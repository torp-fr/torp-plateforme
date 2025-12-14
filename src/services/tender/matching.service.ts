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
  // Données enrichies depuis le profil utilisateur
  certifications?: Array<{
    type: string;
    number?: string;
    expirationDate?: string;
    domains?: string[];
  }>;
  humanResources?: {
    totalEmployees?: number;
    qualifiedTechnicians?: number;
    apprentices?: number;
  };
  materialResources?: string[];
  references?: Array<{
    projectType: string;
    budgetRange?: string;
    year?: number;
    description?: string;
  }>;
  companyAge?: number; // Années d'expérience
  insuranceValid?: boolean;
  decennaleValid?: boolean;
}

// =============================================================================
// MATCHING SERVICE
// =============================================================================

export class MatchingService {
  /**
   * Récupère un profil entreprise enrichi avec les données utilisateur
   */
  static async getEnrichedCompanyProfile(userId: string): Promise<CompanyProfile | null> {
    // Récupérer les données utilisateur + company
    const { data: user, error: userError } = await supabase
      .from('users')
      .select(`
        id, email, name, phone,
        company, company_siret, company_activity, company_size, company_role,
        company_address, company_code_ape, company_rcs, company_description,
        company_human_resources, company_material_resources,
        company_methodology, company_quality_commitments
      `)
      .eq('id', userId)
      .single();

    if (userError || !user) {
      console.error('[MatchingService] User not found:', userError);
      return null;
    }

    // Récupérer les données company si existe
    let companyData: Record<string, unknown> | null = null;
    if (user.company_siret) {
      const { data } = await supabase
        .from('companies')
        .select(`
          *,
          company_specializations (*),
          company_certifications (*),
          company_references (*)
        `)
        .eq('siret', user.company_siret)
        .single();
      companyData = data;
    }

    // Construire le profil enrichi
    const profile: CompanyProfile = {
      id: user.id,
      siret: user.company_siret || '',
      name: user.company || user.name,
      contactEmail: user.email,
      address: this.parseAddress(user.company_address),
      torpScore: companyData?.torp_score as number | undefined,
      torpGrade: companyData?.torp_grade as string | undefined,
      rgeCrertified: companyData?.rge_certified as boolean | undefined,
      qualibatNumber: companyData?.qualibat_number as string | undefined,
      specializations: (companyData?.company_specializations as CompanySpecialization[]) || [],
      certifications: this.parseCertifications(companyData?.company_certifications),
      humanResources: this.parseHumanResources(user.company_human_resources),
      materialResources: this.parseMaterialResources(user.company_material_resources),
      references: this.parseReferences(companyData?.company_references),
      insuranceValid: companyData?.insurance_valid as boolean | undefined,
      decennaleValid: companyData?.decennale_valid as boolean | undefined,
    };

    return profile;
  }

  /**
   * Parse l'adresse depuis le champ company_address (string ou JSONB)
   */
  private static parseAddress(addressData: unknown): CompanyProfile['address'] {
    if (!addressData) return undefined;

    if (typeof addressData === 'string') {
      // Essayer d'extraire le code postal
      const cpMatch = addressData.match(/\b(\d{5})\b/);
      return {
        city: addressData,
        postalCode: cpMatch?.[1],
        department: cpMatch?.[1]?.substring(0, 2),
      };
    }

    if (typeof addressData === 'object') {
      const addr = addressData as Record<string, unknown>;
      return {
        city: addr.city as string,
        postalCode: addr.postalCode as string || addr.postal_code as string,
        department: addr.department as string,
        coordinates: addr.coordinates as { lat: number; lng: number },
      };
    }

    return undefined;
  }

  /**
   * Parse les certifications
   */
  private static parseCertifications(data: unknown): CompanyProfile['certifications'] {
    if (!data) return undefined;
    if (!Array.isArray(data)) return undefined;

    return data.map(cert => ({
      type: cert.type || cert.certification_type,
      number: cert.number || cert.certification_number,
      expirationDate: cert.expiration_date || cert.expirationDate,
      domains: cert.domains || [],
    }));
  }

  /**
   * Parse les ressources humaines
   */
  private static parseHumanResources(data: unknown): CompanyProfile['humanResources'] {
    if (!data) return undefined;

    if (typeof data === 'string') {
      // Essayer d'extraire un nombre
      const match = data.match(/(\d+)/);
      return match ? { totalEmployees: parseInt(match[1]) } : undefined;
    }

    if (typeof data === 'object') {
      const hr = data as Record<string, unknown>;
      return {
        totalEmployees: hr.totalEmployees as number || hr.total_employees as number,
        qualifiedTechnicians: hr.qualifiedTechnicians as number || hr.qualified_technicians as number,
        apprentices: hr.apprentices as number,
      };
    }

    return undefined;
  }

  /**
   * Parse les ressources matérielles
   */
  private static parseMaterialResources(data: unknown): string[] | undefined {
    if (!data) return undefined;
    if (typeof data === 'string') return [data];
    if (Array.isArray(data)) return data.map(String);
    return undefined;
  }

  /**
   * Parse les références
   */
  private static parseReferences(data: unknown): CompanyProfile['references'] {
    if (!data) return undefined;
    if (!Array.isArray(data)) return undefined;

    return data.map(ref => ({
      projectType: ref.project_type || ref.projectType || 'Autre',
      budgetRange: ref.budget_range || ref.budgetRange,
      year: ref.year,
      description: ref.description,
    }));
  }

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

    // Ajouter les certifications enrichies
    company.certifications?.forEach(cert => {
      companyQuals.add(cert.type.toLowerCase());
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
   * Matching des références (expérience sur projets similaires)
   */
  private static matchReferences(
    company: CompanyProfile,
    tender: Tender
  ): MatchDetail {
    const maxScore = 10;

    if (!company.references || company.references.length === 0) {
      return {
        criterion: 'Références',
        matched: false,
        score: 0,
        maxScore,
        details: 'Aucune référence renseignée',
      };
    }

    // Vérifier si l'entreprise a des références sur le type de projet
    const tenderBudget = tender.estimatedBudgetMax || tender.estimatedBudgetMin || 0;
    let relevantRefs = 0;
    let budgetMatchRefs = 0;

    for (const ref of company.references) {
      // Vérifier le type de projet
      const projectTypes = tender.selectedLots?.map(l => l.category) || [];
      if (projectTypes.some(pt => ref.projectType.toLowerCase().includes(pt.toLowerCase()))) {
        relevantRefs++;
      }

      // Vérifier la tranche budgétaire
      if (ref.budgetRange) {
        const budgetMatch = this.budgetRangeMatches(ref.budgetRange, tenderBudget);
        if (budgetMatch) budgetMatchRefs++;
      }
    }

    const totalRefs = company.references.length;
    const relevanceRatio = totalRefs > 0 ? relevantRefs / totalRefs : 0;
    const budgetRatio = totalRefs > 0 ? budgetMatchRefs / totalRefs : 0;

    // Score basé sur la pertinence et l'expérience budgétaire
    const score = Math.round(maxScore * (relevanceRatio * 0.6 + budgetRatio * 0.4));

    return {
      criterion: 'Références',
      matched: relevantRefs > 0,
      score,
      maxScore,
      details: `${relevantRefs} références pertinentes sur ${totalRefs}`,
    };
  }

  /**
   * Vérifie si une tranche budgétaire correspond
   */
  private static budgetRangeMatches(range: string, budget: number): boolean {
    const ranges: Record<string, [number, number]> = {
      'petit': [0, 50000],
      'moyen': [50000, 200000],
      'grand': [200000, 1000000],
      'tres_grand': [1000000, Infinity],
      '< 50k': [0, 50000],
      '50k - 200k': [50000, 200000],
      '200k - 1M': [200000, 1000000],
      '> 1M': [1000000, Infinity],
    };

    const [min, max] = ranges[range.toLowerCase()] || [0, Infinity];
    return budget >= min && budget <= max;
  }

  /**
   * Matching des ressources (humaines et matérielles)
   */
  private static matchResources(
    company: CompanyProfile,
    tender: Tender
  ): MatchDetail {
    const maxScore = 8;
    let score = 0;

    // Score pour ressources humaines
    if (company.humanResources?.totalEmployees) {
      const employees = company.humanResources.totalEmployees;

      // Estimer la taille requise selon le budget
      const budget = tender.estimatedBudgetMax || tender.estimatedBudgetMin || 0;
      const requiredSize = budget < 100000 ? 2 : budget < 500000 ? 5 : budget < 2000000 ? 15 : 30;

      if (employees >= requiredSize) {
        score += 4; // Capacité suffisante
      } else if (employees >= requiredSize * 0.5) {
        score += 2; // Capacité partielle
      }
    }

    // Score pour ressources matérielles
    if (company.materialResources && company.materialResources.length > 0) {
      score += Math.min(4, company.materialResources.length); // Max 4 points
    }

    const hasResources = company.humanResources?.totalEmployees || (company.materialResources?.length || 0) > 0;

    return {
      criterion: 'Ressources',
      matched: hasResources,
      score,
      maxScore,
      details: company.humanResources?.totalEmployees
        ? `${company.humanResources.totalEmployees} employés`
        : 'Non renseigné',
    };
  }

  /**
   * Matching des assurances (décennale, RC)
   */
  private static matchInsurance(company: CompanyProfile): MatchDetail {
    const maxScore = 5;
    let score = 0;

    if (company.insuranceValid) {
      score += 2;
    }

    if (company.decennaleValid) {
      score += 3;
    }

    // Vérifier les certifications d'assurance
    const hasInsuranceCert = company.certifications?.some(c =>
      c.type.toLowerCase().includes('assurance') ||
      c.type.toLowerCase().includes('décennale') ||
      c.type.toLowerCase().includes('rc')
    );

    if (hasInsuranceCert && score < maxScore) {
      score = Math.min(maxScore, score + 2);
    }

    return {
      criterion: 'Assurances',
      matched: score >= 3,
      score,
      maxScore,
      details: company.decennaleValid ? 'Décennale valide' : 'À vérifier',
    };
  }

  /**
   * Calcule le score de matching ENRICHI avec toutes les données profil
   */
  static calculateEnrichedMatchScore(
    company: CompanyProfile,
    tender: Tender,
    criteria: MatchingCriteria
  ): MatchingResult {
    const details: MatchDetail[] = [];
    let totalScore = 0;
    let maxTotalScore = 0;

    // 1. Matching géographique (25 points)
    const geoResult = this.matchGeography(company, tender, criteria.maxDistanceKm || 100);
    details.push(geoResult);
    totalScore += geoResult.score;
    maxTotalScore += geoResult.maxScore;

    // 2. Matching des lots/spécialisations (30 points)
    const lotResult = this.matchLots(company.specializations, criteria.requiredLotTypes || []);
    details.push(lotResult);
    totalScore += lotResult.score;
    maxTotalScore += lotResult.maxScore;

    // 3. Références et expérience (10 points)
    const refResult = this.matchReferences(company, tender);
    details.push(refResult);
    totalScore += refResult.score;
    maxTotalScore += refResult.maxScore;

    // 4. Ressources (8 points)
    const resResult = this.matchResources(company, tender);
    details.push(resResult);
    totalScore += resResult.score;
    maxTotalScore += resResult.maxScore;

    // 5. Certifications RGE (12 points si requis)
    if (tender.requirements?.rgeRequired) {
      const rgeResult = this.matchRGE(company, tender);
      details.push(rgeResult);
      totalScore += rgeResult.score;
      maxTotalScore += rgeResult.maxScore;
    }

    // 6. Score TORP entreprise (8 points)
    const torpResult = this.matchTorpScore(company, criteria.minTorpScore);
    details.push(torpResult);
    totalScore += torpResult.score;
    maxTotalScore += torpResult.maxScore;

    // 7. Assurances (5 points)
    const insuranceResult = this.matchInsurance(company);
    details.push(insuranceResult);
    totalScore += insuranceResult.score;
    maxTotalScore += insuranceResult.maxScore;

    // 8. Qualifications spécifiques (2 points)
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
