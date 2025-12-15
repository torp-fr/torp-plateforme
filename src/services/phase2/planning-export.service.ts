/**
 * TORP Phase 2 - Planning Export Service
 * Export du planning en PDF, Excel et MS Project
 */

import { supabase } from '@/lib/supabase';
import { PlanningService } from './planning.service';
import type { PlanningLot, PlanningTache, CheminCritique } from '@/types/phase2';

interface ExportOptions {
  includeStats?: boolean;
  includeCriticalPath?: boolean;
  includeProgress?: boolean;
  title?: string;
  author?: string;
}

interface PlanningExportData {
  chantier: {
    id: string;
    nom: string;
    reference?: string;
  };
  lots: PlanningLot[];
  taches: PlanningTache[];
  stats: {
    nombreLots: number;
    nombreTaches: number;
    avancementGlobal: number;
    tachesEnRetard: number;
    tachesTerminees: number;
    tachesEnCours: number;
  };
  criticalPath: CheminCritique | null;
  generatedAt: string;
}

class PlanningExportService {
  /**
   * Prépare les données du planning pour l'export
   */
  private async prepareExportData(chantierId: string): Promise<PlanningExportData> {
    const [lots, stats, criticalPath, chantier] = await Promise.all([
      PlanningService.getLots(chantierId),
      PlanningService.getStats(chantierId),
      PlanningService.calculerCheminCritique(chantierId).catch(() => null),
      supabase
        .from('phase2_chantiers')
        .select('id, nom, reference')
        .eq('id', chantierId)
        .single()
        .then(res => res.data),
    ]);

    // Récupérer toutes les tâches
    const taches = await PlanningService.getTachesByChantier(chantierId);

    return {
      chantier: chantier || { id: chantierId, nom: 'Chantier' },
      lots,
      taches,
      stats: stats || {
        nombreLots: lots.length,
        nombreTaches: taches.length,
        avancementGlobal: 0,
        tachesEnRetard: 0,
        tachesTerminees: 0,
        tachesEnCours: 0,
      },
      criticalPath,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Export planning en PDF
   * Note: En production, utiliser jsPDF ou une solution serveur
   */
  async exportToPDF(chantierId: string, options: ExportOptions = {}): Promise<Blob> {
    const data = await this.prepareExportData(chantierId);

    // Générer le contenu HTML pour conversion PDF
    const htmlContent = this.generatePDFHtml(data, options);

    // En environnement réel, utiliser jsPDF ou un service de génération PDF
    // Pour l'instant, on retourne le HTML comme texte
    const pdfContent = `
%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj

2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj

3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
>>
endobj

4 0 obj
<<
/Length ${htmlContent.length}
>>
stream
${htmlContent}
endstream
endobj

xref
0 5
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000214 00000 n

trailer
<<
/Size 5
/Root 1 0 R
>>
startxref
${300 + htmlContent.length}
%%EOF
`;

    return new Blob([pdfContent], { type: 'application/pdf' });
  }

  /**
   * Génère le HTML pour le PDF
   */
  private generatePDFHtml(data: PlanningExportData, options: ExportOptions): string {
    const lines: string[] = [];

    lines.push('='.repeat(70));
    lines.push(`PLANNING DE CHANTIER - ${data.chantier.nom}`);
    if (data.chantier.reference) {
      lines.push(`Référence: ${data.chantier.reference}`);
    }
    lines.push('='.repeat(70));
    lines.push(`Généré le: ${new Date(data.generatedAt).toLocaleDateString('fr-FR')}`);
    lines.push('');

    // Stats
    if (options.includeStats !== false) {
      lines.push('--- RÉSUMÉ ---');
      lines.push(`Nombre de lots: ${data.stats.nombreLots}`);
      lines.push(`Nombre de tâches: ${data.stats.nombreTaches}`);
      lines.push(`Avancement global: ${data.stats.avancementGlobal}%`);
      lines.push(`Tâches terminées: ${data.stats.tachesTerminees}`);
      lines.push(`Tâches en cours: ${data.stats.tachesEnCours}`);
      lines.push(`Tâches en retard: ${data.stats.tachesEnRetard}`);
      lines.push('');
    }

    // Chemin critique
    if (options.includeCriticalPath !== false && data.criticalPath) {
      lines.push('--- CHEMIN CRITIQUE ---');
      lines.push(`Durée totale: ${data.criticalPath.dureeTotaleJours} jours`);
      lines.push(`Du ${data.criticalPath.dateDebut} au ${data.criticalPath.dateFin}`);
      lines.push(`Tâches critiques: ${data.criticalPath.tacheIds.length}`);
      lines.push('');
    }

    // Planning détaillé
    lines.push('--- PLANNING DÉTAILLÉ ---');
    lines.push('');

    for (const lot of data.lots) {
      lines.push(`[${lot.code}] ${lot.nom}`);
      lines.push('-'.repeat(50));

      const lotTaches = data.taches.filter(t => t.lotId === lot.id);
      for (const tache of lotTaches) {
        const isCritical = data.criticalPath?.tacheIds.includes(tache.id) ? ' *CRITIQUE*' : '';
        const progress = options.includeProgress !== false ? ` (${tache.avancement}%)` : '';

        lines.push(
          `  ${tache.nom}${progress}${isCritical}`
        );
        lines.push(
          `    Du ${tache.dateDebutPrevue || '-'} au ${tache.dateFinPrevue || '-'} (${tache.dureeJours}j)`
        );
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Export planning en Excel (CSV)
   * Note: En production, utiliser xlsx ou une solution serveur
   */
  async exportToExcel(chantierId: string, options: ExportOptions = {}): Promise<Blob> {
    const data = await this.prepareExportData(chantierId);

    // Générer CSV
    const rows: string[][] = [];

    // En-têtes
    rows.push([
      'Code Lot',
      'Lot',
      'Tâche',
      'Début prévu',
      'Fin prévue',
      'Durée (j)',
      'Avancement (%)',
      'Statut',
      'Critique',
    ]);

    // Données
    for (const lot of data.lots) {
      const lotTaches = data.taches.filter(t => t.lotId === lot.id);

      for (const tache of lotTaches) {
        const isCritical = data.criticalPath?.tacheIds.includes(tache.id) ? 'Oui' : 'Non';

        rows.push([
          lot.code,
          lot.nom,
          tache.nom,
          tache.dateDebutPrevue || '',
          tache.dateFinPrevue || '',
          String(tache.dureeJours || 0),
          String(tache.avancement || 0),
          tache.statut || 'a_planifier',
          isCritical,
        ]);
      }
    }

    // Convertir en CSV
    const csvContent = rows
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
      .join('\n');

    // Ajouter BOM pour Excel
    const bom = '\uFEFF';
    return new Blob([bom + csvContent], {
      type: 'text/csv;charset=utf-8',
    });
  }

  /**
   * Export au format MS Project XML
   */
  async exportToMSProject(chantierId: string, options: ExportOptions = {}): Promise<Blob> {
    const data = await this.prepareExportData(chantierId);

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<Project xmlns="http://schemas.microsoft.com/project">
  <Name>${this.escapeXml(data.chantier.nom)}</Name>
  <Title>${this.escapeXml(options.title || data.chantier.nom)}</Title>
  <Author>${this.escapeXml(options.author || 'TORP')}</Author>
  <CreationDate>${data.generatedAt}</CreationDate>
  <Tasks>`;

    let taskId = 1;

    for (const lot of data.lots) {
      // Ajouter le lot comme tâche récapitulative
      xml += `
    <Task>
      <UID>${taskId}</UID>
      <ID>${taskId}</ID>
      <Name>${this.escapeXml(lot.code + ' - ' + lot.nom)}</Name>
      <OutlineLevel>1</OutlineLevel>
      <Summary>1</Summary>
    </Task>`;

      taskId++;

      // Ajouter les tâches du lot
      const lotTaches = data.taches.filter(t => t.lotId === lot.id);

      for (const tache of lotTaches) {
        const isCritical = data.criticalPath?.tacheIds.includes(tache.id) ? '1' : '0';
        const durationHours = (tache.dureeJours || 1) * 8; // 8 heures par jour

        xml += `
    <Task>
      <UID>${taskId}</UID>
      <ID>${taskId}</ID>
      <Name>${this.escapeXml(tache.nom)}</Name>
      <OutlineLevel>2</OutlineLevel>
      <Summary>0</Summary>
      <Start>${tache.dateDebutPrevue || ''}</Start>
      <Finish>${tache.dateFinPrevue || ''}</Finish>
      <Duration>PT${durationHours}H0M0S</Duration>
      <PercentComplete>${tache.avancement || 0}</PercentComplete>
      <Critical>${isCritical}</Critical>
      <Milestone>${tache.estJalon ? '1' : '0'}</Milestone>
    </Task>`;

        taskId++;
      }
    }

    xml += `
  </Tasks>
  <Resources>
  </Resources>
  <Assignments>
  </Assignments>
</Project>`;

    return new Blob([xml], { type: 'application/xml' });
  }

  /**
   * Export planning en JSON
   */
  async exportToJSON(chantierId: string): Promise<Blob> {
    const data = await this.prepareExportData(chantierId);

    const jsonContent = JSON.stringify(data, null, 2);

    return new Blob([jsonContent], { type: 'application/json' });
  }

  /**
   * Télécharge le fichier exporté
   */
  downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Export et téléchargement direct
   */
  async exportAndDownload(
    chantierId: string,
    format: 'pdf' | 'excel' | 'msproject' | 'json',
    options: ExportOptions = {}
  ): Promise<void> {
    let blob: Blob;
    let filename: string;
    const timestamp = new Date().toISOString().split('T')[0];

    switch (format) {
      case 'pdf':
        blob = await this.exportToPDF(chantierId, options);
        filename = `planning_${timestamp}.pdf`;
        break;
      case 'excel':
        blob = await this.exportToExcel(chantierId, options);
        filename = `planning_${timestamp}.csv`;
        break;
      case 'msproject':
        blob = await this.exportToMSProject(chantierId, options);
        filename = `planning_${timestamp}.xml`;
        break;
      case 'json':
        blob = await this.exportToJSON(chantierId);
        filename = `planning_${timestamp}.json`;
        break;
      default:
        throw new Error(`Format d'export non supporté: ${format}`);
    }

    this.downloadBlob(blob, filename);
  }

  /**
   * Échappe les caractères spéciaux XML
   */
  private escapeXml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}

export const planningExportService = new PlanningExportService();
export { PlanningExportService };
export type { ExportOptions, PlanningExportData };
