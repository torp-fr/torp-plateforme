/**
 * PDF Extractor Service
 * Extracts text content from PDF files using PDF.js
 */

import * as pdfjsLib from 'pdfjs-dist';
import { initPdfJs } from '@/lib/pdf';
import { log, warn, error, time, timeEnd } from '@/lib/logger';

// Initialize PDF.js with centralized configuration
initPdfJs();

export interface PDFExtractionResult {
  text: string;
  numPages: number;
}

export class PDFExtractorService {
  /**
   * Extract text from PDF file
   */
  async extractText(file: File): Promise<string> {
    try {
      // Convert File to ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();

      // Load PDF document
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;

      const numPages = pdf.numPages;
      const textParts: string[] = [];

      // Extract text from each page
      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();

        // Concatenate text items
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ');

        textParts.push(pageText);
      }

      const fullText = textParts.join('\n\n');

      if (!fullText || fullText.trim().length === 0) {
        throw new Error('No text content found in PDF');
      }

      log(`[PDF] Extracted ${fullText.length} characters from ${numPages} pages`);

      return fullText;
    } catch (error) {
      console.error('[PDF] Extraction failed:', error);
      throw new Error(`Failed to extract PDF text: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Extract full PDF data including page count
   */
  async extractFullData(file: File): Promise<PDFExtractionResult> {
    const text = await this.extractText(file);
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;

    return {
      text,
      numPages: pdf.numPages,
    };
  }

  /**
   * Validate if file is a readable PDF
   */
  async validatePDF(file: File): Promise<boolean> {
    if (!file.type.includes('pdf') && !file.name.endsWith('.pdf')) {
      return false;
    }

    try {
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      await loadingTask.promise;
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get PDF page count without full extraction
   */
  async getPageCount(file: File): Promise<number> {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      return pdf.numPages;
    } catch (error) {
      console.error('[PDF] Failed to get page count:', error);
      return 0;
    }
  }
}

export const pdfExtractorService = new PDFExtractorService();
export default pdfExtractorService;
