/**
 * PDF Generator Utility
 * Generates formatted PDF reports for TORP analysis results
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Project } from '@/context/AppContext';

// Helper function to format strength/warning items (can be string or object)
const formatItem = (item: any): string => {
  if (typeof item === 'string') return item;
  if (typeof item === 'object' && item !== null) {
    // Handle different object structures
    if (item.aspect && item.detail) {
      return `${item.aspect}: ${item.detail}${item.impact ? ` (Impact: ${item.impact})` : ''}`;
    }
    if (item.gravite && item.resolution) {
      return `${item.aspect || ''}: ${item.detail || ''}\nGravite: ${item.gravite || ''}\nResolution: ${item.resolution || ''}`;
    }
    // Fallback: try to extract meaningful text
    const text = item.detail || item.description || item.message || '';
    return text || 'Information non disponible';
  }
  return String(item);
};

export const generateAnalysisReportPDF = (project: Project) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  let yPosition = 20;

  // Add TORP logo/header
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('TORP', 20, yPosition);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Analyse de devis IA', 20, yPosition + 5);

  // Add date
  doc.setFontSize(9);
  doc.text(`Généré le ${new Date().toLocaleDateString('fr-FR')}`, pageWidth - 60, yPosition);

  yPosition += 20;

  // Title
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Rapport d\'Analyse TORP', 20, yPosition);
  yPosition += 10;

  // Project name
  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.text(project.name || 'Devis analysé', 20, yPosition);
  yPosition += 15;

  // Score section
  doc.setFillColor(240, 240, 240);
  doc.rect(20, yPosition - 5, pageWidth - 40, 40, 'F');

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Score Global TORP', 25, yPosition + 5);

  doc.setFontSize(28);
  const scoreColor = project.score >= 800 ? [34, 197, 94] : project.score >= 600 ? [234, 179, 8] : [239, 68, 68];
  doc.setTextColor(scoreColor[0], scoreColor[1], scoreColor[2]);
  doc.text(`${project.grade}`, pageWidth / 2 - 10, yPosition + 20);

  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.text(`${project.score}/1000`, pageWidth / 2 + 10, yPosition + 20);

  yPosition += 50;

  // Detailed scores table
  const { analysisResult } = project;
  const detailedScores = analysisResult?.detailedScores || {};

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Scores Détaillés', 20, yPosition);
  yPosition += 5;

  autoTable(doc, {
    startY: yPosition,
    head: [['Critère', 'Score', 'Évaluation']],
    body: [
      ['Fiabilité entreprise', `${detailedScores.entreprise || 0}%`, getEvaluation(detailedScores.entreprise || 0)],
      ['Prix cohérent', `${detailedScores.prix || 0}%`, getEvaluation(detailedScores.prix || 0)],
      ['Complétude', `${detailedScores.completude || 0}%`, getEvaluation(detailedScores.completude || 0)],
      ['Conformité', `${detailedScores.conformite || 0}%`, getEvaluation(detailedScores.conformite || 0)],
      ['Délais', `${detailedScores.delais || 0}%`, getEvaluation(detailedScores.delais || 0)],
    ],
    theme: 'striped',
    headStyles: { fillColor: [220, 38, 38], textColor: 255 },
    margin: { left: 20, right: 20 },
  });

  yPosition = (doc as any).lastAutoTable.finalY + 15;

  // Check for new page
  if (yPosition > pageHeight - 60) {
    doc.addPage();
    yPosition = 20;
  }

  // Points forts
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(34, 197, 94);
  doc.text('Points Forts', 20, yPosition);
  yPosition += 7;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);

  const strengths = analysisResult?.strengths || [];
  strengths.forEach((strength: any, index: number) => {
    if (yPosition > pageHeight - 20) {
      doc.addPage();
      yPosition = 20;
    }
    const formattedStrength = formatItem(strength);
    const lines = doc.splitTextToSize(`- ${formattedStrength}`, pageWidth - 50);
    doc.text(lines, 25, yPosition);
    yPosition += lines.length * 5 + 2;
  });

  yPosition += 10;

  // Points d'attention
  const warnings = analysisResult?.warnings || [];
  if (warnings.length > 0) {
    if (yPosition > pageHeight - 40) {
      doc.addPage();
      yPosition = 20;
    }

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(234, 179, 8);
    doc.text('Points a Verifier', 20, yPosition);
    yPosition += 7;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);

    warnings.forEach((warning: any) => {
      if (yPosition > pageHeight - 20) {
        doc.addPage();
        yPosition = 20;
      }
      const formattedWarning = formatItem(warning);
      const lines = doc.splitTextToSize(`- ${formattedWarning}`, pageWidth - 50);
      doc.text(lines, 25, yPosition);
      yPosition += lines.length * 5 + 2;
    });

    yPosition += 10;
  }

  // Questions à poser
  const questions = analysisResult?.recommendations?.questions || [];
  if (questions.length > 0) {
    if (yPosition > pageHeight - 40) {
      doc.addPage();
      yPosition = 20;
    }

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(59, 130, 246);
    doc.text('Questions a Poser', 20, yPosition);
    yPosition += 7;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);

    questions.forEach((question: any) => {
      if (yPosition > pageHeight - 20) {
        doc.addPage();
        yPosition = 20;
      }
      const formattedQuestion = typeof question === 'string' ? question : formatItem(question);
      const lines = doc.splitTextToSize(`- ${formattedQuestion}`, pageWidth - 50);
      doc.text(lines, 25, yPosition);
      yPosition += lines.length * 5 + 2;
    });
  }

  // Add footer to all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    doc.text(
      `Page ${i} sur ${totalPages} - TORP Analyse de Devis`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    );
  }

  // Save the PDF
  const fileName = `TORP_Analyse_${project.name?.replace(/[^a-z0-9]/gi, '_') || 'Devis'}_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
};

const getEvaluation = (score: number): string => {
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Correct';
  if (score >= 40) return 'Moyen';
  return 'À améliorer';
};
