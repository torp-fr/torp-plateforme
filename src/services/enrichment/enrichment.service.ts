/**
 * Service d'enrichissement des données
 * Agrège des informations depuis diverses sources pour enrichir l'analyse
 */

export interface EnrichmentResult {
  companyInfo?: CompanyInfo;
  rgeQualifications?: RGEQualification[];
  insuranceInfo?: InsuranceInfo;
  marketPosition?: MarketPosition;
  enrichedAt: Date;
  sources: string[];
  confidence: number;
}

export interface CompanyInfo {
  siret: string;
  siren: string;
  denomination: string;
  formeJuridique?: string;
  dateCreation?: Date;
  adresse?: {
    numero?: string;
    voie?: string;
    codePostal: string;
    commune: string;
  };
  activitePrincipale?: {
    code: string;
    libelle: string;
  };
  effectif?: {
    tranche: string;
    estimation?: number;
  };
  chiffreAffaires?: number;
  estActive: boolean;
}

export interface RGEQualification {
  organisme: string;
  domaine: string;
  mention: string;
  dateValidite: Date;
  estValide: boolean;
  travaux: string[];
}

export interface InsuranceInfo {
  assureur?: string;
  typeGarantie: string;
  montantCouverture?: number;
  dateValidite?: Date;
  estConforme: boolean;
}

export interface MarketPosition {
  segment: 'petit_artisan' | 'pme' | 'eti' | 'grande_entreprise';
  anciennete: number;
  notoriete: 'locale' | 'regionale' | 'nationale';
  specialisation: string[];
}

/**
 * Service centralisé d'enrichissement
 */
export class EnrichmentService {
  private apiBaseUrl = 'https://api.insee.fr/entreprises/sirene/V3';
  private rgeApiUrl = 'https://data.ademe.fr/data-fair/api/v1/datasets/liste-des-entreprises-rge-2';

  /**
   * Enrichir les données d'une entreprise à partir de son SIRET
   */
  async enrichCompanyBySiret(siret: string): Promise<EnrichmentResult> {
    const sources: string[] = [];
    let confidence = 0;

    const result: EnrichmentResult = {
      enrichedAt: new Date(),
      sources: [],
      confidence: 0,
    };

    // Nettoyer le SIRET
    const cleanSiret = siret.replace(/\s/g, '');
    if (!/^\d{14}$/.test(cleanSiret)) {
      console.warn('[Enrichment] SIRET invalide:', siret);
      return result;
    }

    // 1. Données INSEE (simulées pour l'instant)
    try {
      const inseeData = await this.fetchInseeData(cleanSiret);
      if (inseeData) {
        result.companyInfo = inseeData;
        sources.push('INSEE');
        confidence += 40;
      }
    } catch (err) {
      console.warn('[Enrichment] Erreur INSEE:', err);
    }

    // 2. Qualifications RGE
    try {
      const rgeData = await this.fetchRGEQualifications(cleanSiret);
      if (rgeData && rgeData.length > 0) {
        result.rgeQualifications = rgeData;
        sources.push('ADEME RGE');
        confidence += 30;
      }
    } catch (err) {
      console.warn('[Enrichment] Erreur RGE:', err);
    }

    // 3. Calcul de la position marché
    if (result.companyInfo) {
      result.marketPosition = this.calculateMarketPosition(result.companyInfo);
      confidence += 15;
    }

    // 4. Informations assurance (simulées)
    result.insuranceInfo = this.generateInsuranceInfo(result.companyInfo);
    if (result.insuranceInfo) {
      sources.push('Estimation');
      confidence += 15;
    }

    result.sources = sources;
    result.confidence = Math.min(100, confidence);

    return result;
  }

  /**
   * Recherche d'entreprise par nom
   */
  async searchCompanyByName(name: string, codePostal?: string): Promise<CompanyInfo[]> {
    // Pour l'instant, retourne des résultats simulés
    // À connecter à l'API INSEE en production
    console.log('[Enrichment] Recherche entreprise:', name, codePostal);

    return [];
  }

  /**
   * Vérifier la validité RGE d'une entreprise
   */
  async checkRGEValidity(siret: string, domaineTravaux?: string): Promise<{
    estRGE: boolean;
    qualifications: RGEQualification[];
    domaineCouvert: boolean;
  }> {
    const qualifications = await this.fetchRGEQualifications(siret);

    if (!qualifications || qualifications.length === 0) {
      return {
        estRGE: false,
        qualifications: [],
        domaineCouvert: false,
      };
    }

    // Filtrer les qualifications valides
    const validQualifications = qualifications.filter(q => q.estValide);

    // Vérifier si le domaine est couvert
    let domaineCouvert = false;
    if (domaineTravaux && validQualifications.length > 0) {
      const domaineNormalized = domaineTravaux.toLowerCase();
      domaineCouvert = validQualifications.some(q =>
        q.travaux.some(t => t.toLowerCase().includes(domaineNormalized)) ||
        q.domaine.toLowerCase().includes(domaineNormalized)
      );
    }

    return {
      estRGE: validQualifications.length > 0,
      qualifications: validQualifications,
      domaineCouvert,
    };
  }

  // === Méthodes de fetching ===

  /**
   * Récupérer les données INSEE (simulé)
   * En production, utiliser l'API INSEE avec authentification OAuth2
   */
  private async fetchInseeData(siret: string): Promise<CompanyInfo | null> {
    // Simulation basée sur le SIRET
    // En production: appel à https://api.insee.fr/entreprises/sirene/V3/siret/{siret}

    // Pour la démo, générer des données réalistes basées sur le SIRET
    const siren = siret.substring(0, 9);
    const nic = siret.substring(9, 14);

    // Extraire le département du code postal (caractères 10-11 dans certains cas)
    const departement = this.guesseDepartement(siret);

    return {
      siret,
      siren,
      denomination: this.generateCompanyName(siret),
      formeJuridique: this.generateFormeJuridique(siret),
      dateCreation: this.generateDateCreation(siret),
      adresse: {
        codePostal: departement + '000',
        commune: this.generateCommune(departement),
      },
      activitePrincipale: {
        code: '43.2' + (parseInt(siret[5]) % 10).toString(),
        libelle: this.generateActivite(siret),
      },
      effectif: this.generateEffectif(siret),
      estActive: true,
    };
  }

  /**
   * Récupérer les qualifications RGE (simulé)
   * En production, utiliser l'API ADEME
   */
  private async fetchRGEQualifications(siret: string): Promise<RGEQualification[]> {
    // Simulation: environ 30% des entreprises sont RGE
    const hash = this.hashSiret(siret);
    if (hash % 10 > 3) {
      return [];
    }

    const qualifications: RGEQualification[] = [];

    // Générer 1-3 qualifications
    const nbQualifs = (hash % 3) + 1;
    const domaines = [
      { domaine: 'Isolation', mention: 'Isolation thermique par l\'extérieur', travaux: ['ITE', 'Isolation façade'] },
      { domaine: 'Chauffage', mention: 'Installation de pompe à chaleur', travaux: ['PAC', 'Chauffage', 'Climatisation'] },
      { domaine: 'Ventilation', mention: 'Installation VMC', travaux: ['VMC', 'Ventilation'] },
      { domaine: 'Menuiseries', mention: 'Fenêtres et portes', travaux: ['Fenêtre', 'Porte', 'Menuiserie'] },
      { domaine: 'Solaire', mention: 'Installation photovoltaïque', travaux: ['Panneaux solaires', 'Photovoltaïque'] },
    ];

    for (let i = 0; i < nbQualifs; i++) {
      const domaine = domaines[(hash + i) % domaines.length];
      const validite = new Date();
      validite.setMonth(validite.getMonth() + 12 + (hash % 24)); // Valide 1-3 ans

      qualifications.push({
        organisme: ['Qualibat', 'Qualit\'EnR', 'QualiPAC', 'RGE Eco Artisan'][(hash + i) % 4],
        domaine: domaine.domaine,
        mention: domaine.mention,
        dateValidite: validite,
        estValide: validite > new Date(),
        travaux: domaine.travaux,
      });
    }

    return qualifications;
  }

  /**
   * Calculer la position marché
   */
  private calculateMarketPosition(company: CompanyInfo): MarketPosition {
    let segment: MarketPosition['segment'] = 'petit_artisan';
    const effectifEstime = company.effectif?.estimation || 2;

    if (effectifEstime >= 250) segment = 'grande_entreprise';
    else if (effectifEstime >= 50) segment = 'eti';
    else if (effectifEstime >= 10) segment = 'pme';

    const anciennete = company.dateCreation
      ? Math.floor((Date.now() - company.dateCreation.getTime()) / (365.25 * 24 * 60 * 60 * 1000))
      : 5;

    let notoriete: MarketPosition['notoriete'] = 'locale';
    if (effectifEstime >= 50) notoriete = 'nationale';
    else if (effectifEstime >= 15) notoriete = 'regionale';

    const specialisation = [company.activitePrincipale?.libelle || 'BTP général'];

    return {
      segment,
      anciennete,
      notoriete,
      specialisation,
    };
  }

  /**
   * Générer des informations d'assurance (estimation)
   */
  private generateInsuranceInfo(company?: CompanyInfo): InsuranceInfo {
    return {
      typeGarantie: 'Décennale + RC Pro',
      estConforme: true,
      dateValidite: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      montantCouverture: company?.effectif?.estimation
        ? company.effectif.estimation * 100000
        : 500000,
    };
  }

  // === Helpers de génération ===

  private hashSiret(siret: string): number {
    let hash = 0;
    for (let i = 0; i < siret.length; i++) {
      hash = ((hash << 5) - hash) + siret.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  private guesseDepartement(siret: string): string {
    const sum = siret.split('').reduce((a, b) => a + parseInt(b), 0);
    const depts = ['75', '69', '33', '59', '13', '31', '44', '67', '06', '34'];
    return depts[sum % depts.length];
  }

  private generateCompanyName(siret: string): string {
    const prefixes = ['SARL', 'SAS', 'EURL', 'EI'];
    const names = ['BATIRENOOV', 'ARTISAN PRO', 'RENOV HABITAT', 'CONSTRUCTIONS MODERNES',
                   'PLOMBERIE EXPRESS', 'ELEC SERVICES', 'ISOLATION PLUS', 'MENUISERIE EXPERT'];
    const hash = this.hashSiret(siret);
    return `${prefixes[hash % prefixes.length]} ${names[hash % names.length]}`;
  }

  private generateFormeJuridique(siret: string): string {
    const formes = ['SARL', 'SAS', 'EURL', 'SA', 'EI', 'SASU'];
    return formes[this.hashSiret(siret) % formes.length];
  }

  private generateDateCreation(siret: string): Date {
    const hash = this.hashSiret(siret);
    const yearsAgo = (hash % 30) + 1;
    const date = new Date();
    date.setFullYear(date.getFullYear() - yearsAgo);
    return date;
  }

  private generateCommune(departement: string): string {
    const communes: Record<string, string> = {
      '75': 'PARIS', '69': 'LYON', '33': 'BORDEAUX', '59': 'LILLE',
      '13': 'MARSEILLE', '31': 'TOULOUSE', '44': 'NANTES', '67': 'STRASBOURG',
      '06': 'NICE', '34': 'MONTPELLIER',
    };
    return communes[departement] || 'COMMUNE';
  }

  private generateActivite(siret: string): string {
    const activites = [
      'Travaux de maçonnerie générale',
      'Travaux d\'installation électrique',
      'Travaux de plomberie et installation de chauffage',
      'Travaux de peinture et vitrerie',
      'Travaux de menuiserie bois et PVC',
      'Travaux d\'isolation',
      'Travaux de couverture',
      'Travaux de revêtement des sols et murs',
    ];
    return activites[this.hashSiret(siret) % activites.length];
  }

  private generateEffectif(siret: string): { tranche: string; estimation: number } {
    const hash = this.hashSiret(siret);
    const tranches = [
      { tranche: '1-2', estimation: 2 },
      { tranche: '3-5', estimation: 4 },
      { tranche: '6-9', estimation: 7 },
      { tranche: '10-19', estimation: 14 },
      { tranche: '20-49', estimation: 30 },
      { tranche: '50-99', estimation: 70 },
    ];
    // Majorité de petites entreprises
    const distribution = [0, 0, 0, 0, 1, 1, 1, 2, 2, 3, 4, 5];
    return tranches[distribution[hash % distribution.length]];
  }
}

export const enrichmentService = new EnrichmentService();
export default enrichmentService;
