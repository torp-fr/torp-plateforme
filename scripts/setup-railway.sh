#!/bin/bash
# ─────────────────────────────────────────────────────────────────────
# setup-railway.sh — Configure Railway environment variables
# Prerequisites:
#   1. Install Railway CLI: npm i -g @railway/cli
#   2. Login: railway login
#   3. Link project: railway link
# Run: bash scripts/setup-railway.sh
# ─────────────────────────────────────────────────────────────────────

set -e

echo "=== TORP Railway Setup ==="
echo ""

# Check railway CLI
if ! command -v railway &> /dev/null; then
  echo "ERROR: Railway CLI not found. Install with: npm i -g @railway/cli"
  exit 1
fi

echo "Setting environment variables..."

# ─── Required ───────────────────────────────────────────────────────
railway variables set SUPABASE_URL="${SUPABASE_URL:?SUPABASE_URL is required}"
railway variables set SUPABASE_SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY:?SUPABASE_SERVICE_ROLE_KEY is required}"
railway variables set PUBLIC_BASE_URL="${PUBLIC_BASE_URL:-https://torp.fr}"
railway variables set PIPELINE_JWT_SECRET="${PIPELINE_JWT_SECRET:-$(openssl rand -hex 32)}"

# ─── API Keys ────────────────────────────────────────────────────────
if [ -n "$PAPPERS_API_KEY" ]; then
  railway variables set PAPPERS_API_KEY="$PAPPERS_API_KEY"
  echo "  ✓ PAPPERS_API_KEY"
fi

if [ -n "$IGN_API_KEY" ]; then
  railway variables set IGN_API_KEY="$IGN_API_KEY"
  echo "  ✓ IGN_API_KEY"
fi

if [ -n "$LEGIFRANCE_API_KEY" ]; then
  railway variables set LEGIFRANCE_API_KEY="$LEGIFRANCE_API_KEY"
  echo "  ✓ LEGIFRANCE_API_KEY"
fi

if [ -n "$GOOGLE_PLACES_API_KEY" ]; then
  railway variables set GOOGLE_PLACES_API_KEY="$GOOGLE_PLACES_API_KEY"
  echo "  ✓ GOOGLE_PLACES_API_KEY"
fi

if [ -n "$GOOGLE_VISION_API_KEY" ]; then
  railway variables set GOOGLE_VISION_API_KEY="$GOOGLE_VISION_API_KEY"
  echo "  ✓ GOOGLE_VISION_API_KEY"
fi

if [ -n "$TRUSTPILOT_API_KEY" ]; then
  railway variables set TRUSTPILOT_API_KEY="$TRUSTPILOT_API_KEY"
  echo "  ✓ TRUSTPILOT_API_KEY"
fi

# ─── Pipeline config ─────────────────────────────────────────────────
railway variables set PIPELINE_TIMEOUT_MS="${PIPELINE_TIMEOUT_MS:-30000}"
railway variables set API_CALL_TIMEOUT_MS="${API_CALL_TIMEOUT_MS:-5000}"
railway variables set RETRY_MAX_ATTEMPTS="${RETRY_MAX_ATTEMPTS:-3}"
railway variables set RETRY_BACKOFF_MS="${RETRY_BACKOFF_MS:-1000}"
railway variables set TESSERACT_LANG="${TESSERACT_LANG:-fra}"
railway variables set STORAGE_BUCKET_DEVIS="${STORAGE_BUCKET_DEVIS:-devis_uploads}"
railway variables set STORAGE_BUCKET_QRCODES="${STORAGE_BUCKET_QRCODES:-qr_codes}"
railway variables set NODE_ENV="production"

echo ""
echo "=== Environment variables set ==="
echo ""
echo "Deploying to Railway..."
railway up

echo ""
echo "=== Deployment triggered ==="
echo "Monitor at: https://railway.app/dashboard"
