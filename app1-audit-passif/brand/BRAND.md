# IXAUDIT — Image de marque

Board visuel : [`brand-board.html`](./brand-board.html) (autonome, police embarquée).

## Positionnement
**La sécurité de votre site, expliquée simplement.**
IXAUDIT vérifie la sécurité d'un site web et l'explique en langage clair — pour
que n'importe qui comprenne ce qu'il faut améliorer, sans être expert. Le détail
technique reste disponible pour les profils IT.

## Nom & logo
- Nom : **IXAUDIT** (« IX » = monogramme, « AUDIT » en accent violet).
- Symbole : **bouclier** contenant le monogramme IX.
- Variantes : lockup principal (icône + mot), icône seule, monochrome (fond clair).
- Zone de protection : espace libre ≈ hauteur du « X » autour du logo.
- Taille minimale de l'icône : 20 px.

## Couleurs
| Rôle | Nom | Hex |
|---|---|---|
| Fond principal | Noir | `#000000` |
| Accent / marque | Violet | `#8B6CFF` |
| Dégradés, survols | Violet profond | `#6D4BFF` |
| Texte principal | Encre | `#EEF0F8` |
| Texte secondaire | Gris | `#8B8EA3` |
| État — tout va bien | Vert | `#22C55E` |
| État — à améliorer | Orange | `#FB923C` |
| État — risque / priorité | Rouge | `#F43F5E` |

## Typographie
**Inter** (auto-hébergée, licence libre) — moderne, neutre, très lisible.
- Titres : **Bold 700**
- Sous-titres : **SemiBold 600**
- Texte courant : **Regular 400**

## Ton de voix
Clair · Rassurant · Sérieux · Accessible · Sans jargon.

Principes :
- Parler du **risque** (business), pas de la technique.
- **Rassurer et guider**, jamais faire peur inutilement.
- Le **détail technique** reste disponible pour l'IT.
- Vouvoiement, phrases courtes.

On traduit toujours le jargon :
| Technique | IXAUDIT |
|---|---|
| TLS / SSL | Connexion sécurisée |
| En-têtes HTTP | Protection du site |
| CVE | Failles connues |
| Réputation | Réputation en ligne |
| RGPD | Protection des données |

## Application
L'interface (application `app1-audit-passif`) applique cette identité : fond
noir, accent violet, police Inter, ton clair. Rebrandable via variables
d'environnement : `BRAND_NAME`, `BRAND_HEADLINE`, `BRAND_ACCENT`, `BRAND_FONT`,
`BRAND_USER`.
