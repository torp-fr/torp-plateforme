# 📊 Guide: Système de Métriques & Feedback TORP

> **Documentation du système de tracking et collecte feedback**
> Date: 26 Novembre 2025

---

## 📋 TABLE DES MATIÈRES

1. [Vue d'ensemble](#vue-densemble)
2. [Installation & Configuration](#installation--configuration)
3. [Utilisation](#utilisation)
4. [Dashboard Admin](#dashboard-admin)
5. [Métriques trackées](#métriques-trackées)
6. [API Reference](#api-reference)

---

## 🎯 Vue d'ensemble

Ce système permet de:
- ✅ **Tracker** toutes les actions utilisateurs (signup, analyses, uploads, etc.)
- ✅ **Collecter** les feedbacks des testeurs avec système de satisfaction
- ✅ **Analyser** les scores TORP moyens par segment (B2C/B2B)
- ✅ **Visualiser** les métriques dans un dashboard admin

---

## 🔧 Installation & Configuration

### Étape 1: Appliquer la migration Supabase

```bash
# Se connecter à votre projet Supabase
supabase link --project-ref your-project-ref

# Appliquer la migration
supabase db push supabase/migrations/002_analytics_feedback.sql
```

Ou manuellement via Supabase Dashboard:
1. Aller dans **SQL Editor**
2. Coller le contenu de `supabase/migrations/002_analytics_feedback.sql`
3. Exécuter

### Étape 2: Vérifier les tables créées

Tables créées:
- `analytics_events` - Tous les événements utilisateurs
- `user_feedback` - Feedbacks et suggestions
- `devis_analysis_metrics` - Métriques détaillées des analyses

Vues créées:
- `analytics_overview` - Stats globales
- `torp_score_averages` - Moyennes des scores TORP
- `feedback_summary` - Résumé des feedbacks

### Étape 3: Ajouter le FeedbackWidget à votre app

```typescript
// Dans App.tsx ou layout principal
import { FeedbackWidget } from '@/components/feedback/FeedbackWidget';

function App() {
  const userType = getUserType(); // 'B2C' ou 'B2B'

  return (
    <div>
      {/* Votre app */}

      {/* Widget feedback (flottant en bas à droite) */}
      <FeedbackWidget userType={userType} />
    </div>
  );
}
```

---

## 📊 Utilisation

### Tracker un événement

```typescript
import { analyticsService } from '@/services/analytics/analyticsService';

// Exemple: Tracker un signup
await analyticsService.trackSignup('B2C');

// Exemple: Tracker un upload de devis
await analyticsService.trackDevisUploadStarted(
  'B2B',
  1024000, // 1MB
  'application/pdf'
);

// Exemple: Tracker événement custom
await analyticsService.trackEvent({
  event_type: 'page_view',
  event_category: 'navigation',
  user_type: 'B2C',
  metadata: { page: '/pricing' }
});
```

### Tracker une analyse de devis complète

```typescript
import { analyticsService } from '@/services/analytics/analyticsService';

// Après avoir analysé un devis
await analyticsService.trackDevisAnalysis({
  user_type: 'B2B',
  devis_id: 'uuid-123',
  torp_score_overall: 8.5,
  torp_score_transparency: 9.0,
  torp_score_offer: 8.2,
  torp_score_robustness: 8.7,
  torp_score_price: 8.1,
  grade: 'B+',
  analysis_duration_ms: 3500,
  file_size_bytes: 1024000,
  file_type: 'application/pdf',
  upload_success: true
});
```

### Collecter un feedback

```typescript
import { feedbackService } from '@/services/feedback/feedbackService';

// Soumettre un feedback complet
await feedbackService.submitFeedback({
  feedback_type: 'bug',
  category: 'ui',
  satisfaction_score: 4,
  title: 'Problème d\'affichage',
  message: 'Le score TORP ne s\'affiche pas correctement sur mobile',
  page_url: window.location.href
}, 'B2C');

// OU utiliser les helpers
await feedbackService.submitBugReport(
  'Erreur lors de l\'upload',
  'Le fichier PDF ne se charge pas',
  'B2B'
);

await feedbackService.submitFeatureRequest(
  'Export Excel',
  'Ajouter export des analyses en Excel',
  'B2C'
);
```

---

## 📈 Dashboard Admin

### Accès

Route: `/admin/analytics`

Composant: `src/pages/AdminAnalytics.tsx`

### Fonctionnalités

**Vue d'ensemble:**
- Nombre total d'inscriptions (B2C + B2B)
- Nombre total d'analyses effectuées
- Nombre de feedbacks reçus
- Satisfaction moyenne (/5)
- Score TORP moyen global

**Onglet Scores:**
- Scores moyens par segment (B2C / B2B)
- Détail TORP (Transparence, Offre, Robustesse, Prix)
- Temps moyen d'analyse
- Nombre d'analyses par segment

**Onglet Feedbacks:**
- Résumé par type (bug, feature_request, etc.)
- Statut (new, in_progress, resolved)
- Satisfaction moyenne par type
- Nombre de feedbacks par catégorie

---

## 📊 Métriques Trackées

### Événements Automatiques

| Événement | Quand | Metadata |
|-----------|-------|----------|
| `signup` | Inscription utilisateur | user_type |
| `login` | Connexion | user_type |
| `devis_upload_started` | Début upload devis | file_size, file_type |
| `devis_upload_success` | Upload réussi | - |
| `devis_upload_error` | Erreur upload | error_message |
| `devis_analyzed` | Analyse terminée | score, grade |
| `score_viewed` | Consultation score | devis_id |
| `feedback_submitted` | Feedback envoyé | feedback_type, satisfaction |
| `page_view` | Visite de page | page |

### Métriques de Performance

- **Temps d'analyse moyen** (ms)
- **Taille moyenne des fichiers** (bytes)
- **Taux de succès upload** (%)
- **Score TORP moyen** par segment

### Métriques Business

- **Taux de conversion** signup → première analyse
- **Engagement** nombre moyen d'analyses par utilisateur
- **Satisfaction** score moyen /5
- **Rétention** utilisateurs actifs sur 7/30 jours

---

## 🔌 API Reference

### AnalyticsService

```typescript
interface AnalyticsService {
  // Tracker un événement
  trackEvent(event: AnalyticsEvent): Promise<{success: boolean; error?: string}>;

  // Tracker une analyse de devis
  trackDevisAnalysis(metrics: DevisAnalysisMetrics): Promise<{success: boolean; error?: string}>;

  // Récupérer stats globales
  getOverview(): Promise<AnalyticsOverview | null>;

  // Récupérer moyennes scores TORP
  getScoreAverages(): Promise<TorpScoreAverages[]>;

  // Récupérer stats utilisateur
  getUserStats(userId: string): Promise<any>;

  // Helpers rapides
  trackSignup(userType: UserType): Promise<{success: boolean}>;
  trackLogin(userType: UserType): Promise<{success: boolean}>;
  trackDevisUploadStarted(userType, fileSize, fileType): Promise<{success: boolean}>;
  trackDevisUploadSuccess(userType: UserType): Promise<{success: boolean}>;
  trackDevisUploadError(userType, error): Promise<{success: boolean}>;
  trackPageView(page, userType?): Promise<{success: boolean}>;
}
```

### FeedbackService

```typescript
interface FeedbackService {
  // Soumettre un feedback
  submitFeedback(
    feedback: FeedbackSubmission,
    userType: UserType
  ): Promise<{success: boolean; error?: string; feedbackId?: string}>;

  // Récupérer feedbacks utilisateur
  getUserFeedbacks(): Promise<Feedback[]>;

  // Récupérer résumé feedbacks (admin)
  getFeedbackSummary(): Promise<FeedbackSummary[]>;

  // Mettre à jour un feedback
  updateFeedback(
    feedbackId: string,
    updates: Partial<FeedbackSubmission>
  ): Promise<{success: boolean; error?: string}>;

  // Helpers rapides
  submitQuickFeedback(message, userType, satisfactionScore?): Promise<{success: boolean}>;
  submitBugReport(title, message, userType): Promise<{success: boolean}>;
  submitFeatureRequest(title, message, userType): Promise<{success: boolean}>;
}
```

---

## 🎯 Bonnes Pratiques

### 1. Tracker les actions clés

```typescript
// ✅ BON: Tracker après action réussie
const result = await uploadDevis(file);
if (result.success) {
  await analyticsService.trackDevisUploadSuccess(userType);
  await analyticsService.trackDevisAnalysis(metrics);
}

// ❌ MAUVAIS: Tracker avant action
await analyticsService.trackDevisUploadSuccess(userType); // Trop tôt!
const result = await uploadDevis(file);
```

### 2. Inclure le contexte dans metadata

```typescript
// ✅ BON: Contexte riche
await analyticsService.trackEvent({
  event_type: 'recommendation_viewed',
  event_category: 'devis',
  user_type: 'B2B',
  metadata: {
    devis_id: 'uuid-123',
    recommendation_type: 'transparency',
    improvement_potential: 0.5 // +0.5 pts possible
  }
});

// ❌ MAUVAIS: Pas de contexte
await analyticsService.trackEvent({
  event_type: 'recommendation_viewed',
  event_category: 'devis'
});
```

### 3. Gérer les erreurs silencieusement

```typescript
// ✅ BON: Ne pas bloquer l'UX si tracking échoue
try {
  await analyticsService.trackEvent(event);
} catch (error) {
  console.error('Analytics error (non-blocking):', error);
  // Continue l'exécution
}

// ❌ MAUVAIS: Bloquer si tracking échoue
await analyticsService.trackEvent(event); // Crash si erreur!
```

---

## 🔒 Sécurité & Confidentialité

- **Row Level Security (RLS)** activé sur toutes les tables
- Les utilisateurs **ne voient que leurs propres données**
- Les métadonnées sont stockées en **JSONB flexible**
- **Pas de données sensibles** dans les events (emails, mots de passe, etc.)
- IP addresses **anonymisées** (optionnel via config)

---

## 📞 Support

Pour toute question:
- Consulter `supabase/migrations/002_analytics_feedback.sql` pour le schéma
- Vérifier les types dans `src/services/analytics/analyticsService.ts`
- Tester avec le FeedbackWidget sur `/admin/analytics`

---

**Document maintenu par:** Équipe TORP
**Dernière mise à jour:** 26 Novembre 2025
**Version:** 1.0
