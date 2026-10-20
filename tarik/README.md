# Tarik — compatibilité firmware caméras ↔ Genetec Security Center

Tarik va chercher la **Supported Device List** officielle de Genetec
(<https://www.genetec.com/supported-device-list>) et répond à la question :
*« ce firmware de caméra est-il validé sur ma version de Security Center ? »*

100 % Node.js natif (≥ 18), aucune dépendance, comme le reste de la plateforme.

## Utilisation

```bash
cd tarik
node src/index.js sync                     # télécharge la liste (pages ?page=1..N)
node src/index.js sync --details           # + fiches détail (?pid=…), plus lent

# Vérifier directement à partir du nom du paquet firmware
node src/index.js check PNM-9322VQP_2.24.01_20260827_R3.zip --sc 5.11

# Ou en précisant les champs
node src/index.js check --marque Hanwha --modele PNM-9322VQP --firmware 2.24.01 --sc 5.11
node src/index.js list --marque Axis --modele P32
```

`--json` donne une sortie machine. Codes de sortie de `check` : `0` OK / à
vérifier, `1` incompatible, `3` modèle absent de la liste.

## Verdicts

Convention Genetec : le firmware listé est le **dernier validé**, la version
Security Center listée est le **minimum requis** (avec éventuellement un Driver Pack).

| Verdict | Signification |
|---|---|
| `compatible` | firmware = version validée et SC ≥ minimum |
| `compatible (à vérifier)` | firmware plus ancien que le validé, ou SC donné sans build (`5.11` vs `5.11.0.1`) |
| `non validé` | firmware **plus récent** que le dernier validé par Genetec |
| `incompatible` | Security Center plus ancien que le minimum |
| absent | modèle non listé → voir ONVIF ou contacter Genetec |

## Automatisation

`.github/workflows/tarik.yml` resynchronise la base chaque lundi et la committe
dans `data/genetec-sdl.json`. Lancement manuel (Actions → *Tarik* → *Run workflow*)
avec un nom de fichier firmware et une version SC : le verdict s'affiche dans le
résumé du job.

## Hors-ligne

Si le site est inaccessible (proxy, protection anti-bot), enregistrez les pages
de la liste depuis un navigateur (`Ctrl+S`) dans un dossier puis :

```bash
node src/index.js sync --from-dir ./pages-enregistrees
```

## Limites

- Le parsing s'appuie sur les **libellés de colonnes** (Manufacturer, Model,
  Latest firmware supported, Security Center, Driver Pack…) et non sur leur
  position. Si Genetec change la structure ou charge la liste en JavaScript,
  `sync` échoue proprement sans écraser la base existante. Il faut alors
  adapter `src/sources/genetec.js`.
- Genetec précise que certains appareils n'ont été testés que par le
  constructeur. Le verdict de Tarik reflète la liste et ne remplace pas une
  validation sur site.
