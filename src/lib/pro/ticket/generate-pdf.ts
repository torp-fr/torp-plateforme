/**
 * Génération du PDF du ticket TORP
 * Format : 210mm x 99mm (format DL/tiers de A4)
 * Utilise pdf-lib pour créer le badge
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
  qrCodeBuffer: Buffer;
  ticketUrl: string;
}

export interface TicketPDFResult {
  buffer: Buffer;
  fileName: string;
}

/**
 * Couleurs TORP
 */
const COLORS = {
  primary: rgb(0.118, 0.227, 0.373),      // #1E3A5F - Bleu foncé
  secondary: rgb(0.204, 0.596, 0.859),    // #3498DB - Bleu clair
  gradeA: rgb(0.180, 0.800, 0.443),       // #2ECC71 - Vert
  gradeB: rgb(0.404, 0.753, 0.361),       // #67C05B - Vert clair
  gradeC: rgb(0.945, 0.769, 0.059),       // #F1C40F - Jaune
  gradeD: rgb(0.902, 0.494, 0.133),       // #E67E22 - Orange
  gradeE: rgb(0.906, 0.298, 0.235),       // #E74C3C - Rouge
  textDark: rgb(0.2, 0.2, 0.2),
  textLight: rgb(0.5, 0.5, 0.5),
  white: rgb(1, 1, 1),
};

/**
 * Formatte un SIRET pour l'affichage
 */
function formatSiret(siret: string): string {
  const clean = siret.replace(/\s/g, '');
  if (clean.length !== 14) return siret;
  return `${clean.slice(0, 3)} ${clean.slice(3, 6)} ${clean.slice(6, 9)} ${clean.slice(9)}`;
}

/**
 * Tronque un texte si trop long
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Obtient la couleur selon le grade
 */
function getGradeColor(grade: string): { dark: any; light: any } {
  const colorMap: Record<string, any> = {
    'A': COLORS.gradeA,
    'B': COLORS.gradeB,
    'C': COLORS.gradeC,
    'D': COLORS.gradeD,
    'E': COLORS.gradeE,
  };

  return {
    dark: colorMap[grade] || COLORS.gradeC,
    light: colorMap[grade] || COLORS.gradeC,
  };
}

/**
 * Génère le PDF du ticket TORP
 */
export async function generateTicketPDF(data: TicketData): Promise<TicketPDFResult> {
  try {
    // Créer un document PDF
    const pdfDoc = await PDFDocument.create();

    // Format ticket : 210mm x 99mm (format DL/tiers de A4)
    // En points (72 dpi) : 595.28 x 280.63
    const page = pdfDoc.addPage([595, 280]);

    // Charger les fonts
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const gradeColors = getGradeColor(data.grade);

    // ===== BANDEAU GAUCHE (Score) =====
    // Rectangle coloré selon le grade
    page.drawRectangle({
      x: 0,
      y: 0,
      width: 180,
      height: 280,
      color: gradeColors.dark,
    });

    // Logo TORP
    page.drawText('TORP', {
      x: 50,
      y: 240,
      size: 28,
      font: fontBold,
      color: COLORS.white,
    });

    // Ligne sous TORP
    page.drawLine({
      start: { x: 30, y: 230 },
      end: { x: 150, y: 230 },
      thickness: 2,
      color: COLORS.white,
    });

    // Grade (grande lettre)
    page.drawText(data.grade, {
      x: data.grade.length === 1 ? 68 : 55,
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
    page.drawText('SCORE VÉRIFIÉ', {
      x: 35,
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
      y: 35,
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

    const raisonSociale = truncateText(data.entreprise.raisonSociale, 30);
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

    const refDevis = truncateText(data.referenceDevis, 25);
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

    const urlShort = data.ticketUrl.replace('https://', '').replace('http://', '');
    page.drawText(urlShort, {
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
      const qrImage = await pdfDoc.embedPng(data.qrCodeBuffer);
      page.drawImage(qrImage, {
        x: 470,
        y: 85,
        width: 110,
        height: 110,
      });

      // Label sous QR
      page.drawText('Voir l\'analyse', {
        x: 485,
        y: 65,
        size: 9,
        font: fontRegular,
        color: COLORS.textDark,
      });
    } catch (error) {
      console.error('Error embedding QR code:', error);
      // Continue sans QR code si erreur
    }

    // ===== BORDURE =====
    page.drawRectangle({
      x: 2,
      y: 2,
      width: 591,
      height: 276,
      borderColor: COLORS.primary,
      borderWidth: 2,
      color: rgb(0, 0, 0), // Transparent (ne sera pas affiché)
      opacity: 0,
    });

    // Générer le PDF
    const pdfBytes = await pdfDoc.save();
    const buffer = Buffer.from(pdfBytes);

    const fileName = `ticket-torp-${data.ticketCode.toLowerCase().replace('torp-', '')}.pdf`;

    return { buffer, fileName };
  } catch (error) {
    console.error('Error generating ticket PDF:', error);
    throw new Error('Failed to generate ticket PDF');
  }
}
