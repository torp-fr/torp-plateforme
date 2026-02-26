/**
 * Service d'extraction OCR amélioré
 * Utilise PDF.js avec post-traitement intelligent pour les devis BTP
 */

import * as pdfjsLib from 'pdfjs-dist';
import { initPdfJs } from '@/lib/pdf';

// Initialize PDF.js with centralized configuration
initPdfJs();

export interface OcrExtractionResult {
  text: string;
  pages: PageContent[];
  metadata: DocumentMetadata;
  tables: TableExtraction[];
  confidence: number;
}

export interface PageContent {
  pageNumber: number;
  text: string;
  lines: TextLine[];
  layout: 'single_column' | 'two_columns' | 'table_heavy' | 'mixed';
}

export interface TextLine {
  text: string;
  y: number;
  x: number;
  width: number;
  height: number;
  fontSize: number;
  isBold: boolean;
  isHeader: boolean;
}

export interface DocumentMetadata {
  pageCount: number;
  title?: string;
  author?: string;
  creationDate?: Date;
  producer?: string;
  hasImages: boolean;
  hasScannedContent: boolean;
}

export interface TableExtraction {
  pageNumber: number;
  rows: TableRow[];
  headers?: string[];
  type: 'price_table' | 'lot_table' | 'material_table' | 'unknown';
}

export interface TableRow {
  cells: string[];
  isHeader: boolean;
  hasPrice: boolean;
}

/**
 * Service OCR amélioré pour l'extraction de devis BTP
 */
export class OcrExtractorService {
  // Patterns pour la détection de structure BTP
  private static readonly PRICE_PATTERN = /(\d[\d\s]*[,.]?\d*)\s*€/g;
  private static readonly LOT_PATTERN = /^(LOT\s*\d+|N°\s*\d+|[A-Z][\d]+)\s*[-:.]?\s*/i;
  private static readonly QUANTITY_PATTERN = /(\d+[,.]?\d*)\s*(u|ml|m²|m³|m2|m3|unité|pièce|forfait|ens|h|heures?)/gi;
  private static readonly HEADER_KEYWORDS = [
    'désignation', 'description', 'prix unitaire', 'quantité', 'total',
    'montant', 'ht', 'ttc', 'unité', 'qté', 'p.u.', 'ref', 'référence'
  ];

  /**
   * Extraction complète d'un fichier PDF
   */
  async extractFromFile(file: File): Promise<OcrExtractionResult> {
    const arrayBuffer = await file.arrayBuffer();
    return this.extractFromBuffer(arrayBuffer);
  }

  /**
   * Extraction depuis un buffer
   */
  async extractFromBuffer(buffer: ArrayBuffer): Promise<OcrExtractionResult> {
    const loadingTask = pdfjsLib.getDocument({ data: buffer });
    const pdf = await loadingTask.promise;

    const metadata = await this.extractMetadata(pdf);
    const pages: PageContent[] = [];
    const tables: TableExtraction[] = [];
    let fullText = '';

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const pageContent = await this.extractPageContent(page, pageNum);
      pages.push(pageContent);
      fullText += pageContent.text + '\n\n';

      // Extraction des tableaux
      const pageTables = this.detectTables(pageContent);
      tables.push(...pageTables);
    }

    // Calcul de la confiance basée sur la qualité d'extraction
    const confidence = this.calculateConfidence(pages, tables);

    return {
      text: this.cleanText(fullText),
      pages,
      metadata,
      tables,
      confidence,
    };
  }

  /**
   * Extraction des métadonnées du PDF
   */
  private async extractMetadata(pdf: pdfjsLib.PDFDocumentProxy): Promise<DocumentMetadata> {
    const info = await pdf.getMetadata();
    const data = info?.info as Record<string, unknown> | undefined;

    return {
      pageCount: pdf.numPages,
      title: data?.Title as string | undefined,
      author: data?.Author as string | undefined,
      creationDate: data?.CreationDate
        ? this.parsePdfDate(data.CreationDate as string)
        : undefined,
      producer: data?.Producer as string | undefined,
      hasImages: false, // Sera déterminé par page
      hasScannedContent: false,
    };
  }

  /**
   * Extraction du contenu d'une page avec analyse de structure
   */
  private async extractPageContent(
    page: pdfjsLib.PDFPageProxy,
    pageNumber: number
  ): Promise<PageContent> {
    const textContent = await page.getTextContent();
    const viewport = page.getViewport({ scale: 1.0 });

    const lines: TextLine[] = [];
    let currentLine: TextLine | null = null;
    let previousY = -1;

    // Grouper les éléments par ligne
    for (const item of textContent.items) {
      if (!('str' in item)) continue;

      const textItem = item as pdfjsLib.TextItem;
      const transform = textItem.transform;
      const x = transform[4];
      const y = viewport.height - transform[5];
      const height = textItem.height || 12;
      const fontSize = Math.abs(transform[0]) || 12;

      // Détecter si c'est une nouvelle ligne (tolérance de 3px)
      if (Math.abs(y - previousY) > 3 && currentLine) {
        lines.push(currentLine);
        currentLine = null;
      }

      if (!currentLine) {
        currentLine = {
          text: textItem.str,
          y,
          x,
          width: textItem.width || 0,
          height,
          fontSize,
          isBold: this.detectBold(textItem),
          isHeader: false,
        };
      } else {
        currentLine.text += ' ' + textItem.str;
        currentLine.width = Math.max(currentLine.width, x + (textItem.width || 0) - currentLine.x);
      }

      previousY = y;
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    // Analyser les en-têtes
    this.markHeaders(lines);

    // Déterminer le layout de la page
    const layout = this.detectPageLayout(lines, viewport.width);

    // Assembler le texte
    const text = lines.map(l => l.text).join('\n');

    return {
      pageNumber,
      text,
      lines,
      layout,
    };
  }

  /**
   * Détection si le texte est en gras (heuristique basée sur fontName)
   */
  private detectBold(item: pdfjsLib.TextItem): boolean {
    const fontName = item.fontName?.toLowerCase() || '';
    return fontName.includes('bold') ||
           fontName.includes('black') ||
           fontName.includes('heavy');
  }

  /**
   * Marquer les lignes d'en-tête
   */
  private markHeaders(lines: TextLine[]): void {
    for (const line of lines) {
      const lowerText = line.text.toLowerCase();
      const isHeaderByKeyword = OcrExtractorService.HEADER_KEYWORDS.some(
        kw => lowerText.includes(kw)
      );
      const isHeaderByStyle = line.isBold && line.fontSize > 10;
      const isLotHeader = OcrExtractorService.LOT_PATTERN.test(line.text);

      line.isHeader = isHeaderByKeyword || isHeaderByStyle || isLotHeader;
    }
  }

  /**
   * Détection du layout de page
   */
  private detectPageLayout(
    lines: TextLine[],
    pageWidth: number
  ): 'single_column' | 'two_columns' | 'table_heavy' | 'mixed' {
    if (lines.length === 0) return 'single_column';

    // Compter les lignes qui semblent être dans un tableau
    let tableLineCount = 0;
    let multiColumnCount = 0;

    for (const line of lines) {
      // Ligne de tableau probable (contient plusieurs éléments espacés)
      if (this.looksLikeTableRow(line.text)) {
        tableLineCount++;
      }

      // Détection multi-colonne (texte ne commençant pas au bord gauche)
      if (line.x > pageWidth * 0.4) {
        multiColumnCount++;
      }
    }

    const tableRatio = tableLineCount / lines.length;
    const multiColumnRatio = multiColumnCount / lines.length;

    if (tableRatio > 0.5) return 'table_heavy';
    if (multiColumnRatio > 0.3) return 'two_columns';
    if (tableRatio > 0.2 || multiColumnRatio > 0.1) return 'mixed';
    return 'single_column';
  }

  /**
   * Vérifier si une ligne ressemble à une ligne de tableau
   */
  private looksLikeTableRow(text: string): boolean {
    // Contient au moins 3 séparateurs (espaces multiples ou tabs)
    const separators = text.match(/\s{2,}|\t/g);
    if (separators && separators.length >= 2) return true;

    // Contient un prix ET une quantité
    const hasPrice = OcrExtractorService.PRICE_PATTERN.test(text);
    const hasQuantity = OcrExtractorService.QUANTITY_PATTERN.test(text);
    return hasPrice && hasQuantity;
  }

  /**
   * Détection et extraction des tableaux
   */
  private detectTables(page: PageContent): TableExtraction[] {
    const tables: TableExtraction[] = [];
    let currentTable: TableExtraction | null = null;

    for (const line of page.lines) {
      if (this.looksLikeTableRow(line.text)) {
        if (!currentTable) {
          currentTable = {
            pageNumber: page.pageNumber,
            rows: [],
            type: 'unknown',
          };
        }

        const cells = this.parseTableRow(line.text);
        const hasPrice = OcrExtractorService.PRICE_PATTERN.test(line.text);

        currentTable.rows.push({
          cells,
          isHeader: line.isHeader,
          hasPrice,
        });

        // Détecter le type de tableau
        if (line.isHeader && !currentTable.headers) {
          currentTable.headers = cells;
          currentTable.type = this.classifyTableType(cells);
        }
      } else if (currentTable && currentTable.rows.length >= 2) {
        // Fin du tableau
        tables.push(currentTable);
        currentTable = null;
      }
    }

    if (currentTable && currentTable.rows.length >= 2) {
      tables.push(currentTable);
    }

    return tables;
  }

  /**
   * Parser une ligne de tableau en cellules
   */
  private parseTableRow(text: string): string[] {
    // Séparer par espaces multiples ou tabs
    return text
      .split(/\s{2,}|\t/)
      .map(cell => cell.trim())
      .filter(cell => cell.length > 0);
  }

  /**
   * Classifier le type de tableau
   */
  private classifyTableType(
    headers: string[]
  ): 'price_table' | 'lot_table' | 'material_table' | 'unknown' {
    const headerText = headers.join(' ').toLowerCase();

    if (headerText.includes('prix') || headerText.includes('montant') || headerText.includes('total')) {
      return 'price_table';
    }
    if (headerText.includes('lot') || headerText.includes('poste')) {
      return 'lot_table';
    }
    if (headerText.includes('matéri') || headerText.includes('fourniture')) {
      return 'material_table';
    }

    return 'unknown';
  }

  /**
   * Calculer la confiance de l'extraction
   */
  private calculateConfidence(pages: PageContent[], tables: TableExtraction[]): number {
    if (pages.length === 0) return 0;

    let score = 0;
    let factors = 0;

    // Qualité du texte extrait
    const avgTextLength = pages.reduce((sum, p) => sum + p.text.length, 0) / pages.length;
    if (avgTextLength > 500) score += 30;
    else if (avgTextLength > 200) score += 20;
    else if (avgTextLength > 50) score += 10;
    factors++;

    // Présence de tableaux structurés
    if (tables.length > 0) {
      score += 25;
      // Bonus si tableaux avec en-têtes
      const tablesWithHeaders = tables.filter(t => t.headers && t.headers.length > 0).length;
      score += Math.min(15, tablesWithHeaders * 5);
    }
    factors++;

    // Présence de prix détectés
    const allText = pages.map(p => p.text).join(' ');
    const priceMatches = allText.match(OcrExtractorService.PRICE_PATTERN);
    if (priceMatches && priceMatches.length >= 5) score += 20;
    else if (priceMatches && priceMatches.length >= 1) score += 10;
    factors++;

    // Présence de lots
    const lotMatches = allText.match(OcrExtractorService.LOT_PATTERN);
    if (lotMatches && lotMatches.length >= 2) score += 10;
    factors++;

    return Math.min(100, Math.round(score));
  }

  /**
   * Nettoyer le texte extrait
   */
  private cleanText(text: string): string {
    return text
      // Normaliser les espaces
      .replace(/\s+/g, ' ')
      // Supprimer les caractères de contrôle
      .replace(/[\x00-\x1F\x7F]/g, '')
      // Normaliser les sauts de ligne
      .replace(/\n\s*\n/g, '\n\n')
      // Trim
      .trim();
  }

  /**
   * Parser une date PDF
   */
  private parsePdfDate(dateStr: string): Date | undefined {
    // Format: D:YYYYMMDDHHmmss
    const match = dateStr.match(/D:(\d{4})(\d{2})(\d{2})(\d{2})?(\d{2})?(\d{2})?/);
    if (!match) return undefined;

    const [, year, month, day, hour = '0', minute = '0', second = '0'] = match;
    return new Date(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day),
      parseInt(hour),
      parseInt(minute),
      parseInt(second)
    );
  }

  /**
   * Extraire uniquement les lignes de prix du document
   */
  extractPriceLines(result: OcrExtractionResult): string[] {
    const priceLines: string[] = [];

    for (const page of result.pages) {
      for (const line of page.lines) {
        if (OcrExtractorService.PRICE_PATTERN.test(line.text)) {
          priceLines.push(line.text);
        }
      }
    }

    return priceLines;
  }

  /**
   * Extraire les informations d'en-tête du devis
   */
  extractHeaderInfo(result: OcrExtractionResult): {
    entreprise?: string;
    client?: string;
    date?: string;
    reference?: string;
    objet?: string;
  } {
    // Chercher dans les premières lignes
    const firstPageLines = result.pages[0]?.lines || [];
    const headerLines = firstPageLines.slice(0, 30);

    const info: Record<string, string | undefined> = {};

    for (const line of headerLines) {
      const text = line.text.toLowerCase();

      // Entreprise (souvent en haut, en gras)
      if (line.isBold && line.y < 100 && !info.entreprise) {
        info.entreprise = line.text;
      }

      // Date
      if (text.includes('date') || /\d{2}[\/.-]\d{2}[\/.-]\d{4}/.test(text)) {
        const dateMatch = line.text.match(/\d{2}[\/.-]\d{2}[\/.-]\d{4}/);
        if (dateMatch) info.date = dateMatch[0];
      }

      // Référence
      if (text.includes('réf') || text.includes('n°') || text.includes('devis')) {
        const refMatch = line.text.match(/(?:réf|n°|devis)[^\d]*(\S+)/i);
        if (refMatch) info.reference = refMatch[1];
      }

      // Objet
      if (text.includes('objet') || text.includes('travaux')) {
        info.objet = line.text.replace(/^objet\s*:?\s*/i, '');
      }
    }

    return info;
  }
}

export const ocrExtractorService = new OcrExtractorService();
export default ocrExtractorService;
