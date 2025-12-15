/**
 * TORP Matching Service
 * Service de matching entre appels d'offres et entreprises
 *
 * Critères de matching :
 * - Zone géographique
 * - Spécialisations / types de lots
 * - Certifications requises (RGE, Qualibat)
 * - Capacité financière
 * - Disponibilité
 */

import { supabase } from '@/lib/supabase';
import type { Tender, CompanySpecialization } from '@/types/tender';

// =============================================================================
// TYPES
// =============================================================================

export interface MatchingResult {
  companyId: string;
  companyName: string;
  companySiret: string;
  matchScore: number;          // 0-100
  matchDetails: MatchDetail[];
  relevantSpecializations: CompanySpecialization[];
  contactEmail?: string;
  torpScore?: number;
  torpGrade?: string;
}

export interface MatchDetail {
  criterion: string;
  matched: boolean;
  score: number;
  maxScore: number;
  details?: string;
}

export interface MatchingCriteria {
  maxDistanceKm?: number;
  requiredLotTypes?: string[];
  requiredRGE?: boolean;
  requiredQualifications?: string[];
  minTorpScore?: number;
  maxResults?: number;
}

export interface CompanyProfile {
  id: string;
  siret: string;
  name: string;
  contactEmail?: string;
  address?: {
    city?: string;
    postalCode?: string;
    department?: string;
    coordinates?: { lat: number; lng: number };
  };
  torpScore?: number;
  torpGrade?: string;
  rgeCrertified?: boolean;
  qualibatNumber?: string;
  specializations: CompanySpecialization[];
}

// =============================================================================
// MATCHING SERVICE
// =============================================================================

export class MatchingService {
  /**
   * Trouve les entreprises correspondant à un appel d'offres
   */
  static async findMatchingCompanies(
    tender: Tender,
    criteria?: MatchingCriteria
  ): Promise<MatchingResult[]> {
    const maxResults = criteria?.maxResults || 20;
    const maxDistance = criteria?.maxDistanceKm || 100;

    // Récupérer les types de lots de l'AO
    const requiredLotTypes = tender.selectedLots?.map(l => l.lotType) || [];
    const requiredCategories = [...new Set(tender.selectedLots?.map(l => l.category) || [])];

    // 1. Chercher les entreprises avec des spécialisations correspondantes
    let query = supabase
      .from('companies')
      .select(`
        id, siret, name, contact_email, address,
        torp_score, torp_grade, rge_certified, qualibat_number,
        company_specializations (*)
      `)
      .eq('verified', true)
      .limit(100);

    const { data: companies, error } = await query;

    if (error) {
      console.error('[MatchingService] Query error:', error);
      throw error;
    }

    if (!companies || companies.length === 0) {
      return [];
    }

    // 2. Calculer le score de matching pour chaque entreprise
    const results: MatchingResult[] = [];

    for (const company of companies) {
      const specializations = (company.company_specializations || []) as CompanySpecialization[];

      const matchResult = this.calculateMatchScore(
        {
          id: company.id,
          siret: company.siret,
          name: company.name,
          contactEmail: company.contact_email,
          address: company.address,
          torpScore: company.torp_score,
          torpGrade: company.torp_grade,
          rgeCrertified: company.rge_certified,
          qualibatNumber: company.qualibat_number,
          specializations,
        },
        tender,
        {
          ...criteria,
          maxDistanceKm: maxDistance,
          requiredLotTypes,
        }
      );

      if (matchResult.matchScore > 0) {
        results.push(matchResult);
      }
    }

    // 3. Trier par score décroissant et limiter
    results.sort((a, b) => b.matchScore - a.matchScore);

    return results.slice(0, maxResults);
  }

  /**
   * Calcule le score de matching entre une entreprise et un AO
   */
  static calculateMatchScore(
    company: CompanyProfile,
    tender: Tender,
    criteria: MatchingCriteria
  ): MatchingResult {
    const details: MatchDetail[] = [];
    let totalScore = 0;
    let maxTotalScore = 0;

    // 1. Matching géographique (30 points)
    const geoResult = this.matchGeography(company, tender, criteria.maxDistanceKm || 100);
    details.push(geoResult);
    totalScore += geoResult.score;
    maxTotalScore += geoResult.maxScore;

    // 2. Matching des lots/spécialisations (40 points)
    const lotResult = this.matchLots(company.specializations, criteria.requiredLotTypes || []);
    details.push(lotResult);
    totalScore += lotResult.score;
    maxTotalScore += lotResult.maxScore;

    // 3. Certifications RGE (15 points si requis)
    if (tender.requirements?.rgeRequired) {
      const rgeResult = this.matchRGE(company, tender);
      details.push(rgeResult);
      totalScore += rgeResult.score;
      maxTotalScore += rgeResult.maxScore;
    }

    // 4. Score TORP entreprise (10 points)
    const torpResult = this.matchTorpScore(company, criteria.minTorpScore);
    details.push(torpResult);
    totalScore += torpResult.score;
    maxTotalScore += torpResult.maxScore;

    // 5. Qualifications spécifiques (5 points)
    if (criteria.requiredQualifications?.length) {
      const qualResult = this.matchQualifications(company, criteria.requiredQualifications);
      details.push(qualResult);
      totalScore += qualResult.score;
      maxTotalScore += qualResult.maxScore;
    }

    // Calculer le score final (0-100)
    const matchScore = maxTotalScore > 0 ? Math.round((totalScore / maxTotalScore) * 100) : 0;

    // Identifier les spécialisations pertinentes
    const relevantSpecs = company.specializations.filter(s =>
      criteria.requiredLotTypes?.includes(s.lotType)
    );

    return {
      companyId: company.id,
      companyName: company.name,
      companySiret: company.siret,
      matchScore,
      matchDetails: details,
      relevantSpecializations: relevantSpecs,
      contactEmail: company.contactEmail,
      torpScore: company.torpScore,
      torpGrade: company.torpGrade,
    };
  }

  /**
   * Matching géographique
   */
  private static matchGeography(
    company: CompanyProfile,
    tender: Tender,
    maxDistanceKm: number
  ): MatchDetail {
    const maxScore = 30;

    // Si pas de coordonnées, matcher sur le département
    if (!company.address?.coordinates || !tender.workAddress?.coordinates) {
      const companyDept = company.address?.department || company.address?.postalCode?.substring(0, 2);
      const tenderDept = tender.workDepartment || tender.workPostalCode?.substring(0, 2);

      if (companyDept && tenderDept) {
        if (companyDept === tenderDept) {
          return {
            criterion: 'Zone géographique',
            matched: true,
            score: maxScore,
            maxScore,
            details: 'Même département',
          };
        }

        // Départements limitrophes (simplifié)
        const adjacentDepts = this.getAdjacentDepartments(companyDept);
        if (adjacentDepts.includes(tenderDept)) {
          return {
            criterion: 'Zone géographique',
            matched: true,
            score: Math.round(maxScore * 0.7),
            maxScore,
            details: 'Département limitrophe',
          };
        }
      }

      return {
        criterion: 'Zone géographique',
        matched: false,
        score: 0,
        maxScore,
        details: 'Hors zone',
      };
    }

    // Calcul de distance
    const distance = this.calculateDistance(
      company.address.coordinates,
      tender.workAddress.coordinates
    );

    if (distance <= maxDistanceKm) {
      const score = Math.round(maxScore * (1 - distance / maxDistanceKm));
      return {
        criterion: 'Zone géographique',
        matched: true,
        score: Math.max(score, Math.round(maxScore * 0.3)),
        maxScore,
        details: `${Math.round(distance)} km`,
      };
    }

    return {
      criterion: 'Zone géographique',
      matched: false,
      score: 0,
      maxScore,
      details: `${Math.round(distance)} km (trop loin)`,
    };
  }

  /**
   * Matching des lots/spécialisations
   */
  private static matchLots(
    specializations: CompanySpecialization[],
    requiredLotTypes: string[]
  ): MatchDetail {
    const maxScore = 40;

    if (requiredLotTypes.length === 0) {
      return {
        criterion: 'Spécialisations',
        matched: true,
        score: maxScore,
        maxScore,
        details: 'Aucun lot spécifique requis',
      };
    }

    const companyLotTypes = specializations.map(s => s.lotType);
    const matchingLots = requiredLotTypes.filter(lt => companyLotTypes.includes(lt));
    const matchRatio = matchingLots.length / requiredLotTypes.length;

    if (matchRatio === 0) {
      return {
        criterion: 'Spécialisations',
        matched: false,
        score: 0,
        maxScore,
        details: 'Aucune correspondance',
      };
    }

    const score = Math.round(maxScore * matchRatio);

    return {
      criterion: 'Spécialisations',
      matched: matchRatio >= 0.5,
      score,
      maxScore,
      details: `${matchingLots.length}/${requiredLotTypes.length} lots couverts`,
    };
  }

  /**
   * Matching RGE
   */
  private static matchRGE(company: CompanyProfile, tender: Tender): MatchDetail {
    const maxScore = 15;

    if (company.rgeCrertified) {
      // Vérifier si les domaines RGE correspondent aux lots
      const rgeSpecs = company.specializations.filter(s => s.rgeDomains?.length);

      if (rgeSpecs.length > 0) {
        return {
          criterion: 'Certification RGE',
          matched: true,
          score: maxScore,
          maxScore,
          details: 'RGE validé',
        };
      }

      return {
        criterion: 'Certification RGE',
        matched: true,
        score: Math.round(maxScore * 0.8),
        maxScore,
        details: 'RGE (domaines non précisés)',
      };
    }

    return {
      criterion: 'Certification RGE',
      matched: false,
      score: 0,
      maxScore,
      details: 'Non RGE',
    };
  }

  /**
   * Matching score TORP
   */
  private static matchTorpScore(
    company: CompanyProfile,
    minScore?: number
  ): MatchDetail {
    const maxScore = 10;

    if (!company.torpScore) {
      return {
        criterion: 'Score TORP',
        matched: false,
        score: Math.round(maxScore * 0.3),
        maxScore,
        details: 'Non noté',
      };
    }

    const threshold = minScore || 500;

    if (company.torpScore >= threshold) {
      const bonus = Math.min(1, (company.torpScore - threshold) / 500);
      return {
        criterion: 'Score TORP',
        matched: true,
        score: Math.round(maxScore * (0.7 + 0.3 * bonus)),
        maxScore,
        details: `${company.torpScore} pts (${company.torpGrade})`,
      };
    }

    return {
      criterion: 'Score TORP',
      matched: false,
      score: Math.round(maxScore * 0.3),
      maxScore,
      details: `${company.torpScore} pts`,
    };
  }

  /**
   * Matching qualifications
   */
  private static matchQualifications(
    company: CompanyProfile,
    required: string[]
  ): MatchDetail {
    const maxScore = 5;

    const companyQuals = new Set<string>();

    // Collecter toutes les qualifications de l'entreprise
    if (company.qualibatNumber) companyQuals.add('qualibat');
    company.specializations.forEach(s => {
      s.certifications?.forEach(c => companyQuals.add(c.toLowerCase()));
    });

    const matching = required.filter(q => companyQuals.has(q.toLowerCase()));
    const matchRatio = matching.length / required.length;

    return {
      criterion: 'Qualifications',
      matched: matchRatio >= 0.5,
      score: Math.round(maxScore * matchRatio),
      maxScore,
      details: `${matching.length}/${required.length} qualifications`,
    };
  }

  /**
   * Calcule la distance entre deux points (formule Haversine)
   */
  private static calculateDistance(
    point1: { lat: number; lng: number },
    point2: { lat: number; lng: number }
  ): number {
    const R = 6371; // Rayon de la Terre en km
    const dLat = this.toRad(point2.lat - point1.lat);
    const dLng = this.toRad(point2.lng - point1.lng);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(point1.lat)) * Math.cos(this.toRad(point2.lat)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private static toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  /**
   * Retourne les départements limitrophes (simplifié)
   */
  private static getAdjacentDepartments(dept: string): string[] {
    // Mapping simplifié des départements limitrophes
    const adjacency: Record<string, string[]> = {
      '75': ['92', '93', '94'], // Paris
      '92': ['75', '93', '94', '78', '95'], // Hauts-de-Seine
      '93': ['75', '92', '94', '95', '77'], // Seine-Saint-Denis
      '94': ['75', '92', '93', '77', '91'], // Val-de-Marne
      '78': ['92', '95', '91', '27', '28', '76'], // Yvelines
      '91': ['94', '78', '77', '45', '28'], // Essonne
      '95': ['92', '93', '78', '60', '27'], // Val-d'Oise
      '77': ['93', '94', '91', '45', '89', '10', '51', '02', '60'], // Seine-et-Marne
      '69': ['01', '38', '42', '71'], // Rhône
      '13': ['84', '30', '04', '83'], // Bouches-du-Rhône
      '31': ['09', '11', '81', '82', '32', '65'], // Haute-Garonne
      '33': ['17', '16', '24', '47', '40'], // Gironde
      '59': ['62', '80', '02'], // Nord
      // Ajouter d'autres si nécessaire
    };

    return adjacency[dept] || [];
  }

  /**
   * Envoie des invitations aux entreprises matchées
   */
  static async sendInvitations(
    tenderId: string,
    matchingResults: MatchingResult[],
    options?: {
      minScore?: number;
      maxInvitations?: number;
    }
  ): Promise<number> {
    const minScore = options?.minScore || 50;
    const maxInvitations = options?.maxInvitations || 10;

    // Filtrer les résultats
    const qualified = matchingResults
      .filter(r => r.matchScore >= minScore)
      .slice(0, maxInvitations);

    if (qualified.length === 0) {
      return 0;
    }

    // Créer les invitations
    const invitations = qualified.map(match => ({
      tender_id: tenderId,
      company_id: match.companyId,
      company_siret: match.companySiret,
      company_name: match.companyName,
      company_email: match.contactEmail || '',
      status: 'pending',
      access_token: crypto.randomUUID(),
      token_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      metadata: {
        matchScore: match.matchScore,
        matchDetails: match.matchDetails,
      },
    }));

    const { error } = await supabase
      .from('tender_invitations')
      .insert(invitations);

    if (error) {
      console.error('[MatchingService] Invitation insert error:', error);
      throw error;
    }

    // Mettre à jour le compteur d'invitations
    await supabase
      .from('tenders')
      .update({
        invited_count: qualified.length,
        updated_at: new Date().toISOString(),
      })
      .eq('id', tenderId);

    return qualified.length;
  }

  /**
   * Trouve les AO correspondant à une entreprise
   */
  static async findMatchingTenders(
    companyId: string,
    options?: {
      maxResults?: number;
      minMatchScore?: number;
    }
  ): Promise<Array<{
    tender: Tender;
    matchScore: number;
    matchDetails: MatchDetail[];
  }>> {
    // Récupérer le profil entreprise
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select(`
        id, siret, name, contact_email, address,
        torp_score, torp_grade, rge_certified, qualibat_number,
        company_specializations (*)
      `)
      .eq('id', companyId)
      .single();

    if (companyError || !company) {
      throw new Error('Entreprise non trouvée');
    }

    // Récupérer les AO publics ouverts
    const { data: tenders, error: tendersError } = await supabase
      .from('tenders')
      .select('*')
      .eq('visibility', 'public')
      .eq('status', 'published')
      .gte('response_deadline', new Date().toISOString())
      .limit(50);

    if (tendersError) {
      throw tendersError;
    }

    if (!tenders?.length) {
      return [];
    }

    const companyProfile: CompanyProfile = {
      id: company.id,
      siret: company.siret,
      name: company.name,
      contactEmail: company.contact_email,
      address: company.address,
      torpScore: company.torp_score,
      torpGrade: company.torp_grade,
      rgeCrertified: company.rge_certified,
      qualibatNumber: company.qualibat_number,
      specializations: company.company_specializations || [],
    };

    // Calculer le matching pour chaque AO
    const results = tenders.map(tenderRow => {
      const tender = this.mapRowToTender(tenderRow);
      const match = this.calculateMatchScore(companyProfile, tender, {
        requiredLotTypes: tender.selectedLots?.map(l => l.lotType),
      });

      return {
        tender,
        matchScore: match.matchScore,
        matchDetails: match.matchDetails,
      };
    });

    // Filtrer et trier
    const minScore = options?.minMatchScore || 30;
    const maxResults = options?.maxResults || 20;

    return results
      .filter(r => r.matchScore >= minScore)
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, maxResults);
  }

  /**
   * Mappe une row vers un Tender (version légère)
   */
  private static mapRowToTender(row: Record<string, unknown>): Tender {
    return {
      id: row.id as string,
      userId: row.user_id as string,
      reference: row.reference as string,
      title: row.title as string,
      description: row.description as string,
      tenderType: row.tender_type as Tender['tenderType'],
      visibility: row.visibility as Tender['visibility'],
      status: row.status as Tender['status'],
      workCity: row.work_city as string,
      workPostalCode: row.work_postal_code as string,
      workDepartment: row.work_department as string,
      selectedLots: row.selected_lots as Tender['selectedLots'],
      lotsCount: row.lots_count as number,
      estimatedBudgetMin: row.estimated_budget_min as number,
      estimatedBudgetMax: row.estimated_budget_max as number,
      budgetVisibility: (row.budget_visibility as string || 'hidden') as 'hidden' | 'range' | 'exact',
      responseDeadline: row.response_deadline ? new Date(row.response_deadline as string) : undefined,
      requirements: row.requirements as Tender['requirements'] || {},
      evaluationCriteria: row.evaluation_criteria as Tender['evaluationCriteria'] || [],
      dceDocuments: row.dce_documents as Tender['dceDocuments'] || [],
      dceVersion: row.dce_version as number || 1,
      viewsCount: row.views_count as number || 0,
      downloadsCount: row.downloads_count as number || 0,
      responsesCount: row.responses_count as number || 0,
      invitedCount: row.invited_count as number || 0,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    } as Tender;
  }
}

export default MatchingService;
