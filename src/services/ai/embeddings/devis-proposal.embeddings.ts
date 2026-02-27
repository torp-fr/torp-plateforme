/**
 * Devis Proposal Vectorization Service
 * Vectorizes the proposal (devis) content to match demand (CCF) format
 * Creates a common vector format for comparative analysis
 *
 * PHASE 36.12: Type safety - uses strict domain interfaces from devis-proposal.types.ts
 */

import type {
  ExtractedDevisData,
  PosteData,
  PricingData,
  TimelineData,
  EntrepriseData,
  TravauxData,
  isExtractedDevisData,
  isPosteDataArray,
} from '@/types/devis-proposal.types';

export interface DevisProposalVector {
  // Work type vectorization (matches CCF typeEmbedding)
  typeVecteur: string[];

  // Price analysis vectorization
  prixVecteur: PrixVector;

  // Timeline/Deadlines vectorization
  delaisVecteur: DelaisVector;

  // Company/Provider profile
  entrepriseVecteur: EntrepriseVector;

  // Scope & completeness
  perimeterVecteur: PerimeterVector;

  // Quality & compliance indicators
  qualiteVecteur: QualiteVector;

  // Service level indicators
  serviceVecteur: ServiceVector;
}

export interface PrixVector {
  montantTotal: number;
  montantHT?: number;
  tva?: number;
  postes: PosteVector[];
  repartition: {
    // Percentage breakdown by category
    maindOeuvre?: number;    // Labor %
    materiaux?: number;      // Materials %
    autres?: number;         // Other %
  };
  transparence: 'tres-detaille' | 'detaille' | 'global' | 'flou';
  alignmentWithBudget?: 'excellent' | 'bon' | 'acceptable' | 'depassement' | 'severement-depasse';
}

export interface PosteVector {
  designation: string;
  quantite?: number;
  unite?: string;
  prixUnitaire?: number;
  prixTotal: number;
  category?: string;
  detailLevel: 'tres-detaille' | 'detaille' | 'global';
}

export interface DelaisVector {
  dateDebut?: string;
  dateFin?: string;
  dureeEstimeeJours?: number;
  alignmentWithUrgency?: 'excellent' | 'bon' | 'acceptable' | 'serré' | 'impossible';
  planningDetaille: boolean;
  phases?: string[];
  jalons?: {
    date: string;
    description: string;
  }[];
}

export interface EntrepriseVector {
  nom: string;
  siret?: string;
  certifications: string[];
  rge: boolean;
  assurances: {
    decennale: boolean;
    rcPro: boolean;
  };
  reputation: 'verifiee' | 'probable' | 'inconnue' | 'douteuse';
  scoreConformite: number; // 0-100
}

export interface PerimeterVector {
  description: string;
  elementsInclus: string[];
  elementsExclus: string[];
  conditions: string[];
  claritePerimetre: 'tres-clair' | 'clair' | 'acceptable' | 'ambigu' | 'flou';
}

export interface QualiteVector {
  normes: string[];
  qualiteMateriauxEstimee: 'premium' | 'haut-de-gamme' | 'standard' | 'economique';
  garanties: {
    duree?: string;
    couverture: string;
  };
  referencesTechniques: number;
  detailSpecifications: boolean;
}

export interface ServiceVector {
  responsivenessPredite: 'rapide' | 'normal' | 'variable' | 'lent';
  serviceApresVente: boolean;
  contact: {
    telephone?: boolean;
    email?: boolean;
    representant?: boolean;
  };
  paiementFlexibilite: 'flexible' | 'normal' | 'strict';
}

/**
 * Service for vectorizing devis content
 */
export class DevisProposalEmbeddingsService {
  /**
   * Vectorize devis extracted data
   * @param extractedData - Validated devis extraction from OCR/parsing
   * @throws Error if extractedData does not match expected structure
   */
  static vectorizeDevisProposal(extractedData: ExtractedDevisData): DevisProposalVector {
    if (!isExtractedDevisData(extractedData)) {
      throw new Error('Invalid extractedData structure');
    }

    return {
      typeVecteur: this.vectorizeWorkType(extractedData),
      prixVecteur: this.vectorizePrix(extractedData),
      delaisVecteur: this.vectorizeDelais(extractedData),
      entrepriseVecteur: this.vectorizeEntreprise(extractedData),
      perimeterVecteur: this.vectorizePerimeter(extractedData),
      qualiteVecteur: this.vectorizeQualite(extractedData),
      serviceVecteur: this.vectorizeService(extractedData),
    };
  }

  private static vectorizeWorkType(data: ExtractedDevisData): string[] {
    const keywords: string[] = [];

    const travaux = data.travaux;
    if (!travaux) return keywords;

    if (travaux.type) {
      keywords.push(travaux.type.toLowerCase());
    }

    if (travaux.description) {
      // Extract key terms from description
      const desc = travaux.description.toLowerCase();
      const terms = [
        'plomberie', 'electricite', 'peinture', 'renovation',
        'cuisine', 'salle de bain', 'toiture', 'facade',
        'structure', 'isolation', 'chauffage', 'climatisation'
      ];
      terms.forEach(term => {
        if (desc.includes(term)) keywords.push(term);
      });
    }

    if (travaux.postes && isPosteDataArray(travaux.postes)) {
      travaux.postes.forEach((poste: PosteData) => {
        const designation = poste.designation.toLowerCase();
        if (designation.length > 0) keywords.push(designation);
      });
    }

    return [...new Set(keywords)]; // Remove duplicates
  }

  private static vectorizePrix(data: ExtractedDevisData): PrixVector {
    const devis = data.devis;
    const montantTotal = devis?.montantTotal ?? 0;
    const montantHT = devis?.montantHT ?? montantTotal;
    const tva = montantTotal - montantHT;

    const postes = this.vectorizePostes(data.travaux?.postes);

    return {
      montantTotal,
      montantHT,
      tva,
      postes,
      repartition: this.analyzeRepartition(postes),
      transparence: this.analyzeTransparence(postes),
    };
  }

  private static vectorizePostes(postes?: PosteData[]): PosteVector[] {
    if (!postes || !isPosteDataArray(postes)) return [];

    return postes.map(poste => ({
      designation: poste.designation,
      quantite: poste.quantite,
      unite: poste.unite,
      prixUnitaire: poste.prixUnitaire,
      prixTotal: poste.prixTotal ?? 0,
      detailLevel: this.analyzeDetailLevel(poste),
    }));
  }

  private static analyzeDetailLevel(poste: PosteData): 'tres-detaille' | 'detaille' | 'global' {
    const hasQuantity = poste.quantite !== null && poste.quantite !== undefined;
    const hasUnit = poste.unite && poste.unite.length > 0;
    const hasUnitPrice = poste.prixUnitaire !== null && poste.prixUnitaire !== undefined;
    const descLength = poste.designation.length;

    if (hasQuantity && hasUnit && hasUnitPrice && descLength > 30) {
      return 'tres-detaille';
    } else if (hasQuantity && hasUnit) {
      return 'detaille';
    } else {
      return 'global';
    }
  }

  private static analyzeRepartition(postes: PosteVector[]): Record<string, number> {
    const total = postes.reduce((sum, p) => sum + (p.prixTotal || 0), 0);
    if (total === 0) return {};

    const repartition: Record<string, number> = {};

    // Estimate categories based on keywords
    postes.forEach(poste => {
      const desc = poste.designation.toLowerCase();
      let category = 'autres';

      if (desc.includes('main') || desc.includes('pose') || desc.includes('installation') || desc.includes('depose')) {
        category = 'maindOeuvre';
      } else if (desc.includes('materiau') || desc.includes('fourniture') || desc.includes('tuyau') ||
                 desc.includes('cable') || desc.includes('peinture') || desc.includes('carrelage')) {
        category = 'materiaux';
      }

      repartition[category] = (repartition[category] || 0) + (poste.prixTotal || 0);
    });

    // Convert to percentages
    Object.keys(repartition).forEach(key => {
      repartition[key] = Math.round((repartition[key] / total) * 100);
    });

    return repartition;
  }

  private static analyzeTransparence(postes: PosteVector[]): 'tres-detaille' | 'detaille' | 'global' | 'flou' {
    if (postes.length === 0) return 'flou';

    const detailedCount = postes.filter(p => p.detailLevel === 'tres-detaille').length;
    const percentage = Math.round((detailedCount / postes.length) * 100);

    if (percentage >= 80) return 'tres-detaille';
    if (percentage >= 50) return 'detaille';
    if (percentage >= 20) return 'global';
    return 'flou';
  }

  private static vectorizeDelais(data: ExtractedDevisData): DelaisVector {
    const delais = data.delais;
    const debut = delais?.debut;
    const fin = delais?.fin;

    let dureeEstimeeJours: number | undefined;
    if (debut && fin) {
      const startDate = new Date(debut);
      const endDate = new Date(fin);
      dureeEstimeeJours = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    }

    return {
      dateDebut: debut,
      dateFin: fin,
      dureeEstimeeJours,
      planningDetaille: delais?.planning_detaille ?? false,
      phases: delais?.phases ?? [],
      jalons: delais?.jalons ?? [],
    };
  }

  private static vectorizeEntreprise(data: ExtractedDevisData): EntrepriseVector {
    const entreprise = data.entreprise;
    if (!entreprise) {
      return {
        nom: 'Inconnue',
        certifications: [],
        rge: false,
        assurances: {
          decennale: false,
          rcPro: false,
        },
        reputation: 'douteuse',
        scoreConformite: 0,
      };
    }

    const certifications = entreprise.certifications ?? [];
    return {
      nom: entreprise.nom,
      siret: entreprise.siret,
      certifications,
      rge: certifications.some(cert => cert.toLowerCase().includes('rge')),
      assurances: {
        decennale: entreprise.assurances?.decennale ?? false,
        rcPro: entreprise.assurances?.rcPro ?? false,
      },
      reputation: this.assessReputation(entreprise),
      scoreConformite: this.calculateConformiteScore(entreprise),
    };
  }

  private static assessReputation(
    entreprise: EntrepriseData
  ): 'verifiee' | 'probable' | 'inconnue' | 'douteuse' {
    const hasCompleteInfo = entreprise.nom && entreprise.siret && entreprise.adresse;
    const hasCertifications = (entreprise.certifications ?? []).length > 0;
    const hasAssurances = entreprise.assurances?.decennale || entreprise.assurances?.rcPro;

    if (hasCompleteInfo && hasCertifications && hasAssurances) return 'verifiee';
    if (hasCompleteInfo && (hasCertifications || hasAssurances)) return 'probable';
    if (hasCompleteInfo) return 'inconnue';
    return 'douteuse';
  }

  private static calculateConformiteScore(entreprise: EntrepriseData): number {
    let score = 0;

    if (entreprise.nom) score += 15;
    if (entreprise.siret) score += 20;
    if (entreprise.adresse) score += 15;
    if (entreprise.telephone) score += 10;
    if (entreprise.email) score += 10;
    if ((entreprise.certifications ?? []).length > 0) score += 20;
    if (entreprise.assurances?.decennale) score += 20;
    if (entreprise.assurances?.rcPro) score += 15;

    return Math.min(score, 100);
  }

  private static vectorizePerimeter(data: ExtractedDevisData): PerimeterVector {
    const description = data.travaux?.description ?? '';

    return {
      description,
      elementsInclus: this.extractElements(description, 'inclus'),
      elementsExclus: this.extractElements(description, 'exclus'),
      conditions: this.extractConditions(description),
      claritePerimetre: this.assessClarite(description),
    };
  }

  private static extractElements(text: string, type: 'inclus' | 'exclus'): string[] {
    const keywords = type === 'inclus'
      ? ['inclus', 'compris', 'fourni', 'incluse', 'comprise']
      : ['exclu', 'exclus', 'non compris', 'non inclus', 'a charge', 'client'];

    // Very basic extraction - could be enhanced with NLP
    const elements: string[] = [];
    const lines = text.split(/[.,;]/);

    lines.forEach(line => {
      if (keywords.some(kw => line.toLowerCase().includes(kw))) {
        elements.push(line.trim());
      }
    });

    return elements;
  }

  private static extractConditions(text: string): string[] {
    const conditions: string[] = [];
    const conditionKeywords = ['selon', 'conformement', 'dans le respect', 'sous reserve', 'sauf'];

    const lines = text.split(/[.,;]/);
    lines.forEach(line => {
      if (conditionKeywords.some(kw => line.toLowerCase().includes(kw))) {
        conditions.push(line.trim());
      }
    });

    return conditions;
  }

  private static assessClarite(text: string): 'tres-clair' | 'clair' | 'acceptable' | 'ambigu' | 'flou' {
    const length = text.length;
    const hasStructure = text.includes('\n') || text.includes('-') || text.includes('•');
    const hasNegatives = text.includes('exclus') || text.includes('non inclus');

    if (length < 50) return 'flou';
    if (length < 200) return 'ambigu';
    if (!hasStructure && !hasNegatives) return 'acceptable';
    if (hasStructure && hasNegatives) return 'tres-clair';
    return 'clair';
  }

  private static vectorizeQualite(data: ExtractedDevisData): QualiteVector {
    const description = (data.travaux?.description ?? '').toLowerCase();

    return {
      normes: this.extractNormes(description),
      qualiteMateriauxEstimee: this.estimateQuality(description),
      garanties: this.extractGaranties(data),
      referencesTechniques: this.countTechnicalReferences(description),
      detailSpecifications: this.hasDetailedSpecs(data.travaux?.postes),
    };
  }

  private static extractNormes(text: string): string[] {
    const normes: string[] = [];
    const patterns = [
      /NF\s+[A-Z0-9\s-]+/g,
      /EN\s+\d+/g,
      /ISO\s+\d+/g,
      /DIN\s+\d+/g,
      /DTU\s+\d+/g,
      /RT\s+\d+/g,
    ];

    patterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) normes.push(...matches);
    });

    return [...new Set(normes)];
  }

  private static estimateQuality(text: string): 'premium' | 'haut-de-gamme' | 'standard' | 'economique' {
    const premiumTerms = ['premium', 'haut de gamme', 'qualite superieure', 'luxe'];
    const hdgTerms = ['excellent', 'qualite', 'performant', 'durable'];
    const economicTerms = ['economique', 'basique', 'simple', 'standard'];

    if (premiumTerms.some(t => text.includes(t))) return 'premium';
    if (hdgTerms.some(t => text.includes(t))) return 'haut-de-gamme';
    if (economicTerms.some(t => text.includes(t))) return 'economique';
    return 'standard';
  }

  private static extractGaranties(data: ExtractedDevisData): { duree?: string; couverture: string } {
    const description = data.travaux?.description ?? '';

    const dureeMatch = description.match(/(\d+)\s*(ans?|mois)/i);
    const duree = dureeMatch ? dureeMatch[0] : undefined;

    const hasCouverture = description.toLowerCase().includes('garantie') ||
                         description.toLowerCase().includes('couverture');

    return {
      duree,
      couverture: hasCouverture ? 'decennale' : 'legale',
    };
  }

  private static countTechnicalReferences(text: string): number {
    const technicalTerms = [
      'specification', 'dimension', 'materiau', 'couleur', 'finition',
      'resistance', 'capacite', 'puissance', 'vitesse', 'debit'
    ];

    let count = 0;
    technicalTerms.forEach(term => {
      const regex = new RegExp(term, 'gi');
      const matches = text.match(regex);
      if (matches) count += matches.length;
    });

    return count;
  }

  private static hasDetailedSpecs(postes?: PosteData[]): boolean {
    if (!postes || !isPosteDataArray(postes) || postes.length === 0) return false;

    const detailedCount = postes.filter((p: PosteData) =>
      (p.designation.length > 30) ||
      (p.quantite !== null && p.quantite !== undefined)
    ).length;

    return detailedCount >= postes.length / 2;
  }

  private static vectorizeService(data: ExtractedDevisData): ServiceVector {
    const entreprise = data.entreprise;
    const description = (data.travaux?.description ?? '').toLowerCase();

    return {
      responsivenessPredite: this.estimateResponsiveness(entreprise, description),
      serviceApresVente: description.includes('sav') || description.includes('service apres-vente'),
      contact: {
        telephone: !!entreprise?.telephone,
        email: !!entreprise?.email,
        representant: description.includes('representant') || description.includes('commercial'),
      },
      paiementFlexibilite: this.assessPaymentFlexibility(description),
    };
  }

  private static estimateResponsiveness(
    entreprise: EntrepriseData | undefined,
    description: string
  ): 'rapide' | 'normal' | 'variable' | 'lent' {
    const hasMultipleContacts = entreprise && ((!!entreprise.telephone && !!entreprise.email) ||
                                !!entreprise.representant);
    const hasUrgencyTerms = description.includes('urgent') || description.includes('express') ||
                           description.includes('rapide');

    if (hasUrgencyTerms && hasMultipleContacts) return 'rapide';
    if (hasMultipleContacts) return 'normal';
    if (hasUrgencyTerms) return 'variable';
    return 'lent';
  }

  private static assessPaymentFlexibility(description: string): 'flexible' | 'normal' | 'strict' {
    const flexibleTerms = ['acompte', 'echeancier', 'versement', 'flexible', '3x', '4x'];
    const strictTerms = ['50% d\'acompte', 'totalite', 'avant'];

    if (flexibleTerms.some(t => description.includes(t))) return 'flexible';
    if (strictTerms.some(t => description.includes(t))) return 'strict';
    return 'normal';
  }

  /**
   * Compare demand (CCF) and proposal (devis) vectorization
   */
  static compareVectors(
    demandVecteur: ExtractedDevisData,
    proposalVecteur: DevisProposalVector
  ): ComparisonResult {
    return {
      alignmentScore: this.calculateAlignment(demandVecteur, proposalVecteur),
      gapAnalysis: this.analyzeGaps(demandVecteur, proposalVecteur),
      recommendations: this.generateRecommendations(demandVecteur, proposalVecteur),
    };
  }

  private static calculateAlignment(demand: ExtractedDevisData, proposal: DevisProposalVector): number {
    let score = 100;

    // Type alignment
    const typeMatch = proposal.typeVecteur.length > 0 ? 90 : 60;

    // Price alignment
    if (demand.budgetRange?.min && demand.budgetRange?.max) {
      if (proposal.prixVecteur.montantTotal < demand.budgetRange.min) {
        score -= 15;
      } else if (proposal.prixVecteur.montantTotal > demand.budgetRange.max) {
        score -= 25;
      }
    }

    // Urgency/Timeline alignment
    if (demand.urgencyLevel === 'tres-haute' && !proposal.delaisVecteur.planningDetaille) {
      score -= 10;
    }

    // Company compliance
    score += (proposal.entrepriseVecteur.scoreConformite / 100) * 10;

    return Math.max(0, Math.min(100, score));
  }

  private static analyzeGaps(demand: ExtractedDevisData, proposal: DevisProposalVector): GapItem[] {
    const gaps: GapItem[] = [];

    // Budget gap
    if (demand.budgetRange) {
      if (proposal.prixVecteur.montantTotal > (demand.budgetRange.max ?? Infinity)) {
        gaps.push({
          category: 'prix',
          severity: 'high',
          description: `Devis dépasse le budget de ${proposal.prixVecteur.montantTotal - (demand.budgetRange.max ?? 0)}€`,
        });
      } else if (proposal.prixVecteur.montantTotal < (demand.budgetRange.min ?? 0)) {
        gaps.push({
          category: 'prix',
          severity: 'medium',
          description: 'Devis inférieur au budget minimum - vérifier qualité',
        });
      }
    }

    // Transparency gap
    if (proposal.prixVecteur.transparence === 'flou' || proposal.prixVecteur.transparence === 'global') {
      gaps.push({
        category: 'transparence',
        severity: 'medium',
        description: 'Manque de détail dans les postes du devis',
      });
    }

    // Timeline gap
    if (demand.urgencyLevel === 'tres-haute' && !proposal.delaisVecteur.planningDetaille) {
      gaps.push({
        category: 'delais',
        severity: 'high',
        description: 'Pas de planning détaillé pour urgence très haute',
      });
    }

    // Scope gap
    if (proposal.perimeterVecteur.claritePerimetre === 'flou') {
      gaps.push({
        category: 'perimetre',
        severity: 'high',
        description: 'Périmètre des travaux peu clair',
      });
    }

    return gaps;
  }

  private static generateRecommendations(demand: ExtractedDevisData, proposal: DevisProposalVector): string[] {
    const recommendations: string[] = [];

    // Price recommendations
    if (proposal.prixVecteur.transparence !== 'tres-detaille') {
      recommendations.push('Demander une ventilation détaillée des postes (main d\'œuvre / matériaux)');
    }

    // Timeline recommendations
    if (!proposal.delaisVecteur.planningDetaille && demand.urgencyLevel !== 'basse') {
      recommendations.push('Demander un planning détaillé avec jalons');
    }

    // Company recommendations
    if (!proposal.entrepriseVecteur.rge) {
      recommendations.push('Vérifier les certifications RGE si travaux éligibles MaPrimeRénov\'');
    }

    if (!proposal.entrepriseVecteur.assurances.decennale) {
      recommendations.push('Vérifier la couverture assurance décennale');
    }

    // Scope recommendations
    if (proposal.perimeterVecteur.elementsExclus.length === 0) {
      recommendations.push('Demander liste explicite des prestations exclues');
    }

    // Quality recommendations
    if (!proposal.qualiteVecteur.detailSpecifications) {
      recommendations.push('Exiger des spécifications techniques détaillées');
    }

    return recommendations;
  }
}

export interface ComparisonResult {
  alignmentScore: number; // 0-100
  gapAnalysis: GapItem[];
  recommendations: string[];
}

export interface GapItem {
  category: 'prix' | 'delais' | 'perimetre' | 'qualite' | 'transparence' | 'conformite';
  severity: 'low' | 'medium' | 'high';
  description: string;
}

export const devisProposalEmbeddingsService = DevisProposalEmbeddingsService;
