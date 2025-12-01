/**
 * Service complet de génération de tickets TORP
 * Orchestre : code unique + QR code + PDF + upload
 */

import { supabase } from '@/lib/supabase';
import { generateTicketCode } from './generate-code';
import { generateQRCodeBuffer } from './generate-qr';
import { generateTicketPDF } from './generate-pdf';

export interface GenerateTicketResult {
  ticketCode: string;       // "TORP-A7X9K2"
  shortCode: string;        // "A7X9K2"
  ticketUrl: string;        // "https://torp.fr/t/A7X9K2"
  pdfUrl: string;           // URL du PDF dans Supabase Storage
  pdfFileName: string;      // "ticket-torp-a7x9k2.pdf"
}

/**
 * Génère un ticket TORP complet pour une analyse
 */
export async function generateTicket(analysisId: string): Promise<GenerateTicketResult> {
  console.log(`[generateTicket] Starting ticket generation for analysis ${analysisId}`);

  // 1. Récupérer les données de l'analyse
  const { data: analysis, error: analysisError } = await supabase
    .from('pro_devis_analyses')
    .select(`
      *,
      company:pro_company_profiles(*)
    `)
    .eq('id', analysisId)
    .single();

  if (analysisError || !analysis) {
    throw new Error(`Analysis not found: ${analysisId}`);
  }

  console.log('[generateTicket] Analysis loaded:', analysis.reference_devis);

  // 2. Vérifier que l'analyse est terminée
  if (analysis.status !== 'COMPLETED') {
    throw new Error('Analysis not completed yet');
  }

  if (!analysis.grade || !analysis.score_total) {
    throw new Error('Analysis has no score');
  }

  // 3. Vérifier si ticket déjà généré
  if (analysis.ticket_genere && analysis.ticket_code && analysis.ticket_url) {
    console.log('[generateTicket] Ticket already generated, returning existing');
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://torp.fr';
    return {
      ticketCode: `TORP-${analysis.ticket_code}`,
      shortCode: analysis.ticket_code,
      ticketUrl: `${baseUrl}/t/${analysis.ticket_code}`,
      pdfUrl: analysis.ticket_url,
      pdfFileName: `ticket-torp-${analysis.ticket_code.toLowerCase()}.pdf`,
    };
  }

  try {
    // 4. Générer le code unique
    console.log('[generateTicket] Step 1/5: Generating unique code...');
    const codeData = await generateTicketCode(analysisId);
    console.log('[generateTicket] ✓ Code generated:', codeData.code);

    // 5. Sauvegarder le code en base (pour réserver)
    await supabase
      .from('pro_devis_analyses')
      .update({ ticket_code: codeData.shortCode })
      .eq('id', analysisId);

    // 6. Générer le QR code
    console.log('[generateTicket] Step 2/5: Generating QR code...');
    const qrCodeBuffer = await generateQRCodeBuffer(codeData.url, 200);
    console.log('[generateTicket] ✓ QR code generated');

    // 7. Préparer les données du ticket
    const ticketData = {
      ticketCode: codeData.code,
      analysisId,
      grade: analysis.grade as 'A' | 'B' | 'C' | 'D' | 'E',
      scoreTotal: analysis.score_total,
      entreprise: {
        raisonSociale: analysis.company.raison_sociale,
        siret: analysis.company.siret,
      },
      referenceDevis: analysis.reference_devis,
      dateAnalyse: analysis.analyzed_at ? new Date(analysis.analyzed_at) : new Date(),
      qrCodeBuffer,
      ticketUrl: codeData.url,
    };

    // 8. Générer le PDF
    console.log('[generateTicket] Step 3/5: Generating PDF...');
    const pdf = await generateTicketPDF(ticketData);
    console.log('[generateTicket] ✓ PDF generated:', pdf.fileName);

    // 9. Upload le PDF vers Supabase Storage
    console.log('[generateTicket] Step 4/5: Uploading PDF to storage...');
    const storagePath = `tickets/${analysis.company_id}/${pdf.fileName}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('pro-tickets')
      .upload(storagePath, pdf.buffer, {
        contentType: 'application/pdf',
        upsert: true, // Remplacer si existe déjà
      });

    if (uploadError) {
      console.error('[generateTicket] Upload error:', uploadError);
      throw new Error(`Failed to upload PDF: ${uploadError.message}`);
    }

    // Obtenir l'URL publique
    const { data: urlData } = supabase.storage
      .from('pro-tickets')
      .getPublicUrl(storagePath);

    const pdfUrl = urlData.publicUrl;
    console.log('[generateTicket] ✓ PDF uploaded to:', pdfUrl);

    // 10. Mettre à jour l'analyse
    console.log('[generateTicket] Step 5/5: Updating analysis record...');
    await supabase
      .from('pro_devis_analyses')
      .update({
        ticket_genere: true,
        ticket_url: pdfUrl,
      })
      .eq('id', analysisId);

    console.log('[generateTicket] ✓ Ticket generation completed successfully!');

    return {
      ticketCode: codeData.code,
      shortCode: codeData.shortCode,
      ticketUrl: codeData.url,
      pdfUrl,
      pdfFileName: pdf.fileName,
    };
  } catch (error) {
    console.error('[generateTicket] Error during ticket generation:', error);

    // Nettoyer le code si généré
    await supabase
      .from('pro_devis_analyses')
      .update({
        ticket_code: null,
        ticket_genere: false,
        ticket_url: null,
      })
      .eq('id', analysisId);

    throw error;
  }
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

  if (error || !analysis || !analysis.ticket_genere || !analysis.ticket_code) {
    return null;
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://torp.fr';

  return {
    ticketCode: `TORP-${analysis.ticket_code}`,
    shortCode: analysis.ticket_code,
    ticketUrl: `${baseUrl}/t/${analysis.ticket_code}`,
    pdfUrl: analysis.ticket_url || '',
    pdfFileName: `ticket-torp-${analysis.ticket_code.toLowerCase()}.pdf`,
  };
}

/**
 * Vérifie si un ticket existe pour une analyse
 */
export async function ticketExists(analysisId: string): Promise<boolean> {
  const { data } = await supabase
    .from('pro_devis_analyses')
    .select('ticket_genere')
    .eq('id', analysisId)
    .single();

  return data?.ticket_genere || false;
}
