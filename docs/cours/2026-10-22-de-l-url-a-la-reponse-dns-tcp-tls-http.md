# Fiche n° 2 — De l'URL à la réponse : DNS, TCP, TLS, HTTP, lus dans le moteur d'audit

Piste 2 (réseau et système), niveau 1 vers 2, avec un pied dans la piste 3 (sécurité). Lecture : 30 minutes, exercice compris.

## 1. Ce qui est passé dans le projet aujourd'hui, et pourquoi ça vaut un cours

SentinelScope **visite l'URL qu'un utilisateur lui donne**. Tout le produit repose donc sur ce qui se passe entre « j'ai une adresse » et « j'ai une réponse » : traduire un nom en adresse, ouvrir une connexion, la chiffrer, envoyer une requête, lire une réponse. Chaque étape a ses pannes, ses lenteurs et ses risques. En lisant `sentinelscope/audit-engine/src/modules/http-client.js`, `ssl.js` et `lib/ssrf-guard.js`, on retrouve ces étapes une par une, et un défaut réel : issue #48 (résolution DNS faite deux fois). C'est un bon cours parce que le code que tu fais relire par le CEO est exactement celui-là.

## 2. Le concept, du simple au précis

Quand le moteur audite `https://exemple.fr/page`, voici ce qui se passe, dans l'ordre :

1. **DNS (Domain Name System)** — l'ordinateur ne sait pas se connecter à un *nom*, seulement à une *adresse IP*. Il demande à un annuaire (le DNS) : « quelle IP pour `exemple.fr` ? ». La réponse peut contenir **plusieurs** adresses (IPv4 et IPv6) et vient avec une durée de validité, le **TTL** (*time to live*). Une réponse peut donc **changer d'un appel à l'autre**.
2. **TCP (Transmission Control Protocol)** — avec l'IP et un port (443 pour HTTPS), on ouvre une connexion fiable : les octets arrivent dans l'ordre et sans perte. L'ouverture se fait par un échange en trois temps (*three-way handshake*, de mémoire : SYN, SYN-ACK, ACK).
3. **TLS (Transport Layer Security)** — par-dessus TCP, client et serveur négocient une version de protocole et un algorithme de chiffrement (*cipher*), et le serveur présente un **certificat** qui prouve son identité. Le client envoie aussi le nom visé (**SNI**, *Server Name Indication*), parce qu'un même serveur peut héberger plusieurs sites avec des certificats différents.
4. **HTTP** — enfin la requête applicative. D'après MDN, « HTTP is stateless: there is no link between two requests being successively carried out on the same connection », et il est envoyé « over TCP, or over a TLS-encrypted TCP connection » ; une requête contient une méthode, un chemin, une version, des en-têtes optionnels et parfois un corps.

(HTTP/3 utilise un autre transport, QUIC, au-dessus d'UDP ; je l'indique de mémoire, sans l'avoir vérifié aujourd'hui, et ce n'est pas utilisé par le moteur d'audit.)

À chaque étape, un **délai d'attente** (*timeout*) est nécessaire : un serveur peut ne jamais répondre. Sans lui, l'outil attend indéfiniment.

## 3. Le code réel du dépôt

### 3.1 Ouvrir et fermer proprement : `http-client.js`

```js
const lib = url.protocol === 'https:' ? https : http;            // l.53 : TLS ou clair, selon le schéma
...
hostname: url.hostname,                                          // l.59 : on donne un NOM, pas une IP
port: url.port || (url.protocol === 'https:' ? 443 : 80),        // l.60 : ports par défaut
...
'Accept-Encoding': 'identity',                                   // l.67 : pas de compression à gérer
Connection: 'close',                                             // l.68 : une connexion par requête
```

- `hostname: url.hostname` : on passe un **nom**. Node va donc faire la résolution DNS lui-même, **au moment de la connexion**. Retiens ce point, il sert en 3.3.
- `Connection: close` : on ne réutilise pas la connexion. C'est simple et sûr pour un audit ; on perd la rapidité des connexions réutilisées.

```js
const maxContentLength = options.maxContentLength || 5 * 1024 * 1024;   // l.55 : 5 Mo max
...
if (size > maxContentLength) { aborted = true; res.destroy(); return; }  // l.114-117
```

Plafond de taille : sans lui, un site malveillant pourrait envoyer un flux sans fin et saturer la mémoire.

```js
req.setTimeout(timeout, () => {                                   // l.144
  req.destroy(new Error('Timeout après ' + timeout + ' ms'));
});
```

Le commentaire du fichier annonce un « timeout dur » (l.11). Or la documentation Node dit que l'événement `'timeout'` est « emitted when the underlying socket times out from inactivity » et que `setTimeout` règle le délai de la socket. Un délai d'**inactivité** n'est pas un délai **total** : un serveur qui envoie un octet toutes les 11 secondes sur un délai de 12 s ne le déclenche jamais, et la requête n'est arrêtée que par le plafond de 5 Mo. Ce n'est pas catastrophique ici, mais « timeout dur » est inexact. Je n'ai pas testé : l'exercice 5 te le fait vérifier.

```js
if (REDIRECT_CODES.has(status) && res.headers.location && maxRedirects > 0) {   // l.82-86
  ...
  ssrfGuard.assertPublicTarget(nextUrl).then(...)                // l.92 : on re-valide chaque redirection
```

Un site public peut répondre `301` vers une adresse interne. Le code re-valide donc la cible à chaque saut et limite à 5 sauts : bon réflexe.

### 3.2 Inspecter le certificat : `ssl.js`

```js
const socket = tls.connect({
  host, port,
  servername: host,            // l.37 : SNI
  rejectUnauthorized: false,   // l.40 : on N'interrompt PAS sur un certificat invalide
  timeout,
}, () => {
  const cert = socket.getPeerCertificate(true);
  const protocol = socket.getProtocol();        // 'TLSv1.3'...
  const cipher = socket.getCipher();
  const authorized = socket.authorized;
  ...
```

`rejectUnauthorized: false` est *normalement* une faute grave : le client accepte n'importe quel certificat, donc ne se protège plus contre l'interception. Ici c'est voulu et justifié par le commentaire (l.38-39) : l'outil **veut inspecter** un certificat expiré ou invalide pour le signaler (`socket.authorized` indique ensuite si le certificat est valide). La règle à retenir en revue : cette option est acceptable dans un outil d'audit qui ne transmet aucun secret, jamais dans un client qui envoie des identifiants ou des données. Si une PR la copie ailleurs, c'est à refuser.

```js
case 'TLSv1.3': return { note: 100, obsolete: false };   // l.72-73
case 'TLSv1.2': return { note: 90,  obsolete: false };
case 'TLSv1.1': return { note: 40,  obsolete: true };
case 'TLSv1':   return { note: 20,  obsolete: true };
```

La note par version est un choix de produit du dépôt (pas une norme) ; elle illustre qu'on peut déduire l'âge d'une configuration serveur de la version négociée.

### 3.3 Le garde anti-SSRF : `ssrf-guard.js` et le défaut de l'issue #48

SSRF (*server-side request forgery*) : faire visiter à **ton** serveur une adresse que l'attaquant ne peut pas atteindre lui-même (réseau interne, service de métadonnées du cloud en `169.254.169.254`). Le garde résout le nom et refuse les IP privées :

```js
records = await dns.lookup(host, { all: true });     // l.111 : résolution (étape 1)
...
for (const r of records) {                           // l.118-123 : TOUTES les IP sont vérifiées
  if (r.family === 4 && isPrivateV4(r.address)) return { ok: false, ... };
```

- `dns.lookup` « uses the operating system facilities to perform name resolution », via `getaddrinfo(3)` (documentation Node) ; les autres fonctions du module `dns`, comme `resolve`, interrogent directement un serveur DNS.
- `all: true` renvoie **toutes** les adresses : bon, un nom peut en avoir plusieurs, dont une privée.
- Les plages bloquées (`PRIVATE_V4`) correspondent aux adresses privées, de boucle locale (127.0.0.0/8), de lien local (169.254.0.0/16, où se trouvent les métadonnées cloud), etc.

**Le défaut.** Le garde vérifie l'IP, puis `http-client.js` rappelle `https.request({ hostname })` qui **résout le nom une seconde fois**. Entre les deux, la réponse DNS peut changer (TTL très court) : l'attaquant fait renvoyer d'abord une IP publique (le garde est satisfait), puis une IP interne (la connexion part là-bas). L'OWASP écrit : « A second, unchecked DNS lookup between validation and connection can bypass these checks » et recommande de se connecter à l'IP validée en conservant le nom pour l'en-tête `Host`, le SNI et la vérification du certificat. Je n'ai pas reproduit l'attaque : c'est un raisonnement appuyé sur la documentation, formulé dans l'issue #48 sans modifier le code.

## 4. Ce qui arrive quand on le fait mal — symptômes observables

| Erreur | Symptôme |
|---|---|
| Pas de délai d'attente | l'audit « tourne » indéfiniment, la file d'attente se bloque |
| Délai d'inactivité pris pour un délai total | des audits très lents mais « vivants » monopolisent des ressources |
| Pas de plafond de taille | mémoire qui gonfle, processus tué par le système |
| DNS résolu deux fois sans figer l'IP | le garde SSRF est contournable par un attaquant qui contrôle son DNS |
| Redirections suivies sans re-validation | un site public redirige l'outil vers le réseau interne |
| `rejectUnauthorized: false` dans un client « normal » | interception possible sans aucune alerte |
| Erreur `ENOTFOUND` / `Could not resolve host` | le nom ne se traduit pas : DNS (étape 1) |
| `ECONNREFUSED` / `Connection refused` | l'IP répond mais rien n'écoute sur ce port (étape 2) |
| `CERT_HAS_EXPIRED` / certificat expiré | étape 3 |

(Les noms d'erreurs `ENOTFOUND` et `ECONNREFUSED` sont des codes courants de Node ; je les cite de mémoire.)

## 5. Exercice sur le dépôt

Durée : 10 à 12 minutes. À faire **uniquement sur ton propre site** (`sentrylescope.fr`) : on n'audite aucun site tiers.

1. Dans un terminal : `dig sentrylescope.fr` (ou `nslookup sentrylescope.fr`). Repère l'enregistrement **A** et le **TTL**. Note les adresses obtenues.
2. `curl -v https://sentrylescope.fr 2>&1 | head -40`. Repère, dans l'ordre : la résolution (`Trying …`), la connexion TCP (`Connected to`), le handshake TLS (version et cipher), la requête HTTP, le code de réponse.
3. `openssl s_client -connect sentrylescope.fr:443 -servername sentrylescope.fr </dev/null 2>/dev/null | head -20` : retrouve la chaîne de certificats et le protocole négocié. Compare avec ce que `ssl.js` renvoie.
4. Lis `ssrf-guard.js` et `http-client.js`. Dessine sur papier la ligne du temps d'un audit avec les **deux** résolutions DNS (celle du garde, celle de `https.request`).
5. (Optionnel) Écris un petit script de test **hors du dépôt**, dans un dossier à toi, qui démarre un serveur Node local lent (il envoie un octet toutes les 5 secondes) et appelle `http-client.get` avec `timeout: 12000`. Observe si la requête s'arrête à 12 s. Sers-toi de cette observation pour juger l'affirmation « timeout dur ».

**Question :** quel était le problème de l'issue #48, et comment le corrigerais-tu (en une phrase, sans écrire de code) ?

<details>
<summary>Solution</summary>

Le garde SSRF valide une IP, puis la connexion résout le nom de nouveau : entre les deux, le DNS peut renvoyer une autre IP (DNS rebinding). Correction : résoudre **une seule fois**, valider cette IP, puis connecter **à cette IP précise** (option `lookup` de `http.request`/`tls.connect` qui renvoie l'adresse validée), en conservant le nom d'hôte pour l'en-tête `Host`, le SNI et la vérification du certificat. Appliquer la même règle aux redirections.

Pour l'étape 5 : si la requête dépasse largement 12 secondes tant que le serveur envoie des octets, le délai est bien un délai d'inactivité, pas un délai total. Un vrai délai total s'obtient avec un minuteur global (`setTimeout` autour de toute la requête, ou `AbortSignal.timeout`) qui détruit la requête quoi qu'il arrive.
</details>

## 6. Anglais technique

### 6.1 Termes du jour (14)

| Anglais | Français | Prononciation / note |
|---|---|---|
| resolve (a name) | résoudre (un nom) | ri-**zolv** ; *resolution* = résolution |
| lookup | recherche (DNS) | **louk**-eup |
| handshake | poignée de main (négociation) | **hand**-chèïk |
| certificate | certificat | seur-**ti**-fi-kit |
| cipher | algorithme de chiffrement | **saï**-feur (le c = s) |
| inactivity | inactivité | |
| idle | inactif, au repos | **aï**-d'l |
| redirect | redirection | |
| payload | charge utile | **pèï**-lod |
| hang (a request hangs) | se bloquer, rester suspendu | **hang** |
| allowlist | liste d'autorisation | préférée à « whitelist » |
| bypass | contourner | **baï**-pas |
| loopback | boucle locale (127.0.0.1) | **loup**-bak |
| metadata service | service de métadonnées (cloud) | |

### 6.2 Paragraphe à traduire

Source : OWASP, *Server-Side Request Forgery Prevention Cheat Sheet* (consultée le 2026-10-22). Phrase reprise telle que restituée par la page : « A second, unchecked DNS lookup between validation and connection can bypass these checks ». Traduis, puis traduis cette consigne de la même page : « Apply the destination policy to retries and fallback connections as well. »

Mon texte d'entraînement supplémentaire (écrit par moi, pas une citation) :

> The tool resolves the hostname once and checks every address that comes back. If one of them is private, the request is refused. However, the connection library resolves the name again before connecting, so the answer may have changed in the meantime. The safest fix is to connect directly to the address that was checked.

<details>
<summary>Traductions</summary>

- « Une seconde résolution DNS non vérifiée entre la validation et la connexion peut contourner ces contrôles. »
- « Appliquez la politique de destination aux nouvelles tentatives et aux connexions de repli aussi. »
- Texte d'entraînement : « L'outil résout le nom d'hôte une fois et vérifie chaque adresse renvoyée. Si l'une d'elles est privée, la requête est refusée. Cependant, la bibliothèque de connexion résout de nouveau le nom avant de se connecter, donc la réponse a pu changer entre-temps. La correction la plus sûre est de se connecter directement à l'adresse qui a été vérifiée. »
</details>

### 6.3 Trois formulations réutilisables

1. « The name is resolved twice, so the check and the connection may use different addresses. » — *Le nom est résolu deux fois, donc le contrôle et la connexion peuvent utiliser des adresses différentes.*
2. « This is a theoretical risk; I haven't reproduced it, but the documentation describes this exact scenario. » — *Risque théorique : je ne l'ai pas reproduit, mais la documentation décrit exactement ce scénario.*
3. « Could we connect to the validated IP and keep the hostname for SNI and the Host header? » — *Pourrait-on se connecter à l'IP validée en gardant le nom pour le SNI et l'en-tête Host ?*

## 7. Trois questions de contrôle

1. Dans l'ordre, quelles sont les quatre étapes entre une URL et une réponse ?
2. Pourquoi `rejectUnauthorized: false` est-il acceptable dans `ssl.js` et dangereux dans un client qui envoie des mots de passe ?
3. Pourquoi un délai d'inactivité ne protège-t-il pas contre un serveur qui répond très lentement mais sans s'arrêter ?

<details>
<summary>Réponses</summary>

1. DNS (nom → IP), TCP (connexion), TLS (chiffrement et certificat), HTTP (requête et réponse).
2. Dans `ssl.js`, l'outil veut lire un certificat même invalide pour le signaler et n'envoie aucun secret. Dans un client qui envoie des identifiants, accepter n'importe quel certificat permet à un intermédiaire de se faire passer pour le serveur et de lire ou modifier l'échange.
3. Parce que chaque octet reçu remet le compteur à zéro : tant que le serveur envoie quelque chose avant la fin du délai, il n'y a pas de dépassement, même si l'ensemble dure très longtemps. Il faut un délai total en plus.
</details>

## 8. Sources (consultées le 2026-10-22)

- Node.js, module `dns` : https://nodejs.org/api/dns.html — `dns.lookup` passe par `getaddrinfo(3)` ; `resolve` interroge un serveur DNS ; option `all`.
- Node.js, module `http` : https://nodejs.org/api/http.html — événement `'timeout'` émis sur inactivité de la socket ; `request.setTimeout`. L'option `timeout` de `http.request` n'a pas pu être lue (page tronquée).
- OWASP, SSRF Prevention Cheat Sheet : https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html — résolution DNS seconde non vérifiée, connexion à l'IP validée avec conservation du nom ; la page ne dit pas explicitement de re-valider les redirections (elle recommande de les désactiver).
- MDN, aperçu de HTTP : https://developer.mozilla.org/en-US/docs/Web/HTTP/Overview — HTTP sans état, transporté par TCP ou TLS sur TCP, composition d'une requête.
- Dépôt : `sentinelscope/audit-engine/src/modules/http-client.js`, `src/modules/ssl.js`, `src/lib/ssrf-guard.js`, `sentinelscope/app/api/audit/route.js:181`. Issue #48.
- Non vérifié aujourd'hui (de mémoire) : détail du handshake TCP en trois temps, rôle exact du SNI, HTTP/3 sur QUIC, noms d'erreurs Node `ENOTFOUND`/`ECONNREFUSED`.
