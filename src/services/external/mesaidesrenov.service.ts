// ─────────────────────────────────────────────────────────────────────────────
// mesaidesrenov.service.ts — Renovation financial aids simulator
//
// No public API exists for Mes Aides Rénov (mesaides-reno.beta.gouv.fr).
// This service implements the official eligibility rules as a local simulation
// based on the published reference guide (ANAH / DGEC, 2024-2025).
//
// Sources:
//   - MaPrimeRénov': https://www.anah.gouv.fr/maprimerenov
//   - CEE (Certificats d'Économies d'Énergie): arrêtés publiés au JORF
//   - Éco-PTZ: article L315-1 du Code de la construction
//   - TVA 5.5%: article 278-0 bis A du CGI
// ─────────────────────────────────────────────────────────────────────────────

import { structuredLogger } from '@/services/observability/structured-logger.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export type RevenueCategory =
  | 'tres_modestes'    // < plafond ANAH très modestes
  | 'modestes'         // < plafond ANAH modestes
  | 'intermediaires'   // < plafond ANAH intermédiaires
  | 'superieurs';      // revenus supérieurs

export type WorkType =
  | 'isolation_combles'
  | 'isolation_murs'
  | 'isolation_planchers'
  | 'remplacement_chaudiere_gaz'
  | 'pompe_chaleur_air_eau'
  | 'pompe_chaleur_air_air'
  | 'chauffe_eau_thermodynamique'
  | 'ventilation_vmc'
  | 'fenetres_double_vitrage'
  | 'audit_energetique'
  | 'renovation_globale';

export interface RenovationAid {
  name:               string;
  type:               'subvention' | 'credit_impot' | 'pret' | 'tva_reduite';
  montant_estime:     number | null;   // EUR (null = variable/non calculable)
  taux_aide:          number | null;   // % du coût des travaux (0–1)
  description:        string;
  conditions:         string[];
  eligible:           boolean;
  url_info:           string | null;
}

export interface AidsSimulationResult {
  eligible_aids:      RenovationAid[];
  total_estime_min:   number;          // EUR
  total_estime_max:   number;          // EUR
  revenue_category:   RevenueCategory | null;
  departement:        string | null;
  simulation_note:    string;
  source:             'simulation-locale';
}

export interface SimulationInput {
  code_postal:        string;
  revenue_fiscal_ref: number | null;   // EUR
  nb_personnes_foyer: number;
  work_types:         WorkType[];
  cout_travaux:       number | null;   // EUR estimé
  annee_construction: number | null;
  est_proprietaire:   boolean;
}

// ── Revenue thresholds (Île-de-France vs. autres régions, 2024) ───────────────
// Source: ANAH — Barème applicable au 1er janvier 2024

const THRESHOLDS_IDF: Record<number, { tres_modestes: number; modestes: number; intermediaires: number }> = {
  1: { tres_modestes: 23_541, modestes: 28_657, intermediaires: 40_018 },
  2: { tres_modestes: 34_551, modestes: 42_058, intermediaires: 58_827 },
  3: { tres_modestes: 41_493, modestes: 50_513, intermediaires: 70_382 },
  4: { tres_modestes: 48_447, modestes: 58_981, intermediaires: 82_839 },
  5: { tres_modestes: 55_427, modestes: 67_462, intermediaires: 94_844 },
};

const THRESHOLDS_AUTRES: Record<number, { tres_modestes: number; modestes: number; intermediaires: number }> = {
  1: { tres_modestes: 17_009, modestes: 21_805, intermediaires: 30_549 },
  2: { tres_modestes: 24_875, modestes: 31_889, intermediaires: 44_907 },
  3: { tres_modestes: 29_917, modestes: 38_349, intermediaires: 54_071 },
  4: { tres_modestes: 34_948, modestes: 44_802, intermediaires: 63_235 },
  5: { tres_modestes: 40_002, modestes: 51_281, intermediaires: 72_400 },
};

/** Departments in Île-de-France */
const IDF_DEPTS = new Set(['75', '77', '78', '91', '92', '93', '94', '95']);

// ── Aid rates by work type and revenue category (MaPrimeRénov' 2024) ──────────
// Source: Arrêté du 17 novembre 2020 modifié — forfaits MaPrimeRénov'

type AidRate = { tres_modestes: number; modestes: number; intermediaires: number; superieurs: number };

const MPR_RATES: Partial<Record<WorkType, AidRate>> = {
  isolation_combles:            { tres_modestes: 0.75, modestes: 0.60, intermediaires: 0.40, superieurs: 0.15 },
  isolation_murs:               { tres_modestes: 0.75, modestes: 0.60, intermediaires: 0.40, superieurs: 0.15 },
  isolation_planchers:          { tres_modestes: 0.75, modestes: 0.60, intermediaires: 0.40, superieurs: 0.15 },
  remplacement_chaudiere_gaz:   { tres_modestes: 0.00, modestes: 0.00, intermediaires: 0.00, superieurs: 0.00 }, // non éligible depuis 2024
  pompe_chaleur_air_eau:        { tres_modestes: 0.70, modestes: 0.50, intermediaires: 0.40, superieurs: 0.20 },
  pompe_chaleur_air_air:        { tres_modestes: 0.50, modestes: 0.40, intermediaires: 0.30, superieurs: 0.15 },
  chauffe_eau_thermodynamique:  { tres_modestes: 0.70, modestes: 0.50, intermediaires: 0.40, superieurs: 0.25 },
  ventilation_vmc:              { tres_modestes: 0.75, modestes: 0.60, intermediaires: 0.40, superieurs: 0.15 },
  fenetres_double_vitrage:      { tres_modestes: 0.40, modestes: 0.20, intermediaires: 0.00, superieurs: 0.00 },
  audit_energetique:            { tres_modestes: 0.70, modestes: 0.70, intermediaires: 0.50, superieurs: 0.30 },
  renovation_globale:           { tres_modestes: 0.80, modestes: 0.60, intermediaires: 0.45, superieurs: 0.30 },
};

// ── Service ───────────────────────────────────────────────────────────────────

export class MesAidesRenovService {

  /**
   * Simulate available renovation financial aids based on project profile.
   * Uses official ANAH/DGEC eligibility rules (2024-2025 reference).
   */
  simulate(input: SimulationInput): AidsSimulationResult {
    try {
      const dept = input.code_postal.slice(0, 2);
      const isIdf = IDF_DEPTS.has(dept);

      const revCat = this.computeRevenueCategory(
        input.revenue_fiscal_ref,
        input.nb_personnes_foyer,
        isIdf
      );

      const aids: RenovationAid[] = [];

      // ── MaPrimeRénov' ─────────────────────────────────────────────────────
      if (input.est_proprietaire) {
        for (const workType of input.work_types) {
          const aid = this.computeMPR(workType, revCat, input.cout_travaux);
          if (aid) aids.push(aid);
        }
      }

      // ── CEE (Certificats d'Économies d'Énergie) ───────────────────────────
      const ceeAid = this.computeCEE(input.work_types, input.cout_travaux);
      if (ceeAid) aids.push(ceeAid);

      // ── Éco-PTZ ───────────────────────────────────────────────────────────
      if (input.est_proprietaire && input.annee_construction != null && input.annee_construction < 1990) {
        aids.push(this.ecoProtzAid());
      }

      // ── TVA 5.5% ──────────────────────────────────────────────────────────
      if (input.annee_construction == null || input.annee_construction >= 1990) {
        aids.push(this.tvaAid(input.cout_travaux));
      }

      const eligible = aids.filter(a => a.eligible);
      const [min, max] = this.estimateTotals(eligible, input.cout_travaux);

      return {
        eligible_aids:    eligible,
        total_estime_min: min,
        total_estime_max: max,
        revenue_category: revCat,
        departement:      dept,
        simulation_note:  'Simulation indicative basée sur le barème ANAH 2024. ' +
                          'Les montants réels dépendent de l\'instruction du dossier.',
        source:           'simulation-locale',
      };
    } catch (err) {
      structuredLogger.warn({ message: 'MesAidesRenov simulation error', error: String(err) });
      throw err;
    }
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private computeRevenueCategory(
    rfr: number | null,
    nbPersonnes: number,
    isIdf: boolean
  ): RevenueCategory | null {
    if (rfr == null) return null;
    const n = Math.min(Math.max(nbPersonnes, 1), 5);
    const t = isIdf ? THRESHOLDS_IDF[n] : THRESHOLDS_AUTRES[n];

    if (rfr <= t.tres_modestes)  return 'tres_modestes';
    if (rfr <= t.modestes)       return 'modestes';
    if (rfr <= t.intermediaires) return 'intermediaires';
    return 'superieurs';
  }

  private computeMPR(
    workType: WorkType,
    revCat: RevenueCategory | null,
    coutTravaux: number | null
  ): RenovationAid | null {
    const rates = MPR_RATES[workType];
    if (!rates) return null;

    const taux   = revCat ? rates[revCat] : 0;
    const eligible = taux > 0;
    const montant  = (eligible && coutTravaux != null)
      ? Math.round(coutTravaux * taux)
      : null;

    return {
      name:           `MaPrimeRénov' — ${this.labelWorkType(workType)}`,
      type:           'subvention',
      montant_estime: montant,
      taux_aide:      taux,
      description:    'Aide ANAH pour les travaux de rénovation énergétique.',
      conditions:     [
        'Logement de plus de 15 ans',
        'Propriétaire occupant ou bailleur',
        `Revenu fiscal de référence: catégorie ${revCat ?? 'inconnue'}`,
      ],
      eligible,
      url_info: 'https://www.anah.gouv.fr/maprimerenov',
    };
  }

  private computeCEE(
    workTypes: WorkType[],
    coutTravaux: number | null
  ): RenovationAid | null {
    const ceeEligible: WorkType[] = [
      'isolation_combles', 'isolation_murs', 'isolation_planchers',
      'pompe_chaleur_air_eau', 'chauffe_eau_thermodynamique', 'ventilation_vmc',
    ];
    const hasEligibleWork = workTypes.some(w => ceeEligible.includes(w));
    if (!hasEligibleWork) return null;

    const taux    = 0.10; // CEE ~10% en moyenne
    const montant = coutTravaux != null ? Math.round(coutTravaux * taux) : null;

    return {
      name:           'CEE — Certificats d\'Économies d\'Énergie',
      type:           'subvention',
      montant_estime: montant,
      taux_aide:      taux,
      description:    'Prime énergie versée par les fournisseurs d\'énergie (Coup de Pouce).',
      conditions:     [
        'Travaux réalisés par un professionnel RGE',
        'Logement de plus de 2 ans',
        'Cumulable avec MaPrimeRénov\'',
      ],
      eligible:  true,
      url_info:  'https://www.ecologie.gouv.fr/cee',
    };
  }

  private ecoProtzAid(): RenovationAid {
    return {
      name:           'Éco-PTZ (Prêt à Taux Zéro)',
      type:           'pret',
      montant_estime: 30_000,
      taux_aide:      null,
      description:    'Prêt sans intérêts jusqu\'à 50 000 € pour les rénovations globales.',
      conditions:     [
        'Logement construit avant 1990',
        'Résidence principale',
        'Minimum 2 postes de travaux éligibles ou rénovation globale',
      ],
      eligible:  true,
      url_info:  'https://www.service-public.fr/particuliers/vosdroits/F19905',
    };
  }

  private tvaAid(coutTravaux: number | null): RenovationAid {
    const economie = coutTravaux != null
      ? Math.round(coutTravaux * (0.20 - 0.055))   // économie TVA 20% → 5.5%
      : null;
    return {
      name:           'TVA réduite à 5.5%',
      type:           'tva_reduite',
      montant_estime: economie,
      taux_aide:      0.145, // gain = 14.5 pts de TVA
      description:    'TVA à 5.5% au lieu de 20% sur les travaux de rénovation énergétique.',
      conditions:     [
        'Logement achevé depuis plus de 2 ans',
        'Travaux réalisés par un prestataire assujetti à la TVA',
      ],
      eligible:  true,
      url_info:  'https://www.service-public.fr/professionnels-entreprises/vosdroits/F22576',
    };
  }

  private estimateTotals(
    aids: RenovationAid[],
    coutTravaux: number | null
  ): [number, number] {
    let total = 0;
    for (const a of aids) {
      if (a.montant_estime != null) total += a.montant_estime;
    }
    if (coutTravaux != null) {
      const max = Math.min(total, coutTravaux);
      return [Math.round(max * 0.85), max];
    }
    return [Math.round(total * 0.85), total];
  }

  private labelWorkType(w: WorkType): string {
    const labels: Record<WorkType, string> = {
      isolation_combles:           'Isolation des combles',
      isolation_murs:              'Isolation des murs',
      isolation_planchers:         'Isolation des planchers',
      remplacement_chaudiere_gaz:  'Remplacement chaudière gaz',
      pompe_chaleur_air_eau:       'Pompe à chaleur air/eau',
      pompe_chaleur_air_air:       'Pompe à chaleur air/air',
      chauffe_eau_thermodynamique: 'Chauffe-eau thermodynamique',
      ventilation_vmc:             'Ventilation VMC',
      fenetres_double_vitrage:     'Fenêtres double vitrage',
      audit_energetique:           'Audit énergétique',
      renovation_globale:          'Rénovation globale',
    };
    return labels[w] ?? w;
  }
}
