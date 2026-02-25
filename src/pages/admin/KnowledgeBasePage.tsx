/**
 * Knowledge Base Page - Real ingestion pipeline
 * Upload and enrichment of business brain
 */

import React from 'react';
import { UploadKBTab } from '../Analytics';
import { RAGStatusStrip } from '@/components/admin/RAGStatusStrip';
import { VectorHealthPanel } from '@/components/admin/VectorHealthPanel';
import { EmbeddingQueuePanel } from '@/components/admin/EmbeddingQueuePanel';
import { RAGIngestionTimeline } from '@/components/admin/RAGIngestionTimeline';
import { KnowledgeLibraryManager } from '@/components/admin/KnowledgeLibraryManager';
import { IngestionMetricsPanel } from '@/components/admin/IngestionMetricsPanel';

export function KnowledgeBasePage() {
  return (
    <div className="flex flex-col gap-6">
      {/* HEADER */}
      <div>
        <h1 className="text-2xl font-bold">Base de Connaissances</h1>
        <p className="text-sm text-muted-foreground">Upload et enrichissement du cerveau métier</p>
      </div>

      {/* 1️⃣ RAG STATUS */}
      <RAGStatusStrip />

      {/* 2️⃣ VECTOR HEALTH */}
      <VectorHealthPanel />

      {/* 3️⃣ INGESTION PIPELINE */}
      <UploadKBTab />

      {/* 4️⃣ EMBEDDING QUEUE */}
      <EmbeddingQueuePanel />

      {/* 5️⃣ INGESTION TIMELINE */}
      <RAGIngestionTimeline />

      {/* 6️⃣ LIBRARY MANAGER */}
      <KnowledgeLibraryManager />

      {/* 7️⃣ METRICS */}
      <IngestionMetricsPanel />
    </div>
  );
}

export default KnowledgeBasePage;
