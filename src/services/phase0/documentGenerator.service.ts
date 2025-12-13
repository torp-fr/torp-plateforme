/**
 * Service de génération de documents Phase 0
 * Génère les documents CCF, APS et CCTP à partir des données du projet
 */

import { Phase0Project } from '@/types/phase0/project.types';
import { MasterOwnerProfile } from '@/types/phase0/owner.types';
import { Property } from '@/types/phase0/property.types';
import { WorkProject } from '@/types/phase0/work-project.types';
import { SelectedLot, LOT_CATALOG, LotType } from '@/types/phase0/lots.types';
import { DocumentReference } from '@/types/phase0/common.types';
import { supabase } from '@/lib/supabase';
import { EstimationService, ProjectEstimation } from './estimation.service';
import { KnowledgeService, DTU_CATALOG, type CCTPEnrichmentContext } from '@/services/rag';

// Types de documents
export type DocumentType = 'ccf' | 'aps' | 'cctp';

export interface GeneratedDocument {
  id: string;
  projectId: string;
  type: DocumentType;
  title: string;
  version: number;
  content: DocumentContent;
  metadata: DocumentMetadata;
  generatedAt: Date;
  status: 'draft' | 'final' | 'archived';
}

export interface DocumentContent {
  sections: DocumentSection[];
  appendices?: DocumentAppendix[];
}

export interface DocumentSection {
  id: string;
  title: string;
  level: number;
  content: string;
  subsections?: DocumentSection[];
}

export interface DocumentAppendix {
  id: string;
  title: string;
  type: 'table' | 'image' | 'plan' | 'reference';
  content: unknown;
}

export interface DocumentMetadata {
  projectReference: string;
  ownerName: string;
  propertyAddress: string;
  generationDate: Date;
  version: string;
  pageCount?: number;
}

// Templates de sections pour chaque type de document
const CCF_TEMPLATE = {
  title: 'Cahier des Charges Fonctionnel',
  sections: [
    { id: 'context', title: '1. Contexte du Projet', level: 1 },
    { id: 'owner', title: '2. Maître d\'Ouvrage', level: 1 },
    { id: 'property', title: '3. Description du Bien', level: 1 },
    { id: 'objectives', title: '4. Objectifs du Projet', level: 1 },
    { id: 'scope', title: '5. Périmètre des Travaux', level: 1 },
    { id: 'constraints', title: '6. Contraintes et Exigences', level: 1 },
    { id: 'budget', title: '7. Enveloppe Budgétaire', level: 1 },
    { id: 'planning', title: '8. Planning Prévisionnel', level: 1 },
    { id: 'quality', title: '9. Exigences de Qualité', level: 1 },
    { id: 'regulatory', title: '10. Contexte Réglementaire', level: 1 },
  ],
};

const APS_TEMPLATE = {
  title: 'Avant-Projet Sommaire',
  sections: [
    { id: 'summary', title: '1. Résumé Exécutif', level: 1 },
    { id: 'existing', title: '2. État des Lieux', level: 1 },
    { id: 'program', title: '3. Programme de Travaux', level: 1 },
    { id: 'lots', title: '4. Description par Lots', level: 1 },
    { id: 'estimation', title: '5. Estimation Budgétaire', level: 1 },
    { id: 'schedule', title: '6. Planning Prévisionnel', level: 1 },
    { id: 'recommendations', title: '7. Recommandations', level: 1 },
  ],
};

const CCTP_TEMPLATE = {
  title: 'Cahier des Clauses Techniques Particulières',
  sections: [
    { id: 'general', title: '1. Dispositions Générales', level: 1 },
    { id: 'site', title: '2. Description du Site', level: 1 },
    { id: 'prescriptions', title: '3. Prescriptions Techniques Communes', level: 1 },
    { id: 'lots', title: '4. Prescriptions par Lots', level: 1 },
    { id: 'execution', title: '5. Conditions d\'Exécution', level: 1 },
    { id: 'reception', title: '6. Réception des Travaux', level: 1 },
  ],
};

export class DocumentGeneratorService {
  /**
   * Génère un document pour un projet Phase 0
   */
  static async generateDocument(
    project: Phase0Project,
    documentType: DocumentType
  ): Promise<GeneratedDocument> {
    // Récupérer le dernier numéro de version
    const version = await this.getNextVersion(project.id, documentType);

    // Générer le contenu selon le type
    let content: DocumentContent;
    let title: string;

    switch (documentType) {
      case 'ccf':
        content = this.generateCCF(project);
        title = `CCF - ${project.workProject?.general?.title || 'Projet'}`;
        break;
      case 'aps':
        content = this.generateAPS(project);
        title = `APS - ${project.workProject?.general?.title || 'Projet'}`;
        break;
      case 'cctp':
        // Utiliser la génération enrichie avec RAG pour le CCTP
        content = await this.generateCCTPEnriched(project);
        title = `CCTP - ${project.workProject?.general?.title || 'Projet'}`;
        break;
    }

    // Créer les métadonnées
    const metadata: DocumentMetadata = {
      projectReference: project.reference,
      ownerName: this.formatOwnerName(project.owner),
      propertyAddress: this.formatAddress(project.property),
      generationDate: new Date(),
      version: `v${version}.0`,
    };

    // Sauvegarder en base
    const document = await this.saveDocument({
      projectId: project.id,
      type: documentType,
      title,
      version,
      content,
      metadata,
    });

    return document;
  }

  /**
   * Génère le Cahier des Charges Fonctionnel
   */
  static generateCCF(project: Phase0Project): DocumentContent {
    const sections: DocumentSection[] = [];
    const estimation = EstimationService.estimateProject(project);

    // 1. Contexte du Projet
    sections.push({
      id: 'context',
      title: '1. Contexte du Projet',
      level: 1,
      content: this.generateContextSection(project),
      subsections: [
        {
          id: 'context-origin',
          title: '1.1 Origine du Projet',
          level: 2,
          content: project.workProject?.general?.description || 'Non renseigné',
        },
        {
          id: 'context-type',
          title: '1.2 Nature des Travaux',
          level: 2,
          content: this.formatWorkType(project.workProject),
        },
      ],
    });

    // 2. Maître d'Ouvrage
    sections.push({
      id: 'owner',
      title: '2. Maître d\'Ouvrage',
      level: 1,
      content: this.generateOwnerSection(project.owner),
    });

    // 3. Description du Bien
    sections.push({
      id: 'property',
      title: '3. Description du Bien',
      level: 1,
      content: this.generatePropertySection(project.property),
      subsections: [
        {
          id: 'property-location',
          title: '3.1 Localisation',
          level: 2,
          content: this.formatAddress(project.property),
        },
        {
          id: 'property-characteristics',
          title: '3.2 Caractéristiques',
          level: 2,
          content: this.formatPropertyCharacteristics(project.property),
        },
        {
          id: 'property-state',
          title: '3.3 État Actuel',
          level: 2,
          content: this.formatPropertyState(project.property),
        },
      ],
    });

    // 4. Objectifs du Projet
    sections.push({
      id: 'objectives',
      title: '4. Objectifs du Projet',
      level: 1,
      content: this.generateObjectivesSection(project.workProject),
    });

    // 5. Périmètre des Travaux
    sections.push({
      id: 'scope',
      title: '5. Périmètre des Travaux',
      level: 1,
      content: this.generateScopeSection(project.selectedLots),
    });

    // 6. Contraintes et Exigences
    sections.push({
      id: 'constraints',
      title: '6. Contraintes et Exigences',
      level: 1,
      content: this.generateConstraintsSection(project),
    });

    // 7. Enveloppe Budgétaire
    sections.push({
      id: 'budget',
      title: '7. Enveloppe Budgétaire',
      level: 1,
      content: this.generateBudgetSection(project.workProject, estimation),
    });

    // 8. Planning Prévisionnel
    sections.push({
      id: 'planning',
      title: '8. Planning Prévisionnel',
      level: 1,
      content: this.generatePlanningSection(project.workProject, estimation),
    });

    // 9. Exigences de Qualité
    sections.push({
      id: 'quality',
      title: '9. Exigences de Qualité',
      level: 1,
      content: this.generateQualitySection(project.workProject),
    });

    // 10. Contexte Réglementaire
    sections.push({
      id: 'regulatory',
      title: '10. Contexte Réglementaire',
      level: 1,
      content: this.generateRegulatorySection(project),
    });

    return { sections };
  }

  /**
   * Génère l'Avant-Projet Sommaire
   */
  static generateAPS(project: Phase0Project): DocumentContent {
    const sections: DocumentSection[] = [];
    const estimation = EstimationService.estimateProject(project);

    // 1. Résumé Exécutif
    sections.push({
      id: 'summary',
      title: '1. Résumé Exécutif',
      level: 1,
      content: this.generateExecutiveSummary(project, estimation),
    });

    // 2. État des Lieux
    sections.push({
      id: 'existing',
      title: '2. État des Lieux',
      level: 1,
      content: this.generateExistingStateSection(project.property),
    });

    // 3. Programme de Travaux
    sections.push({
      id: 'program',
      title: '3. Programme de Travaux',
      level: 1,
      content: this.generateProgramSection(project),
    });

    // 4. Description par Lots
    sections.push({
      id: 'lots',
      title: '4. Description par Lots',
      level: 1,
      content: '',
      subsections: project.selectedLots?.map((lot, index) => ({
        id: `lot-${lot.type}`,
        title: `4.${index + 1} Lot ${lot.number} - ${lot.name}`,
        level: 2,
        content: this.generateLotDescription(lot),
      })) || [],
    });

    // 5. Estimation Budgétaire
    sections.push({
      id: 'estimation',
      title: '5. Estimation Budgétaire',
      level: 1,
      content: this.generateEstimationSection(estimation),
    });

    // 6. Planning Prévisionnel
    sections.push({
      id: 'schedule',
      title: '6. Planning Prévisionnel',
      level: 1,
      content: this.generateScheduleSection(estimation),
    });

    // 7. Recommandations
    sections.push({
      id: 'recommendations',
      title: '7. Recommandations',
      level: 1,
      content: this.generateRecommendationsSection(project, estimation),
    });

    return { sections };
  }

  /**
   * Génère le Cahier des Clauses Techniques Particulières (version basique)
   */
  static generateCCTP(project: Phase0Project): DocumentContent {
    const sections: DocumentSection[] = [];

    // 1. Dispositions Générales
    sections.push({
      id: 'general',
      title: '1. Dispositions Générales',
      level: 1,
      content: this.generateGeneralDispositionsSection(project),
    });

    // 2. Description du Site
    sections.push({
      id: 'site',
      title: '2. Description du Site',
      level: 1,
      content: this.generateSiteDescriptionSection(project.property),
    });

    // 3. Prescriptions Techniques Communes
    sections.push({
      id: 'prescriptions',
      title: '3. Prescriptions Techniques Communes',
      level: 1,
      content: this.generateCommonPrescriptionsSection(project),
    });

    // 4. Prescriptions par Lots
    sections.push({
      id: 'lots',
      title: '4. Prescriptions par Lots',
      level: 1,
      content: '',
      subsections: project.selectedLots?.map((lot, index) => ({
        id: `cctp-lot-${lot.type}`,
        title: `4.${index + 1} Lot ${lot.number} - ${lot.name}`,
        level: 2,
        content: this.generateLotCCTP(lot),
      })) || [],
    });

    // 5. Conditions d'Exécution
    sections.push({
      id: 'execution',
      title: '5. Conditions d\'Exécution',
      level: 1,
      content: this.generateExecutionConditionsSection(project),
    });

    // 6. Réception des Travaux
    sections.push({
      id: 'reception',
      title: '6. Réception des Travaux',
      level: 1,
      content: this.generateReceptionSection(),
    });

    return { sections };
  }

  /**
   * Génère le CCTP enrichi avec les références DTU via RAG
   * Utilise la base de connaissances pour des prescriptions précises
   */
  static async generateCCTPEnriched(project: Phase0Project): Promise<DocumentContent> {
    const sections: DocumentSection[] = [];

    // Extraire les catégories de lots pour la recherche RAG
    const lotCategories = project.selectedLots?.map(l => l.category || l.type) || [];
    const workDescription = project.workProject?.general?.description || '';

    // Récupérer le contexte enrichi depuis la base de connaissances
    let ragContext: CCTPEnrichmentContext | null = null;
    try {
      console.log('[CCTP] Fetching RAG context for categories:', lotCategories);
      ragContext = await KnowledgeService.enrichCCTPContext(lotCategories, workDescription);
      console.log('[CCTP] RAG context fetched:', {
        dtu: ragContext.dtu.length,
        normes: ragContext.normes.length,
        guides: ragContext.guides.length,
        applicableDTU: ragContext.applicableDTU.length
      });
    } catch (error) {
      console.warn('[CCTP] RAG enrichment failed, using fallback:', error);
    }

    // 1. Dispositions Générales (enrichies avec références DTU)
    sections.push({
      id: 'general',
      title: '1. Dispositions Générales',
      level: 1,
      content: this.generateEnrichedGeneralDispositions(project, ragContext),
    });

    // 2. Description du Site
    sections.push({
      id: 'site',
      title: '2. Description du Site',
      level: 1,
      content: this.generateSiteDescriptionSection(project.property),
    });

    // 3. Références Normatives (nouvelle section avec DTU)
    sections.push({
      id: 'normes',
      title: '3. Références Normatives',
      level: 1,
      content: this.generateNormativeReferencesSection(ragContext),
    });

    // 4. Prescriptions Techniques Communes (enrichies)
    sections.push({
      id: 'prescriptions',
      title: '4. Prescriptions Techniques Communes',
      level: 1,
      content: this.generateEnrichedCommonPrescriptions(project, ragContext),
    });

    // 5. Prescriptions par Lots (enrichies avec RAG)
    const lotSubsections: DocumentSection[] = [];
    for (let index = 0; index < (project.selectedLots?.length || 0); index++) {
      const lot = project.selectedLots![index];
      const lotPrescription = ragContext?.prescriptions?.find(
        p => p.lotCategory.toLowerCase() === (lot.category || lot.type).toLowerCase()
      );

      lotSubsections.push({
        id: `cctp-lot-${lot.type}`,
        title: `5.${index + 1} Lot ${lot.number || index + 1} - ${lot.name || lot.type}`,
        level: 2,
        content: await this.generateEnrichedLotCCTP(lot, lotPrescription, ragContext),
      });
    }

    sections.push({
      id: 'lots',
      title: '5. Prescriptions par Lots',
      level: 1,
      content: '',
      subsections: lotSubsections,
    });

    // 6. Conditions d'Exécution
    sections.push({
      id: 'execution',
      title: '6. Conditions d\'Exécution',
      level: 1,
      content: this.generateExecutionConditionsSection(project),
    });

    // 7. Contrôles et Essais
    sections.push({
      id: 'controls',
      title: '7. Contrôles et Essais',
      level: 1,
      content: this.generateControlsSection(ragContext),
    });

    // 8. Réception des Travaux
    sections.push({
      id: 'reception',
      title: '8. Réception des Travaux',
      level: 1,
      content: this.generateReceptionSection(),
    });

    return { sections };
  }

  /**
   * Génère les dispositions générales enrichies
   */
  private static generateEnrichedGeneralDispositions(
    project: Phase0Project,
    ragContext: CCTPEnrichmentContext | null
  ): string {
    const lines: string[] = [];

    lines.push('1.1 OBJET DU MARCHÉ');
    lines.push('');
    lines.push(`Le présent Cahier des Clauses Techniques Particulières (CCTP) a pour objet de définir les spécifications techniques des travaux de ${project.workProject?.general?.title || 'rénovation'}.`);
    lines.push('');

    lines.push('1.2 CONNAISSANCE DES LIEUX');
    lines.push('');
    lines.push('L\'entrepreneur est réputé avoir pris connaissance du site et de ses accès, des locaux et de leur état actuel, des contraintes liées à l\'occupation des locaux ou du voisinage.');
    lines.push('');

    lines.push('1.3 DOCUMENTS DE RÉFÉRENCE');
    lines.push('');
    lines.push('Les travaux seront exécutés conformément aux prescriptions des documents techniques suivants:');
    lines.push('  • Documents Techniques Unifiés (DTU) du CSTB');
    lines.push('  • Normes NF et européennes en vigueur');
    lines.push('  • Avis Techniques et Documents Techniques d\'Application');
    lines.push('  • Règles professionnelles des métiers concernés');
    lines.push('  • Code de la Construction et de l\'Habitation');
    lines.push('');

    // Ajouter les DTU spécifiques si disponibles
    if (ragContext?.applicableDTU?.length) {
      lines.push('DTU spécifiquement applicables à ce projet:');
      ragContext.applicableDTU.slice(0, 10).forEach(dtu => {
        lines.push(`  • ${dtu.code} - ${dtu.title}`);
      });
      lines.push('');
    }

    lines.push('1.4 QUALITÉ DES MATÉRIAUX');
    lines.push('');
    lines.push('Tous les matériaux, produits et composants mis en œuvre devront:');
    lines.push('  • Être neufs et de première qualité');
    lines.push('  • Porter le marquage CE lorsque réglementairement exigé');
    lines.push('  • Bénéficier d\'un Avis Technique ou Document Technique d\'Application favorable');
    lines.push('  • Être conformes aux normes NF ou équivalentes');

    return lines.join('\n');
  }

  /**
   * Génère la section des références normatives
   */
  private static generateNormativeReferencesSection(ragContext: CCTPEnrichmentContext | null): string {
    const lines: string[] = [];

    lines.push('3.1 DOCUMENTS TECHNIQUES UNIFIÉS (DTU)');
    lines.push('');

    if (ragContext?.applicableDTU?.length) {
      // Grouper par catégorie
      const byCategory: Record<string, typeof ragContext.applicableDTU> = {};
      ragContext.applicableDTU.forEach(dtu => {
        const cat = dtu.category || 'general';
        if (!byCategory[cat]) byCategory[cat] = [];
        byCategory[cat].push(dtu);
      });

      Object.entries(byCategory).forEach(([category, dtus]) => {
        lines.push(`${category.toUpperCase()}:`);
        dtus.forEach(dtu => {
          lines.push(`  • ${dtu.code}: ${dtu.title}`);
        });
        lines.push('');
      });
    } else {
      lines.push('Les DTU applicables seront déterminés en fonction de la nature exacte des travaux.');
      lines.push('');
    }

    lines.push('3.2 NORMES ET RÉGLEMENTATIONS');
    lines.push('');
    lines.push('Réglementations thermiques:');
    lines.push('  • RE2020 pour les constructions neuves et extensions');
    lines.push('  • RT existant pour les rénovations');
    lines.push('');

    if (ragContext?.normes?.length) {
      lines.push('Normes spécifiques identifiées:');
      ragContext.normes.slice(0, 5).forEach(norme => {
        lines.push(`  • ${norme.codeReference || norme.title}: ${norme.content.substring(0, 100)}...`);
      });
      lines.push('');
    }

    lines.push('3.3 AVIS TECHNIQUES ET DTAp');
    lines.push('');
    lines.push('Pour les produits et systèmes non traditionnels, l\'entreprise devra fournir:');
    lines.push('  • L\'Avis Technique ou Document Technique d\'Application en cours de validité');
    lines.push('  • La notice de mise en œuvre du fabricant');
    lines.push('  • Les fiches de données de sécurité (FDS) des produits');

    return lines.join('\n');
  }

  /**
   * Génère les prescriptions communes enrichies
   */
  private static generateEnrichedCommonPrescriptions(
    project: Phase0Project,
    ragContext: CCTPEnrichmentContext | null
  ): string {
    const lines: string[] = [];

    lines.push('4.1 PRESCRIPTIONS GÉNÉRALES');
    lines.push('');
    lines.push('Qualité d\'exécution:');
    lines.push('Les travaux seront exécutés suivant les règles de l\'art et conformément aux documents normatifs listés au chapitre 3.');
    lines.push('');

    lines.push('Protection des ouvrages:');
    lines.push('L\'entreprise assurera la protection des ouvrages existants et des ouvrages en cours de réalisation contre les dégradations, salissures et intempéries.');
    lines.push('');

    lines.push('4.2 COORDINATION');
    lines.push('');
    lines.push('Chaque entreprise devra:');
    lines.push('  • Se coordonner avec les autres corps d\'état');
    lines.push('  • Participer aux réunions de chantier');
    lines.push('  • Respecter le planning général d\'exécution');
    lines.push('  • Signaler toute difficulté ou incompatibilité détectée');
    lines.push('');

    lines.push('4.3 HYGIÈNE ET SÉCURITÉ');
    lines.push('');
    lines.push('L\'entreprise devra:');
    lines.push('  • Respecter les dispositions du Code du travail');
    lines.push('  • Appliquer les mesures du plan de prévention');
    lines.push('  • Assurer la propreté du chantier');
    lines.push('  • Évacuer régulièrement les déchets');
    lines.push('');

    // Contraintes spécifiques de copropriété
    if (project.property?.condo?.isInCondo) {
      lines.push('4.4 CONTRAINTES DE COPROPRIÉTÉ');
      lines.push('');
      lines.push('L\'entreprise devra respecter:');
      lines.push('  • Les horaires autorisés par le règlement de copropriété');
      lines.push('  • Les modalités d\'accès aux parties communes');
      lines.push('  • La protection des zones de circulation');
      lines.push('  • Les conditions de stockage des matériaux');
    }

    // Ajouter les guides et bonnes pratiques si disponibles
    if (ragContext?.guides?.length) {
      lines.push('');
      lines.push('4.5 BONNES PRATIQUES');
      lines.push('');
      ragContext.guides.slice(0, 3).forEach(guide => {
        if (guide.content.length > 50) {
          lines.push(`${guide.title}:`);
          lines.push(`  ${guide.content.substring(0, 200)}...`);
          lines.push('');
        }
      });
    }

    return lines.join('\n');
  }

  /**
   * Génère les prescriptions d'un lot enrichies avec RAG
   */
  private static async generateEnrichedLotCCTP(
    lot: SelectedLot,
    prescription: CCTPEnrichmentContext['prescriptions'][0] | undefined,
    ragContext: CCTPEnrichmentContext | null
  ): Promise<string> {
    const lines: string[] = [];
    const catalogLot = LOT_CATALOG.find(l => l.type === lot.type);
    const lotCategory = lot.category || lot.type;

    // Récupérer les DTU du catalogue local
    const localDTU = DTU_CATALOG[lotCategory.toLowerCase()] || [];

    // OBJET
    lines.push('OBJET:');
    lines.push(lot.description || catalogLot?.description || `Travaux de ${lot.name || lot.type}`);
    lines.push('');

    // CONSISTANCE DES TRAVAUX
    lines.push('CONSISTANCE DES TRAVAUX:');
    if (lot.selectedPrestations?.length) {
      lot.selectedPrestations.forEach(p => lines.push(`  • ${p}`));
    } else if (catalogLot?.commonPrestations?.length) {
      catalogLot.commonPrestations.forEach(p => lines.push(`  • ${p}`));
    } else {
      lines.push('  • Se référer au descriptif général du projet');
    }
    lines.push('');

    // NORMES ET DTU DE RÉFÉRENCE (enrichi)
    lines.push('NORMES ET DTU DE RÉFÉRENCE:');

    // DTU du catalogue local
    if (localDTU.length > 0) {
      localDTU.forEach(dtu => {
        lines.push(`  • ${dtu.code} - ${dtu.title}`);
      });
    }

    // DTU du catalogue du lot
    if (catalogLot?.dtuReferences?.length) {
      catalogLot.dtuReferences.forEach(dtu => {
        if (!localDTU.some(d => dtu.includes(d.code))) {
          lines.push(`  • ${dtu}`);
        }
      });
    }

    // DTU additionnels depuis RAG
    if (prescription?.dtuReferences?.length) {
      prescription.dtuReferences.forEach(dtu => {
        if (!lines.some(l => l.includes(dtu))) {
          lines.push(`  • ${dtu}`);
        }
      });
    }
    lines.push('');

    // PRESCRIPTIONS TECHNIQUES (depuis RAG si disponible)
    if (prescription?.requirements?.length) {
      lines.push('PRESCRIPTIONS TECHNIQUES:');
      prescription.requirements.slice(0, 5).forEach((req, i) => {
        lines.push(`  ${i + 1}. ${req.substring(0, 200)}${req.length > 200 ? '...' : ''}`);
      });
      lines.push('');
    }

    // MATÉRIAUX ET PRODUITS
    lines.push('MATÉRIAUX ET PRODUITS:');
    if (prescription?.materials?.length) {
      prescription.materials.slice(0, 3).forEach(mat => {
        lines.push(`  • ${mat.substring(0, 150)}`);
      });
    } else {
      lines.push('  • Matériaux conformes aux normes NF ou équivalentes');
      lines.push('  • Marquage CE obligatoire');
      lines.push('  • Fiches techniques à fournir avant mise en œuvre');
    }
    lines.push('');

    // MODE D'EXÉCUTION
    lines.push('MODE D\'EXÉCUTION:');
    if (prescription?.execution?.length) {
      prescription.execution.slice(0, 4).forEach(exec => {
        lines.push(`  • ${exec.substring(0, 150)}`);
      });
    } else {
      lines.push('  • Mise en œuvre selon les prescriptions du fabricant');
      lines.push('  • Respect des DTU mentionnés ci-dessus');
      lines.push('  • Conditions atmosphériques à respecter');
    }
    lines.push('');

    // CONTRÔLES
    if (prescription?.controls?.length) {
      lines.push('CONTRÔLES:');
      prescription.controls.slice(0, 3).forEach(ctrl => {
        lines.push(`  • ${ctrl.substring(0, 150)}`);
      });
      lines.push('');
    }

    // DIAGNOSTICS REQUIS
    if (catalogLot?.requiredDiagnostics?.length) {
      lines.push('DIAGNOSTICS PRÉALABLES:');
      catalogLot.requiredDiagnostics.forEach(d => lines.push(`  • ${d}`));
      lines.push('');
    }

    // QUALIFICATION RGE
    if (catalogLot?.rgeEligible || lot.isRGEEligible) {
      lines.push('QUALIFICATION REQUISE:');
      lines.push('Ce lot est éligible aux aides à la rénovation énergétique.');
      lines.push('L\'entreprise devra être titulaire de la qualification RGE correspondante.');
      lines.push('Certificat RGE à fournir avant démarrage des travaux.');
    }

    return lines.join('\n');
  }

  /**
   * Génère la section des contrôles et essais
   */
  private static generateControlsSection(ragContext: CCTPEnrichmentContext | null): string {
    const lines: string[] = [];

    lines.push('7.1 AUTOCONTRÔLE');
    lines.push('');
    lines.push('Chaque entreprise devra mettre en place un système d\'autocontrôle comprenant:');
    lines.push('  • Vérification de la conformité des matériaux à réception');
    lines.push('  • Contrôle des conditions de mise en œuvre');
    lines.push('  • Vérification de la qualité des travaux réalisés');
    lines.push('  • Documentation des contrôles effectués');
    lines.push('');

    lines.push('7.2 ESSAIS ET VÉRIFICATIONS');
    lines.push('');
    lines.push('Les essais suivants pourront être demandés selon les lots:');
    lines.push('');
    lines.push('Électricité:');
    lines.push('  • Mesure de continuité de terre');
    lines.push('  • Mesure d\'isolement');
    lines.push('  • Vérification des protections différentielles');
    lines.push('');
    lines.push('Plomberie:');
    lines.push('  • Épreuve d\'étanchéité des réseaux');
    lines.push('  • Contrôle des débits et pressions');
    lines.push('');
    lines.push('Isolation:');
    lines.push('  • Test d\'infiltrométrie (si applicable)');
    lines.push('  • Vérification thermographique (si demandé)');
    lines.push('');
    lines.push('Ventilation:');
    lines.push('  • Mesure des débits d\'air');
    lines.push('  • Équilibrage des réseaux');
    lines.push('');

    lines.push('7.3 DOCUMENTS À FOURNIR');
    lines.push('');
    lines.push('Avant réception, l\'entreprise fournira:');
    lines.push('  • Procès-verbaux d\'essais');
    lines.push('  • Fiches d\'autocontrôle');
    lines.push('  • Notices d\'entretien et de maintenance');
    lines.push('  • Certificats de garantie des équipements');
    lines.push('  • Plans de récolement si modifications');

    return lines.join('\n');
  }

  /**
   * Récupère tous les documents d'un projet
   */
  static async getProjectDocuments(projectId: string): Promise<GeneratedDocument[]> {
    const { data, error } = await supabase
      .from('phase0_documents')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erreur lors de la récupération des documents:', error);
      throw error;
    }

    return (data || []).map(this.mapRowToDocument);
  }

  /**
   * Récupère un document par ID
   */
  static async getDocument(documentId: string): Promise<GeneratedDocument | null> {
    const { data, error } = await supabase
      .from('phase0_documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return this.mapRowToDocument(data);
  }

  /**
   * Finalise un document (passe de draft à final)
   */
  static async finalizeDocument(documentId: string): Promise<void> {
    const { error } = await supabase
      .from('phase0_documents')
      .update({
        status: 'final',
        updated_at: new Date().toISOString(),
      })
      .eq('id', documentId);

    if (error) {
      throw error;
    }
  }

  /**
   * Exporte un document en format texte (pour PDF ultérieur)
   */
  static exportToText(document: GeneratedDocument): string {
    let output = '';

    // En-tête
    output += `${'='.repeat(60)}\n`;
    output += `${document.title.toUpperCase()}\n`;
    output += `${'='.repeat(60)}\n\n`;

    output += `Référence projet: ${document.metadata.projectReference}\n`;
    output += `Maître d'ouvrage: ${document.metadata.ownerName}\n`;
    output += `Adresse du bien: ${document.metadata.propertyAddress}\n`;
    output += `Date de génération: ${document.metadata.generationDate.toLocaleDateString('fr-FR')}\n`;
    output += `Version: ${document.metadata.version}\n\n`;
    output += `${'-'.repeat(60)}\n\n`;

    // Sections
    const renderSection = (section: DocumentSection, depth = 0): string => {
      let text = '';
      const indent = '  '.repeat(depth);

      text += `${indent}${section.title}\n`;
      text += `${indent}${'-'.repeat(section.title.length)}\n\n`;

      if (section.content) {
        text += `${indent}${section.content}\n\n`;
      }

      if (section.subsections) {
        section.subsections.forEach(sub => {
          text += renderSection(sub, depth + 1);
        });
      }

      return text;
    };

    document.content.sections.forEach(section => {
      output += renderSection(section);
    });

    // Pied de page
    output += `\n${'='.repeat(60)}\n`;
    output += `Document généré par TORP - ${new Date().toLocaleDateString('fr-FR')}\n`;

    return output;
  }

  // Méthodes privées de génération de contenu

  private static generateContextSection(project: Phase0Project): string {
    const workProject = project.workProject;
    const lines: string[] = [];

    lines.push(`Le présent document constitue le Cahier des Charges Fonctionnel pour le projet "${workProject?.general?.title || 'Non défini'}".`);

    if (workProject?.general?.description) {
      lines.push(`\nDescription du projet:\n${workProject.general.description}`);
    }

    return lines.join('\n');
  }

  private static generateOwnerSection(owner?: MasterOwnerProfile): string {
    if (!owner) return 'Informations non renseignées';

    const lines: string[] = [];

    // Type de maître d'ouvrage
    const typeLabels: Record<string, string> = {
      b2c: 'Particulier',
      b2b: 'Professionnel',
      b2g: 'Collectivité publique',
      investor: 'Investisseur',
    };
    lines.push(`Type: ${typeLabels[owner.identity?.type || ''] || 'Non précisé'}`);

    // Identité
    if (owner.identity?.type === 'b2c') {
      lines.push(`Nom: ${owner.identity.lastName || ''} ${owner.identity.firstName || ''}`);
    } else {
      lines.push(`Raison sociale: ${owner.identity?.companyName || 'Non renseignée'}`);
      if (owner.identity?.siret) {
        lines.push(`SIRET: ${owner.identity.siret}`);
      }
    }

    // Contact
    if (owner.contact) {
      lines.push(`\nCoordonnées:`);
      lines.push(`- Email: ${owner.contact.email || 'Non renseigné'}`);
      lines.push(`- Téléphone: ${owner.contact.phone || 'Non renseigné'}`);
    }

    // Expérience
    if (owner.experience?.previousProjects !== undefined) {
      lines.push(`\nExpérience: ${owner.experience.previousProjects} projet(s) antérieur(s)`);
    }

    return lines.join('\n');
  }

  private static generatePropertySection(property?: Property): string {
    if (!property) return 'Informations sur le bien non renseignées';

    const lines: string[] = [];

    // Type de bien
    const typeLabels: Record<string, string> = {
      apartment: 'Appartement',
      house: 'Maison individuelle',
      villa: 'Villa',
      loft: 'Loft',
      studio: 'Studio',
      building: 'Immeuble',
      commercial: 'Local commercial',
      office: 'Bureau',
      warehouse: 'Entrepôt',
      land: 'Terrain',
    };

    lines.push(`Type de bien: ${typeLabels[property.characteristics?.type || ''] || 'Non précisé'}`);

    return lines.join('\n');
  }

  private static formatAddress(property?: Property): string {
    if (!property?.address) return 'Adresse non renseignée';

    const addr = property.address;
    const parts = [
      addr.street,
      addr.complement,
      `${addr.postalCode} ${addr.city}`,
    ].filter(Boolean);

    return parts.join('\n');
  }

  private static formatPropertyCharacteristics(property?: Property): string {
    if (!property?.characteristics) return 'Non renseignées';

    const chars = property.characteristics;
    const lines: string[] = [];

    if (chars.livingArea) lines.push(`Surface habitable: ${chars.livingArea} m²`);
    if (chars.totalArea) lines.push(`Surface totale: ${chars.totalArea} m²`);
    if (chars.roomCount) lines.push(`Nombre de pièces: ${chars.roomCount}`);
    if (chars.bedroomCount) lines.push(`Nombre de chambres: ${chars.bedroomCount}`);
    if (chars.bathroomCount) lines.push(`Nombre de salles de bain: ${chars.bathroomCount}`);
    if (chars.floorCount) lines.push(`Nombre d'étages: ${chars.floorCount}`);

    return lines.join('\n') || 'Non renseignées';
  }

  private static formatPropertyState(property?: Property): string {
    if (!property?.condition) return 'Non renseigné';

    const condition = property.condition;
    const stateLabels: Record<string, string> = {
      new: 'Neuf',
      excellent: 'Excellent état',
      good: 'Bon état',
      average: 'État moyen',
      poor: 'Mauvais état',
      very_poor: 'Très mauvais état',
      to_renovate: 'À rénover',
      ruins: 'En ruine',
    };

    const lines: string[] = [];
    lines.push(`État général: ${stateLabels[condition.overallState || ''] || 'Non évalué'}`);

    if (condition.lastRenovation) {
      lines.push(`Dernière rénovation: ${condition.lastRenovation}`);
    }

    return lines.join('\n');
  }

  private static formatWorkType(workProject?: WorkProject): string {
    if (!workProject?.scope) return 'Non défini';

    const typeLabels: Record<string, string> = {
      new_construction: 'Construction neuve',
      extension: 'Extension',
      renovation: 'Rénovation',
      refurbishment: 'Réhabilitation',
      restoration: 'Restauration',
      maintenance: 'Entretien',
      improvement: 'Amélioration',
      conversion: 'Transformation',
      demolition: 'Démolition',
    };

    return typeLabels[workProject.scope.workType || ''] || 'Non précisé';
  }

  private static generateObjectivesSection(workProject?: WorkProject): string {
    if (!workProject?.scope?.objectives) {
      return 'Les objectifs du projet seront précisés lors de la phase d\'étude.';
    }

    const objectives = workProject.scope.objectives;
    const lines: string[] = ['Les principaux objectifs du projet sont:'];

    if (objectives.functional?.length) {
      lines.push('\nObjectifs fonctionnels:');
      objectives.functional.forEach(obj => lines.push(`  • ${obj}`));
    }

    if (objectives.performance?.length) {
      lines.push('\nObjectifs de performance:');
      objectives.performance.forEach(obj => lines.push(`  • ${obj}`));
    }

    if (objectives.aesthetic?.length) {
      lines.push('\nObjectifs esthétiques:');
      objectives.aesthetic.forEach(obj => lines.push(`  • ${obj}`));
    }

    return lines.join('\n');
  }

  private static generateScopeSection(lots?: SelectedLot[]): string {
    if (!lots || lots.length === 0) {
      return 'Les lots de travaux seront définis lors de la phase d\'étude.';
    }

    const lines: string[] = [
      `Le projet comprend ${lots.length} lot(s) de travaux:`,
      '',
    ];

    // Grouper par catégorie
    const byCategory = lots.reduce((acc, lot) => {
      if (!acc[lot.category]) acc[lot.category] = [];
      acc[lot.category].push(lot);
      return acc;
    }, {} as Record<string, SelectedLot[]>);

    const categoryLabels: Record<string, string> = {
      gros_oeuvre: 'Gros œuvre',
      second_oeuvre: 'Second œuvre',
      technique: 'Lots techniques',
      finitions: 'Finitions',
      exterieur: 'Extérieur',
      specifique: 'Lots spécifiques',
    };

    Object.entries(byCategory).forEach(([category, categoryLots]) => {
      lines.push(`\n${categoryLabels[category] || category}:`);
      categoryLots.forEach(lot => {
        lines.push(`  • Lot ${lot.number} - ${lot.name}`);
        if (lot.description) {
          lines.push(`    ${lot.description}`);
        }
      });
    });

    return lines.join('\n');
  }

  private static generateConstraintsSection(project: Phase0Project): string {
    const lines: string[] = [];
    const constraints = project.workProject?.constraints;

    // Contraintes temporelles
    lines.push('Contraintes temporelles:');
    if (constraints?.temporal?.desiredStartDate) {
      lines.push(`  • Date de début souhaitée: ${new Date(constraints.temporal.desiredStartDate).toLocaleDateString('fr-FR')}`);
    }
    if (constraints?.temporal?.deadlineDate) {
      lines.push(`  • Date limite: ${new Date(constraints.temporal.deadlineDate).toLocaleDateString('fr-FR')}`);
    }
    if (constraints?.temporal?.maxDurationMonths) {
      lines.push(`  • Durée maximale: ${constraints.temporal.maxDurationMonths} mois`);
    }
    if (constraints?.temporal?.isUrgent) {
      lines.push(`  • ⚠️ Travaux urgents`);
    }

    // Contraintes d'occupation
    if (constraints?.occupancy) {
      lines.push('\nContraintes d\'occupation:');
      const occupancyLabels: Record<string, string> = {
        vacant: 'Logement vacant pendant les travaux',
        occupied_full: 'Logement occupé en permanence',
        occupied_partial: 'Occupation partielle',
        flexible: 'Flexible',
      };
      lines.push(`  • ${occupancyLabels[constraints.occupancy.duringWorks || ''] || 'Non précisé'}`);
    }

    // Contraintes d'accès
    if (constraints?.physical?.accessConstraints) {
      lines.push('\nContraintes d\'accès:');
      constraints.physical.accessConstraints.forEach(c => lines.push(`  • ${c}`));
    }

    // Contraintes techniques
    if (constraints?.technical?.existingConstraints) {
      lines.push('\nContraintes techniques:');
      constraints.technical.existingConstraints.forEach(c => lines.push(`  • ${c}`));
    }

    return lines.join('\n') || 'Aucune contrainte particulière identifiée';
  }

  private static generateBudgetSection(
    workProject?: WorkProject,
    estimation?: ProjectEstimation
  ): string {
    const lines: string[] = [];

    // Budget prévu
    if (workProject?.budget?.totalEnvelope) {
      const envelope = workProject.budget.totalEnvelope;
      lines.push('Enveloppe budgétaire du maître d\'ouvrage:');
      lines.push(`  ${envelope.min?.toLocaleString('fr-FR')} € - ${envelope.max?.toLocaleString('fr-FR')} € TTC`);
    }

    // Estimation TORP
    if (estimation?.budget) {
      lines.push('\nEstimation préliminaire TORP:');
      lines.push(`  ${estimation.budget.total.min.toLocaleString('fr-FR')} € - ${estimation.budget.total.max.toLocaleString('fr-FR')} € TTC`);
      lines.push(`  (Confiance: ${estimation.confidence}%)`);
    }

    // Mode de financement
    if (workProject?.budget?.fundingMode) {
      lines.push('\nMode de financement:');
      const modeLabels: Record<string, string> = {
        personal_funds: 'Fonds propres',
        bank_loan: 'Prêt bancaire',
        mixed: 'Financement mixte',
        subsidies: 'Subventions',
      };
      lines.push(`  ${modeLabels[workProject.budget.fundingMode] || workProject.budget.fundingMode}`);
    }

    return lines.join('\n') || 'Budget à définir';
  }

  private static generatePlanningSection(
    workProject?: WorkProject,
    estimation?: ProjectEstimation
  ): string {
    const lines: string[] = [];

    if (workProject?.constraints?.temporal?.desiredStartDate) {
      lines.push(`Date de début souhaitée: ${new Date(workProject.constraints.temporal.desiredStartDate).toLocaleDateString('fr-FR')}`);
    }

    if (estimation?.duration) {
      lines.push(`\nDurée estimée des travaux:`);
      lines.push(`  ${estimation.duration.totalWeeks.min} à ${estimation.duration.totalWeeks.max} semaines`);

      if (estimation.duration.phases.length > 0) {
        lines.push('\nPhases principales:');
        estimation.duration.phases.forEach(phase => {
          lines.push(`  • ${phase.name}: ${phase.durationDays.min}-${phase.durationDays.max} jours`);
        });
      }
    }

    return lines.join('\n') || 'Planning à établir lors de la phase d\'étude';
  }

  private static generateQualitySection(workProject?: WorkProject): string {
    const lines: string[] = [];

    if (workProject?.quality?.finishLevel) {
      const levelLabels: Record<string, string> = {
        basic: 'Basique - Fonctionnel et économique',
        standard: 'Standard - Bon rapport qualité/prix',
        premium: 'Premium - Matériaux et finitions haut de gamme',
        luxury: 'Luxe - Excellence et sur-mesure',
      };
      lines.push(`Niveau de finition: ${levelLabels[workProject.quality.finishLevel]}`);
    }

    if (workProject?.quality?.certifications?.length) {
      lines.push('\nCertifications visées:');
      workProject.quality.certifications.forEach(cert => lines.push(`  • ${cert}`));
    }

    if (workProject?.quality?.priorities?.length) {
      lines.push('\nPriorités qualité:');
      workProject.quality.priorities.forEach(p => lines.push(`  • ${p}`));
    }

    return lines.join('\n') || 'Exigences de qualité standard';
  }

  private static generateRegulatorySection(project: Phase0Project): string {
    const lines: string[] = [];
    const regulatory = project.workProject?.regulatory;

    // Type de déclaration
    if (regulatory?.declarationType) {
      const typeLabels: Record<string, string> = {
        none: 'Aucune déclaration requise',
        prior_declaration: 'Déclaration préalable',
        building_permit: 'Permis de construire',
        demolition_permit: 'Permis de démolir',
      };
      lines.push(`Autorisation administrative: ${typeLabels[regulatory.declarationType]}`);
    }

    // Architecte obligatoire
    if (regulatory?.requiresArchitect) {
      lines.push('⚠️ Recours à un architecte obligatoire');
    }

    // Zone patrimoniale
    if (project.property?.heritage?.isClassified || project.property?.heritage?.isRegistered) {
      lines.push('⚠️ Bien situé en zone patrimoniale - Consultation ABF obligatoire');
    }

    // Risques naturels
    if (project.deductions?.some(d => d.type === 'natural_risks')) {
      lines.push('\nRisques naturels identifiés (voir rapport Géorisques)');
    }

    return lines.join('\n') || 'Contexte réglementaire à vérifier';
  }

  private static generateExecutiveSummary(
    project: Phase0Project,
    estimation: ProjectEstimation
  ): string {
    const lines: string[] = [];

    lines.push(`Projet: ${project.workProject?.general?.title || 'Non défini'}`);
    lines.push(`Référence: ${project.reference}`);
    lines.push('');

    // Résumé du bien
    if (project.property) {
      lines.push(`Bien: ${this.formatAddress(project.property)}`);
      if (project.property.characteristics?.livingArea) {
        lines.push(`Surface: ${project.property.characteristics.livingArea} m²`);
      }
    }

    lines.push('');

    // Résumé des travaux
    lines.push(`Nombre de lots: ${project.selectedLots?.length || 0}`);
    lines.push(`Budget estimé: ${estimation.budget.total.min.toLocaleString('fr-FR')} € - ${estimation.budget.total.max.toLocaleString('fr-FR')} € TTC`);
    lines.push(`Durée estimée: ${estimation.duration.totalWeeks.min} à ${estimation.duration.totalWeeks.max} semaines`);

    return lines.join('\n');
  }

  private static generateExistingStateSection(property?: Property): string {
    const lines: string[] = [];

    // Caractéristiques générales
    lines.push('Caractéristiques générales:');
    lines.push(this.formatPropertyCharacteristics(property));
    lines.push('');

    // État actuel
    lines.push('État actuel:');
    lines.push(this.formatPropertyState(property));
    lines.push('');

    // Construction
    if (property?.construction) {
      lines.push('Caractéristiques constructives:');
      if (property.construction.yearBuilt) {
        lines.push(`  • Année de construction: ${property.construction.yearBuilt}`);
      }
      if (property.construction.structureType) {
        lines.push(`  • Type de structure: ${property.construction.structureType}`);
      }
      if (property.construction.foundationType) {
        lines.push(`  • Type de fondations: ${property.construction.foundationType}`);
      }
    }

    // Diagnostics
    if (property?.diagnostics) {
      lines.push('\nDiagnostics:');
      if (property.diagnostics.dpe?.rating) {
        lines.push(`  • DPE: Classe ${property.diagnostics.dpe.rating}`);
      }
      if (property.diagnostics.asbestos) {
        lines.push(`  • Amiante: ${property.diagnostics.asbestos.presence ? 'Présence détectée' : 'Absence'}`);
      }
    }

    return lines.join('\n');
  }

  private static generateProgramSection(project: Phase0Project): string {
    const lines: string[] = [];

    lines.push('Le programme de travaux comprend les interventions suivantes:');
    lines.push('');

    // Objectifs principaux
    if (project.workProject?.scope?.objectives) {
      lines.push('Objectifs:');
      const allObjectives = [
        ...(project.workProject.scope.objectives.functional || []),
        ...(project.workProject.scope.objectives.performance || []),
      ];
      allObjectives.forEach(obj => lines.push(`  • ${obj}`));
      lines.push('');
    }

    // Liste des lots
    lines.push('Lots de travaux:');
    project.selectedLots?.forEach(lot => {
      lines.push(`  ${lot.number}. ${lot.name}${lot.isUrgent ? ' (urgent)' : ''}`);
    });

    return lines.join('\n');
  }

  private static generateLotDescription(lot: SelectedLot): string {
    const lines: string[] = [];
    const catalogLot = LOT_CATALOG.find(l => l.type === lot.type);

    lines.push(`Description: ${lot.description || catalogLot?.description || 'Non détaillé'}`);
    lines.push('');

    // Priorité
    const priorityLabels: Record<string, string> = {
      critical: 'Critique',
      high: 'Haute',
      medium: 'Moyenne',
      low: 'Basse',
      optional: 'Optionnel',
    };
    lines.push(`Priorité: ${priorityLabels[lot.priority]}`);

    // Estimation
    if (lot.estimatedBudget) {
      lines.push(`Budget estimé: ${lot.estimatedBudget.min.toLocaleString('fr-FR')} € - ${lot.estimatedBudget.max.toLocaleString('fr-FR')} €`);
    }

    if (lot.estimatedDurationDays) {
      lines.push(`Durée estimée: ${lot.estimatedDurationDays} jours`);
    }

    // Prestations
    if (lot.selectedPrestations?.length) {
      lines.push('\nPrestations prévues:');
      lot.selectedPrestations.forEach(p => lines.push(`  • ${p}`));
    }

    // DTU de référence
    if (catalogLot?.dtuReferences?.length) {
      lines.push('\nNormes applicables:');
      catalogLot.dtuReferences.forEach(dtu => lines.push(`  • ${dtu}`));
    }

    return lines.join('\n');
  }

  private static generateEstimationSection(estimation: ProjectEstimation): string {
    const lines: string[] = [];

    lines.push('Estimation globale:');
    lines.push(`  ${estimation.budget.total.min.toLocaleString('fr-FR')} € - ${estimation.budget.total.max.toLocaleString('fr-FR')} € TTC`);
    lines.push('');

    // Par catégorie
    lines.push('Répartition par catégorie:');
    estimation.budget.byCategory.forEach(cat => {
      lines.push(`  • ${cat.categoryName}: ${cat.estimate.min.toLocaleString('fr-FR')} € - ${cat.estimate.max.toLocaleString('fr-FR')} € (${cat.percentage}%)`);
    });
    lines.push('');

    // Provisions
    lines.push('Provisions:');
    lines.push(`  • Imprévus: ${estimation.budget.contingency.min.toLocaleString('fr-FR')} € - ${estimation.budget.contingency.max.toLocaleString('fr-FR')} €`);

    // Confiance
    lines.push('');
    lines.push(`Niveau de confiance: ${estimation.confidence}%`);

    if (estimation.factors.length > 0) {
      lines.push('\nFacteurs pris en compte:');
      estimation.factors.forEach(f => {
        const impact = f.impact === 'increase' ? '+' : f.impact === 'decrease' ? '-' : '';
        lines.push(`  • ${f.name}: ${impact}${Math.abs(f.percentage)}%`);
      });
    }

    return lines.join('\n');
  }

  private static generateScheduleSection(estimation: ProjectEstimation): string {
    const lines: string[] = [];

    lines.push('Durée totale estimée:');
    lines.push(`  ${estimation.duration.totalWeeks.min} à ${estimation.duration.totalWeeks.max} semaines`);
    lines.push(`  (${estimation.duration.totalDays.min} à ${estimation.duration.totalDays.max} jours ouvrés)`);
    lines.push('');

    if (estimation.duration.phases.length > 0) {
      lines.push('Phases d\'exécution:');
      estimation.duration.phases.forEach((phase, index) => {
        lines.push(`  ${index + 1}. ${phase.name}`);
        lines.push(`     Durée: ${phase.durationDays.min} - ${phase.durationDays.max} jours`);
        lines.push(`     Lots: ${phase.lots.join(', ')}`);
      });
    }

    return lines.join('\n');
  }

  private static generateRecommendationsSection(
    project: Phase0Project,
    estimation: ProjectEstimation
  ): string {
    const lines: string[] = [];

    // Recommandations générales
    lines.push('Recommandations générales:');

    // Basées sur le budget
    if (project.workProject?.budget?.totalEnvelope) {
      const budgetComparison = EstimationService.compareBudgetWithTarget(
        estimation.budget,
        project.workProject.budget.totalEnvelope
      );
      lines.push(`  • Budget: ${budgetComparison.recommendation}`);
    }

    // Basées sur les lots
    if (project.selectedLots && project.selectedLots.length > 0) {
      const urgentLots = project.selectedLots.filter(l => l.isUrgent);
      if (urgentLots.length > 0) {
        lines.push(`  • ${urgentLots.length} lot(s) marqué(s) comme urgent(s) - à prioriser`);
      }
    }

    // Avertissements
    if (estimation.warnings.length > 0) {
      lines.push('\nPoints d\'attention:');
      estimation.warnings.forEach(w => lines.push(`  ⚠️ ${w}`));
    }

    // Prochaines étapes
    lines.push('\nProchaines étapes recommandées:');
    lines.push('  1. Valider le programme avec le maître d\'ouvrage');
    lines.push('  2. Consulter des entreprises pour affiner les estimations');
    lines.push('  3. Effectuer les démarches administratives nécessaires');
    lines.push('  4. Planifier les interventions selon les contraintes identifiées');

    return lines.join('\n');
  }

  private static generateGeneralDispositionsSection(project: Phase0Project): string {
    return `Le présent Cahier des Clauses Techniques Particulières (CCTP) définit les prescriptions techniques applicables aux travaux du projet "${project.workProject?.general?.title || 'Non défini'}", référence ${project.reference}.

Il fait partie intégrante du Dossier de Consultation des Entreprises (DCE) et complète les autres pièces du marché.

Les entreprises soumissionnaires sont réputées avoir pris connaissance de l'ensemble des contraintes et particularités du chantier avant remise de leur offre.`;
  }

  private static generateSiteDescriptionSection(property?: Property): string {
    const lines: string[] = [];

    lines.push('Localisation:');
    lines.push(this.formatAddress(property));
    lines.push('');

    lines.push('Caractéristiques du site:');
    lines.push(this.formatPropertyCharacteristics(property));
    lines.push('');

    if (property?.construction) {
      lines.push('Description de l\'existant:');
      if (property.construction.yearBuilt) {
        lines.push(`  • Construction: ${property.construction.yearBuilt}`);
      }
      if (property.construction.structureType) {
        lines.push(`  • Structure: ${property.construction.structureType}`);
      }
    }

    return lines.join('\n');
  }

  private static generateCommonPrescriptionsSection(project: Phase0Project): string {
    const lines: string[] = [];

    lines.push('Normes et règlements:');
    lines.push('Les travaux devront être exécutés conformément aux:');
    lines.push('  • Documents Techniques Unifiés (DTU) en vigueur');
    lines.push('  • Normes NF applicables');
    lines.push('  • Règlements de sécurité');
    lines.push('  • Code de la construction et de l\'habitation');
    lines.push('');

    lines.push('Matériaux:');
    lines.push('Les matériaux employés devront être neufs, de première qualité, et bénéficier du marquage CE lorsque applicable.');
    lines.push('');

    lines.push('Coordination:');
    lines.push('Chaque entreprise devra se coordonner avec les autres corps d\'état pour assurer la bonne exécution des travaux.');

    if (project.property?.condo?.isInCondo) {
      lines.push('');
      lines.push('Contraintes copropriété:');
      lines.push('Les travaux devront respecter le règlement de copropriété, notamment en termes de:');
      lines.push('  • Horaires d\'intervention');
      lines.push('  • Accès aux parties communes');
      lines.push('  • Protection des zones de passage');
    }

    return lines.join('\n');
  }

  private static generateLotCCTP(lot: SelectedLot): string {
    const lines: string[] = [];
    const catalogLot = LOT_CATALOG.find(l => l.type === lot.type);

    // Objet du lot
    lines.push('Objet:');
    lines.push(lot.description || catalogLot?.description || 'Se référer au descriptif général');
    lines.push('');

    // Consistance des travaux
    lines.push('Consistance des travaux:');
    if (lot.selectedPrestations?.length) {
      lot.selectedPrestations.forEach(p => lines.push(`  • ${p}`));
    } else if (catalogLot?.commonPrestations?.length) {
      catalogLot.commonPrestations.forEach(p => lines.push(`  • ${p}`));
    } else {
      lines.push('  • Se référer au programme de travaux');
    }
    lines.push('');

    // Normes applicables
    if (catalogLot?.dtuReferences?.length) {
      lines.push('Normes et DTU de référence:');
      catalogLot.dtuReferences.forEach(dtu => lines.push(`  • ${dtu}`));
      lines.push('');
    }

    // Diagnostics requis
    if (catalogLot?.requiredDiagnostics?.length) {
      lines.push('Diagnostics préalables requis:');
      catalogLot.requiredDiagnostics.forEach(d => lines.push(`  • ${d}`));
      lines.push('');
    }

    // RGE
    if (catalogLot?.rgeEligible) {
      lines.push('Qualification RGE:');
      lines.push('Ce lot est éligible aux aides à la rénovation énergétique. L\'entreprise devra être titulaire de la qualification RGE correspondante.');
    }

    return lines.join('\n');
  }

  private static generateExecutionConditionsSection(project: Phase0Project): string {
    const lines: string[] = [];
    const constraints = project.workProject?.constraints;

    lines.push('Conditions générales d\'exécution:');
    lines.push('');

    // Délais
    lines.push('Délais:');
    if (constraints?.temporal?.desiredStartDate) {
      lines.push(`  • Démarrage prévu: ${new Date(constraints.temporal.desiredStartDate).toLocaleDateString('fr-FR')}`);
    }
    if (constraints?.temporal?.maxDurationMonths) {
      lines.push(`  • Durée maximale: ${constraints.temporal.maxDurationMonths} mois`);
    }
    lines.push('');

    // Occupation
    lines.push('Occupation des lieux:');
    if (constraints?.occupancy?.duringWorks) {
      const occupancyLabels: Record<string, string> = {
        vacant: 'Logement inoccupé pendant les travaux',
        occupied_full: 'Logement occupé - prévoir les aménagements nécessaires',
        occupied_partial: 'Occupation partielle - coordination requise',
        flexible: 'À définir avec le maître d\'ouvrage',
      };
      lines.push(`  ${occupancyLabels[constraints.occupancy.duringWorks]}`);
    }
    lines.push('');

    // Accès
    lines.push('Accès chantier:');
    if (constraints?.physical?.accessConstraints?.length) {
      constraints.physical.accessConstraints.forEach(c => lines.push(`  • ${c}`));
    } else {
      lines.push('  • Conditions d\'accès standard');
    }
    lines.push('');

    // Sécurité
    lines.push('Sécurité:');
    lines.push('  • Respect des règles de sécurité en vigueur');
    lines.push('  • Balisage et protection des zones de travaux');
    lines.push('  • Port des EPI obligatoire');

    return lines.join('\n');
  }

  private static generateReceptionSection(): string {
    return `Réception des travaux:

Pré-réception:
Une visite de pré-réception sera organisée avant la réception définitive pour identifier les éventuelles réserves.

Réception:
La réception des travaux sera prononcée conformément aux dispositions du CCAG Travaux.
Elle pourra être:
  • Sans réserve
  • Avec réserves (à lever dans un délai de 30 jours)
  • Refusée en cas de non-conformité majeure

Documents à fournir:
  • DOE (Dossier des Ouvrages Exécutés)
  • DIUO (Dossier d'Intervention Ultérieure sur l'Ouvrage)
  • Attestations de conformité
  • Garanties et certificats

Garanties:
  • Garantie de parfait achèvement: 1 an
  • Garantie biennale: 2 ans
  • Garantie décennale: 10 ans`;
  }

  private static formatOwnerName(owner?: MasterOwnerProfile): string {
    if (!owner?.identity) return 'Non renseigné';

    if (owner.identity.type === 'b2c') {
      return `${owner.identity.firstName || ''} ${owner.identity.lastName || ''}`.trim() || 'Non renseigné';
    }

    return owner.identity.companyName || 'Non renseigné';
  }

  private static async getNextVersion(projectId: string, documentType: DocumentType): Promise<number> {
    const { data, error } = await supabase
      .from('phase0_documents')
      .select('version')
      .eq('project_id', projectId)
      .eq('document_type', documentType)
      .order('version', { ascending: false })
      .limit(1);

    if (error || !data || data.length === 0) {
      return 1;
    }

    return (data[0].version || 0) + 1;
  }

  private static async saveDocument(doc: {
    projectId: string;
    type: DocumentType;
    title: string;
    version: number;
    content: DocumentContent;
    metadata: DocumentMetadata;
  }): Promise<GeneratedDocument> {
    // DB enum document_generation_status: 'pending', 'generating', 'ready', 'failed', 'expired'
    // Use 'ready' for successfully generated documents
    const { data, error } = await supabase
      .from('phase0_documents')
      .insert({
        project_id: doc.projectId,
        document_type: doc.type,
        name: doc.title, // Original column name
        title: doc.title, // Added by migration 022
        version: doc.version,
        content: doc.content, // JSONB accepts objects directly
        metadata: doc.metadata, // JSONB accepts objects directly
        status: 'ready', // Use valid enum value
        generated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('[DocumentGenerator] Save error:', error);
      throw error;
    }

    return this.mapRowToDocument(data);
  }

  private static mapRowToDocument(row: Record<string, unknown>): GeneratedDocument {
    // Map DB status enum to our internal status
    // DB: 'pending', 'generating', 'ready', 'failed', 'expired'
    // UI: 'draft', 'final', 'archived'
    const statusMap: Record<string, 'draft' | 'final' | 'archived'> = {
      pending: 'draft',
      generating: 'draft',
      ready: 'draft',
      failed: 'archived',
      expired: 'archived',
    };

    // Parse metadata and ensure generationDate is a Date object
    const rawMetadata = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata;
    const metadata: DocumentMetadata = {
      ...rawMetadata,
      generationDate: rawMetadata?.generationDate
        ? new Date(rawMetadata.generationDate)
        : new Date((row.generated_at || row.created_at) as string),
    };

    return {
      id: row.id as string,
      projectId: row.project_id as string,
      type: row.document_type as DocumentType,
      title: (row.title || row.name) as string, // Fallback to name if title is null
      version: row.version as number,
      content: typeof row.content === 'string' ? JSON.parse(row.content) : row.content as DocumentContent,
      metadata,
      generatedAt: new Date((row.generated_at || row.created_at) as string),
      status: statusMap[row.status as string] || 'draft',
    };
  }
}

export default DocumentGeneratorService;
