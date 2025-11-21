import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { callClaude } from '../_shared/ai-client.ts';
import {
  orchestrateRAG,
  generateAIPromptFromRAG,
  type RAGContext
} from '../_shared/rag-orchestrator.ts';

/**
 * Analyse TORP enrichie par RAG
 *
 * Scoring TORP (1000 points):
 * - Entreprise: 250 pts (certifications, ancienneté, conformité)
 * - Prix: 300 pts (cohérence marché, détail, transparence)
 * - Complétude: 200 pts (mentions obligatoires, détails techniques)
 * - Conformité: 150 pts (normes, réglementations)
 * - Délais: 100 pts (planning, engagement)
 */

interface TORPAnalysis {
  scores: {
    entreprise: number;
    prix: number;
    completude: number;
    conformite: number;
    delais: number;
    total: number;
  };
  details: {
    entreprise: {
      score: number;
      certifications: string[];
      alertes: string[];
      anciennete?: number;
      conformiteURSSAF?: boolean;
      conformiteDGFIP?: boolean;
    };
    prix: {
      score: number;
      comparaisonMarche: any[];
      prixCoherents: number;
      prixEleves: number;
      prixBas: number;
      totalHT: number;
      totalTTC: number;
    };
    completude: {
      score: number;
      mentionsPresentes: string[];
      mentionsManquantes: string[];
      detailsTechniques: boolean;
    };
    conformite: {
      score: number;
      reglementationsApplicables: string[];
      conformiteVerifiee: string[];
      alertes: string[];
    };
    delais: {
      score: number;
      delaiAnnonce?: string;
      planningPresent: boolean;
      engagementDate: boolean;
    };
  };
  aides: {
    eligibles: string[];
    montantEstime: number;
    conditions: string[];
  };
  synthese: string;
  recommandations: string[];
  ragContext: {
    sources: string[];
    fiabilite: number;
  };
}

const TORP_ANALYSIS_PROMPT = `Tu es un expert en analyse de devis du bâtiment et de la rénovation énergétique.

Analyse ce devis selon la méthode TORP avec le contexte RAG fourni.

SCORING TORP (1000 points):
1. ENTREPRISE (250 pts max):
   - Certifications RGE valides: 100 pts
   - Ancienneté > 5 ans: 50 pts
   - Conformité URSSAF/DGFIP: 50 pts
   - Pas de procédure collective: 50 pts

2. PRIX (300 pts max):
   - Prix conformes au marché: 150 pts
   - Détail des postes clair: 100 pts
   - Transparence TVA: 50 pts

3. COMPLÉTUDE (200 pts max):
   - Mentions obligatoires: 100 pts
   - Détails techniques suffisants: 50 pts
   - Description travaux précise: 50 pts

4. CONFORMITÉ (150 pts max):
   - Normes techniques respectées: 75 pts
   - Réglementations applicables: 75 pts

5. DÉLAIS (100 pts max):
   - Délai annoncé réaliste: 50 pts
   - Planning détaillé: 25 pts
   - Engagement date: 25 pts

Retourne un JSON avec:
{
  "scores": {
    "entreprise": X,
    "prix": X,
    "completude": X,
    "conformite": X,
    "delais": X,
    "total": X
  },
  "details": {
    "entreprise": { "analyses et justifications" },
    "prix": { "comparaisons et analyses" },
    "completude": { "mentions vérifiées" },
    "conformite": { "normes vérifiées" },
    "delais": { "analyse planning" }
  },
  "synthese": "résumé en 2-3 phrases",
  "recommandations": ["liste des recommandations prioritaires"]
}`;

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const { devisText, devisId, userId, skipRAG = false } = await req.json();

    if (!devisText) {
      return new Response(
        JSON.stringify({ error: 'devisText requis' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const claudeApiKey = Deno.env.get('CLAUDE_API_KEY');
    if (!claudeApiKey) {
      return new Response(
        JSON.stringify({ error: 'CLAUDE_API_KEY non configurée' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let ragContext: RAGContext | null = null;
    let enrichedPrompt = devisText;

    // 1. Orchestration RAG (sauf si skipRAG)
    if (!skipRAG) {
      try {
        ragContext = await orchestrateRAG({ devisText });
        enrichedPrompt = generateAIPromptFromRAG(ragContext, devisText);
      } catch (ragError) {
        console.error('RAG orchestration failed:', ragError);
        // Continue without RAG enrichment
      }
    }

    // 2. Analyse TORP avec contexte enrichi
    const analysis = await callClaude(
      enrichedPrompt,
      TORP_ANALYSIS_PROMPT,
      claudeApiKey
    );

    if (!analysis.success) {
      return new Response(
        JSON.stringify({ error: analysis.error }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Enrichir la réponse avec les données RAG
    const torpAnalysis: TORPAnalysis = {
      ...analysis.data,
      aides: ragContext?.aides || {
        eligibles: [],
        montantEstime: 0,
        conditions: []
      },
      ragContext: {
        sources: ragContext?.sources || [],
        fiabilite: ragContext?.fiabilite || 0
      }
    };

    // 4. Ajuster les scores entreprise avec les données réelles RAG
    if (ragContext?.entreprise) {
      // Le score RAG est sur 100, on le convertit sur 250
      const ragEnterpriseScore = Math.round((ragContext.entreprise.score / 100) * 250);

      // On fait une moyenne pondérée entre l'analyse IA et les données RAG
      if (torpAnalysis.scores?.entreprise) {
        torpAnalysis.scores.entreprise = Math.round(
          (torpAnalysis.scores.entreprise * 0.4) + (ragEnterpriseScore * 0.6)
        );
      } else {
        torpAnalysis.scores = torpAnalysis.scores || {};
        torpAnalysis.scores.entreprise = ragEnterpriseScore;
      }

      // Intégrer les alertes RAG
      if (torpAnalysis.details?.entreprise) {
        torpAnalysis.details.entreprise.alertes = [
          ...(torpAnalysis.details.entreprise.alertes || []),
          ...(ragContext.entreprise.alertes || [])
        ];
        torpAnalysis.details.entreprise.certifications =
          ragContext.entreprise.certifications.rge?.map((c: any) => c.nom_qualification) || [];
      }

      // Recalculer le total
      if (torpAnalysis.scores) {
        torpAnalysis.scores.total =
          (torpAnalysis.scores.entreprise || 0) +
          (torpAnalysis.scores.prix || 0) +
          (torpAnalysis.scores.completude || 0) +
          (torpAnalysis.scores.conformite || 0) +
          (torpAnalysis.scores.delais || 0);
      }
    }

    // 5. Intégrer la comparaison prix RAG
    if (ragContext?.prixMarche?.comparaison && torpAnalysis.details?.prix) {
      torpAnalysis.details.prix.comparaisonMarche = ragContext.prixMarche.comparaison;

      // Compter les prix par catégorie
      const comparaisons = ragContext.prixMarche.comparaison;
      torpAnalysis.details.prix.prixCoherents = comparaisons.filter(
        (c: any) => c.analyse?.includes('conforme')
      ).length;
      torpAnalysis.details.prix.prixEleves = comparaisons.filter(
        (c: any) => c.analyse?.includes('élevé')
      ).length;
      torpAnalysis.details.prix.prixBas = comparaisons.filter(
        (c: any) => c.analyse?.includes('bas')
      ).length;
    }

    // 6. Générer des recommandations supplémentaires basées sur RAG
    if (ragContext) {
      const ragRecommendations: string[] = [];

      // Recommandations basées sur les alertes entreprise
      ragContext.entreprise?.alertes?.forEach(alerte => {
        if (alerte.includes('RGE')) {
          ragRecommendations.push('Demander une copie du certificat RGE en cours de validité');
        }
        if (alerte.includes('URSSAF')) {
          ragRecommendations.push('Demander une attestation de vigilance URSSAF récente');
        }
        if (alerte.includes('récente')) {
          ragRecommendations.push('Vérifier les références de l\'entreprise et demander des avis clients');
        }
      });

      // Recommandations sur les aides
      if (ragContext.aides?.eligibles?.length > 0) {
        ragRecommendations.push(
          `Vous pourriez bénéficier d'aides (${ragContext.aides.eligibles.map((a: any) => a.name).join(', ')}) - Montant estimé: ${ragContext.aides.montantEstime}€`
        );
      }

      // Ajouter aux recommandations existantes
      torpAnalysis.recommandations = [
        ...(torpAnalysis.recommandations || []),
        ...ragRecommendations
      ];
    }

    // 7. Sauvegarder en base si devisId fourni
    if (devisId) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      await supabase
        .from('devis')
        .update({
          analyse_torp: torpAnalysis,
          score_torp: torpAnalysis.scores?.total || 0,
          statut: 'analysé',
          updated_at: new Date().toISOString()
        })
        .eq('id', devisId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        analysis: torpAnalysis,
        ragEnriched: !!ragContext,
        sources: ragContext?.sources || ['Analyse IA uniquement']
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Analysis error:', error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
