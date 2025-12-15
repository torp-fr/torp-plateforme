/**
 * TORP Phase 2 - Planning Agent
 * Agent IA pour génération automatique de planning avec durées types BTP
 */

import { supabase } from '@/integrations/supabase/client';

// Types
interface PlanningGenerationInput {
  projectId: string;
  chantierId: string;
  lots: { code: string; name: string; estimatedDuration?: number }[];
  startDate: string;
  constraints?: {
    maxDuration?: number;
    parallelizationLevel?: 'low' | 'medium' | 'high';
    weatherSensitive?: boolean;
  };
}

interface GeneratedPlanning {
  lots: GeneratedLot[];
  totalDuration: number;
  criticalPath: string[];
  warnings: string[];
}

interface GeneratedLot {
  code: string;
  name: string;
  tasks: GeneratedTask[];
  duration: number;
}

interface GeneratedTask {
  id: string;
  name: string;
  duration: number;
  predecessors: { taskId: string; type: 'FS' | 'SS' | 'FF' | 'SF'; lag: number }[];
  resources: string[];
  isCritical?: boolean;
}

interface TaskDecomposition {
  name: string;
  durationRatio: number;
  predecessors?: { taskId: string; type: 'FS' | 'SS' | 'FF' | 'SF'; lag: number }[];
  resources?: string[];
}

interface OptimizationResult {
  recommendations: string[];
  potentialGain: { days?: number; cost?: number };
  proposedChanges: Array<{
    taskId: string;
    change: string;
    impact: string;
  }>;
}

interface DelaySimulationResult {
  impactedTasks: string[];
  newEndDate: string;
  criticalPathChanged: boolean;
  additionalDays: number;
}

/**
 * Agent IA spécialisé dans la planification de chantiers BTP
 */
class PlanningAgent {
  /**
   * Durées types par type de travaux (en jours ouvrés)
   * Basées sur les références métier BTP
   */
  private readonly DUREES_TYPES: Record<string, { min: number; typical: number; max: number }> = {
    // Gros œuvre
    'demolition': { min: 3, typical: 5, max: 10 },
    'terrassement': { min: 2, typical: 4, max: 8 },
    'fondations': { min: 5, typical: 10, max: 20 },
    'elevation_murs': { min: 10, typical: 20, max: 40 },
    'dalle_plancher': { min: 3, typical: 5, max: 10 },
    'charpente': { min: 5, typical: 10, max: 15 },
    'couverture': { min: 5, typical: 8, max: 15 },

    // Second œuvre
    'menuiseries_ext': { min: 2, typical: 5, max: 10 },
    'isolation': { min: 5, typical: 10, max: 20 },
    'plomberie': { min: 5, typical: 10, max: 20 },
    'electricite': { min: 5, typical: 12, max: 25 },
    'chauffage': { min: 3, typical: 7, max: 15 },
    'platrerie': { min: 5, typical: 10, max: 20 },
    'cloisons': { min: 3, typical: 7, max: 15 },
    'ventilation': { min: 2, typical: 5, max: 10 },

    // Finitions
    'carrelage': { min: 3, typical: 7, max: 15 },
    'peinture': { min: 5, typical: 10, max: 20 },
    'parquet': { min: 2, typical: 5, max: 10 },
    'menuiseries_int': { min: 3, typical: 6, max: 12 },
    'revetements_sols': { min: 3, typical: 6, max: 12 },
    'faience': { min: 2, typical: 4, max: 8 },

    // Extérieurs
    'vrd': { min: 5, typical: 10, max: 20 },
    'amenagements_ext': { min: 3, typical: 7, max: 15 },
    'clotures': { min: 2, typical: 4, max: 8 },

    // Par défaut
    'default': { min: 5, typical: 10, max: 20 },
  };

  /**
   * Dépendances types entre lots (prédécesseurs standards)
   */
  private readonly DEPENDANCES_TYPES: Record<string, string[]> = {
    'fondations': ['terrassement'],
    'elevation_murs': ['fondations'],
    'dalle_plancher': ['elevation_murs'],
    'charpente': ['elevation_murs'],
    'couverture': ['charpente'],
    'menuiseries_ext': ['couverture'],
    'isolation': ['menuiseries_ext'],
    'plomberie': ['isolation'],
    'electricite': ['isolation'],
    'chauffage': ['plomberie'],
    'ventilation': ['isolation'],
    'platrerie': ['electricite', 'plomberie', 'chauffage'],
    'cloisons': ['platrerie'],
    'carrelage': ['platrerie'],
    'faience': ['plomberie'],
    'peinture': ['platrerie', 'cloisons'],
    'parquet': ['peinture'],
    'revetements_sols': ['peinture'],
    'menuiseries_int': ['peinture'],
  };

  /**
   * Mapping codes lots vers types de durées
   */
  private readonly LOT_CODE_MAPPING: Record<string, string> = {
    'GO': 'elevation_murs',
    'GROS_OEUVRE': 'elevation_murs',
    'DEMO': 'demolition',
    'TERR': 'terrassement',
    'FOND': 'fondations',
    'CHARP': 'charpente',
    'COUV': 'couverture',
    'MENU_EXT': 'menuiseries_ext',
    'ISO': 'isolation',
    'PLOMB': 'plomberie',
    'ELEC': 'electricite',
    'CHAUF': 'chauffage',
    'CLIM': 'chauffage',
    'VMC': 'ventilation',
    'PLAT': 'platrerie',
    'CLOIS': 'cloisons',
    'CARR': 'carrelage',
    'PEINT': 'peinture',
    'PARQ': 'parquet',
    'MENU_INT': 'menuiseries_int',
    'VRD': 'vrd',
    'AME_EXT': 'amenagements_ext',
  };

  /**
   * Génère un planning complet pour un chantier
   */
  async generatePlanning(input: PlanningGenerationInput): Promise<GeneratedPlanning> {
    const { lots, startDate, constraints } = input;
    const warnings: string[] = [];

    // 1. Générer les tâches pour chaque lot
    const generatedLots: GeneratedLot[] = [];
    let currentStartDate = new Date(startDate);
    const allTasks: GeneratedTask[] = [];

    for (const lot of lots) {
      const lotType = this.getLotType(lot.code);
      const durees = this.DUREES_TYPES[lotType] || this.DUREES_TYPES['default'];

      // Ajuster selon contraintes
      let duration = lot.estimatedDuration || durees.typical;
      if (constraints?.maxDuration && duration > constraints.maxDuration / lots.length) {
        duration = Math.ceil(constraints.maxDuration / lots.length);
        warnings.push(`Durée du lot ${lot.code} ajustée pour respecter la contrainte de durée maximale`);
      }

      // Générer les tâches du lot
      const lotTasks = await this.generateLotTasks(lot.code, lot.name, duration);

      // Ajouter les dépendances inter-lots
      const predecessorLots = this.DEPENDANCES_TYPES[lotType] || [];
      if (predecessorLots.length > 0 && lotTasks.length > 0) {
        const predLots = generatedLots.filter(l =>
          predecessorLots.some(pred => this.getLotType(l.code) === pred)
        );
        if (predLots.length > 0) {
          // La première tâche du lot dépend de la dernière tâche des lots prédécesseurs
          const predTask = predLots[predLots.length - 1].tasks.slice(-1)[0];
          if (predTask) {
            lotTasks[0].predecessors = [{
              taskId: predTask.id,
              type: 'FS',
              lag: 0,
            }];
          }
        }
      }

      allTasks.push(...lotTasks);

      generatedLots.push({
        code: lot.code,
        name: lot.name,
        tasks: lotTasks,
        duration,
      });
    }

    // 2. Calculer la durée totale en tenant compte des parallélisations
    const totalDuration = this.calculateTotalDurationWithParallelization(
      generatedLots,
      constraints?.parallelizationLevel || 'medium'
    );

    // 3. Identifier le chemin critique
    const criticalPath = this.calculateCriticalPathSimplified(allTasks);

    // 4. Avertissements météo si applicable
    if (constraints?.weatherSensitive) {
      const startMonth = new Date(startDate).getMonth();
      if (startMonth >= 10 || startMonth <= 2) {
        warnings.push('Période hivernale : prévoir des marges pour intempéries');
      }
    }

    // 5. Vérification de cohérence
    if (totalDuration > 365) {
      warnings.push('Durée totale supérieure à 1 an : vérifier le planning');
    }

    return {
      lots: generatedLots,
      totalDuration,
      criticalPath,
      warnings,
    };
  }

  /**
   * Génère les tâches détaillées pour un lot spécifique
   */
  async generateLotTasks(
    lotCode: string,
    lotName: string,
    totalDuration: number
  ): Promise<GeneratedTask[]> {
    const decomposition = this.getLotDecomposition(lotCode);
    const tasks: GeneratedTask[] = [];
    let previousTaskId: string | null = null;

    for (let i = 0; i < decomposition.length; i++) {
      const task = decomposition[i];
      const taskId = `${lotCode}-${i + 1}`;
      const duration = Math.max(1, Math.ceil(totalDuration * task.durationRatio));

      const predecessors: GeneratedTask['predecessors'] = [];
      if (previousTaskId) {
        predecessors.push({ taskId: previousTaskId, type: 'FS', lag: 0 });
      }
      if (task.predecessors) {
        predecessors.push(...task.predecessors);
      }

      tasks.push({
        id: taskId,
        name: task.name,
        duration,
        predecessors,
        resources: task.resources || [],
      });

      previousTaskId = taskId;
    }

    return tasks;
  }

  /**
   * Optimise un planning existant selon un objectif
   */
  async optimizePlanning(
    chantierId: string,
    objective: 'duration' | 'cost' | 'resources'
  ): Promise<OptimizationResult> {
    // Récupérer planning actuel
    const { data: lots } = await supabase
      .from('phase2_planning_lots')
      .select('*, phase2_planning_taches(*)')
      .eq('chantier_id', chantierId);

    if (!lots || lots.length === 0) {
      return {
        recommendations: ['Aucun lot défini - créez d\'abord un planning'],
        potentialGain: {},
        proposedChanges: [],
      };
    }

    const recommendations: string[] = [];
    const proposedChanges: OptimizationResult['proposedChanges'] = [];
    let potentialGainDays = 0;

    // Analyser selon l'objectif
    if (objective === 'duration') {
      // Identifier les tâches parallélisables
      for (const lot of lots) {
        const taches = lot.phase2_planning_taches || [];
        for (const tache of taches) {
          // Vérifier si la tâche peut être parallélisée
          if (!tache.predecessors || tache.predecessors.length === 0) {
            recommendations.push(
              `Tâche "${tache.nom}" sans prédécesseur - vérifier si elle peut démarrer plus tôt`
            );
          }
        }
      }

      // Identifier les buffers inutiles
      for (const lot of lots) {
        const taches = lot.phase2_planning_taches || [];
        for (let i = 0; i < taches.length - 1; i++) {
          const current = taches[i];
          const next = taches[i + 1];
          if (current.date_fin_prevue && next.date_debut_prevue) {
            const gap = this.daysBetween(current.date_fin_prevue, next.date_debut_prevue);
            if (gap > 2) {
              proposedChanges.push({
                taskId: next.id,
                change: `Avancer de ${gap - 1} jours`,
                impact: `Réduction durée totale de ${gap - 1} jours`,
              });
              potentialGainDays += gap - 1;
            }
          }
        }
      }

      if (potentialGainDays > 0) {
        recommendations.push(
          `Optimisation possible : réduction de ${potentialGainDays} jours en réduisant les délais entre tâches`
        );
      }
    }

    if (objective === 'resources') {
      // Identifier les conflits de ressources (même entreprise sur plusieurs lots)
      const resourceConflicts = this.detectResourceConflicts(lots);
      for (const conflict of resourceConflicts) {
        recommendations.push(conflict);
      }
    }

    if (recommendations.length === 0) {
      recommendations.push('Planning déjà optimisé selon les critères standard');
    }

    return {
      recommendations,
      potentialGain: { days: potentialGainDays || undefined },
      proposedChanges,
    };
  }

  /**
   * Simule l'impact d'un retard sur une tâche
   */
  simulateDelay(
    tasks: GeneratedTask[],
    taskId: string,
    delayDays: number
  ): DelaySimulationResult {
    const impactedTasks: string[] = [];
    const taskMap = new Map(tasks.map(t => [t.id, t]));

    // Fonction récursive pour trouver les successeurs
    const findSuccessors = (id: string, visited: Set<string> = new Set()) => {
      if (visited.has(id)) return;
      visited.add(id);

      tasks.forEach(task => {
        if (task.predecessors?.some(p => p.taskId === id)) {
          if (!impactedTasks.includes(task.id)) {
            impactedTasks.push(task.id);
            findSuccessors(task.id, visited);
          }
        }
      });
    };

    findSuccessors(taskId);

    // Vérifier si le chemin critique est impacté
    const criticalPath = this.calculateCriticalPathSimplified(tasks);
    const criticalPathChanged = criticalPath.includes(taskId) ||
      impactedTasks.some(t => criticalPath.includes(t));

    // Calculer nouvelle date de fin (simplifiée)
    const additionalDays = criticalPathChanged ? delayDays : 0;

    return {
      impactedTasks,
      newEndDate: 'À recalculer avec dates réelles',
      criticalPathChanged,
      additionalDays,
    };
  }

  /**
   * Retourne la décomposition standard d'un lot en tâches
   */
  private getLotDecomposition(lotCode: string): TaskDecomposition[] {
    const upperCode = lotCode.toUpperCase();

    const decompositions: Record<string, TaskDecomposition[]> = {
      'GO': [
        { name: 'Implantation', durationRatio: 0.05, resources: ['Géomètre'] },
        { name: 'Terrassement', durationRatio: 0.15, resources: ['Terrassier', 'Pelleteuse'] },
        { name: 'Fondations', durationRatio: 0.25, resources: ['Maçon', 'Ferrailleur'] },
        { name: 'Élévation murs', durationRatio: 0.40, resources: ['Maçon'] },
        { name: 'Plancher haut', durationRatio: 0.15, resources: ['Maçon', 'Ferrailleur'] },
      ],
      'GROS_OEUVRE': [
        { name: 'Implantation', durationRatio: 0.05, resources: ['Géomètre'] },
        { name: 'Terrassement', durationRatio: 0.15, resources: ['Terrassier'] },
        { name: 'Fondations', durationRatio: 0.25, resources: ['Maçon'] },
        { name: 'Élévation', durationRatio: 0.40, resources: ['Maçon'] },
        { name: 'Plancher', durationRatio: 0.15, resources: ['Maçon'] },
      ],
      'ELEC': [
        { name: 'Passage gaines', durationRatio: 0.30, resources: ['Électricien'] },
        { name: 'Câblage', durationRatio: 0.35, resources: ['Électricien'] },
        { name: 'Appareillage', durationRatio: 0.25, resources: ['Électricien'] },
        { name: 'Mise en service Consuel', durationRatio: 0.10, resources: ['Électricien'] },
      ],
      'PLOMB': [
        { name: 'Réseaux EU/EV', durationRatio: 0.30, resources: ['Plombier'] },
        { name: 'Distribution EF/EC', durationRatio: 0.35, resources: ['Plombier'] },
        { name: 'Pose appareils sanitaires', durationRatio: 0.25, resources: ['Plombier'] },
        { name: 'Mise en service', durationRatio: 0.10, resources: ['Plombier'] },
      ],
      'CHAUF': [
        { name: 'Installation chaudière/PAC', durationRatio: 0.25, resources: ['Chauffagiste'] },
        { name: 'Réseaux', durationRatio: 0.35, resources: ['Chauffagiste'] },
        { name: 'Pose émetteurs', durationRatio: 0.30, resources: ['Chauffagiste'] },
        { name: 'Mise en service', durationRatio: 0.10, resources: ['Chauffagiste'] },
      ],
      'PLAT': [
        { name: 'Ossature', durationRatio: 0.20, resources: ['Plaquiste'] },
        { name: 'Isolation', durationRatio: 0.25, resources: ['Plaquiste'] },
        { name: 'Plaque de plâtre', durationRatio: 0.35, resources: ['Plaquiste'] },
        { name: 'Joints et finitions', durationRatio: 0.20, resources: ['Plaquiste'] },
      ],
      'PEINT': [
        { name: 'Préparation supports', durationRatio: 0.25, resources: ['Peintre'] },
        { name: 'Sous-couche', durationRatio: 0.20, resources: ['Peintre'] },
        { name: 'Peinture finition', durationRatio: 0.40, resources: ['Peintre'] },
        { name: 'Retouches', durationRatio: 0.15, resources: ['Peintre'] },
      ],
      'CARR': [
        { name: 'Préparation supports', durationRatio: 0.15, resources: ['Carreleur'] },
        { name: 'Pose carrelage', durationRatio: 0.60, resources: ['Carreleur'] },
        { name: 'Joints', durationRatio: 0.20, resources: ['Carreleur'] },
        { name: 'Nettoyage', durationRatio: 0.05, resources: ['Carreleur'] },
      ],
      'MENU_EXT': [
        { name: 'Pose menuiseries', durationRatio: 0.70, resources: ['Menuisier'] },
        { name: 'Calfeutrement', durationRatio: 0.20, resources: ['Menuisier'] },
        { name: 'Réglages finaux', durationRatio: 0.10, resources: ['Menuisier'] },
      ],
      'MENU_INT': [
        { name: 'Pose portes', durationRatio: 0.50, resources: ['Menuisier'] },
        { name: 'Pose placards', durationRatio: 0.35, resources: ['Menuisier'] },
        { name: 'Finitions', durationRatio: 0.15, resources: ['Menuisier'] },
      ],
      'COUV': [
        { name: 'Écran sous-toiture', durationRatio: 0.15, resources: ['Couvreur'] },
        { name: 'Couverture', durationRatio: 0.55, resources: ['Couvreur'] },
        { name: 'Zinguerie', durationRatio: 0.20, resources: ['Couvreur', 'Zingueur'] },
        { name: 'Finitions', durationRatio: 0.10, resources: ['Couvreur'] },
      ],
      'CHARP': [
        { name: 'Levage charpente', durationRatio: 0.50, resources: ['Charpentier', 'Grutier'] },
        { name: 'Assemblage', durationRatio: 0.35, resources: ['Charpentier'] },
        { name: 'Contreventement', durationRatio: 0.15, resources: ['Charpentier'] },
      ],
      'ISO': [
        { name: 'Isolation murs', durationRatio: 0.40, resources: ['Isoleur'] },
        { name: 'Isolation combles', durationRatio: 0.35, resources: ['Isoleur'] },
        { name: 'Pare-vapeur et finitions', durationRatio: 0.25, resources: ['Isoleur'] },
      ],
      'VRD': [
        { name: 'Terrassement', durationRatio: 0.30, resources: ['Terrassier'] },
        { name: 'Réseaux enterrés', durationRatio: 0.40, resources: ['VRD'] },
        { name: 'Voirie', durationRatio: 0.30, resources: ['VRD'] },
      ],
    };

    // Chercher correspondance exacte ou partielle
    if (decompositions[upperCode]) {
      return decompositions[upperCode];
    }

    // Chercher correspondance partielle
    for (const [key, value] of Object.entries(decompositions)) {
      if (upperCode.includes(key) || key.includes(upperCode)) {
        return value;
      }
    }

    // Décomposition par défaut
    return [
      { name: 'Préparation', durationRatio: 0.10, resources: [] },
      { name: 'Exécution', durationRatio: 0.70, resources: [] },
      { name: 'Contrôles', durationRatio: 0.10, resources: [] },
      { name: 'Finitions', durationRatio: 0.10, resources: [] },
    ];
  }

  /**
   * Retourne le type de lot pour le mapping des durées
   */
  private getLotType(lotCode: string): string {
    const upperCode = lotCode.toUpperCase();

    // Correspondance exacte
    if (this.LOT_CODE_MAPPING[upperCode]) {
      return this.LOT_CODE_MAPPING[upperCode];
    }

    // Correspondance partielle
    for (const [key, value] of Object.entries(this.LOT_CODE_MAPPING)) {
      if (upperCode.includes(key) || key.includes(upperCode)) {
        return value;
      }
    }

    // Recherche par nom
    const lowerCode = lotCode.toLowerCase();
    for (const key of Object.keys(this.DUREES_TYPES)) {
      if (lowerCode.includes(key) || key.includes(lowerCode)) {
        return key;
      }
    }

    return 'default';
  }

  /**
   * Calcule la durée totale en tenant compte des parallélisations
   */
  private calculateTotalDurationWithParallelization(
    lots: GeneratedLot[],
    parallelizationLevel: 'low' | 'medium' | 'high'
  ): number {
    const sumDurations = lots.reduce((sum, lot) => sum + lot.duration, 0);

    // Facteur de parallélisation
    const factors: Record<string, number> = {
      'low': 0.9,      // Peu de parallélisation
      'medium': 0.7,   // Parallélisation standard
      'high': 0.5,     // Forte parallélisation
    };

    const factor = factors[parallelizationLevel];

    // La durée minimale est la durée du lot le plus long
    const maxLotDuration = Math.max(...lots.map(l => l.duration));
    const calculatedDuration = Math.ceil(sumDurations * factor);

    return Math.max(maxLotDuration, calculatedDuration);
  }

  /**
   * Calcul simplifié du chemin critique
   */
  private calculateCriticalPathSimplified(tasks: GeneratedTask[]): string[] {
    if (tasks.length === 0) return [];

    // Identifier les tâches sans successeur (fin de chaîne)
    const hasSuccessor = new Set<string>();
    tasks.forEach(task => {
      task.predecessors?.forEach(pred => {
        hasSuccessor.add(pred.taskId);
      });
    });

    // Trouver le chemin le plus long
    const criticalPath: string[] = [];

    // Simplification : on prend les tâches les plus longues sans successeur
    const endTasks = tasks.filter(t => !hasSuccessor.has(t.id));
    if (endTasks.length > 0) {
      // Remonter la chaîne depuis la tâche finale la plus longue
      let current = endTasks.reduce((a, b) => a.duration > b.duration ? a : b);
      criticalPath.push(current.id);

      while (current.predecessors && current.predecessors.length > 0) {
        const predId = current.predecessors[0].taskId;
        const pred = tasks.find(t => t.id === predId);
        if (pred) {
          criticalPath.unshift(pred.id);
          current = pred;
        } else {
          break;
        }
      }
    }

    return criticalPath;
  }

  /**
   * Détecte les conflits de ressources
   */
  private detectResourceConflicts(lots: Array<{ code: string; nom: string; phase2_planning_taches?: any[] }>): string[] {
    const conflicts: string[] = [];
    const resourceUsage: Map<string, string[]> = new Map();

    for (const lot of lots) {
      const taches = lot.phase2_planning_taches || [];
      for (const tache of taches) {
        // Extraire ressources des métadonnées si disponibles
        const resources = tache.metadata?.resources || [];
        for (const resource of resources) {
          if (!resourceUsage.has(resource)) {
            resourceUsage.set(resource, []);
          }
          resourceUsage.get(resource)!.push(`${lot.code}: ${tache.nom}`);
        }
      }
    }

    // Identifier les ressources utilisées sur plusieurs tâches
    for (const [resource, usages] of resourceUsage) {
      if (usages.length > 2) {
        conflicts.push(
          `Ressource "${resource}" utilisée sur ${usages.length} tâches - vérifier les conflits d'agenda`
        );
      }
    }

    return conflicts;
  }

  /**
   * Calcule le nombre de jours entre deux dates
   */
  private daysBetween(date1: string, date2: string): number {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    const diffTime = Math.abs(d2.getTime() - d1.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
}

// Export singleton
export const planningAgent = new PlanningAgent();
export { PlanningAgent };
export type {
  PlanningGenerationInput,
  GeneratedPlanning,
  GeneratedLot,
  GeneratedTask,
  OptimizationResult,
  DelaySimulationResult,
};
