# 🎯 TORP MVP - Analyse Intelligente de Devis BTP

> **Plateforme B2C** d'analyse automatique de devis de travaux avec scoring IA

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/torp-fr/quote-insight-tally)

---

## 🚀 À propos

TORP est une application web qui permet aux **particuliers** d'analyser la qualité de leurs devis de travaux grâce à l'intelligence artificielle.

### ✨ Fonctionnalités MVP

- 📤 **Upload de devis** - PDF, JPG, PNG (max 10MB)
- 🤖 **Analyse IA automatique** - Extraction OCR + scoring intelligent
- 📊 **Score TORP** - Grade de A à E sur 6 axes
  - Fiabilité entreprise (25%)
  - Assurances (20%)
  - Justesse tarifaire (20%)
  - Qualité du devis (15%)
  - Conformité légale (12%)
  - Transparence (8%)
- ✅ **Vérification SIRET** - Données entreprise temps réel (API SIRENE)
- 💰 **Paiement simple** - 9,99€ par analyse ou packs
- 📥 **Export PDF** - Rapport complet téléchargeable
- 📊 **Dashboard** - Historique de vos analyses

---

## 🎯 Scope MVP B2C

### ✅ Inclus
- Authentification (email/password)
- Upload et analyse de devis
- Scoring TORP sur 6 axes
- Paiement Stripe (crédits)
- Dashboard utilisateur

### ❌ Hors scope (versions futures)
- Module B2B (entreprises)
- Module B2G (collectivités)
- Module B2B2C (prescripteurs)
- Marketplace artisans
- Chat IA conversationnel
- Comparaison multi-devis
- Application mobile

---

## 🏗️ Stack Technique

### Frontend
- **React 18.3** + **TypeScript 5.8** (strict mode)
- **Vite 5.4** - Build rapide
- **TanStack Query** - État serveur
- **React Router v6** - Navigation
- **shadcn/ui** + **Tailwind CSS** - Interface

### Backend
- **Supabase** - Base de données PostgreSQL + Auth + Storage
- **Edge Functions** - Serverless (OCR, Stripe, extraction)
- **Google Cloud Vision** - OCR extraction texte
- **Anthropic Claude** - Extraction données structurées
- **Stripe** - Paiements et abonnements

### DevOps
- **Vercel** - Hosting frontend
- **Sentry** - Error tracking
- **Vitest** + **Playwright** - Tests
- **GitHub Actions** - CI/CD

---

## 🚀 Installation

### Prérequis

- Node.js 18+
- npm ou bun
- Compte Supabase
- Clés API (Claude, Google Vision, Stripe)

### Étapes

```bash
# 1. Cloner le projet
git clone https://github.com/torp-fr/quote-insight-tally.git
cd quote-insight-tally

# 2. Installer dépendances
npm install

# 3. Configurer environnement
cp .env.development.example .env

# 4. Éditer .env avec vos clés
# VITE_SUPABASE_URL=https://xxx.supabase.co
# VITE_SUPABASE_ANON_KEY=xxx
# etc.

# 5. Setup Supabase
supabase link --project-ref YOUR_PROJECT_ID
supabase db push

# 6. Déployer Edge Functions
supabase functions deploy ocr-extract
supabase functions deploy extract-devis-data
supabase functions deploy create-checkout
supabase functions deploy stripe-webhook

# 7. Configurer secrets
supabase secrets set CLAUDE_API_KEY=sk-ant-xxx
supabase secrets set GOOGLE_VISION_CREDENTIALS='{"type":"service_account",...}'
supabase secrets set STRIPE_SECRET_KEY=sk_test_xxx
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxx

# 8. Lancer en développement
npm run dev
```

L'application démarre sur **http://localhost:5173**

---

## 📚 Scripts Disponibles

```bash
npm run dev           # Serveur développement
npm run build         # Build production
npm run preview       # Preview du build
npm test              # Tests unitaires (watch)
npm run test:run      # Tests unitaires (CI)
npm run test:e2e      # Tests E2E Playwright
npm run lint          # Linter
```

---

## 🗂️ Structure du Projet

```
src/
├── components/
│   ├── ui/                    # Composants shadcn/ui (48)
│   ├── auth/                  # Login, Register, Protected
│   ├── error/                 # Error boundaries
│   ├── layout/                # Header, Footer, Nav
│   ├── analyze/               # Upload, Analyzer
│   ├── results/               # ScoreCard, Breakdown, PDF
│   ├── dashboard/             # History, Stats, Profile
│   └── pricing/               # B2CPricing
│
├── pages/
│   ├── Index.tsx              # Landing page
│   ├── Login.tsx              # Connexion
│   ├── Register.tsx           # Inscription
│   ├── Analyze.tsx            # Upload de devis
│   ├── Results.tsx            # Résultats analyse
│   ├── Dashboard.tsx          # Dashboard utilisateur
│   ├── Pricing.tsx            # Tarifs
│   └── NotFound.tsx           # 404
│
├── services/
│   ├── api/
│   │   ├── client.ts          # HTTP client
│   │   ├── auth.ts            # Auth service
│   │   ├── analyses.ts        # CRUD analyses
│   │   └── payments.ts        # Stripe
│   ├── ocr/
│   │   └── ocrService.ts      # Google Vision
│   └── scoring/
│       └── scoringEngine.ts   # Moteur scoring TORP
│
├── lib/
│   ├── supabase.ts            # Supabase client
│   ├── stripe.ts              # Stripe client
│   └── utils.ts               # Utilitaires
│
├── types/
│   ├── database.ts            # Types Supabase
│   ├── analysis.ts            # Types analyse
│   └── scoring.ts             # Types scoring
│
├── context/
│   └── AuthContext.tsx        # Contexte auth
│
└── config/
    └── env.ts                 # Configuration env
```

---

## 🎨 Algorithme de Scoring

### 6 Axes d'Évaluation (100 points)

| Axe | Poids | Critères Clés |
|-----|-------|---------------|
| **Fiabilité Entreprise** | 25 pts | SIRET valide (bloquant), ancienneté, forme juridique, activité |
| **Assurances** | 20 pts | Décennale (bloquant), RC pro, validité |
| **Justesse Tarifaire** | 20 pts | Cohérence prix marché, détail lignes, TVA |
| **Qualité Devis** | 15 pts | Complétude, clarté, quantités, présentation |
| **Conformité Légale** | 12 pts | Mentions obligatoires, CGV, droit rétractation |
| **Transparence** | 8 pts | Coordonnées, délais, garanties |

### Grades

- **A** (80-100) : Excellent - Devis très fiable ✅
- **B** (65-79) : Bon - Fiable avec points mineurs 👍
- **C** (50-64) : Correct - Points de vigilance ⚠️
- **D** (35-49) : Insuffisant - Risques identifiés 🟠
- **E** (0-34) : Critique - Devis à éviter ❌

### Critères Bloquants (Grade E automatique)
- ❌ SIRET invalide ou absent
- ❌ Assurance décennale absente

---

## 💰 Tarification

| Produit | Prix | Crédits | Économie |
|---------|------|---------|----------|
| **Analyse unitaire** | 9,99€ | 1 | - |
| **Pack 3** | 24,99€ | 3 | 17% |
| **Pack 5** | 39,99€ | 5 | 20% |

---

## 🧪 Tests

### Tests Unitaires
```bash
# Lancer les tests
npm test

# Avec couverture
npm run test:coverage

# Objectif : > 70% couverture
```

### Tests E2E
```bash
# Setup
npm install -D @playwright/test
npx playwright install

# Lancer tests E2E
npm run test:e2e

# Mode UI
npm run test:e2e -- --ui
```

### Tests Manuels
```bash
# Démarrer l'app
npm run dev

# Parcours critique à tester :
1. Inscription → Login
2. Dashboard vide (0 crédit)
3. Achat 1 crédit (Stripe test: 4242 4242 4242 4242)
4. Upload devis PDF test
5. Attendre analyse (30s)
6. Voir résultats (score + grade)
7. Télécharger PDF
8. Retour dashboard (historique)
```

---

## 🚀 Déploiement

### Vercel (Recommandé)

```bash
# 1. Installer Vercel CLI
npm i -g vercel

# 2. Lier le projet
vercel link

# 3. Configurer variables environnement
vercel env pull

# 4. Déployer
vercel --prod
```

### Variables Environnement Vercel

```bash
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxx
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_xxx
VITE_APP_URL=https://app.torp.fr
```

### Vérifications Post-Déploiement

- [ ] URL fonctionne
- [ ] HTTPS actif
- [ ] Inscription/login OK
- [ ] Upload devis OK
- [ ] Paiement Stripe OK
- [ ] Analyse retourne résultat
- [ ] PDF téléchargeable
- [ ] Lighthouse > 90

---

## 📊 Monitoring

### Sentry (Errors)
```typescript
// src/lib/sentry.ts
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.VITE_APP_ENV,
  tracesSampleRate: 1.0,
});
```

### Vercel Analytics
Activé automatiquement dans Vercel Dashboard

### Supabase Logs
```bash
# Voir logs Edge Functions
supabase functions logs ocr-extract

# Voir logs database
supabase db logs
```

---

## 📖 Documentation Complète

- **[MVP_GAP_ANALYSIS.md](./MVP_GAP_ANALYSIS.md)** - Analyse des écarts projet actuel vs MVP
- **[MVP_RESTRUCTURATION_PLAN.md](./MVP_RESTRUCTURATION_PLAN.md)** - Plan détaillé 3 semaines
- **[MVP_CLEANUP_SCRIPT.sh](./MVP_CLEANUP_SCRIPT.sh)** - Script de nettoyage automatique
- **[START_HERE.md](./START_HERE.md)** - Guide démarrage rapide Supabase
- **[CHANGELOG.md](./CHANGELOG.md)** - Historique des versions

---

## 🛠️ Développement

### Ajouter un Composant UI
```bash
# Utiliser shadcn/ui CLI
npx shadcn-ui@latest add button
npx shadcn-ui@latest add dialog
```

### Créer une Migration Supabase
```bash
# Créer nouvelle migration
supabase migration new my_migration

# Éditer le fichier SQL
# supabase/migrations/YYYYMMDD_my_migration.sql

# Appliquer
supabase db push
```

### Créer une Edge Function
```bash
# Créer fonction
supabase functions new my-function

# Éditer
# supabase/functions/my-function/index.ts

# Déployer
supabase functions deploy my-function
```

---

## 🐛 Troubleshooting

### Erreur "Module not found"
```bash
# Nettoyer et réinstaller
rm -rf node_modules dist
npm install
npm run dev
```

### Build échoue
```bash
# Vérifier TypeScript
npx tsc --noEmit

# Vérifier ESLint
npm run lint
```

### Tests échouent
```bash
# Nettoyer cache
npm run test -- --clearCache

# Relancer
npm test
```

### Supabase connexion échoue
```bash
# Vérifier le lien
supabase status

# Re-lier si nécessaire
supabase link --project-ref YOUR_PROJECT_ID
```

---

## 🤝 Contribution

Ce projet est développé en solo par Baptiste avec l'aide de Claude Code.

### Workflow Git

```bash
# 1. Créer branche
git checkout -b feature/ma-feature

# 2. Développer et tester
npm run dev
npm test

# 3. Commit
git add .
git commit -m "feat: Ma nouvelle feature"

# 4. Push
git push -u origin feature/ma-feature

# 5. Créer PR sur GitHub
```

### Conventions

- **Commits** : Suivre [Conventional Commits](https://www.conventionalcommits.org/)
  - `feat:` Nouvelle fonctionnalité
  - `fix:` Correction de bug
  - `docs:` Documentation
  - `refactor:` Refactoring
  - `test:` Ajout de tests
  - `chore:` Tâches diverses

- **Branches** :
  - `main` - Production
  - `develop` - Développement
  - `feature/*` - Nouvelles features
  - `fix/*` - Corrections
  - `claude/*` - Branches Claude Code

---

## 📈 Roadmap

### ✅ MVP (v1.0.0) - 3 semaines
- [x] Nettoyage code (B2C uniquement)
- [x] Backend Supabase
- [x] OCR + Scoring
- [x] Paiement Stripe
- [x] Tests E2E
- [x] Production

### 🔜 v1.1 - Améliorations (4-6 semaines)
- [ ] Amélioration précision scoring
- [ ] Optimisation temps traitement
- [ ] Plus de tests
- [ ] Feedback utilisateurs
- [ ] SEO optimization

### 🚀 v2.0 - Features Avancées (3-6 mois)
- [ ] Chat IA avec le devis
- [ ] Comparaison multi-devis
- [ ] Recommandations entreprises
- [ ] Base de connaissances BTP
- [ ] API publique

### 🌍 v3.0 - Expansion (6-12 mois)
- [ ] Module B2B (si validé)
- [ ] Marketplace artisans
- [ ] Application mobile
- [ ] Internationalisation

---

## 📄 Licence

Ce projet est propriété de TORP.

Développé initialement avec [Lovable.dev](https://lovable.dev) - [Project Link](https://lovable.dev/projects/f7c01cee-8476-487a-9d55-ea6fba0aeeee)

---

## 🔗 Liens Utiles

- **Production** : https://quote-insight-tally.vercel.app
- **GitHub** : https://github.com/torp-fr/quote-insight-tally
- **Supabase** : [Dashboard](https://app.supabase.com)
- **Vercel** : [Dashboard](https://vercel.com/dashboard)
- **Stripe** : [Dashboard](https://dashboard.stripe.com)

---

## 💬 Support

Pour toute question :
- 📧 Email : support@torp.app
- 🐛 Issues : [GitHub Issues](https://github.com/torp-fr/quote-insight-tally/issues)
- 📖 Docs : [Documentation complète](./docs/)

---

**Fait avec ❤️ par Baptiste & Claude Code**

🎯 **MVP B2C - Focus sur la valeur utilisateur** 🚀
