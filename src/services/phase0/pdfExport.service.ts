/**
 * PDFExportService - Export de documents en PDF
 * Utilise jsPDF pour générer des PDFs professionnels
 * Adapté selon le profil utilisateur (B2C, B2B, B2G)
 */

import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { GeneratedDocument, DocumentSection, DocumentType } from './documentGenerator.service';
import { UserType } from '@/context/AppContext';

// Extend jsPDF type for autoTable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: unknown) => jsPDF;
    lastAutoTable: {
      finalY: number;
    };
  }
}

// Configuration des styles PDF par profil
const PDF_STYLES: Record<UserType, {
  primaryColor: [number, number, number];
  secondaryColor: [number, number, number];
  headerText: string;
  footerText: string;
  showLogo: boolean;
  fontSize: {
    title: number;
    subtitle: number;
    heading: number;
    body: number;
    small: number;
  };
}> = {
  B2C: {
    primaryColor: [59, 130, 246], // Blue
    secondaryColor: [100, 116, 139],
    headerText: 'TORP - Votre projet de travaux',
    footerText: 'Document généré par TORP - torp.fr',
    showLogo: true,
    fontSize: { title: 20, subtitle: 14, heading: 12, body: 10, small: 8 },
  },
  B2B: {
    primaryColor: [30, 64, 175], // Indigo
    secondaryColor: [71, 85, 105],
    headerText: 'TORP - Plateforme de gestion de projets BTP',
    footerText: 'TORP SAS - Document confidentiel',
    showLogo: true,
    fontSize: { title: 18, subtitle: 12, heading: 11, body: 9, small: 7 },
  },
  B2G: {
    primaryColor: [30, 58, 138], // Dark blue
    secondaryColor: [55, 65, 81],
    headerText: 'TORP - Marchés Publics',
    footerText: 'Document officiel - TORP',
    showLogo: true,
    fontSize: { title: 16, subtitle: 11, heading: 10, body: 9, small: 7 },
  },
  admin: {
    primaryColor: [30, 64, 175],
    secondaryColor: [71, 85, 105],
    headerText: 'TORP Admin',
    footerText: 'TORP - Internal Document',
    showLogo: true,
    fontSize: { title: 18, subtitle: 12, heading: 11, body: 9, small: 7 },
  },
  super_admin: {
    primaryColor: [30, 64, 175],
    secondaryColor: [71, 85, 105],
    headerText: 'TORP System',
    footerText: 'TORP - System Document',
    showLogo: true,
    fontSize: { title: 18, subtitle: 12, heading: 11, body: 9, small: 7 },
  },
};

// Labels de documents par profil
const DOC_LABELS: Record<UserType, Record<DocumentType, string>> = {
  B2C: {
    ccf: 'Cahier des Charges',
    aps: 'Avant-Projet',
    cctp: 'Descriptif Technique',
  },
  B2B: {
    ccf: 'Cahier des Charges Fonctionnel',
    aps: 'Avant-Projet Sommaire',
    cctp: 'CCTP - Clauses Techniques Particulières',
  },
  B2G: {
    ccf: 'Cahier des Charges Fonctionnel',
    aps: 'Avant-Projet Sommaire',
    cctp: 'Cahier des Clauses Techniques Particulières',
  },
  admin: {
    ccf: 'CCF',
    aps: 'APS',
    cctp: 'CCTP',
  },
  super_admin: {
    ccf: 'CCF',
    aps: 'APS',
    cctp: 'CCTP',
  },
};

export class PDFExportService {
  /**
   * Exporte un document en PDF
   */
  static async exportDocumentToPDF(
    document: GeneratedDocument,
    userType: UserType = 'B2B'
  ): Promise<void> {
    const pdf = new jsPDF('p', 'mm', 'a4');
    const styles = PDF_STYLES[userType];
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 20;
    const contentWidth = pageWidth - 2 * margin;

    let yPos = margin;

    // === PAGE DE GARDE ===
    this.addCoverPage(pdf, document, userType, styles);

    // === CONTENU ===
    pdf.addPage();
    yPos = margin;

    // Header sur chaque page
    this.addHeader(pdf, document, styles, margin);
    yPos = 35;

    // Informations du projet
    yPos = this.addProjectInfo(pdf, document, yPos, margin, contentWidth, styles);
    yPos += 10;

    // Sections du document
    for (const section of document.content.sections) {
      yPos = this.addSection(pdf, section, yPos, margin, contentWidth, styles, 0);

      // Nouvelle page si nécessaire
      if (yPos > pageHeight - 40) {
        pdf.addPage();
        this.addHeader(pdf, document, styles, margin);
        yPos = 35;
      }
    }

    // Footer sur toutes les pages
    const pageCount = pdf.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      pdf.setPage(i);
      this.addFooter(pdf, styles, i, pageCount);
    }

    // Télécharger le PDF
    const fileName = this.generateFileName(document, userType);
    pdf.save(fileName);
  }

  /**
   * Exporte tous les documents en un seul PDF
   */
  static async exportAllDocumentsToPDF(
    documents: GeneratedDocument[],
    projectTitle: string,
    projectReference: string,
    userType: UserType = 'B2B'
  ): Promise<void> {
    const pdf = new jsPDF('p', 'mm', 'a4');
    const styles = PDF_STYLES[userType];
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 20;
    const contentWidth = pageWidth - 2 * margin;

    // === PAGE DE GARDE DU DOSSIER ===
    this.addDossierCoverPage(pdf, documents, projectTitle, projectReference, userType, styles);

    // === SOMMAIRE ===
    pdf.addPage();
    this.addTableOfContents(pdf, documents, userType, styles, margin);

    // === CHAQUE DOCUMENT ===
    for (let docIndex = 0; docIndex < documents.length; docIndex++) {
      const document = documents[docIndex];
      pdf.addPage();

      let yPos = margin;

      // En-tête du document
      this.addHeader(pdf, document, styles, margin);
      yPos = 35;

      // Titre du document
      pdf.setFontSize(styles.fontSize.title);
      pdf.setTextColor(...styles.primaryColor);
      pdf.setFont('helvetica', 'bold');
      const docLabel = DOC_LABELS[userType][document.type] || document.type.toUpperCase();
      pdf.text(docLabel, margin, yPos);
      yPos += 10;

      // Informations du projet
      yPos = this.addProjectInfo(pdf, document, yPos, margin, contentWidth, styles);
      yPos += 10;

      // Sections
      for (const section of document.content.sections) {
        yPos = this.addSection(pdf, section, yPos, margin, contentWidth, styles, 0);

        if (yPos > pageHeight - 40) {
          pdf.addPage();
          this.addHeader(pdf, document, styles, margin);
          yPos = 35;
        }
      }
    }

    // Footer sur toutes les pages
    const pageCount = pdf.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      pdf.setPage(i);
      this.addFooter(pdf, styles, i, pageCount);
    }

    // Télécharger
    const fileName = `TORP_Dossier_${projectReference}_${new Date().toISOString().split('T')[0]}.pdf`;
    pdf.save(fileName);
  }

  /**
   * Ajoute la page de garde d'un document
   */
  private static addCoverPage(
    pdf: jsPDF,
    document: GeneratedDocument,
    userType: UserType,
    styles: typeof PDF_STYLES[UserType]
  ): void {
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const centerX = pageWidth / 2;

    // Bandeau supérieur
    pdf.setFillColor(...styles.primaryColor);
    pdf.rect(0, 0, pageWidth, 60, 'F');

    // Logo TORP
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(32);
    pdf.setFont('helvetica', 'bold');
    pdf.text('TORP', centerX, 35, { align: 'center' });

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text(styles.headerText, centerX, 48, { align: 'center' });

    // Type de document
    const docLabel = DOC_LABELS[userType][document.type] || document.type.toUpperCase();
    pdf.setTextColor(...styles.primaryColor);
    pdf.setFontSize(28);
    pdf.setFont('helvetica', 'bold');
    pdf.text(docLabel, centerX, 100, { align: 'center' });

    // Titre du projet
    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'normal');
    const title = document.metadata.projectReference || 'Projet';
    pdf.text(title, centerX, 120, { align: 'center' });

    // Ligne décorative
    pdf.setDrawColor(...styles.primaryColor);
    pdf.setLineWidth(0.5);
    pdf.line(60, 130, pageWidth - 60, 130);

    // Informations
    let yPos = 150;
    pdf.setFontSize(11);
    pdf.setTextColor(...styles.secondaryColor);

    const infoLines = [
      ['Maître d\'ouvrage', document.metadata.ownerName],
      ['Adresse du bien', document.metadata.propertyAddress],
      ['Référence', document.metadata.projectReference],
      ['Version', document.metadata.version],
      ['Date de génération', document.metadata.generationDate.toLocaleDateString('fr-FR')],
    ];

    for (const [label, value] of infoLines) {
      pdf.setFont('helvetica', 'bold');
      pdf.text(label + ' :', 40, yPos);
      pdf.setFont('helvetica', 'normal');
      pdf.text(value || 'Non renseigné', 85, yPos);
      yPos += 8;
    }

    // Bandeau inférieur
    pdf.setFillColor(...styles.primaryColor);
    pdf.rect(0, pageHeight - 20, pageWidth, 20, 'F');

    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(8);
    pdf.text(styles.footerText, centerX, pageHeight - 8, { align: 'center' });
  }

  /**
   * Ajoute la page de garde du dossier complet
   */
  private static addDossierCoverPage(
    pdf: jsPDF,
    documents: GeneratedDocument[],
    projectTitle: string,
    projectReference: string,
    userType: UserType,
    styles: typeof PDF_STYLES[UserType]
  ): void {
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const centerX = pageWidth / 2;

    // Bandeau supérieur
    pdf.setFillColor(...styles.primaryColor);
    pdf.rect(0, 0, pageWidth, 70, 'F');

    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(36);
    pdf.setFont('helvetica', 'bold');
    pdf.text('TORP', centerX, 40, { align: 'center' });

    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'normal');
    pdf.text(styles.headerText, centerX, 55, { align: 'center' });

    // Titre du dossier
    pdf.setTextColor(...styles.primaryColor);
    pdf.setFontSize(24);
    pdf.setFont('helvetica', 'bold');
    const dossierTitle = userType === 'B2C'
      ? 'Dossier de Projet'
      : userType === 'B2G'
        ? 'Dossier de Consultation des Entreprises'
        : 'DCE - Dossier de Consultation';
    pdf.text(dossierTitle, centerX, 100, { align: 'center' });

    // Référence projet
    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'normal');
    pdf.text(projectReference, centerX, 115, { align: 'center' });

    // Ligne décorative
    pdf.setDrawColor(...styles.primaryColor);
    pdf.setLineWidth(0.5);
    pdf.line(50, 125, pageWidth - 50, 125);

    // Liste des documents inclus
    let yPos = 145;
    pdf.setFontSize(12);
    pdf.setTextColor(...styles.primaryColor);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Documents inclus :', 40, yPos);
    yPos += 10;

    pdf.setFontSize(10);
    pdf.setTextColor(0, 0, 0);
    pdf.setFont('helvetica', 'normal');

    for (const doc of documents) {
      const docLabel = DOC_LABELS[userType][doc.type] || doc.type.toUpperCase();
      pdf.text(`• ${docLabel}`, 45, yPos);
      yPos += 7;
    }

    // Date de génération
    yPos += 15;
    pdf.setFontSize(10);
    pdf.setTextColor(...styles.secondaryColor);
    pdf.text(
      `Généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}`,
      centerX,
      yPos,
      { align: 'center' }
    );

    // Bandeau inférieur
    pdf.setFillColor(...styles.primaryColor);
    pdf.rect(0, pageHeight - 20, pageWidth, 20, 'F');

    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(8);
    pdf.text(styles.footerText, centerX, pageHeight - 8, { align: 'center' });
  }

  /**
   * Ajoute le sommaire
   */
  private static addTableOfContents(
    pdf: jsPDF,
    documents: GeneratedDocument[],
    userType: UserType,
    styles: typeof PDF_STYLES[UserType],
    margin: number
  ): void {
    let yPos = margin;

    pdf.setFontSize(styles.fontSize.title);
    pdf.setTextColor(...styles.primaryColor);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Sommaire', margin, yPos);
    yPos += 15;

    pdf.setFontSize(styles.fontSize.body);
    pdf.setTextColor(0, 0, 0);
    pdf.setFont('helvetica', 'normal');

    let pageNum = 3; // Après couverture et sommaire
    for (const doc of documents) {
      const docLabel = DOC_LABELS[userType][doc.type] || doc.type.toUpperCase();

      pdf.setFont('helvetica', 'bold');
      pdf.text(docLabel, margin, yPos);

      pdf.setFont('helvetica', 'normal');
      const pageText = `page ${pageNum}`;
      const textWidth = pdf.getTextWidth(pageText);
      pdf.text(pageText, pdf.internal.pageSize.getWidth() - margin - textWidth, yPos);

      yPos += 8;
      pageNum += Math.ceil(doc.content.sections.length / 3) + 1;
    }
  }

  /**
   * Ajoute l'en-tête d'une page
   */
  private static addHeader(
    pdf: jsPDF,
    document: GeneratedDocument,
    styles: typeof PDF_STYLES[UserType],
    margin: number
  ): void {
    const pageWidth = pdf.internal.pageSize.getWidth();

    pdf.setFontSize(8);
    pdf.setTextColor(...styles.secondaryColor);
    pdf.setFont('helvetica', 'normal');
    pdf.text('TORP', margin, 10);
    pdf.text(document.metadata.projectReference, pageWidth - margin, 10, { align: 'right' });

    pdf.setDrawColor(...styles.primaryColor);
    pdf.setLineWidth(0.3);
    pdf.line(margin, 15, pageWidth - margin, 15);
  }

  /**
   * Ajoute le pied de page
   */
  private static addFooter(
    pdf: jsPDF,
    styles: typeof PDF_STYLES[UserType],
    pageNumber: number,
    totalPages: number
  ): void {
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 20;

    pdf.setDrawColor(...styles.secondaryColor);
    pdf.setLineWidth(0.2);
    pdf.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15);

    pdf.setFontSize(7);
    pdf.setTextColor(...styles.secondaryColor);
    pdf.setFont('helvetica', 'normal');
    pdf.text(styles.footerText, margin, pageHeight - 8);
    pdf.text(`Page ${pageNumber} / ${totalPages}`, pageWidth - margin, pageHeight - 8, { align: 'right' });
  }

  /**
   * Ajoute les informations du projet
   */
  private static addProjectInfo(
    pdf: jsPDF,
    document: GeneratedDocument,
    yPos: number,
    margin: number,
    contentWidth: number,
    styles: typeof PDF_STYLES[UserType]
  ): number {
    // Cadre d'informations
    pdf.setFillColor(245, 245, 245);
    pdf.roundedRect(margin, yPos, contentWidth, 25, 2, 2, 'F');

    pdf.setFontSize(styles.fontSize.small);
    pdf.setTextColor(...styles.secondaryColor);

    const colWidth = contentWidth / 3;
    const innerMargin = margin + 5;
    const innerY = yPos + 8;

    pdf.setFont('helvetica', 'bold');
    pdf.text('Référence', innerMargin, innerY);
    pdf.text('Maître d\'ouvrage', innerMargin + colWidth, innerY);
    pdf.text('Adresse', innerMargin + colWidth * 2, innerY);

    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(0, 0, 0);
    pdf.text(document.metadata.projectReference || '-', innerMargin, innerY + 7);
    pdf.text(document.metadata.ownerName || '-', innerMargin + colWidth, innerY + 7);

    const address = document.metadata.propertyAddress || '-';
    const truncatedAddress = address.length > 40 ? address.substring(0, 37) + '...' : address;
    pdf.text(truncatedAddress, innerMargin + colWidth * 2, innerY + 7);

    return yPos + 30;
  }

  /**
   * Ajoute une section de document
   */
  private static addSection(
    pdf: jsPDF,
    section: DocumentSection,
    yPos: number,
    margin: number,
    contentWidth: number,
    styles: typeof PDF_STYLES[UserType],
    depth: number
  ): number {
    const pageHeight = pdf.internal.pageSize.getHeight();
    const indent = depth * 5;

    // Vérifier si nouvelle page nécessaire
    if (yPos > pageHeight - 50) {
      pdf.addPage();
      yPos = 35;
    }

    // Titre de section
    const fontSize = depth === 0 ? styles.fontSize.heading : styles.fontSize.body;
    pdf.setFontSize(fontSize);
    pdf.setFont('helvetica', 'bold');

    if (depth === 0) {
      pdf.setTextColor(...styles.primaryColor);
    } else {
      pdf.setTextColor(0, 0, 0);
    }

    pdf.text(section.title, margin + indent, yPos);
    yPos += fontSize * 0.5 + 2;

    // Contenu
    if (section.content) {
      pdf.setFontSize(styles.fontSize.body);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(0, 0, 0);

      const lines = pdf.splitTextToSize(section.content, contentWidth - indent);
      for (const line of lines) {
        if (yPos > pageHeight - 30) {
          pdf.addPage();
          yPos = 35;
        }
        pdf.text(line, margin + indent, yPos);
        yPos += 4.5;
      }
      yPos += 3;
    }

    // Sous-sections
    if (section.subsections) {
      for (const subsection of section.subsections) {
        yPos = this.addSection(pdf, subsection, yPos, margin, contentWidth, styles, depth + 1);
      }
    }

    return yPos + 3;
  }

  /**
   * Génère le nom du fichier PDF
   */
  private static generateFileName(document: GeneratedDocument, userType: UserType): string {
    const docLabel = DOC_LABELS[userType][document.type] || document.type.toUpperCase();
    const ref = document.metadata.projectReference.replace(/[^a-zA-Z0-9]/g, '_');
    const date = new Date().toISOString().split('T')[0];
    return `TORP_${docLabel.replace(/\s+/g, '_')}_${ref}_${date}.pdf`;
  }
}

export default PDFExportService;
