/**
 * Types pour le TORP-Score B2B
 * Analyse des propositions commerciales avant envoi au client
 */

// === PROPOSITION COMMERCIALE B2B ===

export interface PropositionCommerciale {
  id: string;
  projectId: string;
  entrepriseId: string;

  // Informations générales
  reference: string;
  dateCreation: Date;
  dateValidite: Date;

  // Client destinataire
  client: {
    nom: string;
    prenom?: string;
    email?: string;
    telephone?: string;
    adresse: string;
  };

  // Contenu de la proposition
  chiffrage: ChiffrageProposition;
  memoireTechnique: MemoireTechnique;
  planningPrevisionnel: PlanningPrevisionnel;
  conditionsCommerciales: ConditionsCommerciales;

  // Documents joints
  documentsJoints: DocumentJoint[];

  // Statut
  status: 'brouillon' | 'analyse_en_cours' | 'pret_envoi' | 'envoye' | 'consulte' | 'accepte' | 'refuse' | 'expire';

  // Métadonnées
  torpScoreId?: string;
  dernierScoreGlobal?: number;
}

export interface ChiffrageProposition {
  // Structure des lots
  lots: LotChiffrage[];

  // Totaux
  totalHT: number;
  totalTVA: number;
  totalTTC: number;

  // Détails TVA
  detailsTVA: { taux: number; base: number; montant: number }[];

  // Remises
  remiseGlobale?: { type: 'pourcentage' | 'montant'; valeur: number };

  // Options
  options?: OptionChiffrage[];
}

export interface LotChiffrage {
  id: string;
  numero: number;
  designation: string;
  description?: string;

  // Lignes de détail
  lignes: LigneChiffrage[];

  // Sous-totaux
  totalMO: number;
  totalFournitures: number;
  totalSousTraitance: number;
  totalHT: number;
}

export interface LigneChiffrage {
  id: string;
  designation: string;
  description?: string;
  unite: string;
  quantite: number;
  prixUnitaireHT: number;

  // Décomposition
  decomposition?: {
    mainOeuvre: number;
    fournitures: number;
    sousTraitance?: number;
  };

  totalHT: number;
  tauxTVA: number;
}

export interface OptionChiffrage {
  id: string;
  designation: string;
  description?: string;
  prixHT: number;
  tauxTVA: number;
  incluse: boolean;
}

export interface MemoireTechnique {
  // Présentation entreprise
  presentationEntreprise: {
    historique?: string;
    effectifs?: number;
    chiffreAffaires?: number;
    certifications: string[];
    references: ReferenceChantier[];
  };

  // Méthodologie
  methodologie: {
    description: string;
    phasage: PhaseMethodologie[];
    moyensHumains: string;
    moyensMateriel: string;
  };

  // Engagements
  engagements: {
    qualite: string[];
    environnement: string[];
    securite: string[];
    delais: string;
  };

  // Points forts
  pointsForts: string[];
}

export interface ReferenceChantier {
  nomProjet: string;
  client: string;
  annee: number;
  montant?: number;
  description: string;
  typeTravauxSimilaires: boolean;
}

export interface PhaseMethodologie {
  numero: number;
  titre: string;
  description: string;
  duree: string;
  livrables?: string[];
}

export interface PlanningPrevisionnel {
  dateDebutSouhaitee?: Date;
  dateDebutProposee: Date;
  dateFinProposee: Date;
  dureeTotaleJours: number;

  // Jalons
  jalons: JalonPlanning[];

  // Contraintes
  contraintesIdentifiees?: string[];

  // Conditions
  conditionsPrealables?: string[];
}

export interface JalonPlanning {
  id: string;
  numero: number;
  designation: string;
  datePrevue: Date;

  // Lien paiement
  paiementAssocie?: {
    pourcentage: number;
    montant: number;
    conditions: string;
  };

  // Livrables
  livrables?: string[];
}

export interface ConditionsCommerciales {
  // Validité
  dureeValiditeJours: number;

  // Paiement
  modalitesPaiement: {
    acompteSignature?: { pourcentage: number; montant: number };
    echeancier: EcheancePaiement[];
    delaiPaiementJours: number;
    moyensPaiement: string[];
  };

  // Garanties
  garanties: {
    parfaitAchevement: boolean;
    biennale: boolean;
    decennale: boolean;
    retenuGarantie?: { pourcentage: number; duree: string };
  };

  // Pénalités
  penalites?: {
    retardJournalier?: number;
    plafond?: number;
  };

  // Conditions particulières
  conditionsParticulieres?: string[];
}

export interface EcheancePaiement {
  numero: number;
  designation: string;
  condition: string;
  pourcentage: number;
  montant: number;
}

export interface DocumentJoint {
  id: string;
  type: 'kbis' | 'assurance_rc' | 'assurance_decennale' | 'qualification' | 'reference' | 'attestation' | 'autre';
  nom: string;
  fichier: string;
  dateValidite?: Date;
}

// === TORP-SCORE ANALYSIS ===

export interface TorpScoreAnalysis {
  id: string;
  propositionId: string;
  dateAnalyse: Date;

  // Score global (0-100)
  scoreGlobal: number;
  grade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';

  // Dimensions d'analyse
  dimensions: {
    competitivite: DimensionCompetitivite;
    completude: DimensionCompletude;
    clarte: DimensionClarte;
    conformite: DimensionConformite;
    coherencePhase0: DimensionCoherencePhase0;
    attractivite: DimensionAttractivite;
  };

  // Probabilité d'acceptation
  probabiliteAcceptation: {
    pourcentage: number;
    facteursFavorables: string[];
    facteursDefavorables: string[];
    comparaisonMarche: string;
  };

  // Recommandations prioritaires
  recommandations: RecommandationTorpScore[];

  // Points forts / Points faibles
  pointsForts: string[];
  pointsFaibles: string[];

  // Actions suggérées
  actionsSuggerees: ActionSuggeree[];

  // Benchmark
  benchmark?: {
    positionMarche: 'tres_competitif' | 'competitif' | 'moyen' | 'eleve' | 'tres_eleve';
    ecartMoyenneMarche: number;
    propositionsSimilairesGagnantes: number;
  };
}

export interface DimensionCompetitivite {
  score: number; // 0-100
  poids: number; // % du score global

  analyse: {
    prixVsMarche: {
      ecart: number; // % par rapport au marché
      position: 'tres_bas' | 'bas' | 'marche' | 'eleve' | 'tres_eleve';
      detail: string;
    };
    rapportQualitePrix: {
      score: number;
      justification: string;
    };
    margeBrute: {
      estimee: number;
      acceptable: boolean;
      commentaire: string;
    };
  };

  recommandations: string[];
}

export interface DimensionCompletude {
  score: number;
  poids: number;

  analyse: {
    elementsPresents: ElementCompletude[];
    elementsManquants: ElementCompletude[];
    tauxCompletude: number;
  };

  elementsObligatoires: {
    element: string;
    present: boolean;
    critique: boolean;
  }[];

  recommandations: string[];
}

export interface ElementCompletude {
  categorie: 'administratif' | 'technique' | 'financier' | 'planning' | 'garanties';
  element: string;
  importance: 'obligatoire' | 'recommande' | 'optionnel';
  present: boolean;
  commentaire?: string;
}

export interface DimensionClarte {
  score: number;
  poids: number;

  analyse: {
    lisibilite: {
      score: number;
      problemes: string[];
    };
    structuration: {
      score: number;
      commentaire: string;
    };
    precision: {
      score: number;
      elementsVagues: string[];
    };
    professionnalisme: {
      score: number;
      points: string[];
    };
  };

  recommandations: string[];
}

export interface DimensionConformite {
  score: number;
  poids: number;

  analyse: {
    mentionsLegales: {
      presentes: string[];
      manquantes: string[];
      conformes: boolean;
    };
    assurances: {
      rcPro: { present: boolean; valide: boolean };
      decennale: { present: boolean; valide: boolean; activitesCouvertes: boolean };
    };
    certifications: {
      rge: { present: boolean; coherent: boolean; numero?: string };
      qualibat: { present: boolean; niveau?: string };
      autres: string[];
    };
    cgv: {
      presentes: boolean;
      conformesLoi: boolean;
      alertes: string[];
    };
  };

  alertes: { niveau: 'critique' | 'important' | 'mineur'; message: string }[];
  recommandations: string[];
}

export interface DimensionCoherencePhase0 {
  score: number;
  poids: number;

  analyse: {
    couvertureBesoin: {
      score: number;
      besoinsCouverts: string[];
      besoinsNonCouverts: string[];
    };
    respectCCTP: {
      score: number;
      conformites: string[];
      ecarts: string[];
    };
    coherenceBudget: {
      budgetPhase0: number;
      propositionTTC: number;
      ecart: number;
      commentaire: string;
    };
    coherencePlanning: {
      delaiPhase0: string;
      delaiPropose: string;
      coherent: boolean;
      commentaire: string;
    };
  };

  recommandations: string[];
}

export interface DimensionAttractivite {
  score: number;
  poids: number;

  analyse: {
    differenciateurs: {
      identifies: string[];
      score: number;
    };
    valeursAjoutees: {
      elements: string[];
      impact: 'fort' | 'moyen' | 'faible';
    };
    presentationEntreprise: {
      score: number;
      pointsForts: string[];
      ameliorations: string[];
    };
    references: {
      pertinentes: number;
      qualite: 'excellente' | 'bonne' | 'moyenne' | 'faible';
    };
  };

  recommandations: string[];
}

export interface RecommandationTorpScore {
  id: string;
  priorite: 'critique' | 'haute' | 'moyenne' | 'basse';
  categorie: 'prix' | 'completude' | 'clarte' | 'conformite' | 'attractivite' | 'coherence';
  titre: string;
  description: string;
  impact: {
    surScore: number; // Points potentiels gagnés
    surAcceptation: number; // % d'amélioration probabilité
  };
  actionRequise: string;
  effort: 'faible' | 'moyen' | 'eleve';
}

export interface ActionSuggeree {
  id: string;
  type: 'modifier_prix' | 'ajouter_element' | 'reformuler' | 'ajouter_document' | 'corriger_erreur';
  cible: string;
  suggestion: string;
  exemple?: string;
  priorite: number;
}

// === TRANSMISSION CLIENT ===

export interface TransmissionClient {
  id: string;
  propositionId: string;

  // Destinataire
  client: {
    nom: string;
    email?: string;
    telephone?: string;
  };

  // Canaux
  canaux: CanalTransmission[];

  // Contenu
  message: {
    objet: string;
    corps: string;
    personnalise: boolean;
  };

  // Lien d'accès
  lienAcces: {
    url: string;
    qrCode: string;
    codeAcces: string;
    expiration: Date;
  };

  // Tracking
  tracking: {
    dateEnvoi: Date;
    dateOuverture?: Date;
    nombreConsultations: number;
    tempsConsultation?: number; // secondes
    documentsTelechargés: string[];
  };

  // Relances
  relances: RelanceClient[];

  // Statut
  status: 'programme' | 'envoye' | 'delivre' | 'ouvert' | 'consulte' | 'expire';
}

export interface CanalTransmission {
  type: 'email' | 'sms' | 'whatsapp';
  destinataire: string;
  actif: boolean;
  dateEnvoi?: Date;
  statusLivraison?: 'envoye' | 'delivre' | 'lu' | 'erreur';
}

export interface RelanceClient {
  id: string;
  numero: number;
  dateRelance: Date;
  canal: 'email' | 'sms' | 'whatsapp';
  automatique: boolean;
  message?: string;
  statusEnvoi: 'programme' | 'envoye' | 'annule';
}

// === CONFIGURATION RELANCES ===

export interface ConfigurationRelances {
  actif: boolean;
  delaiPremiereRelance: number; // jours
  frequence: number; // jours entre relances
  nombreMaxRelances: number;
  canaux: ('email' | 'sms' | 'whatsapp')[];
  messageType: 'standard' | 'personnalise';
  messagePersonnalise?: string;
  horaireEnvoi: { heure: number; minute: number };
  joursEnvoi: number[]; // 0-6 (dimanche-samedi)
}
