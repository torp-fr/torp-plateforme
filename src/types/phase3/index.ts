/**
 * TORP Phase 3 - Types Index
 * Export centralisé de tous les types Phase 3 : Exécution Chantier
 */

// ============================================
// CONTRÔLES RÉGLEMENTAIRES ET QUALITÉ
// ============================================

export type {
  // Organismes de contrôle
  TypeOrganismeControle,
  MissionControle,
  StatutMissionControle,
  TypeVisiteControle,
  OrganismeControle,
  MissionBureauControle,
  VisiteControle,
  RapportControle,
  ReserveControle,

  // Certifications obligatoires
  TypeCertification,
  StatutCertification,
  CertificationObligatoire,
  NonConformiteCertification,

  // Coordonnateur SPS
  NiveauCoordinationSPS,
  TypeVisiteSPS,
  CoordinateurSPS,
  VisiteSPS,
  ObservationSPS,
  ActionCorrectiveSPS,

  // Auto-contrôles entreprise
  TypeAutoControle,
  ResultatAutoControle,
  FicheAutoControle,
  ItemAutoControle,
  PhotoAutoControle,
  DocumentAutoControle,

  // Contrôles MOE
  TypeControleMOE,
  VisiteMOE,
  PointVerificationMOE,

  // Grilles qualité
  CategorieGrilleQualite,
  GrilleControleQualite,
  CritereQualite,
  ReserveQualite,
  TemplateGrilleQualite,

  // Alertes
  AlerteControle,

  // Inputs
  CreateOrganismeControleInput,
  CreateVisiteControleInput,
  CreateCertificationInput,
  CreateFicheAutoControleInput,
  CreateGrilleQualiteInput,
} from './controle.types';

export {
  TEMPLATE_GRILLE_GROS_OEUVRE,
  TEMPLATE_GRILLE_MENUISERIES,
  TEMPLATE_GRILLE_CARRELAGE,
  TEMPLATE_GRILLE_PEINTURE,
  TEMPLATE_GRILLE_ELECTRICITE,
  TEMPLATE_GRILLE_PLOMBERIE,
  TEMPLATES_GRILLES_QUALITE,
} from './controle.types';

// ============================================
// COORDINATION MULTI-ENTREPRISES
// ============================================

export type {
  // Planning collaboratif
  StatutCreneauPlanning,
  TypeConflitPlanning,
  CreneauIntervention,
  ConflitPlanning,
  SuggestionResolutionConflit,

  // Carnet de liaison
  TypeEntreeCarnet,
  CarnetLiaison,
  EntreeCarnetLiaison,
  SignatureCarnet,

  // Chat multi-entreprises
  TypeConversation,
  Conversation,
  ParticipantChat,
  MessageChat,
  PieceJointeChat,

  // Interfaces techniques
  TypeInterface,
  StatutInterface,
  InterfaceTechnique,

  // Plans de synthèse
  PlanSynthese,
  ReseauSynthese,
  ClashDetection,

  // Conducteur travaux
  ConducteurTravaux,
  TypeMissionOPC,
  MissionOPC,

  // Règles chantier
  ReglesChantier,
  OrdreLot,
  RegleConflit,
  ProtocoleInterface,
  RegleDegradation,

  // Dégradations
  StatutDegradation,
  Degradation,
  PhotoDegradation,

  // Alertes
  AlerteCoordination,

  // Inputs
  CreateCreneauInput,
  CreateEntreeCarnetInput,
  CreateInterfaceInput,
  CreateDegradationInput,
  CreateConversationInput,
} from './coordination.types';

// ============================================
// GESTION ADMINISTRATIVE
// ============================================

export type {
  // Situations de travaux
  StatutSituation,
  SituationTravaux,
  LigneSituation,
  VerificationSituation,
  ValidationSituation,
  DocumentSituation,
  FactureSituation,
  PaiementSituation,

  // Suivi budgétaire
  SuiviBudgetaire,
  SuiviBudgetLot,
  AvenantBudget,
  CashFlowItem,
  AlerteBudget,

  // Avenants
  TypeAvenant,
  StatutAvenant,
  Avenant,
  NegociationAvenant,

  // DOE
  TypeDocumentDOE,
  StatutDocumentDOE,
  DossierOuvragesExecutes,
  DOELot,
  DocumentDOEAttendu,
  DocumentDOE,

  // Litiges
  TypeLitige,
  NiveauEscalade,
  StatutLitige,
  Litige,
  PartieLitige,
  PreuveLitige,
  EtapeEscalade,
  ActionEscalade,
  ResolutionLitige,
  DocumentLitige,

  // Templates courriers
  TypeCourrierTemplate,
  TemplateCourrierLitige,

  // Alertes
  AlerteAdministrative,

  // Inputs
  CreateSituationInput,
  CreateAvenantInput,
  CreateLitigeInput,
  CreateDocumentDOEInput,

  // Export comptabilité
  ExportComptable,
  EcritureComptable,
} from './administratif.types';

export {
  TEMPLATES_COURRIERS_LITIGE,
} from './administratif.types';
