/**
 * Edge Function: recognize-material
 * Reconnaissance d'équipement/matériel via IA Vision (style Google Lens)
 *
 * Fonctionnalités:
 * - Identification visuelle via Claude Vision
 * - Enrichissement avec base de données de référence
 * - Estimation de valeur basée sur le marché
 * - Informations de maintenance et sécurité
 */

import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';

// ============================================
// CONFIGURATION & TYPES
// ============================================

// Catégories de matériel BTP avec marques courantes
const MATERIAL_DATABASE = {
  vehicules: {
    label: 'Véhicules',
    brands: ['Renault', 'Peugeot', 'Citroën', 'Ford', 'Mercedes', 'Volkswagen', 'Fiat', 'Iveco', 'MAN'],
    types: ['Fourgon', 'Camion benne', 'Camion plateau', 'Utilitaire', 'Pick-up', 'Remorque'],
    priceRanges: { min: 5000, max: 80000 },
  },
  engins: {
    label: 'Engins de chantier',
    brands: ['Caterpillar', 'Kubota', 'Komatsu', 'Liebherr', 'Volvo', 'JCB', 'Hitachi', 'Bobcat', 'Case', 'New Holland', 'Takeuchi', 'Yanmar'],
    types: ['Mini-pelle', 'Pelleteuse', 'Chargeuse', 'Nacelle', 'Grue mobile', 'Bulldozer', 'Compacteur', 'Dumper', 'Tractopelle', 'Télescopique'],
    priceRanges: { min: 10000, max: 500000 },
  },
  outillage: {
    label: 'Outillage',
    brands: ['Hilti', 'Makita', 'DeWalt', 'Bosch', 'Milwaukee', 'Festool', 'Metabo', 'Ryobi', 'Stanley', 'Facom'],
    types: ['Perceuse', 'Perforateur', 'Meuleuse', 'Scie circulaire', 'Scie sauteuse', 'Visseuse', 'Ponceuse', 'Marteau piqueur', 'Laser de chantier', 'Niveau laser'],
    priceRanges: { min: 50, max: 5000 },
  },
  equipements: {
    label: 'Équipements',
    brands: ['Altrad', 'Tubesca', 'Haulotte', 'Wacker Neuson', 'Atlas Copco', 'Honda', 'SDMO', 'Karcher'],
    types: ['Échafaudage', 'Bétonnière', 'Groupe électrogène', 'Compresseur', 'Nettoyeur haute pression', 'Pompe', 'Chauffage de chantier', 'Ventilateur industriel'],
    priceRanges: { min: 200, max: 50000 },
  },
  informatique: {
    label: 'Informatique',
    brands: ['Apple', 'Samsung', 'DJI', 'Leica', 'Trimble', 'Topcon', 'FARO', 'GoPro'],
    types: ['Tablette de chantier', 'Drone', 'Station totale', 'GPS RTK', 'Scanner 3D', 'Caméra thermique', 'Ordinateur durci'],
    priceRanges: { min: 500, max: 100000 },
  },
  locaux: {
    label: 'Locaux',
    brands: ['Algeco', 'Portakabin', 'Cougnaud', 'Touax', 'Warsco'],
    types: ['Bungalow de chantier', 'Container maritime', 'Bureau modulaire', 'Vestiaire', 'Sanitaire mobile', 'Local stockage'],
    priceRanges: { min: 2000, max: 50000 },
  },
};

// Intervalles de maintenance par type
const MAINTENANCE_GUIDES: Record<string, { interval: string; tasks: string[] }> = {
  'Mini-pelle': {
    interval: 'Toutes les 250 heures',
    tasks: ['Vidange moteur', 'Filtre huile', 'Graissage points de rotation', 'Vérification hydraulique', 'Contrôle chenilles'],
  },
  'Pelleteuse': {
    interval: 'Toutes les 500 heures',
    tasks: ['Vidange complète', 'Filtres (huile, air, carburant)', 'Graissage', 'Contrôle hydraulique', 'Inspection structure'],
  },
  'Nacelle': {
    interval: 'Annuelle + avant chaque utilisation',
    tasks: ['VGP annuelle obligatoire', 'Test fonctions de sécurité', 'Contrôle câbles/vérins', 'Vérification batterie'],
  },
  'Groupe électrogène': {
    interval: 'Toutes les 100 heures',
    tasks: ['Vidange huile', 'Filtre air', 'Contrôle niveau carburant', 'Test charge batterie'],
  },
  'Compresseur': {
    interval: 'Toutes les 500 heures',
    tasks: ['Vidange huile', 'Filtre air', 'Purge condensats', 'Contrôle courroies'],
  },
};

// Notes de sécurité par catégorie
const SAFETY_NOTES: Record<string, string[]> = {
  engins: [
    'CACES obligatoire selon catégorie',
    'Port du casque et gilet obligatoire',
    'Vérifier stabilité du terrain avant utilisation',
    'Ne jamais dépasser la charge maximale',
    'Maintenir distance de sécurité avec les lignes électriques',
  ],
  equipements: [
    'Vérification avant chaque utilisation',
    'Respecter les notices du fabricant',
    'Port des EPI adaptés',
    'Formation obligatoire pour certains équipements',
  ],
  outillage: [
    'Port des EPI (lunettes, gants, casque anti-bruit)',
    'Vérifier état des câbles et batteries',
    'Ne pas utiliser sous la pluie (électrique)',
    'Rangement sécurisé après utilisation',
  ],
};

interface RecognitionResult {
  success: boolean;
  confidence: number;
  category: string;
  categoryLabel?: string;
  type: string;
  brand?: string;
  model?: string;
  serialNumberVisible?: boolean;
  yearEstimate?: string;
  condition?: 'new' | 'excellent' | 'good' | 'fair' | 'poor';
  specifications?: {
    year?: number;
    power?: string;
    capacity?: string;
    dimensions?: string;
    weight?: string;
    features?: string[];
  };
  estimatedValue?: {
    min: number;
    max: number;
    currency: string;
    basis: string;
  };
  usage?: string[];
  maintenance?: {
    interval: string;
    tasks: string[];
    nextDue?: string;
  };
  safetyNotes?: string[];
  certifications?: string[];
  rawDescription?: string;
  similarProducts?: {
    name: string;
    priceRange: string;
  }[];
}

// ============================================
// MAIN HANDLER
// ============================================

Deno.serve(async (req: Request) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    if (!ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY not configured');
    }

    const { imageBase64, imageType = 'image/jpeg', context, enrichWithDatabase = true } = await req.json();

    if (!imageBase64) {
      throw new Error('Image base64 data is required');
    }

    // Construire le prompt système enrichi
    const systemPrompt = buildEnrichedSystemPrompt();
    const userPrompt = context
      ? `Analyse cette image de matériel professionnel BTP. Contexte: ${context}`
      : `Analyse cette image de matériel professionnel BTP et identifie-le précisément.`;

    // Appel à Claude avec vision
    const response = await fetch(CLAUDE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: imageType,
                  data: imageBase64,
                },
              },
              {
                type: 'text',
                text: userPrompt,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[recognize-material] Claude API error:', errorText);
      throw new Error(`Claude API error: ${response.status}`);
    }

    const result = await response.json();
    const content = result.content[0]?.text || '';

    // Parser la réponse JSON
    let recognitionResult = parseAIResponse(content);

    // Enrichir avec notre base de données locale
    if (recognitionResult.success && enrichWithDatabase) {
      recognitionResult = enrichWithLocalData(recognitionResult);
    }

    // Optionnel: Enrichir avec Supabase si configuré
    try {
      const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
      const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

      if (SUPABASE_URL && SUPABASE_SERVICE_KEY && recognitionResult.success) {
        recognitionResult = await enrichWithSupabase(
          recognitionResult,
          SUPABASE_URL,
          SUPABASE_SERVICE_KEY
        );
      }
    } catch (dbError) {
      console.warn('[recognize-material] Database enrichment failed:', dbError);
      // Continue without DB enrichment
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: recognitionResult,
        timestamp: new Date().toISOString(),
        model: 'claude-sonnet-4-20250514',
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('[recognize-material] Error:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});

// ============================================
// HELPER FUNCTIONS
// ============================================

function buildEnrichedSystemPrompt(): string {
  // Construire la liste des marques connues par catégorie
  const brandsInfo = Object.entries(MATERIAL_DATABASE)
    .map(([cat, data]) => `${data.label}: ${data.brands.join(', ')}`)
    .join('\n');

  return `Tu es un expert en identification d'équipements et de matériel professionnel pour le secteur du BTP (Bâtiment et Travaux Publics) en France.

## TON RÔLE
Analyser des photos de matériel et fournir une identification précise avec des informations exploitables.

## MARQUES CONNUES PAR CATÉGORIE
${brandsInfo}

## CATÉGORIES DISPONIBLES
- vehicules: Véhicules utilitaires, fourgons, camions, remorques
- engins: Engins de chantier (pelles, nacelles, grues, etc.)
- outillage: Outils électroportatifs et manuels
- equipements: Équipements de chantier (échafaudages, bétonnières, etc.)
- informatique: Matériel informatique et électronique (drones, tablettes, etc.)
- locaux: Installations de chantier (bungalows, containers, etc.)

## CE QUE TU DOIS IDENTIFIER
1. **Catégorie** (une des 6 ci-dessus)
2. **Type exact** (ex: "Mini-pelle", "Perceuse à percussion", "Nacelle articulée")
3. **Marque** si visible (logo, couleur caractéristique, forme)
4. **Modèle** si identifiable
5. **État apparent** (new/excellent/good/fair/poor)
6. **Année estimée** (basée sur le design, l'usure)
7. **Spécifications visibles** (taille, puissance estimée, capacité)
8. **Valeur estimée** (fourchette basée sur le marché français de l'occasion)

## FORMAT DE RÉPONSE (JSON uniquement)
{
  "success": true,
  "confidence": 0.85,
  "category": "engins",
  "type": "Mini-pelle",
  "brand": "Kubota",
  "model": "KX016-4",
  "condition": "good",
  "yearEstimate": "2018-2020",
  "specifications": {
    "power": "15.5 CV",
    "capacity": "1.7 tonnes",
    "dimensions": "3.8m x 1.5m x 2.4m",
    "weight": "1650 kg",
    "features": ["Cabine fermée", "Lame avant", "Godet 400mm"]
  },
  "estimatedValue": {
    "min": 15000,
    "max": 22000,
    "currency": "EUR",
    "basis": "Marché occasion France 2024"
  },
  "usage": ["Terrassement léger", "Tranchées VRD", "Aménagement paysager"],
  "certifications": ["CACES R482 Cat A requis"],
  "rawDescription": "Mini-pelle Kubota de couleur orange, cabine fermée, état général bon avec traces d'usure normales."
}

## RÈGLES IMPORTANTES
- Si tu n'es pas sûr de la marque, indique les 2-3 marques les plus probables
- Pour la valeur, base-toi sur les prix du marché français de l'occasion
- Confidence entre 0 et 1 (0.8+ = identification certaine)
- Si l'image est floue ou le matériel non identifiable, success: false`;
}

function parseAIResponse(content: string): RecognitionResult {
  try {
    // Essayer d'extraire le JSON de la réponse
    const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) ||
                      content.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const jsonStr = jsonMatch[1] || jsonMatch[0];
      return JSON.parse(jsonStr);
    }

    throw new Error('No JSON found in response');
  } catch (parseError) {
    console.error('[recognize-material] Parse error:', parseError);
    return {
      success: false,
      confidence: 0,
      category: 'unknown',
      type: 'Non identifié',
      rawDescription: content,
    };
  }
}

function enrichWithLocalData(result: RecognitionResult): RecognitionResult {
  const category = result.category as keyof typeof MATERIAL_DATABASE;
  const categoryData = MATERIAL_DATABASE[category];

  if (!categoryData) return result;

  // Ajouter le label de catégorie
  result.categoryLabel = categoryData.label;

  // Enrichir avec les notes de sécurité
  const safetyCat = category as keyof typeof SAFETY_NOTES;
  if (SAFETY_NOTES[safetyCat]) {
    result.safetyNotes = [
      ...(result.safetyNotes || []),
      ...SAFETY_NOTES[safetyCat],
    ];
  }

  // Enrichir avec les infos de maintenance
  const maintenanceType = result.type as keyof typeof MAINTENANCE_GUIDES;
  if (MAINTENANCE_GUIDES[maintenanceType]) {
    result.maintenance = {
      ...MAINTENANCE_GUIDES[maintenanceType],
      ...(result.maintenance || {}),
    };
  }

  // Affiner l'estimation de valeur si non fournie
  if (!result.estimatedValue && categoryData.priceRanges) {
    const condition = result.condition || 'good';
    const multiplier = {
      new: 1.0,
      excellent: 0.8,
      good: 0.6,
      fair: 0.4,
      poor: 0.25,
    }[condition] || 0.6;

    result.estimatedValue = {
      min: Math.round(categoryData.priceRanges.min * multiplier),
      max: Math.round(categoryData.priceRanges.max * multiplier),
      currency: 'EUR',
      basis: `Estimation basée sur l'état (${condition}) - marché français`,
    };
  }

  // Suggérer des produits similaires
  if (result.type && categoryData.types) {
    result.similarProducts = categoryData.types
      .filter(t => t !== result.type)
      .slice(0, 3)
      .map(name => ({
        name,
        priceRange: `${categoryData.priceRanges.min.toLocaleString('fr-FR')} - ${categoryData.priceRanges.max.toLocaleString('fr-FR')} €`,
      }));
  }

  return result;
}

async function enrichWithSupabase(
  result: RecognitionResult,
  supabaseUrl: string,
  supabaseKey: string
): Promise<RecognitionResult> {
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Chercher dans le catalogue de référence si la table existe
  try {
    const { data: catalogData } = await supabase
      .from('material_reference_catalog')
      .select('*')
      .ilike('type', `%${result.type}%`)
      .limit(1)
      .maybeSingle();

    if (catalogData) {
      // Enrichir avec les données du catalogue
      if (catalogData.price_used_min && catalogData.price_used_max) {
        result.estimatedValue = {
          min: catalogData.price_used_min,
          max: catalogData.price_used_max,
          currency: 'EUR',
          basis: 'Catalogue de référence TORP',
        };
      }

      if (catalogData.maintenance_intervals) {
        result.maintenance = {
          ...result.maintenance,
          ...catalogData.maintenance_intervals,
        };
      }

      if (catalogData.required_certifications) {
        result.certifications = [
          ...(result.certifications || []),
          ...catalogData.required_certifications,
        ];
      }
    }
  } catch (error) {
    // Table might not exist yet, ignore
    console.log('[recognize-material] Catalog table not available');
  }

  return result;
}
