# Veille MINERVE — journal daté (ajout uniquement, jamais réécrit)

Règles : chaque entrée donne ce qui a été **lu à la source** avec URL et date de consultation. Ce qui n'a pas pu être lu est écrit comme tel. MINERVE ne connaît pas l'inventaire d'Aymerick : tout est formulé en « si tu as tel produit en telle version ». Une trouvaille déjà consignée n'est pas répétée.

---

## 2026-10-23 (vendredi)

Sources consultées le 2026-10-23 : catalogue CISA KEV (`catalogVersion` 2026.10.21, publié le 2026-10-21), avis des éditeurs Palo Alto, Cisco et Fortinet (lus), base NVD (API, lue), liste des alertes du CERT-FR (page lue), registre d'avis npm. Non lus : avis Ivanti (page dynamique, vide à la lecture), avis Microsoft MSRC (page dynamique, vide à la lecture).

Classement par « ce que ça change pour toi ». Définition utile : le catalogue KEV de la CISA ne contient que des failles dont l'**exploitation active** est constatée ; y figurer vaut donc preuve d'exploitation (le champ « utilisée par des rançongiciels » vaut « Unknown » pour toutes les entrées ci-dessous).

### 1. Ivanti Connect Secure — CVE-2026-104935 (accès distant, exposé sur Internet)
- **Exploitation active :** oui, ajouté au KEV le 2026-10-13 (échéance CISA : 2026-10-16). Le CERT-FR a publié l'alerte CERTFR-2026-ALE-013 le 14 octobre 2026 (« Vulnérabilité dans Ivanti Connect Secure (ICS) », selon la liste des alertes ; page de l'alerte non ouverte).
- **Nature :** contournement d'authentification par usurpation ; un attaquant distant **non authentifié** peut exécuter des commandes arbitraires.
- **Score :** CVSS 3.1 = 8,6 (HIGH), source NVD.
- **Versions :** NVD : « ICS before version 25.1.3.0 »; « does not impact ICS version 22.7R2.14 or prior ». Plages NVD : 25.1.0.0 à avant 25.1.1.2 et 25.1.2.0 à avant 25.1.3.0 ; versions 22.8 R2 à R2.4 listées. **Version corrigée et contournement officiel : non lus** (page Ivanti illisible). À vérifier sur l'avis Ivanti.
- **Ce que tu vérifies chez toi (si tu as Connect Secure) :** (1) la version exacte du boîtier et si elle est dans les plages ci-dessus ; (2) si le portail est joignable depuis Internet ; (3) l'outil de vérification d'intégrité du constructeur et les journaux du boîtier autour du 13 octobre.
- Sources : https://nvd.nist.gov/vuln/detail/CVE-2026-104935 (API consultée 2026-10-23) ; KEV : https://www.cisa.gov/known-exploited-vulnerabilities-catalog (2026-10-23) ; CERT-FR : https://cert.cyber.gouv.fr/alerte/ (2026-10-23).

### 2. Cisco Secure Email Gateway — CVE-2026-76519
- **Exploitation active :** oui. Cisco écrit : « In October 2026, the Cisco PSIRT became aware of active exploitation of this vulnerability. » KEV : 2026-10-14.
- **Nature :** écriture de fichier arbitraire (« Arbitrary File Write »), distante et **non authentifiée**.
- **Score :** CVSS 3.1 = 9,8 (`AV:N/AC:L/PR:N/UI:N`), source Cisco.
- **Conditions :** le service File Reputation (AMP) doit être activé et assigné à une politique de messagerie, **et** la version de Content Scanner Tools doit être antérieure à 25.3.0.5525.
- **Corrigé :** AsyncOS 15.5 → 15.5.5-014 ; 16.5 → 16.5.0-780 ; 16.0 → « migrer vers une version corrigée » ; correctif aussi via Content Scanner Tools 25.3.0.5525 ou plus.
- **Contournement :** aucun (« There are no workarounds that address this vulnerability »).
- **Ce que tu vérifies (si tu as Secure Email Gateway) :** version d'AsyncOS et de Content Scanner Tools ; File Reputation activé ou non ; traces dans les journaux après le début octobre.
- Source : https://sec.cloudapps.cisco.com/security/center/content/CiscoSecurityAdvisory/cisco-sa-esa-afw-zqYJkjxp (2026-10-23).

### 3. Palo Alto Networks PAN-OS — CVE-2026-0322 (interface d'administration)
- **Exploitation active :** oui, mais décrite comme limitée : « Very limited exploitation has been observed targeting the Palo Alto Networks management interface. » Maturité d'exploitation : ATTACKED. Urgence suggérée : HIGHEST. KEV : 2026-10-14.
- **Nature :** exécution de code à distance **authentifiée** dans l'interface d'administration (privilèges requis : élevés). Il faut des identifiants valides.
- **Score :** CVSS 4.0 = 8,6 (HIGH).
- **Produits :** pare-feu PA-Series, VM-Series, Panorama. Cloud NGFW et Prisma Access : non affectés. Aucune configuration particulière requise.
- **Corrigé (extraits de l'avis) :** 12.2 → 12.2.4 ; 12.1 → 12.1.10-h2 ; 11.2 → 11.2.16 ; 11.1 → 11.1.16-h3 ; 10.2 → 10.2.18-h12 ; des correctifs intermédiaires existent par sous-branche (ex. 10.2.16-h11, 11.2.13-h3) : se reporter à l'avis pour ta branche exacte.
- **Contournement :** aucun contournement complet ; couverture partielle limitée par des signatures Threat Prevention (IDs 510046 et 510047, avec déchiffrement SSL) ; l'avis recommande de limiter l'accès à l'interface d'administration à des IP de confiance ou à un poste de rebond.
- **Ce que tu vérifies (si tu as PAN-OS) :** version et branche ; **l'interface d'administration est-elle joignable depuis Internet ?** (idéalement non) ; comptes administrateurs et connexions inattendues dans les journaux.
- Source : https://security.paloaltonetworks.com/CVE-2026-0322 (2026-10-23).

### 4. Microsoft Windows (shell) — CVE-2026-96951
- **Exploitation active :** oui (KEV 2026-10-13, échéance 2026-10-16).
- **Nature :** injection de commande dans le shell Windows ; contournement d'une fonction de sécurité par le réseau (« security feature bypass »).
- **Score :** CVSS 3.1 = 8,8 (HIGH), source Microsoft via NVD.
- **Versions corrigées (numéros de build lus dans NVD) :** Windows Server 2016 → 10.0.14393.9612 ; 2019 → 10.0.17763.9376 ; 2022 → 10.0.20348.5761 ; 2025 → 10.0.26100.33650 ; Windows 10 22H2 → 10.0.19045.7807 ; 10 21H2 → 10.0.19044.7807 ; Windows 11 23H2 → 10.0.22631.7652 ; 24H2 → 10.0.26100.9711 ; 25H2 → 10.0.26200.9711. Pour Windows Server 2012 R2, NVD liste le produit sans borne de version : non interprétable. **Numéros de KB et page MSRC : non lus.**
- **Ce que tu vérifies :** le numéro de build des serveurs et postes (`winver`, ou la valeur `UBR` du registre) et l'état des mises à jour de ce mois sur les contrôleurs de domaine et serveurs de fichiers.
- Sources : https://nvd.nist.gov/vuln/detail/CVE-2026-96951 (2026-10-23) ; MSRC : https://msrc.microsoft.com/update-guide/en-US/vulnerability/CVE-2026-96951 (non lisible).

### 5. Fortinet — CVE-2025-61624 (FG-IR-26-122, FortiOS, FortiPAM, FortiProxy, FortiSwitchManager)
- **Exploitation active :** oui (« Known Exploited: Yes » ; KEV 2026-10-16).
- **Nature :** traversée de chemin dans la ligne de commande : un administrateur authentifié avec au moins lecture-écriture peut écrire ou supprimer des fichiers arbitraires via des commandes CLI.
- **Score :** CVSS 3.1 = 6,0 (Medium). Le score est modéré parce qu'il faut déjà être administrateur ; l'exploitation constatée justifie malgré tout d'agir.
- **Corrigé :** FortiOS 7.6.5 et 7.4.10 ; FortiProxy 7.6.5 et 7.4.12 ; FortiSwitchManager 7.2.8 et 7.0.7 ; FortiPAM 1.7.1. FortiOS 7.2, 7.0, 6.4 et FortiProxy 7.2, 7.0 : toutes les versions affectées, « migrer vers une version corrigée ».
- **Contournement :** aucun ; un correctif virtuel (signature FG-VD-59270) existe dans la mise à jour de base FMWP 25.120.
- **Ce que tu vérifies (si tu as FortiGate/FortiOS) :** version en place ; qui possède un compte administrateur avec écriture ; accès d'administration limité aux réseaux de confiance.
- Source : https://fortiguard.fortinet.com/psirt/FG-IR-26-122 (2026-10-23).

### Vu mais non détaillé aujourd'hui
- **Citrix NetScaler ADC et Gateway — CVE-2026-88779** (déni de service, KEV 2026-10-04) : NVD indique avant 14.1-73.41, avant 13.1-64.28, avant 13.1-37.282 pour les variantes FIPS ; CVSS 4.0 = 8,7 et 3.1 = 7,5. Le CERT-FR a publié CERTFR-2026-ALE-011 le 28 septembre 2026 (mis à jour le 5 octobre). Avis Citrix non lu.
- Hors de ta liste : alerte CERT-FR du 21 octobre 2026 sur PHP (CERTFR-2026-ALE-014).

### Pile de production du projet
- **Next.js (dépôt SentinelScope).** `main` déclare `next ^14.2.35`. Les pages d'avis lues indiquent trois avis **critiques** sans correctif listé en 14.x (images : GHSA-2464…, GHSA-2xp9… ; Windows : GHSA-p293…). La PR #45 (Next 16.4.2) les corrige mais n'est pas fusionnée. L'applicabilité réelle n'est pas établie. Issue ouverte : https://github.com/maltid2/plateforme-/issues/49 (consultée 2026-10-23). Sources : pages GitHub Advisory (GHSA-2464-fhr4-w9xw, GHSA-2xp9-vwfh-vxw4, GHSA-p293-qw3h-jr36) et API npm, 2026-10-23.

### Non traité aujourd'hui
Intelligence artificielle et nouvelles technologies : volume des avis ci-dessus suffisant, rien consigné.
