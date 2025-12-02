/**
 * Service principal de génération de tickets TORP
 * Orchestre la génération du code, QR code, PDF et stockage
 */

import { supabase } from '@/lib/supabase';
import { generateTicketCode } from './generate-code';
import { generateQRCode } from './generate-qr';
import { generateTicketPDF, type TicketData } from './generate-pdf';

export interface GenerateTicketResult {
  ticketCode: string;      // "TORP-A7X9K2"
  ticketUrl: string;       // URL de la page publique
  pdfUrl: string;          // URL du PDF dans Supabase Storage
  pdfFileName: string;
}

/**
 * Génère un ticket TORP complet pour une analyse
 */
export async function generateTicket(analysisId: string): Promise<GenerateTicketResult> {
  console.log('[TICKET] 🎫 Début génération ticket pour:', analysisId);

  // 1. Récupérer les données de l'analyse
  console.log('[TICKET] 📊 Récupération de l\'analyse...');
  const { data: analysis, error: analysisError } = await supabase
    .from('pro_devis_analyses')
    .select(`
      *,
      company:pro_company_profiles!inner(
        raison_sociale,
        siret
      )
    `)
    .eq('id', analysisId)
    .single();

  if (analysisError || !analysis) {
    console.error('[TICKET] ❌ Erreur récupération analyse:', analysisError);
    throw new Error('Analysis not found');
  }

  console.log('[TICKET] ✅ Analyse récupérée:', analysis.reference_devis);

  if (analysis.status !== 'COMPLETED') {
    console.error('[TICKET] ❌ Analyse non complétée:', analysis.status);
    throw new Error('Analysis not completed yet');
  }

  if (!analysis.grade || analysis.score_total === null) {
    console.error('[TICKET] ❌ Pas de score');
    throw new Error('Analysis has no score');
  }

  // 2. Vérifier si ticket déjà généré
  if (analysis.ticket_genere && analysis.ticket_code && analysis.ticket_url) {
    console.log('[TICKET] ℹ️ Ticket déjà généré:', analysis.ticket_code);
    const baseUrl = import.meta.env.VITE_APP_URL || window.location.origin;
    const ticketCode = analysis.ticket_code.toLowerCase();
    return {
      ticketCode: `TORP-${analysis.ticket_code}`,
      ticketUrl: `${baseUrl}/t/${analysis.ticket_code}`,
      pdfUrl: analysis.ticket_url,
      pdfFileName: `ticket-torp-${ticketCode}.pdf`,
    };
  }

  // 3. Générer le code unique
  console.log('[TICKET] 🔑 Génération du code unique...');
  const codeData = await generateTicketCode(analysisId);
  console.log('[TICKET] ✅ Code généré:', codeData.code);

  // 4. Sauvegarder le code en base
  console.log('[TICKET] 💾 Sauvegarde du code en base...');
  const { error: updateCodeError } = await supabase
    .from('pro_devis_analyses')
    .update({ ticket_code: codeData.shortCode })
    .eq('id', analysisId);

  if (updateCodeError) {
    console.error('[TICKET] ❌ Erreur sauvegarde code:', updateCodeError);
    throw new Error('Failed to save ticket code');
  }

  // 5. Générer le QR code
  console.log('[TICKET] 📱 Génération du QR code...');
  const qrCode = await generateQRCode({
    url: codeData.url,
    size: 200,
  });
  console.log('[TICKET] ✅ QR code généré');

  // 6. Préparer les données du ticket
  console.log('[TICKET] 📄 Préparation des données PDF...');
  const ticketData: TicketData = {
    ticketCode: codeData.code,
    analysisId,
    grade: analysis.grade as 'A' | 'B' | 'C' | 'D' | 'E',
    scoreTotal: analysis.score_total,
    entreprise: {
      raisonSociale: analysis.company.raison_sociale,
      siret: analysis.company.siret,
    },
    referenceDevis: analysis.reference_devis || 'Devis sans référence',
    dateAnalyse: analysis.analyzed_at ? new Date(analysis.analyzed_at) : new Date(),
    qrCodeBuffer: qrCode.buffer,
    ticketUrl: codeData.url,
  };

  // 7. Générer le PDF
  console.log('[TICKET] 📝 Génération du PDF...');
  const pdf = await generateTicketPDF(ticketData);
  console.log('[TICKET] ✅ PDF généré:', pdf.fileName);

  // 8. Upload le PDF vers Supabase Storage
  const storagePath = `${analysis.user_id}/${pdf.fileName}`;
  console.log('[TICKET] ☁️ Upload vers Storage:', storagePath);

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('tickets-torp')
    .upload(storagePath, pdf.buffer, {
      contentType: 'application/pdf',
      upsert: true, // Remplacer si existe déjà
    });

  if (uploadError) {
    console.error('[TICKET] ❌ Erreur upload Storage:', uploadError);
    throw new Error('Failed to upload ticket PDF');
  }
  console.log('[TICKET] ✅ PDF uploadé dans Storage');

  // 9. Obtenir l'URL publique du PDF
  const { data: urlData } = supabase.storage
    .from('tickets-torp')
    .getPublicUrl(storagePath);

  const pdfUrl = urlData.publicUrl;
  console.log('[TICKET] 🔗 URL publique:', pdfUrl);

  // 10. Mettre à jour l'analyse avec les infos du ticket
  console.log('[TICKET] 💾 Mise à jour de l\'analyse...');
  const { error: updateError } = await supabase
    .from('pro_devis_analyses')
    .update({
      ticket_genere: true,
      ticket_url: pdfUrl,
    })
    .eq('id', analysisId);

  if (updateError) {
    console.error('[TICKET] ❌ Erreur mise à jour analyse:', updateError);
    throw new Error('Failed to update analysis');
  }

  console.log('[TICKET] ✅ Ticket généré avec succès !');
  return {
    ticketCode: codeData.code,
    ticketUrl: codeData.url,
    pdfUrl,
    pdfFileName: pdf.fileName,
  };
}

/**
 * Récupère les informations d'un ticket existant
 */
export async function getTicketInfo(analysisId: string): Promise<GenerateTicketResult | null> {
  const { data: analysis, error } = await supabase
    .from('pro_devis_analyses')
    .select('ticket_genere, ticket_code, ticket_url, grade, score_total')
    .eq('id', analysisId)
    .single();

  if (error || !analysis) {
    return null;
  }

  if (!analysis.ticket_genere || !analysis.ticket_code) {
    return null;
  }

  const baseUrl = import.meta.env.VITE_APP_URL || window.location.origin;
  const ticketCode = analysis.ticket_code.toLowerCase();

  return {
    ticketCode: `TORP-${analysis.ticket_code}`,
    ticketUrl: `${baseUrl}/t/${analysis.ticket_code}`,
    pdfUrl: analysis.ticket_url || '',
    pdfFileName: `ticket-torp-${ticketCode}.pdf`,
  };
}
