# Faire évoluer ton métier : ingénieur réseau, sécurité, automatisation, gouvernance — état des signaux au 16 novembre 2026

Document de **veille métier**, à ta demande : « savoir si je dois évoluer vers de nouvelles technologies ». **Je ne te donne pas de verdict** : je ne connais ni ton niveau exact, ni ta situation, ni ce qui te plaît. Je te donne **ce que j'ai lu**, **ce qui est solide**, **ce qui ne l'est pas**, et **comment tester une piste à faible coût**.

**Une question pour toi (à lever d'abord) :** tu as écrit « ou gouv un truc du genre ». J'ai compris **gouvernance** (gouvernance, risque et conformité, « GRC » : politiques de sécurité, conformité, analyse de risques). Si tu pensais à autre chose (par exemple le secteur public), dis-le-moi.

Sources lues le 2026-11-16 : billet de recherche d'EMA (6 mai 2026), page « NIS 2 » du service de l'ANSSI. Beaucoup d'autres éléments viennent d'**extraits de blogs et de cabinets de recrutement** non vérifiés : je les marque comme tels.

## 1. Ce qui est solide (source lue)

**a) Il manque des ingénieurs réseau, et le manque s'aggrave** (EMA Research, billet du 6 mai 2026, étude « Network Management Megatrends 2026 »). Part des responsables informatiques qui disent avoir du mal à **recruter et fidéliser** des ingénieurs réseau : **26 % en 2022, 41 % en 2024, 52 % en 2026**. Trois compétences sont les plus difficiles à trouver : **la sécurité réseau**, **le réseau pour les applications d'IA**, **l'automatisation réseau**. Limites : étude **mondiale** (pas la France), menée par un cabinet d'analyse ; elle mesure **ce que disent des responsables**, pas les offres réelles.

**b) L'IA et l'automatisation touchent surtout les postes d'entrée** (même billet). Les citations d'architectes de grandes entreprises rapportent la volonté de **réduire les équipes de niveau 1 de centre d'exploitation réseau** (NOC) : « ce qui était géré par une équipe de 25 est géré par une équipe de 10 ». EMA ajoute que **72 %** de 152 décideurs informatiques et cyber interrogés sont au moins « plutôt inquiets » que l'IA remplace les postes d'entrée et prive l'entreprise de sa filière interne. EMA conclut que l'IA **« ne remplacera jamais les ingénieurs et architectes réseau seniors »** (c'est son avis, pas un fait mesuré). **Pour toi :** le risque n'est pas « le réseau disparaît », c'est que **le travail de dépannage de premier niveau se réduit** : ce qui garde de la valeur, c'est la compréhension du **fonctionnement interne** (c'est ce que tes fiches travaillent).

**c) Comment les entreprises répondent** (même billet) : **61 %** pensent que des outils de gestion de réseau pilotés par l'IA peuvent aider ; près de **60 %** forment leur personnel existant à des rôles avancés ; **54 %** adoptent l'automatisation et l'orchestration. **Pour toi :** la **formation interne** est un levier courant : une évolution **dans** ton entreprise est une option réaliste, pas seulement un changement d'employeur.

**d) La réglementation européenne NIS 2 est un moteur de demande en conformité** (page de l'ANSSI, lue, sans date lisible) : l'ANSSI dit que NIS 2 vise à « élever le niveau global de cybersécurité par l'application de règles harmonisées », que **18 secteurs** et **plusieurs milliers d'entités** en France sont concernés, et que **la transposition en droit français est « en cours »** au moment de la page ; les entités sont invitées à s'y préparer. **Limite :** la page n'est pas datée, l'état de transposition peut avoir changé ; **vérifie l'état actuel** avant de t'appuyer dessus.

## 2. Ce qui est plausible mais non vérifié (extraits de blogs et de cabinets)

- Des offres françaises pour « network engineer » demandent de plus en plus **Ansible, Python, Terraform, le cloud** en plus de Cisco et des pare-feu (agrégateur d'offres cité par la recherche, **non lu**). 
- Les profils **GRC** (conformité, analyse de risques, politiques de sécurité) et **RSSI** seraient très demandés grâce à NIS 2 et DORA (sites de recrutement et de formation, **non lus**, chiffres contradictoires : « plus de 15 000 postes ouverts » contre « 60 000 experts manquants », sans source).
- **Salaires :** les fourchettes varient fortement d'une source à l'autre ; **je ne reprends aucun chiffre**. Un site met en garde : un poste « RSSI » dans une petite structure peut être un poste DSI + GRC opérationnel **sans pouvoir budgétaire réel** (avertissement d'un blog, utile comme **question à poser en entretien**).
- Pas d'étude de l'APEC ni de document de recrutement de l'ANSSI **lus** : **je n'ai aucune donnée officielle sur l'emploi en France**.

## 3. Les pistes et ce qu'elles demandent (lecture personnelle, à toi de juger)

| Piste | Ce que c'est | Signaux lus | Écart avec ton profil (d'après ce que je sais) |
|---|---|---|---|
| **Rester réseau et monter en profondeur** | Architecture, diagnostic avancé, ingénierie | Pénurie de seniors (EMA) ; les postes d'entrée se réduisent | À l'aise en pratique ; **manque déclaré : vocabulaire précis et fonctionnement interne** (le sujet de tes fiches) |
| **Réseau + automatisation** | Scripts, Ansible, Python, infrastructure décrite en code | Compétence parmi les **trois plus difficiles à trouver** (EMA) | À tester : tu as déjà de la **pratique PowerShell** (script AD) |
| **Réseau + sécurité** | Pare-feu, segmentation, VPN, réponse à incident | **Sécurité réseau** : la compétence la plus difficile à trouver (EMA) | Cohérent avec ton **mastère** (cybersécurité, management d'infrastructure) |
| **Gouvernance / GRC** | Conformité, risques, politiques, audits (NIS 2, ISO 27001) | Demande portée par NIS 2 (ANSSI : réalité de la réglementation lue ; demande d'emploi : blogs non lus) | **Rédaction, structuration, anglais écrit** : justement ce que tu travailles pour janvier |
| **Réseau pour l'IA / cloud** | Réseaux de calcul, interconnexion cloud | « Networking for AI » cité par EMA comme difficile à trouver | Peu de matière dans tes labs actuels |

**Lecture, non un conseil :** ton **mastère de management d'infrastructure en cybersécurité** et ton **travail de l'anglais écrit** vont dans le sens des pistes **sécurité** et **gouvernance**. Ton **point fort revendiqué** (pratique réseau) est ce qui manque d'après EMA. Cela **n'oblige pas** à changer de métier : ça peut être **réseau + sécurité**.

## 4. Comment tester une piste à faible coût (30 jours, dans ton lab, sans toucher au réseau de ton employeur)

1. **Automatisation :** écrire un petit script (PowerShell, tu en as déjà un) qui **lit** l'état de ton lab (par exemple la liste des GPO ou des SRV DNS de ta VM) : est-ce que ça te plaît ? Durée : 2 à 3 soirées.
2. **Sécurité réseau :** refaire dans Packet Tracer un petit **plan de segmentation** (VLAN, listes de contrôle d'accès) et le décrire par écrit.
3. **Gouvernance :** lire le **texte de présentation de NIS 2** (page de l'ANSSI) et écrire en anglais **10 lignes** : « Which 5 controls would I check first in a small company, and why? » Cela sert aussi ton examen d'anglais.
4. **Observer :** noter ce qui t'**énerve** et ce qui te **donne envie de continuer**. C'est le meilleur indicateur d'une évolution.

## 5. Ce que je ne sais pas (et que tu dois me dire pour affiner)

- Ton **niveau réel** en AD, SQL, scripts (tes calibrages n'ont pas de réponse).
- Ta **situation** : ancienneté, contraintes, ce qui te plaît ou t'épuise dans ton poste.
- La **date de ton mastère** et ce qu'il couvre (programme non reçu).
- Le **marché local** (région, secteur) : je n'ai pas de données françaises officielles.

## 6. Comment je suivrai ce thème

Un point **« Métier »** **tous les mois** (premier lundi) : études récentes **lues** (EMA, ISC2, ANSSI, France Travail/APEC quand ils sont lisibles), évolutions des certifications, offres. Le reste du temps, une ligne dans la veille **seulement** si un fait solide change la donne (par exemple la publication du texte de transposition de NIS 2). **Je ne te dirai jamais « change de métier » ou « ne change pas »** : je te donne les signaux et les tests.

## 7. Sources (consultées le 2026-11-16)

- EMA Research Blog, « Network Engineers: Today's Endangered Species », 6 mai 2026 : https://blog.enterprisemanagement.com/network-engineers-todays-endangered-species (chiffres 26 % / 41 % / 52 %, compétences difficiles à trouver, 61 % / 60 % / 54 %, 72 %, citations d'architectes). Source d'un statut de **statistique relayée** : l'affirmation « 25 % des ingénieurs réseau partiront en retraite » est tracée par l'auteur à une enquête OpenGear de 2023 (86 % des directeurs informatiques s'y attendent) ; je ne l'ai pas lue à la source.
- ANSSI, service « NIS 2 » (MesServicesCyber) : https://monespacenis2.cyber.gouv.fr/ (18 secteurs, plusieurs milliers d'entités, transposition « en cours » ; **page non datée**).
- **Non lus :** étude ISC2 sur la main-d'œuvre cyber (page non chargée à la lecture), APEC, France Travail, DORA, contenu des offres d'emploi. Les éléments du §2 viennent d'extraits de résultats de recherche (blogs, cabinets de recrutement).
