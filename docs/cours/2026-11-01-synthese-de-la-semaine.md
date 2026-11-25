# Synthèse de la semaine du 26 octobre au 1er novembre 2026

Dimanche : pas de nouveau sujet. Les six fiches de la semaine, regroupées par thème, avec ce qu'il faut savoir expliquer à voix haute et ce qui reste à confirmer. Lecture : 15 à 20 minutes.

## 1. Les fiches, par thème

### Réseau et poste de travail
| Fiche | Le mécanisme à savoir expliquer |
|---|---|
| [2026-10-26 Commutateur : trame vers MAC inconnue](2026-10-26-commutateur-trame-vers-mac-inconnue.md) | Le commutateur **apprend** l'adresse MAC source par VLAN ; destination inconnue → **inondation** dans le VLAN sauf le port d'entrée ; entrée **vieillie** après un délai (300 s par défaut dans la doc Catalyst 9500 citée, selon la plateforme) ; **table MAC ≠ table ARP**. |
| [2026-10-31 Numéro de build Windows](2026-10-31-numero-de-build-windows-suis-je-corrige.md) | `10.0.<build>.<révision>` : le build désigne le produit, la **révision (UBR)** le niveau de correctifs ; un seuil NVD `versionEndExcluding` est **exclu** (à la valeur du seuil, la machine est corrigée). |
| [2026-10-24 DHCP côté client](2026-10-24-dhcp-cycle-de-vie-et-adresse-169-254.md) (semaine précédente, rappel) | DISCOVER / OFFER / REQUEST / ACK ; T1 = 0,5 et T2 = 0,875 du bail (RFC 2131) ; repli en 169.254/16 (RFC 3927, jamais routé). |

### Active Directory et SQL
| Fiche | Le mécanisme à savoir expliquer |
|---|---|
| [2026-10-27 Kerberos](2026-10-27-kerberos-ouverture-de-session-et-horloge.md) | Le contrôleur de domaine joue le rôle de KDC ; échanges AS puis TGS puis AP ; pré-authentification par horodatage chiffré ; tolérance d'horloge de **5 minutes** ; événements 4768 / 4771 et codes de résultat. |
| [2026-10-28 SQL : index et EXPLAIN](2026-10-28-sql-index-et-plan-d-execution.md) | Un index B-tree change le **plan** (`type`, `key`, `rows`) ; préfixe gauche ; `rows` est une **estimation** ; `EXPLAIN` (plan estimé) contre `ANALYZE` (exécution réelle). |

### Sécurité de l'infrastructure
| Fiche | Le mécanisme à savoir expliquer |
|---|---|
| [2026-10-29 PHP puis noyau Linux vers root](2026-10-29-enchainement-php-noyau-linux-vers-root.md) | Une **chaîne** : un premier maillon distant donne un accès limité, un second (élévation locale) donne root. Le score d'une CVE seule sous-estime la chaîne. Lecture d'un vecteur CVSS 3.1 champ par champ. |
| Veille du 2026-10-31 (Ivanti) | Même schéma que ci-dessus : CVE-2026-104935 (distant) + CVE-2026-118527 + CVE-2026-111357 (root local), d'après le catalogue CISA. |

### Projet et développement
| Fiche | Le mécanisme à savoir expliquer |
|---|---|
| [2026-10-30 Relire une PR de performance](2026-10-30-relire-une-pr-de-performance.md) | Lire un diff puis un tableau avant/après : **une mesure unique ne prouve pas** ; moyenne contre p95 ; `transform`/`opacity` composités sans repeindre ; `will-change` en dernier recours. |

## 2. Fil rouge de la semaine

Trois idées reviennent d'une fiche à l'autre :
1. **Lire la valeur exacte, pas l'étiquette.** « Windows Server 2019 » ne dit rien ; `17763.9245` oui. « Rien à signaler » sur une page ne dit rien ; une version lue, oui.
2. **Estimation contre mesure.** `rows` d'EXPLAIN, ancienneté d'une entrée MAC, une mesure de performance unique : ce sont des indices, à confirmer.
3. **Un maillon ne fait pas une chaîne, mais une chaîne dépasse la somme de ses scores.** PHP + noyau, puis Ivanti.

## 3. Mise en situation : un diagnostic qui mobilise toute la semaine

Un utilisateur dit : « Je n'arrive plus à ouvrir mon dossier partagé depuis ce matin. »
- **Réseau** : a-t-il une adresse valide ou une 169.254.x.x ? (DHCP)
- **Active Directory** : le message d'erreur parle-t-il d'authentification ? Y a-t-il un événement 4768/4771 côté contrôleur de domaine, ou un écart d'horloge ? (Kerberos)
- **Poste de travail** : quel est le build du poste, et du serveur de fichiers ? (build Windows)
- **Base de données** : si l'application lente interroge une base, `EXPLAIN` montre-t-il un parcours complet de table ? (SQL)

Écris, en trois phrases, l'ordre dans lequel tu vérifierais ces quatre points et pourquoi.

<details><summary>Une réponse possible (la tienne peut différer)</summary>

On part de ce qui est le moins coûteux et le plus bas dans la pile : l'adresse IP (sans adresse valide, rien d'autre ne compte), puis le nom et l'horloge (Kerberos dépend des deux), puis l'authentification côté contrôleur de domaine, enfin le serveur de fichiers et son niveau de correctifs. SQL n'entre en jeu que si l'application, et non l'accès au dossier, est en cause.
</details>

## 4. Contrôle : quatre questions de la semaine

1. Quelle est la différence entre la table MAC et la table ARP ?
2. Pourquoi un décalage d'horloge de plus de 5 minutes casse-t-il Kerberos ?
3. `EXPLAIN` annonce `rows = 2`. Est-ce un nombre mesuré ?
4. Une CVE a un seuil `versionEndExcluding 10.0.17763.9376`. Que dis-tu d'une machine en `9376` ?

<details><summary>Réponses</summary>

1. MAC : « sur quel port est cette adresse MAC ? » (couche 2, appris sur les trames reçues). ARP : « quelle adresse MAC correspond à cette adresse IP ? ». 2. Le ticket est protégé par un horodatage : le serveur le refuse s'il est trop éloigné de son horloge (tolérance de 5 minutes par défaut). 3. Non, c'est une estimation du moteur. 4. Corrigée : la borne est exclue.
</details>

## 5. Mise à jour du plan

- **Réseau et commutation (lundi 2 novembre)** : niveau « comprendre » ; prochain mécanisme : **étiquette 802.1Q et VLAN natif** (ce que contient l'étiquette, ce qui fuit quand le VLAN natif ne correspond pas aux deux bouts d'un trunk).
- **Active Directory (mardi 3)** : calibrage **toujours sans réponse**. En attendant, je reste au niveau de départ ; prochain sujet possible : de quoi est faite une ouverture de session réseau (NTLM contre Kerberos), à confirmer avec tes réponses.
- **SQL (mercredi 4)** : même situation ; prochain sujet : jointures et ce que `EXPLAIN` en dit.
- **Anglais** : test blanc n°1 prévu le dimanche **8 novembre** (cf. `anglais-plan-a2-b2-janvier.md`). Je n'ai reçu aucun essai ni cas rédigé à ce jour : sans copie, je ne peux pas estimer ton niveau.
- **À me renvoyer** (une ligne par point suffit) : réponses aux calibrages AD et SQL ; nombre d'heures par semaine réellement disponibles ; sujet complet et grille de ton examen.

## 6. Sources

Toutes les affirmations techniques renvoient aux sources citées dans chaque fiche liée. Aucune source nouvelle consultée pour cette synthèse, hors le catalogue CISA (`catalogVersion` 2026.10.30, relu le 2026-11-01 : aucune nouvelle entrée par rapport à hier) et l'état des PR et issues du dépôt (lu le 2026-11-01).
