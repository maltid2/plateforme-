# Mise en route Stripe (paiement unique → accès à vie)

Guide pas à pas pour brancher Stripe en **paiement externe** via un
**Payment Link**. Le code est déjà prêt : tu n'écris aucune ligne, tu
configures 2 variables d'environnement.

> Modèle : **paiement unique**, pas d'abonnement. Après paiement, le compte
> client est activé **à vie**, automatiquement, sans intervention de ta part.

---

## Vue d'ensemble

```
Client → /app → "Payer" → Stripe Payment Link (page hébergée par Stripe)
                              │
                        paiement réussi
                              │
        Stripe appelle  POST /webhook/stripe   (signé)
                              │
              compte activé À VIE → audits illimités
```

Tu n'as besoin que de **2 variables** :

| Variable | Où la trouver |
|---|---|
| `PAYMENT_URL` | L'URL de ton Payment Link Stripe |
| `STRIPE_WEBHOOK_SECRET` | Le « signing secret » du webhook (commence par `whsec_`) |

> Pas besoin de `STRIPE_SECRET_KEY` ni `STRIPE_PRICE_ID` : ils ne servent qu'au
> mode « checkout intégré » que tu n'utilises pas ici.

---

## Étape 1 — Créer le produit et le Payment Link

1. Dans le **Dashboard Stripe** → **Produits** → **Ajouter un produit**.
2. Renseigne le nom (ex. « Audit de sécurité — accès à vie ») et le prix.
   **Important : choisis « Tarification unique » (One-time), pas récurrent.**
3. Une fois le produit créé → **Payment Links** → **Nouveau** → sélectionne ce
   produit → **Créer le lien**.
4. Copie l'URL du lien (ex. `https://buy.stripe.com/xxxxxxxx`).
   → C'est ta variable **`PAYMENT_URL`**.

### (Recommandé) Rediriger le client vers l'app après paiement

Dans les réglages du Payment Link → **Après le paiement** → **Rediriger les
clients** → indique :

```
https://TON-DOMAINE/app?paid=1
```

Ainsi le client revient sur son espace après avoir payé.

---

## Étape 2 — Créer le webhook

1. Dashboard Stripe → **Développeurs** → **Webhooks** → **Ajouter un endpoint**.
2. **URL de l'endpoint** :

   ```
   https://TON-DOMAINE/webhook/stripe
   ```

3. **Événements à écouter** : ajoute au minimum
   **`checkout.session.completed`** (tu peux aussi ajouter
   `payment_intent.succeeded`).
4. Valide, puis ouvre l'endpoint créé → **Révéler le signing secret** →
   copie la valeur `whsec_...`.
   → C'est ta variable **`STRIPE_WEBHOOK_SECRET`**.

---

## Étape 3 — Configurer l'app

Dans ton fichier `.env` (à côté de `package.json`) :

```env
PUBLIC_BASE_URL=https://TON-DOMAINE
PAYMENT_URL=https://buy.stripe.com/xxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxx
```

Puis lance le serveur :

```bash
node src/server.js
```

---

## Étape 4 — Tester

### En local (avec la CLI Stripe)

La CLI Stripe permet de rejouer un vrai événement vers ton localhost :

```bash
stripe listen --forward-to localhost:3000/webhook/stripe
# puis, dans un autre terminal :
stripe trigger checkout.session.completed
```

Le compte correspondant doit passer à **actif**.

### Bout en bout (réel)

1. Ouvre `https://TON-DOMAINE/app`, crée un compte, copie ta clé.
2. Clique **Payer** → tu arrives sur la page Stripe.
3. Paie (en test : carte `4242 4242 4242 4242`, date future, CVC quelconque).
4. Stripe appelle `/webhook/stripe` → ton compte est activé à vie.
5. Reviens sur `/app`, **Vérifier mon statut** → « Accès : ACTIF — accès à vie ».
6. Lance autant d'audits que tu veux.

---

## Faire correspondre le paiement au bon compte

Quand le client clique **Payer**, l'app ajoute automatiquement son identifiant
au lien (`?client_reference_id=<id>`). Stripe le renvoie dans l'événement
`checkout.session.completed`, ce qui permet d'activer **le bon compte** sans
ambiguïté. À défaut, l'email du client (utilisé au paiement) sert de repli.

---

## Dépannage

| Symptôme | Cause probable |
|---|---|
| Webhook rejeté (400) | `STRIPE_WEBHOOK_SECRET` incorrect ou absent |
| Compte non activé | L'événement `checkout.session.completed` n'est pas coché sur l'endpoint |
| « Aucun moyen de paiement configuré » | `PAYMENT_URL` non défini dans `.env` |
| Le client revient mais reste INACTIF | Attendre quelques secondes puis « Vérifier mon statut » ; vérifier les logs du webhook côté Stripe |

## Activation manuelle (repli)

En cas de besoin (paiement hors ligne, litige), tu peux toujours activer à la
main :

```bash
node src/admin.js activate --email client@ex.com --lifetime
```
