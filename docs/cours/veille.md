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

---

## 2026-10-29 (jeudi)

Sources consultées le 2026-10-29 : catalogue CISA KEV (`catalogVersion` 2026.10.28, publié le 2026-10-28 à 19 h UTC), avis Broadcom VMSA-2026-0006.2 (lu), NVD (API). Les avis déjà consignés ne sont pas répétés.

### 1. Enchaînement PHP puis noyau Linux, exploitation active — CVE-2026-46300 (noyau Linux) avec CVE-2026-109618 et CVE-2026-109619 (PHP, entrée du 27 octobre)
- **Exploitation :** CVE-2026-46300 ajoutée au catalogue CISA le **2026-10-28** (échéance **2026-10-31**, triage forensique demandé). Le catalogue précise qu'elle « peut être enchaînée avec CVE-2026-109618 et CVE-2026-109619 pour implanter des webshells PHP et exécuter des commandes en tant que root ».
- **Score :** 7,8 (High), `AV:L/AC:L/PR:L` (NVD, statut « Undergoing Analysis »). Faille locale : le premier maillon (exécution de code PHP) fournit l'accès local peu privilégié.
- **Versions du noyau (NVD, bornes amont) :** concernées : 3.9 à 5.10.257 inclus ; 5.11 avant 5.15.208 ; 5.16 avant 6.1.174 ; 6.2 avant 6.6.141 ; 6.7 avant 6.12.91 ; 6.13 avant 6.18.33 ; 6.19 avant 7.0.10. Les distributions rétroportent : **le numéro de version amont ne suffit pas**, consulte l'avis de ta distribution (non lu).
- **Contournement :** non lu.
- **Ce que tu vérifies chez toi :** (1) sur tout serveur Linux qui exécute du code exposé (PHP, applications web), la version du noyau **en cours d'exécution** (`uname -r`) et l'avis de ta distribution ; (2) la version de PHP (entrée du 27 octobre) ; (3) des fichiers PHP récents ou inattendus dans les dossiers publiés et des processus fils inattendus d'un processus PHP (la CISA demande un triage forensique). **Fiche du jour : `2026-10-29-enchainement-php-noyau-linux-vers-root.md`.**
- Sources : catalogue CISA ; https://nvd.nist.gov/vuln/detail/CVE-2026-46300 (consultés le 2026-10-29).

### 2. Broadcom VMware ESX : journalisation insuffisante — CVE-2026-41709 — **exploitation active constatée par la CISA**
- **Exploitation :** ajoutée au catalogue le **2026-10-28** (échéance 2026-11-11). L'avis Broadcom lu indique ne pas faire état d'exploitation, mais il date du 29 juillet 2026 (mis à jour le 19 août) : **il précède l'ajout au catalogue**.
- **Nature :** un administrateur malveillant peut effectuer certaines opérations **sans qu'elles soient journalisées** (CWE-778). Il faut un accès administrateur : c'est une faille qui **masque des traces**, pas une porte d'entrée.
- **Score :** 2,7 (Low), `AV:N/AC:L/PR:H`. Le score est bas parce qu'il faut déjà être administrateur ; l'exploitation constatée justifie malgré tout l'attention.
- **Avis :** VMSA-2026-0006.2, « VMware ESX, vCenter, Workstation, and Fusion updates address multiple vulnerabilities », publié le 2026-07-29.
- **Versions corrigées pour CVE-2026-41709 :** ESX 9.1 → ESXi-9.1.0.0-25370933 ; ESX 9.0 → ESXi-9.0.2.0100-25595025 ; ESXi 8.0 U3 → ESXi80U3j-25429389 ; VCF 5.x → 5.2.3 / 5.2.4 ; Telco Cloud Platform ESX 5.0.x et 5.1.x → KB449886 (sans version listée). ESXi 7.0 **n'apparaît pas** pour cette CVE dans le tableau lu.
- **Contournement :** aucun pour les CVE ESX de cet avis.
- **Même avis, autres CVE sur ESX (non exploitées au catalogue au 2026-10-29) :** CVE-2026-47876 (9,3) et CVE-2026-41703 (7,6) ; correctifs en ESXi 9.1 : ESXi-9.1.0.0200-25557999 ; 9.0 : ESXi-9.0.2.0100-25595025 ; 8.0 U3 : ESXi80U3k-25595708 (pour 47876) et ESXi80U3i-25205845 (pour 41703) ; 8.0 U2 : ESXi80U2f-25626445 ; 7.0 : pas de version listée pour 47876, contacter Broadcom si contrat d'assistance étendu. Les failles vCenter CVE-2026-59309 et CVE-2026-59310 (9,8) sont dans le même avis ; CVE-2026-59310 figure déjà au catalogue depuis le 2026-08-18.
- **Ce que tu vérifies chez toi (si tu as ESXi ou vCenter) :** (1) le numéro de build exact (`vmware -vl` ou l'interface), comparé aux versions ci-dessus ; (2) que les journaux de l'hôte sont **envoyés à un serveur distant** (une journalisation locale peut être incomplète d'après cette faille) ; (3) qui a un accès administrateur à l'hôte, et que l'interface d'administration n'est pas joignable depuis Internet.
- Sources : https://support.broadcom.com/web/ecx/support-content-notification/-/external/content/SecurityAdvisories/0/38017 ; https://nvd.nist.gov/vuln/detail/CVE-2026-41709 ; catalogue CISA (consultés le 2026-10-29).

### Suivi : Node.js Brotli (entrée du 28 octobre)
Rien de nouveau lu aujourd'hui. L'issue #51 reste ouverte pour confirmer la version de Node en production.

### Pile de production du projet
Aucune nouvelle trouvaille. Issues #48, #49 et #51 ouvertes ; PR #45, #46 et #50 à vérifier côté dépôt.

---

## 2026-10-30 (vendredi)

Sources consultées le 2026-10-30 : catalogue CISA KEV (`catalogVersion` 2026.10.29, publié le 2026-10-29 à 19 h UTC), avis Cisco (lu), liste des alertes du CERT-FR (aucune alerte après celle du 21 octobre sur PHP, mise à jour le 26 octobre). Les avis déjà consignés ne sont pas répétés.

### 1. Cisco Secure Firewall ASA et Secure FTD : déni de service sur le VPN SSL d'accès distant — CVE-2026-76418 — **exploitation active, équipement exposé sur Internet**
- **Exploitation :** Cisco écrit qu'en octobre 2026 son PSIRT a eu connaissance d'une « active exploitation ». Ajoutée au catalogue CISA le **2026-10-29** (échéance 2026-11-01).
- **Nature :** un attaquant distant **non authentifié** peut faire **redémarrer l'équipement de façon inattendue** (déni de service ; faiblesse CWE-690, « unchecked return value to NULL pointer dereference »). Avis : cisco-sa-asaftd-tunnel-dos-s6mgkb75, première publication le **2026-10-28**, identifiant de bogue CSCwx26625.
- **Score :** CVSS 3.1 de **8,6 (High)**, `AV:N/AC:L/PR:N/UI:N/S:C/C:N/I:N/A:H`.
- **Configuration vulnérable (d'après l'avis) :** VPN SSL d'accès distant activé (`webvpn` avec le VPN SSL activé sur au moins une interface) **et** authentification secondaire configurée dans un groupe de tunnels (`secondary-authentication-server-group`), y compris dans `DefaultWEBVPNGroup`. Le contrôle vaut même si `tunnel-group-list enable` est absent.
- **Versions corrigées (première version corrigée par branche) :** ASA 9.16 et antérieures → **9.16.4.104** ; 9.18 → **9.18.4.96** ; 9.20 → **9.20.4.50** ; 9.22 → **9.22.3.200** ; 9.23 → **9.23.1.48** ; 9.24 → **9.24.1.27** et **9.24.10.1**. FTD 7.0 et antérieures → **7.0.11** ; 7.2 → **7.2.13** ; 7.4 → **7.4.9** ; 7.6 → **7.6.7** ; 7.7 → **7.7.14** ; 10.0 → **10.0.3** ; 10.1 → **10.1.1**. Non concernés : Cloud-delivered Firewall, cdFMC, Secure Access et Secure FMC Software.
- **Contournement :** aucun qui corrige entièrement la faille. Atténuations officielles : (cas 1) si `DefaultWEBVPNGroup` n'utilise pas l'authentification secondaire, désactiver la liste des groupes de tunnels (`no tunnel-group-list enable`, les utilisateurs doivent alors connaître le nom exact du profil) ; (cas 2) si `DefaultWEBVPNGroup` l'utilise, retirer l'authentification secondaire (`no secondary-authentication-server-group`), ce qui **abaisse le niveau de sécurité du VPN**. Cisco recommande de **mettre à niveau**.
- **Indicateurs de compromission :** l'avis n'en donne aucun (ni empreintes, ni adresses, ni signature de journaux).
- **Ce que tu vérifies chez toi (si tu as ASA ou FTD) :** (1) la version exacte et la comparer à ta branche ci-dessus ; (2) si le VPN SSL d'accès distant est activé et **joignable depuis Internet**, et si une authentification secondaire est configurée dans un groupe de tunnels ; (3) des **redémarrages inattendus** de l'équipement dans l'historique et les journaux depuis octobre.
- Sources : https://sec.cloudapps.cisco.com/security/center/content/CiscoSecurityAdvisory/cisco-sa-asaftd-tunnel-dos-s6mgkb75 ; catalogue CISA (consultés le 2026-10-30).

### Vu, hors de ta liste d'éditeurs
**GitLab Community et Enterprise Edition** (CVE-2026-97229) : un utilisateur non authentifié pourrait exécuter du code sur le serveur par une expression régulière forgée dans une configuration CI/CD (dépassement d'entier). Ajoutée au catalogue CISA le 2026-10-29, échéance 2026-11-01, triage forensique demandé. Les notes du catalogue renvoient à la version de correctif GitLab 19.4.2 et à une annonce Ruby sur des « regexp fixes » du 23 octobre ; ces pages ne sont **pas lues**. Si tu as GitLab, consulte l'avis de l'éditeur.

### Projet : trois PR d'agents fusionnées le 28 octobre
Les PR #45 (Next 16), #46 et #50 sont dans `main`. Vérification du verrou : `next` 16.4.2, `react` 19.3.1, `sharp` 0.35.5 ; l'API d'avis npm ne renvoie plus d'avis pour `next` ni `react`. Il reste 2 avis (`source-map-js` high, `postcss-selector-parser` moderate), applicabilité non établie. J'ai commenté les issues #49 (suivi) et #51 (version de Node toujours inconnue ; minimum Next 16 : Node 20.9). Détail : fiche `2026-10-30-relire-une-pr-de-performance.md`.

---

## 2026-10-31 (samedi)

Sources consultées le 2026-10-31 : catalogue CISA KEV (`catalogVersion` 2026.10.30), API NVD (CVE-2026-104935, CVE-2026-111357, CVE-2026-118527, CVE-2026-96951), page « Windows Server release information » de Microsoft Learn (mise à jour 2026-10-28). Deux ajouts au catalogue depuis hier, tous deux Ivanti. Les avis déjà consignés ne sont pas répétés.

### 1. Ivanti Connect Secure : la faille du 13 octobre devient une **chaîne de trois CVE** — **exploitation active, équipement exposé sur Internet**
- **Ce qui est nouveau :** le 2026-10-30, la CISA a ajouté **CVE-2026-118527** et **CVE-2026-111357**. Les deux notes du catalogue écrivent que chacune « peut être enchaînée » avec **CVE-2026-104935** (déjà consignée le 23 octobre) et avec l'autre.
- **Les trois maillons (d'après le catalogue et NVD) :**
  1. **CVE-2026-104935** : contournement d'authentification, distant, non authentifié, exécution de commandes. CVSS 3.1 de 8,6 (NVD). Voir l'entrée du 2026-10-23.
  2. **CVE-2026-118527** : « génération de nombres ou d'identifiants prévisibles » (CWE-340) ; un attaquant distant **authentifié** peut déposer des fichiers au contenu qu'il contrôle **à un emplacement connu** du disque. Échéance CISA : **2026-11-13**. NVD ne renvoie **aucun enregistrement** pour cette CVE au 2026-10-31 : pas de score ni de versions lues.
  3. **CVE-2026-111357** : fonction critique sans authentification (CWE-306, CWE-862, CWE-345) ; un attaquant **local authentifié** peut passer **root**. NVD : « Ivanti Connect Secure 22.8R2.4 », vecteur `AV:L/AC:H/PR:L`, **7,0 (High)**, description « exploited in the wild in October 2026 ». Échéance CISA : **2026-11-02**, triage forensique demandé par le catalogue.
- **Lecture :** pris isolément, les deux nouveaux maillons ont besoin d'un accès préalable (authentifié, local). C'est le premier maillon qui les rend atteignables depuis Internet. C'est la même logique que la fiche du 2026-10-29 (PHP puis noyau) : **le score d'une CVE seule sous-estime la chaîne**.
- **Versions corrigées et contournement officiel :** **non lus dans ce journal** (l'avis Ivanti n'a pas été consigné ici). Les plages NVD pour CVE-2026-104935 sont dans l'entrée du 23 octobre ; ne pas en déduire la liste des versions sûres. À lire sur l'avis Ivanti référencé par le catalogue : https://hub.ivanti.com/s/article/Security-Advisory-Ivanti-Connect-Secure-CVE-2026-104935 .
- **Indicateurs de compromission :** aucun consigné ici.
- **Ce que tu vérifies chez toi (si tu as Connect Secure) :** (1) la version exacte, comparée à l'avis Ivanti (pas à ce journal) ; (2) si le portail est joignable depuis Internet ; (3) l'état du boîtier : un correctif appliqué **après** une compromission ne la supprime pas. Suivre la procédure de l'éditeur et du CERT-FR (vérification d'intégrité, journaux, rotation des secrets) plutôt que « mettre à jour et passer à autre chose ».
- Sources : https://www.cisa.gov/known-exploited-vulnerabilities-catalog (2026-10-31) ; https://nvd.nist.gov/vuln/detail/CVE-2026-111357 ; https://nvd.nist.gov/vuln/detail/CVE-2026-118527 (consultés le 2026-10-31).

### 2. Rien d'autre dans ta liste d'éditeurs
Le catalogue ne contient aucune autre entrée nouvelle hier. Pas de nouvelle lecture sur PAN-OS, Fortinet, Check Point, Citrix, Veeam, Commvault ni sur les autres éditeurs de la liste aujourd'hui : **absence de trouvaille ≠ absence de faille**, je n'ai pas relu chaque PSIRT.

### Suivis
- Cisco ASA/FTD CVE-2026-76418 (entrée du 30 octobre) : échéance CISA 2026-11-01, demain. Rien de nouveau lu.
- Microsoft CVE-2026-96951 : sert d'exemple à la fiche du jour (seuils NVD comparés au tableau de versions de Microsoft).

### Pile de production du projet
La PR #52 (« perf(ui) : site fluide… ») est fusionnée dans `main` ; **non lue** dans ce journal. Issues #48, #49 et #51 toujours ouvertes. Aucune nouvelle trouvaille ; pas de nouvelle issue.

---

## 2026-11-01 (dimanche)

Sources consultées le 2026-11-01 : catalogue CISA KEV (`catalogVersion` **2026.10.30**, 1 766 entrées, **identique à celui d'hier** : aucune nouvelle entrée). Liste des PR et issues du dépôt. Je n'ai relu aucun PSIRT éditeur aujourd'hui : **absence de nouvelle entrée au catalogue ≠ absence de nouvel avis**.

### Suivis (rien de nouveau, rien de répété)
- **Ivanti Connect Secure** (chaîne CVE-2026-104935 / 118527 / 111357) : échéance CISA de CVE-2026-111357 = **demain, 2026-11-02**. Versions corrigées toujours à lire sur l'avis Ivanti (non consignées ici).
- **Cisco ASA/FTD CVE-2026-76418** : échéance CISA = aujourd'hui, 2026-11-01.

### Pile de production du projet
- Nouvelle PR ouverte : **#53 « perf(ui) : défilement et pop-up de résultat fluides »**, mise à jour le 2026-10-31. **Non lue** ; je n'en dis rien. Candidate à la fiche de vendredi prochain.
- Issues **#48, #49, #51** toujours ouvertes, sans nouvelle réponse. Pas de nouvelle issue.

---

## 2026-11-02 (lundi)

Sources consultées le 2026-11-02 : catalogue CISA KEV (`catalogVersion` **2026.10.30**, 1 766 entrées : **inchangé depuis le 2026-10-31**, aucune nouvelle entrée). Je n'ai relu aucun PSIRT éditeur aujourd'hui : **le catalogue inchangé ne dit rien des avis non exploités**. `main` : seulement des mises à jour automatiques de signatures d'audit depuis hier ; aucune lecture de code.

### Échéances CISA du jour (rappel, rien de nouveau)
- **Ivanti Connect Secure CVE-2026-111357** : échéance CISA **aujourd'hui, 2026-11-02**. Si tu as ce produit : version exacte lue sur l'avis Ivanti, exposition du portail, état du boîtier (voir l'entrée du 2026-10-31).
- Cisco ASA/FTD CVE-2026-76418 : échéance passée hier (2026-11-01).

### Pile de production du projet
Rien de nouveau lu. La PR #53 (« perf(ui) : défilement et pop-up de résultat fluides ») reste non lue. Issues #48, #49, #51 : aucune nouvelle réponse connue de ma part ; pas de nouvelle issue.

---

## 2026-11-03 (mardi)

Sources consultées le 2026-11-03 : catalogue CISA KEV (`catalogVersion` **2026.10.30**, 1 766 entrées : toujours **inchangé** depuis le 2026-10-31, aucune nouvelle entrée). Je n'ai relu aucun PSIRT éditeur aujourd'hui : un catalogue inchangé ne dit rien des avis non exploités. `main` : seulement des mises à jour automatiques de signatures d'audit.

### Rien de nouveau à signaler
Aucun nouvel avis consigné aujourd'hui. Suivis déjà consignés, sans changement lu : Ivanti Connect Secure (chaîne de trois CVE, voir 2026-10-31 ; échéance CISA de CVE-2026-111357 passée hier), Cisco ASA/FTD CVE-2026-76418 (échéance passée le 2026-11-01). Si tu as l'un de ces produits et que tu n'as pas encore relevé la version exacte, c'est toujours la vérification utile.

### Calendrier (information, pas un avis)
Le prochain « Patch Tuesday » Microsoft tombe le **2026-11-10** (deuxième mardi du mois, règle décrite dans la fiche du 2026-10-31) : calcul de ma part, date non lue sur une page Microsoft.

### Pile de production du projet
Rien de nouveau lu. PR #53 toujours non lue ; issues #48, #49, #51 sans nouvelle réponse connue ; pas de nouvelle issue.

---

## 2026-11-04 (mercredi)

Sources consultées le 2026-11-04 : catalogue CISA KEV (`catalogVersion` **2026.11.03**, 1 767 entrées : **une** nouvelle entrée depuis hier), API NVD (CVE-2026-119977), annonce de sécurité WordPress 7.1.4. Aucun PSIRT d'éditeur de ta liste relu aujourd'hui : **le catalogue ne dit rien des avis non exploités**.

### 1. WordPress Core : exécution de code pendant une mise à jour — CVE-2026-119977 — **exploitation active constatée par la CISA** (hors de ta liste d'éditeurs)
- **Pourquoi je la mets en tête malgré tout :** ton lab (`docker-compose.yml`) fait tourner WordPress. Ce n'est pas la pile de SentinelScope ; si tu as un WordPress ailleurs, c'est l'avis qui compte.
- **Exploitation :** ajoutée au catalogue le **2026-11-03**, échéance CISA **2026-11-06**.
- **Nature :** condition de concurrence « time-of-check time-of-use » (CWE-367) ; des chemins de préparation prévisibles et accessibles depuis le web, utilisés lors des mises à jour complètes du noyau, permettent à un attaquant **non authentifié** d'exécuter du code sur le serveur **pendant la fenêtre de mise à jour** (description NVD).
- **Score :** CVSS 3.1 de **8,1**, vecteur `AV:N/AC:H/PR:N/UI:N` (complexité d'attaque élevée : la fenêtre est courte).
- **Versions affectées (NVD) :** WordPress « 4.7 à 7.1.3 ».
- **Version corrigée :** l'annonce officielle de **WordPress 7.1.4** (publiée le **2026-10-28**, version de sécurité) liste « une faiblesse du processus de mise à jour de WordPress pouvant mener à une exécution de code à distance pendant la fenêtre de mise à jour ». Elle ne cite pas le numéro CVE ; le rapprochement avec CVE-2026-119977 vient de la note du catalogue CISA, qui renvoie à cette annonce. Les correctifs sont aussi **rétroportés** vers les branches encore éligibles, « jusqu'à 4.7 », mais l'annonce précise que **les rétroportages sont en cours et sortent au fur et à mesure** : ne pas supposer qu'une branche ancienne est déjà corrigée.
- **Contournement :** aucun officiel lu.
- **Indicateurs de compromission :** aucun lu (la note du catalogue renvoie à un article Wordfence, **non lu**).
- **Ce que tu vérifies chez toi (si tu as un WordPress) :** (1) la version exacte (tableau de bord, ou fichier de version du noyau) ; (2) si le site est joignable depuis Internet ; (3) si les mises à jour automatiques sont actives (le risque est pendant la mise à jour) et l'état des fichiers de `wp-admin` après la dernière mise à jour.
- Sources : https://wordpress.org/news/2026/10/wordpress-7-1-4 ; https://nvd.nist.gov/vuln/detail/CVE-2026-119977 ; catalogue CISA (consultés le 2026-11-04).

### Suivis (rien de nouveau)
Ivanti Connect Secure (chaîne CVE-2026-104935 / 118527 / 111357, voir 2026-10-31) et Cisco ASA/FTD CVE-2026-76418 : aucune lecture nouvelle. Le **Patch Tuesday du 2026-11-10** approche (calcul de ma part).

### Pile de production du projet
`main` contient désormais la PR **#53** (« perf(ui) : défilement et pop-up de résultat fluides… ») fusionnée ; **non lue**. Issues #48, #49, #51 sans nouvelle réponse connue. Pas de nouvelle issue : WordPress n'est pas dans la pile de SentinelScope.

---

## 2026-11-05 (jeudi)

Sources consultées le 2026-11-05 : catalogue CISA KEV (`catalogVersion` **2026.11.04**, 1 768 entrées : **une** nouvelle entrée depuis hier). Aucun PSIRT d'éditeur de ta liste relu aujourd'hui : le catalogue ne dit rien des avis non exploités. `main` : seulement des mises à jour automatiques de signatures d'audit.

### 1. Apple (iOS, iPadOS, macOS, Safari, tvOS, watchOS) — CVE-2024-27834 — **exploitation active constatée par la CISA** (hors de ta liste d'éditeurs)
- Ajoutée au catalogue le **2026-11-04**, échéance CISA **2026-11-18**.
- Selon la description du catalogue : défaut d'authentification (contournement de l'authentification de pointeurs) pour un attaquant qui dispose déjà d'une capacité de lecture et d'écriture arbitraires ; le catalogue cite les versions « 10.5 » pour ces produits.
- **Je n'ai lu ni l'avis Apple ni la fiche NVD** : pas de score, pas de liste de versions corrigées par produit consignés. Si tu as des iPhone, iPad ou Mac à gérer, la source à lire est l'avis de sécurité d'Apple ; la vérification utile est la version du système sur ces appareils.

### Suivi : WordPress CVE-2026-119977 (entrée du 2026-11-04)
Rien de nouveau dans le catalogue. J'ai lu le **diff réel** entre WordPress 7.1.3 et 7.1.4 : trois changements (nom du répertoire de travail rendu aléatoire, `index.php` dans `wp-content/upgrade/`, `wp-config.php` exclu de la copie). Détail et déduction clairement séparés dans la fiche `2026-11-05-wordpress-fenetre-de-mise-a-jour-toctou.md`. Échéance CISA : **demain, 2026-11-06**. Rappel : les correctifs pour les branches anciennes sont, d'après l'annonce, **en cours de publication**.

### Autres suivis
Ivanti Connect Secure (chaîne de trois CVE, voir 2026-10-31) et Cisco ASA/FTD CVE-2026-76418 : aucune lecture nouvelle. Patch Tuesday Microsoft : 2026-11-10 (calcul de ma part).

### Pile de production du projet
Rien de nouveau lu. PR #53 fusionnée mais non lue. Issues #48, #49, #51 sans nouvelle réponse connue de ma part. Pas de nouvelle issue.

---

## 2026-11-06 (vendredi)

Sources consultées le 2026-11-06 : catalogue CISA KEV (`catalogVersion` **2026.11.04**, 1 768 entrées : **inchangé** depuis hier, aucune nouvelle entrée). Aucun PSIRT d'éditeur de ta liste relu aujourd'hui : un catalogue inchangé ne dit rien des avis non exploités. `main` : seulement des mises à jour automatiques de signatures d'audit depuis la PR #53.

### Échéances CISA, rappel
- **WordPress Core CVE-2026-119977** : échéance **aujourd'hui, 2026-11-06**. Version corrigée 7.1.4 ; correctifs des branches anciennes en cours de publication d'après l'annonce du 2026-10-28 (voir 2026-11-04 et 2026-11-05).
- Apple CVE-2024-27834 : échéance 2026-11-18 (voir 2026-11-05).
- Ivanti Connect Secure et Cisco ASA/FTD : rien de nouveau lu ; si tu as ces produits et n'as pas relevé la version exacte, c'est toujours la vérification utile. **Patch Tuesday Microsoft : 2026-11-10** (calcul de ma part).

### Pile de production du projet
La PR **#53** (« perf(ui) : défilement et pop-up de résultat fluides ») est lue en entier : voir la fiche du jour. Aucune faille de sécurité dans ce diff ; points à vérifier à la main (décalage de mise en page à l'ouverture d'un pop-up, focus du pop-up), tous du domaine de l'interface. Issues #48, #49, #51 sans nouvelle réponse connue de ma part. Pas de nouvelle issue.

---

## 2026-11-07 (samedi)

Sources consultées le 2026-11-07 : catalogue CISA KEV (`catalogVersion` **2026.11.06**, 1 769 entrées : **une** nouvelle entrée depuis le 2026-11-05), API NVD (CVE-2026-19868), article de BleepingComputer du 2026-11-06 (source **secondaire**). La page de l'avis SonicWall (SNWLID-2026-0014) **n'a pas pu être lue** : elle se charge par script et la lecture ne renvoie que le titre « Security Advisory ». Aucun autre PSIRT d'éditeur de ta liste relu aujourd'hui : le catalogue ne dit rien des avis non exploités.

### 1. SonicWall SonicOS, VPN SSL (SSLVPN) : contournement de l'authentification SAML — CVE-2026-19868 — **exploitation active constatée par la CISA, équipement exposé sur Internet**
- **Exploitation :** ajoutée au catalogue le **2026-11-06**, échéance CISA **2026-11-20**. D'après BleepingComputer, l'avis de SonicWall dit que son PSIRT « a enquêté sur un signalement indiquant une exploitation potentielle » et presse les clients de mettre à jour ; le détail de l'exploitation n'est pas publié (rapporté par la presse, **avis éditeur non lu**).
- **Nature :** un utilisateur qui dispose d'identifiants valides pour **une autre méthode d'authentification** peut contourner les contrôles SAML du service SSLVPN, **y compris l'authentification multifacteur imposée par SAML** (description NVD). CWE-308 (« single-factor authentication »). La presse précise que seuls les SSLVPN **configurés avec SAML** sont concernés.
- **Score :** NVD affiche **7,5** avec le vecteur `AV:N/AC:H/PR:N/UI:N/S:C/C:H/I:L/A:N` (j'ai recalculé : ce vecteur donne bien 7,5). **BleepingComputer écrit 7,1.** Écart non résolu faute d'avoir pu lire l'avis éditeur.
- **Versions (d'après BleepingComputer uniquement, à confirmer sur l'avis SonicWall) :** affectées : SonicOS **Gen7 7.3.3-7015 et antérieures**, **Gen8 8.2.2-8015 et antérieures**. Corrigées : **7.3.4-7013** (Gen7) et **8.2.3-8015** (Gen8). Aucun contournement (« no workarounds »), toujours d'après l'article.
- **Même avis :** l'article cite six autres failles corrigées (deux failles de l'interface de gestion notées 8,8 permettant à des attaquants non authentifiés d'effectuer des opérations non autorisées dans certaines conditions ; des dépassements de tampon avant authentification dans SSL-VPN et TACACS+ pouvant causer un déni de service ; un hachage de mot de passe faible sur appliance virtuelle). **Numéros de CVE non lus.**
- **Ce que tu vérifies chez toi (si tu as un pare-feu SonicWall) :** (1) la **version exacte de SonicOS** (Gen7 ou Gen8) comparée à l'avis SonicWall, pas à ce journal ; (2) si le **VPN SSL est activé**, **joignable depuis Internet** et **configuré avec SAML** ; quelles **autres méthodes d'authentification** sont aussi activées sur le même service (le contournement suppose des identifiants valides pour l'une d'elles) ; (3) que l'**interface de gestion** n'est pas joignable depuis Internet (deux autres failles de cet avis la concernent, d'après la presse) ; et les **journaux de connexion VPN** depuis le 2026-11-06 (sessions authentifiées par une méthode autre que SAML ; ce dernier point est ma déduction de la description, pas une consigne de l'éditeur).
- Sources : https://nvd.nist.gov/vuln/detail/CVE-2026-19868 ; https://psirt.global.sonicwall.com/vuln-detail/SNWLID-2026-0014 (non lisible) ; catalogue CISA ; https://www.bleepingcomputer.com/news/security/sonicwall-warns-of-new-ssl-vpn-mfa-bypass-flaw-exploited-in-attacks/ (secondaire) (consultés le 2026-11-07).

### Échéances CISA, rappel
- WordPress Core CVE-2026-119977 : échéance passée hier (2026-11-06).
- Apple CVE-2024-27834 : 2026-11-18. Ivanti Connect Secure, Cisco ASA/FTD : rien de nouveau lu. **Patch Tuesday Microsoft : 2026-11-10** (calcul de ma part).

### Pile de production du projet
`main` contient une fusion récente (« refonte visuelle SentinelScope + compétences unslop et ui-ux-pro-max », `24810c1`) et une PR de refonte de sections ; **non lues**, aucune lecture de sécurité faite. Issues #48, #49, #51 sans nouvelle réponse connue. Pas de nouvelle issue.

---

## 2026-11-08 (dimanche)

Sources consultées le 2026-11-08 : catalogue CISA KEV (`catalogVersion` **2026.11.06**, 1 769 entrées : **inchangé** depuis hier, aucune nouvelle entrée). Aucun PSIRT d'éditeur de ta liste relu aujourd'hui : un catalogue inchangé ne dit rien des avis non exploités.

### Suivis (rien de nouveau lu, rien de répété)
- **SonicWall SonicOS SSLVPN CVE-2026-19868** (entrée du 2026-11-07) : échéance CISA 2026-11-20. L'avis de l'éditeur reste à lire directement ; versions et score non confirmés par la source éditeur.
- **Patch Tuesday Microsoft : demain+1, 2026-11-10** (calcul de ma part, règle du deuxième mardi).
- Apple CVE-2024-27834 : échéance 2026-11-18. Ivanti Connect Secure, Cisco ASA/FTD, WordPress : aucune lecture nouvelle.

### Pile de production du projet
PR #47 (la mienne) ouverte ; PR #50, #52, #53 fusionnées ; fusion « refonte visuelle SentinelScope » dans `main` : **non lue**. Issues #48, #49, #51 ouvertes, sans nouvelle réponse. Aucun commentaire de ta part sur la PR #47 (calibrages). Pas de nouvelle issue.

---

## 2026-11-09 (lundi)

Sources consultées le 2026-11-09 : catalogue CISA KEV (`catalogVersion` **2026.11.06**, 1 769 entrées : **inchangé** depuis le 2026-11-07, aucune nouvelle entrée). Aucun PSIRT d'éditeur de ta liste relu aujourd'hui : un catalogue inchangé ne dit rien des avis non exploités. `main` : seulement des mises à jour automatiques de signatures d'audit.

### Rien de nouveau à signaler (échéances et suivis, sans répétition)
- **Demain, 2026-11-10 : Patch Tuesday Microsoft** (deuxième mardi du mois, calcul de ma part). Je lirai la source Microsoft demain ; ne tire aucune conclusion de cette ligne.
- SonicWall SonicOS SSLVPN CVE-2026-19868 : échéance CISA 2026-11-20 ; l'avis éditeur reste à lire directement. Apple CVE-2024-27834 : 2026-11-18. Ivanti Connect Secure, Cisco ASA/FTD, WordPress : aucune lecture nouvelle.

### Pile de production du projet
Rien de nouveau lu. Fusion « refonte visuelle SentinelScope » toujours non lue. Issues #48, #49, #51 sans nouvelle réponse connue. Pas de nouvelle issue.

---

## 2026-11-10 (mardi)

Sources consultées le 2026-11-10 : catalogue CISA KEV (`catalogVersion` **2026.11.09**, 1 773 entrées : **quatre** nouvelles entrées depuis le 2026-11-09), API NVD (CVE-2026-123158), notes de version OpenSSH 10.6p2, avis Alpine Linux du 2026-11-05, API MSRC (document « 2026-Nov »). Aucun autre PSIRT d'éditeur de ta liste relu aujourd'hui : un catalogue qui bouge peu ne dit rien des avis non exploités.

### 1. OpenSSH (sshd) sur Linux avec musl libc et sans PAM : contournement de l'authentification par mot de passe — CVE-2026-123158 — **exploitation active constatée par la CISA, service exposé sur Internet si sshd l'est**
- **Exploitation :** ajoutée au catalogue le **2026-11-09**, échéance CISA **2026-11-12** (dans deux jours). Les références NVD citent une page de suivi d'événements GreyNoise : **non lue**.
- **Périmètre exact (à lire avant de s'inquiéter) :** NVD : « sshd in OpenSSH before **10.6p2** on Linux, when **musl libc** is used **without PAM**, lacks a workaround for a password authentication bypass … any password between 256 and 1024 characters succeeds » pour certaines configurations de comptes ; exemple cité : Alpine Linux. Les notes de version OpenSSH 10.6p2 (2026-11-05) parlent d'une « critical security workaround » pour les **systèmes Linux qui utilisent musl libc avec PAM désactivé**, et précisent que la cause racine est jugée **hors de sshd** mais exploitable via sshd. **Ni NVD ni les notes ne désignent les distributions à glibc ; je n'en déduis rien pour elles.**
- **Nature (avis Alpine, 2026-11-05) :** un attaquant qui peut joindre le port SSH peut s'authentifier **sans connaître de mot de passe**, en une connexion. Conditions listées par Alpine : sshd sans PAM (paquet `openssh-server`, ou `openssh-server-pam` avec `UsePAM no`) ; `PasswordAuthentication yes` (valeur par défaut) ; un compte dont le champ de mot de passe vaut `*` (compte sans mot de passe, normal pour des comptes à clé seule, `root` dans les images de base depuis environ Alpine 3.16) ; **et** au moins un autre compte local avec un hachage `$5$` ou `$6$`. Le mot de passe envoyé doit être très long (Alpine : 257 à 1024 octets ; NVD : 256 à 1024 caractères : léger écart non résolu).
- **Score :** CVSS 3.1 de **8,1** (NVD, source `cve@mitre.org`), `AV:N/AC:H/PR:N/UI:N`.
- **Versions corrigées :** OpenSSH portable **10.6p2**. Pour Alpine, paquets corrigés : edge 10.6_p2-r0 ; 3.24 : 10.3_p1-r2 ; 3.23 : 10.2_p1-r1 ; 3.22 : 10.0_p1-r11 ; 3.21 : 9.9_p2-r1 ; 3.20 : 9.7_p1-r6 ; 3.19 : 9.6_p1-r3 ; 3.18 : 9.3_p2-r4 ; 3.17 : 9.1_p1-r7 ; 3.16 : 9.0_p1-r6 (avis Alpine). **Redémarrer sshd après la mise à jour** : le paquet seul ne remplace pas le démon en cours.
- **Contournement officiel (avis Alpine) :** `PasswordAuthentication no` puis redémarrage de sshd ; mettre à jour **ou** désactiver l'authentification par mot de passe ferme le trou.
- **Non concernés (avis Alpine) :** conteneurs sans sshd ; `PasswordAuthentication no` ; `openssh-server-pam` avec `UsePAM yes` ; comptes verrouillés (`!`) ; systèmes sans compte à hachage `$`.
- **Ce que tu vérifies chez toi (si tu exploites sshd) :** (1) **sur quel système tourne sshd** : Alpine, autre distribution musl, image de conteneur ou boîtier embarqué ? C'est cela qui décide si tu es concerné ; (2) la valeur effective de `PasswordAuthentication` (lecture seule, par exemple `sshd -T`) et si sshd est joignable depuis Internet ; (3) la version d'OpenSSH et les comptes à champ `*` à côté d'au moins un compte à mot de passe ; puis, dans les journaux, des connexions par **mot de passe** réussies pour des comptes qui n'en ont pas (ce dernier point est ma déduction, pas une consigne de l'éditeur).
- Sources : https://nvd.nist.gov/vuln/detail/CVE-2026-123158 ; https://www.openssh.com/releasenotes.html (10.6p2) ; https://alpinelinux.org/posts/2026-11-05-openssh-password-authentication-bypass/ ; catalogue CISA (consultés le 2026-11-10).

### 2. Microsoft : le Patch Tuesday d'aujourd'hui n'est **pas encore lisible ce matin**
Le document « 2026-Nov » de l'API MSRC porte, à cette heure, le titre « **November 2026 Early Security Updates** » (publication initiale 2026-11-04, 93 entrées, dont des composants tiers comme Git for Windows, Elasticsearch, rsync ; aucune marquée « Exploited:Yes » dans ce document). Le jeu mensuel complet n'est pas encore dans ce document : Microsoft publie d'ordinaire dans la journée (heure exacte non vérifiée par moi). **Je n'ai donc rien à dire aujourd'hui des correctifs Windows de novembre.** À relire demain.

### Vu, hors de ta liste d'éditeurs (catalogue CISA du 2026-11-09, échéance 2026-11-12)
GPUStack (authentification, accès administrateur), SignalWire FreeSwitch (injection de code), IBM Aspera Faspex (autorisation). **Non lus au-delà de la description du catalogue** : si tu as l'un de ces produits, lis l'avis de l'éditeur.

### Suivis
SonicWall SSLVPN CVE-2026-19868 (échéance 2026-11-20), Apple CVE-2024-27834 (2026-11-18), Ivanti Connect Secure, Cisco ASA/FTD, WordPress : aucune lecture nouvelle.

### Pile de production du projet
Rien de nouveau lu. Issues #48, #49, #51 sans nouvelle réponse connue. Pas de nouvelle issue : OpenSSH/musl ne concerne pas la pile Next.js du projet d'après `docker-compose.yml` (pas de sshd), mais je ne connais pas l'image de production.

---

## 2026-11-11 (mercredi)

Sources consultées le 2026-11-11 : catalogue CISA KEV (`catalogVersion` **2026.11.10**, 1 779 entrées : **six** nouvelles entrées depuis le 2026-11-10), API MSRC (document « November 2026 Security Updates », publié le **2026-11-10**, 1 342 entrées dont des composants tiers comme Chromium), API NVD (CVE-2026-20320, CVE-2026-111560, CVE-2026-116606). Les avis détaillés des éditeurs eux-mêmes (pages Cisco, Barracuda) n'ont **pas** été lus : la description vient de NVD et du catalogue.

### 1. Microsoft : Patch Tuesday de novembre 2026 — **une exploitation active constatée**
- **Exploité :** **CVE-2026-124194, Microsoft Outlook, usurpation** (*spoofing*), CVSS 6,5 ; MSRC : « Exploited:Yes », « Exploitation Detected » ; ajoutée au catalogue CISA le **2026-11-10**, échéance **2026-11-24**. Selon la FAQ MSRC : un attaquant non authentifié peut envoyer un **fichier de message** forgé et convaincre un utilisateur de l'ouvrir ; Outlook peut alors se connecter à **un emplacement réseau contrôlé par l'attaquant** sans afficher l'avertissement habituel ; le **volet de lecture n'est pas un vecteur**. Produits listés : Microsoft 365 Apps, Office LTSC 2021 (liste complète non relevée). **KB et versions de correctif pour Outlook : non extraits.**
- **Non exploités au moment de la publication, mais classés « Critical » et proches de ton domaine** (MSRC) :
  - **CVE-2026-119958, Windows LDAP, exécution de code à distance, 9,8**, attaquant **non authentifié**, écriture hors limites, « Exploitation Less Likely ».
  - **CVE-2026-118146, Active Directory Domain Services, exécution de code, 8,8**, attaquant authentifié à faible privilège, « Exploitation **More** Likely ».
  - **CVE-2026-118148, Active Directory Domain Services, élévation de privilège, 7,5**, jusqu'à SYSTEM, nécessite de gagner une condition de concurrence (`AC:H`), « Exploitation **More** Likely ».
  - **CVE-2026-118207, Microsoft Exchange Server, exécution de code, 8,8**, attaquant authentifié, « Exploitation **More** Likely ».
  - Autres « Critical » du même jeu, **non détaillés** : Message Queuing (plusieurs), SMB Server (srvnet.sys, 7,5), TCP/IP (7,5), Print Spooler (7,5), Schannel (8,1), CredSSP (8,1), RPC Runtime (8,1), Windows Search (9,8), IIS (8,1), Entra Device Registration (10,0, élévation de privilège ; produit en ligne).
- **Comptes :** sur les 1 342 entrées, MSRC en classe **68 « Critical »**, 1 117 « Important », 110 « Moderate », 47 « Low ». **Une seule** est marquée exploitée, aucune « publiquement divulguée ».
- **Windows Server : mises à jour qui corrigent CVE-2026-119958 (colonne « fixed build » de MSRC) :** Server 2016 → **10.0.14393.9688** (KB5131291) ; Server 2019 → **10.0.17763.9487** (KB5131085) ; Server 2022 → **10.0.20348.5870** (KB5131090) ; Server 2025 → **10.0.26100.33730** (KB5131077). Pour CVE-2026-118146 et CVE-2026-118148, Server 2019 : même build 9487, même KB5131085.
- **Ce que tu vérifies chez toi :** (1) le **build (révision) des contrôleurs de domaine et serveurs** comparé à ceux-ci (méthode : fiche du 2026-10-31) ; priorité aux **contrôleurs de domaine** (LDAP et AD DS) ; (2) Exchange si tu en as un : version et mise à jour ; (3) pour Outlook : la version de Microsoft 365 Apps / Office déployée, et la politique d'ouverture de fichiers de message reçus.
- Sources : https://api.msrc.microsoft.com/cvrf/v3.0/cvrf/2026-Nov ; https://nvd.nist.gov/ (pour CISA) ; catalogue CISA (consultés le 2026-11-11). Le guide MSRC (page web) n'a pas été lu.

### 2. Cisco BroadWorks : XXE sans authentification — CVE-2026-20320 — **exploitation active constatée par la CISA**
- Ajoutée au catalogue le **2026-11-10**, échéance **2026-11-24**. NVD : faille de l'analyseur XML de l'interface OCI de BroadWorks ; un attaquant distant **non authentifié** peut lire des informations de configuration sensibles ; CVSS 3.1 de **7,5**, `AV:N/AC:L/PR:N/UI:N`. Publiée dans NVD le 2026-08-19.
- **Versions affectées et corrigées : non lues** (l'avis Cisco `cisco-sa-bworks-xxe-uwUd7CEt` n'a pas été lu ; NVD liste plusieurs composants BroadWorks sans bornes lisibles pour toi). Si tu as **Cisco BroadWorks** (plateforme de téléphonie d'opérateur, rare en parc d'entreprise), lis l'avis Cisco.
- Une des références NVD est un article d'un tiers sur une « campagne d'intrusion » : **non lu**, je n'en tire rien.

### 3. Hors de ta liste d'éditeurs mais avec exposition probable : Barracuda — **exploitation active constatée par la CISA, échéance 2026-11-13**
- **CVE-2026-116606 (Email Security Gateway)** : contournement d'authentification ; un attaquant distant **non authentifié** peut invoquer une fonction d'import de configuration et restaurer une archive de sauvegarde forgée, modifiant la **configuration globale** ; NVD : « versions earlier than **9.4.0.030** » ; CVSS 4.0 de **9,3**.
- **CVE-2026-111560 (plusieurs produits Barracuda : ESG, Load Balancer, ADC, Message Archiver, WAF Control Center, WAF, Web Security Gateway)** : injection de commandes via le champ de fuseau horaire par un **administrateur authentifié**, exécution avec les droits root ; CVSS 4.0 de **8,6**.
- Ajoutées au catalogue le 2026-11-10. **Avis Barracuda non lu**, ainsi que les rapports Mandiant cités par NVD : correctifs pour les autres produits non consignés. Si tu as un produit Barracuda, lis l'avis de l'éditeur aujourd'hui (échéance CISA dans deux jours).

### Vu, hors de ta liste (catalogue du 2026-11-10)
Chromium (CVE-2026-125350, use-after-free, exécution de code dans le bac à sable ; échéance 2026-11-24) et Openwave Webtop Media Transcoder (CVE-2026-111793) : **descriptions du catalogue seulement**.

### Suivis
OpenSSH musl (CVE-2026-123158) : **échéance CISA demain, 2026-11-12** (voir 2026-11-10). SonicWall CVE-2026-19868 (2026-11-20), Apple CVE-2024-27834 (2026-11-18), Ivanti, Cisco ASA/FTD, WordPress : rien de nouveau lu.

### Pile de production du projet
Rien de nouveau lu. Issues #48, #49, #51 sans nouvelle réponse connue. Pas de nouvelle issue : les trouvailles du jour ne concernent pas la pile Next.js/Node d'après mes lectures (Chromium est un navigateur, non lu dans la pile).

---

## 2026-11-12 (jeudi)

Sources consultées le 2026-11-12 : catalogue CISA KEV (`catalogVersion` **2026.11.10**, 1 779 entrées : **inchangé** depuis hier, aucune nouvelle entrée), avis Barracuda (page lue), code source OpenSSH 10.6p1 / 10.6p2 (voir la fiche du jour). Aucun autre PSIRT d'éditeur de ta liste relu aujourd'hui : un catalogue inchangé ne dit rien des avis non exploités.

### 1. OpenSSH sur Linux musl sans PAM — CVE-2026-123158 — **échéance CISA aujourd'hui, 2026-11-12**
Rien de nouveau à ajouter aux faits consignés le 2026-11-10 (périmètre, conditions, correctifs, contournement). Le mécanisme est expliqué dans `2026-11-12-openssh-musl-quand-un-champ-mot-de-passe-vaut-etoile.md`, à partir du **diff réel** : OpenSSH 10.6p2 ajoute une garde `strlen(pw_password) >= 4` avant d'accepter une comparaison de mots de passe hachés. Si tu exploites sshd sur Alpine ou une autre distribution musl sans PAM, la vérification utile reste : système, version, `PasswordAuthentication`, **redémarrage de sshd** après mise à jour.

### 2. Barracuda (hors de ta liste d'éditeurs) — suivi et **correction de ma note du 2026-11-11** — échéance CISA **demain, 2026-11-13**
J'ai lu l'**avis de l'éditeur** (page « Pre-Authentication Authorization Bypass and Command Injection Vulnerabilities in Certain Barracuda Products », mise à jour le 2026-11-09 à 21 h, heure de New York).
- **Exploitation :** l'éditeur écrit avoir identifié une activité d'exploitation affectant **un petit nombre d'organisations**.
- **Correction :** le 2026-11-05, Barracuda a modifié le champ « Authentication Required » de CVE-2026-116606 de « Yes, administrative access » à **« No (Administrative UI Access Required) »** : **pas d'authentification requise, mais l'interface d'administration doit être accessible à l'attaquant**. Mon entrée du 2026-11-11 écrivait « attaquant distant non authentifié » d'après NVD sans cette précision. Les deux failles, **combinées**, peuvent permettre de contourner les contrôles d'autorisation et d'obtenir un **accès root**.
- **Produits et correctifs nommés par l'éditeur :** Email Security Gateway (ESG) : concerné par les deux CVE ; correctifs BNSF-40425 (9.4.017 et plus) et BNSF-40430 (avant 9.4.017). Load Balancer ADC : CVE-2026-111560 seulement ; BNADC-16586. Message Archiver : BNMA-32468. WAF Control Center : BNWF-60060. Web Application Firewall : BNADC-16586. Web Security Gateway : BNYF-24789.
- **Parade (éditeur) :** les organisations dont **l'interface d'administration n'est pas joignable depuis Internet** sont moins exposées ; restreindre l'accès aux réseaux internes de confiance. Vérifier le micrologiciel (« le périphérique affiche la dernière version disponible »), activer les correctifs automatiques ; si le micrologiciel a plusieurs versions de retard, plusieurs mises à jour peuvent être nécessaires.
- **Ce que tu vérifies (si tu as un produit Barracuda) :** (1) que l'**interface d'administration n'est pas exposée sur Internet** ; (2) le micrologiciel et le correctif appliqué, d'après le tableau ci-dessus ; (3) des signes de modification de configuration ou de restauration de sauvegarde inattendue (**déduction** de ma part à partir de la description NVD).
- Source : https://trust.barracuda.com/security/pre-authentication-authorization-bypass-command-injection (consultée le 2026-11-12). Les rapports Mandiant cités par NVD ne sont pas lus.

### Suivis
Microsoft (Outlook CVE-2026-124194, AD DS, LDAP, Exchange : voir 2026-11-11, échéance Outlook 2026-11-24), SonicWall CVE-2026-19868 (2026-11-20), Apple CVE-2024-27834 (2026-11-18), Cisco BroadWorks (2026-11-24), Ivanti, Cisco ASA/FTD, WordPress : rien de nouveau lu.

### Pile de production du projet
Rien de nouveau lu. Issues #48, #49, #51 sans nouvelle réponse connue. Pas de nouvelle issue.

---

## 2026-11-13 (vendredi)

Sources consultées le 2026-11-13 : catalogue CISA KEV (`catalogVersion` **2026.11.10**, 1 779 entrées : **inchangé** depuis le 2026-11-11, aucune nouvelle entrée). Aucun PSIRT d'éditeur de ta liste relu aujourd'hui : un catalogue inchangé ne dit rien des avis non exploités.

### Échéances CISA, rappel (rien de nouveau, rien de répété)
- **Barracuda** (CVE-2026-116606 et CVE-2026-111560) : échéance **aujourd'hui, 2026-11-13** ; voir l'entrée du 2026-11-12 (avis de l'éditeur lu).
- OpenSSH musl CVE-2026-123158 : échéance passée hier. SonicWall CVE-2026-19868 : 2026-11-20. Microsoft Outlook CVE-2026-124194 et Cisco BroadWorks CVE-2026-20320 : 2026-11-24. Apple CVE-2024-27834 : 2026-11-18.

### Pile de production du projet
Lecture de la fusion « refonte visuelle SentinelScope » (voir la fiche du jour `2026-11-13-relire-une-refonte-csp-competences-tierces.md`). Aucune faille de dépendance lue. Trois observations de **conception**, pas des failles confirmées : (1) `next.config.mjs` : la CSP de développement est servie pour toute valeur de `NODE_ENV` autre que `production` (condition qui s'ouvre par défaut) ; (2) deux compétences tierces importées dans `.claude/skills/` sans fichier de licence ; (3) `wiki_sync.py` (compétence `unslop`) documente un enchaînement qui envoie du texte externe à un agent muni de `Bash`. **Pas d'issue ouverte** : aucun de ces points n'est une faille avérée dans la production ; ils sont dans la fiche et le compte-rendu pour ta décision. Issues #48, #49, #51 sans nouvelle réponse connue.

---

## 2026-11-14 (samedi)

Sources consultées le 2026-11-14 : catalogue CISA KEV (`catalogVersion` **2026.11.13**, 1 781 entrées : **deux** nouvelles entrées depuis le 2026-11-13), API NVD (CVE-2026-123039), page de l'avis Check Point `sk1000362` (**titre seulement lisible**, le contenu se charge par script). Aucun autre PSIRT d'éditeur de ta liste relu aujourd'hui : un catalogue qui bouge peu ne dit rien des avis non exploités.

### 1. Check Point Gaia OS : élévation de privilèges locale vers root par le démon DynamicCLI — CVE-2026-123039 — **exploitation active constatée par la CISA, échéance lundi 2026-11-16**
- **Exploitation :** ajoutée au catalogue le **2026-11-13**, échéance **2026-11-16**.
- **Nature :** d'après NVD, le démon DynamicCLI de Gaia OS « runs as root and listens on a world-writable local socket (`/tmp/dynamic_socket`) without authenticating connecting processes. An authenticated **local** user can send a command to the socket and have it executed as root. » CWE-732 et CWE-862. Le catalogue CISA liste : Check Point Firewall, Multi-Domain Security Management Server, Scalable Platforms, Security Gateway, Security Management Server.
- **Score :** CVSS 3.1 de **7,8**, `AV:L/AC:L/PR:L/UI:N` (source `cve@checkpoint.com`).
- **Lecture du vecteur :** il faut **déjà** un accès local authentifié à l'équipement ; ce n'est pas une porte d'entrée depuis Internet. Mais l'accès local peut venir d'une autre faille ou d'un compte à faibles privilèges (**déduction**, c'est le même schéma « chaîne » que les fiches du 29 octobre et du 31 octobre). Le catalogue ne précise pas par quel chemin l'exploitation a eu lieu.
- **Versions affectées et corrigées, correctif (hotfix), contournement : non lus.** L'avis Check Point (`https://support.checkpoint.com/results/sk/sk1000362`) ne s'affiche pas à la lecture ; une recherche n'a trouvé **aucune source secondaire** sur cette CVE. **Lis l'avis directement.**
- **Ce que tu vérifies chez toi (si tu as Check Point Gaia) :** (1) le **modèle et la version de Gaia** de tes passerelles et serveurs de gestion, à comparer à l'avis ; (2) **qui a un compte** sur ces équipements (comptes d'administration et comptes à privilèges réduits) et que l'**accès de gestion** n'est pas joignable depuis Internet ; (3) des **comptes ou connexions inhabituels** sur ces équipements (**déduction**, pas une consigne de l'éditeur).
- Sources : https://nvd.nist.gov/vuln/detail/CVE-2026-123039 ; https://support.checkpoint.com/results/sk/sk1000362 (titre seulement) ; catalogue CISA (consultés le 2026-11-14).

### Vu, hors de ta liste d'éditeurs (catalogue du 2026-11-13, échéance 2026-11-16)
UnrealIRCd CVE-2026-114713 (injection de commandes serveur à serveur sur un réseau avec deux serveurs liés ou plus). **Description du catalogue seulement.**

### Échéances CISA, rappel
Barracuda (2026-11-13, passée). SonicWall CVE-2026-19868 : 2026-11-20. Apple CVE-2024-27834 : 2026-11-18. Microsoft Outlook CVE-2026-124194 et Cisco BroadWorks CVE-2026-20320 : 2026-11-24. Rien de nouveau lu sur les autres suivis.

### Pile de production du projet
Rien de nouveau lu. Issues #48, #49, #51 sans nouvelle réponse connue. Pas de nouvelle issue.

---

## 2026-11-15 (dimanche)

Sources consultées le 2026-11-15 : catalogue CISA KEV (`catalogVersion` **2026.11.13**, 1 781 entrées : **inchangé** depuis hier, aucune nouvelle entrée). Aucun PSIRT d'éditeur de ta liste relu aujourd'hui : un catalogue inchangé ne dit rien des avis non exploités.

### Suivis (rien de nouveau lu, rien de répété)
- **Check Point Gaia CVE-2026-123039** (entrée du 2026-11-14) : échéance CISA **demain, 2026-11-16**. Avis de l'éditeur toujours à lire directement (`sk1000362`).
- Apple CVE-2024-27834 : 2026-11-18. SonicWall CVE-2026-19868 : 2026-11-20. Microsoft Outlook CVE-2026-124194 et Cisco BroadWorks CVE-2026-20320 : 2026-11-24.

### Pile de production du projet
PR #47 (la mienne) ouverte ; aucune nouvelle PR de la part de tes agents depuis la #53 d'après la liste lue aujourd'hui. Issues #48, #49, #51 ouvertes, sans nouvelle réponse. Aucun commentaire de ta part sur la PR #47. Pas de nouvelle issue.

---

## 2026-11-16 (lundi)

Sources consultées le 2026-11-16 : catalogue CISA KEV (`catalogVersion` **2026.11.13**, 1 781 entrées : **inchangé** depuis le 2026-11-14, aucune nouvelle entrée). Aucun PSIRT d'éditeur de ta liste relu aujourd'hui : un catalogue inchangé ne dit rien des avis non exploités.

### Échéances CISA du jour et à venir (rien de nouveau lu, rien de répété)
- **Check Point Gaia CVE-2026-123039 : échéance aujourd'hui, 2026-11-16** (entrée du 2026-11-14). Avis de l'éditeur (`sk1000362`) toujours non lu : la page ne montre que son titre à la lecture. Si tu as du Check Point : version de Gaia, comptes sur les équipements, exposition de l'accès de gestion.
- UnrealIRCd CVE-2026-114713 (hors de ta liste) : échéance aujourd'hui.
- Apple CVE-2024-27834 : 2026-11-18. SonicWall CVE-2026-19868 : 2026-11-20. Microsoft Outlook CVE-2026-124194 et Cisco BroadWorks CVE-2026-20320 : 2026-11-24.

### Pile de production du projet
Rien de nouveau lu. Issues #48, #49, #51 sans nouvelle réponse connue. Pas de nouvelle issue.

---

## 2026-11-16 (lundi), ajout du soir : incident majeur que j'avais manqué — panne Microsoft Outlook / Microsoft 365 des 12 et 13 novembre

**Pourquoi cet ajout :** tu m'as signalé la panne et demandé si elle figurait dans la veille. **Non** : ma veille de la semaine ne suivait que les failles (catalogue CISA, NVD, avis d'éditeurs). Je n'ai donc rien consigné sur cette panne avant ta remarque. Je l'ajoute maintenant et j'élargis le périmètre (voir la fin de l'entrée).

Sources lues le 2026-11-16 : Al Jazeera (explication publiée le 13 novembre) et ABC News (publié le 16 novembre). Les deux sont des **médias**, pas des documents de Microsoft : je n'ai **pas** lu le rapport d'incident de Microsoft lui-même.

- **Début et durée :** les problèmes ont commencé vers **16 h GMT le jeudi 12 novembre** ; en une heure, Downdetector avait enregistré des signalements dans **74 pays et territoires** (Al Jazeera). L'incident a duré **deux jours ouvrés** (ABC) ; en Europe, vendredi matin, la panne n'était **pas résolue** et des serveurs remis en service retombaient. **Heure de fin : non lue** (une recherche a cité un rapport préliminaire de Microsoft mentionnant la fin vendredi 13 novembre vers 11 h 10, heure de New York ; je ne l'ai pas vérifié à la source).
- **Services touchés :** Outlook le plus durement (boîtes inaccessibles par le web, l'application et le mobile, courriers en retard) ; Teams et Copilot partiellement ; des intégrations tierces dont celles d'OpenAI et d'Anthropic (Al Jazeera). Plus de **43 000** signalements Downdetector pour Outlook vendredi à 7 h GMT, dans 72 pays ; chiffre **partiel** par nature.
- **Cyberattaque ?** Microsoft a déclaré **qu'il n'y a pas d'indication d'activité malveillante** (Charles Lamanna, vice-président exécutif, le jeudi soir).
- **Cause annoncée par Microsoft le lundi 16 novembre (rapportée par ABC) :** trois éléments combinés : (1) un **défaut latent**, issu d'un **correctif « préparé spécifiquement pour les serveurs passerelles réseau de Microsoft 365 »** (ABC parle d'un « bug latent de juillet ») ; (2) une **hausse de charge** sur la passerelle ; (3) une **capacité de serveurs réduite**, qui « n'a eu aucun impact à elle seule ». Les deux derniers ont fait que la passerelle a rencontré le défaut ; des requêtes se sont accumulées jusqu'à ce que les serveurs ne répondent plus, **pendant le pic de trafic aux États-Unis**.
- **Pourquoi c'était si long (même source) :** « à mesure que les serveurs revenaient en service, ils étaient **immédiatement submergés par le trafic en attente** et cessaient de répondre » : c'est un **effet de rafale à la reprise** (*retry storm* / *thundering herd*, termes de ma part, pas de Microsoft).
- **Ce que tu retiens en tant qu'exploitant (déduction de ma part) :** (1) ta messagerie en ligne peut tomber **sans aucune faille ni attaque** ; (2) un **plan de repli de communication** (téléphone, messagerie secondaire, canal d'astreinte) se prépare **avant** la panne ; (3) une panne se suit sur la **page d'état du service** de l'éditeur, pas seulement sur les sites de signalement ; (4) à la reprise, **les files d'attente peuvent rejouer** (courriers en retard, doublons).
- **Statut :** le rapport définitif de Microsoft n'est **pas lu** ; la cause peut être précisée ou corrigée. Sources : https://www.aljazeera.com/news/2026/11/13/microsoft-hit-by-global-outages-what-happened-and-why ; https://abcnews.com/US/outlook-outage-cause-microsoft-reason-teams-down/story?id=138174626 (consultés le 2026-11-16).

### Périmètre élargi de la veille (à ta demande)
À partir de maintenant, en plus des failles, je cherche **chaque jour** les **pannes et incidents majeurs** des services qui comptent pour toi : messagerie et cloud (Microsoft 365, Azure, Google), accès distant et VPN, DNS et opérateurs, hébergeurs, éditeurs de sauvegarde. Pour chacun : quoi, quand, durée, cause **annoncée** (distincte de la cause **réelle**), source lue, et ce que tu en retiens. **Limite :** je lis des **médias et pages d'état** que le moteur de recherche me remonte ; je peux **en manquer**. Dis-moi quand je rate un incident, ou quels services tu veux que je surveille en priorité.

---

## 2026-11-16 (lundi), ajout du soir n°2 : outils cyber et informatiques (nouveau périmètre, à ta demande)

Périmètre ajouté : les **dernières versions d'outils** de cybersécurité et d'administration, en plus des failles et des pannes. **Rappel de règle :** les outils d'analyse ci-dessous (scanners de ports, d'XSS, de partages) ne s'utilisent que **sur tes laboratoires ou des systèmes dont tu es responsable**, jamais sur un système tiers ni sur le réseau de ton employeur à titre d'apprentissage.

Sources lues le 2026-11-16 : blog officiel de Kali, page « News » de Wireshark, notes de version de Zabbix 8.0.0, pages Microsoft Learn sur PowerShell, article de Cybersecurity News. Les points non lus sont **marqués comme tels**.

### 1. Kali Linux 2026.3 — publiée le **2026-10-26** (blog officiel, lu)
- **Nouveaux outils** (réseaux dépôts Kali) : `dalfox` (scanner XSS automatisé), `katana` (explorateur / « crawler » de sites), `qsreplace` (remplace les valeurs des paramètres d'URL lues sur l'entrée standard), `rustscan` (scanner de ports), `sdrangel` (interface pour la radio logicielle), `snaffler-ng` (recherche d'identifiants et de données sensibles sur des partages SMB).
- **Système :** 126 mises à jour de paquets ; noyau Kali de **6.19 à 7.1.5** ; bureau KDE Plasma 6.7 ; réécriture des scripts de construction d'images (« build-scripts refresh »).
- **NetHunter** (Kali sur téléphone / montre) : prise en charge de la montre TicWatch Pro 3 pour le « wardriving », accès NFC dans le chroot Kali, KernelSU.
- **Ce que ça change pour toi :** utile pour monter un **laboratoire** (une machine d'attaque pour t'entraîner contre **tes propres** VM). Une date divergente (5 novembre) apparaît dans un site tiers ; le **blog officiel dit le 26 octobre**.

### 2. Wireshark 5.0.0rc1 — publiée le **2026-11-11** (page News de Wireshark, lue)
- Version de développement (« release candidate »). Nouveautés listées : éditeur de thèmes (View › Internals › Theme Designer), thèmes adaptés au daltonisme, aide associée à chaque boîte de dialogue, graphiques E/S avec moyennes mobiles exponentielles (EWMA), **premier support des empreintes TCP nDPI**, étiquetage de paquets (texte, emoji, lien), icônes rafraîchies, application macOS signée avec un nouveau certificat (l'ancien expire début 2027).
- **Non lu :** la date de sortie de la version stable 5.0.0 (une liste de diffusion citait 21 octobre comme date prévue ; la page News lue montre une **version candidate** au 11 novembre, donc la stable n'est **pas** confirmée). Les branches **4.6** (4.6.9 listée comme dernière) et **4.7** (4.7.4) coexistent.
- **Ce que ça change pour toi :** outil central de diagnostic réseau (tu vois les trames de tes fiches sur 802.1Q, STP, DNS) ; la 5.0 apporte surtout de l'ergonomie. **Pas de raison de migrer** un poste de production vers une version candidate.

### 3. Zabbix 8.0.0 — publiée le **2026-11-05** (notes de version officielles, lues) — Zabbix est sur ta liste d'éditeurs
- Première version **8.0.0** annoncée par l'équipe Zabbix (licence AGPLv3). Parmi les nouveautés lues : prise en charge d'un **cluster ClickHouse** et d'**Elasticsearch 8.x / 9.x**, « traces APM » à racine manquante, longueur maximale des données opérationnelles d'un déclencheur portée à 2048 caractères, versions maximales prises en charge relevées (MariaDB 12.3, MySQL 9.7, TimescaleDB 2.29).
- **Non confirmé :** que 8.0 soit une version « LTS » (les notes lues ne le disent pas dans les extraits que j'ai vus) ; calendrier de support ; avis de sécurité liés. **Si tu exploites Zabbix**, ne mets pas à jour sans lire la procédure de mise à niveau de l'éditeur.

### 4. OpenAI « Daybreak Red Team » et « Daybreak Defense Factory » — annoncés le **2026-11-12** (presse spécialisée, lue ; pages de l'éditeur **non lues**)
- **Red Team** (accès anticipé) : examen automatisé d'applications web, avec des agents qui testent si une faille signalée est **atteignable et exploitable**, y compris pour des signalements de scanners, de programmes de primes aux bogues ou de divulgations. **Defense Factory** : trouve, valide et **corrige** des failles dans le code ; les ingénieurs **relisent et approuvent** une demande de fusion avec correctif et test. D'après l'article, ces produits utilisent des modèles de cybersécurité d'OpenAI.
- **Ce que ça change pour ton projet (déduction) :** c'est un produit **voisin de SentinelScope** (audit de sécurité web). À suivre comme **concurrence ou complément**, pas comme fait établi ; je n'ai lu ni les tarifs ni les conditions.

### 5. PowerShell — **information contradictoire, rien d'établi**
- Les pages Microsoft que j'ai lues indiquent : version stable courante **7.5.11**, version LTS courante **7.6.6** (page sans date lisible) ; la page « Nouveautés de PowerShell 7.7 » décrit une version **préliminaire** (7.7.0-preview.5, sur .NET 11 RC1) avec un changement notable : `New-Guid` produirait des identifiants **version 7** (triables dans le temps) par défaut. Wikipédia (non lue directement) annoncerait « 7.7.0 » le 10 novembre : **non confirmé** par les pages Microsoft lues.
- **Ce que ça change pour toi :** rien d'urgent ; vérifie la version installée sur tes serveurs de lab avant tout script.

### 6. À vérifier (signalé par la recherche, **non lu**)
- **ARTEX** : outil open source d'attaque assistée par IA ; un avis du FBI (« FLASH ») le dirait utilisé dans des attaques (résultat de recherche ; l'article de BleepingComputer n'a pas pu être ouvert, **403**). Aucune version ni détail consigné.
- **Proxmox, Windows Server** : aucune nouveauté de novembre trouvée (Wikipédia cite Proxmox VE 9.2 en mai 2026) : **rien lu** de plus.

### Comment je suivrai ce périmètre
Chaque lundi, un point **« Outils »** (3 à 5 entrées : outil, version, date, source lue, ce que ça change pour toi). Les autres jours, une seule ligne si un outil de ta liste sort. **Dis-moi quels outils te comptent** (par exemple Wireshark, Nmap, Metasploit, PowerShell, Proxmox, Zabbix, Veeam, PRTG) et je les suis nommément.

---

## 2026-11-16 (lundi), ajout du soir n°3 : dépôts GitHub pour tes agents, TikTok, et limites de la lecture de X (Twitter)

Périmètre ajouté à ta demande : (a) dépôts GitHub utiles pour améliorer tes agents (motion design, interface…), (b) TikTok et les nouveautés d'outils d'IA, (c) X (Twitter). Sources lues le 2026-11-16 : les fichiers `README.md` et `LICENSE` des dépôts (lus via `raw.githubusercontent.com`), des articles de presse. **Les nombres d'étoiles et d'installations cités par des sites agrégateurs ne sont pas vérifiés** : je ne les reprends pas.

### 1. Dépôts GitHub pour agents, interface et motion design (README et licence lus)
| Dépôt | Ce que c'est (d'après son README) | Licence (fichier lu) | Pour toi |
|---|---|---|---|
| `LottieFiles/motion-design-skill` | Principes de **motion design** pour agents : durées, courbes d'accélération, chorégraphie, adaptés des 12 principes de Disney pour l'interface ; « agnostique de l'implémentation » (CSS, Framer Motion…) ; commande d'installation `npx skills add LottieFiles/motion-design-skill` | **MIT** (« Copyright (c) 2025 LottieFiles ») | Cadre de réflexion pour les animations de SentinelScope (cf. fiches du 22 octobre et du 6 novembre). |
| `emilkowalski/skills` | Compétences pour concepteurs et ingénieurs d'interface (auteur ayant travaillé chez Vercel et Linear d'après son README) ; l'auteur écrit que les agents choisissent parfois de mauvaises courbes (par exemple `ease-in` à l'entrée au lieu de `ease-out`) | **MIT** (« Copyright (c) 2026 Emil Kowalski ») | Règles d'animation « d'opinion » : à lire avant de les traiter comme des lois. |
| `heygen-com/hyperframes` | « Write HTML. Render video. Built for agents. » : écrire du HTML qui se rend en **vidéo** ; nécessite Node ≥ 22 d'après ses badges | **Apache 2.0** | Pour des vidéos de démonstration du produit (idée, non testée). |
| `wilwaldon/Claude-Code-Frontend-Design-Toolkit` | **Liste commentée** (« awesome list », 70+ outils, date indiquée avril 2026) de compétences, extensions et astuces pour de meilleures interfaces | **Aucun fichier `LICENSE` trouvé** | Utile comme **annuaire** ; je ne copierais pas son contenu sans licence. |
| `imMamdouhaboammar/motion-graphics-skills` | Compétences « motion graphics » pour agents (annoncées : 64) | **« PROPRIETARY AND CONFIDENTIAL LICENSE (ALL RIGHTS RESERVED) »** | **Ne pas importer dans ton dépôt** : licence propriétaire, tous droits réservés. |

**Avant d'installer quoi que ce soit (rappel de la fiche du 13 novembre) :** une « compétence » est un ensemble d'instructions et de scripts qu'un agent suit ou exécute. `npx skills add …` **télécharge du code**. Règles : (1) lis le dépôt avant ; (2) vérifie la **licence** et copie le **fichier de licence** avec le contenu ; (3) **épingle un commit** (comme le font les `ORIGINE.md` de ton dépôt) ; (4) essaie d'abord dans un **dossier de test**, pas dans le dépôt de production ; (5) ne lance jamais d'enchaînement qui envoie du texte externe à un agent muni de `Bash`.

### 2. TikTok
- **Publicité et création par IA (lu) :** le 9 novembre, d'après Social Media Today (journaliste cité : Andrew Hutchinson), TikTok a mis à jour **Symphony** : accès au dernier modèle **Dreamina Seedance**, jusqu'à **50 références** multimodales (contre 9), vidéos de **30 secondes** par requête (contre 15), **API Symphony** mise à jour pour générer dans ses propres outils, et achat de jetons **BytePlus** ouvert hors Amérique du Nord à partir du 9 novembre. L'article ne présente ceci que comme un outil à **tester**.
- **Plus ancien (lu) :** « TikTok World '26 » (13 mai 2026) : annonces d'outils d'IA pour annonceurs (page du Newsroom TikTok).
- **Ce que je ne peux pas faire :** lire les **tendances en temps réel** de la plateforme (sons, hashtags, formats en vogue). Le **Creative Center** de TikTok se charge par script : la lecture ne renvoie que le menu. **Je ne te donne donc aucune tendance de plateforme.** Ce que je peux suivre : les **annonces d'outils** (Newsroom, presse spécialisée).
- **Ce que ça change pour toi (déduction) :** utile si tu veux produire des vidéos courtes autour de SentinelScope ; je n'ai pas lu les tarifs ni les conditions.

### 3. X (Twitter) — ce que je peux et ne peux pas faire
- **Je ne peux pas lire le fil d'actualité de X** : le site exige une connexion et bloque la lecture automatique ; je n'ai **pas** testé d'outil de contournement et je n'en utiliserai pas pour passer une protection.
- **Ce que je peux faire à la place (et qui est souvent mieux) :** suivre **les sources primaires** que ces comptes relaient : les PSIRT des éditeurs, les blogs officiels, le catalogue CISA, le CERT-FR, les dépôts GitHub (notes de version). Et **lire les pages publiques** que la recherche me remonte (articles qui citent un message d'un compte).
- **Ce que je ne peux pas garantir :** la vitesse (l'annonce sur X précède souvent la page officielle) ni l'exhaustivité (une rumeur ou un message supprimé m'échappe).
- **Proposition :** donne-moi **les comptes qui comptent pour toi** (éditeurs, chercheurs, médias cyber) : je cherche leurs **annonces relayées dans des sources lisibles** et je note **toujours** la différence entre **rumeur / annonce / disponibilité réelle**.

### Comment je les suivrai
Chaque lundi : un point « Outils et dépôts » (3 à 5 entrées). Chaque jour : une ligne s'il y a un incident, une panne ou une annonce d'un service de ta liste. **Dis-moi** quels thèmes tu veux plus gros : sécurité, interface et motion, réseaux sociaux, IA.

---

## 2026-11-16 (lundi), ajout du soir n°4 : l'IA et la cybersécurité (nouveau périmètre, à ta demande)

Périmètre ajouté : **tout ce qui touche à l'IA, y compris côté cyber** : attaques assistées par IA, failles découvertes par IA, outils de défense, sorties de modèles, régulation. Pour chaque point : **ce que j'ai lu** (source, date) et **ce que je n'ai pas lu**. **Transparence :** je suis un modèle d'**Anthropic** ; pour tout ce qui touche à Anthropic, croise avec une source indépendante.

Sources lues le 2026-11-16 : notes de version OpenSSH 10.6p2 (déjà lues le 12), page « News » d'Anthropic, article de Cybersecurity News (déjà cité), liste d'articles de Malwarebytes Labs. **Beaucoup d'autres points viennent d'extraits de résultats de recherche (articles de presse non ouverts ou bloqués)** : je les marque « non lu ».

### 1. Ce qui a changé pour toi dans les faits (lu)
- **Les éditeurs reçoivent beaucoup plus de rapports de failles trouvées par IA.** Notes de version OpenSSH 10.6p2 (2026-11-05), lues : l'équipe écrit avoir reçu « un grand nombre de rapports de bogues de sécurité, dont beaucoup sont des découvertes de modèles d'IA ou faites avec leur aide » ; elle a vu des cas où une faille trouvée par IA est **retrouvée indépendamment par un autre chercheur**, ce qui, écrit-elle, « suggère que des adversaires qui ne signalent pas les bogues aux projets libres sont probablement capables de les découvrir aussi ». **Conséquence annoncée : « des versions plus fréquentes »** au lieu d'attendre la prochaine version planifiée. **Ce que ça change pour toi (déduction) :** le rythme des correctifs de logiciels libres (OpenSSH, mais pas seulement) va probablement **s'accélérer** ; ton processus de mise à jour doit absorber plus de petites versions.
- **OpenAI « Daybreak Red Team » et « Defense Factory »** (annoncés le 2026-11-12, déjà consignés ce soir) : test automatisé d'applications web et production de correctifs relus par des humains. Source : presse spécialisée, pages de l'éditeur non lues.

### 2. Attaques assistées par IA (presse ; **sources primaires non lues**)
- **ARTEX** (cadre libre d'attaque autonome, déjà signalé ce soir) : d'après plusieurs articles issus d'une recherche, l'**FBI** a publié le **2026-11-13** un avis **FLASH-20261113-001** ; selon ces articles : utilisation par des acteurs malveillants **depuis août**, certaines intrusions atteignant des **droits privilégiés en moins de trois heures**, **plus de 1 600 consoles ARTEX exposées** sur Internet début novembre, **aucune CVE citée**, indicateurs de **comportement** (portes dérobées web à des emplacements d'application inhabituels, appels sortants inattendus vers des API de modèles du commerce) et recommandations sur les **connexions de comptes de service et les nouveaux identifiants OAuth**. Un titre de Malwarebytes du 2026-11-16 confirme l'existence de l'alerte (« Criminals are using ARTEX AI agents to speed up cyberattacks, FBI warns », lu). **L'avis du FBI lui-même n'est pas lu**, et les détails ci-dessus sont ceux de la presse : **vérifie dans l'avis**. **Ce que ça change pour toi (déduction) :** ce qui se détecte, c'est le **comportement** (web shells, sorties vers des API de modèles), pas une CVE ; et la **rapidité** d'une intrusion se compte en heures.
- **Google** : un article cité par la recherche (BleepingComputer, **bloqué en 403, non lu**) dit que Google avertit que des **attaques entièrement automatisées par IA** approchent et que des acteurs abusent d'outils libres de test d'intrusion.
- **Amazon** : un extrait de recherche (**non lu**) dit que des agents d'IA chassent des failles dans des applications d'IA **exposées sur Internet** (LiteLLM, One API, Dify) pour **voler des clés de fournisseurs de modèles**. **Si tu exposes une passerelle ou une application d'IA**, c'est un point à vérifier : version, exposition, clés stockées.
- **SGLang** (moteur d'inférence libre) : un extrait (**non lu**) cite une faille d'exécution de code exploitée le 2026-11-09, avec exposition de comptes d'environ 100 utilisateurs d'un service. À confirmer à la source.

### 3. Découvertes par IA (extraits non lus : à confirmer avant de les citer)
- Google DeepMind (6 novembre) : des agents supervisés auraient trouvé deux façons de **réduire le coût d'attaque contre RSA 1024 bits** (extrait de recherche, **non lu**). Un titre sur « 948 failles du noyau Linux » attribué à OpenAI est **un titre seul**, je n'en tire rien.

### 4. Modèles (page officielle lue, détails non lus)
- La page « News » d'Anthropic, lue, liste en tête, daté du **2026-11-16**, « **Introducing Claude Fable 5.2 and Claude Mythos 5.2** » (« nos modèles les plus performants pour les travaux techniques difficiles ») ; plus bas : « **Claude Opus 5.5** » (annoncé « 40 % moins coûteux que Opus 5 sur des charges typiques ») et « **Claude Haiku 5.5** » (« petit modèle le plus rapide et le plus performant », cité pour « sous-agents et navigation »), ainsi qu'un dépôt de demande d'introduction en bourse (« Form S-1 ») et une feuille de route de lancement. **Une lettre d'information citée par la recherche donnait le 9 novembre pour Fable 5.2 : la page officielle dit le 16 novembre**, je retiens la page officielle.
- **Ce que ça change pour ta flotte d'agents (question que tu poses) :** je **n'ai pas lu** les articles de lancement, donc je ne donne **ni tarif, ni limite, ni capacité**. À lire avant tout changement de modèle sur tes agents. Pour les autres éditeurs (OpenAI, Google, etc.), la recherche mentionne « GPT-6 Cyber » et une autre appellation : **sources contradictoires, rien d'établi**.

### 5. Régulation et gouvernance (extraits non lus)
- « Paris Call for AI Safety and Security » signé par dix entreprises d'IA lors d'une réunion du 9 novembre ; l'Australie envisagerait un régulateur de sécurité de l'IA (extraits de recherche). **À confirmer.**

### Comment je les suivrai
Chaque jour, **une ligne** « IA et cyber » dans le bloc « À FAIRE » seulement si un point te **concerne directement** (outil que tu utilises, avis du FBI ou de la CISA sur l'IA, faille d'un logiciel d'IA exposé). Chaque lundi, un point **« IA et cyber »** de 3 à 5 entrées avec **source lue** ou la mention **non lu**. **Dis-moi** quels aspects te comptent : attaques, défense, modèles pour tes agents, régulation, outils d'IA que tu héberges.

---

## 2026-11-16 (lundi), ajout du soir n°5 : veille « métier » (évolution de carrière)

À ta demande (« savoir si je dois évoluer avec mon métier vers de nouvelles technologies »), un document dédié : `evolution-du-metier-reseau-2026-11-16.md`. En résumé : **solide (lu)** : la pénurie d'ingénieurs réseau s'aggrave (EMA : 26 % en 2022, 41 % en 2024, 52 % en 2026 déclarent avoir du mal à recruter ; sécurité réseau, automatisation et réseau pour l'IA sont les compétences les plus rares) ; l'IA et l'automatisation touchent surtout les **postes d'entrée** ; NIS 2 est un moteur de conformité (ANSSI, page non datée). **Plausible mais non vérifié :** demande forte en GRC et en automatisation, chiffres d'emploi et salaires (sources contradictoires, non reprises). **Aucun verdict.** Point « Métier » mensuel, premier lundi du mois.

---

## 2026-11-16 (lundi), ajout du soir n°6 : tendances et découvertes en IA (précision de périmètre)

**Précision reçue :** tu ne parlais pas de TikTok comme plateforme, mais des **tendances et découvertes en IA** (où qu'on les voie, y compris sur TikTok). J'avais lu « TikTok » trop littéralement ; je corrige. **Ce que je ne vois pas :** le fil TikTok lui-même (non lisible, voir l'ajout n°3). **Ce que je lis à la place :** les **lettres d'information spécialisées** qui relaient les tendances, et les **pages officielles** quand elles sont lisibles.

Sources lues le 2026-11-16 : **The Neuron** (« Everything That Happened in AI Today », 16 novembre, journaliste citée : Marianne Sison) et **Bad Good Better** (« AI Weekly Update, semaine du 15 novembre ») : ce sont des **lettres d'information** (sources **secondaires**) ; je n'ai **pas** ouvert les pages des éditeurs cités, sauf la page d'Anthropic lue précédemment. Un autre résumé (Annielytics) est **bloqué (403)**. Tout ce qui suit est **« selon la lettre »**.

### A. Tendance n° 1 : les agents d'IA reçoivent des moyens d'agir (paiement, permissions) — et la gouvernance suit
- **ChatGPT Wallet** (OpenAI, selon The Neuron) : un agent peut **acheter** pour toi ; tu ajoutes une carte une fois, tu **approuves chaque achat** par vérification biométrique ; le réseau de paiement fournit un **substitut temporaire** des données de carte, donc l'agent et le commerçant ne voient pas ta vraie carte. Développé avec American Express, Mastercard et Visa ; **déploiement initial limité aux abonnés ChatGPT Pro aux États-Unis** ; les autorisations préalables dans des limites de dépense sont des **projets**, pas une réalité.
- **United Airlines** restreint les agents de réservation non autorisés ; **Poppy 1.0** (Sierra, selon la lettre) est un protocole par lequel une entreprise indique **quelles actions un agent a le droit de faire** ; Shopify l'aurait activé sur ses boutiques et plus de 100 entreprises y participeraient.
- **Uber** (selon la lettre) a conçu un cadre qui vérifie, **avant les actions sensibles**, si l'action proposée par un agent correspond à la demande de l'utilisateur, avec **journalisation** pour les revues de sécurité.
- **Pourquoi c'est de la cyber (déduction) :** « qui a le droit de faire quoi, au nom de qui, avec quelle preuve » est exactement le terrain de **l'identité et des droits** : jetons temporaires, approbation humaine, journaux. C'est aussi ce que tu apprends côté AD (authentification, autorisation).

### B. Tendance n° 2 : l'IA qui tourne chez toi (modèles ouverts, agents locaux)
- **Rakazo** (selon la lettre) : alternative **libre** aux agents hébergés ; des « coéquipiers » IA tournent **sur ton ordinateur**, avec **tes** modèles et clés ; règles d'approbation ; identifiants et journaux **restent dans ton environnement**.
- **Edge0-145B** (selon la lettre) : modèle ouvert de 145 milliards de paramètres pour PC compatibles ; l'éditeur annonce plus de 80 jetons par seconde avec environ 29 Go de mémoire de pointe : **chiffres de l'éditeur, non vérifiés**.
- **Meituan LongCat-2.5** (selon la lettre) : modèle à poids ouverts de 1,6 billion de paramètres pour agents de programmation, « entraîné entièrement sur du matériel chinois » ; un déploiement d'exemple exige **194 puces Huawei Ascend** : donc **pas à portée d'un poste de travail**.
- **Ce que ça change pour toi (déduction) :** « l'IA qui tourne chez moi » est une piste crédible pour des **agents de lab**, mais **toute application d'IA que tu héberges est une surface d'attaque** (voir l'ajout n°4 sur les agents qui chassent les passerelles d'IA exposées). Je n'ai testé aucun de ces outils.

### C. Découvertes et recherche
- **OpenAI** a lancé un **blog scientifique** (publication des résultats de chercheurs utilisant l'IA, avec leurs limites) ; un article de physique, développé avec **GPT-6 Astra** selon la lettre, propose une définition mathématique du Modèle standard sur une grille d'espace-temps ; un physicien cité dit qu'Astra a aidé la preuve, mais le résultat reste **une contribution de recherche**, pas un problème résolu.
- **Google Gemini 4 Carbon** « prend la première place » de MathArena devant « GPT-6.1 Sol » d'OpenAI, mais la configuration testée coûte environ **15 fois plus** par évaluation et dépasse souvent le temps limite (selon la lettre).
- **Ce que j'en retiens (prudence) :** ce sont des **résultats annoncés** ; « premier d'un classement » ne dit rien de **ton** cas d'usage. Je ne les ai pas lus à la source.

### D. Le contexte (pour savoir pourquoi ça bouge)
- **Anthropic** : page officielle lue (voir l'ajout n°4) : dépôt d'une demande d'introduction en bourse et lancement de la tournée de présentation (« roadshow »). **Je suis un modèle d'Anthropic : lis une source indépendante.**
- **Nvidia** : démission de Jensen Huang annoncée (selon la lettre, enquête sur un possible lien avec une opération de renseignement étrangère ; l'avis du conseil dit n'avoir **aucune raison de croire** que la sécurité nationale ou les secrets de Nvidia ont été compromis) ; une autre section de la lettre évoque un retour envisagé : **informations qui bougent vite et se contredisent, rien d'établi**.
- **Réserve fédérale (États-Unis)** : l'IA devient la préoccupation de stabilité financière la plus citée (87 % des répondants contre 50 % en mai, selon la lettre). **Chaîne d'approvisionnement de l'IA** : les États-Unis et leurs alliés annoncent une protection commune des chaînes critiques (selon la lettre).
- **Avertissement d'un chercheur d'alignement** (Paul Christiano, selon les deux lettres) sur un « risque élevé de prise de contrôle par l'IA dans les trois ans » : **opinion**, qu'il reconnaît sans modèle quantitatif.
- **Pannes de la semaine :** Bad Good Better note que **ni** la panne Microsoft **ni** l'arrêt des vols aux États-Unis n'ont été **reliés à l'IA** ni à une cyberattaque d'après la FAA et d'autres sources citées.

### Comment je suivrai ce thème
Chaque **lundi** : un point « IA : tendances et découvertes » (3 à 5 entrées, chacune avec **la source lue** et la mention **« selon la lettre »** quand je n'ai pas lu la page de l'éditeur). Chaque jour : une ligne **seulement** si un fait **te concerne** (outil que tu utilises, faille d'un logiciel d'IA, annonce touchant tes agents). **Dis-moi quels sujets te donnent le plus envie** : agents et permissions, IA locale, recherche, ou création (vidéo, image, motion).
