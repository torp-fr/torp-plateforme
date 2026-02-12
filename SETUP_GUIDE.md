# 🚀 TORP MVP - Setup Guide

## Configuration Supabase & Déploiement

### ÉTAPE 1: Exécuter les Migrations SQL

**Option A: Via Supabase Dashboard (Recommandé)**

1. Aller à: https://supabase.com/dashboard
2. Sélectionner votre projet `iixxzfgexmiofvmfrnuy`
3. Aller à **SQL Editor**
4. Créer une nouvelle query
5. Copier le contenu de: `supabase/migrations/000_mvp_clean_slate.sql`
6. Coller dans l'éditeur
7. Cliquer **RUN**

**Option B: Via Supabase CLI (si installé)**
```bash
supabase link --project-ref iixxzfgexmiofvmfrnuy
supabase db push
```

---

### ÉTAPE 2: Vérifier les Storage Buckets

1. Aller à **Storage** dans Supabase Dashboard
2. Vérifier que `devis_uploads` et `documents` existent
3. Si manquants, créer via SQL:
```sql
INSERT INTO storage.buckets (id, name, public) 
VALUES ('devis_uploads', 'devis_uploads', false);

INSERT INTO storage.buckets (id, name, public) 
VALUES ('documents', 'documents', false);
```

---

### ÉTAPE 3: Déployer les Edge Functions

**Edge Functions existantes:**
- ✅ analyze-devis (main scoring)
- ✅ extract-pdf (PDF extraction)
- ✅ llm-completion (Claude/GPT routing)
- ✅ generate-embedding (text embeddings)

**Installation CLI Supabase:**
```bash
# Install
npm install -g supabase

# Login
supabase login

# Link project
supabase link --project-ref iixxzfgexmiofvmfrnuy

# Deploy functions
supabase functions deploy

# Or specific function:
supabase functions deploy analyze-devis
```

---

### ÉTAPE 4: Variables d'Environnement - Vercel

Ajouter dans Vercel Dashboard → Settings → Environment Variables:

```
VITE_SUPABASE_URL = https://iixxzfgexmiofvmfrnuy.supabase.co
VITE_SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlpeHh6ZmdleG1pb2Z2bWZybnV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4OTgyOTMsImV4cCI6MjA4NjQ3NDI5M30.pyVLm8Wj23G63SF5MYgBq4vA0-5vd4_W0st8Tg3AEs8
VITE_ANTHROPIC_API_KEY = sk-ant-v7-... (existant déjà selon vous)
VITE_AUTH_PROVIDER = supabase
VITE_MOCK_API = false
```

---

### ÉTAPE 5: Test Local

```bash
# Développement local
npm run dev

# Test upload:
# 1. Aller à http://localhost:8080
# 2. /analyze page
# 3. Upload un PDF de test
# 4. Voir si extraction + scoring fonctionne
```

---

## ✅ Checklist de Déploiement

- [ ] .env.local créé avec clés Supabase
- [ ] Migration 000_mvp_clean_slate.sql exécutée
- [ ] Storage buckets créés (devis_uploads, documents)
- [ ] RLS policies activées
- [ ] Edge Functions deployées (ou at least one function)
- [ ] Vercel env vars configurées
- [ ] Test local npm run dev
- [ ] Upload PDF test
- [ ] Voir scoring fonctionne
- [ ] Déployer sur Vercel

---

## 🔧 Troubleshooting

**Erreur: "VITE_SUPABASE_URL not found"**
→ Vérifier .env.local existe dans root

**Erreur: "Devis upload failed"**
→ Vérifier que storage buckets existent dans Supabase

**Erreur: "RLS policy denies access"**
→ Vérifier que utilisateur est authentifié (auth.uid() valide)

**Erreur: "Claude API not configured"**
→ Vérifier VITE_ANTHROPIC_API_KEY est correct dans Vercel

---

## 📊 Architecture MVP

```
FRONTEND (Vite + React)
├── /analyze ..................... Upload PDF
├── /results ..................... Affichage score
├── /dashboard ................... Historique
└── Protected routes ............ MainLayout

SUPABASE BACKEND
├── Database ..................... users, devis, projects, companies
├── Storage ...................... devis_uploads (PDF files)
├── Edge Functions
│   ├── analyze-devis ........... 9-step scoring (Claude)
│   ├── extract-pdf ............. OCR + text extraction
│   └── llm-completion .......... AI routing
└── RLS .......................... Row-level security

EXTERNAL APIs
├── Claude/Anthropic ............ VITE_ANTHROPIC_API_KEY
├── Vercel ...................... Deployment
└── GitHub ...................... Version control
```

---

## 🎯 Next Steps After Setup

1. Test fully with real PDFs
2. Collect artisan feedback
3. Iterate on scoring logic
4. Add optional features (comparisons, Excel export)
5. Setup monitoring (Sentry)
6. Plan monetization

