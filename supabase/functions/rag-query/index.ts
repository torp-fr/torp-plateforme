import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import {
  orchestrateRAG,
  generateAIPromptFromRAG,
  extractDevisData,
  type RAGContext
} from '../_shared/rag-orchestrator.ts';
import {
  countTokens,
  validateTokens,
  type TokenCountResult,
  type TokenCountError
} from '../_shared/token-counter.ts';

/**
 * Endpoint RAG standalone
 * Permet d'interroger le système RAG sans lancer l'analyse TORP complète
 *
 * Use cases:
 * - Vérification rapide d'une entreprise
 * - Comparaison prix marché
 * - Éligibilité aides
 * - Extraction données devis
 */

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const { action, devisText, siret, siren, nom, categories } = await req.json();

    switch (action) {
      // RAG complet sur un devis
      case 'full':
      case 'analyze': {
        if (!devisText) {
          return errorResponse('devisText requis pour action "full"');
        }

        // ============================================
        // RAG ORCHESTRATION
        // ============================================
        const context = await orchestrateRAG({ devisText });

        // ============================================
        // GENERATE FULL PROMPT
        // ============================================
        const fullPrompt = generateAIPromptFromRAG(context, devisText);

        // ============================================
        // TOKEN VALIDATION ON CONCATENATED PROMPT
        // ============================================
        const systemPrompt = 'Vous êtes un expert en analyse de devis du bâtiment.';
        const tokenValidation = validateTokens(
          [{ role: 'user', content: fullPrompt }],
          'claude-3-5-sonnet-20241022',
          4096,
          systemPrompt
        );

        // Check if validation returned an error
        if (tokenValidation && 'error' in tokenValidation && tokenValidation.error !== undefined) {
          const errorData = tokenValidation as TokenCountError;
          console.warn('[RAG Query Full] Context limit exceeded:', {
            inputTokens: errorData.inputTokens,
            outputTokens: errorData.outputTokens,
            maxAllowed: errorData.maxAllowed
          });
          return contextLimitExceededResponse(errorData);
        }

        const validTokens = tokenValidation as TokenCountResult;
        console.log('[RAG Query Full] Token validation passed:', {
          inputTokens: validTokens.inputTokens,
          outputTokens: validTokens.outputTokens,
          estimatedTotal: validTokens.estimatedTotal,
          safeLimit: validTokens.safeLimit
        });

        return successResponse({
          context,
          prompt: fullPrompt,
          tokens: {
            estimated: validTokens.estimatedTotal,
            safeLimit: validTokens.safeLimit
          }
        });
      }

      // Extraction données devis uniquement
      case 'extract': {
        if (!devisText) {
          return errorResponse('devisText requis pour action "extract"');
        }
        const claudeApiKey = Deno.env.get('CLAUDE_API_KEY');
        if (!claudeApiKey) {
          return errorResponse('CLAUDE_API_KEY non configurée');
        }

        // ============================================
        // CONSTRUCT ACTUAL EXTRACTION PROMPT
        // ============================================
        const extractionPrompt = `Analyse ce devis et extrait les informations structurées.

DEVIS:
${devisText}

Retourne un JSON avec cette structure exacte:
{
  "entreprise": {
    "nom": "nom de l'entreprise",
    "siret": "numéro SIRET si présent (14 chiffres)",
    "siren": "numéro SIREN si présent (9 chiffres)",
    "adresse": "adresse complète",
    "telephone": "téléphone",
    "email": "email"
  },
  "travaux": [
    {
      "type": "type de travaux (isolation, chauffage, etc.)",
      "description": "description détaillée",
      "quantite": nombre,
      "unite": "m², unité, ml, etc.",
      "prixUnitaire": prix_unitaire_ht,
      "prixTotal": prix_total_ht,
      "categorie": "catégorie principale"
    }
  ],
  "montants": {
    "ht": montant_total_ht,
    "tva": montant_tva,
    "ttc": montant_ttc,
    "acompte": montant_acompte_si_present
  },
  "dateDevis": "date du devis",
  "validite": "durée de validité",
  "delaiTravaux": "délai d'exécution",
  "garanties": ["liste des garanties mentionnées"]
}`;

        const systemPrompt = 'Tu es un expert en analyse de devis du bâtiment. Extrait les données avec précision. Retourne uniquement du JSON valide.';

        // ============================================
        // TOKEN VALIDATION ON ACTUAL PROMPT
        // ============================================
        const tokenValidation = validateTokens(
          [{ role: 'user', content: extractionPrompt }],
          'claude-3-5-sonnet-20241022',
          4096,
          systemPrompt
        );

        // Check if validation returned an error
        if (tokenValidation && 'error' in tokenValidation && tokenValidation.error !== undefined) {
          const errorData = tokenValidation as TokenCountError;
          console.warn('[RAG Query Extract] Context limit exceeded:', {
            inputTokens: errorData.inputTokens,
            outputTokens: errorData.outputTokens,
            maxAllowed: errorData.maxAllowed
          });
          return contextLimitExceededResponse(errorData);
        }

        const validTokens = tokenValidation as TokenCountResult;
        console.log('[RAG Query Extract] Token validation passed:', {
          inputTokens: validTokens.inputTokens,
          outputTokens: validTokens.outputTokens,
          estimatedTotal: validTokens.estimatedTotal,
          safeLimit: validTokens.safeLimit
        });

        // ============================================
        // EXTRACT DEVIS DATA
        // ============================================
        const extracted = await extractDevisData(devisText, claudeApiKey);
        return successResponse({
          extracted,
          tokens: {
            estimated: validTokens.estimatedTotal,
            safeLimit: validTokens.safeLimit
          }
        });
      }

      // Vérification entreprise
      case 'enterprise':
      case 'entreprise': {
        if (!siret && !siren && !nom) {
          return errorResponse('siret, siren ou nom requis pour action "enterprise"');
        }

        // Import dynamique des fonctions API
        const {
          searchEntreprise,
          getRGECertifications,
          getBODACCAnnonces
        } = await import('../_shared/api-clients.ts');

        const [entreprise, rge, bodacc] = await Promise.all([
          searchEntreprise({ siret, siren, q: nom }).catch(() => null),
          getRGECertifications({ siret, nom }).catch(() => []),
          siren ? getBODACCAnnonces(siren) : Promise.resolve([])
        ]);

        return successResponse({
          entreprise: entreprise?.results?.[0] || null,
          certifications: { rge },
          annoncesLegales: bodacc,
          sources: ['API Recherche Entreprises', 'ADEME RGE', 'BODACC']
        });
      }

      // Comparaison prix marché
      case 'prices':
      case 'prix': {
        const { getIndicesBTP } = await import('../_shared/api-clients.ts');
        const indices = await getIndicesBTP();

        // Prix de référence par catégorie
        const PRICES: Record<string, any[]> = {
          isolation: [
            { item: 'Combles perdus', min: 20, max: 40, avg: 30, unit: 'm²' },
            { item: 'ITI', min: 40, max: 80, avg: 60, unit: 'm²' },
            { item: 'ITE', min: 100, max: 200, avg: 150, unit: 'm²' }
          ],
          chauffage: [
            { item: 'PAC air/eau', min: 8000, max: 18000, avg: 12000, unit: 'unité' },
            { item: 'PAC air/air', min: 3000, max: 8000, avg: 5000, unit: 'unité' },
            { item: 'Chaudière gaz', min: 3000, max: 7000, avg: 5000, unit: 'unité' }
          ],
          menuiserie: [
            { item: 'Fenêtre PVC DV', min: 300, max: 800, avg: 500, unit: 'unité' },
            { item: 'Fenêtre alu DV', min: 500, max: 1200, avg: 800, unit: 'unité' }
          ],
          ventilation: [
            { item: 'VMC simple flux', min: 400, max: 1000, avg: 700, unit: 'unité' },
            { item: 'VMC double flux', min: 2000, max: 5000, avg: 3500, unit: 'unité' }
          ]
        };

        const requestedCategories = categories || Object.keys(PRICES);
        const prices = requestedCategories.reduce((acc: any, cat: string) => {
          if (PRICES[cat.toLowerCase()]) {
            acc[cat] = PRICES[cat.toLowerCase()];
          }
          return acc;
        }, {});

        return successResponse({
          prices,
          indices,
          sources: ['ADEME', 'FFB', 'INSEE Indices BTP']
        });
      }

      // Éligibilité aides
      case 'aids':
      case 'aides': {
        const workCategories = categories || ['isolation', 'chauffage', 'menuiserie'];

        const AIDS: Record<string, any> = {
          'MaPrimeRénov': {
            applicable: true,
            conditions: ['Résidence principale', 'Logement > 15 ans', 'Artisan RGE'],
            travaux: ['isolation', 'chauffage', 'menuiserie', 'ventilation']
          },
          'CEE': {
            applicable: true,
            conditions: ['Artisan RGE', 'Devis non signé avant demande'],
            travaux: ['isolation', 'chauffage', 'menuiserie', 'ventilation']
          },
          'Éco-PTZ': {
            applicable: true,
            conditions: ['Logement > 2 ans', 'Bouquet travaux ou performance'],
            maxAmount: 50000,
            travaux: ['isolation', 'chauffage', 'menuiserie', 'ventilation']
          },
          'TVA 5.5%': {
            applicable: true,
            conditions: ['Logement > 2 ans', 'Travaux amélioration énergétique'],
            travaux: ['isolation', 'chauffage', 'menuiserie', 'ventilation']
          }
        };

        const eligibles = Object.entries(AIDS)
          .filter(([_, aid]) =>
            aid.travaux.some((t: string) =>
              workCategories.map((c: string) => c.toLowerCase()).includes(t)
            )
          )
          .map(([name, aid]) => ({ name, ...aid }));

        return successResponse({
          eligibles,
          categories: workCategories,
          disclaimer: 'Vérifiez les conditions sur les sites officiels'
        });
      }

      default:
        return errorResponse(
          `Action inconnue: ${action}. Actions disponibles: full, extract, enterprise, prices, aids`
        );
    }

  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function successResponse(data: any) {
  return new Response(
    JSON.stringify({ success: true, ...data }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

function errorResponse(message: string, status = 400) {
  return new Response(
    JSON.stringify({ success: false, error: message }),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

/**
 * Structured error response for context limit exceeded
 * Returns standardized format for token validation failures
 */
function contextLimitExceededResponse(errorData: TokenCountError) {
  return new Response(
    JSON.stringify({
      success: false,
      error: 'context_limit_exceeded',
      message: errorData.message,
      details: {
        estimated_tokens: errorData.inputTokens,
        safe_limit: errorData.maxAllowed,
        output_tokens: errorData.outputTokens,
        total_would_be: errorData.inputTokens + errorData.outputTokens
      }
    }),
    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
