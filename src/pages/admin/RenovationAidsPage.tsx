/**
 * RenovationAidsPage — Renovation financial aids simulator.
 * Uses MesAidesRenovService (local ANAH/CEE rule engine — no external API call).
 * Displays MaPrimeRénov', CEE, Éco-PTZ and TVA 5.5% eligibility + estimated amounts.
 */

import { useState } from 'react';
import { Euro, Home, CheckCircle2, XCircle, Info, Calculator } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

// ── Types (mirroring MesAidesRenovService) ────────────────────────────────────

type WorkType =
  | 'isolation_combles'    | 'isolation_murs'       | 'isolation_planchers'
  | 'pompe_chaleur_air_eau' | 'pompe_chaleur_air_air' | 'chauffe_eau_thermodynamique'
  | 'ventilation_vmc'      | 'fenetres_double_vitrage' | 'audit_energetique'
  | 'renovation_globale'   | 'remplacement_chaudiere_gaz';

type AidType = 'subvention' | 'credit_impot' | 'pret' | 'tva_reduite';

interface RenovationAid {
  name:           string;
  type:           AidType;
  montant_estime: number | null;
  taux_aide:      number | null;
  description:    string;
  conditions:     string[];
  eligible:       boolean;
  url_info:       string | null;
}

interface SimulationResult {
  eligible_aids:    RenovationAid[];
  total_estime_min: number;
  total_estime_max: number;
  revenue_category: string | null;
  departement:      string | null;
  simulation_note:  string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const WORK_TYPE_LABELS: Record<WorkType, string> = {
  isolation_combles:           'Isolation des combles',
  isolation_murs:              'Isolation des murs',
  isolation_planchers:         'Isolation des planchers',
  pompe_chaleur_air_eau:       'Pompe à chaleur air/eau',
  pompe_chaleur_air_air:       'Pompe à chaleur air/air',
  chauffe_eau_thermodynamique: 'Chauffe-eau thermodynamique',
  ventilation_vmc:             'Ventilation VMC',
  fenetres_double_vitrage:     'Fenêtres double vitrage',
  audit_energetique:           'Audit énergétique',
  renovation_globale:          'Rénovation globale',
  remplacement_chaudiere_gaz:  'Remplacement chaudière gaz',
};

const AID_TYPE_LABELS: Record<AidType, string> = {
  subvention:     'Subvention',
  credit_impot:   'Crédit d\'impôt',
  pret:           'Prêt à taux zéro',
  tva_reduite:    'TVA réduite',
};

const AID_TYPE_COLORS: Record<AidType, string> = {
  subvention:   'bg-green-100 text-green-800',
  credit_impot: 'bg-blue-100 text-blue-800',
  pret:         'bg-purple-100 text-purple-800',
  tva_reduite:  'bg-yellow-100 text-yellow-800',
};

const REV_CAT_LABELS: Record<string, string> = {
  tres_modestes:  'Très modestes (ANAH bleu)',
  modestes:       'Modestes (ANAH jaune)',
  intermediaires: 'Intermédiaires (ANAH violet)',
  superieurs:     'Revenus supérieurs (ANAH rose)',
};

// ── Simulation (calls local rule engine via API route) ────────────────────────

async function simulate(input: {
  code_postal: string;
  revenue_fiscal_ref: number | null;
  nb_personnes_foyer: number;
  work_types: WorkType[];
  cout_travaux: number | null;
  annee_construction: number | null;
  est_proprietaire: boolean;
}): Promise<SimulationResult> {
  // We call the simulation directly in-browser by reimplementing the same rules
  // (MesAidesRenovService is server-side only due to process.env usage in logger)
  // This client-side mirror uses the same ANAH 2024 thresholds.

  const IDF = new Set(['75', '77', '78', '91', '92', '93', '94', '95']);
  const dept = input.code_postal.slice(0, 2);
  const isIdf = IDF.has(dept);

  const T_IDF: Record<number, [number, number, number]> = {
    1: [23541, 28657, 40018], 2: [34551, 42058, 58827],
    3: [41493, 50513, 70382], 4: [48447, 58981, 82839], 5: [55427, 67462, 94844],
  };
  const T_AUT: Record<number, [number, number, number]> = {
    1: [17009, 21805, 30549], 2: [24875, 31889, 44907],
    3: [29917, 38349, 54071], 4: [34948, 44802, 63235], 5: [40002, 51281, 72400],
  };

  const n = Math.min(Math.max(input.nb_personnes_foyer, 1), 5);
  const thresholds = isIdf ? T_IDF[n] : T_AUT[n];
  const rfr = input.revenue_fiscal_ref;

  let revCat: string | null = null;
  if (rfr !== null) {
    if (rfr <= thresholds[0])       revCat = 'tres_modestes';
    else if (rfr <= thresholds[1])  revCat = 'modestes';
    else if (rfr <= thresholds[2])  revCat = 'intermediaires';
    else                            revCat = 'superieurs';
  }

  const MPR: Partial<Record<WorkType, Record<string, number>>> = {
    isolation_combles:            { tres_modestes: 0.75, modestes: 0.60, intermediaires: 0.40, superieurs: 0.15 },
    isolation_murs:               { tres_modestes: 0.75, modestes: 0.60, intermediaires: 0.40, superieurs: 0.15 },
    isolation_planchers:          { tres_modestes: 0.75, modestes: 0.60, intermediaires: 0.40, superieurs: 0.15 },
    pompe_chaleur_air_eau:        { tres_modestes: 0.70, modestes: 0.50, intermediaires: 0.40, superieurs: 0.20 },
    pompe_chaleur_air_air:        { tres_modestes: 0.50, modestes: 0.40, intermediaires: 0.30, superieurs: 0.15 },
    chauffe_eau_thermodynamique:  { tres_modestes: 0.70, modestes: 0.50, intermediaires: 0.40, superieurs: 0.25 },
    ventilation_vmc:              { tres_modestes: 0.75, modestes: 0.60, intermediaires: 0.40, superieurs: 0.15 },
    fenetres_double_vitrage:      { tres_modestes: 0.40, modestes: 0.20, intermediaires: 0.00, superieurs: 0.00 },
    audit_energetique:            { tres_modestes: 0.70, modestes: 0.70, intermediaires: 0.50, superieurs: 0.30 },
    renovation_globale:           { tres_modestes: 0.80, modestes: 0.60, intermediaires: 0.45, superieurs: 0.30 },
  };

  const aids: RenovationAid[] = [];

  // MaPrimeRénov'
  if (input.est_proprietaire && revCat) {
    for (const w of input.work_types) {
      const rates = MPR[w];
      if (!rates) continue;
      const taux = rates[revCat] ?? 0;
      aids.push({
        name: `MaPrimeRénov' — ${WORK_TYPE_LABELS[w] ?? w}`,
        type: 'subvention',
        montant_estime: taux > 0 && input.cout_travaux != null
          ? Math.round(input.cout_travaux * taux) : null,
        taux_aide: taux,
        description: 'Aide ANAH pour les travaux de rénovation énergétique.',
        conditions: ['Logement de plus de 15 ans', 'Propriétaire occupant ou bailleur'],
        eligible: taux > 0,
        url_info: 'https://www.anah.gouv.fr/maprimerenov',
      });
    }
  }

  // CEE
  const CEE_ELIGIBLE: WorkType[] = [
    'isolation_combles', 'isolation_murs', 'isolation_planchers',
    'pompe_chaleur_air_eau', 'chauffe_eau_thermodynamique', 'ventilation_vmc',
  ];
  if (input.work_types.some(w => CEE_ELIGIBLE.includes(w))) {
    const taux = 0.10;
    aids.push({
      name: "CEE — Certificats d'Économies d'Énergie",
      type: 'subvention',
      montant_estime: input.cout_travaux != null ? Math.round(input.cout_travaux * taux) : null,
      taux_aide: taux,
      description: "Prime énergie versée par les fournisseurs d'énergie.",
      conditions: ['Travaux réalisés par un professionnel RGE', 'Logement de plus de 2 ans'],
      eligible: true,
      url_info: 'https://www.ecologie.gouv.fr/cee',
    });
  }

  // Éco-PTZ
  if (input.est_proprietaire && input.annee_construction != null && input.annee_construction < 1990) {
    aids.push({
      name: "Éco-PTZ (Prêt à Taux Zéro)",
      type: 'pret',
      montant_estime: 30000,
      taux_aide: null,
      description: "Prêt sans intérêts jusqu'à 50 000 € pour les rénovations globales.",
      conditions: ['Logement construit avant 1990', 'Résidence principale'],
      eligible: true,
      url_info: 'https://www.service-public.fr/particuliers/vosdroits/F19905',
    });
  }

  // TVA 5.5%
  if (input.annee_construction == null || input.annee_construction >= 1990) {
    aids.push({
      name: 'TVA réduite à 5.5%',
      type: 'tva_reduite',
      montant_estime: input.cout_travaux != null
        ? Math.round(input.cout_travaux * 0.145) : null,
      taux_aide: 0.145,
      description: 'TVA à 5.5% au lieu de 20% sur les travaux de rénovation énergétique.',
      conditions: ['Logement achevé depuis plus de 2 ans'],
      eligible: true,
      url_info: 'https://www.service-public.fr/professionnels-entreprises/vosdroits/F22576',
    });
  }

  const eligible = aids.filter(a => a.eligible);
  let totalMin = 0;
  let totalMax = 0;
  for (const a of eligible) {
    if (a.montant_estime != null) {
      totalMin += Math.round(a.montant_estime * 0.85);
      totalMax += a.montant_estime;
    }
  }

  return {
    eligible_aids:    eligible,
    total_estime_min: totalMin,
    total_estime_max: input.cout_travaux != null ? Math.min(totalMax, input.cout_travaux) : totalMax,
    revenue_category: revCat,
    departement:      dept,
    simulation_note:  'Simulation indicative basée sur le barème ANAH 2024.',
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function RenovationAidsPage() {
  const [codePostal,      setCodePostal]      = useState('75001');
  const [rfr,             setRfr]             = useState('');
  const [nbPersonnes,     setNbPersonnes]     = useState('2');
  const [coutTravaux,     setCoutTravaux]     = useState('');
  const [anneeConstruct,  setAnneeConstruct]  = useState('');
  const [proprietaire,    setProprietaire]    = useState(true);
  const [selectedWorks,   setSelectedWorks]   = useState<WorkType[]>(['isolation_combles']);
  const [loading,         setLoading]         = useState(false);
  const [result,          setResult]          = useState<SimulationResult | null>(null);

  function toggleWork(w: WorkType) {
    setSelectedWorks(prev =>
      prev.includes(w) ? prev.filter(x => x !== w) : [...prev, w]
    );
  }

  async function handleSimulate() {
    if (!codePostal || selectedWorks.length === 0) return;
    setLoading(true);
    try {
      const res = await simulate({
        code_postal:        codePostal,
        revenue_fiscal_ref: rfr ? parseFloat(rfr) : null,
        nb_personnes_foyer: parseInt(nbPersonnes) || 2,
        work_types:         selectedWorks,
        cout_travaux:       coutTravaux ? parseFloat(coutTravaux) : null,
        annee_construction: anneeConstruct ? parseInt(anneeConstruct) : null,
        est_proprietaire:   proprietaire,
      });
      setResult(res);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Euro className="h-6 w-6 text-green-600" />
          Aides à la Rénovation
        </h1>
        <p className="text-muted-foreground mt-1">
          Simulation MaPrimeRénov' · CEE · Éco-PTZ · TVA 5.5% (barème ANAH 2024)
        </p>
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Calculator className="h-4 w-4" /> Paramètres du projet
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Code postal</Label>
              <Input value={codePostal} onChange={e => setCodePostal(e.target.value)} placeholder="75001" />
            </div>
            <div>
              <Label>Revenu fiscal de référence (€/an)</Label>
              <Input value={rfr} onChange={e => setRfr(e.target.value)} placeholder="Laissez vide si inconnu" type="number" />
            </div>
            <div>
              <Label>Nombre de personnes au foyer</Label>
              <Input value={nbPersonnes} onChange={e => setNbPersonnes(e.target.value)} type="number" min={1} max={8} />
            </div>
            <div>
              <Label>Coût estimé des travaux (€ HT)</Label>
              <Input value={coutTravaux} onChange={e => setCoutTravaux(e.target.value)} placeholder="ex: 15000" type="number" />
            </div>
            <div>
              <Label>Année de construction</Label>
              <Input value={anneeConstruct} onChange={e => setAnneeConstruct(e.target.value)} placeholder="ex: 1975" type="number" />
            </div>
            <div>
              <Label>Statut d'occupation</Label>
              <Select value={proprietaire ? 'proprio' : 'locataire'} onValueChange={v => setProprietaire(v === 'proprio')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="proprio">Propriétaire</SelectItem>
                  <SelectItem value="locataire">Locataire / autre</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Work types */}
          <div>
            <Label className="block mb-2">Types de travaux envisagés</Label>
            <div className="flex flex-wrap gap-2">
              {(Object.entries(WORK_TYPE_LABELS) as [WorkType, string][]).map(([w, label]) => (
                <button
                  key={w}
                  onClick={() => toggleWork(w)}
                  className={`text-sm px-3 py-1 rounded-full border transition-colors ${
                    selectedWorks.includes(w)
                      ? 'bg-green-600 text-white border-green-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-green-400'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <Button onClick={handleSimulate} disabled={loading || selectedWorks.length === 0}>
            {loading ? 'Calcul en cours…' : 'Simuler les aides'}
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Summary */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-6 flex-wrap">
                <div>
                  <p className="text-sm text-muted-foreground">Aides potentielles</p>
                  <p className="text-2xl font-bold text-green-600">
                    {result.total_estime_min.toLocaleString('fr-FR')} –{' '}
                    {result.total_estime_max.toLocaleString('fr-FR')} €
                  </p>
                </div>
                {result.revenue_category && (
                  <div>
                    <p className="text-sm text-muted-foreground">Catégorie de revenus</p>
                    <Badge variant="outline">
                      {REV_CAT_LABELS[result.revenue_category] ?? result.revenue_category}
                    </Badge>
                  </div>
                )}
                <div>
                  <p className="text-sm text-muted-foreground">Département</p>
                  <Badge variant="secondary">{result.departement}</Badge>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1">
                <Info className="h-3 w-3" /> {result.simulation_note}
              </p>
            </CardContent>
          </Card>

          {/* Aid cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {result.eligible_aids.map((aid, i) => (
              <Card key={i} className={aid.eligible ? '' : 'opacity-50'}>
                <CardContent className="pt-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium text-sm">{aid.name}</span>
                    {aid.eligible
                      ? <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                      : <XCircle className="h-4 w-4 text-gray-400 shrink-0" />
                    }
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Badge className={AID_TYPE_COLORS[aid.type]}>
                      {AID_TYPE_LABELS[aid.type]}
                    </Badge>
                    {aid.taux_aide != null && aid.taux_aide > 0 && (
                      <Badge variant="outline">
                        {Math.round(aid.taux_aide * 100)} %
                      </Badge>
                    )}
                    {aid.montant_estime != null && (
                      <Badge variant="secondary">
                        ~{aid.montant_estime.toLocaleString('fr-FR')} €
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{aid.description}</p>
                  {aid.url_info && (
                    <a href={aid.url_info} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-blue-600 underline">
                      En savoir plus
                    </a>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
