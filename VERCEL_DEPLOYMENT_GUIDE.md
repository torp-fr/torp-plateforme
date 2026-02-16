# Guide de Déploiement Vercel - TORP

## ⚠️ Si vous avez une page blanche après le déploiement

**99% du temps**, c'est dû aux **variables d'environnement manquantes** sur Vercel.

---

## 🔧 Configuration Vercel

### 1. Allez dans les paramètres de votre projet Vercel
```
https://vercel.com/dashboard/[your-project]/settings/environment-variables
```

### 2. Ajoutez les variables d'environnement requises

#### **Variables obligatoires** (dépend de votre configuration)

Si vous utilisez **Supabase** (recommended):
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
VITE_APP_ENV=production
VITE_AUTH_PROVIDER=supabase
```

#### **Variables optionnelles** (pour fonctionnalités complètes)
```
# Debug & Mode
VITE_DEBUG_MODE=false
VITE_MOCK_API=false
VITE_FREE_MODE=true

# Features
VITE_FEATURE_PAYMENT_ENABLED=false
VITE_FEATURE_CHAT_AI_ENABLED=true
VITE_FEATURE_MARKETPLACE_ENABLED=false
VITE_FEATURE_ANALYTICS_ENABLED=false

# Credits (Free Mode)
VITE_DEFAULT_CREDITS=999999
VITE_FREE_MODE_MESSAGE="🎉 TORP est gratuit en phase test!"

# Optional: Stripe (disable for now)
VITE_STRIPE_ENABLED=false

# Optional: Sentry (error tracking)
# VITE_SENTRY_DSN=your-sentry-dsn

# Optional: Google Maps
# VITE_GOOGLE_MAPS_API_KEY=your-api-key
```

---

## 🔍 Comment trouver vos credentials Supabase

### 1. Allez dans Supabase Dashboard
```
https://app.supabase.com/projects
```

### 2. Sélectionnez votre projet

### 3. Allez dans **Settings → API**

### 4. Copiez:
- **Project URL** → `VITE_SUPABASE_URL`
- **Anon public key** → `VITE_SUPABASE_ANON_KEY`

---

## ✅ Après avoir configuré les variables

### 1. Redéployez sur Vercel
```bash
# Push sur votre branche
git push origin claude/analyze-project-state-c4W3e

# Vercel va automatiquement redéployer
```

### 2. Vérifiez que le déploiement réussit
- Allez dans **Deployments**
- Vérifiez que la build est **✅ Ready**

### 3. Testez la page
- Ouvrez votre URL Vercel
- Ouvrez la **Console** (F12 → Console tab)
- Cherchez les logs `[TORP]` pour vérifier que tout charge

---

## 🐛 Debugging

### Si vous avez toujours une page blanche:

#### Étape 1: Ouvrez la Console (F12)
Cherchez des messages comme:
```
[TORP] Starting application...
[TORP] Root element found...
[TORP] App rendered successfully ✅
```

#### Étape 2: Si vous voyez des erreurs
Notez l'erreur exacte et vérifiez:

- **`VITE_SUPABASE_URL not configured`**
  → Ajoutez `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` dans Vercel Settings

- **`Cannot read property of undefined`**
  → Vérifiez que vos Supabase credentials sont corrects

- **`Module not found`**
  → Redéployez (la build cache peut être obsolète)

#### Étape 3: Vérifiez les Vercel Logs
```
https://vercel.com/dashboard/[your-project]/logs
```

Cherchez:
- Build errors (section "Build Output")
- Runtime errors (section "Function Logs")

---

## 📋 Checklist de déploiement

- [ ] Variables d'environnement ajoutées sur Vercel
- [ ] `VITE_SUPABASE_URL` configurée
- [ ] `VITE_SUPABASE_ANON_KEY` configurée
- [ ] `VITE_APP_ENV=production` défini
- [ ] Build réussit localement (`npm run build`)
- [ ] Redéploiement lancé sur Vercel
- [ ] Console navigateur ne montre pas d'erreurs
- [ ] Page charge avec contenu (pas blanche)

---

## 🚀 Production Ready Checklist

### Avant de aller en production:

```
❌ VITE_DEBUG_MODE=true → Changer à: false
❌ VITE_MOCK_API=true → Changer à: false
✅ VITE_FREE_MODE=true → OK pour phase test
✅ VITE_SUPABASE_URL → Votre vraie Supabase
✅ VITE_SUPABASE_ANON_KEY → Votre vraie clé
```

---

## 💡 Tips

### 1. Redéployez rapidement
Si vous changez les variables, vous pouvez redéployer rapidement sans repush:
- Allez dans Vercel Dashboard
- Cliquez sur la dernière deployment
- Cliquez **Redeploy**

### 2. Vérifiez que vous êtes sur la bonne branche
Vercel doit déployer depuis: `claude/analyze-project-state-c4W3e`

### 3. Activez les Build Logs détaillés
Vercel Settings → Project Settings → Build & Development Settings → "Enhanced logs" (si disponible)

---

## 🔐 Sécurité des Secrets

**Important:** Vos clés Supabase sont secrets!
- ❌ Ne les commitez PAS dans Git
- ✅ Mettez-les dans Vercel Settings uniquement
- ✅ Le fichier `.env` est dans `.gitignore`

---

## 📞 Besoin d'aide?

Si ça ne fonctionne toujours pas:

1. **Vérifiez la Console** (F12) pour l'erreur exacte
2. **Vérifiez les Vercel Logs**
3. **Testez localement:**
   ```bash
   npm run build
   npm run preview
   ```
   Cela simule la production localement

---

**Dernière mise à jour:** 2026-02-16
**Version:** Phase 30.3 Production Hardening
