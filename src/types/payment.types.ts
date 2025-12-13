/**
 * Types pour le système de paiements jalonnés
 * Gestion des contrats, jalons, paiements et litiges
 */

// === ÉNUMÉRATIONS ===

export type PaymentStatus =
  | 'pending'           // En attente de validation
  | 'awaiting_payment'  // Validé, en attente de paiement client
  | 'processing'        // Paiement en cours de traitement
  | 'held'              // Bloqué en séquestre
  | 'released'          // Libéré vers l'entreprise
  | 'refunded'          // Remboursé au client
  | 'disputed'          // En litige
  | 'cancelled';        // Annulé

export type PaymentType =
  | 'deposit'           // Acompte à la signature
  | 'milestone'         // Paiement jalon
  | 'final'             // Solde final
  | 'retention'         // Retenue de garantie
  | 'penalty'           // Pénalité de retard
  | 'adjustment';       // Ajustement/avenant

export type MilestoneStatus =
  | 'pending'           // En attente
  | 'in_progress'       // En cours
  | 'submitted'         // Soumis pour validation
  | 'validated'         // Validé par le client
  | 'rejected'          // Rejeté
  | 'completed';        // Complété et payé

export type DisputeStatus =
  | 'opened'            // Ouvert
  | 'under_review'      // En cours d'examen TORP
  | 'mediation'         // En médiation
  | 'resolved_client'   // Résolu en faveur du client
  | 'resolved_enterprise' // Résolu en faveur de l'entreprise
  | 'escalated'         // Escaladé (juridique)
  | 'closed';           // Fermé

export type DisputeReason =
  | 'non_conformity'    // Non-conformité des travaux
  | 'delay'             // Retard
  | 'quality'           // Qualité insuffisante
  | 'incomplete'        // Travaux incomplets
  | 'price_dispute'     // Contestation de prix
  | 'communication'     // Problème de communication
  | 'damage'            // Dommages causés
  | 'abandonment'       // Abandon de chantier
  | 'other';            // Autre

export type FraudRiskLevel = 'low' | 'medium' | 'high' | 'critical';

export type ContractStatus = 'draft' | 'pending_signature' | 'active' | 'completed' | 'terminated' | 'disputed';

// === CONTRATS ===

export interface ProjectContract {
  id: string;

  // Références
  projectId: string;
  propositionId?: string;
  entrepriseId: string;
  clientId: string;

  // Informations contrat
  reference: string;
  titre: string;
  description?: string;

  // Montants
  montantTotalHT: number;
  montantTotalTTC: number;
  tauxTVA: number;

  // Dates
  dateSignature?: Date;
  dateDebutPrevue?: Date;
  dateFinPrevue?: Date;
  dateDebutEffective?: Date;
  dateFinEffective?: Date;

  // Retenue de garantie
  retenueGarantiePct: number;
  retenueGarantieDureeMois: number;

  // Pénalités de retard
  penaliteRetardJour: number;
  penalitePlafondPct: number;

  // Statut
  status: ContractStatus;

  // Documents
  documents: ContractDocument[];

  // Jalons
  milestones?: PaymentMilestone[];

  // Métadonnées
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export interface ContractDocument {
  id: string;
  type: 'contract' | 'annexe' | 'avenant' | 'pv_reception' | 'other';
  nom: string;
  fichier: string;
  dateAjout: Date;
  signatureClient?: string;
  signatureEntreprise?: string;
}

// === JALONS ===

export interface PaymentMilestone {
  id: string;

  // Références
  contractId: string;

  // Identification
  numero: number;
  designation: string;
  description?: string;

  // Montants
  montantHT: number;
  montantTTC: number;
  pourcentageContrat: number;

  // Dates
  datePrevue?: Date;
  dateSoumission?: Date;
  dateValidation?: Date;
  datePaiement?: Date;

  // Conditions
  conditionsDeclenchement: string[];
  livrablesAttendus: string[];

  // Validation
  status: MilestoneStatus;
  validatedBy?: string;
  rejectionReason?: string;

  // Preuves fournies
  preuves: MilestoneProof[];
  compteRendu?: string;

  // Anti-arnaque
  verificationAuto: MilestoneVerification;
  fraudCheckResult?: FraudCheckResult;
  fraudRiskLevel: FraudRiskLevel;

  // Métadonnées
  createdAt: Date;
  updatedAt: Date;
}

export interface MilestoneProof {
  id: string;
  type: 'photo' | 'document' | 'bon_commande' | 'facture' | 'pv' | 'other';
  nom: string;
  fichier: string;
  dateAjout: Date;

  // Métadonnées photo
  metadata?: {
    geolocation?: { lat: number; lng: number };
    dateCapture?: Date;
    device?: string;
  };

  // Validation
  verifie: boolean;
  commentaire?: string;
}

export interface MilestoneVerification {
  // Vérifications automatiques effectuées
  dateVerification?: Date;
  photosAnalysees: boolean;
  coherenceVerifiee: boolean;
  delaiRespected: boolean;

  // Résultats
  alertes: string[];
  score: number;
}

// === PAIEMENTS ===

export interface Payment {
  id: string;

  // Références
  contractId: string;
  milestoneId?: string;

  // Identification
  reference: string;
  paymentType: PaymentType;

  // Montants
  montantHT: number;
  montantTVA: number;
  montantTTC: number;

  // Stripe
  stripePaymentIntentId?: string;
  stripeChargeId?: string;
  stripeTransferId?: string;
  providerData?: Record<string, unknown>;

  // Parties
  payerId: string;  // Client
  payeeId: string;  // Entreprise

  // Séquestre
  heldUntil?: Date;
  escrowReleasedAt?: Date;
  escrowReleasedBy?: string;

  // Statut
  status: PaymentStatus;
  statusHistory: PaymentStatusChange[];

  // Dates
  dueDate?: Date;
  paidAt?: Date;
  releasedAt?: Date;

  // Anti-fraude
  fraudChecks: FraudCheckResult;
  fraudScore: number;
  fraudAlerts: string[];
  requiresManualReview: boolean;
  reviewedBy?: string;
  reviewedAt?: Date;
  reviewNotes?: string;

  // Métadonnées
  createdAt: Date;
  updatedAt: Date;
}

export interface PaymentStatusChange {
  status: PaymentStatus;
  changedAt: Date;
  changedBy?: string;
  reason?: string;
}

// === LITIGES ===

export interface Dispute {
  id: string;

  // Références
  contractId: string;
  paymentId?: string;
  milestoneId?: string;

  // Identification
  reference: string;

  // Parties
  openedBy: string;
  against: string;

  // Détails
  reason: DisputeReason;
  titre: string;
  description: string;
  montantConteste?: number;

  // Preuves
  preuvesDemandeur: DisputeProof[];
  preuvesDefendeur: DisputeProof[];

  // Traitement
  status: DisputeStatus;
  assignedTo?: string;

  // Résolution
  resolutionType?: 'full_refund' | 'partial_refund' | 'work_completion' | 'compromise' | 'dismissed';
  resolutionDescription?: string;
  resolutionMontant?: number;
  resolvedAt?: Date;
  resolvedBy?: string;

  // Timeline
  deadlineReponse?: Date;
  deadlineResolution?: Date;

  // Historique
  historique: DisputeEvent[];

  // Métadonnées
  createdAt: Date;
  updatedAt: Date;
}

export interface DisputeProof {
  id: string;
  type: 'photo' | 'document' | 'message' | 'video' | 'other';
  nom: string;
  fichier: string;
  dateAjout: Date;
  description?: string;
}

export interface DisputeEvent {
  id: string;
  type: 'status_change' | 'message' | 'proof_added' | 'assignment' | 'resolution';
  date: Date;
  acteur: string;
  description: string;
  data?: Record<string, unknown>;
}

// === ANTI-FRAUDE ===

export interface FraudRule {
  id: string;
  code: string;
  nom: string;
  description?: string;

  actif: boolean;
  severite: FraudRiskLevel;
  scoreImpact: number;

  typeRegle: 'threshold' | 'pattern' | 'timing' | 'behavior';
  conditions: Record<string, unknown>;

  actionAuto?: 'block' | 'hold' | 'flag' | 'notify';
  notificationAdmin: boolean;
}

export interface FraudCheckResult {
  totalScore: number;
  riskLevel: FraudRiskLevel;
  rulesTriggered: string[];
  details: Record<string, unknown>;
  shouldBlock: boolean;
  checkedAt: Date;
}

export interface FraudAlert {
  id: string;
  paymentId?: string;
  milestoneId?: string;
  contractId: string;

  ruleCode: string;
  severity: FraudRiskLevel;
  message: string;
  details: Record<string, unknown>;

  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  actionTaken?: string;

  createdAt: Date;
}

// === COMPTE ENTREPRISE ===

export interface EnterprisePaymentAccount {
  id: string;
  userId: string;

  // Stripe Connect
  stripeAccountId?: string;
  stripeAccountStatus?: 'pending' | 'active' | 'restricted' | 'disabled';
  stripeOnboardingComplete: boolean;
  stripeChargesEnabled: boolean;
  stripePayoutsEnabled: boolean;

  // Informations bancaires
  ibanLast4?: string;
  bankName?: string;

  // Vérification
  identityVerified: boolean;
  businessVerified: boolean;

  // Limites
  payoutLimitDaily: number;
  payoutLimitMonthly: number;

  // Statistiques
  totalReceived: number;
  totalPending: number;
  totalDisputes: number;

  createdAt: Date;
  updatedAt: Date;
}

// === DEMANDE DE PAIEMENT ===

export interface PaymentRequest {
  contractId: string;
  milestoneId?: string;
  paymentType: PaymentType;
  montantHT: number;
  tauxTVA: number;
  description?: string;

  // Preuves fournies
  preuves?: MilestoneProof[];
  compteRendu?: string;
}

export interface PaymentValidation {
  milestoneId: string;
  approved: boolean;
  rejectionReason?: string;
  commentaire?: string;
}

// === SÉQUESTRE ===

export interface EscrowConfig {
  // Durée de rétention par défaut (jours)
  defaultHoldDays: number;

  // Conditions de libération automatique
  autoReleaseOnValidation: boolean;
  autoReleaseAfterDays: number;

  // Retenue de garantie
  retenueGarantiePct: number;
  retenueGarantieDureeMois: number;
}

export interface EscrowRelease {
  paymentId: string;
  releaseAmount: number;
  releaseType: 'full' | 'partial' | 'retention';
  reason: string;
  releasedBy: string;
  releasedAt: Date;
}

// === STATISTIQUES ===

export interface PaymentStats {
  // Totaux
  totalContrats: number;
  totalMontantContracte: number;
  totalPaye: number;
  totalEnAttente: number;
  totalEnSequestre: number;

  // Par statut
  parStatut: Record<PaymentStatus, { count: number; montant: number }>;

  // Litiges
  litiges: {
    ouverts: number;
    resolus: number;
    montantConteste: number;
  };

  // Fraude
  fraude: {
    alertesTotal: number;
    bloques: number;
    tauxDetection: number;
  };
}

// === WEBHOOKS STRIPE ===

export interface StripeWebhookEvent {
  type: string;
  data: {
    object: {
      id: string;
      amount?: number;
      status?: string;
      metadata?: Record<string, string>;
      [key: string]: unknown;
    };
  };
}

// === NOTIFICATIONS PAIEMENT ===

export interface PaymentNotification {
  type: 'payment_received' | 'payment_released' | 'milestone_validated' | 'milestone_rejected' |
        'dispute_opened' | 'dispute_resolved' | 'fraud_alert' | 'escrow_release' | 'payment_reminder';
  recipientId: string;
  title: string;
  message: string;
  data: Record<string, unknown>;
  priority: 'low' | 'normal' | 'high' | 'urgent';
}
