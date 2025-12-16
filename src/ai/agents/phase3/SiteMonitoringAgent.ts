/**
 * SiteMonitoringAgent - Agent IA pour le suivi de chantier Phase 3
 * Analyse l'avancement, détecte les risques de retard, génère des alertes proactives
 * SÉCURISÉ: Utilise les Edge Functions Supabase (pas de clé API côté client)
 */

import { supabase } from '@/lib/supabase';
import { secureAI } from '@/services/ai/secure-ai.service';

// Types
interface SiteProgress {
  projetId: string;
  dateAnalyse: Date;
  avancementGlobal: number;
  avancementParLot: LotProgress[];
  tendance: 'en_avance' | 'conforme' | 'leger_retard' | 'retard_critique';
  joursPrevus: number;
  joursReels: number;
  ecartJours: number;
}

interface LotProgress {
  lotId: string;
  lotNom: string;
  entrepriseId: string;
  entrepriseNom: string;
  avancementPrevu: number;
  avancementReel: number;
  ecart: number;
  risqueRetard: 'faible' | 'moyen' | 'eleve' | 'critique';
  facteursBlocage: string[];
}

interface WeeklyAlert {
  type: 'retard' | 'blocage' | 'conflit' | 'qualite' | 'budget' | 'meteo';
  severite: 'info' | 'warning' | 'critical';
  titre: string;
  description: string;
  lotsConcernes: string[];
  actionsSuggerees: string[];
  delaiRecommande: string;
}

interface WeeklyReport {
  projetId: string;
  semaine: string;
  dateGeneration: Date;
  resume: string;
  progression: SiteProgress;
  alertes: WeeklyAlert[];
  pointsVigilance: string[];
  actionsPrioritaires: ActionPrioritaire[];
  previsionsSemaineSuivante: string[];
  indicateursMeteo?: MeteoImpact;
}

interface ActionPrioritaire {
  action: string;
  responsable: string;
  deadline: string;
  priorite: 'haute' | 'moyenne' | 'basse';
  impact: string;
}

interface MeteoImpact {
  joursIntemperies: number;
  impactPlanning: string;
  rattrapagePossible: boolean;
}

interface AnalysisContext {
  situations: any[];
  controles: any[];
  conflits: any[];
  journal: any[];
  avenants: any[];
  meteo?: any[];
}

export class SiteMonitoringAgent {
  private model: string = 'gpt-4o';

  /**
   * Analyse hebdomadaire complète du chantier
   */
  async analyzeWeeklyProgress(projetId: string): Promise<WeeklyReport> {
    // 1. Collecter toutes les données pertinentes
    const context = await this.collectAnalysisContext(projetId);

    // 2. Calculer la progression par lot
    const progression = await this.calculateProgress(projetId, context);

    // 3. Détecter les alertes
    const alertes = await this.detectAlerts(context, progression);

    // 4. Générer le rapport avec l'IA
    const aiAnalysis = await this.generateAIAnalysis(context, progression, alertes);

    // 5. Construire le rapport final
    const report: WeeklyReport = {
      projetId,
      semaine: this.getCurrentWeek(),
      dateGeneration: new Date(),
      resume: aiAnalysis.resume,
      progression,
      alertes,
      pointsVigilance: aiAnalysis.pointsVigilance,
      actionsPrioritaires: aiAnalysis.actionsPrioritaires,
      previsionsSemaineSuivante: aiAnalysis.previsions,
    };

    // 6. Sauvegarder le rapport
    await this.saveReport(report);

    return report;
  }

  /**
   * Collecte le contexte d'analyse depuis la base de données
   */
  private async collectAnalysisContext(projetId: string): Promise<AnalysisContext> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [situations, controles, conflits, journal, avenants] = await Promise.all([
      // Situations de paiement récentes
      supabase
        .from('payment_situations')
        .select('*')
        .eq('projet_id', projetId)
        .gte('date_situation', thirtyDaysAgo.toISOString())
        .order('date_situation', { ascending: false }),

      // Contrôles qualité récents
      supabase
        .from('quality_controls')
        .select('*, control_visits(*)')
        .eq('projet_id', projetId)
        .gte('created_at', thirtyDaysAgo.toISOString()),

      // Conflits de coordination
      supabase
        .from('coordination_conflicts')
        .select('*')
        .eq('projet_id', projetId)
        .in('statut', ['detecte', 'en_resolution']),

      // Journal de chantier
      supabase
        .from('site_journal')
        .select('*')
        .eq('projet_id', projetId)
        .gte('date_entree', thirtyDaysAgo.toISOString())
        .order('date_entree', { ascending: false }),

      // Avenants en cours
      supabase
        .from('contract_amendments')
        .select('*')
        .eq('projet_id', projetId)
        .in('statut', ['en_attente', 'en_negociation']),
    ]);

    return {
      situations: situations.data || [],
      controles: controles.data || [],
      conflits: conflits.data || [],
      journal: journal.data || [],
      avenants: avenants.data || [],
    };
  }

  /**
   * Calcule la progression du chantier
   */
  private async calculateProgress(
    projetId: string,
    context: AnalysisContext
  ): Promise<SiteProgress> {
    // Récupérer les lots du projet
    const { data: lots } = await supabase
      .from('lots')
      .select('*, entreprises(*)')
      .eq('projet_id', projetId);

    const avancementParLot: LotProgress[] = [];
    let totalPrevu = 0;
    let totalReel = 0;

    for (const lot of lots || []) {
      // Calculer l'avancement basé sur les situations de paiement
      const situationsLot = context.situations.filter(s => s.lot_id === lot.id);
      const derniereSituation = situationsLot[0];

      const avancementReel = derniereSituation?.pourcentage_avancement || 0;
      const avancementPrevu = this.calculateExpectedProgress(lot);
      const ecart = avancementReel - avancementPrevu;

      // Déterminer le risque de retard
      let risqueRetard: LotProgress['risqueRetard'] = 'faible';
      if (ecart < -20) risqueRetard = 'critique';
      else if (ecart < -10) risqueRetard = 'eleve';
      else if (ecart < -5) risqueRetard = 'moyen';

      // Identifier les facteurs de blocage
      const facteursBlocage = this.identifyBlockingFactors(lot, context);

      avancementParLot.push({
        lotId: lot.id,
        lotNom: lot.nom,
        entrepriseId: lot.entreprise_id,
        entrepriseNom: lot.entreprises?.nom || 'N/A',
        avancementPrevu,
        avancementReel,
        ecart,
        risqueRetard,
        facteursBlocage,
      });

      totalPrevu += avancementPrevu;
      totalReel += avancementReel;
    }

    const nbLots = lots?.length || 1;
    const avancementGlobal = totalReel / nbLots;
    const avancementPrevuGlobal = totalPrevu / nbLots;
    const ecartGlobal = avancementGlobal - avancementPrevuGlobal;

    // Déterminer la tendance globale
    let tendance: SiteProgress['tendance'] = 'conforme';
    if (ecartGlobal > 5) tendance = 'en_avance';
    else if (ecartGlobal < -15) tendance = 'retard_critique';
    else if (ecartGlobal < -5) tendance = 'leger_retard';

    return {
      projetId,
      dateAnalyse: new Date(),
      avancementGlobal,
      avancementParLot,
      tendance,
      joursPrevus: 0, // À calculer selon planning
      joursReels: 0,
      ecartJours: 0,
    };
  }

  /**
   * Calcule l'avancement prévu théorique
   */
  private calculateExpectedProgress(lot: any): number {
    const dateDebut = new Date(lot.date_debut || lot.created_at);
    const dateFin = new Date(lot.date_fin_prevue || new Date());
    const now = new Date();

    const dureeTotale = dateFin.getTime() - dateDebut.getTime();
    const dureeEcoulee = now.getTime() - dateDebut.getTime();

    if (dureeTotale <= 0) return 100;
    if (dureeEcoulee <= 0) return 0;

    return Math.min(100, Math.round((dureeEcoulee / dureeTotale) * 100));
  }

  /**
   * Identifie les facteurs de blocage pour un lot
   */
  private identifyBlockingFactors(lot: any, context: AnalysisContext): string[] {
    const facteurs: string[] = [];

    // Conflits non résolus
    const conflitsLot = context.conflits.filter(
      c => c.lot_principal_id === lot.id || c.lot_secondaire_id === lot.id
    );
    if (conflitsLot.length > 0) {
      facteurs.push(`${conflitsLot.length} conflit(s) de coordination non résolu(s)`);
    }

    // Contrôles qualité échoués
    const controlesEchoues = context.controles.filter(
      c => c.lot_id === lot.id && c.resultat === 'non_conforme'
    );
    if (controlesEchoues.length > 0) {
      facteurs.push(`${controlesEchoues.length} non-conformité(s) en attente`);
    }

    // Avenants en attente
    const avenantsLot = context.avenants.filter(a => a.lot_id === lot.id);
    if (avenantsLot.length > 0) {
      facteurs.push(`${avenantsLot.length} avenant(s) en négociation`);
    }

    // Intempéries (depuis journal)
    const intemperies = context.journal.filter(
      j => j.lot_id === lot.id && j.type === 'intemperie'
    );
    if (intemperies.length > 2) {
      facteurs.push(`Intempéries fréquentes (${intemperies.length} jours)`);
    }

    return facteurs;
  }

  /**
   * Détecte les alertes basées sur l'analyse
   */
  private async detectAlerts(
    context: AnalysisContext,
    progression: SiteProgress
  ): Promise<WeeklyAlert[]> {
    const alertes: WeeklyAlert[] = [];

    // Alertes de retard
    for (const lot of progression.avancementParLot) {
      if (lot.risqueRetard === 'critique') {
        alertes.push({
          type: 'retard',
          severite: 'critical',
          titre: `Retard critique sur ${lot.lotNom}`,
          description: `Le lot accuse un retard de ${Math.abs(lot.ecart)}% par rapport au planning prévu.`,
          lotsConcernes: [lot.lotId],
          actionsSuggerees: [
            'Organiser une réunion de crise avec l\'entreprise',
            'Évaluer les possibilités de renfort d\'équipe',
            'Réviser le planning des tâches restantes',
          ],
          delaiRecommande: '48h',
        });
      } else if (lot.risqueRetard === 'eleve') {
        alertes.push({
          type: 'retard',
          severite: 'warning',
          titre: `Risque de retard sur ${lot.lotNom}`,
          description: `Le lot présente un écart de ${Math.abs(lot.ecart)}% nécessitant une attention particulière.`,
          lotsConcernes: [lot.lotId],
          actionsSuggerees: [
            'Planifier un point avec le chef de chantier',
            'Identifier les blocages potentiels',
          ],
          delaiRecommande: '1 semaine',
        });
      }
    }

    // Alertes de conflits
    if (context.conflits.length > 0) {
      const conflitsCritiques = context.conflits.filter(c => c.impact === 'bloquant');
      if (conflitsCritiques.length > 0) {
        alertes.push({
          type: 'conflit',
          severite: 'critical',
          titre: `${conflitsCritiques.length} conflit(s) bloquant(s) détecté(s)`,
          description: 'Des conflits de coordination nécessitent une résolution immédiate.',
          lotsConcernes: conflitsCritiques.map(c => c.lot_principal_id),
          actionsSuggerees: [
            'Convoquer une réunion de coordination d\'urgence',
            'Arbitrer les priorités entre lots',
          ],
          delaiRecommande: '24h',
        });
      }
    }

    // Alertes qualité
    const nonConformites = context.controles.filter(c => c.resultat === 'non_conforme');
    if (nonConformites.length > 0) {
      alertes.push({
        type: 'qualite',
        severite: nonConformites.length > 3 ? 'critical' : 'warning',
        titre: `${nonConformites.length} non-conformité(s) à traiter`,
        description: 'Des points de contrôle qualité nécessitent des actions correctives.',
        lotsConcernes: [...new Set(nonConformites.map(c => c.lot_id))],
        actionsSuggerees: [
          'Planifier les reprises avec les entreprises concernées',
          'Programmer une visite de contre-contrôle',
        ],
        delaiRecommande: '1 semaine',
      });
    }

    return alertes;
  }

  /**
   * Génère l'analyse IA du rapport
   */
  private async generateAIAnalysis(
    context: AnalysisContext,
    progression: SiteProgress,
    alertes: WeeklyAlert[]
  ): Promise<{
    resume: string;
    pointsVigilance: string[];
    actionsPrioritaires: ActionPrioritaire[];
    previsions: string[];
  }> {
    const prompt = `Tu es un expert en suivi de chantier BTP. Analyse les données suivantes et génère un rapport de synthèse.

## Données de progression
${JSON.stringify(progression, null, 2)}

## Alertes détectées
${JSON.stringify(alertes, null, 2)}

## Contexte (30 derniers jours)
- ${context.situations.length} situations de paiement
- ${context.controles.length} contrôles qualité
- ${context.conflits.length} conflits en cours
- ${context.journal.length} entrées journal
- ${context.avenants.length} avenants en cours

Génère une réponse JSON avec:
1. "resume": un résumé exécutif de 3-4 phrases
2. "pointsVigilance": liste de 3-5 points de vigilance pour la semaine
3. "actionsPrioritaires": liste de 3-5 actions prioritaires avec format {action, responsable, deadline, priorite, impact}
4. "previsions": liste de 3-5 prévisions pour la semaine suivante

Réponds uniquement en JSON valide.`;

    try {
      return await secureAI.completeJSON<{
        resume: string;
        pointsVigilance: string[];
        actionsPrioritaires: ActionPrioritaire[];
        previsions: string[];
      }>({
        messages: [{ role: 'user', content: prompt }],
        model: this.model,
        provider: 'openai',
        temperature: 0.3,
      });
    } catch (error) {
      console.error('AI Analysis error:', error);
      // Fallback en cas d'erreur
      return {
        resume: `Le chantier présente une tendance ${progression.tendance} avec ${alertes.length} alertes actives.`,
        pointsVigilance: alertes.map(a => a.titre),
        actionsPrioritaires: [],
        previsions: ['Suivi standard à maintenir'],
      };
    }
  }

  /**
   * Sauvegarde le rapport en base
   */
  private async saveReport(report: WeeklyReport): Promise<void> {
    await supabase.from('progress_reports').insert({
      projet_id: report.projetId,
      semaine: report.semaine,
      type: 'hebdomadaire',
      contenu: report,
      alertes_count: report.alertes.length,
      alertes_critiques: report.alertes.filter(a => a.severite === 'critical').length,
      avancement_global: report.progression.avancementGlobal,
      tendance: report.progression.tendance,
    });
  }

  /**
   * Retourne la semaine courante au format ISO
   */
  private getCurrentWeek(): string {
    const now = new Date();
    const year = now.getFullYear();
    const oneJan = new Date(year, 0, 1);
    const week = Math.ceil(
      ((now.getTime() - oneJan.getTime()) / 86400000 + oneJan.getDay() + 1) / 7
    );
    return `${year}-W${week.toString().padStart(2, '0')}`;
  }

  /**
   * Génère des recommandations de rattrapage pour un lot en retard
   */
  async generateCatchUpPlan(
    projetId: string,
    lotId: string
  ): Promise<{
    diagnostic: string;
    optionsRattrapage: Array<{
      option: string;
      impact: string;
      cout: string;
      delai: string;
      risques: string[];
    }>;
    recommandation: string;
  }> {
    const { data: lot } = await supabase
      .from('lots')
      .select('*, entreprises(*)')
      .eq('id', lotId)
      .single();

    const context = await this.collectAnalysisContext(projetId);
    const progression = await this.calculateProgress(projetId, context);
    const lotProgress = progression.avancementParLot.find(l => l.lotId === lotId);

    const prompt = `Tu es un expert en pilotage de chantier BTP. Un lot accuse un retard significatif.

## Informations du lot
- Nom: ${lot?.nom}
- Entreprise: ${lot?.entreprises?.nom}
- Avancement réel: ${lotProgress?.avancementReel}%
- Avancement prévu: ${lotProgress?.avancementPrevu}%
- Écart: ${lotProgress?.ecart}%
- Facteurs de blocage: ${lotProgress?.facteursBlocage.join(', ') || 'Aucun identifié'}

Génère un plan de rattrapage en JSON avec:
1. "diagnostic": analyse des causes du retard (2-3 phrases)
2. "optionsRattrapage": 3 options avec {option, impact, cout, delai, risques[]}
3. "recommandation": l'option recommandée avec justification

Réponds uniquement en JSON valide.`;

    try {
      return await secureAI.completeJSON<{
        diagnostic: string;
        optionsRattrapage: Array<{
          option: string;
          impact: string;
          cout: string;
          delai: string;
          risques: string[];
        }>;
        recommandation: string;
      }>({
        messages: [{ role: 'user', content: prompt }],
        model: this.model,
        provider: 'openai',
        temperature: 0.4,
      });
    } catch (error) {
      console.error('Catch-up plan error:', error);
      return {
        diagnostic: 'Analyse automatique indisponible',
        optionsRattrapage: [],
        recommandation: 'Veuillez analyser manuellement la situation',
      };
    }
  }
}

export const siteMonitoringAgent = new SiteMonitoringAgent();
