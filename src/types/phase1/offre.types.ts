/**
 * TORP Phase 1 - Types Offre
 * Module 1.3 : Réception et Analyse des Offres
 *
 * Structure complète pour la gestion, l'analyse et la comparaison
 * des offres reçues des entreprises
 */

import type { Address, EstimationRange } from '../phase0/common.types';
import type { Entreprise, ScoreEntreprise } from './entreprise.types';
import type { AllotissementLot } from './dce.types';

// =============================================================================
// OFFRE PRINCIPALE
// =============================================================================

export interface Offre {
  id: string;
  consultationId: string;
  entrepriseId: string;

  // Informations entreprise (snapshot au moment de l'offre)
  entreprise: Entreprise;

  // Statut
  statut: StatutOffre;
  dateReception: string;
  dateModification?: string;

  // Conformité
  conformite: ConformiteOffre;

  // Contenu de l'offre
  contenu: ContenuOffre;

  // Analyse
  analyse?: AnalyseOffre;

  // Score final
  scoreOffre?: ScoreOffre;

  // Documents joints
  documents: DocumentOffre[];

  // Historique
  historique: HistoriqueOffre[];
}

export type StatutOffre =
  | 'recue'              // Vient d'être reçue
  | 'en_analyse'         // En cours d'analyse
  | 'conforme'           // Analyse terminée, offre conforme
  | 'non_conforme'       // Non conforme (éliminatoire ou pas)
  | 'retenue'            // Offre retenue (short-list)
  | 'selectionnee'       // Offre sélectionnée (attributaire)
  | 'rejetee'            // Offre rejetée
  | 'retiree';           // Retirée par l'entreprise

// =============================================================================
// CONFORMITÉ
// =============================================================================

export interface ConformiteOffre {
  // Conformité administrative
  administrative: {
    estConforme: boolean;
    verifications: VerificationConformite[];
    piecesManquantes: string[];
    piecesNonConformes: string[];
  };

  // Conformité technique
  technique: {
    estConforme: boolean;
    verifications: VerificationConformite[];
    ecarts: EcartTechnique[];
  };

  // Conformité financière
  financiere: {
    estConforme: boolean;
    verifications: VerificationConformite[];
    anomalies: AnomalieFinanciere[];
  };

  // Résultat global
  estConforme: boolean;
  nonConformitesEliminatoires: string[];
  nonConformitesNonEliminatoires: string[];

  // Demande de compléments
  demandeComplements?: {
    envoyee: boolean;
    dateEnvoi?: string;
    elements: string[];
    dateReponse?: string;
    reponseRecue: boolean;
  };
}

export interface VerificationConformite {
  id: string;
  element: string;
  attendu: string;
  constate: string;
  conforme: boolean;
  eliminatoire: boolean;
  commentaire?: string;
}

export interface EcartTechnique {
  id: string;
  element: string;
  description: string;
  typeEcart: 'variante' | 'option' | 'non_conformite' | 'amelioration';
  accepte: boolean;
  impactPrix?: number;
  commentaire?: string;
}

export interface AnomalieFinanciere {
  id: string;
  type: TypeAnomalieFinanciere;
  description: string;
  gravite: 'info' | 'warning' | 'error';
  details?: Record<string, unknown>;
}

export type TypeAnomalieFinanciere =
  | 'erreur_arithmetique'
  | 'prix_aberrant'
  | 'poste_vide'
  | 'total_incorrect'
  | 'tva_incorrecte'
  | 'desequilibre_lots'
  | 'ecart_estimation';

// =============================================================================
// CONTENU DE L'OFFRE
// =============================================================================

export interface ContenuOffre {
  // Proposition financière
  financier: PropositionFinanciere;

  // Mémoire technique
  technique: MemoireTechniqueRecu;

  // Planning
  planning: PlanningPropose;

  // Variantes (si autorisées)
  variantes?: Variante[];

  // Options
  options?: OptionOffre[];
}

export interface PropositionFinanciere {
  // DPGF rempli
  dpgf: DPGFRempli;

  // Prix par lot (si multi-lots)
  prixParLot?: PrixLot[];

  // Totaux
  totalHT: number;
  tauxTVA: number;
  montantTVA: number;
  totalTTC: number;

  // Conditions
  conditionsPaiement: {
    acompte: number; // %
    echeancier: Echeance[];
    delaiPaiement: number; // jours
  };

  // Validité
  dureeValidite: number; // jours
  dateValiditeFin: string;

  // Révision
  revisionPrix: boolean;
  indiceRevision?: string;
}

export interface DPGFRempli {
  lots: DPGFLotRempli[];
  totalHT: number;
  commentaires?: string;
}

export interface DPGFLotRempli {
  numero: string;
  designation: string;
  postes: DPGFPosteRempli[];
  sousTotalHT: number;
}

export interface DPGFPosteRempli {
  reference: string;
  designation: string;
  unite: string;
  quantite: number;
  prixUnitaireHT: number;
  totalHT: number;
  commentaire?: string;
}

export interface PrixLot {
  lotId: string;
  numero: string;
  designation: string;
  montantHT: number;
  pourcentageTotal: number;
}

export interface Echeance {
  description: string;
  pourcentage: number;
  montant: number;
  condition: string;
}

export interface MemoireTechniqueRecu {
  // Fichier
  fichierUrl: string;
  fichierNom: string;
  taille: number;
  dateUpload: string;

  // Analyse structurelle
  structureRespectee: boolean;
  sectionsPresentes: SectionMTRecue[];
  nombrePages: number;

  // Extraction automatique (si disponible)
  extractionAuto?: {
    equipeProposee?: PersonnelPropose[];
    materielPropose?: string[];
    delaiPropose?: number;
    phasesProposees?: PhaseProposee[];
  };
}

export interface SectionMTRecue {
  numero: number;
  titre: string;
  presente: boolean;
  pagesDebut?: number;
  pagesFin?: number;
  qualiteContenu?: 'excellent' | 'bon' | 'moyen' | 'insuffisant';
}

export interface PersonnelPropose {
  nom: string;
  fonction: string;
  experience?: string;
  disponibilite?: string;
}

export interface PhaseProposee {
  nom: string;
  duree: number;
  jourDebut: number;
  jourFin: number;
  predecesseurs?: string[];
}

export interface PlanningPropose {
  // Fichier
  fichierUrl?: string;

  // Données extraites
  dateDebutProposee: string;
  dateFinProposee: string;
  dureeJours: number;

  // Jalons
  jalons: JalonPropose[];

  // Phases
  phases: PhaseProposee[];

  // Analyse
  coherent: boolean;
  observations?: string[];
}

export interface JalonPropose {
  nom: string;
  date: string;
  jourDepuisDebut: number;
}

export interface Variante {
  id: string;
  designation: string;
  description: string;
  justification: string;

  // Impact
  impactPrix: number; // Différence HT
  impactDelai: number; // Différence jours

  // Analyse
  acceptee: boolean;
  commentaireAnalyse?: string;
}

export interface OptionOffre {
  id: string;
  designation: string;
  description: string;
  prixHT: number;
  incluse: boolean;
}

// =============================================================================
// ANALYSE DE L'OFFRE
// =============================================================================

export interface AnalyseOffre {
  // Date d'analyse
  dateAnalyse: string;
  analysteId?: string;

  // Analyse financière
  financiere: AnalyseFinanciere;

  // Analyse technique
  technique: AnalyseTechnique;

  // Analyse planning
  planning: AnalysePlanning;

  // Synthèse
  synthese: SyntheseAnalyse;
}

export interface AnalyseFinanciere {
  // Comparaison avec estimation TORP
  comparaisonEstimation: {
    estimationTORP: EstimationRange;
    montantOffre: number;
    ecartPourcentage: number;
    position: 'inferieur' | 'dans_fourchette' | 'superieur';
  };

  // Comparaison avec autres offres
  comparaisonOffres?: {
    medianeOffres: number;
    ecartMediane: number;
    rang: number;
    totalOffres: number;
  };

  // Analyse par lot
  analyseParLot: AnalyseLot[];

  // Ratios
  ratios: {
    prixM2?: number;
    ratioFournituresMO?: number; // % fournitures vs main d'œuvre
    tauxHoraireMoyen?: number;
  };

  // Alertes prix
  alertes: AlertePrix[];

  // Note
  noteFinanciere: number; // 0-100
}

export interface AnalyseLot {
  lotId: string;
  designation: string;
  montantOffre: number;
  montantEstimation: EstimationRange;
  ecartPourcentage: number;
  pourcentageTotal: number;
  alerte: boolean;
  commentaire?: string;
}

export interface AlertePrix {
  type: 'trop_bas' | 'trop_haut' | 'desequilibre' | 'erreur';
  element: string;
  description: string;
  severite: 'info' | 'warning' | 'error';
  valeurConstatee: number;
  valeurAttendue?: number;
}

export interface AnalyseTechnique {
  // Notation par section du mémoire technique
  notationSections: NotationSection[];

  // Équipe proposée
  analyseEquipe: {
    noteEquipe: number;
    points: string[];
    alertes: string[];
  };

  // Méthodologie
  analyseMethodologie: {
    noteMethodologie: number;
    points: string[];
    alertes: string[];
  };

  // Moyens
  analyseMoyens: {
    noteMoyens: number;
    points: string[];
    alertes: string[];
  };

  // Références
  analyseReferences: {
    noteReferences: number;
    referencesVerifiees: number;
    referencesValidees: number;
  };

  // Note technique globale
  noteTechnique: number; // 0-100
}

export interface NotationSection {
  sectionId: string;
  titre: string;
  noteObtenue: number;
  noteMax: number;
  poids: number;
  commentaire?: string;
  pointsForts?: string[];
  pointsFaibles?: string[];
}

export interface AnalysePlanning {
  // Cohérence du planning
  coherence: {
    estCoherent: boolean;
    observations: string[];
  };

  // Comparaison avec délai demandé
  comparaisonDelai: {
    delaiDemande: number;
    delaiPropose: number;
    ecartJours: number;
    respect: boolean;
  };

  // Analyse des phases
  analysePhases: {
    nombrePhases: number;
    phasesCritiques: string[];
    marges: number; // jours tampon
  };

  // Note planning
  notePlanning: number; // 0-100
}

export interface SyntheseAnalyse {
  // Points forts
  pointsForts: string[];

  // Points faibles
  pointsFaibles: string[];

  // Points de vigilance
  pointsVigilance: string[];

  // Questions à poser (si audition)
  questionsAPoser?: string[];

  // Recommandation
  recommandation: RecommandationOffre;
  commentaireGlobal: string;
}

export type RecommandationOffre =
  | 'tres_favorable'
  | 'favorable'
  | 'acceptable'
  | 'defavorable'
  | 'tres_defavorable';

// =============================================================================
// SCORE OFFRE
// =============================================================================

export interface ScoreOffre {
  // Score global pondéré
  scoreGlobal: number; // 0-100

  // Scores par critère
  scores: ScoreCritereOffre[];

  // Classement
  classement?: {
    rang: number;
    totalOffres: number;
    ecartPremier?: number;
    ecartDernier?: number;
  };

  // Date de calcul
  dateCalcul: string;
}

export interface ScoreCritereOffre {
  critereId: string;
  critereName: string;
  poids: number; // %
  scoreObtenu: number; // 0-100
  scorePondere: number; // scoreObtenu * poids / 100
  details?: string;
}

// =============================================================================
// DOCUMENTS OFFRE
// =============================================================================

export interface DocumentOffre {
  id: string;
  type: TypeDocumentOffre;
  nom: string;
  fichierUrl: string;
  taille: number;
  format: string;
  dateUpload: string;
  valide: boolean;
  commentaire?: string;
}

export type TypeDocumentOffre =
  | 'acte_engagement'
  | 'dpgf'
  | 'memoire_technique'
  | 'planning'
  | 'kbis'
  | 'assurance_decennale'
  | 'assurance_rc'
  | 'attestation_urssaf'
  | 'attestation_fiscale'
  | 'qualifications'
  | 'references'
  | 'autre';

// =============================================================================
// HISTORIQUE
// =============================================================================

export interface HistoriqueOffre {
  date: string;
  action: ActionHistoriqueOffre;
  utilisateurId?: string;
  details?: Record<string, unknown>;
  commentaire?: string;
}

export type ActionHistoriqueOffre =
  | 'reception'
  | 'ouverture'
  | 'demande_complements'
  | 'reception_complements'
  | 'debut_analyse'
  | 'fin_analyse'
  | 'notation'
  | 'selection'
  | 'rejet'
  | 'notification'
  | 'modification';

// =============================================================================
// TABLEAU COMPARATIF
// =============================================================================

export interface TableauComparatif {
  consultationId: string;
  dateGeneration: string;

  // Offres comparées
  offres: OffreComparee[];

  // Critères
  criteres: CritereComparaison[];

  // Statistiques
  statistiques: StatistiquesComparaison;

  // Recommandation
  recommandation: RecommandationComparatif;
}

export interface OffreComparee {
  offreId: string;
  entreprise: {
    id: string;
    nom: string;
    scoreEntreprise?: number;
  };

  // Données principales
  montantHT: number;
  delaiJours: number;
  noteTechnique: number;

  // Scores
  scoreGlobal: number;
  scores: Record<string, number>; // Par critère

  // Position
  rang: number;
  badges: BadgeOffre[];
}

export interface BadgeOffre {
  type: 'meilleur_prix' | 'meilleur_technique' | 'meilleur_delai' | 'recommande' | 'vigilance';
  label: string;
  couleur: string;
}

export interface CritereComparaison {
  id: string;
  nom: string;
  poids: number;
  type: 'prix' | 'technique' | 'delai' | 'autre';
  formule?: string;
}

export interface StatistiquesComparaison {
  nombreOffres: number;
  prixMoyen: number;
  prixMedian: number;
  prixMin: number;
  prixMax: number;
  delaiMoyen: number;
  noteTechniqueMoyenne: number;
  ecartTypesPrix: number;
}

export interface RecommandationComparatif {
  offreRecommandeeId: string;
  justification: string;
  alternativesViables: string[]; // IDs des offres alternatives
  pointsVigilance: string[];
}

// =============================================================================
// PRISE DE RÉFÉRENCES
// =============================================================================

export interface PriseReference {
  id: string;
  offreId: string;
  entrepriseId: string;
  referenceId: string;

  // Contact
  contact: {
    nom: string;
    telephone: string;
    email?: string;
    dateContact: string;
  };

  // Questionnaire
  reponses: ReponseReference[];

  // Synthèse
  noteGlobale: number; // 0-10
  recommande: boolean;
  commentaireGlobal: string;
}

export interface ReponseReference {
  question: string;
  reponse: string;
  note?: number; // 0-10 si applicable
}

// Questions standard pour la prise de références
export const QUESTIONS_REFERENCE: { question: string; type: 'note' | 'texte' | 'oui_non' }[] = [
  { question: 'Le délai a-t-il été respecté ?', type: 'oui_non' },
  { question: 'Si non, quel a été l\'écart (jours) ?', type: 'texte' },
  { question: 'Le budget a-t-il été respecté ?', type: 'oui_non' },
  { question: 'Si non, quel a été le dépassement (%) ?', type: 'texte' },
  { question: 'Note qualité des travaux (1-10)', type: 'note' },
  { question: 'Note propreté du chantier (1-10)', type: 'note' },
  { question: 'Note gestion des imprévus (1-10)', type: 'note' },
  { question: 'Note communication (1-10)', type: 'note' },
  { question: 'Recommanderiez-vous cette entreprise ?', type: 'oui_non' },
  { question: 'Commentaires complémentaires', type: 'texte' },
];

// =============================================================================
// CONSULTATION
// =============================================================================

export interface Consultation {
  id: string;
  projectId: string;
  dceId: string;

  // Paramètres
  parametres: {
    dateLancement: string;
    dateClotureOffres: string;
    dureeValiditeOffres: number;
  };

  // Entreprises invitées
  entreprisesInvitees: EntrepriseInvitee[];

  // Offres reçues
  offresRecues: Offre[];

  // Statut
  statut: StatutConsultation;

  // Résultat
  resultat?: ResultatConsultation;
}

export interface EntrepriseInvitee {
  entrepriseId: string;
  dateInvitation: string;
  dateOuvertureDCE?: string;
  dateDepotOffre?: string;
  statut: StatutInvitation;
  relances: Relance[];
}

export type StatutInvitation =
  | 'invitee'
  | 'dce_ouvert'
  | 'offre_deposee'
  | 'declinee'
  | 'non_reponse';

export interface Relance {
  date: string;
  type: 'email' | 'telephone';
  resultat: string;
}

export type StatutConsultation =
  | 'preparation'
  | 'envoyee'
  | 'en_cours'
  | 'cloturee'
  | 'analyse'
  | 'attribuee'
  | 'annulee';

export interface ResultatConsultation {
  offreRetenue: string; // ID offre
  entrepriseAttributaire: string; // ID entreprise
  montantMarche: number;
  dateAttribution: string;
  dateNotification?: string;
}
