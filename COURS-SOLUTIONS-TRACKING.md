# Choisir sa solution de suivi GPS — le cours

Ce document explique, sans jargon, **comment fonctionne une application de suivi
GPS** et **quelles sont les 4 façons de la mettre en place**, avec les avantages,
les limites et le coût réel de chacune.

Il est volontairement **générique** : il s'applique à toute activité où l'on veut
savoir où se trouvent des personnes ou des appareils sur le terrain (chauffeurs,
techniciens, livreurs, équipes mobiles, matériel). Aucun secteur en particulier.

---

## 1. Comment marche une app de suivi : les 3 briques

Toute solution de tracking, quelle que soit la techno, repose sur les mêmes trois
briques. C'est la base à comprendre avant de choisir.

| Brique | Rôle | Qui l'utilise |
|---|---|---|
| **1. L'app côté terrain** | Installée sur le téléphone. Lit le GPS et envoie la position à intervalles réguliers. | La personne suivie |
| **2. Le serveur** | Reçoit les positions, les stocke, calcule l'historique, les trajets, les alertes. | Personne (il tourne 24/7) |
| **3. L'interface de suivi** | La carte, les listes, les rapports. Une page web consultable depuis n'importe quel navigateur. | Vous (le responsable) |

Point clé : **les 4 options ci-dessous ne changent pas la brique 1 de la même
façon.** C'est là que se joue la fiabilité du suivi. Une interface ratée se
refait ; un suivi qui s'arrête tout seul, non.

Deuxième point clé : le suivi ne tient que si l'app **continue à envoyer des
positions quand le téléphone est en poche, écran éteint**. C'est ce qu'on appelle
le fonctionnement « en arrière-plan », et c'est le critère qui élimine
directement l'option 4.

---

## 2. Les 4 options

### Option 1 — Application mobile 100 % sur-mesure (iOS + Android)

On développe tout : l'app terrain, le serveur, l'interface.

- **Comment ça marche** : une app à votre nom, publiée sur l'App Store et le Play
  Store, qui envoie les positions à votre propre serveur.
- **Avantages** : liberté totale sur les fonctions, l'ergonomie, le design. C'est
  le haut de gamme.
- **Limites** : long à développer, et surtout **coûteux à maintenir dans le
  temps**. Deux systèmes (iOS et Android) à suivre, des mises à jour imposées
  chaque année par Apple et Google, des comptes développeurs à payer, des
  republications à faire. Le coût ne s'arrête pas à la livraison.
- **Verdict** : techniquement le top, mais **surdimensionné** pour un besoin de
  suivi. On paie du développement là où une brique gratuite et éprouvée existe
  déjà. **Non recommandé.**

### Option 2 — Traccar prêt à l'emploi

Traccar est une **plateforme de tracking open-source professionnelle**, utilisée
partout dans le monde, mature et éprouvée depuis des années.

- **Comment ça marche** : on installe Traccar sur un serveur. Les personnes
  suivies installent l'**app Traccar Client, gratuite sur le Play Store et
  l'App Store**. Vous, vous ouvrez l'interface web de Traccar : carte en direct,
  historique des trajets, rapports, alertes, zones géographiques.
- **Avantages** :
  - la brique terrain est **déjà faite, gratuite et fiable** (suivi en
    arrière-plan correctement géré) ;
  - pas de développement d'app mobile, donc **rien à maintenir sur les stores** ;
  - vous avez **un lien web** à consulter quand vous voulez, depuis un ordinateur
    ou un téléphone ;
  - le coût courant se limite à l'hébergement du serveur.
- **Limites** : l'interface est **standard**. Fonctionnelle, mais générique :
  pas votre logo, pas vos couleurs, pas votre vocabulaire métier. On s'adapte à
  l'outil plutôt que l'inverse.
- **Verdict** : **solide, rapide à mettre en place, pas cher.** Simplement pas à
  votre image.

### Option 3 — Traccar + interface à votre marque *(l'option que je propose)*

Même socle que l'option 2, mais l'interface de suivi est **développée
spécifiquement pour vous**.

- **Comment ça marche** : Traccar reste le moteur (réception des positions,
  stockage, historique) et l'app gratuite reste celle du terrain — donc
  **strictement la même fiabilité que l'option 2**. Par-dessus, je code **votre**
  interface web : votre logo, vos couleurs, vos écrans, et surtout **vos
  fonctions métier** — seulement les informations qui vous servent, présentées
  comme vous les utilisez vraiment.
- **Avantages** :
  - la fiabilité éprouvée du socle open-source, sans le coût d'une app
    sur-mesure ;
  - un outil **à votre image**, présentable à un client ou à un partenaire ;
  - évolutif : on ajoute des fonctions au fil du temps sans toucher au moteur ;
  - toujours **un simple lien web**, consultable quand vous voulez.
- **Limites** : un peu plus cher et plus long que l'option 2, puisqu'il y a du
  développement. Et l'interface, c'est moi qui la maintiens — donc une dépendance
  à prévoir (le code vous appartient, c'est le point à verrouiller au départ).
- **Verdict** : **le meilleur rapport qualité/prix.** On ne paie du sur-mesure
  que là où il apporte quelque chose : l'interface.

> **Variante à connaître : passer directement chez Traccar (offre cloud
> officielle), sans moi.**
> Ça fonctionne très bien : vous payez un abonnement, ils hébergent, vous n'avez
> rien à gérer. Deux différences à avoir en tête :
> 1. c'est un **abonnement à vie**, facturé par appareil suivi — sur la durée,
>    la facture cumulée dépasse celle d'un serveur que vous maîtrisez ;
> 2. vous restez sur l'**interface standard**, sans votre marque ni vos fonctions
>    métier.
>
> C'est une piste légitime : regardez-la, comparez, ça vous donnera un point de
> repère sur les prix.

### Option 4 — Web app installable (PWA)

Une page web que je développe, avec une particularité : elle **s'installe comme
une app** sur le téléphone (une icône sur l'écran d'accueil, sans passer par les
stores).

- **Comment ça marche** : la personne ouvre la page, autorise la géolocalisation,
  et le navigateur envoie les positions.
- **Avantages** : la moins chère et la plus rapide à sortir, aucun store, aucune
  validation Apple ou Google, mise à jour instantanée.
- **Limites — et c'est bloquant** : un navigateur **n'a pas le droit** de suivre
  une position en continu quand la page est fermée ou le téléphone verrouillé.
  Résultat : **le suivi se coupe** dès que la personne ferme l'onglet, change
  d'app trop longtemps ou range son téléphone. Sur iOS, c'est encore plus
  restreint.
- **Verdict** : **à éviter pour du suivi**. Une solution de tracking dont les
  données ont des trous n'est pas une solution de tracking. Une PWA est
  excellente pour l'interface de consultation — pas pour la collecte.

---

## 3. Tableau comparatif

| Critère | 1. App sur-mesure | 2. Traccar standard | 3. Traccar + votre interface | 4. Web app (PWA) |
|---|---|---|---|---|
| **Fiabilité du suivi** | Excellente | Excellente | Excellente | **Insuffisante** |
| **Suivi écran éteint / app fermée** | Oui | Oui | Oui | **Non** |
| **À votre marque** | Oui | Non | **Oui** | Oui |
| **Fonctions métier sur mesure** | Oui | Non | **Oui** | Oui |
| **Délai de mise en place** | Long | Très court | Court à moyen | Court |
| **Coût de départ** | €€€€ | € | €€ | € |
| **Coût récurrent** | €€€ (stores + maintenance 2 OS) | € (serveur) | € (serveur) + maintenance interface | € |
| **Ce que voit le terrain** | Votre app | App Traccar gratuite | App Traccar gratuite | Une page web |
| **Ce que vous voyez** | Votre interface | Interface standard | **Votre interface** | Votre interface |
| **Recommandé** | Non | **Oui** | **Oui** | Non |

*Les symboles € sont des ordres de grandeur relatifs, pas des devis : les
montants exacts se chiffrent au moment du choix, selon le nombre d'appareils
suivis et l'hébergement retenu.*

---

## 4. La recommandation

**Option 2 ou option 3.** Ce sont les deux seules qui cochent les trois cases qui
comptent : suivi fiable, coût maîtrisé, et un lien web consultable à tout moment.

La bonne façon de choisir entre les deux :

- **Option 2** si l'objectif est d'**avoir un suivi qui marche, vite et pas
  cher**, et que l'apparence de l'outil n'a pas d'importance (usage interne
  uniquement).
- **Option 3** si l'outil sera **vu par des clients ou des partenaires**, ou si
  vous voulez des écrans et des indicateurs qui collent à votre façon de
  travailler.

Et une stratégie pragmatique qui marche très bien : **commencer par l'option 2**
pour valider le suivi sur le terrain avec de vraies données, **puis passer à
l'option 3** une fois qu'on sait exactement quelles informations vous regardez
tous les jours. On ne jette rien : le socle et l'historique des positions sont
les mêmes, on ne rajoute que l'interface.

---

## 5. Les pièges techniques à connaître (valables pour toutes les options)

Ce ne sont pas des détails : ce sont les raisons habituelles pour lesquelles un
projet de tracking déçoit.

1. **La batterie.** Le GPS consomme. Le réglage de la fréquence d'envoi (toutes
   les 30 secondes ? 2 minutes ?) est un compromis entre précision et autonomie.
   À calibrer sur le terrain, pas sur le papier.
2. **Les autorisations.** Le suivi en arrière-plan doit être autorisé
   explicitement sur le téléphone (« Toujours autoriser » la localisation) et
   l'app ne doit pas être mise en veille par les économiseurs de batterie. C'est
   la cause n°1 des « trous » dans les données. Prévoir une courte notice
   d'installation.
3. **Le réseau.** En zone blanche, les positions sont mises en file d'attente et
   envoyées au retour du réseau. Un retard à l'affichage n'est donc pas forcément
   une panne.
4. **La précision.** Comptez quelques mètres en terrain dégagé, beaucoup plus en
   ville dense, en parking souterrain ou en tunnel. Une position aberrante isolée
   est normale ; c'est la trace globale qui compte.
5. **L'appareil.** Suivre un téléphone, c'est suivre la personne qui le porte,
   pas le matériel. Si l'objectif est de suivre un véhicule ou un équipement même
   sans personne à côté, il faut un **traceur matériel dédié** — Traccar en
   gère des centaines de modèles, c'est d'ailleurs un de ses points forts, et
   ça ne change rien à l'interface.

---

## 6. Le cadre légal — à ne pas sauter

Dès que le suivi porte sur des personnes (a fortiori des salariés), il y a des
règles. En France, c'est le RGPD et la doctrine de la CNIL. En résumé :

- **informer** clairement les personnes suivies (pourquoi, quelles données,
  combien de temps elles sont conservées, qui y a accès) ;
- **finalité précise et proportionnée** : on suit pour un motif légitime et
  déclaré, pas « au cas où » ;
- **pas de suivi en dehors du temps de travail** : la personne doit pouvoir
  désactiver le suivi pendant ses pauses et après sa journée ;
- **durée de conservation limitée** : on ne garde pas l'historique
  indéfiniment ;
- **accès restreint** aux seules personnes qui en ont besoin.

Bonne nouvelle : ces exigences se traduisent par des réglages concrets, et elles
sont **plus faciles à respecter avec les options 2 et 3** (vous maîtrisez le
serveur, les durées de conservation et les accès) qu'avec une solution où les
données vivent chez un tiers.

---

## 7. Décider en 5 questions

1. **L'outil sera-t-il vu par des personnes extérieures ?**
   Oui → option 3. Non → option 2 suffit.
2. **Combien d'appareils à suivre, et combien dans un an ?**
   Ça détermine si un abonnement par appareil reste raisonnable ou devient cher.
3. **Le suivi doit-il tenir écran éteint, sans intervention de l'utilisateur ?**
   Oui → l'option 4 est éliminée.
4. **Suivez-vous des personnes, ou du matériel qui roule sans personne ?**
   Du matériel seul → prévoir des traceurs dédiés en plus des téléphones.
5. **Qui gère le serveur dans deux ans ?**
   Si personne en interne → prévoir un contrat de maintenance, ou assumer le
   surcoût du cloud officiel.

---

## 8. Prochaines étapes concrètes

1. Répondre aux 5 questions ci-dessus.
2. Installer l'app Traccar sur **un seul téléphone** et tester le suivi pendant
   deux ou trois journées réelles. C'est gratuit et ça tranche plus de débats
   qu'une réunion.
3. Regarder au passage les tarifs du cloud officiel Traccar, pour avoir un point
   de comparaison chiffré.
4. Lister les **5 informations** que vous voulez voir en ouvrant la page le
   matin. Cette liste, c'est le cahier des charges de l'option 3.
5. Trancher entre option 2 et option 3, et chiffrer.

---

### À retenir en trois phrases

L'app terrain, ce n'est pas là qu'il faut dépenser : une brique open-source
gratuite et éprouvée fait le travail mieux qu'un développement sur-mesure.
Ce qui mérite d'être personnalisé, c'est **l'interface** — c'est elle que vous
regardez tous les jours. Et dans tous les cas, ce que vous obtenez au bout, c'est
**un lien web** à ouvrir quand vous voulez, depuis n'importe où.
