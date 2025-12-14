/**
 * Types pour Phase 4 : Réception & Garanties
 * OPR, Réception, Réserves, Garanties, DOE/DIUO
 */

// =====================================================
// ENUMS
// =====================================================

export type ReserveGravite = 'mineure' | 'majeure' | 'grave' | 'non_conformite_substantielle';
export type ReserveStatut = 'ouverte' | 'en_cours' | 'levee' | 'contestee' | 'expiree';
export type ReceptionDecision = 'acceptee_sans_reserve' | 'acceptee_avec_reserves' | 'refusee' | 'reportee';
export type GarantieType = 'parfait_achevement' | 'biennale' | 'decennale' | 'vices_caches';
export type DesordreStatut = 'signale' | 'diagnostic' | 'en_reparation' | 'repare' | 'conteste' | 'prescrit';
export type DocumentDOEType = 'plan_execution' | 'notice_technique' | 'fiche_materiau' | 'pv_controle' | 'certificat' | 'garantie' | 'autre';
export type ParticipantRole = 'maitre_ouvrage' | 'maitre_oeuvre' | 'entreprise' | 'bureau_controle' | 'coordonnateur_sps' | 'expert' | 'assureur';

// =====================================================
// OPR - OPÉRATIONS PRÉALABLES À LA RÉCEPTION
// =====================================================

export interface OPRSession {
  id: string;
  chantierId: string;
  dateOPR: string;
  heureDebut: string;
  heureFin?: string;
  lieu: string;
  statut: 'planifiee' | 'en_cours' | 'terminee' | 'annulee';

  // Participants
  participants: OPRParticipant[];

  // Convocation
  convocationEnvoyee: boolean;
  dateConvocation?: string;
  modeConvocation: ('email' | 'lrar' | 'courrier')[];

  // Résultats
  controles: OPRControle[];
  reserves: Reserve[];
  documentsVerifies: DocumentVerification[];

  // Photos
  photosGenerales: string[];

  // Metadata
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface OPRParticipant {
  id: string;
  userId?: string;
  role: ParticipantRole;
  nom: string;
  prenom: string;
  entreprise?: string;
  email: string;
  telephone?: string;
  present: boolean;
  represente?: boolean; // Si représenté par quelqu'un d'autre
  representePar?: string;
  signature?: string; // Base64 signature
  dateSignature?: string;
}

export interface OPRControle {
  id: string;
  lot: string;
  categorie: string;
  point: string;
  description: string;
  obligatoire: boolean;
  statut: 'conforme' | 'non_conforme' | 'reserve' | 'non_applicable' | 'non_verifie';
  commentaire?: string;
  photos?: string[];
  reserveId?: string; // Lien vers réserve si non conforme
}

export interface DocumentVerification {
  id: string;
  type: 'consuel' | 'qualigaz' | 'attestation_rt' | 'test_etancheite' | 'notice' | 'garantie' | 'autre';
  nom: string;
  obligatoire: boolean;
  present: boolean;
  conforme: boolean;
  commentaire?: string;
  fichier?: string;
}

// =====================================================
// RÉSERVES
// =====================================================

export interface Reserve {
  id: string;
  oprId: string;
  chantierId: string;
  numero: number; // Numéro séquentiel dans l'OPR

  // Localisation
  lot: string;
  piece?: string;
  localisation: string;
  coordonneesPhoto?: { x: number; y: number }; // Position sur plan

  // Description
  nature: string;
  description: string;
  gravite: ReserveGravite;

  // Photos
  photos: ReservePhoto[];

  // Statut
  statut: ReserveStatut;

  // Entreprise concernée
  entrepriseId: string;
  entrepriseNom: string;

  // Délais
  delaiLeveeJours: number;
  dateEcheance: string;

  // Levée
  dateLevee?: string;
  leveePar?: string;
  commentaireLevee?: string;
  photosApres?: string[];
  pvLeveeId?: string;

  // Contestation (si entreprise conteste)
  contestee: boolean;
  motifContestation?: string;
  dateContestation?: string;

  // Coût estimé (pour retenue)
  coutEstime?: number;

  // Metadata
  createdAt: string;
  updatedAt: string;
}

export interface ReservePhoto {
  id: string;
  url: string;
  legende?: string;
  dateCapture: string;
  type: 'avant' | 'apres' | 'detail';
}

// =====================================================
// RÉCEPTION
// =====================================================

export interface Reception {
  id: string;
  chantierId: string;
  oprId: string;

  // Date et lieu
  dateReception: string; // Date d'effet juridique
  lieu: string;

  // Décision
  decision: ReceptionDecision;
  motifRefus?: string;
  dateNouvelleOPR?: string; // Si reportée

  // Participants signataires
  signataires: ReceptionSignataire[];

  // Réserves (si acceptée avec réserves)
  reserves: Reserve[];
  nombreReserves: number;
  nombreReservesLevees: number;

  // PV
  pvReceptionUrl?: string;
  pvGenere: boolean;
  pvSigne: boolean;

  // Effets juridiques
  transfertGarde: boolean;
  dateTransfertGarde?: string;
  demarragGaranties: boolean;
  dateDemarageGaranties?: string;

  // Financier
  soldeDu: number;
  retenueGarantie: number;
  montantReservesRetenu: number;

  // Metadata
  createdAt: string;
  updatedAt: string;
}

export interface ReceptionSignataire {
  id: string;
  participantId: string;
  role: ParticipantRole;
  nom: string;
  entreprise?: string;
  signature: string; // Base64
  dateSignature: string;
  mentionManuscrite?: string; // Ex: "Lu et approuvé" ou "Sous réserves"
}

// =====================================================
// LEVÉE DES RÉSERVES
// =====================================================

export interface VisiteLeveeReserves {
  id: string;
  chantierId: string;
  receptionId: string;

  // Date et participants
  dateVisite: string;
  participants: OPRParticipant[];

  // Réserves contrôlées
  reservesControlees: ReserveControle[];

  // Résultat global
  toutesLevees: boolean;
  nouvellesReserves: Reserve[]; // Si travaux correctifs mal faits

  // PV
  pvLeveeUrl?: string;

  // Metadata
  createdAt: string;
  updatedAt: string;
}

export interface ReserveControle {
  reserveId: string;
  reserve: Reserve;
  statut: 'levee' | 'non_levee' | 'partiellement_levee';
  commentaire?: string;
  photos?: string[];
  nouveauDelai?: number; // Jours supplémentaires si non levée
}

// =====================================================
// GARANTIES
// =====================================================

export interface Garantie {
  id: string;
  chantierId: string;
  receptionId: string;

  // Type et durée
  type: GarantieType;
  dureeAnnees: number;

  // Dates
  dateDebut: string; // = date réception
  dateFin: string;

  // Périmètre
  perimetre: string; // Description ce qui est couvert
  exclusions: string[]; // Ce qui n'est pas couvert

  // Entreprise/Assurance
  entrepriseId: string;
  entrepriseNom: string;
  assuranceId?: string;
  assuranceNom?: string;
  numeroPolice?: string;

  // Statut
  active: boolean;
  expiree: boolean;

  // Désordres signalés
  desordres: Desordre[];

  // Metadata
  createdAt: string;
  updatedAt: string;
}

export interface Desordre {
  id: string;
  garantieId: string;
  chantierId: string;

  // Identification
  numero: string; // Référence unique
  dateDecouverte: string;
  dateSignalement: string;

  // Description
  nature: string;
  description: string;
  localisation: string;
  gravite: 'faible' | 'moyenne' | 'grave' | 'critique';

  // Type de garantie applicable
  garantieApplicable: GarantieType;

  // Photos et preuves
  photos: string[];
  documents: string[];

  // Statut
  statut: DesordreStatut;

  // Signalement
  signalementEntreprise?: {
    date: string;
    mode: 'email' | 'lrar' | 'courrier';
    referenceEnvoi?: string;
    accuse?: string;
  };

  // Diagnostic
  diagnosticDate?: string;
  diagnosticResultat?: string;
  responsabiliteAcceptee?: boolean;
  motifContestation?: string;

  // Expert (si nécessaire)
  expertiseRequise: boolean;
  expertId?: string;
  rapportExpertise?: string;

  // Réparation
  reparationPlanifiee?: string;
  reparationRealisee?: string;
  coutReparation?: number;
  reparationConforme?: boolean;

  // Assurance
  declarationAssurance?: {
    date: string;
    numeroSinistre?: string;
    statut: 'en_cours' | 'accepte' | 'refuse' | 'expertise';
    indemnisation?: number;
  };

  // Metadata
  createdAt: string;
  updatedAt: string;
}

// =====================================================
// RETENUE DE GARANTIE
// =====================================================

export interface RetenueGarantie {
  id: string;
  chantierId: string;
  receptionId: string;
  entrepriseId: string;

  // Montant
  montantTotal: number; // Généralement 5% du marché
  pourcentage: number;

  // Dates
  dateConstitution: string; // = date réception
  dateLiberationPrevue: string; // = réception + 1 an
  dateLiberationEffective?: string;

  // Statut
  statut: 'retenue' | 'partiellement_liberee' | 'liberee' | 'consommee';

  // Consommation (si désordres non réparés)
  montantConsomme: number;
  motifsConsommation: {
    date: string;
    montant: number;
    motif: string;
    reserveId?: string;
    desordreId?: string;
  }[];

  // Libération
  montantLibere: number;
  demandesLiberation: {
    date: string;
    montant: number;
    statut: 'demandee' | 'acceptee' | 'refusee';
    motifRefus?: string;
  }[];

  // Metadata
  createdAt: string;
  updatedAt: string;
}

// =====================================================
// DOE - DOSSIER OUVRAGES EXÉCUTÉS
// =====================================================

export interface DOE {
  id: string;
  chantierId: string;

  // Statut
  statut: 'en_constitution' | 'complet' | 'remis' | 'valide';
  dateRemise?: string;
  dateValidation?: string;

  // Documents
  documents: DocumentDOE[];

  // Sections
  plansExecution: DocumentDOE[];
  noticesTechniques: DocumentDOE[];
  fichesMateriaux: DocumentDOE[];
  pvControles: DocumentDOE[];
  certificats: DocumentDOE[];
  garanties: DocumentDOE[];

  // Complétude
  pourcentageComplet: number;
  documentsManquants: string[];

  // Carnet de santé
  carnetSante?: CarnetSante;

  // Metadata
  createdAt: string;
  updatedAt: string;
}

export interface DocumentDOE {
  id: string;
  doeId: string;
  type: DocumentDOEType;
  categorie: string;
  lot?: string;

  // Identification
  nom: string;
  description?: string;
  reference?: string;

  // Fichier
  fichierUrl: string;
  format: string; // pdf, dwg, jpg, etc.
  tailleMo: number;

  // Validité
  obligatoire: boolean;
  valide: boolean;
  dateValidation?: string;
  validePar?: string;

  // Dates
  dateDocument?: string;
  dateExpiration?: string; // Pour certificats/garanties

  // Metadata
  uploadedAt: string;
  uploadedBy: string;
}

export interface CarnetSante {
  id: string;
  chantierId: string;
  doeId: string;

  // Fiche signalétique
  adresse: string;
  surface: number;
  anneeConstruction?: number;
  anneeRenovation?: number;

  // Historique travaux
  travaux: {
    date: string;
    nature: string;
    entreprise: string;
    montant: number;
    lot: string;
  }[];

  // Garanties en cours
  garantiesActives: {
    type: GarantieType;
    dateDebut: string;
    dateFin: string;
    entreprise: string;
    assurance?: string;
  }[];

  // Entretiens
  entretiensProgrammes: EntretienProgramme[];
  entretiensRealises: EntretienRealise[];

  // Contacts utiles
  contacts: {
    role: string;
    nom: string;
    telephone?: string;
    email?: string;
  }[];

  // Recommandations futures
  travauxFutursRecommandes: {
    nature: string;
    priorite: 'haute' | 'moyenne' | 'basse';
    echeance?: string;
    coutEstime?: number;
  }[];

  // Metadata
  createdAt: string;
  updatedAt: string;
}

export interface EntretienProgramme {
  id: string;
  equipement: string;
  nature: string;
  periodicite: string; // "annuel", "semestriel", "3 ans", etc.
  periodiciteMois: number;
  derniereRealisation?: string;
  prochaineEcheance: string;
  prestataire?: string;
  coutEstime?: number;
  obligatoire: boolean;
  rappelEnvoye: boolean;
}

export interface EntretienRealise {
  id: string;
  entretienProgrammeId?: string;
  equipement: string;
  date: string;
  nature: string;
  prestataire: string;
  cout?: number;
  observations?: string;
  factureUrl?: string;
  prochainEntretien?: string;
}

// =====================================================
// DIUO - DOSSIER INTERVENTION ULTÉRIEURE
// =====================================================

export interface DIUO {
  id: string;
  chantierId: string;

  // Statut
  statut: 'en_constitution' | 'complet' | 'remis';
  dateRemise?: string;

  // Descriptif ouvrage
  descriptif: {
    adresse: string;
    maitreOuvrage: string;
    anneeConstruction: number;
    surface: number;
    niveaux: number;
    acces: string;
  };

  // Zones et risques
  zones: ZoneRisque[];

  // Mesures de prévention générales
  mesuresGenerales: string[];

  // EPI recommandés
  epiRecommandes: string[];

  // Documents joints
  documents: string[];
  plans: string[];

  // Metadata
  createdAt: string;
  updatedAt: string;
}

export interface ZoneRisque {
  id: string;
  nom: string;
  localisation: string;

  // Risques identifiés
  risques: {
    nature: string;
    description: string;
    gravite: 'faible' | 'moyenne' | 'elevee' | 'critique';
    permanent: boolean;
  }[];

  // Mesures de prévention spécifiques
  mesures: {
    type: 'epi' | 'epc' | 'procedure' | 'interdiction';
    description: string;
    obligatoire: boolean;
  }[];

  // Consignes
  consignes: string[];

  // Habilitations requises
  habilitations: string[];
}

// =====================================================
// CHECK-LISTS OPR
// =====================================================

export interface CheckListOPR {
  id: string;
  nom: string;
  description: string;
  lots: string[]; // Lots concernés

  // Points de contrôle par catégorie
  categories: {
    nom: string;
    lot: string;
    points: {
      id: string;
      libelle: string;
      description?: string;
      obligatoire: boolean;
      normeReference?: string;
    }[];
  }[];

  // Metadata
  nombrePointsTotal: number;
  createdAt: string;
  updatedAt: string;
}

// =====================================================
// TEMPLATES ET GÉNÉRATION DOCUMENTS
// =====================================================

export interface TemplatePV {
  type: 'pv_reception' | 'pv_levee_reserves' | 'pv_opr';
  contenu: string; // Template HTML/Markdown
  variables: string[]; // Variables à remplacer
}

export interface GenerationPVParams {
  templateType: TemplatePV['type'];
  donnees: {
    chantier: {
      reference: string;
      adresse: string;
      maitreOuvrage: string;
      entreprises: string[];
    };
    date: string;
    lieu: string;
    participants: OPRParticipant[];
    constatations?: string;
    reserves?: Reserve[];
    decision?: ReceptionDecision;
    signatures: ReceptionSignataire[];
  };
}
