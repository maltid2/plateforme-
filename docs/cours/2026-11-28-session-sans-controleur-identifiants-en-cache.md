# Fiche — Ouvrir une session sans contrôleur de domaine : les identifiants mis en cache

*Piste : poste de travail et support · samedi 28 novembre 2026 · lecture : 25 min*

> **Rappel :** observations sur un poste de **laboratoire** (VM Windows jointe à un domaine de test). Ne modifie pas le nombre d'ouvertures de session en cache, ne débranche pas des postes et ne cherche pas les informations en cache sur le parc de ton employeur. Lire l'état d'un poste en dépannage est de l'exploitation normale.

## 1. Pourquoi ce mécanisme
Cas de support fréquent : un portable en télétravail, sans VPN, **s'ouvre quand même** ; ou au contraire « le système ne peut pas vous connecter maintenant ». La différence vient du **cache d'ouverture de session** : le poste a-t-il déjà mémorisé ce compte ? Fiche du 10 novembre : le poste cherche un contrôleur de domaine (DC locator) ; ici, **que fait-il quand il n'en trouve aucun ?**

## 2. Le mécanisme (source : Microsoft Learn, lue le 2026-11-28)
- Les informations d'ouverture de session d'un compte de domaine peuvent être **mises en cache localement** ; si aucun contrôleur n'est joignable à une ouverture ultérieure, l'utilisateur peut **quand même se connecter**.
- Le réglage **« Interactive logon: Number of previous logons to cache (in case domain controller is not available) »** fixe **le nombre d'utilisateurs distincts** dont les informations sont mises en cache. Valeur **de 0 à 50**, ou « non défini ».
- **Remplacement :** avec une valeur de 10, le 11ᵉ utilisateur qui ouvre une session **écrase la plus ancienne** entrée en cache.
- **Pas d'expiration :** « the cached account information does not expire, but can get overwritten ».
- **Valeurs par défaut (tableau de la page) :** poste client et serveur membre : **10 ouvertures** ; contrôleur de domaine : **sans effet** ; la stratégie par défaut du domaine : non définie.
- **Sécurité :** les identifiants des utilisateurs qui ouvrent une session sur la console sont mis en cache sur la machine ; quelqu'un qui accède au système de fichiers pourrait tenter une attaque par force brute ; Windows atténue en **chiffrant** l'information et en la gardant dans les **ruches de registre**. Les **bases de référence de sécurité Windows ne recommandent pas de configurer** ce réglage.
- **Application :** le changement prend effet **sans redémarrage** (enregistré localement ou distribué par stratégie de groupe). Emplacement : `Configuration ordinateur\Paramètres Windows\Paramètres de sécurité\Stratégies locales\Options de sécurité`.

## 3. Lecture du réel
Messages authentiques de la page :
- **Compte en cache, DC injoignable :** « A domain controller for your domain couldn't be contacted. You've been logged on using cached account information. Changes to your profile since you last logged on might not be available. »
- **Compte non en cache, DC injoignable :** « The system can't log you on now because the domain DOMAIN NAME isn't available. »
Lecture champ par champ : le premier message est une **réussite dégradée** (la session s'ouvre, mais les changements de profil depuis la dernière ouverture en ligne peuvent manquer) ; le second est un **échec** : ce compte n'a jamais été mis en cache sur ce poste, ou a été écrasé.

## 4. Ce qui casse, et le symptôme
| Symptôme | Cause plausible |
|---|---|
| « Le système ne peut pas vous connecter maintenant » à domicile | première ouverture sur ce poste, ou entrée écrasée (plus de N autres utilisateurs depuis) |
| Session ouverte mais ressources internes absentes | ouverture « en cache » : aucun DC contacté |
| Poste partagé où un utilisateur occasionnel « perd » son accès hors ligne | entrées écrasées (valeur basse, nombreux utilisateurs) |
| Valeur 0 | aucune ouverture hors ligne possible *(déduction de la plage 0-50 ; non lue explicitement)* |
**Non couvert par la page, à ne pas inventer :** ce qui se passe si le mot de passe du domaine change pendant que le poste est hors ligne. Question à vérifier en laboratoire.
Remonter : DC joignable ? (DNS, VPN, fiche du 10 novembre) → le compte a-t-il déjà ouvert une session en ligne sur ce poste ? → combien d'autres comptes depuis ?

## 5. Vocabulaire
| Français | English | Définition / piège |
|---|---|---|
| identifiants mis en cache | cached credentials | informations d'ouverture de session stockées localement |
| ouverture de session interactive | interactive logon | à la console ou en bureau à distance |
| contrôleur de domaine | domain controller | |
| stratégie de sécurité locale | local security policy | |
| bases de référence de sécurité | security baselines | configurations recommandées |
| ruche de registre | registry hive | fichier du registre |
| attaque par force brute | brute-force attack | |
| profil utilisateur | user profile | |
| écrasement | overwrite | l'entrée la plus ancienne remplacée |
| hors ligne | offline | |
| compte de domaine | domain account | ≠ compte local |
| non défini | not defined | **≠ 0** : prend la valeur par défaut du poste |
Faux amis : « cache de mot de passe » ≠ « mot de passe en clair » ; hors ligne ≠ « sans réseau » (le DC suffit à manquer) ; « non défini » ≠ « désactivé ».

## 6. Comment le dire juste
- **Collègue :** « Il n'arrive pas à ouvrir sa session hors VPN : ce compte n'a probablement jamais été mis en cache sur ce portable, ou il a été écrasé. »
- **Prestataire (EN):** "Users can't sign in off the corporate network. Could you confirm the 'Number of previous logons to cache' setting on these laptops and whether it was changed by a GPO?"
- **Ticket (EN):** "User cannot log on while off-VPN: 'The system can't log you on now because the domain isn't available'. Likely no cached logon for this account on this device. Check: first online sign-in on this device, cache count, domain reachability."

## 7. Exercice (VM de laboratoire, 25 min, sans modifier le cache)
Sur une VM de test jointe au domaine : 1) ouvre une session en ligne avec un compte de test ; 2) coupe l'accès au DC (déconnecte la carte virtuelle) ; 3) déconnecte puis reconnecte la session. **Avant de le faire, écris ta prévision** : quel message attends-tu ? Puis refais l'essai avec un second compte de test **jamais utilisé** sur cette VM.
<details><summary>Solution</summary>
Attendu, d'après la page : premier compte, message « You've been logged on using cached account information… » ; second compte, « The system can't log you on now because the domain … isn't available ». **Je n'ai pas rejoué l'exercice** : note ce que tu observes.
</details>

## 8. Révision espacée
Hier (outillage tiers embarqué) : 1) Pourquoi un hook déclaré dans le dépôt est-il sensible ? 2) Que ne dit pas « relu avant installation » ? Il y a sept jours (21 nov, NCSI) : 3) Que vérifie la sonde active ?

## 9. Questions de contrôle
1. Quelle est la valeur par défaut sur un poste client ? 2. Que se passe-t-il à la onzième ouverture avec la valeur 10 ? 3. Pourquoi les bases de référence ne recommandent-elles pas de configurer ce réglage ?
<details><summary>Réponses</summary>
1. 10 ouvertures. 2. La plus ancienne entrée en cache est écrasée. 3. La page ne donne pas la raison ; elle indique seulement la recommandation. Ne pas inventer au-delà.
</details>

## 10. Sources (consultées le 2026-11-28)
- Microsoft Learn, « Interactive logon: Number of previous logons to cache (in case domain controller is not available) » : https://learn.microsoft.com/en-us/windows/security/threat-protection/security-policy-settings/interactive-logon-number-of-previous-logons-to-cache-in-case-domain-controller-is-not-available — valeurs 0-50, défaut 10, remplacement, messages, sécurité.
