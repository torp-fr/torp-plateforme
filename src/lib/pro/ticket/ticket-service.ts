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
  // 1. Récupérer les données de l'analyse
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
    throw new Error('Analysis not found');
  }

  if (analysis.status !== 'COMPLETED') {
    throw new Error('Analysis not completed yet');
  }

  if (!analysis.grade || analysis.score_total === null) {
    throw new Error('Analysis has no score');
  }

  // 2. Vérifier si ticket déjà généré
  if (analysis.ticket_genere && analysis.ticket_code && analysis.ticket_url) {
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
  const codeData = await generateTicketCode(analysisId);

  // 4. Sauvegarder le code en base
  const { error: updateCodeError } = await supabase
    .from('pro_devis_analyses')
    .update({ ticket_code: codeData.shortCode })
    .eq('id', analysisId);

  if (updateCodeError) {
    throw new Error('Failed to save ticket code');
  }

  // 5. Générer le QR code
  const qrCode = await generateQRCode({
    url: codeData.url,
    size: 200,
  });

  // 6. Préparer les données du ticket
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
  const pdf = await generateTicketPDF(ticketData);

  // 8. Upload le PDF vers Supabase Storage
  const storagePath = `${analysis.company_id}/${pdf.fileName}`;

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('pro-tickets')
    .upload(storagePath, pdf.buffer, {
      contentType: 'application/pdf',
      upsert: true, // Remplacer si existe déjà
    });

  if (uploadError) {
    console.error('Error uploading ticket PDF:', uploadError);
    throw new Error('Failed to upload ticket PDF');
  }

  // 9. Obtenir l'URL publique du PDF
  const { data: urlData } = supabase.storage
    .from('pro-tickets')
    .getPublicUrl(storagePath);

  const pdfUrl = urlData.publicUrl;

  // 10. Mettre à jour l'analyse avec les infos du ticket
  const { error: updateError } = await supabase
    .from('pro_devis_analyses')
    .update({
      ticket_genere: true,
      ticket_url: pdfUrl,
    })
    .eq('id', analysisId);

  if (updateError) {
    console.error('Error updating analysis with ticket info:', updateError);
    throw new Error('Failed to update analysis');
  }

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
