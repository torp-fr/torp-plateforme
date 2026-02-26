#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOGGER_IMPORT = "import { log, warn, error, time, timeEnd } from '@/lib/logger';";

// Noisy log patterns to completely remove
const NOISY_PATTERNS = [
  /.*console\.log\s*\(\s*['"`]\[RAG COMMAND CENTER\].*?\);?[\n]*/,
  /.*console\.log\s*\(\s*['"`]\[EmbeddingQueue\].*?\);?[\n]*/,
  /.*console\.log\s*\(\s*['"`]\[RAGStatus\].*?\);?[\n]*/,
  /.*console\.log\s*\(\s*['"`]\[Heartbeat\].*?\);?[\n]*/,
  /.*console\.log\s*\(\s*['"`]\[AI_TELEMETRY\].*?\);?[\n]*/,
  /.*console\.log\s*\(\s*['"`]\[STREAMING\].*?\);?[\n]*/,
  /.*console\.log\s*\(\s*['"`]\[CHUNKING\].*?\);?[\n]*/,
  /.*console\.log\s*\(\s*['"`]\[EMBEDDING\].*?\);?[\n]*/,
];

async function processFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf-8');
    const originalContent = content;

    // Check if already has logger import
    const hasLoggerImport = content.includes("from '@/lib/logger'");

    // Remove noisy logs
    NOISY_PATTERNS.forEach(pattern => {
      content = content.replace(pattern, '');
    });

    // Replace console methods
    content = content.replace(/console\.log\(/g, 'log(');
    content = content.replace(/console\.warn\(/g, 'warn(');
    content = content.replace(/console\.time\(/g, 'time(');
    content = content.replace(/console\.timeEnd\(/g, 'timeEnd(');

    // Add import if needed
    if (!hasLoggerImport && content !== originalContent) {
      const imports = content.match(/^import .*?;/gm) || [];
      if (imports.length > 0) {
        const lastImport = imports[imports.length - 1];
        const insertIndex = content.indexOf(lastImport) + lastImport.length;
        content = content.slice(0, insertIndex) + '\n' + LOGGER_IMPORT + content.slice(insertIndex);
      } else {
        content = LOGGER_IMPORT + '\n\n' + content;
      }
    }

    if (content !== originalContent) {
      fs.writeFileSync(filePath, content, 'utf-8');
      return { modified: true, removed: originalContent.match(/console\.log|console\.warn/g)?.length || 0 };
    }
    return { modified: false, removed: 0 };
  } catch (error) {
    console.error(`❌ Error: ${filePath}`, error.message);
    return { modified: false, removed: 0 };
  }
}

async function main() {
  const srcDir = path.join(__dirname, '../src');
  const files = await glob(`${srcDir}/**/*.{ts,tsx}`, { ignore: `${srcDir}/node_modules/**` });

  console.log(`🔄 Processing ${files.length} files...\n`);

  let totalModified = 0;
  let totalLogsRemoved = 0;

  for (const file of files) {
    const result = await processFile(file);
    if (result.modified) {
      totalModified++;
      totalLogsRemoved += result.removed;
      const rel = path.relative(srcDir, file);
      console.log(`✓ ${rel}`);
    }
  }

  console.log(`\n✅ Migration Complete!`);
  console.log(`   Modified files: ${totalModified}`);
  console.log(`   Logs removed/replaced: ${totalLogsRemoved}`);
}

main().catch(console.error);
