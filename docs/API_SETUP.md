# API Setup Guide — TORP Phase 4

Guide complet pour configurer toutes les APIs externes du projet TORP.

---

## Quick Start

```bash
# 1. Copier le template
cp .env.example .env.local

# 2. Remplir les credentials (voir sections ci-dessous)
# Éditer .env.local avec vos clés

# 3. Configurer les secrets Supabase Edge Functions
supabase link --project-ref iixxzfgexmiofvmfrnuy
supabase secrets set ANTHROPIC_API_KEY="sk-ant-..."
supabase secrets set OPENAI_API_KEY="sk-proj-..."
supabase secrets set PAPPERS_API_KEY="..."

# 4. Tester la connectivité
pnpm test:apis
# ou: bash scripts/test-api-connectivity.sh all
```

---

## Règles de sécurité

| Règle | Détail |
|---|---|
| ✅ `VITE_*` = public | Inclus dans le bundle JS — visible par l'utilisateur final |
| 🔴 Secrets ≠ `VITE_*` | `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `PAPPERS_API_KEY` etc. sans VITE_ |
| 🔴 `.env.local` hors Git | Déjà dans `.gitignore` — ne jamais committer |
| ✅ `.env.example` dans Git | Template sans secrets — à committer |
| ✅ Edge Functions | Secrets injectés via `supabase secrets set` — jamais en clair |

**Pattern d'appel LLM côté frontend** : Toute requête Claude ou OpenAI depuis le frontend passe par une Edge Function (`llm-completion`, `generate-embedding`). Les clés ne touchent jamais le bundle Vite.

---

## APIs par priorité

### P0 — Critique (requis pour fonctionnement de base)

#### Supabase
```bash
# Automatiquement configuré via Supabase dashboard
# Variables publiques (safe in VITE_):
VITE_SUPABASE_URL=https://iixxzfgexmiofvmfrnuy.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...

# Variables serveur (Edge Functions + Express):
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...

# Test:
curl "${SUPABASE_URL}/rest/v1/platform_settings?select=id&limit=1" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}"
```

#### Anthropic Claude
1. Créer un compte: [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys)
2. Settings → API Keys → Create Key
3. Format: `sk-ant-api03-...`

```bash
ANTHROPIC_API_KEY=sk-ant-api03-...
CLAUDE_API_KEY=sk-ant-api03-...  # alias

# Test:
curl -X POST https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "Content-Type: application/json" \
  -d '{"model":"claude-haiku-4-5-20251001","max_tokens":10,"messages":[{"role":"user","content":"Hi"}]}'

# Supabase secret:
supabase secrets set ANTHROPIC_API_KEY="sk-ant-api03-..."
```

**Pricing**: Sonnet 4.6 = $3/$15 per 1M tokens (input/output).

#### OpenAI
1. Créer une clé: [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Create new secret key → format `sk-proj-...`

```bash
OPENAI_API_KEY=sk-proj-...

# Test:
curl https://api.openai.com/v1/models?limit=1 \
  -H "Authorization: Bearer $OPENAI_API_KEY"

# Supabase secret:
supabase secrets set OPENAI_API_KEY="sk-proj-..."
```

**Usage TORP**: `text-embedding-3-small` (dimensions: 384) pour `knowledge_chunks.embedding_vector`.
**Pricing**: $0.02/1M tokens pour embeddings.

#### Google Cloud Vision
1. [console.cloud.google.com](https://console.cloud.google.com)
2. APIs & Services → Enable → "Cloud Vision API"
3. Credentials → Create Credentials → API Key
4. **Restreindre**: API restrictions → Cloud Vision API uniquement

```bash
GOOGLE_CLOUD_API_KEY=AIzaSy...
GOOGLE_CLOUD_PROJECT_ID=torp-project-xxx

# Test:
curl -X POST "https://vision.googleapis.com/v1/images:annotate?key=$GOOGLE_CLOUD_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"requests":[{"image":{"content":"iVBORw0KGgo="},"features":[{"type":"LABEL_DETECTION"}]}]}'

# Supabase secret:
supabase secrets set GOOGLE_CLOUD_API_KEY="AIzaSy..."
```

**Usage TORP**: OCR devis photographiés via Edge Function `google-vision-ocr`.
**Pricing**: 1000 premiers OCR/mois gratuits, puis $1.50/1000.

#### Pappers
1. S'inscrire: [pappers.fr/api](https://www.pappers.fr/api)
2. Dashboard → API Keys → Créer une clé

```bash
PAPPERS_API_KEY=votre_token
PAPPERS_API_ENDPOINT=https://api.pappers.fr/v2

# Test:
curl "https://api.pappers.fr/v2/entreprise?siret=35600000059843&api_token=$PAPPERS_API_KEY"

# Supabase secret:
supabase secrets set PAPPERS_API_KEY="votre_token"
```

**Usage TORP**: EnterpriseEngine → SIRET lookup, vérification solvabilité.
**Pricing**: 100 appels/mois gratuits. Payant au-delà.

---

### P1 — Important

#### BANO / Base Adresse Nationale
Aucune clé requise — open data gouvernemental.

```bash
BANO_API_ENDPOINT=https://api-adresse.data.gouv.fr

# Test:
curl "https://api-adresse.data.gouv.fr/search/?q=Paris&limit=1"
```

**Usage TORP**: ClientLocalizationPipeline → géocodage adresses.
**Rate limit**: 50 req/s recommandé.

#### Nominatim / OpenStreetMap
Aucune clé — mais `User-Agent` obligatoire (CGU OSM).

```bash
NOMINATIM_API_ENDPOINT=https://nominatim.openstreetmap.org
NOMINATIM_USER_AGENT=TORP/1.0 contact@torp.fr  # Mettre votre email réel

# Test:
curl -H "User-Agent: TORP/1.0 contact@torp.fr" \
  "https://nominatim.openstreetmap.org/search?q=Paris&format=json&limit=1"
```

**Rate limit**: **1 req/sec** — backoff 1200ms implémenté dans `NominatimClient.ts`.

#### ADEME — RGE / DPE
Aucune clé requise pour la plupart des endpoints.

```bash
ADEME_DPE_ENDPOINT=https://data.ademe.fr/data-fair/api/v1/datasets
ADEME_RGE_API_KEY=  # Laisser vide

# Test:
curl "https://data.ademe.fr/data-fair/api/v1/datasets/liste-des-entreprises-rge-2/lines?size=1"
```

#### IGN Géoportail
1. [geoservices.ign.fr](https://geoservices.ign.fr) → Espace pro → Créer un compte
2. Créer un projet → Activer WFS Géoportail
3. Copier la clé générée

```bash
IGN_API_KEY=votre_cle_ign
IGN_GEOPORTAIL_ENDPOINT=https://wxs.ign.fr

# Test PLU (public, sans clé):
curl "https://www.geoportail-urbanisme.gouv.fr/api/feature-info?lon=2.3522&lat=48.8566&format=json"
```

#### INSEE SIRENE
Optionnel (augmente les quotas de 30 → 1000 req/min).

1. [api.insee.fr](https://api.insee.fr) → Inscription → Abonnement API SIRENE
2. Créer une application → récupérer token OAuth2

```bash
INSEE_API_KEY=votre_token
INSEE_API_URL=https://api.insee.fr

# Test sans clé (quotas limités):
curl "https://api.insee.fr/api/sirene/V3.11/etablissements/35600000059843" \
  -H "Accept: application/json"

# Test avec clé:
curl "https://api.insee.fr/api/sirene/V3.11/etablissements/35600000059843" \
  -H "Authorization: Bearer $INSEE_API_KEY" \
  -H "Accept: application/json"
```

**Coût**: Gratuit.

#### Resend (Email transactionnel)
1. [resend.com](https://resend.com) → Signup
2. Domains → Add Domain → Ajouter les enregistrements DNS pour `torp.fr`
3. API Keys → Create API Key

```bash
RESEND_API_KEY=re_xxxx
RESEND_FROM_EMAIL=noreply@torp.fr

# Test (liste domaines):
curl "https://api.resend.com/domains" \
  -H "Authorization: Bearer $RESEND_API_KEY"

# Supabase secret:
supabase secrets set RESEND_API_KEY="re_xxxx"
```

**Usage TORP**: Notifications email (analyse terminée, alertes admin).
**Pricing**: 3000 emails/mois gratuits.

#### Légifrance PISTE
> ⚠️ Status: **stub** — `legifranceEnabled` feature flag OFF. À implémenter en Phase 4.

1. [piste.gouv.fr](https://piste.gouv.fr) → Créer un compte
2. Mes applications → Nouvelle application → Activer "Légifrance"
3. Récupérer `client_id` + `client_secret` OAuth2

```bash
LEGIFRANCE_API_KEY=votre_token_piste
LEGIFRANCE_API_ENDPOINT=https://sandbox.piste.gouv.fr  # dev

# Obtenir un token OAuth2:
curl -X POST https://oauth.piste.gouv.fr/api/oauth/token \
  -d "grant_type=client_credentials&client_id=YOUR_ID&client_secret=YOUR_SECRET&scope=openid"

# Test (avec token):
curl "https://sandbox.piste.gouv.fr/dila/legifrance/lf-engine-app/consult/getArticle?id=LEGIARTI000006353783" \
  -H "Authorization: Bearer $LEGIFRANCE_API_KEY"
```

**Coût**: Gratuit (service public).

---

### P2 — Optionnel

#### Sentry (Error tracking)
```bash
VITE_SENTRY_DSN=https://xxx@org.ingest.sentry.io/project

# Installation:
pnpm add @sentry/react @sentry/tracing

# Initialisation dans main.tsx (à faire en Phase 4):
# import * as Sentry from '@sentry/react';
# Sentry.init({ dsn: import.meta.env.VITE_SENTRY_DSN });
```

#### Slack (Alertes système)
```bash
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/T.../B.../xxx

# Obtenir:
# api.slack.com/apps → Create New App → Incoming Webhooks → Activate
# → Add to Workspace → Copier l'URL

# Test:
curl -X POST $SLACK_WEBHOOK_URL \
  -H "Content-Type: application/json" \
  -d '{"text":"Test TORP alert"}'
```

#### Trustpilot (Réputation entreprise)
```bash
TRUSTPILOT_API_KEY=votre_token
TRUSTPILOT_API_ENDPOINT=https://api.trustpilot.com/v1
```

**Pricing**: API B2B payante — tarification sur demande.

#### Stripe (Phase 5 — désactivé)
```bash
VITE_STRIPE_ENABLED=false
VITE_STRIPE_PUBLIC_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...         # ⚠️ JAMAIS en VITE_
STRIPE_WEBHOOK_SECRET=whsec_...
```

---

## Configurer les secrets Supabase Edge Functions

Les Edge Functions (`llm-completion`, `generate-embedding`, `google-vision-ocr`, `pappers-proxy`, etc.) lisent leurs secrets via `Deno.env.get('KEY')`. Il faut les configurer séparément du `.env.local`.

### Via CLI

```bash
# Lier le projet
supabase link --project-ref iixxzfgexmiofvmfrnuy

# Configurer les secrets
supabase secrets set ANTHROPIC_API_KEY="sk-ant-api03-..."
supabase secrets set CLAUDE_API_KEY="sk-ant-api03-..."
supabase secrets set OPENAI_API_KEY="sk-proj-..."
supabase secrets set GOOGLE_CLOUD_API_KEY="AIzaSy..."
supabase secrets set GOOGLE_CLOUD_PROJECT_ID="torp-project-xxx"
supabase secrets set PAPPERS_API_KEY="..."
supabase secrets set RESEND_API_KEY="re_..."
supabase secrets set N8N_WEBHOOK_SECRET="..."

# Vérifier (affiche les noms, pas les valeurs)
supabase secrets list
```

### Via Dashboard

[supabase.com/dashboard/project/iixxzfgexmiofvmfrnuy/settings/functions](https://supabase.com/dashboard/project/iixxzfgexmiofvmfrnuy/settings/functions) → Secrets → Add secret.

---

## Tests de connectivité

```bash
# Tous les tests
pnpm test:apis
# ou: bash scripts/test-api-connectivity.sh all

# Test individuel
bash scripts/test-api-connectivity.sh pappers
bash scripts/test-api-connectivity.sh anthropic
bash scripts/test-api-connectivity.sh openai

# Sources disponibles:
# supabase | bano | nominatim | insee | ademe | datagouv
# pappers | google | anthropic | openai | legifrance | ign | resend
```

### Résultat attendu

```
╔══════════════════════════════════════════════════════════════════╗
║          TORP — API Connectivity Test Suite                    ║
╚══════════════════════════════════════════════════════════════════╝

▸ Supabase          ✅  responding (service role valid)
▸ BANO              ✅  responding — found: Paris 1er Arrondissement
▸ Nominatim         ✅  responding — found: Paris, Île-de-France...
▸ INSEE SIRENE      ✅  responding (HTTP 200)
▸ ADEME RGE         ✅  responding
▸ Data.gouv.fr      ✅  responding
▸ Pappers           ✅  API key valid — SIREN: 356000000
▸ Google Vision     ✅  API key valid
▸ Anthropic Claude  ✅  API key valid
▸ OpenAI            ✅  API key valid
▸ Légifrance        ⚠️  key not set (skipping)
▸ IGN Géoportail    ✅  PLU public endpoint responding
▸ Resend            ⚠️  key not set (skipping)

Results:
  ✅ Passed:  11
  ❌ Failed:  0
  ⚠️  Skipped: 2
```

---

## Matrice de stockage des credentials

| Variable | `.env.local` | Vercel env | Supabase secrets | Sensibilité |
|---|---|---|---|---|
| `VITE_SUPABASE_URL` | ✅ | ✅ | — | Public |
| `VITE_SUPABASE_ANON_KEY` | ✅ | ✅ | — | Public |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | ✅ | ✅ auto-injecté | 🔴 Secret |
| `ANTHROPIC_API_KEY` | ✅ | ✅ | ✅ | 🔴 Secret |
| `OPENAI_API_KEY` | ✅ | ✅ | ✅ | 🔴 Secret |
| `GOOGLE_CLOUD_API_KEY` | ✅ | ✅ | ✅ | 🔴 Secret |
| `PAPPERS_API_KEY` | ✅ | ✅ | ✅ | 🔴 Secret |
| `RESEND_API_KEY` | ✅ | ✅ | ✅ | 🔴 Secret |
| `IGN_API_KEY` | ✅ | ✅ | — | 🟡 Secret |
| `LEGIFRANCE_API_KEY` | ✅ | ✅ | — | 🟡 Secret |
| `INSEE_API_KEY` | ✅ | ✅ | — | 🟡 Semi-public |
| `VITE_SENTRY_DSN` | ✅ | ✅ | — | 🟢 Public |
| `STRIPE_SECRET_KEY` | ✅ | ✅ | — | 🔴 Secret |
| `VITE_STRIPE_PUBLIC_KEY` | ✅ | ✅ | — | 🟢 Public |
| `JWT_SECRET` | ✅ | ✅ | — | 🔴 Secret |
| `N8N_WEBHOOK_SECRET` | ✅ | ✅ | ✅ | 🔴 Secret |
| `BANO_API_ENDPOINT` | ✅ | — | — | 🟢 Public |
| `NOMINATIM_USER_AGENT` | ✅ | — | — | 🟢 Public |
