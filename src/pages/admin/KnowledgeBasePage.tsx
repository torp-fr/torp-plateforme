/**
 * Knowledge Base Page - Real ingestion pipeline
 * Upload and enrichment of business brain
 */

import React from 'react';
import { UploadKBTab } from '../Analytics';

export function KnowledgeBasePage() {
  return (
    <div className="flex flex-col gap-6">
      {/* HEADER */}
      <div>
        <h1 className="text-2xl font-bold">Base de Connaissances</h1>
        <p className="text-sm text-muted-foreground">Upload et enrichissement du cerveau métier</p>
      </div>

      {/* INGESTION PIPELINE */}
      <UploadKBTab />
    </div>
  );
}

export default KnowledgeBasePage;
