/**
 * Service de parsing de devis BTP
 * Transforme le texte brut en structure de données exploitable
 */

import { OcrExtractionResult, TableExtraction } from './ocr-extractor.service';

export interface ParsedDevis {
  // Informations générales
  reference?: string;
  date?: string;
  validite?: string;

  // Entreprise
  entreprise: {
    nom?: string;
    siret?: string;
    adresse?: string;
    telephone?: string;
    email?: string;
    rge?: boolean;
    assurance?: string;
  };

  // Client
  client: {
    nom?: string;
    adresse?: string;
    telephone?: string;
    email?: string;
  };

  // Projet
  projet: {
    objet?: string;
    lieu?: string;
    type?: string;
  };

  // Lots et lignes
  lots: DevisLot[];

  // Totaux
  totaux: {
    totalHT: number;
    tva: number;
    tauxTva: number;
    totalTTC: number;
    acompte?: number;
  };

  // Métadonnées d'extraction
  metadata: {
    confidence: number;
    extractedAt: Date;
    warnings: string[];
    sourcePageCount: number;
  };
}

export interface DevisLot {
  numero?: string;
  titre: string;
  lignes: DevisLigne[];
  sousTotalHT?: number;
}

export interface DevisLigne {
  reference?: string;
  designation: string;
  quantite?: number;
  unite?: string;
  prixUnitaire?: number;
  totalHT?: number;
  tva?: number;
  categorie?: LigneCategorie;
}

export type LigneCategorie =
  | 'main_oeuvre'
  | 'fourniture'
  | 'materiau'
  | 'location'
  | 'sous_traitance'
  | 'forfait'
  | 'autre';

/**
 * Service de parsing structuré des devis
 */
export class DevisParserService {
  // Patterns de détection
  private static readonly SIRET_PATTERN = /(?:siret|siren)\s*:?\s*(\d[\d\s]{12,16})/i;
  private static readonly TVA_PATTERN = /(?:tva|t\.v\.a\.?)\s*(?:à|:)?\s*(\d+(?:[,.]?\d+)?)\s*%/i;
  private static readonly PHONE_PATTERN = /(?:tél|tel|téléphone|phone)\s*:?\s*((?:\+33|0)\s*[1-9](?:[\s.-]*\d{2}){4})/i;
  private static readonly EMAIL_PATTERN = /[\w.-]+@[\w.-]+\.\w+/i;
  private static readonly PRICE_PATTERN = /(\d[\d\s]*(?:[,.]?\d{1,2})?)\s*€?$/;
  private static readonly QUANTITY_PATTERN = /^(\d+(?:[,.]?\d+)?)\s*(u|ml|m²|m³|m2|m3|unité|pièce|forfait|ens|h|heures?|jours?|kg|t|l)/i;

  // Mots-clés de catégorisation
  private static readonly MAIN_OEUVRE_KEYWORDS = [
    'main d\'oeuvre', 'mo', 'pose', 'installation', 'montage',
    'démontage', 'heure', 'journée', 'intervention'
  ];
  private static readonly FOURNITURE_KEYWORDS = [
    'fourniture', 'matériel', 'équipement', 'appareil',
    'robinet', 'radiateur', 'chaudière', 'vmce'
  ];
  private static readonly MATERIAU_KEYWORDS = [
    'matériau', 'béton', 'ciment', 'parpaing', 'brique',
    'plaque', 'isolant', 'laine', 'tube', 'tuyau', 'câble'
  ];
  private static readonly LOCATION_KEYWORDS = [
    'location', 'échafaudage', 'nacelle', 'benne', 'container'
  ];

  /**
   * Parser un résultat d'extraction OCR en devis structuré
   */
  parseFromOcr(ocrResult: OcrExtractionResult): ParsedDevis {
    const warnings: string[] = [];

    // Extraire les informations de base
    const entreprise = this.extractEntreprise(ocrResult.text);
    const client = this.extractClient(ocrResult.text);
    const projet = this.extractProjet(ocrResult.text);
    const reference = this.extractReference(ocrResult.text);
    const date = this.extractDate(ocrResult.text);

    // Extraire les lots et lignes
    const lots = this.extractLots(ocrResult);

    // Si pas de lots trouvés via structure, essayer via tableaux
    if (lots.length === 0 && ocrResult.tables.length > 0) {
      const lotsFromTables = this.extractLotsFromTables(ocrResult.tables);
      lots.push(...lotsFromTables);
      if (lotsFromTables.length > 0) {
        warnings.push('Lots extraits depuis tableaux (structure moins fiable)');
      }
    }

    // Calculer les totaux
    const totaux = this.calculateTotaux(ocrResult.text, lots);

    // Valider la cohérence
    const validationWarnings = this.validateDevis(lots, totaux);
    warnings.push(...validationWarnings);

    return {
      reference,
      date,
      entreprise,
      client,
      projet,
      lots,
      totaux,
      metadata: {
        confidence: ocrResult.confidence,
        extractedAt: new Date(),
        warnings,
        sourcePageCount: ocrResult.metadata.pageCount,
      },
    };
  }

  /**
   * Extraire les informations entreprise
   */
  private extractEntreprise(text: string): ParsedDevis['entreprise'] {
    const entreprise: ParsedDevis['entreprise'] = {};

    // SIRET
    const siretMatch = text.match(DevisParserService.SIRET_PATTERN);
    if (siretMatch) {
      entreprise.siret = siretMatch[1].replace(/\s/g, '');
    }

    // Téléphone
    const phoneMatch = text.match(DevisParserService.PHONE_PATTERN);
    if (phoneMatch) {
      entreprise.telephone = phoneMatch[1];
    }

    // Email
    const emailMatch = text.match(DevisParserService.EMAIL_PATTERN);
    if (emailMatch) {
      entreprise.email = emailMatch[0];
    }

    // RGE
    entreprise.rge = /rge|reconnu\s+garant/i.test(text);

    // Assurance
    const assuranceMatch = text.match(/(?:assurance|décennale|rc\s*pro)[^.]*(?:n°|numéro)?\s*(\S+)/i);
    if (assuranceMatch) {
      entreprise.assurance = assuranceMatch[1];
    }

    return entreprise;
  }

  /**
   * Extraire les informations client
   */
  private extractClient(text: string): ParsedDevis['client'] {
    const client: ParsedDevis['client'] = {};

    // Chercher la section client
    const clientSection = text.match(/(?:client|destinataire|pour)\s*:?\s*([^\n]+(?:\n[^\n]+){0,4})/i);
    if (clientSection) {
      const lines = clientSection[1].split('\n').map(l => l.trim()).filter(Boolean);
      if (lines[0]) client.nom = lines[0];
      if (lines.length > 1) {
        client.adresse = lines.slice(1).join(', ');
      }
    }

    return client;
  }

  /**
   * Extraire les informations projet
   */
  private extractProjet(text: string): ParsedDevis['projet'] {
    const projet: ParsedDevis['projet'] = {};

    // Objet
    const objetMatch = text.match(/(?:objet|nature\s*des\s*travaux|travaux)\s*:?\s*([^\n]+)/i);
    if (objetMatch) {
      projet.objet = objetMatch[1].trim();
    }

    // Lieu
    const lieuMatch = text.match(/(?:lieu|chantier|adresse\s*travaux)\s*:?\s*([^\n]+)/i);
    if (lieuMatch) {
      projet.lieu = lieuMatch[1].trim();
    }

    // Type de travaux
    if (/rénovation|rénover/i.test(text)) projet.type = 'renovation';
    else if (/construction|neuf/i.test(text)) projet.type = 'construction';
    else if (/extension|agrandissement/i.test(text)) projet.type = 'extension';
    else if (/entretien|maintenance/i.test(text)) projet.type = 'entretien';

    return projet;
  }

  /**
   * Extraire la référence du devis
   */
  private extractReference(text: string): string | undefined {
    const patterns = [
      /(?:devis|référence|réf|n°)\s*:?\s*([A-Z0-9][\w-]{3,20})/i,
      /([A-Z]{2,4}[-/]\d{4,}[-/]?\d*)/,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) return match[1];
    }

    return undefined;
  }

  /**
   * Extraire la date du devis
   */
  private extractDate(text: string): string | undefined {
    const patterns = [
      /(?:date|établi\s*le|fait\s*le)\s*:?\s*(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4})/i,
      /(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{4})/,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) return match[1];
    }

    return undefined;
  }

  /**
   * Extraire les lots et lignes du devis
   */
  private extractLots(ocrResult: OcrExtractionResult): DevisLot[] {
    const lots: DevisLot[] = [];
    let currentLot: DevisLot | null = null;

    for (const page of ocrResult.pages) {
      for (const line of page.lines) {
        const text = line.text.trim();
        if (!text) continue;

        // Détection d'un nouveau lot
        const lotMatch = text.match(/^(?:LOT\s*)?(\d+|[A-Z])\s*[-:.]?\s*(.+)/i);
        if (lotMatch && line.isHeader) {
          if (currentLot && currentLot.lignes.length > 0) {
            lots.push(currentLot);
          }
          currentLot = {
            numero: lotMatch[1],
            titre: lotMatch[2],
            lignes: [],
          };
          continue;
        }

        // Si pas de lot courant, créer un lot par défaut
        if (!currentLot) {
          currentLot = {
            titre: 'Travaux',
            lignes: [],
          };
        }

        // Parser la ligne comme ligne de devis
        const devisLigne = this.parseLigne(text);
        if (devisLigne) {
          currentLot.lignes.push(devisLigne);
        }
      }
    }

    if (currentLot && currentLot.lignes.length > 0) {
      lots.push(currentLot);
    }

    // Calculer les sous-totaux
    for (const lot of lots) {
      lot.sousTotalHT = lot.lignes.reduce((sum, l) => sum + (l.totalHT || 0), 0);
    }

    return lots;
  }

  /**
   * Extraire les lots depuis les tableaux détectés
   */
  private extractLotsFromTables(tables: TableExtraction[]): DevisLot[] {
    const lots: DevisLot[] = [];

    for (const table of tables) {
      if (table.type !== 'price_table' && table.rows.length < 3) continue;

      const lot: DevisLot = {
        titre: `Tableau page ${table.pageNumber}`,
        lignes: [],
      };

      // Trouver les indices des colonnes
      const columnIndices = this.detectColumnIndices(table.headers || []);

      for (const row of table.rows) {
        if (row.isHeader) continue;

        const ligne = this.parseTableRow(row.cells, columnIndices);
        if (ligne) {
          lot.lignes.push(ligne);
        }
      }

      if (lot.lignes.length > 0) {
        lot.sousTotalHT = lot.lignes.reduce((sum, l) => sum + (l.totalHT || 0), 0);
        lots.push(lot);
      }
    }

    return lots;
  }

  /**
   * Détecter les indices des colonnes dans un tableau
   */
  private detectColumnIndices(headers: string[]): {
    designation: number;
    quantite: number;
    unite: number;
    prixUnitaire: number;
    total: number;
  } {
    const indices = {
      designation: 0,
      quantite: -1,
      unite: -1,
      prixUnitaire: -1,
      total: -1,
    };

    headers.forEach((header, i) => {
      const h = header.toLowerCase();
      if (h.includes('désignation') || h.includes('description') || h.includes('libellé')) {
        indices.designation = i;
      } else if (h.includes('qté') || h.includes('quantité') || h.includes('qt')) {
        indices.quantite = i;
      } else if (h.includes('unité') || h.includes('u.')) {
        indices.unite = i;
      } else if (h.includes('p.u') || h.includes('prix unitaire') || h.includes('pu')) {
        indices.prixUnitaire = i;
      } else if (h.includes('total') || h.includes('montant') || h.includes('ht')) {
        indices.total = i;
      }
    });

    return indices;
  }

  /**
   * Parser une ligne de tableau
   */
  private parseTableRow(
    cells: string[],
    columnIndices: ReturnType<typeof this.detectColumnIndices>
  ): DevisLigne | null {
    if (cells.length < 2) return null;

    const designation = cells[columnIndices.designation] || cells[0];
    if (!designation || designation.length < 3) return null;

    const ligne: DevisLigne = {
      designation,
    };

    // Quantité
    if (columnIndices.quantite >= 0 && cells[columnIndices.quantite]) {
      ligne.quantite = this.parseNumber(cells[columnIndices.quantite]);
    }

    // Unité
    if (columnIndices.unite >= 0 && cells[columnIndices.unite]) {
      ligne.unite = cells[columnIndices.unite];
    }

    // Prix unitaire
    if (columnIndices.prixUnitaire >= 0 && cells[columnIndices.prixUnitaire]) {
      ligne.prixUnitaire = this.parseNumber(cells[columnIndices.prixUnitaire]);
    }

    // Total
    if (columnIndices.total >= 0 && cells[columnIndices.total]) {
      ligne.totalHT = this.parseNumber(cells[columnIndices.total]);
    } else if (ligne.quantite && ligne.prixUnitaire) {
      ligne.totalHT = ligne.quantite * ligne.prixUnitaire;
    }

    // Catégorie
    ligne.categorie = this.categoriseLigne(designation);

    return ligne;
  }

  /**
   * Parser une ligne de texte brut en ligne de devis
   */
  private parseLigne(text: string): DevisLigne | null {
    // Ignorer les lignes trop courtes ou les en-têtes
    if (text.length < 10) return null;
    if (/^(total|sous-total|tva|ttc|ht)/i.test(text)) return null;

    const ligne: DevisLigne = {
      designation: text,
    };

    // Extraire le prix en fin de ligne
    const priceMatch = text.match(DevisParserService.PRICE_PATTERN);
    if (priceMatch) {
      ligne.totalHT = this.parseNumber(priceMatch[1]);
      ligne.designation = text.replace(priceMatch[0], '').trim();
    }

    // Extraire quantité et unité
    const qtyMatch = text.match(DevisParserService.QUANTITY_PATTERN);
    if (qtyMatch) {
      ligne.quantite = this.parseNumber(qtyMatch[1]);
      ligne.unite = qtyMatch[2];
    }

    // Si pas de prix détecté, ignorer
    if (!ligne.totalHT && !ligne.quantite) return null;

    // Catégorie
    ligne.categorie = this.categoriseLigne(ligne.designation);

    return ligne;
  }

  /**
   * Parser un nombre depuis une chaîne
   */
  private parseNumber(str: string): number {
    const cleaned = str
      .replace(/\s/g, '')
      .replace(',', '.')
      .replace(/[^\d.]/g, '');
    return parseFloat(cleaned) || 0;
  }

  /**
   * Catégoriser une ligne de devis
   */
  private categoriseLigne(designation: string): LigneCategorie {
    const lower = designation.toLowerCase();

    if (DevisParserService.MAIN_OEUVRE_KEYWORDS.some(kw => lower.includes(kw))) {
      return 'main_oeuvre';
    }
    if (DevisParserService.LOCATION_KEYWORDS.some(kw => lower.includes(kw))) {
      return 'location';
    }
    if (DevisParserService.MATERIAU_KEYWORDS.some(kw => lower.includes(kw))) {
      return 'materiau';
    }
    if (DevisParserService.FOURNITURE_KEYWORDS.some(kw => lower.includes(kw))) {
      return 'fourniture';
    }
    if (/forfait|ens|ensemble/i.test(lower)) {
      return 'forfait';
    }

    return 'autre';
  }

  /**
   * Calculer les totaux du devis
   */
  private calculateTotaux(text: string, lots: DevisLot[]): ParsedDevis['totaux'] {
    // Total calculé depuis les lots
    const totalLotsHT = lots.reduce((sum, lot) => sum + (lot.sousTotalHT || 0), 0);

    // Chercher le total dans le texte
    let totalHT = totalLotsHT;
    const totalHTMatch = text.match(/total\s*h\.?t\.?\s*:?\s*([\d\s,]+)\s*€?/i);
    if (totalHTMatch) {
      const extracted = this.parseNumber(totalHTMatch[1]);
      if (extracted > 0) totalHT = extracted;
    }

    // Taux de TVA
    let tauxTva = 20; // Par défaut
    const tvaMatch = text.match(DevisParserService.TVA_PATTERN);
    if (tvaMatch) {
      tauxTva = parseFloat(tvaMatch[1].replace(',', '.'));
    }

    // Montant TVA
    let tva = totalHT * (tauxTva / 100);
    const tvaAmountMatch = text.match(/(?:montant\s*)?tva\s*:?\s*([\d\s,]+)\s*€/i);
    if (tvaAmountMatch) {
      const extracted = this.parseNumber(tvaAmountMatch[1]);
      if (extracted > 0) tva = extracted;
    }

    // Total TTC
    let totalTTC = totalHT + tva;
    const totalTTCMatch = text.match(/total\s*t\.?t\.?c\.?\s*:?\s*([\d\s,]+)\s*€?/i);
    if (totalTTCMatch) {
      const extracted = this.parseNumber(totalTTCMatch[1]);
      if (extracted > 0) totalTTC = extracted;
    }

    // Acompte
    let acompte: number | undefined;
    const acompteMatch = text.match(/acompte\s*:?\s*([\d\s,]+)\s*€?/i);
    if (acompteMatch) {
      acompte = this.parseNumber(acompteMatch[1]);
    }

    return {
      totalHT,
      tva,
      tauxTva,
      totalTTC,
      acompte,
    };
  }

  /**
   * Valider la cohérence du devis parsé
   */
  private validateDevis(lots: DevisLot[], totaux: ParsedDevis['totaux']): string[] {
    const warnings: string[] = [];

    // Vérifier qu'il y a au moins un lot avec des lignes
    const totalLignes = lots.reduce((sum, lot) => sum + lot.lignes.length, 0);
    if (totalLignes === 0) {
      warnings.push('Aucune ligne de devis détectée');
    }

    // Vérifier la cohérence des totaux
    const calculatedTotal = lots.reduce((sum, lot) => sum + (lot.sousTotalHT || 0), 0);
    if (calculatedTotal > 0 && totaux.totalHT > 0) {
      const diff = Math.abs(calculatedTotal - totaux.totalHT);
      const tolerance = totaux.totalHT * 0.05; // 5% de tolérance
      if (diff > tolerance) {
        warnings.push(`Écart détecté entre total calculé (${calculatedTotal.toFixed(2)}€) et total affiché (${totaux.totalHT.toFixed(2)}€)`);
      }
    }

    // Vérifier la cohérence TTC
    const calculatedTTC = totaux.totalHT + totaux.tva;
    if (Math.abs(calculatedTTC - totaux.totalTTC) > 1) {
      warnings.push('Incohérence entre HT + TVA et TTC');
    }

    return warnings;
  }
}

export const devisParserService = new DevisParserService();
export default devisParserService;
