# Synthèse de la semaine du 9 au 15 novembre 2026

Dimanche : pas de nouveau sujet de fond. Les six fiches de la semaine regroupées par thème, un fil rouge, une mise en situation, un **bloc d'anglais** (nouveau texte à trous, tiré d'un avis réel lu cette semaine), puis le plan mis à jour. Lecture : 20 à 25 minutes.

## 1. Les fiches de la semaine, par thème

### Réseau et poste de travail
| Fiche | Le mécanisme à savoir expliquer |
|---|---|
| [2026-11-09 STP : élection du pont racine](2026-11-09-stp-election-du-pont-racine.md) | Le BID (priorité, identifiant de système étendu, MAC) ; chaque commutateur se croit racine puis garde le plus petit identifiant de racine reçu ; priorité par pas de 4096 (12 bits pris par le n° de VLAN) ; à priorité égale, la plus petite MAC gagne ; coût de chemin et rôles des ports. Source : cours Cisco NetAcad (copie hébergée par une université, source secondaire). |
| [2026-11-14 Stratégies de groupe : `gpresult` et `gpupdate`](2026-11-14-strategies-de-groupe-gpresult-et-gpupdate.md) | La portée (utilisateur / ordinateur, par sites, domaines et OU), le moment (premier plan au démarrage et à l'ouverture de session, arrière-plan) et le type d'extension (`/logoff`, `/boot`) ; `gpupdate /force` réapplique tout, `gpresult` observe. |

### Active Directory et SQL
| Fiche | Le mécanisme à savoir expliquer |
|---|---|
| [2026-11-10 DC locator](2026-11-10-active-directory-comment-le-poste-trouve-son-controleur.md) | Netlogon interroge le DNS (SRV `_ldap._tcp.<domaine>`), envoie un ping LDAP UDP, retient **le premier** qui répond et met en cache ; le contrôleur du site le plus proche est recherché ; la découverte NetBIOS est dépréciée. |
| [2026-11-11 SQL : `GROUP BY` et `Extra`](2026-11-11-sql-group-by-tri-et-extra.md) | `Using temporary`, `Using filesort`, `Using index for group-by` (définitions MariaDB mot pour mot) ; l'index peut livrer les lignes déjà ordonnées ; le volume décide, pas le mot `filesort`. |

### Sécurité de l'infrastructure et projet
| Fiche | Le mécanisme à savoir expliquer |
|---|---|
| [2026-11-12 OpenSSH sur musl sans PAM](2026-11-12-openssh-musl-quand-un-champ-mot-de-passe-vaut-etoile.md) | Diff réel 10.6p1 → 10.6p2 : garde `strlen(pw_password) >= 4` avant d'accepter une comparaison de hachages. Cause racine jugée hors de sshd ; scénario complet = **déduction** de ma part. |
| [2026-11-13 Relire une refonte](2026-11-13-relire-une-refonte-csp-competences-tierces.md) | CSP qui s'ouvre par défaut (`NODE_ENV !== "production"`), compétences tierces dans `.claude/skills/` (provenance bonne, pas de fichier `LICENSE`), enchaînement dangereux « page externe → agent avec `Bash` », `AGENTS.md` généré. |

## 2. Fil rouge de la semaine

1. **La règle de départage, et ce qui se passe par défaut.** STP : à priorité égale, la plus petite MAC ; DC locator : le premier qui répond ; OpenSSH : la comparaison de deux valeurs ; CSP : tout ce qui n'est pas `production`. À chaque fois, **le comportement par défaut est celui qui s'applique quand personne n'a rien décidé**. Un bon diagnostic cherche ce défaut.
2. **S'ouvrir ou se fermer par défaut (*fail-open / fail-closed*).** La CSP qui s'ouvre, une comparaison qui accepte deux valeurs d'échec identiques, une racine STP choisie par hasard de fabrication. La question à poser : « quand ça échoue, qu'est-ce qui se passe ? »
3. **D'où viennent les consignes et les données.** SRV du DNS, stratégies d'un contrôleur, compétences importées d'un tiers : la chaîne de confiance compte autant que le contenu.

## 3. Mise en situation : un diagnostic qui croise la semaine

Un nouveau poste, branché sur un commutateur d'accès fraîchement installé, ouvre une session avec un message « contrôleur de domaine introuvable », puis, après un redémarrage, ouvre bien la session mais **n'applique pas** une GPO.
- **Réseau** : le poste est-il dans le bon VLAN ? Le VLAN natif du lien d'accès est-il d'accord avec l'autre bout (fiche du 2 novembre) ? Le nouveau commutateur est-il devenu racine STP sans que personne l'ait voulu ?
- **DNS et AD** : quel serveur DNS le poste a-t-il reçu (DHCP) ? Le SRV `_ldap._tcp.dc._msdcs.<domaine>` répond-il sur ce serveur ?
- **Poste** : `gpresult /scope computer /r` et `/scope user /r` : la GPO est-elle listée ? Est-ce un réglage qui exige `/boot` ou `/logoff` ?
- **Base de données** (si l'application dépend d'une requête lente après ouverture de session) : `EXPLAIN` montre-t-il `Using temporary` ?
Écris, en quatre phrases, l'ordre de tes vérifications et pourquoi.

<details><summary>Une réponse possible</summary>

D'abord le plus bas et le moins coûteux : VLAN et adresse du poste, puis DNS (serveur reçu, SRV du contrôleur), puis l'application des stratégies (`gpresult`, type de réglage), et seulement ensuite la base de données si l'application est lente mais joignable. La racine STP et le VLAN natif se regardent si plusieurs postes d'un même commutateur ont le même symptôme.
</details>

## 4. Anglais de la semaine (bloc du dimanche)

Priorité de ton plan : l'anglais écrit B2 pour le **4 janvier 2027**, dans environ **sept semaines**. **Aucune copie ne m'est parvenue en six semaines** : le test blanc n°1 (8 novembre) est passé sans écrit de ta part. Je ne le reproche pas ; je le constate, car sans écrit je ne peux ni corriger ni estimer ton niveau.

### 4.1 Quinze termes de la semaine
| FR | EN | Remarque |
|---|---|---|
| pont racine | *root bridge* | |
| identifiant de pont | *bridge ID (BID)* | |
| localiser un contrôleur de domaine | *to locate a domain controller* | piège : *to locate* = localiser, pas « louer » |
| enregistrement de localisation de service | *SRV record* | |
| mise en cache | *caching* | |
| stratégie de groupe | *Group Policy* | piège : *policy* = stratégie, pas « police » |
| jeu de stratégies résultant | *Resultant Set of Policy (RSoP)* | |
| forcer | *to force* | `gpupdate /force` |
| tri (en plus) | *sort / filesort* | |
| table temporaire | *temporary table* | |
| s'ouvre / se ferme par défaut | *fail-open / fail-closed* | |
| chaîne d'approvisionnement | *supply chain* | |
| épingler une version | *to pin a version* | |
| cause racine | *root cause* | |
| redémarrer le démon | *to restart the daemon* | piège : mettre à jour ≠ redémarrer |

### 4.2 Texte à trous (9 trous) — avis réel de Barracuda, lu le 2026-11-12
Le texte reprend des phrases **authentiques** de l'avis de l'éditeur (je les ai lues) ; j'ai ôté neuf mots. Écris le mot qui manque.

> Organizations whose administrative interfaces are not (1)\_\_\_\_\_ accessible from the internet are less (2)\_\_\_\_\_ to this attack path. Barracuda recommends (3)\_\_\_\_\_ access to administrative interfaces to trusted internal networks and using appropriate network access (4)\_\_\_\_\_ to limit exposure.
> Customers should review the affected products and (5)\_\_\_\_\_ guidance below, ensure their systems are running the latest firmware (6)\_\_\_\_\_, and have all security (7)\_\_\_\_\_ applied. If a patch has not been (8)\_\_\_\_\_ applied, customers should manually apply the appropriate patch as soon as (9)\_\_\_\_\_.

<details><summary>Réponses</summary>

(1) publicly · (2) exposed · (3) restricting · (4) controls · (5) remediation · (6) version · (7) patches · (8) automatically · (9) possible. Pièges : *restrict access **to*** (restreindre l'accès **à**) ; *as soon as possible*, pas *as soon as possibly* ; *patches* (pluriel) après *security*. Si ta réponse diffère mais reste correcte, note-la.
</details>

### 4.3 Consigne de rédaction (reportée, pour ta première copie)
Écris **120 à 150 mots** en anglais : « Explain to a colleague, in a ticket, why the administrative interface of a network appliance should not be reachable from the Internet. » Utilise au moins cinq mots de 4.1. **Envoie-la dans la conversation.** Je la corrigerai avec la grille du plan (instructions et contenu, ton, enchaînement des idées, lexique, grammaire).

### 4.4 Plan minimal pour les sept semaines
- **Maintenant :** une copie de 120 à 150 mots (4.3). C'est la seule chose qui débloque la correction.
- **29 novembre :** test blanc n°2 (cloze + rédaction, voir `anglais-plan-a2-b2-janvier.md`).
- **20 décembre :** test blanc n°3.
- **4 janvier 2027 :** examen.
Si le temps manque, dis-le-moi : je réduis le plan plutôt que de laisser le calendrier glisser sans trace.

## 5. Mise à jour du plan

- **Lundi 16 novembre — réseau** : agrégation de liens (ce qu'un agrégat répartit et selon quel critère : hachage de la trame sur le trunk).
- **Mardi 17 novembre — Active Directory** : sujet selon tes réponses au calibrage ; sans réponse, je poursuis au niveau de départ (par exemple : réplication entre contrôleurs, ce qu'est un site et un lien de site).
- **Mercredi 18 novembre — SQL** : transactions et verrous (ce que voit une requête pendant qu'une autre écrit), ou sous-requêtes ; je choisirai selon ce que la documentation MariaDB permet de lire.
- **Jeudi 19 novembre — sécurité de l'infrastructure** : mécanisme de l'avis marquant (candidat : **Check Point Gaia, socket local sans authentification**, **si** l'avis de l'éditeur devient lisible ; sinon un autre avis lu à la source).
- **Vendredi 20 novembre — projet** : ce que les agents livrent (PR de la semaine).
- **Samedi 21 novembre — poste de travail et support** : à choisir.
- **Échéances CISA à ne pas oublier (veille) :** Check Point CVE-2026-123039 : **lundi 16** ; Apple CVE-2024-27834 : 18 ; SonicWall CVE-2026-19868 : 20 ; Microsoft Outlook CVE-2026-124194 et Cisco BroadWorks CVE-2026-20320 : 24.
- **Statut des calibrages :** Active Directory et SQL toujours **en attente**. Je n'ai trouvé aucun commentaire de ta part sur la PR #47 (dernière vérification : aujourd'hui).

## 6. Sources

Chaque affirmation technique renvoie aux sources des fiches liées. Consultés le 2026-11-15 : catalogue CISA KEV (`catalogVersion` 2026.11.13, inchangé depuis hier) ; état des PR et issues du dépôt (API GitHub). L'avis de Barracuda (§4.2) a été lu le 2026-11-12 : https://trust.barracuda.com/security/pre-authentication-authorization-bypass-command-injection
