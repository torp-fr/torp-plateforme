/**
 * TORP Phase 0 - Service CCTP
 * Module 0.5 : Génération du Cahier des Clauses Techniques Particulières
 */

import { supabase } from '@/lib/supabase';
import type {
  CCTPDocument,
  CCTPStatus,
  CCTPLot,
  CCTPArticle,
  Article1_MarketObject,
  Article2_GeneralDescription,
  Article3_LotSpecifications,
  Article4_ContractorDocuments,
  Article5_Scheduling,
  Article6_FinancialConditions,
  Article7_SpecialClauses,
  MaterialSpecification,
  TechnicalPrescription,
  QualityRequirement,
  DPGF,
  DPGFLot,
  WorksPlanning,
  PlanningPhase,
} from '@/types/phase0/cctp.types';
import type { Property } from '@/types/phase0/property.types';
import type { WorkProject } from '@/types/phase0/work-project.types';
import type { SelectedLot, LotType } from '@/types/phase0/lots.types';
import type { MasterOwnerProfile } from '@/types/phase0/owner.types';
import type { EstimationRange, Priority } from '@/types/phase0/common.types';

// =============================================================================
// TYPES
// =============================================================================

export interface CCTPGenerationInput {
  projectId: string;
  property: Partial<Property>;
  workProject: Partial<WorkProject>;
  selectedLots: SelectedLot[];
  ownerProfile: Partial<MasterOwnerProfile>;
  finishLevel: 'basic' | 'standard' | 'premium' | 'luxury';
  includeDPGF: boolean;
  includePlanning: boolean;
}

export interface CCTPLotGeneration {
  lotType: LotType;
  lotName: string;
  specifications: TechnicalPrescription[];
  materials: MaterialSpecification[];
  qualityRequirements: QualityRequirement[];
  estimatedBudget: EstimationRange;
  estimatedDuration: number;
}

export interface DPGFGenerationResult {
  dpgf: DPGF;
  totalHT: number;
  totalTTC: number;
  lotBreakdown: Array<{
    lotType: LotType;
    totalHT: number;
    percentage: number;
  }>;
}

// =============================================================================
// MATERIAL DATABASE (simplified)
// =============================================================================

const MATERIAL_DATABASE: Record<string, MaterialSpecification[]> = {
  isolation_thermique: [
    {
      id: 'iso_lv_120',
      category: 'isolation',
      designation: 'Laine de verre semi-rigide',
      brand: undefined,
      reference: undefined,
      characteristics: {
        thickness: 120,
        thermalResistance: 3.75,
        density: 18,
      },
      performance: {
        thermalConductivity: 0.032,
        fireRating: 'A1',
        acousticRating: 35,
      },
      certification: ['ACERMI', 'CE'],
      priceRange: { min: 8, max: 15 },
      unit: 'm²',
      origin: 'France',
      warranty: 10,
    },
    {
      id: 'iso_pu_100',
      category: 'isolation',
      designation: 'Panneau polyuréthane',
      characteristics: {
        thickness: 100,
        thermalResistance: 4.55,
        density: 35,
      },
      performance: {
        thermalConductivity: 0.022,
        fireRating: 'E',
      },
      certification: ['ACERMI', 'CE'],
      priceRange: { min: 20, max: 35 },
      unit: 'm²',
      warranty: 10,
    },
  ],
  electricite: [
    {
      id: 'elec_tableau',
      category: 'electricite',
      designation: 'Tableau électrique équipé',
      characteristics: {
        capacity: '2 rangées',
        protection: 'IP30',
      },
      certification: ['NF', 'CE'],
      priceRange: { min: 150, max: 400 },
      unit: 'U',
      warranty: 2,
    },
    {
      id: 'elec_prise',
      category: 'electricite',
      designation: 'Prise de courant 2P+T',
      brand: undefined,
      characteristics: {
        amperage: 16,
        protection: 'IP20',
      },
      certification: ['NF', 'CE'],
      priceRange: { min: 15, max: 50 },
      unit: 'U',
      warranty: 2,
    },
  ],
  plomberie: [
    {
      id: 'plomb_cuivre_16',
      category: 'plomberie',
      designation: 'Tube cuivre écroui 16/18',
      characteristics: {
        diameter: 16,
        wallThickness: 1,
      },
      certification: ['NF'],
      priceRange: { min: 8, max: 12 },
      unit: 'ml',
      warranty: 10,
    },
    {
      id: 'plomb_per_16',
      category: 'plomberie',
      designation: 'Tube PER gainé 16',
      characteristics: {
        diameter: 16,
      },
      certification: ['NF'],
      priceRange: { min: 2, max: 5 },
      unit: 'ml',
      warranty: 10,
    },
  ],
  carrelage_faience: [
    {
      id: 'carrel_gres_60',
      category: 'carrelage',
      designation: 'Carrelage grès cérame 60x60',
      characteristics: {
        dimensions: '60x60 cm',
        thickness: 10,
        finish: 'mat',
      },
      performance: {
        abrasionRating: 'PEI IV',
        slipResistance: 'R10',
      },
      certification: ['CE', 'UPEC'],
      priceRange: { min: 25, max: 60 },
      unit: 'm²',
      warranty: 5,
    },
  ],
  peinture: [
    {
      id: 'peint_acryl_mat',
      category: 'peinture',
      designation: 'Peinture acrylique mate',
      characteristics: {
        finish: 'mat',
        coverage: '10-12 m²/L',
      },
      performance: {
        vocContent: '< 30 g/L',
      },
      certification: ['NF Environnement', 'Écolabel'],
      priceRange: { min: 4, max: 12 },
      unit: 'm²',
      warranty: 2,
    },
  ],
};

// =============================================================================
// SERVICE
// =============================================================================

export class CCTPService {
  /**
   * Generates a complete CCTP document
   */
  static async generateCCTP(input: CCTPGenerationInput): Promise<CCTPDocument> {
    const {
      projectId,
      property,
      workProject,
      selectedLots,
      ownerProfile,
      finishLevel,
      includeDPGF,
      includePlanning,
    } = input;

    // Generate articles
    const article1 = this.generateArticle1(property, workProject, ownerProfile);
    const article2 = this.generateArticle2(property, workProject, selectedLots);
    const article3 = this.generateArticle3(selectedLots, finishLevel, property);
    const article4 = this.generateArticle4(selectedLots);
    const article5 = this.generateArticle5(workProject, selectedLots);
    const article6 = this.generateArticle6(workProject);
    const article7 = this.generateArticle7(property, workProject);

    // Generate DPGF if requested
    let dpgf: DPGF | undefined;
    if (includeDPGF) {
      const dpgfResult = this.generateDPGF(selectedLots, property, finishLevel);
      dpgf = dpgfResult.dpgf;
    }

    // Generate planning if requested
    let planning: WorksPlanning | undefined;
    if (includePlanning) {
      planning = this.generatePlanning(selectedLots, workProject);
    }

    // Generate lot specifications
    const lots = this.generateCCTPLots(selectedLots, finishLevel, property);

    const cctp: CCTPDocument = {
      id: crypto.randomUUID(),
      projectId,
      version: 1,
      status: 'draft',
      title: `CCTP - ${workProject.general?.name || 'Projet de rénovation'}`,
      reference: this.generateReference(projectId),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),

      // Project info
      projectType: workProject.scope?.workType || 'renovation',
      finishLevel,

      // Articles
      article1,
      article2,
      article3,
      article4,
      article5,
      article6,
      article7,

      // Lots details
      lots,

      // Annexes
      dpgf,
      planning,

      // Metadata
      torpMetadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'system',
        version: 1,
        source: 'generation',
        completeness: this.calculateCompleteness(input),
        aiEnriched: false,
      },
    };

    return cctp;
  }

  /**
   * Article 1: Objet du marché
   */
  static generateArticle1(
    property: Partial<Property>,
    workProject: Partial<WorkProject>,
    ownerProfile: Partial<MasterOwnerProfile>
  ): Article1_MarketObject {
    const address = property.identification?.address;
    const addressStr = address
      ? `${address.streetNumber || ''} ${address.streetName}, ${address.postalCode} ${address.city}`
      : 'Adresse à préciser';

    return {
      title: 'Objet du marché',
      projectName: workProject.general?.name || 'Projet de travaux',
      projectDescription: workProject.general?.description ||
        `Travaux de ${workProject.scope?.workType || 'rénovation'} sur le bien situé ${addressStr}`,
      siteAddress: addressStr,
      masterOwner: {
        name: this.getOwnerName(ownerProfile),
        address: ownerProfile.contact?.address
          ? `${ownerProfile.contact.address.streetName}, ${ownerProfile.contact.address.postalCode} ${ownerProfile.contact.address.city}`
          : 'Adresse à préciser',
        contact: ownerProfile.contact?.email || 'Contact à préciser',
      },
      projectManager: workProject.team?.architect
        ? {
            name: workProject.team.architect.name || 'À définir',
            company: workProject.team.architect.company,
            contact: workProject.team.architect.email || '',
          }
        : undefined,
      marketType: 'travaux',
      decomposition: 'lots_separes',
      executionMode: 'entreprise_generale',
    };
  }

  /**
   * Article 2: Description générale des ouvrages
   */
  static generateArticle2(
    property: Partial<Property>,
    workProject: Partial<WorkProject>,
    selectedLots: SelectedLot[]
  ): Article2_GeneralDescription {
    const characteristics = property.characteristics;
    const construction = property.construction;

    return {
      title: 'Description générale des ouvrages',
      existingState: {
        propertyType: property.identification?.type || 'house',
        surface: characteristics?.surfaces?.livingArea || 0,
        floors: characteristics?.numberOfFloors || 1,
        yearBuilt: construction?.yearBuilt || 0,
        structureType: construction?.structure?.type || 'unknown',
        currentCondition: property.currentCondition?.overall || 'fair',
      },
      projectScope: {
        workType: workProject.scope?.workType || 'renovation',
        affectedAreas: selectedLots.map(l => l.name),
        surfaceImpacted: this.calculateImpactedSurface(selectedLots, characteristics?.surfaces?.livingArea || 100),
        mainObjectives: workProject.general?.objectives || [],
      },
      technicalContext: {
        siteAccess: property.location?.accessibility?.vehicleAccess || 'normal',
        parkingAvailable: property.parking?.available || false,
        storageArea: property.parking?.garageCount
          ? `Garage disponible (${property.parking.garageCount} places)`
          : 'Zone de stockage à définir sur site',
        neighbourhoodConstraints: property.condo?.isInCondo
          ? ['Contraintes de copropriété', 'Horaires de travaux limités']
          : [],
      },
      applicableDocuments: [
        'Plans de l\'existant',
        'Diagnostics techniques',
        'Règlement de copropriété (si applicable)',
        'PLU de la commune',
      ],
    };
  }

  /**
   * Article 3: Spécifications techniques par lot
   */
  static generateArticle3(
    selectedLots: SelectedLot[],
    finishLevel: string,
    property: Partial<Property>
  ): Article3_LotSpecifications {
    return {
      title: 'Spécifications techniques par lot',
      lots: selectedLots.map(lot => ({
        lotNumber: this.getLotNumber(lot.type),
        lotType: lot.type,
        lotName: lot.name,
        scope: lot.description || this.getDefaultLotScope(lot.type),
        technicalPrescriptions: this.getLotPrescriptions(lot.type, finishLevel),
        materials: this.getLotMaterials(lot.type, finishLevel),
        qualityRequirements: this.getLotQualityRequirements(lot.type),
        executionRules: this.getLotExecutionRules(lot.type),
        applicableDTU: this.getLotDTU(lot.type),
      })),
    };
  }

  /**
   * Article 4: Documents à fournir par les entreprises
   */
  static generateArticle4(selectedLots: SelectedLot[]): Article4_ContractorDocuments {
    const requiredQualifications: string[] = [];

    // Add RGE if energy-related lots
    const energyLots = ['isolation_thermique', 'chauffage', 'menuiseries_exterieures', 'ventilation'];
    if (selectedLots.some(l => energyLots.includes(l.type))) {
      requiredQualifications.push('Qualification RGE (Reconnu Garant de l\'Environnement)');
    }

    // Add Qualibat for major works
    const majorLots = ['gros_oeuvre', 'charpente', 'couverture'];
    if (selectedLots.some(l => majorLots.includes(l.type))) {
      requiredQualifications.push('Qualification Qualibat');
    }

    // Add electrical certification
    if (selectedLots.some(l => l.type === 'electricite')) {
      requiredQualifications.push('Habilitation électrique');
      requiredQualifications.push('Attestation CONSUEL en fin de travaux');
    }

    // Add gas certification
    if (selectedLots.some(l => l.type === 'chauffage')) {
      requiredQualifications.push('Qualification PG (Professionnel Gaz) si travaux gaz');
    }

    return {
      title: 'Documents à fournir par les entreprises',
      beforeContract: {
        administrative: [
          'Extrait Kbis de moins de 3 mois',
          'Attestation URSSAF de moins de 6 mois',
          'Attestation d\'assurance RC professionnelle',
          'Attestation d\'assurance décennale',
          'Références de chantiers similaires',
        ],
        technical: [
          'Mémoire technique',
          'Planning prévisionnel d\'exécution',
          'Liste du personnel affecté au chantier',
          'Liste des sous-traitants éventuels',
        ],
        financial: [
          'Devis détaillé',
          'Décomposition du prix global et forfaitaire (DPGF)',
          'Conditions de règlement proposées',
        ],
      },
      duringExecution: {
        planningDocuments: [
          'Planning d\'exécution détaillé',
          'Comptes-rendus de chantier hebdomadaires',
          'Situations de travaux mensuelles',
        ],
        technicalDocuments: [
          'Fiches techniques des matériaux',
          'Plans d\'exécution',
          'Notes de calcul si nécessaire',
          'PV d\'essais et contrôles',
        ],
        qualityDocuments: [
          'Procès-verbaux de réception des supports',
          'Fiches d\'autocontrôle',
          'Photos d\'avancement',
        ],
      },
      atCompletion: {
        administrativeDocuments: [
          'DOE (Dossier des Ouvrages Exécutés)',
          'Attestations de garantie',
          'Certificats de conformité',
        ],
        technicalDocuments: [
          'Plans de récolement',
          'Notices de maintenance',
          'Fiches d\'entretien',
        ],
        certifications: requiredQualifications,
      },
      requiredQualifications,
    };
  }

  /**
   * Article 5: Délais et planification
   */
  static generateArticle5(
    workProject: Partial<WorkProject>,
    selectedLots: SelectedLot[]
  ): Article5_Scheduling {
    const totalDuration = this.calculateTotalDuration(selectedLots);

    return {
      title: 'Délais et planification',
      globalDuration: {
        preparation: 2, // weeks
        execution: Math.ceil(totalDuration / 5), // convert days to weeks
        reception: 1, // week
      },
      keyMilestones: [
        {
          name: 'Ordre de service de démarrage',
          deadline: 'J+0',
          description: 'Notification de l\'ordre de service',
        },
        {
          name: 'Installation de chantier',
          deadline: 'J+7',
          description: 'Mise en place des installations de chantier',
        },
        {
          name: 'Fin des travaux de gros œuvre',
          deadline: `J+${Math.ceil(totalDuration * 0.4)}`,
          description: 'Achèvement des travaux de structure',
        },
        {
          name: 'Fin des travaux tous corps d\'état',
          deadline: `J+${totalDuration - 7}`,
          description: 'Achèvement de l\'ensemble des travaux',
        },
        {
          name: 'Opérations préalables à la réception',
          deadline: `J+${totalDuration - 3}`,
          description: 'Vérifications et levée des réserves',
        },
        {
          name: 'Réception des travaux',
          deadline: `J+${totalDuration}`,
          description: 'Réception avec ou sans réserves',
        },
      ],
      workingHours: {
        weekdays: { start: '07:30', end: '18:00' },
        saturday: { start: '08:00', end: '12:00' },
        sundayAndHolidays: false,
      },
      penalties: {
        delayPenalty: {
          rate: 1 / 1000, // 1/1000 per day
          cap: 5, // 5% max
        },
        absencePenalty: {
          rate: 500, // €500 per day
          conditions: 'En cas d\'absence non justifiée',
        },
      },
      coordinationRules: [
        'Réunion de chantier hebdomadaire obligatoire',
        'Notification 48h avant intervention sur parties communes',
        'Respect des plannings d\'intervention des autres lots',
      ],
    };
  }

  /**
   * Article 6: Conditions financières
   */
  static generateArticle6(workProject: Partial<WorkProject>): Article6_FinancialConditions {
    return {
      title: 'Conditions financières',
      priceType: 'forfaitaire',
      priceRevision: {
        applicable: workProject.planning?.timeline?.estimatedDuration
          ? workProject.planning.timeline.estimatedDuration > 180
          : false,
        index: 'BT01',
        formula: 'P = P0 × (BT01/BT01₀)',
      },
      paymentTerms: {
        advancePayment: {
          percentage: 0, // No advance by default
          conditions: 'Non applicable',
        },
        progressPayments: {
          frequency: 'monthly',
          basis: 'Situations de travaux validées',
          retentionPercentage: 5,
        },
        finalPayment: {
          conditions: 'Après réception et levée des réserves',
          retentionRelease: 'À l\'expiration du délai de parfait achèvement (1 an)',
        },
      },
      guarantees: {
        performanceBond: {
          required: false,
          percentage: 5,
        },
        retentionGuarantee: {
          percentage: 5,
          releaseConditions: 'Fin du délai de parfait achèvement',
        },
      },
      insurance: {
        rcRequired: true,
        decennialRequired: true,
        minimumCoverage: 1000000,
      },
    };
  }

  /**
   * Article 7: Clauses particulières
   */
  static generateArticle7(
    property: Partial<Property>,
    workProject: Partial<WorkProject>
  ): Article7_SpecialClauses {
    const clauses: Article7_SpecialClauses['clauses'] = [
      {
        id: 'clause_proprete',
        title: 'Propreté du chantier',
        content: 'L\'entrepreneur maintient le chantier en état de propreté permanent. Le nettoyage quotidien est obligatoire.',
        isMandatory: true,
      },
      {
        id: 'clause_securite',
        title: 'Sécurité',
        content: 'L\'entrepreneur respecte les règles de sécurité en vigueur et met en place les protections nécessaires.',
        isMandatory: true,
      },
      {
        id: 'clause_nuisances',
        title: 'Limitation des nuisances',
        content: 'L\'entrepreneur limite les nuisances sonores et respecte les horaires de travail autorisés.',
        isMandatory: true,
      },
    ];

    // Add condo-specific clauses
    if (property.condo?.isInCondo) {
      clauses.push({
        id: 'clause_copro',
        title: 'Règles de copropriété',
        content: 'L\'entrepreneur respecte le règlement de copropriété et les décisions de l\'assemblée générale.',
        isMandatory: true,
      });
    }

    // Add heritage-specific clauses
    if (property.heritage?.isInProtectedZone) {
      clauses.push({
        id: 'clause_abf',
        title: 'Prescriptions ABF',
        content: 'L\'entrepreneur respecte les prescriptions de l\'Architecte des Bâtiments de France.',
        isMandatory: true,
      });
    }

    // Add occupied site clause
    if (workProject.constraints?.occupancy?.duringWorks) {
      clauses.push({
        id: 'clause_occupation',
        title: 'Site occupé pendant les travaux',
        content: 'Les travaux sont réalisés en site occupé. L\'entrepreneur prend toutes dispositions pour maintenir l\'accès aux zones habitées.',
        isMandatory: true,
      });
    }

    return {
      title: 'Clauses particulières',
      clauses,
      environmentalRequirements: [
        'Tri sélectif des déchets de chantier',
        'Utilisation de matériaux à faible impact environnemental',
        'Limitation des consommations d\'eau et d\'énergie',
      ],
      wasteManagement: {
        sortingRequired: true,
        disposalResponsibility: 'entrepreneur',
        recyclableCategories: ['bois', 'métaux', 'gravats', 'plastiques'],
        traceabilityRequired: true,
      },
      qualityAssurance: {
        autocontrolRequired: true,
        externalControlRequired: false,
        holdPoints: [
          'Avant coulage béton',
          'Avant fermeture des cloisons (réseaux)',
          'Avant peinture de finition',
        ],
      },
    };
  }

  /**
   * Generates DPGF (Décomposition du Prix Global et Forfaitaire)
   */
  static generateDPGF(
    selectedLots: SelectedLot[],
    property: Partial<Property>,
    finishLevel: string
  ): DPGFGenerationResult {
    const surface = property.characteristics?.surfaces?.livingArea || 100;
    const lotItems: DPGFLot[] = [];
    let totalHT = 0;

    selectedLots.forEach((lot, index) => {
      const lotPrices = this.calculateLotPrices(lot, surface, finishLevel);
      const lotTotal = lotPrices.reduce((sum, item) => sum + item.totalHT, 0);

      lotItems.push({
        lotNumber: this.getLotNumber(lot.type),
        lotName: lot.name,
        items: lotPrices.map((price, pIndex) => ({
          reference: `${this.getLotNumber(lot.type)}.${pIndex + 1}`,
          designation: price.designation,
          unit: price.unit,
          quantity: price.quantity,
          unitPriceHT: price.unitPrice,
          totalHT: price.totalHT,
        })),
        subtotalHT: lotTotal,
      });

      totalHT += lotTotal;
    });

    const tvaRate = 0.10; // 10% for renovation (reduced rate)
    const totalTTC = totalHT * (1 + tvaRate);

    return {
      dpgf: {
        reference: `DPGF-${Date.now()}`,
        date: new Date().toISOString(),
        lots: lotItems,
        summary: {
          totalHT,
          tvaRate,
          tvaAmount: totalHT * tvaRate,
          totalTTC,
        },
      },
      totalHT,
      totalTTC,
      lotBreakdown: lotItems.map(lot => ({
        lotType: selectedLots.find(l => l.name === lot.lotName)?.type || 'other',
        totalHT: lot.subtotalHT,
        percentage: Math.round((lot.subtotalHT / totalHT) * 100),
      })),
    };
  }

  /**
   * Generates works planning
   */
  static generatePlanning(
    selectedLots: SelectedLot[],
    workProject: Partial<WorkProject>
  ): WorksPlanning {
    const phases = this.generatePlanningPhases(selectedLots);
    const totalDuration = phases.reduce((sum, p) => sum + p.duration, 0);

    return {
      reference: `PLAN-${Date.now()}`,
      startDate: workProject.planning?.timeline?.worksStart ||
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // +30 days
      endDate: new Date(
        Date.now() + (30 + totalDuration) * 24 * 60 * 60 * 1000
      ).toISOString(),
      totalDuration,
      phases,
      criticalPath: this.calculateCriticalPath(phases),
      milestones: [
        { name: 'Démarrage', date: 'J+0' },
        { name: 'Fin gros œuvre', date: `J+${Math.ceil(totalDuration * 0.4)}` },
        { name: 'Fin second œuvre', date: `J+${Math.ceil(totalDuration * 0.8)}` },
        { name: 'Réception', date: `J+${totalDuration}` },
      ],
    };
  }

  /**
   * Saves CCTP to database
   */
  static async saveCCTP(cctp: CCTPDocument): Promise<CCTPDocument> {
    const { data, error } = await supabase
      .from('phase0_cctp_lots')
      .upsert({
        project_id: cctp.projectId,
        version: cctp.version,
        status: cctp.status,
        title: cctp.title,
        reference: cctp.reference,
        content: {
          article1: cctp.article1,
          article2: cctp.article2,
          article3: cctp.article3,
          article4: cctp.article4,
          article5: cctp.article5,
          article6: cctp.article6,
          article7: cctp.article7,
        },
        lots: cctp.lots,
        dpgf: cctp.dpgf,
        planning: cctp.planning,
        metadata: cctp.torpMetadata,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'project_id',
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving CCTP:', error);
      throw new Error(`Erreur lors de la sauvegarde du CCTP: ${error.message}`);
    }

    return { ...cctp, id: data.id };
  }

  /**
   * Gets CCTP by project ID
   */
  static async getCCTPByProjectId(projectId: string): Promise<CCTPDocument | null> {
    const { data, error } = await supabase
      .from('phase0_cctp_lots')
      .select('*')
      .eq('project_id', projectId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Erreur lors de la récupération du CCTP: ${error.message}`);
    }

    return this.mapRowToCCTP(data);
  }

  // =============================================================================
  // PRIVATE METHODS
  // =============================================================================

  private static generateReference(projectId: string): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `CCTP-${year}${month}-${projectId.substring(0, 8).toUpperCase()}`;
  }

  private static getOwnerName(ownerProfile: Partial<MasterOwnerProfile>): string {
    const identity = ownerProfile.identity;
    if (!identity) return 'Maître d\'ouvrage';

    if (identity.type === 'B2C') {
      const individual = identity as { firstName?: string; lastName?: string };
      return `${individual.firstName || ''} ${individual.lastName || ''}`.trim() || 'Particulier';
    } else if (identity.type === 'B2B') {
      const company = identity as { companyName?: string };
      return company.companyName || 'Entreprise';
    } else {
      const entity = identity as { entityName?: string };
      return entity.entityName || 'Collectivité';
    }
  }

  private static getLotNumber(lotType: LotType): string {
    const lotNumbers: Record<string, string> = {
      demolition: '01',
      gros_oeuvre: '02',
      maconnerie: '03',
      charpente: '04',
      couverture: '05',
      etancheite: '06',
      facades: '07',
      menuiseries_exterieures: '08',
      menuiseries_interieures: '09',
      isolation_thermique: '10',
      cloisons_doublages: '11',
      plomberie: '12',
      electricite: '13',
      chauffage: '14',
      ventilation: '15',
      climatisation: '16',
      carrelage_faience: '17',
      parquet_sols_souples: '18',
      peinture: '19',
      plafonds: '20',
      cuisine_equipee: '21',
      salle_bains: '22',
    };
    return lotNumbers[lotType] || '99';
  }

  private static getDefaultLotScope(lotType: LotType): string {
    const scopes: Record<string, string> = {
      demolition: 'Travaux de démolition et évacuation des déchets',
      gros_oeuvre: 'Travaux de structure et maçonnerie porteuse',
      electricite: 'Installation électrique complète aux normes NF C 15-100',
      plomberie: 'Réseaux d\'alimentation et d\'évacuation',
      isolation_thermique: 'Isolation thermique des parois',
      peinture: 'Peinture et revêtements muraux',
    };
    return scopes[lotType] || 'Travaux du lot';
  }

  private static getLotPrescriptions(lotType: LotType, finishLevel: string): TechnicalPrescription[] {
    const basePrescriptions: TechnicalPrescription[] = [
      {
        category: 'general',
        requirement: 'Respect des DTU applicables',
        standard: 'DTU',
        isMandatory: true,
      },
      {
        category: 'general',
        requirement: 'Mise en œuvre selon règles de l\'art',
        isMandatory: true,
      },
    ];

    const lotSpecific: Record<string, TechnicalPrescription[]> = {
      electricite: [
        {
          category: 'technique',
          requirement: 'Installation conforme NF C 15-100',
          standard: 'NF C 15-100',
          isMandatory: true,
        },
        {
          category: 'securite',
          requirement: 'Protection différentielle 30mA sur tous circuits',
          isMandatory: true,
        },
      ],
      isolation_thermique: [
        {
          category: 'performance',
          requirement: `Résistance thermique R ≥ ${finishLevel === 'premium' ? '4.5' : '3.7'} m².K/W`,
          standard: 'RT2012/RE2020',
          isMandatory: true,
        },
        {
          category: 'technique',
          requirement: 'Pose continue sans pont thermique',
          isMandatory: true,
        },
      ],
      plomberie: [
        {
          category: 'technique',
          requirement: 'Réseau en attente équipé de bouchons',
          isMandatory: true,
        },
        {
          category: 'performance',
          requirement: 'Pression d\'essai 10 bars minimum',
          isMandatory: true,
        },
      ],
    };

    return [...basePrescriptions, ...(lotSpecific[lotType] || [])];
  }

  private static getLotMaterials(lotType: LotType, finishLevel: string): MaterialSpecification[] {
    return MATERIAL_DATABASE[lotType] || [];
  }

  private static getLotQualityRequirements(lotType: LotType): QualityRequirement[] {
    return [
      {
        category: 'finition',
        description: 'Finition soignée sans défaut visible',
        verificationMethod: 'Contrôle visuel',
        acceptanceCriteria: 'Absence de défaut à 1.5m',
      },
      {
        category: 'conformite',
        description: 'Conformité aux plans et CCTP',
        verificationMethod: 'Vérification dimensionnelle',
        acceptanceCriteria: 'Tolérances DTU',
      },
    ];
  }

  private static getLotExecutionRules(lotType: LotType): string[] {
    const rules: Record<string, string[]> = {
      electricite: [
        'Repérage de tous les circuits',
        'Passage des câbles sous gaine',
        'Protection des équipements pendant travaux',
      ],
      plomberie: [
        'Essai d\'étanchéité avant fermeture',
        'Calorifugeage des canalisations',
        'Pente d\'évacuation 1% minimum',
      ],
      peinture: [
        'Préparation des supports obligatoire',
        'Application en 2 couches minimum',
        'Protection des ouvrages adjacents',
      ],
    };
    return rules[lotType] || ['Exécution selon règles de l\'art'];
  }

  private static getLotDTU(lotType: LotType): string[] {
    const dtus: Record<string, string[]> = {
      gros_oeuvre: ['DTU 20.1', 'DTU 21'],
      electricite: ['NF C 15-100'],
      plomberie: ['DTU 60.1', 'DTU 60.11'],
      isolation_thermique: ['DTU 45.10', 'DTU 45.11'],
      carrelage_faience: ['DTU 52.2'],
      peinture: ['DTU 59.1'],
      menuiseries_exterieures: ['DTU 36.5', 'DTU 37.1'],
    };
    return dtus[lotType] || [];
  }

  private static generateCCTPLots(
    selectedLots: SelectedLot[],
    finishLevel: string,
    property: Partial<Property>
  ): CCTPLot[] {
    return selectedLots.map(lot => ({
      lotNumber: this.getLotNumber(lot.type),
      lotType: lot.type,
      lotName: lot.name,
      description: lot.description || this.getDefaultLotScope(lot.type),
      technicalPrescriptions: this.getLotPrescriptions(lot.type, finishLevel),
      materials: this.getLotMaterials(lot.type, finishLevel),
      qualityRequirements: this.getLotQualityRequirements(lot.type),
      executionRules: this.getLotExecutionRules(lot.type),
      applicableDTU: this.getLotDTU(lot.type),
      estimatedQuantity: lot.estimatedQuantity,
      unit: lot.unit || 'm²',
    }));
  }

  private static calculateLotPrices(
    lot: SelectedLot,
    surface: number,
    finishLevel: string
  ): Array<{
    designation: string;
    unit: string;
    quantity: number;
    unitPrice: number;
    totalHT: number;
  }> {
    const finishMultiplier = finishLevel === 'premium' ? 1.3 :
                             finishLevel === 'luxury' ? 1.6 :
                             finishLevel === 'basic' ? 0.8 : 1.0;

    // Simplified price calculation
    const basePrices: Record<string, Array<{ designation: string; unit: string; basePricePerUnit: number; quantityFactor: number }>> = {
      electricite: [
        { designation: 'Tableau électrique', unit: 'U', basePricePerUnit: 800, quantityFactor: 1 },
        { designation: 'Points lumineux', unit: 'U', basePricePerUnit: 150, quantityFactor: surface / 10 },
        { designation: 'Prises de courant', unit: 'U', basePricePerUnit: 80, quantityFactor: surface / 5 },
      ],
      plomberie: [
        { designation: 'Alimentation générale', unit: 'Ens', basePricePerUnit: 500, quantityFactor: 1 },
        { designation: 'Points d\'eau', unit: 'U', basePricePerUnit: 300, quantityFactor: 4 },
        { designation: 'Évacuations', unit: 'ml', basePricePerUnit: 50, quantityFactor: 20 },
      ],
      isolation_thermique: [
        { designation: 'Isolation murs', unit: 'm²', basePricePerUnit: 45, quantityFactor: surface * 0.8 },
        { designation: 'Isolation combles', unit: 'm²', basePricePerUnit: 35, quantityFactor: surface * 0.5 },
      ],
      peinture: [
        { designation: 'Préparation supports', unit: 'm²', basePricePerUnit: 8, quantityFactor: surface * 2.5 },
        { designation: 'Peinture finition', unit: 'm²', basePricePerUnit: 18, quantityFactor: surface * 2.5 },
      ],
    };

    const lotPrices = basePrices[lot.type] || [
      { designation: 'Forfait travaux', unit: 'Ens', basePricePerUnit: 5000, quantityFactor: 1 },
    ];

    return lotPrices.map(price => {
      const quantity = Math.round(price.quantityFactor);
      const unitPrice = Math.round(price.basePricePerUnit * finishMultiplier);
      return {
        designation: price.designation,
        unit: price.unit,
        quantity,
        unitPrice,
        totalHT: quantity * unitPrice,
      };
    });
  }

  private static calculateImpactedSurface(lots: SelectedLot[], totalSurface: number): number {
    // Estimate impacted surface based on lot types
    const surfaceFactors: Record<string, number> = {
      peinture: 1.0,
      electricite: 0.8,
      plomberie: 0.3,
      isolation_thermique: 0.6,
      carrelage_faience: 0.4,
    };

    const maxFactor = Math.max(...lots.map(l => surfaceFactors[l.type] || 0.5));
    return Math.round(totalSurface * maxFactor);
  }

  private static calculateTotalDuration(lots: SelectedLot[]): number {
    const baseDurations: Record<string, number> = {
      demolition: 5,
      gros_oeuvre: 20,
      electricite: 10,
      plomberie: 8,
      isolation_thermique: 7,
      cloisons_doublages: 10,
      carrelage_faience: 8,
      peinture: 12,
      menuiseries_interieures: 5,
      menuiseries_exterieures: 3,
    };

    // Account for some parallelization
    const totalDays = lots.reduce((sum, lot) => {
      return sum + (baseDurations[lot.type] || 5);
    }, 0);

    return Math.round(totalDays * 0.7); // 30% parallelization factor
  }

  private static generatePlanningPhases(lots: SelectedLot[]): PlanningPhase[] {
    const phases: PlanningPhase[] = [];

    // Group lots by phase
    const phaseGroups = {
      preparation: ['demolition', 'echafaudages'],
      gros_oeuvre: ['gros_oeuvre', 'maconnerie', 'charpente', 'couverture'],
      clos_couvert: ['menuiseries_exterieures', 'etancheite', 'facades'],
      technique: ['electricite', 'plomberie', 'chauffage', 'ventilation', 'climatisation'],
      amenagement: ['isolation_thermique', 'cloisons_doublages', 'menuiseries_interieures'],
      finitions: ['carrelage_faience', 'parquet_sols_souples', 'peinture', 'plafonds'],
      equipements: ['cuisine_equipee', 'salle_bains', 'domotique'],
    };

    let offset = 0;
    Object.entries(phaseGroups).forEach(([phaseName, lotTypes]) => {
      const phaseLots = lots.filter(l => lotTypes.includes(l.type));
      if (phaseLots.length > 0) {
        const duration = phaseLots.reduce((sum, lot) => {
          return sum + (lot.estimatedDurationDays || 5);
        }, 0);

        phases.push({
          name: phaseName,
          startOffset: offset,
          duration: Math.round(duration * 0.8),
          lots: phaseLots.map(l => l.type),
          dependencies: phases.length > 0 ? [phases[phases.length - 1].name] : [],
        });

        offset += Math.round(duration * 0.6); // Some overlap
      }
    });

    return phases;
  }

  private static calculateCriticalPath(phases: PlanningPhase[]): string[] {
    // Simplified: return sequential phase names
    return phases.map(p => p.name);
  }

  private static calculateCompleteness(input: CCTPGenerationInput): number {
    let completeness = 0;

    if (input.property?.identification?.address) completeness += 15;
    if (input.workProject?.general?.name) completeness += 10;
    if (input.workProject?.scope?.workType) completeness += 15;
    if (input.selectedLots.length > 0) completeness += 30;
    if (input.ownerProfile?.identity) completeness += 15;
    if (input.finishLevel) completeness += 15;

    return completeness;
  }

  private static mapRowToCCTP(row: Record<string, unknown>): CCTPDocument {
    const content = row.content as Record<string, unknown>;

    return {
      id: row.id as string,
      projectId: row.project_id as string,
      version: row.version as number,
      status: row.status as CCTPStatus,
      title: row.title as string,
      reference: row.reference as string,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
      projectType: 'renovation',
      finishLevel: 'standard',
      article1: content.article1 as Article1_MarketObject,
      article2: content.article2 as Article2_GeneralDescription,
      article3: content.article3 as Article3_LotSpecifications,
      article4: content.article4 as Article4_ContractorDocuments,
      article5: content.article5 as Article5_Scheduling,
      article6: content.article6 as Article6_FinancialConditions,
      article7: content.article7 as Article7_SpecialClauses,
      lots: row.lots as CCTPLot[],
      dpgf: row.dpgf as DPGF,
      planning: row.planning as WorksPlanning,
      torpMetadata: row.metadata as CCTPDocument['torpMetadata'],
    };
  }
}

export default CCTPService;
