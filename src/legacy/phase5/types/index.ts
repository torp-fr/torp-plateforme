/**
 * Phase 5 Types - Maintenance & Exploitation (LEGACY)
 * Types pour le carnet numérique et la gestion long terme du bien
 * These types are archived and maintained for backwards compatibility
 */

// =============================================================================
// CARNET NUMÉRIQUE
// =============================================================================

export interface CarnetNumerique {
  id: string;
  project_id: string;
  bien: BienImmobilier;
  travaux_historique: TravauxHistorique[];
  diagnostics: DiagnosticCarnet[];
  entretiens: EntretienProgramme[];
  garanties: GarantieActive[];
  sinistres: Sinistre[];
  documents: DocumentCarnet[];
  created_at: string;
  updated_at: string;
}

export interface BienImmobilier {
  adresse: string;
  type: 'maison' | 'appartement' | 'immeuble' | 'local_commercial';
  surface_habitable: number;
  surface_terrain?: number;
  annee_construction?: number;
  dpe?: string;
  ges?: string;
  reference_cadastrale?: string;
}

// =============================================================================
// HISTORIQUE DES TRAVAUX
// =============================================================================

export interface TravauxHistorique {
  id: string;
  date_realisation: string;
  type: 'renovation' | 'extension' | 'entretien' | 'reparation' | 'amelioration';
  description: string;
  lots: string[];
  entreprises: EntrepriseIntervenue[];
  montant_total: number;
  documents: string[];
  garanties: {
    type: 'parfait_achevement' | 'biennale' | 'decennale';
    date_fin: string;
  }[];
  photos?: string[];
}

export interface EntrepriseIntervenue {
  nom: string;
  siret?: string;
  lot: string;
  contact?: string;
  telephone?: string;
  email?: string;
}

// =============================================================================
// DIAGNOSTICS
// =============================================================================

export interface DiagnosticCarnet {
  id: string;
  type: DiagnosticType;
  date_realisation: string;
  date_validite: string;
  resultat?: string;
  note?: string;
  diagnostiqueur: {
    nom: string;
    certification?: string;
  };
  document_url?: string;
  statut: 'valide' | 'expire' | 'a_renouveler';
}

export type DiagnosticType =
  | 'dpe'
  | 'amiante'
  | 'plomb'
  | 'electricite'
  | 'gaz'
  | 'termites'
  | 'erp'
  | 'assainissement'
  | 'carrez'
  | 'boutin';

// =============================================================================
// ENTRETIEN
// =============================================================================

export interface EntretienProgramme {
  id: string;
  titre: string;
  description: string;
  categorie: CategorieEntretien;
  frequence: FrequenceEntretien;
  derniere_realisation?: string;
  prochaine_echeance: string;
  priorite: 'basse' | 'moyenne' | 'haute';
  cout_estime?: number;
  prestataire_recommande?: string;
  statut: 'a_faire' | 'planifie' | 'realise' | 'en_retard';
}

export type CategorieEntretien =
  | 'chauffage'
  | 'ventilation'
  | 'plomberie'
  | 'electricite'
  | 'toiture'
  | 'facade'
  | 'espaces_verts'
  | 'securite'
  | 'piscine'
  | 'autre';

export type FrequenceEntretien =
  | 'mensuel'
  | 'trimestriel'
  | 'semestriel'
  | 'annuel'
  | 'bi_annuel'
  | 'quinquennal'
  | 'ponctuel';

// =============================================================================
// GARANTIES ACTIVES
// =============================================================================

export interface GarantieActive {
  id: string;
  type: 'parfait_achevement' | 'biennale' | 'decennale' | 'fabricant';
  description: string;
  lot?: string;
  entreprise: {
    nom: string;
    siret?: string;
    telephone?: string;
    email?: string;
  };
  assureur?: {
    nom: string;
    numero_police?: string;
  };
  date_debut: string;
  date_fin: string;
  statut: 'active' | 'expiree';
  documents?: string[];
}

// =============================================================================
// SINISTRES
// =============================================================================

export interface Sinistre {
  id: string;
  date_declaration: string;
  date_survenance: string;
  type: 'degat_des_eaux' | 'incendie' | 'vol' | 'catastrophe_naturelle' | 'malfacon' | 'autre';
  description: string;
  localisation: string;
  photos?: string[];
  garantie_concernee?: string;
  assurance: {
    compagnie: string;
    numero_dossier?: string;
    expert?: string;
  };
  statut: 'declare' | 'expertise' | 'travaux' | 'clos' | 'refuse';
  indemnisation?: number;
  travaux_reparation?: TravauxHistorique;
}

// =============================================================================
// DOCUMENTS
// =============================================================================

export interface DocumentCarnet {
  id: string;
  type: TypeDocumentCarnet;
  nom: string;
  description?: string;
  date_ajout: string;
  date_document?: string;
  url: string;
  taille?: number;
  tags?: string[];
}

export type TypeDocumentCarnet =
  | 'acte_notarie'
  | 'titre_propriete'
  | 'plan'
  | 'facture'
  | 'devis'
  | 'diagnostic'
  | 'attestation_assurance'
  | 'permis_construire'
  | 'declaration_travaux'
  | 'pv_reception'
  | 'garantie'
  | 'notice'
  | 'photo'
  | 'autre';

// =============================================================================
// STATS
// =============================================================================

export interface Phase5Stats {
  garantiesActives: number;
  diagnosticsARenouveler: number;
  entretiensEnRetard: number;
  sinistresEnCours: number;
  prochainEntretien?: EntretienProgramme;
  prochainDiagnostic?: DiagnosticCarnet;
}
