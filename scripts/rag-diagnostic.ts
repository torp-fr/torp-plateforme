/**
 * Script de diagnostic de la base RAG
 * Analyse l'état des documents, chunks et embeddings
 *
 * Usage: npx tsx scripts/rag-diagnostic.ts
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
  console.error('   Set these in .env or as environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

interface DocumentIssue {
  id: string;
  name: string;
  totalChunks: number;
  emptyChunks: number;
  missingEmbeddings: number;
  avgChunkLength: number;
  issues: string[];
}

interface DiagnosticResult {
  totalDocuments: number;
  totalChunks: number;
  chunksWithEmbeddings: number;
  chunksWithoutEmbeddings: number;
  emptyChunks: number;
  shortChunks: number;
  documentsWithIssues: DocumentIssue[];
  summary: {
    healthScore: number;
    criticalIssues: string[];
    recommendations: string[];
  };
}

async function runDiagnostic(): Promise<DiagnosticResult> {
  console.log('🔍 Démarrage du diagnostic RAG...\n');

  // 1. Compter les documents
  const { count: totalDocuments, error: docError } = await supabase
    .from('knowledge_documents')
    .select('*', { count: 'exact', head: true });

  if (docError) {
    console.error('❌ Erreur lecture documents:', docError.message);
  }
  console.log(`📄 Documents totaux: ${totalDocuments || 0}`);

  // 2. Compter les chunks
  const { count: totalChunks, error: chunkError } = await supabase
    .from('knowledge_chunks')
    .select('*', { count: 'exact', head: true });

  if (chunkError) {
    console.error('❌ Erreur lecture chunks:', chunkError.message);
  }
  console.log(`📦 Chunks totaux: ${totalChunks || 0}`);

  // 3. Chunks avec embeddings valides
  const { count: chunksWithEmbeddings, error: embError } = await supabase
    .from('knowledge_chunks')
    .select('*', { count: 'exact', head: true })
    .not('embedding', 'is', null);

  if (embError) {
    console.error('❌ Erreur lecture embeddings:', embError.message);
  }
  console.log(`✅ Chunks avec embeddings: ${chunksWithEmbeddings || 0}`);

  // 4. Chunks sans embeddings
  const chunksWithoutEmbeddings = (totalChunks || 0) - (chunksWithEmbeddings || 0);
  console.log(`❌ Chunks sans embeddings: ${chunksWithoutEmbeddings}`);

  // 5. Chunks vides ou null
  const { count: emptyChunks, error: emptyError } = await supabase
    .from('knowledge_chunks')
    .select('*', { count: 'exact', head: true })
    .or('content.is.null,content.eq.');

  if (emptyError) {
    console.error('❌ Erreur lecture chunks vides:', emptyError.message);
  }
  console.log(`🚫 Chunks vides: ${emptyChunks || 0}`);

  // 6. Compter les chunks courts (< 50 caractères) via content_length
  const { count: shortChunks, error: shortError } = await supabase
    .from('knowledge_chunks')
    .select('*', { count: 'exact', head: true })
    .lt('content_length', 50);

  if (shortError) {
    console.error('❌ Erreur lecture chunks courts:', shortError.message);
  }
  console.log(`⚠️ Chunks courts (<50 car.): ${shortChunks || 0}`);

  // 7. Analyser par document - récupérer tous les documents avec leurs chunks
  console.log('\n📊 Analyse par document...');

  const { data: documents, error: docsError } = await supabase
    .from('knowledge_documents')
    .select(`
      id,
      filename,
      original_name,
      title,
      status,
      chunks_count
    `);

  if (docsError) {
    console.error('❌ Erreur analyse documents:', docsError.message);
  }

  const documentsWithIssues: DocumentIssue[] = [];

  // Pour chaque document, vérifier l'état des chunks
  for (const doc of documents || []) {
    const { data: chunks, error: chunksErr } = await supabase
      .from('knowledge_chunks')
      .select('id, content, content_length, embedding')
      .eq('document_id', doc.id);

    if (chunksErr) continue;

    const chunksList = chunks || [];
    const issues: string[] = [];

    const emptyCount = chunksList.filter(
      (c) => !c.content || c.content.trim() === ''
    ).length;

    const missingEmbeddings = chunksList.filter(
      (c) => !c.embedding
    ).length;

    const avgLength = chunksList.length > 0
      ? chunksList.reduce((sum, c) => sum + (c.content_length || c.content?.length || 0), 0) / chunksList.length
      : 0;

    // Détecter les problèmes
    if (chunksList.length === 0) issues.push('AUCUN_CHUNK');
    if (emptyCount > chunksList.length * 0.3) issues.push('TROP_DE_CHUNKS_VIDES');
    if (missingEmbeddings > chunksList.length * 0.2) issues.push('EMBEDDINGS_MANQUANTS');
    if (avgLength < 100 && chunksList.length > 0) issues.push('CHUNKS_TROP_COURTS');
    if (avgLength > 8000) issues.push('CHUNKS_TROP_LONGS');
    if (doc.status === 'error') issues.push('STATUS_ERROR');
    if (doc.status === 'pending') issues.push('NON_TRAITE');

    if (issues.length > 0) {
      documentsWithIssues.push({
        id: doc.id,
        name: doc.title || doc.original_name || doc.filename || 'Sans nom',
        totalChunks: chunksList.length,
        emptyChunks: emptyCount,
        missingEmbeddings,
        avgChunkLength: Math.round(avgLength),
        issues,
      });
    }
  }

  console.log(`📋 Documents avec problèmes: ${documentsWithIssues.length}/${documents?.length || 0}`);

  // 8. Calculer le score de santé
  const total = totalChunks || 1;
  const withEmb = chunksWithEmbeddings || 0;
  const empty = emptyChunks || 0;
  const short = shortChunks || 0;

  const healthScore = Math.max(0, Math.min(100, Math.round(
    (withEmb / total) * 100 -
    (empty / total) * 50 -
    (short / total) * 25
  )));

  // 9. Générer les recommandations
  const criticalIssues: string[] = [];
  const recommendations: string[] = [];

  if (withEmb < total * 0.8) {
    criticalIssues.push(`${Math.round((total - withEmb) / total * 100)}% des chunks n'ont pas d'embeddings`);
    recommendations.push('Relancer la génération d\'embeddings par lots');
  }

  if (empty > 100) {
    criticalIssues.push(`${empty} chunks sont vides`);
    recommendations.push('Supprimer les chunks vides et réanalyser les documents sources');
  }

  if (short > total * 0.1) {
    criticalIssues.push(`${short} chunks sont trop courts (<50 car.)`);
    recommendations.push('Améliorer le chunking pour éviter les fragments');
  }

  if (documentsWithIssues.length > (documents?.length || 0) * 0.3) {
    criticalIssues.push(`${documentsWithIssues.length} documents ont des problèmes`);
    recommendations.push('Réingérer les documents problématiques avec un meilleur parser');
  }

  return {
    totalDocuments: totalDocuments || 0,
    totalChunks: totalChunks || 0,
    chunksWithEmbeddings: chunksWithEmbeddings || 0,
    chunksWithoutEmbeddings,
    emptyChunks: emptyChunks || 0,
    shortChunks: shortChunks || 0,
    documentsWithIssues,
    summary: {
      healthScore,
      criticalIssues,
      recommendations,
    },
  };
}

// Main execution
async function main() {
  console.log('='.repeat(60));
  console.log('🔬 DIAGNOSTIC BASE RAG TORP');
  console.log('='.repeat(60));
  console.log(`📅 ${new Date().toISOString()}\n`);

  try {
    const result = await runDiagnostic();

    console.log('\n' + '='.repeat(60));
    console.log('📊 RAPPORT DE DIAGNOSTIC RAG');
    console.log('='.repeat(60));
    console.log(`\n🏥 Score de santé: ${result.summary.healthScore}/100`);
    console.log(`\n📈 Statistiques:`);
    console.log(`   - Documents: ${result.totalDocuments}`);
    console.log(`   - Chunks totaux: ${result.totalChunks}`);
    console.log(`   - Avec embeddings: ${result.chunksWithEmbeddings}`);
    console.log(`   - Sans embeddings: ${result.chunksWithoutEmbeddings}`);
    console.log(`   - Vides: ${result.emptyChunks}`);
    console.log(`   - Courts (<50 car.): ${result.shortChunks}`);

    if (result.summary.criticalIssues.length > 0) {
      console.log(`\n🚨 PROBLÈMES CRITIQUES:`);
      result.summary.criticalIssues.forEach(issue => console.log(`   - ${issue}`));
    }

    if (result.summary.recommendations.length > 0) {
      console.log(`\n💡 RECOMMANDATIONS:`);
      result.summary.recommendations.forEach(rec => console.log(`   - ${rec}`));
    }

    if (result.documentsWithIssues.length > 0) {
      console.log(`\n📋 Documents problématiques (${result.documentsWithIssues.length}):`);
      result.documentsWithIssues.slice(0, 20).forEach(doc => {
        console.log(`   - ${doc.name.substring(0, 50)}: ${doc.issues.join(', ')}`);
      });
      if (result.documentsWithIssues.length > 20) {
        console.log(`   ... et ${result.documentsWithIssues.length - 20} autres`);
      }
    }

    // Sauvegarder le rapport complet
    const reportPath = 'rag-diagnostic-report.json';
    fs.writeFileSync(reportPath, JSON.stringify(result, null, 2));
    console.log(`\n✅ Rapport complet sauvegardé: ${reportPath}`);

    // Sauvegarder la liste des documents à retraiter
    if (result.documentsWithIssues.length > 0) {
      const toReprocess = {
        generatedAt: new Date().toISOString(),
        count: result.documentsWithIssues.length,
        documentIds: result.documentsWithIssues.map(d => d.id),
        documents: result.documentsWithIssues,
      };
      const reprocessPath = 'documents-to-reprocess.json';
      fs.writeFileSync(reprocessPath, JSON.stringify(toReprocess, null, 2));
      console.log(`📝 Liste des documents à retraiter: ${reprocessPath}`);
    }

  } catch (error) {
    console.error('\n❌ Erreur lors du diagnostic:', error);
    process.exit(1);
  }
}

main();
