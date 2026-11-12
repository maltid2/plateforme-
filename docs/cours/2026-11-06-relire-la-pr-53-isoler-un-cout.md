# Fiche — Relire la PR #53 : isoler un coût de rendu, et lire ce qu'une PR déclare ne pas avoir vérifié

Piste : le projet et le développement (rotation du vendredi). Lecture + exercice : 25 à 30 minutes. Suite de la fiche du 30 octobre (PR #50) : là, tu as appris à lire un tableau avant/après ; ici, tu lis une PR **mieux documentée** et tu cherches **ce qui reste à vérifier**. Matière : la PR #53 de GHOST, fusionnée le 3 novembre (`59f840a`), que j'ai lue en entier (description et diff) le 2026-11-06.

## 1. Pourquoi ce mécanisme

Tes agents livrent des PR de performance. Une PR de performance peut être **juste** (le gain est réel) tout en cachant un effet de bord. Ton rôle de relecteur : (1) vérifier que la **cause** désignée est bien celle qui a été mesurée ; (2) lire la section « contrôles non effectués » comme une liste de choses à regarder toi-même ; (3) repérer les **couplages cachés** que le diff introduit.

## 2. Le mécanisme, pas à pas

### 2.1 Ce que la PR affirme (extraits de sa description)
- **Constat** : « après la PR #52 », bugs et lenteur au défilement et à l'ouverture du pop-up de résultat. Mesure sur `main` : Chromium sans interface, **processeur ralenti ×4**, **rendu logiciel**, « valeurs **relatives** ».
- **Méthode de recherche de la cause : le retrait.** « Découpage par retrait d'éléments » : on enlève une chose à la fois et on regarde ce qui change. Pop-up : 12,9 → 30,6 images/s sans `backdrop-filter`. Canvas : 39 → 58 images/s sans lui.
- **Correctif** : retirer les `backdrop-blur*`, intégrer l'opacité au dessin du canvas, remplacer des masques par un calque de fondu fixe, figer la page et mettre le fond en pause quand un pop-up est ouvert.

### 2.2 Pourquoi ces choses coûtent cher (mécanisme du navigateur)
Rappel de la fiche n° 1 : le navigateur enchaîne style → mise en page → peinture → composition. Trois éléments de cette PR forcent un travail **à chaque image** :
1. **`backdrop-filter` (flou d'arrière-plan)** : pour flouter ce qui est *derrière* un élément, le navigateur doit relire l'image de tout ce qui est dessous, la flouter, puis la combiner. Si dessous il y a un canvas qui s'anime, il refait cela à chaque image. La PR le dit pour le voile du pop-up : il « floutait toute la page, canvas animé compris ».
2. **`mask-image` et opacité sur un canvas animé** : la PR écrit que le masque et la transparence sont « recomposés à chaque image ». Le correctif remplace le masque par un **calque de fondu fixe** par-dessus, et l'opacité par `ctx.globalAlpha` **dans le dessin**.
3. **Un canvas qui redessine derrière un pop-up** : travail inutile, car on ne le voit plus.

### 2.3 Le diff, extrait par extrait (diff réel de `59f840a`)

**(a) Le pop-up fige la page et met le fond en pause** (`AuditForm.tsx`) :
```tsx
useEffect(() => {
  if (!consentOpen && !contactOpen) return;
  const b = document.body;
  const prev = b.style.overflow;
  b.classList.add("modal-open");
  b.style.overflow = "hidden";
  return () => { b.classList.remove("modal-open"); b.style.overflow = prev; };
}, [consentOpen, contactOpen]);
```
- La fonction renvoyée est le **nettoyage** de l'effet : elle restaure l'état quand l'un des deux pop-up se ferme ou quand le composant disparaît. Lecture : bonne pratique, la restauration est symétrique.
- `prev` mémorise l'ancienne valeur de `overflow` pour la restaurer exactement.

**(b) Le canvas lit ce signal** (`NetworkBackground.tsx`) :
```tsx
const step = (t: number) => {
  // Rien à dessiner pendant qu'un pop-up est ouvert.
  if (!document.body.classList.contains("modal-open") && t - lastDraw >= FRAME_MS) { ... draw(); }
  raf = requestAnimationFrame(step);
};
```
- La boucle `requestAnimationFrame` **continue de tourner** ; seule la partie coûteuse (déplacer les nœuds et dessiner) est sautée. Conséquence : quand la classe est retirée, l'animation **reprend toute seule**, sans code de relance. La PR le vérifie : « fermé : … canvas à nouveau animé ».
- **Couplage caché** : `AuditForm` et `NetworkBackground` ne s'importent pas ; ils communiquent par une **classe CSS sur `<body>`** (`modal-open`). Pas un défaut en soi, mais une dépendance invisible : si on renomme la classe d'un côté, l'autre ne casse pas bruyamment, il cesse simplement de se mettre en pause. J'ai cherché la chaîne `modal-open` dans `main` : deux occurrences utiles dans le code (l'ajout/retrait dans `AuditForm.tsx`, la lecture dans `NetworkBackground.tsx`), **aucune règle CSS**.

**(c) L'opacité entre dans le dessin** :
```tsx
ctx.globalAlpha = opacity;   // dans draw()
...
}, [density, staticRender, opacity]);   // l'effet dépend maintenant de `opacity`
```
`opacity` est dans la liste de dépendances : si la valeur change, l'effet est **relancé** (réinitialisation du canvas). Ici la valeur est constante par composant, donc sans effet visible ; mais c'est le genre de détail à repérer.

**(d) Le fondu vers le noir** (`Hero.tsx`) :
```tsx
<NetworkBackground className="absolute inset-0 h-full w-full" density={0.00016} opacity={0.8} />
<div className="absolute inset-0 bg-[radial-gradient(130%_110%_at_68%_38%,transparent_50%,#07090D_85%)]" />
```
Le masque (qui rendait les bords transparents) est remplacé par un calque **plein couleur `#07090D`** qui masque les bords. Pour que cela ressemble au rendu d'avant, ce calque doit avoir **la même couleur que le fond de la page**. Je l'ai vérifié : `tailwind.config.ts` définit `bg: "#07090D"` et `globals.css` définit `--bg: #07090d` : même couleur. La PR le signale elle-même comme risque (§8) : une couleur écrite **en dur** à trois endroits.

### 2.4 Lire les chiffres (recalculés par moi à partir de la description)
| | Avant | Après | Variation |
|---|---|---|---|
| Ouverture du pop-up, ordinateur | 12,9 images/s (p95 100 ms) | 57,6 à 58,8 images/s (p95 17 ms) | environ ×4,5 |
| Défilement, ordinateur | 39 à 45 images/s (p95 33–50 ms) | 58,5 à 58,6 images/s (p95 17 ms) | environ +30 % à +50 % |
| Mobile émulé, défilement | 58 à 59 images/s | 58,5 à 58,6 images/s | inchangé |
Ce que le tableau dit bien : **le gain est sur ordinateur**, et il est important. Sur mobile émulé il n'y avait presque rien à gagner. Notes de lecture : (1) 58–59 images/s est proche du plafond de 60 : on a rejoint la limite d'affichage ; (2) l'ordre de grandeur du p95 (100 ms → 17 ms) compte plus que la moyenne pour la sensation de saccade ; (3) la PR avertit : « seule la comparaison avant/après est fiable, pas les valeurs absolues. Une seule série de mesures par état. »

## 3. Lecture du réel : la section « contrôles non effectués » (§7 de la PR)

Cette section est **la plus utile pour toi**. La PR liste ce qu'elle n'a pas fait :
- « Appareil réel, GPU, Safari/Firefox » : la mesure est en **rendu logiciel** sans GPU. Un GPU réel fait le flou plus vite : le gain constaté sur un vrai poste peut être **plus petit** (je ne l'ai pas mesuré).
- « Lint (aucune config ESLint) » : pas de contrôle automatique de style.
- « Piège de focus du pop-up de contact : non modifié, non vérifié ».
- « Parcours d'audit réel complet (réponse simulée seulement) ».
- « Les pages légales perdent aussi leur flou d'en-tête : non capturées » : `LegalShell.tsx` est modifié mais non vérifié visuellement. (Pages légales : à ne pas toucher par MINERVE ; la remarque est pour ta relecture.)
- Honnêteté de la PR : elle écrit « Gain de conversion : aucun, non mesuré ». Bon réflexe : une PR de performance **ne promet pas** de ventes.

## 4. Ce qui casse, symptôme, remontée

| Risque | Symptôme possible | Comment vérifier |
|---|---|---|
| **Décalage de mise en page à l'ouverture du pop-up** (hypothèse de ma part, non testée) : `body { overflow: hidden }` fait disparaître la barre de défilement | Sur un ordinateur, la page « saute » de quelques pixels quand le pop-up s'ouvre | `globals.css` définit une barre de défilement **stylée** de 10 px de large (`::-webkit-scrollbar`). Cette barre occupe de la place sur un vrai navigateur de bureau, contrairement à de nombreux navigateurs sans interface qui utilisent des barres superposées. Observer sur un navigateur de bureau réel (exercice §7). |
| Rendu moins estompé sous la barre de navigation | Texte qui défile plus visible sous la barre (fond à 90 % d'opacité) | Déclaré par la PR (§8) |
| Couleur du fondu en dur | Un jour, le fond change et des bords du Hero ont un liseré | Chercher `#07090D` dans le dépôt |
| Classe `modal-open` renommée d'un côté | Le fond ne se met plus en pause pendant les pop-up : régression silencieuse de performance | Chercher la chaîne des deux côtés |
| Piège de focus (non vérifié) | Au clavier, le focus peut sortir du pop-up | Navigation au Tab dans le pop-up |

**Piège de raisonnement :** « tests OK + captures comparables » ne dit rien de ces risques : ce sont des **contrôles non effectués**, et la PR le dit.

## 5. Vocabulaire (FR / EN)

| FR | EN | Définition, piège |
|---|---|---|
| flou d'arrière-plan | *backdrop filter / backdrop blur* | flou de ce qui est derrière un élément ; **piège :** ≠ `filter: blur` (flou de l'élément lui-même) |
| masque | *mask (mask-image)* | rend certaines zones transparentes |
| composition | *compositing* | assemblage final des calques |
| images par seconde | *frames per second (fps)* | **piège :** *frame* = image affichée, pas « cadre » |
| 95e centile | *95th percentile (p95)* | 95 % des images sont plus rapides que cette valeur |
| rendu logiciel | *software rendering* | calcul par le processeur, sans GPU |
| sans interface | *headless* | navigateur sans fenêtre, pour les tests |
| valeur relative / absolue | *relative / absolute value* | ici : seul l'écart avant/après est fiable |
| effet (React) | *effect (useEffect)* | code lancé après le rendu ; **piège :** pas un « effet visuel » |
| nettoyage d'effet | *effect cleanup* | fonction renvoyée, exécutée à la fermeture |
| liste de dépendances | *dependency array* | valeurs dont le changement relance l'effet |
| couplage | *coupling* | dépendance entre deux parties du code |
| retour arrière | *rollback / revert* | annuler un changement |
| régression | *regression* | une chose qui marchait cesse de marcher |
| faux ami : *to revert* | = annuler un commit | pas « revenir » |

## 6. Comment le dire juste

**À un collègue (FR) :** « La PR #53 enlève les flous d'arrière-plan et met le canvas en pause pendant les pop-up. Le gain annoncé est sur ordinateur, mesuré en rendu logiciel sans GPU, une seule série. Je vérifie sur un vrai navigateur que la page ne saute pas quand la barre de défilement disparaît. »

**À ton agent / à GHOST (FR + EN) :**
- FR : « Peux-tu confirmer que l'ouverture du pop-up ne décale pas la mise en page sur un navigateur de bureau avec barre de défilement visible ? Cas non couvert par la PR #53. »
- EN: "Can you confirm that opening the pop-up does not shift the layout on a desktop browser with a visible scrollbar? This case is not covered by PR #53."

**Dans un commentaire de PR / ticket (FR + EN) :**
- FR : « PR #53 : gain mesuré (pop-up 12,9 → ~58 images/s, rendu logiciel, une série). Point à contrôler : `body { overflow: hidden }` avec barre stylée de 10 px (`globals.css`) peut décaler la page à l'ouverture. Non couvert par la PR. »
- EN: "PR #53: measured gain (pop-up 12.9 → ~58 fps, software rendering, single run). To check: `body { overflow: hidden }` with a 10 px styled scrollbar (`globals.css`) may shift the page on open. Not covered by the PR."

## 7. Exercice d'observation (20 à 30 minutes, sur **ton propre produit**)

Il s'agit de ton propre site SentinelScope (déploiement de prévisualisation ou local), pas d'un site tiers.
1. Ouvre la page d'accueil dans un navigateur **de bureau** (fenêtre visible, barre de défilement visible). Lance un audit pour faire apparaître le pop-up de consentement.
2. **Hypothèse à écrire d'abord :** « le contenu de la page se décale-t-il horizontalement quand le pop-up s'ouvre ? » Regarde le bord droit et le centre du titre.
3. Ferme le pop-up. La page revient-elle exactement où elle était ? Le défilement est-il restauré ?
4. Outils de développement → **Rendering** → active **Paint flashing** : pendant que le pop-up est ouvert, les zones de la page derrière se repeignent-elles encore ? Compare avec la page sans pop-up.
5. Avec la touche **Tab**, le focus reste-t-il dans le pop-up ?
6. Écris la phrase de commentaire de PR (§6) avec **ce que tu as vu**.

<details><summary>Solution</summary>

Il n'y a pas de réponse imposée : c'est une observation. Ce que tu dois pouvoir dire : (a) décalage oui/non, et de combien environ ; (b) si la page revient bien à sa position ; (c) si le fond se repeint pendant le pop-up (il ne devrait plus s'animer) ; (d) si le focus sort du pop-up (cas que la PR dit ne pas avoir vérifié). Je n'ai pas fait cette observation : mon hypothèse du décalage vient de la lecture de `globals.css`, pas d'un test.
</details>

## 8. Révision espacée

**D'hier (fiche du 2026-11-05, WordPress, TOCTOU) :**
1. Qu'est-ce qu'un TOCTOU, et quel est « l'intervalle » dans la faille WordPress ?
2. Cite deux des trois changements du correctif 7.1.4.
3. Pourquoi une liste d'exclusion est-elle moins robuste qu'une liste d'inclusion ?

**D'il y a 7 jours (fiche du 2026-10-30, PR de performance #50) :**
1. Pourquoi une mesure unique ne prouve-t-elle pas une amélioration ?
2. Pourquoi `transform` et `opacity` sont-ils moins coûteux à animer que `left`/`top` ?
3. Pourquoi `will-change` doit-il rester rare ?

<details><summary>Réponses</summary>

D'hier : (1) L'état change entre la vérification et l'usage ; ici entre la décompression du paquet dans un dossier accessible par le web et sa recopie sur le site. (2) Nom du dossier de travail aléatoire ; `index.php` contre le listage ; `wp-config.php` jamais recopié. (3) On doit penser à tout ce qui est dangereux ; une liste d'inclusion ne laisse passer que le prévu.
Du 30 : (1) Le bruit d'une mesure peut égaler l'écart. (2) Ils peuvent être traités par le compositeur sans repeindre ni recalculer la mise en page. (3) Il réserve de la mémoire ; MDN : dernier recours.
</details>

## 9. Trois questions de contrôle

1. Pourquoi un `backdrop-filter` devant un canvas animé coûte-t-il cher à chaque image ?
2. Comment `AuditForm` et `NetworkBackground` communiquent-ils, et quel est le risque de ce choix ?
3. Cite deux « contrôles non effectués » de la PR et ce que chacun pourrait cacher.

<details><summary>Réponses</summary>

1. Le navigateur doit relire ce qui est derrière, le flouter et le recomposer à chaque image, canvas compris. 2. Par la classe `modal-open` sur `body` ; si elle est renommée d'un côté, le fond ne se met plus en pause, sans erreur. 3. Par exemple : « appareil réel, GPU » (le gain peut être plus petit hors rendu logiciel) ; « piège de focus » (accessibilité au clavier non vérifiée).
</details>

## 10. Sources (consultées le 2026-11-06)

- PR #53 (description et métadonnées, lues via l'API GitHub) : https://github.com/maltid2/plateforme-/pull/53 ; commit `59f840a` dans `main` (diff lu en entier avec `git show`).
- Fichiers de `main` lus : `sentinelscope/components/AuditForm.tsx`, `NetworkBackground.tsx`, `Hero.tsx`, `sentinelscope/app/globals.css`, `sentinelscope/tailwind.config.ts`.
- Résultat de recherche dans le dépôt : `modal-open` (2 occurrences de code, 0 règle CSS) ; la règle `.glass` de `globals.css` (qui contient un `backdrop-filter`) n'est utilisée dans aucun composant d'après ma recherche (code mort, sans coût d'exécution).
- **Non vérifié :** tous les chiffres de performance sont ceux de la PR (je n'ai rien mesuré) ; l'hypothèse du décalage de mise en page ; le comportement sur GPU, Safari et Firefox.
