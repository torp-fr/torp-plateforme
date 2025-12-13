/**
 * TORP Phase 0 - Service Budget et Financement
 * Module 0.6 : Gestion du budget, financement et aides
 */

import { supabase } from '@/lib/supabase';
import type {
  BudgetPlan,
  BudgetStatus,
  CostEstimation,
  DirectCosts,
  IndirectCosts,
  CostBreakdownItem,
  ContingencyAllocation,
  FinancingPlan,
  FinancingSource,
  FinancingType,
  LoanSimulation,
  AidesAnalysis,
  AideEligibility,
  MaPrimeRenovAnalysis,
  MaPrimeRenovCategory,
  EcoPTZAnalysis,
  CEEAnalysis,
  LocalAidesAnalysis,
  ROIAnalysis,
  CashFlowProjection,
  CashFlowMonth,
} from '@/types/phase0/budget.types';
import type { Property } from '@/types/phase0/property.types';
import type { WorkProject } from '@/types/phase0/work-project.types';
import type { MasterOwnerProfile } from '@/types/phase0/owner.types';
import type { SelectedLot } from '@/types/phase0/lots.types';
import type { EstimationRange } from '@/types/phase0/common.types';

// =============================================================================
// TYPES
// =============================================================================

export interface BudgetAnalysisInput {
  property: Partial<Property>;
  workProject: Partial<WorkProject>;
  selectedLots: SelectedLot[];
  ownerProfile: Partial<MasterOwnerProfile>;
  dpeClass?: string;
  targetDpeClass?: string;
}

export interface AidesCalculationInput {
  ownerProfile: Partial<MasterOwnerProfile>;
  property: Partial<Property>;
  selectedLots: SelectedLot[];
  totalWorksCost: number;
  dpeClass?: string;
  targetDpeClass?: string;
}

export interface FinancingScenario {
  name: string;
  description: string;
  sources: FinancingSource[];
  totalFinanced: number;
  monthlyCost: number;
  totalCost: number;
  savingsVsBase: number;
}

// =============================================================================
// INCOME THRESHOLDS 2024 (MaPrimeRénov')
// =============================================================================

const MPR_THRESHOLDS_IDF = {
  very_modest: [23541, 34551, 41493, 48447, 55427, 6970], // +6970 per additional person
  modest: [28657, 42058, 50513, 58981, 67473, 8486],
  intermediate: [40018, 58827, 70382, 82839, 94844, 11455],
  // Above intermediate = "aisés" (wealthy)
};

const MPR_THRESHOLDS_OTHER = {
  very_modest: [17009, 24875, 29917, 34948, 40002, 5045],
  modest: [21805, 31889, 38349, 44802, 51281, 6462],
  intermediate: [30549, 44907, 53934, 63379, 72400, 9165],
};

// =============================================================================
// AIDE AMOUNTS 2024
// =============================================================================

const MPR_AMOUNTS: Record<MaPrimeRenovCategory, Record<string, number>> = {
  blue: {
    // Très modestes
    isolation_murs_ext: 75, // €/m²
    isolation_murs_int: 25,
    isolation_toiture: 75,
    isolation_plancher: 75,
    pompe_chaleur_air_eau: 5000,
    pompe_chaleur_geothermie: 11000,
    chaudiere_granules: 10000,
    chaudiere_buches: 8000,
    solaire_thermique: 4000,
    ventilation_double_flux: 2500,
    fenetre: 100, // par fenêtre
    audit_energetique: 500,
  },
  yellow: {
    // Modestes
    isolation_murs_ext: 60,
    isolation_murs_int: 20,
    isolation_toiture: 60,
    isolation_plancher: 60,
    pompe_chaleur_air_eau: 4000,
    pompe_chaleur_geothermie: 9000,
    chaudiere_granules: 8000,
    chaudiere_buches: 6500,
    solaire_thermique: 3000,
    ventilation_double_flux: 2000,
    fenetre: 80,
    audit_energetique: 400,
  },
  violet: {
    // Intermédiaires
    isolation_murs_ext: 40,
    isolation_murs_int: 15,
    isolation_toiture: 40,
    isolation_plancher: 40,
    pompe_chaleur_air_eau: 3000,
    pompe_chaleur_geothermie: 6000,
    chaudiere_granules: 4000,
    chaudiere_buches: 3000,
    solaire_thermique: 2000,
    ventilation_double_flux: 1500,
    fenetre: 40,
    audit_energetique: 300,
  },
  pink: {
    // Aisés - seul parcours accompagné
    isolation_murs_ext: 0,
    isolation_murs_int: 0,
    isolation_toiture: 0,
    isolation_plancher: 0,
    pompe_chaleur_air_eau: 0,
    pompe_chaleur_geothermie: 0,
    chaudiere_granules: 0,
    chaudiere_buches: 0,
    solaire_thermique: 0,
    ventilation_double_flux: 0,
    fenetre: 0,
    audit_energetique: 0,
  },
};

// Parcours accompagné (rénovation globale)
const MPR_GLOBAL_RENOVATION: Record<MaPrimeRenovCategory, Record<string, { percentage: number; cap: number }>> = {
  blue: {
    '2_classes': { percentage: 80, cap: 63000 },
    '3_classes': { percentage: 80, cap: 63000 },
    '4_classes': { percentage: 80, cap: 63000 },
  },
  yellow: {
    '2_classes': { percentage: 60, cap: 52500 },
    '3_classes': { percentage: 60, cap: 52500 },
    '4_classes': { percentage: 60, cap: 52500 },
  },
  violet: {
    '2_classes': { percentage: 45, cap: 42000 },
    '3_classes': { percentage: 50, cap: 42000 },
    '4_classes': { percentage: 50, cap: 42000 },
  },
  pink: {
    '2_classes': { percentage: 30, cap: 31500 },
    '3_classes': { percentage: 35, cap: 31500 },
    '4_classes': { percentage: 35, cap: 31500 },
  },
};

// CEE values (simplified)
const CEE_VALUES: Record<string, { kwh_cumac: number; price_per_kwh: number }> = {
  isolation_murs: { kwh_cumac: 3200, price_per_kwh: 0.005 }, // per m²
  isolation_toiture: { kwh_cumac: 3800, price_per_kwh: 0.005 },
  isolation_plancher: { kwh_cumac: 2400, price_per_kwh: 0.005 },
  pompe_chaleur: { kwh_cumac: 45000, price_per_kwh: 0.005 }, // per unit
  chaudiere_performante: { kwh_cumac: 35000, price_per_kwh: 0.005 },
  fenetre: { kwh_cumac: 8200, price_per_kwh: 0.005 }, // per unit
};

// =============================================================================
// SERVICE
// =============================================================================

export class BudgetService {
  /**
   * Calculates complete budget plan
   */
  static async calculateBudgetPlan(input: BudgetAnalysisInput): Promise<BudgetPlan> {
    const { property, workProject, selectedLots, ownerProfile, dpeClass, targetDpeClass } = input;

    // Calculate costs
    const costEstimation = this.calculateCosts(selectedLots, property, workProject);

    // Calculate eligible aides
    const aidesAnalysis = this.calculateAides({
      ownerProfile,
      property,
      selectedLots,
      totalWorksCost: costEstimation.totalTTC,
      dpeClass,
      targetDpeClass,
    });

    // Generate financing plan
    const financingPlan = this.generateFinancingPlan(
      costEstimation.totalTTC,
      aidesAnalysis,
      ownerProfile
    );

    // Generate cash flow projection
    const cashFlow = this.generateCashFlowProjection(
      costEstimation,
      financingPlan,
      selectedLots
    );

    // Calculate ROI if energy renovation
    let roiAnalysis: ROIAnalysis | undefined;
    if (this.isEnergyRenovation(selectedLots)) {
      roiAnalysis = this.calculateROI(costEstimation, aidesAnalysis, property, dpeClass, targetDpeClass);
    }

    return {
      id: crypto.randomUUID(),
      projectId: '', // Set when saving
      status: 'draft',
      version: 1,
      costEstimation,
      financingPlan,
      aidesAnalysis,
      cashFlow,
      roiAnalysis,
      summary: {
        totalCost: costEstimation.totalTTC,
        totalAides: aidesAnalysis.totalEligible,
        remainingToFinance: costEstimation.totalTTC - aidesAnalysis.totalEligible,
        monthlyPayment: financingPlan.monthlyPayment,
      },
      torpMetadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'system',
        version: 1,
        source: 'calculation',
        completeness: this.calculateCompleteness(input),
        aiEnriched: false,
      },
    };
  }

  /**
   * Calculates project costs
   */
  static calculateCosts(
    selectedLots: SelectedLot[],
    property: Partial<Property>,
    workProject: Partial<WorkProject>
  ): CostEstimation {
    const surface = property.characteristics?.surfaces?.livingArea || 100;
    const finishLevel = workProject.quality?.finishLevel || 'standard';

    // Calculate direct costs by lot
    const lotCosts: CostBreakdownItem[] = selectedLots.map(lot => {
      const estimate = this.estimateLotCost(lot, surface, finishLevel);
      return {
        category: 'lot',
        subcategory: lot.type,
        description: lot.name,
        quantity: lot.estimatedQuantity || surface,
        unit: lot.unit || 'm²',
        unitPrice: Math.round((estimate.min + estimate.max) / 2 / surface),
        totalHT: Math.round((estimate.min + estimate.max) / 2),
        tvaRate: this.getTVARate(lot.type, property),
        totalTTC: Math.round((estimate.min + estimate.max) / 2 * (1 + this.getTVARate(lot.type, property))),
      };
    });

    const directCostsHT = lotCosts.reduce((sum, c) => sum + c.totalHT, 0);
    const directCostsTTC = lotCosts.reduce((sum, c) => sum + c.totalTTC, 0);

    const directCosts: DirectCosts = {
      worksHT: directCostsHT,
      worksTTC: directCostsTTC,
      byLot: lotCosts,
      byCategory: this.aggregateByCategoryFromCosts(lotCosts),
    };

    // Calculate indirect costs
    const needsArchitect = surface > 150 || workProject.regulatory?.requiresArchitect;
    const architectFees = needsArchitect ? directCostsHT * 0.08 : 0;

    const indirectCosts: IndirectCosts = {
      architectFees: {
        description: 'Honoraires architecte',
        amount: architectFees,
        percentage: needsArchitect ? 8 : 0,
      },
      engineeringFees: {
        description: 'Bureau d\'études',
        amount: directCostsHT * 0.02,
        percentage: 2,
      },
      permitFees: {
        description: 'Frais de permis',
        amount: this.getPermitCost(workProject),
      },
      insuranceFees: {
        description: 'Assurance dommages-ouvrage',
        amount: directCostsTTC * 0.02,
        percentage: 2,
      },
      coordinationFees: {
        description: 'Coordination SPS',
        amount: selectedLots.length > 3 ? 1500 : 0,
      },
      otherFees: [],
      totalIndirect: 0, // Calculated below
    };

    indirectCosts.totalIndirect =
      indirectCosts.architectFees.amount +
      indirectCosts.engineeringFees.amount +
      indirectCosts.permitFees.amount +
      indirectCosts.insuranceFees.amount +
      indirectCosts.coordinationFees.amount;

    // Calculate contingency
    const contingencyRate = this.getContingencyRate(property, selectedLots);
    const contingency: ContingencyAllocation = {
      percentage: contingencyRate * 100,
      amount: directCostsHT * contingencyRate,
      breakdown: [
        { category: 'Imprévus techniques', percentage: 60, amount: directCostsHT * contingencyRate * 0.6 },
        { category: 'Variations prix', percentage: 20, amount: directCostsHT * contingencyRate * 0.2 },
        { category: 'Ajouts/Modifications', percentage: 20, amount: directCostsHT * contingencyRate * 0.2 },
      ],
    };

    const totalHT = directCostsHT + indirectCosts.totalIndirect + contingency.amount;
    const averageTVA = directCostsTTC / directCostsHT - 1;
    const totalTTC = totalHT * (1 + averageTVA);

    return {
      directCosts,
      indirectCosts,
      contingency,
      totalHT,
      tvaAmount: totalTTC - totalHT,
      totalTTC,
      pricePerSqm: Math.round(totalTTC / surface),
      confidence: this.calculateCostConfidence(selectedLots, property),
    };
  }

  /**
   * Calculates all eligible aides
   */
  static calculateAides(input: AidesCalculationInput): AidesAnalysis {
    const { ownerProfile, property, selectedLots, totalWorksCost, dpeClass, targetDpeClass } = input;

    const eligibleAides: AideEligibility[] = [];

    // Determine MaPrimeRénov' category
    const mprCategory = this.determineMPRCategory(ownerProfile, property);

    // Calculate MaPrimeRénov'
    const mprAnalysis = this.calculateMaPrimeRenov(
      selectedLots,
      mprCategory,
      property,
      totalWorksCost,
      dpeClass,
      targetDpeClass
    );

    if (mprAnalysis.totalAmount > 0) {
      eligibleAides.push({
        id: 'maprimenov',
        name: 'MaPrimeRénov\'',
        type: 'prime',
        amount: mprAnalysis.totalAmount,
        conditions: mprAnalysis.conditions,
        requirements: ['Artisan RGE', 'Devis avant travaux', 'Logement > 15 ans'],
        applicationUrl: 'https://www.maprimerenov.gouv.fr',
        isCumulative: true,
      });
    }

    // Calculate Éco-PTZ eligibility
    const ecoPTZ = this.calculateEcoPTZ(selectedLots, totalWorksCost);
    if (ecoPTZ.eligible) {
      eligibleAides.push({
        id: 'ecoptz',
        name: 'Éco-PTZ',
        type: 'loan',
        amount: ecoPTZ.maxAmount,
        conditions: ['Logement > 2 ans', 'Résidence principale'],
        requirements: ['Artisan RGE', 'Au moins une action éligible'],
        isCumulative: true,
      });
    }

    // Calculate CEE (Certificats d'Économie d'Énergie)
    const ceeAnalysis = this.calculateCEE(selectedLots, property, mprCategory);
    if (ceeAnalysis.totalAmount > 0) {
      eligibleAides.push({
        id: 'cee',
        name: 'Prime CEE',
        type: 'prime',
        amount: ceeAnalysis.totalAmount,
        conditions: ['Logement > 2 ans'],
        requirements: ['Contrat signé AVANT travaux', 'Artisan RGE'],
        isCumulative: true,
      });
    }

    // Local aides (simplified - would query database in production)
    const localAides = this.getLocalAides(property, selectedLots);
    eligibleAides.push(...localAides);

    // Calculate totals
    const totalEligible = eligibleAides.reduce((sum, a) => sum + a.amount, 0);
    const netCost = totalWorksCost - totalEligible;

    return {
      ownerCategory: mprCategory,
      eligibleAides,
      maPrimeRenov: mprAnalysis,
      ecoPTZ,
      cee: ceeAnalysis,
      localAides: {
        region: [],
        department: [],
        commune: [],
        totalLocal: localAides.reduce((sum, a) => sum + a.amount, 0),
      },
      totalEligible,
      netCostAfterAides: netCost,
      savingsPercentage: Math.round((totalEligible / totalWorksCost) * 100),
    };
  }

  /**
   * Generates financing plan
   */
  static generateFinancingPlan(
    totalCost: number,
    aidesAnalysis: AidesAnalysis,
    ownerProfile: Partial<MasterOwnerProfile>
  ): FinancingPlan {
    const sources: FinancingSource[] = [];
    let remainingToFinance = totalCost;

    // Add aides as financing sources
    aidesAnalysis.eligibleAides.forEach(aide => {
      if (aide.type === 'prime') {
        sources.push({
          type: 'aide',
          name: aide.name,
          amount: aide.amount,
          percentage: Math.round((aide.amount / totalCost) * 100),
          conditions: aide.conditions,
          status: 'potential',
        });
        remainingToFinance -= aide.amount;
      }
    });

    // Add personal contribution
    const personalContribution = ownerProfile.financial?.personalContribution || 0;
    if (personalContribution > 0) {
      const contributionUsed = Math.min(personalContribution, remainingToFinance);
      sources.push({
        type: 'apport',
        name: 'Apport personnel',
        amount: contributionUsed,
        percentage: Math.round((contributionUsed / totalCost) * 100),
        status: 'confirmed',
      });
      remainingToFinance -= contributionUsed;
    }

    // Add Éco-PTZ if eligible
    if (aidesAnalysis.ecoPTZ.eligible && remainingToFinance > 0) {
      const ecoPTZAmount = Math.min(aidesAnalysis.ecoPTZ.maxAmount, remainingToFinance);
      sources.push({
        type: 'pret',
        name: 'Éco-PTZ',
        amount: ecoPTZAmount,
        percentage: Math.round((ecoPTZAmount / totalCost) * 100),
        interestRate: 0,
        duration: aidesAnalysis.ecoPTZ.duration,
        monthlyPayment: Math.round(ecoPTZAmount / (aidesAnalysis.ecoPTZ.duration * 12)),
        status: 'potential',
      });
      remainingToFinance -= ecoPTZAmount;
    }

    // Add standard loan for remaining amount
    if (remainingToFinance > 0) {
      const loan = this.simulateLoan(remainingToFinance, 10, 4.5);
      sources.push({
        type: 'pret',
        name: 'Prêt travaux',
        amount: remainingToFinance,
        percentage: Math.round((remainingToFinance / totalCost) * 100),
        interestRate: 4.5,
        duration: 10,
        monthlyPayment: loan.monthlyPayment,
        totalInterest: loan.totalInterest,
        status: 'potential',
      });
    }

    // Calculate total monthly payment
    const monthlyPayment = sources
      .filter(s => s.type === 'pret')
      .reduce((sum, s) => sum + (s.monthlyPayment || 0), 0);

    return {
      totalRequired: totalCost,
      totalAides: aidesAnalysis.totalEligible,
      totalLoans: sources.filter(s => s.type === 'pret').reduce((sum, s) => sum + s.amount, 0),
      personalContribution: sources.find(s => s.type === 'apport')?.amount || 0,
      sources,
      monthlyPayment,
      financingRate: Math.round(((totalCost - (sources.find(s => s.type === 'apport')?.amount || 0)) / totalCost) * 100),
    };
  }

  /**
   * Simulates a loan
   */
  static simulateLoan(
    amount: number,
    durationYears: number,
    annualRate: number
  ): LoanSimulation {
    const monthlyRate = annualRate / 100 / 12;
    const numberOfPayments = durationYears * 12;

    const monthlyPayment = amount *
      (monthlyRate * Math.pow(1 + monthlyRate, numberOfPayments)) /
      (Math.pow(1 + monthlyRate, numberOfPayments) - 1);

    const totalPayment = monthlyPayment * numberOfPayments;
    const totalInterest = totalPayment - amount;

    // Generate amortization schedule (simplified - first and last)
    const schedule = [
      {
        month: 1,
        payment: Math.round(monthlyPayment),
        principal: Math.round(monthlyPayment - amount * monthlyRate),
        interest: Math.round(amount * monthlyRate),
        balance: Math.round(amount - (monthlyPayment - amount * monthlyRate)),
      },
    ];

    return {
      amount,
      duration: durationYears,
      annualRate,
      monthlyPayment: Math.round(monthlyPayment),
      totalPayment: Math.round(totalPayment),
      totalInterest: Math.round(totalInterest),
      schedule,
    };
  }

  /**
   * Calculates ROI for energy renovation
   */
  static calculateROI(
    costs: CostEstimation,
    aides: AidesAnalysis,
    property: Partial<Property>,
    currentDpe?: string,
    targetDpe?: string
  ): ROIAnalysis {
    // Estimate annual energy savings
    const surface = property.characteristics?.surfaces?.livingArea || 100;
    const currentConsumption = this.getDpeConsumption(currentDpe || 'E');
    const targetConsumption = this.getDpeConsumption(targetDpe || 'C');
    const energySavingsKwh = (currentConsumption - targetConsumption) * surface;
    const energyPriceKwh = 0.18; // Average energy price €/kWh
    const annualSavings = energySavingsKwh * energyPriceKwh;

    const netInvestment = costs.totalTTC - aides.totalEligible;
    const paybackYears = netInvestment / annualSavings;

    // Property value increase (estimate 5-15% for DPE improvement)
    const propertyValue = property.financial?.estimatedValue || surface * 3000;
    const valueIncreasePercent = this.getValueIncreasePercent(currentDpe, targetDpe);
    const valueIncrease = propertyValue * valueIncreasePercent;

    return {
      investmentCost: costs.totalTTC,
      aidesReceived: aides.totalEligible,
      netInvestment,
      annualEnergySavings: Math.round(annualSavings),
      paybackPeriod: Math.round(paybackYears * 10) / 10,
      propertyValueIncrease: Math.round(valueIncrease),
      totalBenefit10Years: Math.round(annualSavings * 10 + valueIncrease),
      roi10Years: Math.round(((annualSavings * 10 + valueIncrease) / netInvestment - 1) * 100),
    };
  }

  /**
   * Generates cash flow projection
   */
  static generateCashFlowProjection(
    costs: CostEstimation,
    financing: FinancingPlan,
    selectedLots: SelectedLot[]
  ): CashFlowProjection {
    const months: CashFlowMonth[] = [];
    const totalDuration = this.estimateProjectDuration(selectedLots);
    const monthlyExpense = costs.totalTTC / totalDuration;

    let cumulativeExpenses = 0;
    let cumulativeIncome = 0;

    // Distribute aides reception over project
    const aidesTotal = financing.totalAides;
    const aidesMonth = Math.ceil(totalDuration / 2); // Receive aides mid-project

    for (let month = 1; month <= totalDuration + 3; month++) {
      const expenses = month <= totalDuration ? monthlyExpense : 0;
      cumulativeExpenses += expenses;

      const income = month === aidesMonth ? aidesTotal :
                     month === 1 ? financing.personalContribution : 0;
      cumulativeIncome += income;

      months.push({
        month,
        expenses: Math.round(expenses),
        income: Math.round(income),
        cumulativeExpenses: Math.round(cumulativeExpenses),
        cumulativeIncome: Math.round(cumulativeIncome),
        balance: Math.round(cumulativeIncome - cumulativeExpenses),
      });
    }

    const peakFinancingNeed = Math.max(...months.map(m => m.cumulativeExpenses - m.cumulativeIncome));

    return {
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + totalDuration * 30 * 24 * 60 * 60 * 1000).toISOString(),
      months,
      peakFinancingNeed: Math.round(peakFinancingNeed),
      aidesReceptionTimeline: [
        { aide: 'MaPrimeRénov\'', expectedMonth: aidesMonth, amount: aidesTotal * 0.7 },
        { aide: 'CEE', expectedMonth: totalDuration + 2, amount: aidesTotal * 0.3 },
      ],
    };
  }

  /**
   * Saves budget plan to database
   */
  static async saveBudgetPlan(projectId: string, plan: BudgetPlan): Promise<BudgetPlan> {
    const { data: budgetData, error: budgetError } = await supabase
      .from('phase0_budget_items')
      .upsert({
        project_id: projectId,
        status: plan.status,
        version: plan.version,
        cost_estimation: plan.costEstimation,
        summary: plan.summary,
        metadata: plan.torpMetadata,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'project_id' })
      .select()
      .single();

    if (budgetError) {
      throw new Error(`Erreur budget: ${budgetError.message}`);
    }

    // Save financing sources
    const { error: financingError } = await supabase
      .from('phase0_financing_sources')
      .upsert(
        plan.financingPlan.sources.map(source => ({
          project_id: projectId,
          source_type: source.type,
          name: source.name,
          amount: source.amount,
          status: source.status,
          details: source,
        })),
        { onConflict: 'project_id,source_type,name' }
      );

    if (financingError) {
      console.error('Error saving financing sources:', financingError);
    }

    // Save aides eligibility
    const { error: aidesError } = await supabase
      .from('phase0_aides_eligibility')
      .upsert(
        plan.aidesAnalysis.eligibleAides.map(aide => ({
          project_id: projectId,
          aide_type: aide.type,
          aide_name: aide.name,
          amount: aide.amount,
          status: aide.status || 'potential',
          conditions: aide.conditions,
          requirements: aide.requirements,
        })),
        { onConflict: 'project_id,aide_type,aide_name' }
      );

    if (aidesError) {
      console.error('Error saving aides eligibility:', aidesError);
    }

    return { ...plan, id: budgetData.id, projectId };
  }

  /**
   * Gets budget plan by project ID
   */
  static async getBudgetPlanByProjectId(projectId: string): Promise<BudgetPlan | null> {
    const { data, error } = await supabase
      .from('phase0_budget_items')
      .select('*')
      .eq('project_id', projectId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Erreur: ${error.message}`);
    }

    // Get financing sources
    const { data: sourcesData } = await supabase
      .from('phase0_financing_sources')
      .select('*')
      .eq('project_id', projectId);

    // Get aides eligibility
    const { data: aidesData } = await supabase
      .from('phase0_aides_eligibility')
      .select('*')
      .eq('project_id', projectId);

    return this.mapRowToBudgetPlan(data, sourcesData || [], aidesData || []);
  }

  // =============================================================================
  // PRIVATE METHODS
  // =============================================================================

  private static estimateLotCost(
    lot: SelectedLot,
    surface: number,
    finishLevel: string
  ): EstimationRange {
    if (lot.estimatedBudget) return lot.estimatedBudget;

    const basePrices: Record<string, { min: number; max: number }> = {
      demolition: { min: 30, max: 80 },
      gros_oeuvre: { min: 150, max: 400 },
      electricite: { min: 80, max: 150 },
      plomberie: { min: 60, max: 120 },
      chauffage: { min: 100, max: 250 },
      isolation_thermique: { min: 40, max: 100 },
      menuiseries_exterieures: { min: 500, max: 1200 }, // per unit
      peinture: { min: 15, max: 35 },
      carrelage_faience: { min: 50, max: 120 },
    };

    const basePrice = basePrices[lot.type] || { min: 50, max: 150 };
    const finishMultiplier = finishLevel === 'premium' ? 1.3 :
                             finishLevel === 'luxury' ? 1.6 :
                             finishLevel === 'basic' ? 0.8 : 1.0;

    const quantity = lot.estimatedQuantity || surface;

    return {
      min: Math.round(basePrice.min * quantity * finishMultiplier),
      max: Math.round(basePrice.max * quantity * finishMultiplier),
    };
  }

  private static getTVARate(lotType: string, property: Partial<Property>): number {
    const yearBuilt = property.construction?.yearBuilt || 2000;
    const buildingAge = new Date().getFullYear() - yearBuilt;

    // TVA réduite 10% for buildings > 2 years (renovation)
    // TVA super-réduite 5.5% for energy efficiency works
    const energyLots = ['isolation_thermique', 'chauffage', 'menuiseries_exterieures', 'ventilation'];

    if (buildingAge >= 2) {
      if (energyLots.includes(lotType)) return 0.055;
      return 0.10;
    }
    return 0.20;
  }

  private static getPermitCost(workProject: Partial<WorkProject>): number {
    const declarationType = workProject.regulatory?.declarationType;
    if (declarationType === 'building_permit') return 500;
    if (declarationType === 'prior_declaration') return 100;
    return 0;
  }

  private static getContingencyRate(
    property: Partial<Property>,
    lots: SelectedLot[]
  ): number {
    let rate = 0.08;

    const yearBuilt = property.construction?.yearBuilt || 2000;
    if (yearBuilt < 1970) rate += 0.05;

    const structuralLots = ['gros_oeuvre', 'charpente', 'fondations'];
    if (lots.some(l => structuralLots.includes(l.type))) rate += 0.03;

    return rate;
  }

  private static aggregateByCategoryFromCosts(
    costs: CostBreakdownItem[]
  ): Array<{ category: string; totalHT: number; percentage: number }> {
    const categories: Record<string, number> = {};
    const total = costs.reduce((sum, c) => sum + c.totalHT, 0);

    costs.forEach(cost => {
      const cat = this.getLotCategory(cost.subcategory || '');
      categories[cat] = (categories[cat] || 0) + cost.totalHT;
    });

    return Object.entries(categories).map(([category, totalHT]) => ({
      category,
      totalHT,
      percentage: Math.round((totalHT / total) * 100),
    }));
  }

  private static getLotCategory(lotType: string): string {
    const mapping: Record<string, string> = {
      gros_oeuvre: 'Gros œuvre',
      demolition: 'Gros œuvre',
      electricite: 'Lots techniques',
      plomberie: 'Lots techniques',
      chauffage: 'Lots techniques',
      isolation_thermique: 'Second œuvre',
      peinture: 'Finitions',
      carrelage_faience: 'Finitions',
    };
    return mapping[lotType] || 'Divers';
  }

  private static calculateCostConfidence(
    lots: SelectedLot[],
    property: Partial<Property>
  ): number {
    let confidence = 60;

    if (property.characteristics?.surfaces?.livingArea) confidence += 15;
    if (property.construction?.yearBuilt) confidence += 10;

    const lotsWithBudget = lots.filter(l => l.estimatedBudget).length;
    confidence += Math.min(lotsWithBudget * 3, 15);

    return Math.min(confidence, 90);
  }

  private static determineMPRCategory(
    ownerProfile: Partial<MasterOwnerProfile>,
    property: Partial<Property>
  ): MaPrimeRenovCategory {
    const income = ownerProfile.financial?.annualIncome || 0;
    const householdSize = ownerProfile.household?.size || 1;
    const postalCode = property.identification?.address?.postalCode || '';
    const isIDF = postalCode.startsWith('75') || postalCode.startsWith('77') ||
                  postalCode.startsWith('78') || postalCode.startsWith('91') ||
                  postalCode.startsWith('92') || postalCode.startsWith('93') ||
                  postalCode.startsWith('94') || postalCode.startsWith('95');

    const thresholds = isIDF ? MPR_THRESHOLDS_IDF : MPR_THRESHOLDS_OTHER;
    const index = Math.min(householdSize - 1, 4);
    const additionalPersons = Math.max(0, householdSize - 5);

    const veryModestThreshold = thresholds.very_modest[index] +
      additionalPersons * thresholds.very_modest[5];
    const modestThreshold = thresholds.modest[index] +
      additionalPersons * thresholds.modest[5];
    const intermediateThreshold = thresholds.intermediate[index] +
      additionalPersons * thresholds.intermediate[5];

    if (income <= veryModestThreshold) return 'blue';
    if (income <= modestThreshold) return 'yellow';
    if (income <= intermediateThreshold) return 'violet';
    return 'pink';
  }

  private static calculateMaPrimeRenov(
    lots: SelectedLot[],
    category: MaPrimeRenovCategory,
    property: Partial<Property>,
    totalCost: number,
    currentDpe?: string,
    targetDpe?: string
  ): MaPrimeRenovAnalysis {
    let totalAmount = 0;
    const eligibleWorks: Array<{ name: string; amount: number }> = [];
    const conditions: string[] = [];

    const surface = property.characteristics?.surfaces?.livingArea || 100;
    const amounts = MPR_AMOUNTS[category];

    // Check global renovation eligibility (parcours accompagné)
    const dpeImprovement = this.calculateDpeImprovement(currentDpe, targetDpe);
    if (dpeImprovement >= 2 && this.isGlobalRenovation(lots)) {
      const globalAmounts = MPR_GLOBAL_RENOVATION[category][`${dpeImprovement}_classes`];
      if (globalAmounts) {
        const globalAmount = Math.min(totalCost * globalAmounts.percentage / 100, globalAmounts.cap);
        return {
          category,
          eligible: true,
          totalAmount: globalAmount,
          eligibleWorks: [{ name: 'Rénovation globale', amount: globalAmount }],
          conditions: [
            'Amélioration d\'au moins 2 classes DPE',
            'Accompagnement par un Accompagnateur Rénov\'',
            'Audit énergétique obligatoire',
          ],
          maxCeiling: globalAmounts.cap,
        };
      }
    }

    // Individual works (parcours décarboné)
    lots.forEach(lot => {
      let workAmount = 0;
      let workName = lot.name;

      switch (lot.type) {
        case 'isolation_thermique':
          if (lot.description?.toLowerCase().includes('mur')) {
            if (lot.description?.toLowerCase().includes('ext')) {
              workAmount = (amounts.isolation_murs_ext || 0) * surface * 0.8;
              workName = 'Isolation murs par l\'extérieur';
            } else {
              workAmount = (amounts.isolation_murs_int || 0) * surface * 0.8;
              workName = 'Isolation murs par l\'intérieur';
            }
          } else if (lot.description?.toLowerCase().includes('toiture') ||
                     lot.description?.toLowerCase().includes('comble')) {
            workAmount = (amounts.isolation_toiture || 0) * surface * 0.6;
            workName = 'Isolation toiture/combles';
          } else if (lot.description?.toLowerCase().includes('plancher')) {
            workAmount = (amounts.isolation_plancher || 0) * surface * 0.5;
            workName = 'Isolation plancher bas';
          }
          break;

        case 'chauffage':
          if (lot.description?.toLowerCase().includes('pompe') &&
              lot.description?.toLowerCase().includes('chaleur')) {
            if (lot.description?.toLowerCase().includes('géo')) {
              workAmount = amounts.pompe_chaleur_geothermie || 0;
              workName = 'Pompe à chaleur géothermique';
            } else {
              workAmount = amounts.pompe_chaleur_air_eau || 0;
              workName = 'Pompe à chaleur air/eau';
            }
          } else if (lot.description?.toLowerCase().includes('granul')) {
            workAmount = amounts.chaudiere_granules || 0;
            workName = 'Chaudière à granulés';
          }
          break;

        case 'menuiseries_exterieures':
          const windowCount = Math.ceil(surface / 15); // Estimate 1 window per 15m²
          workAmount = (amounts.fenetre || 0) * windowCount;
          workName = `Remplacement fenêtres (${windowCount} unités estimées)`;
          break;

        case 'ventilation':
          if (lot.description?.toLowerCase().includes('double flux')) {
            workAmount = amounts.ventilation_double_flux || 0;
            workName = 'VMC double flux';
          }
          break;
      }

      if (workAmount > 0) {
        totalAmount += workAmount;
        eligibleWorks.push({ name: workName, amount: Math.round(workAmount) });
      }
    });

    conditions.push('Logement de plus de 15 ans');
    conditions.push('Travaux réalisés par un artisan RGE');
    conditions.push('Résidence principale');

    return {
      category,
      eligible: totalAmount > 0,
      totalAmount: Math.round(totalAmount),
      eligibleWorks,
      conditions,
      maxCeiling: 40000, // Plafond général
    };
  }

  private static calculateEcoPTZ(
    lots: SelectedLot[],
    totalCost: number
  ): EcoPTZAnalysis {
    const energyLots = ['isolation_thermique', 'chauffage', 'menuiseries_exterieures', 'ventilation'];
    const eligibleLots = lots.filter(l => energyLots.includes(l.type));
    const actionCount = eligibleLots.length;

    if (actionCount === 0) {
      return { eligible: false, maxAmount: 0, duration: 0, eligibleActions: [] };
    }

    // Éco-PTZ amounts based on number of actions
    let maxAmount = 15000; // 1 action
    let duration = 15; // years

    if (actionCount >= 3) {
      maxAmount = 30000;
      duration = 15;
    } else if (actionCount === 2) {
      maxAmount = 25000;
      duration = 15;
    }

    // Performance globale = 50 000€
    if (this.isGlobalRenovation(lots)) {
      maxAmount = 50000;
      duration = 20;
    }

    return {
      eligible: true,
      maxAmount: Math.min(maxAmount, totalCost),
      duration,
      eligibleActions: eligibleLots.map(l => l.name),
      monthlyCostZero: Math.round(Math.min(maxAmount, totalCost) / (duration * 12)),
    };
  }

  private static calculateCEE(
    lots: SelectedLot[],
    property: Partial<Property>,
    mprCategory: MaPrimeRenovCategory
  ): CEEAnalysis {
    let totalKwhCumac = 0;
    let totalAmount = 0;
    const eligibleWorks: Array<{ name: string; kwhCumac: number; amount: number }> = [];

    const surface = property.characteristics?.surfaces?.livingArea || 100;

    // Bonus for modest households
    const bonusMultiplier = mprCategory === 'blue' ? 1.5 :
                            mprCategory === 'yellow' ? 1.3 : 1;

    lots.forEach(lot => {
      let ceeData: { kwh_cumac: number; price_per_kwh: number } | undefined;
      let quantity = 1;

      switch (lot.type) {
        case 'isolation_thermique':
          if (lot.description?.toLowerCase().includes('mur')) {
            ceeData = CEE_VALUES.isolation_murs;
            quantity = surface * 0.8;
          } else if (lot.description?.toLowerCase().includes('toiture')) {
            ceeData = CEE_VALUES.isolation_toiture;
            quantity = surface * 0.6;
          } else if (lot.description?.toLowerCase().includes('plancher')) {
            ceeData = CEE_VALUES.isolation_plancher;
            quantity = surface * 0.5;
          }
          break;

        case 'chauffage':
          if (lot.description?.toLowerCase().includes('pompe')) {
            ceeData = CEE_VALUES.pompe_chaleur;
          } else if (lot.description?.toLowerCase().includes('chaudière')) {
            ceeData = CEE_VALUES.chaudiere_performante;
          }
          break;

        case 'menuiseries_exterieures':
          ceeData = CEE_VALUES.fenetre;
          quantity = Math.ceil(surface / 15);
          break;
      }

      if (ceeData) {
        const kwhCumac = ceeData.kwh_cumac * quantity;
        const amount = kwhCumac * ceeData.price_per_kwh * bonusMultiplier;

        totalKwhCumac += kwhCumac;
        totalAmount += amount;

        eligibleWorks.push({
          name: lot.name,
          kwhCumac: Math.round(kwhCumac),
          amount: Math.round(amount),
        });
      }
    });

    return {
      eligible: totalAmount > 0,
      totalKwhCumac: Math.round(totalKwhCumac),
      totalAmount: Math.round(totalAmount),
      eligibleWorks,
      bonusApplied: bonusMultiplier > 1 ? `Bonus ménages ${mprCategory}` : undefined,
    };
  }

  private static getLocalAides(
    property: Partial<Property>,
    lots: SelectedLot[]
  ): AideEligibility[] {
    // Simplified - in production, would query a database of local aides
    const aides: AideEligibility[] = [];
    const postalCode = property.identification?.address?.postalCode || '';
    const isEnergyReno = this.isEnergyRenovation(lots);

    // Example: Île-de-France region aide
    if (postalCode.match(/^(75|77|78|91|92|93|94|95)/)) {
      if (isEnergyReno) {
        aides.push({
          id: 'idf_chaleur',
          name: 'Aide régionale Île-de-France Energies',
          type: 'prime',
          amount: 500,
          conditions: ['Remplacement système de chauffage'],
          requirements: ['Résidence principale en Île-de-France'],
          isCumulative: true,
        });
      }
    }

    // Example: Paris city aide
    if (postalCode.startsWith('75')) {
      aides.push({
        id: 'paris_eco',
        name: 'Éco-rénovons Paris',
        type: 'prime',
        amount: 1000,
        conditions: ['Copropriété parisienne'],
        requirements: ['Audit énergétique réalisé'],
        isCumulative: true,
      });
    }

    return aides;
  }

  private static isEnergyRenovation(lots: SelectedLot[]): boolean {
    const energyLots = ['isolation_thermique', 'chauffage', 'menuiseries_exterieures', 'ventilation'];
    return lots.some(l => energyLots.includes(l.type));
  }

  private static isGlobalRenovation(lots: SelectedLot[]): boolean {
    const energyLots = ['isolation_thermique', 'chauffage', 'menuiseries_exterieures', 'ventilation'];
    const energyLotCount = lots.filter(l => energyLots.includes(l.type)).length;
    return energyLotCount >= 2;
  }

  private static calculateDpeImprovement(currentDpe?: string, targetDpe?: string): number {
    const dpeOrder = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
    const currentIndex = dpeOrder.indexOf(currentDpe || 'E');
    const targetIndex = dpeOrder.indexOf(targetDpe || 'C');

    if (currentIndex < 0 || targetIndex < 0) return 0;
    return currentIndex - targetIndex;
  }

  private static getDpeConsumption(dpeClass: string): number {
    const consumption: Record<string, number> = {
      A: 50, B: 90, C: 150, D: 230, E: 330, F: 450, G: 600,
    };
    return consumption[dpeClass] || 330;
  }

  private static getValueIncreasePercent(currentDpe?: string, targetDpe?: string): number {
    const improvement = this.calculateDpeImprovement(currentDpe, targetDpe);
    if (improvement >= 4) return 0.15;
    if (improvement >= 3) return 0.12;
    if (improvement >= 2) return 0.08;
    if (improvement >= 1) return 0.05;
    return 0;
  }

  private static estimateProjectDuration(lots: SelectedLot[]): number {
    const baseDurations: Record<string, number> = {
      demolition: 0.5,
      gros_oeuvre: 2,
      electricite: 1,
      plomberie: 1,
      chauffage: 0.5,
      isolation_thermique: 1,
      peinture: 1,
    };

    const totalMonths = lots.reduce((sum, lot) => {
      return sum + (baseDurations[lot.type] || 0.5);
    }, 0);

    return Math.max(Math.ceil(totalMonths), 2);
  }

  private static calculateCompleteness(input: BudgetAnalysisInput): number {
    let completeness = 0;

    if (input.property?.characteristics?.surfaces) completeness += 20;
    if (input.selectedLots.length > 0) completeness += 30;
    if (input.ownerProfile?.financial?.annualIncome) completeness += 20;
    if (input.dpeClass) completeness += 15;
    if (input.targetDpeClass) completeness += 15;

    return completeness;
  }

  private static mapRowToBudgetPlan(
    row: Record<string, unknown>,
    sources: Record<string, unknown>[],
    aides: Record<string, unknown>[]
  ): BudgetPlan {
    return {
      id: row.id as string,
      projectId: row.project_id as string,
      status: row.status as BudgetStatus,
      version: row.version as number,
      costEstimation: row.cost_estimation as CostEstimation,
      financingPlan: {
        totalRequired: 0,
        totalAides: 0,
        totalLoans: 0,
        personalContribution: 0,
        sources: sources.map(s => s.details as FinancingSource),
        monthlyPayment: 0,
        financingRate: 0,
      },
      aidesAnalysis: {
        ownerCategory: 'violet',
        eligibleAides: aides.map(a => ({
          id: a.aide_type as string,
          name: a.aide_name as string,
          type: a.aide_type as string,
          amount: a.amount as number,
          conditions: a.conditions as string[],
          requirements: a.requirements as string[],
          isCumulative: true,
        })),
        totalEligible: aides.reduce((sum, a) => sum + (a.amount as number), 0),
        netCostAfterAides: 0,
        savingsPercentage: 0,
      },
      summary: row.summary as BudgetPlan['summary'],
      torpMetadata: row.metadata as BudgetPlan['torpMetadata'],
    };
  }
}

export default BudgetService;
