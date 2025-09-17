export interface UserData {
  id: string;
  email?: string;
  name?: string;
  location?: LocationData;
  scoreInitial?: number;
  source?: TrafficSource;
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