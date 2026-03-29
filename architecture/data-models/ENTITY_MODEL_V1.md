# TORP Entity Data Model — Phase 3+
**Version:** 1.0
**Date:** 2026-03-27
**Status:** Design (not yet implemented)

---

## Entities Overview

```
Entreprise (1) ──────────── (N) Clients
     │                            │
     │                            │ (1:N)
     │                            ↓
     │                       Projets (N)
     │                            │
     │                            │ (1:N)
     │                            ↓
     └──────────────────── Devis (N)
                                  │
                                  │ (1:1)
                                  ↓
                              Audit (1)
                                  │
                                  │ (1:1)
                                  ↓
                            QRCode (1)
```

---

## 1. ENTREPRISE

```typescript
interface Entreprise {
  id: string;                          // UUID
  siret: string;                       // SIRET 14 chiffres (unique key)
  raison_sociale: string;

  // Auto-fetched on registration (Pappers + data.gouv)
  donnees_rcs: {
    code_naf: string;                  // Ex: "43.21A" (électricité)
    libelle_naf: string;               // Ex: "Travaux d'installation électrique"
    effectifs: number;                 // Nombre salariés
    chiffre_affaires: number;          // CA en €
    capital_social: number;
    forme_juridique: string;           // SARL, SAS, EI, etc.
    date_creation: Date;
    adresse_siege: string;
    dirigeant: string;
  };

  donnees_certifications: {
    rge: boolean;                      // Reconnu Garant Environnement
    qualiopi: boolean;                 // Formation professionnelle
    qualibat: boolean;                 // Qualification bâtiment
    qualifelec: boolean;               // Qualification électricité
    labels: string[];                  // Labels spécifiques obtenus
    certifications_raw: any;           // Données brutes de data.gouv
    last_fetched_at: Date;
  };

  donnees_reputation: {
    google: {
      note: number;                    // 1.0 – 5.0
      count: number;
      last_fetched_at: Date;
    } | null;
    trustpilot: {
      note: number;
      count: number;
      last_fetched_at: Date;
    } | null;
  };

  // Manual fields (saisie par l'entreprise)
  profil: {
    contact_principal: string;
    email: string;
    telephone: string;
    adresse: string;
    ville: string;
    cp: string;
    website?: string;
    logo_url?: string;
  };

  // Metadata
  created_at: Date;
  updated_at: Date;
  status: 'active' | 'suspended' | 'archived';
  plan: 'free' | 'starter' | 'pro' | 'enterprise';
}
```

---

## 2. CLIENT

```typescript
interface Client {
  id: string;
  entreprise_id: string;               // FK → Entreprise

  // Saisie minimale sur chantier (obligatoire)
  nom: string;
  prenom: string;
  email?: string;
  telephone: string;

  // Auto-lookup via adresse (lazy-loaded)
  localisation?: {
    adresse_saisie: string;            // Texte libre saisi
    adresse_normalisee?: string;       // BANO normalisée
    code_postal: string;
    ville: string;
    lat: number;
    lng: number;
    parcelle_cadastrale?: string;      // Via IGN Géoportail
    fetched_at: Date;
  };

  // Contexte local (lazy-loaded par type de projet)
  contexte_local?: {
    plu_info?: LazyLoadedData<PLUInfo>;         // Plan Local d'Urbanisme
    abf_protection?: LazyLoadedData<boolean>;   // Zone ABF ?
    secteur_protege?: LazyLoadedData<boolean>;  // Zone protégée ?
    aides_etat?: LazyLoadedData<string[]>;      // MaPrimeRénov, CEE, etc.
    fetched_for_project_types: string[];        // Types de projets ayant déclenché les lookups
  };

  created_at: Date;
  updated_at: Date;
}

interface LazyLoadedData<T> {
  status: 'pending' | 'loaded' | 'failed' | 'skipped';
  data?: T;
  error?: string;
  fetched_at?: Date;
  source_api?: string;                 // 'geoportail', 'legifrance', etc.
}

interface PLUInfo {
  zone: string;                        // Ex: "UA", "UC", "N"
  piscine_autorisee: boolean;
  extension_autorisee: boolean;
  hauteur_max?: number;
  coefficient_emprise?: number;
  raw_data?: any;
}
```

---

## 3. PROJET

```typescript
interface Projet {
  id: string;
  client_id: string;                   // FK → Client
  entreprise_id: string;               // FK (dénormalisé pour RLS)

  // Définition du projet
  type: ProjectType;                   // 'piscine' | 'renovation' | 'extension' | ...
  description: string;
  tags: string[];                      // Ex: ['thermique', 'structure']

  // Localisation (déclenche les lookups contextuels)
  localisation: {
    adresse: string;
    code_postal: string;
    ville: string;
    lat: number;
    lng: number;
    parcelle_cadastrale?: string;

    // Contexte réglementaire (lazy-loaded selon project.type)
    contexte: {
      plu?: LazyLoadedData<PLUInfo>;
      abf_protection?: LazyLoadedData<boolean>;
      permis_requis?: LazyLoadedData<PermisInfo>;
      aides_eligibles?: LazyLoadedData<AideInfo[]>;
      contraintes?: LazyLoadedData<string[]>;
    };
  };

  // Périmètre (manuel)
  budget_estime?: number;
  delai_prevu?: string;                // Ex: "6-8 semaines"
  date_debut_prevue?: Date;

  // Domaines réglementaires déduits (Phase 2 logic)
  implied_domains: string[];           // Ex: ['structure', 'hydraulique', 'électrique']
  context_deduction_confidence: 'high' | 'medium' | 'low';

  // Metadata
  created_at: Date;
  updated_at: Date;
  status: 'draft' | 'active' | 'completed' | 'archived';
}

type ProjectType =
  | 'piscine'
  | 'renovation'
  | 'extension'
  | 'construction_neuve'
  | 'maison_neuve'
  | 'toiture'
  | 'electricite_seule'
  | 'plomberie_seule'
  | 'isolation'
  | 'chauffage'
  | 'fenetre'
  | 'cuisine'
  | 'salle_de_bain'
  | 'autre';

interface PermisInfo {
  type: 'permis_construire' | 'declaration_travaux' | 'aucun';
  obligatoire: boolean;
  seuil_surface?: number;
  delai_instruction?: string;
}

interface AideInfo {
  nom: string;                         // Ex: "MaPrimeRénov'"
  eligible: boolean;
  montant_max?: number;
  conditions?: string;
  url?: string;
}
```

---

## 4. DEVIS

```typescript
interface Devis {
  id: string;
  projet_id: string;                   // FK → Projet
  entreprise_id: string;               // FK (dénormalisé pour RLS)

  // Upload
  version: number;                     // 1, 2, 3... (incrémenté)
  upload_format: 'pdf' | 'image' | 'csv' | 'excel' | 'web_form' | 'docx';
  upload_file_url?: string;            // Supabase Storage URL
  upload_timestamp: Date;

  // Parsing
  parsing_result: {
    status: 'pending' | 'parsing' | 'parsed' | 'failed';
    items: DevisItem[];
    montant_ht: number;
    montant_ttc: number;
    tva_taux: number;                  // %
    devise: 'EUR';
    parsing_confidence: number;        // 0.0 – 1.0
    parsing_method: 'pdf_text' | 'ocr' | 'csv' | 'web_form' | 'manual';
    parsing_errors?: string[];
    parsed_at?: Date;
  };

  // Audit (généré après parsing)
  audit_id?: string;                   // FK → Audit (created after parse)

  // Metadata
  created_at: Date;
  is_final: boolean;                   // Version verrouillée ?
  notes?: string;                      // Notes internes
}

interface DevisItem {
  id: string;
  line_number: number;
  description: string;
  quantity: number;
  unit: string;                        // 'm²', 'ml', 'u', 'forfait'
  unit_price: number;
  total_ht: number;
  category: string;                    // 'electricite' | 'plomberie' | 'structure' | ...
  domain?: string;                     // DB domain (électrique, hydraulique, ...)
  is_taxable: boolean;
  tva_taux: number;
  confidence?: number;                 // 0-1 (OCR reliability per item)
}
```

---

## 5. AUDIT

```typescript
interface Audit {
  id: string;
  devis_id: string;                    // FK → Devis
  projet_id: string;                   // FK (dénormalisé)
  entreprise_id: string;               // FK (dénormalisé)

  // Execution
  audit_timestamp: Date;
  audit_engine_version: string;        // Ex: '2.1.0'
  processing_time_ms: number;

  // Phase 2: Coverage Analysis
  coverage: {
    total_rules: number;
    explicit_coverage: number;
    implicit_coverage: number;
    gaps: number;
    coverage_pct: number;              // 0–100
    explicit_pct: number;
    top_gaps: CoverageGap[];
    strengths: string[];
    risk_domains: string[];
  };

  // Phase 3: Multi-Dimensional Scoring (TBD)
  scoring: {
    dimensions: ScoringDimension[];
    final_score: number;               // 0–100 (weighted average)
    grade: 'A' | 'B' | 'C' | 'D' | 'E';
    potential_score?: number;          // If all recs applied
    potential_grade?: 'A' | 'B' | 'C' | 'D' | 'E';
  };

  // Recommendations
  recommendations: AuditRecommendation[];

  // Public summary (for QR/client access)
  public_summary: {
    title: string;
    score: number;
    grade: 'A' | 'B' | 'C' | 'D' | 'E';
    risk_label: string;
    compliance_verdict: 'conforme' | 'attention' | 'non_conforme' | 'critique';
    highlights: string[];              // 3–5 points forts
    key_findings: string[];            // 2–4 constats
  };

  // Version delta (si devis.version > 1)
  version_delta?: {
    previous_audit_id: string;
    previous_score: number;
    score_delta: number;               // +/- points
    improvements_made: string[];
    remaining_gaps: string[];
  };
}

interface ScoringDimension {
  key: string;                         // 'conformite', 'exhaustivite', etc.
  name: string;
  score: number;                       // 0–100
  weight: number;                      // 0–1
  reasoning: string;
  sub_scores?: Record<string, number>;
}

interface AuditRecommendation {
  id: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  domain: string;
  action: string;
  rationale: string;
  regulatory_reference?: string;       // Ex: 'NF C 15-100'
  effort: 'quick' | 'medium' | 'complex';
  gap_count: number;
  estimated_score_gain?: number;       // Points gained if fixed
}

interface CoverageGap {
  rule_id: string;
  rule_domain: string;
  rule_description: string;
  severity: 'high' | 'medium' | 'low';
  reason: 'not_mentioned' | 'domain_only' | 'underspecified';
  suggestion: string;
}
```

---

## 6. QRCODE & ACCESS

```typescript
interface QRCode {
  id: string;
  audit_id: string;                    // FK → Audit

  qr_image_url: string;               // Supabase Storage URL (PNG)
  short_code: string;                  // 8 chars alphanumeric (ex: "AB3XK7M2")
  access_url: string;                  // https://torp.fr/audit/AB3XK7M2

  created_at: Date;
  expires_at?: Date;                   // Null = no expiry

  access_stats: {
    scans: number;
    unique_views: number;
    last_accessed_at?: Date;
  };

  // Access control
  is_active: boolean;
  created_by: string;                  // User ID
}
```

---

## Relationships Summary

```
Entreprise
  ├─ has_many: Clients
  ├─ has_many: Projets (through Clients)
  └─ has_many: Devis (through Projets)

Client
  ├─ belongs_to: Entreprise
  └─ has_many: Projets

Projet
  ├─ belongs_to: Client
  ├─ belongs_to: Entreprise
  └─ has_many: Devis

Devis
  ├─ belongs_to: Projet
  ├─ belongs_to: Entreprise
  └─ has_one: Audit

Audit
  ├─ belongs_to: Devis
  ├─ has_one: QRCode
  └─ has_many: AuditRecommendations
```

---

## Supabase Tables (Draft)

```sql
-- Core tables
CREATE TABLE entreprises (id uuid PRIMARY KEY, siret text UNIQUE, ...);
CREATE TABLE clients (id uuid PRIMARY KEY, entreprise_id uuid REFERENCES entreprises(id), ...);
CREATE TABLE projets (id uuid PRIMARY KEY, client_id uuid REFERENCES clients(id), entreprise_id uuid, ...);
CREATE TABLE devis (id uuid PRIMARY KEY, projet_id uuid REFERENCES projets(id), version int, ...);
CREATE TABLE audits (id uuid PRIMARY KEY, devis_id uuid REFERENCES devis(id), ...);
CREATE TABLE qrcodes (id uuid PRIMARY KEY, audit_id uuid REFERENCES audits(id), short_code text UNIQUE, ...);

-- RLS: All tables scoped by entreprise_id
CREATE POLICY "org_isolation" ON clients USING (entreprise_id = current_user_entreprise_id());
```

---

## Lazy-Load Strategy Summary

| Field | When Loaded | API Source | Blocking? |
|-------|------------|-----------|---------|
| `entreprise.donnees_rcs` | On SIRET registration | Pappers | Yes (sync) |
| `entreprise.donnees_certifications` | On SIRET registration | data.gouv | Yes (sync) |
| `entreprise.donnees_reputation` | Background after registration | Trustpilot/Google | No (async) |
| `client.localisation` | On address validation | BANO + IGN | Soft (optional) |
| `projet.localisation.contexte.plu` | On project type selection | Géoportail | No (async) |
| `projet.localisation.contexte.abf` | On project type selection | Légifrance | No (async) |
| `projet.implied_domains` | Immediately on type selection | contextDeduction (local) | Yes (instant) |
| `devis.parsing_result` | On file upload | PDF/OCR pipeline | Yes (sync) |
| `audit.*` | After parsing completes | Internal engines | Yes (async) |
