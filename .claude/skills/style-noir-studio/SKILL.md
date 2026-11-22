---
name: style-noir-studio
description: Style visuel « Noir studio », appris du site d'une agence de création 3D (530°, page Works) — noir pur, typographie large en majuscules gris clair, aucun décor (ni bordure, ni arrondi, ni ombre), grille stricte, beaucoup de vide, le contenu porte la couleur. Utiliser quand on demande une interface « haut de gamme », « style agence », « minimaliste noir », « comme 530 », « style studio », ou pour habiller une page, un tableau de bord, une galerie, un portfolio ou un outil interne (dont la carte réseau) dans cet esprit. Ne pas utiliser pour un document imprimable (le style est fait pour l'écran).
user-invocable: true
argument-hint: "[page ou composant à habiller]"
metadata:
  source: "https://530degres.agency/works/ — observé le 22/11/2026 (rendu réel + styles calculés)"
  version: "1.1.0"
---

# Style « Noir studio »

Appris en observant le site d'une agence de design 3D (530°, page *Works* et
une page projet) dans un vrai navigateur : captures d'écran, styles
calculés au repos **et pendant les interactions** (survol, clic, défilement). L'idée : le
haut de gamme vient de **la retenue**. Moins d'éléments, mieux alignés, et le
contenu (images, données, câbles…) apporte seul la couleur.

## Ce qu'on a observé (les faits)

| Élément | Valeur relevée |
| --- | --- |
| Fond | `#000000`, pur, sans dégradé, sans grain, sans halo |
| Texte du menu | police large *GraphikWide-Regular*, 14 px, poids 400, interligne 16,8 px, gris `#BFBFBF` (rgb 191,191,191) |
| Casse | MAJUSCULES pour le menu (WORKS · R&D · ABOUT) et les titres de projets |
| Menu | logo à gauche, 3 liens seulement, centrés et très espacés, barre fixe en haut, sans fond ni filet |
| Projets | vignettes **toutes de même taille**, au format portrait, en grille de **10 colonnes** sur 1440 px, gouttières larges (≈ 65 px horizontalement, ≈ 65 px verticalement) |
| Décor des vignettes | aucun : ni bordure, ni arrondi, ni ombre, ni légende visible au repos ; le titre apparaît au survol, posé sur l'image |
| Accueil | une vidéo plein écran, le menu par-dessus, rien d'autre |
| Couleur | uniquement dans les visuels ; l'interface reste noir, gris et blanc |

## Les interactions observées (mesurées)

| Interaction | Ce qui se passe | Valeurs relevées |
| --- | --- | --- |
| Curseur | une **croix** remplace la flèche partout | image 28 × 28 px, point actif au centre (`14 14`) |
| Survol d'une vignette | l'**image s'efface**, le **titre apparaît à sa place** (petit, majuscules, gris clair) et suit légèrement la souris | titre 10 px, `#BFBFBF`, `opacity 0 → 1` en `0.4s ease-out` ; image `opacity 0.3s ease-out`, `transform 0.4s ease-out` |
| Vignettes | des **vidéos courtes muettes en boucle**, toutes en lecture en même temps : la grille « respire » sans qu'on touche à rien | `<video autoplay muted loop playsinline>` |
| Mouvement de la vignette | apparition / déplacement doux, rapide au début, très lent à la fin | `transform, opacity 0.5s cubic-bezier(0.165, 0.84, 0.44, 1)` (« ease-out-quart ») |
| Menu | gris au repos, **blanc au survol**, rien d'autre (ni fond, ni soulignement animé) | `#BFBFBF → #FFFFFF` |
| Fond de page | change de couleur en douceur d'une page à l'autre | `background-color 0.3s` |
| Défilement | la page Works **tient en un seul écran** (aucun défilement) : tout se voit d'un coup | hauteur de page = hauteur de fenêtre |
| Clic sur un projet | page projet : **titre à gauche** (28 px, majuscules, sur 2 lignes), **année tout à droite**, court texte en casse normale ; puis les médias en **grand, bord à bord, 2 colonnes sans gouttière**, la première décalée à droite (composition asymétrique), vidéos en lecture auto | texte 28 px `#BFBFBF` |

## Les principes (ce qu'il faut en retenir)

1. **Noir pur, partout.** `#000` pour le fond, les panneaux, les fenêtres. On
   sépare les zones par un **filet** (1 px, blanc à 14-22 % d'opacité), jamais
   par des fonds de couleurs différentes.
2. **Une seule voix typographique.** Une police sans empattement, large si
   possible ; petite (11-14 px) ; poids 400 ; **MAJUSCULES espacées**
   (`letter-spacing` 0,07-0,12 em) pour tout ce qui est interface : menus,
   onglets, boutons, titres de section, en-têtes de tableau. Le texte saisi
   et les données restent en casse normale.
3. **Gris au repos, blanc à l'action.** Texte d'interface `#BFBFBF` / `#8C8C8C`,
   blanc `#FFF` au survol ou quand c'est actif. L'élément actif est
   **souligné** (filet fin décalé), pas surligné d'un fond.
4. **Zéro décor.** `border-radius: 0`, aucune `box-shadow`, aucun dégradé,
   aucune « carte » autour d'un bloc. Un champ de saisie = un trait en dessous.
5. **La grille fait l'ordre.** Éléments de même taille, alignés sur des
   colonnes régulières, avec de **grandes gouttières**. Le vide est voulu :
   ne pas le remplir.
6. **Le contenu porte la couleur.** L'interface est monochrome ; seules les
   données (images, couleurs des câbles, types d'équipements…) sont en
   couleur. On ne rajoute pas de couleur d'accent à l'interface.
7. **Le détail vient à l'interaction.** Les légendes et titres secondaires
   n'apparaissent qu'au survol ou en zoomant ; au repos, la page reste nue.
8. **Le mouvement est doux et court.** Une seule courbe pour tout le site
   (ease-out-quart), 0,3 à 0,5 s ; on anime l'opacité et la position, jamais
   les couleurs criardes ni les rebonds.
9. **Le survol échange, il ne décore pas.** Au survol, une chose disparaît
   (l'image) pour en révéler une autre (le titre) ; pas d'ombre, pas de zoom
   exagéré, pas de cadre qui s'allume.
10. **Un curseur signature.** Une croix fine, comme un viseur : c'est le seul
   « ornement » du site.
11. **Une seule action principale.** Le bouton principal est le seul élément
   plein : fond blanc, texte noir. Tous les autres boutons sont du texte.

## Jetons prêts à l'emploi

```css
:root, .theme-studio {
  --bg: #000;            /* fond, panneaux, fenêtres */
  --encre: #e8e8e8;      /* texte principal */
  --repos: #bfbfbf;      /* interface au repos */
  --sourd: #8c8c8c;      /* texte secondaire, aides */
  --filet: rgba(255, 255, 255, 0.16);
  --filet-fort: rgba(255, 255, 255, 0.55);
  --actif: #fff;
  --police: "Helvetica Neue", Arial, "Segoe UI", system-ui, sans-serif;
  --maj: 0.1em;          /* espacement des majuscules */
}
```

```css
/* Zéro décor */
.theme-studio *, .theme-studio *::before, .theme-studio *::after {
  border-radius: 0 !important; box-shadow: none !important;
}
/* Interface en majuscules espacées, gris → blanc */
.theme-studio button, .theme-studio summary, .theme-studio h2, .theme-studio h3,
.theme-studio th, .theme-studio label {
  text-transform: uppercase; letter-spacing: var(--maj); font-weight: 400;
}
.theme-studio button { background: transparent; border-color: transparent; color: var(--repos); font-size: 11.5px; }
.theme-studio button:hover { color: var(--actif); }
.theme-studio [aria-selected="true"] { color: var(--actif); text-decoration: underline; text-underline-offset: 6px; text-decoration-thickness: 1px; }
.theme-studio button.primaire { background: #fff; color: #000; border-color: #fff; }
/* Un champ = un trait */
.theme-studio input, .theme-studio select { background: #000; border: 0; border-bottom: 1px solid var(--filet); }
.theme-studio input:focus { border-bottom-color: var(--actif); }
/* Blocs séparés par un filet, pas par un fond */
.theme-studio section, .theme-studio fieldset { background: transparent; border: 0; border-top: 1px solid var(--filet); }
```

Grille type « galerie » (comme la page Works) :

```css
.grille-studio {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(72px, 1fr));
  gap: 64px 64px;            /* le vide fait partie du dessin */
  padding: 150px 72px;       /* grande marge haute sous le menu fixe */
}
.grille-studio > * { aspect-ratio: 4 / 5; overflow: hidden; position: relative; }
.grille-studio .titre { position: absolute; inset: auto 0 0 0; opacity: 0; text-transform: uppercase;
  letter-spacing: var(--maj); font-size: 11px; color: #fff; transition: opacity .2s ease; }
.grille-studio > *:hover .titre { opacity: 1; }
```

Interactions prêtes à l'emploi (curseur en SVG intégré : fonctionne hors
ligne, aucune image à télécharger) :

```css
:root { --doux: cubic-bezier(0.165, 0.84, 0.44, 1); }   /* ease-out-quart */
/* Curseur croix, point actif au centre */
.theme-studio, .theme-studio button, .theme-studio a, .theme-studio svg {
  cursor: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='28'%3E%3Cpath d='M14 3v22M3 14h22' stroke='white' stroke-width='1.2'/%3E%3C/svg%3E") 14 14, crosshair;
}
.theme-studio input, .theme-studio textarea { cursor: text; }
/* Survol : l'image s'efface, le titre prend sa place */
.vignette { position: relative; transition: transform .5s var(--doux), opacity .5s var(--doux); }
.vignette img, .vignette video { transition: opacity .3s ease-out, transform .4s ease-out; }
.vignette .titre { position: absolute; inset: 0; display: grid; place-items: center; opacity: 0;
  font-size: 10px; text-transform: uppercase; letter-spacing: .1em; color: #bfbfbf; transition: opacity .4s ease-out; }
.vignette:hover img, .vignette:hover video { opacity: 0; }
.vignette:hover .titre { opacity: 1; }
/* Menu : gris → blanc, rien d'autre */
nav a { color: #bfbfbf; transition: color .3s var(--doux); }
nav a:hover { color: #fff; }
/* Respecter les réglages d'accessibilité */
@media (prefers-reduced-motion: reduce) { * { transition-duration: 0s !important; animation: none !important; } }
```

```js
// Le titre suit légèrement la souris dans la vignette (comme sur le site).
document.querySelectorAll(".vignette").forEach((v) => v.addEventListener("pointermove", (e) => {
  const r = v.getBoundingClientRect(), t = v.querySelector(".titre");
  t.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.15}px, ${(e.clientY - r.top - r.height / 2) * 0.15}px)`;
}));
```

## Mode d'emploi

1. Commencer par **retirer** : fonds de cartes, arrondis, ombres, dégradés,
   couleurs d'accent de l'interface.
2. Passer le fond en `#000` et séparer par des filets.
3. Mettre toute l'interface en majuscules espacées, gris au repos, blanc à
   l'action ; souligner l'élément actif.
4. Aligner sur une grille régulière, élargir les gouttières, laisser du vide.
5. Garder la couleur pour les données seulement.
6. Cacher le détail secondaire jusqu'au survol ou au zoom.
7. Ajouter le mouvement en dernier : une seule courbe douce, le survol qui
   échange (image → titre), le curseur croix ; couper les animations si
   l'utilisateur a demandé moins de mouvement.
8. Vérifier : une capture d'écran en noir et blanc doit rester lisible
   (hiérarchie par la taille, la casse et l'espace, pas par la couleur).

## À ne pas faire

- Pas de « carte » à fond gris foncé sur fond noir : c'est un filet ou rien.
- Pas de couleur d'accent violette, bleue ou verte dans l'interface.
- Pas de gras pour hiérarchiser : on joue sur la taille, la casse, le gris.
- Pas de police téléchargée si la page doit rester hors ligne ou sous une
  politique de sécurité stricte (`font-src 'none'`) : la police large de
  l'agence est payante ; on l'approche avec Helvetica / Arial + espacement.
- Pas de rebond, de secousse, d'animation longue (> 0,6 s) ni de mouvement
  qui gêne la lecture ; pas de vidéo avec le son.
- Ne pas imposer ce style : le proposer **en option** à côté de l'apparence
  habituelle.

## Exemple appliqué : la carte réseau

Dans `carte-reseau/` (outil « Topologie réseau v1 »), ce style existe en
apparence au choix : **Couleurs › Apparence › Noir studio**.

- Classe `theme-studio` posée sur `<body>` par `appliquerCouleurs()`
  (`src/apparence.ts`), choix retenu dans le navigateur et emporté dans la
  visionneuse exportée.
- Règles CSS : fin de `src/style.css`, bloc « Apparence Noir studio ».
- Plan 2D : les cadres portent les classes `cadre-site`, `cadre-entete`,
  `cadre-point` (`src/plan2d.ts`) pour être réduits à un filet ; cartes
  résumé (`.g-resume rect`) noires à liseré blanc.
- 3D : fond et brouillard noirs quand la classe est présente (`src/vue3d.ts`).
- Les couleurs des câbles et des équipements restent : ce sont les données.
- Interactions reprises : curseur croix sur la carte et les boutons, survol
  gris → blanc, transitions ease-out-quart, mouvement coupé si le poste
  demande moins d'animations.
