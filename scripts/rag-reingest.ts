/**
 * Script de réingestion des documents problématiques
 * Traite par lots avec le processeur PDF intelligent
 *
 * Usage: npx tsx scripts/rag-reingest.ts [--limit N] [--doc-id UUID]
 *
 * Options:
 *   --limit N       Nombre maximum de documents à traiter
 *   --doc-id UUID   Retraiter un document spécifique
 *   --dry-run       Simulation sans modification
 *
 * Requires:
 * - SUPABASE_URL (or VITE_SUPABASE_URL)
 * - SUPABASE_SERVICE_ROLE_KEY
 * - OPENAI_API_KEY (for embeddings)
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import { generateEmbedding } from '../supabase/functions/_shared/ai-client.ts';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const openaiKey = process.env.OPENAI_API_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

if (!openaiKey) {
  console.error('❌ Missing OPENAI_API_KEY (required for embeddings)');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Parse arguments
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const limitIndex = args.indexOf('--limit');
const LIMIT = limitIndex !== -1 ? parseInt(args[limitIndex + 1], 10) : 10;
const docIdIndex = args.indexOf('--doc-id');
const SPECIFIC_DOC_ID = docIdIndex !== -1 ? args[docIdIndex + 1] : null;

// Configuration
const BATCH_SIZE = 5;           // Documents par lot
const EMBEDDING_BATCH = 20;     // Chunks par appel embedding
const CHUNK_SIZE = 1500;        // Taille max d'un chunk
const CHUNK_OVERLAP = 200;      // Overlap entre chunks

interface ReingestionStats {
  documentsProcessed: number;
  documentsSuccessful: number;
  documentsFailed: number;
  chunksCreated: number;
  embeddingsGenerated: number;
  errors: Array<{ documentId: string; error: string }>;
}

/**
 * Génère les embeddings pour une liste de textes via ai-client
 */
async function generateEmbeddings(texts: string[], sessionId: string): Promise<number[][]> {
  if (texts.length === 0) return [];

  try {
    const embeddings: number[][] = [];

    for (const text of texts) {
      const result = await generateEmbedding(
        text,
        openaiKey,
        'text-embedding-3-small',
        {
          sessionId,
          supabaseClient: supabase
        }
      );
      embeddings.push(result.embedding);
    }

    return embeddings;
  } catch (error) {
    console.error('   ❌ Erreur génération embeddings:', error);
    throw error;
  }
}

/**
 * Découpe le texte en chunks
 */
function chunkText(
  text: string,
  maxSize: number = CHUNK_SIZE,
  overlap: number = CHUNK_OVERLAP
): Array<{ content: string; index: number }> {
  const chunks: Array<{ content: string; index: number }> = [];

  if (!text || text.trim().length === 0) {
    return chunks;
  }

  // Découper par paragraphes
  const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 0);

  let currentChunk = '';
  let currentIndex = 0;

  for (const paragraph of paragraphs) {
    const trimmedPara = paragraph.trim();

    if (currentChunk.length + trimmedPara.length > maxSize && currentChunk.length >= 100) {
      // Sauvegarder le chunk actuel
      chunks.push({
        content: currentChunk.trim(),
        index: currentIndex++,
      });

      // Nouveau chunk avec overlap
      const overlapText = currentChunk.slice(-overlap);
      currentChunk = overlapText + '\n\n' + trimmedPara;
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + trimmedPara;
    }
  }

  // Dernier chunk
  if (currentChunk.trim().length >= 50) {
    chunks.push({
      content: currentChunk.trim(),
      index: currentIndex,
    });
  }

  return chunks;
}

/**
 * Télécharge et extrait le texte d'un document
 */
async function downloadAndExtract(filePath: string): Promise<string | null> {
  try {
    // Télécharger depuis Supabase Storage
    const { data, error } = await supabase.storage
      .from('knowledge')  // Adapter selon votre bucket
      .download(filePath);

    if (error) {
      // Essayer un autre bucket
      const { data: data2, error: error2 } = await supabase.storage
        .from('documents')
        .download(filePath);

      if (error2) {
        console.error(`   ❌ Erreur téléchargement: ${error.message}`);
        return null;
      }

      return await extractTextFromBlob(data2);
    }

    return await extractTextFromBlob(data);
  } catch (error) {
    console.error(`   ❌ Erreur: ${error}`);
    return null;
  }
}

/**
 * Extrait le texte d'un Blob PDF
 */
async function extractTextFromBlob(blob: Blob): Promise<string | null> {
  try {
    // Utiliser pdf.js dynamiquement
    const pdfjsLib = await import('pdfjs-dist');
    const arrayBuffer = await blob.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    const textParts: string[] = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ')
        .trim();

      if (pageText.length > 0) {
        textParts.push(pageText);
      }
    }

    return textParts.join('\n\n');
  } catch (error) {
    console.error(`   ❌ Erreur extraction PDF: ${error}`);
    return null;
  }
}

/**
 * Réingère un document spécifique
 */
async function reingestDocument(
  documentId: string,
  sessionId: string
): Promise<{ success: boolean; chunksCreated: number; error?: string }> {
  try {
    // 1. Récupérer les infos du document
    const { data: doc, error: docError } = await supabase
      .from('knowledge_documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (docError || !doc) {
      return { success: false, chunksCreated: 0, error: `Document non trouvé: ${docError?.message}` };
    }

    console.log(`   📄 Document: ${doc.title || doc.original_name || doc.filename}`);
    console.log(`   📁 Fichier: ${doc.file_path}`);

    // 2. Télécharger et extraire le texte
    const text = await downloadAndExtract(doc.file_path);

    if (!text || text.trim().length < 50) {
      return { success: false, chunksCreated: 0, error: 'Texte non extractible ou trop court' };
    }

    console.log(`   📝 Texte extrait: ${text.length} caractères`);

    if (DRY_RUN) {
      const chunks = chunkText(text, CHUNK_SIZE, CHUNK_OVERLAP);
      console.log(`   [DRY-RUN] ${chunks.length} chunks seraient créés`);
      return { success: true, chunksCreated: chunks.length };
    }

    // 3. Supprimer les anciens chunks
    const { error: deleteError } = await supabase
      .from('knowledge_chunks')
      .delete()
      .eq('document_id', documentId);

    if (deleteError) {
      console.warn(`   ⚠️ Erreur suppression anciens chunks: ${deleteError.message}`);
    }

    // 4. Créer les nouveaux chunks
    const chunks = chunkText(text, CHUNK_SIZE, CHUNK_OVERLAP);
    console.log(`   📦 Chunks créés: ${chunks.length}`);

    if (chunks.length === 0) {
      return { success: false, chunksCreated: 0, error: 'Aucun chunk généré' };
    }

    // 5. Générer les embeddings par lots
    const chunksWithEmbeddings: Array<{
      document_id: string;
      content: string;
      content_length: number;
      chunk_index: number;
      embedding: number[];
      metadata: any;
    }> = [];

    for (let i = 0; i < chunks.length; i += EMBEDDING_BATCH) {
      const batch = chunks.slice(i, i + EMBEDDING_BATCH);
      const texts = batch.map(c => c.content);

      try {
        const embeddings = await generateEmbeddings(texts, sessionId);

        for (let j = 0; j < batch.length; j++) {
          chunksWithEmbeddings.push({
            document_id: documentId,
            content: batch[j].content,
            content_length: batch[j].content.length,
            chunk_index: batch[j].index,
            embedding: embeddings[j],
            metadata: {
              reingested_at: new Date().toISOString(),
            },
          });
        }

        process.stdout.write(`   Embeddings: ${Math.min(i + EMBEDDING_BATCH, chunks.length)}/${chunks.length}\r`);
      } catch (embError) {
        return { success: false, chunksCreated: 0, error: `Erreur embeddings: ${embError}` };
      }
    }

    console.log('');

    // 6. Insérer en base par lots
    const insertBatchSize = 50;
    for (let i = 0; i < chunksWithEmbeddings.length; i += insertBatchSize) {
      const batch = chunksWithEmbeddings.slice(i, i + insertBatchSize);
      const { error: insertError } = await supabase
        .from('knowledge_chunks')
        .insert(batch);

      if (insertError) {
        return { success: false, chunksCreated: i, error: `Erreur insertion: ${insertError.message}` };
      }
    }

    // 7. Mettre à jour le document
    await supabase
      .from('knowledge_documents')
      .update({
        status: 'indexed',
        chunks_count: chunks.length,
        indexed_at: new Date().toISOString(),
        processing_error: null,
      })
      .eq('id', documentId);

    return { success: true, chunksCreated: chunks.length };

  } catch (error) {
    return {
      success: false,
      chunksCreated: 0,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Exécute la réingestion
 */
async function runReingestion(): Promise<ReingestionStats> {
  const stats: ReingestionStats = {
    documentsProcessed: 0,
    documentsSuccessful: 0,
    documentsFailed: 0,
    chunksCreated: 0,
    embeddingsGenerated: 0,
    errors: [],
  };

  console.log('='.repeat(60));
  console.log('🔄 RÉINGESTION DES DOCUMENTS RAG');
  console.log('='.repeat(60));
  console.log(`📅 ${new Date().toISOString()}`);
  if (DRY_RUN) {
    console.log('⚠️  MODE DRY-RUN: Aucune modification ne sera effectuée');
  }
  console.log('');

  // Déterminer les documents à traiter
  let documentsToProcess: string[] = [];

  if (SPECIFIC_DOC_ID) {
    // Document spécifique
    documentsToProcess = [SPECIFIC_DOC_ID];
    console.log(`📋 Document spécifique: ${SPECIFIC_DOC_ID}\n`);
  } else {
    // Charger depuis le fichier ou récupérer les documents problématiques
    try {
      const data = JSON.parse(fs.readFileSync('documents-to-reprocess.json', 'utf8'));
      documentsToProcess = data.documentIds.slice(0, LIMIT);
      console.log(`📋 ${documentsToProcess.length} documents depuis documents-to-reprocess.json\n`);
    } catch {
      // Récupérer les documents avec problèmes
      const { data, error } = await supabase
        .from('knowledge_documents')
        .select('id, filename, status')
        .or('status.eq.pending,status.eq.error,chunks_count.eq.0,chunks_count.is.null')
        .limit(LIMIT);

      if (error) {
        console.error('❌ Erreur récupération documents:', error.message);
        return stats;
      }

      documentsToProcess = (data || []).map(d => d.id);
      console.log(`📋 ${documentsToProcess.length} documents problématiques détectés\n`);
    }
  }

  if (documentsToProcess.length === 0) {
    console.log('✅ Aucun document à retraiter');
    return stats;
  }

  // Traiter par lots
  for (let i = 0; i < documentsToProcess.length; i += BATCH_SIZE) {
    const batch = documentsToProcess.slice(i, i + BATCH_SIZE);

    console.log(`\n--- Lot ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(documentsToProcess.length / BATCH_SIZE)} ---`);

    for (const docId of batch) {
      console.log(`\n📄 Traitement: ${docId}`);

      const sessionId = `rag-reingest-${docId}-${Date.now()}`;
      const result = await reingestDocument(docId, sessionId);

      stats.documentsProcessed++;

      if (result.success) {
        stats.documentsSuccessful++;
        stats.chunksCreated += result.chunksCreated;
        console.log(`   ✅ Succès: ${result.chunksCreated} chunks`);
      } else {
        stats.documentsFailed++;
        stats.errors.push({ documentId: docId, error: result.error || 'Unknown error' });
        console.log(`   ❌ Échec: ${result.error}`);
      }
    }

    // Pause entre les lots
    if (i + BATCH_SIZE < documentsToProcess.length) {
      console.log('\n⏳ Pause 2s avant le lot suivant...');
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  return stats;
}

// Main execution
async function main() {
  const startTime = Date.now();

  const stats = await runReingestion();

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('\n' + '='.repeat(60));
  console.log('📊 RAPPORT DE RÉINGESTION');
  console.log('='.repeat(60));
  console.log(`   Durée: ${duration}s`);
  console.log(`   Mode: ${DRY_RUN ? 'DRY-RUN (simulation)' : 'RÉEL'}`);
  console.log('');
  console.log(`   Documents traités: ${stats.documentsProcessed}`);
  console.log(`   ✅ Succès: ${stats.documentsSuccessful}`);
  console.log(`   ❌ Échecs: ${stats.documentsFailed}`);
  console.log(`   Chunks créés: ${stats.chunksCreated}`);

  if (stats.errors.length > 0) {
    console.log(`\n❌ Erreurs (${stats.errors.length}):`);
    stats.errors.slice(0, 10).forEach(e => {
      console.log(`   - ${e.documentId.substring(0, 8)}...: ${e.error}`);
    });
    if (stats.errors.length > 10) {
      console.log(`   ... et ${stats.errors.length - 10} autres`);
    }
  }

  // Sauvegarder le rapport
  const reportPath = 'rag-reingestion-report.json';
  fs.writeFileSync(reportPath, JSON.stringify({
    ...stats,
    executedAt: new Date().toISOString(),
    dryRun: DRY_RUN,
    durationSeconds: parseFloat(duration),
  }, null, 2));
  console.log(`\n✅ Rapport sauvegardé: ${reportPath}`);

  if (!DRY_RUN && stats.documentsSuccessful > 0) {
    console.log(`\n💡 Recommandation: Relancer le diagnostic pour vérifier`);
    console.log(`   npx tsx scripts/rag-diagnostic.ts`);
  }
}

main().catch(console.error);
