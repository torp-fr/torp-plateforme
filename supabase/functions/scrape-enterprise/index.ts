import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { callClaude } from '../_shared/ai-client.ts';

interface EnterpriseData {
  siret?: string;
  siren?: string;
  name: string;
  address?: string;
  rgeLabels?: string[];
  certifications?: string[];
  reviews?: { source: string; rating: number; count: number }[];
  creationDate?: string;
  employees?: string;
  capital?: string;
  activity?: string;
}

// API endpoints (public French data)
const API_SIRENE = 'https://api.insee.fr/entreprises/sirene/V3.11';
const API_RGE = 'https://data.ademe.fr/data-fair/api/v1/datasets/liste-des-entreprises-rge-2/lines';

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const { siret, name, postalCode } = await req.json();

    if (!siret && !name) {
      return new Response(
        JSON.stringify({ error: 'siret ou name requis' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result: EnterpriseData = { name: name || '' };
    const errors: string[] = [];

    // 1. Fetch SIRENE data (INSEE)
    if (siret) {
      try {
        const inseeToken = Deno.env.get('INSEE_API_TOKEN');
        if (inseeToken) {
          const sireneResponse = await fetch(
            `${API_SIRENE}/siret/${siret}`,
            { headers: { Authorization: `Bearer ${inseeToken}` } }
          );
          if (sireneResponse.ok) {
            const sireneData = await sireneResponse.json();
            const etablissement = sireneData.etablissement;
            const unite = etablissement?.uniteLegale;

            result.siret = siret;
            result.siren = siret.substring(0, 9);
            result.name = unite?.denominationUniteLegale || name;
            result.creationDate = unite?.dateCreationUniteLegale;
            result.employees = unite?.trancheEffectifsUniteLegale;
            result.activity = etablissement?.activitePrincipaleEtablissement;

            const adresse = etablissement?.adresseEtablissement;
            if (adresse) {
              result.address = [
                adresse.numeroVoieEtablissement,
                adresse.typeVoieEtablissement,
                adresse.libelleVoieEtablissement,
                adresse.codePostalEtablissement,
                adresse.libelleCommuneEtablissement
              ].filter(Boolean).join(' ');
            }
          }
        } else {
          errors.push('INSEE_API_TOKEN non configuré');
        }
      } catch (e) {
        errors.push(`Erreur SIRENE: ${e}`);
      }
    }

    // 2. Fetch RGE certifications (ADEME open data)
    try {
      const searchParam = siret
        ? `siret:${siret}`
        : `nom_entreprise:${encodeURIComponent(name)}`;

      const rgeParams = new URLSearchParams({
        q: searchParam,
        size: '10'
      });

      if (postalCode) {
        rgeParams.append('q', `code_postal:${postalCode}`);
      }

      const rgeResponse = await fetch(`${API_RGE}?${rgeParams}`);
      if (rgeResponse.ok) {
        const rgeData = await rgeResponse.json();
        if (rgeData.results?.length > 0) {
          const rgeLabels = new Set<string>();
          const certifications = new Set<string>();

          rgeData.results.forEach((r: any) => {
            if (r.nom_qualification) rgeLabels.add(r.nom_qualification);
            if (r.organisme) certifications.add(r.organisme);
            if (!result.siret && r.siret) result.siret = r.siret;
            if (!result.address && r.adresse) {
              result.address = `${r.adresse}, ${r.code_postal} ${r.commune}`;
            }
          });

          result.rgeLabels = Array.from(rgeLabels);
          result.certifications = Array.from(certifications);
        }
      }
    } catch (e) {
      errors.push(`Erreur RGE: ${e}`);
    }

    // 3. Enrich with AI if we have partial data
    const claudeApiKey = Deno.env.get('CLAUDE_API_KEY');
    if (claudeApiKey && (result.name || siret)) {
      try {
        const enrichPrompt = `Recherche des informations complémentaires sur cette entreprise du bâtiment:
Nom: ${result.name || 'Non connu'}
SIRET: ${result.siret || siret || 'Non connu'}
Adresse: ${result.address || 'Non connue'}

Données déjà collectées:
- Labels RGE: ${result.rgeLabels?.join(', ') || 'Aucun trouvé'}
- Certifications: ${result.certifications?.join(', ') || 'Aucune trouvée'}

Enrichis avec des informations typiques pour ce type d'entreprise (avis clients estimés, réputation secteur).
Retourne un JSON avec: additionalCertifications[], estimatedReviews, sectorReputation, warnings[].`;

        const aiResponse = await callClaude(
          enrichPrompt,
          'Tu es un expert en vérification d\'entreprises du bâtiment. Retourne uniquement du JSON valide.',
          claudeApiKey
        );

        if (aiResponse.success && aiResponse.data) {
          if (aiResponse.data.additionalCertifications) {
            result.certifications = [
              ...(result.certifications || []),
              ...aiResponse.data.additionalCertifications
            ];
          }
          if (aiResponse.data.estimatedReviews) {
            result.reviews = [{
              source: 'AI Estimate',
              rating: aiResponse.data.estimatedReviews.rating || 3.5,
              count: aiResponse.data.estimatedReviews.count || 0
            }];
          }
        }
      } catch (e) {
        errors.push(`Erreur enrichissement IA: ${e}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        enterprise: result,
        sources: ['INSEE SIRENE', 'ADEME RGE', 'AI Enrichment'],
        warnings: errors.length > 0 ? errors : undefined
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
