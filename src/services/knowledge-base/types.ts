/**
 * Knowledge Base Types
 * Types pour la base de connaissances vectorisée TORP
 */

export type DocumentType = 'norm' | 'guide' | 'practice' | 'pricing';
export type DocumentStatus = 'raw' | 'processing' | 'vectorized';

export interface KBDocument {
  id: string;
  title: string;
  docType: DocumentType;
  sourceFile: string;
  uploadedAt: string;
  status: DocumentStatus;
  metadata: {
    region?: string;
    workTypes?: string[];
    validFor?: string[];
    tags?: string[];
  };
  createdAt: string;
}

export interface KBChunk {
  id: string;
  docId: string;
  sectionId: string;
  content: string;
  keywords: string[];
  embedding: number[]; // 1536 dimensions for Claude embeddings
  metadata: {
    docType: DocumentType;
    region?: string;
    workTypes?: string[];
    pageNumber?: number;
  };
  createdAt: string;
}

export interface KBSearchResult {
  chunks: KBChunk[];
  distances: number[];
  totalResults: number;
}

export interface ProcessedDocument {
  docId: string;
  title: string;
  docType: DocumentType;
  sections: {
    sectionId: string;
    title: string;
    content: string;
    keywords: string[];
    metadata: Record<string, any>;
  }[];
}

export interface DocumentUploadRequest {
  file: File;
  docType: DocumentType;
  title?: string;
  metadata?: Record<string, any>;
}

export interface VectorizationResult {
  docId: string;
  chunksCreated: number;
  totalTokens: number;
  status: 'success' | 'partial' | 'error';
  error?: string;
}
