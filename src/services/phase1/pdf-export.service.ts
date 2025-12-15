/**
 * Phase1PDFService - Service d'export PDF pour Phase 1
 *
 * Génère des documents PDF pour:
 * - DCE (Dossier de Consultation des Entreprises)
 * - Analyse des offres
 * - Contrats de travaux
 */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { DCEDocument } from '@/types/phase1/dce.types';
import type { Offre, AnalyseOffre } from '@/types/phase1/offre.types';
import type { Contrat } from '@/types/phase1/contrat.types';

// Extend jsPDF type for autoTable
declare module 'jspdf' {
  interface jsPDF {
    lastAutoTable: { finalY: number };
  }
}

class Phase1PDFService {
  private readonly primaryColor: [number, number, number] = [41, 128, 185];
  private readonly secondaryColor: [number, number, number] = [52, 73, 94];

  /**
   * Export DCE complet en PDF
   */
  async exportDCE(dce: DCEDocument): Promise<Blob> {
    const doc = new jsPDF();
    let yPos = 20;

    // === PAGE DE GARDE ===
    doc.setFillColor(...this.primaryColor);
    doc.rect(0, 0, 210, 50, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('DOSSIER DE CONSULTATION', 105, 25, { align: 'center' });
    doc.text('DES ENTREPRISES', 105, 35, { align: 'center' });

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    yPos = 70;

    doc.text(`Référence: ${dce.metadata?.reference || 'N/A'}`, 20, yPos);
    yPos += 8;
    doc.text(`Date: ${new Date().toLocaleDateString('fr-FR')}`, 20, yPos);
    yPos += 8;
    doc.text(`Statut: ${this.translateStatus(dce.status)}`, 20, yPos);

    // Sommaire
    yPos = 120;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('SOMMAIRE', 20, yPos);
    yPos += 15;

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    const sommaire = [
      '1. Règlement de Consultation (RC)',
      '2. Acte d\'Engagement (AE)',
      '3. Décomposition du Prix Global Forfaitaire (DPGF)',
      '4. Cadre du Mémoire Technique',
    ];

    sommaire.forEach((item, index) => {
      doc.text(item, 25, yPos + (index * 8));
    });

    // === RÈGLEMENT DE CONSULTATION ===
    doc.addPage();
    this.addSectionHeader(doc, 'RÈGLEMENT DE CONSULTATION');
    yPos = 50;

    const rcContent = this.formatRCContent(dce.reglementConsultation);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');

    const rcLines = doc.splitTextToSize(rcContent, 170);
    doc.text(rcLines, 20, yPos);

    // === ACTE D'ENGAGEMENT ===
    doc.addPage();
    this.addSectionHeader(doc, 'ACTE D\'ENGAGEMENT');
    yPos = 50;

    const aeContent = this.formatAEContent(dce.acteEngagement);
    const aeLines = doc.splitTextToSize(aeContent, 170);
    doc.text(aeLines, 20, yPos);

    // === DPGF ===
    doc.addPage();
    this.addSectionHeader(doc, 'DÉCOMPOSITION DU PRIX GLOBAL FORFAITAIRE');

    if (dce.decompositionPrix?.postes) {
      autoTable(doc, {
        startY: 50,
        head: [['N°', 'Désignation', 'Unité', 'Quantité', 'PU HT (€)', 'Total HT (€)']],
        body: dce.decompositionPrix.postes.map((p, i) => [
          String(i + 1),
          p.designation || '',
          p.unite || 'ens',
          String(p.quantite || 1),
          '', // À remplir par l'entreprise
          '',
        ]),
        foot: [['', '', '', '', 'TOTAL HT', '']],
        theme: 'grid',
        headStyles: { fillColor: this.primaryColor },
        footStyles: { fillColor: [240, 240, 240] },
        styles: { fontSize: 9 },
        columnStyles: {
          0: { cellWidth: 15 },
          1: { cellWidth: 70 },
          2: { cellWidth: 20 },
          3: { cellWidth: 25 },
          4: { cellWidth: 30 },
          5: { cellWidth: 30 },
        },
      });
    }

    // === CADRE MÉMOIRE TECHNIQUE ===
    doc.addPage();
    this.addSectionHeader(doc, 'CADRE DU MÉMOIRE TECHNIQUE');
    yPos = 50;

    const mtContent = this.formatMTContent(dce.cadreMemoireTechnique);
    const mtLines = doc.splitTextToSize(mtContent, 170);
    doc.text(mtLines, 20, yPos);

    return doc.output('blob');
  }

  /**
   * Export analyse des offres en PDF
   */
  async exportAnalyseOffres(
    offres: Offre[],
    analyse: { offres: Record<string, AnalyseOffre> }
  ): Promise<Blob> {
    const doc = new jsPDF();

    // En-tête
    doc.setFillColor(...this.primaryColor);
    doc.rect(0, 0, 210, 40, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('RAPPORT D\'ANALYSE DES OFFRES', 105, 25, { align: 'center' });

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');

    let yPos = 55;
    doc.text(`Date d'analyse: ${new Date().toLocaleDateString('fr-FR')}`, 20, yPos);
    yPos += 6;
    doc.text(`Nombre d'offres analysées: ${offres.length}`, 20, yPos);

    // Tableau comparatif
    yPos += 15;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('TABLEAU COMPARATIF', 20, yPos);

    autoTable(doc, {
      startY: yPos + 10,
      head: [['Rang', 'Entreprise', 'Prix HT (€)', 'Note Tech.', 'Note Prix', 'Note Globale', 'Conformité']],
      body: offres
        .sort((a, b) => {
          const scoreA = analyse.offres[a.id]?.noteGlobale || 0;
          const scoreB = analyse.offres[b.id]?.noteGlobale || 0;
          return scoreB - scoreA;
        })
        .map((o, index) => {
          const a = analyse.offres[o.id];
          return [
            `#${index + 1}`,
            o.entreprise?.identification?.raisonSociale || 'N/A',
            o.contenu?.propositionFinanciere?.montantTotalHT?.toLocaleString('fr-FR') || '-',
            a?.noteTechnique ? `${a.noteTechnique}/100` : '-',
            a?.notePrix ? `${a.notePrix}/100` : '-',
            a?.noteGlobale ? `${a.noteGlobale}/100` : '-',
            a?.conformite?.administrative && a?.conformite?.technique ? '✓' : '✗',
          ];
        }),
      theme: 'striped',
      headStyles: { fillColor: this.primaryColor },
      styles: { fontSize: 9 },
    });

    // Détail par offre
    const tableEndY = (doc as any).lastAutoTable?.finalY || 150;

    offres.forEach((offre, index) => {
      const a = analyse.offres[offre.id];
      if (!a) return;

      if (index > 0) doc.addPage();

      const startY = index === 0 ? tableEndY + 20 : 20;

      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(`DÉTAIL - ${offre.entreprise?.identification?.raisonSociale || 'Offre ' + (index + 1)}`, 20, startY);

      let detailY = startY + 15;

      // Informations entreprise
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`SIRET: ${offre.entreprise?.identification?.siret || 'N/A'}`, 20, detailY);
      detailY += 6;
      doc.text(`Prix HT: ${offre.contenu?.propositionFinanciere?.montantTotalHT?.toLocaleString('fr-FR') || '-'} €`, 20, detailY);
      detailY += 6;
      doc.text(`Prix TTC: ${offre.contenu?.propositionFinanciere?.montantTotalTTC?.toLocaleString('fr-FR') || '-'} €`, 20, detailY);

      // Scores
      detailY += 15;
      doc.setFont('helvetica', 'bold');
      doc.text('Scores:', 20, detailY);
      doc.setFont('helvetica', 'normal');
      detailY += 8;
      doc.text(`- Note technique: ${a.noteTechnique || '-'}/100`, 25, detailY);
      detailY += 6;
      doc.text(`- Note prix: ${a.notePrix || '-'}/100`, 25, detailY);
      detailY += 6;
      doc.text(`- Note globale: ${a.noteGlobale || '-'}/100`, 25, detailY);

      // Conformité
      detailY += 15;
      doc.setFont('helvetica', 'bold');
      doc.text('Conformité:', 20, detailY);
      doc.setFont('helvetica', 'normal');
      detailY += 8;
      doc.text(`- Administrative: ${a.conformite?.administrative ? 'Conforme' : 'Non conforme'}`, 25, detailY);
      detailY += 6;
      doc.text(`- Technique: ${a.conformite?.technique ? 'Conforme' : 'Non conforme'}`, 25, detailY);

      // Alertes
      if (a.alertes && a.alertes.length > 0) {
        detailY += 15;
        doc.setFont('helvetica', 'bold');
        doc.text('Points d\'attention:', 20, detailY);
        doc.setFont('helvetica', 'normal');
        a.alertes.slice(0, 5).forEach((alerte, i) => {
          detailY += 8;
          doc.text(`- ${alerte.message}`, 25, detailY);
        });
      }
    });

    // Recommandation finale
    doc.addPage();
    this.addSectionHeader(doc, 'RECOMMANDATION');

    const sortedOffres = [...offres].sort((a, b) => {
      const scoreA = analyse.offres[a.id]?.noteGlobale || 0;
      const scoreB = analyse.offres[b.id]?.noteGlobale || 0;
      return scoreB - scoreA;
    });

    const bestOffre = sortedOffres[0];
    const bestAnalyse = analyse.offres[bestOffre?.id];

    if (bestOffre && bestAnalyse) {
      let recY = 60;
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');

      const recText = `Sur la base de l'analyse multicritères effectuée, l'offre de l'entreprise "${bestOffre.entreprise?.identification?.raisonSociale}" est recommandée.

Cette offre présente:
- Une note globale de ${bestAnalyse.noteGlobale}/100
- Une note technique de ${bestAnalyse.noteTechnique}/100
- Une note prix de ${bestAnalyse.notePrix}/100
- Un montant de ${bestOffre.contenu?.propositionFinanciere?.montantTotalTTC?.toLocaleString('fr-FR')} € TTC

Cette recommandation est établie conformément aux critères de sélection définis dans le règlement de consultation.`;

      const recLines = doc.splitTextToSize(recText, 170);
      doc.text(recLines, 20, recY);
    }

    return doc.output('blob');
  }

  /**
   * Export contrat en PDF
   */
  async exportContrat(contrat: Contrat): Promise<Blob> {
    const doc = new jsPDF();

    // En-tête
    doc.setFillColor(...this.secondaryColor);
    doc.rect(0, 0, 210, 35, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('MARCHÉ DE TRAVAUX', 105, 22, { align: 'center' });

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');

    let yPos = 50;

    // Référence
    doc.text(`Référence: ${contrat.id?.slice(0, 12) || 'N/A'}`, 20, yPos);
    yPos += 6;
    doc.text(`Date: ${new Date().toLocaleDateString('fr-FR')}`, 20, yPos);

    // Parties
    yPos += 20;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('ENTRE LES SOUSSIGNÉS', 20, yPos);

    yPos += 12;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Le Maître d\'Ouvrage:', 20, yPos);
    doc.setFont('helvetica', 'normal');
    yPos += 6;
    doc.text(contrat.parties?.maitreOuvrage?.nom || 'N/A', 25, yPos);
    yPos += 5;
    doc.text(contrat.parties?.maitreOuvrage?.adresse || '', 25, yPos);

    yPos += 12;
    doc.setFont('helvetica', 'bold');
    doc.text('L\'Entreprise:', 20, yPos);
    doc.setFont('helvetica', 'normal');
    yPos += 6;
    doc.text(contrat.parties?.entreprise?.raisonSociale || 'N/A', 25, yPos);
    yPos += 5;
    doc.text(`SIRET: ${contrat.parties?.entreprise?.siret || 'N/A'}`, 25, yPos);
    yPos += 5;
    doc.text(contrat.parties?.entreprise?.adresse || '', 25, yPos);

    // Article 1 - Objet
    yPos += 20;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('ARTICLE 1 - OBJET DU MARCHÉ', 20, yPos);
    yPos += 8;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');

    const objetText = contrat.objet?.description || 'Exécution de travaux tels que définis dans le CCTP et ses annexes.';
    const objetLines = doc.splitTextToSize(objetText, 170);
    doc.text(objetLines, 20, yPos);
    yPos += objetLines.length * 5 + 10;

    // Article 2 - Prix
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('ARTICLE 2 - PRIX', 20, yPos);
    yPos += 8;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');

    const prix = contrat.conditionsFinancieres?.prixTotal;
    if (prix) {
      doc.text(`Montant HT: ${prix.ht?.toLocaleString('fr-FR') || '-'} €`, 25, yPos);
      yPos += 6;
      doc.text(`TVA (${prix.tauxTVA || 10}%): ${prix.tva?.toLocaleString('fr-FR') || '-'} €`, 25, yPos);
      yPos += 6;
      doc.setFont('helvetica', 'bold');
      doc.text(`Montant TTC: ${prix.ttc?.toLocaleString('fr-FR') || '-'} €`, 25, yPos);
      doc.setFont('helvetica', 'normal');
    }

    // Article 3 - Délais
    yPos += 15;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('ARTICLE 3 - DÉLAIS D\'EXÉCUTION', 20, yPos);
    yPos += 8;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');

    const delais = contrat.delais?.execution;
    if (delais) {
      doc.text(`Durée: ${delais.duree || '-'} jours calendaires`, 25, yPos);
      yPos += 6;
      if (delais.dateDebut) {
        doc.text(`Date de début prévisionnelle: ${new Date(delais.dateDebut).toLocaleDateString('fr-FR')}`, 25, yPos);
      }
    }

    // Article 4 - Pénalités
    yPos += 15;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('ARTICLE 4 - PÉNALITÉS DE RETARD', 20, yPos);
    yPos += 8;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');

    const penalites = contrat.delais?.penalites;
    if (penalites) {
      doc.text(`Montant par jour de retard: ${penalites.montantJour?.toLocaleString('fr-FR') || '-'} €`, 25, yPos);
      yPos += 6;
      doc.text(`Plafond: ${penalites.plafondPourcentage || 10}% du montant du marché`, 25, yPos);
    }

    // Article 5 - Garanties
    yPos += 15;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('ARTICLE 5 - GARANTIES', 20, yPos);
    yPos += 8;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');

    doc.text('Les garanties légales s\'appliquent conformément aux articles 1792 et suivants du Code civil:', 20, yPos);
    yPos += 8;
    doc.text('- Garantie de parfait achèvement: 1 an', 25, yPos);
    yPos += 6;
    doc.text('- Garantie biennale: 2 ans', 25, yPos);
    yPos += 6;
    doc.text('- Garantie décennale: 10 ans', 25, yPos);

    // Page 2 - Signatures
    doc.addPage();

    // Clauses
    yPos = 30;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('ARTICLE 6 - PIÈCES CONTRACTUELLES', 20, yPos);
    yPos += 8;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');

    const pieces = [
      'L\'acte d\'engagement et ses annexes',
      'Le Cahier des Clauses Techniques Particulières (CCTP)',
      'Le bordereau des prix ou DPGF',
      'Les plans et documents graphiques',
      'Le mémoire technique de l\'entreprise',
    ];

    pieces.forEach((piece, i) => {
      doc.text(`${i + 1}. ${piece}`, 25, yPos);
      yPos += 6;
    });

    // Zone signatures
    const signatureY = doc.internal.pageSize.height - 80;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Le Maître d\'Ouvrage', 40, signatureY, { align: 'center' });
    doc.text('L\'Entreprise', 170, signatureY, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.text('Fait à ........................', 40, signatureY + 20, { align: 'center' });
    doc.text('Fait à ........................', 170, signatureY + 20, { align: 'center' });

    doc.text('Le ........................', 40, signatureY + 30, { align: 'center' });
    doc.text('Le ........................', 170, signatureY + 30, { align: 'center' });

    doc.text('Signature:', 40, signatureY + 45, { align: 'center' });
    doc.text('Signature et cachet:', 170, signatureY + 45, { align: 'center' });

    // Cadres signatures
    doc.rect(15, signatureY + 50, 70, 25);
    doc.rect(125, signatureY + 50, 70, 25);

    return doc.output('blob');
  }

  /**
   * Ajoute un en-tête de section
   */
  private addSectionHeader(doc: jsPDF, title: string): void {
    doc.setFillColor(...this.primaryColor);
    doc.rect(0, 0, 210, 30, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(title, 105, 20, { align: 'center' });

    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
  }

  /**
   * Formate le contenu du Règlement de Consultation
   */
  private formatRCContent(rc: any): string {
    if (!rc) {
      return 'Contenu du Règlement de Consultation non disponible.';
    }

    return `
ARTICLE 1 - OBJET DE LA CONSULTATION
${rc.objet?.marche || rc.identification?.objetMarche || 'Non spécifié'}

ARTICLE 2 - CONDITIONS DE LA CONSULTATION
Délai de validité des offres: ${rc.modalites?.delaiValiditeOffres || 90} jours
Mode de passation: ${rc.identification?.typeMarche || 'Marché privé'}

ARTICLE 3 - MODALITÉS DE REMISE DES OFFRES
${rc.modalites?.formatRemise === 'electronique' ? 'Les offres doivent être remises par voie électronique.' : 'Les offres peuvent être remises par voie postale ou électronique.'}
Date limite de réception: À définir par le maître d'ouvrage

ARTICLE 4 - PIÈCES À FOURNIR
Documents administratifs:
${rc.piecesAdministratives?.map((p: any) => `- ${p.nom || p}`).join('\n') || '- À définir'}

Documents techniques:
${rc.piecesTechniques?.map((p: any) => `- ${p.nom || p}`).join('\n') || '- Mémoire technique'}

Documents financiers:
${rc.piecesFinancieres?.map((p: any) => `- ${p.nom || p}`).join('\n') || '- DPGF complété'}

ARTICLE 5 - CRITÈRES D'ATTRIBUTION
${rc.criteres?.map((c: any) => `- ${c.nom || c.libelle}: ${c.ponderation}%`).join('\n') || 'Prix: 50%, Valeur technique: 50%'}

ARTICLE 6 - RENSEIGNEMENTS COMPLÉMENTAIRES
Pour toute question, contacter le maître d'ouvrage aux coordonnées indiquées dans l'avis de consultation.
    `.trim();
  }

  /**
   * Formate le contenu de l'Acte d'Engagement
   */
  private formatAEContent(ae: any): string {
    return `
ACTE D'ENGAGEMENT

Je soussigné(e), représentant l'entreprise désignée ci-après, après avoir pris connaissance du dossier de consultation des entreprises, m'engage à exécuter les prestations définies dans le Cahier des Clauses Techniques Particulières (CCTP).


IDENTIFICATION DE L'ENTREPRISE

Raison sociale: .....................................................

Forme juridique: .....................................................

SIRET: .....................................................

Adresse du siège social: .....................................................

.....................................................

Téléphone: .....................................................

Email: .....................................................


ENGAGEMENT FINANCIER

Je m'engage à réaliser les prestations objet du présent marché aux conditions suivantes:

Montant total HT: ........................... €

TVA (____%): ........................... €

Montant total TTC: ........................... €

(En lettres: ...............................................)


DÉLAI D'EXÉCUTION

Je m'engage à réaliser les travaux dans un délai de ............ jours calendaires à compter de la date de l'ordre de service de démarrage.


DÉCLARATIONS

- J'atteste sur l'honneur ne pas faire l'objet d'une interdiction de soumissionner.
- J'atteste être en règle au regard de mes obligations fiscales et sociales.
- J'atteste disposer des capacités techniques et financières nécessaires.
- J'atteste disposer des assurances requises (responsabilité civile professionnelle et garantie décennale).


Fait à .............................., le ..............................

Signature et cachet de l'entreprise:
    `.trim();
  }

  /**
   * Formate le contenu du Cadre du Mémoire Technique
   */
  private formatMTContent(mt: any): string {
    return `
CADRE DU MÉMOIRE TECHNIQUE

Ce document constitue le cadre à remplir par le candidat. Il doit être complété de manière détaillée et précise.


1. PRÉSENTATION DE L'ENTREPRISE

1.1 Présentation générale
(Historique, activités principales, références similaires...)

.....................................................
.....................................................
.....................................................


1.2 Moyens humains
(Effectifs, organigramme, qualifications du personnel affecté au chantier...)

.....................................................
.....................................................
.....................................................


1.3 Moyens matériels
(Équipements, engins, outillage spécifique...)

.....................................................
.....................................................
.....................................................


2. MÉTHODOLOGIE ET ORGANISATION

2.1 Compréhension du projet
(Reformulation des besoins, analyse des contraintes...)

.....................................................
.....................................................
.....................................................


2.2 Méthodologie d'exécution
(Description des méthodes, phases de réalisation, interfaces...)

.....................................................
.....................................................
.....................................................


2.3 Planning prévisionnel
(Phasage, jalons, chemin critique...)

.....................................................
.....................................................
.....................................................


3. QUALITÉ - SÉCURITÉ - ENVIRONNEMENT

3.1 Démarche qualité
(Procédures, contrôles, points d'arrêt...)

.....................................................
.....................................................


3.2 Mesures de sécurité
(Organisation, prévention des risques...)

.....................................................
.....................................................


3.3 Mesures environnementales
(Gestion des déchets, nuisances...)

.....................................................
.....................................................


4. RÉFÉRENCES

Joindre 3 références de chantiers similaires avec:
- Nom du maître d'ouvrage et coordonnées
- Nature et montant des travaux
- Dates de réalisation
- Attestation de bonne exécution si possible
    `.trim();
  }

  /**
   * Traduit les statuts
   */
  private translateStatus(status: string): string {
    const translations: Record<string, string> = {
      draft: 'Brouillon',
      review: 'En révision',
      ready: 'Prêt',
      sent: 'Envoyé',
      closed: 'Clôturé',
      archived: 'Archivé',
    };
    return translations[status] || status;
  }
}

export const phase1PDFService = new Phase1PDFService();
