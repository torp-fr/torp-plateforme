# Architecture RAG - Analyse de Devis TORP

## Vue d'ensemble

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           FLUX D'ANALYSE DEVIS                               │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────┐     ┌──────────────────┐     ┌────────────────────────────────┐
│   DEVIS PDF  │────▶│  EXTRACT-PDF     │────▶│     RAG ORCHESTRATOR           │
└──────────────┘     └──────────────────┘     │                                │
                                              │  ┌────────────────────────────┐│
                                              │  │ 1. Extraction entités IA   ││
                                              │  │    (SIRET, travaux, prix)  ││
                                              │  └────────────────────────────┘│
                                              │             │                  │
                                              │             ▼                  │
                                              │  ┌────────────────────────────┐│
                                              │  │ 2. Requêtes parallèles     ││
                                              │  │    vers sources données    ││
                                              │  └────────────────────────────┘│
                                              │             │                  │
                                              │             ▼                  │
                                              │  ┌────────────────────────────┐│
                                              │  │ 3. Agrégation & Scoring    ││
                                              │  └────────────────────────────┘│
                                              │             │                  │
                                              │             ▼                  │
                                              │  ┌────────────────────────────┐│
                                              │  │ 4. Génération contexte IA  ││
                                              │  └────────────────────────────┘│
                                              └────────────────────────────────┘
                                                           │
                                                           ▼
                                              ┌────────────────────────────────┐
                                              │      ANALYSE TORP + IA         │
                                              │  (Claude avec contexte RAG)    │
                                              └────────────────────────────────┘
                                                           │
                                                           ▼
                                              ┌────────────────────────────────┐
                                              │   RÉSULTAT ENRICHI (1000 pts)  │
                                              │  • Scores détaillés            │
                                              │  • Alertes entreprise          │
                                              │  • Comparaison prix marché     │
                                              │  • Aides éligibles             │
                                              │  • Recommandations             │
                                              └────────────────────────────────┘
```

## Sources de données

### APIs Ouvertes (Sans authentification)

| Source | Endpoint | Données | Rate Limit |
|--------|----------|---------|------------|
| **Recherche Entreprises** | `recherche-entreprises.api.gouv.fr/search` | Identité, dirigeants, finances, RGE | 7 req/s |
| **RGE ADEME** | `data.ademe.fr/.../liste-des-entreprises-rge-2/lines` | Certifications RGE détaillées | Illimité |
| **BODACC** | `bodacc-datadila.opendatasoft.com/api/explore/v2.0` | Annonces légales | 10000/jour |

### APIs avec Token (API Entreprise)

| Endpoint | Token requis | Données |
|----------|--------------|---------|
| `/v4/qualibat/.../certification_batiment` | `API_ENTREPRISE_TOKEN` | Certifications Qualibat |
| `/v3/qualifelec/.../certificats` | `API_ENTREPRISE_TOKEN` | Certifications Qualifelec |
| `/v3/opqibi/.../certification_ingenierie` | `API_ENTREPRISE_TOKEN` | Certifications OPQIBI |
| `/v4/urssaf/.../attestation_vigilance` | `API_ENTREPRISE_TOKEN` | Conformité URSSAF |
| `/v4/dgfip/.../attestation_fiscale` | `API_ENTREPRISE_TOKEN` | Conformité fiscale |
| `/v3/infogreffe/.../extrait_kbis` | `API_ENTREPRISE_TOKEN` | Kbis |

### Référentiels Intégrés

| Référentiel | Contenu | Mise à jour |
|-------------|---------|-------------|
| **Prix marché** | Isolation, chauffage, menuiserie, etc. | Manuel (ADEME/FFB) |
| **Indices BTP** | BT01-BT52 (16 indices) | Trimestriel (INSEE) |
| **Aides** | MaPrimeRénov, CEE, Éco-PTZ, TVA | Manuel |
| **Réglementations** | RE2020, DPE, RGE, DTU | Manuel |

## Modules

### `_shared/api-clients.ts`
Clients centralisés pour toutes les APIs externes.

```typescript
// APIs ouvertes
searchEntreprise(params)      // Recherche entreprise
getRGECertifications(params)  // Certifications RGE
getBODACCAnnonces(siren)      // Annonces légales

// APIs avec token
getQualibatCertification(siret, config)
getQualifelecCertification(siret, config)
getURSSAFAttestation(siren, config)
getDGFIPAttestation(siren, config)
// ...
```

### `_shared/rag-orchestrator.ts`
Orchestration RAG intelligente.

```typescript
// Extraction automatique des données devis
extractDevisData(devisText, claudeApiKey) → DevisExtractedData

// Orchestration complète
orchestrateRAG(query) → RAGContext

// Génération prompt enrichi
generateAIPromptFromRAG(context, devisText) → string
```

### `analyze-devis/index.ts`
Analyse TORP enrichie par RAG.

```typescript
POST /functions/v1/analyze-devis
{
  "devisText": "...",
  "devisId": "uuid",      // Optionnel - sauvegarde en base
  "skipRAG": false        // Optionnel - désactive RAG
}

// Réponse
{
  "success": true,
  "analysis": TORPAnalysis,
  "ragEnriched": true,
  "sources": ["API Recherche Entreprises", "ADEME", ...]
}
```

## Scoring TORP (1000 points)

| Critère | Points | Sources RAG |
|---------|--------|-------------|
| **Entreprise** | 250 | Recherche Entreprises, RGE, BODACC, URSSAF, DGFIP |
| **Prix** | 300 | Indices BTP, Référentiels prix ADEME/FFB |
| **Complétude** | 200 | Analyse IA du devis |
| **Conformité** | 150 | Réglementations, normes DTU |
| **Délais** | 100 | Analyse IA du devis |

## Base de connaissances métier

### Catégories → Indices BTP
```javascript
{
  'isolation': ['BT38'],
  'chauffage': ['BT41'],
  'electricite': ['BT43'],
  'menuiserie': ['BT16', 'BT19'],
  // ...
}
```

### Catégories → Certifications requises
```javascript
{
  'isolation': ['RGE - Isolation des murs', 'RGE - Isolation des combles'],
  'chauffage': ['RGE - Pompes à chaleur', 'Qualibat'],
  'electricite': ['Qualifelec'],
  // ...
}
```

### Catégories → Aides éligibles
```javascript
{
  'isolation': ['MaPrimeRénov', 'CEE', 'Éco-PTZ', 'TVA 5.5%'],
  'chauffage': ['MaPrimeRénov', 'CEE', 'Coup de pouce chauffage'],
  // ...
}
```

## Variables d'environnement

```bash
# Obligatoire
CLAUDE_API_KEY=sk-ant-...
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Optionnel - API Entreprise (accès restreint)
API_ENTREPRISE_TOKEN=eyJ...
API_ENTREPRISE_RECIPIENT=SIRET_demandeur

# Optionnel - INSEE
INSEE_API_TOKEN=...

# Optionnel - N8N
N8N_WEBHOOK_SECRET=...
```

## Workflow N8N

```
┌─────────────┐
│  Webhook    │
│  Trigger    │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Get Pending │
│   Devis     │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Split     │
│  Batches    │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Extract    │
│    PDF      │
└──────┬──────┘
       │
       ├────────────────┬────────────────┐
       ▼                ▼                ▼
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│   Scrape    │  │   Compare   │  │   Check     │
│ Enterprise  │  │   Prices    │  │   Aids      │
└──────┬──────┘  └──────┬──────┘  └──────┬──────┘
       │                │                │
       └────────────────┴────────────────┘
                        │
                        ▼
               ┌─────────────┐
               │    TORP     │
               │  Analysis   │
               └──────┬──────┘
                      │
                      ▼
               ┌─────────────┐
               │   Score     │
               │   >= 700?   │
               └──────┬──────┘
                      │
              ┌───────┴───────┐
              ▼               ▼
       ┌─────────────┐ ┌─────────────┐
       │  Approved   │ │   Review    │
       │   Notify    │ │   Needed    │
       └─────────────┘ └─────────────┘
```

## Déploiement

```bash
# Déployer toutes les fonctions
supabase functions deploy analyze-devis
supabase functions deploy extract-pdf
supabase functions deploy scrape-enterprise
supabase functions deploy scrape-prices
supabase functions deploy scrape-regulations
supabase functions deploy webhook-n8n

# Configurer les secrets
supabase secrets set CLAUDE_API_KEY=sk-ant-...
supabase secrets set API_ENTREPRISE_TOKEN=eyJ...
```

## Exemple d'appel

```bash
curl -X POST https://xxx.supabase.co/functions/v1/analyze-devis \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "devisText": "DEVIS N°2024-001\nEntreprise ABC RENOVATION\nSIRET: 12345678901234\n...",
    "devisId": "uuid-optional"
  }'
```
