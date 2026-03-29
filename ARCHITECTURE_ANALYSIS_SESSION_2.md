# ARCHITECTURE ANALYSIS — SESSION 2
**Date:** 2026-03-27
**Status:** Analysis complete — ready for Phase 3 planning

---

## 1. Vision Globale

### Mission du Projet

TORP est une plateforme B2B SaaS d'**intelligence réglementaire** pour les entreprises de construction françaises.
Elle transforme la connaissance réglementaire brute (DTU, codes de construction, normes techniques) en insights de conformité actionnables, réduisant le risque projet et accélérant la prise de décision dans le BTP.

**Input:** Devis BTP (PDF, DOCX, image, texte)
**Output:** Score de confiance A–E + rapport structuré lot par lot

### Roadmap Stratégique (Trois Piliers)

| Pilier | Calendrier | Capability |
|--------|-----------|-----------|
| **Détection** | Q1-Q2 2026 | Extraction auto d'obligations réglementaires |
| **Scoring** | Q2-Q3 2026 | Évaluation conformité multi-dimensionnelle |
| **Certification** | Q4 2026 - Q2 2027 | Certification formelle conformité projet |

### Public Cible
- **Primaire:** PME et mid-market BTP (5-500 employés) — maçons, électriciens, plombiers, chefs de projet, QA
- **Secondaire:** Grands donneurs d'ordre (clients du marché primaire)
- **Géographie:** France-first (expansion EU Année 2)

### Phases Fonctionnelles (docs/audit/)
Les docs audit décrivent les phases du workflow d'un chantier, pas les phases de développement:
- **Phase 0:** Conception (74% maturité)
- **Phase 1:** Consultation (65%)
- **Phase 2 Contractualisation:** (75%)
- **Phase 3:** Exécution (70%)
- **Phase 4:** Réception (85%)

---

## 2. Les 12 Moteurs du Pipeline

Le pipeline s'exécute séquentiellement via `EngineOrchestrator`. L'ordre est fixe et non modifiable sans comprendre les dépendances inter-moteurs.

### Moteur 1 — Context Engine
- **Fichier:** `src/core/engines/lotContext.engine.ts`
- **Responsabilité:** Extraction du contexte projet (géographie, catégorie, lots détectés)
- **Input:** `projectData` brut (texte du devis)
- **Output:** `context.detectedLots`, `context.spaces`, `context.flags`
- **Status:** Implémenté

### Moteur 2 — Lot Engine
- **Fichier:** `src/core/engines/lot.engine.ts`
- **Responsabilité:** Parse et structure les lots (corps d'état)
- **Input:** `context.detectedLots`
- **Output:** `lots.normalizedLots` avec `category` + `domain`
- **Critères:** Regex pattern matching sur 7 catégories (electricite, plomberie, toiture, structure, chauffage, autre, unknown)
- **Mapping:** `LOT_TO_DOMAIN` → domaines DB (électrique, hydraulique, structure, thermique)
- **Status:** ✅ Amélioré Phase 2 (nouveau champ domain, 5 catégories, fix pompe/chauffant)

### Moteur 3 — Rule Engine
- **Fichier:** `src/core/engines/rule.engine.ts`
- **Responsabilité:** Charge les règles applicables depuis Supabase (table `rules`)
- **Input:** `lots.normalizedLots.domain` + `impliedDomains`
- **Output:** `rules.resolvedDecisions`, `rules.detailedObligations`, `rules.ruleCount`
- **Critères:** Filtre par domaine (IN clause), limit 500, rule_types: constraint/requirement/formula
- **Status:** ✅ Amélioré Phase 2 (merge lotDomains UNION impliedDomains)

### Moteur 4 — Scoring Engine
- **Fichier:** `src/core/engines/scoring.engine.ts` (v1.2)
- **Responsabilité:** Calcul du score de risque pondéré par type d'obligation
- **Input:** `rules.detailedObligations`, `lots.complexityScore`, `resolvedDecisions`
- **Output:** `audit.riskScore`, `audit.globalScore`, `audit.riskLevel`, `ruleEvaluation`
- **Formule:**
  ```
  riskScore = legal(100%) + regulatory(100%) + advisory(50%) - commercial(30%) + violations×5
  globalScore = max(0, (100 - riskScore - complexityImpact) × compliance_score)
  riskLevel: low(≥75), medium(≥50), high(≥25), critical(<25)
  ```
- **Status:** Implémenté + décisionEngine intégré (grade A-E, violations)

### Moteur 5 — Enrichment Engine
- **Fichier:** `src/core/engines/enrichment.engine.ts`
- **Responsabilité:** Profil de risque + stratégie de traitement + recommandations génériques
- **Input:** `rules`, `lots`, `context`
- **Output:** `enrichments.recommendations`, `enrichments.processingStrategy` (standard/enhanced/detailed/expert)
- **Status:** Implémenté (sans APIs externes actuellement)

### Moteur 6 — Audit Engine
- **Fichier:** `src/core/engines/audit.engine.ts` (v1.1)
- **Responsabilité:** Génération du rapport d'audit structuré + analyse de couverture
- **Input:** Tout le contexte (obligations, lots, enrichissements, ruleEvaluation)
- **Output:** `auditReport` (executive summary, risk assessment, compliance findings) + `coverageAudit` (nouveau)
- **Status:** ✅ Amélioré Phase 2 (coverageAudit field via reasoning layer)

### Moteur 7 — Enterprise Engine
- **Fichier:** `src/core/engines/enterprise.engine.ts`
- **Responsabilité:** Vérification entreprise (ancienneté, assurances, certifications)
- **Input:** `projectData.enterprise` (données Pappers/Siret)
- **Output:** `enterprise.normalizedScore`, `enterprise.breakdown`
- **Critères:** Longévité, assurance, certifications professionnelles, structure juridique
- **Status:** Implémenté (sans Pappers API actuellement)

### Moteur 8 — Pricing Engine
- **Fichier:** `src/core/engines/pricing.engine.ts`
- **Responsabilité:** Analyse cohérence des prix unitaires vs. références marché
- **Input:** `projectData.lots` (prix HT/TTC par lot)
- **Output:** `pricing.normalizedScore`, `pricing.breakdown`
- **Critères:** Ratio HT/TTC, anomalies extrêmes, cohérence décomposition
- **Status:** Implémenté (heuristiques statiques, pas de référentiel marché dynamique)

### Moteur 9 — Quality Engine
- **Fichier:** `src/core/engines/quality.engine.ts`
- **Responsabilité:** Qualité documentaire du devis
- **Input:** `projectData` (descriptions, mentions légales)
- **Output:** `quality.normalizedScore`, `quality.breakdown`
- **Critères:** Richesse descriptions (mots), spécifications matériaux, mentions légales, clarté
- **Status:** Implémenté

### Moteur 10 — Global Scoring
- **Fichier:** `src/core/engines/globalScoring.engine.ts`
- **Responsabilité:** Combinaison pondérée des 4 piliers → score final A-E
- **Formule:**
  ```
  weightedScore = compliance × 0.35 + enterprise × 0.25 + pricing × 0.20 + quality × 0.20
  Grade: A(≥90), B(≥75), C(≥60), D(≥40), E(<40)
  ```
- **Status:** Implémenté

### Moteur 11 — Trust Capping
- **Fichier:** `src/core/trust/trustCapping.engine.ts`
- **Responsabilité:** Plafonnement intelligent de la note selon cohérence lots/obligations
- **Input:** `globalScore.grade`, `trustFramework.registry`, anomalies prix, obligations bloquantes
- **Output:** `finalProfessionalGrade` (≤ grade original)
- **Logique:** min(grade_original, grade_max_autorisé) selon incohérences détectées
- **Status:** Implémenté

### Moteur 12 — Structural Consistency
- **Fichier:** `src/core/trust/structuralConsistency.engine.ts`
- **Responsabilité:** Détection incohérences entre piliers (compliance/quality, enterprise/risk, pricing/quality)
- **Input:** Tous les scores des piliers
- **Output:** `structuralConsistency.flags` (analyse pure, zéro impact scoring)
- **Status:** Implémenté

---

## 3. Critères / Axes d'Analyse

### Axe 1 — Conformité Réglementaire (35% du score final)
| Critère | Calcul | Seuils |
|---------|--------|--------|
| riskScore | legal + regulatory + advisory×0.5 - commercial×0.3 + violations×5 | — |
| complianceScore | 1.0 si aucune violation, < 1.0 sinon | 0–1 |
| globalScore (compliance pillar) | (100 - riskScore - complexityImpact) × complianceScore | 0–100 |
| riskLevel | low(≥75), medium(≥50), high(≥25), critical(<25) | — |
| grade (decision engine) | A-E par rule evaluation | A≥90, B≥75... |

### Axe 2 — Couverture des Règles (nouveau — Phase 2)
| Critère | Calcul | Seuils |
|---------|--------|--------|
| explicit_coverage | termes-clés règle trouvés dans devis (score ≥ 0.25) | — |
| implicit_coverage | domaine représenté dans devis, pas les termes | — |
| gap_count | règles ni explicitement ni implicitement couvertes | — |
| coverage_pct | (explicit + implicit) / total × 100 | — |
| risk_level (couverture) | < 50%: critical, 50-69%: high, 70-84%: medium, ≥85%: low | — |
| compliance_verdict | critique / non_conforme / attention / conforme | — |

### Axe 3 — Entreprise (25% du score final)
| Critère | Critères |
|---------|---------|
| Longévité | < 2 ans: risque, 2-10 ans: moyen, > 10 ans: stable |
| Assurances | RC Pro, décennale, DO présentes |
| Certifications | Qualibat, RGE, Qualifelec, etc. |
| Structure | SARL/SAS/SA vs EI |

### Axe 4 — Pricing (20% du score final)
| Critère | Critères |
|---------|---------|
| Ratio HT/TTC | cohérence TVA (5.5%, 10%, 20%) |
| Fourchettes | 100-10000€/lot normal, extrêmes: anomalie |
| Décomposition | présence des sous-postes |

### Axe 5 — Qualité (20% du score final)
| Critère | Critères |
|---------|---------|
| Descriptions | < 20 mots: pauvre, 20-50: moyen, 50+: bon, 100+: excellent |
| Matériaux | spécifications présentes |
| Mentions légales | SIRET, garanties, assurances mentionnées |

---

## 4. Phase 2 — Intégration dans l'Architecture

### Services créés (couche reasoning)

```
src/core/reasoning/
├── contextDeduction.service.ts      → Moteur 2 (impliedDomains avant lotEngine)
├── ruleKeywordExtractor.service.ts  → Moteur 6 (keywords pour coverageAnalyzer)
├── coverageAnalyzer.service.ts      → Moteur 6 (devis vs. règles)
├── recommendationGenerator.service.ts → Moteur 6 (gaps → recommandations)
└── auditReportGenerator.service.ts  → Moteur 6 (rapport structuré final)
```

### Points d'intégration

| Service Phase 2 | Moteur modifié | Données ajoutées |
|-----------------|---------------|-----------------|
| contextDeduction | Orchestrateur + Moteur 2 | `impliedDomains` sur ExecutionContext |
| analyzeCoverage | Moteur 6 (audit.engine) | `coverageAudit.coverage` |
| generateRecommendations | Moteur 6 | `coverageAudit.recommendations` |
| generateAuditReport | Moteur 6 | `coverageAudit` complet sur AuditEngineResult |

### Données manquantes pour activation complète

Le champ `coverageAudit` dans audit.engine ne se déclenche que si `projectData.devisLines` (ou `.lines`/`.items`) est présent. **Sans interface frontend, ce champ reste vide.** Phase 3 doit connecter la saisie devis au `projectData`.

---

## 5. Gaps Identifiés (Architecture vs. Code)

| Gap | Architecture dit | Code actuel | Impact |
|-----|-----------------|-------------|--------|
| Pilier Détection | KPI: précision >95%, latence <5s/chunk | Ingestion OK (258 docs), pas de KPI tracking | Monitoring manquant |
| Geographic context | Microservice indépendant | Non implémenté | Feature manquante |
| Scoring context-aware | Phase contextuelle, métier, contraintes géo | Partiel (domaines via impliedDomains) | Amélioration possible |
| Regulatory feed | DECISION 10: subscription future | Non commencé | Backlog |
| Frontend phases | Phase 0-4 UI components | Pas de vue "audit rapport" | Priorité Phase 3 |
| Pappers API | Enterprise scoring live | Heuristiques statiques | Approximation |

---

## 6. Recommandations d'Enrichissement

### Enrichissement #1 — Connecter coverageAudit au Frontend
**Contexte:** audit.engine v1.1 génère `coverageAudit` mais le frontend ne l'affiche pas.
**Problème actuel:** Résultats inaccessibles aux utilisateurs.
**Solution:** Créer un composant React `<AuditCoverageReport>` qui affiche coverage_pct, risk_level, top_gaps, recommendations.
**Impact:** Utilisateurs voient concrètement les lacunes réglementaires.
**Effort:** Medium | **Priorité:** Critical (bloque valeur Phase 2)
**Fichiers:** `src/features/audit/`, `src/components/audit/CoverageReport.tsx`

### Enrichissement #2 — Formulaire Saisie Devis
**Contexte:** `projectData.devisLines` est la source des données pour coverageAnalyzer.
**Problème actuel:** Le champ n'est pas alimenté depuis l'interface.
**Solution:** Formulaire de saisie manuelle (ligne par ligne) + parsing PDF → devisLines.
**Impact:** Active toute la chaîne Phase 2.
**Effort:** Medium | **Priorité:** Critical
**Fichiers:** `src/features/devis/DevisForm.tsx`, `src/services/devis/devisParser.service.ts`

### Enrichissement #3 — Score de Couverture dans Global Scoring
**Contexte:** `globalScoring.engine.ts` utilise compliance (35%) mais ignore la couverture des règles.
**Problème actuel:** Un devis peut avoir globalScore=80 mais ne couvrir que 30% des règles applicables.
**Solution:** Intégrer `coverageAudit.coverage_pct` comme facteur de pondération dans le pilier compliance (ex: compliance_final = compliance × (0.5 + 0.5 × coverage_pct/100)).
**Impact:** Score global reflète réellement la complétude réglementaire.
**Effort:** Quick | **Priorité:** High
**Fichiers:** `src/core/engines/globalScoring.engine.ts`

### Enrichissement #4 — Work Type → Domain Mapping Amélioré
**Contexte:** `contextDeduction.service.ts` a 26 types de projets hardcodés. `workTypeRulesMap.ts` a un mapping plus riche.
**Problème actuel:** Double maintenance des taxonomies (contextDeduction + workTypes).
**Solution:** Unifier `contextDeduction.deduceImpliedDomains()` avec `workTypeRulesMap` pour source unique.
**Impact:** Meilleure cohérence, moins de maintenance.
**Effort:** Medium | **Priorité:** Medium
**Fichiers:** `src/core/reasoning/contextDeduction.service.ts`, `src/core/workTypes/workTypeRulesMap.ts`

### Enrichissement #5 — KPI Tracking Pipeline (Pilier Détection)
**Contexte:** PROJECT_CONTEXT.md définit KPI: précision extraction >95%, latence <5s/chunk.
**Problème actuel:** Aucun système de tracking/monitoring de ces KPIs.
**Solution:** Ajouter des métriques dans `ragTracing.service.ts` + dashboard simple.
**Impact:** Valide que le Pilier 1 atteint ses objectifs.
**Effort:** Complex | **Priorité:** Medium
**Fichiers:** `src/core/rag/analytics/ragTracing.service.ts`, nouveau `scripts/kpi-report.ts`

### Enrichissement #6 — Sémantique vs. Keyword Matching
**Contexte:** `coverageScore()` utilise du substring matching. Pour des règles longues/complexes, les termes exacts peuvent ne pas apparaître dans le devis.
**Problème actuel:** Faux-négatifs (règles couvertes implicitement identifiées comme gaps).
**Solution:** Optionnel: utiliser les embeddings Supabase pour similarité sémantique devis/règle (cosine similarity via pgvector).
**Impact:** Réduction des faux-négatifs, recommendations plus pertinentes.
**Effort:** Complex | **Priorité:** Low (bon backlog ML)
**Fichiers:** Nouveau `src/core/reasoning/semanticCoverage.service.ts`

---

*Généré: 2026-03-27 | Basé sur: architecture/, docs/, src/core/engines/, src/core/reasoning/*
*Status: Analysis complete, ready for Phase 3 planning*
