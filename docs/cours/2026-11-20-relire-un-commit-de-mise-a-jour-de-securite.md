# Fiche — Relire un commit « mise à jour de sécurité » de tes agents : ce que `npm audit`, le fichier de verrouillage et `^` te disent vraiment

*Piste : projet et développement · vendredi 20 novembre 2026 · lecture : 25 min*

> Matière : le commit `f5295a7` (18 novembre) sur `main`, « chore(deps): Next.js 16.4.2 → 16.4.6 (avis de sécurité publié) », lu le 2026-11-20. Rien n'est exécuté chez ton employeur ; la seule commande lancée est un `npm audit` en lecture sur une copie du fichier de verrouillage.

## 1. Pourquoi ce mécanisme
Tes agents poussent des montées de version. Pour juger la PR, il faut savoir : qu'a-t-on corrigé exactement, **la version installée est-elle bien celle qu'on croit**, et qu'est-ce qui reste ouvert. Le message du commit répond bien à la première question ; les deux autres se vérifient dans les fichiers.

## 2. Le mécanisme
- **`package.json`** déclare des **plages** : `"next": "^16.4.6"`. Selon la documentation semver de npm (lue le 2026-11-20), `^1.2.3` signifie `>=1.2.3 <2.0.0` : les correctifs et les nouveautés compatibles sont permis, pas le majeur suivant. Monter `^16.4.2` en `^16.4.6` relève **le plancher** : plus aucune installation ne peut descendre sous 16.4.6.
- **`package-lock.json`** fige la version **réellement installée** (ici `next` 16.4.6, lue dans le fichier) avec l'adresse de téléchargement. Le fichier de verrouillage, pas `package.json`, dit ce qui tourne.
- **`npm audit`** envoie la liste des paquets et versions de l'arbre au registre, qui répond avec les avis connus (point d'accès « Bulk Advisory »). npm calcule alors des **méta-vulnérabilités** : un paquet est vulnérable parce qu'il dépend d'une version vulnérable (exemple de la doc : `bar` dépend de `foo@^1.1.0`, et seule une version vulnérable de `foo` satisfait la plage). `npm audit fix` réinstalle des versions corrigées **sans changer les plages**, sinon il faut `--force`.
- Le code de sortie est 0 si rien n'est trouvé ; sinon il dépend du niveau configuré.

## 3. Lecture du réel
Extraits du commit (lus) : Next.js 16.4.2 → 16.4.6 ; `source-map-js` 1.2.1 → 1.2.2 (GHSA-68fv-2mgg-jv7q, déni de service, dépendance transitive de postcss) ; « reste un avis non traité : picomatch (ReDoS, GHSA-fc5q-39xc-vjpf) », atteignable par le glob de Tailwind 3 au build, correctif jugé lié à Tailwind 4 ; ajout de `experimental.agentUpgrade: "security"` dans `next.config.mjs` (ligne 57 sur `main`), motivé par un `next build` qui s'interrompait pour afficher la recommandation. **Mes vérifications du 2026-11-20 :** `package.json` sur `main` : `"next": "^16.4.6"` ; fichier de verrouillage : `next` 16.4.6, `source-map-js` 1.2.2, `picomatch` **2.3.2**, `tailwindcss` 3.4.19 ; `npm audit --package-lock-only` sur cette copie : **0 vulnérabilité** (info/faible/modérée/haute/critique).

## 4. Ce qui casse, et le symptôme
- **Contradiction à lever :** le commit dit qu'un avis picomatch reste ouvert, et mon audit du jour n'en rapporte aucun sur le fichier de `main`. Je n'ai pas pu lire l'avis (l'API GitHub me renvoie 403) : je ne sais donc pas si l'avis a évolué, si 2.3.2 est une version corrigée ou si l'audit ne le couvre pas. **À toi de demander à l'agent** : « quel est l'état exact de GHSA-fc5q-39xc-vjpf avec picomatch 2.3.2 ? ».
- **Pas vérifié par moi :** l'identité de l'avis Next.js qui concernait 16.4.2 (commit : « avis de sécurité publié », sans numéro), et le comportement du marqueur `agentUpgrade` (affirmé dans le message du commit).
- Piège général : un audit « propre » dit « aucun avis **connu du registre** », pas « aucune faille ».

## 5. Vocabulaire
| Français | English | Définition / piège |
|---|---|---|
| plage de versions | version range | `^16.4.6` = `>=16.4.6 <17.0.0` |
| fichier de verrouillage | lockfile | version **installée** |
| dépendance transitive | transitive dependency | dépendance d'une dépendance |
| avis de sécurité | security advisory | entrée dans une base (GHSA) |
| méta-vulnérabilité | meta-vulnerability | vulnérable par dépendance |
| déni de service | denial of service (DoS) | |
| ReDoS | ReDoS | expression régulière à coût explosif |
| version corrigée | patched version | |
| correctif de maintenance | patch release | ne change que le dernier chiffre |
| version majeure | major version | peut casser la compatibilité |
| montée de version | version bump | |
| chaîne d'approvisionnement logicielle | software supply chain | |
Faux amis : « audit » npm ≠ audit de sécurité complet ; « corrigé » ≠ « plus vulnérable à tout ».

## 6. Comment le dire juste
- **Collègue / agent :** « Le plancher de Next est relevé à 16.4.6 et le lockfile le confirme ; il reste à expliquer pourquoi picomatch est dit ouvert alors que l'audit est vert. »
- **Prestataire (EN) :** "The lockfile resolves Next.js to 16.4.6 and `npm audit` reports no known advisories; please confirm the status of the picomatch ReDoS advisory with version 2.3.2."
- **Ticket / commentaire de PR (EN) :** "LGTM on the Next.js bump (lockfile checked: 16.4.6). One open question: the commit mentions an unresolved picomatch ReDoS, but `npm audit` is clean on main. Please document the advisory status."

## 7. Exercice (20 min, sur ta copie locale du dépôt)
Sans rien modifier : 1) ouvre `package.json` et le fichier de verrouillage, note la plage et la version installée de `next` ; 2) formule une hypothèse sur ce que fait `^16.4.6` si Next.js 17.0.0 sort ; 3) compare à la documentation semver.
<details><summary>Solution</summary>
La plage `>=16.4.6 <17.0.0` exclut 17.0.0 : aucune montée de majeur automatique ; la version installée reste celle du lockfile jusqu'à une mise à jour volontaire.
</details>

## 8. Révision espacée
Hier (SAML/SSLVPN) : 1) Où se joue le MFA dans un SSO SAML ? 2) Pourquoi « MFA configuré » ne suffit-il pas ? Il y a sept jours (13 nov, relire une refonte CSP) : 3) Quel risque pose `'unsafe-eval'` conditionné par `NODE_ENV` ?

## 9. Questions de contrôle
1. Quel fichier dit la version réellement installée ? 2. Que signifie `^16.4.6` ? 3. Pourquoi un audit vert ne prouve-t-il pas l'absence de faille ?
<details><summary>Réponses</summary>
1. Le fichier de verrouillage. 2. `>=16.4.6 <17.0.0`. 3. Il ne couvre que les avis connus du registre.
</details>

## 10. Sources (consultées le 2026-11-20)
- Dépôt, commit `f5295a7` et fichiers `sentinelscope/package.json`, `package-lock.json`, `next.config.mjs` sur `origin/main`.
- npm Docs, `npm audit` : https://docs.npmjs.com/cli/v10/commands/npm-audit — point d'accès Bulk Advisory, méta-vulnérabilités, `audit fix`.
- npm Docs, semver : https://docs.npmjs.com/cli/v6/using-npm/semver — plages `^`.
- npm Docs, package-lock.json : https://docs.npmjs.com/cli/v10/configuring-npm/package-lock-json — rôle du fichier.
- API d'avis GitHub : **403, non lue**.
