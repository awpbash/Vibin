#!/usr/bin/env bash
# Push relevant API keys from .env.local to Vercel.
#
# Skips: DATABASE_URL (auto-injected by Postgres integration),
#        BLOB_READ_WRITE_TOKEN (auto-injected when Blob is provisioned),
#        VERCEL_OIDC_TOKEN, POSTGRES_*, PG*, NEON_* (Vercel-managed),
#        GOOGLE_MAPS_API_KEY, NEXT_PUBLIC_GOOGLE_MAPS_API_KEY (no maps).
#
# For each key: removes the existing prod env var (if any) then re-adds
# with the value from .env.local. Idempotent — re-running is safe.
#
# Run from project root:
#   bash scripts/push-env.sh

set -u
cd "$(dirname "$0")/.."

ENV_FILE=".env.local"
if [ ! -f "$ENV_FILE" ]; then
  echo "no .env.local at $(pwd)/$ENV_FILE"; exit 1
fi

KEYS=(
  OPENAI_API_KEY
  OPENAI_VISION_MODEL
  OPENAI_EMBED_MODEL
  OPENAI_IMAGE_MODEL
  OPENAI_IMAGE_QUALITY
  VIBER_FRAME_FPS
  VIBER_FRAME_MAX_COUNT
  VIBER_FRAME_WIDTH
  VIBER_STILL_COUNT
  ELEVENLABS_API_KEY
  ELEVENLABS_VOICE_ID
  ELEVENLABS_MODEL_ID
  GEMINI_API_KEY
  VIBER_GEMINI_AUDIO_MODEL
  VIBER_GEMINI_IMAGE_MODEL
  VIBER_GEMINI_VEO_MODEL
  VIBER_GEMINI_LYRIA_MODEL
  VIBER_MUSIC_BACKEND
  VIBER_BRIDGE_CROSSFADE_SEC
  VIBER_BRIDGE_SFX
  VIBER_VIDEO_MODE
  FAL_API_KEY
  VIBER_VEO_MODEL
  VIBER_USE_VEO
  VIBER_VENUE_LAT
  VIBER_VENUE_LNG
  VIBER_VENUE_RADIUS_M
)

# Pick the right vercel binary. Prefer global, fall back to npx.
VERCEL=$(command -v vercel || true)
if [ -z "$VERCEL" ]; then VERCEL="npx vercel"; fi

ENV_TARGET="${ENV_TARGET:-production}"
echo "Pushing env vars to: $ENV_TARGET"
echo ""

pushed=0
skipped=0
failed=0

for key in "${KEYS[@]}"; do
  # Grab value from the FIRST occurrence of KEY= in .env.local.
  raw=$(grep -m 1 -E "^${key}=" "$ENV_FILE" || true)
  if [ -z "$raw" ]; then
    printf "  %-30s (not in .env.local, skipping)\n" "$key"
    skipped=$((skipped+1))
    continue
  fi
  value="${raw#*=}"
  # Strip optional surrounding quotes.
  value="${value#\"}"; value="${value%\"}"
  value="${value#\'}"; value="${value%\'}"
  if [ -z "$value" ]; then
    printf "  %-30s (empty, skipping)\n" "$key"
    skipped=$((skipped+1))
    continue
  fi

  # Remove any existing prod entry so the add succeeds. -y suppresses
  # the confirm prompt. Stderr swallowed because not-found is fine.
  $VERCEL env rm "$key" "$ENV_TARGET" -y >/dev/null 2>&1 || true

  if printf "%s" "$value" | $VERCEL env add "$key" "$ENV_TARGET" >/dev/null 2>&1; then
    printf "  %-30s ✓\n" "$key"
    pushed=$((pushed+1))
  else
    printf "  %-30s ✗ failed\n" "$key"
    failed=$((failed+1))
  fi
done

echo ""
echo "Pushed: $pushed   Skipped: $skipped   Failed: $failed"
echo ""
echo "Next: vercel --prod"
