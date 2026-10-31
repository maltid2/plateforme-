# Fiche — Relire une PR de performance : ce qui prouve une amélioration, et ce qui ne la prouve pas

Piste : le projet et le développement (rotation du vendredi). Sujet : ce que tes agents ont livré. Lecture : 25 à 30 minutes. Pas de tutoriel : comment **juger** un diff et ses chiffres.

## 1. Ce qui s'est passé dans le projet, et pourquoi ça vaut un cours

Le **28 octobre 2026**, entre 10 h 08 et 10 h 10 UTC, trois PR d'agents ont été fusionnées dans `main` (liste des PR et historique du dépôt, lus le 2026-10-30) :
- **#45** (ATLAS) : migration Next 16 et React 19, pour corriger l'alerte critique sur Next.js.
- **#46** (SIMBA) : chargement « honnête » de l'audit, sans étapes simulées ni délai artificiel.
- **#50** (GHOST) : allègement des animations du hero (`.beam-frame` et `.headline-shine`).

La PR #50 cite explicitement la fiche n° 1 : « La fiche de cours de la PR #47 pointe `.beam-frame` (…) et `.headline-shine` (…) ; `.aurora` n'anime que `transform` avec un flou statique, donc peu coûteuse. J'ai vérifié par une mesure ». Ce qui vaut un cours : une PR de performance arrive toujours avec des **chiffres**. Savoir les lire, repérer ce qu'ils ne disent pas, et distinguer un *gain mesuré* d'un *gain supposé*, c'est ce qui te permet de fusionner en connaissance de cause.

## 2. Le mécanisme : lire le diff, puis lire les chiffres

### 2.1 Ce que le diff change (extraits authentiques de la PR #50, `globals.css`)

Avant, le cadre lumineux animait **une propriété personnalisée** qui servait d'angle au dégradé, et un pseudo-élément flouté le copiait :
```css
.beam-frame { background: conic-gradient(from var(--beam-angle, 0deg), …); animation: beam-spin 7s linear infinite; }
.beam-frame::before { background: inherit; filter: blur(22px); opacity: 0.45; }
@property --beam-angle { syntax: "<angle>"; … }
@keyframes beam-spin { to { --beam-angle: 360deg; } }
```
Après, le dégradé est **fixe**, porté par un pseudo-élément qui **tourne** :
```css
.beam-frame { isolation: isolate; overflow: hidden; … }
.beam-frame::before {
  position: absolute; z-index: -1; left: 50%; top: 50%;
  width: 250%; aspect-ratio: 1;
  background: conic-gradient(…);                       /* sans « from var(--beam-angle) » */
  transform: translate(-50%, -50%) rotate(0deg);
  will-change: transform;
  animation: beam-spin 7s linear infinite;
}
@keyframes beam-spin { to { transform: translate(-50%, -50%) rotate(360deg); } }
```
Et le reflet du titre ne boucle plus : `animation: shine 2.6s cubic-bezier(…) 0.9s 1 both;` (une seule passe, avec un état final fixe).

Mécanisme (fiche n° 1, §2) : le navigateur peint le dégradé **une fois** dans un calque ; ensuite le compositeur **fait tourner** ce calque sans le repeindre. Avant, chaque image changeait l'angle donc le **contenu** du dégradé, et il fallait repeindre (et reflouter) à chaque fois.

### 2.2 Trois détails de géométrie et de coût qui échappent à une lecture rapide

1. **Pourquoi `width: 250%`, `aspect-ratio: 1`, `overflow: hidden` ?** Un carré qui tourne autour du centre d'un rectangle doit le **couvrir à tout angle**. Pour un carré de côté *s* et un rectangle *l × h*, il faut que la distance du centre au coin le plus éloigné (la demi-diagonale) tienne dans le cercle inscrit du carré : ½·√(l² + h²) ≤ s/2, soit √(l² + h²) ≤ s. Avec *s* = 2,5·*l* : h ≤ l·√(2,5² − 1) ≈ **2,29·l**. La PR écrit « au-delà de 1,7× » pour la limite : sa valeur est plus prudente que ce calcul (ma dérivation, non vérifiée avec un rendu). `overflow: hidden` coupe ce qui dépasse du cadre.
2. **La taille du calque.** Le calque tournant est un carré de 2,5 fois la largeur du cadre. Pour un cadre de 512 pixels CSS de large (c'est ce que dit `max-w-lg` dans `AuditForm.tsx`, soit 32 rem à la taille de police par défaut ; `Hero.tsx` n'a pas la même contrainte), cela donne 1 280 × 1 280 pixels CSS, donc plusieurs millions de pixels à garder en mémoire graphique, selon la densité d'écran. C'est un **ordre de grandeur de mémoire à mesurer**, pas une mesure ; je n'ai pas mesuré, et je ne sais pas comment Chrome découpe ce calque en tuiles.
3. **`will-change: transform`.** MDN l'écrit : à utiliser « as a last resort » et à ne pas appliquer « to too many elements » (page lue le 2026-10-22). Ici il est posé **sur un seul élément** : c'est conforme.

### 2.3 Lire le tableau de mesures

Chiffres de la PR #50 (mesure Chromium sans interface, processeur ralenti six fois, six secondes sur la page d'accueil ; **une seule mesure par cas**, d'après la PR). Mes pourcentages sont recalculés à partir de ces valeurs :

| | Peintures (nombre / ms) | Image moyenne / p95 (ms) |
|---|---|---|
| Ordinateur, avant | 356 / 235 | 83,7 / 133,4 |
| Ordinateur, après | 158 / 82 | 77,3 / 150,0 |
| Mobile, avant | 795 / 497 | 37,9 / 66,6 |
| Mobile, après | 390 / 164 | 30,7 / 50,1 |

| Variation | Ordinateur | Mobile |
|---|---|---|
| nombre de peintures | −55,6 % | −50,9 % |
| temps de peinture | −65,1 % | −67,0 % |
| temps d'image moyen | −7,6 % | −19,0 % |
| p95 du temps d'image | **+12,4 %** | −24,8 % |

Lecture :
- **Ce que les chiffres prouvent :** le **coût de peinture** a nettement baissé, dans la mesure effectuée. C'est exactement ce que la théorie (fiche n° 1) prévoit.
- **Ce qu'ils ne prouvent pas :** une amélioration du **temps d'image sur ordinateur**. La moyenne gagne 7,6 %, mais le p95 (les images les plus lentes) **monte** de 12,4 %. La PR parle de « bruit de mesure », ce qui est une **hypothèse** : avec une seule mesure par cas, on ne peut pas savoir si 133 → 150 ms est du bruit. Il faudrait **répéter** (au moins cinq fois) et comparer les plages.
- **Une valeur à interroger :** les « tâches de rastérisation » passent de 961 ms et 1 143 ms à **0** exactement (tableau de la PR). Un zéro parfait peut être réel (plus de repeinte) ou un artefact de la mesure (par exemple une autre catégorie de tâche, ou un rendu logiciel qui rastérise ailleurs). À demander à l'agent.
- **Ce que la mesure ne couvre pas** (la PR le dit) : un vrai appareil, un GPU, plusieurs répétitions, Safari et Firefox. Le **reste du coût** vient d'autres éléments (le canvas `NetworkBackground`, etc.), non traités.

### 2.4 Ce que la PR change pour le visiteur (décisions de produit, pas de technique)
- Le **halo flou** autour du cadre est « un peu moins diffus » : le pseudo-élément flouté est supprimé, il ne reste que le `box-shadow` fixe.
- Le **reflet du titre** ne boucle plus : « choix assumé, à valider » (PR). C'est à **toi** de dire si le produit l'accepte.
- `prefers-reduced-motion` : la règle globale qui coupe les animations reste dans le fichier (non modifiée par la PR). Je ne l'ai pas testée dans un navigateur.

## 3. La lecture du réel : PR #45 vérifiée dans le dépôt

La PR #45 promettait de corriger l'alerte critique sur Next. Vérification à partir du `package-lock.json` de `main` (lu le 2026-10-30) :
```
next 16.4.2   react 19.3.1   react-dom 19.3.1   sharp 0.35.5   (139 paquets dans le verrou)
```
Interrogation de l'API d'avis npm avec ces 139 paquets : **aucun avis pour `next`, `react` ni `react-dom`** ; 2 avis restent :

| Paquet | Version | Avis | Où |
|---|---|---|---|
| `source-map-js` | 1.2.1 | « event-loop denial of service through indexed source-map sections » (gravité high, plage `>=1.0.0 <1.2.2`) | tiré par le `postcss` embarqué dans `next` |
| `postcss-selector-parser` | 6.1.4 | « Quadratic complexity in flat selector parsing » (moderate, plage `<6.1.5`) | chaîne de développement de Tailwind |

Lecture : le **but déclaré** de #45 est atteint (les trois avis critiques sur Next ne concernent plus la version installée : 16.4.2 dépasse 16.4.1 et 16.3.3). Les deux avis restants sont **hors périmètre** de la PR (qui le disait) et leur applicabilité n'est pas établie ici. Les scripts `dev` et `build` utilisent `--webpack` (le guide Next 16 lu prévoit cette option pour qui garde une configuration webpack ; la PR dit que Turbopack ne charge pas `__non_webpack_require__`, ce que je n'ai pas testé). Point ouvert : Node en production (issue #51) ; le minimum de Next 16 est Node 20.9.

## 4. Ce qui casse, et le symptôme

| Défaut d'une PR de performance | Symptôme | Comment le repérer en relecture |
|---|---|---|
| Un seul échantillon présenté comme un gain | un chiffre « meilleur » qui ne se reproduit pas | y a-t-il plusieurs répétitions, une plage, une variance ? |
| Moyenne qui s'améliore, p95 qui se dégrade | ressenti « saccadé » malgré un bon score moyen | regarder **aussi** le percentile haut |
| Gain sur une métrique qui n'est pas celle du ressenti | la page « semble » aussi lente | la métrique est-elle liée à ce que voit l'utilisateur (images saccadées) ou à un détail interne ? |
| Mesure sur un environnement artificiel | écart entre le test et la production | rendu logiciel, processeur ralenti, pas de GPU : les valeurs sont **relatives** |
| Calque très grand pour une animation | mémoire graphique élevée sur mobile | taille et nombre de calques promus (`will-change`) |
| Changement visuel non signalé | halo, reflet, ombres différents | la PR liste-t-elle les écarts de rendu ? (ici oui) |
| Régression de comportement non testée | contenu coupé (`overflow: hidden`), cadre mal couvert | la PR liste-t-elle les cas limites ? (ici oui, en partie) |

## 5. Vocabulaire du jour (12 termes)

| Français | Anglais | Définition exacte / piège |
|---|---|---|
| repeinture | *repaint* | recalcul des pixels d'un élément ; coûteux sur le fil principal |
| composition | *compositing* | assemblage de calques déjà peints, fait par le compositeur |
| calque | *layer* | surface peinte puis déplacée, tournée ou fondue sans repeinture |
| rastérisation | *rasterization* | conversion d'instructions de dessin en pixels |
| promotion de calque | *layer promotion* | décision de donner un calque à un élément (ex. `will-change`) |
| percentile 95 (p95) | *95th percentile* | valeur sous laquelle se situent 95 % des mesures : les « pires » images |
| bruit de mesure | *measurement noise* | variation entre deux mesures identiques ; sans répétitions on ne le connaît pas |
| répétabilité | *repeatability* | capacité à retrouver le même résultat en refaisant la mesure |
| processeur ralenti | *CPU throttling* | simulation d'un appareil plus lent (ici ×6) |
| rendu logiciel | *software rendering* | dessin par le processeur au lieu du GPU ; valeurs différentes d'un vrai appareil |
| régression | *regression* | dégradation introduite par un changement. Faux ami : « regression » n'est pas « régression » statistique |
| compromis | *trade-off* | ce qu'on perd pour gagner autre chose (ici le halo plus diffus) |

Approximations courantes : « c'est plus rapide » sans dire **quelle métrique** ; « ça a baissé de 55 % » sans dire de **quoi** (nombre de peintures ou temps d'image) ; « dans le bruit » sans répétitions.

## 6. Comment le dire juste

**Pour un collègue :** « Le coût de peinture a baissé d'environ moitié et les deux tiers en temps, mais le temps d'image du desktop ne s'améliore pas clairement : une seule mesure, p95 à la hausse. Je fusionne, je demande des répétitions. »

**Pour l'auteur de la PR / un prestataire** (FR puis EN) :
- FR : « Pouvez-vous répéter la mesure au moins cinq fois et donner les plages ? Sur ordinateur le p95 passe de 133,4 à 150 ms : est-ce du bruit ? Et pourquoi les tâches de rastérisation tombent-elles à exactement zéro ? »
- EN: "Could you repeat the measurement at least five times and report the ranges? On desktop the p95 goes from 133.4 to 150 ms: is that noise? And why do the rasterization tasks drop to exactly zero?"

**Dans un ticket** (FR puis EN) :
- FR : « Constat : la peinture baisse de 51 à 56 % en nombre et de 65 à 67 % en temps (mesure unique, rendu logiciel, processeur ralenti ×6). Non démontré : le temps d'image sur ordinateur. À faire : répéter la mesure, vérifier sur un vrai appareil. Décision produit : reflet du titre joué une seule fois. »
- EN: "Finding: paint count drops 51–56% and paint time 65–67% (single run, software rendering, CPU slowed ×6). Not demonstrated: desktop frame time. To do: repeat the measurement, check on a real device. Product decision: title shine plays once."

## 7. Exercice de relecture (20 à 30 minutes, **sur ton propre site et dans ton laboratoire**)

1. Recalcule les huit pourcentages du tableau §2.3 à partir des valeurs brutes. Retrouves-tu ceux de la PR (« ≈ −55 % », « −65 à −70 % »)?
2. Un cadre fait 520 pixels de large et 1 100 de haut. Le calque tournant est-il suffisant d'après la condition §2.2 (h ≤ 2,29·l) ? Et pour 520 × 1 300 ?
3. Écris en trois lignes un **protocole de mesure** que tu demanderais pour valider la PR : combien de répétitions, quelles métriques, quel appareil, quel critère de réussite.
4. Dans ton navigateur, sur ton propre site, ouvre les outils de développement → panneau « Rendering », coche « Paint flashing » et observe le cadre lumineux (le cadre doit ne plus clignoter en vert en continu si la PR agit comme décrit) : note ce que tu vois. Je n'ai pas fait cette observation : c'est la **vérification indépendante** de la PR.

<details>
<summary>Solution</summary>

1. Peintures : 356 → 158 = −55,6 % ; 795 → 390 = −50,9 %. Temps de peinture : 235 → 82 = −65,1 % ; 497 → 164 = −67,0 %. Image moyenne : −7,6 % (ordinateur), −19,0 % (mobile). p95 : +12,4 % (ordinateur), −24,8 % (mobile). Les pourcentages de la PR sont cohérents ; « ≈ −55 % du nombre de peintures » est vrai sur ordinateur (−51 % sur mobile).
2. Pour 520 × 1 100 : diagonale = √(520² + 1100²) ≈ 1 217 ; le carré mesure 2,5 × 520 = 1 300 ≥ 1 217 : suffisant. Pour 520 × 1 300 : diagonale ≈ 1 400 > 1 300 : insuffisant, les coins peuvent ne plus être couverts à certains angles.
3. Exemple : ≥ 5 répétitions par cas ; relever peintures, temps de peinture, p95 et moyenne du temps d'image ; un téléphone réel de gamme moyenne, avec et sans la PR ; critère : p95 inférieur ou égal à l'avant sur toute la plage de mesures, et nombre de peintures en baisse.
4. Attendu (non vérifié par moi) : plus de clignotement vert permanent sur le cadre ; le reflet du titre ne clignote qu'au chargement.
</details>

## 8. Révision espacée

Fiche de la veille (2026-10-29, enchaînement PHP / noyau Linux) et fiche d'il y a sept jours (2026-10-23, avis de dépendance).

1. (29 octobre) Pourquoi une faille « locale » peut-elle être critique sur un serveur web ?
2. (23 octobre) Pourquoi `npm update` ne corrigeait-il pas Next 14.2.35 ?
3. (23 octobre) Distingue gravité, exploitation et applicabilité.

<details>
<summary>Réponses</summary>

1. Parce qu'un premier maillon (exécution de code à distance dans un service) fournit l'accès local peu privilégié que la faille exige, et la seconde donne alors root.
2. La plage `^14.2.35` ne franchit pas le majeur et les correctifs n'étaient listés que pour les branches 15 et 16 (la PR #45 a changé la plage vers `^16.4.2`).
3. Gravité : le score. Exploitation : catalogue CISA ou déclaration de l'éditeur. Applicabilité : les conditions de l'avis face à ta configuration.
</details>

## 9. Trois questions de contrôle

1. Pourquoi faire tourner un calque par `transform` coûte-t-il moins cher que d'animer l'angle d'un dégradé ?
2. Que ne démontre pas un tableau avec une seule mesure par cas ?
3. Pourquoi un p95 qui monte alors que la moyenne baisse mérite-t-il une question ?

<details>
<summary>Réponses</summary>

1. Le calque est peint une fois ; le compositeur le tourne ensuite sans repeindre. Animer l'angle change le contenu et force une repeinture à chaque image.
2. On ne sait pas distinguer un gain réel du bruit de mesure : il faut des répétitions et des plages.
3. Parce que le p95 représente les images les plus lentes, celles que l'utilisateur ressent comme des saccades ; la moyenne peut masquer une dégradation de ces images.
</details>

## 10. Sources (consultées le 2026-10-30)

- Dépôt `maltid2/plateforme-` : PR #45, #46, #50 (descriptions et diff lus), historique de `main` (commits `88da139`, `dbfa3a7`, `ab07f96`), `sentinelscope/app/globals.css`, `package.json` et `package-lock.json` sur `main`.
- API d'avis npm (bulk) : https://registry.npmjs.org/-/npm/v1/security/advisories/bulk — interrogée avec les 139 paquets du verrou.
- Next.js, guide de migration vers la version 16 : https://nextjs.org/docs/app/guides/upgrading/version-16 — Node.js 20.9 minimum, option `--webpack`.
- MDN, `will-change` : https://developer.mozilla.org/en-US/docs/Web/CSS/will-change (lue le 2026-10-22) ; fiche n° 1 de ce dossier pour le pipeline de rendu.
- Non vérifié par moi : les chiffres de la PR #50 (mesure de l'agent, non reproduite) ; le rendu dans un navigateur ; la taille mémoire du calque ; ma dérivation géométrique (calcul, pas essai).
