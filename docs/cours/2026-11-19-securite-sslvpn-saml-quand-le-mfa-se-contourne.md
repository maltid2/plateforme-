# Fiche — SSLVPN et SAML : comment un MFA peut être contourné par « une autre méthode d'authentification » (SonicWall CVE-2026-19868)

*Piste : sécurité de l'infrastructure · jeudi 19 novembre 2026 · lecture : 25 min*

> **Rappel :** cette fiche explique un mécanisme. **Ne teste aucune faille sur un équipement réel** (ni chez ton employeur ni ailleurs). Vérifier la version d'un SonicWall et si son SSLVPN est exposé est de l'exploitation normale ; reproduire le contournement ne l'est pas.

## 1. Pourquoi ce mécanisme
Un SSLVPN est une porte d'entrée sur Internet. Si le MFA exigé par le fournisseur d'identité peut être « sauté », le VPN accepte un mot de passe seul. C'est ce que la description officielle de l'avis laisse entendre (§3). Comprendre ce qui est *censé* se passer te permet de poser les bonnes questions au prestataire.

## 2. Le mécanisme
**Ce qui est lu (sources §10).** CISA (catalogue KEV, ajouté le 2026-11-06, échéance 2026-11-20) et le NVD décrivent : une vulnérabilité d'application de l'authentification dans le service **SSLVPN de SonicOS** ; un utilisateur disposant d'identifiants valides pour **une autre méthode d'authentification** peut **contourner les contrôles SAML** ; l'exploitation peut aussi contourner le **MFA imposé par SAML**.

**Ce qu'est SAML (source Microsoft Learn, lue le 2026-11-19).** Le service (ici le VPN) est le **fournisseur de service** ; l'annuaire/SSO est le **fournisseur d'identité**. Le service envoie un **`AuthnRequest`** (par redirection HTTP) ; le fournisseur d'identité authentifie l'utilisateur — **c'est là que se passe le MFA** — puis renvoie par **POST HTTP** une réponse portant une **assertion**. L'élément `RequestedAuthnContext` permet de **demander des méthodes d'authentification précises** ; l'assertion indique la méthode réellement utilisée dans `AuthnContextClassRef` (exemple de la documentation : `…:ac:classes:Password`).

**Le point d'attention (inférence de ma part, non confirmée par l'éditeur).** Le MFA n'a de valeur que si le service **n'accepte pas d'autre chemin** vers la session. Un équipement qui propose plusieurs méthodes (locale, RADIUS, SAML…) doit imposer, **pour ce portail**, la méthode SAML ; si un chemin alternatif reste accepté, le contrôle SAML est contourné. **Je ne sais pas si c'est le mécanisme exact** : la page de l'avis SonicWall (SNWLID-2026-0014) ne m'est pas lisible (page vide côté serveur, JavaScript), donc je n'ai ni versions affectées ni versions corrigées, ni contournement officiel.

## 3. Lecture du réel
Extrait authentique (flux CISA KEV, lu le 2026-11-19) : `vulnerabilityName` « SonicWall SonicOS SSLVPN Use of Single-factor Authentication Vulnerability » ; `dateAdded` 2026-11-06 ; échéance 2026-11-20. NVD (lu le 2026-11-19) : CVSS 3.1 de **7,5** (vecteur `AV:N/AC:H/PR:N/UI:N/S:C/C:H/I:L/A:N`, source « Secondary »), statut *Analyzed*, référence vers `psirt.global.sonicwall.com/vuln-detail/SNWLID-2026-0014`. Lecture : `AV:N` = joignable par le réseau ; `AC:H` = conditions d'exploitation complexes ; `PR:N` = aucun privilège préalable **selon le score** (la description exige pourtant des identifiants valides pour une autre méthode : à ne pas confondre avec « sans compte ») ; `S:C` = périmètre franchi.

## 4. Ce qui casse, et le symptôme
Symptôme : des sessions VPN établies **sans** passage par le MFA, visibles côté fournisseur d'identité (pas de trace d'authentification) alors que le VPN journalise une connexion. À rapprocher : journaux VPN, journaux du fournisseur d'identité, heures. *(Méthode générale, non spécifique à cet avis.)*

## 5. Vocabulaire
| Français | English | Définition / piège |
|---|---|---|
| fournisseur d'identité | identity provider (IdP) | authentifie (MFA) |
| fournisseur de service | service provider (SP) | le VPN, ici |
| assertion | assertion | déclaration signée sur l'utilisateur |
| contexte d'authentification | authentication context | méthode utilisée |
| authentification multifacteur | multi-factor authentication | plus d'un facteur |
| contournement | bypass | |
| exploitation active | known exploited | listé au KEV |
| mesure de contournement temporaire | workaround | ≠ correctif |
| échéance | due date | date imposée aux agences américaines, pas à toi |
| SSLVPN | SSL VPN | accès distant via TLS |
Faux amis : « MFA activé » ≠ « MFA imposé » ; « SAML » (protocole) ≠ « le fournisseur d'identité ».

## 6. Comment le dire juste
- **Collègue :** « Le MFA est configuré sur le SSO, mais le VPN accepterait une autre méthode : je vérifie quelles méthodes le portail accepte et la version. »
- **Prestataire (EN) :** "Our SSLVPN uses SAML for MFA. Can you confirm which authentication methods are enabled on the portal and whether our SonicOS version is covered by SNWLID-2026-0014?"
- **Ticket (EN) :** "SonicOS SSLVPN: CVE-2026-19868 (listed in CISA KEV, due 2026-11-20). Verify firmware version, exposure of the SSLVPN portal, and enabled authentication methods; review VPN vs IdP logs for sessions without MFA."

## 7. Exercice (labo / papier, 20 min)
Pas de manipulation. À partir de la description CISA, écris sur une page : 1) les trois acteurs d'un SSO SAML, 2) l'endroit où le MFA se joue, 3) l'hypothèse « quels chemins alternatifs le VPN accepte-t-il ? ». Compare ensuite avec l'avis SonicWall quand tu y as accès.
<details><summary>Solution</summary>
1) Utilisateur, fournisseur de service (VPN), fournisseur d'identité. 2) Chez le fournisseur d'identité. 3) Méthodes locale/RADIUS/SAML : si une autre est acceptée sur le portail, le contrôle SAML est inopérant. Hypothèse à confirmer par l'avis.
</details>

## 8. Révision espacée
Hier (SQL, verrous) : 1) Pourquoi une requête au bon plan attend-elle ? 2) Que signifie l'erreur 1205 ? Il y a sept jours (12 nov, OpenSSH/musl) : 3) Que vaut un champ mot de passe `*` ?

## 9. Questions de contrôle
1. Où se joue le MFA dans un SSO SAML ? 2. Pourquoi « MFA configuré » ne suffit-il pas ? 3. Que ne sait-on pas de cet avis sans l'avis SonicWall ?
<details><summary>Réponses</summary>
1. Chez le fournisseur d'identité. 2. Si le service accepte une autre méthode, le MFA peut être évité. 3. Versions affectées/corrigées, contournement officiel, mécanisme exact.
</details>

## 10. Sources (consultées le 2026-11-19)
- CISA, catalogue KEV (flux JSON) : https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json — CVE-2026-19868, dateAdded, description.
- NVD API 2.0, CVE-2026-19868 : https://services.nvd.nist.gov/rest/json/cves/2.0?cveId=CVE-2026-19868 — score, vecteur, références.
- Microsoft Learn, « Single sign-on SAML protocol » : https://learn.microsoft.com/en-us/entra/identity-platform/single-sign-on-saml-protocol — AuthnRequest, réponse POST, RequestedAuthnContext.
- SonicWall PSIRT SNWLID-2026-0014 : https://psirt.global.sonicwall.com/vuln-detail/SNWLID-2026-0014 — **non lisible** (page vide).
