# Anglais — cybersécurité et management d'infrastructure : glossaire et étude de cas n° 1

Piste 4, orientée examen « B2 écrit » (Mastère cybersécurité, management d'infrastructure). Rédigé le 2026-10-22.

Statut des informations : les définitions ci-dessous sont des définitions standard du métier, écrites de mémoire ; je ne les ai pas recoupées aujourd'hui avec une source. Les noms de référentiels (ISO/IEC 27001, NIST Cybersecurity Framework) sont des noms réels, mais je ne cite ni version ni année. Le texte de l'étude de cas est **écrit par moi** : il ne vient d'aucune source externe et ne décrit aucun incident réel.

## 1. Glossaire (≈ 60 termes)

### Risque et gouvernance
| Anglais | Français | Sens / piège |
|---|---|---|
| asset | actif | tout ce qui a de la valeur : serveur, donnée, service |
| threat | menace | ce qui peut causer un dommage (un attaquant, un incendie) |
| vulnerability | vulnérabilité | une faiblesse exploitable. Prononcer **vul**-ne-ra-**bi**-li-ti |
| risk | risque | probabilité × impact d'une menace qui exploite une vulnérabilité |
| impact | impact | gravité des conséquences |
| likelihood | probabilité (de survenue) | **laïk**-li-houd |
| risk assessment | évaluation des risques | analyse qui classe les risques |
| risk appetite | appétence au risque | niveau de risque que l'organisation accepte |
| policy | politique (règle générale) | **po**-li-ci. Ne pas confondre avec *police* |
| procedure | procédure | étapes détaillées pour appliquer la politique |
| compliance | conformité | respect des règles et lois |
| audit | audit | contrôle indépendant |
| governance | gouvernance | **gueu**-veur-nance : qui décide, qui contrôle |
| stakeholder | partie prenante | **stèïk**-hol-deur |
| ISO/IEC 27001 | norme de management de la sécurité de l'information | nom de norme réel ; version non vérifiée ici |
| NIST Cybersecurity Framework | cadre de cybersécurité du NIST | nom de référentiel réel ; version non vérifiée ici |

### Contrôle d'accès
| Anglais | Français | Sens / piège |
|---|---|---|
| authentication | authentification | prouver qui on est |
| authorization | autorisation | décider ce qu'on a le droit de faire |
| MFA (multi-factor authentication) | authentification multifacteur | plusieurs preuves : secret + appareil, etc. |
| IAM (identity and access management) | gestion des identités et des accès | |
| least privilege | moindre privilège | donner seulement les droits nécessaires |
| privilege escalation | élévation de privilèges | obtenir plus de droits que prévu |
| role-based access control (RBAC) | contrôle d'accès par rôles | droits attachés aux rôles |
| credentials | identifiants | **kri**-**den**-chiolz |
| password policy | politique de mots de passe | |
| service account | compte de service | compte non humain |

### Infrastructure et durcissement
| Anglais | Français | Sens / piège |
|---|---|---|
| infrastructure | infrastructure | |
| server / host / endpoint | serveur / hôte / poste terminal | |
| hardening | durcissement | réduire la surface d'attaque d'un système |
| attack surface | surface d'attaque | tout ce qui est atteignable |
| baseline / configuration baseline | référence de configuration | **bèïs**-laïne |
| asset inventory | inventaire des actifs | on ne protège pas ce qu'on ne connaît pas |
| segmentation | segmentation | séparer le réseau en zones |
| DMZ | zone démilitarisée | zone tampon exposée à Internet |
| defense in depth | défense en profondeur | plusieurs barrières successives |
| zero trust | confiance zéro | ne jamais faire confiance par défaut |
| patch management | gestion des correctifs | |
| change management | gestion des changements | contrôler et tracer chaque modification |
| configuration drift | dérive de configuration | l'état réel s'éloigne de la référence |

### Disponibilité et continuité
| Anglais | Français | Sens / piège |
|---|---|---|
| availability | disponibilité | |
| high availability (HA) | haute disponibilité | |
| redundancy | redondance | doubler un composant |
| failover | bascule | passage automatique sur le secours |
| single point of failure (SPOF) | point de défaillance unique | |
| backup / restore | sauvegarde / restauration | une sauvegarde non testée n'est pas fiable |
| RTO (recovery time objective) | durée maximale d'interruption admissible | |
| RPO (recovery point objective) | perte de données maximale admissible | |
| disaster recovery plan (DRP) | plan de reprise d'activité informatique | |
| business continuity plan (BCP) | plan de continuité d'activité | |
| SLA (service level agreement) | accord de niveau de service | engagement chiffré, ex. disponibilité |

### Détection et réponse
| Anglais | Français | Sens / piège |
|---|---|---|
| log | journal | enregistrement horodaté des événements |
| monitoring | supervision | |
| SIEM | système de gestion des événements de sécurité | **sim** |
| SOC (security operations center) | centre des opérations de sécurité | **sok** |
| alert / false positive | alerte / faux positif | alerte déclenchée à tort |
| incident | incident | événement qui affecte la sécurité |
| breach | violation, compromission | **brich**. *data breach* = fuite de données |
| incident response | réponse à incident | |
| containment | confinement | limiter la propagation |
| eradication | éradication | supprimer la cause |
| recovery | rétablissement | remettre en service |
| root cause | cause racine | cause initiale du problème |
| lessons learned | retour d'expérience | |
| indicator of compromise (IOC) | indicateur de compromission | trace qui révèle une intrusion |
| forensics | investigation numérique | fo-**ren**-siks |

## 2. Phrases-types pour un rapport ou une réponse de cas

Pour décrire :
- « The incident was detected by the monitoring system at 02:15. »
- « The attacker gained access through an exposed administration interface. »
- « The root cause was a missing security patch. »

Pour raisonner :
- « This increased the risk because the servers were not segmented. »
- « As a result, the service was unavailable for four hours. »
- « However, the backup had never been tested. »

Pour recommander :
- « We recommend enforcing multi-factor authentication for all administrators. »
- « The company should apply the principle of least privilege. »
- « In the short term, … ; in the long term, … »

## 3. Étude de cas n° 1 : « The unpatched gateway »

*Texte écrit par MINERVE à titre d'entraînement. Entreprise et événements fictifs.*

> **Company profile.** Nordic Logistics is a mid-sized company with about 400 employees. Its infrastructure includes two data centres, a remote access gateway for staff working from home, and a customer portal hosted in the cloud.
>
> **The incident.** On a Monday morning, the monitoring system raised an alert about an unusual number of failed logins on the remote access gateway. The security team investigated and found that the gateway was running a version of its software that had been missing a security patch for three months. The patch had been released by the vendor, but the change had been postponed twice because the operations team feared downtime.
>
> An attacker had used the vulnerability to log in without valid credentials and had moved to a file server, because the internal network was not segmented. The attacker copied some internal documents before the team disconnected the gateway. The customer portal was not affected.
>
> **The response.** The team disconnected the gateway, changed the passwords of the administrators and restored the file server from the previous night's backup. Service for remote staff was unavailable for six hours. The management then asked the security team for a report with recommendations.

### Questions (réponds en anglais, en phrases complètes)
1. What triggered the first alert?
2. Explain why the attacker was able to access the file server.
3. The operations team postponed the patch twice. Why, and was this a good decision? Justify your answer.
4. Identify two weaknesses in the company's infrastructure management.
5. Write three recommendations for the management. For each one, explain the benefit in one sentence.
6. The management asks: "How can we avoid choosing between security and availability?" Answer in 80 to 100 words.

<details>
<summary>Éléments de réponse (à ouvrir après avoir répondu)</summary>

1. The monitoring system raised an alert about an unusual number of failed logins on the remote access gateway.
2. Because the internal network was not segmented, so the attacker could move from the gateway to the file server.
3. The team feared downtime when applying the change. It was not a good decision, because it left a known vulnerability open for three months, and the incident caused six hours of unavailability, which is probably worse than a planned short maintenance.
4. Any two of: poor patch management (a three-month delay); no network segmentation; no process balancing security and availability; possibly insufficient monitoring before the incident (the alert came only after the attack began).
5. Example: *Apply security patches within a defined deadline, so that known vulnerabilities do not stay open.* / *Segment the network, so that a compromised system cannot reach the whole infrastructure.* / *Test backups regularly, so that restoration is fast and reliable.* / *Enforce multi-factor authentication on the gateway, so that stolen or bypassed credentials are not enough.* (Une recommandation sans bénéfice expliqué perd des points.)
6. Modèle : « Security and availability can be reconciled through planning. The company should schedule regular maintenance windows, test patches in a staging environment first, and use redundant systems so that one component can be updated while another keeps serving users. In addition, a clear change-management process with defined deadlines would prevent patches from being postponed indefinitely. » (≈ 70 mots : à étoffer pour atteindre 80 à 100.)

Ce que le correcteur regarde, probablement : (a) as-tu répondu à la question posée ? (b) as-tu justifié ? (c) tes phrases sont-elles complètes et compréhensibles ? (d) le vocabulaire est-il adapté ? À confirmer avec la grille de ton école.
</details>

## 4. À faire cette semaine
1. Apprends 10 termes de la section 1 (pas plus), écris pour chacun une phrase à toi.
2. Réponds par écrit aux six questions **avant** d'ouvrir les éléments de réponse, puis envoie-moi tes réponses dans la PR : je te les corrige.
3. Demande à ton école la grille de notation et un sujet précédent.
