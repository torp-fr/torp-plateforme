/**
 * Contextual Scoring Service
 * Analyse les devis en tenant compte du contexte projet et de la Knowledge Base
 */

import { ragService } from '@/services/knowledge-base';
import { projectContextService } from '@/services/project';
import { claudeService } from '@/services/ai';
import type { ProjectContext } from '@/types/ProjectContext';
import type { KBChunk } from '@/services/knowledge-base/types';
import { log, warn, error, time, timeEnd } from '@/lib/logger';

export interface ExtractedQuote {
  id?: string;
  content: string;
  entreprise?: {
    name: string;
    siret?: string;
    rge?: boolean;
  };
  montant?: number;
  travaux?: Array<{
    type: string;
    description: string;
    montant?: number;
  }>;
  dateDevis?: string;
}

export interface RoomScore {
  roomName: string;
  surface: number;
  workTypes: string[];
  score: number;
  maxScore: number;
  pourcentage: number;
  detailsScoring: Record<string, number>;
  conformites: string[];
  nonConformites: string[];
  recommandations: string[];
}

export interface ContextualScoreResult {
  globalScore: number;
  maxScore: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  pourcentage: number;

  // Breakdown par pièce
  roomsScores: RoomScore[];

  // Analyse générale
  pointsForts: string[];
  pointsFaibles: string[];
  recommandations: string[];

  // Références
  kbReferences: Array<{
    type: 'norm' | 'guide' | 'practice';
    title: string;
    relevance: string;
  }>;

  // Métadonnées
  analyzedAt: string;
  contextUsed: {
    projectId?: string;
    projectType: string;
    region?: string;
    workTypes: string[];
    kbChunksUsed: number;
  };
}

export class ContextualScoringService {
  /**
   * Analyser un devis avec contexte complet
   */
  async scoreQuoteWithContext(
    quote: ExtractedQuote,
    projectContextId: string
  ): Promise<ContextualScoreResult> {
    try {
      log(`🎯 Starting contextual scoring for quote: ${quote.id}`);

      // 1. Récupérer le contexte projet
      const projectContext = await projectContextService.getProjectContext(projectContextId);
      if (!projectContext) {
        throw new Error(`Project context not found: ${projectContextId}`);
      }

      // 2. Récupérer le contexte KB pertinent
      const kbContext = await this.retrieveKBContext(projectContext);

      // 3. Appeler Claude avec tout le contexte
      const claudeAnalysis = await this.analyzeWithClaude(
        quote,
        projectContext,
        kbContext
      );

      // 4. Générer le breakdown par pièce
      const roomsScores = this.generateRoomBreakdown(
        claudeAnalysis,
        projectContext,
        kbContext
      );

      // 5. Construire le résultat final
      const result: ContextualScoreResult = {
        globalScore: claudeAnalysis.globalScore,
        maxScore: 1000,
        grade: this.calculateGrade(claudeAnalysis.globalScore),
        pourcentage: (claudeAnalysis.globalScore / 1000) * 100,
        roomsScores,
        pointsForts: claudeAnalysis.pointsForts,
        pointsFaibles: claudeAnalysis.pointsFaibles,
        recommandations: claudeAnalysis.recommandations,
        kbReferences: claudeAnalysis.kbReferences,
        analyzedAt: new Date().toISOString(),
        contextUsed: {
          projectId: projectContextId,
          projectType: projectContext.projectType,
          region: projectContext.region,
          workTypes: projectContext.rooms
            .flatMap(r => r.works.map(w => w.type)),
          kbChunksUsed: kbContext.totalChunksUsed,
        },
      };

      log(`✅ Scoring complete: ${result.grade} (${result.pourcentage.toFixed(1)}%)`);
      return result;
    } catch (error) {
      console.error('❌ Contextual scoring error:', error);
      throw error;
    }
  }

  /**
   * Récupérer le contexte KB pertinent
   */
  private async retrieveKBContext(projectContext: ProjectContext): Promise<{
    workTypeDocs: Record<string, KBChunk[]>;
    regionDocs: KBChunk[];
    projectTypeDocs: KBChunk[];
    totalChunksUsed: number;
  }> {
    try {
      log(`📚 Retrieving KB context for project...`);

      const workTypeDocs: Record<string, KBChunk[]> = {};
      const workTypes = projectContext.rooms.flatMap(r => r.works.map(w => w.type));

      // Récupérer docs pour chaque type de travail
      for (const workType of [...new Set(workTypes)]) {
        const docs = await ragService.searchByWorkType(workType, 5);
        workTypeDocs[workType] = docs;
      }

      // Récupérer docs régionaux
      const regionDocs = projectContext.region
        ? await ragService.searchByRegion(projectContext.region, undefined, 5)
        : [];

      // Récupérer docs pour le type de projet
      const projectTypeDocs = await ragService.retrieveRelevant(
        projectContext.projectType,
        undefined,
        5
      ).then(r => r.chunks);

      const totalChunksUsed = Object.values(workTypeDocs).flat().length
        + regionDocs.length
        + projectTypeDocs.length;

      log(`✅ Retrieved ${totalChunksUsed} KB chunks`);

      return {
        workTypeDocs,
        regionDocs,
        projectTypeDocs,
        totalChunksUsed,
      };
    } catch (error) {
      console.error('⚠️ KB context retrieval error:', error);
      return {
        workTypeDocs: {},
        regionDocs: [],
        projectTypeDocs: [],
        totalChunksUsed: 0,
      };
    }
  }

  /**
   * Analyser avec Claude
   */
  private async analyzeWithClaude(
    quote: ExtractedQuote,
    projectContext: ProjectContext,
    kbContext: any
  ): Promise<any> {
    try {
      // Construire le prompt avec tout le contexte
      const prompt = this.buildClaudePrompt(quote, projectContext, kbContext);

      // Appeler Claude
      const response = await claudeService.callClaude({
        prompt,
        maxTokens: 4000,
        responseFormat: 'json',
      });

      // Parser la réponse
      const analysis = JSON.parse(response);
      return analysis;
    } catch (error) {
      console.error('❌ Claude analysis error:', error);
      // Retourner une analyse par défaut
      return {
        globalScore: 500,
        pointsForts: [],
        pointsFaibles: ['Analyse échouée'],
        recommandations: [],
        kbReferences: [],
        roomsAnalysis: {},
      };
    }
  }

  /**
   * Construire le prompt Claude
   */
  private buildClaudePrompt(
    quote: ExtractedQuote,
    projectContext: ProjectContext,
    kbContext: any
  ): string {
    const workTypeDocsStr = Object.entries(kbContext.workTypeDocs)
      .map(([workType, docs]: [string, KBChunk[]]) => {
        const content = docs
          .map(d => d.content)
          .join('\n---\n');
        return `### ${workType}\n${content}`;
      })
      .join('\n\n');

    const regionDocsStr = kbContext.regionDocs
      .map((d: KBChunk) => d.content)
      .join('\n---\n');

    const projectTypeDocsStr = kbContext.projectTypeDocs
      .map((d: KBChunk) => d.content)
      .join('\n---\n');

    return `# Analyse Contextuelle de Devis - TORP

## CONTEXTE PROJET
Adresse: ${projectContext.address}
Type: ${projectContext.projectType}
Budget: ${projectContext.budget || 'N/A'}€
Surface totale: ${projectContext.squareMetersTotal}m²
Région: ${projectContext.region || 'N/A'}
Urgence: ${projectContext.urgency || 'N/A'}

### Pièces et Travaux
${projectContext.rooms.map(room => `
- **${room.name}** (${room.surface}m²)
  ${room.works.map(w => `  * ${w.type}: ${w.details}`).join('\n  ')}
`).join('\n')}

## DEVIS À ANALYSER
Entreprise: ${quote.entreprise?.name || 'Non spécifiée'}
SIRET: ${quote.entreprise?.siret || 'Non trouvé'}
RGE: ${quote.entreprise?.rge ? 'Oui' : 'Non'}
Montant: ${quote.montant || 'N/A'}€
Date: ${quote.dateDevis || 'N/A'}

Travaux dans le devis:
${quote.travaux?.map(t => `- ${t.type}: ${t.description} (${t.montant || 'N/A'}€)`).join('\n') || 'Non détaillés'}

## DOCUMENTATION MÉTIER PERTINENTE

### Par Type de Travail
${workTypeDocsStr}

### Standards Régionaux
${regionDocsStr}

### Guide Type de Projet
${projectTypeDocsStr}

## TÂCHE D'ANALYSE

Analyser ce devis en tenant compte du contexte projet et de la documentation métier:

1. **Évaluer la conformité** avec les normes et standards (DTU, RE2020, etc.)
2. **Comparer les prix** avec les référentiels régionaux
3. **Vérifier la complétude** (tous les travaux du projet sont-ils inclus?)
4. **Évaluer par pièce** (détails de scoring pour chaque pièce)
5. **Générer des recommandations** spécifiques et contextualisées

Retourner un JSON avec cette structure:
{
  "globalScore": <0-1000>,
  "pointsForts": ["..."],
  "pointsFaibles": ["..."],
  "recommandations": ["..."],
  "kbReferences": [
    {
      "type": "norm|guide|practice",
      "title": "...",
      "relevance": "..."
    }
  ],
  "roomsAnalysis": {
    "roomName": {
      "score": <0-100>,
      "conformites": ["..."],
      "nonConformites": ["..."],
      "recommandations": ["..."]
    }
  }
}`;
  }

  /**
   * Générer le breakdown par pièce
   */
  private generateRoomBreakdown(
    claudeAnalysis: any,
    projectContext: ProjectContext,
    kbContext: any
  ): RoomScore[] {
    const roomsScores: RoomScore[] = [];

    for (const room of projectContext.rooms) {
      const analysis = claudeAnalysis.roomsAnalysis?.[room.name] || {};
      const workTypes = room.works.map(w => w.type);

      const score: RoomScore = {
        roomName: room.name,
        surface: room.surface,
        workTypes,
        score: analysis.score || 50,
        maxScore: 100,
        pourcentage: (analysis.score || 50) / 100 * 100,
        detailsScoring: {
          conformity: analysis.conformity || 50,
          pricing: analysis.pricing || 50,
          completeness: analysis.completeness || 50,
        },
        conformites: analysis.conformites || [],
        nonConformites: analysis.nonConformites || [],
        recommandations: analysis.recommandations || [],
      };

      roomsScores.push(score);
    }

    return roomsScores;
  }

  /**
   * Calculer le grade
   */
  private calculateGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
    if (score >= 850) return 'A';
    if (score >= 700) return 'B';
    if (score >= 550) return 'C';
    if (score >= 400) return 'D';
    return 'F';
  }
}

export const contextualScoringService = new ContextualScoringService();
export default contextualScoringService;
