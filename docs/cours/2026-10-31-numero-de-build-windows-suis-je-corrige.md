# Fiche — Numéro de build Windows : « cette machine est-elle corrigée ? »

Piste : poste de travail et support (rotation du samedi). Lecture + exercice : 25 minutes. Aucun correctif à installer, aucune manipulation sur le réseau de ton employeur : l'exercice se fait sur **ta propre VM Windows Server 2019** (celle de `Read Me Active Directory`).

## 1. Pourquoi ça compte, et quand ça change le diagnostic

Un avis dit « corrigé à partir de la version X ». Pour répondre « suis-je concerné ? », il faut une seule chose fiable : **le numéro de build complet de la machine**, révision comprise. « Windows Server 2019 » ne suffit pas : deux serveurs 2019 peuvent différer de plusieurs mois de correctifs.

Cas typique de support : un utilisateur ou un collègue dit « il est à jour ». Le numéro de build tranche en dix secondes, mieux que « Windows Update dit qu'il n'y a rien ».

## 2. Le mécanisme, pas à pas

Un numéro de build Windows 10/11/Server s'écrit `10.0.<build>.<révision>`.
1. `10.0` : la famille de version (inchangée depuis Windows 10).
2. **Build** (ex. `17763`) : identifie la version de Windows. `17763` = Windows Server 2019 / version 1809 (tableau Microsoft, lu le 2026-10-31).
3. **Révision** (ex. `9376`), appelée aussi **UBR** (*Update Build Revision*) : monte à chaque mise à jour cumulative. C'est elle qui dit « quel mois de correctifs ».
4. Chaque mise à jour cumulative est publiée avec un **numéro de KB** (article de la base de connaissances) et fait passer la révision à une valeur précise.
5. Une CVE Microsoft donne, par produit, la **première révision corrigée**. Dans NVD, cela s'écrit « `versionEndExcluding` 10.0.17763.9376 » : **strictement avant** cette révision = vulnérable ; **à cette révision ou au-dessus** = corrigé.
6. Comparer deux révisions : on compare le **dernier nombre** (même build), en nombre entier, pas en texte.

**Types de mises à jour** (colonne « Update type » du tableau Microsoft) : `B` = mise à jour mensuelle de sécurité (« Patch Tuesday », deuxième mardi du mois) ; `D` = facultative, publiée plus tard dans le mois (sans correctifs de sécurité nouveaux, d'après la convention Microsoft : à confirmer sur la page de politique de servicing, non lue aujourd'hui) ; `OOB` = *out-of-band*, publiée hors calendrier, souvent pour corriger un problème introduit par la précédente ou une urgence.

Conséquence importante : une mise à jour `OOB` est **cumulative** dans ce tableau (la révision monte), donc une machine à `9378` est « au-dessus » de `9376`. Mais **vérifie toujours la colonne** : toutes les `OOB` ne se comportent pas de la même façon, et un correctif hors calendrier peut ne pas être cumulatif. Ici, le tableau lu montre une progression régulière des révisions.

## 3. Lecture du réel (extraits authentiques, annotés)

Tableau « Windows Server release information », Windows Server 2019 (OS build 17763), Microsoft Learn, page mise à jour le 2026-10-28, consultée le 2026-10-31 :

```
| LTSC | 2026-10 OOB | 2026-10-26 | 17763.9378 | KB5134124 |
| LTSC | 2026-10 B   | 2026-10-13 | 17763.9376 | KB5126651 |
| LTSC | 2026-09 OOB | 2026-09-14 | 17763.9247 | KB5129238 |
| LTSC | 2026-09 B   | 2026-09-08 | 17763.9245 | KB5122876 |
```
- Colonne 2 : mois + type (`B`, `OOB`). Colonne 3 : date de publication. Colonne 4 : **build.révision**. Colonne 5 : **KB**.
- Ligne 2026-10 B : publiée le 13 octobre = le « Patch Tuesday » d'octobre. Révision **9376**.
- Ligne 2026-10 OOB : publiée le 26 octobre, révision **9378** (la 9377 n'est pas listée dans ce tableau).

NVD, CVE-2026-96951 (Windows Shell, contournement de fonction de sécurité par le réseau, CVSS 3.1 de 8,8, **exploitée** d'après le catalogue CISA, voir la veille du 2026-10-23) :
```
windows_server_2019   versionEndExcluding 10.0.17763.9376
windows_server_2016   versionEndExcluding 10.0.14393.9612
windows_server_2022   versionEndExcluding 10.0.20348.5761
windows_server_2025   versionEndExcluding 10.0.26100.33650
```
Lecture : un Server 2019 en `17763.9245` (septembre) est **vulnérable** à cette CVE ; en `17763.9376` (octobre B) ou `17763.9378` (octobre OOB), il est au seuil ou au-dessus, donc **corrigé selon NVD**. Précision : NVD reflète la lecture des données Microsoft par le NIST ; la page MSRC de la CVE n'a **pas été lue**, donc je ne cite aucun KB « officiel » de correction pour cette CVE. Le KB `5126651` est celui de la mise à jour d'octobre B **dans le tableau de release**, ce qui n'est pas la même chose que « l'avis MSRC dit KB5126651 ».

## 4. Ce qui casse, symptôme, traçage

| Situation | Symptôme | Comment tracer |
|---|---|---|
| Lire « 2019 » comme « corrigé » | Faux sentiment de sécurité | Lire la **révision**, la comparer au seuil de l'avis |
| Comparer en texte (`"9376" > "10012"` donne faux) | Mauvaise conclusion quand les nombres n'ont pas la même longueur | Comparer en entiers |
| Mélanger les builds (2016 vs 2019 vs 2022) | Seuil du mauvais produit | Le **build** (`17763`) désigne le produit ; chaque produit a son seuil |
| Cache de « Windows Update : à jour » | La machine n'a simplement pas vu la mise à jour (WSUS, GPO, différé) | Le numéro de build ne ment pas, le message d'interface peut |
| Mise à jour installée, **redémarrage en attente** | La révision lue est l'ancienne | Redémarrer, relire la révision |
| `OOB` ignorée car « hors calendrier » | Machine restée sous le seuil si la CVE est corrigée dans l'`OOB` | Lire la colonne « Update type » et la date |

## 5. Vocabulaire FR + EN (pièges)

| FR | EN | Piège |
|---|---|---|
| numéro de build | *build number* | pas « version » seule |
| révision (UBR) | *revision, UBR (Update Build Revision)* | le dernier nombre du build complet |
| mise à jour cumulative | *cumulative update* | contient les précédentes |
| article de la base de connaissances | *KB article* (Knowledge Base) | numéro à 7 chiffres |
| hors cycle / hors calendrier | *out-of-band (OOB)* | pas « out of band » au sens réseau |
| correctif | *patch, fix, hotfix* | *hotfix* ancien sens : correctif ciblé |
| seuil / première version corrigée | *fixed version, threshold* | NVD : *versionEndExcluding* |
| vulnérable | *affected* | *vulnerable* est aussi courant ; NVD dit *affected* |
| redémarrage en attente | *pending reboot* | la mise à jour n'est pas encore active |
| mardi des correctifs | *Patch Tuesday* | second mardi du mois |
| faux ami : *patch* | = correctif | pas « patch » au sens de rustine physique |
| faux ami : *revision* | = numéro de révision | pas « révision » scolaire |
| exposé sur Internet | *internet-facing* | pas « internet-exposed » |
| contournement | *workaround* | pas *bypass* (qui désigne l'attaque) |

## 6. Trois formulations professionnelles

**Collègue (FR) :** « Le serveur de fichiers est en 17763.9245. L'avis demande 9376 ou plus. On est donc sous le seuil ; on le met dans la fenêtre de maintenance de ce soir. »

**Éditeur / support (FR + EN) :**
- FR : « Pouvez-vous confirmer que la mise à jour d'octobre fait passer la révision à 9376 ou plus sur Windows Server 2019 ? »
- EN: "Can you confirm that the October update raises the revision to 9376 or higher on Windows Server 2019?"

**Ticket (FR + EN) :**
- FR : « Machine SRV-01, Windows Server 2019, build relevé 17763.9245 (septembre B). Sous le seuil de l'avis. Action : installer la mise à jour cumulative d'octobre, redémarrer, relever à nouveau le build. »
- EN: "Host SRV-01, Windows Server 2019, build found: 17763.9245 (September B). Below the advisory threshold. Action: install the October cumulative update, reboot, re-check the build."

## 7. Exercice d'observation (20-30 minutes, **lab uniquement**)

Sur **ta VM Windows Server 2019 personnelle** (pas sur un poste de l'employeur) :
1. Relève le build complet : touche Windows + R, `winver`, ou en PowerShell la lecture de la clé `HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion` (valeurs `CurrentBuild` et `UBR`). *Ces noms de clé et de valeurs viennent de ma mémoire et n'ont pas été relus aujourd'hui : vérifie-les à l'écran.*
2. Note le résultat sous la forme `10.0.17763.<révision>`.
3. Repère cette révision dans le tableau de la section 3 (ou sur la page Microsoft Learn citée en §10). Dans quelle ligne se trouve-t-elle ? Quel mois de correctifs ?
4. Compare au seuil `17763.9376` : **au-dessus** ou **en dessous** ? Écris ta phrase de ticket (§6).
5. Si tu es en dessous : ne fais rien sur le réseau de ton employeur. Dans ton lab seulement, tu peux installer la mise à jour et relever à nouveau le build.

<details><summary>Solution (à ouvrir après)</summary>

Il n'y a pas de « bonne » valeur unique : cela dépend de la date de ta dernière mise à jour. Ce qui est vérifiable : (a) le build vaut `17763` ; (b) la révision se retrouve dans le tableau si ta VM a été mise à jour avec une cumulative publiée ; (c) si la révision n'y figure pas, soit la machine est plus ancienne que la liste affichée, soit c'est une révision non listée (par exemple `9377`) : dans ce cas, ne conclus pas, relis la page.
</details>

## 8. Révision espacée

**D'hier (fiche du 2026-10-30, relire une PR de performance) :**
1. Pourquoi un tableau « avant/après » avec **une seule mesure** par cas ne prouve-t-il pas une amélioration ?
2. Pourquoi le p95 d'image peut-il **monter** sur ordinateur alors que le nombre de peintures baisse ?
3. Pourquoi `will-change: transform` doit-il rester rare ?

**D'il y a 7 jours (fiche du 2026-10-24, DHCP) :**
1. Que se passe-t-il à T1 (la moitié du bail) ?
2. Pourquoi une adresse en 169.254.x.x n'est-elle jamais routée ?
3. Qui envoie l'ACK final dans l'échange DISCOVER / OFFER / REQUEST / ACK ?

<details><summary>Réponses</summary>

D'hier : (1) le bruit d'une mesure unique peut être aussi grand que l'écart ; il faut répéter. (2) La moyenne ou le p95 d'image dépend du bruit et de la charge du processeur ralenti, pas seulement du nombre de peintures. (3) Il réserve un calque en mémoire ; en abuser coûte de la mémoire (MDN : dernier recours).
Du 24 : (1) le client tente de **renouveler** auprès du serveur qui lui a donné le bail (unicast). (2) C'est une adresse de lien local (RFC 3927), faite pour un seul segment. (3) Le **serveur DHCP**.
</details>

## 9. Trois questions de contrôle

1. Que représente le dernier nombre de `10.0.17763.9376` ?
2. NVD écrit `versionEndExcluding 10.0.17763.9376`. Une machine en `9376` est-elle vulnérable ? Une en `9245` ?
3. Pourquoi « Windows Update dit qu'il est à jour » ne remplace-t-il pas la lecture du build ?

<details><summary>Réponses</summary>

1. La **révision** (UBR) : le niveau de mise à jour cumulative installé. 2. `9376` : **non** (borne exclue, donc corrigé) ; `9245` : **oui**, vulnérable. 3. Ce message dépend d'une source de mises à jour (WSUS, GPO, différé) et d'un état de l'interface ; le build est la valeur effectivement installée.
</details>

## 10. Sources (consultées le 2026-10-31)

- Windows Server release information, Microsoft Learn (mise à jour 2026-10-28) : https://learn.microsoft.com/en-us/windows/release-health/windows-server-release-info
- NVD, CVE-2026-96951 : https://nvd.nist.gov/vuln/detail/CVE-2026-96951 (les seuils cités sont ceux de NVD ; la page MSRC n'a pas été lue).
- Catalogue CISA KEV : https://www.cisa.gov/known-exploited-vulnerabilities-catalog
- Non vérifié aujourd'hui (de mémoire) : noms des valeurs de registre `CurrentBuild` / `UBR` ; définition du type `D`.
