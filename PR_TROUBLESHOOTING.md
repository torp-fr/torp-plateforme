# Troubleshooting des Erreurs PR

## ❌ Problème: Page blanche après déploiement Vercel

### Cause Racine
Les variables d'environnement Supabase ne sont pas configurées sur Vercel.

### Solution Rapide ⚡
1. Allez dans **Vercel Dashboard → Settings → Environment Variables**
2. Ajoutez:
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   VITE_APP_ENV=production
   ```
3. Redéployez (Redeploy button dans Vercel)

**📖 Documentation complète:** Voir `VERCEL_DEPLOYMENT_GUIDE.md`

---

## ✅ Vérifier que ça fonctionne

### Test local en mode production
```bash
# Build
npm run build

# Lancer preview (simule production)
npm run preview

# Ouvrir http://localhost:4173
# Ouvrir Console (F12)
# Chercher les logs [TORP]
```

### Vérifier les logs Vercel
```
https://vercel.com/dashboard/[your-project]/logs
```

Cherchez:
- Build output (erreurs de construction)
- Function logs (erreurs runtime)

---

## 🔍 Diagnostique: Ouvrir la Console (F12)

### Si vous voyez:
```
❌ [TORP] Failed to initialize: Error: Root element not found
```
→ Problème HTML/DOM - contacter support

```
❌ [ENV] Validation error: Missing VITE_SUPABASE_URL
```
→ Ajouter les env vars sur Vercel (voir ci-dessus)

```
✅ [TORP] Starting application...
✅ [TORP] App rendered successfully
```
→ Tout fonctionne! ✨

---

## PR Checks - Phase 30

### Build Checks
- ✅ TypeScript: Pas d'erreurs de typage
- ✅ Vite Build: Compile sans erreurs
- ✅ Bundle Size: < 2.5MB gzipped

### Code Quality
- ✅ No breaking changes: 100% backward compatible
- ✅ No unused imports
- ✅ Proper error handling

### Features
- ✅ Logger service: Fonctionne sur browser + Node
- ✅ CSS @import: Avant @tailwind
- ✅ Cache service: Sans module crypto
- ✅ Env validation: Non-bloquant en production

---

## Common Issues & Solutions

### 1. "Cannot find module logger"
**Cause:** Fichier `src/core/platform/logger.ts` manquant
**Solution:** Vérifiez que le fichier existe
```bash
ls -la src/core/platform/logger.ts
```

### 2. "Module crypto has been externalized"
**Cause:** Import du module crypto dans intelligentCache.service
**Solution:** Déjà fixé dans notre version (hash JS natif)

### 3. "@import must precede all other statements"
**Cause:** CSS @import après @tailwind
**Solution:** Déjà fixé dans index.css

### 4. Blank page with no console errors
**Cause:** Erreur silencieuse avant React render
**Solution:** Voir VERCEL_DEPLOYMENT_GUIDE.md

---

## Commits de Fix

```
52ea6b8 Add Vercel deployment guide
9d06d6c Fix: Allow app to load gracefully when env missing
25731f7 Add diagnostic logging to main.tsx
4c8ad55 Fix: Remove crypto module dependency
abca2b2 Fix: Create logger service
1afcd06 Add comprehensive PR description
```

---

## Next Steps

1. **Merger la PR** (une fois GitHub checks passés)
2. **Configurer Vercel env vars** (voir guide)
3. **Redéployer** sur Vercel
4. **Tester** que page charge sans blanche

---

## Support

Besoin d'aide? Vérifiez:
- Console F12 pour les logs [TORP]
- Vercel Logs pour les erreurs de build
- VERCEL_DEPLOYMENT_GUIDE.md pour config
