import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { callClaude } from '../_shared/ai-client.ts';

interface Aid {
  name: string;
  type: 'prime' | 'credit_impot' | 'pret' | 'subvention';
  maxAmount?: number;
  percentage?: number;
  conditions: string[];
  eligible: string[];
  cumulative: boolean;
  source: string;
  url: string;
  validUntil?: string;
}

interface Regulation {
  name: string;
  code: string;
  description: string;
  requirements: string[];
  applicableTo: string[];
  source: string;
}

// Base de données des aides (mise à jour 2024)
const AIDS_DATABASE: Aid[] = [
  {
    name: 'MaPrimeRénov\'',
    type: 'prime',
    conditions: ['Résidence principale', 'Logement > 15 ans', 'Travaux par artisan RGE'],
    eligible: ['Propriétaires occupants', 'Propriétaires bailleurs', 'Copropriétés'],
    cumulative: true,
    source: 'ANAH',
    url: 'https://www.maprimerenov.gouv.fr',
    validUntil: '2025-12-31'
  },
  {
    name: 'MaPrimeRénov\' Sérénité',
    type: 'prime',
    maxAmount: 30000,
    percentage: 50,
    conditions: ['Gain énergétique ≥ 35%', 'Revenus modestes/très modestes', 'Logement > 15 ans'],
    eligible: ['Propriétaires occupants'],
    cumulative: false,
    source: 'ANAH',
    url: 'https://www.maprimerenov.gouv.fr',
    validUntil: '2025-12-31'
  },
  {
    name: 'Certificats d\'Économies d\'Énergie (CEE)',
    type: 'prime',
    conditions: ['Travaux éligibles', 'Artisan RGE', 'Devis non signé avant demande'],
    eligible: ['Tous propriétaires', 'Locataires'],
    cumulative: true,
    source: 'Ministère Transition Écologique',
    url: 'https://www.ecologie.gouv.fr/cee',
  },
  {
    name: 'Éco-PTZ',
    type: 'pret',
    maxAmount: 50000,
    conditions: ['Résidence principale', 'Logement > 2 ans', 'Bouquet de travaux ou performance globale'],
    eligible: ['Propriétaires', 'Copropriétés'],
    cumulative: true,
    source: 'Service Public',
    url: 'https://www.service-public.fr/particuliers/vosdroits/F19905',
  },
  {
    name: 'TVA réduite 5.5%',
    type: 'subvention',
    conditions: ['Logement > 2 ans', 'Travaux amélioration énergétique'],
    eligible: ['Tous'],
    cumulative: true,
    source: 'Service Public',
    url: 'https://www.service-public.fr/particuliers/vosdroits/F10871',
  },
  {
    name: 'Aide locale collectivité',
    type: 'subvention',
    conditions: ['Variable selon région/commune'],
    eligible: ['Variable'],
    cumulative: true,
    source: 'ANIL',
    url: 'https://www.anil.org/aides-locales-travaux/',
  }
];

// Base de données réglementations
const REGULATIONS_DATABASE: Regulation[] = [
  {
    name: 'RE2020',
    code: 'RE2020',
    description: 'Réglementation environnementale pour les constructions neuves',
    requirements: [
      'Performance énergétique Bbio',
      'Confort d\'été (DH)',
      'Empreinte carbone (Ic)',
      'Énergies renouvelables'
    ],
    applicableTo: ['Construction neuve'],
    source: 'Ministère Transition Écologique'
  },
  {
    name: 'Diagnostic de Performance Énergétique',
    code: 'DPE',
    description: 'Classement énergétique obligatoire du logement',
    requirements: [
      'Classe A à G',
      'Interdiction location F/G dès 2025/2028',
      'Validité 10 ans'
    ],
    applicableTo: ['Vente', 'Location', 'Construction'],
    source: 'ADEME'
  },
  {
    name: 'RGE - Reconnu Garant de l\'Environnement',
    code: 'RGE',
    description: 'Label obligatoire pour bénéficier des aides',
    requirements: [
      'Formation certifiée',
      'Audit chantier',
      'Assurances valides',
      'Renouvellement tous les 4 ans'
    ],
    applicableTo: ['Artisans', 'Entreprises travaux'],
    source: 'Qualibat / Qualit\'EnR'
  },
  {
    name: 'Audit énergétique obligatoire',
    code: 'AUDIT',
    description: 'Audit obligatoire pour vente de passoires thermiques',
    requirements: [
      'Obligatoire DPE F/G depuis 2023',
      'Obligatoire DPE E depuis 2025',
      'Propositions de travaux chiffrées'
    ],
    applicableTo: ['Vente logement'],
    source: 'Service Public'
  },
  {
    name: 'Décret tertiaire',
    code: 'DEET',
    description: 'Réduction consommation énergétique bâtiments tertiaires',
    requirements: [
      '-40% en 2030',
      '-50% en 2040',
      '-60% en 2050',
      'Surfaces > 1000m²'
    ],
    applicableTo: ['Bâtiments tertiaires'],
    source: 'ADEME'
  }
];

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const { type, workTypes, situation, devisText } = await req.json();

    let aids: Aid[] = [];
    let regulations: Regulation[] = [];

    // 1. Filter aids by type
    if (!type || type === 'all' || type === 'aids') {
      aids = AIDS_DATABASE;
    }

    // 2. Filter regulations
    if (!type || type === 'all' || type === 'regulations') {
      regulations = REGULATIONS_DATABASE;
    }

    // 3. If situation provided, filter applicable aids
    if (situation) {
      const { ownerType, incomeLevel, buildingAge, buildingType } = situation;

      aids = aids.filter(aid => {
        // Basic eligibility check
        if (ownerType && !aid.eligible.some(e =>
          e.toLowerCase().includes(ownerType.toLowerCase()) || e === 'Tous'
        )) {
          return false;
        }
        return true;
      });
    }

    // 4. If devisText provided, analyze and recommend
    if (devisText) {
      const claudeApiKey = Deno.env.get('CLAUDE_API_KEY');
      if (claudeApiKey) {
        const analysisPrompt = `Analyse ce devis de travaux et détermine les aides applicables:

${devisText}

Contexte des aides disponibles:
${JSON.stringify(AIDS_DATABASE, null, 2)}

Retourne un JSON avec:
{
  "workTypes": ["types de travaux identifiés"],
  "eligibleAids": [
    {
      "aidName": "nom de l'aide",
      "estimatedAmount": montant_estimé,
      "confidence": "high/medium/low",
      "conditions": ["conditions à vérifier"]
    }
  ],
  "totalEstimatedAids": montant_total_estimé,
  "recommendations": ["recommandations pour maximiser les aides"],
  "warnings": ["points d'attention"]
}`;

        const aiResponse = await callClaude(
          analysisPrompt,
          'Tu es un expert en aides à la rénovation énergétique en France. Retourne uniquement du JSON valide.',
          claudeApiKey
        );

        if (aiResponse.success) {
          return new Response(
            JSON.stringify({
              success: true,
              analysis: aiResponse.data,
              availableAids: AIDS_DATABASE,
              regulations: REGULATIONS_DATABASE
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    // 5. Filter by work types if specified
    if (workTypes && Array.isArray(workTypes)) {
      // Keep all aids but add relevance score
      aids = aids.map(aid => ({
        ...aid,
        relevanceScore: workTypes.some(w =>
          aid.conditions.some(c => c.toLowerCase().includes(w.toLowerCase()))
        ) ? 1 : 0.5
      }));
    }

    return new Response(
      JSON.stringify({
        success: true,
        aids,
        regulations,
        summary: {
          totalAids: aids.length,
          cumulativeAids: aids.filter(a => a.cumulative).length,
          maxPotentialAid: aids
            .filter(a => a.maxAmount)
            .reduce((sum, a) => sum + (a.maxAmount || 0), 0)
        },
        lastUpdate: '2024-01',
        disclaimer: 'Ces informations sont indicatives. Vérifiez les conditions sur les sites officiels.'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
