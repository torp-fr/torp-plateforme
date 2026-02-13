/**
 * Knowledge Base Type Definitions
 * Structures for domain knowledge storage and retrieval
 */

/**
 * Document Classification Taxonomy
 */
export enum DocumentCategory {
  // Regulations
  DTU = 'DTU',                           // Détails Techniques Unifiés
  EUROCODE = 'EUROCODE',                 // European standards
  NORM = 'NORM',                         // ISO, NF, EN norms
  REGULATION = 'REGULATION',             // Building regulations

  // Guidelines & Best Practices
  GUIDELINE = 'GUIDELINE',               // Internal guidelines
  BEST_PRACTICE = 'BEST_PRACTICE',       // Industry best practices
  TECHNICAL_GUIDE = 'TECHNICAL_GUIDE',   // Technical documentation

  // Training & Education
  TRAINING = 'TRAINING',                 // Training materials
  MANUAL = 'MANUAL',                     // Operation manuals
  HANDBOOK = 'HANDBOOK',                 // Technical handbooks

  // Environmental & Sustainability
  SUSTAINABILITY = 'SUSTAINABILITY',     // Green building, eco-labels
  ENERGY_EFFICIENCY = 'ENERGY_EFFICIENCY', // Energy standards

  // Legal & Compliance
  LEGAL = 'LEGAL',                       // Legal requirements
  LIABILITY = 'LIABILITY',               // Insurance, liability
  WARRANTY = 'WARRANTY',                 // Warranty standards

  // Case Studies & Examples
  CASE_STUDY = 'CASE_STUDY',             // Project examples
  LESSONS_LEARNED = 'LESSONS_LEARNED',   // Past projects feedback
}

/**
 * Work Type Categories for filtering knowledge
 */
export enum WorkType {
  PLUMBING = 'plumbing',
  ELECTRICAL = 'electrical',
  PAINTING = 'painting',
  RENOVATION = 'renovation',
  CONSTRUCTION = 'construction',
  HVAC = 'hvac',
  ROOFING = 'roofing',
  INSULATION = 'insulation',
  FLOORING = 'flooring',
  KITCHEN = 'kitchen',
  BATHROOM = 'bathroom',
  FACADE = 'facade',
  STRUCTURE = 'structure',
  LANDSCAPING = 'landscaping',
  OTHER = 'other',
}

/**
 * Knowledge Base Document Structure
 */
export interface KnowledgeBaseDocument {
  // Identification
  id: string;
  title: string;
  description?: string;

  // Classification
  category: DocumentCategory;
  workTypes: WorkType[];
  tags: string[];

  // Content
  content: string;
  summary?: string;
  keyPoints?: string[];

  // Metadata
  source: 'internal' | 'external' | 'official';
  sourceUrl?: string;

  // Structure
  sections?: DocumentSection[];
  relatedDocuments?: string[];

  // Dates
  publishedDate?: Date;
  lastUpdatedDate: Date;
  version?: string;

  // Access & Quality
  authority: 'official' | 'expert' | 'community' | 'generated';
  confidenceScore: number;
  relevanceScores?: {
    [key: string]: number;
  };

  // Audit trail
  createdBy: string;
  createdAt: Date;
  approvedBy?: string;
  approvedAt?: Date;

  // For RAG/Search
  embeddingId?: string;
}

/**
 * Document Section for structured content
 */
export interface DocumentSection {
  id: string;
  title: string;
  level: number;
  content: string;
  keywords: string[];
  relatedSections?: string[];
}

/**
 * Knowledge Query Structure
 */
export interface KnowledgeQuery {
  query: string;
  workType?: string;
  context?: string;
  categories?: DocumentCategory[];
  minConfidence?: number;
  sources?: ('internal' | 'external' | 'official')[];
  maxResults?: number;
  includeRelated?: boolean;
  deepSearch?: boolean;
}

/**
 * Knowledge Query Result
 */
export interface KnowledgeResult {
  query: KnowledgeQuery;
  documents: KnowledgeResultDocument[];
  synthesis?: string;
  totalRelevant: number;
  searchDurationMs: number;
  sources: {
    [key: string]: number;
  };
}

export interface KnowledgeResultDocument {
  document: KnowledgeBaseDocument;
  relevanceScore: number;
  matchedSections?: DocumentSection[];
  highlights?: string[];
  applicability: 'directly_applicable' | 'related' | 'informational';
}

/**
 * Domain-Specific Analysis Request
 */
export interface DomainAnalysisRequest {
  proposalData: {
    type: string;
    description: string;
    materials?: string[];
    budget?: number;
    timeline?: string;
    company?: {
      name: string;
      certifications?: string[];
    };
  };
  demandData?: {
    type: string;
    constraints?: string[];
    budget?: number;
    timeline?: string;
  };
  includeWebSearch?: boolean;
  analysisDepth?: 'quick' | 'standard' | 'comprehensive';
}

/**
 * Domain Analysis Result
 */
export interface DomainAnalysisResult {
  issues: DomainIssue[];
  recommendations: DomainRecommendation[];
  optimizations: DomainOptimization[];
  knowledgeSources: KnowledgeResultDocument[];
  webEnrichment?: {
    sources: Array<{
      title: string;
      url: string;
      relevance: number;
    }>;
    insights: string[];
  };
  executiveSummary: string;
  detailedAnalysis: string;
  analysisDate: Date;
  confidence: number;
  analysisDurationMs: number;
}

/**
 * Domain Issue (gap from best practices)
 */
export interface DomainIssue {
  id: string;
  title: string;
  description: string;
  severity: 'critical' | 'major' | 'minor';
  category: 'missing' | 'non-compliant' | 'suboptimal' | 'risk';
  knowledgeReference?: KnowledgeBaseDocument;
  regulation?: string;
  norm?: string;
  impact: string;
  affectedAreas: string[];
  suggestedFix?: string;
  estimatedCost?: {
    min: number;
    max: number;
    unit: string;
  };
}

/**
 * Domain Recommendation
 */
export interface DomainRecommendation {
  id: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  category: 'compliance' | 'quality' | 'efficiency' | 'sustainability';
  rationale: string;
  baselineReference?: KnowledgeBaseDocument;
  implementationSteps?: string[];
  estimatedEffort?: string;
  estimatedCost?: {
    min: number;
    max: number;
    unit: string;
  };
  expectedBenefits: string[];
}

/**
 * Domain Optimization
 */
export interface DomainOptimization {
  id: string;
  title: string;
  description: string;
  type: 'performance' | 'cost' | 'timeline' | 'quality' | 'sustainability';
  potentialGain: string;
  currentState: string;
  proposedState: string;
  implementationPath: string;
  complexity: 'simple' | 'moderate' | 'complex';
  roiEstimate?: string;
  riskLevel: 'low' | 'medium' | 'high';
}

/**
 * Document Ingestion Configuration
 */
export interface DocumentIngestionConfig {
  sourceType: 'file_upload' | 'web_scrape' | 'api_integration' | 'manual_entry';
  sourceIdentifier: string;
  suggestedCategory?: DocumentCategory;
  suggestedWorkTypes?: string[];
  suggestedTags?: string[];
  shouldExtractSections: boolean;
  shouldGenerateEmbedding: boolean;
  shouldAutoClassify: boolean;
  requiresApproval: boolean;
  approvalThreshold: number;
}

/**
 * RAG Source Configuration
 */
export interface RAGSourceConfig {
  name: string;
  type: 'local_vector_db' | 'cloud_vector_db' | 'web_search' | 'api_integration';
  endpoint?: string;
  apiKey?: string;
  enabled: boolean;
  priority: number;
  maxResultsPerQuery: number;
  defaultCategories: DocumentCategory[];
  excludeCategories?: DocumentCategory[];
  minConfidence: number;
  costPerQuery?: number;
  monthlyBudget?: number;
}
