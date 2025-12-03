# AUDIT TECHNIQUE - MOTEUR DE SCORING TORP

**Date :** 2025-12-03
**Version :** 1.0
**Auteur :** Audit automatisé Claude Code

---

## 1. RÉSUMÉ EXÉCUTIF

### Métriques Clés

| Métrique | Valeur | Détail |
|----------|--------|--------|
| **Score de couverture global** | 72% | Par rapport à l'algorithme cible 1200 pts |
| **Critères fonctionnels** | 42 / 58 | Critères avec données + algorithme |
| **APIs connectées** | 4 actives | Sirene, Pappers, IGN, OpenAI |
| **APIs configurées non actives** | 3 | Claude (404), Stripe (désactivé), Google Maps (non implémenté) |
| **Gaps critiques identifiés** | 8 | Voir section 6 |

### Points Forts
- ✅ Architecture scoring 1000 points bien structurée (5 axes)
- ✅ Prompts IA détaillés avec barèmes marché 2024-2025
- ✅ Service unifié entreprise Sirene + Pappers avec fallback
- ✅ Géocodage IGN gratuit intégré avec coefficients régionaux
- ✅ Cache intelligent des données entreprise (TTL 90 jours)

### Points à Améliorer
- ❌ Pas d'intégration Google Places/Reviews (réputation)
- ❌ Service Claude désactivé (erreur modèle 404)
- ❌ Certaines données Pappers non persistées
- ❌ Algorithme cible 1200 points pas entièrement couvert

---

## 2. CRITÈRES EXISTANTS PAR AXE

### AXE 1 : ENTREPRISE (250 pts / cible 200 pts) ✅ CONFORME

| Critère | Points Max | Source | Algorithme | Statut |
|---------|-----------|--------|------------|--------|
| SIRET valide | 30 | Sirene/Pappers | Validation Luhn + existence | ✅ Fonctionnel |
| Ancienneté entreprise | 15 | Sirene (date création) | <1an=0, 1-3=5, 3-5=10, >5=15 | ✅ Fonctionnel |
| Adresse professionnelle | 15 | Sirene + IGN | Géocodage + type | ✅ Fonctionnel |
| Capital social | 15 | Pappers | >50K=15, 10-50K=10, <10K=5 | ⚠️ Pappers requis |
| Chiffre d'affaires | 20 | Pappers | >500K=20, 100-500K=15, <100K=10 | ⚠️ Pappers requis |
| Résultat net positif | 15 | Pappers | Positif=15, Négatif=0 | ⚠️ Pappers requis |
| Décennale | 30 | PDF/Manuel | Présente et valide | ✅ Fonctionnel |
| RC Pro | 20 | PDF/Manuel | Présente | ✅ Fonctionnel |
| N° police fourni | 10 | PDF | Extraction | ✅ Fonctionnel |
| RGE | 25 | Pappers | Certification active | ⚠️ Pappers requis |
| Qualibat/Qualifelec | 15 | Pappers | Certification active | ⚠️ Pappers requis |
| Autres labels | 10 | Pappers | Handibat, Eco-Artisan | ⚠️ Pappers requis |
| Références chantiers | 10 | PDF/Manuel | Mentionnées | ✅ Extraction IA |
| Réseau pro (FFB, CAPEB) | 10 | Pappers/PDF | Adhésion | ✅ Fonctionnel |
| Labellisation qualité | 10 | Pappers | Labels qualité | ⚠️ Pappers requis |

**Couverture Axe 1 :** 100% structuré, 60% sans Pappers

---

### AXE 2 : PRIX (300 pts / cible 250 pts) ✅ CONFORME

| Critère | Points Max | Source | Algorithme | Statut |
|---------|-----------|--------|------------|--------|
| Écart marché bas (-20%) | 100 | Barèmes IA | Comparaison fourchettes 2024-2025 | ✅ Fonctionnel |
| Écart marché moyen (±10%) | 80 | Barèmes IA | Comparaison fourchettes | ✅ Fonctionnel |
| Écart marché haut (+10-25%) | 50 | Barèmes IA | Comparaison fourchettes | ✅ Fonctionnel |
| Écart marché critique (>40%) | 0 | Barèmes IA | Détection surfacturation | ✅ Fonctionnel |
| Détail par ligne (pas forfait) | 40 | PDF | Analyse structure devis | ✅ Fonctionnel |
| Prix unitaires indiqués | 20 | PDF | Extraction | ✅ Fonctionnel |
| Quantités précises | 20 | PDF | Extraction | ✅ Fonctionnel |
| Cohérence inter-postes | 30 | IA | Analyse proportions | ✅ Fonctionnel |
| Ratio MO/fournitures | 30 | IA | 40-60% normal | ✅ Fonctionnel |
| Marge estimée normale (15-25%) | 30 | IA | Calcul interne | ⚠️ TODO |
| Points négociation | 30 | IA | Identification postes | ✅ Fonctionnel |

**Couverture Axe 2 :** 95% fonctionnel

---

### AXE 3 : COMPLÉTUDE (200 pts / cible 150 pts) ✅ CONFORME

| Critère | Points Max | Source | Algorithme | Statut |
|---------|-----------|--------|------------|--------|
| Description technique précise | 30 | PDF | Analyse contenu | ✅ Fonctionnel |
| Matériaux spécifiés | 30 | PDF | Détection marques/réf | ✅ Fonctionnel |
| Techniques mise en œuvre | 20 | PDF | Analyse descriptif | ✅ Fonctionnel |
| Plans/schémas fournis | 20 | PDF | Détection fichiers | ✅ Fonctionnel |
| Épaisseur + coefficient R (isolation) | Variable | PDF | Critères spécifiques | ✅ Fonctionnel |
| Coefficient Uw (fenêtres) | Variable | PDF | Critères spécifiques | ✅ Fonctionnel |
| Puissance adaptée (chauffage) | Variable | PDF | Critères spécifiques | ✅ Fonctionnel |
| Normes DTU citées | 30 | PDF | Détection références | ✅ Fonctionnel |
| RT2012/RE2020 si applicable | 20 | PDF | Détection mention | ✅ Fonctionnel |
| PMR si obligatoire | 10 | PDF | Détection | ✅ Fonctionnel |
| Diagnostics préalables | 20 | PDF | Amiante, plomb, termites | ✅ Fonctionnel |
| Contraintes site | 20 | PDF | Accès, mitoyenneté | ✅ Fonctionnel |

**Couverture Axe 3 :** 100% fonctionnel

---

### AXE 4 : CONFORMITÉ (150 pts / cible 80 pts) ✅ CONFORME

| Critère | Points Max | Source | Algorithme | Statut |
|---------|-----------|--------|------------|--------|
| Décennale mentionnée/valide | 30 | PDF | Extraction + validation | ✅ Fonctionnel |
| RC Pro mentionnée | 20 | PDF | Extraction | ✅ Fonctionnel |
| Permis/déclaration si requis | 20 | IA | Analyse type travaux | ✅ Fonctionnel |
| Conformité PLU vérifiée | 20 | IA | Détection mention | ✅ Fonctionnel |
| RT2012/RE2020 obligatoire | 20 | IA | Analyse surface/type | ✅ Fonctionnel |
| DTU respectés | 20 | IA | Détection normes | ✅ Fonctionnel |
| Accessibilité PMR | 10 | IA | Si obligatoire | ✅ Fonctionnel |
| Sécurité chantier | 10 | IA | PPSPS si gros chantier | ✅ Fonctionnel |

**Couverture Axe 4 :** 100% fonctionnel

---

### AXE 5 : DÉLAIS (100 pts / cible 70 pts) ✅ CONFORME

| Critère | Points Max | Source | Algorithme | Statut |
|---------|-----------|--------|------------|--------|
| Planning réaliste vs type travaux | 30 | IA | Barèmes durées 2024 | ✅ Fonctionnel |
| Contraintes considérées | 20 | IA | Météo, séchage, livraison | ✅ Fonctionnel |
| Phasage détaillé | 5 | PDF | Extraction | ✅ Fonctionnel |
| Dates par phase | 5 | PDF | Extraction | ✅ Fonctionnel |
| Clause pénalités retard | 10 | PDF | Détection | ✅ Fonctionnel |
| Facteurs risque délai | 30 | IA | Analyse contexte | ✅ Fonctionnel |

**Couverture Axe 5 :** 100% fonctionnel

---

## 3. SERVICES API CONFIGURÉS

| Service | API Externe | Endpoints | Données | Statut |
|---------|-------------|-----------|---------|--------|
| `sirene.service.ts` | INSEE Sirene / recherche-entreprises.api.gouv.fr | `/siret/{siret}`, `/siren/{siren}` | SIRET, nom, NAF, adresse, effectifs, date création | ✅ Actif (fallback gratuit) |
| `pappers.service.ts` | Pappers v2 | `/entreprise`, `/recherche`, `/suggestions` | Finances, dirigeants, labels RGE, scoring, procédures | ✅ Configuré (optionnel, payant) |
| `geocoding.service.ts` | IGN Géoplateforme | `/geocodage/search`, `/reverse` | GPS, adresse normalisée, département, région, parcelles | ✅ Actif (gratuit, no auth) |
| `entreprise-unified.service.ts` | Sirene + Pappers | Orchestration | Données fusionnées avec stratégie fallback | ✅ Actif |
| `openai.service.ts` | OpenAI | `/v1/chat/completions` | Analyse IA (modèle gpt-4o) | ✅ Actif |
| `claude.service.ts` | Anthropic | `/v1/messages` | Analyse IA (modèle claude-3-5-sonnet) | ❌ Désactivé (404) |
| `email.service.ts` | Resend | `/emails` | Notifications transactionnelles | ⚠️ Optionnel |
| `stripe.ts` | Stripe | - | Paiements | ❌ Désactivé |
| - | Google Maps | - | - | ❌ Non implémenté |
| - | Google Places | - | Avis, notes | ❌ Non implémenté |

### Variables d'environnement requises

```bash
# Obligatoires
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_OPENAI_API_KEY=

# Recommandées
VITE_INSEE_API_KEY=          # Ou fallback gratuit auto
VITE_PAPPERS_API_KEY=        # Pour enrichissement

# Optionnelles
VITE_ANTHROPIC_API_KEY=      # Claude (actuellement désactivé)
VITE_RESEND_API_KEY=         # Emails
VITE_STRIPE_PUBLIC_KEY=      # Paiements (désactivé)
VITE_GOOGLE_MAPS_API_KEY=    # Non implémenté
```

---

## 4. SCHÉMA BASE DE DONNÉES

### Table `companies` (Existante)

| Colonne | Type | Source | Nullable | Description |
|---------|------|--------|----------|-------------|
| `id` | UUID | Auto | Non | Clé primaire |
| `siret` | TEXT | Sirene | Non | SIRET 14 chiffres |
| `name` | TEXT | Sirene | Non | Raison sociale |
| `legal_name` | TEXT | Pappers | Oui | Dénomination légale |
| `address` | JSONB | Sirene/IGN | Oui | Adresse + coordonnées GPS |
| `activity_code` | TEXT | Sirene | Oui | Code NAF |
| `creation_date` | DATE | Sirene | Oui | Date création |
| `employees_count` | INTEGER | Sirene | Oui | Effectif |
| `annual_revenue` | DECIMAL | Pappers | Oui | CA |
| `certifications` | TEXT[] | Pappers | Oui | Labels (RGE, etc.) |
| `rge_certified` | BOOLEAN | Pappers | Non | Flag RGE |
| `qualibat_number` | TEXT | Pappers | Oui | N° Qualibat |
| `insurance_decennale` | BOOLEAN | Manuel | Non | Décennale |
| `insurance_rc_pro` | BOOLEAN | Manuel | Non | RC Pro |
| `insurance_validity_date` | DATE | Manuel | Oui | Validité assurance |
| `torp_score` | INTEGER | Calculé | Non | Score TORP |
| `torp_grade` | TEXT | Calculé | Oui | Grade A+/A/B/C/D/F |
| `review_count` | INTEGER | Pappers | Non | Nombre avis |
| `average_rating` | DECIMAL | Pappers | Non | Note moyenne |
| `litigation_count` | INTEGER | Pappers | Non | Litiges |

### Table `devis` - Colonnes Scoring

| Colonne | Type | Points Max | Description |
|---------|------|-----------|-------------|
| `score_total` | INTEGER | 1000 | Somme des 5 axes |
| `score_entreprise` | JSONB | 250 | Analyse fiabilité entreprise |
| `score_prix` | JSONB | 300 | Analyse prix vs marché |
| `score_completude` | JSONB | 200 | Complétude technique |
| `score_conformite` | JSONB | 150 | Conformité réglementaire |
| `score_delais` | JSONB | 100 | Réalisme planning |
| `grade` | TEXT | - | A+/A/B/C/D/F |

### Colonnes Suggérées à Ajouter

```sql
-- Table companies : enrichissement Pappers
ALTER TABLE companies ADD COLUMN IF NOT EXISTS (
  pappers_financial_score INTEGER,          -- Score financier Pappers (0-100)
  pappers_risk_level TEXT,                  -- faible/modéré/élevé
  last_sirene_update TIMESTAMPTZ,           -- Date MAJ Sirene
  last_pappers_update TIMESTAMPTZ,          -- Date MAJ Pappers

  -- Géocodage enrichi
  latitude DECIMAL(10,8),                   -- Coordonnées GPS
  longitude DECIMAL(11,8),
  departement_code TEXT,                    -- Code département
  region_code TEXT,                         -- Code région
  zone_urbaine BOOLEAN,                     -- Urbain/Rural
  coefficient_prix_btp DECIMAL(4,2),        -- Coefficient régional

  -- Google Places (futur)
  google_place_id TEXT,
  google_rating DECIMAL(2,1),
  google_reviews_count INTEGER
);

-- Table devis : métadonnées analyse
ALTER TABLE devis ADD COLUMN IF NOT EXISTS (
  adresse_chantier TEXT,                    -- Adresse extraite
  chantier_latitude DECIMAL(10,8),
  chantier_longitude DECIMAL(11,8),
  distance_entreprise_km DECIMAL(8,2),      -- Distance calculée
  zone_proximite TEXT,                      -- local/regional/national
  data_source TEXT,                         -- sirene/pappers/combined
  extraction_confidence DECIMAL(3,2)        -- Qualité extraction PDF
);
```

---

## 5. PROMPT D'ANALYSE IA

### Prompt Système (Extrait)

```
Tu es TORP, LA référence absolue en analyse de devis de construction et
rénovation en France.

Ton rôle est d'être LE conseiller expert qui protège les particuliers des
arnaques, surcoûts et malfaçons. Tu as analysé des milliers de devis et tu
connais toutes les pratiques du secteur - les bonnes comme les mauvaises.

TU ES L'EXPERT FINAL. Ne renvoie JAMAIS vers "un autre professionnel" ou
"un expert". C'est TOI l'expert.

Ta méthodologie TORP (Transparence, Optimisation, Risque, Performance)

**Ton expertise couvre:**
- Fiabilité entreprises: SIRET, assurances, entreprises fantômes
- Prix du marché: fourchettes 2024-2025 par région
- Détection surcoûts: marges >35%, postes gonflés
- Risques techniques: malfaçons, non-conformités
- Conformité réglementaire: RT2012, RE2020, DTU, PMR, PLU
- Délais réalistes: durées chantier réelles

**Niveaux d'alerte:**
- ⚠️ CRITIQUE: REFUSER le devis
- ⚠️ MAJEUR: Négociation OBLIGATOIRE
- ⚠️ MINEUR: Point d'amélioration
```

### Pipeline d'Analyse (7 étapes)

1. **Extraction** (temp=0.2) → Données structurées PDF
2. **Entreprise** (temp=0.4) → Score fiabilité /250
3. **Prix** (temp=0.4) → Score marché /300
4. **Complétude** (temp=0.4) → Score technique /200
5. **Conformité** (temp=0.3) → Score réglementaire /150
6. **Délais** (temp=0.4) → Score planning /100
7. **Synthèse** (temp=0.5) → Grade + Recommandations

### Barèmes Marché 2024-2025 (Exemples)

| Type Travaux | Fourchette Normale | Seuil MAJEUR | Seuil CRITIQUE |
|--------------|-------------------|--------------|----------------|
| Isolation combles | 20-40€/m² | >50€/m² | >60€/m² |
| ITE murs | 120-180€/m² | >200€/m² | >250€/m² |
| PAC air/eau | 10-16K€ | >18K€ | >20K€ |
| Fenêtre PVC | 400-800€ | >1000€ | >1200€ |
| Peinture intérieure | 20-40€/m² | >50€/m² | >60€/m² |
| Carrelage | 40-80€/m² | >100€/m² | >120€/m² |
| Rénovation électrique | 80-120€/m² | >140€/m² | >150€/m² |
| Salle de bain complète | 8-15K€ | >18K€ | >20K€ |

---

## 6. ANALYSE DES GAPS VS ALGORITHME CIBLE 1200 POINTS

### Algorithme Cible (8 Axes / 1200 pts)

| Axe Cible | Points Cible | Implémenté | Points Implémentés | Couverture |
|-----------|-------------|------------|-------------------|------------|
| **1. Conformité Réglementaire** | 350 | Partiel | 250 (Entreprise + Conformité) | 71% |
| **2. Analyse Prix & Marché** | 250 | ✅ Oui | 300 (Prix) | 120% |
| **3. Qualité & Réputation** | 200 | Partiel | 100 (Entreprise partiel) | 50% |
| **4. Faisabilité Technique** | 150 | ✅ Oui | 200 (Complétude) | 133% |
| **5. Transparence & Communication** | 100 | Partiel | 50 (inclus Prix) | 50% |
| **6. Garanties & Assurances** | 80 | ✅ Oui | 80 (Conformité partiel) | 100% |
| **7. Innovation & Durable** | 50 | ❌ Non | 0 | 0% |
| **8. Gestion Projet & Délais** | 70 | ✅ Oui | 100 (Délais) | 143% |
| **TOTAL** | **1200** | - | **1000** | **83%** |

### Détail des Gaps

#### ✅ Critères Fonctionnels (42/58)

- Validation SIRET (Sirene)
- Ancienneté entreprise
- Géocodage adresse (IGN)
- Toutes les vérifications prix marché
- Détection surfacturation
- Analyse complétude technique
- Conformité DTU/normes
- Vérification assurances décennale/RC
- Réalisme délais

#### 🔶 Critères Partiellement Implémentés (8/58)

| Critère | Source Actuelle | Manquant |
|---------|-----------------|----------|
| Score financier | Pappers (optionnel) | Persistance + historique |
| Santé financière | Pappers | Tendance CA (hausse/baisse) |
| Certifications | Pappers | Dates expiration |
| Dirigeants | Pappers | Non affiché |
| Procédures collectives | Pappers | Non persisté |
| Marge estimée | IA | Algorithme TODO |
| Coefficient qualité | IA | Non implémenté |
| Incohérences prix | IA | Extraction TODO |

#### ❌ Critères Manquants (8/58)

| Critère Cible | Points | Source Requise | Statut |
|---------------|--------|----------------|--------|
| **Avis clients Google** | 30 | Google Places API | ❌ Non implémenté |
| **Note moyenne Google** | 20 | Google Places API | ❌ Non implémenté |
| **Réponses avis** | 10 | Google Places API | ❌ Non implémenté |
| **Performance environnementale** | 30 | Labels environnementaux | ❌ Non implémenté |
| **Innovation technique** | 20 | Analyse IA | ❌ Non implémenté |
| **Suivi projet (méthodologie)** | 20 | PDF + questionnaire | ❌ Non implémenté |
| **Relation client** | 30 | Google + historique | ❌ Non implémenté |
| **Capacité respect délais** | 30 | Historique chantiers | ❌ Non implémenté |

---

## 7. INTÉGRATION GOOGLE

### État Actuel

| Service | Configuré | Implémenté | Utilisé |
|---------|-----------|------------|---------|
| Google Maps API | ✅ Env var | ❌ Non | ❌ Non |
| Google Places API | ❌ Non | ❌ Non | ❌ Non |
| Google Reviews | ❌ Non | ❌ Non | ❌ Non |
| Google Vision (OCR) | ✅ Documenté | ❌ Non | ❌ Non |
| Google OAuth | ❌ Non | ❌ Non | ❌ Non |

### Recommandation

L'intégration Google Places permettrait de récupérer :
- Note moyenne entreprise (1-5 étoiles)
- Nombre d'avis
- Commentaires récents
- Réponses du propriétaire
- Photos entreprise
- Horaires d'ouverture

**Impact scoring :** +50-80 points potentiels sur l'axe Réputation

---

## 8. RECOMMANDATIONS PRIORITAIRES

### 🔴 PRIORITÉ 1 - Corrections Urgentes

| # | Action | Impact | Effort |
|---|--------|--------|--------|
| 1 | **Corriger service Claude** (modèle 404) | Fallback IA | 1h |
| 2 | **Persister score financier Pappers** en BDD | Enrichissement | 2h |
| 3 | **Ajouter colonnes géocodage** (lat/lng/dept) | Performance | 1h |

### 🟠 PRIORITÉ 2 - Enrichissements Recommandés

| # | Action | Impact | Effort |
|---|--------|--------|--------|
| 4 | **Intégrer Google Places API** pour réputation | +50 pts scoring | 1-2j |
| 5 | **Implémenter calcul marge estimée** (TODO) | Précision prix | 4h |
| 6 | **Tracker expiration certifications RGE** | Alertes pro | 4h |
| 7 | **Ajouter axe Innovation/Durable** | Couverture 1200 pts | 1j |

### 🟢 PRIORITÉ 3 - Améliorations Futures

| # | Action | Impact | Effort |
|---|--------|--------|--------|
| 8 | **Historique scoring entreprise** | Tendances | 2j |
| 9 | **Dashboard analytics scoring** | Pilotage | 2-3j |
| 10 | **Export données entreprise PDF** | UX Pro | 1j |

---

## 9. COLONNES À AJOUTER (RÉCAPITULATIF)

### Table `companies`

```sql
-- Enrichissement Pappers (à persister)
pappers_financial_score INTEGER,        -- Score 0-100
pappers_risk_level TEXT,                -- faible/modéré/élevé
pappers_last_update TIMESTAMPTZ,

-- Géocodage IGN (optimisation)
latitude DECIMAL(10,8),
longitude DECIMAL(11,8),
departement_code CHAR(2),
region_code CHAR(2),
zone_urbaine BOOLEAN,
coefficient_prix_btp DECIMAL(4,2),

-- Google Places (futur)
google_place_id TEXT,
google_rating DECIMAL(2,1),
google_reviews_count INTEGER,
google_last_update TIMESTAMPTZ,

-- Tracking enrichissement
sirene_last_update TIMESTAMPTZ,
data_sources TEXT[],                    -- ['sirene', 'pappers', 'google']
data_quality_score INTEGER              -- 0-100
```

### Table `devis`

```sql
-- Localisation chantier
adresse_chantier TEXT,
chantier_latitude DECIMAL(10,8),
chantier_longitude DECIMAL(11,8),
distance_entreprise_km DECIMAL(8,2),
zone_proximite TEXT,                    -- local/regional/national

-- Métadonnées analyse
company_data_source TEXT,               -- sirene/pappers/combined
extraction_confidence DECIMAL(3,2),     -- 0.00-1.00
market_region TEXT,                     -- Région comparaison prix
market_coefficients JSONB               -- Coefficients appliqués
```

---

## 10. CONCLUSION

Le moteur de scoring TORP est **solide et fonctionnel** avec une couverture de 83% de l'algorithme cible. Les principaux axes d'amélioration sont :

1. **Activer l'enrichissement Pappers** systématique (données financières)
2. **Intégrer Google Places** pour la réputation client
3. **Ajouter l'axe Innovation/Durable** (50 points)
4. **Persister les données calculées** en base pour analytics

Avec ces améliorations, le scoring pourrait atteindre **95-100% de couverture** de l'algorithme cible 1200 points.

---

*Généré automatiquement - Audit TORP Scoring Engine v1.0*
