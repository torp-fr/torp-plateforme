# 🏗️ Architecture Module B2B - TORP Pro

> **Module d'Auto-Analyse de Devis pour Professionnels BTP**
> Version: 1.0 - Architecture & Modèle de Données

---

## 📋 Table des Matières

1. [Vue d'ensemble](#vue-densemble)
2. [Architecture de la base de données](#architecture-de-la-base-de-données)
3. [Structure des dossiers](#structure-des-dossiers)
4. [Routes et pages](#routes-et-pages)
5. [Services API](#services-api)
6. [Types TypeScript](#types-typescript)
7. [Prochaines étapes](#prochaines-étapes)

---

## 🎯 Vue d'ensemble

Le module B2B permet aux professionnels BTP de :
1. Créer un profil entreprise (vérification SIRET)
2. Uploader leurs documents officiels (Kbis, assurances, certifications)
3. Soumettre leurs devis pour auto-analyse
4. Recevoir un score TORP + recommandations d'amélioration
5. Générer un "Ticket TORP" (badge de certification avec QR code)
6. Suivre les consultations de leurs tickets (tracking)

---

## 📊 Architecture de la Base de Données

### Migration Supabase

**Fichier:** `supabase/migrations/007_b2b_pro_module.sql`

### Tables créées

#### 1. `pro_company_profiles`
Profils entreprises liés aux utilisateurs B2B.

```sql
CREATE TABLE public.pro_company_profiles (
  id UUID PRIMARY KEY,
  user_id UUID UNIQUE REFERENCES public.users(id),
  siret TEXT UNIQUE NOT NULL,
  siren TEXT NOT NULL,
  raison_sociale TEXT NOT NULL,
  forme_juridique TEXT,
  code_naf TEXT,
  adresse TEXT,
  code_postal TEXT,
  ville TEXT,
  telephone TEXT,
  email TEXT NOT NULL,
  site_web TEXT,
  date_creation DATE,
  capital_social DECIMAL(15,2),
  effectif TEXT,
  dirigeant_nom TEXT,
  siret_verifie BOOLEAN DEFAULT FALSE,
  siret_verifie_le TIMESTAMP WITH TIME ZONE,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Clés étrangères:**
- `user_id` → `users.id` (CASCADE)

**Index:**
- `user_id`, `siret`, `siren`, `created_at`

---

#### 2. `company_documents`
Documents officiels de l'entreprise.

```sql
CREATE TABLE public.company_documents (
  id UUID PRIMARY KEY,
  company_id UUID REFERENCES pro_company_profiles(id),
  type company_doc_type NOT NULL,
  nom TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  date_emission DATE,
  date_expiration DATE,
  numero_document TEXT,
  emetteur TEXT,
  statut doc_status DEFAULT 'PENDING',
  date_verification TIMESTAMP WITH TIME ZONE,
  verification_notes TEXT,
  metadata JSONB,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Clés étrangères:**
- `company_id` → `pro_company_profiles.id` (CASCADE)

**Index:**
- `company_id`, `type`, `statut`, `date_expiration`

**Types de documents supportés:**
- KBIS
- ATTESTATION_URSSAF
- ATTESTATION_VIGILANCE
- ASSURANCE_DECENNALE
- ASSURANCE_RC_PRO
- CERTIFICATION_QUALIBAT / RGE / QUALIFELEC / QUALIPAC
- LABEL_AUTRE
- AUTRE

**Statuts possibles:**
- PENDING (En attente)
- VALID (Valide)
- EXPIRING (Expire bientôt < 30 jours)
- EXPIRED (Expiré)
- INVALID (Non valide)

---

#### 3. `pro_devis_analyses`
Analyses de devis soumis par les professionnels.

```sql
CREATE TABLE public.pro_devis_analyses (
  id UUID PRIMARY KEY,
  company_id UUID REFERENCES pro_company_profiles(id),
  user_id UUID REFERENCES users(id),
  reference_devis TEXT NOT NULL,
  nom_projet TEXT,
  montant_ht DECIMAL(15,2),
  montant_ttc DECIMAL(15,2),
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  status analysis_status DEFAULT 'PENDING',
  score_total INTEGER, -- 0-1000
  grade TEXT, -- A+, A, A-, B+, B, B-, C+, C, C-, D, F
  score_details JSONB, -- {"transparence": 250, "offre": 230, ...}
  recommandations JSONB, -- Array de recommandations
  points_bloquants JSONB, -- Array de points bloquants
  extracted_data JSONB,
  version INTEGER DEFAULT 1,
  parent_analysis_id UUID REFERENCES pro_devis_analyses(id),
  ticket_genere BOOLEAN DEFAULT FALSE,
  ticket_url TEXT,
  ticket_code TEXT UNIQUE, -- Ex: TORP-ABC123XY
  ticket_generated_at TIMESTAMP WITH TIME ZONE,
  ticket_view_count INTEGER DEFAULT 0,
  ticket_last_viewed_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  analyzed_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Clés étrangères:**
- `company_id` → `pro_company_profiles.id` (CASCADE)
- `user_id` → `users.id` (CASCADE)
- `parent_analysis_id` → `pro_devis_analyses.id` (pour versioning)

**Index:**
- `company_id`, `user_id`, `status`, `score_total`, `grade`, `ticket_code`, `created_at`

**Statuts d'analyse:**
- PENDING (En attente)
- PROCESSING (En cours)
- COMPLETED (Terminée)
- FAILED (Échec)

**Format des scores (JSONB):**
```json
{
  "transparence": 230,
  "offre": 220,
  "robustesse": 240,
  "prix": 210
}
```

**Format des recommandations (JSONB):**
```json
[
  {
    "type": "transparence",
    "message": "Ajoutez les détails des matériaux utilisés",
    "impact": "+30pts",
    "priority": "high",
    "difficulty": "easy",
    "example": "Ex: Parquet chêne massif 14mm - Réf. XYZ123"
  }
]
```

---

#### 4. `ticket_tracking_events`
Événements de tracking des tickets TORP.

```sql
CREATE TABLE public.ticket_tracking_events (
  id UUID PRIMARY KEY,
  analysis_id UUID REFERENCES pro_devis_analyses(id),
  event_type TEXT NOT NULL, -- 'qr_scanned', 'link_viewed', 'pdf_downloaded'
  ip_address INET,
  user_agent TEXT,
  referer TEXT,
  country TEXT,
  city TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Clés étrangères:**
- `analysis_id` → `pro_devis_analyses.id` (CASCADE)

**Index:**
- `analysis_id`, `event_type`, `created_at`

---

### Fonctions SQL utilitaires

#### `generate_ticket_code()`
Génère un code unique pour les tickets TORP.
```sql
SELECT generate_ticket_code(); -- Retourne: 'TORP-ABC123XY'
```

#### `increment_ticket_view_count(UUID)`
Incrémente le compteur de vues d'un ticket.
```sql
SELECT increment_ticket_view_count('uuid-analysis-id');
```

#### `calculate_grade_from_score(INTEGER)`
Calcule le grade à partir du score (0-1000).
```sql
SELECT calculate_grade_from_score(870); -- Retourne: 'A-'
```

---

### Row Level Security (RLS)

Toutes les tables ont des politiques RLS activées :

**pro_company_profiles:**
- Users can view/create/update/delete their own company profile

**company_documents:**
- Users can view/create/update/delete documents of their own company

**pro_devis_analyses:**
- Users can view/create/update/delete their own analyses
- **Public can view analyses via ticket_code** (pour QR codes)

**ticket_tracking_events:**
- Users can view tracking events for their analyses
- Anyone can create tracking events (pour tracking public)

---

## 📁 Structure des Dossiers

```
src/
├── pages/
│   ├── pro/
│   │   ├── ProDashboard.tsx                    # Dashboard principal B2B
│   │   ├── onboarding/
│   │   │   └── ProOnboarding.tsx               # Wizard création profil entreprise
│   │   ├── documents/
│   │   │   └── ProDocuments.tsx                # Gestion documents
│   │   ├── analyses/
│   │   │   ├── ProAnalysesList.tsx             # Liste des analyses
│   │   │   ├── NewProAnalysis.tsx              # Nouvelle analyse
│   │   │   ├── ProAnalysisDetail.tsx           # Détail d'une analyse
│   │   │   └── TicketGeneration.tsx            # Génération ticket TORP
│   │   └── settings/
│   │       └── ProSettings.tsx                 # Paramètres entreprise
│   └── TicketPublicView.tsx                    # Page publique ticket (QR code)
│
├── components/
│   └── pro/
│       └── (à créer - composants UI du module B2B)
│
├── services/
│   └── api/
│       └── pro/
│           ├── companyService.ts               # CRUD profils entreprise
│           ├── documentService.ts              # Gestion documents
│           └── analysisService.ts              # CRUD analyses + tracking
│
└── types/
    └── pro.ts                                  # Types TypeScript centralisés
```

---

## 🛣️ Routes et Pages

### Routes Authentifiées (B2B)

| Route | Page | Description |
|-------|------|-------------|
| `/pro/dashboard` | `ProDashboard.tsx` | Dashboard principal professionnel |
| `/pro/onboarding` | `ProOnboarding.tsx` | Wizard création profil entreprise |
| `/pro/documents` | `ProDocuments.tsx` | Gestion documents (Kbis, assurances) |
| `/pro/analyses` | `ProAnalysesList.tsx` | Liste des analyses de devis |
| `/pro/analyses/new` | `NewProAnalysis.tsx` | Nouvelle analyse de devis |
| `/pro/analyses/:id` | `ProAnalysisDetail.tsx` | Détail d'une analyse |
| `/pro/analyses/:id/ticket` | `TicketGeneration.tsx` | Génération ticket TORP |
| `/pro/settings` | `ProSettings.tsx` | Paramètres entreprise |

### Routes Publiques

| Route | Page | Description |
|-------|------|-------------|
| `/t/:code` | `TicketPublicView.tsx` | Consultation publique ticket (via QR code) |

**Exemple:** `https://torp.app/t/TORP-ABC123XY`

---

## 🔌 Services API

### `companyService.ts`

**Fonctions:**
- `getCompanyProfile()` - Récupérer le profil entreprise de l'utilisateur
- `createCompanyProfile(data)` - Créer un profil entreprise
- `updateCompanyProfile(id, data)` - Mettre à jour le profil
- `deleteCompanyProfile(id)` - Supprimer le profil
- `verifySiret(siret)` - Vérifier un SIRET via API externe

**Usage:**
```typescript
import { getCompanyProfile, createCompanyProfile } from '@/services/api/pro/companyService';

const profile = await getCompanyProfile();
const newProfile = await createCompanyProfile({
  siret: '12345678901234',
  siren: '123456789',
  raison_sociale: 'Ma Société',
  email: 'contact@masociete.fr',
  // ...
});
```

---

### `documentService.ts`

**Fonctions:**
- `listCompanyDocuments(companyId)` - Lister les documents
- `getCompanyDocument(documentId)` - Récupérer un document
- `uploadCompanyDocument(data)` - Upload d'un document
- `updateCompanyDocument(documentId, data)` - Mettre à jour un document
- `deleteCompanyDocument(documentId)` - Supprimer un document
- `checkExpiringDocuments(companyId)` - Vérifier les documents expirant bientôt

**Usage:**
```typescript
import { uploadCompanyDocument, listCompanyDocuments } from '@/services/api/pro/documentService';

const document = await uploadCompanyDocument({
  company_id: 'uuid',
  type: 'KBIS',
  nom: 'Kbis 2024',
  file: fileObject,
  date_emission: '2024-01-15',
  date_expiration: '2024-12-31',
});

const documents = await listCompanyDocuments('company-uuid');
```

---

### `analysisService.ts`

**Fonctions:**
- `listAnalyses(companyId, filters?)` - Lister les analyses
- `getAnalysis(analysisId)` - Récupérer une analyse
- `createAnalysis(data)` - Créer une nouvelle analyse
- `reanalyzeDevis(parentAnalysisId, file?)` - Re-analyser (nouvelle version)
- `updateAnalysis(analysisId, data)` - Mettre à jour une analyse
- `deleteAnalysis(analysisId)` - Supprimer une analyse
- `generateTicket(analysisId)` - Générer un ticket TORP
- `getTicketTracking(analysisId)` - Récupérer les événements de tracking
- `getAnalysisByTicketCode(ticketCode)` - Récupérer via ticket_code (public)
- `trackTicketView(ticketCode, eventType, metadata?)` - Enregistrer un événement

**Usage:**
```typescript
import { createAnalysis, generateTicket } from '@/services/api/pro/analysisService';

// Créer une analyse
const analysis = await createAnalysis({
  company_id: 'uuid',
  reference_devis: 'DEV-2024-001',
  nom_projet: 'Rénovation maison',
  montant_ht: 25000,
  montant_ttc: 30000,
  file: devisFileObject,
});

// Générer un ticket TORP
const ticket = await generateTicket(analysis.id);
// Retourne: { ticket_url, ticket_code, qr_code_url, public_url }
```

---

## 📘 Types TypeScript

**Fichier:** `src/types/pro.ts`

### Interfaces principales

#### `CompanyProfile`
Profil entreprise complet.

#### `CompanyDocument`
Document de l'entreprise avec statut et métadonnées.

#### `ProDevisAnalysis`
Analyse complète d'un devis avec scores, recommandations et ticket.

#### `ScoreDetails`
Détail des scores par axe TORP (transparence, offre, robustesse, prix).

#### `Recommendation`
Recommandation d'amélioration avec impact et priorité.

#### `PointBloquant`
Point bloquant identifié avec sévérité.

#### `TicketTrackingEvent`
Événement de tracking d'un ticket (QR scan, vue, téléchargement).

### Enums

- `CompanyDocType` - Types de documents
- `DocStatus` - Statuts de documents
- `AnalysisStatus` - Statuts d'analyse
- `TicketEventType` - Types d'événements de tracking
- `RecommendationPriority` - Priorités de recommandations
- `PointBloquantSeverity` - Sévérités de points bloquants

### Constantes utiles

- `GRADE_INFO` - Mapping des grades avec couleurs et descriptions
- `DOCUMENT_TYPE_LABELS` - Labels lisibles des types de documents
- `DOCUMENT_STATUS_LABELS` - Labels des statuts de documents
- `ANALYSIS_STATUS_LABELS` - Labels des statuts d'analyse

**Usage:**
```typescript
import { GRADE_INFO, type ProDevisAnalysis } from '@/types/pro';

const analysis: ProDevisAnalysis = { /* ... */ };
const gradeInfo = GRADE_INFO[analysis.grade!];
console.log(gradeInfo.label); // "Très bon"
console.log(gradeInfo.color); // "green"
```

---

## 🚀 Prochaines Étapes

### Phase 1 : Implémentation Backend (API)

- [ ] Implémenter les services Supabase dans `companyService.ts`
- [ ] Implémenter les services Supabase dans `documentService.ts`
- [ ] Implémenter les services Supabase dans `analysisService.ts`
- [ ] Configurer Supabase Storage pour upload de fichiers
- [ ] Intégrer l'API de vérification SIRET (Pappers ou Data Gouv)
- [ ] Développer le service d'analyse IA (scoring TORP)
- [ ] Développer le générateur de tickets TORP (PDF + QR code)

### Phase 2 : Implémentation Frontend (UI)

- [ ] Créer les composants UI réutilisables dans `components/pro/`
- [ ] Implémenter le wizard d'onboarding (ProOnboarding)
- [ ] Implémenter le dashboard professionnel (ProDashboard)
- [ ] Implémenter la gestion des documents (ProDocuments)
- [ ] Implémenter la liste et détail des analyses
- [ ] Implémenter le formulaire de nouvelle analyse
- [ ] Implémenter la génération de tickets TORP
- [ ] Implémenter la page publique de consultation (TicketPublicView)

### Phase 3 : Routing et Navigation

- [ ] Ajouter les routes B2B dans le router principal
- [ ] Créer un layout spécifique pour les pages Pro
- [ ] Implémenter la navigation entre les pages B2B
- [ ] Ajouter les guards d'authentification (B2B only)
- [ ] Rediriger automatiquement selon le type d'utilisateur

### Phase 4 : Tests et Validation

- [ ] Tests unitaires des services API
- [ ] Tests d'intégration Supabase
- [ ] Tests des composants UI
- [ ] Tests E2E du parcours complet B2B
- [ ] Validation de la migration SQL

### Phase 5 : Documentation et Déploiement

- [ ] Documentation utilisateur pour les professionnels
- [ ] Guide d'utilisation du module B2B
- [ ] Tutoriel vidéo (optionnel)
- [ ] Déploiement de la migration Supabase
- [ ] Mise en production du module B2B

---

## 📞 Support Technique

Pour toute question sur l'architecture du module B2B :
- Consulter la documentation B2B : `/docs/B2B_ASSISTANT_SCOPE.md`
- Architecture générale : `/docs/ARCHITECTURE.md`
- Issues GitHub : https://github.com/torp-fr/quote-insight-tally/issues

---

**Document créé le:** 2025-12-01
**Version:** 1.0
**Auteur:** Équipe TORP
