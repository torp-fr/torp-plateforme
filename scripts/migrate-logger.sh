#!/bin/bash

# Logger Migration Script
# Replaces console.log/warn with centralized logger

LOGGER_IMPORT="import { log, warn, error, time, timeEnd } from '@/lib/logger';"
SRC_DIR="src"

echo "=== Starting Logger Migration ==="
echo ""

# Find all TS/TSX files
files=$(find "$SRC_DIR" -type f \( -name "*.ts" -o -name "*.tsx" \) | grep -v node_modules)

modified=0
processed=0

for file in $files; do
  ((processed++))

  # Skip if already has logger import
  if grep -q "@/lib/logger" "$file"; then
    continue
  fi

  # Check if file has any console statements
  if ! grep -q "console\.log\|console\.warn\|console\.time" "$file"; then
    continue
  fi

  # Make a backup
  cp "$file" "${file}.bak"

  # Remove noisy logs completely (RAG, EmbeddingQueue, Heartbeat, AI_TELEMETRY)
  sed -i "/console\.log.*\[RAG COMMAND CENTER\]/d" "$file"
  sed -i "/console\.log.*\[EmbeddingQueue\]/d" "$file"
  sed -i "/console\.log.*\[RAGStatus\]/d" "$file"
  sed -i "/console\.log.*\[Heartbeat\]/d" "$file"
  sed -i "/console\.log.*\[AI_TELEMETRY\]/d" "$file"
  sed -i "/console\.log.*\[STREAMING\]/d" "$file"
  sed -i "/console\.log.*\[CHUNKING\]/d" "$file"
  sed -i "/console\.log.*\[EMBEDDING\]/d" "$file"

  # Replace console methods
  sed -i "s/console\.log(/log(/g" "$file"
  sed -i "s/console\.warn(/warn(/g" "$file"
  sed -i "s/console\.time(/time(/g" "$file"
  sed -i "s/console\.timeEnd(/timeEnd(/g" "$file"

  # Add logger import if file was modified
  if ! diff -q "$file" "${file}.bak" > /dev/null 2>&1; then
    # Find last import and insert after it
    import_line=$(grep -n "^import " "$file" | tail -1 | cut -d: -f1)

    if [ -n "$import_line" ]; then
      # Insert after last import
      sed -i "${import_line}a\\$LOGGER_IMPORT" "$file"
    else
      # No imports, add at top
      sed -i "1i\\$LOGGER_IMPORT\n" "$file"
    fi

    ((modified++))
    echo "✓ Modified: $file"

    # Clean up backup
    rm "${file}.bak"
  else
    rm "${file}.bak"
  fi
done

echo ""
echo "=== Migration Complete ==="
echo "Processed: $processed files"
echo "Modified: $modified files"
echo ""
echo "✅ Next steps:"
echo "1. Review changes with: git diff"
echo "2. Test build: npm run build"
echo "3. Check console in dev and prod modes"
