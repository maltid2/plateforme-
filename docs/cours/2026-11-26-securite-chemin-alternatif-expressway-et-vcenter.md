# Fiche — Le contrôle d'accès contourné par « un autre chemin » : Cisco Expressway (identifiants/cookies de cluster) et VMware vCenter (service d'annuaire)

*Piste : sécurité de l'infrastructure · jeudi 26 novembre 2026 · lecture : 25 min · sujet pris sur les deux avis ajoutés au catalogue CISA le 20 novembre, que j'ai lus*

> **Rappel :** cette fiche explique des mécanismes. **Ne teste aucune de ces failles** sur un équipement réel. Vérifier une version et l'exposition d'une interface est de l'exploitation normale ; reproduire une attaque ne l'est pas.

## 1. Pourquoi ce mécanisme
Deux équipements d'infrastructure, deux avis critiques (CVSS 9,8), deux familles du même défaut : **l'authentification existe, mais un autre chemin ne la vérifie pas**. Savoir reconnaître cette famille te permet de poser les bonnes questions au prestataire : « quels services écoutent en plus de l'interface d'administration, et que vérifient-ils ? ».

## 2. Le mécanisme (sources : avis éditeurs et MITRE CWE, lus les 2026-11-21 et 2026-11-26)
**Définitions MITRE.**
- **CWE-288** (*Authentication Bypass Using an Alternate Path or Channel*) : « The product requires authentication, but the product has an **alternate path or channel** that does not require authentication. »
- **CWE-798** (*Use of Hard-coded Credentials*) : « The product contains hard-coded credentials, such as a password or cryptographic key. » Deux variantes décrites : **entrante** (un mot de passe codé en dur, identique pour chaque installation, rarement modifiable) et **sortante** (le produit contient des identifiants pour se connecter à un composant arrière).

**Cisco Expressway (cisco-sa-vcs-static-cred-hr7EWZ8t, version 1.1 du 2026-11-23).** CVE-2026-76466, CWE-798, CVSS 9,8. Mécanisme décrit par l'éditeur : une faille dans la fonction de **service de base de données** ; elle est due à **l'utilisation de cookies persistants** et à une **validation insuffisante des certificats clients** pour le **clustering** (le texte parle d'un « TLS Verify Mode » activé pour le clustering, avec des certificats clients **non validés**). Un attaquant **en possession des cookies** peut se connecter au service de base de données et invoquer des **appels de procédure à distance (RPC)** précis, puis **exécuter des commandes en root**. Affecté : Expressway-C et -E (virtuels et matériels) **configurés en cluster** et exécutant une version vulnérable. Corrigé : **X15.5.20** (pour X15.5.3 et antérieures) ; X14 et antérieur : migrer. **Aucun contournement.**
*Lecture :* le service de base de données du cluster est un **canal entre membres du cluster**, pas l'interface d'administration ; c'est ce canal qui fait confiance à des éléments (cookies, certificats) insuffisamment contrôlés.

**VMware vCenter (VMSA-2026-0009.1, mis à jour le 2026-11-20).** CVE-2026-123890, CWE-288 (selon le catalogue CISA), CVSS 9,8. Description : **contournement d'authentification dans le *VMware Directory Service*** ; « un acteur malveillant avec un accès réseau à vCenter peut contourner l'authentification et obtenir un accès non autorisé au système ». Corrigé : 9.1.1.0200, 9.0.2.0200, 8.0 U3m (7.0 : support Broadcom avec contrat étendu) ; **aucun contournement.** L'avis ne détaille **pas** le chemin exact ; je ne le devine pas.

**Statut d'exploitation (mis à jour).** Les deux CVE sont au catalogue CISA (ajoutés le 2026-11-20). La **version 1.1 de l'avis Cisco** précise : ajout au KEV, mais « **Cisco ne dispose pas de preuve directe d'exploitation active** » (note de révision du 2026-11-23). L'avis Broadcom **ne déclare pas** d'exploitation. Je corrige donc ma note du 21 novembre : la divergence apparente venait d'une version antérieure de la page Cisco.

## 3. Lecture du réel
Extrait authentique (Cisco, §« Summary », lu le 2026-11-21) : « This vulnerability is due to the use of persistent cookies. Additionally, there is insufficient validation of client certificates when the TLS Verify Mode is set to Enabled for clustering, which means that client certificates are not validated. » Champ par champ : *persistent cookies* = justificatif réutilisable ; *client certificates … not validated* = l'authentification par certificat entre membres ne vérifie pas ce qu'elle devrait ; *clustering* = condition d'exposition. Extrait Broadcom : « Known Attack Vectors: A malicious actor with network access to vCenter may exploit this issue to bypass authentication and gain unauthorized access to the system. » : le **vecteur** est le réseau ; pas de privilège préalable annoncé.

## 4. Ce qui casse, et le symptôme
- **Un équipement d'infrastructure accessible depuis un réseau trop large** (Internet, réseau utilisateurs) : le service « interne » devient atteignable.
- **Symptôme côté défenseur :** des connexions vers le port d'un service de cluster ou d'annuaire **depuis une source qui n'est pas un membre du cluster** ; des accès administrateur sans authentification correspondante dans les journaux. *(Indice de méthode, non tiré des avis.)*
- **Remonter :** version installée → cluster ou non → quelles sources réseau atteignent l'équipement.

## 5. Vocabulaire
| Français | English | Définition / piège |
|---|---|---|
| contournement d'authentification | authentication bypass | accès sans passer le contrôle |
| chemin ou canal alternatif | alternate path or channel | accès non contrôlé |
| identifiants codés en dur | hard-coded credentials | mot de passe/clé dans le produit |
| cookie persistant | persistent cookie | justificatif conservé et rejouable |
| certificat client | client certificate | prouve l'identité du client |
| validation insuffisante | insufficient validation | |
| grappe / cluster | cluster | |
| appel de procédure à distance | remote procedure call (RPC) | |
| exécution de commandes arbitraires | arbitrary command execution | |
| en tant que root | as root | privilèges maximaux |
| catalogue des vulnérabilités exploitées | KEV catalog | ≠ preuve chez toi |
| contournement temporaire | workaround | ≠ correctif |
Faux amis : « aucune exploitation connue de l'éditeur » ≠ « pas exploitée » ; KEV **ne dit pas** que **ton** équipement a été attaqué.

## 6. Comment le dire juste
- **Collègue :** « Les Expressway en cluster et le vCenter ont des correctifs critiques ; je vérifie les versions et qui peut joindre ces équipements sur le réseau. »
- **Prestataire (EN) :** "Please confirm our Expressway version and cluster status against cisco-sa-vcs-static-cred-hr7EWZ8t, and that the management and cluster interfaces are not reachable from untrusted networks."
- **Ticket (EN) :** "CVE-2026-76466 (Expressway, fixed in X15.5.20) and CVE-2026-123890 (vCenter, fixed in 9.1.1.0200/9.0.2.0200/8.0 U3m) are in the CISA KEV catalog. Verify versions and network exposure; no workaround available."

## 7. Exercice (papier, 20 min, sans manipulation)
Pour un équipement de ton choix (sur le papier, pas sur le réseau réel) : liste **tous** les ports qu'il écoute et, pour chacun, **qui** peut l'atteindre et **comment** il authentifie. Repère le port « interne » (cluster, annuaire, base) qui authentifie le moins.
<details><summary>Solution</summary>
Il n'y a pas de solution unique : l'exercice réplique le raisonnement de la famille CWE-288 (un canal secondaire moins contrôlé que l'interface principale). Une bonne réponse nomme le service, la source réseau autorisée et le mécanisme d'authentification attendu.
</details>

## 8. Révision espacée
Hier (semi-jointure) : 1) Quelle forme de requête est une semi-jointure ? 2) Comment la désactiver ? Il y a sept jours (19 nov, SAML) : 3) Où se joue le MFA dans un SSO SAML ?

## 9. Questions de contrôle
1. Que décrit CWE-288 ? 2. Quelle condition rend un Expressway vulnérable selon Cisco ? 3. Que signifie l'ajout au KEV, et que ne signifie-t-il pas ?
<details><summary>Réponses</summary>
1. Une authentification requise, mais un chemin ou canal alternatif qui n'en exige pas. 2. Être configuré en cluster et exécuter une version vulnérable. 3. CISA constate une exploitation ou la juge pertinente pour sa liste ; cela ne prouve pas une attaque chez toi.
</details>

## 10. Sources (consultées les 2026-11-21 et 2026-11-26)
- Cisco, cisco-sa-vcs-static-cred-hr7EWZ8t (v1.1, 2026-11-23) : https://sec.cloudapps.cisco.com/security/center/content/CiscoSecurityAdvisory/cisco-sa-vcs-static-cred-hr7EWZ8t
- Broadcom, VMSA-2026-0009.1 : https://support.broadcom.com/web/ecx/support-content-notification/-/external/content/SecurityAdvisories/0/39495
- MITRE, CWE-288 : https://cwe.mitre.org/data/definitions/288.html ; CWE-798 : https://cwe.mitre.org/data/definitions/798.html
- CISA, catalogue KEV (flux JSON) : https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json
