/**
 * Types Phase 3 - Contrôles Réglementaires et Qualité
 * Bureau de contrôle, SPS, Consuel, Qualigaz, auto-contrôles, MOE
 */

// ============================================
// ORGANISMES DE CONTRÔLE
// ============================================

export type TypeOrganismeControle =
  | 'bureau_controle'     // Bureau de contrôle technique (ex: Socotec, Apave)
  | 'sps'                 // Coordonnateur SPS
  | 'consuel'             // Électricité
  | 'qualigaz'            // Gaz
  | 'certigaz'            // Gaz naturel GRDF
  | 'operateur_rt'        // Performance énergétique RE2020/RT2012
  | 'autre';

export type MissionControle =
  | 'L'              // Solidité ouvrages
  | 'S'              // Sécurité personnes
  | 'PS'             // Sécurité incendie
  | 'HAND'           // Accessibilité
  | 'TH'             // Thermique
  | 'PH'             // Phonique
  | 'SEI'            // Sécurité incendie ERP
  | 'DTA'            // Diagnostic technique amiante
  | 'STI'            // Sécurité travail immeubles
  | 'AV'             // Ascenseurs
  | 'autre';

export type StatutMissionControle =
  | 'planifiee'
  | 'en_cours'
  | 'rapport_emis'
  | 'avis_favorable'
  | 'avis_favorable_reserve'
  | 'avis_defavorable'
  | 'cloturee';

export type TypeVisiteControle =
  | 'visite_initiale'
  | 'visite_periodique'
  | 'visite_finale'
  | 'visite_inopinee'
  | 'controle_levee_reserve';

// Organisme de contrôle
export interface OrganismeControle {
  id: string;
  chantierId: string;

  // Identification
  type: TypeOrganismeControle;
  nom: string;
  reference?: string; // Numéro de mission

  // Contact
  contact?: {
    nom: string;
    fonction?: string;
    email?: string;
    telephone?: string;
  };

  // Missions
  missions: MissionBureauControle[];

  // Dates marché
  dateDebut?: string;
  dateFin?: string;

  // Montant
  montantHT?: number;

  // Statut
  statut: 'actif' | 'termine' | 'suspendu';

  createdAt: string;
  updatedAt: string;
}

export interface MissionBureauControle {
  id: string;
  organismeId: string;

  // Mission
  code: MissionControle;
  libelle: string;
  description?: string;

  // Statut
  statut: StatutMissionControle;

  // Rapports
  rapports: RapportControle[];

  // Statistiques réserves
  nombreReserves: number;
  reservesLevees: number;
}

export interface VisiteControle {
  id: string;
  organismeId: string;
  missionId?: string;

  // Type
  type: TypeVisiteControle;

  // Planning
  datePrevue: string;
  dateReelle?: string;
  dureeMinutes?: number;

  // Participants
  controleur?: string;
  accompagnants?: string[];

  // Rapport
  rapport?: RapportControle;

  // Statut
  statut: 'planifiee' | 'effectuee' | 'reportee' | 'annulee';

  // Notes
  observations?: string;

  createdAt: string;
}

export interface RapportControle {
  id: string;
  visiteId?: string;

  // Identification
  numero?: string;
  date: string;
  type: 'initial' | 'intermediaire' | 'final' | 'levee_reserves';

  // Avis
  avis: 'favorable' | 'favorable_reserve' | 'defavorable' | 'en_attente';

  // Réserves/Observations
  reserves: ReserveControle[];
  observations?: string;

  // Document
  documentUrl?: string;

  createdAt: string;
}

export interface ReserveControle {
  id: string;
  rapportId: string;

  // Identification
  numero?: string;

  // Contenu
  localisation: string;
  description: string;
  reference_reglementaire?: string; // Ex: "NF C 15-100 §..."

  // Gravité
  gravite: 'mineure' | 'majeure' | 'critique';

  // Levée
  statut: 'a_lever' | 'en_cours' | 'levee' | 'maintenue';
  dateLimite?: string;

  // Levée effective
  levee?: {
    date: string;
    controlePar: string;
    observations?: string;
    photos?: string[];
  };

  createdAt: string;
  updatedAt: string;
}

// ============================================
// CERTIFICATIONS OBLIGATOIRES
// ============================================

export type TypeCertification =
  | 'consuel_jaune'    // Usage propre
  | 'consuel_bleu'     // Vente/Location
  | 'qualigaz'
  | 'certigaz'
  | 'test_etancheite'  // Q4Pa-surf RE2020
  | 'attestation_fin_travaux_re2020'
  | 'autre';

export type StatutCertification =
  | 'a_demander'
  | 'demande_envoyee'
  | 'rdv_planifie'
  | 'visite_effectuee'
  | 'conforme'
  | 'non_conforme'
  | 'certificat_obtenu';

export interface CertificationObligatoire {
  id: string;
  chantierId: string;

  // Type
  type: TypeCertification;
  organisme: string;

  // Demande
  dateDemande?: string;
  numeroDossier?: string;

  // Visite
  dateVisite?: string;
  controleur?: string;

  // Résultat
  statut: StatutCertification;
  dateObtention?: string;
  numeroCertificat?: string;

  // Documents
  documentDemandeUrl?: string;
  certificatUrl?: string;
  rapportUrl?: string;

  // Coût
  coutHT?: number;

  // Non-conformités
  nonConformites?: NonConformiteCertification[];

  createdAt: string;
  updatedAt: string;
}

export interface NonConformiteCertification {
  id: string;
  description: string;
  localisation?: string;
  gravite: 'mineure' | 'majeure' | 'bloquante';
  corrigee: boolean;
  dateCorrection?: string;
  photos?: string[];
}

// ============================================
// COORDONNATEUR SPS
// ============================================

export type NiveauCoordinationSPS = '1' | '2' | '3';

export type TypeVisiteSPS =
  | 'visite_prealable'
  | 'visite_periodique'
  | 'visite_inopinee'
  | 'visite_alerte'
  | 'inspection_commune';

export interface CoordinateurSPS {
  id: string;
  chantierId: string;

  // Coordonnateur
  organisme?: string;
  nom: string;
  certification?: string; // Niveau de certification

  // Contact
  email?: string;
  telephone?: string;

  // Mission
  niveau: NiveauCoordinationSPS;
  dateDebut: string;
  dateFin?: string;

  // Documents produits
  pgcUrl?: string;           // Plan Général Coordination
  registreJournalUrl?: string;
  diuoUrl?: string;          // Dossier Intervention Ultérieure

  // Visites
  frequenceVisites: 'quotidienne' | 'hebdomadaire' | 'bimensuelle' | 'mensuelle';
  prochainVisite?: string;

  // Statut
  statut: 'actif' | 'termine' | 'suspendu';

  createdAt: string;
  updatedAt: string;
}

export interface VisiteSPS {
  id: string;
  coordinateurId: string;

  // Visite
  type: TypeVisiteSPS;
  date: string;
  dureeMinutes?: number;

  // Observations
  observations: ObservationSPS[];

  // Conclusion
  conclusion?: string;
  actionsCorrectives?: ActionCorrectiveSPS[];

  // Signature
  signatureSPS?: string;
  signatureMO?: string;

  // Rapport
  rapportUrl?: string;

  createdAt: string;
}

export interface ObservationSPS {
  id: string;

  // Localisation
  zone: string;
  entreprise?: string;

  // Observation
  description: string;
  typeRisque: 'chute_hauteur' | 'ensevelissement' | 'electrique' | 'circulation' | 'manutention' | 'chimique' | 'bruit' | 'autre';

  // Gravité
  gravite: 'remarque' | 'observation' | 'danger_grave' | 'danger_imminent';

  // Photos
  photos?: string[];

  // Statut
  statut: 'signale' | 'correction_demandee' | 'corrige' | 'non_corrige';
}

export interface ActionCorrectiveSPS {
  id: string;
  observationId: string;

  // Action
  description: string;
  responsable: string;
  delai: string;

  // Suivi
  statut: 'a_faire' | 'en_cours' | 'fait' | 'non_fait';
  dateRealisation?: string;

  // Validation
  validePar?: string;
}

// ============================================
// AUTO-CONTRÔLES ENTREPRISE
// ============================================

export type TypeAutoControle =
  | 'conformite_cctp'
  | 'respect_dtu'
  | 'tolerances_dimensionnelles'
  | 'finitions'
  | 'essais_fonctionnels'
  | 'etancheite'
  | 'autre';

export type ResultatAutoControle =
  | 'conforme'       // ✅
  | 'reserve_mineure' // ⚠️
  | 'reserve_majeure' // ❌
  | 'non_conforme';   // 🚫

export interface FicheAutoControle {
  id: string;
  chantierId: string;
  lotId?: string;
  tacheId?: string;

  // Identification
  reference?: string;
  entreprise: string;
  lot: string;

  // Objet
  objet: string;
  zone?: string;

  // Date
  dateControle: string;
  controlePar: string;

  // Check-list
  items: ItemAutoControle[];

  // Résultat global
  resultat: ResultatAutoControle;
  observations?: string;

  // Photos
  photos: PhotoAutoControle[];

  // Documents joints
  documents?: DocumentAutoControle[];

  // Validation MOE
  validationMOE?: {
    date: string;
    par: string;
    avis: 'valide' | 'reserve' | 'refuse';
    commentaire?: string;
  };

  createdAt: string;
  updatedAt: string;
}

export interface ItemAutoControle {
  id: string;

  // Point de contrôle
  reference?: string;
  libelle: string;
  critere?: string;
  toleranceMin?: string;
  toleranceMax?: string;

  // Mesure
  valeurMesuree?: string;
  unite?: string;

  // Résultat
  resultat: ResultatAutoControle;
  observation?: string;

  // Photo
  photoUrl?: string;
}

export interface PhotoAutoControle {
  id: string;
  url: string;
  legende?: string;
  zone?: string;
  dateHeure: string;
  geolocalisee?: boolean;
  coordonnees?: { lat: number; lng: number };
}

export interface DocumentAutoControle {
  id: string;
  type: 'pv_essai' | 'fiche_technique' | 'avis_technique' | 'photo' | 'autre';
  nom: string;
  url: string;
}

// ============================================
// CONTRÔLES MOE
// ============================================

export type TypeControleMOE =
  | 'visite_periodique'
  | 'controle_qualite'
  | 'validation_situation'
  | 'opr'
  | 'reception';

export interface VisiteMOE {
  id: string;
  chantierId: string;

  // Type
  type: TypeControleMOE;

  // Date
  date: string;
  dureeMinutes?: number;

  // Participants
  moe: string;
  accompagnants?: string[];

  // Points vérifiés
  pointsVerifies: PointVerificationMOE[];

  // Avancement
  avancementConstate?: number;
  coherenceAvecPlanning: boolean;
  retardEstime?: number; // jours

  // Conclusion
  syntheseGenerale?: string;

  // Validation situation
  situationValidee?: boolean;
  numeroSituation?: number;

  // Document
  compteRenduUrl?: string;

  createdAt: string;
}

export interface PointVerificationMOE {
  id: string;

  // Point
  lot: string;
  zone?: string;
  objet: string;

  // Constatation
  constatation: string;
  conforme: boolean;

  // Action si non-conforme
  action?: {
    description: string;
    responsable: string;
    delai?: string;
    statut: 'a_faire' | 'fait';
  };

  // Photo
  photoUrl?: string;
}

// ============================================
// GRILLE DE CONTRÔLE QUALITÉ
// ============================================

export type CategorieGrilleQualite =
  | 'gros_oeuvre'
  | 'menuiseries'
  | 'plomberie'
  | 'electricite'
  | 'carrelage'
  | 'peinture'
  | 'parquet'
  | 'platrerie'
  | 'isolation'
  | 'couverture'
  | 'etancheite'
  | 'vrd'
  | 'autre';

export interface GrilleControleQualite {
  id: string;
  chantierId: string;

  // Identification
  categorie: CategorieGrilleQualite;
  lot: string;
  zone?: string;

  // Date contrôle
  dateControle: string;
  controlePar: string;
  roleControleur: 'moe' | 'mo' | 'entreprise' | 'bureau_controle';

  // Critères
  criteres: CritereQualite[];

  // Résultat global
  scoreTotal: number;
  scoreObtenu: number;
  pourcentageConformite: number;

  // Synthèse
  syntheseQualite: 'excellent' | 'satisfaisant' | 'insuffisant' | 'inacceptable';
  observations?: string;

  // Réserves
  reserves: ReserveQualite[];

  // Photos
  photos?: PhotoAutoControle[];

  // Validation
  valide: boolean;
  validePar?: string;
  datValidation?: string;

  createdAt: string;
  updatedAt: string;
}

export interface CritereQualite {
  id: string;

  // Critère
  libelle: string;
  referenceNorme?: string; // Ex: DTU 26.1

  // Tolérances
  tolerance?: string; // Ex: "max 1cm/2m"

  // Évaluation
  note: 0 | 1 | 2 | 3; // 0=non applicable, 1=non conforme, 2=réserve, 3=conforme
  observation?: string;

  // Photo
  photoUrl?: string;
}

export interface ReserveQualite {
  id: string;
  grilleId: string;

  // Localisation
  localisation: string;
  critereId?: string;

  // Description
  description: string;

  // Gravité
  gravite: 'mineure' | 'majeure' | 'critique';

  // Photo
  photos?: string[];

  // Suivi
  statut: 'a_corriger' | 'en_correction' | 'corrigee' | 'refusee';
  dateCorrection?: string;
  responsableCorrection?: string;

  // Validation correction
  correctionValidee?: boolean;
  validePar?: string;
  dateValidation?: string;

  createdAt: string;
  updatedAt: string;
}

// ============================================
// TEMPLATES GRILLES QUALITÉ
// ============================================

export interface TemplateGrilleQualite {
  categorie: CategorieGrilleQualite;
  criteres: Omit<CritereQualite, 'id' | 'note' | 'observation' | 'photoUrl'>[];
}

export const TEMPLATE_GRILLE_GROS_OEUVRE: TemplateGrilleQualite = {
  categorie: 'gros_oeuvre',
  criteres: [
    { libelle: 'Planéité des murs', referenceNorme: 'DTU 20.1', tolerance: 'max 1cm/2m' },
    { libelle: 'Verticalité des murs', referenceNorme: 'DTU 20.1', tolerance: 'max 1cm/étage' },
    { libelle: 'Niveaux des dalles', referenceNorme: 'DTU 21', tolerance: '±5mm' },
    { libelle: 'Équerrage des angles', referenceNorme: 'DTU 20.1', tolerance: '±2mm/m' },
    { libelle: 'Alignement des rangs', referenceNorme: 'DTU 20.1', tolerance: '±5mm' },
    { libelle: 'Épaisseur des joints', referenceNorme: 'DTU 20.1', tolerance: '8-15mm' },
    { libelle: 'Enrobage des aciers', referenceNorme: 'NF EN 1992', tolerance: '≥20mm' },
    { libelle: 'Position des réservations', referenceNorme: 'Plans', tolerance: '±20mm' },
  ],
};

export const TEMPLATE_GRILLE_MENUISERIES: TemplateGrilleQualite = {
  categorie: 'menuiseries',
  criteres: [
    { libelle: 'Jeu ouvrant/dormant', referenceNorme: 'DTU 36.5', tolerance: '3-5mm' },
    { libelle: 'Étanchéité à l\'eau', referenceNorme: 'DTU 36.5', tolerance: 'absence infiltration' },
    { libelle: 'Étanchéité à l\'air', referenceNorme: 'DTU 36.5', tolerance: 'joint continu' },
    { libelle: 'Manœuvre ouverture/fermeture', tolerance: 'souplesse, sans effort' },
    { libelle: 'Verticalité du cadre', tolerance: '±2mm/m' },
    { libelle: 'Aplomb des ouvrants', tolerance: '±1mm/m' },
    { libelle: 'Vitrage (pose, joint)', referenceNorme: 'DTU 39', tolerance: 'calage conforme' },
    { libelle: 'Quincaillerie fonctionnelle' },
  ],
};

export const TEMPLATE_GRILLE_CARRELAGE: TemplateGrilleQualite = {
  categorie: 'carrelage',
  criteres: [
    { libelle: 'Planéité générale', referenceNorme: 'DTU 52.1', tolerance: 'max 3mm/2m' },
    { libelle: 'Désaffleur entre carreaux', referenceNorme: 'DTU 52.1', tolerance: 'max 1mm' },
    { libelle: 'Largeur des joints', referenceNorme: 'DTU 52.1', tolerance: 'régularité ±1mm' },
    { libelle: 'Alignement des joints', tolerance: 'rectitude continue' },
    { libelle: 'Remplissage des joints', tolerance: 'complet, affleurant' },
    { libelle: 'Coupes et raccords', tolerance: 'précision, propreté' },
    { libelle: 'Sonorité (carreaux collés)', tolerance: 'absence de sonnant creux' },
    { libelle: 'Joints de fractionnement', referenceNorme: 'DTU 52.1', tolerance: 'tous 40m² ou 8m' },
  ],
};

export const TEMPLATE_GRILLE_PEINTURE: TemplateGrilleQualite = {
  categorie: 'peinture',
  criteres: [
    { libelle: 'Uniformité de la teinte', tolerance: 'lumière rasante' },
    { libelle: 'Absence de coulures', tolerance: 'aucune visible' },
    { libelle: 'Couvrance (opacité)', tolerance: 'fond invisible' },
    { libelle: 'Rechampis (angles)', tolerance: 'nets, rectilignes' },
    { libelle: 'Raccords (retouches)', tolerance: 'invisibles' },
    { libelle: 'Aspect de surface', tolerance: 'tendu, sans défaut' },
    { libelle: 'Protection des menuiseries', tolerance: 'propre, sans trace' },
    { libelle: 'Ponçage entre-couches', tolerance: 'lisse au toucher' },
  ],
};

export const TEMPLATE_GRILLE_ELECTRICITE: TemplateGrilleQualite = {
  categorie: 'electricite',
  criteres: [
    { libelle: 'Continuité des conducteurs', referenceNorme: 'NF C 15-100', tolerance: 'test OK' },
    { libelle: 'Isolement', referenceNorme: 'NF C 15-100', tolerance: '>0.5MΩ' },
    { libelle: 'Terre et équipotentialité', referenceNorme: 'NF C 15-100', tolerance: 'mesure <100Ω' },
    { libelle: 'Disjoncteur différentiel', referenceNorme: 'NF C 15-100', tolerance: 'test fonctionnel' },
    { libelle: 'Calibrage protections', referenceNorme: 'NF C 15-100', tolerance: 'conforme section' },
    { libelle: 'Repérage circuits', referenceNorme: 'NF C 15-100', tolerance: 'étiquetage complet' },
    { libelle: 'Encastrement appareillage', tolerance: 'affleurant, d\'équerre' },
    { libelle: 'GTL et ETEL', referenceNorme: 'NF C 15-100', tolerance: 'dimensions et accès' },
  ],
};

export const TEMPLATE_GRILLE_PLOMBERIE: TemplateGrilleQualite = {
  categorie: 'plomberie',
  criteres: [
    { libelle: 'Étanchéité réseau eau', referenceNorme: 'DTU 60.1', tolerance: 'test pression OK' },
    { libelle: 'Pentes évacuations EU/EV', referenceNorme: 'DTU 60.11', tolerance: '1-3%' },
    { libelle: 'Ventilation primaire', referenceNorme: 'DTU 60.11', tolerance: 'présente et conforme' },
    { libelle: 'Calorifugeage', referenceNorme: 'DTU 60.1', tolerance: 'continu, épaisseur' },
    { libelle: 'Fixations canalisations', referenceNorme: 'DTU 60.1', tolerance: 'espacements normes' },
    { libelle: 'Raccords et joints', tolerance: 'propres, accessibles' },
    { libelle: 'Appareils sanitaires', tolerance: 'fixation, niveau, joints' },
    { libelle: 'Robinetterie', tolerance: 'fonctionnement, étanchéité' },
  ],
};

export const TEMPLATES_GRILLES_QUALITE: Record<CategorieGrilleQualite, TemplateGrilleQualite | null> = {
  gros_oeuvre: TEMPLATE_GRILLE_GROS_OEUVRE,
  menuiseries: TEMPLATE_GRILLE_MENUISERIES,
  carrelage: TEMPLATE_GRILLE_CARRELAGE,
  peinture: TEMPLATE_GRILLE_PEINTURE,
  electricite: TEMPLATE_GRILLE_ELECTRICITE,
  plomberie: TEMPLATE_GRILLE_PLOMBERIE,
  parquet: null,
  platrerie: null,
  isolation: null,
  couverture: null,
  etancheite: null,
  vrd: null,
  autre: null,
};

// ============================================
// INPUTS CRÉATION
// ============================================

export interface CreateOrganismeControleInput {
  chantierId: string;
  type: TypeOrganismeControle;
  nom: string;
  reference?: string;
  contact?: OrganismeControle['contact'];
  missions?: MissionControle[];
  dateDebut?: string;
  montantHT?: number;
}

export interface CreateVisiteControleInput {
  organismeId: string;
  missionId?: string;
  type: TypeVisiteControle;
  datePrevue: string;
  controleur?: string;
}

export interface CreateCertificationInput {
  chantierId: string;
  type: TypeCertification;
  organisme: string;
  coutHT?: number;
}

export interface CreateFicheAutoControleInput {
  chantierId: string;
  lotId?: string;
  tacheId?: string;
  entreprise: string;
  lot: string;
  objet: string;
  zone?: string;
  dateControle: string;
  controlePar: string;
  items: Omit<ItemAutoControle, 'id'>[];
}

export interface CreateGrilleQualiteInput {
  chantierId: string;
  categorie: CategorieGrilleQualite;
  lot: string;
  zone?: string;
  dateControle: string;
  controlePar: string;
  roleControleur: GrilleControleQualite['roleControleur'];
}

// ============================================
// ALERTES ET NOTIFICATIONS
// ============================================

export interface AlerteControle {
  id: string;
  chantierId: string;

  type:
    | 'visite_a_planifier'
    | 'visite_proche'
    | 'reserve_non_levee'
    | 'reserve_depassee'
    | 'certification_manquante'
    | 'non_conformite_grave'
    | 'danger_sps';

  niveau: 'info' | 'warning' | 'error' | 'critical';

  // Référence
  entiteType: 'organisme' | 'certification' | 'reserve' | 'observation_sps' | 'grille';
  entiteId: string;

  // Message
  titre: string;
  message: string;

  // Action
  actionRequise?: string;
  lienAction?: string;

  // Dates
  dateCreation: string;
  dateEcheance?: string;

  // Statut
  lu: boolean;
  traite: boolean;

  createdAt: string;
}
