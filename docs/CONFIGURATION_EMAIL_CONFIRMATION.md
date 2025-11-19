# Configuration de l'Email de Confirmation Supabase

Ce guide explique comment configurer les emails de confirmation pour éviter les erreurs de redirection après l'inscription.

## Problème

Après l'inscription d'un nouvel utilisateur, le lien de confirmation dans l'email renvoie vers une page d'erreur au lieu du dashboard.

## Solution

### 1. Configuration dans le Dashboard Supabase

#### A. Configurer l'URL de redirection

1. Allez sur le dashboard Supabase : https://app.supabase.com
2. Sélectionnez votre projet `quote-insight-tally`
3. Naviguez vers **Authentication → URL Configuration**
4. Configurez les URLs suivantes :

```
Site URL: https://votre-domaine.vercel.app
```

**Redirect URLs (ajoutez toutes ces URLs) :**
```
https://votre-domaine.vercel.app/**
https://votre-domaine.vercel.app/dashboard
https://votre-domaine.vercel.app/auth/callback
http://localhost:5173/**
http://localhost:5173/dashboard
```

#### B. Activer la confirmation par email

1. Allez sur **Authentication → Providers → Email**
2. Vérifiez que **"Confirm email"** est activé
3. **"Enable email confirmations"** → ✅ ON
4. **"Secure email change"** → ✅ ON (recommandé)

#### C. Personnaliser le template d'email

1. Allez sur **Authentication → Email Templates**
2. Sélectionnez **"Confirm signup"**
3. Utilisez ce template personnalisé :

```html
<h2>Bienvenue sur TORP !</h2>
<p>Merci de vous être inscrit. Cliquez sur le lien ci-dessous pour confirmer votre adresse email :</p>
<p><a href="{{ .ConfirmationURL }}">Confirmer mon email</a></p>
<p>Ce lien expire dans 24 heures.</p>
<p>Si vous n'avez pas créé de compte TORP, ignorez cet email.</p>
```

**Variables disponibles :**
- `{{ .ConfirmationURL }}` - Lien de confirmation
- `{{ .Token }}` - Token de confirmation
- `{{ .TokenHash }}` - Hash du token
- `{{ .SiteURL }}` - URL du site configurée

### 2. Configuration côté Code (déjà fait)

Le code dans `src/services/api/supabase/auth.service.ts` est déjà configuré :

```typescript
const { data: authData, error: authError } = await supabase.auth.signUp({
  email: data.email,
  password: data.password,
  options: {
    emailRedirectTo: `${window.location.origin}/dashboard`, // ✅ Correct
    data: {
      name: data.name,
      user_type: data.type,
      // ...
    },
  },
});
```

### 3. Configuration en Production (Vercel)

#### Variables d'environnement Vercel

Assurez-vous que ces variables sont configurées dans Vercel :

1. Allez sur votre projet Vercel
2. **Settings → Environment Variables**
3. Ajoutez/vérifiez :

```bash
# Supabase
VITE_SUPABASE_URL=https://votre-projet.supabase.co
VITE_SUPABASE_ANON_KEY=votre_clé_anon

# URLs (pour vérification)
VITE_SITE_URL=https://votre-domaine.vercel.app
```

### 4. Test de la Configuration

#### Étape 1 : Créer un compte test

1. Sur votre site en production, allez sur `/register`
2. Créez un nouveau compte avec un email valide
3. Vérifiez le message : "Vérifiez votre email pour confirmer votre compte"

#### Étape 2 : Vérifier l'email reçu

1. Ouvrez votre boîte email
2. Vous devez recevoir un email de `noreply@mail.app.supabase.io`
3. Sujet : "Confirm Your Signup" ou "Confirmez votre inscription"

#### Étape 3 : Cliquer sur le lien

1. Cliquez sur le lien de confirmation
2. ✅ Vous devez être redirigé vers `https://votre-domaine.vercel.app/dashboard`
3. ✅ Vous devez être automatiquement connecté
4. ✅ Le dashboard doit s'afficher correctement

### 5. Debugging en cas d'erreur

#### Erreur : "Invalid Redirect URL"

**Cause :** L'URL de redirection n'est pas dans la liste des URLs autorisées

**Solution :**
1. Vérifiez que votre URL est dans **Authentication → URL Configuration → Redirect URLs**
2. Ajoutez `https://votre-domaine.vercel.app/**` avec le wildcard `**`

#### Erreur : Page blanche ou 404

**Cause :** La route `/dashboard` n'existe pas ou erreur de routing

**Solution :**
1. Vérifiez que la route `/dashboard` existe dans `src/App.tsx`
2. Testez directement : `https://votre-domaine.vercel.app/dashboard`

#### Email non reçu

**Cause :** Plusieurs raisons possibles

**Solutions :**
1. Vérifiez les spams
2. Vérifiez que l'email est valide
3. Allez sur Supabase Dashboard → **Authentication → Users** pour voir si le compte existe
4. Statut doit être **"Waiting for verification"**

#### Token expiré

**Cause :** Le lien a plus de 24h

**Solution :**
1. Renvoyer l'email de confirmation :
   - Allez sur Supabase Dashboard
   - **Authentication → Users**
   - Trouvez l'utilisateur
   - Cliquez sur **"Send magic link"** ou **"Resend verification email"**

### 6. Configuration SMTP personnalisée (Optionnel)

Pour personnaliser les emails avec votre propre domaine :

1. Allez sur **Project Settings → Auth**
2. Activez **"Enable Custom SMTP"**
3. Configurez votre serveur SMTP :

```
Host: smtp.votre-domaine.com
Port: 587
Username: noreply@votre-domaine.com
Password: votre_mot_de_passe_smtp
Sender email: noreply@votre-domaine.com
Sender name: TORP
```

### 7. Vérification finale

Liste de contrôle :

- [ ] Site URL configuré dans Supabase
- [ ] Redirect URLs contiennent `https://votre-domaine.vercel.app/**`
- [ ] "Confirm email" est activé
- [ ] Template d'email personnalisé (optionnel)
- [ ] Variables d'environnement Vercel configurées
- [ ] Test de création de compte réussi
- [ ] Email de confirmation reçu
- [ ] Redirection vers /dashboard fonctionne
- [ ] Connexion automatique après confirmation

## Support

Si vous rencontrez toujours des problèmes :

1. Vérifiez les logs Supabase : **Logs → Auth Logs**
2. Vérifiez la console navigateur pour erreurs JavaScript
3. Testez avec un email différent
4. Contactez le support Supabase si nécessaire

## Liens utiles

- [Documentation Supabase Auth](https://supabase.com/docs/guides/auth)
- [Email Templates](https://supabase.com/docs/guides/auth/auth-email-templates)
- [Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)
