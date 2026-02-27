/**
 * Knowledge Base Page - Real ingestion pipeline
 * Upload and enrichment of business brain
 */

import React from 'react';
import { UploadKBTab } from '../Analytics';
import { AICommandCenterStrip } from '@/components/admin/AICommandCenterStrip';
import { RAGStatusStrip } from '@/components/admin/RAGStatusStrip';
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

      {/* 🎯 AI COMMAND CENTER */}
      <AICommandCenterStrip />

      {/* 1️⃣ RAG STATUS */}
      <RAGStatusStrip />

      {/* 2️⃣ INGESTION PIPELINE */}
      <UploadKBTab />

      {/* 3️⃣ DOCUMENT MANAGEMENT */}
      <KnowledgeLibraryManager />

      {/* 4️⃣ METRICS */}
      <IngestionMetricsPanel />
    </div>
  );
}

export default KnowledgeBasePage;
