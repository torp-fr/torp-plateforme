/**
 * FraudDetectionService - Système anti-arnaque TORP
 * Détection automatique des comportements frauduleux
 */

import { supabase } from '@/lib/supabase';
import {
  FraudCheckResult,
  FraudRiskLevel,
  FraudRule,
  FraudAlert,
  PaymentType,
} from '@/types/payment.types';

// Configuration des seuils
const FRAUD_THRESHOLDS = {
  // Scores de risque
  lowRiskMax: 24,
  mediumRiskMax: 49,
  highRiskMax: 79,
  // Au-dessus = critical

  // Seuils d'action
  blockThreshold: 80,
  holdThreshold: 50,
  flagThreshold: 25,

  // Limites métier
  maxDepositPercent: 30,
  criticalDepositPercent: 50,
  maxPaymentsPerWeek: 2,
  minProofsForLargeMilestone: 3,
  largeMilestoneThreshold: 5000,
  newAccountDays: 30,
  recentDisputeDays: 90,
};

interface PaymentCheckInput {
  contractId: string;
  entrepriseId: string;
  montant: number;
  type: PaymentType;
  milestoneId?: string;
  preuves?: { type: string; metadata?: Record<string, unknown> }[];
}

interface RuleCheckResult {
  triggered: boolean;
  ruleCode: string;
  score: number;
  details: Record<string, unknown>;
}

export class FraudDetectionService {
  /**
   * Vérifie un paiement contre toutes les règles de fraude
   */
  static async checkPayment(input: PaymentCheckInput): Promise<FraudCheckResult> {
    const rulesTriggered: string[] = [];
    const details: Record<string, unknown> = {};
    let totalScore = 0;

    // Récupérer le contrat
    const { data: contract } = await supabase
      .from('project_contracts')
      .select('*')
      .eq('id', input.contractId)
      .single();

    if (!contract) {
      return {
        totalScore: 100,
        riskLevel: 'critical',
        rulesTriggered: ['CONTRACT_NOT_FOUND'],
        details: { error: 'Contrat non trouvé' },
        shouldBlock: true,
        checkedAt: new Date(),
      };
    }

    // Exécuter chaque règle
    const ruleChecks = await Promise.all([
      this.checkDepositAmount(input, contract),
      this.checkTotalVsContract(input, contract),
      this.checkPaymentFrequency(input),
      this.checkAccountAge(input.entrepriseId),
      this.checkRecentDisputes(input.entrepriseId),
      this.checkCompletedProjects(input.entrepriseId),
      this.checkProofQuality(input),
      this.checkMilestoneTimining(input),
      this.checkAmountVariance(input, contract),
      this.checkBehaviorPatterns(input, contract),
    ]);

    // Agréger les résultats
    for (const check of ruleChecks) {
      if (check.triggered) {
        totalScore += check.score;
        rulesTriggered.push(check.ruleCode);
        details[check.ruleCode] = check.details;
      }
    }

    // Déterminer le niveau de risque
    const riskLevel = this.calculateRiskLevel(totalScore);
    const shouldBlock = totalScore >= FRAUD_THRESHOLDS.blockThreshold;

    // Logger le résultat
    await this.logFraudCheck({
      contractId: input.contractId,
      milestoneId: input.milestoneId,
      totalScore,
      riskLevel,
      rulesTriggered,
      details,
      shouldBlock,
    });

    // Créer des alertes si nécessaire
    if (riskLevel === 'high' || riskLevel === 'critical') {
      await this.createFraudAlerts(input, rulesTriggered, riskLevel, details);
    }

    return {
      totalScore,
      riskLevel,
      rulesTriggered,
      details,
      shouldBlock,
      checkedAt: new Date(),
    };
  }

  /**
   * Vérifie le montant de l'acompte
   */
  private static async checkDepositAmount(
    input: PaymentCheckInput,
    contract: Record<string, unknown>
  ): Promise<RuleCheckResult> {
    if (input.type !== 'deposit') {
      return { triggered: false, ruleCode: 'ACOMPTE_CHECK', score: 0, details: {} };
    }

    const depositPercent = (input.montant / (contract.montant_total_ttc as number)) * 100;

    if (depositPercent > FRAUD_THRESHOLDS.criticalDepositPercent) {
      return {
        triggered: true,
        ruleCode: 'ACOMPTE_TRES_ELEVE',
        score: 80,
        details: {
          depositPercent: depositPercent.toFixed(1),
          threshold: FRAUD_THRESHOLDS.criticalDepositPercent,
          message: `Acompte de ${depositPercent.toFixed(1)}% - Risque très élevé`,
        },
      };
    }

    if (depositPercent > FRAUD_THRESHOLDS.maxDepositPercent) {
      return {
        triggered: true,
        ruleCode: 'ACOMPTE_EXCESSIF',
        score: 40,
        details: {
          depositPercent: depositPercent.toFixed(1),
          threshold: FRAUD_THRESHOLDS.maxDepositPercent,
          message: `Acompte de ${depositPercent.toFixed(1)}% au-dessus du seuil recommandé`,
        },
      };
    }

    return { triggered: false, ruleCode: 'ACOMPTE_OK', score: 0, details: { depositPercent } };
  }

  /**
   * Vérifie le total des paiements vs montant contractuel
   */
  private static async checkTotalVsContract(
    input: PaymentCheckInput,
    contract: Record<string, unknown>
  ): Promise<RuleCheckResult> {
    const { data: existingPayments } = await supabase
      .from('payments')
      .select('montant_ttc')
      .eq('contract_id', input.contractId)
      .in('status', ['held', 'released', 'processing', 'awaiting_payment']);

    const totalPaid = existingPayments?.reduce((sum, p) => sum + p.montant_ttc, 0) || 0;
    const contractTotal = contract.montant_total_ttc as number;
    const newTotal = totalPaid + input.montant;
    const percentOfContract = (newTotal / contractTotal) * 100;

    if (percentOfContract > 105) {
      return {
        triggered: true,
        ruleCode: 'DEPASSEMENT_CONTRAT',
        score: 100,
        details: {
          totalPaid,
          newPayment: input.montant,
          newTotal,
          contractTotal,
          percentOfContract: percentOfContract.toFixed(1),
          message: 'Le total des paiements dépasse le montant contractuel',
        },
      };
    }

    if (percentOfContract > 100) {
      return {
        triggered: true,
        ruleCode: 'DEPASSEMENT_LEGER',
        score: 30,
        details: {
          percentOfContract: percentOfContract.toFixed(1),
          message: 'Léger dépassement du montant contractuel',
        },
      };
    }

    return { triggered: false, ruleCode: 'TOTAL_OK', score: 0, details: { percentOfContract } };
  }

  /**
   * Vérifie la fréquence des demandes de paiement
   */
  private static async checkPaymentFrequency(
    input: PaymentCheckInput
  ): Promise<RuleCheckResult> {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const { data: recentPayments } = await supabase
      .from('payments')
      .select('id, created_at')
      .eq('contract_id', input.contractId)
      .gte('created_at', oneWeekAgo.toISOString());

    const count = recentPayments?.length || 0;

    if (count >= FRAUD_THRESHOLDS.maxPaymentsPerWeek) {
      return {
        triggered: true,
        ruleCode: 'PAIEMENTS_RAPIDES',
        score: 35,
        details: {
          recentPaymentsCount: count,
          period: '7 jours',
          threshold: FRAUD_THRESHOLDS.maxPaymentsPerWeek,
          message: `${count + 1} demandes de paiement en une semaine`,
        },
      };
    }

    return { triggered: false, ruleCode: 'FREQUENCE_OK', score: 0, details: { recentPaymentsCount: count } };
  }

  /**
   * Vérifie l'ancienneté du compte entreprise
   */
  private static async checkAccountAge(entrepriseId: string): Promise<RuleCheckResult> {
    const { data: user } = await supabase
      .from('auth.users')
      .select('created_at')
      .eq('id', entrepriseId)
      .single();

    if (!user) {
      // Fallback: vérifier dans le profil
      const { data: profile } = await supabase
        .from('users')
        .select('created_at')
        .eq('id', entrepriseId)
        .single();

      if (!profile) {
        return {
          triggered: true,
          ruleCode: 'COMPTE_INCONNU',
          score: 50,
          details: { message: 'Impossible de vérifier l\'ancienneté du compte' },
        };
      }

      const accountAgeDays = Math.floor(
        (Date.now() - new Date(profile.created_at).getTime()) / (1000 * 60 * 60 * 24)
      );

      if (accountAgeDays < FRAUD_THRESHOLDS.newAccountDays) {
        return {
          triggered: true,
          ruleCode: 'NOUVELLE_ENTREPRISE',
          score: 25,
          details: {
            accountAgeDays,
            threshold: FRAUD_THRESHOLDS.newAccountDays,
            message: `Compte créé il y a ${accountAgeDays} jour(s)`,
          },
        };
      }
    }

    return { triggered: false, ruleCode: 'ACCOUNT_AGE_OK', score: 0, details: {} };
  }

  /**
   * Vérifie les litiges récents
   */
  private static async checkRecentDisputes(entrepriseId: string): Promise<RuleCheckResult> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - FRAUD_THRESHOLDS.recentDisputeDays);

    const { data: disputes } = await supabase
      .from('disputes')
      .select('id, status, reason, created_at')
      .eq('against', entrepriseId)
      .gte('created_at', cutoffDate.toISOString());

    const disputeCount = disputes?.length || 0;

    if (disputeCount > 0) {
      // Vérifier les litiges perdus
      const lostDisputes = disputes?.filter(d =>
        d.status === 'resolved_client'
      ).length || 0;

      let score = disputeCount * 15;
      score += lostDisputes * 30; // Pénalité supplémentaire pour litiges perdus

      return {
        triggered: true,
        ruleCode: 'LITIGE_RECENT',
        score: Math.min(score, 75),
        details: {
          disputeCount,
          lostDisputes,
          period: `${FRAUD_THRESHOLDS.recentDisputeDays} jours`,
          disputes: disputes?.map(d => ({
            reason: d.reason,
            status: d.status,
            date: d.created_at,
          })),
          message: `${disputeCount} litige(s) récent(s), dont ${lostDisputes} perdu(s)`,
        },
      };
    }

    return { triggered: false, ruleCode: 'DISPUTES_OK', score: 0, details: { disputeCount: 0 } };
  }

  /**
   * Vérifie les projets complétés par l'entreprise
   */
  private static async checkCompletedProjects(entrepriseId: string): Promise<RuleCheckResult> {
    const { data: completedContracts } = await supabase
      .from('project_contracts')
      .select('id')
      .eq('entreprise_id', entrepriseId)
      .eq('status', 'completed');

    const completedCount = completedContracts?.length || 0;

    if (completedCount === 0) {
      return {
        triggered: true,
        ruleCode: 'PREMIER_PROJET',
        score: 15,
        details: {
          completedProjects: 0,
          message: 'Premier projet de l\'entreprise sur TORP',
        },
      };
    }

    return {
      triggered: false,
      ruleCode: 'EXPERIENCE_OK',
      score: 0,
      details: { completedProjects: completedCount },
    };
  }

  /**
   * Vérifie la qualité des preuves fournies
   */
  private static async checkProofQuality(input: PaymentCheckInput): Promise<RuleCheckResult> {
    if (!input.milestoneId || input.type === 'deposit') {
      return { triggered: false, ruleCode: 'PREUVES_NA', score: 0, details: {} };
    }

    const { data: milestone } = await supabase
      .from('payment_milestones')
      .select('preuves, montant_ttc')
      .eq('id', input.milestoneId)
      .single();

    if (!milestone) {
      return { triggered: false, ruleCode: 'MILESTONE_NOT_FOUND', score: 0, details: {} };
    }

    const preuves = milestone.preuves || [];
    const montant = milestone.montant_ttc;

    // Vérifier le nombre de preuves pour les gros jalons
    if (montant > FRAUD_THRESHOLDS.largeMilestoneThreshold) {
      if (preuves.length < FRAUD_THRESHOLDS.minProofsForLargeMilestone) {
        return {
          triggered: true,
          ruleCode: 'PREUVES_INSUFFISANTES',
          score: 20,
          details: {
            proofsCount: preuves.length,
            required: FRAUD_THRESHOLDS.minProofsForLargeMilestone,
            milestoneAmount: montant,
            message: `Seulement ${preuves.length} preuve(s) pour un jalon de ${montant}€`,
          },
        };
      }
    }

    // Vérifier les métadonnées des photos
    const photos = preuves.filter((p: Record<string, unknown>) => p.type === 'photo');
    const photosWithoutMetadata = photos.filter((p: Record<string, unknown>) => {
      const metadata = p.metadata as Record<string, unknown> | undefined;
      return !metadata?.geolocation || !metadata?.dateCapture;
    });

    if (photosWithoutMetadata.length > photos.length / 2) {
      return {
        triggered: true,
        ruleCode: 'PHOTOS_METADATA_MANQUANTES',
        score: 10,
        details: {
          totalPhotos: photos.length,
          photosWithoutMetadata: photosWithoutMetadata.length,
          message: 'Plusieurs photos sans géolocalisation ou date',
        },
      };
    }

    return { triggered: false, ruleCode: 'PREUVES_OK', score: 0, details: { proofsCount: preuves.length } };
  }

  /**
   * Vérifie le timing du jalon
   */
  private static async checkMilestoneTimining(input: PaymentCheckInput): Promise<RuleCheckResult> {
    if (!input.milestoneId) {
      return { triggered: false, ruleCode: 'TIMING_NA', score: 0, details: {} };
    }

    const { data: milestone } = await supabase
      .from('payment_milestones')
      .select('date_prevue, status')
      .eq('id', input.milestoneId)
      .single();

    if (!milestone?.date_prevue) {
      return { triggered: false, ruleCode: 'NO_PLANNED_DATE', score: 0, details: {} };
    }

    const datePrevue = new Date(milestone.date_prevue);
    const now = new Date();
    const daysBeforePlanned = Math.floor((datePrevue.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysBeforePlanned > 7) {
      return {
        triggered: true,
        ruleCode: 'PAIEMENT_PREMATURE',
        score: 25,
        details: {
          datePrevue: datePrevue.toISOString(),
          daysBeforePlanned,
          message: `Demande de paiement ${daysBeforePlanned} jours avant la date prévue`,
        },
      };
    }

    return { triggered: false, ruleCode: 'TIMING_OK', score: 0, details: { daysBeforePlanned } };
  }

  /**
   * Vérifie la variance du montant
   */
  private static async checkAmountVariance(
    input: PaymentCheckInput,
    contract: Record<string, unknown>
  ): Promise<RuleCheckResult> {
    if (!input.milestoneId) {
      return { triggered: false, ruleCode: 'VARIANCE_NA', score: 0, details: {} };
    }

    const { data: milestone } = await supabase
      .from('payment_milestones')
      .select('montant_ttc')
      .eq('id', input.milestoneId)
      .single();

    if (!milestone) {
      return { triggered: false, ruleCode: 'MILESTONE_NOT_FOUND', score: 0, details: {} };
    }

    const expectedAmount = milestone.montant_ttc;
    const variance = ((input.montant - expectedAmount) / expectedAmount) * 100;

    if (Math.abs(variance) > 20) {
      return {
        triggered: true,
        ruleCode: 'MONTANT_INCOHERENT',
        score: 30,
        details: {
          expectedAmount,
          requestedAmount: input.montant,
          variance: variance.toFixed(1),
          message: `Écart de ${variance.toFixed(1)}% par rapport au montant prévu`,
        },
      };
    }

    return { triggered: false, ruleCode: 'VARIANCE_OK', score: 0, details: { variance: variance.toFixed(1) } };
  }

  /**
   * Analyse les patterns comportementaux
   */
  private static async checkBehaviorPatterns(
    input: PaymentCheckInput,
    contract: Record<string, unknown>
  ): Promise<RuleCheckResult> {
    let score = 0;
    const alerts: string[] = [];
    const details: Record<string, unknown> = {};

    // Vérifier si le contrat vient d'être créé et demande déjà un paiement
    const contractCreatedAt = new Date(contract.created_at as string);
    const hoursSinceContract = (Date.now() - contractCreatedAt.getTime()) / (1000 * 60 * 60);

    if (hoursSinceContract < 24 && input.type === 'deposit') {
      // Normal pour un acompte
    } else if (hoursSinceContract < 24 && input.type === 'milestone') {
      score += 20;
      alerts.push('Demande de jalon très rapide après création du contrat');
      details.hoursSinceContract = hoursSinceContract.toFixed(1);
    }

    // Vérifier les patterns horaires suspects (demandes en dehors des heures de bureau)
    const hour = new Date().getHours();
    if (hour < 6 || hour > 22) {
      score += 5;
      alerts.push('Demande en dehors des heures normales');
      details.requestHour = hour;
    }

    if (score > 0) {
      return {
        triggered: true,
        ruleCode: 'BEHAVIOR_SUSPECT',
        score,
        details: {
          ...details,
          alerts,
          message: alerts.join('; '),
        },
      };
    }

    return { triggered: false, ruleCode: 'BEHAVIOR_OK', score: 0, details: {} };
  }

  /**
   * Calcule le niveau de risque basé sur le score
   */
  private static calculateRiskLevel(score: number): FraudRiskLevel {
    if (score >= FRAUD_THRESHOLDS.blockThreshold) return 'critical';
    if (score >= FRAUD_THRESHOLDS.holdThreshold) return 'high';
    if (score >= FRAUD_THRESHOLDS.flagThreshold) return 'medium';
    return 'low';
  }

  /**
   * Log la vérification de fraude
   */
  private static async logFraudCheck(data: {
    contractId: string;
    milestoneId?: string;
    totalScore: number;
    riskLevel: FraudRiskLevel;
    rulesTriggered: string[];
    details: Record<string, unknown>;
    shouldBlock: boolean;
  }): Promise<void> {
    await supabase.from('fraud_checks_log').insert({
      contract_id: data.contractId,
      milestone_id: data.milestoneId,
      total_score: data.totalScore,
      risk_level: data.riskLevel,
      rules_triggered: data.rulesTriggered,
      details: data.details,
      blocked: data.shouldBlock,
      requires_review: data.riskLevel === 'high',
      action_taken: data.shouldBlock ? 'blocked' : data.riskLevel === 'high' ? 'flagged' : null,
    });
  }

  /**
   * Crée des alertes fraude pour les admins
   */
  private static async createFraudAlerts(
    input: PaymentCheckInput,
    rulesTriggered: string[],
    riskLevel: FraudRiskLevel,
    details: Record<string, unknown>
  ): Promise<void> {
    for (const ruleCode of rulesTriggered) {
      const ruleDetails = details[ruleCode] as Record<string, unknown> || {};

      await supabase.from('fraud_alerts').insert({
        contract_id: input.contractId,
        milestone_id: input.milestoneId,
        rule_code: ruleCode,
        severity: riskLevel,
        message: (ruleDetails.message as string) || `Règle ${ruleCode} déclenchée`,
        details: ruleDetails,
        acknowledged: false,
      });
    }

    // Notifier les admins si critique
    if (riskLevel === 'critical') {
      console.log('🚨 ALERTE CRITIQUE FRAUDE:', {
        contractId: input.contractId,
        rules: rulesTriggered,
        details,
      });
      // TODO: Envoyer notification admin
    }
  }

  /**
   * Récupère les alertes fraude non traitées
   */
  static async getPendingAlerts(): Promise<FraudAlert[]> {
    const { data, error } = await supabase
      .from('fraud_alerts')
      .select('*')
      .eq('acknowledged', false)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  /**
   * Marque une alerte comme traitée
   */
  static async acknowledgeAlert(
    alertId: string,
    acknowledgedBy: string,
    actionTaken?: string
  ): Promise<void> {
    await supabase
      .from('fraud_alerts')
      .update({
        acknowledged: true,
        acknowledged_by: acknowledgedBy,
        acknowledged_at: new Date().toISOString(),
        action_taken: actionTaken,
      })
      .eq('id', alertId);
  }

  /**
   * Récupère les statistiques fraude
   */
  static async getFraudStats(): Promise<{
    totalChecks: number;
    blockedPayments: number;
    flaggedPayments: number;
    ruleBreakdown: Record<string, number>;
  }> {
    const { data: logs } = await supabase
      .from('fraud_checks_log')
      .select('blocked, risk_level, rules_triggered');

    if (!logs) {
      return {
        totalChecks: 0,
        blockedPayments: 0,
        flaggedPayments: 0,
        ruleBreakdown: {},
      };
    }

    const ruleBreakdown: Record<string, number> = {};
    logs.forEach(log => {
      (log.rules_triggered || []).forEach((rule: string) => {
        ruleBreakdown[rule] = (ruleBreakdown[rule] || 0) + 1;
      });
    });

    return {
      totalChecks: logs.length,
      blockedPayments: logs.filter(l => l.blocked).length,
      flaggedPayments: logs.filter(l => l.risk_level === 'high' && !l.blocked).length,
      ruleBreakdown,
    };
  }
}

export default FraudDetectionService;
