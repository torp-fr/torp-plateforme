# Context-Driven Data Fetching Pipeline
**Version:** 1.0
**Date:** 2026-03-27
**Status:** Design

---

## Philosophy

**Don't fetch everything upfront. Fetch what the project actually needs.**

```
Client: "piscine" project in Paris 75001
→ System: "I need PLU (piscines allowed?), ABF check (historic zone), water/elec permits"
→ Fetch only those 3 APIs — skip DPE, skip aides (not applicable for new construction)

Client: "window replacement" (simple renovation)
→ System: "Just need ABF check for historic zone"
→ Skip PLU, permits, aides → 1 API call instead of 5
```

---

## Decision Tree: What to Fetch?

```
START: projectType defined + client address validated
    ↓
[PROJECT_TYPE switch]
    │
    ├─ PISCINE / BASSIN
    │   ├─ PLU:       fetchPLU()       ← Piscines autorisées dans cette zone?
    │   ├─ Permits:   fetchPermits()   ← Permis construire requis si > 10m²?
    │   ├─ ABF:       fetchABF()       ← Zone protégée historique?
    │   └─ Utility:   fetchUtility()   ← Capacité eau / élec suffisante? (optional)
    │
    ├─ RENOVATION LOURDE
    │   ├─ ABF:       fetchABF()       ← Zone protégée (façades, toitures)?
    │   ├─ Permits:   fetchPermits()   ← Déclaration préalable / PC requis?
    │   ├─ DPE:       fetchDPE()       ← Étiquette énergie actuelle?
    │   └─ Aides:     fetchAides()     ← CEE, MaPrimeRénov?
    │
    ├─ CONSTRUCTION NEUVE
    │   ├─ PLU:       fetchPLU()       ← Hauteur max, COS, zone constructible
    │   ├─ Permits:   fetchPermits()   ← Permis construire obligatoire
    │   ├─ ABF:       fetchABF()       ← Zone protégée
    │   └─ Utility:   fetchUtility()   ← Raccordement eau, élec, gaz
    │
    ├─ TOITURE
    │   ├─ ABF:       fetchABF()       ← Matériaux imposés en zone protégée?
    │   └─ Permits:   fetchPermits()   ← Déclaration si surface > 20m²
    │
    ├─ ELECTRICITE_SEULE / PLOMBERIE_SEULE
    │   └─ Skip all   (no geo context needed for interior work)
    │
    ├─ ISOLATION / CHAUFFAGE
    │   ├─ DPE:       fetchDPE()       ← Performance actuelle (base pour calcul gain)
    │   └─ Aides:     fetchAides()     ← CEE, MaPrimeRénov, éco-PTZ
    │
    └─ DEFAULT / AUTRE
        └─ Minimal:   fetchABF()       ← Always check ABF as baseline
```

---

## APIs Inventory

### TIER 1 — Free APIs (Always try first)

| API | Purpose | Endpoint | Latency | Rate Limit |
|-----|---------|----------|---------|-----------|
| **Pappers** | SIRET/RCS — effectifs, CA, dirigeant, NAF | `api.pappers.fr/v2/entreprise?siret=` | 100ms | 50 req/min (free) |
| **data.gouv — SIRET** | Certifications RGE, Qualiopi, Qualibat | `api.gouv.fr/v1/siret/{siret}` | 300ms | Generous |
| **Base Adresse Nationale** | Address validation + geocoding | `api-adresse.data.gouv.fr/search/` | 100ms | No limit |
| **IGN Géoportail** | Cadastre, parcelles, PLU | `wxs.ign.fr/` + WMS/WMTS | 300ms | No limit |
| **Géo.API.gouv** | City data, zones PLU | `geo.api.gouv.fr/communes` | 200ms | No limit |
| **Légifrance API** | Regulatory texts (ABF zones, permits) | `sandbox.piste.gouv.fr` | 500ms | Key required |
| **data.gouv — Aides** | MaPrimeRénov, CEE eligibility | `data.gouv.fr/api/1/datasets/` | 400ms | No limit |
| **OpenStreetMap Nominatim** | Backup geocoding | `nominatim.openstreetmap.org` | 200ms | 1 req/sec |

### TIER 2 — Paid APIs (When budget allows)

| API | Purpose | Cost Model | Latency |
|-----|---------|-----------|---------|
| **Trustpilot Business** | Company reputation score | B2B pricing | 1s |
| **Google Business API** | GMB reviews + photos | Free quota then pay | 500ms |
| **Veriff** | Company identity verification | Per-check pricing | 2s |
| **Infogreffe** | Official RCS/RNCS data | Per-request | 300ms |
| **ADEME DPE** | DPE energy certificate lookup | Free (public) | 500ms |

### TIER 3 — Future (Phase 4+)

- CCTP/CCAP mining (historic devis database)
- Weather API (climate factors for thermal projects)
- Insurance data APIs (contractor liability verification)
- Sinimo / Assurland (insurance broker APIs)

---

## LazyLoad Pattern

### TypeScript Interface

```typescript
interface LazyLoadedData<T> {
  status: 'pending' | 'loading' | 'loaded' | 'failed' | 'skipped';
  data?: T;
  error?: string;
  fetched_at?: Date;
  source_api?: string;
  duration_ms?: number;
}

// Example: Projet contexte_local
interface ProjetContexte {
  plu?: LazyLoadedData<PLUInfo>;
  abf_protection?: LazyLoadedData<boolean>;
  permis_requis?: LazyLoadedData<PermisInfo>;
  aides_eligibles?: LazyLoadedData<AideInfo[]>;
  dpe_actuel?: LazyLoadedData<DPEInfo>;
}
```

### Data Need Resolver

```typescript
type DataNeed = 'PLU' | 'ABF' | 'PERMITS' | 'AIDES' | 'DPE' | 'UTILITY' | 'REPUTATION';

function resolveDataNeeds(projectType: ProjectType): DataNeed[] {
  const needs: Record<ProjectType, DataNeed[]> = {
    piscine:          ['PLU', 'ABF', 'PERMITS', 'UTILITY'],
    renovation:       ['ABF', 'PERMITS', 'DPE', 'AIDES'],
    construction_neuve: ['PLU', 'ABF', 'PERMITS', 'UTILITY'],
    toiture:          ['ABF', 'PERMITS'],
    electricite_seule: [],
    plomberie_seule:  [],
    isolation:        ['DPE', 'AIDES'],
    chauffage:        ['DPE', 'AIDES'],
    fenetre:          ['ABF'],
    extension:        ['PLU', 'ABF', 'PERMITS'],
    maison_neuve:     ['PLU', 'ABF', 'PERMITS', 'UTILITY'],
    autre:            ['ABF'],
    // ... etc
  };
  return needs[projectType] ?? ['ABF'];
}
```

### Fetch Orchestrator

```typescript
async function enrichProjectContext(
  projet: Projet,
  localisation: { lat: number; lng: number; code_postal: string }
): Promise<ProjetContexte> {
  const needs = resolveDataNeeds(projet.type);
  const contexte: ProjetContexte = {};

  // Fetch all needed data in parallel
  const fetches = needs.map(need => fetchDataForNeed(need, localisation));
  const results = await Promise.allSettled(fetches);

  results.forEach((result, i) => {
    const need = needs[i];
    if (result.status === 'fulfilled') {
      contexte[need.toLowerCase() as keyof ProjetContexte] = {
        status: 'loaded',
        data: result.value,
        fetched_at: new Date(),
        source_api: getSourceAPI(need),
      };
    } else {
      contexte[need.toLowerCase() as keyof ProjetContexte] = {
        status: 'failed',
        error: result.reason?.message,
      };
    }
  });

  return contexte;
}
```

---

## Fetch Strategy per Entity

### Entreprise Registration (Synchronous — user waits)

```
User enters SIRET
    ↓
[Trigger parallel fetches — 2-3 sec max]
    ├─ Pappers.fetch(siret)          → donnees_rcs
    ├─ data.gouv.fetch(siret)        → donnees_certifications
    └─ [Background, no wait]
        └─ Trustpilot + Google       → donnees_reputation

Show: "Enrichissement du profil..." (spinner)
On complete: Show pre-filled profile for user to confirm
Cache: Store all results in entreprises table
```

### Project Localization (Async — background fetch)

```
User enters address + selects project type
    ↓
[Instant: compute impliedDomains from projectType] ← Phase 2 ContextDeductionEngine
    ↓
[Async parallel — show progress]
    ├─ BANO.geocode(address)           → lat/lng + normalized address
    ├─ IGN.fetchParcelle(lat, lng)     → cadastre parcel
    └─ [Triggered by project type]
        ├─ Géoportail.fetchPLU(...)    → PLU info
        ├─ Légifrance.fetchABF(...)    → ABF status
        └─ data.gouv.fetchAides(...)   → Eligible aides

Show: "Vérification des réglementations locales..."
On complete: Display "Réglementations applicables" card
Cache: Store in projet.localisation.contexte
```

### Devis Upload (Synchronous — user waits)

```
User uploads file
    ↓
[Format detection]
    ↓
[Parsing — 2-10 sec depending on size/OCR]
    ↓
Show: "Analyse du devis..."
On complete: Preview parsed items for user validation
```

---

## Error Handling Strategy

```typescript
async function fetchWithFallback<T>(
  primaryFetch: () => Promise<T>,
  fallbackFetch?: () => Promise<T>,
  options: { tier: 'free' | 'paid'; required: boolean } = { tier: 'free', required: false }
): Promise<LazyLoadedData<T>> {
  try {
    const data = await primaryFetch();
    return { status: 'loaded', data, fetched_at: new Date() };
  } catch (primaryError) {
    if (fallbackFetch) {
      try {
        const data = await fallbackFetch();
        return { status: 'loaded', data, fetched_at: new Date(), source_api: 'fallback' };
      } catch (fallbackError) {
        // Both failed
      }
    }

    if (options.required) {
      // Block the flow — user must see this error
      return { status: 'failed', error: String(primaryError) };
    } else {
      // Non-blocking — log and continue without data
      console.warn(`Optional data fetch failed: ${primaryError}`);
      return { status: 'failed', error: String(primaryError) };
    }
  }
}
```

---

## Caching Strategy

| Data Type | Cache Duration | Storage |
|-----------|---------------|---------|
| Entreprise RCS (Pappers) | 30 days | Supabase (entreprises table) |
| Entreprise certifications | 7 days | Supabase (entreprises table) |
| Entreprise reputation | 24 hours | Supabase (entreprises table) |
| PLU info by parcel | 90 days | Supabase (projet.localisation) |
| ABF protection | 1 year | Supabase (projet.localisation) |
| Aides éligibilité | 7 days | Supabase (projet.localisation) |
| DPE data | Permanent (DPE is immutable) | Supabase |

**Rule:** Never re-fetch if `fetched_at` is within cache duration. Always expose `fetched_at` to the user.

---

## User-Visible States

```
Entreprise registration:
  "Récupération du profil SIRET..." → 2-3 sec → "Profil enrichi ✓"

Project creation:
  "Vérification des réglementations locales..." → 2-4 sec → "Contexte réglementaire disponible ✓"
  Or if failed: "Données locales indisponibles — continuez manuellement"

Devis upload:
  "Analyse du devis (format: PDF)..." → 2-10 sec → "9 postes détectés ✓"
  Or: "Qualité OCR faible — vérifiez les postes manuellement"
```
