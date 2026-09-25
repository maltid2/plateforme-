# Tableau de bord & rapport quotidien — Geometry Dow

Petit serveur Node.js **sans dépendance** qui lit les fichiers écrits par l'EA
`GeometryDow.mq5` et affiche :

- **En direct** : capital, résultat du jour, zones supply/demand M15 sur les bougies,
  la **check-list** (achat et vente) étape par étape, la position en cours, la courbe de capital,
  les derniers trades avec leur setup.
- **Rapports quotidiens** : chaque soir à **23:15 (heure de Paris)**, du lundi au vendredi,
  un bilan automatique est généré :
  - trades du jour, résultat en argent / points / R, capital ;
  - **audit des règles de la méthode** : stop jamais élargi, une seule position à la fois,
    nombre de trades maximum, pause de 2 h après une perte (pas de trade de vengeance) ;
  - garde-fous déclenchés dans la journée ;
  - bilan de la semaine et total (réussite, drawdown max) ;
  - un rappel de psychologie tiré du PDF, choisi selon la journée ;
  - un champ **journal de trading** pour noter ton ressenti (« tiens un journal »).

  Facultatif : le rapport peut aussi être envoyé sur **Telegram**.

## Essayer tout de suite (sans MetaTrader)

```bash
cd robot-geometry-dow/dashboard
npm run demo          # = node src/server.js --demo
```

Ouvre <http://127.0.0.1:8787>. Le mode démo fait tourner le backtester sur 6 semaines de
**cours simulés au hasard** (les résultats affichés ne disent rien de la méthode) et écrit
les fichiers exactement comme l'EA.

## Utilisation réelle

1. L'EA écrit (paramètre `InpExportDashboard = true`, activé par défaut) dans le dossier
   commun de MetaTrader : `%APPDATA%\MetaQuotes\Terminal\Common\Files\GeometryDow\`
   - `state.json` : état instantané, réécrit à chaque bougie M5 ;
   - `events.jsonl` : une ligne par événement (`start`, `open`, `trail`, `close`, `block`).
2. Sur la **même machine** que MetaTrader 5 :

   ```bash
   cd robot-geometry-dow\dashboard
   npm start
   ```

   Sous Windows le dossier de l'EA est trouvé automatiquement ; sinon définis `GD_DATA_DIR`.

| Variable | Rôle | Défaut |
|---|---|---|
| `GD_DATA_DIR` | dossier des fichiers de l'EA | dossier commun MT5 |
| `GD_PORT` | port HTTP | `8787` |
| `GD_HOST` | interface d'écoute | `127.0.0.1` (la machine seulement) |
| `GD_PASSWORD` | mot de passe (identifiant libre) | aucun — **obligatoire** si `GD_HOST` ≠ local |
| `GD_REPORT_TIME` | heure de Paris du rapport | `23:15` |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | envoi du rapport sur Telegram | désactivé |

Les rapports sont enregistrés dans `GeometryDow\reports\AAAA-MM-JJ.json` et `.txt`,
et les notes du journal dans `notes.json`. Le bouton **Recalculer** régénère un rapport
à tout moment.

### Recevoir le rapport sur Telegram (facultatif)

1. Dans Telegram, écris à **@BotFather** → `/newbot` → récupère le *token*.
2. Envoie un message à ton bot, puis ouvre
   `https://api.telegram.org/bot<TOKEN>/getUpdates` : le champ `chat.id` est ton `TELEGRAM_CHAT_ID`.
3. Lance le serveur avec les deux variables définies.

### Voir le tableau de bord depuis ton téléphone

Par défaut il n'est accessible que depuis la machine elle-même. Pour y accéder à distance,
le plus sûr est un tunnel privé (Tailscale, par exemple) plutôt qu'ouvrir un port.
Si tu exposes quand même le serveur (`GD_HOST=0.0.0.0`), `GD_PASSWORD` est obligatoire
et le serveur refuse de démarrer sans lui.

## Tests

```bash
npm test
```
