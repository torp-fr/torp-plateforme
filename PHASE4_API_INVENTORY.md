# PHASE 4 — API Inventory & Integration Plan
*TORP Platform — Audit des sources de données — 2026-03-28*

---

## Executive Summary

| Métrique | Valeur |
|---|---|
| Variables d'environnement uniques | 78 |
| APIs externes intégrées | 18 |
| APIs commerciales (payantes) | 7 |
| APIs open data (gratuites) | 11 |
| Edge Functions Supabase | 17 |
| Client classes dédiés | 6 |
| Packages NPM API-related | 5 installés |
| Problème sécurité identifié | ⚠️ 2 clés API exposées côté frontend |

**Verdict**: L'infrastructure d'intégration est bien avancée. Les clients Pappers, IGN, INSEE, ADEME-RGE, BANO/Nominatim, et Trustpilot sont implémentés. Claude, OpenAI et Google Vision sont opérationnels via Edge Functions. Les principales lacunes sont: Légifrance (stub sans appel réel), absence de Brevo/Slack, et deux clés API exposées côté Vite (à migrer côté serveur).

---

## Part 1 — Audit des intégrations existantes

### 1.1 Matrice : Source × Status × Credentials

| Source | Status | Credentials nécessaires | Où stocké actuellement |
|---|---|---|---|
| **Supabase** | ✅ Opérationnel | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | `.env.local` + Edge Function secrets |
| **Anthropic Claude** | ✅ Opérationnel | `ANTHROPIC_API_KEY` / `CLAUDE_API_KEY` | `.env.local` + Edge Function secrets |
| **OpenAI** | ✅ Opérationnel | `OPENAI_API_KEY` | `.env.local` + Edge Function secrets |
| **Google Cloud Vision** | ✅ Opérationnel | `GOOGLE_CLOUD_API_KEY` + `GOOGLE_SERVICE_ACCOUNT_JSON` | Edge Function secrets |
| **Pappers** | ✅ Client implémenté | `PAPPERS_API_KEY` | `.env.local` + Edge Function secrets |
| **ADEME RGE** | ✅ Intégration active | `ADEME_RGE_API_KEY` (optionnel — certains endpoints open data) | `.env.local` |
| **BANO / BAN** | ✅ Client implémenté | Aucun (open data) | N/A |
| **Nominatim OSM** | ✅ Client implémenté | Aucun + `User-Agent` header | Config hardcodée |
| **IGN Géoportail** | ✅ Client implémenté | `IGN_API_KEY` (WFS), PLU public sans clé | `.env.local` |
| **Data.gouv.fr (RGE/Qualiopi)** | ✅ Client implémenté | Aucun (open data) | N/A |
| **INSEE SIRENE** | ✅ Service implémenté | `INSEE_API_KEY` (optionnel) | `.env.local` |
| **Légifrance PISTE** | ⚠️ Config présente, pas d'appel réel | `LEGIFRANCE_API_KEY` | `.env.local` |
| **Trustpilot** | ✅ Client implémenté | `TRUSTPILOT_API_KEY` | `.env.local` |
| **Resend (Email)** | ⚠️ Package installé, non configuré | `RESEND_API_KEY` | Non configuré |
| **Stripe** | ⚠️ Feature flag, désactivé | `VITE_STRIPE_PUBLIC_KEY`, `STRIPE_SECRET_KEY` | Non configuré |
| **Slack** | ❌ Non implémenté | `SLACK_WEBHOOK_URL`, `SLACK_BOT_TOKEN` | Non configuré |
| **Sentry** | ❌ Non implémenté | `VITE_SENTRY_DSN` | Non configuré |
| **n8n** | ✅ Webhook configuré | `N8N_WEBHOOK_SECRET` | Edge Function secrets |

### 1.2 Client classes dédiés

```
src/external/clients/
├── BaseAPIClient.ts     — Base abstraite: retry, cache, timeout, backoff
├── PappersClient.ts     — SIRET lookup, données entreprise
├── IGNClient.ts         — Cadastre WFS, PLU géoportail
├── DataGouvClient.ts    — RGE ADEME open data, Qualiopi
├── NominatimClient.ts   — BANO geocoding primaire, Nominatim fallback
└── TrustpilotClient.ts  — Avis et score réputation
```

### 1.3 Problèmes de sécurité identifiés

> ⚠️ **CRITIQUE**: `VITE_OPENAI_API_KEY` et `VITE_ANTHROPIC_API_KEY` sont déclarés dans `.env.example` comme variables `VITE_*` — ce qui les expose dans le bundle Vite côté client.
>
> **Solution**: Ces appels passent déjà par les Edge Functions. Retirer les variables `VITE_OPENAI_API_KEY` et `VITE_ANTHROPIC_API_KEY` du frontend. Ne conserver que les versions serveur (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`).

---

## Part 2 — Fiche par source

---

### 🏢 Pappers — Données entreprise (SIRET, dirigeants, financiers)

| Champ | Valeur |
|---|---|
| **Priorité** | P0 — Critique |
| **URL** | `https://api.pappers.fr/v2` |
| **Auth** | Query param `?api_token=` |
| **SDK** | Aucun SDK officiel — client custom (`PappersClient.ts`) |
| **Status** | ✅ Implémenté et actif |

**Variables d'environnement**
```bash
PAPPERS_API_KEY=votre_token_pappers
PAPPERS_API_ENDPOINT=https://api.pappers.fr/v2  # optionnel, déjà par défaut
```

**Endpoints utilisés**
- `GET /entreprise?siret={siret}` → raison sociale, NAF, effectifs, dirigeants, adresse, coordonnées GPS
- `GET /entreprise?siret={siret}&extrait_kbis=true` → extrait Kbis

**Stockage**
- Dev: `.env.local`
- Prod: Supabase Edge Function secrets
- Sensibilité: **Secret** (ne jamais exposer côté frontend)

**Où obtenir la clé**
1. S'inscrire sur [pappers.fr/api](https://www.pappers.fr/api)
2. Tableau de bord → API Keys → Créer une clé
3. Copier dans `PAPPERS_API_KEY`

**Pricing**: Pay-per-call. Free tier: 100 appels/mois. Payant au-delà.

**Rate limit**: Non documenté publiquement. Cache implémenté: 7 jours.

---

### 🤖 Anthropic Claude — LLM principal (analyse devis, OCR structuré)

| Champ | Valeur |
|---|---|
| **Priorité** | P0 — Critique |
| **URL** | `https://api.anthropic.com/v1/messages` |
| **Auth** | Header `x-api-key` |
| **SDK** | `@anthropic-ai/sdk` v0.70.0 ✅ installé |
| **Status** | ✅ Opérationnel (Edge Functions) |

**Variables d'environnement**
```bash
ANTHROPIC_API_KEY=sk-ant-api03-...
# Alias accepté aussi dans certains fichiers:
CLAUDE_API_KEY=sk-ant-api03-...
```

**Modèles utilisés**
- `claude-sonnet-4-6` (analyses devis, raisonnement)
- Vision: analyse d'images/devis photographiés

**Stockage**
- Dev: `.env.local`
- Prod: Supabase Edge Function secrets + GitHub Actions secrets
- Sensibilité: **Secret absolu** — ne jamais dans `VITE_`

**Note critique**: Retirer `VITE_ANTHROPIC_API_KEY` du frontend. Passer tous les appels via Edge Function `llm-completion`.

**Où obtenir la clé**
1. [console.anthropic.com](https://console.anthropic.com/settings/keys)
2. Settings → API Keys → Create Key
3. Format: `sk-ant-api03-...`

**Pricing**: Pay-per-token. Sonnet ≈ $3/$15 per 1M tokens (input/output).

---

### 🧠 OpenAI — Embeddings RAG + fallback LLM

| Champ | Valeur |
|---|---|
| **Priorité** | P0 — Critique |
| **URL** | `https://api.openai.com/v1` |
| **Auth** | Bearer `Authorization: Bearer sk-...` |
| **SDK** | `openai` v6.9.1 ✅ installé |
| **Status** | ✅ Opérationnel (embeddings, completions) |

**Variables d'environnement**
```bash
OPENAI_API_KEY=sk-proj-...
```

**Modèles utilisés**
- `text-embedding-3-small` (dimensions: 384) → knowledge_chunks.embedding_vector
- GPT-4 series → fallback LLM si Claude indisponible

**Stockage**
- Dev: `.env.local`
- Prod: Supabase Edge Function secrets
- Sensibilité: **Secret** — retirer `VITE_OPENAI_API_KEY`

**Où obtenir la clé**
1. [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Create new secret key
3. Format: `sk-proj-...` (nouveaux) ou `sk-...` (anciens)

**Pricing**: `text-embedding-3-small` = $0.02/1M tokens. GPT-4o ≈ $5/$15 per 1M tokens.

---

### 👁️ Google Cloud Vision — OCR documents PDF/images

| Champ | Valeur |
|---|---|
| **Priorité** | P0 — Critique |
| **URL** | `https://vision.googleapis.com/v1/projects/{id}/images:annotate` |
| **Auth** | Query param `?key=` (API Key) ou Service Account JSON |
| **SDK** | `@google-cloud/vision` v5.3.4 ✅ installé |
| **Status** | ✅ Opérationnel (Edge Function `google-vision-ocr`) |

**Variables d'environnement**
```bash
GOOGLE_CLOUD_API_KEY=AIzaSy...
GOOGLE_CLOUD_PROJECT_ID=torp-project-xxx
# OU (pour Service Account):
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"..."}
```

**Usage TORP**: OCR des devis BTP photographiés ou scannés avant analyse.

**Stockage**
- Dev: `.env.local` (API key) ou fichier JSON local
- Prod: Supabase Edge Function secrets (JSON encodé en string)
- Sensibilité: **Secret**

**Où obtenir les credentials**
1. [console.cloud.google.com](https://console.cloud.google.com)
2. APIs & Services → Enable "Cloud Vision API"
3. Credentials → Create Credentials → API Key (restreindre au Vision API)
4. OU: Service Accounts → Create → JSON key download

**Pricing**: 1000 premiers OCR/mois gratuits. $1.50/1000 images au-delà.

---

### 🗺️ BANO / BAN — Géocodage adresses françaises

| Champ | Valeur |
|---|---|
| **Priorité** | P0 — Critique |
| **URL** | `https://api-adresse.data.gouv.fr` |
| **Auth** | Aucune (open data gouvernemental) |
| **SDK** | Client custom `NominatimClient.ts` |
| **Status** | ✅ Implémenté |

**Variables d'environnement**
```bash
BANO_API_ENDPOINT=https://api-adresse.data.gouv.fr  # optionnel
```

**Endpoints**
- `GET /search/?q={adresse}&limit=1` → coordonnées GPS, INSEE commune
- `GET /reverse/?lon={lng}&lat={lat}` → adresse inverse

**Coût**: Gratuit. Hébergé par data.gouv.fr. Pas de clé requise.

**Rate limit**: Pas de limite officielle. Recommandation: max 50 req/s.

---

### 🗺️ Nominatim OSM — Géocodage fallback

| Champ | Valeur |
|---|---|
| **Priorité** | P1 — Important |
| **URL** | `https://nominatim.openstreetmap.org` |
| **Auth** | Aucune + header `User-Agent` obligatoire |
| **Status** | ✅ Implémenté (fallback BANO) |

**Variables d'environnement**
```bash
NOMINATIM_API_ENDPOINT=https://nominatim.openstreetmap.org  # optionnel
NOMINATIM_USER_AGENT=TORP/1.0 contact@torp.fr               # requis
```

**Rate limit**: **1 req/sec** — backoff 1200ms implémenté dans `NominatimClient.ts`.

---

### 🏗️ ADEME — Certifications RGE + données DPE

| Champ | Valeur |
|---|---|
| **Priorité** | P0 — Critique (pour devis travaux énergétiques) |
| **URL RGE** | `https://data.ademe.fr/data-fair/api/v1/datasets/liste-des-entreprises-rge-2/lines` |
| **URL DPE** | `https://data.ademe.fr/data-fair/api/v1/datasets` |
| **Auth** | Open data: aucune clé requise pour lecture |
| **Status** | ✅ Intégration active (rge.integration.ts + DataGouvClient.ts) |

**Variables d'environnement**
```bash
ADEME_RGE_API_KEY=           # optionnel — certains endpoints sont publics
ADEME_DPE_ENDPOINT=https://data.ademe.fr/data-fair/api/v1/datasets
```

**Usage TORP**: Vérification que l'entreprise est certifiée RGE pour devis isolation/chauffage/ENR. Requis pour éligibilité aides (MaPrimeRénov', CEE).

**Coût**: Gratuit (financement public).

**Où s'inscrire**: [data.ademe.fr](https://data.ademe.fr) — compte optionnel pour quota augmenté.

---

### 📜 Légifrance PISTE — Textes réglementaires

| Champ | Valeur |
|---|---|
| **Priorité** | P1 — Important |
| **URL** | `https://api.piste.gouv.fr` (prod) / `https://sandbox.piste.gouv.fr` (dev) |
| **Auth** | Bearer token OAuth2 (PISTE) |
| **Status** | ⚠️ Config présente, pas d'appels réels implémentés |

**Variables d'environnement**
```bash
LEGIFRANCE_API_KEY=votre_token_piste
LEGIFRANCE_API_ENDPOINT=https://sandbox.piste.gouv.fr  # dev
# Production:
# LEGIFRANCE_API_ENDPOINT=https://api.piste.gouv.fr
```

**Usage TORP**: Recherche normes DTU, règlements de construction, arrêtés préfectoraux applicables au projet.

**Où obtenir les credentials**
1. S'inscrire sur [piste.gouv.fr](https://piste.gouv.fr)
2. Créer une application → activer "API Légifrance"
3. Récupérer `client_id` + `client_secret` OAuth2
4. Token endpoint: `https://oauth.piste.gouv.fr/api/oauth/token`

**Coût**: Gratuit (service public).

**État actuel**: Le code pipeline (`ContextRegulationPipeline.ts`) vérifie `legifranceEnabled` avant d'appeler. Appels réels à implémenter en Phase 4.

---

### 🏛️ INSEE SIRENE — Validation SIRET officielle

| Champ | Valeur |
|---|---|
| **Priorité** | P1 — Important |
| **URL** | `https://api.insee.fr/api/sirene/V3/etablissements/{siret}` |
| **Auth** | Bearer token (optionnel — quotas plus élevés avec token) |
| **Status** | ✅ Service implémenté (`INSEEService.ts`) |

**Variables d'environnement**
```bash
INSEE_API_KEY=votre_token_insee   # optionnel
INSEE_API_URL=https://api.insee.fr
```

**Usage TORP**: Validation officielle du SIRET en complément Pappers. Données légales certifiées.

**Où obtenir la clé**
1. [api.insee.fr](https://api.insee.fr) → Inscription
2. Créer une application → Abonnement API SIRENE
3. OAuth2: récupérer token via `client_credentials`

**Rate limit**: 30 req/min sans clé, 1000 req/min avec clé.
**Coût**: Gratuit (service public).

---

### 🗺️ IGN Géoportail — Cadastre + PLU

| Champ | Valeur |
|---|---|
| **Priorité** | P1 — Important |
| **URL WFS** | `https://wxs.ign.fr/{key}/geoportail/wfs` |
| **URL PLU** | `https://www.geoportail-urbanisme.gouv.fr/api/feature-info` (public) |
| **Auth** | Clé API dans le path URL pour WFS; PLU sans clé |
| **Status** | ✅ Client implémenté (`IGNClient.ts`) |

**Variables d'environnement**
```bash
IGN_API_KEY=votre_cle_ign
IGN_GEOPORTAIL_ENDPOINT=https://wxs.ign.fr  # optionnel
```

**Usage TORP**: Localisation parcelle cadastrale, plan local d'urbanisme (zones constructibles, contraintes ABF).

**Où obtenir la clé**
1. [geoservices.ign.fr](https://geoservices.ign.fr) → Espace pro → Créer un compte
2. Créer un projet → Activer "WFS Géoportail"
3. Copier la clé API générée

**Coût**: Gratuit pour usage non-commercial / faible volume.

---

### 🌐 Data.gouv.fr — Open data RGE, Qualiopi, BODACC

| Champ | Valeur |
|---|---|
| **Priorité** | P1 — Important |
| **URL** | `https://data.opendatasoft.com/api/v2/catalog/datasets` |
| **Auth** | Aucune (open data) |
| **Status** | ✅ Client implémenté (`DataGouvClient.ts`) |

**Variables d'environnement**: Aucune requise.

**Datasets utilisés**
- RGE certifications: `liste-des-entreprises-rge-2`
- Qualiopi: formation professionnelle
- BODACC: annonces légales entreprises

**Coût**: Gratuit. Cache 30 jours implémenté.

---

### ⭐ Trustpilot — Avis et réputation entreprise

| Champ | Valeur |
|---|---|
| **Priorité** | P2 — Optionnel |
| **URL** | `https://api.trustpilot.com/v1` |
| **Auth** | Bearer token |
| **Status** | ✅ Client implémenté (`TrustpilotClient.ts`) |

**Variables d'environnement**
```bash
TRUSTPILOT_API_KEY=votre_token
TRUSTPILOT_API_ENDPOINT=https://api.trustpilot.com/v1  # optionnel
```

**Coût**: API B2B payante. Tarification sur demande. Cache 30 jours implémenté.

---

### 📧 Resend — Email transactionnel

| Champ | Valeur |
|---|---|
| **Priorité** | P1 — Important |
| **URL** | `https://api.resend.com/emails` |
| **Auth** | Bearer `re_...` |
| **SDK** | `resend` v6.5.2 ✅ installé |
| **Status** | ⚠️ Package installé, pas encore configuré |

**Variables d'environnement**
```bash
RESEND_API_KEY=re_xxxx
RESEND_FROM_EMAIL=noreply@torp.fr
```

**Usage TORP**: Notifications email (résultats d'analyse, alertes admin, résumés quotidiens).

**Où obtenir la clé**
1. [resend.com](https://resend.com) → Signup
2. API Keys → Create API Key
3. Vérifier le domaine `torp.fr` dans DNS

**Pricing**: 3000 emails/mois gratuits. $20/mois pour 50k emails.

---

### 💬 Slack — Notifications système

| Champ | Valeur |
|---|---|
| **Priorité** | P2 — Optionnel |
| **Status** | ❌ Non implémenté |

**Variables d'environnement**
```bash
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/T.../B.../xxx
SLACK_BOT_TOKEN=xoxb-...  # si Slack App complète
```

**Où obtenir**
1. [api.slack.com/apps](https://api.slack.com/apps) → Create New App
2. Incoming Webhooks → Activate → Add to channel
3. Copier l'URL de webhook

---

### 🪲 Sentry — Error tracking

| Champ | Valeur |
|---|---|
| **Priorité** | P1 — Important (production) |
| **Status** | ❌ Non implémenté (variable `VITE_SENTRY_DSN` déclarée mais vide) |

**Variables d'environnement**
```bash
VITE_SENTRY_DSN=https://xxx@oXXXXX.ingest.sentry.io/YYYYYYY
SENTRY_AUTH_TOKEN=sntrys_...  # pour source maps upload
SENTRY_ORG=torp
SENTRY_PROJECT=torp-frontend
```

**NPM à installer**
```bash
pnpm add @sentry/react @sentry/tracing
```

---

### 💳 Stripe — Paiements (Phase 5)

| Champ | Valeur |
|---|---|
| **Priorité** | P2 — Futur (Phase 5) |
| **Status** | ⚠️ Feature flag désactivé (`VITE_STRIPE_ENABLED=false`) |

**Variables d'environnement**
```bash
VITE_STRIPE_PUBLIC_KEY=pk_test_...   # frontend uniquement
STRIPE_SECRET_KEY=sk_test_...        # backend uniquement — jamais dans VITE_
STRIPE_WEBHOOK_SECRET=whsec_...      # validation webhooks
```

---

## Part 3 — Variables d'environnement complètes

### `.env.local` — Développement local

```bash
# ════════════════════════════════════════════════════════
# TORP — .env.local (local development)
# ════════════════════════════════════════════════════════
# NE PAS COMMITTER — ajouté dans .gitignore

# ── APP ─────────────────────────────────────────────────
VITE_APP_NAME=TORP
VITE_APP_ENV=development
VITE_APP_VERSION=1.0.0
VITE_API_BASE_URL=http://localhost:3001/api
VITE_API_TIMEOUT=30000
VITE_DEBUG_MODE=true

# ── SUPABASE ─────────────────────────────────────────────
VITE_SUPABASE_URL=https://iixxzfgexmiofvmfrnuy.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
# Serveur uniquement (Express server + Edge Functions):
SUPABASE_URL=https://iixxzfgexmiofvmfrnuy.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# ── ANTHROPIC CLAUDE (SERVEUR UNIQUEMENT) ─────────────────
# ⚠️ Ne JAMAIS mettre en VITE_ — exposé dans le bundle
ANTHROPIC_API_KEY=sk-ant-api03-...
CLAUDE_API_KEY=sk-ant-api03-...  # alias accepté dans certains modules

# ── OPENAI (SERVEUR UNIQUEMENT) ───────────────────────────
# ⚠️ Ne JAMAIS mettre en VITE_ — exposé dans le bundle
OPENAI_API_KEY=sk-proj-...

# ── GOOGLE CLOUD ─────────────────────────────────────────
GOOGLE_CLOUD_PROJECT_ID=torp-project-xxx
GOOGLE_CLOUD_API_KEY=AIzaSy...
# Ou Service Account (format JSON stringifié):
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"..."}

# ── PAPPERS ──────────────────────────────────────────────
PAPPERS_API_KEY=votre_token_pappers
PAPPERS_API_ENDPOINT=https://api.pappers.fr/v2

# ── LÉGIFRANCE (PISTE) ────────────────────────────────────
LEGIFRANCE_API_KEY=votre_token_piste
LEGIFRANCE_API_ENDPOINT=https://sandbox.piste.gouv.fr

# ── INSEE ────────────────────────────────────────────────
INSEE_API_KEY=votre_token_insee
INSEE_API_URL=https://api.insee.fr

# ── ADEME ────────────────────────────────────────────────
ADEME_RGE_API_KEY=         # optionnel (open data accessible sans clé)
ADEME_DPE_ENDPOINT=https://data.ademe.fr/data-fair/api/v1/datasets

# ── IGN ──────────────────────────────────────────────────
IGN_API_KEY=votre_cle_ign
IGN_GEOPORTAIL_ENDPOINT=https://wxs.ign.fr

# ── GEOCODING ────────────────────────────────────────────
BANO_API_ENDPOINT=https://api-adresse.data.gouv.fr
NOMINATIM_API_ENDPOINT=https://nominatim.openstreetmap.org
NOMINATIM_USER_AGENT=TORP/1.0 contact@torp.fr

# ── DATAGOUV (open data) ─────────────────────────────────
DATAGOUV_API_ENDPOINT=https://data.opendatasoft.com/api/v2

# ── EMAIL (RESEND) ────────────────────────────────────────
RESEND_API_KEY=re_xxxx
RESEND_FROM_EMAIL=noreply@torp.fr

# ── TRUSTPILOT ───────────────────────────────────────────
TRUSTPILOT_API_KEY=votre_token_trustpilot
TRUSTPILOT_API_ENDPOINT=https://api.trustpilot.com/v1

# ── SLACK ────────────────────────────────────────────────
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/T.../B.../xxx

# ── SENTRY ───────────────────────────────────────────────
VITE_SENTRY_DSN=https://xxx@oXXXX.ingest.sentry.io/YYYY

# ── STRIPE (désactivé) ───────────────────────────────────
VITE_STRIPE_ENABLED=false
VITE_STRIPE_PUBLIC_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# ── EXPRESS SERVER ────────────────────────────────────────
PORT=3001
NODE_ENV=development
PUBLIC_BASE_URL=http://localhost:5173
CLIENT_URL=http://localhost:5173
JWT_SECRET=dev_secret_change_in_production
JWT_TOKEN_EXPIRY_SECONDS=86400
PIPELINE_JWT_SECRET=dev_pipeline_secret
PIPELINE_TIMEOUT_MS=120000
API_CALL_TIMEOUT_MS=30000

# ── CACHE TTL (en jours) ──────────────────────────────────
CACHE_TTL_ENTREPRISE_DAYS=7
CACHE_TTL_CERTIFICATIONS_DAYS=30
CACHE_TTL_REPUTATION_HOURS=168
CACHE_TTL_PLU_DAYS=30
CACHE_TTL_ABF_DAYS=90
CACHE_TTL_AIDES_DAYS=14

# ── FEATURE FLAGS ─────────────────────────────────────────
VITE_FREE_MODE=true
VITE_DEFAULT_CREDITS=999999
VITE_FEATURE_PAYMENT_ENABLED=false
VITE_FEATURE_CHAT_AI_ENABLED=true
VITE_FEATURE_ANALYTICS_ENABLED=true
VITE_AI_PRIMARY_PROVIDER=claude
VITE_AI_FALLBACK_ENABLED=true

# ── N8N ──────────────────────────────────────────────────
N8N_WEBHOOK_SECRET=votre_secret_n8n
```

### Matrice de stockage par credential

| Variable | Local Dev | Vercel Prod | Supabase Secrets | Sensibilité |
|---|---|---|---|---|
| `VITE_SUPABASE_URL` | `.env.local` | Vercel env | — | Public |
| `VITE_SUPABASE_ANON_KEY` | `.env.local` | Vercel env | — | Public |
| `SUPABASE_SERVICE_ROLE_KEY` | `.env.local` | Vercel env | ✅ Edge secrets | **🔴 Secret** |
| `ANTHROPIC_API_KEY` | `.env.local` | Vercel env | ✅ Edge secrets | **🔴 Secret** |
| `OPENAI_API_KEY` | `.env.local` | Vercel env | ✅ Edge secrets | **🔴 Secret** |
| `GOOGLE_CLOUD_API_KEY` | `.env.local` | Vercel env | ✅ Edge secrets | **🔴 Secret** |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | `.env.local` | Vercel env | ✅ Edge secrets | **🔴 Secret** |
| `PAPPERS_API_KEY` | `.env.local` | Vercel env | ✅ Edge secrets | **🔴 Secret** |
| `LEGIFRANCE_API_KEY` | `.env.local` | Vercel env | ✅ Edge secrets | 🟡 Secret |
| `INSEE_API_KEY` | `.env.local` | Vercel env | — | 🟡 Semi-public |
| `ADEME_RGE_API_KEY` | `.env.local` | Vercel env | — | 🟢 Optionnel |
| `IGN_API_KEY` | `.env.local` | Vercel env | — | 🟡 Secret |
| `RESEND_API_KEY` | `.env.local` | Vercel env | ✅ Edge secrets | **🔴 Secret** |
| `SLACK_WEBHOOK_URL` | `.env.local` | Vercel env | — | 🟡 Secret |
| `VITE_SENTRY_DSN` | `.env.local` | Vercel env | — | 🟢 Public |
| `STRIPE_SECRET_KEY` | `.env.local` | Vercel env | — | **🔴 Secret** |
| `VITE_STRIPE_PUBLIC_KEY` | `.env.local` | Vercel env | — | 🟢 Public |
| `JWT_SECRET` | `.env.local` | Vercel env | — | **🔴 Secret** |
| `N8N_WEBHOOK_SECRET` | `.env.local` | Vercel env | ✅ Edge secrets | **🔴 Secret** |

---

## Part 4 — Guide de setup par source P0/P1

### Pappers

```bash
# 1. Créer un compte
# → https://www.pappers.fr/api
# → Sign up → Dashboard → API Keys

# 2. Tester
curl "https://api.pappers.fr/v2/entreprise?siret=80295478500018&api_token=VOTRE_KEY"

# 3. Configurer
echo "PAPPERS_API_KEY=votre_token" >> .env.local
```

**Rate limits**: ~100 req/mois gratuits. Voir [pricing Pappers](https://www.pappers.fr/api/pricing).

### Anthropic Claude

```bash
# 1. Créer un compte
# → https://console.anthropic.com/settings/keys
# → Create Key → Copy sk-ant-api03-...

# 2. Tester
curl -X POST https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "Content-Type: application/json" \
  -d '{"model":"claude-haiku-4-5-20251001","max_tokens":100,"messages":[{"role":"user","content":"Hello"}]}'

# 3. Configurer
echo "ANTHROPIC_API_KEY=sk-ant-api03-..." >> .env.local
# ⚠️ Ajouter aussi dans Supabase → Project Settings → Edge Functions → Secrets
```

### OpenAI

```bash
# 1. Créer une clé
# → https://platform.openai.com/api-keys → Create new secret key

# 2. Tester
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"

# 3. Configurer
echo "OPENAI_API_KEY=sk-proj-..." >> .env.local
```

### Google Vision

```bash
# 1. Activer l'API
# → https://console.cloud.google.com
# → APIs & Services → Enable APIs → "Cloud Vision API"
# → Credentials → Create Credentials → API Key

# 2. Restreindre la clé
# → API restrictions → Restrict to "Cloud Vision API"

# 3. Tester
curl -X POST \
  "https://vision.googleapis.com/v1/images:annotate?key=$GOOGLE_CLOUD_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"requests":[{"image":{"source":{"imageUri":"https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/PNG_transparency_demonstration_1.png/280px-PNG_transparency_demonstration_1.png"}},"features":[{"type":"TEXT_DETECTION"}]}]}'

# 4. Configurer
echo "GOOGLE_CLOUD_API_KEY=AIzaSy..." >> .env.local
echo "GOOGLE_CLOUD_PROJECT_ID=torp-project-xxx" >> .env.local
```

### Légifrance PISTE

```bash
# 1. Inscription
# → https://piste.gouv.fr → Créer un compte

# 2. Créer une application
# → Mes applications → Nouvelle application
# → Activer "Légifrance" API
# → Récupérer client_id et client_secret

# 3. Obtenir un token OAuth2
curl -X POST https://oauth.piste.gouv.fr/api/oauth/token \
  -d "grant_type=client_credentials&client_id=YOUR_ID&client_secret=YOUR_SECRET&scope=openid"

# 4. Tester (avec le token récupéré)
curl "https://sandbox.piste.gouv.fr/dila/legifrance/lf-engine-app/consult/getArticle?id=LEGIARTI000006353783" \
  -H "Authorization: Bearer $LEGIFRANCE_TOKEN"

# 5. Configurer
echo "LEGIFRANCE_API_KEY=votre_token" >> .env.local
echo "LEGIFRANCE_API_ENDPOINT=https://sandbox.piste.gouv.fr" >> .env.local
```

### Resend (Email)

```bash
# 1. Créer un compte
# → https://resend.com → Signup

# 2. Vérifier le domaine torp.fr
# → Domains → Add Domain → ajouter les enregistrements DNS TXT/MX

# 3. Créer une clé API
# → API Keys → Create API Key

# 4. Tester
curl -X POST https://api.resend.com/emails \
  -H "Authorization: Bearer $RESEND_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"from":"noreply@torp.fr","to":["test@example.com"],"subject":"Test TORP","html":"<p>Test</p>"}'

# 5. Configurer
echo "RESEND_API_KEY=re_xxxx" >> .env.local
echo "RESEND_FROM_EMAIL=noreply@torp.fr" >> .env.local
```

### INSEE SIRENE

```bash
# 1. Inscription (optionnel mais recommandé)
# → https://api.insee.fr → Inscription → Abonnement API SIRENE

# 2. Tester sans clé (quotas limités)
curl "https://api.insee.fr/api/sirene/V3/etablissements/80295478500018" \
  -H "Accept: application/json"

# 3. Tester avec clé
curl "https://api.insee.fr/api/sirene/V3/etablissements/80295478500018" \
  -H "Authorization: Bearer $INSEE_API_KEY" \
  -H "Accept: application/json"

# 4. Configurer
echo "INSEE_API_KEY=votre_token" >> .env.local
```

---

## Part 5 — NPM Packages

### Déjà installés ✅

```
@anthropic-ai/sdk    ^0.70.0   — Claude API
@google-cloud/vision ^5.3.4    — Google Vision OCR
@supabase/supabase-js ^2.81.1  — Supabase client
openai               ^6.9.1    — OpenAI API
resend               ^6.5.2    — Email transactionnel
```

### À installer selon les besoins

```bash
# Sentry (error tracking) — P1 production
pnpm add @sentry/react @sentry/tracing

# Slack (notifications système) — P2
pnpm add @slack/webhook @slack/web-api

# Stripe (paiements Phase 5) — P2
pnpm add stripe
# Frontend uniquement (déjà géré par VITE_STRIPE_PUBLIC_KEY + fetch):
pnpm add @stripe/stripe-js @stripe/react-stripe-js
```

### Packages déjà disponibles sans installation

| API | Package | Note |
|---|---|---|
| BANO/BAN | `fetch` natif | Endpoint REST simple |
| Nominatim | `fetch` natif | Client custom dans codebase |
| IGN WFS | `fetch` natif | Client custom dans codebase |
| ADEME RGE | `fetch` natif | Client custom dans codebase |
| Légifrance | `fetch` natif | Intégration via `Authorization` header |
| INSEE SIRENE | `fetch` natif | Client custom dans codebase |
| Trustpilot | `fetch` natif | Client custom dans codebase |
| Data.gouv.fr | `fetch` natif | Client custom dans codebase |

---

## Part 6 — Priorités et plan d'action

### P0 — Critique (opérationnel maintenant)

| Action | Source | Effort |
|---|---|---|
| ✅ Déjà fait | Supabase, Claude, OpenAI, Google Vision | — |
| ✅ Déjà fait | Pappers, BANO, IGN, ADEME RGE, INSEE | — |
| 🔧 Sécurité: retirer `VITE_OPENAI_API_KEY` et `VITE_ANTHROPIC_API_KEY` | — | 30 min |
| 🔧 Configurer `RESEND_API_KEY` + vérifier domaine torp.fr | Resend | 1h |

### P1 — Important (à faire)

| Action | Source | Effort |
|---|---|---|
| 🔧 Implémenter appels réels Légifrance (actuellement stub) | Légifrance PISTE | 2-4h |
| 🔧 Configurer Sentry DSN + initialiser dans `main.tsx` | Sentry | 1h |
| 🔧 Configurer `NOMINATIM_USER_AGENT` avec email réel | Nominatim | 15 min |
| 🔧 Ajouter `N8N_WEBHOOK_SECRET` à Supabase Edge Secrets | n8n | 15 min |

### P2 — Optionnel

| Action | Source | Effort |
|---|---|---|
| 📋 Configurer Slack webhook pour alertes orchestration | Slack | 1h |
| 📋 Implémenter Stripe (Phase 5, `VITE_STRIPE_ENABLED=true`) | Stripe | 4-8h |
| 📋 Activer Trustpilot pour enrichissement réputation | Trustpilot | 2h |

---

## Part 7 — Supabase Edge Function secrets

Ces variables DOIVENT être configurées dans **Supabase → Project Settings → Edge Functions → Secrets** :

```
SUPABASE_URL               ← déjà auto-injecté par Supabase
SUPABASE_SERVICE_ROLE_KEY  ← déjà auto-injecté par Supabase
ANTHROPIC_API_KEY
CLAUDE_API_KEY             (alias)
OPENAI_API_KEY
GOOGLE_CLOUD_API_KEY
GOOGLE_CLOUD_PROJECT_ID
PAPPERS_API_KEY
N8N_WEBHOOK_SECRET
API_ENTREPRISE_TOKEN       (si utilisé)
API_ENTREPRISE_RECIPIENT   (si utilisé)
```

**Comment configurer** :
```bash
# Via Supabase CLI:
supabase secrets set ANTHROPIC_API_KEY=sk-ant-api03-...
supabase secrets set OPENAI_API_KEY=sk-proj-...
supabase secrets set PAPPERS_API_KEY=...
```

Ou via [Supabase Dashboard](https://supabase.com/dashboard/project/_/settings/functions) → Settings → Edge Functions → Add secret.
