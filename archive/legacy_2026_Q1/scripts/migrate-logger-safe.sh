#!/bin/bash

# Safe Logger Migration - Handles one file at a time
# Usage: ./scripts/migrate-logger-safe.sh

LOGGER_IMPORT="import { log, warn, error, time, timeEnd } from '@/lib/logger';"
SRC_DIR="src"

processed=0
modified=0
removed=0

# Temporary file for processing
TEMP_FILE=$(mktemp)
trap "rm -f $TEMP_FILE" EXIT

echo "🔄 Starting safe logger migration..."
echo ""

# Process each file
find "$SRC_DIR" -type f \( -name "*.ts" -o -name "*.tsx" \) | while read -r file; do
  ((processed++))

  # Skip files that already have logger import
  if grep -q "@/lib/logger" "$file" 2>/dev/null; then
    continue
  fi

  # Check if file has console statements
  if ! grep -q "console\.log\|console\.warn\|console\.time" "$file" 2>/dev/null; then
    continue
  fi

  cp "$file" "$TEMP_FILE"

  # Remove specific noisy logs (complete lines)
  sed -i.tmp '/\[RAG COMMAND CENTER\].*console\.log/d' "$file"
  sed -i.tmp '/\[EmbeddingQueue\].*console\.log/d' "$file"
  sed -i.tmp '/\[RAGStatus\].*console\.log/d' "$file"
  sed -i.tmp '/\[Heartbeat\].*console\.log/d' "$file"
  sed -i.tmp '/\[AI_TELEMETRY\].*console\.log/d' "$file"
  sed -i.tmp '/\[STREAMING\].*console\.log/d' "$file"
  sed -i.tmp '/\[CHUNKING\].*console\.log/d' "$file"
  sed -i.tmp '/\[EMBEDDING\].*console\.log/d' "$file"
  rm -f "${file}.tmp"

  # Replace console methods
  sed -i 's/console\.log(/log(/g' "$file"
  sed -i 's/console\.warn(/warn(/g' "$file"
  sed -i 's/console\.time(/time(/g' "$file"
  sed -i 's/console\.timeEnd(/timeEnd(/g' "$file"

  # Check if file was modified
  if ! diff -q "$TEMP_FILE" "$file" > /dev/null 2>&1; then
    # Add logger import
    if ! grep -q "from '@/lib/logger'" "$file"; then
      # Find position after last import
      last_import=$(grep -n "^import " "$file" | tail -1 | cut -d: -f1)

      if [ -n "$last_import" ]; then
        sed -i "${last_import}a\\${LOGGER_IMPORT}" "$file"
      else
        sed -i "1i\\${LOGGER_IMPORT}\n" "$file"
      fi
    fi

    ((modified++))
    echo "✓ $(basename $file)"
  fi
done

echo ""
echo "📊 Migration Summary:"
echo "   Processed: $processed files"
echo "   Modified: $modified files"
echo ""
echo "✅ Next steps:"
echo "   1. Review changes: git diff"
echo "   2. Build: npm run build"
echo "   3. Test: npm run preview"
echo "   4. Check console in DEV and PROD modes"
