#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════════
# TORP — API Connectivity Test Suite
# ════════════════════════════════════════════════════════════════════════════
#
# Usage:
#   bash scripts/test-api-connectivity.sh [source]
#
# Sources:
#   bano | nominatim | insee | ademe | pappers | google | anthropic | openai
#   legifrance | ign | resend | supabase | all
#
# Examples:
#   bash scripts/test-api-connectivity.sh all
#   bash scripts/test-api-connectivity.sh pappers
#
# Requires: curl, jq
# ════════════════════════════════════════════════════════════════════════════

set -euo pipefail

# ── Load .env.local ──────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

if [ -f "$ROOT_DIR/.env.local" ]; then
  set -a
  # shellcheck disable=SC1091
  source <(grep -v '^#' "$ROOT_DIR/.env.local" | grep -v '^[[:space:]]*$')
  set +a
else
  echo "❌  .env.local not found. Copy .env.example → .env.local and fill credentials."
  exit 1
fi

# ── Colors ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# ── Counters ─────────────────────────────────────────────────────────────────
PASSED=0
FAILED=0
SKIPPED=0

pass()  { echo -e "${GREEN}  ✅  $1${NC}"; ((PASSED++));  }
fail()  { echo -e "${RED}  ❌  $1${NC}"; ((FAILED++));   }
warn()  { echo -e "${YELLOW}  ⚠️   $1${NC}"; ((SKIPPED++)); }
info()  { echo -e "${BLUE}  ℹ️   $1${NC}"; }

# ── Helper: HTTP status check ─────────────────────────────────────────────────
http_status() {
  curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$@"
}

json_field() {
  # $1 = URL, $2 = jq filter, rest = curl args
  local url="$1"; local filter="$2"; shift 2
  curl -s --max-time 10 "$@" "$url" | jq -r "$filter" 2>/dev/null || echo ""
}

# ════════════════════════════════════════════════════════════════════════════
# Test functions
# ════════════════════════════════════════════════════════════════════════════

test_bano() {
  echo ""
  echo "▸ BANO / Base Adresse Nationale (open data)"
  local name
  name=$(json_field "https://api-adresse.data.gouv.fr/search/?q=Paris&limit=1" '.features[0].properties.label')
  if [ -n "$name" ] && [ "$name" != "null" ]; then
    pass "BANO responding — found: $name"
  else
    fail "BANO API unreachable or returned empty result"
  fi
}

test_nominatim() {
  echo ""
  echo "▸ Nominatim / OpenStreetMap Geocoding (open data)"
  local name
  name=$(json_field "https://nominatim.openstreetmap.org/search?q=Paris+France&format=json&limit=1" '.[0].display_name' \
    -H "User-Agent: ${NOMINATIM_USER_AGENT:-TORP/1.0 contact@torp.fr}")
  if [ -n "$name" ] && [ "$name" != "null" ]; then
    pass "Nominatim responding — found: ${name:0:60}..."
  else
    fail "Nominatim API unreachable or rate-limited"
  fi
}

test_insee() {
  echo ""
  echo "▸ INSEE SIRENE (official SIRET validation)"
  local status
  # Test SIRET of BNP Paribas Paris — returns 200 or 404, both mean API is up
  status=$(http_status "https://api.insee.fr/api/sirene/V3.11/etablissements/33002222800023" \
    -H "Accept: application/json" \
    ${INSEE_API_KEY:+-H "Authorization: Bearer $INSEE_API_KEY"})
  if [ "$status" = "200" ] || [ "$status" = "404" ] || [ "$status" = "301" ]; then
    pass "INSEE SIRENE API responding (HTTP $status)"
  else
    fail "INSEE SIRENE API error (HTTP $status)"
  fi
}

test_ademe() {
  echo ""
  echo "▸ ADEME — RGE Certifications (open data)"
  local status
  status=$(http_status "https://data.ademe.fr/data-fair/api/v1/datasets/liste-des-entreprises-rge-2/lines?size=1")
  if [ "$status" = "200" ]; then
    pass "ADEME RGE API responding"
  else
    fail "ADEME RGE API error (HTTP $status)"
  fi
}

test_datagouv() {
  echo ""
  echo "▸ Data.gouv.fr (open data)"
  local status
  status=$(http_status "https://www.data.gouv.fr/api/1/datasets/?page_size=1")
  if [ "$status" = "200" ]; then
    pass "data.gouv.fr API responding"
  else
    fail "data.gouv.fr API error (HTTP $status)"
  fi
}

test_pappers() {
  echo ""
  echo "▸ Pappers — Company Data (SIRET lookup)"
  if [ -z "${PAPPERS_API_KEY:-}" ]; then
    warn "PAPPERS_API_KEY not set — skipping"
    return
  fi
  # Test with a known SIRET (La Poste SA)
  local response
  response=$(json_field "https://api.pappers.fr/v2/entreprise?siret=35600000059843&api_token=${PAPPERS_API_KEY}" '.siren')
  if [ -n "$response" ] && [ "$response" != "null" ]; then
    pass "Pappers API key valid — SIREN: $response"
  else
    local err
    err=$(curl -s --max-time 10 "https://api.pappers.fr/v2/entreprise?siret=35600000059843&api_token=${PAPPERS_API_KEY}" | jq -r '.message // .error // "unknown"')
    fail "Pappers API error: $err"
  fi
}

test_google_vision() {
  echo ""
  echo "▸ Google Cloud Vision (OCR)"
  if [ -z "${GOOGLE_CLOUD_API_KEY:-}" ] && [ -z "${GOOGLE_VISION_API_KEY:-}" ]; then
    warn "GOOGLE_CLOUD_API_KEY not set — skipping"
    return
  fi
  local key="${GOOGLE_CLOUD_API_KEY:-${GOOGLE_VISION_API_KEY}}"
  # A request with an intentionally minimal image — validates key, not image content
  local err_code
  err_code=$(curl -s --max-time 10 \
    -X POST "https://vision.googleapis.com/v1/images:annotate?key=${key}" \
    -H "Content-Type: application/json" \
    -d '{"requests":[{"image":{"content":"iVBORw0KGgo="},"features":[{"type":"LABEL_DETECTION","maxResults":1}]}]}' \
    | jq -r '.error.code // "ok"')
  if [ "$err_code" = "ok" ] || [ "$err_code" = "400" ]; then
    # 400 means key is valid but image is too small — that's expected
    pass "Google Cloud Vision API key valid"
  elif [ "$err_code" = "403" ]; then
    fail "Google Cloud Vision: API key rejected (403) — check key restrictions in GCP console"
  else
    fail "Google Cloud Vision error: HTTP code $err_code"
  fi
}

test_anthropic() {
  echo ""
  echo "▸ Anthropic Claude (LLM)"
  if [ -z "${ANTHROPIC_API_KEY:-}" ]; then
    warn "ANTHROPIC_API_KEY not set — skipping"
    return
  fi
  local err_type
  err_type=$(curl -s --max-time 15 \
    -X POST "https://api.anthropic.com/v1/messages" \
    -H "x-api-key: ${ANTHROPIC_API_KEY}" \
    -H "anthropic-version: 2023-06-01" \
    -H "Content-Type: application/json" \
    -d '{"model":"claude-haiku-4-5-20251001","max_tokens":10,"messages":[{"role":"user","content":"Hi"}]}' \
    | jq -r '.error.type // "ok"')
  if [ "$err_type" = "ok" ]; then
    pass "Anthropic Claude API key valid"
  elif [ "$err_type" = "authentication_error" ]; then
    fail "Anthropic: invalid API key"
  else
    fail "Anthropic error: $err_type"
  fi
}

test_openai() {
  echo ""
  echo "▸ OpenAI (Embeddings + LLM fallback)"
  if [ -z "${OPENAI_API_KEY:-}" ]; then
    warn "OPENAI_API_KEY not set — skipping"
    return
  fi
  local obj
  obj=$(json_field "https://api.openai.com/v1/models?limit=1" '.object' \
    -H "Authorization: Bearer ${OPENAI_API_KEY}")
  if [ "$obj" = "list" ]; then
    pass "OpenAI API key valid"
  else
    local err
    err=$(curl -s --max-time 10 "https://api.openai.com/v1/models?limit=1" \
      -H "Authorization: Bearer ${OPENAI_API_KEY}" | jq -r '.error.message // "unknown"')
    fail "OpenAI error: $err"
  fi
}

test_legifrance() {
  echo ""
  echo "▸ Légifrance PISTE (regulatory texts)"
  if [ -z "${LEGIFRANCE_API_KEY:-}" ]; then
    warn "LEGIFRANCE_API_KEY not set — skipping (P1 — not yet implemented)"
    return
  fi
  local endpoint="${LEGIFRANCE_API_ENDPOINT:-https://sandbox.piste.gouv.fr}"
  local status
  status=$(http_status "$endpoint/dila/legifrance/lf-engine-app/consult/getArticle?id=LEGIARTI000006353783" \
    -H "Authorization: Bearer ${LEGIFRANCE_API_KEY}")
  if [ "$status" = "200" ]; then
    pass "Légifrance PISTE API responding (sandbox)"
  elif [ "$status" = "401" ]; then
    fail "Légifrance: invalid token (401) — check PISTE OAuth credentials"
  else
    fail "Légifrance API error (HTTP $status)"
  fi
}

test_ign() {
  echo ""
  echo "▸ IGN Géoportail (cadastre, PLU)"
  if [ -z "${IGN_API_KEY:-}" ]; then
    warn "IGN_API_KEY not set — skipping"
    return
  fi
  # Test PLU endpoint (no key needed for public WMS)
  local status
  status=$(http_status "https://www.geoportail-urbanisme.gouv.fr/api/feature-info?lon=2.3522&lat=48.8566&format=json")
  if [ "$status" = "200" ] || [ "$status" = "404" ]; then
    pass "IGN Géoportail (PLU public endpoint) responding"
  else
    fail "IGN Géoportail API error (HTTP $status)"
  fi
}

test_resend() {
  echo ""
  echo "▸ Resend (email transactional)"
  if [ -z "${RESEND_API_KEY:-}" ]; then
    warn "RESEND_API_KEY not set — skipping"
    return
  fi
  # List domains to validate key without sending email
  local status
  status=$(http_status "https://api.resend.com/domains" \
    -H "Authorization: Bearer ${RESEND_API_KEY}")
  if [ "$status" = "200" ]; then
    pass "Resend API key valid"
  elif [ "$status" = "401" ]; then
    fail "Resend: invalid API key (401)"
  else
    fail "Resend API error (HTTP $status)"
  fi
}

test_supabase() {
  echo ""
  echo "▸ Supabase (database + auth)"
  if [ -z "${SUPABASE_URL:-}" ] || [ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]; then
    warn "SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set — skipping"
    return
  fi
  local status
  status=$(http_status "${SUPABASE_URL}/rest/v1/platform_settings?select=id&limit=1" \
    -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}")
  if [ "$status" = "200" ]; then
    pass "Supabase REST API responding (service role valid)"
  elif [ "$status" = "401" ]; then
    fail "Supabase: invalid service role key (401)"
  else
    fail "Supabase API error (HTTP $status)"
  fi
}

# ════════════════════════════════════════════════════════════════════════════
# Main
# ════════════════════════════════════════════════════════════════════════════

echo ""
echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║          TORP — API Connectivity Test Suite                    ║"
echo "╠══════════════════════════════════════════════════════════════════╣"
echo "║  Requires: curl, jq                                            ║"
echo "║  Source: .env.local                                            ║"
echo "╚══════════════════════════════════════════════════════════════════╝"

SOURCE="${1:-all}"

case "$SOURCE" in
  bano)       test_bano ;;
  nominatim)  test_nominatim ;;
  insee)      test_insee ;;
  ademe)      test_ademe ;;
  datagouv)   test_datagouv ;;
  pappers)    test_pappers ;;
  google)     test_google_vision ;;
  anthropic)  test_anthropic ;;
  openai)     test_openai ;;
  legifrance) test_legifrance ;;
  ign)        test_ign ;;
  resend)     test_resend ;;
  supabase)   test_supabase ;;
  all)
    test_supabase
    test_bano
    test_nominatim
    test_insee
    test_ademe
    test_datagouv
    test_pappers
    test_google_vision
    test_anthropic
    test_openai
    test_legifrance
    test_ign
    test_resend
    ;;
  *)
    echo "Usage: $0 [bano|nominatim|insee|ademe|datagouv|pappers|google|anthropic|openai|legifrance|ign|resend|supabase|all]"
    exit 1
    ;;
esac

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║                         Results                                ║"
echo "╠══════════════════════════════════════════════════════════════════╣"
printf "║  %-62s ║\n" "✅ Passed:  $PASSED"
printf "║  %-62s ║\n" "❌ Failed:  $FAILED"
printf "║  %-62s ║\n" "⚠️  Skipped: $SKIPPED (key not set)"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo ""

if [ "$FAILED" -gt 0 ]; then
  echo "Some tests failed. Check credentials in .env.local or see docs/API_SETUP.md"
  exit 1
fi
exit 0
