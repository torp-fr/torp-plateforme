/**
 * Types Phase 2 - Planning d'exécution
 * Structure WBS, tâches, dépendances, Gantt
 */

// Statuts
export type StatutTache =
  | 'a_planifier'
  | 'planifiee'
  | 'en_cours'
  | 'en_attente'
  | 'terminee'
  | 'annulee';

export type TypeDependance =
  | 'fin_debut'    // FD: B démarre quand A finit
  | 'debut_debut'  // DD: B démarre quand A démarre
  | 'fin_fin'      // FF: B finit quand A finit
  | 'debut_fin';   // DF: B finit quand A démarre

export type TypeContrainte =
  | 'aucune'
  | 'debut_au_plus_tot'
  | 'debut_au_plus_tard'
  | 'fin_au_plus_tot'
  | 'fin_au_plus_tard'
  | 'date_fixe';

// Interfaces principales

// Lot (niveau WBS haut)
export interface PlanningLot {
  id: string;
  chantierId: string;
  parentId?: string;

  // Hiérarchie
  ordre: number;
  niveau: number;
  codeWbs?: string;

  // Identification
  nom: string;
  description?: string;

  // Entreprise
  entrepriseId?: string;
  entrepriseNom?: string;

  // Dates planifiées
  dateDebutPrevue?: string;
  dateFinPrevue?: string;
  dureePrevueJours?: number;

  // Dates réelles
  dateDebutReelle?: string;
  dateFinReelle?: string;

  // Avancement
  avancement: number;

  // Chemin critique
  estCritique: boolean;
  margeTotaleJours?: number;
  margeLibreJours?: number;

  // Statut
  statut: StatutTache;

  // Ressources
  ressources: Ressource[];

  // Enfants (pour arborescence)
  children?: PlanningLot[];
  taches?: PlanningTache[];

  // Timestamps
  createdAt: string;
  updatedAt: string;
}

// Tâche détaillée
export interface PlanningTache {
  id: string;
  lotId: string;
  chantierId: string;
  parentId?: string;

  // Hiérarchie
  ordre: number;
  codeWbs?: string;

  // Identification
  nom: string;
  description?: string;

  // Dates planifiées
  dateDebut: string;
  dateFin: string;
  dureeJours: number;

  // Dates réelles
  dateDebutReelle?: string;
  dateFinReelle?: string;

  // Avancement
  avancement: number;

  // Chemin critique
  estCritique: boolean;
  margeTotaleJours?: number;
  margeLibreJours?: number;

  // Contraintes
  contrainteType?: TypeContrainte;
  contrainteDate?: string;

  // Statut
  statut: StatutTache;

  // Point d'arrêt
  estPointArret: boolean;
  pointArretDescription?: string;
  pointArretValide?: boolean;
  pointArretDateValidation?: string;

  // Ressources
  ressources: Ressource[];

  // Notes
  notes?: string;

  // Relations
  predecesseurs?: TacheDependance[];
  successeurs?: TacheDependance[];

  // Timestamps
  createdAt: string;
  updatedAt: string;
}

// Dépendance entre tâches
export interface TacheDependance {
  id: string;
  chantierId: string;
  tachePredecesseurId: string;
  tacheSuccesseurId: string;
  type: TypeDependance;
  decalageJours: number;

  // Pour affichage
  tachePredecesseur?: { id: string; nom: string };
  tacheSuccesseur?: { id: string; nom: string };

  createdAt: string;
}

// Ressource (humaine ou matérielle)
export interface Ressource {
  id: string;
  type: 'humaine' | 'materielle';
  nom: string;
  quantite?: number;
  unite?: string;
  cout?: number;
}

// Vue Gantt
export interface GanttTask {
  id: string;
  name: string;
  start: Date;
  end: Date;
  progress: number;
  type: 'project' | 'task' | 'milestone';
  dependencies?: string[];
  isDisabled?: boolean;
  styles?: {
    backgroundColor?: string;
    progressColor?: string;
    progressSelectedColor?: string;
  };
  // Données additionnelles
  lotId?: string;
  estCritique?: boolean;
  estPointArret?: boolean;
}

// Chemin critique
export interface CheminCritique {
  taches: PlanningTache[];
  dureeTotaleJours: number;
  dateDebutProjet: string;
  dateFinProjet: string;
}

// Simulation retard
export interface SimulationRetard {
  tacheId: string;
  retardJours: number;
  impactDateFinProjet: number;
  tachesImpactees: {
    id: string;
    nom: string;
    nouveauDebut: string;
    nouvelleFin: string;
  }[];
}

// Inputs création
export interface CreateLotInput {
  chantierId: string;
  parentId?: string;
  nom: string;
  description?: string;
  entrepriseId?: string;
  entrepriseNom?: string;
  dateDebutPrevue?: string;
  dateFinPrevue?: string;
  ordre?: number;
}

export interface CreateTacheInput {
  lotId: string;
  chantierId: string;
  parentId?: string;
  nom: string;
  description?: string;
  dateDebut: string;
  dateFin: string;
  dureeJours?: number;
  contrainteType?: TypeContrainte;
  contrainteDate?: string;
  estPointArret?: boolean;
  pointArretDescription?: string;
  ressources?: Ressource[];
  ordre?: number;
}

export interface CreateDependanceInput {
  chantierId: string;
  tachePredecesseurId: string;
  tacheSuccesseurId: string;
  type: TypeDependance;
  decalageJours?: number;
}

// Mise à jour avancement
export interface UpdateAvancementInput {
  tacheId: string;
  avancement: number;
  dateDebutReelle?: string;
  dateFinReelle?: string;
  statut?: StatutTache;
  notes?: string;
}

// Export/Import
export interface PlanningExport {
  lots: PlanningLot[];
  taches: PlanningTache[];
  dependances: TacheDependance[];
  exportDate: string;
  chantierId: string;
  chantierNom: string;
}
