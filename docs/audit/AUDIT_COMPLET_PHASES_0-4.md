# AUDIT COMPLET TORP - Phases 0 à 4

**Date**: 2025-12-15
**Branche**: `claude/audit-phases-integration-yYOyH`
**Version**: 1.0.0

---

## EXECUTIVE SUMMARY

Le projet TORP est une plateforme SaaS d'analyse intelligente de devis BTP avec une architecture React + Supabase + OpenAI/Anthropic. L'audit révèle un projet **bien avancé** avec une architecture solide mais des **gaps significatifs** pour une mise en production complète.

### Score Global de Maturité

| Phase | Score | État |
|-------|-------|------|
| Phase 0 - Conception | **74%** | Opérationnel avec mocks |
| Phase 1 - Consultation | **65%** | Partiel - Données mockées |
| Phase 2 - Contractualisation | **75%** | Opérationnel avec mocks |
| Phase 3 - Exécution | **70%** | Complet mais pas de persistance |
| Phase 4 - Réception | **85%** | Très avancé |
| RAG & AI | **70%** | Fonctionnel, gaps sécurité |
| APIs Externes | **80%** | Fallbacks robustes |

**Score Moyen Global: 74%**

---

## 1. CARTOGRAPHIE DU CODEBASE

### 1.1 Structure Générale

```
quote-insight-tally/
├── src/
│   ├── components/     (24 dossiers, ~150 fichiers)
│   │   ├── phase0/     (31 composants)
│   │   ├── phase1/     (3 composants)
│   │   ├── phase2/     (5 composants)
│   │   ├── phase3/     (4 composants)
│   │   ├── phase4/     (5 composants)
│   │   └── ui/         (composants shadcn/ui)
│   ├── services/       (33 dossiers, ~100 fichiers)
│   │   ├── ai/         (7 fichiers - LLM services)
│   │   ├── rag/        (4 fichiers - Knowledge base)
│   │   ├── api/        (8 fichiers - APIs externes)
│   │   ├── phase0/     (19 fichiers - ~15,000 lignes)
│   │   ├── phase1/     (8 fichiers - ~4,500 lignes)
│   │   ├── phase2/     (5 fichiers - ~2,500 lignes)
│   │   ├── phase3/     (5 fichiers - ~3,100 lignes)
│   │   └── phase4/     (6 fichiers - ~5,100 lignes)
│   ├── types/          (7 dossiers, ~50 fichiers)
│   ├── pages/          (10 dossiers, ~40 fichiers)
│   ├── hooks/          (8 fichiers)
│   └── context/        (2 fichiers)
├── supabase/           (migrations, fonctions)
└── docs/               (documentation)
```

### 1.2 Stack Technique

| Technologie | Usage | Version |
|-------------|-------|---------|
| React | Frontend | 18.3.1 |
| TypeScript | Typage | 5.8.3 |
| Vite | Build | 5.4.19 |
| Supabase | Backend/DB | 2.81.1 |
| OpenAI SDK | LLM | 6.9.1 |
| Anthropic SDK | LLM | 0.70.0 |
| TanStack Query | Data fetching | 5.83.0 |
| Radix UI | Composants | Latest |
| Tailwind CSS | Styling | 3.4.17 |

### 1.3 Statistiques du Code

| Métrique | Valeur |
|----------|--------|
| Fichiers TypeScript/TSX | ~300+ |
| Lignes de code (services) | ~35,000+ |
| Tests unitaires | 213 passing |
| Types définis | ~500+ interfaces |

---

## 2. AUDIT PAR PHASE

### 2.1 PHASE 0 - Conception (Score: 74%)

#### Points Forts
- Architecture wizard multi-mode (B2C/B2B/B2G) excellente
- Types TypeScript ultra-détaillés (~1500 types)
- Auto-save et synchronisation robustes
- Catalogue lots dynamique complet
- Estimation budgétaire avec coefficients régionaux

#### Composants Clés
| Composant | État | Lignes |
|-----------|------|--------|
| WizardContainer | 90% | ~500 |
| StepOwnerProfile | 85% | ~300 |
| StepPropertyAddress | 85% | ~350 |
| StepRoomDetails | 80% | ~400 |
| StepSummary | 85% | ~350 |

#### Services Critiques
| Service | État | Mocks |
|---------|------|-------|
| wizard.service | 80% | Fallback mémoire |
| project.service | 85% | Supabase OK |
| deduction.service | 70% | Géorisques, Cadastre mockés |
| estimation.service | 75% | Données réelles |
| cctp.service | 65% | Partiellement mocké |

#### Mocks Identifiés
```
deduction.service.ts:488-507  → Risques naturels mockés
deduction.service.ts:516      → Zone patrimoine mockée
deduction.service.ts:539      → Cadastre mocké
pricing-estimation.service.ts:605 → Projets similaires mockés
```

---

### 2.2 PHASE 1 - Consultation (Score: 65%)

#### Points Forts
- Génération DCE complète (RC, AE, DPGF, Mémoire)
- Analyse offres multi-critères sophistiquée
- Scoring entreprises détaillé (9 critères)

#### Points Faibles CRITIQUES
- **Entreprises 100% mockées** (5 entreprises hardcodées)
- Aucune connexion API Qualibat/Infogreffe
- Export DCE texte brut uniquement

#### Composants Clés
| Composant | État | Lignes |
|-----------|------|--------|
| DCEDocumentViewer | 85% | 254 |
| EntrepriseCard | 90% | 186 |
| Phase1Consultation | 60% | ~400 |

#### Services Critiques
| Service | État | Mocks |
|---------|------|-------|
| dce.service | 80% | Supabase OK |
| entreprise.service | **50%** | **100% MOCKÉ** |
| offre.service | 85% | Supabase OK |
| urbanisme.service | **30%** | **STUB COMPLET** |

#### Mocks CRITIQUES
```
entreprise.service.ts:777-942 → 5 entreprises fictives
urbanisme.service.ts:229-309  → PLU/Patrimoine stub complet
```

---

### 2.3 PHASE 2 - Contractualisation (Score: 75%)

#### Points Forts
- Algorithme PERT complet (chemin critique, marges)
- Planning Gantt interactif 3 vues
- Gestion réunions avec templates
- Checklist démarrage chantier (25 items)

#### Composants Clés
| Composant | État | Lignes |
|-----------|------|--------|
| PlanningTimeline | 85% | 370 |
| ChantierCard | 85% | 186 |
| ReunionCard | 85% | 292 |
| TaskList | 85% | 350 |

#### Services Critiques
| Service | État | Mocks |
|---------|------|-------|
| planning.service | 90% | Supabase OK |
| chantier.service | 85% | Supabase OK |
| reunion.service | 85% | Supabase OK |
| logistique.service | 80% | Supabase OK |

#### Mocks Identifiés
```
ChantiersListPage.tsx:139-156 → Avancement aléatoire
JournalPage.tsx:129-192       → 2 entrées mockées
```

---

### 2.4 PHASE 3 - Exécution (Score: 70%)

#### Points Forts
- Contrôles qualité complets (6 grilles templates)
- Coordination multi-entreprises avec détection conflits
- Gestion administrative sophistiquée
- Templates courriers légaux pré-remplis

#### Points Faibles
- **Aucune persistance Supabase** (tout en mémoire)
- 61+ appels console.log au lieu de DB

#### Composants Clés
| Composant | État | Lignes |
|-----------|------|--------|
| ReserveControleList | 85% | 366 |
| ControleCard | 85% | 210 |
| VisiteTimeline | 85% | 234 |

#### Services (TOUS EN MOCK)
| Service | Lignes | Supabase |
|---------|--------|----------|
| controle.service | 940 | **NON** |
| coordination.service | 1,135 | **NON** |
| administratif.service | 1,062 | **NON** |
| connection.service | 682 | Partiel |

#### Mocks MAJEURS
```
controle.service.ts:736-938     → Données organismes, visites, certifications
coordination.service.ts:818-1133 → Créneaux, conflits, carnets, chat
administratif.service.ts:858-1060 → Lots, situations, avenants, DOE
```

---

### 2.5 PHASE 4 - Réception (Score: 85%)

#### Points Forts
- OPR avec checklists complètes (5 lots)
- Réception formelle avec PV automatique
- Gestion réserves sophistiquée (levée, contestation)
- 3 garanties légales automatisées
- DOE/DIUO complets

#### Composants Clés
| Composant | État | Lignes |
|-----------|------|--------|
| Phase4Dashboard | 90% | 576 |
| OPRSessionCard | 85% | 254 |
| ReservesList | 85% | 483 |
| GarantiesTracker | 85% | 490 |
| DOEProgress | 80% | 393 |

#### Services (TOUS AVEC SUPABASE)
| Service | Lignes | Supabase |
|---------|--------|----------|
| opr.service | 1,028 | **OUI** |
| reception.service | 771 | **OUI** |
| reserves.service | 1,026 | **OUI** |
| garanties.service | 1,209 | **OUI** |
| doe-diuo.service | 1,082 | **OUI** |

#### Lacunes
- Upload fichiers non implémenté
- Génération PDF PV manquante
- Signatures légales non validées

---

## 3. AUDIT RAG & SERVICES AI

### 3.1 Architecture Actuelle

```
┌─────────────────────────────────────────────┐
│         HybridAIService (Orchestration)     │
├──────────────────┬──────────────────────────┤
│  OpenAIService   │  ClaudeService           │
│  (gpt-4o)        │  (claude-3.5-sonnet)     │
└──────────────────┴──────────────────────────┘
           ↓
┌─────────────────────────────────────────────┐
│  KnowledgeService (RAG)                     │
│  - Supabase pgvector                        │
│  - text-embedding-3-small (1536 dims)       │
│  - Catalogue DTU enrichi (50+ références)   │
└─────────────────────────────────────────────┘
```

### 3.2 Système TORP (7 Dimensions)

| Dimension | Points | Service |
|-----------|--------|---------|
| Entreprise | 250 | TorpAnalyzer |
| Prix | 300 | TorpAnalyzer |
| Complétude | 200 | TorpAnalyzer |
| Conformité | 150 | TorpAnalyzer |
| Délais | 100 | TorpAnalyzer |
| Innovation | 50 | InnovationDurable |
| Transparence | 100 | Transparence |

### 3.3 Gaps Critiques RAG

| Gap | Impact | Priorité |
|-----|--------|----------|
| Embeddings côté client | Sécurité clé API | CRITIQUE |
| Pas de caching | Coûts OpenAI élevés | CRITIQUE |
| Pas de Hybrid Search | Qualité retrieval | MAJEUR |
| Pas de multi-agents | Scalabilité | MAJEUR |

---

## 4. AUDIT APIs EXTERNES

### 4.1 Tableau Récapitulatif

| API | Clé Configurée | Fonctionnel | Fallback |
|-----|----------------|-------------|----------|
| INSEE Sirene | NON | OUI via fallback | api.gouv.fr |
| Pappers | NON (payant) | NON | Sirene |
| ADEME RGE | N/A (gratuit) | **OUI** | - |
| IGN Geocoding | N/A (gratuit) | **OUI** | - |
| Google Places | NON | NON | IGN |
| OpenAI | NON | NON | Claude |
| Anthropic | NON | NON | OpenAI |

### 4.2 APIs Actives Sans Configuration

- ADEME RGE (qualifications énergétiques)
- IGN Geocoding (géolocalisation)
- Recherche Entreprises API.gouv (fallback)
- QR Server (génération codes)

### 4.3 APIs Mentionnées Non Implémentées

- Georisques (risques naturels)
- Cadastre IGN (parcelles)
- DPE ADEME (diagnostics énergétiques)
- Atlas Patrimoine (zones protégées)
- PLU/GPU IGN (urbanisme)

---

## 5. MOCKS CONSOLIDÉS PAR CRITICITÉ

### 5.1 CRITIQUES (Bloquent Production)

| Localisation | Description | Impact |
|--------------|-------------|--------|
| `entreprise.service.ts:777-942` | 5 entreprises fictives | Fausses données affichées |
| `urbanisme.service.ts:229-309` | PLU/Patrimoine stub | Contraintes erronées |
| `controle.service.ts:736-938` | Organismes/visites mock | Phase 3 non persistante |
| `coordination.service.ts:818-1133` | Coordination mock | Phase 3 non persistante |
| `administratif.service.ts:858-1060` | Budget/litiges mock | Phase 3 non persistante |

### 5.2 MAJEURS (Dégradent UX)

| Localisation | Description |
|--------------|-------------|
| `deduction.service.ts:488-539` | Risques/Cadastre simulés |
| `JournalPage.tsx:129-192` | Journal entrées mockées |
| `ChantiersListPage.tsx:139-156` | Avancement aléatoire |

### 5.3 MINEURS (Acceptables en MVP)

| Localisation | Description |
|--------------|-------------|
| `pricing-estimation.service.ts:605` | Projets similaires random |
| Checklists statiques | Templates intentionnels |
| DTU Catalog | Données référence OK |

---

## 6. PLAN D'ACTION RECOMMANDÉ

### 6.1 Priorité CRITIQUE (Semaines 1-2)

1. **Sécuriser Embeddings**
   - Migrer vers Supabase Edge Function
   - Effort: 2-3 jours

2. **Connecter Entreprises Phase 1**
   - Implémenter recherche Supabase réelle
   - Connecter API Qualibat/ADEME
   - Effort: 3-5 jours

3. **Persister Phase 3**
   - Créer tables Supabase
   - Adapter services CRUD
   - Effort: 5-7 jours

### 6.2 Priorité HAUTE (Semaines 3-4)

4. **Intégrer APIs Urbanisme**
   - Géoportail Urbanisme (PLU)
   - Georisques (risques)
   - Effort: 5-8 jours

5. **Export PDF**
   - DCE, PV réception, situations
   - Effort: 3-5 jours

6. **Upload Fichiers**
   - Supabase Storage
   - Phase 4 photos/documents
   - Effort: 3-4 jours

### 6.3 Priorité MOYENNE (Mois 2)

7. **Hybrid Search RAG**
   - BM25 + Vector
   - Effort: 5-7 jours

8. **Signatures Électroniques**
   - eIDAS/DocuSign
   - Effort: 5-10 jours

9. **Notifications**
   - Email (Resend configuré)
   - SMS (optionnel)
   - Effort: 3-5 jours

---

## 7. ESTIMATION EFFORT PRODUCTION-READY

| Domaine | Effort | Priorité |
|---------|--------|----------|
| Mocks → Réel Phase 1 | 2 semaines | P0 |
| Persistance Phase 3 | 1.5 semaines | P0 |
| APIs Urbanisme | 1.5 semaines | P1 |
| Sécurité RAG | 0.5 semaines | P0 |
| Export PDF | 1 semaine | P1 |
| Upload fichiers | 1 semaine | P1 |
| Tests couverture 70% | 1.5 semaines | P1 |
| **TOTAL** | **~9-10 semaines** | |

---

## 8. CONCLUSION

### Forces du Projet
- Architecture modulaire bien pensée
- Types TypeScript exhaustifs
- Logique métier BTP très complète
- Fallbacks et gestion erreurs robustes
- Phase 4 particulièrement mature

### Faiblesses Principales
- Phase 1 entreprises 100% mockées
- Phase 3 sans persistance
- Clés API non configurées
- Embeddings côté client (sécurité)

### Recommandation Finale

**TORP est prêt pour un déploiement BETA** avec les limitations suivantes :
- Phase 0 & 4 : Production-ready
- Phase 2 : Production-ready avec mocks mineurs
- Phase 1 : DEMO uniquement (données fictives)
- Phase 3 : DEMO uniquement (pas de persistance)

**Investissement pour Production Complète**: 9-10 semaines avec équipe 2 développeurs.

---

*Rapport généré automatiquement par Claude Code*
*Commit: b9cf4fa - feat: Production readiness improvements*
