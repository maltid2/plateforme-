# Carte réseau — outil interne

On écrit à la main ses sites, ses baies, ses équipements et leurs liaisons
port à port. L'outil dessine la carte tout seul, en **plan 2D** et en **vue 3D**.
On ne place plus rien un par un sur la carte.

Tout reste dans le navigateur : rien n'est envoyé sur un serveur. La saisie
est gardée en local et s'enregistre ou s'ouvre en `.txt`.

## Lancer

```bash
npm install
npm run dev        # http://localhost:5173
```

Pour une version à poser sur un serveur interne (ou un partage réseau) :

```bash
npm run build      # produit dist/, des fichiers statiques
```

## Écrire l'inventaire

```text
site Nanterre | Siège

baie A1
  passerelle GW-NANTERRE | 10.14.0.1 | FortiGate 60F
  switch SW-CORE | 10.14.0.2 | Cisco 9300 | ports=24
baie A2
  switch SW-CAM | 10.14.0.3 | PoE 16 ports

camera CAM-ENTREE | 10.14.0.50
camera CAM-PARKING x4 | 10.14.0.51        # crée CAM-PARKING-1 à 4, IP qui suivent

GW-NANTERRE:LAN1 -> SW-CORE:1
SW-CORE:24 -> SW-CAM:16 | uplink
CAM-ENTREE -> SW-CAM:2
CAM-PARKING* -> SW-CAM:3                   # ports 3, 4, 5, 6

site Lyon
passerelle GW-LYON | 10.20.0.1
switch SW-LYON | 10.20.0.2 | sur GW-LYON:LAN1   # liaison directement sur la ligne

GW-NANTERRE:WAN -> GW-LYON:WAN | VPN IPsec  # entre deux sites
```

- **Équipement** : `type NOM | IP | infos libres | clé=valeur`
- **Site sur la ligne** : `@Lyon` (ou `site=Lyon`) range l'équipement dans ce
  site, sans ouvrir de bloc ; le site est créé au besoin et l'ordre des lignes
  est libre :

  ```text
  switch SW-LYON-1 | @Lyon | 10.20.0.2 | sur SW-SIEGE:5 | fibre
  switch SW-LYON-2 | @Lyon | 10.20.0.3 | sur SW-LYON-1:24
  camera CAM-LYON x6 | @Lyon | 10.20.0.50 | sur SW-LYON-2:1
  ```
- **Types** : passerelle, parefeu, switch, camera, nvr, borne, serveur, nas,
  poste, imprimante, telephone, onduleur, autre
- **Baie** : `baie A1`, puis les lignes **en retrait** qui suivent sont dans la baie
- **Liaison** : `NOM:port -> NOM:port | libellé` (ou `sur NOM:port` en fin de ligne)
- `#` commence un commentaire

Les erreurs s'affichent sous l'éditeur avec leur numéro de ligne : nom
inconnu dans une liaison, port déjà pris, nom en double, équipement relié à rien.

## Comment la carte est construite

Dans chaque site, l'arbre part de la passerelle ou du pare-feu ; sans eux, du
switch qui remonte vers les autres sites. Les autres switchs viennent en
dessous, puis ce qui est branché dessus. Chaque équipement se range sous celui
auquel il est relié.

Tous les sites sont sur une même carte, chacun dans son cadre. Le site le plus
relié aux autres (le siège) se place au centre et les liaisons inter-sites
rayonnent vers les agences. Testé avec 20 sites, 40 switchs et une centaine de
caméras.

## Tests

```bash
npm test
```
