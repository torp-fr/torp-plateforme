/**
 * TORP Phase 1 - Types DCE (Dossier de Consultation des Entreprises)
 * Module 1.1 : Constitution du Dossier de Consultation
 *
 * Structure complète pour la génération automatique de DCE
 * conforme aux standards des marchés publics et privés français
 */

import type { TORPMetadata, Address, EstimationRange } from '../phase0/common.types';
import type { WizardMode } from '../phase0/wizard.types';

// =============================================================================
// DCE DOCUMENT PRINCIPAL
// =============================================================================

export interface DCEDocument {
  id: string;
  projectId: string;

  // Métadonnées
  metadata: DCEMetadata;

  // Pièces du DCE
  reglementConsultation: ReglementConsultation;
  acteEngagement: ActeEngagement;
  decompositionPrix: DecompositionPrix;
  cadreMemoireTechnique: CadreMemoireTechnique;

  // Annexes
  annexes: DCEAnnexe[];

  // État du DCE
  status: DCEStatus;

  // Génération
  generationInfo: DCEGenerationInfo;

  torpMetadata: TORPMetadata;
}

export interface DCEMetadata {
  reference: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  userMode: WizardMode;

  // Informations projet
  projectTitle: string;
  projectReference: string;
  consultationDeadline?: string;

  // Auteur
  author?: string;
  organization?: string;
}

export type DCEStatus =
  | 'draft'              // Brouillon
  | 'review'             // En relecture
  | 'ready'              // Prêt à envoyer
  | 'sent'               // Envoyé aux entreprises
  | 'closed'             // Consultation terminée
  | 'archived';          // Archivé

// =============================================================================
// RÈGLEMENT DE CONSULTATION (RC)
// =============================================================================

export interface ReglementConsultation {
  // Section 1: Identification du projet
  identification: RCIdentification;

  // Section 2: Modalités de candidature
  modalitesCandidature: ModalitesCandidature;

  // Section 3: Remise des offres
  remiseOffres: RemiseOffres;

  // Section 4: Critères de sélection
  criteresSelection: CriteresSelection;

  // Section 5: Pièces à fournir
  piecesAFournir: PiecesAFournir;

  // Section 6: Modalités d'analyse
  modalitesAnalyse: ModalitesAnalyse;

  // Section 7: Attribution et notification
  attributionNotification: AttributionNotification;
}

// Section 1: Identification
export interface RCIdentification {
  // Maître d'ouvrage
  maitreOuvrage: {
    nom: string;
    adresse: Address;
    contact: {
      nom?: string;
      email: string;
      telephone?: string;
    };
    siret?: string;
    type: 'particulier' | 'entreprise' | 'collectivite';
  };

  // Nature des travaux
  natureObjet: string;
  description: string;

  // Localisation
  adresseChantier: Address;

  // Budget (facultatif B2C, obligatoire B2G)
  budgetPrevisionnel?: {
    montantMin?: number;
    montantMax?: number;
    afficher: boolean; // Afficher dans le RC
  };

  // Références
  referenceMarche?: string;
}

// Section 2: Modalités de candidature
export interface ModalitesCandidature {
  // Allotissement
  allotissement: {
    type: 'mono_lot' | 'multi_lots';
    lots?: AllotissementLot[];
    groupementAutorise: boolean;
    coTraitanceAutorisee: boolean;
  };

  // Conditions de participation
  conditionsParticipation: {
    qualificationsExigees: QualificationExigee[];
    assurancesObligatoires: AssuranceObligatoire[];
    referencesExigees: {
      nombreMinimum: number;
      montantMinimum?: number;
      ancienneteMaximum: number; // années
      typeSimilaire: boolean;
    };
    capaciteFinanciere?: {
      caMinimum?: number;
      effectifMinimum?: number;
    };
  };
}

export interface AllotissementLot {
  numero: number;
  designation: string;
  description?: string;
  budgetEstimatif?: EstimationRange;
}

export interface QualificationExigee {
  type: 'qualibat' | 'rge' | 'qualifelec' | 'qualipac' | 'qualisol' | 'qualipv' | 'autre';
  designation: string;
  niveau?: string;
  obligatoire: boolean;
}

export interface AssuranceObligatoire {
  type: 'rc_decennale' | 'rc_professionnelle' | 'biennale' | 'parfait_achevement';
  montantMinimum?: number;
  validiteMinimum: string; // Date ISO ou description
}

// Section 3: Remise des offres
export interface RemiseOffres {
  // Format
  format: {
    numerique: boolean;
    papier: boolean;
    formatFichiers?: string[]; // PDF, XLSX, etc.
    decoupage: ('administratif' | 'technique' | 'financier')[];
    signatureElectronique: boolean; // Obligatoire B2G
  };

  // Délais
  delais: {
    dateLimiteReception: string;
    heureLimit: string;
    dureeValiditeOffre: number; // jours
    delaiStandstill?: number; // B2G: 11j min
  };

  // Visite de site
  visiteSite: {
    obligatoire: boolean;
    facultative: boolean;
    dates?: string[];
    attestationRequise: boolean;
    contact?: string;
  };

  // Interdictions
  interdictions?: {
    contactEntreprises: boolean; // B2G
    modificationApresDepot: boolean;
  };

  // Adresse de remise
  adresseRemise?: {
    physique?: Address;
    electronique?: string; // URL plateforme
  };
}

// Section 4: Critères de sélection
export interface CriteresSelection {
  // Type de pondération selon mode utilisateur
  mode: 'b2c' | 'b2b' | 'b2g';

  // Critères avec pondération
  criteres: CritereSelection[];

  // Formule de notation prix
  formulePrix?: string;

  // Seuil minimum technique
  seuilMinimumTechnique?: number;
}

export interface CritereSelection {
  id: string;
  nom: string;
  description: string;
  poids: number; // % - total = 100
  sousCriteres?: SousCritere[];
  bareme?: string; // Description du barème
}

export interface SousCritere {
  id: string;
  nom: string;
  poids: number; // % du critère parent
  bareme?: string;
}

// Pondérations par défaut selon mode
export const PONDERATIONS_DEFAUT: Record<'b2c' | 'b2b' | 'b2g', CritereSelection[]> = {
  b2c: [
    { id: 'prix', nom: 'Prix', description: 'Montant global de l\'offre', poids: 40 },
    { id: 'references', nom: 'Références / expérience', description: 'Qualité des références similaires', poids: 25 },
    { id: 'methodologie', nom: 'Méthodologie / organisation', description: 'Organisation proposée pour le chantier', poids: 20 },
    { id: 'delai', nom: 'Délai', description: 'Durée d\'exécution proposée', poids: 15 },
  ],
  b2b: [
    { id: 'valeur_technique', nom: 'Valeur technique', description: 'Qualité technique de l\'offre', poids: 35 },
    { id: 'prix', nom: 'Prix', description: 'Montant global de l\'offre', poids: 30 },
    { id: 'methodologie', nom: 'Méthodologie / planning', description: 'Organisation et planning proposés', poids: 20 },
    { id: 'moyens', nom: 'Moyens / équipe', description: 'Ressources humaines et matérielles', poids: 15 },
  ],
  b2g: [
    { id: 'valeur_technique', nom: 'Valeur technique', description: 'Qualité technique de l\'offre', poids: 40 },
    { id: 'prix', nom: 'Prix', description: 'Montant global de l\'offre', poids: 35 },
    { id: 'environnement', nom: 'Performance environnementale', description: 'Démarche environnementale', poids: 15 },
    { id: 'delai', nom: 'Délai / organisation', description: 'Durée et organisation', poids: 10 },
  ],
};

// Section 5: Pièces à fournir
export interface PiecesAFournir {
  administratives: PieceAdministrative[];
  techniques: PieceTechnique[];
  financieres: PieceFinanciere[];
}

export interface PieceAdministrative {
  id: string;
  designation: string;
  reference?: string; // DC1, DC2, etc.
  description: string;
  obligatoire: boolean;
  validite?: string; // Ex: "moins de 3 mois"
  modele?: string; // URL vers modèle
}

export interface PieceTechnique {
  id: string;
  designation: string;
  description: string;
  obligatoire: boolean;
  format?: string[];
  contenuAttendu?: string[];
}

export interface PieceFinanciere {
  id: string;
  designation: string;
  description: string;
  obligatoire: boolean;
  modele?: string;
}

// Pièces administratives standard
export const PIECES_ADMINISTRATIVES_STANDARD: PieceAdministrative[] = [
  { id: 'dc1', designation: 'DC1 - Lettre de candidature', reference: 'DC1', description: 'Lettre de candidature et habilitation du mandataire', obligatoire: true },
  { id: 'dc2', designation: 'DC2 - Déclaration du candidat', reference: 'DC2', description: 'Déclaration du candidat individuel ou membre du groupement', obligatoire: true },
  { id: 'kbis', designation: 'Extrait Kbis', description: 'Extrait Kbis de moins de 3 mois', obligatoire: true, validite: 'moins de 3 mois' },
  { id: 'assurance_decennale', designation: 'Attestation RC décennale', description: 'Attestation d\'assurance responsabilité civile décennale en cours de validité', obligatoire: true, validite: 'moins de 1 an' },
  { id: 'urssaf', designation: 'Attestation Urssaf', description: 'Attestation de vigilance Urssaf de moins de 6 mois', obligatoire: true, validite: 'moins de 6 mois' },
  { id: 'fiscal', designation: 'Attestation fiscale', description: 'Attestation de régularité fiscale de moins de 6 mois', obligatoire: true, validite: 'moins de 6 mois' },
  { id: 'qualifications', designation: 'Qualifications', description: 'Certificats de qualification (Qualibat, RGE, etc.)', obligatoire: false },
];

// Pièces techniques standard
export const PIECES_TECHNIQUES_STANDARD: PieceTechnique[] = [
  { id: 'memoire', designation: 'Mémoire technique', description: 'Mémoire technique selon cadre imposé', obligatoire: true, format: ['PDF', 'DOCX'] },
  { id: 'planning', designation: 'Planning prévisionnel', description: 'Planning d\'exécution détaillé', obligatoire: true },
  { id: 'moyens_humains', designation: 'Moyens humains', description: 'Liste du personnel affecté au chantier', obligatoire: true },
  { id: 'sous_traitance', designation: 'Sous-traitance envisagée', description: 'Liste des sous-traitants éventuels', obligatoire: false },
  { id: 'references', designation: 'Références projets', description: '3 à 5 références de projets similaires', obligatoire: true, contenuAttendu: ['Client', 'Nature travaux', 'Montant', 'Délai', 'Date'] },
];

// Pièces financières standard
export const PIECES_FINANCIERES_STANDARD: PieceFinanciere[] = [
  { id: 'ae', designation: 'Acte d\'engagement (AE)', description: 'Acte d\'engagement signé', obligatoire: true },
  { id: 'dpgf', designation: 'DPGF rempli', description: 'Décomposition du Prix Global Forfaitaire', obligatoire: true },
  { id: 'dqe', designation: 'DQE / BPU complétés', description: 'Détail Quantitatif Estimatif ou Bordereau Prix Unitaires', obligatoire: false },
  { id: 'sous_detail', designation: 'Détail prix', description: 'Sous-détail de prix par poste', obligatoire: false },
  { id: 'variantes', designation: 'Options / variantes', description: 'Propositions alternatives si autorisées', obligatoire: false },
];

// Section 6: Modalités d'analyse
export interface ModalitesAnalyse {
  // Commission
  commission?: {
    ouverturePlis: boolean; // B2G
    membres?: string[];
  };

  // Analyse
  etapesAnalyse: EtapeAnalyse[];

  // Auditions
  auditions?: {
    prevues: boolean;
    criteres: string[];
    duree?: number; // minutes
  };

  // Négociations
  negociations?: {
    autorisees: boolean;
    modalites?: string;
  };
}

export interface EtapeAnalyse {
  ordre: number;
  designation: string;
  description: string;
  eliminatoire: boolean;
}

// Section 7: Attribution et notification
export interface AttributionNotification {
  // Délais
  delais: {
    attribution: number; // jours après clôture
    standstill?: number; // B2G: 11j min
    notification: number; // jours après attribution
  };

  // Information candidats
  informationCandidats: {
    evincesInformes: boolean;
    motifsRefusCommuniques: boolean;
    delaiRecours?: number; // jours
  };

  // Signature
  signature: {
    marche: boolean;
    ordreService: boolean;
    delaiDemarrage?: number; // jours après OS
  };
}

// =============================================================================
// ACTE D'ENGAGEMENT (AE)
// =============================================================================

export interface ActeEngagement {
  // En-tête
  reference: string;
  date: string;

  // Article 1: Objet
  objet: {
    description: string;
    adresseChantier: Address;
    lots?: AllotissementLot[];
  };

  // Article 2: Prix
  prix: {
    type: 'forfaitaire' | 'unitaire' | 'mixte';
    montantHT?: number;
    tauxTVA: number;
    montantTTC?: number;
    revisionPrix: boolean;
    indiceRevision?: string;
  };

  // Article 3: Délai
  delai: {
    duree: number;
    unite: 'jours_calendaires' | 'jours_ouvres' | 'semaines' | 'mois';
    dateDebutType: 'ordre_service' | 'notification' | 'date_fixe';
    dateDebut?: string;
  };

  // Article 4: Modalités de règlement
  reglement: {
    acomptes: boolean;
    baseAcomptes?: string;
    delaiPaiement: number; // jours
    retenueGarantie: {
      taux: number;
      caution: boolean;
    };
  };

  // Article 5: Pénalités
  penalites: {
    retard: {
      montantJour: number | string; // €/jour ou formule
      plafond?: number; // %
    };
    absenceReunion?: number;
    nonConformite?: number;
  };

  // Article 6: Engagement
  engagement: string;

  // Signatures
  signatures: {
    entreprise: {
      fait_a?: string;
      le?: string;
      nom?: string;
      qualite?: string;
      cachet: boolean;
    };
    maitreOuvrage: {
      fait_a?: string;
      le?: string;
      nom?: string;
      qualite?: string;
    };
  };

  // Annexes référencées
  annexes: string[];
}

// =============================================================================
// DÉCOMPOSITION DES PRIX (DPGF / DQE / BPU)
// =============================================================================

export type TypeDecompositionPrix = 'dpgf' | 'dqe' | 'bpu';

export interface DecompositionPrix {
  type: TypeDecompositionPrix;

  // En-tête
  reference: string;
  date: string;
  projectReference: string;

  // Structure selon le type
  lots: DecompositionLot[];

  // Totaux
  totaux: {
    totalHT: number;
    tauxTVA: number;
    montantTVA: number;
    totalTTC: number;
  };

  // Métadonnées
  metadata: {
    source: 'estimation' | 'manuel' | 'import';
    confidenceLevel: number;
    lastUpdated: string;
  };
}

export interface DecompositionLot {
  numero: string;
  designation: string;
  postes: DecompositionPoste[];
  sousTotalHT: number;
}

export interface DecompositionPoste {
  reference: string;
  designation: string;
  unite: string;
  quantite: number;
  prixUnitaireHT?: number; // À remplir par l'entreprise pour DPGF/DQE
  totalHT?: number;
  observation?: string;
}

// =============================================================================
// CADRE DE MÉMOIRE TECHNIQUE
// =============================================================================

export interface CadreMemoireTechnique {
  // Structure imposée pour comparabilité
  sections: SectionMemoireTechnique[];

  // Instructions générales
  instructions: string;

  // Nombre de pages max recommandé
  pagesMaxRecommandees: number;

  // Format
  format: {
    police: string;
    taillePolice: number;
    marges: string;
  };
}

export interface SectionMemoireTechnique {
  numero: number;
  titre: string;
  description: string;
  points: number; // Points attribués à cette section
  contenuAttendu: string[];
  pagesSuggerees: number;
  obligatoire: boolean;
}

// Structure standard du mémoire technique
export const STRUCTURE_MEMOIRE_TECHNIQUE: SectionMemoireTechnique[] = [
  {
    numero: 1,
    titre: 'Présentation de l\'entreprise',
    description: 'Présentation générale de l\'entreprise',
    points: 10,
    contenuAttendu: [
      'Historique, effectifs, CA',
      'Domaines d\'expertise',
      'Certifications, labels',
      'Implantations géographiques',
      'Sous-traitance habituelle',
    ],
    pagesSuggerees: 2,
    obligatoire: true,
  },
  {
    numero: 2,
    titre: 'Compréhension du projet',
    description: 'Analyse et compréhension du besoin client',
    points: 15,
    contenuAttendu: [
      'Reformulation du besoin',
      'Contraintes identifiées',
      'Enjeux techniques majeurs',
      'Propositions d\'optimisation',
    ],
    pagesSuggerees: 2,
    obligatoire: true,
  },
  {
    numero: 3,
    titre: 'Moyens humains',
    description: 'Équipe dédiée au chantier',
    points: 20,
    contenuAttendu: [
      'Effectif dédié au chantier',
      'Organigramme chantier',
      'CV chef de chantier et conducteur travaux',
      'Compagnons par corps d\'état',
      'Disponibilité / simultanéité autres chantiers',
    ],
    pagesSuggerees: 3,
    obligatoire: true,
  },
  {
    numero: 4,
    titre: 'Moyens matériels',
    description: 'Engins et équipements',
    points: 10,
    contenuAttendu: [
      'Engins nécessaires (propriété / location)',
      'Outillage spécifique',
      'Installations de chantier (base vie, stockage)',
    ],
    pagesSuggerees: 1,
    obligatoire: true,
  },
  {
    numero: 5,
    titre: 'Méthodologie d\'exécution',
    description: 'Organisation et méthodes de travail',
    points: 25,
    contenuAttendu: [
      'Phasage détaillé des travaux',
      'Mode opératoire par lot',
      'Interfaces entre corps d\'état',
      'Gestion des contraintes (site occupé, accès restreint, nuisances)',
      'Dispositifs de protection',
    ],
    pagesSuggerees: 4,
    obligatoire: true,
  },
  {
    numero: 6,
    titre: 'Planning d\'exécution',
    description: 'Planning détaillé',
    points: 10,
    contenuAttendu: [
      'Diagramme de Gantt détaillé',
      'Jalons importants',
      'Chemin critique',
      'Coordination / réunions de chantier',
    ],
    pagesSuggerees: 2,
    obligatoire: true,
  },
  {
    numero: 7,
    titre: 'Qualité / Sécurité / Environnement',
    description: 'Démarche QSE',
    points: 10,
    contenuAttendu: [
      'Procédures contrôle qualité',
      'Plan sécurité (PPSPS)',
      'Gestion déchets (tri, recyclage, évacuation)',
      'Performance environnementale',
    ],
    pagesSuggerees: 2,
    obligatoire: true,
  },
  {
    numero: 8,
    titre: 'Références similaires',
    description: 'Projets de référence (hors notation)',
    points: 0, // Obligatoire mais non noté
    contenuAttendu: [
      'Minimum 3 chantiers de typologie similaire',
      'Pour chaque: client, nature travaux, montant HT, délai, date achèvement',
      'Photos avant/après si disponibles',
      'Coordonnées contact pour vérification',
    ],
    pagesSuggerees: 3,
    obligatoire: true,
  },
];

// =============================================================================
// ANNEXES DCE
// =============================================================================

export interface DCEAnnexe {
  id: string;
  code: string;
  titre: string;
  type: TypeAnnexeDCE;
  description: string;
  fichierUrl?: string;
  taille?: number;
  format: string;
  obligatoire: boolean;
}

export type TypeAnnexeDCE =
  | 'cctp'               // Cahier des Clauses Techniques Particulières
  | 'ccap'               // Cahier des Clauses Administratives Particulières
  | 'plans'              // Plans
  | 'diagnostics'        // Rapports de diagnostics
  | 'photos'             // Photos de l'existant
  | 'autorisations'      // Autorisations administratives
  | 'modele_offre'       // Modèles de documents à remplir
  | 'autre';

// =============================================================================
// GÉNÉRATION DCE
// =============================================================================

export interface DCEGenerationInfo {
  generatedAt: string;
  generatedBy: 'auto' | 'manual' | 'hybrid';
  projectId: string;

  // Statistiques
  completeness: number;
  piecesGenerees: string[];
  piecesManuelles: string[];

  // Validation
  validationStatus: 'pending' | 'validated' | 'errors';
  validationErrors?: ValidationError[];

  // Export
  exportFormats: ('pdf' | 'docx' | 'xlsx')[];
}

export interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

// =============================================================================
// CONFIGURATION GÉNÉRATION
// =============================================================================

export interface DCEGenerationConfig {
  // Mode utilisateur
  userMode: WizardMode;

  // Options de génération
  includeRC: boolean;
  includeAE: boolean;
  includeDPGF: boolean;
  includeCadreMT: boolean;

  // Type de décomposition prix
  typeDecomposition: TypeDecompositionPrix;

  // Personnalisation
  logoUrl?: string;
  couleurPrincipale?: string;

  // Format de sortie
  outputFormats: ('pdf' | 'docx' | 'xlsx')[];
}
