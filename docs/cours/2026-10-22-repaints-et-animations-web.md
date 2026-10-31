# Fiche n° 1 — Pourquoi les animations du hero coûtent cher : repaints et animations web

Piste 1 (technique du projet), niveau 2. Lecture : 25 minutes, exercice compris.

## 1. Ce qui est passé dans le projet aujourd'hui, et pourquoi ça vaut un cours

Le commit `72090e7` (« refonte visuelle du hero », PR #43, fusionné le 2026-10-22) a ajouté quatre effets au hero de la page d'accueil :

- une **aurore** violette (`.aurora`) derrière le hero ;
- un **reflet** qui traverse le mot « l'alerte » (`.headline-shine`) ;
- un **cadre à bordure lumineuse tournante** autour du champ d'audit (`.beam-frame`) ;
- des contrôles et un pop-up de résultat redessinés (hors sujet ici).

Ces effets tournent **en boucle infinie, dès l'arrivée sur la page**. Un effet visuel qui tourne en permanence est un coût permanent : sur un ordinateur récent on ne le voit pas, sur un téléphone d'entrée de gamme on le sent (défilement saccadé, ventilateur, batterie). Quand tu relis un diff « design », la question utile n'est pas « est-ce joli » mais **« qu'est-ce que ça fait faire au navigateur, à chaque image, pour toujours ? »**. Cette fiche te donne de quoi répondre.

Honnêteté : je n'ai **pas mesuré** le site dans un navigateur pour cette fiche. Ce qui suit est le mécanisme, vérifié contre la documentation citée en section 8. L'exercice (section 5) te fait la mesure toi-même.

## 2. Le concept

### 2.1 Le pipeline de rendu

Pour afficher une page, le navigateur enchaîne cinq étapes. Chaque image à l'écran (« frame ») peut les refaire :

1. **Style** : quelles règles CSS s'appliquent à quel élément, et quelles sont leurs valeurs finales.
2. **Layout** (mise en page) : où se trouve chaque boîte et quelle taille elle fait. Changer une largeur peut déplacer d'autres éléments : c'est l'étape la plus « contagieuse ».
3. **Paint** (peinture) : transformer chaque boîte en instructions de dessin (remplir ce rectangle avec ce dégradé, écrire ce texte). Le résultat est ensuite **rastérisé**, c'est-à-dire converti en pixels.
4. **Composite** (composition) : le navigateur a peint certaines parties de la page dans des **couches** (*layers*, des sortes de calques déjà dessinés). Il les assemble, avec position, échelle, transparence, dans l'image finale. C'est le GPU (processeur graphique) qui fait ça, très vite.

(Le découpage exact varie d'un navigateur à l'autre ; ce modèle en étapes style → layout → paint → composite est celui qu'utilise la documentation web.dev citée plus bas.)

Le point décisif : **un thread principal et un thread de composition**. Le *main thread* (fil principal) fait déjà tout le reste : exécuter ton JavaScript, calculer les styles, la mise en page, la peinture. Le compositeur peut, lui, tourner de son côté. Si une animation ne demande que l'étape de composition, elle peut continuer de couler même quand le fil principal est occupé. Si elle demande une repeinture, elle dépend du fil principal, donc elle se dispute le temps avec ton JavaScript et le défilement.

Le budget : pour 60 images par seconde, il faut produire une image toutes les ≈ 16,7 ms. Pour 120 Hz, ≈ 8,3 ms. Si le travail d'une image dépasse ce budget, l'image est sautée : c'est la saccade (*jank*).

### 2.2 Pourquoi `transform` et `opacity` sont « gratuits »

La documentation web.dev le dit ainsi : « Today there are only two properties for which that is true - `transform`s and `opacity` » — c'est-à-dire les seules propriétés qui permettent une animation « qui évite à la fois le layout et le paint, et ne demande que des changements de composition ».

Pourquoi ? Parce que déplacer, agrandir, tourner ou rendre transparent un calque **déjà peint** ne change pas son contenu : le GPU reprend le même bitmap et le dessine ailleurs ou plus pâle. Rien à re-calculer, rien à re-dessiner.

À l'inverse, changer le **contenu** d'un calque (la couleur, l'angle d'un dégradé, la position d'un fond, le flou) invalide son bitmap : il faut repeindre, donc rastériser de nouveau, donc repasser par le fil principal, **à chaque image**.

### 2.3 Les mauvais candidats

| Ce qu'on anime | Étape déclenchée | Pourquoi |
|---|---|---|
| `width`, `height`, `top`, `left`, `margin` | layout, puis paint, puis composite | change la géométrie, peut déplacer d'autres boîtes |
| `background-position`, `background-color`, `box-shadow` | paint, puis composite | le contenu du calque change, pas la géométrie |
| une propriété personnalisée lue par un dégradé (`--beam-angle`) | style, puis paint, puis composite | à chaque image, le dégradé est recalculé et repeint |
| `filter: blur()` **dont le rayon varie** | paint, puis composite | le flou est recalculé sur tout le bitmap |
| `transform`, `opacity` | composite seulement | on déplace un bitmap existant |

Attention à une confusion fréquente : un `filter: blur()` **statique** n'est pas ce qui coûte, c'est de le **faire varier** (ou de repeindre ce qu'il floute) à chaque image. Un flou fixe sur un calque qu'on déplace ne se re-rastérise pas ; il reste un coût de GPU à l'affichage. Les mesures de la section 5 te permettront de distinguer ce que le DevTools constate.

## 3. Le code réel du dépôt

Source : `sentinelscope/app/globals.css`, état de `main` au 2026-10-22 (après `72090e7` et `e3e2771`).

### 3.1 L'aurore — le cas qui est bien fait

```css
.aurora {                                              /* l.90 */
  background:                                          /* trois dégradés radiaux superposés */
    radial-gradient(40% 50% at 18% 20%, rgba(141,124,255,.32), transparent 70%),
    radial-gradient(34% 44% at 82% 14%, rgba(183,166,255,.2), transparent 70%),
    radial-gradient(46% 40% at 60% 90%, rgba(91,70,230,.22), transparent 70%);
  filter: blur(28px);                                  /* l.95 : flou FIXE */
  animation: aurora-drift 22s ease-in-out infinite alternate;   /* l.96 */
}
@keyframes aurora-drift {                              /* l.255 */
  0%   { transform: translate3d(-2%, 0, 0) scale(1); }
  100% { transform: translate3d(3%, 4%, 0) scale(1.08); }
}
```

- Les trois `radial-gradient` : fond statique, peint une fois.
- `filter: blur(28px)` : flou **constant**. Il n'est pas dans les `@keyframes`.
- `aurora-drift` anime uniquement `transform` (déplacement + échelle). C'est la bonne pratique de 2.2 : le navigateur peut peindre l'aurore une fois dans un calque et ne plus que le déplacer.
- Réserve : cet élément est grand (`inset-[-10%]` dans `Hero.tsx:32`, donc plus grand que le hero) et flouté ; son coût est surtout de **mémoire GPU et de remplissage**, pas de repeinture. Ce n'est pas une preuve de lenteur : c'est un point à regarder dans la mesure.

### 3.2 Le reflet du titre — repeinture à chaque image

```css
.headline-shine {                                      /* l.100 */
  background: linear-gradient(100deg, #8d7cff 0%, #d9d0ff 38%, #8d7cff 62%, #b7a6ff 100%);
  background-size: 220% 100%;                          /* l.108 : fond 2,2x plus large que l'élément */
  -webkit-background-clip: text;                       /* le fond n'est visible qu'à travers les lettres */
  background-clip: text;
  color: transparent;
  animation: shine 7s linear infinite;                 /* l.112 */
}
@keyframes shine {                                     /* l.250 */
  to { background-position: -220% 0; }                 /* on fait glisser le fond */
}
```

- `background-clip: text` découpe le dégradé selon la forme des lettres. On anime `background-position`. Ce n'est ni `transform` ni `opacity` : à chaque image, le navigateur doit **repeindre le texte avec son fond décalé**.
- Surface faible (un mot), donc coût faible par image. Mais il est permanent, et il occupe le fil principal.
- Note : `Hero.tsx:65` et `AuditForm.tsx:702` utilisent tous deux la classe, donc il y a deux animations de ce type dans le code (la deuxième n'est visible que si le composant l'est).

### 3.3 Le cadre lumineux — le cas le plus coûteux

```css
@property --beam-angle {                               /* l.240 */
  syntax: "<angle>";                                   /* le navigateur sait que c'est un angle... */
  inherits: false;
  initial-value: 0deg;
}
@keyframes beam-spin { to { --beam-angle: 360deg; } }  /* l.245 */

.beam-frame {                                          /* l.116 */
  position: relative; border-radius: 28px; padding: 1.5px;
  background: conic-gradient(from var(--beam-angle, 0deg), ...);   /* l.120-129 */
  animation: beam-spin 7s linear infinite;             /* l.130 */
  box-shadow: 0 30px 80px -30px rgba(141,124,255,.55), 0 0 0 1px rgba(255,255,255,.03);
}
.beam-frame::before {                                  /* l.135 */
  content: ""; position: absolute; inset: -1px; z-index: -1;
  border-radius: inherit;
  background: inherit;                                 /* l.141 : recopie le dégradé tournant */
  filter: blur(22px);                                  /* l.142 */
  opacity: 0.45;
}
```

Mécanisme, pas à pas :

1. Sans `@property`, `--beam-angle` serait une simple chaîne de texte : on ne peut pas interpoler « 0 » vers « 360deg » en texte. Avec `@property` et `syntax: "<angle>"`, le navigateur sait que c'est un angle et peut l'animer en continu. C'est une astuce moderne et propre, **mais** :
2. À chaque image, `--beam-angle` change → le style de `.beam-frame` est recalculé → `conic-gradient(from <angle>, ...)` change de valeur → le contenu du fond est différent → **repeinture** du cadre. Aucune étape de composition seule ne peut l'obtenir : on change ce qui est dessiné.
3. `::before` utilise `background: inherit` : il recopie le même dégradé tournant, donc il est **repeint aussi**, et en plus on lui applique un `blur(22px)`. Le flou s'applique sur un contenu qui change à chaque image, ce qui est bien plus lourd qu'un flou sur un contenu fixe.
4. `box-shadow` est statique ici, donc sans effet par image, mais il agrandit la zone à repeindre.

Je précise ce que je n'ai pas pu vérifier : que cette animation tourne bien sur le fil principal dans Chrome, Firefox et Safari. C'est le comportement attendu pour une propriété personnalisée enregistrée, mais la documentation consultée (MDN `@property`) ne le dit pas ; l'exercice 5 le vérifie.

### 3.4 Le filet de sécurité

```css
@media (prefers-reduced-motion: reduce) {              /* l.179 */
  *, *::before, *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    ...
  }
}
```

C'est bien : les gens qui ont activé « réduire les animations » dans leur système (MDN : ces animations « peuvent provoquer un inconfort chez les personnes ayant des troubles vestibulaires ») voient l'état final, sans boucle. Mais c'est un **choix explicite de l'utilisateur** : tous les autres visiteurs, y compris sur un téléphone faible, paient le coût complet.

## 4. Ce qui arrive quand on le fait mal — symptômes observables

- **Défilement saccadé** pendant que le cadre tourne : le fil principal est occupé à repeindre, donc le défilement perd des images.
- **Images par seconde qui chutent** (en dessous de 60) sur un téléphone modeste, alors que tout va bien sur l'ordinateur du développeur : la machine de test n'est pas celle du visiteur.
- **Ventilateur et batterie** : un effet infini maintient le processeur et le GPU actifs même quand le visiteur lit sans rien toucher.
- **Interactions retardées** (INP, un des Core Web Vitals) : un clic arrive pendant qu'une repeinture occupe le fil principal.
- **Effet de cascade** : plus on ajoute d'effets de ce type, plus ils s'additionnent. Aucun n'est « grave » seul.

## 5. Exercice sur le dépôt

Durée : 10 minutes. Outil : Chrome ou Edge, DevTools.

1. Ouvre le site, puis DevTools → menu ⋮ → *More tools* → **Rendering**.
2. Coche **Paint flashing** : Chrome « flashes the screen green whenever repainting happens » (Chrome for Developers). Observe quelles zones clignotent en vert sans que tu touches à rien.
3. Coche **Frame rendering stats** : une surcouche en haut à droite affiche les images par seconde. Note la valeur au repos, puis en défilant.
4. Active **CPU throttling** (onglet *Performance* → icône engrenage → *CPU: 4× slowdown*) pour imiter un téléphone moyen, et note de nouveau les images par seconde.
5. Dans l'onglet *Elements*, désactive à la main, une par une, la propriété `animation` de `.beam-frame`, puis de `.headline-shine`, puis de `.aurora`. Note laquelle fait le plus remonter les images par seconde.

**Question :** classe les trois effets du plus au moins coûteux et justifie avec tes mesures. Puis propose (sans l'écrire dans le dépôt) comment obtenir un cadre lumineux qui tourne **sans repeindre**.

<details>
<summary>Solution</summary>

Résultat attendu (à confirmer par tes mesures, je ne les ai pas faites) : paint flashing vert sur le cadre du champ d'audit et sur le mot « l'alerte », **pas** sur l'aurore. Classement probable : `.beam-frame` (repeinture du dégradé + du `::before` flouté), puis `.headline-shine`, puis `.aurora`, dont le coût est surtout GPU.

Piste pour le cadre : ne pas animer le dégradé, mais **faire tourner l'élément qui le porte**. On met le `conic-gradient` fixe sur un pseudo-élément plus grand que le cadre, et on anime `transform: rotate(360deg)` dessus, avec `overflow: hidden` sur le parent pour ne laisser voir que la bordure. Le dégradé est peint une fois ; seule la rotation du calque est recomposée. Autres leviers : supprimer le flou du `::before` (ou le rendre fixe et le déplacer par `transform`) ; mettre l'animation en pause quand le hero sort de l'écran (`IntersectionObserver`) ; limiter la durée de vie de l'animation (quelques boucles, pas l'infini).

`will-change: transform` sur l'élément qui tourne est envisageable pour demander un calque dédié, mais MDN avertit : c'est « a last resort » et il ne faut pas l'appliquer à trop d'éléments, car cela peut ralentir la page au lieu de l'accélérer. À ne poser qu'**après** une mesure qui le justifie.
</details>

## 6. Anglais technique

### 6.1 Dix termes du jour

| Anglais | Français | Note |
|---|---|---|
| repaint | repeinture | `/ˌriːˈpeɪnt/` |
| layout | mise en page (calcul des positions et tailles) | `/ˈleɪaʊt/` |
| composite (verbe) | composer, assembler les calques | verbe : `/kəmˈpɑːzɪt/`, accent sur la 2e syllabe |
| layer | couche, calque | `/ˈleɪər/` |
| frame | image (d'une animation) | `/freɪm/` |
| jank | saccade | `/dʒæŋk/` |
| main thread | fil principal | `thread` = `/θred/`, le « th » sourd est le piège |
| throttle | brider | `/ˈθrɑːtl/`, même « th » ; *CPU throttling* = bridage du processeur |
| opt in / opt out | adhérer / se désengager | un utilisateur peut *opt out* de l'animation |
| fall back | solution de repli | `fallback` en nom : « un repli » |
| compositor | compositeur | `/kəmˈpɑːzɪtər/` |
| rasterize | rastériser | `/ˈræstəraɪz/` |

### 6.2 Paragraphe à traduire

Source : MDN, page `will-change` (consultée le 2026-10-22). Ce n'est pas une note de version : c'est la documentation de référence ; je n'ai pas cherché de note de version publiée aujourd'hui, donc je ne prétends pas que ce texte est « du jour » mais seulement qu'il a été lu aujourd'hui.

> **Don't apply `will-change` to too many elements**: The browser already tries as hard as it can to optimize everything. Some of the stronger optimizations that are likely to be tied to `will-change` end up using a lot of a machine's resources. Overusing the property can cause the page to slow down instead of improving its performance.

Traduis-le d'abord seul·e, puis compare avec la proposition ci-dessous.

<details>
<summary>Proposition de traduction</summary>

« N'appliquez pas `will-change` à trop d'éléments : le navigateur s'efforce déjà d'optimiser tout ce qu'il peut. Certaines des optimisations les plus fortes, associées à `will-change`, finissent par consommer beaucoup de ressources de la machine. Abuser de cette propriété peut ralentir la page au lieu d'en améliorer les performances. »

Pièges : *tries as hard as it can* = « fait tout son possible » ; *end up using* = « finissent par utiliser » ; *instead of improving* = « au lieu d'améliorer ».
</details>

### 6.3 Trois formulations réutilisables dans une PR ou une issue

1. « This animation triggers a repaint on every frame; could we animate `transform` instead? » — *Cette animation déclenche une repeinture à chaque image ; pourrait-on animer `transform` à la place ?*
2. « Do you have numbers for this? I'd like to see the FPS before and after on a throttled CPU. » — *As-tu des mesures ? J'aimerais voir les images par seconde avant et après sur un processeur bridé.*
3. « Non-blocking: this looks fine on desktop, but it may be heavy on low-end phones. » — *Non bloquant : ça va sur ordinateur, mais ça peut être lourd sur un téléphone d'entrée de gamme.*

## 7. Trois questions de contrôle

1. Pourquoi `transform` peut-il être animé sans repeindre, alors que `background-position` ne le peut pas ?
2. Dans `.aurora`, il y a un `filter: blur(28px)`. Est-ce lui qui rend l'animation coûteuse ? Justifie.
3. À quoi sert `@property --beam-angle` et quel est le coût de ce qu'elle permet ?

<details>
<summary>Réponses</summary>

1. `transform` déplace un calque déjà peint : seul le compositeur travaille. `background-position` change le **contenu** du calque, qu'il faut donc repeindre à chaque image sur le fil principal.
2. Pas par lui-même : le flou est constant et l'animation ne touche que `transform`. Il coûte du remplissage GPU, pas des repeintures. Il deviendrait coûteux si le rayon varie ou si le contenu flouté change à chaque image (ce qui est le cas du `::before` de `.beam-frame`).
3. Elle déclare que `--beam-angle` est un angle, ce qui permet de l'interpoler dans `@keyframes`. Le coût : à chaque image, le `conic-gradient` change donc le cadre (et son `::before` flouté) est repeint.
</details>

## 8. Sources (consultées le 2026-10-22)

- web.dev, « Stick to compositor-only properties and manage layer count » : https://web.dev/articles/stick-to-compositor-only-properties-and-manage-layer-count — `transform` et `opacity` seules propriétés animables sans layout ni paint (citation en 2.2).
- web.dev, « Animations guide » : https://web.dev/articles/animations-guide — recommande de limiter les animations à `opacity` et `transform` et d'éviter tout ce qui déclenche layout ou paint. Cette page ne mentionne ni le fil principal ni `background-position` ni les propriétés personnalisées : ces points viennent de mon raisonnement et sont à vérifier par l'exercice.
- MDN, `@property` : https://developer.mozilla.org/en-US/docs/Web/CSS/@property — définition et exemple d'animation d'une propriété personnalisée ; badge « Baseline 2024 », disponible depuis juillet 2024.
- MDN, `will-change` : https://developer.mozilla.org/en-US/docs/Web/CSS/will-change — mises en garde citées en 5 et 6.2.
- MDN, `prefers-reduced-motion` : https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion — citation en 3.4.
- Chrome for Developers, outils de rendu : https://developer.chrome.com/docs/devtools/rendering/performance — Paint flashing et Frame rendering stats.
- Dépôt : `sentinelscope/app/globals.css`, `sentinelscope/components/Hero.tsx`, `sentinelscope/components/AuditForm.tsx`, commit `72090e7`.
