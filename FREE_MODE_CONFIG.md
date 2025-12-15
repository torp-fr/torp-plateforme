# 🎁 CONFIGURATION MODE GRATUIT - Phase Test

> **Objectif** : Rendre TORP gratuit pour les testeurs sans supprimer le code Stripe
> **Stratégie** : Flag de configuration qui active/désactive le paiement
> **Durée** : 2-3 mois de test, puis activation paiement

---

## 🎯 CONCEPT

### Ce qu'on veut

- ✅ Interface pricing **visible** (pour montrer le modèle économique)
- ✅ Code Stripe **présent** mais **inactif**
- ✅ Crédits **illimités** pour tous les utilisateurs
- ✅ Badge "Testeur" visible dans le dashboard
- ✅ Possibilité d'**activer le paiement** en 1 variable d'environnement

### Ce qu'on ne veut pas

- ❌ Supprimer le code Stripe
- ❌ Cacher complètement le pricing
- ❌ Avoir à recoder tout le système de paiement plus tard

---

## ⚙️ IMPLÉMENTATION

### Étape 1 : Variables Environnement

#### Fichier : `.env`
```bash
# Mode gratuit pour phase test
VITE_FREE_MODE=true

# Crédits par défaut (illimités en mode gratuit)
VITE_DEFAULT_CREDITS=999999

# Message affiché aux utilisateurs
VITE_FREE_MODE_MESSAGE="🎉 TORP est gratuit pendant la phase de test !"
```

#### Fichier : `.env.example`
```bash
# Configuration Application
VITE_APP_ENV=development
VITE_API_BASE_URL=http://localhost:5173

# Supabase
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxx

# Stripe (inactif si FREE_MODE=true)
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_xxx

# Mode Gratuit (true pour phase test, false pour production payante)
VITE_FREE_MODE=true
VITE_DEFAULT_CREDITS=999999
VITE_FREE_MODE_MESSAGE="🎉 TORP est gratuit pendant la phase de test !"
```

#### Fichier : `.env.production` (pour plus tard)
```bash
# Quand vous activerez le paiement:
VITE_FREE_MODE=false
VITE_DEFAULT_CREDITS=0
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_xxx  # Clé live
```

---

### Étape 2 : Configuration Centralisée

#### Fichier : `src/config/env.ts`

Ajouter ou mettre à jour :

```typescript
// src/config/env.ts

function getEnvVar(key: string, defaultValue?: string): string {
  const value = import.meta.env[key];
  if (!value && defaultValue === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value || defaultValue || '';
}

function getBooleanEnv(key: string, defaultValue: boolean = false): boolean {
  const value = import.meta.env[key];
  if (value === undefined) return defaultValue;
  return value === 'true' || value === '1';
}

function getNumberEnv(key: string, defaultValue: number): number {
  const value = import.meta.env[key];
  if (value === undefined) return defaultValue;
  return parseInt(value, 10);
}

export const config = {
  app: {
    env: getEnvVar('VITE_APP_ENV', 'development'),
    apiBaseUrl: getEnvVar('VITE_API_BASE_URL', ''),
    debugMode: getBooleanEnv('VITE_DEBUG_MODE', false),
  },

  supabase: {
    url: getEnvVar('VITE_SUPABASE_URL'),
    anonKey: getEnvVar('VITE_SUPABASE_ANON_KEY'),
  },

  stripe: {
    publishableKey: getEnvVar('VITE_STRIPE_PUBLISHABLE_KEY', ''),
  },

  // ✨ NOUVEAU : Configuration mode gratuit
  freeMode: {
    enabled: getBooleanEnv('VITE_FREE_MODE', false),
    defaultCredits: getNumberEnv('VITE_DEFAULT_CREDITS', 999999),
    message: getEnvVar(
      'VITE_FREE_MODE_MESSAGE',
      '🎉 TORP est gratuit pendant la phase de test !'
    ),
  },

  // Helper pour faciliter l'usage
  get isFreeMode(): boolean {
    return this.freeMode.enabled;
  },

  get defaultCredits(): number {
    return this.freeMode.enabled ? this.freeMode.defaultCredits : 0;
  },
} as const;

export type Config = typeof config;
```

---

### Étape 3 : Adapter l'Authentification

#### Fichier : `src/services/auth/authService.ts`

```typescript
// src/services/auth/authService.ts
import { supabase } from '@/lib/supabase';
import { config } from '@/config/env';

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

    // Créer profil avec crédits
    if (data.user) {
      await supabase.from('profiles').insert({
        id: data.user.id,
        email,
        name,
        // ✨ Crédits selon mode gratuit ou non
        credits: config.defaultCredits,
      });
    }

    return data;
  },

  // ... reste du code inchangé
};
```

---

### Étape 4 : Composant Badge Testeur

#### Fichier : `src/components/dashboard/TesterBadge.tsx` (nouveau)

```typescript
// src/components/dashboard/TesterBadge.tsx
import { Badge } from '@/components/ui/badge';
import { config } from '@/config/env';

export function TesterBadge() {
  if (!config.isFreeMode) return null;

  return (
    <Badge variant="success" className="animate-pulse">
      🎉 Testeur
    </Badge>
  );
}
```

---

### Étape 5 : Adapter le Dashboard

#### Fichier : `src/components/dashboard/CreditBalance.tsx`

```typescript
// src/components/dashboard/CreditBalance.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { config } from '@/config/env';
import { TesterBadge } from './TesterBadge';

interface CreditBalanceProps {
  credits: number;
}

export function CreditBalance({ credits }: CreditBalanceProps) {
  const navigate = useNavigate();

  // Mode gratuit - Affichage spécial
  if (config.isFreeMode) {
    return (
      <Card className="border-2 border-green-500">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Analyses</CardTitle>
            <TesterBadge />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="text-4xl font-bold text-green-600">∞</div>
            <p className="text-sm text-muted-foreground mt-1">
              Illimitées
            </p>
          </div>

          <div className="bg-green-50 dark:bg-green-950 p-3 rounded-lg">
            <p className="text-sm font-medium text-green-800 dark:text-green-200">
              {config.freeMode.message}
            </p>
            <p className="text-xs text-green-600 dark:text-green-400 mt-1">
              Profitez de toutes les fonctionnalités gratuitement pendant la phase de test.
            </p>
          </div>

          <Button
            variant="outline"
            onClick={() => navigate('/pricing')}
            className="w-full"
          >
            Voir les futurs tarifs
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Mode normal - Affichage avec crédits
  return (
    <Card>
      <CardHeader>
        <CardTitle>Crédits restants</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="text-4xl font-bold">{credits}</div>
          <p className="text-sm text-muted-foreground mt-1">
            {credits === 0 ? 'Aucun crédit' : `Analyse${credits > 1 ? 's' : ''} disponible${credits > 1 ? 's' : ''}`}
          </p>
        </div>

        {credits === 0 && (
          <div className="bg-orange-50 dark:bg-orange-950 p-3 rounded-lg">
            <p className="text-sm text-orange-800 dark:text-orange-200">
              Vous n'avez plus de crédit. Achetez-en pour continuer à analyser vos devis.
            </p>
          </div>
        )}

        <Button
          onClick={() => navigate('/pricing')}
          className="w-full"
          variant={credits === 0 ? 'default' : 'outline'}
        >
          {credits === 0 ? 'Acheter des crédits' : 'Recharger'}
        </Button>
      </CardContent>
    </Card>
  );
}
```

---

### Étape 6 : Adapter la Page Pricing

#### Fichier : `src/pages/Pricing.tsx`

```typescript
// src/pages/Pricing.tsx
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Info } from 'lucide-react';
import { config } from '@/config/env';
import { B2CPricing } from '@/components/pricing/B2CPricing';

export function Pricing() {
  // Mode gratuit - Afficher les tarifs futurs mais désactiver l'achat
  if (config.isFreeMode) {
    return (
      <div className="container mx-auto py-12 px-4">
        <div className="max-w-5xl mx-auto space-y-8">
          {/* Alerte mode gratuit */}
          <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
            <Info className="h-5 w-5 text-green-600" />
            <AlertTitle className="text-green-800 dark:text-green-200">
              Phase de Test Gratuite 🎉
            </AlertTitle>
            <AlertDescription className="text-green-700 dark:text-green-300">
              <p className="mb-2">
                {config.freeMode.message}
              </p>
              <p className="text-sm">
                Profitez d'<strong>analyses illimitées</strong> pour tester toutes les fonctionnalités.
                Le paiement sera activé prochainement.
              </p>
            </AlertDescription>
          </Alert>

          {/* Titre */}
          <div className="text-center space-y-4">
            <Badge variant="outline" className="mb-2">
              Tarifs Futurs
            </Badge>
            <h1 className="text-4xl font-bold">Tarification TORP</h1>
            <p className="text-xl text-muted-foreground">
              Voici les tarifs qui seront appliqués après la phase de test
            </p>
          </div>

          {/* Grille de prix (désactivée) */}
          <div className="grid md:grid-cols-3 gap-6">
            <PricingCard
              name="Analyse Unitaire"
              price="9,99€"
              description="Pour tester le service"
              features={[
                '1 analyse de devis',
                'Score TORP détaillé',
                'Vérification entreprise',
                'Rapport PDF',
              ]}
              disabled
              badge="Actuellement gratuit"
            />

            <PricingCard
              name="Pack 3"
              price="24,99€"
              description="Le plus populaire"
              features={[
                '3 analyses de devis',
                'Score TORP détaillé',
                'Vérification entreprise',
                'Rapport PDF',
                'Économie de 17%',
              ]}
              disabled
              badge="Actuellement gratuit"
              popular
            />

            <PricingCard
              name="Pack 5"
              price="39,99€"
              description="Pour plusieurs projets"
              features={[
                '5 analyses de devis',
                'Score TORP détaillé',
                'Vérification entreprise',
                'Rapport PDF',
                'Économie de 20%',
              ]}
              disabled
              badge="Actuellement gratuit"
            />
          </div>

          {/* FAQ courte */}
          <div className="max-w-2xl mx-auto mt-12">
            <h2 className="text-2xl font-bold mb-6 text-center">Questions Fréquentes</h2>
            <div className="space-y-4">
              <FAQItem
                question="Combien de temps durera la phase gratuite ?"
                answer="La phase de test gratuite durera environ 2-3 mois. Nous vous préviendrons à l'avance avant l'activation du paiement."
              />
              <FAQItem
                question="Que se passera-t-il avec mes analyses après la phase gratuite ?"
                answer="Toutes vos analyses resteront accessibles. Vous pourrez continuer à consulter vos anciens rapports gratuitement."
              />
              <FAQItem
                question="Y aura-t-il une offre pour les testeurs ?"
                answer="Oui ! Les testeurs actifs bénéficieront d'une offre spéciale lors du lancement officiel."
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Mode normal - Page pricing standard avec paiement actif
  return <B2CPricing />;
}

interface PricingCardProps {
  name: string;
  price: string;
  description: string;
  features: string[];
  disabled?: boolean;
  badge?: string;
  popular?: boolean;
}

function PricingCard({
  name,
  price,
  description,
  features,
  disabled = false,
  badge,
  popular = false,
}: PricingCardProps) {
  return (
    <Card className={popular ? 'border-2 border-primary' : ''}>
      <CardHeader>
        {badge && (
          <Badge className="w-fit mb-2" variant={disabled ? 'secondary' : 'default'}>
            {badge}
          </Badge>
        )}
        <CardTitle>{name}</CardTitle>
        <CardDescription>{description}</CardDescription>
        <div className="mt-4">
          <span className="text-4xl font-bold">{price}</span>
          <span className="text-muted-foreground">/analyse</span>
        </div>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {features.map((feature, i) => (
            <li key={i} className="flex items-start gap-2">
              <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
              <span className="text-sm">{feature}</span>
            </li>
          ))}
        </ul>
      </CardContent>
      <CardFooter>
        <Button
          className="w-full"
          disabled={disabled}
          variant={popular ? 'default' : 'outline'}
        >
          {disabled ? 'Actuellement gratuit' : 'Acheter'}
        </Button>
      </CardFooter>
    </Card>
  );
}

interface FAQItemProps {
  question: string;
  answer: string;
}

function FAQItem({ question, answer }: FAQItemProps) {
  return (
    <div className="bg-muted p-4 rounded-lg">
      <h3 className="font-semibold mb-2">{question}</h3>
      <p className="text-sm text-muted-foreground">{answer}</p>
    </div>
  );
}
```

---

### Étape 7 : Vérification Crédits Avant Analyse

#### Fichier : `src/pages/Analyze.tsx`

```typescript
// src/pages/Analyze.tsx
import { useAuth } from '@/context/AuthContext';
import { config } from '@/config/env';
import { useNavigate } from 'react-router-dom';

export function Analyze() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const handleAnalyze = async (file: File) => {
    // En mode gratuit, pas de vérification de crédit
    if (config.isFreeMode) {
      // Lancer l'analyse directement
      await startAnalysis(file);
      return;
    }

    // Mode normal - Vérifier les crédits
    if (!profile || profile.credits <= 0) {
      toast.error('Vous n\'avez plus de crédit');
      navigate('/pricing');
      return;
    }

    // Lancer l'analyse
    await startAnalysis(file);
  };

  // ... reste du composant
}
```

---

### Étape 8 : Ne PAS décrémenter les crédits en mode gratuit

#### Fichier : `src/services/analyses/analysisService.ts` (ou équivalent)

```typescript
// src/services/analyses/analysisService.ts
import { supabase } from '@/lib/supabase';
import { config } from '@/config/env';

export const analysisService = {
  async createAnalysis(userId: string, fileUrl: string) {
    // Créer l'analyse
    const { data: analysis, error } = await supabase
      .from('analyses')
      .insert({
        user_id: userId,
        file_url: fileUrl,
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw error;

    // Décrémenter le crédit UNIQUEMENT en mode payant
    if (!config.isFreeMode) {
      await supabase.rpc('decrement_user_credits', {
        user_id: userId,
      });
    }

    return analysis;
  },

  // ... reste du service
};
```

#### Migration SQL : Fonction pour décrémenter (si pas déjà créée)

```sql
-- supabase/migrations/YYYYMMDD_decrement_credits.sql

-- Fonction pour décrémenter les crédits d'un utilisateur
CREATE OR REPLACE FUNCTION decrement_user_credits(user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.profiles
  SET credits = GREATEST(credits - 1, 0)
  WHERE id = user_id;
END;
$$;
```

---

## 🧪 TESTS

### Test 1 : Inscription avec Mode Gratuit

```bash
# 1. S'assurer que FREE_MODE=true dans .env
cat .env | grep FREE_MODE

# 2. Démarrer l'app
npm run dev

# 3. Créer un compte
# Aller sur /register
# S'inscrire avec un email

# 4. Vérifier dans Supabase
# Aller sur Supabase Dashboard → Table Editor → profiles
# Vérifier que le nouvel utilisateur a 999999 crédits
```

### Test 2 : Dashboard Affiche Badge Testeur

```bash
# 1. Se connecter
# 2. Aller sur /dashboard
# 3. Vérifier :
#    - Badge "🎉 Testeur" visible
#    - Crédits affichés comme "∞ Illimitées"
#    - Message "TORP est gratuit pendant la phase de test"
```

### Test 3 : Analyse Sans Décrémenter Crédits

```bash
# 1. Upload un devis
# 2. Lancer l'analyse
# 3. Attendre le résultat
# 4. Retour dashboard
# 5. Vérifier que les crédits sont toujours 999999 (pas décrémentés)
```

### Test 4 : Page Pricing Montre Tarifs Futurs

```bash
# 1. Aller sur /pricing
# 2. Vérifier :
#    - Alerte verte "Phase de Test Gratuite"
#    - Cartes pricing affichées mais boutons désactivés
#    - Badge "Actuellement gratuit" sur chaque carte
#    - FAQ expliquant la phase de test
```

---

## 🚀 ACTIVATION DU PAIEMENT (Plus Tard)

Quand vous serez prêts à monétiser (dans 2-3 mois) :

### Étape 1 : Changer la Configuration

```bash
# .env.production
VITE_FREE_MODE=false
VITE_DEFAULT_CREDITS=0
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_xxx  # Clé live Stripe
```

### Étape 2 : Déployer

```bash
git add .env.production
git commit -m "feat: Activate payment mode"
git push

# Déployer sur Vercel
# Les variables d'environnement seront automatiquement prises en compte
```

### Étape 3 : Migration Utilisateurs Existants (Optionnel)

Vous pouvez décider de donner des crédits gratuits aux testeurs :

```sql
-- Donner 3 crédits gratuits à tous les testeurs existants
UPDATE public.profiles
SET credits = 3
WHERE created_at < '2025-03-01'  -- Date de fin de phase test
  AND credits = 999999;  -- Testeurs avec crédits illimités
```

### Étape 4 : Communication

Envoyer un email aux testeurs :

```markdown
Subject: 🎉 Merci d'avoir testé TORP !

Bonjour,

La phase de test gratuite de TORP se termine. Merci d'avoir participé !

En remerciement, nous vous offrons **3 crédits gratuits** pour continuer à utiliser TORP.

À partir de maintenant, les analyses seront payantes :
- Analyse unitaire : 9,99€
- Pack 3 : 24,99€ (économie 17%)
- Pack 5 : 39,99€ (économie 20%)

**Offre spéciale testeurs** : -20% avec le code TESTEUR20 (valable 1 mois)

Merci pour votre confiance !

L'équipe TORP
```

---

## 📊 MONITORING MODE GRATUIT

### Métriques à Suivre

```sql
-- Nombre total d'utilisateurs testeurs
SELECT COUNT(*)
FROM public.profiles
WHERE credits = 999999;

-- Nombre d'analyses effectuées en mode gratuit
SELECT COUNT(*)
FROM public.analyses
WHERE created_at > '2025-01-01'  -- Date début phase test
  AND created_at < NOW();

-- Utilisateurs les plus actifs (pour offres spéciales)
SELECT
  p.email,
  p.name,
  COUNT(a.id) as analyses_count
FROM public.profiles p
JOIN public.analyses a ON a.user_id = p.id
WHERE p.credits = 999999
GROUP BY p.id, p.email, p.name
ORDER BY analyses_count DESC
LIMIT 50;
```

### Dashboard Interne (Optionnel)

Créer une page admin `/admin/stats` pour suivre :
- Nombre de testeurs inscrits
- Nombre d'analyses effectuées
- Taux d'utilisation
- Feedback collecté

---

## ✅ CHECKLIST FINALE

### Configuration
- [ ] `VITE_FREE_MODE=true` ajouté dans `.env`
- [ ] `VITE_DEFAULT_CREDITS=999999` ajouté
- [ ] `config.ts` mis à jour avec `freeMode`

### Code
- [ ] `authService` donne crédits illimités aux nouveaux users
- [ ] `CreditBalance` affiche badge testeur
- [ ] `Pricing` page adaptée (tarifs futurs)
- [ ] `Analyze` ne vérifie pas les crédits en mode gratuit
- [ ] `analysisService` ne décrémente pas les crédits

### Tests
- [ ] Inscription → Crédits illimités ✓
- [ ] Dashboard → Badge testeur visible ✓
- [ ] Analyse → Pas de décrémentation ✓
- [ ] Pricing → Tarifs futurs affichés ✓

### Documentation
- [ ] README mis à jour (mode gratuit expliqué)
- [ ] Guide activation paiement rédigé
- [ ] Email testeurs préparé

---

## 🎉 RÉSULTAT

Avec cette configuration :

✅ **Testeurs** : Expérience fluide, 0 friction, analyses illimitées
✅ **Code** : Stripe prêt, activation en 1 variable
✅ **Marketing** : Pricing visible, modèle économique clair
✅ **Flexibilité** : Basculer en mode payant en 5 minutes

**Temps d'implémentation** : 2-3 heures
**Maintenance** : Aucune
**Migration future** : Transparente

---

**Configuration créée avec ❤️ pour maximiser l'adoption**

**Status** : ✅ Ready to Implement
**Difficulté** : ⭐⭐ Facile
**Impact** : ⭐⭐⭐⭐⭐ Critique

🚀 **Mode gratuit = Plus de testeurs = Meilleur feedback = Meilleur produit !**
