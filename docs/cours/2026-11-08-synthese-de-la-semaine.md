# Synthèse de la semaine du 2 au 8 novembre 2026

Dimanche : pas de nouveau sujet de fond. Les six fiches de la semaine regroupées par thème, un bloc d'**anglais** tiré de leur contenu (la rotation quotidienne n'en contient pas, or ton examen est le 4 janvier 2027), puis le plan mis à jour. Lecture : 20 à 25 minutes.

## 1. Les fiches de la semaine, par thème

### Réseau, poste de travail
| Fiche | Le mécanisme à savoir expliquer |
|---|---|
| [2026-11-02 Étiquette 802.1Q et VLAN natif](2026-11-02-etiquette-8021q-et-vlan-natif.md) | Étiquette de 4 octets entre l'adresse source et Type/Longueur (TPID 0x8100, priorité 3 bits, CFI 1 bit, VID 12 bits) ; le VLAN natif circule **sans** étiquette ; un VLAN natif différent aux deux bouts fait « fuir » les trames natives vers l'autre VLAN, le trunk restant actif. |
| [2026-11-07 DNS côté poste](2026-11-07-dns-cote-poste-cache-et-ordre-d-interrogation.md) | Cache du résolveur (fichier Hosts + réponses précédentes, **y compris négatives**) puis escalade d'interrogation des serveurs ; `/flushdns` vide le cache du poste, pas celui du serveur. Durées documentées pour Windows Server 2008. |

### Active Directory et SQL
| Fiche | Le mécanisme à savoir expliquer |
|---|---|
| [2026-11-03 NTLM ou Kerberos, événement 4624](2026-11-03-ntlm-ou-kerberos-lire-l-evenement-4624.md) | Negotiate essaie Kerberos puis se replie sur NTLM ; le champ `Authentication Package` du 4624 dit lequel a servi ; NTLM est normal hors domaine. |
| [2026-11-04 SQL : jointures et EXPLAIN](2026-11-04-sql-jointures-et-explain.md) | Une table directrice, puis une recherche par ligne dans la suivante ; `eq_ref` = index unique ; un `ALL` sur une table **jointe** multiplie le coût ; `rows` est une estimation. |

### Sécurité de l'infrastructure
| Fiche | Le mécanisme à savoir expliquer |
|---|---|
| [2026-11-05 WordPress, TOCTOU](2026-11-05-wordpress-fenetre-de-mise-a-jour-toctou.md) | L'état change entre la vérification et l'usage ; ici un dossier de travail de mise à jour, web-accessible et à nom devinable ; le correctif 7.1.4 rend le nom aléatoire, bloque le listage et refuse de recopier `wp-config.php`. Le scénario complet est une **déduction** de ma part. |
| Veille du 2026-11-07 (SonicWall) | Même famille que la semaine dernière (Ivanti) : un **VPN exposé** dont l'authentification est contournée. Ici, SAML contourné avec des identifiants valides d'une autre méthode ; versions seulement via la presse (avis éditeur illisible). |

### Projet
| Fiche | Le mécanisme à savoir expliquer |
|---|---|
| [2026-11-06 Relire la PR #53](2026-11-06-relire-la-pr-53-isoler-un-cout.md) | Isoler un coût **par retrait** ; `backdrop-filter`, masque et transparence recomposés à chaque image ; couplage par une classe sur `body` ; lire la section « contrôles non effectués » ; hypothèse à tester du décalage de mise en page quand la barre de défilement disparaît. |

## 2. Fil rouge de la semaine

1. **Le chemin qu'on ne voit pas.** Trame sans étiquette, repli NTLM, cache négatif, dossier de travail de mise à jour : à chaque fois, le symptôme vient d'un chemin **implicite**. Le diagnostic consiste à rendre ce chemin visible (colonne « Native vlan », champ `Authentication Package`, `/displaydns`, `EXPLAIN`).
2. **Ce qui est déclaré compte autant que ce qui est mesuré.** `rows` est une estimation ; la PR #53 liste ce qu'elle n'a pas vérifié ; mes fiches marquent ce qui est « de mémoire ». C'est la même discipline.
3. **Un accès distant qui s'ouvre est une porte.** Ivanti, SonicWall : des équipements d'accès exposés. Pour chacun, la question utile reste : version exacte, exposition, journaux.

## 3. Mise en situation : un diagnostic qui croise la semaine

Un collaborateur dit : « Depuis ce matin, je n'accède plus à l'application interne par son nom ; par l'adresse IP, ça marche. »
- **Poste** : que montre `ipconfig /displaydns` pour ce nom ? Entrée négative ?
- **Réseau** : le poste est-il dans le bon VLAN ? Le trunk du commutateur d'accès est-il d'accord sur le VLAN natif ?
- **Active Directory** : sur le serveur applicatif, un 4624 de type 3 montre-t-il NTLM par l'IP et Kerberos par le nom ?
- **SQL** : si l'application répond mais lentement, le plan de la requête montre-t-il un `ALL` sur la table jointe ?

Écris, en quatre phrases, l'ordre de tes vérifications et pourquoi.

<details><summary>Une réponse possible</summary>

D'abord le plus bas et le moins coûteux : adresse et VLAN du poste, puis résolution de nom (cache du poste, serveurs DNS de chaque carte), puis authentification (Kerberos ou repli NTLM) côté serveur, et seulement ensuite la base de données si l'application est lente mais joignable.
</details>

## 4. Anglais de la semaine (bloc du dimanche)

Priorité de ton plan : l'anglais écrit B2 pour le 4 janvier 2027. La rotation des fiches ne contient pas d'anglais ; ce bloc comble le trou en réutilisant la matière de la semaine.

### 4.1 Quinze termes de la semaine
| FR | EN | Remarque |
|---|---|---|
| étiquette | *tag* | *tagged / untagged frame* |
| VLAN natif | *native VLAN* | *native VLAN mismatch* |
| ouverture de session | *logon* | piège : *login* (usage courant) / *logon* (Microsoft) |
| repli | *fallback* | *to fall back to NTLM* |
| jointure | *join* | *inner join / left join* |
| balayage complet | *full table scan* | |
| condition de concurrence | *race condition* | |
| contournement (d'une protection) | *bypass* | nom et verbe : *to bypass authentication* ; piège : ≠ *workaround* (solution de contournement) |
| solution de contournement | *workaround* | |
| exploitation active | *active exploitation* | |
| correctif | *fix / patch* | *to patch* = appliquer un correctif |
| version corrigée | *fixed version* | |
| exposé sur Internet | *internet-facing* | |
| délai dépassé | *timeout* | |
| vider le cache | *to flush the cache* | piège : *flush* ≠ rincer |

### 4.2 Un mini texte à trous (9 trous) — écris les mots, puis vérifie
Le début reprend la **description NVD réelle** de CVE-2026-19868 (lue le 2026-11-07), dont j'ai ôté quatre mots. La suite est **ma paraphrase** de l'article de presse, pas une citation. Écris le mot qui manque.

> An authentication (1)\_\_\_\_\_ vulnerability in the SonicOS SSLVPN service may allow a user with valid credentials for an (2)\_\_\_\_\_ authentication method to (3)\_\_\_\_\_ SAML authentication controls. Successful (4)\_\_\_\_\_ may also bypass SAML-enforced multi-factor authentication (MFA).
> SonicWall says that no (5)\_\_\_\_\_ are available, so customers are urged to (6)\_\_\_\_\_ to the latest release as soon as (7)\_\_\_\_\_. CISA has added the flaw to its Known (8)\_\_\_\_\_ Vulnerabilities catalog, which means it has been exploited (9)\_\_\_\_\_ the wild.

<details><summary>Réponses</summary>

(1) enforcement · (2) alternate · (3) bypass · (4) exploitation (trous 1 à 4 : mots de la description NVD) · (5) workarounds · (6) upgrade (ou *update*) · (7) possible · (8) Exploited · (9) in. Pièges : *workaround* (solution de contournement) et *bypass* (contourner une protection) ne sont pas synonymes ; *as soon as possible*, pas *as soon as possibly*. Si ta réponse diffère mais reste correcte, note-la.
</details>

### 4.3 Consigne de rédaction (pour le test blanc n°1 d'aujourd'hui)
Écris **120 à 150 mots** en anglais : « Explain to a colleague, in a ticket, why a VPN that is exposed to the Internet should be patched first. » Utilise au moins cinq mots de 4.1. **Envoie-moi ta copie dans la conversation** ; je la corrigerai avec la grille du plan (instructions et contenu, ton, enchaînement des idées, lexique, grammaire), sans la noter sur 70 tant que je n'ai pas le sujet complet de ton école.

## 5. Mise à jour du plan

- **Aujourd'hui, dimanche 8 novembre** : test blanc d'anglais n°1 (voir `anglais-plan-a2-b2-janvier.md`). **Aucune copie reçue à ce jour.** Je ne peux pas estimer ton niveau d'anglais sans écrit.
- **Lundi 9 novembre — réseau** : élection du pont racine de l'arbre recouvrant (STP) : identifiants de pont, coûts, états des ports, convergence.
- **Mardi 10 novembre — Active Directory** : le sujet dépendra de tes réponses au calibrage. Sans réponse, je poursuis au niveau de départ (par exemple : de quoi est faite la résolution d'un contrôleur de domaine par le poste, lien avec le DNS de samedi). **C'est aussi le jour du Patch Tuesday Microsoft** (mon calcul) : la veille en parlera si l'avis est lisible.
- **Mercredi 11 novembre — SQL** : même règle ; sujet probable : agrégations et `GROUP BY`, ou transactions et verrous.
- **Jeudi 12 novembre — sécurité de l'infrastructure** : mécanisme de l'avis marquant de la semaine (candidat : SonicWall/SAML, **si** l'avis éditeur devient lisible ; sinon un autre avis lu à la source).
- **Vendredi 13 novembre — projet** : la fusion « refonte visuelle SentinelScope » vue dans `main` (non lue à ce jour).
- **Samedi 14 novembre — poste de travail et support** : à choisir (stratégies de groupe / `gpresult`, ou mises à jour Windows).
- **Statut des calibrages :** Active Directory et SQL toujours **en attente** ; je n'ai trouvé aucun commentaire de ta part sur la PR #47. Réponds dans la conversation, une ligne par question.

## 6. Sources

Chaque affirmation technique renvoie aux sources des fiches liées. Consultés le 2026-11-08 : catalogue CISA KEV (`catalogVersion` 2026.11.06, inchangé depuis hier) ; état des PR et issues du dépôt (API GitHub). La description NVD de CVE-2026-19868 (§4.2) a été lue le 2026-11-07.
