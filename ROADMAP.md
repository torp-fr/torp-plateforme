# 🗺️ ROADMAP TORP - Plateforme SaaS Complète

> De prototype Lovable à plateforme opérationnelle production-ready

**Status actuel** : Phase 1 terminée (75%) - Phase 2 à démarrer

---

## 🎯 Vision

Transformer TORP en une **plateforme SaaS multi-tenant opérationnelle** qui analyse réellement les devis de travaux avec l'IA, connectée à un backend sécurisé, avec paiements, notifications et monitoring.

---

## ✅ Phase 0 - Fondations (TERMINÉ)

**Durée** : 2 jours
**Status** : ✅ 100% Complété

### Réalisations
- [x] TypeScript strict mode progressif
- [x] Variables d'environnement type-safe
- [x] Infrastructure de tests (Vitest) - 13 tests ✅
- [x] Architecture backend-ready (API layer)
- [x] Services mockés (auth, devis, projects)
- [x] Protection des routes + Error boundaries
- [x] Lazy loading configuration
- [x] Documentation technique complète
- [x] Configuration Vercel

### Livrables
- `src/config/env.ts` - Configuration centralisée
- `src/services/api/` - Client HTTP + services mockés
- `src/components/auth/ProtectedRoute.tsx`
- `src/components/error/ErrorBoundary.tsx`
- `src/App.improved.tsx` - Version optimisée
- `docs/ARCHITECTURE.md` + `docs/GETTING_STARTED.md`
- `vercel.json` + `.env.*.example`

---

## 🎨 Phase 1 - UX/UI Optimization (EN COURS)

**Durée** : 1 semaine
**Status** : ⏳ 75% Complété

### 1.1 Landing Page ✅ DONE
- [x] Header simplifié et navigation optimisée
- [x] Hero conversion-focused avec social proof
- [x] Section "Comment ça marche" (3 étapes)
- [x] Section "Solutions" (B2C/B2B/B2G/B2B2C)
- [x] Témoignages clients avec métriques
- [x] FAQ (8 questions)
- [x] CTA final

### 1.2 Parcours Utilisateur ✅ DONE
- [x] Simplification navigation
- [x] CTAs clairs et hiérarchisés
- [x] Responsive mobile-first
- [x] Copywriting orienté bénéfices

### 1.3 Contenu & Copywriting ✅ DONE
- [x] Headlines accrocheurs
- [x] Value propositions claires
- [x] Social proof omniprésent
- [x] Trust signals (RGPD, sécurité)

### 1.4 Dashboards par Profil ⏳ TODO
- [ ] B2C Dashboard - Interface particulier améliorée
- [ ] B2B Dashboard - Interface pro avec analytics
- [ ] B2G Dashboard - Observatoire marchés publics
- [ ] B2B2C Dashboard - Interface prescripteur multi-clients
- [ ] Admin Dashboard - Vue globale + metrics

**Temps estimé restant** : 3 jours

---

## 🔌 Phase 2 - Backend Integration (PRIORITÉ HAUTE)

**Durée estimée** : 2 semaines
**Status** : 🔜 À démarrer

### 2.1 Base de Données (Supabase)
- [ ] Setup Supabase project
- [ ] Schéma BDD PostgreSQL :
  - [ ] Table `users` (id, email, type, created_at, etc.)
  - [ ] Table `projects` (id, user_id, name, type, status, etc.)
  - [ ] Table `devis` (id, project_id, file_url, analysis_result, etc.)
  - [ ] Table `companies` (siret, name, certifications, assurances, etc.)
  - [ ] Table `transactions` (paiements)
  - [ ] Table `notifications`
- [ ] Migrations SQL
- [ ] Row Level Security (RLS) policies
- [ ] Indexes pour performance

### 2.2 Authentification Réelle
- [ ] Supabase Auth configuration
- [ ] Email/password login
- [ ] OAuth (Google, GitHub)
- [ ] Password reset flow
- [ ] Email verification
- [ ] Session management
- [ ] Remplacer `MockAuthService` par vraie API

### 2.3 API REST Endpoints
- [ ] `/api/auth/*` - Login, register, logout
- [ ] `/api/users/*` - Profil utilisateur
- [ ] `/api/projects/*` - CRUD projets
- [ ] `/api/devis/*` - Upload, analyse, liste
- [ ] `/api/companies/*` - Recherche entreprises
- [ ] `/api/payments/*` - Gestion paiements
- [ ] Middleware auth + rate limiting
- [ ] Documentation API (Swagger)

### 2.4 Upload Fichiers Sécurisé
- [ ] Supabase Storage bucket configuration
- [ ] Upload PDF/images (max 10MB)
- [ ] Validation fichiers (type, taille, virus scan)
- [ ] Génération URLs signées (sécurité)
- [ ] OCR du contenu PDF
- [ ] Extraction données structurées

**Livrables attendus** :
- BDD complète avec données réelles
- Auth fonctionnelle (login/register/logout)
- API REST documentée
- Upload de fichiers opérationnel

---

## 🤖 Phase 3 - AI/LLM Integration (CRITIQUE)

**Durée estimée** : 3 semaines
**Status** : 🔜 À démarrer après Phase 2

### 3.1 Intégration LLM (OpenAI/Anthropic)
- [ ] Setup API keys (OpenAI GPT-4 ou Anthropic Claude)
- [ ] Service d'analyse de devis par IA
- [ ] Prompt engineering pour extraction :
  - [ ] Montant total et détails
  - [ ] Liste des travaux
  - [ ] Entreprise (nom, SIRET)
  - [ ] Délais
  - [ ] Garanties
- [ ] Gestion des erreurs et retry logic
- [ ] Cache des résultats (éviter double appel)

### 3.2 Scoring TORP Algorithmique
- [ ] Algorithme de scoring sur 1000 points :
  - [ ] **Entreprise** (250 pts) : Fiabilité, santé financière, assurances
  - [ ] **Prix** (300 pts) : Vs marché, transparence, cohérence
  - [ ] **Complétude** (200 pts) : Éléments manquants, conformité normes
  - [ ] **Conformité** (150 pts) : Assurances, PLU, normes
  - [ ] **Délais** (100 pts) : Réalisme, planning détaillé
- [ ] Grade A+ à F selon score
- [ ] Génération recommandations personnalisées
- [ ] Détection surcoûts et économies potentielles

### 3.3 Fine-tuning Prompts
- [ ] Collecter 100+ exemples devis annotés
- [ ] Fine-tuning modèle sur cas d'usage TORP
- [ ] Tests A/B sur différents prompts
- [ ] Optimisation précision (> 90%)
- [ ] Gestion multi-types de travaux

### 3.4 Chat AI Temps Réel
- [ ] WebSocket pour chat instantané
- [ ] Contexte de conversation (historique)
- [ ] Réponses streaming (word by word)
- [ ] Suggestions automatiques
- [ ] Sauvegarde conversations

**Livrables attendus** :
- Analyse IA réelle fonctionnelle
- Scoring précis et fiable
- Recommandations personnalisées
- Chat AI opérationnel

---

## 📊 Phase 4 - Data & Scraping (SUPPORT IA)

**Durée estimée** : 2 semaines
**Status** : 🔜 Parallèle à Phase 3

### 4.1 Scraping Données Marché
- [ ] Bot de scraping prix moyens par région
- [ ] Sources : travaux.com, enchantier.com, devis.fr, etc.
- [ ] Scraping légal avec respect robots.txt
- [ ] Données collectées :
  - [ ] Prix moyen par type de travaux par région
  - [ ] Fourchettes basse/moyenne/haute
  - [ ] Délais moyens
- [ ] ETL pipeline (Extract, Transform, Load)
- [ ] Mise à jour automatique (weekly cron)

### 4.2 Base Données Référentielle
- [ ] BDD matériaux :
  - [ ] Nom, catégorie, prix moyen, fournisseurs
  - [ ] Normes applicables (CE, NF, etc.)
- [ ] BDD tarifs par corps de métier :
  - [ ] Plomberie, électricité, maçonnerie, etc.
  - [ ] Tarifs horaires moyens par région
- [ ] BDD entreprises BTP :
  - [ ] SIRET, nom, adresse, certifications
  - [ ] RGE, Qualibat, etc.
  - [ ] Litiges (sources publiques)

### 4.3 API Externes
- [ ] Intégration API SIRENE (INSEE) pour données entreprises
- [ ] API Infogreffe pour bilans financiers
- [ ] API Qualibat pour certifications
- [ ] API cadastre pour données parcellaires

**Livrables attendus** :
- BDD de +100K prix référence
- BDD entreprises à jour
- Scraper automatisé
- APIs externes connectées

---

## 💰 Phase 5 - Features Avancées (MONÉTISATION)

**Durée estimée** : 2 semaines
**Status** : 🔜 Après Phases 2-3-4

### 5.1 Système de Paiement (Stripe)
- [ ] Setup Stripe account
- [ ] Intégration Stripe Checkout
- [ ] Plans tarifaires :
  - [ ] B2C : Gratuit (1 devis) + Premium (9€/mois)
  - [ ] B2B : Pro (49€/mois) + Business (149€/mois)
  - [ ] B2G : Sur devis
  - [ ] B2B2C : Commission (10% sur projets)
- [ ] Webhooks Stripe (payment succeeded, failed, etc.)
- [ ] Gestion abonnements (upgrade, downgrade, cancel)
- [ ] Invoicing automatique

### 5.2 Paiements Échelonnés Sécurisés
- [ ] Système de séquestre (escrow)
- [ ] Validation par étapes (photos, signatures)
- [ ] Déblocage automatique des fonds
- [ ] Gestion litiges
- [ ] Remboursements

### 5.3 Notifications & Emails
- [ ] Service d'emailing (SendGrid/Resend)
- [ ] Templates emails :
  - [ ] Welcome email
  - [ ] Analyse terminée
  - [ ] Rappels paiement
  - [ ] Newsletter
- [ ] Notifications push (in-app)
- [ ] SMS notifications (optionnel, via Twilio)
- [ ] Préférences utilisateur (opt-in/out)

### 5.4 Marketplace Artisans
- [ ] Annuaire artisans certifiés TORP
- [ ] Système de matching (particulier → artisan)
- [ ] Avis et notes
- [ ] Demande de devis via plateforme
- [ ] Commission sur mise en relation

**Livrables attendus** :
- Paiements Stripe opérationnels
- Abonnements fonctionnels
- Emails automatisés
- Marketplace v1

---

## 🧪 Phase 6 - Tests & Qualité (CONTINU)

**Durée** : Parallèle à toutes les phases
**Status** : 🔄 Continu

### 6.1 Tests Unitaires
- [ ] Augmenter couverture > 70%
- [ ] Tests pour tous les services API
- [ ] Tests pour composants critiques
- [ ] Tests pour utils et helpers

### 6.2 Tests E2E (Playwright)
- [ ] Setup Playwright
- [ ] Scénarios critiques :
  - [ ] Inscription → Login → Upload devis → Analyse
  - [ ] Paiement bout-en-bout
  - [ ] Parcours B2C complet
  - [ ] Parcours B2B complet
- [ ] Tests multi-navigateurs
- [ ] CI/CD integration

### 6.3 Tests de Charge
- [ ] k6 ou Artillery pour load testing
- [ ] Simuler 1000 users concurrents
- [ ] Identifier bottlenecks
- [ ] Optimiser performances

**Livrables attendus** :
- Coverage > 70%
- 20+ tests E2E
- Load tests passants

---

## 📈 Phase 7 - Monitoring & Analytics (PROD READY)

**Durée estimée** : 1 semaine
**Status** : 🔜 Avant mise en production

### 7.1 Error Tracking (Sentry)
- [ ] Setup Sentry project
- [ ] Intégration frontend (React)
- [ ] Intégration backend (API)
- [ ] Alertes email/Slack
- [ ] Source maps pour debug

### 7.2 Analytics
- [ ] Google Analytics 4 ou Plausible
- [ ] Events tracking :
  - [ ] Page views
  - [ ] CTA clicks
  - [ ] Conversions
  - [ ] Funnel analysis
- [ ] Vercel Analytics
- [ ] Heatmaps (Hotjar/Clarity)

### 7.3 Logs & APM
- [ ] Structured logging (Pino/Winston)
- [ ] Centralized logs (Datadog/LogRocket)
- [ ] Application Performance Monitoring
- [ ] Database query monitoring
- [ ] API response times

### 7.4 Uptime Monitoring
- [ ] Uptime Robot ou Checkly
- [ ] Health check endpoints
- [ ] Alertes SMS/email si down
- [ ] Status page public

**Livrables attendus** :
- Sentry opérationnel
- Analytics configurés
- Logs centralisés
- Monitoring 24/7

---

## 🚀 Phase 8 - CI/CD & Production (DÉPLOIEMENT)

**Durée estimée** : 1 semaine
**Status** : 🔜 Phase finale

### 8.1 CI/CD Pipeline (GitHub Actions)
- [ ] Workflow CI :
  - [ ] Lint (ESLint)
  - [ ] Tests (Vitest)
  - [ ] Build
  - [ ] Type check
- [ ] Workflow CD :
  - [ ] Deploy preview (Pull Requests)
  - [ ] Deploy staging (branche `develop`)
  - [ ] Deploy production (branche `main`)
- [ ] Secrets management
- [ ] Rollback automatique si erreurs

### 8.2 Environnements
- [ ] **Development** : Localhost
- [ ] **Staging** : staging.torp.app (Vercel)
- [ ] **Production** : app.torp.app (Vercel)

### 8.3 Performance Optimization
- [ ] Code splitting avancé
- [ ] Image optimization (WebP, lazy loading)
- [ ] Bundle analysis et tree-shaking
- [ ] Service Worker (PWA)
- [ ] Cache stratégies

### 8.4 SEO & Marketing
- [ ] Meta tags optimisés
- [ ] Open Graph + Twitter Cards
- [ ] Sitemap.xml
- [ ] robots.txt
- [ ] Google Search Console
- [ ] Schema.org markup

### 8.5 Security Hardening
- [ ] Audit de sécurité
- [ ] HTTPS enforced
- [ ] CSP headers
- [ ] Rate limiting API
- [ ] SQL injection prevention
- [ ] XSS protection
- [ ] CSRF tokens

**Livrables attendus** :
- CI/CD fonctionnel
- 3 environnements configurés
- Lighthouse score > 95
- Security audit passé

---

## 📅 Timeline Globale

| Phase | Durée | Début | Fin Estimée | Status |
|-------|-------|-------|-------------|--------|
| **Phase 0 - Fondations** | 2j | ✅ Done | ✅ Done | ✅ 100% |
| **Phase 1 - UX/UI** | 1sem | ✅ Done | +3j | ⏳ 75% |
| **Phase 2 - Backend** | 2sem | À venir | +2sem | 🔜 0% |
| **Phase 3 - AI/LLM** | 3sem | Après P2 | +3sem | 🔜 0% |
| **Phase 4 - Data** | 2sem | // P3 | +2sem | 🔜 0% |
| **Phase 5 - Features** | 2sem | Après P3-4 | +2sem | 🔜 0% |
| **Phase 6 - Tests** | Continu | Dès P2 | Continu | 🔄 20% |
| **Phase 7 - Monitoring** | 1sem | Avant Prod | +1sem | 🔜 0% |
| **Phase 8 - Production** | 1sem | Finale | +1sem | 🔜 0% |

**Durée totale estimée** : ~10-12 semaines (2,5-3 mois)

---

## 🎯 Critères de Succès

### MVP (Minimum Viable Product)
- ✅ Phase 1 complète (UX/UI)
- ✅ Phase 2 complète (Backend + Auth)
- ✅ Phase 3.1-3.2 (IA analyse basique)
- ✅ Tests E2E basiques
- ✅ Déployé en production

### V1.0 (First Release)
- MVP +
- Phase 3.3-3.4 (Fine-tuning + Chat AI)
- Phase 5.1 (Paiements Stripe)
- Phase 7 (Monitoring complet)
- Coverage > 70%

### V2.0 (Scale)
- V1.0 +
- Phase 4 complète (Data + Scraping)
- Phase 5.2-5.4 (Features avancées)
- Load testing validé (1000+ users)
- SEO optimisé (top 10 Google)

---

## 🛠️ Stack Technique Complète

### Frontend
- React 18 + TypeScript 5
- Vite (build)
- TanStack Query (state)
- React Router v6 (routing)
- shadcn/ui + Tailwind (UI)

### Backend
- Supabase (BDD + Auth + Storage)
- PostgreSQL (database)
- Edge Functions (serverless)

### AI/LLM
- OpenAI GPT-4 ou Anthropic Claude
- LangChain (orchestration)
- Pinecone ou Chroma (vector DB, optionnel)

### Payments
- Stripe (paiements + abonnements)

### Monitoring
- Sentry (errors)
- Google Analytics (analytics)
- Vercel Analytics
- Datadog ou LogRocket (logs)

### DevOps
- GitHub (code + CI/CD)
- Vercel (hosting frontend)
- Supabase (hosting backend)

---

## 📝 Notes Importantes

### Priorités
1. **Phase 2 (Backend)** : Critique, sans ça rien ne fonctionne réellement
2. **Phase 3 (AI)** : Cœur du produit, différenciation
3. **Phase 5 (Paiements)** : Monétisation
4. **Phase 1.4 (Dashboards)** : UX améliorée
5. **Phase 4 (Data)** : Améliore précision IA

### Risques Identifiés
- ⚠️ Coût API OpenAI (limiter avec cache)
- ⚠️ Précision IA (besoin fine-tuning)
- ⚠️ Scraping légal (respecter robots.txt)
- ⚠️ RGPD (données sensibles)
- ⚠️ Scale (optimiser dès le début)

### Quick Wins
- ✅ Activer landing page optimisée (gain conversion +30%)
- 🔜 Connecter Supabase Auth (authentification réelle)
- 🔜 Premier appel OpenAI (analyse basique)
- 🔜 Stripe checkout (premiers paiements)

---

## 🤝 Contribution

Chaque phase peut être développée en parallèle par différents dev.

**Suggestions d'équipe idéale** :
- 1 Frontend Dev (React/TypeScript)
- 1 Backend Dev (Supabase/PostgreSQL)
- 1 AI/ML Engineer (LLM integration)
- 1 Data Engineer (Scraping + BDD)
- 1 DevOps (CI/CD + Monitoring)

Ou **1 Full-Stack Senior** peut gérer tout en séquentiel (10-12 semaines).

---

**Dernière mise à jour** : 2025-11-18
**Prochaine étape** : Phase 1.4 - Dashboards OU Phase 2 - Backend

Voulez-vous démarrer Phase 1.4 ou passer directement à Phase 2 (Backend) ? 🚀
