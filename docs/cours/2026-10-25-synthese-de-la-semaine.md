# Synthèse de la semaine du 22 au 25 octobre 2026

Dimanche = synthèse de piste : pas de nouveau sujet. Ce document regroupe les fiches par thème, fixe ce qu'il faut avoir **compris et pas seulement lu**, et met le plan à jour. Lecture : 15 minutes.

## 1. Où tu en es (faits, pas impressions)

| Élément | État au 2026-10-25 | Source |
|---|---|---|
| Fiches rédigées | 4 (animations, réseau URL→réponse, avis de dépendance, DHCP) + glossaires et analyse d'examen | dossier `docs/cours/` |
| Questions de calibrage | **aucune réponse reçue** (la PR #47 ne contient aucun commentaire de ta part) | PR #47 |
| Essais d'anglais (« The slow checkout », « The unpatched gateway », sujet blanc n° 1) | **non reçus** | PR #47 |
| Examen d'anglais | lundi 4 janvier 2027 : il reste **71 jours** (10 semaines et 1 jour) | calcul |
| Prochain jalon | test blanc n° 1 le dimanche 8 novembre (dans 14 jours) | `anglais-plan-a2-b2-janvier.md` |

Je ne sais donc pas ce que tu as lu, compris ou fait : « fiche rédigée » ne veut pas dire « acquise ». Aucun statut « acquis » n'est posé dans le tableau de suivi tant que tu n'as pas répondu aux questions de contrôle.

## 2. Les fiches de la semaine, par thème

### Thème A — Comment le navigateur et le réseau traitent une page
- **Repaints et animations** ([`2026-10-22-repaints-et-animations-web.md`](2026-10-22-repaints-et-animations-web.md)) — Mécanisme à retenir : le navigateur enchaîne style, mise en page, peinture, composition. `transform` et `opacity` n'exigent que la composition (déplacer un calque déjà peint) ; animer `background-position` ou une propriété enregistrée par `@property` change le **contenu** du calque et force une repeinture sur le fil principal à chaque image. Le cadre lumineux du hero (`.beam-frame`) est le plus coûteux ; l'aurore (`transform` + flou fixe) l'est peu. La PR #50 de GHOST vise précisément ces animations (non relue par moi).
- **De l'URL à la réponse** ([`2026-10-22-de-l-url-a-la-reponse-dns-tcp-tls-http.md`](2026-10-22-de-l-url-a-la-reponse-dns-tcp-tls-http.md)) — Mécanisme : DNS (nom → adresse), TCP (connexion), TLS (chiffrement, certificat, SNI), HTTP (requête). Défaut relevé dans le code : le garde anti-SSRF vérifie l'IP, puis la connexion résout le nom une seconde fois (issue #48).

### Thème B — Poste de travail et réseau local
- **DHCP côté client** ([`2026-10-24-dhcp-cycle-de-vie-et-adresse-169-254.md`](2026-10-24-dhcp-cycle-de-vie-et-adresse-169-254.md)) — Mécanisme : DISCOVER diffusé, OFFER, REQUEST, ACK ; contrôle ARP et DECLINE ; bail avec T1 = 0,5 et T2 = 0,875 × durée du bail (valeurs par défaut de la RFC 2131) ; repli en 169.254/16 après 3 sondes ARP, jamais routé.

### Thème C — Vulnérabilités et décisions de correction
- **Lire un avis de dépendance** ([`2026-10-23-lire-un-avis-de-vulnerabilite-de-dependance.md`](2026-10-23-lire-un-avis-de-vulnerabilite-de-dependance.md)) — Mécanisme : un outil d'audit compare une version à une plage (`>=10.0.0 <=15.5.27`) ; il ne voit pas ton code. Les versions corrigées sont listées **par branche** ; `^14.2.35` ne franchit pas le majeur, donc il faut changer la plage. Trois questions distinctes : gravité, exploitation, applicabilité.
- **Veille** ([`veille.md`](veille.md)) — Avis consignés cette semaine : Ivanti Connect Secure, Cisco Secure Email Gateway, PAN-OS (deux avis), Windows, Fortinet (deux avis), Citrix ; pile de production : issue #49 ; IA, innovation et TikTok.

### Thème D — Langues et examen
- Examen FEDE : [`anglais-examen-fede-cu-b4-analyse.md`](anglais-examen-fede-cu-b4-analyse.md) (format, grille sur 70, sujet blanc n° 1).
- Plan et calendrier : [`anglais-plan-a2-b2-janvier.md`](anglais-plan-a2-b2-janvier.md) ; parcours global : [`parcours-en-parallele.md`](parcours-en-parallele.md).
- Glossaires : [`anglais-reseau-glossaire.md`](anglais-reseau-glossaire.md), [`anglais-cybersecurite-infra-glossaire-et-cas.md`](anglais-cybersecurite-infra-glossaire-et-cas.md).
- Français : [`francais-orthographe-fiche-1-homophones.md`](francais-orthographe-fiche-1-homophones.md).

## 3. Les six idées à savoir expliquer à voix haute

1. **Composition contre repeinture :** pourquoi `transform` est « gratuit » et pas `background-position`.
2. **Résoudre puis se connecter :** pourquoi deux résolutions DNS successives ouvrent une fenêtre d'attaque.
3. **Plage contre version :** comment un outil dit « vulnérable » en testant l'appartenance à une plage.
4. **Gravité, exploitation, applicabilité :** trois questions, trois sources différentes (score, catalogue d'exploitation, conditions de l'avis).
5. **Le client DHCP a des horloges :** T1, T2, expiration, puis retour au DISCOVER.
6. **169.254 ne sort pas du segment :** conséquence de la norme, utile à chaque ticket « plus de réseau ».

Critère de réussite : tu peux expliquer chacune en une minute, avec les termes exacts, à un collègue qui ne connaît pas le sujet.

## 4. Vocabulaire de la semaine (à réviser par répétition espacée)

| Français | Anglais | Thème |
|---|---|---|
| repeinture, composition | *repaint, composite* | A |
| fil principal | *main thread* | A |
| résolution de nom | *name resolution / DNS lookup* | A |
| poignée de main | *handshake* | A, B |
| plage de versions, version corrigée | *version range, patched version* | C |
| avis de sécurité | *advisory* | C |
| gravité, exploitabilité | *severity, exploitability* | C |
| faux positif | *false positive* | C |
| bail, renouvellement, réassociation | *lease, renewal, rebinding* | B |
| diffusion | *broadcast* | B |
| agent de relais | *relay agent* | B |
| adresse de lien local | *link-local address* | B |

## 5. Révision de la semaine (huit questions, réponses repliées)

1. Pourquoi anime-t-on `transform` plutôt que `background-position` ?
2. Quelles sont les quatre étapes entre une URL et une réponse ?
3. Que contient exactement la requête envoyée à l'API d'avis npm, et que peut-on en déduire ?
4. Pourquoi `npm update` ne règle-t-il pas Next 14.2.35 ?
5. Comment distingues-tu gravité, exploitation et applicabilité ?
6. Quand un client DHCP renouvelle-t-il son bail, et que change-t-il à T2 ?
7. Pourquoi un poste en 169.254.x.x n'atteint-il pas sa passerelle ?
8. Quel est le risque décrit dans l'issue #48 ?

<details>
<summary>Réponses</summary>

1. `transform` déplace un calque déjà peint (composition seule) ; `background-position` change le contenu et force une repeinture.
2. DNS, TCP, TLS, HTTP.
3. Des noms de paquets et des numéros de version seulement ; l'outil teste l'appartenance à une plage et ne sait pas si ton code emprunte le chemin fautif.
4. La plage `^14.2.35` ne franchit pas le majeur et les versions corrigées n'existent que pour les branches 15 et 16 d'après les avis lus.
5. Gravité : le score. Exploitation : catalogue CISA ou déclaration de l'éditeur. Applicabilité : les conditions de l'avis face à ta configuration.
6. À T1 (0,5 × bail) auprès du serveur d'origine ; à T2 (0,875 × bail), en diffusion à n'importe quel serveur.
7. Il n'a pas de passerelle par défaut et les paquets en 169.254 ne sont jamais routés.
8. Le garde SSRF valide une IP, puis la connexion résout le nom de nouveau : le DNS peut renvoyer une autre adresse entre les deux (DNS rebinding).
</details>

## 6. Plan de la semaine du 26 octobre

Rotation fixe : lundi réseau et commutation · mardi Active Directory et Windows Server · mercredi SQL · jeudi sécurité de l'infrastructure · vendredi projet et développement · samedi poste de travail et support · dimanche synthèse.

| Jour | Sujet prévu (provisoire) |
|---|---|
| lun. 26 oct. | **Commutateur et trame vers une adresse MAC inconnue** (table MAC, inondation, apprentissage) |
| mar. 27 oct. | Active Directory : **calibrage** (trois questions) puis ouverture de session et Kerberos |
| mer. 28 oct. | SQL : **calibrage** (trois questions) puis index et plan d'exécution |
| jeu. 29 oct. | Sécurité de l'infrastructure : mécanisme de l'avis le plus marquant de la semaine (candidat : l'interface d'administration exposée, PAN-OS) |
| ven. 30 oct. | Projet : ce que les agents ont livré (PR #45, #46, #50 si fusionnées) |
| sam. 31 oct. | Poste de travail : à fixer d'après tes retours |

Ces sujets sont des propositions. L'anglais n'est pas dans cette rotation mais reste la priorité n° 1 : **ton essai de diagnostic était attendu cette semaine**.

## 7. Ce que j'attends de toi
1. Réponds en commentaire de la PR #47 aux questions de calibrage (au moins la piste anglais et la piste réseau).
2. Envoie tes réponses aux deux études de cas d'anglais, ou dis-moi ce qui bloque (temps, niveau, consigne).
3. Envoie le sujet complet de la session de janvier 2025 et la grille de ton école, si tu les as.
4. Dis-moi ton nombre d'heures par semaine réel : je ne sais pas si le plan à 10 heures est tenable.
