# Fiche — Comment deux contrôleurs de domaine se mettent d'accord : USN, vecteur d'à-jour et notification

*Piste : Active Directory et Windows Server · mardi 17 novembre 2026 · lecture : 25 min*

> **Rappel de sécurité :** cette fiche explique un mécanisme. Les commandes d'observation (`repadmin`) ne se lancent **pas** sur le réseau de ton employeur pour t'entraîner : labo uniquement. Les consulter pour diagnostiquer une panne réelle est de l'exploitation normale, mais c'est ton choix et ton périmètre.

## 1. Pourquoi ce mécanisme
Un utilisateur change son mot de passe sur un site, puis ne peut plus se connecter sur un autre ; une GPO « n'arrive pas » ; un compte supprimé réapparaît. Dans ces trois cas, la question utile est : **le changement est-il arrivé sur le contrôleur de domaine (DC) que le poste interroge ?** Savoir comment un DC apprend un changement te dit où regarder (réseau, DNS, authentification entre DC, topologie) au lieu de « redémarrer le DC ».

## 2. Le mécanisme (source : Microsoft Learn, lue le 2026-11-17)
**Multi-maître.** Tout DC accepte une écriture LDAP pour les objets dont il fait partie ; chaque écriture « d'origine » est ensuite répliquée aux autres, qui l'enregistrent comme écriture **répliquée**.

**Pas l'horloge, des compteurs.** La réplication ne s'appuie pas d'abord sur l'heure : elle utilise des **numéros de séquence de mise à jour (USN)**, un compteur **local** à chaque DC, 64 bits, stocké dans `highestCommittedUsn` (rootDSE). Au début de chaque transaction (d'origine ou répliquée), le DC l'incrémente et associe la valeur à l'écriture. Comme chaque compteur est local, il ne recule jamais.

**Ce qui est stocké, par attribut modifié :**
- **USN local** (propre à ce DC) ; le maximum sur l'objet donne `uSNChanged` (indexé).
- **USN d'origine** + version + heure d'origine + DC d'origine : ces métadonnées **voyagent** avec la valeur.

**Deux filtres côté destination :**
1. **High-watermark** (*direct up-to-dateness vector*) : « le dernier changement reçu de **ce** partenaire pour **cette** partition » ; la source ignore les objets dont `uSNChanged` ≤ cette valeur.
2. **Vecteur d'à-jour** (*up-to-dateness vector*) : une entrée par DC ayant écrit (identifiant de base `invocation ID` + plus haut USN d'origine reçu). Il permet la **suppression de propagation** (*propagation dampening*) : la source n'envoie pas à B ce que B a déjà reçu via C. Ainsi un anneau ou plusieurs chemins ne bouclent pas.

**Déclenchement (pull + notification).** Dans un site, un DC qui a un changement attend le **délai de notification initial (15 s par défaut)** puis notifie un premier partenaire ; ensuite **3 s** entre partenaires suivants ; le partenaire **demande** (*pull*) les changements. Entre sites, le DC pont (*bridgehead*) tire selon le **calendrier du lien de sites** (notification possible si activée). Certaines modifications sont **urgentes** (immédiates dans le site) : verrouillage de compte (pas le déverrouillage), politique de verrouillage, politique de mot de passe du domaine, secret LSA, mot de passe de compte machine de DC, changement de propriétaire du rôle RID. *Les valeurs 15 s / 3 s viennent d'une page « Windows Server 2003 – 2012 R2 » ; la page de topologie plus récente ne les redonne pas : je ne les ai pas revérifiées pour Windows Server 2022/2025.*

**Topologie.** Le **KCC** (tourne sur chaque DC) crée des **objets de connexion** entrants. Dans un site : anneau bidirectionnel, plus raccourcis. Entre sites : arbres couvrants superposés, via les **liens de sites** (coût, calendrier). Prérequis : sites et sous-réseaux corrects, DNS fonctionnel (la zone `_msdcs` sert à localiser les partenaires), authentification entre DC.

## 3. Lecture du réel
Je **n'ai pas de sortie `repadmin` authentique sous la main** (la page de référence de la commande n'est pas accessible depuis mon environnement). Voici donc ce qui est **lu** et non reconstitué : la page Microsoft de dépannage indique d'exporter l'état avec `repadmin /showrepl * /csv`, puis de trier la colonne *Last Success Time* et de filtrer *Last Failure Time* ≠ 0 ; chaque ligne donne, pour chaque DC, le partenaire source, la dernière réussite et le dernier échec par partition. **Exemple d'USN tiré de la page :** DC1 est à 4710 ; il crée un utilisateur → USN local **4711** sur chaque attribut ; sur DC2 la valeur répliquée reçoit **son propre** USN local, mais garde l'USN d'origine **4711** de DC1.

## 4. Ce qui casse, et le symptôme
Causes racines listées par Microsoft : **connectivité réseau, résolution de noms (DNS), authentification/autorisation, base d'annuaire, moteur de réplication, topologie**. Symptômes terrain : changement visible sur un DC mais pas sur un autre ; événements d'erreur dans le journal *Directory Service*. **Limite de durée de vie des objets supprimés** (*tombstone lifetime*) : 60 jours par défaut (180 pour une forêt créée sous Windows Server 2003 SP1) ; un DC hors réplication plus longtemps peut conserver des objets supprimés ailleurs (**objets persistants**, *lingering objects*), d'où l'importance de ne pas rallumer un vieux DC. Remonter : DNS d'abord, puis réseau/ports (RPC 135 + ports dynamiques), puis droits, puis topologie.

## 5. Vocabulaire
| Français | English | Définition / piège |
|---|---|---|
| réplication multi-maître | multi-master replication | tout DC écrit |
| numéro de séquence de mise à jour (USN) | update sequence number | compteur **local**, pas une horloge |
| écriture d'origine / répliquée | originating / replicated write | l'USN d'origine voyage, le local non |
| vecteur d'à-jour | up-to-dateness vector | état par DC d'origine |
| marque de haut niveau | high-watermark | dernier changement reçu d'un partenaire |
| suppression de propagation | propagation dampening | évite doublons et boucles |
| contrôleur de domaine | domain controller | |
| vérificateur de cohérence des connaissances | KCC | génère la topologie |
| objet de connexion | connection object | entrant, sous *NTDS Settings* |
| site / sous-réseau / lien de sites | site / subnet / site link | le lien ne dessine pas le chemin réseau réel |
| serveur pont | bridgehead server | DC de bord de site |
| durée de vie des objets supprimés | tombstone lifetime | limite de réplication tolérable |
| objet persistant | lingering object | objet supprimé resté sur un DC isolé trop longtemps |
Faux amis : « réplication » AD ≠ « sauvegarde » ; « synchronisation d'horloge » ≠ réplication.

## 6. Comment le dire juste
- **Collègue :** « Le changement est fait sur DC1 mais DC2 ne l'a pas : je regarde le dernier succès de réplication entrante de DC2 depuis DC1. »
- **Prestataire / éditeur (EN) :** "The change was originated on DC1 but has not replicated to DC2; inbound replication from DC1 shows a failure. Can you confirm DNS and RPC reachability between the two?"
- **Ticket (EN) :** "Inbound AD replication from DC1 to DC2 failing since <time>. Suspected name resolution/RPC. Attributes changed on DC1 not visible on DC2."

## 7. Exercice (labo uniquement, 25 min)
Dans une VM Windows Server de **laboratoire** avec deux DC (ou lis seulement), crée un utilisateur sur DC1, compare `uSNChanged` de l'objet sur DC1 et DC2 (visionneuse d'attributs). **Hypothèse à formuler :** les valeurs diffèrent-elles ? Pourquoi ? Vérifie.
<details><summary>Solution</summary>
Elles diffèrent : l'USN local est propre à chaque DC. Ce qui est identique, c'est l'USN d'origine et le DC d'origine dans les métadonnées de l'attribut.
</details>

## 8. Révision espacée
Hier (EtherChannel) : 1) Le hachage de répartition est-il aléatoire ? 2) Que donne `test etherchannel load-balance` ? Il y a sept jours (10 nov, DC locator) : 3) Quel enregistrement DNS un poste interroge-t-il pour trouver un DC ?

## 9. Questions de contrôle
1. Pourquoi l'USN n'est-il pas une heure ? 2. Qu'évite le vecteur d'à-jour ? 3. Quelle limite de durée rend un DC éteint dangereux à rallumer ?
<details><summary>Réponses</summary>
1. Compteur local, ne recule jamais, pas de dépendance à l'horloge. 2. Renvois en double et boucles. 3. La *tombstone lifetime* (60 j par défaut ; 180 j selon la création de la forêt).
</details>

## 10. Sources (consultées le 2026-11-17)
- Microsoft Learn, « How the Active Directory Replication Model Works » : https://learn.microsoft.com/en-us/previous-versions/windows/it-pro/windows-server-2003/cc772726(v=ws.10) — USN, vecteur d'à-jour, high-watermark, délais 15 s / 3 s, réplication urgente, tombstone.
- Microsoft Learn, « Active Directory Replication Concepts » (maj 2025-05-12) : https://learn.microsoft.com/en-us/windows-server/identity/ad-ds/get-started/replication/active-directory-replication-concepts — KCC, connexions, sites, liens.
- Microsoft Learn, « Troubleshooting Active Directory Replication Problems » : https://learn.microsoft.com/en-us/windows-server/identity/ad-ds/manage/troubleshoot/troubleshooting-active-directory-replication-problems — causes racines, export `repadmin /showrepl * /csv`.
