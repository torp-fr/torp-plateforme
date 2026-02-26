/**
 * Robust PDF Text Extraction Utility
 * Safe, error-handled, production-grade extraction
 *
 * Usage:
 * const text = await extractPdfText(file);
 */

import * as pdfjsLib from 'pdfjs-dist';

interface ExtractionOptions {
  maxPages?: number;
  timeout?: number;
}

/**
 * Extract text from PDF file
 * @param file - PDF File object
 * @param options - Optional extraction parameters
 * @returns Extracted text content
 */
export async function extractPdfText(
  file: File,
  options: ExtractionOptions = {}
): Promise<string> {
  const { maxPages = Infinity, timeout = 30000 } = options;

  try {
    // Convert File to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();

    // Create timeout promise
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error('PDF extraction timeout')),
        timeout
      )
    );

    // Get PDF document with timeout
    const loadingTask = pdfjsLib.getDocument({
      data: arrayBuffer,
    });

    const pdf = await Promise.race([
      loadingTask.promise,
      timeoutPromise,
    ]);

    let text = '';
    const pageCount = Math.min(pdf.numPages, maxPages);

    // Extract text from each page
    for (let i = 1; i <= pageCount; i++) {
      try {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();

        // Convert text items to string
        const pageText = content.items
          .map((item: any) => {
            // Handle text items and operator data
            if (item.str) {
              return item.str;
            }
            return '';
          })
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();

        if (pageText) {
          text += pageText + '\n';
        }

        // Cleanup
        page.cleanup();
      } catch (pageError) {
        console.warn(`Failed to extract page ${i}:`, pageError);
        // Continue with next page instead of failing
        continue;
      }
    }

    // Cleanup document
    pdf.destroy();

    // Validate extraction
    if (!text.trim()) {
      throw new Error('No text content extracted from PDF');
    }

    return text.trim();
  } catch (error) {
    // Detailed error logging for debugging
    const errorMsg = error instanceof Error ? error.message : String(error);

    console.error('❌ PDF extraction failed:', {
      fileName: file.name,
      fileSize: file.size,
      error: errorMsg,
    });

    throw new Error(
      `Failed to extract PDF text: ${errorMsg}`
    );
  }
}

/**
 * Check if file is valid PDF before processing
 */
export function isPdfFile(file: File): boolean {
  return (
    file.type === 'application/pdf' ||
    file.name.toLowerCase().endsWith('.pdf')
  );
}

/**
 * Validate PDF file size (prevents memory issues)
 */
export function validatePdfSize(
  file: File,
  maxSizeMB: number = 100
): boolean {
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  return file.size <= maxSizeBytes;
}
