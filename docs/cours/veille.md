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

---

## 2026-10-23 (vendredi) — Intelligence artificielle et nouvelles technologies (ajout)

Critère de tri : est-ce que ça change la façon de faire travailler ta flotte d'agents, ou ce que tu peux vendre. Sources **officielles** lues le 2026-10-23 ; les sites de presse et blogs trouvés par recherche web ont été traités comme des rumeurs tant qu'ils n'étaient pas confirmés par une source officielle (voir la dernière rubrique, où plusieurs se sont révélés faux ou contredits).

Vocabulaire d'état : **annoncé** = l'éditeur l'a dit ; **disponible** = utilisable aujourd'hui (changelog ou documentation) ; **rumeur** = source secondaire non confirmée.

### 1. Agent Skills passe à une fondation neutre — **annoncé le 22 octobre 2026**
- **Fait :** Anthropic donne le standard Agent Skills (instructions et savoir-faire spécialisés pour agents) à l'Agentic AI Foundation (AAIF), placée sous la Linux Foundation. Elle a été cofondée avec Block et OpenAI et héberge déjà le Model Context Protocol (MCP). Sont transférés : le nom et le logo, l'organisation GitHub et le domaine agentskills.io. Anthropic dit vouloir le garder « open, community-driven, and vendor-neutral ».
- **Chiffres donnés par Anthropic (non vérifiés indépendamment) :** plus de 70 plateformes d'agents l'ont intégré (dont ChatGPT, Cursor, GitHub Copilot, VS Code), 1 million de skills publiés, près de 280 millions d'installations.
- **Prévu mais non daté :** versions numérotées, processus formel de proposition, **consignes de sécurité pour ceux qui écrivent et installent des skills**.
- **Ce que ça change pour toi :** les instructions que tu confies à ta flotte sous forme de skills ne sont plus liées à un seul fournisseur ; elles resteront utilisables si tu changes d'outil. Conséquence pratique (mon avis, pas celui de l'annonce) : tant que les consignes de sécurité n'existent pas, n'installe pas de skill dont tu ne maîtrises pas le contenu : une skill est du texte qui guide un agent, donc elle peut lui faire exécuter des actions.
- Source : https://www.anthropic.com/news/donating-agent-skills-to-the-agentic-ai-foundation (2026-10-23).

### 2. Gamme Claude et tarifs — **disponible** (page de documentation consultée le 2026-10-23)
| Modèle | ID d'API | Entrée / sortie par million de jetons | Retrait (engagement Anthropic) |
|---|---|---|---|
| Claude Fable 5.1 | `claude-fable-5-1` | 10 $ / 50 $ | pas avant le 1er septembre 2027 |
| Claude Opus 5.5 | `claude-opus-5-5` | 4 $ / 20 $ | pas avant le 22 septembre 2027 |
| Claude Sonnet 5.5 | `claude-sonnet-5-5` | 2 $ / 10 $ | pas avant le 28 septembre 2027 |
| Claude Haiku 5.5 | `claude-haiku-5-5` | à partir de 0,10 $ / 0,50 $ | pas avant le 7 octobre 2027 |

Les quatre ont 1 million de jetons de contexte et 128 000 jetons de sortie maximum. L'API par lots coûte 50 % de moins ; la lecture depuis le cache d'invites coûte 10 % du prix d'entrée de base (5 % pour Opus 5.5 et Sonnet 5.5, 2,5 % pour Fable 5.1 et Mythos 5.1, selon la page). La documentation recommande Opus 5.5 pour la plupart des usages, Fable 5.1 pour le raisonnement exigeant et le travail d'agent de longue haleine, Haiku 5.5 pour la classification, l'extraction et l'aiguillage.
- **Ce que ça change pour toi :** un coût par rôle d'agent peut se raisonner : Haiku pour les tâches répétitives et de tri, Sonnet pour le travail courant, Opus ou Fable pour les cas difficiles. Les dates de retrait donnent un horizon stable de près d'un an. Je ne connais pas le modèle réellement utilisé par chaque agent de ta flotte : à vérifier chez toi.
- Source : https://platform.claude.com/docs/en/about-claude/models/overview (2026-10-23).

### 3. MCP : spécification du 28 juillet 2026 — **disponible** (page officielle lue)
- **Fait (page officielle) :** la spécification en vigueur est datée 2026-07-28. Elle décrit des requêtes **sans état et autonomes** (*stateless, self-contained*) et une négociation des capacités **à chaque requête**. Extensions optionnelles : **Tasks** (opérations asynchrones de longue durée), **Skills over MCP** (instructions d'agents découvertes via MCP) et **MCP Apps** (interfaces interactives dans la conversation).
- **Rumeur / source secondaire :** des blogs affirment que la révision supprime la poignée de main `initialize` et l'en-tête `Mcp-Session-Id`, avec une période de dépréciation de 12 mois pour certaines fonctions. La page officielle que j'ai lue ne détaille pas ces points : **non confirmé**.
- **Ce que ça change pour toi :** si tes agents utilisent des serveurs MCP (c'est le cas de ta session), une mise à jour côté client ou serveur peut être nécessaire à terme ; l'extension Tasks et le lien avec les skills vont dans le sens de la flotte d'agents. Non vérifié sur ton installation.
- Source : https://modelcontextprotocol.io/specification (2026-10-23).

### 4. Anthropic Cyber Mission — **annoncée le 8 octobre 2026**
- **Fait :** engagement à long terme pour aider les défenseurs : programme pour les infrastructures critiques (CIDP, avec notamment Palo Alto Networks, CrowdStrike, Deloitte, Accenture parmi les partenaires fondateurs), **OSS Scanner** (analyses périodiques gratuites de projets open source, avec preuve de concept, explication et correctif proposé), financement de fondations open source, et **Cyber Verification Program** (accès élargi aux capacités cyber de Claude pour un usage défensif).
- **Réserves dites par Anthropic :** les rapports d'OSS Scanner sont « sent without human review » ; l'objectif annoncé est un taux de vrais positifs supérieur à 90 % : c'est une **attente**, pas un résultat mesuré.
- **Ce que ça change pour toi :** deux pistes à évaluer, sans rien supposer : le Cyber Verification Program, si ton travail d'audit défensif se heurte à des refus de modèle ; OSS Scanner, seulement si un dépôt open source est concerné (je ne sais pas si le dépôt SentinelScope est public). La [mise à jour de la politique d'usage](https://www.anthropic.com/news/2026-usage-policy-update) (effective le 12 novembre 2026) ne mentionne, dans la page lue, **ni cybersécurité ni scan automatisé** ; elle précise notamment l'obligation d'un humain dans la boucle et d'une information des personnes pour les usages à haut risque. À relire pour ton produit.
- Sources : https://www.anthropic.com/news/anthropic-cyber-mission ; https://www.anthropic.com/news/2026-usage-policy-update (2026-10-23).

### 5. Google et OpenAI : ce qui est réellement **disponible** — et pourquoi je n'ai pas repris la presse
- **Google (journal des modifications officiel) :** Gemini 4 Argon (`gemini-4-argon`) est **en disponibilité générale depuis le 13 octobre 2026**. Prix standard : 2 $ en entrée et 10 $ en sortie par million de jetons jusqu'au 30 novembre 2026, puis 4 $ et 20 $ à partir du 1er décembre 2026. Gemini 3.8 Flash : 0,75 $ / 3,75 $ jusqu'au 31 décembre 2026, puis 1,50 $ / 7,50 $.
- **OpenAI (journal des modifications officiel) :** GPT-6 Sol et GPT-6 Luna le 22 septembre 2026, GPT-6.1 Sol le 29 septembre 2026 ; le 22 octobre, l'API Decisions passe en disponibilité générale avec `gpt-6-luna` ; ajouts récents côté agents (mode « Ultrafast », bacs à sable hébergés, cache d'invites de 12 heures).
- **Rumeurs contredites par ces sources officielles :** une recherche web m'a d'abord rapporté que le modèle OpenAI de l'automne était « abandonné » (GPT-6.1 Astra) et qu'un lancement GPT-6 aurait eu lieu le 7 octobre ; le journal officiel montre au contraire GPT-6.1 Sol publié le 29 septembre et GPT-6 le 22 septembre. De même, une source secondaire disait Gemini 4 Argon limité à un aperçu restreint le 30 septembre ; le journal officiel indique une disponibilité générale le 13 octobre. **Leçon pratique : une seule source secondaire ne suffit pas, y compris pour des dates et des noms de modèles.**
- **Ce que ça change pour toi :** rien d'obligatoire. Ta flotte est construite sur Claude ; ces sorties comptent pour la pression sur les prix (le tarif d'entrée de Gemini 4 Argon, 2 $ puis 4 $ par million de jetons, se compare à 4 $ pour Claude Opus 5.5, **sans que je compare leurs performances**, que je n'ai pas mesurées).
- Sources : https://ai.google.dev/gemini-api/docs/changelog ; https://ai.google.dev/gemini-api/docs/pricing ; https://developers.openai.com/api/docs/changelog (2026-10-23).

### Écartées
Introduction en bourse d'Anthropic, litiges publics, « modèles à venir » : rumeurs ou hors critère, non consignées.

---

## 2026-10-23 (vendredi) — Innovation, sorties et TikTok (ajout)

Même règle : officiel lu = consigné ; presse secondaire = rumeur tant que non confirmée.

### 1. Microsoft : « Securing the agentic insider » — **billet publié le 19 octobre 2026**
- **Fait (billet de Hayete Gallot, Microsoft Security) :** les agents d'entreprise sont souvent **sur-privilégiés** (accès à des données, outils et systèmes) et imprévisibles ; Microsoft les appelle des « agentic insiders » (initiés agentiques). Position affichée : « frontier models ... cannot be trusted » (non par malveillance, mais parce qu'ils sont entraînés à atteindre un résultat, ce qui peut conduire à des contournements). Proposition en trois volets : capteurs et signaux pour découvrir les agents et les placer sous gestion, notation dynamique du risque, et **Guardian Agents** qui surveillent et modèrent les actions avant leur exécution.
- **Statut :** concept et positionnement. **Project Perception** (annoncé en juillet 2026) n'a pas de date de disponibilité dans le billet ; **aucune configuration concrète** (Entra, permissions, journalisation) n'est donnée.
- **Ce que ça change pour toi :** le principe utile, applicable dès maintenant à ta flotte : **donner à chaque agent une identité, un périmètre isolé et des permissions minimales, et garder des traces de ce qu'il a fait**. C'est le moindre privilège appliqué aux agents. C'est un billet d'éditeur : les produits cités sont de la promesse, pas du disponible.
- Source : https://blogs.microsoft.com/blog/2026/10/19/securing-the-agentic-insider/ (2026-10-23).
- Titres vus sur le blog Microsoft, **non lus** : « Advancing digital sovereignty with greater control and choice » (20 oct.), « Microsoft to expand Azure Maia system to multi-gigawatt deployments » (12 oct.), « Introducing the new Copilot with Home, Code and Autopilot » (25 sept.). Source : https://blogs.microsoft.com/ (2026-10-23).

### 2. TikTok
- **Officiel (salle de presse, seul billet visible) :** « What's shaping the holiday season on TikTok Shop » (14 octobre 2026) : retours possibles dans environ 10 000 points Happy Returns **aux États-Unis**, badge « 3-Day Delivery », assurance bijoux d'un an, Black Friday et Cyber Monday du 11 au 30 novembre sur TikTok Shop. La page affiche un pied de page « © 2025 » : à relativiser. Source : https://newsroom.tiktok.com/en-us (2026-10-23).
- **Presse (ABC News, 3 septembre 2026) :** nouveaux commentaires : **commentaires vocaux** jusqu'à 60 secondes (comptes de 18 ans et plus), **sondages** ajoutés par le créateur à son propre commentaire (jusqu'à cinq options), **carrousel de photos** jusqu'à neuf images, déploiement mondial « over the next month » ; les commentaires en Live Photo sont déjà disponibles. Source secondaire (non confirmée par la salle de presse) : https://goodmorningamerica.com/living/story/tiktok-announces-new-ways-comment-including-voice-messages-136153358 (2026-10-23).
- **Non trouvé :** aucune annonce de fonctionnalité TikTok datée d'octobre 2026 dans une source officielle.
- **Ce que ça change pour toi :** rien d'opérationnel sur ta flotte ni ton produit ; ce serait utile seulement si tu communiques sur TikTok (je n'en sais rien).

### 3. Matériel grand public (Apple, Microsoft Surface, Nvidia, Samsung) : **non confirmé**
Les résultats de recherche ne contiennent que de la presse d'avant-événement (par exemple des vagues de lancements Apple annoncées par un journaliste, une conférence Windows/Surface du 7 octobre, des hausses de prix Samsung). La page officielle Apple lue ne listait aucun article. **Je ne consigne aucune sortie de produit** faute de source officielle lue.

---

## 2026-10-23 — Correctif à l'entrée « Agent Skills » (ajout)

Vérification demandée par Aymerick sur les chiffres de l'annonce Anthropic du 22 octobre 2026.
- **« 1 million de skills » et « près de 280 millions d'installations » :** retrouvés dans un rapport de **Vercel** (publié le 25 septembre 2026, chiffres jusqu'en août 2026), qui les attribue au **registre skills.sh** (lancé par Vercel en janvier 2026) : « In seven months, the skills.sh registry grew to one million agent skills and recorded nearly 280 million installs. » Ce sont donc des chiffres d'**un registre précis**, pas nécessairement de « tout l'écosystème » ; l'annonce Anthropic, telle que je l'ai lue, ne précise pas cette provenance dans mon résumé. Confirmé par une source indépendante d'Anthropic, mais **avec cette réserve de périmètre**.
- **« Plus de 70 plateformes » :** **non confirmé**. Ni le site agentskills.io (qui renvoie à une « Client Showcase » sans chiffre lu), ni le dépôt GitHub `agentskills` (aucune liste d'adoptants visible), ni le rapport Vercel (aucun décompte) ne donnent ce nombre. La seule autre figure trouvée : « 30+ plateformes » dans un annuaire tiers, qui agrège un autre ensemble de skills (plus de 100 000) : elle ne confirme ni n'infirme le chiffre.
- **Ce que le site officiel confirme :** une skill est un dossier contenant un fichier `SKILL.md` (métadonnées `name` et `description` + instructions), éventuellement avec scripts, références et ressources ; les agents les chargent par « divulgation progressive » (découverte, activation, exécution). Le dépôt `agentskills/agentskills` affiche 26 485 étoiles, licence Apache-2.0 (page GitHub lue le 2026-10-23).
- Sources : https://vercel.com/blog/state-of-agent-skills ; https://agentskills.io ; https://github.com/agentskills (2026-10-23).

---

## 2026-10-24 (samedi)

Sources consultées le 2026-10-24 : catalogue CISA KEV (`catalogVersion` 2026.10.23, publié le 2026-10-23 à 19 h 30 UTC), pages PSIRT Palo Alto et Fortinet (lues), liste des avis du CERT-FR (page lue, entrées du 23 octobre). Non lue : la liste des avis Cisco (page vide à la lecture, gabarit non rendu). Les avis déjà consignés hier (Ivanti, Cisco Secure Email Gateway, PAN-OS CVE-2026-0322, Windows CVE-2026-96951, Fortinet CVE-2025-61624, Citrix CVE-2026-88779) ne sont pas répétés.

### Nouveautés du catalogue KEV depuis le 21 octobre
Deux entrées, **toutes deux hors de ta liste d'éditeurs** : Arista VeloCloud Orchestrator, injection SQL (CVE-2026-114625), et Collabora Online, injection de commande dans le serveur CODE intégré (CVE-2026-110447), toutes deux ajoutées le 2026-10-23 avec échéance au 2026-10-26. Aucune entrée nouvelle pour Palo Alto, Fortinet, Cisco, Microsoft, Ivanti, Citrix, Veeam, VMware ou les autres éditeurs de ta liste. Détails non lus (nom et date uniquement).

### 1. Palo Alto PAN-OS : failles PHP (CVE-2026-109618 et CVE-2026-109619) — **corrigés « bientôt », pas encore tous disponibles**
- **Exploitation :** Palo Alto écrit ne connaître aucune exploitation malveillante contre ses produits (« not aware of any malicious exploitation »). Le CERT-FR a publié le 21 octobre 2026 l'alerte CERTFR-2026-ALE-014 « Multiples vulnérabilités dans PHP », et sa page indique que des preuves de concept existent pour ces deux CVE dans certains déploiements PHP (selon la liste des alertes ; alerte non ouverte).
- **Score et urgence :** 8,7 HIGH (CVSS 4.0, évaluation de l'avis), score éditeur 9,2, « urgence suggérée » MODERATE, 7,1 si l'accès d'administration passe par un poste de rebond.
- **Produits :** PAN-OS sur pare-feu PA-Series et VM-Series et sur Panorama. Aucune configuration particulière requise. Le risque est le plus élevé quand l'**interface d'administration est joignable depuis Internet** ; l'interface de données n'est concernée que si un profil de gestion y est attaché. GlobalProtect (portail, passerelle, VPN sans client) et le portail captif ne sont pas concernés.
- **Versions affectées → corrigées (dates de disponibilité estimées par l'éditeur, fin octobre) :** 12.2 → 12.2.4-h1 (28/10) ; 12.1 → 12.1.4-h13 (29/10), 12.1.7-h11 (28/10), 12.1.10-h3 (30/10) ; 11.2 → 11.2.4-h23 (30/10), 11.2.7-h23 (29/10), 11.2.10-h16 (26/10), 11.2.13-h4 (27/10), 11.2.16-h1 (28/10) ; 11.1 → 11.1.4-h38 (29/10), 11.1.6-h40 (29/10), 11.1.7-h12 (30/10), 11.1.10-h36 (28/10), 11.1.13-h16 (27/10), 11.1.16-h4 (26/10) ; 10.2 → 10.2.7-h39 (30/10), 10.2.10-h42 (29/10), 10.2.13-h27 (27/10), 10.2.16-h12 (28/10), 10.2.18-h13 (26/10). L'avis dit que les correctifs arrivent dans « les prochaines versions » : **ces dates sont des estimations**.
- **Contournement :** signatures Threat Prevention (identifiant 543004 et la série 97622 à 97678, contenu Applications et Threats 9162, 9163 ou 9164 minimum selon la branche) ; acheminer le trafic du port de gestion par un port de données, remplacer le certificat de gestion entrant, déchiffrer le trafic de gestion entrant ; **surtout, restreindre l'accès à l'interface d'administration aux IP internes de confiance**.
- **Ce que tu vérifies (si tu as PAN-OS) :** (1) ta branche et ta version exacte, et si un correctif de la liste ci-dessus est déjà publié pour elle ; (2) **l'interface d'administration est-elle joignable depuis Internet ?** C'est la même question que pour CVE-2026-0322 (entrée du 2026-10-23) : restreindre cet accès réduit les deux risques ; (3) si un profil de gestion est attaché à une interface de données.
- Source : https://security.paloaltonetworks.com/CVE-2026-109618 (publié le 2026-10-21, mis à jour le 2026-10-24, consulté le 2026-10-24).

### 2. Fortinet FortiSandbox : contournement d'authentification — CVE-2026-107656 (FG-IR-26-185) — **pas d'exploitation constatée**
- **Exploitation :** « Known Exploited: No » ; pas de contournement ni de correctif virtuel.
- **Score :** CVSSv3 9,6, **Critical**. Un attaquant distant **non authentifié** peut contourner la connexion de l'interface web de gestion avec des requêtes HTTP forgées (CWE-288) et exécuter du code ou des commandes. L'avis ne dit pas explicitement que l'interface doit être exposée sur Internet.
- **Versions affectées → corrigées :** FortiSandbox 5.0.0 à 5.0.6 → 5.0.7 ou plus ; 4.4.0 à 4.4.9 → 4.4.10 ou plus ; 5.2 non affecté. FortiSandbox PaaS 5.0.0 à 5.0.6 → 5.0.7 ou plus ; PaaS 4.4 : toutes les versions, migrer vers une version corrigée. L'avis ne liste **aucun autre produit** (FortiOS, FortiProxy, FortiManager non listés).
- **Ce que tu vérifies (si tu as un FortiSandbox) :** version ; interface web joignable ou non depuis Internet ; qui peut l'atteindre. Publié le 2026-10-13.
- Source : https://fortiguard.fortinet.com/psirt/FG-IR-26-185 (consulté le 2026-10-24).

### Vu, non détaillé
- Autres avis Fortinet du 13 octobre 2026 dans la liste PSIRT : FG-IR-26-179 (contournement d'authentification de l'API Fabric, gravité Medium), FG-IR-26-178 (lecture/écriture de fichiers via injection SQL, High), FG-IR-26-177 (exécution de commande dans fgfmsd, Medium) ; produits et versions non lus. Source : https://www.fortiguard.com/psirt (2026-10-24).
- Avis du CERT-FR du 23 octobre 2026 : CERTFR-2026-AVI-1371 sur Microsoft Edge (contenu non précisé dans la page lue) ; AVI-1369 sur HPE Aruba Networking ; autres avis du jour hors liste. Source : https://cert.cyber.gouv.fr/avis/ (2026-10-24).

### Pile de production du projet
Pas de nouvelle trouvaille aujourd'hui sur Next.js, React ou Node. L'issue #49 reste ouverte. Fait de projet : la PR #50 (GHOST, « alléger les animations du hero ») est ouverte depuis le 23 octobre ; elle porte sur les deux animations que la fiche n° 1 désigne comme coûteuses (cadre lumineux et reflet du titre). Je ne l'ai pas relue.

---

## 2026-10-25 (dimanche)

Sources consultées le 2026-10-25 : catalogue CISA KEV (`catalogVersion` 2026.10.23, publié le 2026-10-23 ; **aucune entrée nouvelle** depuis la lecture du 24 octobre). Aucun nouvel avis retenu aujourd'hui ; les avis déjà consignés ne sont pas répétés. Rotation du dimanche : synthèse de la semaine ([`2026-10-25-synthese-de-la-semaine.md`](2026-10-25-synthese-de-la-semaine.md)). Rappel de ce qui reste ouvert : issues #48 (garde SSRF) et #49 (Next.js), PR #45, #46 et #50 non fusionnées au 2026-10-25 (liste des PR lue le même jour).

---

## 2026-10-26 (lundi)

Sources consultées le 2026-10-26 : catalogue CISA KEV (`catalogVersion` 2026.10.23, inchangé : **aucune entrée nouvelle**), liste des alertes du CERT-FR (**aucune alerte nouvelle** après CERTFR-2026-ALE-014 du 21 octobre), liste PSIRT Fortinet (aucun avis après le 13 octobre), avis Palo Alto (relu). Cisco : page de liste illisible (gabarit non rendu), non contrôlée.

### Suivi d'une trouvaille déjà consignée : Palo Alto PAN-OS, failles PHP (CVE-2026-109618 et CVE-2026-109619)
Mise à jour de l'avis le **2026-10-26** : plusieurs correctifs sont désormais **publiés** (« released ») : 11.1.4-h38, 11.1.6-h40, 11.1.10-h36, 11.1.13-h16, 11.1.16-h4, 11.2.10-h16 et 10.2.18-h13. Toujours annoncés avec une date estimée : 12.2.4-h1 (28/10), 12.1.4-h13 (29/10), 12.1.7-h11 (28/10), 12.1.10-h3 (30/10), 11.2.4-h23 (30/10), 11.2.7-h23 (29/10), 11.2.13-h4 (27/10), 11.2.16-h1 (28/10), 11.1.7-h12 (30/10), 10.2.7-h39 (30/10), 10.2.10-h42 (29/10), 10.2.13-h27 (27/10), 10.2.16-h12 (28/10). **Statut d'exploitation inchangé** : Palo Alto « is not aware of any malicious exploitation ». Ce que tu vérifies si tu as PAN-OS : si ta branche figure dans la liste « publiée », applique-la ; sinon, **restreins l'accès à l'interface d'administration** en attendant. Source : https://security.paloaltonetworks.com/CVE-2026-109618 (mis à jour le 2026-10-26, consulté le 2026-10-26).

### Rien d'autre aujourd'hui
Aucun nouvel avis activement exploité pour les éditeurs de ta liste. Pile de production du projet : rien de nouveau (issues #48 et #49 ouvertes ; PR #45, #46, #50 non fusionnées au 2026-10-26).

---

## 2026-10-27 (mardi)

Sources consultées le 2026-10-27 : catalogue CISA KEV (`catalogVersion` 2026.10.26, publié le 2026-10-26 à 22 h 24 UTC), alerte CERT-FR CERTFR-2026-ALE-014 (page lue), avis Palo Alto (relu). Les avis déjà consignés ne sont répétés que pour ce qui a changé.

### 1. PHP : exécution de code à distance non authentifiée, **exploitation active constatée** — CVE-2026-109618 et CVE-2026-109619
Ce n'est pas un éditeur de ta liste, mais il touche **Palo Alto PAN-OS** (entrée du 24 octobre) et ton laboratoire WordPress (voir plus bas).
- **Exploitation :** ajoutées au catalogue CISA le **2026-10-26** (échéance fixée au 2026-10-29), ce qui vaut preuve d'exploitation. Le CERT-FR écrit le 26 octobre « constater des tentatives d'exploitation » de ces deux failles (alerte publiée le 21 octobre ; preuves de concept signalées le 22).
- **Nature :** CVE-2026-109618 : corruption mémoire (« out-of-memory corruption ») ; CVE-2026-109619 : état interne de requête périmé (« stale internal request-state ») ; toutes deux permettent à un attaquant distant non authentifié d'exécuter du code (descriptions du catalogue CISA).
- **Versions (CERT-FR) :** à mettre à jour : PHP 8.2.x avant **8.2.35**, 8.3.x avant **8.3.36**, 8.4.x avant **8.4.27**, 8.5.x avant **8.5.12** ; PHP 5.x, 7.x, 8.0.x et 8.1.x ne sont plus supportés (pas de correctif). Le CERT-FR renvoie au bulletin de l'éditeur pour les correctifs ; **je n'ai pas lu ce bulletin**.
- **Contournements cités par le CERT-FR (non qualifiés par lui) :** désactiver le suivi de progression d'envoi (`session.upload_progress.enabled = Off`, avec `php_admin_flag[session.upload_progress.enabled] = off` pour PHP-FPM), ce qui ne réduit la surface d'attaque que pour CVE-2026-109619 ; bloquer au niveau d'un pare-feu applicatif les requêtes dont le `Content-Type` est `multipart`, ou à défaut les superviser. Le CERT-FR recommande aussi d'**isoler les équipements affectés**.
- **Ce que tu vérifies chez toi :** (1) toute machine qui exécute PHP : version exacte (`php -v`) comparée aux seuils ci-dessus ; (2) si elle est joignable depuis Internet ; (3) dans ton lab WordPress du dépôt, l'image `php:8.2-fpm` (ligne 21 de `docker-compose.yml`) : le suffixe `8.2` désigne une branche, pas une version : **la version réellement présente dépend de la date de téléchargement de l'image** ; vérifie qu'elle est ≥ 8.2.35 (je ne peux pas le savoir), et ne l'expose pas à Internet tant que ce n'est pas fait. Ce lab n'est pas la production de SentinelScope (Next.js et Node, sans PHP) : aucune issue ouverte.
- Sources : https://www.cisa.gov/known-exploited-vulnerabilities-catalog ; https://cert.cyber.gouv.fr/alerte/CERTFR-2026-ALE-014/ (consultés le 2026-10-27).

### 2. Suivi : Palo Alto PAN-OS, failles PHP (entrée du 24 octobre)
Avis mis à jour le 2026-10-27 : en plus des versions déjà publiées signalées hier, sont désormais **publiées** 12.2.4-h1, 12.1.7-h11, 10.2.13-h27 et 10.2.16-h12. Restent avec une date estimée : 12.1.4-h13 (29/10), 12.1.10-h3 (30/10), 11.1.7-h12 (30/10), 11.2.4-h23 (30/10), 11.2.7-h23 (29/10), 11.2.13-h4 (27/10), 11.2.16-h1 (28/10), 10.2.7-h39 (30/10), 10.2.10-h42 (29/10). **Exploitation :** la page de l'avis dit toujours que Palo Alto « is not aware of any malicious exploitation of this issue against our products » ; cela concerne **ses produits**, alors que le catalogue CISA signale maintenant l'exploitation de PHP en général. Ne prends pas l'absence de constat chez l'éditeur pour une absence de risque : **restreins l'accès à l'interface d'administration** et applique le correctif de ta branche dès qu'il est publié. Source : https://security.paloaltonetworks.com/CVE-2026-109618 (mis à jour le 2026-10-27, consulté le 2026-10-27).

### Rien d'autre aujourd'hui
Aucune autre entrée nouvelle du catalogue CISA pour les éditeurs de ta liste. Pile de production du projet : rien de nouveau (issues #48 et #49 ouvertes).

---

## 2026-10-28 (mercredi)

Sources consultées le 2026-10-28 : catalogue CISA KEV (`catalogVersion` 2026.10.27, publié le 2026-10-27 à 19 h UTC), publication de sécurité Node.js du 21 octobre 2026 (page officielle lue), NVD (API). Les avis déjà consignés ne sont pas répétés.

### 1. Node.js : décodeur Brotli (CVE-2026-111497) — **exploitation active constatée, touche la pile de production du projet**
- **Exploitation :** ajoutée au catalogue CISA le **2026-10-27** (échéance 2026-11-10), donc exploitation constatée. L'entrée du catalogue la rattache à Google Brotli (bibliothèque réutilisée par plusieurs produits).
- **Nature (Node.js) :** « A flaw in the Brotli decoder bundled with Node.js allows malformed compressed input to write past the end of an internal decoder buffer. » Un attaquant qui peut fournir des données Brotli qu'une application décompresse avec `node:zlib` peut provoquer un plantage, divulguer la mémoire du processus ou exécuter du code. Gravité **high** selon Node.js ; CVSS 4.0 de **9,2** (critique) dans la base NVD.
- **Versions :** lignes **26.x, 24.x et 22.x** affectées ; corrigées en **22.23.4, 24.22.1 et 26.12.1** (publication du 21 octobre 2026). Les versions en fin de vie sont « always affected ». Côté bibliothèque Brotli autonome (NVD) : 1.0.3 à 1.2.0 affectées ; corrigées en 1.0.10, 1.1.1 ou 1.2.1.
- **Contournement :** la page Node.js n'en indique **aucun**.
- **Ce que tu vérifies chez toi :** (1) la version de Node.js de **chaque** machine qui l'exécute (`node --version`) ; (2) si une application décompresse du Brotli venant de l'extérieur ; (3) tout produit tiers qui embarque sa propre copie de Brotli (mettre à jour la bibliothèque autonome ne corrige pas la copie intégrée à Node.js).
- **Autres corrections de la même publication, gravité high :** CVE-2026-105483 et CVE-2026-106069 (contournements de la vérification du nom d'hôte d'un certificat TLS) et CVE-2026-105482 (`dns.resolve` tronque les noms contenant un caractère NUL).
- **Projet SentinelScope :** version de Node en production non lisible dans le dépôt ; aucun usage direct de `zlib` ou de Brotli ; moteur d'audit sans décompression. Applicabilité non établie. **Issue ouverte : https://github.com/maltid2/plateforme-/issues/51**.
- Sources : https://nodejs.org/en/blog/vulnerability/october-2026-security-releases ; https://nvd.nist.gov/vuln/detail/CVE-2026-111497 (API) ; catalogue CISA (consultés le 2026-10-28).

### Vu, hors de ta liste
Adobe Commerce et Magento, envoi de fichier dangereux (CVE-2026-48356), ajouté au catalogue le 2026-10-27 avec échéance 2026-11-10 ; détails non lus.

### Suivi
Rien de nouveau sur PAN-OS, Fortinet, Cisco, Ivanti ou Citrix dans les sources lues aujourd'hui (catalogue CISA : aucune nouvelle entrée pour ces éditeurs).
