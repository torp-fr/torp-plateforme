/**
 * Edge Function: recognize-material
 * Reconnaissance d'équipement/matériel via IA Vision (style Google Lens)
 *
 * Entrée: Image base64 du matériel
 * Sortie: Informations identifiées (catégorie, type, marque, modèle, spécifications)
 */

import { corsHeaders } from '../_shared/cors.ts';

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';

// Catégories de matériel BTP
const MATERIAL_CATEGORIES = {
  vehicules: {
    label: 'Véhicules',
    keywords: ['fourgon', 'camion', 'utilitaire', 'van', 'pickup', 'véhicule', 'voiture', 'remorque'],
  },
  engins: {
    label: 'Engins de chantier',
    keywords: ['pelleteuse', 'mini-pelle', 'chargeuse', 'nacelle', 'grue', 'bulldozer', 'compacteur', 'rouleau', 'engin', 'tracto-pelle'],
  },
  outillage: {
    label: 'Outillage',
    keywords: ['perceuse', 'visseuse', 'meuleuse', 'scie', 'marteau', 'tournevis', 'pince', 'clé', 'niveau', 'mètre', 'outil'],
  },
  equipements: {
    label: 'Équipements',
    keywords: ['échafaudage', 'escabeau', 'échelle', 'bétonnière', 'groupe électrogène', 'compresseur', 'pompe', 'chauffage', 'ventilation'],
  },
  informatique: {
    label: 'Informatique',
    keywords: ['ordinateur', 'tablette', 'smartphone', 'drone', 'caméra', 'scanner', 'imprimante', 'station'],
  },
  locaux: {
    label: 'Locaux',
    keywords: ['bungalow', 'algeco', 'container', 'bureau', 'sanitaire', 'vestiaire', 'stockage', 'atelier'],
  },
};

interface RecognitionResult {
  success: boolean;
  confidence: number;
  category: string;
  type: string;
  brand?: string;
  model?: string;
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
  };
  usage?: string[];
  maintenance?: string[];
  safetyNotes?: string[];
  rawDescription?: string;
}

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

    const { imageBase64, imageType = 'image/jpeg', context } = await req.json();

    if (!imageBase64) {
      throw new Error('Image base64 data is required');
    }

    // Construire le prompt système pour la reconnaissance
    const systemPrompt = `Tu es un expert en identification d'équipements et de matériel professionnel pour le secteur du BTP (Bâtiment et Travaux Publics).

Ton rôle est d'analyser des photos de matériel et d'identifier précisément :
1. La catégorie générale (véhicules, engins de chantier, outillage, équipements, informatique, locaux)
2. Le type exact de matériel
3. La marque si visible/identifiable
4. Le modèle si identifiable
5. Les spécifications techniques estimées
6. Une estimation de valeur (fourchette)
7. Les usages typiques dans le BTP
8. Les points de maintenance importants
9. Les notes de sécurité pertinentes

Catégories disponibles:
- vehicules: Véhicules utilitaires, fourgons, camions, remorques
- engins: Engins de chantier (pelles, nacelles, grues, etc.)
- outillage: Outils électroportatifs et manuels
- equipements: Équipements de chantier (échafaudages, bétonnières, etc.)
- informatique: Matériel informatique et électronique (drones, tablettes, etc.)
- locaux: Installations de chantier (bungalows, containers, etc.)

Réponds UNIQUEMENT en JSON valide avec la structure suivante:
{
  "success": true,
  "confidence": 0.85,
  "category": "engins",
  "type": "Mini-pelle",
  "brand": "Kubota",
  "model": "KX016-4",
  "specifications": {
    "year": 2020,
    "power": "15.5 CV",
    "capacity": "1.5 tonnes",
    "dimensions": "3.8m x 1.5m x 2.4m",
    "weight": "1650 kg",
    "features": ["Cabine fermée", "Lame avant", "Godet 400mm"]
  },
  "estimatedValue": {
    "min": 15000,
    "max": 25000,
    "currency": "EUR"
  },
  "usage": ["Terrassement", "Tranchées", "Démolition légère"],
  "maintenance": ["Vidange tous les 250h", "Graissage quotidien", "Contrôle hydraulique mensuel"],
  "safetyNotes": ["Port du casque obligatoire", "Vérifier la stabilité du terrain"],
  "rawDescription": "Mini-pelle Kubota KX016-4 de couleur orange, apparemment en bon état, équipée d'une cabine fermée et d'une lame avant."
}

Si tu ne peux pas identifier clairement le matériel, indique success: false avec une explication.`;

    const userPrompt = context
      ? `Analyse cette image de matériel. Contexte additionnel: ${context}`
      : `Analyse cette image de matériel et identifie-le précisément.`;

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
    let recognitionResult: RecognitionResult;
    try {
      // Essayer d'extraire le JSON de la réponse
      const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) ||
                        content.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const jsonStr = jsonMatch[1] || jsonMatch[0];
        recognitionResult = JSON.parse(jsonStr);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('[recognize-material] Parse error:', parseError);
      recognitionResult = {
        success: false,
        confidence: 0,
        category: 'unknown',
        type: 'Non identifié',
        rawDescription: content,
      };
    }

    // Enrichir avec des informations supplémentaires si la catégorie est identifiée
    if (recognitionResult.success && recognitionResult.category) {
      const categoryInfo = MATERIAL_CATEGORIES[recognitionResult.category as keyof typeof MATERIAL_CATEGORIES];
      if (categoryInfo) {
        recognitionResult = {
          ...recognitionResult,
          categoryLabel: categoryInfo.label,
        } as RecognitionResult & { categoryLabel: string };
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: recognitionResult,
        timestamp: new Date().toISOString(),
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
