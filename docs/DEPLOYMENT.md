# Guide de Déploiement - TORP

## 🚀 Déploiement sur Vercel

### Option 1 : Déploiement via Interface Vercel (Recommandé)

1. **Aller sur Vercel**
   - Se connecter sur [vercel.com](https://vercel.com)
   - Cliquer sur "Add New Project"
   - Importer le repo GitHub `torp-fr/quote-insight-tally`

2. **Configuration du projet**
   ```
   Framework Preset: Vite
   Build Command: npm run build
   Output Directory: dist
   Install Command: npm install
   ```

3. **Variables d'environnement**

   Dans "Environment Variables", ajouter :

   **Variables obligatoires :**
   ```bash
   VITE_APP_ENV=production
   VITE_APP_NAME=TORP
   VITE_MOCK_API=true
   VITE_DEBUG_MODE=false
   ```

   **Variables optionnelles (backend réel) :**
   ```bash
   VITE_API_BASE_URL=https://api.torp.app/api
   VITE_AUTH_PROVIDER=supabase
   VITE_AUTH_SUPABASE_URL=https://xxxxx.supabase.co
   VITE_AUTH_SUPABASE_ANON_KEY=eyJxxx...
   ```

4. **Déployer**
   - Cliquer sur "Deploy"
   - Attendre la fin du build (2-3 minutes)
   - Le site sera disponible sur `*.vercel.app`

### Option 2 : Déploiement via CLI

```bash
# Installer Vercel CLI
npm i -g vercel

# Se connecter
vercel login

# Déployer en preview
vercel

# Déployer en production
vercel --prod
```

### Option 3 : Déploiement automatique (CI/CD)

Le projet est configuré pour se déployer automatiquement :
- **Push sur `main`** → Déploiement en production
- **Push sur autres branches** → Preview deployment
- **Pull Request** → Preview deployment avec lien de preview

---

## 🔧 Configuration Post-Déploiement

### 1. Domaine personnalisé

**Via Vercel Dashboard :**
1. Aller dans "Settings" > "Domains"
2. Ajouter votre domaine (ex: `app.torp.fr`)
3. Configurer le DNS selon les instructions
4. Attendre la propagation DNS (5-30 min)

**DNS Records :**
```
Type: CNAME
Name: app (ou @)
Value: cname.vercel-dns.com
```

### 2. Variables d'environnement par environnement

Vercel permet de configurer des variables par environnement :
- **Production** : Utilisées pour `main` branch
- **Preview** : Utilisées pour les autres branches
- **Development** : Utilisées en local

**Exemple de configuration :**

| Variable | Production | Preview | Development |
|----------|-----------|---------|-------------|
| `VITE_DEBUG_MODE` | `false` | `true` | `true` |
| `VITE_MOCK_API` | `false` | `true` | `true` |
| `VITE_API_BASE_URL` | `https://api.torp.app` | `https://api-staging.torp.app` | `http://localhost:3000` |

### 3. Performance

**Build Cache**
- Vercel met en cache `node_modules` automatiquement
- Les builds suivants sont plus rapides (~30s)

**Edge Network**
- Les assets sont distribués sur le CDN global Vercel
- Temps de réponse < 100ms partout dans le monde

**Optimisations automatiques :**
- ✅ Compression Brotli
- ✅ Cache immutable pour assets
- ✅ HTTP/2 Push
- ✅ Image optimization (si activée)

---

## 📊 Monitoring

### Vercel Analytics

1. Activer dans "Analytics" tab
2. Voir les métriques :
   - Page views
   - Top pages
   - Top referrers
   - Devices/Browsers
   - Real User Monitoring (RUM)

### Vercel Speed Insights

1. Installer le package :
   ```bash
   npm install @vercel/speed-insights
   ```

2. Ajouter dans `main.tsx` :
   ```typescript
   import { SpeedInsights } from '@vercel/speed-insights/react';

   // Dans le render
   <SpeedInsights />
   ```

### Logs

**Via Dashboard :**
- "Deployments" > Click sur le déploiement > "Logs"
- Logs de build
- Runtime logs
- Erreurs

**Via CLI :**
```bash
vercel logs [deployment-url]
vercel logs --follow  # Real-time
```

---

## 🔐 Sécurité

### Headers de sécurité

Déjà configurés dans `vercel.json` :
- ✅ `X-Content-Type-Options: nosniff`
- ✅ `X-Frame-Options: DENY`
- ✅ `X-XSS-Protection: 1; mode=block`
- ✅ `Referrer-Policy: strict-origin-when-cross-origin`

### Variables secrètes

**Bonnes pratiques :**
- ✅ Ne jamais commiter `.env` avec des vraies valeurs
- ✅ Utiliser Vercel Environment Variables pour les secrets
- ✅ Marquer les variables sensibles comme "Secret"
- ✅ Rotation régulière des clés API

### HTTPS

- ✅ HTTPS automatique avec certificat Let's Encrypt
- ✅ Renouvellement automatique
- ✅ HTTP → HTTPS redirect automatique

---

## 🌍 Déploiements Multi-Environnements

### Structure recommandée

```
main               → Production (app.torp.fr)
staging            → Staging (staging.torp.fr)
feature/*          → Preview (feature-xyz.vercel.app)
```

### Configuration

**1. Créer une branche staging**
```bash
git checkout -b staging
git push origin staging
```

**2. Dans Vercel Dashboard**
- "Settings" > "Git"
- Production Branch: `main`
- Ajouter "Branch Configuration" pour `staging`
- Assigner un domaine différent

**3. Workflow de déploiement**
```bash
# Développement local
git checkout -b feature/new-feature
# ... développer ...
git push origin feature/new-feature
# → Crée un preview deployment

# Review & merge vers staging
# → Déploie sur staging.torp.fr

# Test sur staging, puis merge vers main
# → Déploie en production sur app.torp.fr
```

---

## 🐛 Troubleshooting

### Build échoue

**Problème : "Module not found"**
```bash
# Solution : Vérifier package.json et réinstaller
npm install
npm run build  # Tester localement
```

**Problème : "Out of memory"**
```bash
# Solution : Augmenter la mémoire Node
# Dans package.json :
"build": "NODE_OPTIONS='--max-old-space-size=4096' vite build"
```

### Runtime errors

**Problème : "Hydration mismatch"**
- Vérifier que les composants n'utilisent pas `window` au render initial
- Utiliser `useEffect` pour le code client-only

**Problème : "Environment variable undefined"**
- Vérifier que la variable est préfixée par `VITE_`
- Vérifier qu'elle est configurée dans Vercel Dashboard
- Re-déployer après ajout de variables

### Performance

**Build lent**
```bash
# Vérifier la taille du bundle
npm run build
npx vite-bundle-visualizer

# Optimiser les imports
# Avant :
import { Button, Card, Input } from '@/components/ui';

# Après :
import { Button } from '@/components/ui/button';
```

**Page lente**
- Activer Vercel Speed Insights
- Vérifier les imports lourds
- Utiliser lazy loading (déjà configuré dans App.improved.tsx)

---

## 📈 Métriques de Succès

### Objectifs de performance

- **Time to First Byte (TTFB)** : < 200ms
- **First Contentful Paint (FCP)** : < 1.5s
- **Largest Contentful Paint (LCP)** : < 2.5s
- **Time to Interactive (TTI)** : < 3.5s
- **Cumulative Layout Shift (CLS)** : < 0.1

### Vérifier avec Lighthouse

```bash
# Installer lighthouse
npm i -g lighthouse

# Auditer le site
lighthouse https://your-app.vercel.app --view

# Ou via Chrome DevTools : F12 > Lighthouse
```

---

## 🔄 Rollback

### Via Dashboard

1. "Deployments" > Trouver le déploiement précédent
2. Cliquer sur "..." > "Promote to Production"
3. Confirmer

### Via CLI

```bash
# Lister les déploiements
vercel ls

# Promouvoir un ancien déploiement
vercel promote <deployment-url>
```

**Rollback instantané** : < 10 secondes

---

## 📞 Support

**Problème de déploiement ?**
- 📖 [Vercel Docs](https://vercel.com/docs)
- 💬 [Vercel Discord](https://vercel.com/discord)
- 📧 support@vercel.com

**Problème avec le projet ?**
- 🐛 [GitHub Issues](https://github.com/torp-fr/quote-insight-tally/issues)
- 📧 support@torp.app

---

## ✅ Checklist de déploiement

**Avant de déployer en production :**

- [ ] Tests passent (`npm test`)
- [ ] Build réussit localement (`npm run build`)
- [ ] Variables d'environnement configurées
- [ ] Domaine configuré (si applicable)
- [ ] Analytics activés
- [ ] Monitoring configuré (Sentry si disponible)
- [ ] Documentation à jour
- [ ] CHANGELOG.md mis à jour
- [ ] README.md avec lien de production

**Après déploiement :**

- [ ] Tester l'application en production
- [ ] Vérifier les logs Vercel
- [ ] Tester sur mobile
- [ ] Vérifier le SSL (HTTPS)
- [ ] Lighthouse audit > 90
- [ ] Monitoring actif

---

**Fait avec ❤️ pour TORP**
