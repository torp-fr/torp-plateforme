/**
 * Types Phase 2 - Logistique et Installation
 * Base vie, approvisionnements, déchets, documents
 */

// Statuts
export type StatutInstallation =
  | 'a_preparer'
  | 'en_preparation'
  | 'installee'
  | 'operationnelle'
  | 'demontee';

export type StatutApprovisionnement =
  | 'a_commander'
  | 'commande'
  | 'en_fabrication'
  | 'expedie'
  | 'livre'
  | 'controle'
  | 'conforme'
  | 'non_conforme';

export type TypeDechet =
  | 'gravats_inertes'
  | 'dib'
  | 'bois'
  | 'metaux'
  | 'platre'
  | 'laine_minerale'
  | 'polystyrene'
  | 'dds'
  | 'amiante'
  | 'autre';

export type StatutDocumentChantier =
  | 'a_fournir'
  | 'fourni'
  | 'valide'
  | 'expire'
  | 'non_conforme';

export type TypeDocumentChantier =
  | 'pc_dp'
  | 'dict'
  | 'doc'
  | 'ppsps'
  | 'pgc'
  | 'registre_sps'
  | 'attestation_assurance'
  | 'plans_execution'
  | 'planning'
  | 'annuaire_contacts'
  | 'reglement_chantier'
  | 'consignes_securite'
  | 'fds_produits'
  | 'autorisation_voirie'
  | 'arrete_circulation'
  | 'constat_huissier'
  | 'autre';

// Installation chantier
export interface InstallationChantier {
  id: string;
  chantierId: string;

  // Base vie
  baseVie: {
    vestiaires: { prevu: boolean; installe: boolean; surfaceM2: number };
    sanitaires: { prevu: boolean; installe: boolean; type: string };
    refectoire: { prevu: boolean; installe: boolean; equipements: string[] };
    bureauChantier: { prevu: boolean; installe: boolean };
  };

  // Branchements provisoires
  branchements: {
    electricite: { demande: boolean; raccorde: boolean; puissanceKw: number };
    eau: { demande: boolean; raccorde: boolean };
    assainissement: { prevu: boolean; installe: boolean };
  };

  // Zones
  zones: {
    stockageMateriaux: Zone[];
    stockageDechets: Zone[];
    circulationEngins: Zone[];
    stationnement: Zone[];
  };

  // Signalisation
  signalisation: {
    panneauChantier: boolean;
    panneauEntreprise: boolean;
    consignesSecurite: boolean;
    planEvacuation: boolean;
    balisagePerimetre: boolean;
  };

  // Sécurité
  securite: {
    extincteurs: { nombre: number; emplacements: string[] };
    trousseSecours: boolean;
    numerosUrgenceAffiches: boolean;
    registreSecurite: boolean;
  };

  // Statut
  statut: StatutInstallation;
  checklistCompletude: number;

  // Plan
  planInstallationUrl?: string;

  createdAt: string;
  updatedAt: string;
}

export interface Zone {
  id: string;
  nom: string;
  description?: string;
  surfaceM2?: number;
  coordonnees?: { x: number; y: number };
}

// Approvisionnement
export interface Approvisionnement {
  id: string;
  chantierId: string;
  tacheId?: string;

  // Identification
  designation: string;
  reference?: string;
  fournisseur?: string;

  // Quantités
  quantite: number;
  unite?: string;

  // Dates
  dateCommande?: string;
  delaiFabricationJours?: number;
  dateLivraisonPrevue?: string;
  dateLivraisonReelle?: string;

  // Statut
  statut: StatutApprovisionnement;

  // Contrôle réception
  controleReception?: ControleReception;

  // Documents
  bonCommandeUrl?: string;
  bonLivraisonUrl?: string;

  createdAt: string;
  updatedAt: string;
}

export interface ControleReception {
  date: string;
  controlePar: string;
  quantiteRecue: number;
  conforme: boolean;
  anomalies?: string[];
  photos?: string[];
  reservesBL?: string;
}

// Gestion des déchets
export interface Dechet {
  id: string;
  chantierId: string;

  // Type
  type: TypeDechet;
  contenant?: 'benne' | 'big_bag' | 'fut' | 'conteneur';
  volumeM3?: number;

  // Évacuation
  datePose?: string;
  dateEnlevement?: string;
  prestataire?: string;

  // Traçabilité
  bsdNumero?: string;
  bsdUrl?: string;
  ticketPeseeUrl?: string;
  poidsTonnes?: number;

  // Coût
  coutHT?: number;

  createdAt: string;
}

// Documents chantier obligatoires
export interface DocumentChantier {
  id: string;
  chantierId: string;

  // Type
  type: TypeDocumentChantier;
  nom: string;
  description?: string;

  // Fichier
  fileUrl?: string;
  fileName?: string;

  // Validité
  dateEmission?: string;
  dateExpiration?: string;

  // Statut
  statut: StatutDocumentChantier;

  // Fournisseur
  fourniPar?: string;

  // Vérification
  verifieLe?: string;
  verifiePar?: string;
  commentaireVerification?: string;

  createdAt: string;
  updatedAt: string;
}

// Journal chantier
export interface JournalChantier {
  id: string;
  chantierId: string;

  // Date
  dateJournal: string;

  // Météo
  meteo: {
    matin: string;
    apresMidi: string;
    temperatureMin?: number;
    temperatureMax?: number;
    intemperie: boolean;
  };

  // Effectifs
  effectifs: EffectifJour[];
  effectifTotal: number;

  // Travaux
  travauxRealises: TravailJour[];

  // Observations
  observations?: string;
  incidents?: string;

  // Visiteurs
  visiteurs: Visiteur[];

  // Photos
  photos: PhotoJournal[];

  // Validation
  redigePar?: string;
  validePar?: string;
  valideLe?: string;

  createdAt: string;
  updatedAt: string;
}

export interface EffectifJour {
  entreprise: string;
  nombrePersonnes: number;
  fonctions?: string[];
}

export interface TravailJour {
  lot: string;
  description: string;
  zone?: string;
  avancement?: number;
}

export interface Visiteur {
  nom: string;
  organisme?: string;
  objetVisite?: string;
  heureArrivee?: string;
  heureDepart?: string;
}

export interface PhotoJournal {
  id: string;
  url: string;
  legende?: string;
  zone?: string;
  dateHeure: string;
}

// Checklist démarrage
export interface ChecklistDemarrage {
  id: string;
  chantierId: string;

  // Items
  items: ChecklistItem[];

  // Score
  itemsTotal: number;
  itemsValides: number;
  pourcentageCompletion: number;

  // Statut
  estComplet: boolean;
  peutDemarrer: boolean;

  // Validation
  validePar?: string;
  valideLe?: string;
  commentaires?: string;

  createdAt: string;
  updatedAt: string;
}

export interface ChecklistItem {
  id: string;
  categorie: string;
  libelle: string;
  obligatoire: boolean;
  valide: boolean;
  commentaire?: string;
  dateValidation?: string;
  documentUrl?: string;
}

// Template checklist
export const CHECKLIST_DEMARRAGE_ITEMS: Omit<ChecklistItem, 'id' | 'valide' | 'commentaire' | 'dateValidation' | 'documentUrl'>[] = [
  // Documents administratifs
  { categorie: 'Documents administratifs', libelle: 'PC/DP affiché sur site', obligatoire: true },
  { categorie: 'Documents administratifs', libelle: 'Ordre de service signé', obligatoire: true },
  { categorie: 'Documents administratifs', libelle: 'DICT envoyées + retours reçus', obligatoire: true },
  { categorie: 'Documents administratifs', libelle: 'DOC déposée mairie', obligatoire: false },
  { categorie: 'Documents administratifs', libelle: 'Autorisation voirie obtenue', obligatoire: false },

  // Assurances
  { categorie: 'Assurances', libelle: 'Attestations décennale entreprises', obligatoire: true },
  { categorie: 'Assurances', libelle: 'Dommage-ouvrage souscrit', obligatoire: true },
  { categorie: 'Assurances', libelle: 'RC Pro entreprises', obligatoire: true },

  // Sécurité
  { categorie: 'Sécurité', libelle: 'PPSPS reçus et validés', obligatoire: true },
  { categorie: 'Sécurité', libelle: 'PGC établi (si coordination SPS)', obligatoire: false },
  { categorie: 'Sécurité', libelle: 'Registre SPS ouvert', obligatoire: false },
  { categorie: 'Sécurité', libelle: 'EPI disponibles', obligatoire: true },
  { categorie: 'Sécurité', libelle: 'Extincteurs en place', obligatoire: true },
  { categorie: 'Sécurité', libelle: 'Numéros urgence affichés', obligatoire: true },

  // Installation chantier
  { categorie: 'Installation chantier', libelle: 'Base vie installée', obligatoire: true },
  { categorie: 'Installation chantier', libelle: 'Électricité provisoire raccordée', obligatoire: true },
  { categorie: 'Installation chantier', libelle: 'Eau provisoire raccordée', obligatoire: true },
  { categorie: 'Installation chantier', libelle: 'Sanitaires installés', obligatoire: true },
  { categorie: 'Installation chantier', libelle: 'Balisage/clôture périmètre', obligatoire: true },
  { categorie: 'Installation chantier', libelle: 'Zones stockage délimitées', obligatoire: true },

  // Documents techniques
  { categorie: 'Documents techniques', libelle: 'Plans d\'exécution diffusés', obligatoire: true },
  { categorie: 'Documents techniques', libelle: 'Planning validé et diffusé', obligatoire: true },
  { categorie: 'Documents techniques', libelle: 'Annuaire contacts établi', obligatoire: true },
  { categorie: 'Documents techniques', libelle: 'Règlement intérieur chantier', obligatoire: false },

  // Contrat
  { categorie: 'Contrat', libelle: 'Contrat signé toutes parties', obligatoire: true },
  { categorie: 'Contrat', libelle: 'Caution bancaire reçue (si applicable)', obligatoire: false },
  { categorie: 'Contrat', libelle: 'Retenue de garantie définie', obligatoire: true },
];

// Inputs création
export interface CreateApprovisionnementInput {
  chantierId: string;
  tacheId?: string;
  designation: string;
  reference?: string;
  fournisseur?: string;
  quantite: number;
  unite?: string;
  dateLivraisonPrevue?: string;
  delaiFabricationJours?: number;
}

export interface CreateDocumentInput {
  chantierId: string;
  type: TypeDocumentChantier;
  nom: string;
  description?: string;
  dateExpiration?: string;
  fourniPar?: string;
}

export interface CreateJournalInput {
  chantierId: string;
  dateJournal: string;
  meteo?: JournalChantier['meteo'];
  effectifs?: EffectifJour[];
  travauxRealises?: TravailJour[];
  observations?: string;
  incidents?: string;
}
