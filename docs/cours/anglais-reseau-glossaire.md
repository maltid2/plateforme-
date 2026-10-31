# Anglais technique du réseau — glossaire et méthode

Piste 4, niveaux 1 à 3, centrée réseau. Rédigé le 2026-10-22 à la demande d'Aymerick : « devenir expert, avec tous les mots en particulier ».

## Comment lire ce document

Ce n'est pas un texte à lire une fois : c'est une **liste de travail**. Un glossaire de ~90 termes se retient en y revenant (voir la méthode en fin de document), pas en le lisant d'une traite.

Statut des informations :
- **Vérifié le 2026-10-22** : les intitulés officiels des codes HTTP 301, 302, 400, 401, 403, 404, 500, 502, 503, 504 (RFC 9110).
- **Définitions et prononciations** : ce sont des définitions standard du métier, écrites de mémoire. Je n'ai pas lu les pages de définition correspondantes aujourd'hui (le glossaire MDN contient bien des entrées TCP, UDP, DNS, latency, bandwidth, packet, CDN, firewall, TTL ; je n'ai lu que leurs titres). Si une définition te semble douteuse, dis-le-moi : je la recoupe avec la source.
- **Prononciation** : notation simplifiée « à la française », accent sur la syllabe en **gras**. Elle ne remplace pas l'écoute : pour chaque mot piège, écoute-le sur un dictionnaire en ligne (Cambridge, Merriam-Webster, Forvo).

## 1. Les mots du chemin d'une requête

| Anglais | Français | Prononciation / piège | Sens en une ligne |
|---|---|---|---|
| client | client | **klaï**-eunt | le programme qui demande (navigateur, `curl`) |
| server | serveur | **seur**-veur | le programme qui répond |
| request / response | requête / réponse | ri-**kwest** / ri-**sponce** | un message demandé, un message renvoyé |
| endpoint | point d'accès (d'une API) | **end**-point | une URL précise qui offre un service |
| host / hostname | hôte / nom d'hôte | **host** (le h se prononce) | la machine, ou son nom (`sentrylescope.fr`) |
| domain | domaine | do-**mèïne** | le nom de plus haut niveau que tu possèdes |
| subdomain | sous-domaine | **seub**-do-mèïne | `www.` dans `www.exemple.fr` |
| URL | adresse web | ïou-ar-**el** | adresse complète : schéma, hôte, chemin, paramètres |
| path | chemin | **path** (th sourd) | la partie après l'hôte (`/api/audit`) |
| query string | paramètres d'URL | **kwi**-ri string | ce qui suit le `?` |
| IP address | adresse IP | aï-**pi** | numéro d'une machine sur le réseau |
| port | port | **pôrt** | numéro de la « porte » d'un service (443 pour HTTPS) |
| socket | connecteur réseau | **sok**-ite | un point de communication ouvert |
| protocol | protocole | **pro**-to-kol (accent sur *pro*) | les règles d'une conversation (HTTP, TCP) |
| stack | pile | **stak** | les couches empilées (*network stack*) |
| layer | couche | **lè**-yeur | un niveau de la pile (modèle OSI : 7 couches) |

## 2. DNS

| Anglais | Français | Piège | Sens |
|---|---|---|---|
| DNS (Domain Name System) | système de noms de domaine | on épelle D-N-S | annuaire qui traduit un nom en adresse IP |
| resolver | résolveur | ri-**zol**-veur | serveur qui fait la traduction pour toi |
| nameserver | serveur de noms | **nèïm**-seurveur | serveur qui fait autorité sur un domaine |
| record | enregistrement | **rè**-kord (nom) / ri-**kord** (verbe) | une ligne de l'annuaire |
| A record / AAAA record | enregistrement A / AAAA | « eï record », « quad-eï » | nom → IPv4 / nom → IPv6 |
| CNAME | alias de nom | **si**-nèïm | un nom qui pointe vers un autre nom |
| MX | enregistrement de messagerie | em-ex | où livrer le courrier du domaine |
| TXT | enregistrement texte | ti-ex-ti | texte libre (vérifications, SPF) |
| TTL (time to live) | durée de vie | ti-ti-el | temps pendant lequel une réponse peut être gardée en cache |
| propagation | propagation | pro-pa-**guèï**-cheune | délai avant que tout le monde voie un changement de DNS |
| lookup | recherche, résolution | **louk**-eup | une requête DNS |

## 3. Transport : TCP, UDP, TLS

| Anglais | Français | Piège | Sens |
|---|---|---|---|
| TCP | TCP (transport fiable) | ti-si-pi | livre les données dans l'ordre, sans perte |
| UDP | UDP (transport rapide) | ïou-di-pi | envoie sans garantie ni ordre |
| packet | paquet | **pa**-kit | un petit morceau de données qui voyage |
| handshake | poignée de main (établissement) | **hand**-chèïk | les échanges initiaux pour s'entendre |
| connection | connexion | keu-**nek**-cheune | lien établi entre deux machines |
| TLS (Transport Layer Security) | sécurité de la couche transport | ti-el-es | chiffre la connexion (le « S » de HTTPS) |
| SSL | ancêtre de TLS | es-es-el | nom qu'on emploie encore par habitude |
| certificate | certificat | seur-**ti**-fi-kit | pièce d'identité d'un serveur |
| cipher | algorithme de chiffrement | **saï**-feur | le « c » se prononce « s » |
| encryption | chiffrement | in-**kripe**-cheune | rendre illisible sans clé |
| expired / revoked | expiré / révoqué | iks-**païe**-erd / ri-**vôkt** | état d'un certificat invalide |

## 4. HTTP

| Anglais | Français | Sens |
|---|---|---|
| method / verb | méthode / verbe | `GET`, `POST`, `PUT`, `DELETE` |
| header | en-tête | métadonnée d'une requête ou réponse |
| body / payload | corps / charge utile | le contenu transporté |
| status code | code d'état | nombre qui résume le résultat |
| redirect | redirection | « va voir ailleurs » (301, 302) |
| cookie | cookie | petit fichier gardé par le navigateur (se prononce **kou**-ki) |
| cache | cache | copie gardée pour aller plus vite (se prononce **cash**, pas « cache-é ») |
| stateless | sans état | chaque requête est indépendante |
| idempotent | idempotent | refaire l'appel donne le même résultat que le faire une fois (**aï**-dem-**pô**-tent) |
| payload too large | contenu trop gros | refus d'un corps trop volumineux |

### Codes d'état : intitulés officiels

Vérifiés dans la RFC 9110 « HTTP Semantics » (juin 2022, norme Internet), consultée le 2026-10-22.

| Code | Intitulé officiel (anglais) | À retenir |
|---|---|---|
| 301 | Moved Permanently | déplacé définitivement |
| 302 | Found | déplacé temporairement (le nom prête à confusion) |
| 400 | Bad Request | requête malformée |
| 401 | Unauthorized | **non authentifié** malgré le nom |
| 403 | Forbidden | authentifié mais interdit |
| 404 | Not Found | introuvable |
| 500 | Internal Server Error | bug côté serveur |
| 502 | Bad Gateway | le relais a reçu une mauvaise réponse en amont |
| 503 | Service Unavailable | indisponible (surcharge, maintenance) |
| 504 | Gateway Timeout | le relais n'a pas reçu de réponse à temps |

Le code **429** « Too Many Requests » (trop de requêtes, limitation de débit) n'était pas dans la portion de RFC que j'ai pu lire : je l'indique sans l'avoir vérifié aujourd'hui.

## 5. Performance et fiabilité

| Anglais | Français | Piège / sens |
|---|---|---|
| latency | latence | **lèï**-ten-ci : temps d'un aller-retour |
| bandwidth | bande passante | **band**-width : volume possible par seconde |
| throughput | débit effectif | **throu**-pout : ce qui passe réellement |
| round trip | aller-retour | durée requête + réponse |
| timeout | délai d'attente dépassé | **taïm**-aoute |
| retry | nouvelle tentative | ri-**traï** |
| backoff | attente croissante entre tentatives | **bak**-off |
| rate limit | limitation de débit | combien de requêtes par minute |
| throttle | brider | **thrott'l** (th sourd) |
| load balancer | répartiteur de charge | **lôd** **bal**-eun-ceur |
| CDN (content delivery network) | réseau de diffusion de contenu | si-di-en |
| uptime / downtime | disponibilité / indisponibilité | **eup**-taïme |
| outage | panne | **aoute**-idj |
| bottleneck | goulot d'étranglement | **bot**-'l-nek |

## 6. Sécurité réseau

| Anglais | Français | Sens |
|---|---|---|
| firewall | pare-feu | filtre le trafic autorisé |
| proxy | mandataire, relais | intermédiaire (se dit **prok**-si) |
| reverse proxy | proxy inverse | placé devant un serveur (ex. nginx) |
| allowlist / blocklist | liste autorisée / bloquée | préfère ces termes à « whitelist/blacklist » |
| spoofing | usurpation | se faire passer pour quelqu'un d'autre |
| man-in-the-middle (MITM) | attaque de l'homme du milieu | un intermédiaire intercepte l'échange |
| denial of service (DoS) | déni de service | saturer pour rendre indisponible |
| SSRF (server-side request forgery) | falsification de requête côté serveur | faire visiter au serveur une adresse interne |
| exposure | exposition | ce qui est visible depuis Internet |
| attack surface | surface d'attaque | **a**-tak **seur**-fis : l'ensemble de ce qui peut être attaqué |
| mitigation | atténuation | mi-ti-**guèï**-cheune : réduire un risque sans le supprimer |
| patch | correctif | **patch** |

## 7. Phrases du métier à savoir lire et écrire

Lecture :
- « The connection was reset by peer. » → la connexion a été coupée par l'autre bout.
- « Request timed out after 10 seconds. » → délai de 10 s dépassé.
- « The certificate has expired. » → le certificat a expiré.
- « Could not resolve host. » → le nom n'a pas pu être traduit en adresse (DNS).
- « Connection refused. » → rien n'écoute sur ce port.
- « Name or service not known. » → même famille : le nom est inconnu.

Écriture (PR, issue, revue) :
1. « This fails with a 502 when the upstream times out; should we add a retry with backoff? »
2. « Could you add a timeout here? A hanging request would block the worker. »
3. « Nit: please use an allowlist rather than a blocklist for these hosts. »

## 8. Méthode pour devenir expert, pas juste connaisseur

1. **10 mots par jour, pas plus.** Choisis dans ce glossaire ; écris chaque mot dans une phrase à toi, en anglais, qui parle de SentinelScope.
2. **Répétition espacée.** Revois un mot le lendemain, 3 jours, 7 jours, 21 jours. Un mot revu 4 fois est acquis ; un mot lu 1 fois ne l'est pas. Un tableur ou des cartes (Anki) suffisent ; je peux préparer un fichier d'import si tu veux.
3. **Lis la source, pas le résumé.** Une page MDN ou une RFC par semaine, en anglais, sans traduire d'abord : souligne ce que tu ne comprends pas, puis cherche.
4. **Parle à voix haute.** Prononciation : écoute le mot, répète-le trois fois. Les pièges de ce document (th, h, c/s) se corrigent à l'oral, pas à l'écrit.
5. **Écris en anglais dans les PR.** Chaque fiche te donne trois formulations à réutiliser. C'est là que le vocabulaire devient actif.
6. **Contrôle de niveau.** Toutes les deux semaines, je te propose un texte réel (avis de sécurité, note de version) à traduire sans dictionnaire et je note les mots qui bloquent.

Objectif réaliste : « expert » est un horizon, pas une date. Avec 10 mots par jour et 20 minutes de lecture technique en anglais quotidiennes, le niveau 3 (écrire une PR claire en anglais) est atteignable en quelques mois ; je ne peux pas te donner une durée exacte sans connaître ton point de départ, c'est ce que le calibrage mesure.

## Sources (consultées le 2026-10-22)

- RFC 9110, HTTP Semantics : https://www.rfc-editor.org/rfc/rfc9110.html — intitulés des codes d'état, statut de norme. Les définitions de « safe » et « idempotent » n'ont pas pu être lues (page tronquée), je n'en cite donc pas la formulation officielle.
- MDN Web Docs, Glossary : https://developer.mozilla.org/en-US/docs/Glossary — présence des entrées TCP, UDP, DNS, latency, bandwidth, packet, CDN, firewall, TTL ; titres seulement, définitions non lues.
