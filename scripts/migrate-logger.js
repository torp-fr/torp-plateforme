#!/usr/bin/env node

/**
 * Automated logger migration script
 * Replaces console.log/warn with centralized logger
 * Removes noisy logs from production
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

const LOGGER_IMPORT = "import { log, warn, error, time, timeEnd } from '@/lib/logger';";

// Patterns to completely remove (noisy logs)
const REMOVE_PATTERNS = [
  /console\.log\s*\(\s*['"`]\[RAG COMMAND CENTER\]/,
  /console\.log\s*\(\s*['"`]\[EmbeddingQueue\]/,
  /console\.log\s*\(\s*['"`]\[RAGStatus\]/,
  /console\.log\s*\(\s*['"`]\[Heartbeat\]/,
  /console\.log\s*\(\s*['"`]\[AI_TELEMETRY\]/,
  /console\.log\s*\(\s*['"`]\[STREAMING\]/,
  /console\.log\s*\(\s*['"`]\[CHUNKING\]/,
  /console\.log\s*\(\s*['"`]\[EMBEDDING\]/,
];

function processFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf-8');
    const originalContent = content;

    // Check if file already has logger import
    const hasLoggerImport = content.includes("from '@/lib/logger'");

    // Remove noisy log statements entirely
    REMOVE_PATTERNS.forEach(pattern => {
      const regex = new RegExp(`\\s*console\\.log\\s*\\(\\s*['"\`]\\[.*?\\][^)]*\\);?\\s*`, 'gm');
      content = content.replace(regex, '');
    });

    // Replace console.log with log (but not console.error)
    content = content.replace(/console\.log\(/g, 'log(');

    // Replace console.warn with warn
    content = content.replace(/console\.warn\(/g, 'warn(');

    // Replace console.time with time
    content = content.replace(/console\.time\(/g, 'time(');

    // Replace console.timeEnd with timeEnd
    content = content.replace(/console\.timeEnd\(/g, 'timeEnd(');

    // Add logger import if not present and we made changes
    if (!hasLoggerImport && (content !== originalContent)) {
      // Find the last import statement
      const lastImportMatch = content.match(/^import .*?;/gm);
      if (lastImportMatch) {
        const lastImportIndex = content.lastIndexOf(lastImportMatch[lastImportMatch.length - 1]);
        const insertPos = lastImportIndex + lastImportMatch[lastImportMatch.length - 1].length;
        content = content.slice(0, insertPos) + '\n' + LOGGER_IMPORT + content.slice(insertPos);
      } else {
        // No imports found, add at top
        content = LOGGER_IMPORT + '\n\n' + content;
      }
    }

    // Write back if changed
    if (content !== originalContent) {
      fs.writeFileSync(filePath, content, 'utf-8');
      return true;
    }
    return false;
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
    return false;
  }
}

function main() {
  const pattern = path.join(__dirname, '../src/**/*.{ts,tsx}');
  const files = glob.sync(pattern);

  let processed = 0;
  let modified = 0;

  console.log(`Processing ${files.length} files...`);

  files.forEach(file => {
    if (processFile(file)) {
      modified++;
      console.log(`✓ Modified: ${file}`);
    }
    processed++;
  });

  console.log(`\n✅ Done! Processed: ${processed}, Modified: ${modified}`);
}

main();
