import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { callClaude } from '../_shared/ai-client.ts';

/**
 * Webhook endpoint for N8N integration
 * Supports multiple actions: extract, analyze, full-pipeline
 */
serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const { action, payload, webhookSecret } = await req.json();

    // Validate webhook secret
    const expectedSecret = Deno.env.get('N8N_WEBHOOK_SECRET');
    if (expectedSecret && webhookSecret !== expectedSecret) {
      return new Response(
        JSON.stringify({ error: 'Invalid webhook secret' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let result: any;

    switch (action) {
      case 'list-pending':
        // Get devis awaiting analysis
        const { data: pending } = await supabase
          .from('devis')
          .select('id, nom, fichier_url, statut, created_at')
          .eq('statut', 'en_attente')
          .order('created_at', { ascending: true })
          .limit(payload?.limit || 10);
        result = { devis: pending || [] };
        break;

      case 'get-devis':
        // Get specific devis details
        const { data: devis } = await supabase
          .from('devis')
          .select('*')
          .eq('id', payload.devisId)
          .single();
        result = { devis };
        break;

      case 'update-status':
        // Update devis status
        await supabase
          .from('devis')
          .update({ statut: payload.status, updated_at: new Date().toISOString() })
          .eq('id', payload.devisId);
        result = { success: true };
        break;

      case 'save-analysis':
        // Save analysis results
        await supabase
          .from('devis')
          .update({
            analyse_torp: payload.analysis,
            statut: 'analysé',
            updated_at: new Date().toISOString()
          })
          .eq('id', payload.devisId);
        result = { success: true };
        break;

      case 'scrape-enterprise':
        // Scrape enterprise info (placeholder for N8N scraper node)
        const claudeApiKey = Deno.env.get('CLAUDE_API_KEY');
        if (claudeApiKey && payload.enterpriseName) {
          const scrapePrompt = `Recherche des informations sur l'entreprise "${payload.enterpriseName}":
          - SIRET/SIREN
          - Certifications RGE
          - Avis clients
          - Ancienneté
          Retourne un JSON structuré.`;

          const enterpriseInfo = await callClaude(
            scrapePrompt,
            'Tu es un assistant qui structure des informations d\'entreprise en JSON.',
            claudeApiKey
          );
          result = enterpriseInfo;
        } else {
          result = { error: 'enterpriseName requis ou CLAUDE_API_KEY manquante' };
        }
        break;

      case 'notify':
        // Send notification (placeholder - integrate with email/SMS service)
        console.log('Notification:', payload);
        result = { notified: true, payload };
        break;

      default:
        return new Response(
          JSON.stringify({ error: `Action inconnue: ${action}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    return new Response(
      JSON.stringify({ success: true, ...result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
