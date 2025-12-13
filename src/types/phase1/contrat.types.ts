/**
 * TORP Phase 1 - Types Contrat
 * Module 1.4 : Sélection et Contractualisation
 *
 * Structure complète pour la génération de contrats,
 * la négociation et la sécurisation juridique
 */

import type { Address, EstimationRange } from '../phase0/common.types';
import type { WizardMode } from '../phase0/wizard.types';

// =============================================================================
// CONTRAT PRINCIPAL
// =============================================================================

export interface Contrat {
  id: string;
  projectId: string;
  consultationId: string;
  offreId: string;

  // Type de contrat
  type: TypeContrat;
  mode: WizardMode; // B2C, B2B, B2G

  // Parties
  parties: PartiesContrat;

  // Objet
  objet: ObjetContrat;

  // Conditions financières
  conditionsFinancieres: ConditionsFinancieres;

  // Délais
  delais: DelaisContrat;

  // Garanties et assurances
  garanties: GarantiesContrat;

  // Clauses
  clauses: ClausesContrat;

  // Annexes
  annexes: AnnexeContrat[];

  // Signature
  signature: SignatureContrat;

  // Statut
  statut: StatutContrat;

  // Métadonnées
  metadata: ContratMetadata;
}

export type TypeContrat =
  | 'marche_prive_b2c'       // Contrat particulier
  | 'marche_prive_b2b'       // Contrat professionnel
  | 'marche_public_mapa'     // MAPA
  | 'marche_public_ao';      // Appel d'offres

export type StatutContrat =
  | 'brouillon'
  | 'en_negociation'
  | 'a_signer'
  | 'signe_entreprise'
  | 'signe_mo'
  | 'notifie'
  | 'en_cours'
  | 'termine'
  | 'resilie'
  | 'archive';

// =============================================================================
// PARTIES AU CONTRAT
// =============================================================================

export interface PartiesContrat {
  maitreOuvrage: PartieMO;
  entreprise: PartieEntreprise;
  maitreOeuvre?: PartieMOE;
  controleurTechnique?: PartieControleur;
}

export interface PartieMO {
  type: 'particulier' | 'entreprise' | 'collectivite';

  // Identité
  nom: string;
  prenom?: string; // Si particulier
  raisonSociale?: string; // Si entreprise/collectivité
  formeJuridique?: string;

  // Identification
  siret?: string;
  adresse: Address;

  // Contact
  email: string;
  telephone: string;
  representant?: {
    nom: string;
    qualite: string;
  };
}

export interface PartieEntreprise {
  raisonSociale: string;
  formeJuridique: string;
  siret: string;
  numeroTVA?: string;
  capital?: number;
  adresse: Address;

  // Représentant
  representant: {
    nom: string;
    qualite: string;
    habilitation?: string;
  };

  // Contact
  email: string;
  telephone: string;

  // Assurances
  assuranceDecennale: {
    compagnie: string;
    numeroPolice: string;
    validiteJusquau: string;
    montantGaranti: number;
  };
  assuranceRC: {
    compagnie: string;
    numeroPolice: string;
    validiteJusquau: string;
    montantGaranti: number;
  };

  // Qualifications
  qualifications: {
    type: string;
    numero: string;
    validiteJusquau: string;
  }[];
}

export interface PartieMOE {
  raisonSociale: string;
  adresse: Address;
  representant: {
    nom: string;
    qualite: string;
  };
  email: string;
  telephone: string;
  missionType: TypeMissionMOE;
}

export type TypeMissionMOE =
  | 'complete'           // Mission complète
  | 'conception'         // Conception uniquement
  | 'execution'          // Suivi d'exécution
  | 'opc';               // OPC uniquement

export interface PartieControleur {
  raisonSociale: string;
  adresse: Address;
  agrementNumero: string;
  missionType: string;
}

// =============================================================================
// OBJET DU CONTRAT
// =============================================================================

export interface ObjetContrat {
  // Description
  titre: string;
  description: string;

  // Localisation
  adresseChantier: Address;

  // Travaux
  natureTravaux: string;
  lots: LotContrat[];

  // Surface
  surface?: number;

  // Références
  referenceCCTP?: string;
  referenceDPGF?: string;
}

export interface LotContrat {
  numero: string;
  designation: string;
  montantHT: number;
  description?: string;
}

// =============================================================================
// CONDITIONS FINANCIÈRES
// =============================================================================

export interface ConditionsFinancieres {
  // Prix
  prix: {
    type: 'forfaitaire' | 'unitaire' | 'mixte';
    montantHT: number;
    tauxTVA: number;
    montantTVA: number;
    montantTTC: number;
  };

  // Révision des prix
  revision: {
    applicable: boolean;
    formule?: string;
    indice?: string;
    periodeRevision?: number; // mois
    dateReference?: string;
  };

  // Modalités de paiement
  paiement: ModalitesPaiement;

  // Retenue de garantie
  retenueGarantie: RetenueGarantie;

  // Pénalités
  penalites: PenalitesContrat;
}

export interface ModalitesPaiement {
  // Acompte démarrage
  acompte?: {
    pourcentage: number;
    montant: number;
    conditions: string;
  };

  // Échéancier
  echeancier: EcheancePaiement[];

  // Délai de paiement
  delaiPaiement: number; // jours
  baseDelai: 'reception_facture' | 'fin_mois' | 'situation_validee';

  // Intérêts de retard
  interetsRetard: {
    applicable: boolean;
    taux?: number;
    calcul?: string;
  };
}

export interface EcheancePaiement {
  designation: string;
  pourcentage: number;
  montant: number;
  condition: string;
  date?: string;
}

// Échéancier type recommandé
export const ECHEANCIER_TYPE: { designation: string; pourcentage: number; condition: string }[] = [
  { designation: 'Acompte démarrage', pourcentage: 15, condition: 'À la signature de l\'ordre de service' },
  { designation: 'Fin gros œuvre', pourcentage: 25, condition: 'À l\'achèvement du gros œuvre' },
  { designation: 'Fin second œuvre', pourcentage: 30, condition: 'À l\'achèvement du second œuvre' },
  { designation: 'Fin finitions', pourcentage: 20, condition: 'À l\'achèvement des finitions' },
  { designation: 'Solde', pourcentage: 10, condition: 'À la réception sans réserves ou levée des réserves' },
];

export interface RetenueGarantie {
  applicable: boolean;
  pourcentage: number; // Généralement 5%
  duree: number; // mois (généralement 12)
  liberation: {
    automatique: boolean;
    conditions: string[];
  };
  substitution: {
    cautionBancaire: boolean;
    conditions?: string;
  };
}

export interface PenalitesContrat {
  retard: {
    montantParJour: number | string; // € ou formule
    plafond?: number; // %
    debutDecompte: string;
    causesSuspension: string[];
  };
  absenceReunion?: number;
  nonConformite?: {
    montant: number;
    conditions: string;
  };
}

// =============================================================================
// DÉLAIS
// =============================================================================

export interface DelaisContrat {
  // Préparation
  preparation: {
    duree: number;
    unite: 'jours' | 'semaines';
  };

  // Exécution
  execution: {
    duree: number;
    unite: 'jours_calendaires' | 'jours_ouvres' | 'semaines' | 'mois';
    debutType: 'ordre_service' | 'notification' | 'date_fixe';
    dateDebut?: string;
    dateFin?: string;
  };

  // Réception
  reception: {
    delaiDemande: number; // jours avant fin
    delaiReponse: number; // jours pour répondre
    delaiLeveeReserves: number; // jours
  };

  // Jalons contractuels
  jalons?: JalonContractuel[];
}

export interface JalonContractuel {
  designation: string;
  delaiJours: number; // À partir du démarrage
  penalisable: boolean;
  montantPenalite?: number;
}

// =============================================================================
// GARANTIES ET ASSURANCES
// =============================================================================

export interface GarantiesContrat {
  // Garanties légales
  legales: {
    parfaitAchevement: {
      duree: 1; // 1 an obligatoire
      couverture: string;
    };
    biennale: {
      duree: 2; // 2 ans obligatoire
      couverture: string;
      elementsCouverts: string[];
    };
    decennale: {
      duree: 10; // 10 ans obligatoire
      couverture: string;
    };
  };

  // Assurances obligatoires
  assurancesObligatoires: {
    rcDecennale: boolean;
    rcProfessionnelle: boolean;
    montantMinimum: number;
  };

  // Assurances facultatives
  assurancesFacultatives: {
    dommageOuvrage: {
      souscrit: boolean;
      parQui?: 'mo' | 'entreprise';
      montant?: number;
    };
    trc: {
      souscrit: boolean;
      parQui?: 'mo' | 'entreprise';
      couverture?: string[];
    };
  };

  // Garanties bancaires
  garantiesBancaires?: {
    cautionnementDefinitif?: {
      requis: boolean;
      pourcentage: number;
    };
    cautionRestitutionAvance?: {
      requis: boolean;
      conditions: string;
    };
  };
}

// =============================================================================
// CLAUSES DU CONTRAT
// =============================================================================

export interface ClausesContrat {
  // Clauses obligatoires
  obligatoires: ClauseContrat[];

  // Clauses particulières
  particulieres: ClauseContrat[];

  // Clauses environnementales
  environnementales?: ClauseContrat[];

  // Clauses sociales
  sociales?: ClauseContrat[];
}

export interface ClauseContrat {
  id: string;
  titre: string;
  contenu: string;
  obligatoire: boolean;
  modifiable: boolean;
  reference?: string; // Référence légale
}

// Clauses obligatoires B2C (Code de la consommation)
export const CLAUSES_OBLIGATOIRES_B2C: Omit<ClauseContrat, 'id'>[] = [
  {
    titre: 'Identité des parties',
    contenu: 'Identification complète du maître d\'ouvrage et de l\'entreprise (nom, adresse, SIRET)',
    obligatoire: true,
    modifiable: false,
    reference: 'Article L111-1 Code de la consommation',
  },
  {
    titre: 'Description des travaux',
    contenu: 'Description précise des travaux à réaliser (référence au CCTP)',
    obligatoire: true,
    modifiable: false,
  },
  {
    titre: 'Prix',
    contenu: 'Prix TTC détaillé et modalités de paiement',
    obligatoire: true,
    modifiable: false,
    reference: 'Article L111-1 Code de la consommation',
  },
  {
    titre: 'Délai d\'exécution',
    contenu: 'Date de début et durée d\'exécution des travaux',
    obligatoire: true,
    modifiable: false,
  },
  {
    titre: 'Pénalités de retard',
    contenu: 'Montant des pénalités en cas de retard d\'exécution',
    obligatoire: true,
    modifiable: true,
  },
  {
    titre: 'Garanties',
    contenu: 'Rappel des garanties légales (parfait achèvement, biennale, décennale)',
    obligatoire: true,
    modifiable: false,
    reference: 'Articles 1792 et suivants du Code civil',
  },
  {
    titre: 'Assurances',
    contenu: 'Numéros des contrats d\'assurance RC décennale de l\'entreprise',
    obligatoire: true,
    modifiable: false,
  },
  {
    titre: 'Droit de rétractation',
    contenu: 'Information sur le délai de rétractation de 14 jours (si démarchage à domicile)',
    obligatoire: true,
    modifiable: false,
    reference: 'Article L221-18 Code de la consommation',
  },
  {
    titre: 'Résiliation',
    contenu: 'Conditions de résiliation du contrat par chaque partie',
    obligatoire: true,
    modifiable: true,
  },
  {
    titre: 'Tribunal compétent',
    contenu: 'Tribunal compétent en cas de litige',
    obligatoire: true,
    modifiable: false,
  },
];

// Clauses spécifiques marchés publics
export const CLAUSES_MARCHE_PUBLIC: Omit<ClauseContrat, 'id'>[] = [
  {
    titre: 'Pièces constitutives du marché',
    contenu: 'Liste des pièces du marché par ordre de priorité décroissant',
    obligatoire: true,
    modifiable: false,
    reference: 'CCAG Travaux Article 4',
  },
  {
    titre: 'Délai de paiement',
    contenu: 'Délai global de paiement de 30 jours maximum',
    obligatoire: true,
    modifiable: false,
    reference: 'Article L2192-10 Code de la commande publique',
  },
  {
    titre: 'Sous-traitance',
    contenu: 'Conditions de sous-traitance et paiement direct',
    obligatoire: true,
    modifiable: true,
    reference: 'Loi n°75-1334 du 31 décembre 1975',
  },
  {
    titre: 'Nantissement',
    contenu: 'Possibilité de nantissement du marché',
    obligatoire: true,
    modifiable: false,
  },
  {
    titre: 'Résiliation',
    contenu: 'Cas de résiliation pour faute, pour motif d\'intérêt général',
    obligatoire: true,
    modifiable: false,
    reference: 'CCAG Travaux Articles 46 à 49',
  },
];

// =============================================================================
// ANNEXES
// =============================================================================

export interface AnnexeContrat {
  id: string;
  code: string;
  titre: string;
  type: TypeAnnexeContrat;
  fichierUrl?: string;
  obligatoire: boolean;
  description?: string;
}

export type TypeAnnexeContrat =
  | 'cctp'
  | 'ccap'
  | 'dpgf'
  | 'planning'
  | 'plans'
  | 'attestation_assurance'
  | 'kbis'
  | 'qualification'
  | 'autre';

// =============================================================================
// SIGNATURE
// =============================================================================

export interface SignatureContrat {
  // Signature entreprise
  entreprise: {
    signee: boolean;
    dateSignature?: string;
    lieu?: string;
    signataire?: {
      nom: string;
      qualite: string;
    };
    typeSignature: TypeSignature;
    signatureUrl?: string;
    cachet: boolean;
  };

  // Signature maître d'ouvrage
  maitreOuvrage: {
    signee: boolean;
    dateSignature?: string;
    lieu?: string;
    signataire?: {
      nom: string;
      qualite: string;
    };
    typeSignature: TypeSignature;
    signatureUrl?: string;
  };

  // Notification
  notification?: {
    envoyee: boolean;
    dateEnvoi?: string;
    modeEnvoi?: 'rar' | 'email' | 'remise_main_propre';
    dateReception?: string;
    accuseReceptionUrl?: string;
  };

  // Ordre de service
  ordreService?: {
    emis: boolean;
    dateEmission?: string;
    dateEffet?: string;
    documentUrl?: string;
  };
}

export type TypeSignature =
  | 'manuscrite'
  | 'electronique_simple'
  | 'electronique_avancee'
  | 'electronique_qualifiee';

// =============================================================================
// NÉGOCIATION
// =============================================================================

export interface Negociation {
  id: string;
  contratId: string;

  // Points de négociation
  pointsNegociation: PointNegociation[];

  // Historique
  historique: HistoriqueNegociation[];

  // Résultat
  resultat: ResultatNegociation;
}

export interface PointNegociation {
  id: string;
  type: TypePointNegociation;
  designation: string;
  valeurInitiale: string | number;
  valeurDemandee: string | number;
  valeurAccordee?: string | number;
  statut: 'en_cours' | 'accepte' | 'refuse' | 'compromis';
  argumentaire?: string;
  contreArgumentaire?: string;
}

export type TypePointNegociation =
  | 'prix_global'
  | 'prix_poste'
  | 'delai'
  | 'phasage'
  | 'modalites_paiement'
  | 'penalites'
  | 'garanties'
  | 'prestations'
  | 'autre';

export interface HistoriqueNegociation {
  date: string;
  acteur: 'mo' | 'entreprise';
  action: string;
  details?: Record<string, unknown>;
}

export interface ResultatNegociation {
  abouti: boolean;
  dateAccord?: string;
  prixFinalHT?: number;
  ecartPrixInitial?: number; // %
  modificationsAcceptees: string[];
}

// =============================================================================
// VÉRIFICATION JURIDIQUE
// =============================================================================

export interface VerificationJuridique {
  contratId: string;
  dateVerification: string;

  // Résultat global
  conforme: boolean;
  score: number; // 0-100

  // Vérifications
  verifications: VerificationClause[];

  // Alertes
  alertes: AlerteJuridique[];

  // Recommandations
  recommandations: string[];
}

export interface VerificationClause {
  clauseId: string;
  clauseTitre: string;
  presente: boolean;
  conforme: boolean;
  commentaire?: string;
  referenceObligatoire?: string;
}

export interface AlerteJuridique {
  type: 'erreur' | 'warning' | 'info';
  clause?: string;
  message: string;
  consequence?: string;
  correction?: string;
}

// =============================================================================
// MÉTADONNÉES
// =============================================================================

export interface ContratMetadata {
  version: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  modifiedBy?: string;
  templateUsed?: string;
  exportFormats: ('pdf' | 'docx')[];
}
