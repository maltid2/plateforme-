/* AgentShield Audit — relevé de démonstration.

   Ce n'est pas de la surveillance : rien n'est observé en direct. C'est le
   résultat d'une analyse de configuration, lancée par le client sur sa
   propre machine. On ne lit donc pas des appels qui ont eu lieu, mais les
   chemins que la configuration AUTORISE. La barrière ne montre pas ce qui
   a été bloqué : elle montre ce qui bloquerait s'il y avait quelque chose. */

export const RISQUES = {
  faible:   { label:'Faible',   couleur:0x5E7A9B, css:'#5E7A9B' },
  eleve:    { label:'Élevé',    couleur:0xFF9F43, css:'#FF9F43' },
  critique: { label:'Critique', couleur:0xFF5B5B, css:'#FF5B5B' },
};
export const SEV = {
  crit: { label:'Critique', css:'#FF5B5B' },
  haut: { label:'Élevé',    css:'#FF9F43' },
  moy:  { label:'Moyen',    css:'#FFD166' },
};

/* Le noyau : les outils que les agents peuvent atteindre. `regle` est la
   seule chose qui crée un anneau de barrière à ce niveau. */
export const OUTILS = [
  { id:'lecture',  nom:'Lecture de fichiers',  y:6.4, risque:'faible',   regle:null },
  { id:'web',      nom:'Navigateur web',       y:5.3, risque:'faible',   regle:null },
  { id:'bdd',      nom:'Base de données',      y:4.2, risque:'eleve',    regle:null },
  { id:'mail',     nom:'Messagerie sortante',  y:3.1, risque:'eleve',
    regle:'Validation humaine au-delà de 50 messages par jour — définie dans jobs/relances/politique.yml' },
  { id:'paiement', nom:'API de paiement',      y:2.0, risque:'critique', regle:null },
  { id:'shell',    nom:'Exécution shell',      y:0.9, risque:'critique', regle:null },
];

/* Les agents trouvés par l'analyse, et le fichier où chacun est déclaré. */
export const AGENTS = [
  { id:'ag-support', nom:'Assistant de support', modele:'Claude Sonnet 4.5',
    source:'services/support/agent.ts', outils:['lecture','web','bdd'] },
  { id:'ag-deploy', nom:'Agent de déploiement', modele:'Claude Opus 4.6',
    source:'.github/workflows/agent-deploy.yml', outils:['shell','lecture'] },
  { id:'ag-factu', nom:'Relance de factures', modele:'Claude Haiku 4.5',
    source:'jobs/relances/agent.py', outils:['bdd','mail'] },
  { id:'ag-crm', nom:'Enrichissement CRM', modele:'Claude Sonnet 4.5',
    source:'integrations/crm/agent.ts', outils:['web','bdd','paiement'] },
  { id:'ag-poste1', nom:'Claude Code · poste 1', modele:'Claude Opus 4.6',
    source:'~/.claude/settings.json', outils:['shell','lecture','web','bdd'] },
  { id:'ag-poste2', nom:'Claude Code · poste 2', modele:'Claude Sonnet 4.5',
    source:'~/.claude/settings.json', outils:['shell','lecture','web'] },
];

/* Les constats. Chacun cite un fichier ; aucune valeur de secret n'est
   recopiée — on donne l'emplacement, jamais la clé. */
export const CONSTATS = [
  { id:'c1', sev:'crit', agent:'ag-poste1', titre:'Validation des outils désactivée', ou:'~/.claude/settings.json',
    txt:"Le mode d'exécution sans confirmation est actif dans un fichier de réglages. L'agent exécute tout ce qu'il décide d'exécuter, sans qu'une personne ne voie passer la demande." },
  { id:'c2', sev:'crit', agent:'ag-crm', titre:"Clé d'API en clair dans une définition d'outil", ou:'integrations/crm/.mcp.json · ligne 12',
    txt:"Une clé est écrite en clair dans la déclaration du serveur d'outils, et le fichier est versionné. Elle est donc dans l'historique du dépôt, même si on l'enlève aujourd'hui. La valeur n'est pas recopiée dans ce rapport." },
  { id:'c3', sev:'haut', agent:'ag-deploy', titre:"Serveur d'outils tiers non épinglé", ou:'.github/workflows/agent-deploy.yml',
    txt:"Le serveur d'outils est récupéré en dernière version à chaque démarrage. Le code exécuté avec les droits de l'agent peut donc changer sans qu'aucune relecture n'ait lieu." },
  { id:'c4', sev:'haut', agent:'ag-poste2', titre:'Exécution shell sans restriction', ou:'~/.claude/settings.json',
    txt:"Toutes les commandes sont autorisées, sans liste blanche. Une suppression, un envoi réseau ou une lecture de secret passent au même titre qu'un simple ls." },
  { id:'c5', sev:'haut', agent:'ag-crm', titre:'API de paiement atteignable par un agent', ou:'integrations/crm/.mcp.json',
    txt:"Un agent d'enrichissement de données déclare un accès à l'API de paiement. Aucune règle ne restreint cet usage, et rien dans sa mission ne le justifie." },
  { id:'c6', sev:'moy', agent:null, titre:"Aucun journal d'activité", ou:'aucun fichier de configuration trouvé',
    txt:"Rien ne conserve ce que les agents ont fait. En cas d'incident, il n'y a pas de trace à relire : ni quels outils ont été appelés, ni avec quels arguments, ni quand." },
];

export const CIBLE = 'Dépôt interne · 2 postes de développement';
