export interface UserData {
  id: string;
  email?: string;
  name?: string;
  location?: LocationData;
  scoreInitial?: number;
  source?: TrafficSource;
  profileType: 'B2B' | 'B2C';
}

export interface ParcelData {
  surfaceTotale: number;
  surfaceConstruiteExistante: number;
  zone: string;
  cosMaximum: number;
  cesMaximum: number;
  hauteurMax: string;
  retraitVoirie: number;
  retraitLimites: number;
  potentielConstructible: {
    surfacePlancherMax: number;
    surfacePlancherDisponible: number;
    emprisesolMax: number;
    emprisesolDisponible: number;
  };
}

export interface RiskAnalysis {
  zoneInondable: 'rouge' | 'bleue' | 'verte';
  argileGonflante: 'fort' | 'moyen' | 'faible';
  distanceRaccordementEgout: number;
  largeurAcces: number;
  score: number;
  alerts: string[];
  surcouts: { description: string; montant: number }[];
}

export interface LocationData {
  region: string;
  prixMoyenM2: number;
  disponibiliteArtisans: number;
  delaiMoyenChantier: number;
}

export interface TrafficSource {
  type: 'direct' | 'seo' | 'sea' | 'social' | 'partenaire';
  points: number;
}

export interface QualificationAnswers {
  typeProjet: 'construction_neuve' | 'extension' | 'renovation_lourde' | 'renovation_legere';
  budget: 'moins_20k' | '20k_50k' | '50k_100k' | 'plus_100k';
  timeline: 'immediat' | '3_mois' | '6_mois' | 'exploration';
}

export interface ScoringResult {
  scoreInitial: number;
  typeProjet: number;
  budget: number;
  timeline: number;
  trafficSource: number;
  total: number;
  grade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';
  message: string;
}

export interface DevisData {
  id: string;
  montant: number;
  entreprise: EntrepriseData;
  itemsDevis: DevisItem[];
  completude: number;
  conformite: number;
}

export interface EntrepriseData {
  siret: string;
  nom: string;
  age: number;
  chiffreAffaires: number;
  certification: string[];
  assurances: AssuranceData;
  reputation: number;
  litiges: number;
}

export interface AssuranceData {
  decennale: boolean;
  rcPro: boolean;
  validite: string;
}

export interface DevisItem {
  description: string;
  quantite: number;
  prixUnitaire: number;
  total: number;
  categorie: string;
}

export interface PaymentStage {
  id: string;
  nom: string;
  montant: number;
  pourcentage: number;
  status: 'en_attente' | 'paye' | 'valide' | 'litige';
  dateEcheance: Date;
  datePaiement?: Date;
  typeValidation: 'photos' | 'signature' | 'rapport';
  preuves?: string[];
}

export interface ProjetTracking {
  id: string;
  nom: string;
  montantTotal: number;
  avancement: number;
  etapesPaiement: PaymentStage[];
  entreprise: EntrepriseData;
  client: UserData;
  dateDebut: Date;
  dateFinPrevue: Date;
  alerts: Alert[];
}

export interface Alert {
  type: 'retard' | 'budget' | 'qualite' | 'paiement';
  niveau: 'info' | 'warning' | 'danger';
  message: string;
  dateCreation: Date;
}

// Phase 3: Système de Paiements Avancé
export interface PaymentMethod {
  type: 'cb' | 'virement' | 'cheque' | 'especes';
  details: string;
  commission: number;
}

export interface PaymentSequestre {
  id: string;
  projetId: string;
  montant: number;
  dateCreation: Date;
  dateLiberationPrevue: Date;
  dateLiberationReelle?: Date;
  status: 'en_attente' | 'bloque' | 'libere' | 'litige';
  commissionTorp: number;
  justificationLiberation: string[];
}

export interface PaymentReminder {
  id: string;
  paiementId: string;
  type: 'soft' | 'urgent' | 'formal' | 'legal';
  canal: 'sms' | 'email' | 'push' | 'courrier';
  message: string;
  dateEnvoi: Date;
  status: 'envoye' | 'lu' | 'ignore' | 'repondu';
}

export interface PaymentDispute {
  id: string;
  projetId: string;
  initiateur: 'client' | 'artisan';
  motif: 'qualite' | 'delai' | 'prix' | 'abandon';
  description: string;
  preuves: string[];
  status: 'ouvert' | 'mediation' | 'resolu' | 'escalade';
  dateCreation: Date;
  resolution?: string;
}

export interface TorpAnalysisResult {
  id: string;
  devisId: string;
  scoreGlobal: number;
  grade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';
  
  // Analyse entreprise (250 points)
  scoreEntreprise: {
    fiabilite: number;
    santeFinnaciere: number;
    anciennete: number;
    assurances: number;
    certifications: number;
    reputation: number;
    risques: string[];
    benefices: string[];
  };
  
  // Analyse prix (300 points)
  scorePrix: {
    vsMarche: number;
    transparence: number;
    coherence: number;
    margeEstimee: number;
    ajustementQualite: number;
    economiesPotentielles: number;
  };
  
  // Complétude technique (200 points)
  scoreCompletude: {
    elementsManquants: string[];
    incohérences: string[];
    conformiteNormes: number;
    risquesTechniques: string[];
  };
  
  // Conformité réglementaire (150 points)
  scoreConformite: {
    assurances: boolean;
    plu: boolean;
    normes: boolean;
    accessibilite: boolean;
    defauts: string[];
  };
  
  // Délais (100 points)
  scoreDelais: {
    realisme: number;
    vsMarche: number;
    planningDetaille: boolean;
    penalitesRetard: boolean;
  };
  
  recommandations: Recommendation[];
  surcoutsDetectes: number;
  budgetRealEstime: number;
  margeNegociation: { min: number; max: number };

  // Données extraites du devis (pour enrichissement et géocodage)
  extractedData?: {
    entreprise: {
      nom: string;
      siret: string | null;
      siretVerification?: {
        source: 'document' | 'pappers_lookup' | 'non_trouve';
        confidence: 'high' | 'medium' | 'low';
        verified: boolean;
        message: string;
        pappersMatch?: {
          nomEntreprise: string;
          adresse: string;
          siret: string;
          matchScore: number;
        };
      };
      adresse: string | null;
      telephone: string | null;
      email: string | null;
      certifications: string[];
    };
    client?: {
      nom: string | null;
      adresse: string | null;
    };
    travaux?: {
      type: string;
      adresseChantier: string | null;
    };
    devis?: {
      montantTotal: number;
      montantHT: number | null;
    };
  };

  dateAnalyse: Date;
  dureeAnalyse: number; // en secondes
}

export interface Recommendation {
  type: 'negociation' | 'verification' | 'protection' | 'amelioration';
  priorite: 'haute' | 'moyenne' | 'faible';
  titre: string;
  description: string;
  actionSuggeree: string;
  impactBudget?: number;
  delaiAction?: number; // en jours
}