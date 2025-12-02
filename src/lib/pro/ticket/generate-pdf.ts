/**
 * Génération du PDF ticket TORP
 * Format : 210mm x 99mm (format DL/tiers de A4)
 */

import { PDFDocument, rgb, StandardFonts, PDFPage } from 'pdf-lib';

export interface TicketData {
  // Identifiants
  ticketCode: string;        // "TORP-A7X9K2"
  analysisId: string;

  // Score
  grade: 'A' | 'B' | 'C' | 'D' | 'E';
  scoreTotal: number;        // 0-1000

  // Entreprise
  entreprise: {
    raisonSociale: string;
    siret: string;
  };

  // Devis
  referenceDevis: string;
  dateAnalyse: Date;

  // QR Code
  qrCodeBuffer: Uint8Array;
  ticketUrl: string;
}

export interface TicketPDFResult {
  buffer: Uint8Array;
  fileName: string;
}

// Couleurs TORP
const COLORS = {
  primary: rgb(0.118, 0.227, 0.373),      // #1E3A5F - Bleu foncé
  secondary: rgb(0.204, 0.596, 0.859),    // #3498DB - Bleu clair
  gradeA: rgb(0.180, 0.800, 0.443),       // #2ECC71 - Vert
  gradeB: rgb(0.353, 0.784, 0.443),       // Vert clair
  gradeC: rgb(0.945, 0.769, 0.059),       // #F1C40F - Jaune
  gradeD: rgb(0.902, 0.494, 0.133),       // #E67E22 - Orange
  gradeE: rgb(0.906, 0.298, 0.235),       // #E74C3C - Rouge
  textDark: rgb(0.2, 0.2, 0.2),
  textLight: rgb(0.5, 0.5, 0.5),
  white: rgb(1, 1, 1),
};

/**
 * Formate un numéro SIRET pour l'affichage
 */
function formatSiret(siret: string): string {
  const clean = siret.replace(/\s/g, '');
  if (clean.length !== 14) return siret;
  return `${clean.slice(0, 3)} ${clean.slice(3, 6)} ${clean.slice(6, 9)} ${clean.slice(9)}`;
}

/**
 * Obtient la couleur selon le grade
 */
function getGradeColor(grade: string) {
  switch (grade) {
    case 'A': return COLORS.gradeA;
    case 'B': return COLORS.gradeB;
    case 'C': return COLORS.gradeC;
    case 'D': return COLORS.gradeD;
    case 'E': return COLORS.gradeE;
    default: return COLORS.gradeC;
  }
}

/**
 * Génère le PDF du ticket TORP
 */
export async function generateTicketPDF(data: TicketData): Promise<TicketPDFResult> {
  // Créer un document PDF
  const pdfDoc = await PDFDocument.create();

  // Format ticket : 210mm x 99mm (format DL/tiers de A4)
  // En points (72 dpi) : 595 x 280
  const page = pdfDoc.addPage([595, 280]);

  // Charger les fonts
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const gradeColor = getGradeColor(data.grade);

  // ===== BANDEAU GAUCHE (Score) =====
  page.drawRectangle({
    x: 0,
    y: 0,
    width: 180,
    height: 280,
    color: gradeColor,
  });

  // Logo TORP
  page.drawText('TORP', {
    x: 50,
    y: 240,
    size: 28,
    font: fontBold,
    color: COLORS.white,
  });

  // Grade (grande lettre)
  page.drawText(data.grade, {
    x: 70,
    y: 130,
    size: 80,
    font: fontBold,
    color: COLORS.white,
  });

  // Score numérique
  const scoreText = `${data.scoreTotal}/1000`;
  const scoreWidth = fontBold.widthOfTextAtSize(scoreText, 20);
  page.drawText(scoreText, {
    x: 90 - scoreWidth / 2,
    y: 95,
    size: 20,
    font: fontBold,
    color: COLORS.white,
  });

  // Label "Score Vérifié"
  const labelText = 'SCORE VÉRIFIÉ';
  const labelWidth = fontRegular.widthOfTextAtSize(labelText, 12);
  page.drawText(labelText, {
    x: 90 - labelWidth / 2,
    y: 60,
    size: 12,
    font: fontRegular,
    color: COLORS.white,
  });

  // Date d'analyse
  const dateFormatted = data.dateAnalyse.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const dateWidth = fontRegular.widthOfTextAtSize(dateFormatted, 10);
  page.drawText(dateFormatted, {
    x: 90 - dateWidth / 2,
    y: 40,
    size: 10,
    font: fontRegular,
    color: COLORS.white,
  });

  // ===== PARTIE CENTRALE (Infos) =====

  // Titre
  page.drawText('Certificat d\'Analyse TORP', {
    x: 200,
    y: 245,
    size: 16,
    font: fontBold,
    color: COLORS.primary,
  });

  // Ligne séparatrice
  page.drawLine({
    start: { x: 200, y: 235 },
    end: { x: 450, y: 235 },
    thickness: 1,
    color: COLORS.secondary,
  });

  // Entreprise
  page.drawText('ENTREPRISE', {
    x: 200,
    y: 210,
    size: 8,
    font: fontRegular,
    color: COLORS.textLight,
  });

  // Raison sociale (tronquer si trop long)
  let raisonSociale = data.entreprise.raisonSociale;
  if (raisonSociale.length > 35) {
    raisonSociale = raisonSociale.substring(0, 32) + '...';
  }
  page.drawText(raisonSociale, {
    x: 200,
    y: 195,
    size: 14,
    font: fontBold,
    color: COLORS.textDark,
  });

  page.drawText(`SIRET : ${formatSiret(data.entreprise.siret)}`, {
    x: 200,
    y: 178,
    size: 10,
    font: fontRegular,
    color: COLORS.textLight,
  });

  // Référence devis
  page.drawText('DEVIS ANALYSÉ', {
    x: 200,
    y: 150,
    size: 8,
    font: fontRegular,
    color: COLORS.textLight,
  });

  let refDevis = data.referenceDevis;
  if (refDevis.length > 30) {
    refDevis = refDevis.substring(0, 27) + '...';
  }
  page.drawText(refDevis, {
    x: 200,
    y: 135,
    size: 12,
    font: fontBold,
    color: COLORS.textDark,
  });

  // Code ticket
  page.drawText('CODE VÉRIFICATION', {
    x: 200,
    y: 105,
    size: 8,
    font: fontRegular,
    color: COLORS.textLight,
  });
  page.drawText(data.ticketCode, {
    x: 200,
    y: 90,
    size: 14,
    font: fontBold,
    color: COLORS.primary,
  });

  // Instructions
  page.drawText('Scannez le QR code ou visitez :', {
    x: 200,
    y: 55,
    size: 9,
    font: fontRegular,
    color: COLORS.textLight,
  });

  // URL (tronquer si nécessaire)
  let urlDisplay = data.ticketUrl.replace(/^https?:\/\//, '');
  if (urlDisplay.length > 35) {
    urlDisplay = urlDisplay.substring(0, 32) + '...';
  }
  page.drawText(urlDisplay, {
    x: 200,
    y: 40,
    size: 10,
    font: fontBold,
    color: COLORS.secondary,
  });

  // Disclaimer
  page.drawText('Ce score reflète la qualité du devis à la date d\'analyse.', {
    x: 200,
    y: 18,
    size: 7,
    font: fontRegular,
    color: COLORS.textLight,
  });

  // ===== QR CODE (Droite) =====
  try {
    console.log('[PDF] 📱 Intégration du QR code...');
    console.log('[PDF] QR buffer length:', data.qrCodeBuffer.length);
    const qrImage = await pdfDoc.embedPng(data.qrCodeBuffer);
    console.log('[PDF] ✅ QR code intégré');
    page.drawImage(qrImage, {
      x: 470,
      y: 80,
      width: 110,
      height: 110,
    });

    // Label sous QR
    const qrLabelText = 'Voir l\'analyse';
    const qrLabelWidth = fontRegular.widthOfTextAtSize(qrLabelText, 9);
    page.drawText(qrLabelText, {
      x: 525 - qrLabelWidth / 2,
      y: 60,
      size: 9,
      font: fontRegular,
      color: COLORS.textDark,
    });
  } catch (error) {
    console.error('[PDF] ❌ Error embedding QR code:', error);
    // Continue without QR code if error
  }

  // ===== BORDURE =====
  page.drawRectangle({
    x: 2,
    y: 2,
    width: 591,
    height: 276,
    borderColor: COLORS.primary,
    borderWidth: 2,
    color: rgb(0, 0, 0, 0), // Transparent
  });

  // Générer le PDF
  const pdfBytes = await pdfDoc.save();
  // pdfBytes est déjà un Uint8Array, pas besoin de conversion

  const fileName = `ticket-torp-${data.ticketCode.toLowerCase().replace('torp-', '')}.pdf`;

  return { buffer: pdfBytes, fileName };
}
