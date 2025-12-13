/**
 * TORP Phase 1 - Service de Génération du DCE
 * Module 1.1 : Constitution du Dossier de Consultation des Entreprises
 *
 * Génère automatiquement le DCE complet :
 * - Règlement de Consultation (RC) adaptable B2C/B2B/B2G
 * - Acte d'Engagement (AE)
 * - DPGF / DQE / BPU selon le marché
 * - Cadre de Mémoire Technique
 */

import { supabase } from '@/lib/supabase';
import type { Phase0Project } from '@/types/phase0/project.types';
import type { MasterOwnerProfile } from '@/types/phase0/owner.types';
import type { Property } from '@/types/phase0/property.types';
import type { WorkProject } from '@/types/phase0/work-project.types';
import type { SelectedLot } from '@/types/phase0/lots.types';
import type { WizardMode } from '@/types/phase0/wizard.types';
import { EstimationService } from '@/services/phase0/estimation.service';

import type {
  DCEDocument,
  DCEMetadata,
  DCEStatus,
  ReglementConsultation,
  RCIdentification,
  ModalitesCandidature,
  RemiseOffres,
  CriteresSelection,
  PiecesAFournir,
  ModalitesAnalyse,
  AttributionNotification,
  ActeEngagement,
  DecompositionPrix,
  TypeDecompositionPrix,
  CadreMemoireTechnique,
  DCEAnnexe,
  DCEGenerationInfo,
  DCEGenerationConfig,
  PONDERATIONS_DEFAUT,
  PIECES_ADMINISTRATIVES_STANDARD,
  PIECES_TECHNIQUES_STANDARD,
  PIECES_FINANCIERES_STANDARD,
  STRUCTURE_MEMOIRE_TECHNIQUE,
} from '@/types/phase1/dce.types';

// =============================================================================
// TYPES INTERNES
// =============================================================================

export interface DCEGenerationInput {
  project: Phase0Project;
  config: Partial<DCEGenerationConfig>;
}

export interface DCEGenerationResult {
  success: boolean;
  dce?: DCEDocument;
  errors?: string[];
  warnings?: string[];
}

// =============================================================================
// SERVICE
// =============================================================================

export class DCEService {
  /**
   * Génère le DCE complet pour un projet Phase 0
   */
  static async generateDCE(input: DCEGenerationInput): Promise<DCEGenerationResult> {
    const { project, config } = input;
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Validation des données requises
      const validation = this.validateProjectForDCE(project);
      if (!validation.valid) {
        return {
          success: false,
          errors: validation.errors,
        };
      }

      // Configuration par défaut
      const fullConfig = this.getDefaultConfig(project.wizardMode, config);

      // Génération des pièces du DCE
      const reglementConsultation = fullConfig.includeRC
        ? this.generateReglementConsultation(project, fullConfig)
        : undefined;

      const acteEngagement = fullConfig.includeAE
        ? this.generateActeEngagement(project)
        : undefined;

      const decompositionPrix = fullConfig.includeDPGF
        ? this.generateDecompositionPrix(project, fullConfig.typeDecomposition)
        : undefined;

      const cadreMemoireTechnique = fullConfig.includeCadreMT
        ? this.generateCadreMemoireTechnique(project.wizardMode)
        : undefined;

      // Génération des annexes
      const annexes = this.generateAnnexes(project);

      // Création du document DCE
      const dceId = crypto.randomUUID();
      const now = new Date().toISOString();

      const metadata: DCEMetadata = {
        reference: this.generateReference(project.id),
        version: 1,
        createdAt: now,
        updatedAt: now,
        userMode: project.wizardMode,
        projectTitle: project.workProject?.general?.title || 'Projet de travaux',
        projectReference: project.id.substring(0, 8).toUpperCase(),
        consultationDeadline: this.calculateDeadline(30), // 30 jours par défaut
      };

      const generationInfo: DCEGenerationInfo = {
        generatedAt: now,
        generatedBy: 'auto',
        projectId: project.id,
        completeness: this.calculateCompleteness(reglementConsultation, acteEngagement, decompositionPrix, cadreMemoireTechnique),
        piecesGenerees: this.getPiecesGenerees(fullConfig),
        piecesManuelles: [],
        validationStatus: errors.length > 0 ? 'errors' : 'pending',
        validationErrors: errors.map((e) => ({
          field: 'general',
          message: e,
          severity: 'error' as const,
        })),
        exportFormats: ['pdf', 'docx', 'xlsx'],
      };

      const dce: DCEDocument = {
        id: dceId,
        projectId: project.id,
        metadata,
        reglementConsultation: reglementConsultation!,
        acteEngagement: acteEngagement!,
        decompositionPrix: decompositionPrix!,
        cadreMemoireTechnique: cadreMemoireTechnique!,
        annexes,
        status: 'draft',
        generationInfo,
        torpMetadata: {
          createdAt: now,
          updatedAt: now,
          createdBy: 'system',
          version: 1,
          source: 'generation',
          completeness: generationInfo.completeness,
          aiEnriched: false,
        },
      };

      // Sauvegarde en base
      await this.saveDCE(dce);

      return {
        success: true,
        dce,
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    } catch (error) {
      console.error('[DCE] Generation error:', error);
      return {
        success: false,
        errors: [`Erreur lors de la génération du DCE: ${error instanceof Error ? error.message : 'Erreur inconnue'}`],
      };
    }
  }

  /**
   * Génère le Règlement de Consultation
   */
  static generateReglementConsultation(
    project: Phase0Project,
    config: DCEGenerationConfig
  ): ReglementConsultation {
    const mode = this.getModeFromWizard(project.wizardMode);

    // Section 1: Identification
    const identification = this.generateRCIdentification(project);

    // Section 2: Modalités de candidature
    const modalitesCandidature = this.generateModalitesCandidature(project, mode);

    // Section 3: Remise des offres
    const remiseOffres = this.generateRemiseOffres(mode);

    // Section 4: Critères de sélection
    const criteresSelection = this.generateCriteresSelection(mode);

    // Section 5: Pièces à fournir
    const piecesAFournir = this.generatePiecesAFournir(project, mode);

    // Section 6: Modalités d'analyse
    const modalitesAnalyse = this.generateModalitesAnalyse(mode);

    // Section 7: Attribution et notification
    const attributionNotification = this.generateAttributionNotification(mode);

    return {
      identification,
      modalitesCandidature,
      remiseOffres,
      criteresSelection,
      piecesAFournir,
      modalitesAnalyse,
      attributionNotification,
    };
  }

  /**
   * Génère l'Acte d'Engagement
   */
  static generateActeEngagement(project: Phase0Project): ActeEngagement {
    const estimation = EstimationService.estimateProject(project);
    const now = new Date().toISOString();

    return {
      reference: `AE-${project.id.substring(0, 8).toUpperCase()}`,
      date: now,

      objet: {
        description: `${project.workProject?.general?.title || 'Travaux de rénovation'}`,
        adresseChantier: project.property?.address || {
          street: '',
          postalCode: '',
          city: '',
          country: 'France',
        },
        lots: project.selectedLots?.map((lot, idx) => ({
          numero: idx + 1,
          designation: lot.name || lot.type,
          description: lot.description,
          budgetEstimatif: lot.estimatedBudget,
        })),
      },

      prix: {
        type: 'forfaitaire',
        montantHT: undefined, // À remplir par l'entreprise
        tauxTVA: 10, // TVA réduite par défaut pour rénovation
        montantTTC: undefined,
        revisionPrix: (project.workProject?.constraints?.temporal?.maxDurationMonths || 0) > 3,
        indiceRevision: 'BT01',
      },

      delai: {
        duree: estimation?.duration?.totalWeeks?.max
          ? estimation.duration.totalWeeks.max
          : 8,
        unite: 'semaines',
        dateDebutType: 'ordre_service',
      },

      reglement: {
        acomptes: true,
        baseAcomptes: 'Situations de travaux validées par le maître d\'ouvrage',
        delaiPaiement: 30,
        retenueGarantie: {
          taux: 5,
          caution: true,
        },
      },

      penalites: {
        retard: {
          montantJour: '1/1000 du montant TTC du marché',
          plafond: 10,
        },
        absenceReunion: 100,
      },

      engagement: `L'entreprise soussignée s'engage à réaliser les travaux décrits dans le présent marché, conformément au CCTP et aux autres pièces contractuelles, pour le prix indiqué ci-dessus et dans le délai d'exécution prévu.`,

      signatures: {
        entreprise: {
          signee: false,
          cachet: true,
        },
        maitreOuvrage: {
          signee: false,
        },
      },

      annexes: ['CCTP', 'DPGF', 'Planning prévisionnel', 'Plans'],
    };
  }

  /**
   * Génère la Décomposition des Prix (DPGF/DQE/BPU)
   */
  static generateDecompositionPrix(
    project: Phase0Project,
    type: TypeDecompositionPrix = 'dpgf'
  ): DecompositionPrix {
    const estimation = EstimationService.estimateProject(project);
    const now = new Date().toISOString();

    // Construire les lots avec les postes
    const lots = project.selectedLots?.map((lot, lotIdx) => {
      const lotEstimation = estimation?.budget?.byLot?.find((l) => l.lotType === lot.type);

      // Générer les postes pour ce lot
      const postes = this.generatePostesLot(lot, lotEstimation);

      return {
        numero: String(lotIdx + 1).padStart(2, '0'),
        designation: lot.name || lot.type,
        postes,
        sousTotalHT: postes.reduce((sum, p) => sum + (p.totalHT || 0), 0),
      };
    }) || [];

    const totalHT = lots.reduce((sum, l) => sum + l.sousTotalHT, 0);
    const tauxTVA = 10; // TVA réduite pour rénovation

    return {
      type,
      reference: `${type.toUpperCase()}-${project.id.substring(0, 8).toUpperCase()}`,
      date: now,
      projectReference: project.id.substring(0, 8).toUpperCase(),
      lots,
      totaux: {
        totalHT,
        tauxTVA,
        montantTVA: totalHT * tauxTVA / 100,
        totalTTC: totalHT * (1 + tauxTVA / 100),
      },
      metadata: {
        source: 'estimation',
        confidenceLevel: estimation?.confidence || 50,
        lastUpdated: now,
      },
    };
  }

  /**
   * Génère le Cadre de Mémoire Technique
   */
  static generateCadreMemoireTechnique(wizardMode: WizardMode): CadreMemoireTechnique {
    // Adapter la structure selon le mode
    let sections = [...STRUCTURE_MEMOIRE_TECHNIQUE];

    // Simplifier pour B2C
    if (wizardMode === 'b2c_simple' || wizardMode === 'b2c_detailed') {
      sections = sections.map((s) => ({
        ...s,
        pagesSuggerees: Math.max(1, Math.ceil(s.pagesSuggerees * 0.7)),
      }));
    }

    // Renforcer QSE pour B2G
    if (wizardMode === 'b2g_public') {
      const qseIndex = sections.findIndex((s) => s.numero === 7);
      if (qseIndex !== -1) {
        sections[qseIndex] = {
          ...sections[qseIndex],
          points: 15,
          contenuAttendu: [
            ...sections[qseIndex].contenuAttendu,
            'Politique RSE de l\'entreprise',
            'Engagement développement durable',
            'Clause d\'insertion sociale (si applicable)',
          ],
        };
      }
    }

    return {
      sections,
      instructions: `Le mémoire technique doit être structuré selon le plan ci-dessous. Chaque section sera notée selon le barème indiqué. Le non-respect de la structure imposée pourra entraîner une pénalité de notation.`,
      pagesMaxRecommandees: sections.reduce((sum, s) => sum + s.pagesSuggerees, 0),
      format: {
        police: 'Arial ou équivalent',
        taillePolice: 11,
        marges: '2 cm minimum',
      },
    };
  }

  // =============================================================================
  // MÉTHODES PRIVÉES - GÉNÉRATION RC
  // =============================================================================

  private static generateRCIdentification(project: Phase0Project): RCIdentification {
    const owner = project.ownerProfile;
    const property = project.property;

    return {
      maitreOuvrage: {
        nom: this.getOwnerName(owner),
        adresse: owner?.contact?.address || property?.address || {
          street: '',
          postalCode: '',
          city: '',
          country: 'France',
        },
        contact: {
          nom: owner?.identity?.type === 'b2c'
            ? `${(owner.identity as { firstName?: string; lastName?: string }).firstName || ''} ${(owner.identity as { firstName?: string; lastName?: string }).lastName || ''}`.trim()
            : undefined,
          email: owner?.contact?.email || '',
          telephone: owner?.contact?.phone,
        },
        siret: owner?.identity?.type !== 'b2c'
          ? (owner?.identity as { siret?: string }).siret
          : undefined,
        type: this.getOwnerType(owner),
      },
      natureObjet: project.workProject?.scope?.workType || 'renovation',
      description: project.workProject?.general?.description || 'Travaux de rénovation',
      adresseChantier: property?.address || {
        street: '',
        postalCode: '',
        city: '',
        country: 'France',
      },
      budgetPrevisionnel: {
        montantMin: project.workProject?.budget?.totalEnvelope?.min,
        montantMax: project.workProject?.budget?.totalEnvelope?.max,
        afficher: project.wizardMode === 'b2g_public', // Obligatoire pour B2G
      },
    };
  }

  private static generateModalitesCandidature(
    project: Phase0Project,
    mode: 'b2c' | 'b2b' | 'b2g'
  ): ModalitesCandidature {
    const lots = project.selectedLots || [];

    // Déterminer les qualifications requises selon les lots
    const qualificationsExigees = this.determineQualificationsRequises(lots, mode);

    return {
      allotissement: {
        type: lots.length > 1 ? 'multi_lots' : 'mono_lot',
        lots: lots.map((lot, idx) => ({
          numero: idx + 1,
          designation: lot.name || lot.type,
          description: lot.description,
          budgetEstimatif: lot.estimatedBudget,
        })),
        groupementAutorise: mode !== 'b2c',
        coTraitanceAutorisee: mode !== 'b2c',
      },
      conditionsParticipation: {
        qualificationsExigees,
        assurancesObligatoires: [
          {
            type: 'rc_decennale',
            montantMinimum: project.workProject?.budget?.totalEnvelope?.max || 100000,
            validiteMinimum: 'Date fin travaux + 1 an',
          },
          {
            type: 'rc_professionnelle',
            validiteMinimum: 'En cours',
          },
        ],
        referencesExigees: {
          nombreMinimum: mode === 'b2c' ? 2 : mode === 'b2b' ? 3 : 5,
          ancienneteMaximum: 5,
          typeSimilaire: true,
        },
        capaciteFinanciere: mode !== 'b2c'
          ? {
              caMinimum: (project.workProject?.budget?.totalEnvelope?.max || 50000) * 2,
            }
          : undefined,
      },
    };
  }

  private static generateRemiseOffres(mode: 'b2c' | 'b2b' | 'b2g'): RemiseOffres {
    const delaiConsultation = mode === 'b2c' ? 15 : mode === 'b2b' ? 21 : 30;

    return {
      format: {
        numerique: true,
        papier: mode === 'b2c',
        formatFichiers: ['PDF'],
        decoupage: ['administratif', 'technique', 'financier'],
        signatureElectronique: mode === 'b2g',
      },
      delais: {
        dateLimiteReception: this.calculateDeadline(delaiConsultation),
        heureLimit: '12:00',
        dureeValiditeOffre: mode === 'b2c' ? 60 : 90,
        delaiStandstill: mode === 'b2g' ? 11 : undefined,
      },
      visiteSite: {
        obligatoire: false,
        facultative: true,
        attestationRequise: mode === 'b2g',
      },
      interdictions: mode === 'b2g'
        ? {
            contactEntreprises: true,
            modificationApresDepot: true,
          }
        : undefined,
    };
  }

  private static generateCriteresSelection(mode: 'b2c' | 'b2b' | 'b2g'): CriteresSelection {
    return {
      mode,
      criteres: PONDERATIONS_DEFAUT[mode],
      formulePrix: 'Note prix = (Prix le plus bas / Prix offre) × Note maximale',
      seuilMinimumTechnique: mode === 'b2g' ? 50 : undefined,
    };
  }

  private static generatePiecesAFournir(
    project: Phase0Project,
    mode: 'b2c' | 'b2b' | 'b2g'
  ): PiecesAFournir {
    // Adapter les pièces selon le mode
    let administratives = [...PIECES_ADMINISTRATIVES_STANDARD];
    let techniques = [...PIECES_TECHNIQUES_STANDARD];
    let financieres = [...PIECES_FINANCIERES_STANDARD];

    // Simplifier pour B2C
    if (mode === 'b2c') {
      administratives = administratives.filter((p) =>
        ['kbis', 'assurance_decennale', 'qualifications'].includes(p.id)
      );
      techniques = techniques.filter((p) =>
        ['memoire', 'references'].includes(p.id)
      );
    }

    // Ajouter des pièces pour B2G
    if (mode === 'b2g') {
      administratives.push({
        id: 'dc3',
        designation: 'DC3 - Acte d\'engagement',
        reference: 'DC3',
        description: 'Acte d\'engagement complété et signé',
        obligatoire: true,
      });
      administratives.push({
        id: 'dc4',
        designation: 'DC4 - Déclaration de sous-traitance',
        reference: 'DC4',
        description: 'Si sous-traitance envisagée',
        obligatoire: false,
      });
    }

    return {
      administratives,
      techniques,
      financieres,
    };
  }

  private static generateModalitesAnalyse(mode: 'b2c' | 'b2b' | 'b2g'): ModalitesAnalyse {
    return {
      commission: mode === 'b2g'
        ? {
            ouverturePlis: true,
          }
        : undefined,
      etapesAnalyse: [
        {
          ordre: 1,
          designation: 'Contrôle de conformité administrative',
          description: 'Vérification des pièces administratives obligatoires',
          eliminatoire: true,
        },
        {
          ordre: 2,
          designation: 'Analyse financière',
          description: 'Vérification de la cohérence du prix',
          eliminatoire: false,
        },
        {
          ordre: 3,
          designation: 'Analyse technique',
          description: 'Évaluation du mémoire technique et des références',
          eliminatoire: false,
        },
        {
          ordre: 4,
          designation: 'Notation et classement',
          description: 'Application des critères de sélection pondérés',
          eliminatoire: false,
        },
      ],
      auditions: mode !== 'b2c'
        ? {
            prevues: true,
            criteres: ['Clarification méthodologie', 'Présentation équipe', 'Questions techniques'],
            duree: 45,
          }
        : undefined,
      negociations: mode !== 'b2g'
        ? {
            autorisees: true,
            modalites: 'Négociation possible sur le prix et les délais après analyse des offres',
          }
        : undefined,
    };
  }

  private static generateAttributionNotification(mode: 'b2c' | 'b2b' | 'b2g'): AttributionNotification {
    return {
      delais: {
        attribution: mode === 'b2c' ? 7 : mode === 'b2b' ? 15 : 30,
        standstill: mode === 'b2g' ? 11 : undefined,
        notification: 7,
      },
      informationCandidats: {
        evincesInformes: true,
        motifsRefusCommuniques: mode !== 'b2c',
        delaiRecours: mode === 'b2g' ? 2 : undefined, // 2 mois B2G
      },
      signature: {
        marche: true,
        ordreService: true,
        delaiDemarrage: 15,
      },
    };
  }

  // =============================================================================
  // MÉTHODES PRIVÉES - UTILITAIRES
  // =============================================================================

  private static validateProjectForDCE(project: Phase0Project): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!project.ownerProfile) {
      errors.push('Profil du maître d\'ouvrage non renseigné');
    }
    if (!project.property?.address) {
      errors.push('Adresse du bien non renseignée');
    }
    if (!project.selectedLots || project.selectedLots.length === 0) {
      errors.push('Aucun lot de travaux sélectionné');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  private static getDefaultConfig(
    wizardMode: WizardMode,
    partialConfig: Partial<DCEGenerationConfig>
  ): DCEGenerationConfig {
    return {
      userMode: wizardMode,
      includeRC: partialConfig.includeRC ?? true,
      includeAE: partialConfig.includeAE ?? true,
      includeDPGF: partialConfig.includeDPGF ?? true,
      includeCadreMT: partialConfig.includeCadreMT ?? true,
      typeDecomposition: partialConfig.typeDecomposition ?? 'dpgf',
      outputFormats: partialConfig.outputFormats ?? ['pdf', 'docx'],
      ...partialConfig,
    };
  }

  private static getModeFromWizard(wizardMode: WizardMode): 'b2c' | 'b2b' | 'b2g' {
    if (wizardMode === 'b2c_simple' || wizardMode === 'b2c_detailed') return 'b2c';
    if (wizardMode === 'b2b_professional') return 'b2b';
    return 'b2g';
  }

  private static getOwnerType(owner?: MasterOwnerProfile): 'particulier' | 'entreprise' | 'collectivite' {
    const type = owner?.identity?.type;
    if (type === 'b2c' || type === 'B2C') return 'particulier';
    if (type === 'b2b' || type === 'B2B') return 'entreprise';
    return 'collectivite';
  }

  private static getOwnerName(owner?: MasterOwnerProfile): string {
    if (!owner?.identity) return 'Maître d\'ouvrage';

    const identity = owner.identity;
    if (identity.type === 'b2c' || identity.type === 'B2C') {
      const individual = identity as { firstName?: string; lastName?: string };
      return `${individual.firstName || ''} ${individual.lastName || ''}`.trim() || 'Particulier';
    } else if (identity.type === 'b2b' || identity.type === 'B2B') {
      const company = identity as { companyName?: string };
      return company.companyName || 'Entreprise';
    } else {
      const entity = identity as { entityName?: string };
      return entity.entityName || 'Collectivité';
    }
  }

  private static generateReference(projectId: string): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `DCE-${year}${month}-${projectId.substring(0, 8).toUpperCase()}`;
  }

  private static calculateDeadline(days: number): string {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString();
  }

  private static determineQualificationsRequises(
    lots: SelectedLot[],
    mode: 'b2c' | 'b2b' | 'b2g'
  ) {
    const qualifications = [];

    // RGE si lots énergie
    const lotsEnergie = ['isolation_thermique', 'chauffage', 'menuiseries_exterieures', 'ventilation', 'photovoltaique'];
    if (lots.some((l) => lotsEnergie.includes(l.type))) {
      qualifications.push({
        type: 'rge' as const,
        designation: 'RGE (Reconnu Garant de l\'Environnement)',
        obligatoire: mode !== 'b2c', // Facultatif en B2C mais recommandé
      });
    }

    // Qualibat si gros œuvre
    const lotsGrosOeuvre = ['gros_oeuvre', 'charpente', 'couverture', 'maconnerie'];
    if (lots.some((l) => lotsGrosOeuvre.includes(l.type))) {
      qualifications.push({
        type: 'qualibat' as const,
        designation: 'Qualibat',
        niveau: mode === 'b2g' ? 'technicite_confirmee' : undefined,
        obligatoire: mode === 'b2g',
      });
    }

    // Qualifelec si électricité
    if (lots.some((l) => l.type === 'electricite')) {
      qualifications.push({
        type: 'qualifelec' as const,
        designation: 'Qualifelec - Habilitation électrique',
        obligatoire: true,
      });
    }

    return qualifications;
  }

  private static generatePostesLot(
    lot: SelectedLot,
    lotEstimation?: { estimate: { min: number; max: number } }
  ) {
    // Postes simplifiés basés sur les prestations du lot
    const postes = [];
    const basePrice = lotEstimation?.estimate?.min || 5000;

    // Si le lot a des prestations sélectionnées
    if (lot.selectedPrestations && lot.selectedPrestations.length > 0) {
      const pricePerPrestation = basePrice / lot.selectedPrestations.length;

      lot.selectedPrestations.forEach((prestation, idx) => {
        postes.push({
          reference: `${lot.type.substring(0, 3).toUpperCase()}-${String(idx + 1).padStart(2, '0')}`,
          designation: prestation,
          unite: 'Ens',
          quantite: 1,
          prixUnitaireHT: undefined, // À remplir par l'entreprise
          totalHT: undefined,
        });
      });
    } else {
      // Poste forfaitaire par défaut
      postes.push({
        reference: `${lot.type.substring(0, 3).toUpperCase()}-01`,
        designation: `Travaux du lot ${lot.name || lot.type}`,
        unite: 'Fft',
        quantite: 1,
        prixUnitaireHT: undefined,
        totalHT: undefined,
      });
    }

    return postes;
  }

  private static generateAnnexes(project: Phase0Project): DCEAnnexe[] {
    const annexes: DCEAnnexe[] = [];

    // CCTP (si généré)
    if (project.generatedDocuments?.some((d) => d.type === 'cctp')) {
      annexes.push({
        id: crypto.randomUUID(),
        code: 'A1',
        titre: 'Cahier des Clauses Techniques Particulières (CCTP)',
        type: 'cctp',
        description: 'Spécifications techniques des travaux',
        obligatoire: true,
        format: 'PDF',
      });
    }

    // Plans (si disponibles)
    annexes.push({
      id: crypto.randomUUID(),
      code: 'A2',
      titre: 'Plans',
      type: 'plans',
      description: 'Plans de l\'existant et du projet',
      obligatoire: false,
      format: 'PDF',
    });

    // Diagnostics
    annexes.push({
      id: crypto.randomUUID(),
      code: 'A3',
      titre: 'Diagnostics techniques',
      type: 'diagnostics',
      description: 'DPE, amiante, plomb, etc.',
      obligatoire: false,
      format: 'PDF',
    });

    return annexes;
  }

  private static calculateCompleteness(
    rc?: ReglementConsultation,
    ae?: ActeEngagement,
    dpgf?: DecompositionPrix,
    mt?: CadreMemoireTechnique
  ): number {
    let completeness = 0;
    if (rc) completeness += 30;
    if (ae) completeness += 25;
    if (dpgf) completeness += 25;
    if (mt) completeness += 20;
    return completeness;
  }

  private static getPiecesGenerees(config: DCEGenerationConfig): string[] {
    const pieces: string[] = [];
    if (config.includeRC) pieces.push('Règlement de Consultation');
    if (config.includeAE) pieces.push('Acte d\'Engagement');
    if (config.includeDPGF) pieces.push('DPGF');
    if (config.includeCadreMT) pieces.push('Cadre Mémoire Technique');
    return pieces;
  }

  // =============================================================================
  // PERSISTANCE
  // =============================================================================

  static async saveDCE(dce: DCEDocument): Promise<void> {
    const { error } = await supabase.from('phase1_dce').upsert(
      {
        id: dce.id,
        project_id: dce.projectId,
        metadata: dce.metadata,
        reglement_consultation: dce.reglementConsultation,
        acte_engagement: dce.acteEngagement,
        decomposition_prix: dce.decompositionPrix,
        cadre_memoire_technique: dce.cadreMemoireTechnique,
        annexes: dce.annexes,
        status: dce.status,
        generation_info: dce.generationInfo,
        torp_metadata: dce.torpMetadata,
        created_at: dce.metadata.createdAt,
        updated_at: dce.metadata.updatedAt,
      },
      { onConflict: 'project_id' }
    );

    if (error) {
      console.error('[DCE] Save error:', error);
      throw new Error(`Erreur lors de la sauvegarde du DCE: ${error.message}`);
    }
  }

  static async getDCEByProjectId(projectId: string): Promise<DCEDocument | null> {
    const { data, error } = await supabase
      .from('phase1_dce')
      .select('*')
      .eq('project_id', projectId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Erreur lors de la récupération du DCE: ${error.message}`);
    }

    return this.mapRowToDCE(data);
  }

  private static mapRowToDCE(row: Record<string, unknown>): DCEDocument {
    return {
      id: row.id as string,
      projectId: row.project_id as string,
      metadata: row.metadata as DCEMetadata,
      reglementConsultation: row.reglement_consultation as ReglementConsultation,
      acteEngagement: row.acte_engagement as ActeEngagement,
      decompositionPrix: row.decomposition_prix as DecompositionPrix,
      cadreMemoireTechnique: row.cadre_memoire_technique as CadreMemoireTechnique,
      annexes: row.annexes as DCEAnnexe[],
      status: row.status as DCEStatus,
      generationInfo: row.generation_info as DCEGenerationInfo,
      torpMetadata: row.torp_metadata as DCEDocument['torpMetadata'],
    };
  }

  // =============================================================================
  // EXPORT
  // =============================================================================

  /**
   * Exporte le DCE en texte formaté (pour génération PDF ultérieure)
   */
  static exportDCEToText(dce: DCEDocument): string {
    const lines: string[] = [];

    // En-tête
    lines.push('='.repeat(70));
    lines.push('DOSSIER DE CONSULTATION DES ENTREPRISES');
    lines.push('='.repeat(70));
    lines.push('');
    lines.push(`Référence: ${dce.metadata.reference}`);
    lines.push(`Projet: ${dce.metadata.projectTitle}`);
    lines.push(`Date: ${new Date(dce.metadata.createdAt).toLocaleDateString('fr-FR')}`);
    lines.push('');
    lines.push('-'.repeat(70));
    lines.push('');

    // Règlement de Consultation
    if (dce.reglementConsultation) {
      lines.push('RÈGLEMENT DE CONSULTATION');
      lines.push('-'.repeat(30));
      lines.push('');
      lines.push('1. IDENTIFICATION DU PROJET');
      lines.push(`   Maître d'ouvrage: ${dce.reglementConsultation.identification.maitreOuvrage.nom}`);
      lines.push(`   Nature: ${dce.reglementConsultation.identification.natureObjet}`);
      lines.push(`   Adresse chantier: ${this.formatAddress(dce.reglementConsultation.identification.adresseChantier)}`);
      lines.push('');

      lines.push('2. MODALITÉS DE CANDIDATURE');
      lines.push(`   Allotissement: ${dce.reglementConsultation.modalitesCandidature.allotissement.type === 'mono_lot' ? 'Lot unique' : 'Multi-lots'}`);
      lines.push('');

      lines.push('3. REMISE DES OFFRES');
      lines.push(`   Date limite: ${new Date(dce.reglementConsultation.remiseOffres.delais.dateLimiteReception).toLocaleDateString('fr-FR')}`);
      lines.push(`   Validité: ${dce.reglementConsultation.remiseOffres.delais.dureeValiditeOffre} jours`);
      lines.push('');

      lines.push('4. CRITÈRES DE SÉLECTION');
      dce.reglementConsultation.criteresSelection.criteres.forEach((c) => {
        lines.push(`   • ${c.nom}: ${c.poids}%`);
      });
      lines.push('');
    }

    // Acte d'Engagement
    if (dce.acteEngagement) {
      lines.push('');
      lines.push('ACTE D\'ENGAGEMENT');
      lines.push('-'.repeat(30));
      lines.push('');
      lines.push(`Objet: ${dce.acteEngagement.objet.description}`);
      lines.push(`Délai: ${dce.acteEngagement.delai.duree} ${dce.acteEngagement.delai.unite}`);
      lines.push(`Pénalités retard: ${dce.acteEngagement.penalites.retard.montantJour}`);
      lines.push('');
    }

    // Pied de page
    lines.push('');
    lines.push('='.repeat(70));
    lines.push(`Document généré par TORP - ${new Date().toLocaleDateString('fr-FR')}`);

    return lines.join('\n');
  }

  private static formatAddress(address: {
    street?: string;
    postalCode?: string;
    city?: string;
  }): string {
    return [address.street, `${address.postalCode} ${address.city}`.trim()]
      .filter(Boolean)
      .join(', ');
  }
}

export default DCEService;
