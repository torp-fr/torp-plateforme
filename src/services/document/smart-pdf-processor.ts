/**
 * Service d'extraction PDF intelligent pour la base RAG
 *
 * Détecte automatiquement :
 * 1. PDF avec texte natif (extraction directe)
 * 2. PDF scanné (nécessite OCR)
 * 3. PDF mixte (texte + images)
 *
 * Optimise le traitement selon le type détecté
 */

import * as pdfjsLib from 'pdfjs-dist';

// Types
export interface PDFAnalysis {
  type: 'native' | 'scanned' | 'mixed';
  totalPages: number;
  pagesWithText: number;
  pagesNeedingOCR: number;
  confidence: number;
  textDensity: number;          // Caractères par page moyenne
  hasImages: boolean;
  estimatedProcessingTime: number; // En secondes
}

export interface PageExtractionResult {
  pageNumber: number;
  text: string;
  method: 'native' | 'ocr';
  confidence: number;
  charCount: number;
}

export interface ExtractionResult {
  success: boolean;
  text: string;
  pages: PageExtractionResult[];
  metadata: {
    totalCharacters: number;
    processingTimeMs: number;
    ocrPagesCount: number;
    nativePagesCount: number;
    averageConfidence: number;
  };
  analysis: PDFAnalysis;
  error?: string;
}

export interface ChunkResult {
  content: string;
  index: number;
  metadata: {
    startChar: number;
    endChar: number;
    pageNumbers: number[];
  };
}

export interface ChunkOptions {
  maxChunkSize?: number;
  minChunkSize?: number;
  overlap?: number;
  preserveParagraphs?: boolean;
  preservePageBoundaries?: boolean;
}

// Configuration
const MIN_TEXT_PER_PAGE = 100;  // Minimum caractères pour considérer une page "avec texte"
const MIN_TEXT_DENSITY = 50;    // Caractères/page pour considérer un PDF natif

/**
 * Service d'extraction PDF intelligent
 */
class SmartPDFProcessor {

  /**
   * Analyse un PDF pour déterminer la stratégie d'extraction optimale
   */
  async analyzePDF(pdfBuffer: ArrayBuffer): Promise<PDFAnalysis> {
    const pdf = await pdfjsLib.getDocument({ data: pdfBuffer }).promise;
    const totalPages = pdf.numPages;

    let pagesWithText = 0;
    let totalTextLength = 0;
    let hasImages = false;

    for (let i = 1; i <= totalPages; i++) {
      const page = await pdf.getPage(i);

      // Extraire le texte natif
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ')
        .trim();

      totalTextLength += pageText.length;

      if (pageText.length >= MIN_TEXT_PER_PAGE) {
        pagesWithText++;
      }

      // Vérifier la présence d'images (opérateurs de rendu d'image)
      try {
        const ops = await page.getOperatorList();
        const imageOps = [
          pdfjsLib.OPS.paintImageXObject,
          pdfjsLib.OPS.paintImageMaskXObject,
          pdfjsLib.OPS.paintJpegXObject,
        ];

        if (ops.fnArray.some((op: number) => imageOps.includes(op))) {
          hasImages = true;
        }
      } catch {
        // Ignorer les erreurs d'opérateurs
      }
    }

    const textDensity = totalTextLength / totalPages;
    const pagesNeedingOCR = totalPages - pagesWithText;

    // Déterminer le type
    let type: PDFAnalysis['type'];
    if (pagesWithText >= totalPages * 0.9) {
      type = 'native';
    } else if (pagesWithText <= totalPages * 0.1) {
      type = 'scanned';
    } else {
      type = 'mixed';
    }

    // Estimer le temps de traitement
    const nativeTimePerPage = 0.1;  // secondes
    const ocrTimePerPage = 3;       // secondes (si OCR était disponible)
    const estimatedProcessingTime =
      pagesWithText * nativeTimePerPage +
      pagesNeedingOCR * ocrTimePerPage;

    return {
      type,
      totalPages,
      pagesWithText,
      pagesNeedingOCR,
      confidence: pagesWithText / totalPages,
      textDensity,
      hasImages,
      estimatedProcessingTime,
    };
  }

  /**
   * Extrait le texte d'un PDF de manière intelligente
   * Note: OCR n'est pas implémenté dans cette version (nécessiterait Tesseract.js)
   */
  async extractText(
    pdfBuffer: ArrayBuffer,
    options: {
      forceOCR?: boolean;
      onProgress?: (progress: { page: number; total: number; method: string }) => void;
    } = {}
  ): Promise<ExtractionResult> {
    const startTime = Date.now();
    const { forceOCR = false, onProgress } = options;

    try {
      // Analyser d'abord le PDF
      const analysis = await this.analyzePDF(pdfBuffer);
      const pdf = await pdfjsLib.getDocument({ data: pdfBuffer }).promise;

      const pages: PageExtractionResult[] = [];
      let ocrPagesCount = 0;
      let nativePagesCount = 0;

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);

        // Extraction native
        const textContent = await page.getTextContent();
        let pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ')
          .trim();

        let method: 'native' | 'ocr' = 'native';
        let confidence = 1;

        // Si pas assez de texte et forceOCR demandé
        if (forceOCR && pageText.length < MIN_TEXT_PER_PAGE) {
          // OCR non implémenté - marquer comme nécessitant OCR
          method = 'ocr';
          confidence = 0;
          ocrPagesCount++;
          // Dans une vraie implémentation, on appellerait Tesseract ici
          console.warn(`[SmartPDF] Page ${i}: OCR nécessaire mais non implémenté`);
        } else {
          nativePagesCount++;
        }

        onProgress?.({ page: i, total: pdf.numPages, method });

        pages.push({
          pageNumber: i,
          text: pageText,
          method,
          confidence,
          charCount: pageText.length,
        });
      }

      // Combiner tout le texte
      const fullText = pages.map(p => p.text).filter(t => t.length > 0).join('\n\n');

      // Calculer la confiance moyenne
      const avgConfidence = pages.length > 0
        ? pages.reduce((sum, p) => sum + p.confidence, 0) / pages.length
        : 0;

      return {
        success: true,
        text: fullText,
        pages,
        metadata: {
          totalCharacters: fullText.length,
          processingTimeMs: Date.now() - startTime,
          ocrPagesCount,
          nativePagesCount,
          averageConfidence: avgConfidence,
        },
        analysis,
      };

    } catch (error) {
      return {
        success: false,
        text: '',
        pages: [],
        metadata: {
          totalCharacters: 0,
          processingTimeMs: Date.now() - startTime,
          ocrPagesCount: 0,
          nativePagesCount: 0,
          averageConfidence: 0,
        },
        analysis: {
          type: 'scanned',
          totalPages: 0,
          pagesWithText: 0,
          pagesNeedingOCR: 0,
          confidence: 0,
          textDensity: 0,
          hasImages: false,
          estimatedProcessingTime: 0,
        },
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Chunking intelligent avec préservation de la structure
   */
  chunkText(
    text: string,
    options: ChunkOptions = {}
  ): ChunkResult[] {
    const {
      maxChunkSize = 1500,
      minChunkSize = 100,
      overlap = 200,
      preserveParagraphs = true,
    } = options;

    const chunks: ChunkResult[] = [];

    if (!text || text.trim().length === 0) {
      return chunks;
    }

    if (preserveParagraphs) {
      // Découper par paragraphes d'abord
      const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 0);

      let currentChunk = '';
      let currentStart = 0;
      let charOffset = 0;

      for (const paragraph of paragraphs) {
        const trimmedPara = paragraph.trim();

        if (currentChunk.length + trimmedPara.length > maxChunkSize && currentChunk.length >= minChunkSize) {
          // Sauvegarder le chunk actuel
          chunks.push({
            content: currentChunk.trim(),
            index: chunks.length,
            metadata: {
              startChar: currentStart,
              endChar: charOffset,
              pageNumbers: [], // À enrichir si besoin
            },
          });

          // Nouveau chunk avec overlap
          const overlapText = currentChunk.slice(-overlap);
          currentChunk = overlapText + '\n\n' + trimmedPara;
          currentStart = Math.max(0, charOffset - overlap);
        } else {
          currentChunk += (currentChunk ? '\n\n' : '') + trimmedPara;
        }

        charOffset += paragraph.length + 2; // +2 pour \n\n
      }

      // Dernier chunk
      if (currentChunk.trim().length >= minChunkSize) {
        chunks.push({
          content: currentChunk.trim(),
          index: chunks.length,
          metadata: {
            startChar: currentStart,
            endChar: charOffset,
            pageNumbers: [],
          },
        });
      }
    } else {
      // Chunking simple par taille
      for (let i = 0; i < text.length; i += maxChunkSize - overlap) {
        const chunk = text.slice(i, i + maxChunkSize);
        if (chunk.trim().length >= minChunkSize) {
          chunks.push({
            content: chunk.trim(),
            index: chunks.length,
            metadata: {
              startChar: i,
              endChar: Math.min(i + maxChunkSize, text.length),
              pageNumbers: [],
            },
          });
        }
      }
    }

    return chunks;
  }

  /**
   * Chunking avec préservation des sections/titres
   */
  chunkTextWithSections(
    text: string,
    options: ChunkOptions = {}
  ): ChunkResult[] {
    const {
      maxChunkSize = 1500,
      minChunkSize = 100,
      overlap = 200,
    } = options;

    // Patterns pour détecter les titres/sections
    const sectionPatterns = [
      /^#{1,6}\s+.+$/gm,           // Markdown headers
      /^[A-Z][A-Z\s]{3,}$/gm,      // ALL CAPS lines
      /^\d+\.\s+[A-Z].+$/gm,       // Numbered sections
      /^Article\s+\d+/gmi,         // Articles juridiques
      /^Chapitre\s+\d+/gmi,        // Chapitres
    ];

    // Trouver toutes les sections
    const sections: { start: number; title: string }[] = [];

    for (const pattern of sectionPatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        sections.push({
          start: match.index,
          title: match[0].trim(),
        });
      }
    }

    // Trier par position
    sections.sort((a, b) => a.start - b.start);

    const chunks: ChunkResult[] = [];
    let lastEnd = 0;

    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      const nextStart = sections[i + 1]?.start || text.length;
      const sectionText = text.slice(section.start, nextStart);

      // Si la section est trop longue, la découper
      if (sectionText.length > maxChunkSize) {
        const subChunks = this.chunkText(sectionText, {
          maxChunkSize,
          minChunkSize,
          overlap,
          preserveParagraphs: true,
        });

        for (const subChunk of subChunks) {
          chunks.push({
            ...subChunk,
            index: chunks.length,
            metadata: {
              ...subChunk.metadata,
              startChar: section.start + subChunk.metadata.startChar,
              endChar: section.start + subChunk.metadata.endChar,
            },
          });
        }
      } else if (sectionText.trim().length >= minChunkSize) {
        chunks.push({
          content: sectionText.trim(),
          index: chunks.length,
          metadata: {
            startChar: section.start,
            endChar: nextStart,
            pageNumbers: [],
          },
        });
      }

      lastEnd = nextStart;
    }

    // Traiter le texte avant la première section
    if (sections.length > 0 && sections[0].start > minChunkSize) {
      const preText = text.slice(0, sections[0].start).trim();
      if (preText.length >= minChunkSize) {
        chunks.unshift({
          content: preText,
          index: 0,
          metadata: {
            startChar: 0,
            endChar: sections[0].start,
            pageNumbers: [],
          },
        });
        // Réindexer
        chunks.forEach((c, i) => c.index = i);
      }
    }

    // Si pas de sections détectées, utiliser le chunking standard
    if (chunks.length === 0) {
      return this.chunkText(text, options);
    }

    return chunks;
  }

  /**
   * Nettoie le texte extrait
   */
  cleanText(text: string): string {
    return text
      // Normaliser les espaces
      .replace(/\s+/g, ' ')
      // Supprimer les caractères de contrôle
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
      // Normaliser les sauts de ligne
      .replace(/\r\n/g, '\n')
      // Supprimer les lignes vides multiples
      .replace(/\n{3,}/g, '\n\n')
      // Supprimer les espaces en début/fin de ligne
      .split('\n')
      .map(line => line.trim())
      .join('\n')
      .trim();
  }

  /**
   * Détecte si le texte semble être du bruit OCR
   */
  isOCRNoise(text: string): boolean {
    if (!text || text.length < 10) return true;

    // Ratio de caractères alphanumériques
    const alphanumeric = (text.match(/[a-zA-Z0-9àâäéèêëïîôùûüç]/g) || []).length;
    const ratio = alphanumeric / text.length;

    // Mots reconnaissables (longueur >= 3)
    const words = text.split(/\s+/).filter(w => w.length >= 3);
    const avgWordLength = words.length > 0
      ? words.reduce((sum, w) => sum + w.length, 0) / words.length
      : 0;

    // Critères de bruit
    if (ratio < 0.5) return true;  // Trop peu de caractères alphanumériques
    if (avgWordLength < 2 || avgWordLength > 15) return true;  // Mots anormaux
    if (words.length < 3) return true;  // Pas assez de mots

    return false;
  }
}

export const smartPDFProcessor = new SmartPDFProcessor();
export default smartPDFProcessor;
