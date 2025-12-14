/**
 * Types Phase 3 - Gestion Administrative Continue
 * Situations de travaux, facturation, budget, DOE, litiges
 */

// ============================================
// SITUATIONS DE TRAVAUX (ACOMPTES)
// ============================================

export type StatutSituation =
  | 'brouillon'
  | 'soumise'
  | 'en_verification'
  | 'validee_moe'
  | 'validee_mo'
  | 'facturee'
  | 'payee'
  | 'contestee';

export interface SituationTravaux {
  id: string;
  chantierId: string;
  entrepriseId: string;

  // Numérotation
  numero: number;
  reference?: string;

  // Période
  periodeDebut: string;
  periodeFin: string;

  // Montants par lot
  lignes: LigneSituation[];

  // Totaux
  montantPeriodeHT: number;
  cumulAnterieurHT: number;
  cumulSituationHT: number;

  // Retenue de garantie
  retenueGarantiePourcent: number;
  retenueGarantieHT: number;

  // Acomptes
  acomptesAnterieurs: number;

  // Montant à payer
  netAPayerHT: number;
  tauxTVA: number;
  montantTVA: number;
  netAPayerTTC: number;

  // Workflow
  statut: StatutSituation;

  // Établissement par entreprise
  etabliePar?: string;
  dateEtablissement?: string;

  // Vérification MOE
  verificationMOE?: VerificationSituation;

  // Validation MO
  validationMO?: ValidationSituation;

  // Pièces jointes
  documents: DocumentSituation[];

  // Facture
  facture?: FactureSituation;

  // Paiement
  paiement?: PaiementSituation;

  createdAt: string;
  updatedAt: string;
}

export interface LigneSituation {
  id: string;

  // Lot/Poste
  lotId?: string;
  lotNom: string;
  poste?: string;

  // Marché
  montantMarcheHT: number;

  // Avancement
  avancementPrecedent: number; // %
  avancementActuel: number;    // %
  avancementPeriode: number;   // %

  // Montants
  montantPrecedentHT: number;
  montantActuelHT: number;
  montantPeriodeHT: number;

  // Travaux supplémentaires
  avenantId?: string;
  estTravauxSup: boolean;
}

export interface VerificationSituation {
  date: string;
  par: string;

  // Visite chantier
  visiteChantier: boolean;
  dateVisite?: string;

  // Cohérence
  avancementCoherent: boolean;
  observations?: string;

  // Décision
  decision: 'valide' | 'reserve' | 'refuse';
  motifRefus?: string;

  // Modifications demandées
  modifications?: {
    lotId: string;
    avancementPropose: number;
    avancementCorrige: number;
    motif: string;
  }[];
}

export interface ValidationSituation {
  date: string;
  par: string;
  decision: 'valide' | 'refuse';
  commentaire?: string;
}

export interface DocumentSituation {
  id: string;
  type: 'situation' | 'facture' | 'attestation_fiscale' | 'attestation_urssaf' | 'attestation_assurance' | 'autre';
  nom: string;
  url: string;
  dateEmission?: string;
  dateExpiration?: string;
}

export interface FactureSituation {
  numero: string;
  date: string;
  montantHT: number;
  montantTVA: number;
  montantTTC: number;
  documentUrl?: string;
}

export interface PaiementSituation {
  date: string;
  montant: number;
  modeReglement: 'virement' | 'cheque' | 'autre';
  reference?: string;
  justificatifUrl?: string;
}

// ============================================
// SUIVI BUDGÉTAIRE
// ============================================

export interface SuiviBudgetaire {
  id: string;
  chantierId: string;

  // Date du suivi
  dateSuivi: string;

  // Par lot
  lots: SuiviBudgetLot[];

  // Totaux
  totalMarcheHT: number;
  totalAvenantsHT: number;
  totalActualiseHT: number;
  totalSituationsPaveesHT: number;
  totalResteAPayerHT: number;

  // Indicateurs
  pourcentageAvancement: number;
  pourcentageConsomme: number;
  depassementGlobalHT: number;
  depassementPourcent: number;

  // Cash-flow
  cashFlow: CashFlowItem[];

  // Alertes
  alertes: AlerteBudget[];

  createdAt: string;
}

export interface SuiviBudgetLot {
  lotId: string;
  lotNom: string;
  entreprise: string;

  // Marché initial
  montantMarcheHT: number;

  // Avenants
  avenants: AvenantBudget[];
  totalAvenantsHT: number;

  // Total actualisé
  montantActualiseHT: number;

  // Situations
  situationsPayeesHT: number;
  pourcentagePaye: number;

  // Reste
  resteAPayerHT: number;

  // Dépassement
  depassementHT: number;
  depassementPourcent: number;

  // Statut
  statut: 'normal' | 'attention' | 'alerte' | 'critique';
}

export interface AvenantBudget {
  id: string;
  numero: number;
  objet: string;
  montantHT: number;
  dateValidation?: string;
  statut: 'en_attente' | 'valide' | 'refuse';
}

export interface CashFlowItem {
  date: string;
  type: 'decaissement' | 'encaissement';
  montant: number;
  description: string;
  cumul: number;
}

export interface AlerteBudget {
  type: 'depassement_lot' | 'depassement_global' | 'retard_paiement' | 'avenants_excessifs' | 'tresorerie';
  niveau: 'info' | 'warning' | 'error';
  message: string;
  valeur?: number;
  seuil?: number;
}

// ============================================
// GESTION DES AVENANTS
// ============================================

export type TypeAvenant =
  | 'travaux_supplementaires'
  | 'travaux_modificatifs'
  | 'moins_value'
  | 'prolongation_delai'
  | 'revision_prix'
  | 'autre';

export type StatutAvenant =
  | 'brouillon'
  | 'soumis'
  | 'en_negociation'
  | 'accepte'
  | 'refuse'
  | 'signe';

export interface Avenant {
  id: string;
  chantierId: string;
  marcheId?: string;

  // Numérotation
  numero: number;
  reference?: string;

  // Type
  type: TypeAvenant;
  objet: string;
  description?: string;

  // Impact financier
  montantInitialHT: number;
  montantAvenantHT: number;
  montantFinalHT: number;
  impactPourcent: number;

  // Impact délai
  impactDelaiJours: number;
  nouvelleDateFin?: string;

  // Justification
  justification: string;
  origineDemande: 'mo' | 'moe' | 'entreprise' | 'externe';

  // Devis
  devisEntrepriseHT?: number;
  devisEntrepriseUrl?: string;

  // Négociation
  negociations?: NegociationAvenant[];

  // Statut
  statut: StatutAvenant;

  // Validation
  validationMOE?: {
    date: string;
    par: string;
    avis: 'favorable' | 'reserve' | 'defavorable';
    commentaire?: string;
  };
  validationMO?: {
    date: string;
    par: string;
    decision: 'accepte' | 'refuse';
    commentaire?: string;
  };

  // Signature
  signature?: {
    dateMO: string;
    dateEntreprise: string;
    documentUrl?: string;
  };

  createdAt: string;
  updatedAt: string;
}

export interface NegociationAvenant {
  date: string;
  par: string;
  role: 'mo' | 'moe' | 'entreprise';
  montantProposeHT: number;
  commentaire?: string;
}

// ============================================
// DOE - DOSSIER OUVRAGES EXÉCUTÉS
// ============================================

export type TypeDocumentDOE =
  | 'plan_as_built'
  | 'notice_equipement'
  | 'fiche_technique'
  | 'pv_essai'
  | 'attestation'
  | 'certificat'
  | 'garantie'
  | 'autre';

export type StatutDocumentDOE =
  | 'a_fournir'
  | 'fourni'
  | 'en_verification'
  | 'conforme'
  | 'non_conforme'
  | 'valide';

export interface DossierOuvragesExecutes {
  id: string;
  chantierId: string;

  // Documents par lot
  lots: DOELot[];

  // Statistiques
  totalDocuments: number;
  documentsFournis: number;
  documentsValides: number;
  pourcentageComplet: number;

  // Statut global
  complet: boolean;
  dateCompletude?: string;

  // Validation finale
  validePar?: string;
  dateValidation?: string;

  createdAt: string;
  updatedAt: string;
}

export interface DOELot {
  lotId: string;
  lotNom: string;
  entreprise: string;

  // Documents attendus
  documentsAttendus: DocumentDOEAttendu[];

  // Documents fournis
  documentsFournis: DocumentDOE[];

  // Statistiques lot
  totalAttendus: number;
  totalFournis: number;
  totalValides: number;
  pourcentageComplet: number;
}

export interface DocumentDOEAttendu {
  id: string;
  type: TypeDocumentDOE;
  libelle: string;
  obligatoire: boolean;
  description?: string;
}

export interface DocumentDOE {
  id: string;
  type: TypeDocumentDOE;
  nom: string;
  description?: string;

  // Fichier
  url: string;
  formatFichier?: string;
  tailleMo?: number;

  // Dates
  dateFourniture: string;
  dateDocument?: string;

  // Fournisseur
  fourniPar: string;
  entreprise?: string;

  // Vérification
  statut: StatutDocumentDOE;
  verifiePar?: string;
  dateVerification?: string;
  commentaireVerification?: string;

  createdAt: string;
}

// ============================================
// GESTION DES LITIGES
// ============================================

export type TypeLitige =
  | 'retard_execution'
  | 'qualite_insuffisante'
  | 'non_respect_securite'
  | 'communication'
  | 'facturation'
  | 'abandon_chantier'
  | 'degradation'
  | 'autre';

export type NiveauEscalade =
  | 'niveau1_discussion'     // Discussion chef chantier
  | 'niveau2_reunion'        // Réunion formelle
  | 'niveau3_mise_demeure'   // LRAR
  | 'niveau4_suspension'     // Suspension chantier
  | 'niveau5_resiliation'    // Résiliation marché
  | 'mediation'              // Médiateur
  | 'contentieux';           // Tribunal

export type StatutLitige =
  | 'signale'
  | 'en_analyse'
  | 'escalade'
  | 'en_resolution'
  | 'resolu'
  | 'contentieux'
  | 'clos';

export interface Litige {
  id: string;
  chantierId: string;

  // Identification
  reference?: string;
  type: TypeLitige;
  objet: string;
  description: string;

  // Parties
  parties: PartieLitige[];

  // Gravité
  gravite: 'mineur' | 'modere' | 'grave' | 'critique';
  impactFinancierEstime?: number;
  impactDelaiEstime?: number;

  // Détection
  dateSignalement: string;
  signalePar: string;

  // Preuves
  preuves: PreuveLitige[];

  // Escalade
  niveauActuel: NiveauEscalade;
  historiqueEscalade: EtapeEscalade[];

  // Statut
  statut: StatutLitige;

  // Résolution
  resolution?: ResolutionLitige;

  // Documents
  documents: DocumentLitige[];

  createdAt: string;
  updatedAt: string;
}

export interface PartieLitige {
  type: 'mo' | 'moe' | 'entreprise' | 'tiers';
  nom: string;
  role: 'demandeur' | 'defandeur' | 'tiers';
  contact?: {
    nom: string;
    email?: string;
    telephone?: string;
  };
}

export interface PreuveLitige {
  id: string;
  type: 'photo' | 'email' | 'courrier' | 'compte_rendu' | 'facture' | 'contrat' | 'autre';
  description: string;
  date: string;
  url?: string;
}

export interface EtapeEscalade {
  niveau: NiveauEscalade;
  dateDebut: string;
  dateFin?: string;

  // Actions
  actions: ActionEscalade[];

  // Résultat
  resultat?: 'succes' | 'echec' | 'en_cours';
  commentaire?: string;
}

export interface ActionEscalade {
  id: string;
  type: 'discussion' | 'reunion' | 'courrier' | 'mise_demeure' | 'suspension' | 'autre';
  date: string;
  description: string;

  // Participants
  participants?: string[];

  // Document
  documentUrl?: string;

  // Suite
  suiteADonner?: string;
  delai?: string;
}

export interface ResolutionLitige {
  type: 'amiable' | 'mediation' | 'transaction' | 'jugement';
  date: string;
  description: string;

  // Accord
  accordFinancier?: number;
  accordDelai?: number;
  autresMesures?: string[];

  // Document
  documentUrl?: string;

  // Parties signataires
  signataires?: string[];
}

export interface DocumentLitige {
  id: string;
  type: 'courrier' | 'mise_demeure' | 'pv_reunion' | 'accord' | 'jugement' | 'autre';
  nom: string;
  date: string;
  url?: string;
}

// ============================================
// TEMPLATES COURRIERS
// ============================================

export type TypeCourrierTemplate =
  | 'relance_paiement'
  | 'mise_demeure'
  | 'suspension_travaux'
  | 'resiliation'
  | 'convocation_reunion'
  | 'demande_documents'
  | 'notification_reserve';

export interface TemplateCourrierLitige {
  type: TypeCourrierTemplate;
  objet: string;
  corps: string;
  variablesRequises: string[];
  conseils?: string[];
}

export const TEMPLATES_COURRIERS_LITIGE: TemplateCourrierLitige[] = [
  {
    type: 'relance_paiement',
    objet: 'Relance paiement situation n°{numero_situation}',
    corps: `Madame, Monsieur,

Par la présente, nous vous rappelons que la situation de travaux n°{numero_situation} d'un montant de {montant_ttc} € TTC, datée du {date_situation}, demeure impayée à ce jour.

Conformément aux termes du contrat, le délai de paiement de {delai_paiement} jours est dépassé de {jours_retard} jours.

Nous vous remercions de bien vouloir procéder au règlement de cette somme dans les meilleurs délais.

À défaut de paiement sous {delai_action} jours, nous serons contraints d'appliquer les pénalités de retard prévues au contrat.

Veuillez agréer, Madame, Monsieur, l'expression de nos salutations distinguées.`,
    variablesRequises: ['numero_situation', 'montant_ttc', 'date_situation', 'delai_paiement', 'jours_retard', 'delai_action'],
    conseils: ['Envoyer par email + LRAR', 'Conserver accusé de réception'],
  },
  {
    type: 'mise_demeure',
    objet: 'Mise en demeure - {objet_litige}',
    corps: `LETTRE RECOMMANDÉE AVEC ACCUSÉ DE RÉCEPTION

Madame, Monsieur,

Par la présente, nous vous mettons en demeure de {action_demandee} dans un délai de {delai_jours} jours à compter de la réception de ce courrier.

Rappel des faits :
{description_faits}

Cette situation constitue un manquement à vos obligations contractuelles, notamment {reference_contrat}.

À défaut d'exécution dans le délai imparti, nous nous réservons le droit :
- De suspendre l'exécution des travaux
- De faire exécuter les travaux par une entreprise tierce à vos frais
- D'engager toute procédure judiciaire utile

Cette mise en demeure vaut point de départ des intérêts moratoires.

Veuillez agréer, Madame, Monsieur, l'expression de nos salutations distinguées.`,
    variablesRequises: ['objet_litige', 'action_demandee', 'delai_jours', 'description_faits', 'reference_contrat'],
    conseils: ['Obligatoirement en LRAR', 'Constitue une preuve juridique', 'Délai raisonnable : 8 à 15 jours'],
  },
  {
    type: 'suspension_travaux',
    objet: 'Notification de suspension des travaux',
    corps: `LETTRE RECOMMANDÉE AVEC ACCUSÉ DE RÉCEPTION

Madame, Monsieur,

Par la présente, nous vous notifions la suspension des travaux du chantier {nom_chantier} à compter du {date_effet}.

Motif de la suspension :
{motif_suspension}

Mesures conservatoires à prendre :
{mesures_conservatoires}

La reprise des travaux sera conditionnée à {conditions_reprise}.

Les frais induits par cette suspension seront à votre charge conformément à l'article {article_contrat} du contrat.

Veuillez agréer, Madame, Monsieur, l'expression de nos salutations distinguées.`,
    variablesRequises: ['nom_chantier', 'date_effet', 'motif_suspension', 'mesures_conservatoires', 'conditions_reprise', 'article_contrat'],
    conseils: ['Mesure grave, à utiliser avec précaution', 'Prévoir les mesures de protection du chantier'],
  },
];

// ============================================
// ALERTES ADMINISTRATIVES
// ============================================

export interface AlerteAdministrative {
  id: string;
  chantierId: string;

  type:
    | 'situation_en_attente'
    | 'paiement_retard'
    | 'document_manquant'
    | 'attestation_expiree'
    | 'depassement_budget'
    | 'avenant_en_attente'
    | 'doe_incomplet'
    | 'litige_escalade';

  niveau: 'info' | 'warning' | 'error' | 'critical';

  // Référence
  entiteType: 'situation' | 'avenant' | 'document' | 'litige' | 'budget' | 'doe';
  entiteId?: string;

  // Message
  titre: string;
  message: string;

  // Montant si applicable
  montant?: number;

  // Dates
  dateCreation: string;
  dateEcheance?: string;

  // Actions
  actionRequise?: string;
  lienAction?: string;

  // Statut
  lu: boolean;
  traite: boolean;

  createdAt: string;
}

// ============================================
// INPUTS CRÉATION
// ============================================

export interface CreateSituationInput {
  chantierId: string;
  entrepriseId: string;
  periodeDebut: string;
  periodeFin: string;
  lignes: Omit<LigneSituation, 'id'>[];
  retenueGarantiePourcent?: number;
  tauxTVA?: number;
}

export interface CreateAvenantInput {
  chantierId: string;
  type: TypeAvenant;
  objet: string;
  description?: string;
  montantAvenantHT: number;
  impactDelaiJours?: number;
  justification: string;
  origineDemande: Avenant['origineDemande'];
  devisEntrepriseHT?: number;
}

export interface CreateLitigeInput {
  chantierId: string;
  type: TypeLitige;
  objet: string;
  description: string;
  parties: PartieLitige[];
  gravite: Litige['gravite'];
  impactFinancierEstime?: number;
  impactDelaiEstime?: number;
}

export interface CreateDocumentDOEInput {
  chantierId: string;
  lotId: string;
  type: TypeDocumentDOE;
  nom: string;
  description?: string;
  url: string;
  dateDocument?: string;
  fourniPar: string;
}

// ============================================
// EXPORT COMPTABILITÉ
// ============================================

export interface ExportComptable {
  chantierId: string;
  dateExport: string;
  periodeDebut: string;
  periodeFin: string;

  // Lignes d'écriture
  ecritures: EcritureComptable[];

  // Format
  format: 'csv' | 'fec' | 'excel';
  fichierUrl?: string;
}

export interface EcritureComptable {
  dateEcriture: string;
  journal: string;
  compte: string;
  libelle: string;
  debit: number;
  credit: number;
  reference?: string;
}
