/**
 * Script de nettoyage progressif de la base RAG
 * Supprime par lots pour éviter les timeouts Supabase
 *
 * Usage: npx tsx scripts/rag-cleanup.ts [--dry-run] [--include-no-embedding]
 *
 * Options:
 *   --dry-run             Simulation sans suppression
 *   --include-no-embedding  Supprimer aussi les chunks sans embeddings
 *
 * Requires:
 * - SUPABASE_URL (or VITE_SUPABASE_URL)
 * - SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Configuration
const BATCH_SIZE = 100;  // Taille des lots de suppression
const DELAY_MS = 300;    // Pause entre les lots (ms)
const MIN_CHUNK_LENGTH = 20;  // Longueur minimale pour garder un chunk

// Parse arguments
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const INCLUDE_NO_EMBEDDING = args.includes('--include-no-embedding');

interface CleanupStats {
  emptyChunksDeleted: number;
  shortChunksDeleted: number;
  orphanChunksDeleted: number;
  noEmbeddingChunksDeleted: number;
  totalDeleted: number;
  documentsToReprocess: string[];
  errors: string[];
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Supprime des chunks par lots selon une condition
 */
async function deleteChunksBatch(
  description: string,
  selectFn: () => Promise<{ data: { id: string }[] | null; error: any }>
): Promise<number> {
  let totalDeleted = 0;
  let hasMore = true;

  console.log(`\n🗑️  ${description}`);

  if (DRY_RUN) {
    // En dry-run, juste compter
    const { data, error } = await selectFn();
    if (error) {
      console.error(`   ❌ Erreur: ${error.message}`);
      return 0;
    }
    const count = data?.length || 0;
    console.log(`   [DRY-RUN] ${count} chunks seraient supprimés`);
    return count;
  }

  while (hasMore) {
    const { data: toDelete, error: selectError } = await selectFn();

    if (selectError) {
      console.error(`   ❌ Erreur sélection: ${selectError.message}`);
      break;
    }

    if (!toDelete || toDelete.length === 0) {
      hasMore = false;
      break;
    }

    const ids = toDelete.slice(0, BATCH_SIZE).map(item => item.id);

    // Supprimer le lot
    const { error: deleteError } = await supabase
      .from('knowledge_chunks')
      .delete()
      .in('id', ids);

    if (deleteError) {
      console.error(`   ❌ Erreur suppression: ${deleteError.message}`);
      break;
    }

    totalDeleted += ids.length;
    process.stdout.write(`   Supprimés: ${totalDeleted}\r`);

    // Pause pour éviter de surcharger
    await sleep(DELAY_MS);

    // Si on a moins que demandé, c'est qu'on a fini
    if (toDelete.length < BATCH_SIZE) {
      hasMore = false;
    }
  }

  console.log(`   ✅ Total supprimé: ${totalDeleted}    `);
  return totalDeleted;
}

/**
 * Supprime les chunks vides (content null ou '')
 */
async function cleanupEmptyChunks(): Promise<number> {
  return await deleteChunksBatch(
    'Chunks avec contenu vide ou NULL',
    async () => {
      return await supabase
        .from('knowledge_chunks')
        .select('id')
        .or('content.is.null,content.eq.')
        .limit(BATCH_SIZE);
    }
  );
}

/**
 * Supprime les chunks trop courts
 */
async function cleanupShortChunks(): Promise<number> {
  return await deleteChunksBatch(
    `Chunks trop courts (< ${MIN_CHUNK_LENGTH} caractères)`,
    async () => {
      return await supabase
        .from('knowledge_chunks')
        .select('id')
        .lt('content_length', MIN_CHUNK_LENGTH)
        .limit(BATCH_SIZE);
    }
  );
}

/**
 * Supprime les chunks orphelins (document parent n'existe plus)
 */
async function cleanupOrphanChunks(): Promise<number> {
  console.log(`\n🗑️  Chunks orphelins (document supprimé)`);

  // Récupérer tous les IDs de documents valides
  const { data: validDocs, error: docsError } = await supabase
    .from('knowledge_documents')
    .select('id');

  if (docsError) {
    console.error(`   ❌ Erreur récupération documents: ${docsError.message}`);
    return 0;
  }

  const validDocIds = new Set((validDocs || []).map(d => d.id));
  let totalDeleted = 0;
  let offset = 0;
  const batchSize = 1000;

  while (true) {
    // Récupérer un lot de chunks avec leur document_id
    const { data: chunks, error: chunksError } = await supabase
      .from('knowledge_chunks')
      .select('id, document_id')
      .range(offset, offset + batchSize - 1);

    if (chunksError) {
      console.error(`   ❌ Erreur: ${chunksError.message}`);
      break;
    }

    if (!chunks || chunks.length === 0) break;

    // Filtrer les orphelins
    const orphans = chunks.filter(c => !validDocIds.has(c.document_id));

    if (orphans.length > 0) {
      if (DRY_RUN) {
        totalDeleted += orphans.length;
        console.log(`   [DRY-RUN] ${orphans.length} orphelins détectés dans ce lot`);
      } else {
        // Supprimer par lots de BATCH_SIZE
        for (let i = 0; i < orphans.length; i += BATCH_SIZE) {
          const batch = orphans.slice(i, i + BATCH_SIZE).map(o => o.id);
          const { error: deleteError } = await supabase
            .from('knowledge_chunks')
            .delete()
            .in('id', batch);

          if (deleteError) {
            console.error(`   ❌ Erreur suppression: ${deleteError.message}`);
            break;
          }

          totalDeleted += batch.length;
          process.stdout.write(`   Supprimés: ${totalDeleted}\r`);
          await sleep(DELAY_MS);
        }
      }
    }

    offset += chunks.length;

    if (chunks.length < batchSize) break;
  }

  console.log(`   ✅ Total supprimé: ${totalDeleted}    `);
  return totalDeleted;
}

/**
 * Supprime les chunks sans embeddings (optionnel)
 */
async function cleanupNoEmbeddingChunks(): Promise<number> {
  if (!INCLUDE_NO_EMBEDDING) {
    console.log(`\n⏭️  Chunks sans embeddings: ignorés (utiliser --include-no-embedding)`);
    return 0;
  }

  return await deleteChunksBatch(
    'Chunks sans embeddings',
    async () => {
      return await supabase
        .from('knowledge_chunks')
        .select('id')
        .is('embedding', null)
        .limit(BATCH_SIZE);
    }
  );
}

/**
 * Met à jour le statut des documents sans chunks
 */
async function updateEmptyDocuments(): Promise<string[]> {
  console.log(`\n🔍 Identification des documents sans chunks...`);

  const { data: documents, error } = await supabase
    .from('knowledge_documents')
    .select(`
      id,
      filename,
      title,
      status,
      chunks_count
    `);

  if (error) {
    console.error(`   ❌ Erreur: ${error.message}`);
    return [];
  }

  const emptyDocs: string[] = [];

  for (const doc of documents || []) {
    // Compter les chunks réels
    const { count, error: countError } = await supabase
      .from('knowledge_chunks')
      .select('*', { count: 'exact', head: true })
      .eq('document_id', doc.id);

    if (countError) continue;

    if (count === 0 || count === null) {
      emptyDocs.push(doc.id);

      if (!DRY_RUN) {
        // Mettre à jour le statut du document
        await supabase
          .from('knowledge_documents')
          .update({
            status: 'pending',
            chunks_count: 0,
            processing_error: 'Chunks supprimés - Réingestion nécessaire'
          })
          .eq('id', doc.id);
      }
    }
  }

  console.log(`   📋 ${emptyDocs.length} documents sans chunks (statut mis à jour)`);
  return emptyDocs;
}

/**
 * Exécute le nettoyage complet
 */
async function runCleanup(): Promise<CleanupStats> {
  const stats: CleanupStats = {
    emptyChunksDeleted: 0,
    shortChunksDeleted: 0,
    orphanChunksDeleted: 0,
    noEmbeddingChunksDeleted: 0,
    totalDeleted: 0,
    documentsToReprocess: [],
    errors: [],
  };

  console.log('='.repeat(60));
  console.log('🧹 NETTOYAGE PROGRESSIF DE LA BASE RAG');
  console.log('='.repeat(60));
  console.log(`📅 ${new Date().toISOString()}`);
  if (DRY_RUN) {
    console.log('⚠️  MODE DRY-RUN: Aucune suppression ne sera effectuée');
  }
  console.log('');

  try {
    // 1. Supprimer les chunks vides
    stats.emptyChunksDeleted = await cleanupEmptyChunks();

    // 2. Supprimer les chunks trop courts
    stats.shortChunksDeleted = await cleanupShortChunks();

    // 3. Supprimer les chunks orphelins
    stats.orphanChunksDeleted = await cleanupOrphanChunks();

    // 4. Optionnel: supprimer les chunks sans embeddings
    stats.noEmbeddingChunksDeleted = await cleanupNoEmbeddingChunks();

    // 5. Identifier les documents à retraiter
    stats.documentsToReprocess = await updateEmptyDocuments();

    stats.totalDeleted = stats.emptyChunksDeleted +
                         stats.shortChunksDeleted +
                         stats.orphanChunksDeleted +
                         stats.noEmbeddingChunksDeleted;

  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    stats.errors.push(errMsg);
    console.error(`\n❌ Erreur: ${errMsg}`);
  }

  return stats;
}

// Main execution
async function main() {
  const startTime = Date.now();

  const stats = await runCleanup();

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('\n' + '='.repeat(60));
  console.log('📊 RÉSUMÉ DU NETTOYAGE');
  console.log('='.repeat(60));
  console.log(`   Durée: ${duration}s`);
  console.log(`   Mode: ${DRY_RUN ? 'DRY-RUN (simulation)' : 'RÉEL'}`);
  console.log('');
  console.log(`   Chunks vides supprimés: ${stats.emptyChunksDeleted}`);
  console.log(`   Chunks courts supprimés: ${stats.shortChunksDeleted}`);
  console.log(`   Chunks orphelins supprimés: ${stats.orphanChunksDeleted}`);
  console.log(`   Chunks sans embedding supprimés: ${stats.noEmbeddingChunksDeleted}`);
  console.log(`   ─────────────────────────────`);
  console.log(`   TOTAL SUPPRIMÉ: ${stats.totalDeleted}`);
  console.log(`   Documents à retraiter: ${stats.documentsToReprocess.length}`);

  if (stats.errors.length > 0) {
    console.log(`\n❌ Erreurs (${stats.errors.length}):`);
    stats.errors.forEach(e => console.log(`   - ${e}`));
  }

  // Sauvegarder le rapport
  const reportPath = 'rag-cleanup-report.json';
  fs.writeFileSync(reportPath, JSON.stringify({
    ...stats,
    executedAt: new Date().toISOString(),
    dryRun: DRY_RUN,
    durationSeconds: parseFloat(duration),
  }, null, 2));
  console.log(`\n✅ Rapport sauvegardé: ${reportPath}`);

  // Sauvegarder la liste des documents à retraiter
  if (stats.documentsToReprocess.length > 0) {
    const reprocessPath = 'documents-to-reprocess.json';
    fs.writeFileSync(reprocessPath, JSON.stringify({
      generatedAt: new Date().toISOString(),
      source: 'cleanup',
      count: stats.documentsToReprocess.length,
      documentIds: stats.documentsToReprocess,
    }, null, 2));
    console.log(`📝 Documents à retraiter: ${reprocessPath}`);
  }

  if (!DRY_RUN && stats.totalDeleted > 0) {
    console.log(`\n💡 Recommandation: Relancer le diagnostic pour vérifier l'état`);
    console.log(`   npx tsx scripts/rag-diagnostic.ts`);
  }
}

main().catch(console.error);
