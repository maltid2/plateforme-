# Tarik — compatibilité firmware caméras ↔ Genetec Security Center

Tarik interroge la **Supported Device List** officielle de Genetec
(<https://www.genetec.com/supported-device-list>), via l'API de recherche
publique qu'utilise la page (`/restservices/public/search`), et répond à la question :
*« ce firmware de caméra est-il validé sur ma version de Security Center ? »*

100 % Node.js natif (≥ 18), aucune dépendance, comme le reste de la plateforme.

## Utilisation

```bash
cd tarik
node src/index.js sync                     # télécharge toute la liste caméras

# Vérifier directement à partir du nom du paquet firmware
node src/index.js check PNM-9322VQP_2.24.01_20260827_R3.zip --sc 5.11

# Ou en précisant les champs
node src/index.js check --marque Hanwha --modele PNM-9322VQP --firmware 2.24.01 --sc 5.11
node src/index.js list --marque Axis --modele P32
```

`check` interroge l'API en direct ; `--hors-ligne` utilise la base locale
`data/genetec-sdl.json` (repli automatique si l'API est injoignable).
`--json` donne une sortie machine. Codes de sortie de `check` : `0` OK / à
vérifier, `1` incompatible, `3` modèle absent de la liste.

## Verdicts

Pour chaque modèle, Genetec liste les firmwares testés avec leur certification
(*Certified*, *Tested by Partner*, *Supported by Design*) et la version
Security Center (+ Driver Pack) associée.

| Verdict | Signification |
|---|---|
| `compatible` | firmware listé (Certified / Tested by Partner) et SC ≥ minimum |
| `compatible (à vérifier)` | firmware *Supported by Design*, ou non listé mais dans la plage testée, ou SC donné sans build complète |
| `non validé` | firmware **plus récent** que le plus haut testé par Genetec |
| `incompatible` | Security Center plus ancien que le minimum |
| absent | modèle non listé → voir ONVIF ou contacter Genetec |

## Automatisation

`.github/workflows/tarik.yml` resynchronise la base chaque lundi et la committe
dans `data/genetec-sdl.json`, puis vérifie chaque ligne de `parc.txt`
(`<fichier firmware> <version SC>`) ; un push qui modifie `parc.txt` relance
la vérification. Lancement manuel (Actions → *Tarik* → *Run workflow*)
avec un nom de fichier firmware et une version SC : le verdict s'affiche dans le
résumé du job.

## Limites

- L'API n'est pas documentée publiquement : les identifiants du moteur de
  recherche sont relus à chaque exécution dans la configuration de la page.
  Si Genetec la modifie, `sync` échoue sans écraser la base existante.
  Il faut alors adapter `src/sources/genetec.js`.
- Genetec précise que certains appareils n'ont été testés que par le
  constructeur. Le verdict de Tarik reflète la liste et ne remplace pas une
  validation sur site.
