/**
 * Document Ingestion Service
 * Handles document uploads, auto-classification, and storage
 * with quality gates and approval workflows
 */

import type {
  KnowledgeBaseDocument,
  DocumentSection,
  DocumentCategory,
  DocumentIngestionConfig,
} from './types';

export class DocumentIngestionService {
  /**
   * Ingest a document from various sources
   */
  async ingestDocument(
    content: string,
    metadata: {
      title: string;
      source: 'internal' | 'external' | 'official';
      sourceUrl?: string;
      manual?: {
        category?: DocumentCategory;
        workTypes?: string[];
        tags?: string[];
      };
    },
    config: DocumentIngestionConfig
  ): Promise<KnowledgeBaseDocument> {
    const doc: KnowledgeBaseDocument = {
      id: this.generateDocumentId(metadata.title),
      title: metadata.title,
      content,
      source: metadata.source,
      sourceUrl: metadata.sourceUrl,
      category: metadata.manual?.category || (await this.autoClassifyCategory(content, metadata)),
      workTypes: metadata.manual?.workTypes || (await this.autoClassifyWorkTypes(content, metadata)),
      tags: metadata.manual?.tags || (await this.extractTags(content, metadata)),
      createdBy: 'system',
      createdAt: new Date(),
      lastUpdatedDate: new Date(),
      authority: this.assessAuthority(metadata.source),
      confidenceScore: 0, // Will be set after quality gates

      // Structure extraction
      sections: config.shouldExtractSections ? await this.extractSections(content) : undefined,

      // Keywords extraction
      keyPoints: await this.extractKeyPoints(content),
      summary: await this.generateSummary(content),
    };

    // Run quality gates
    if (config.requiresApproval) {
      doc.confidenceScore = await this.assessQuality(doc);

      if (doc.confidenceScore < config.approvalThreshold) {
        console.warn(
          `[Ingestion] Document "${doc.title}" below approval threshold: ${doc.confidenceScore}/${config.approvalThreshold}`
        );
        // Document would require manual approval
      }
    } else {
      doc.confidenceScore = await this.assessQuality(doc);
    }

    // Generate embedding if requested
    if (config.shouldGenerateEmbedding) {
      doc.embeddingId = await this.generateEmbedding(doc);
    }

    console.log(`[Ingestion] Document ingested: "${doc.title}" (confidence: ${doc.confidenceScore})`);

    return doc;
  }

  /**
   * Auto-classify document category using heuristics and keywords
   */
  private async autoClassifyCategory(
    content: string,
    metadata: { title: string; sourceUrl?: string }
  ): Promise<DocumentCategory> {
    const text = (metadata.title + ' ' + content).toLowerCase();

    // Category keywords mapping
    const categoryKeywords: { [key in DocumentCategory]: string[] } = {
      DTU: ['dtu', 'détail technique', 'cahier des charges', 'aménagement intérieur', 'rénovation'],
      EUROCODE: ['eurocode', 'en ', 'european standard', 'ec'],
      NORM: ['norme', 'iso', 'nf', ' en ', 'certification'],
      REGULATION: ['réglementation', 'code construction', 'loi', 'décret', 'article'],
      GUIDELINE: ['guide', 'directive', 'recommandation', 'best practice', 'bonnes pratiques'],
      BEST_PRACTICE: ['meilleur pratique', 'retour expérience', 'excellence', 'optimal'],
      TECHNICAL_GUIDE: ['guide technique', 'manuel', 'procédure', 'étapes', 'instructions'],
      TRAINING: ['formation', 'entraînement', 'cours', 'module d\'apprentissage', 'workshop'],
      MANUAL: ['manuel', 'mode d\'emploi', 'instructions', 'opérationnel'],
      HANDBOOK: ['manuel', 'référence', 'guide complet', 'handbook'],
      SUSTAINABILITY: ['développement durable', 'écologie', 'environnement', 'vert', 'éco'],
      ENERGY_EFFICIENCY: ['efficacité énergétique', 'énergie', 'rt 2020', 'dpe', 'isolation thermique'],
      LEGAL: ['légal', 'droit', 'loi', 'conformité juridique', 'contrat'],
      LIABILITY: ['responsabilité', 'assurance', 'décennale', 'garantie'],
      WARRANTY: ['garantie', 'couverture', 'protection', 'durée de vie'],
      CASE_STUDY: ['étude de cas', 'projet', 'exemple', 'retour chantier', 'portfolio'],
      LESSONS_LEARNED: ['retours d\'expérience', 'leçons', 'feedback', 'amélioration', 'erreurs'],
    };

    // Score each category
    let bestCategory = DocumentCategory.GUIDELINE;
    let bestScore = 0;

    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      const matches = keywords.filter(kw => text.includes(kw)).length;
      if (matches > bestScore) {
        bestScore = matches;
        bestCategory = category as DocumentCategory;
      }
    }

    return bestCategory;
  }

  /**
   * Auto-classify applicable work types
   */
  private async autoClassifyWorkTypes(
    content: string,
    metadata: { title: string }
  ): Promise<string[]> {
    const text = (metadata.title + ' ' + content).toLowerCase();

    const workTypeKeywords: { [key: string]: string[] } = {
      plumbing: ['plomberie', 'tuyauterie', 'eau', 'sanitaire', 'robinet', 'conduite', 'drainage'],
      electrical: ['électricité', 'électrique', 'tableau', 'disjoncteur', 'câblage', 'installation électrique'],
      painting: ['peinture', 'pinceaux', 'déco', 'couleur', 'revêtement mural'],
      renovation: ['rénovation', 'rénover', 'restauration', 'refonte', 'modernisation'],
      construction: ['construction', 'bâtiment', 'structure', 'gros œuvre', 'fondation'],
      hvac: ['chauffage', 'ventilation', 'climatisation', 'thermique', 'confort thermique'],
      roofing: ['toiture', 'toit', 'couverture', 'charpente', 'ardoise', 'tuile'],
      insulation: ['isolation', 'isolant', 'thermique', 'acoustique', 'laine'],
      flooring: ['sol', 'revêtement sol', 'carrelage', 'parquet', 'béton'],
      kitchen: ['cuisine', 'cuisinette', 'évier', 'plan de travail', 'électroménager'],
      bathroom: ['salle de bain', 'sanitaires', 'douche', 'baignoire', 'wc'],
      facade: ['façade', 'isolation thermique', 'revêtement externe', 'brique', 'pierre'],
      structure: ['structure', 'charpente', 'gros œuvre', 'fondation', 'dalle'],
      landscaping: ['aménagement extérieur', 'jardinage', 'paysagisme', 'clôture'],
    };

    const applicableTypes: string[] = [];
    for (const [workType, keywords] of Object.entries(workTypeKeywords)) {
      const matches = keywords.filter(kw => text.includes(kw)).length;
      if (matches > 0) {
        applicableTypes.push(workType);
      }
    }

    return applicableTypes.length > 0 ? applicableTypes : ['other'];
  }

  /**
   * Extract key terms as tags
   */
  private async extractTags(
    content: string,
    metadata: { title: string }
  ): Promise<string[]> {
    // Extract uppercase terms, important words, etc.
    const tags: Set<string> = new Set();

    // Add category from title
    const titleWords = metadata.title.split(/\s+/).filter(w => w.length > 3);
    titleWords.slice(0, 3).forEach(word => tags.add(word.toLowerCase()));

    // Extract common technical terms
    const technicalTerms = [
      'rge', 'maprimerénov', 'dpe', 'rt2020', 'maçonnerie', 'étanchéité',
      'ventilation', 'mise à la terre', 'détecteurs', 'disjoncteurs',
    ];

    technicalTerms.forEach(term => {
      if (content.toLowerCase().includes(term)) {
        tags.add(term);
      }
    });

    return Array.from(tags);
  }

  /**
   * Extract document sections (H1, H2, H3 structure)
   */
  private async extractSections(content: string): Promise<DocumentSection[]> {
    const sections: DocumentSection[] = [];
    const lines = content.split('\n');

    let currentLevel = 0;
    let currentContent = '';
    let sectionId = 0;

    for (const line of lines) {
      const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);

      if (headerMatch) {
        if (currentContent.trim()) {
          sections.push({
            id: `section-${sectionId++}`,
            title: currentContent.substring(0, 50),
            level: currentLevel,
            content: currentContent.trim(),
            keywords: await this.extractKeywords(currentContent),
          });
        }

        currentLevel = headerMatch[1].length;
        currentContent = headerMatch[2];
      } else {
        currentContent += '\n' + line;
      }
    }

    // Add last section
    if (currentContent.trim()) {
      sections.push({
        id: `section-${sectionId}`,
        title: currentContent.substring(0, 50),
        level: currentLevel,
        content: currentContent.trim(),
        keywords: await this.extractKeywords(currentContent),
      });
    }

    return sections;
  }

  /**
   * Extract key points from content
   */
  private async extractKeyPoints(content: string): Promise<string[]> {
    const points: string[] = [];

    // Extract bullet points
    const bulletRegex = /^[\s]*[-•*]\s+(.+)$/gm;
    let match;

    while ((match = bulletRegex.exec(content)) !== null) {
      points.push(match[1].substring(0, 100));
      if (points.length >= 5) break;
    }

    return points;
  }

  /**
   * Generate document summary
   */
  private async generateSummary(content: string): Promise<string> {
    // Take first meaningful paragraph
    const paragraphs = content.split('\n\n');
    const firstParagraph = paragraphs.find(p => p.length > 50);
    return firstParagraph?.substring(0, 200) || content.substring(0, 200);
  }

  /**
   * Assess document quality (0-100)
   */
  private async assessQuality(doc: KnowledgeBaseDocument): Promise<number> {
    let score = 50; // Base score

    // Content length
    if (doc.content.length > 1000) score += 10;
    if (doc.content.length > 5000) score += 10;

    // Structure
    if ((doc.sections?.length || 0) > 3) score += 10;

    // Metadata completeness
    if (doc.summary) score += 5;
    if ((doc.keyPoints?.length || 0) > 2) score += 5;
    if ((doc.tags.length || 0) > 2) score += 5;

    // Authority
    if (doc.source === 'official') score += 15;
    if (doc.authority === 'official') score += 10;
    if (doc.authority === 'expert') score += 5;

    return Math.min(100, score);
  }

  /**
   * Generate vector embedding for document
   */
  private async generateEmbedding(doc: KnowledgeBaseDocument): Promise<string> {
    // TODO: Call embedding service (e.g., Supabase pgvector, OpenAI, Anthropic)
    // For now, return a placeholder
    return `embedding_${doc.id}`;
  }

  /**
   * Helper to extract keywords from text
   */
  private async extractKeywords(text: string): Promise<string[]> {
    const words = text.toLowerCase().split(/\s+/);
    return words.filter(w => w.length > 4).slice(0, 5);
  }

  /**
   * Assess authority level based on source
   */
  private assessAuthority(source: 'internal' | 'external' | 'official'): 'official' | 'expert' | 'community' | 'generated' {
    switch (source) {
      case 'official':
        return 'official';
      case 'internal':
        return 'expert';
      case 'external':
        return 'community';
      default:
        return 'generated';
    }
  }

  /**
   * Generate unique document ID
   */
  private generateDocumentId(title: string): string {
    const timestamp = Date.now();
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .substring(0, 20);
    return `doc_${slug}_${timestamp}`;
  }
}

export const documentIngestionService = new DocumentIngestionService();
