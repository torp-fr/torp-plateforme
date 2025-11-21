import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { callClaude } from '../_shared/ai-client.ts';

const TORP_SYSTEM_PROMPT = `Tu es un expert en analyse de devis pour le secteur du bâtiment et de la rénovation énergétique.
Analyse le devis fourni selon la méthode TORP (1000 points):
- Entreprise (250 pts): certifications, expérience, garanties
- Prix (300 pts): cohérence, détail, comparaison marché
- Complétude (200 pts): mentions obligatoires, détails techniques
- Conformité (150 pts): normes, réglementations
- Délais (100 pts): planning, engagement

Retourne un JSON avec: scores, analyses détaillées, recommandations.`;

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const { devisText, devisId, userId } = await req.json();

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

    // Analyse TORP
    const analysis = await callClaude(
      `Analyse ce devis:\n\n${devisText}`,
      TORP_SYSTEM_PROMPT,
      claudeApiKey
    );

    if (!analysis.success) {
      return new Response(
        JSON.stringify({ error: analysis.error }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Save to Supabase if devisId provided
    if (devisId) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      await supabase
        .from('devis')
        .update({
          analyse_torp: analysis.data,
          statut: 'analysé',
          updated_at: new Date().toISOString()
        })
        .eq('id', devisId);
    }

    return new Response(
      JSON.stringify({ success: true, analysis: analysis.data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
