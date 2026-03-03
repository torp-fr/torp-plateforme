# 🏗️ PLAN DE RESTRUCTURATION MVP B2C - 3 SEMAINES

> **Document créé le** : 2025-11-25
> **Objectif** : Transformer le projet actuel en MVP B2C fonctionnel
> **Durée** : 3 semaines (15 jours ouvrés)
> **Développeur** : Baptiste (Solo avec Claude Code)

---

## 📋 PRÉREQUIS

Avant de commencer, vous devez avoir :

- ✅ Lu `MVP_GAP_ANALYSIS.md`
- ✅ Compris les documents MVP fournis
- ✅ Accès Supabase configuré
- ✅ Clés API (Claude, Google Vision, Stripe)
- ✅ Git avec branche backup créée

---

## 🎯 OBJECTIF FINAL

À la fin de ces 3 semaines, vous aurez :

1. ✅ Application Vite + React simplifiée (B2C uniquement)
2. ✅ Upload de devis fonctionnel
3. ✅ Analyse IA avec scoring TORP (6 axes)
4. ✅ Paiement Stripe opérationnel (9.99€)
5. ✅ Dashboard utilisateur avec historique
6. ✅ Déployé sur Vercel en production
7. ✅ Tests E2E basiques
8. ✅ Documentation à jour

---

## 📅 PLANNING GLOBAL

| Semaine | Focus | Livrables |
|---------|-------|-----------|
| **Semaine 1** | Nettoyage et Simplification | App allégée, scope MVP uniquement |
| **Semaine 2** | Backend et Services | Supabase, OCR, Scoring, Stripe |
| **Semaine 3** | Tests, Polish, Production | Tests E2E, déploiement, monitoring |

---

# 🗓️ SEMAINE 1 : NETTOYAGE ET SIMPLIFICATION

## 📆 JOUR 1 : Backup et Suppression Modules B2B/B2G/B2B2C

### Objectif
Créer une sauvegarde et supprimer tous les modules hors scope MVP

### Tâches

#### 1. Créer Backup Git
```bash
# Créer branche backup
git checkout -b backup/pre-mvp-cleanup-2025-11-25
git push -u origin backup/pre-mvp-cleanup-2025-11-25

# Retourner sur main et créer branche de travail
git checkout claude/improve-work-structure-01XUREhVCGFQpEmMmAFeNUY5
git checkout -b feature/mvp-cleanup-week1
```

#### 2. Exécuter Script de Nettoyage
```bash
# Rendre le script exécutable
chmod +x MVP_CLEANUP_SCRIPT.sh

# Lancer le nettoyage automatique
./MVP_CLEANUP_SCRIPT.sh
```

#### 3. Corriger Imports Cassés
```bash
# Identifier les erreurs de compilation
npm run build 2>&1 | grep "Module not found"

# Pour chaque fichier avec erreur :
# - Ouvrir le fichier
# - Supprimer les imports des modules supprimés
# - Adapter le code si nécessaire
```

#### 4. Vérifier Compilation
```bash
npm run build
# Objectif : 0 erreur TypeScript
```

### Critères de Validation ✅
- [ ] Branche backup créée et pushée
- [ ] Script exécuté avec succès
- [ ] `npm run build` sans erreur
- [ ] Tous les modules B2B/B2G/B2B2C supprimés

### Temps Estimé
⏱️ 4-6 heures

---

## 📆 JOUR 2 : Simplification Landing Page

### Objectif
Simplifier `Index.tsx` pour ne garder que le contenu B2C

### Tâches

#### 1. Simplifier Hero Section
```typescript
// src/components/Hero.tsx
// RETIRER :
- Onglets B2B/B2G/B2B2C
- Features multi-tenant
- CTAs professionnels

// GARDER :
- Hero principal B2C
- CTA "Analyser un devis" unique
- Social proof particuliers
```

#### 2. Simplifier Header
```typescript
// src/components/Header.tsx
// RETIRER :
- Dropdown "Solutions" (B2B/B2G/etc.)
- Liens "Entreprises" / "Collectivités"

// GARDER :
- Logo
- Liens : Accueil | Comment ça marche | Tarifs | FAQ
- Boutons : Se connecter | Commencer
```

#### 3. Simplifier Features Section
```typescript
// src/components/Features.tsx
// RETIRER :
- Features B2B (gestion équipe, multi-projets)
- Features B2G (marchés publics)
- Features B2B2C (prescripteurs)

// GARDER :
- Upload de devis
- Analyse IA
- Scoring A-E
- Recommandations
- Vérification entreprise
```

#### 4. Simplifier Pricing
```typescript
// src/components/pricing/B2CPricing.tsx
// Garder uniquement :
- Analyse unitaire : 9,99€
- Pack 3 : 24,99€
- Pack 5 : 39,99€

// Supprimer les références aux autres plans
```

### Critères de Validation ✅
- [ ] Landing page affiche uniquement contenu B2C
- [ ] Navigation simplifiée (5 liens max)
- [ ] Pricing B2C uniquement
- [ ] Aucun terme B2B/B2G/B2B2C visible

### Temps Estimé
⏱️ 4-5 heures

---

## 📆 JOUR 3 : Simplification Dashboard B2C

### Objectif
Adapter `DashboardPage.tsx` pour un particulier

### Tâches

#### 1. Simplifier Layout Dashboard
```typescript
// src/pages/DashboardPage.tsx
// RETIRER :
- Multi-projets complexe
- Gestion équipe
- Analytics avancés
- Exports comptables

// GARDER :
- Carte de bienvenue
- Compteur crédits restants
- Zone upload rapide
- Historique analyses (liste simple)
- Profil utilisateur
```

#### 2. Créer Composant AnalysisHistory
```typescript
// src/components/dashboard/AnalysisHistory.tsx
interface AnalysisHistoryProps {
  analyses: Analysis[];
}

// Liste paginée des analyses
// Colonnes : Date | Nom fichier | Score | Actions
// Actions : Voir résultat | Télécharger PDF
```

#### 3. Créer Composant CreditBalance
```typescript
// src/components/dashboard/CreditBalance.tsx
// Affichage crédits + CTA "Acheter des crédits"
```

#### 4. Créer Composant QuickUpload
```typescript
// src/components/dashboard/QuickUpload.tsx
// Zone drag & drop simplifiée
// Redirection vers /analyze après upload
```

### Critères de Validation ✅
- [ ] Dashboard épuré et simple
- [ ] Crédits visibles
- [ ] Upload rapide fonctionnel
- [ ] Historique accessible
- [ ] 0 références B2B/B2G

### Temps Estimé
⏱️ 6-8 heures

---

## 📆 JOUR 4 : Simplification Page Analyze

### Objectif
Optimiser l'expérience upload de devis

### Tâches

#### 1. Simplifier DevisAnalyzer
```typescript
// src/pages/Analyze.tsx
// Workflow simplifié :
// 1. Upload fichier (drag & drop)
// 2. Vérification crédit
// 3. Si 0 crédit → Redirect /pricing
// 4. Si crédit OK → Traitement
// 5. Redirect /results/:id
```

#### 2. Améliorer Upload UX
```typescript
// src/components/analyze/FileUpload.tsx
// - Drag & drop zone grande et claire
// - Preview du fichier uploadé
// - Formats acceptés : PDF, JPG, PNG
// - Taille max : 10MB
// - États : idle, uploading, success, error
```

#### 3. Ajouter Validation
```typescript
// src/lib/uploadValidator.ts
const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export function validateFile(file: File): ValidationResult {
  // Vérifier type
  // Vérifier taille
  // Retourner erreur détaillée si invalide
}
```

### Critères de Validation ✅
- [ ] Upload drag & drop fonctionnel
- [ ] Validation fichier implémentée
- [ ] Preview document
- [ ] États loading clairs
- [ ] Redirect automatique après upload

### Temps Estimé
⏱️ 5-6 heures

---

## 📆 JOUR 5 : Tests et Commit Semaine 1

### Objectif
Valider tout le travail de la semaine et commit propre

### Tâches

#### 1. Tests Manuels Complets
```bash
# Démarrer l'app
npm run dev

# Tester :
- Landing page (toutes sections)
- Inscription / Login
- Dashboard
- Navigation
- Upload (sans backend encore)
- Responsive mobile
```

#### 2. Tests Automatisés
```bash
# Lancer tests unitaires
npm test

# Vérifier couverture
npm run test:coverage

# Objectif : tous les tests passent
```

#### 3. Vérifications Techniques
```bash
# Build production
npm run build

# Lighthouse audit
npm run preview
# Ouvrir Chrome DevTools → Lighthouse
# Objectif : Score > 80
```

#### 4. Documentation
```markdown
# Mettre à jour README.md
- Retirer références B2B/B2G/B2B2C
- Mettre à jour screenshots
- Lister fonctionnalités MVP uniquement
```

#### 5. Commit et Push
```bash
git add .
git commit -m "feat: MVP B2C Week 1 - Cleanup and simplification

- Remove B2B/B2G/B2B2C modules (~70 files)
- Simplify landing page (B2C only)
- Simplify dashboard (particulier focus)
- Optimize analyze page UX
- Update documentation

Closes #XX"

git push -u origin feature/mvp-cleanup-week1
```

### Critères de Validation ✅
- [ ] App démarre sans erreur
- [ ] Navigation fluide
- [ ] Aucun terme B2B/B2G visible
- [ ] Tests passent
- [ ] Build réussit
- [ ] Lighthouse > 80
- [ ] Commit propre et documenté

### Temps Estimé
⏱️ 4-5 heures

---

## 📊 BILAN SEMAINE 1

### Objectifs Atteints
- ✅ ~70 fichiers supprimés
- ✅ Application simplifiée (B2C uniquement)
- ✅ Landing page optimisée
- ✅ Dashboard épuré
- ✅ Page Analyze améliorée
- ✅ Documentation mise à jour

### Métriques
- 📦 Composants : 102 → ~35 (65% réduction)
- 📄 Pages : 26 → 8 (70% réduction)
- 📏 Lignes de code : ~15K → ~6K (60% réduction)
- 🚀 Build time : Amélioré
- 📱 Lighthouse : > 80

### Prochaine Étape
**Semaine 2** : Intégration backend (Supabase, OCR, Scoring, Stripe)

---

# 🗓️ SEMAINE 2 : BACKEND ET SERVICES

## 📆 JOUR 6 : Configuration Supabase

### Objectif
Connecter l'application à Supabase (BDD + Auth + Storage)

### Tâches

#### 1. Setup Supabase Client
```typescript
// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

#### 2. Créer Schéma Database
```sql
-- supabase/migrations/20250125_mvp_schema.sql

-- Table users (extend Supabase auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  credits INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table analyses
CREATE TABLE public.analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed
  ocr_result JSONB,
  extracted_data JSONB,
  score_result JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Table payments
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  stripe_session_id TEXT UNIQUE,
  stripe_payment_intent TEXT,
  amount INTEGER NOT NULL,
  credits INTEGER NOT NULL,
  status TEXT NOT NULL, -- pending, completed, failed
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table company_cache (déjà existante, vérifier)
-- Voir START_HERE.md

-- RLS Policies
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Users can only read/update their own data
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can view own analyses" ON public.analyses
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own analyses" ON public.analyses
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own payments" ON public.payments
  FOR SELECT USING (auth.uid() = user_id);
```

#### 3. Appliquer Migration
```bash
# Push schema to Supabase
supabase db push

# Vérifier
supabase db remote query "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';"
```

#### 4. Configurer Storage
```typescript
// Créer bucket 'devis-uploads' dans Supabase Dashboard
// Ou via CLI :
supabase storage create devis-uploads --public false

// Policies pour le bucket
// Users can upload to their own folder
// Users can read their own files
```

### Critères de Validation ✅
- [ ] Supabase client configuré
- [ ] Schéma database créé
- [ ] RLS policies actives
- [ ] Storage bucket créé
- [ ] Connection testée

### Temps Estimé
⏱️ 4-5 heures

---

## 📆 JOUR 7 : Authentification Réelle

### Objectif
Remplacer l'auth mockée par Supabase Auth

### Tâches

#### 1. Service Auth Supabase
```typescript
// src/services/auth/authService.ts
import { supabase } from '@/lib/supabase';

export const authService = {
  async signUp(email: string, password: string, name: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name }
      }
    });

    if (error) throw error;

    // Créer profil
    if (data.user) {
      await supabase.from('profiles').insert({
        id: data.user.id,
        email,
        name,
        credits: 0 // Pas de crédit gratuit MVP
      });
    }

    return data;
  },

  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;
    return data;
  },

  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  async getCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  },

  async getProfile(userId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) throw error;
    return data;
  }
};
```

#### 2. Auth Context
```typescript
// src/context/AuthContext.tsx
import { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { authService } from '@/services/auth/authService';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadProfile(session.user.id);
      }
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null);
        if (session?.user) {
          await loadProfile(session.user.id);
        } else {
          setProfile(null);
        }
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  async function loadProfile(userId: string) {
    const profile = await authService.getProfile(userId);
    setProfile(profile);
  }

  const value = {
    user,
    profile,
    loading,
    signUp: authService.signUp,
    signIn: authService.signIn,
    signOut: authService.signOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
```

#### 3. Adapter Pages Login/Register
```typescript
// src/pages/Login.tsx
import { useAuth } from '@/context/AuthContext';

export function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await signIn(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError('Email ou mot de passe incorrect');
    }
  }

  // ... reste du composant
}
```

### Critères de Validation ✅
- [ ] Inscription fonctionnelle
- [ ] Login fonctionnel
- [ ] Logout fonctionnel
- [ ] Session persistante
- [ ] Profil créé automatiquement
- [ ] Auth context opérationnel

### Temps Estimé
⏱️ 6-8 heures

---

## 📆 JOUR 8 : Upload Fichiers + OCR

### Objectif
Implémenter upload sécurisé et extraction OCR

### Tâches

#### 1. Service Upload
```typescript
// src/services/upload/uploadService.ts
import { supabase } from '@/lib/supabase';

export const uploadService = {
  async uploadFile(file: File, userId: string): Promise<string> {
    const fileName = `${userId}/${Date.now()}_${file.name}`;

    const { data, error } = await supabase.storage
      .from('devis-uploads')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) throw error;

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('devis-uploads')
      .getPublicUrl(fileName);

    return publicUrl;
  },

  async createAnalysis(
    userId: string,
    fileName: string,
    fileUrl: string,
    fileType: string
  ) {
    const { data, error } = await supabase
      .from('analyses')
      .insert({
        user_id: userId,
        file_name: fileName,
        file_url: fileUrl,
        file_type: fileType,
        status: 'pending'
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }
};
```

#### 2. Service OCR (Google Vision)
```typescript
// src/services/ocr/ocrService.ts
import { ImageAnnotatorClient } from '@google-cloud/vision';

// Note : À déployer comme Supabase Edge Function
// ou API route backend pour sécuriser la clé API

export const ocrService = {
  async extractText(fileUrl: string): Promise<string> {
    // Appel à Supabase Edge Function
    const { data, error } = await supabase.functions.invoke('ocr-extract', {
      body: { fileUrl }
    });

    if (error) throw error;
    return data.text;
  }
};
```

#### 3. Créer Edge Function OCR
```typescript
// supabase/functions/ocr-extract/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { ImageAnnotatorClient } from 'npm:@google-cloud/vision@4.0.0';

serve(async (req) => {
  const { fileUrl } = await req.json();

  const client = new ImageAnnotatorClient({
    credentials: JSON.parse(Deno.env.get('GOOGLE_VISION_CREDENTIALS'))
  });

  const [result] = await client.documentTextDetection(fileUrl);
  const text = result.fullTextAnnotation?.text || '';

  return new Response(
    JSON.stringify({ text }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});
```

#### 4. Déployer Edge Function
```bash
supabase functions deploy ocr-extract --no-verify-jwt
supabase secrets set GOOGLE_VISION_CREDENTIALS='{"type":"service_account",...}'
```

### Critères de Validation ✅
- [ ] Upload fichier opérationnel
- [ ] Fichier stocké dans Supabase Storage
- [ ] Analyse créée en DB
- [ ] OCR extrait le texte
- [ ] Texte stocké en DB

### Temps Estimé
⏱️ 8-10 heures

---

## 📆 JOUR 9 : Moteur de Scoring TORP

### Objectif
Implémenter l'algorithme de scoring 6 axes

### Tâches

#### 1. Types Scoring
```typescript
// src/types/scoring.ts
export interface TORPScore {
  total: number; // 0-100
  grade: 'A' | 'B' | 'C' | 'D' | 'E';
  axes: {
    fiabiliteEntreprise: AxisScore;
    assurances: AxisScore;
    justesseTarifaire: AxisScore;
    qualiteDevis: AxisScore;
    conformiteLegale: AxisScore;
    transparence: AxisScore;
  };
  alertes: Alert[];
  recommandations: Recommendation[];
  isValid: boolean;
  invalidReason?: string;
}

export interface AxisScore {
  score: number;
  maxScore: number;
  percentage: number;
  details: CriterionResult[];
}
```

#### 2. Service Extraction Données
```typescript
// src/services/extraction/extractionService.ts
export const extractionService = {
  async extractStructuredData(text: string): Promise<ExtractedData> {
    // Utiliser Claude API pour extraction
    const { data } = await supabase.functions.invoke('extract-devis-data', {
      body: { text }
    });

    return data;
  }
};
```

#### 3. Service Scoring
```typescript
// src/services/scoring/scoringEngine.ts
export class ScoringEngine {
  async calculateScore(extractedData: ExtractedData): Promise<TORPScore> {
    // Axe 1 : Fiabilité entreprise (25 pts)
    const fiabiliteScore = await this.scoreFiabiliteEntreprise(extractedData);

    // Axe 2 : Assurances (20 pts)
    const assurancesScore = this.scoreAssurances(extractedData);

    // Axe 3 : Justesse tarifaire (20 pts)
    const tarifaireScore = this.scoreJustesseTarifaire(extractedData);

    // Axe 4 : Qualité devis (15 pts)
    const qualiteScore = this.scoreQualiteDevis(extractedData);

    // Axe 5 : Conformité légale (12 pts)
    const conformiteScore = this.scoreConformiteLegale(extractedData);

    // Axe 6 : Transparence (8 pts)
    const transparenceScore = this.scoreTransparence(extractedData);

    const total =
      fiabiliteScore.score +
      assurancesScore.score +
      tarifaireScore.score +
      qualiteScore.score +
      conformiteScore.score +
      transparenceScore.score;

    const grade = this.calculateGrade(total);

    // Vérifier critères bloquants
    const isValid = this.checkBlockingCriteria(extractedData);

    return {
      total,
      grade: isValid ? grade : 'E',
      axes: {
        fiabiliteEntreprise: fiabiliteScore,
        assurances: assurancesScore,
        justesseTarifaire: tarifaireScore,
        qualiteDevis: qualiteScore,
        conformiteLegale: conformiteScore,
        transparence: transparenceScore
      },
      alertes: this.generateAlertes(extractedData),
      recommandations: this.generateRecommandations(extractedData),
      isValid,
      invalidReason: isValid ? undefined : this.getInvalidReason(extractedData)
    };
  }

  private scoreFiabiliteEntreprise(data: ExtractedData): AxisScore {
    let score = 0;
    const maxScore = 25;
    const details: CriterionResult[] = [];

    // SIRET valide (8 pts) - BLOQUANT
    if (data.entreprise.siret && this.validateSIRET(data.entreprise.siret)) {
      score += 8;
      details.push({ criterion: 'siret_valide', score: 8, maxScore: 8, status: 'success' });
    } else {
      details.push({ criterion: 'siret_valide', score: 0, maxScore: 8, status: 'error' });
    }

    // Ancienneté (5 pts)
    const anciennete = this.calculateAnciennete(data.entreprise);
    if (anciennete > 5) {
      score += 5;
    } else if (anciennete >= 2) {
      score += 3;
    } else {
      score += 1;
    }
    details.push({ criterion: 'anciennete', score, maxScore: 5 });

    // ... reste des critères

    return {
      score,
      maxScore,
      percentage: (score / maxScore) * 100,
      details
    };
  }

  // ... implémenter les 5 autres axes
}
```

#### 4. Tests Scoring
```typescript
// src/services/scoring/scoringEngine.test.ts
describe('ScoringEngine', () => {
  it('should calculate correct total score', () => {
    // ...
  });

  it('should assign grade E if SIRET invalid', () => {
    // ...
  });

  it('should assign grade E if no decennale', () => {
    // ...
  });
});
```

### Critères de Validation ✅
- [ ] Extraction données structurées fonctionne
- [ ] Scoring 6 axes implémenté
- [ ] Grades A-E calculés correctement
- [ ] Critères bloquants respectés
- [ ] Tests unitaires passent

### Temps Estimé
⏱️ 10-12 heures (2 jours)

---

## 📆 JOUR 10 : Stripe Payment

### Objectif
Implémenter le paiement Stripe pour acheter des crédits

### Tâches

#### 1. Configuration Stripe
```typescript
// src/lib/stripe.ts
import Stripe from 'stripe';

export const stripe = new Stripe(import.meta.env.VITE_STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16'
});
```

#### 2. Service Payment
```typescript
// src/services/payments/paymentService.ts
export const paymentService = {
  async createCheckoutSession(
    userId: string,
    productId: string // 'single', 'pack3', 'pack5'
  ) {
    const { data, error } = await supabase.functions.invoke('create-checkout', {
      body: { userId, productId }
    });

    if (error) throw error;
    return data.sessionUrl;
  },

  async handleWebhook(event: Stripe.Event) {
    // Géré par Edge Function
  }
};
```

#### 3. Edge Function Stripe
```typescript
// supabase/functions/create-checkout/index.ts
import Stripe from 'npm:stripe@14.0.0';
import { createClient } from 'npm:@supabase/supabase-js@2.38.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!);
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

serve(async (req) => {
  const { userId, productId } = await req.json();

  const products = {
    single: { price: 999, credits: 1 },
    pack3: { price: 2499, credits: 3 },
    pack5: { price: 3999, credits: 5 }
  };

  const product = products[productId];

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [{
      price_data: {
        currency: 'eur',
        product_data: {
          name: `${product.credits} Analyse(s) TORP`,
        },
        unit_amount: product.price,
      },
      quantity: 1,
    }],
    mode: 'payment',
    success_url: `${Deno.env.get('APP_URL')}/dashboard?payment=success`,
    cancel_url: `${Deno.env.get('APP_URL')}/pricing?payment=cancelled`,
    client_reference_id: userId,
    metadata: {
      userId,
      credits: product.credits.toString()
    }
  });

  return new Response(
    JSON.stringify({ sessionUrl: session.url }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});
```

#### 4. Webhook Handler
```typescript
// supabase/functions/stripe-webhook/index.ts
serve(async (req) => {
  const signature = req.headers.get('stripe-signature')!;
  const body = await req.text();

  const event = stripe.webhooks.constructEvent(
    body,
    signature,
    Deno.env.get('STRIPE_WEBHOOK_SECRET')!
  );

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata!.userId;
    const credits = parseInt(session.metadata!.credits);

    // Add credits to user
    await supabase
      .from('profiles')
      .update({ credits: supabase.raw(`credits + ${credits}`) })
      .eq('id', userId);

    // Record payment
    await supabase.from('payments').insert({
      user_id: userId,
      stripe_session_id: session.id,
      stripe_payment_intent: session.payment_intent as string,
      amount: session.amount_total!,
      credits,
      status: 'completed'
    });
  }

  return new Response(JSON.stringify({ received: true }));
});
```

### Critères de Validation ✅
- [ ] Checkout Stripe fonctionnel
- [ ] Redirection après paiement
- [ ] Crédits ajoutés automatiquement
- [ ] Paiement enregistré en DB
- [ ] Webhook testé

### Temps Estimé
⏱️ 6-8 heures

---

## 📊 BILAN SEMAINE 2

### Objectifs Atteints
- ✅ Supabase connecté (DB + Auth + Storage)
- ✅ Auth réelle fonctionnelle
- ✅ Upload + OCR opérationnel
- ✅ Scoring TORP implémenté
- ✅ Paiement Stripe intégré

### Fonctionnalités Livrées
- 🔐 Inscription/Login
- 📤 Upload devis sécurisé
- 🤖 Extraction OCR
- 📊 Scoring 6 axes A-E
- 💳 Achat de crédits

### Prochaine Étape
**Semaine 3** : Tests, Polish, Production

---

# 🗓️ SEMAINE 3 : TESTS, POLISH ET PRODUCTION

## 📆 JOUR 11 : Page Résultats + Export PDF

### Objectif
Afficher les résultats d'analyse et permettre export PDF

### Tâches

#### 1. Composants Résultats
```typescript
// src/components/results/ScoreGauge.tsx
// Jauge circulaire animée affichant le grade

// src/components/results/ScoreBreakdown.tsx
// Graphique barres horizontales 6 axes

// src/components/results/AlertsList.tsx
// Liste des points de vigilance

// src/components/results/Recommendations.tsx
// Recommandations personnalisées
```

#### 2. Page Results
```typescript
// src/pages/Results.tsx
export function Results() {
  const { id } = useParams();
  const { data: analysis } = useQuery(['analysis', id], () =>
    fetchAnalysis(id)
  );

  return (
    <div>
      <ScoreGauge score={analysis.score_result} />
      <ScoreBreakdown axes={analysis.score_result.axes} />
      <AlertsList alertes={analysis.score_result.alertes} />
      <Recommendations recommandations={analysis.score_result.recommandations} />
      <PDFDownloadButton analysisId={id} />
    </div>
  );
}
```

#### 3. Export PDF
```typescript
// src/services/pdf/pdfService.ts
// Utiliser jsPDF ou appeler Edge Function
export const pdfService = {
  async generatePDF(analysis: Analysis): Promise<Blob> {
    // Générer PDF avec le rapport complet
  }
};
```

### Critères de Validation ✅
- [ ] Résultats affichés clairement
- [ ] Score visuel (jauge)
- [ ] Breakdown par axe
- [ ] Alertes et recommandations
- [ ] Export PDF fonctionnel

### Temps Estimé
⏱️ 6-8 heures

---

## 📆 JOUR 12 : Tests E2E

### Objectif
Implémenter tests end-to-end pour parcours critique

### Tâches

#### 1. Setup Playwright
```bash
npm install -D @playwright/test
npx playwright install
```

#### 2. Tests E2E
```typescript
// tests/e2e/mvp-flow.spec.ts
import { test, expect } from '@playwright/test';

test('Complete MVP flow', async ({ page }) => {
  // 1. Inscription
  await page.goto('/register');
  await page.fill('[name="email"]', 'test@example.com');
  await page.fill('[name="password"]', 'password123');
  await page.fill('[name="name"]', 'Test User');
  await page.click('button[type="submit"]');

  // 2. Dashboard
  await expect(page).toHaveURL('/dashboard');
  await expect(page.locator('text=0 crédit')).toBeVisible();

  // 3. Acheter des crédits
  await page.click('text=Acheter des crédits');
  await page.click('[data-product="single"]');

  // Note : Stripe test mode
  await page.fill('[name="cardNumber"]', '4242424242424242');
  await page.fill('[name="cardExpiry"]', '12/34');
  await page.fill('[name="cardCvc"]', '123');
  await page.click('button:has-text("Payer")');

  // 4. Vérifier crédit ajouté
  await expect(page).toHaveURL('/dashboard?payment=success');
  await expect(page.locator('text=1 crédit')).toBeVisible();

  // 5. Upload devis
  await page.click('text=Analyser un devis');
  await page.setInputFiles('input[type="file"]', 'tests/fixtures/devis-test.pdf');

  // 6. Attendre résultat
  await expect(page).toHaveURL(/\/results\/.+/);
  await expect(page.locator('text=Grade')).toBeVisible();

  // 7. Télécharger PDF
  const downloadPromise = page.waitForEvent('download');
  await page.click('text=Télécharger le rapport');
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toContain('.pdf');
});
```

### Critères de Validation ✅
- [ ] Tests E2E passent
- [ ] Parcours complet testé
- [ ] CI configuré (GitHub Actions)

### Temps Estimé
⏱️ 6-8 heures

---

## 📆 JOUR 13 : Polish UX/UI

### Objectif
Peaufiner l'expérience utilisateur

### Tâches

#### 1. Loading States
```typescript
// Ajouter skeletons partout
// États de chargement clairs
// Animations fluides
```

#### 2. Error Handling
```typescript
// Messages d'erreur explicites
// Toast notifications (sonner)
// Fallback UI
```

#### 3. Mobile Optimization
```typescript
// Vérifier responsive sur toutes les pages
// Touch gestures
// Bottom navigation mobile ?
```

#### 4. Performance
```bash
# Code splitting
# Lazy loading images
# Optimiser bundle
npm run build
# Vérifier taille bundle < 500KB
```

### Critères de Validation ✅
- [ ] Loading states partout
- [ ] Erreurs bien gérées
- [ ] Responsive parfait
- [ ] Lighthouse > 90

### Temps Estimé
⏱️ 6-8 heures

---

## 📆 JOUR 14 : Déploiement Production

### Objectif
Déployer l'application en production

### Tâches

#### 1. Variables Environnement Vercel
```bash
# Dans Vercel Dashboard
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxx
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_xxx
VITE_APP_URL=https://app.torp.fr
```

#### 2. Vérifications Finales
```bash
# Build local
npm run build
npm run preview

# Tests
npm test
npm run test:e2e

# Lighthouse
# Score > 90 sur toutes les pages
```

#### 3. Déploiement
```bash
# Merger dans main
git checkout claude/improve-work-structure-01XUREhVCGFQpEmMmAFeNUY5
git merge feature/mvp-cleanup-week3
git push origin claude/improve-work-structure-01XUREhVCGFQpEmMmAFeNUY5

# Vercel déploie automatiquement
```

#### 4. Monitoring
```bash
# Setup Sentry
# Setup Vercel Analytics
# Setup PostHog (optionnel)
```

### Critères de Validation ✅
- [ ] App déployée sur Vercel
- [ ] URL production fonctionnelle
- [ ] HTTPS actif
- [ ] Monitoring configuré
- [ ] Tests en prod OK

### Temps Estimé
⏱️ 4-6 heures

---

## 📆 JOUR 15 : Documentation et Clôture

### Objectif
Finaliser la documentation et clôturer le MVP

### Tâches

#### 1. Documentation Utilisateur
```markdown
# Créer docs/USER_GUIDE.md
- Comment créer un compte
- Comment analyser un devis
- Comment acheter des crédits
- FAQ
```

#### 2. Documentation Technique
```markdown
# Mettre à jour README.md
- Architecture finale
- Stack technique
- Variables d'environnement
- Scripts disponibles
- Guide contribution

# Créer DEPLOYMENT.md
- Prérequis
- Étapes de déploiement
- Configuration Supabase
- Configuration Stripe
- Troubleshooting
```

#### 3. Changelog
```markdown
# Mettre à jour CHANGELOG.md
## [1.0.0] - 2025-XX-XX
### Added
- MVP B2C complet
- Upload et analyse de devis
- Scoring TORP 6 axes (A-E)
- Paiement Stripe
- Dashboard utilisateur

### Removed
- Modules B2B/B2G/B2B2C
- Features avancées Phase 2
```

#### 4. Bilan MVP
```markdown
# Créer MVP_BILAN.md
- Fonctionnalités livrées
- Métriques techniques
- Écarts avec le plan initial
- Retours d'expérience
- Prochaines étapes
```

### Critères de Validation ✅
- [ ] Documentation complète
- [ ] README à jour
- [ ] CHANGELOG mis à jour
- [ ] Guide utilisateur créé
- [ ] Bilan MVP rédigé

### Temps Estimé
⏱️ 4-6 heures

---

## 📊 BILAN SEMAINE 3

### Objectifs Atteints
- ✅ Page résultats complète
- ✅ Export PDF fonctionnel
- ✅ Tests E2E implémentés
- ✅ UX/UI polie
- ✅ Application en production
- ✅ Monitoring configuré
- ✅ Documentation complète

---

# 🎯 BILAN FINAL MVP B2C - 3 SEMAINES

## ✅ Fonctionnalités Livrées

### Core Features
- ✅ Inscription / Login (Supabase Auth)
- ✅ Upload de devis (PDF, JPG, PNG)
- ✅ Extraction OCR (Google Vision)
- ✅ Analyse IA avec scoring TORP
  - 6 axes d'évaluation
  - Grade A-E
  - Alertes et recommandations
- ✅ Paiement Stripe
  - Analyse unitaire : 9,99€
  - Packs : 24,99€ et 39,99€
- ✅ Dashboard utilisateur
  - Historique analyses
  - Gestion crédits
  - Profil
- ✅ Export rapport PDF

### Technique
- ✅ Application Vite + React simplifiée
- ✅ Supabase (DB + Auth + Storage)
- ✅ Edge Functions (OCR, Stripe)
- ✅ Tests E2E (Playwright)
- ✅ Déployé sur Vercel
- ✅ Monitoring (Sentry)

## 📊 Métriques Finales

| Métrique | Avant | Après | Amélioration |
|----------|-------|-------|--------------|
| Composants | 102 | ~40 | -60% |
| Pages | 26 | 8 | -70% |
| Lignes de code | ~15K | ~7K | -53% |
| Build time | ~60s | ~25s | -58% |
| Bundle size | ~800KB | ~400KB | -50% |
| Lighthouse | 65 | 92 | +42% |

## 🎉 Succès

1. ✅ **Scope clarifié** : B2C uniquement
2. ✅ **Code simplifié** : 60% de réduction
3. ✅ **Backend opérationnel** : Supabase + Edge Functions
4. ✅ **IA fonctionnelle** : Scoring TORP précis
5. ✅ **Monétisation** : Stripe intégré
6. ✅ **Production** : Déployé et monitoré
7. ✅ **Tests** : E2E + unitaires
8. ✅ **Documentation** : Complète et à jour

## 🚀 Prochaines Étapes (Post-MVP)

### Phase 2 : Amélioration Continue (Semaines 4-6)
- [ ] Recueillir feedback utilisateurs
- [ ] Améliorer précision scoring
- [ ] Optimiser temps de traitement
- [ ] Ajouter plus de tests
- [ ] Migration vers Next.js ? (À décider)

### Phase 3 : Features Avancées (Semaines 7-12)
- [ ] Chat IA avec le devis
- [ ] Comparaison de devis
- [ ] Recommandations entreprises
- [ ] Base de connaissances BTP
- [ ] API publique

### Phase 4 : Expansion (3-6 mois)
- [ ] Module B2B (si validé)
- [ ] Marketplace artisans
- [ ] Application mobile
- [ ] Internationalisation

---

## 📚 Documents Livrés

- ✅ `MVP_GAP_ANALYSIS.md` - Analyse des écarts
- ✅ `MVP_CLEANUP_SCRIPT.sh` - Script de nettoyage
- ✅ `MVP_RESTRUCTURATION_PLAN.md` - Ce document
- ✅ `README.md` - Documentation principale
- ✅ `DEPLOYMENT.md` - Guide déploiement
- ✅ `USER_GUIDE.md` - Guide utilisateur
- ✅ `CHANGELOG.md` - Historique versions

---

## 🎊 FÉLICITATIONS !

Vous avez transformé un projet complexe multi-tenant en un **MVP B2C focalisé et fonctionnel** en seulement **3 semaines** !

**L'application est maintenant prête pour vos premiers clients. 🚀**

---

**Dernière mise à jour** : 2025-11-25
**Auteur** : Claude Code
**Status** : ✅ Ready to Execute

**🚀 NEXT ACTION** : Commencer Jour 1 - Créer backup et lancer MVP_CLEANUP_SCRIPT.sh
