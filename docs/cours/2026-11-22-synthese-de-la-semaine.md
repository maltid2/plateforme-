# Synthèse de la semaine du 16 au 22 novembre 2026

*Dimanche : consolidation, pas de nouveau sujet. Lecture : 25 min, bloc d'anglais compris.*

## 1. Les fiches de la semaine, par thème

### Réseau et poste de travail
- [16 nov — Agrégat de liens (EtherChannel) : hachage déterministe, répartition 0-7, modes PAgP](2026-11-16-agregat-de-liens-etherchannel-repartition.md) : un agrégat répartit **par flux**, selon un hachage de la trame ; deux machines peuvent toujours tomber sur le même lien.
- [21 nov — « Connecté, sans accès Internet » : la sonde NCSI](2026-11-21-poste-connecte-sans-acces-internet-ncsi.md) : DNS puis HTTP vers `www.msftconnecttest.com`, contenu attendu « Microsoft Connect Test » ; proxy ou portail captif suffisent à fausser le verdict.

### Active Directory et SQL
- [17 nov — Réplication AD : USN, vecteur d'à-jour, notification](2026-11-17-active-directory-replication-usn-et-notification.md) : compteurs **locaux**, pas l'horloge ; notification puis tirage (*pull*) ; durée de vie des objets supprimés.
- [18 nov — Transactions, isolation et verrous InnoDB](2026-11-18-sql-transactions-isolation-et-verrous-innodb.md) : verrous sur enregistrements d'index ; `REPEATABLE READ` garde les verrous jusqu'à la fin ; erreur 1205.

### Sécurité de l'infrastructure et projet
- [19 nov — SSLVPN et SAML : le MFA contourné (SonicWall CVE-2026-19868)](2026-11-19-securite-sslvpn-saml-quand-le-mfa-se-contourne.md) : le MFA se joue chez le fournisseur d'identité ; un chemin alternatif l'annule (inférence, avis éditeur illisible).
- [20 nov — Relire un commit de mise à jour de sécurité](2026-11-20-relire-un-commit-de-mise-a-jour-de-securite.md) : plage `^`, fichier de verrouillage, `npm audit` ; contradiction picomatch non levée.

## 2. Fil rouge de la semaine
1. **Ce que dit l'état affiché n'est pas l'état réel.** L'icône « sans Internet » (NCSI), un MFA « configuré » (SAML), un audit « propre » (npm) : chaque fois, une **sonde ou une déclaration** remplace la vérification directe.
2. **Un correctif publié n'est pas un correctif appliqué.** Synology DSM : correctif en 2024, exploitation constatée par CISA en 2026. vCenter, Expressway : correctifs disponibles, échéance lundi.
3. **Locale ou globale ?** L'USN est local à chaque contrôleur ; un verrou InnoDB est local à un enregistrement d'index. Comprendre à quel niveau se décide une chose évite de chercher au mauvais endroit.

## 3. Mise en situation
Un utilisateur dit : « Je suis connecté au VPN, mais Windows indique *sans accès Internet*, et mon mot de passe changé ce matin ne passe que sur certaines applications ». Écris en quatre phrases l'ordre de tes vérifications.
<details><summary>Une réponse possible</summary>
D'abord le poste : état NCSI, DNS et proxy (la sonde atteint-elle `www.msftconnecttest.com` ?). Ensuite le VPN : la session est-elle passée par le MFA (journaux VPN contre journaux du fournisseur d'identité) ? Puis l'annuaire : le changement de mot de passe est-il arrivé sur le contrôleur interrogé (réplication entrante, dernier succès) ? Enfin les applications, si elles dépendent d'une base verrouillée.
</details>

## 4. Anglais de la semaine (bloc du dimanche)

Examen B2 écrit le **4 janvier 2027**, dans environ **sept semaines**. **Aucune copie ne m'est parvenue** : sans écrit, je ne peux ni corriger ni estimer ton niveau.

### 4.1 Quinze termes de la semaine (tirés des avis lus cette semaine)
| English | Français | Exemple court |
|---|---|---|
| vulnerability | vulnérabilité | "a vulnerability in the database service" |
| unauthenticated | non authentifié | "an unauthenticated, remote attacker" |
| remote attacker | attaquant à distance | |
| arbitrary commands | commandes arbitraires | "execute arbitrary commands as root" |
| authentication bypass | contournement d'authentification | "vCenter authentication bypass" |
| workaround | contournement temporaire | "There are no workarounds" |
| fixed release / patched version | version corrigée | "first fixed release" |
| affected products | produits affectés | |
| insufficient validation | validation insuffisante | |
| hard-coded credentials | identifiants codés en dur | |
| network access | accès réseau | "with network access to vCenter" |
| to address a vulnerability | corriger une faille | "updates address this vulnerability" |
| known exploited | activement exploité | "listed in the KEV catalog" |
| due date | échéance | |
| to apply a patch | appliquer un correctif | |
Piège : *address* signifie ici **traiter / corriger**, pas « adresser ». *Apply a patch*, pas *make a patch*.

### 4.2 Texte à trous (9 trous) : avis réel de Cisco, lu le 2026-11-21
Phrases **authentiques** de l'avis cisco-sa-vcs-static-cred-hr7EWZ8t ; neuf mots ôtés.

> A (1)\_\_\_\_\_ in the database service feature of Cisco Expressway Series could allow an (2)\_\_\_\_\_, remote attacker with (3)\_\_\_\_\_ access to a Cisco Expressway device to execute (4)\_\_\_\_\_ operating system commands as root.
> This vulnerability is (5)\_\_\_\_\_ to the use of persistent cookies. Additionally, there is (6)\_\_\_\_\_ validation of client certificates. Cisco has released software updates that (7)\_\_\_\_\_ this vulnerability. There are no (8)\_\_\_\_\_ that address this vulnerability. Customers are advised to upgrade to an (9)\_\_\_\_\_ fixed software release.

<details><summary>Réponses</summary>
(1) vulnerability · (2) unauthenticated · (3) network · (4) arbitrary · (5) due · (6) insufficient · (7) address · (8) workarounds · (9) appropriate. Les phrases 1 à 4 et « There are no workarounds… » sont dans l'avis ; la dernière phrase reprend « Customers are advised to upgrade to an appropriate fixed software release ». Pièges : *due to* (à cause de) ; *workarounds* au pluriel après *no*.
</details>

### 4.3 Consigne de rédaction (toujours en attente)
**120 à 150 mots** : « Explain to a colleague, in a ticket, why the administrative interface of a network appliance should not be reachable from the Internet. » Au moins cinq mots de 4.1. **Envoie-la dans la conversation.**

### 4.4 Calendrier
- **29 novembre :** test blanc n°2 (cloze + rédaction, voir `anglais-plan-a2-b2-janvier.md`). **20 décembre :** test blanc n°3. **4 janvier 2027 :** examen.

## 5. Mise à jour du plan (23 au 29 novembre)
- **Lundi 23 — réseau :** table d'adresses MAC contre table ARP (sujet à confirmer selon ce que la documentation permet de lire).
- **Mardi 24 — Active Directory :** SPN et ce qui change quand un service change de compte (ou un autre sujet si tu réponds au calibrage).
- **Mercredi 25 — SQL :** sous-requêtes ou index couvrants (plan d'exécution).
- **Jeudi 26 — sécurité de l'infrastructure :** mécanisme de l'avis marquant **si l'avis de l'éditeur est lisible** (candidats : vCenter VMSA-2026-0009, Expressway).
- **Vendredi 27 — projet :** ce que les agents livrent. **Samedi 28 — poste de travail.** **Dimanche 29 — synthèse + test blanc n°2.**
- **Échéances CISA :** vCenter CVE-2026-123890 et Cisco Expressway CVE-2026-76466 : **lundi 23 novembre** ; Outlook CVE-2026-124194, Cisco BroadWorks CVE-2026-20320 et Chromium CVE-2026-125350 : **mardi 24 novembre** (dates relevées dans mes notes de veille du 16 novembre, non revérifiées aujourd'hui).
- **Calibrages AD et SQL :** toujours en attente ; aucune réponse reçue.

## 6. Sources
Fiches liées (sources dans chacune). Consulté le 2026-11-22 : catalogue CISA KEV (`catalogVersion` 2026.11.20, 1790 entrées, **inchangé depuis le 21 novembre**) ; avis Cisco cisco-sa-vcs-static-cred-hr7EWZ8t : https://sec.cloudapps.cisco.com/security/center/content/CiscoSecurityAdvisory/cisco-sa-vcs-static-cred-hr7EWZ8t (lu le 2026-11-21).
