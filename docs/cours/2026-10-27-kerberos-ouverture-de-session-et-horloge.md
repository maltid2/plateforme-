# Fiche — Ce que Kerberos échange réellement à l'ouverture de session, et pourquoi une horloge décalée casse tout

Piste : Active Directory et Windows Server (rotation du mardi). Lecture : 25 à 30 minutes, exercice compris. Pas de tutoriel : le mécanisme et les mots exacts.

## 0. Calibrage de la piste (3 questions, avant de lire la suite)

C'est la première fiche de cette piste : ta réponse fixe le niveau des suivantes. Réponds en commentaire de la PR #47 ou directement dans notre conversation, en une ou deux phrases chacune. « Je ne sais pas » est une réponse utile.

1. (Facile) À quoi sert un contrôleur de domaine, et quel rôle installe-t-on sur Windows Server pour en créer un ?
2. (Moyen) Dans ton script de création d'utilisateurs, chaque compte reçoit un `SamAccountName` et un `UserPrincipalName`. Quelle est la différence, et dans quelles situations voit-on l'un ou l'autre ?
3. (Difficile) Un utilisateur tape un mot de passe **correct** mais l'ouverture de session échoue, alors que ses collègues se connectent normalement. Cite deux causes **autres que le mot de passe** que tu vérifierais, et explique pourquoi.

Résultat du calibrage : **en attente de ta réponse** (noté dans `docs/cours/README.md`).

## 1. Pourquoi ce mécanisme, et ce qu'il change dans ton diagnostic

Dans ton lab (`Read Me Active Directory` : Windows Server 2019, domaine `laplateforme.io`, utilisateurs créés par script), l'ouverture de session d'un utilisateur ne « compare » pas un mot de passe à une base à chaque fois. Elle suit un échange précis avec le contrôleur de domaine. Sur le terrain, trois symptômes viennent de là : « mot de passe correct mais refusé », « ça marche sur un poste et pas sur l'autre » et « ça cassait depuis qu'on a restauré la machine virtuelle » (ancienne horloge). Si tu sais lire l'échange et l'événement qu'il laisse sur le contrôleur de domaine, tu passes de « essayez de redémarrer » à une cause précise.

## 2. Le mécanisme, étape par étape

**Les trois acteurs.** D'après la documentation Microsoft (lue le 2026-10-27) : le client qui agit pour un principal de sécurité, le service que ce principal veut atteindre, et le **KDC** (*Key Distribution Center*) auquel les deux font confiance. « In Windows Server, the KDC runs on every domain controller and uses the domain's Active Directory Domain Services database as its account database. » Un *principal de sécurité* est une identité (utilisateur, ordinateur, service). Le domaine Active Directory joue le rôle de ce que Kerberos appelle un **domaine d'authentification** (*realm*).

**Étape 1 — Obtenir le billet d'identité (échange AS).** À l'ouverture de session, le client contacte le KDC « to prove the user's identity and obtain a ticket-granting ticket (TGT) ». Il envoie une demande (*KRB_AS_REQ*) qui contient une preuve d'identité appelée **pré-authentification** : par défaut un **horodatage chiffré** avec une clé tirée du mot de passe (type *PA-ENC-TIMESTAMP*, que la documentation décrit comme « the normal type for standard password authentication »). Le KDC déchiffre avec la clé qu'il connaît, vérifie que l'horodatage est **proche de son heure**, et si tout va bien répond par un **TGT** (billet d'octroi de billets). Le client le range dans son cache de billets et le réutilise « until the ticket expires ».

**Étape 2 — Obtenir un billet pour un service (échange TGS).** Pour joindre un service (partage de fichiers, base SQL…), « the client presents its TGT to the KDC and requests a service ticket for that specific service » (demande *KRB_TGS_REQ*). Le KDC répond avec un **billet de service**.

**Étape 3 — Présenter le billet au service (échange AP).** Le client présente le billet de service directement au serveur visé (*KRB_AP_REQ*). « Because the ticket already contains the information that the service needs to verify the client's identity, the service can authenticate the client without contacting a domain controller for each connection » (sauf validation du PAC, voir plus bas). Le service déchiffre le billet avec **sa** clé secrète.

**Pourquoi l'horloge compte.** Pour empêcher les **attaques par rejeu** (*replay attacks*, où un justificatif intercepté est renvoyé tel quel), Kerberos utilise des horodatages : « For time stamps to work properly, the clocks of the client and the domain controller need to be in sync as much as possible ». Le paramètre « Maximum tolerance for computer clock synchronization » fixe l'écart maximal accepté ; sa valeur par défaut est de **5 minutes** (valeur effective par défaut sur un contrôleur de domaine), et Microsoft recommande de la laisser à 5 minutes. Au-delà, le KDC refuse avec l'erreur **KRB_AP_ERR_SKEW (code 0x25)** : « The clock skew is too great ».

**Les autres éléments utiles à connaître.**
- **PAC** (*Privilege Attribute Certificate*) : données d'autorisation (appartenances aux groupes) portées dans le billet ; c'est ce qui permet au service de décider ce que l'utilisateur a le droit de faire. Kerberos **authentifie** ; l'**autorisation** vient de ces données et des droits du service.
- **SPN** (*Service Principal Name*) : le nom sous lequel un service est enregistré dans l'annuaire ; le client le demande dans l'échange TGS. Un SPN en double provoque l'erreur 0x8 (« This error occurs if duplicate principal names exist »).
- **krbtgt** : compte spécial du domaine, utilisé par le KDC pour émettre les billets ; son SID se termine par 502.
- **Annuaire et DNS** : le client doit **trouver** un contrôleur de domaine, ce qu'il fait par le DNS (enregistrements de service) ; c'est pourquoi un problème de DNS ressemble souvent à un problème de Kerberos (cité de mémoire, non vérifié aujourd'hui, comme le port 88 que le KDC écoute).

## 3. La lecture du réel

Extrait authentique de la documentation Microsoft de l'événement **4768** (« A Kerberos authentication ticket (TGT) was requested », lu le 2026-10-27), tel que le contrôleur de domaine l'écrit dans son journal Sécurité (valeurs d'exemple de la documentation, domaine fictif `CONTOSO.LOCAL`) :

```
EventID           4768
Computer          DC01.contoso.local
TargetUserName    duser
TargetDomainName  CONTOSO.LOCAL
ServiceName       krbtgt
TicketOptions     0x40810010
Status            0x0
TicketEncryptionType  0x12
PreAuthType       2
IpAddress         ::ffff:172.27.248.104
IpPort            54393
```

| Champ | Lecture |
|---|---|
| `EventID` 4768 | « généré chaque fois que le KDC émet un TGT » ; **uniquement sur un contrôleur de domaine** |
| `TargetUserName` / `TargetDomainName` | le compte pour lequel le TGT est demandé (un compte d'ordinateur se termine par `$`) et son domaine d'authentification |
| `ServiceName` : `krbtgt` | le service qui émet les TGT |
| `TicketOptions` : `0x40810010` | indicateurs de billet ; d'après la documentation : *Forwardable, Renewable, Canonicalize, Renewable-ok* |
| `Status` : `0x0` | code de résultat ; `0x0` = succès. Un autre code = échec, et c'est **la** zone à lire |
| `TicketEncryptionType` : `0x12` | chiffrement du billet : **AES256-CTS-HMAC-SHA1-96** |
| `PreAuthType` : `2` | pré-authentification par **horodatage chiffré** (PA-ENC-TIMESTAMP) : le cas normal avec mot de passe |
| `IpAddress` / `IpPort` | adresse et port **du client** qui a fait la demande (utile pour retrouver le poste) |

Codes de résultat les plus utiles au support (tableau Microsoft, même page) :

| Code | Nom | Sens |
|---|---|---|
| `0x6` | KDC_ERR_C_PRINCIPAL_UNKNOWN | le compte n'existe pas |
| `0x12` | KDC_ERR_CLIENT_REVOKED | compte désactivé, expiré ou verrouillé |
| `0x17` | KDC_ERR_KEY_EXPIRED | le mot de passe a expiré, il faut le changer |
| `0x18` | KDC_ERR_PREAUTH_FAILED | mauvais mot de passe ; **cet échec n'apparaît pas en 4768** mais en **4771** (« Kerberos pre-authentication failed ») |
| `0x25` | KRB_AP_ERR_SKEW | écart d'horloge trop grand |
| `0x21` | KRB_AP_ERR_TKT_NYV | billet pas encore valide (« most probable cause is that the clocks on the KDC and the client are not synchronized ») |

Remarque : la documentation précise que 4768 n'est **pas** généré pour les codes `0x10` et `0x18` ; l'événement 4771 est généré à la place. Un mauvais mot de passe se cherche donc dans **4771**, pas dans 4768.

## 4. Ce qui casse, et le symptôme

| Défaut | Symptôme sur le terrain | Comment remonter à la cause |
|---|---|---|
| **Écart d'horloge** > 5 min entre client et contrôleur de domaine | connexion refusée avec un mot de passe correct ; accès à un partage qui échoue ; souvent sur **une seule machine** | code `0x25` ; comparer l'heure du poste et du contrôleur de domaine |
| Machine virtuelle restaurée ou revenue d'un instantané | tout cassait « du jour au lendemain » : l'horloge de la VM est restée dans le passé | l'heure de la VM, avant tout |
| Mot de passe expiré ou à changer | demande de changement, ou refus selon le contexte | code `0x17` |
| Compte désactivé, expiré, verrouillé | refus net | code `0x12` |
| Mauvais mot de passe | refus | événement **4771** (pas 4768), code `0x18` |
| Nom d'utilisateur inexistant (faute de frappe, mauvais domaine) | refus | code `0x6` ; l'accumulation de `0x6` sur un même compte peut aussi trahir une énumération de comptes (recommandation de la documentation) |
| DNS qui renvoie une mauvaise adresse | le client contacte le mauvais serveur | la documentation cite des erreurs `0x29` et `0x44` liées à un DNS erroné |
| SPN dupliqué | échec d'accès à un service précis | code `0x8` |

Hypothèse à vérifier dans ton lab (je ne l'ai **pas** observée) : ton script crée les comptes avec `-ChangePasswordAtLogon $true`. À la première ouverture de session d'un de ces utilisateurs, tu devrais voir côté contrôleur de domaine un événement indiquant que le mot de passe doit être changé (code `0x17`) avant l'événement de succès.

## 5. Vocabulaire du jour (14 termes)

| Français | Anglais | Définition exacte / piège |
|---|---|---|
| contrôleur de domaine | *domain controller (DC)* | serveur qui héberge l'annuaire et le KDC |
| centre de distribution de clés | *Key Distribution Center (KDC)* | service Kerberos qui émet les billets ; sur un DC Windows |
| billet d'octroi de billets | *ticket-granting ticket (TGT)* | preuve d'identité réutilisable, obtenue à l'ouverture de session |
| billet de service | *service ticket* | billet pour **un** service précis |
| domaine d'authentification | *realm* | l'ensemble qui partage la même base Kerberos ; le domaine AD en est un |
| principal | *principal* | identité authentifiable : utilisateur, ordinateur, service |
| nom de principal de service | *Service Principal Name (SPN)* | nom d'un service dans l'annuaire |
| pré-authentification | *pre-authentication* | preuve fournie avant l'émission du TGT (horodatage chiffré) |
| écart d'horloge | *clock skew* | différence d'heure entre deux machines |
| rejeu | *replay (attack)* | réutilisation d'un justificatif intercepté |
| authentification / autorisation | *authentication / authorization* | prouver qui on est / décider ce qu'on a le droit de faire. Ne pas confondre |
| `SamAccountName` | *SAM account name* | nom de connexion « court » (`utilisateur`), historique ; avec le domaine : `DOMAINE\utilisateur` |
| `UserPrincipalName` | *UPN* | nom au format `utilisateur@domaine` |
| authentification mutuelle | *mutual authentication* | le client vérifie aussi le serveur ; ce que NTLM ne permet pas, d'après la documentation |

Faux amis et approximations : « ticket » désigne le billet Kerberos, pas un ticket de support ; « le mot de passe est expiré » (0x17) ≠ « le compte est verrouillé » (0x12) ; « Kerberos autorise l'accès » est faux : Kerberos **authentifie**, c'est le service qui autorise.

## 6. Comment le dire juste

**Pour un collègue :** « Le mot de passe est bon, mais le contrôleur de domaine refuse avec un écart d'horloge : le poste a plus de cinq minutes de décalage, Kerberos rejette l'horodatage. »

**Pour un prestataire ou un éditeur** (FR puis EN) :
- FR : « Le journal Sécurité du contrôleur de domaine montre des 4768 avec le code 0x25 pour les postes de ce site. Pouvez-vous confirmer la source de temps du domaine ? »
- EN: "The domain controller's Security log shows 4768 events with result code 0x25 for the machines on this site. Could you confirm the domain's time source?"

**Dans un ticket** (FR puis EN) :
- FR : « Symptôme : ouverture de session refusée malgré un mot de passe correct, poste X uniquement. Constat : écart d'horloge supérieur à 5 minutes entre le poste et le DC (code 0x25). Action : resynchroniser l'heure du poste ; vérifier la source de temps de la machine virtuelle. »
- EN: "Symptom: logon denied despite a correct password, workstation X only. Finding: clock skew over 5 minutes between the workstation and the DC (result code 0x25). Action: resynchronize the workstation clock; check the virtual machine's time source."

## 7. Exercice de diagnostic (20 à 30 minutes, **dans ton laboratoire** : ta VM Windows Server 2019, jamais sur le réseau de l'employeur)

Trois extraits **inventés par MINERVE** (journal Sécurité d'un contrôleur de domaine fictif, un champ chacun) :

```
A) 4768  TargetUserName=jdupont   Status=0x25  IpAddress=192.168.10.54
B) 4771  TargetUserName=mmartin   Status=0x18  IpAddress=192.168.10.77
C) 4768  TargetUserName=pdurand   Status=0x12  IpAddress=192.168.10.31
```
1. Pour chaque ligne, donne la cause probable et la **première vérification**.
2. Pourquoi la ligne B est-elle un événement **4771** et pas un 4768 ?
3. Dans ton lab : modifie l'heure d'un poste joint au domaine de **plus de 5 minutes** (par exemple dans la VM cliente, hors réseau de l'employeur), tente une ouverture de session et note l'événement obtenu sur le contrôleur de domaine. Rétablis ensuite l'heure.

<details>
<summary>Solution</summary>

1. A) `0x25` : écart d'horloge trop grand pour `jdupont` ; compare l'heure du poste 192.168.10.54 avec celle du DC. B) `0x18` : mauvais mot de passe pour `mmartin` ; vérifie la saisie (clavier, majuscule) et si ce compte est visé par plusieurs tentatives. C) `0x12` : compte de `pdurand` désactivé, expiré ou verrouillé ; regarde l'état du compte dans l'annuaire.
2. Parce que `0x18` (échec de pré-authentification) « cannot occur in event 4768 » : l'événement correspondant est le 4771.
3. Observation attendue (à confirmer dans ton lab, je ne l'ai pas testée) : un événement avec le code `0x25` côté contrôleur de domaine. Si le poste avait la même heure que le DC, tu verrais un succès (`0x0`).
</details>

## 8. Révision espacée

Fiche de la veille (2026-10-26) : le commutateur. Il n'existe pas de fiche vieille de sept jours ; je reprends une question de la fiche du 22 octobre.

1. Qu'apprend un commutateur dans une trame, l'adresse source ou la destination, et que fait-il d'une destination inconnue ?
2. Que fait un client DHCP à T1 et à T2 ?
3. Dans l'ordre, quelles sont les quatre étapes entre une URL et une réponse ?

<details>
<summary>Réponses</summary>

1. L'adresse **source** ; une destination inconnue est inondée sur tous les ports du VLAN sauf celui d'arrivée.
2. À T1 (0,5 × bail par défaut), il demande une prolongation à son serveur d'origine ; à T2 (0,875 × bail), il diffuse la demande à n'importe quel serveur.
3. DNS, TCP, TLS, HTTP.
</details>

## 9. Trois questions de contrôle

1. Pourquoi Kerberos tolère-t-il seulement un écart d'horloge de quelques minutes ?
2. Où cherches-tu un mauvais mot de passe : événement 4768 ou 4771 ?
3. Quelle est la différence entre un TGT et un billet de service ?

<details>
<summary>Réponses</summary>

1. Pour empêcher le rejeu : la pré-authentification est un horodatage chiffré ; si l'écart dépasse la tolérance (5 minutes par défaut), le KDC refuse (0x25).
2. Dans **4771** (code 0x18), pas dans 4768.
3. Le TGT prouve l'identité auprès du KDC et se réutilise ; le billet de service est émis en échange du TGT pour **un** service précis et se présente à ce service.
</details>

## 10. Remarque hygiène sur ton lab (hors cours)

En lisant tes fichiers pour cette fiche, j'ai remarqué trois points. Je **ne reproduis aucune valeur**.
- **Mot de passe en clair dans un script commité :** `script ajout utilisateur Active Directory`, **ligne 5** (définition du mot de passe) et **ligne 58** (affichage du mot de passe à l'écran).
- **Mots de passe de base de données dans le dépôt :** `docker-compose.yml`, **lignes 10 et 13** (`MYSQL_ROOT_PASSWORD` et `MYSQL_PASSWORD`).
- **Données qui ressemblent à des personnes réelles :** `fichier csv` contient des noms, prénoms et fonctions ; je ne sais pas s'ils sont fictifs (énoncé d'exercice) ou réels. Si le dépôt est public et que ce sont de vraies personnes, c'est un sujet de protection des données.
Dans un lab c'est un moindre mal ; dans un environnement réel, un mot de passe initial codé en dur est un défaut. Pour comprendre le mécanisme de la fiche, retiens que le script met `ChangePasswordAtLogon` à vrai : l'utilisateur doit en choisir un autre à sa première connexion, ce qui limite l'effet du mot de passe initial.

## 11. Sources (consultées le 2026-10-27)

- Microsoft Learn, « Kerberos authentication overview in Windows Server » : https://learn.microsoft.com/en-us/windows-server/security/kerberos/kerberos-authentication-overview — rôle du KDC sur chaque contrôleur de domaine, TGT, billet de service, authentification mutuelle.
- Microsoft Learn, « 4768(S, F) A Kerberos authentication ticket (TGT) was requested » : https://learn.microsoft.com/en-us/windows/security/threat-protection/auditing/event-4768 — champs de l'événement, exemple, codes de résultat (0x6, 0x12, 0x17, 0x18, 0x21, 0x25…), types de pré-authentification, relation avec l'événement 4771.
- Microsoft Learn, « Maximum tolerance for computer clock synchronization » : https://learn.microsoft.com/en-us/windows/security/threat-protection/security-policy-settings/maximum-tolerance-for-computer-clock-synchronization — tolérance de 5 minutes par défaut, rejeu et horodatages.
- Dépôt : `Read Me Active Directory`, `script ajout utilisateur Active Directory`, `fichier csv`, `docker-compose.yml`.
- Non vérifié aujourd'hui (de mémoire) : la durée de vie par défaut des billets, le port d'écoute du KDC, la découverte du contrôleur de domaine par enregistrements DNS de service, le chiffrement du TGT avec la clé de `krbtgt`, et le comportement exact de `ChangePasswordAtLogon` côté événements.
