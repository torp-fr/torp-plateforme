/**
 * PhotoAnalysisAgent - Agent IA pour l'analyse de photos de chantier
 * Utilise GPT-4o Vision pour analyser les photos et détecter les anomalies
 * SÉCURISÉ: Utilise les Edge Functions Supabase (pas de clé API côté client)
 */

import { supabase } from '@/lib/supabase';
import { secureAI } from '@/services/ai/secure-ai.service';

// Types
interface PhotoAnalysisResult {
  photoId: string;
  url: string;
  dateAnalyse: Date;
  elementsDetectes: DetectedElement[];
  anomalies: Anomaly[];
  avancementEstime: number;
  conformiteGenerale: 'conforme' | 'attention' | 'non_conforme';
  commentaireIA: string;
  tagsAutomatiques: string[];
  confiance: number;
}

interface DetectedElement {
  type: string;
  description: string;
  zone: string;
  etat: 'bon' | 'acceptable' | 'deteriore' | 'critique';
  confiance: number;
}

interface Anomaly {
  type: 'securite' | 'qualite' | 'avancement' | 'organisation';
  severite: 'faible' | 'moyenne' | 'elevee' | 'critique';
  description: string;
  localisation: string;
  actionRequise: string;
  priorite: number;
}

interface BatchAnalysisResult {
  projetId: string;
  dateAnalyse: Date;
  nombrePhotos: number;
  resultats: PhotoAnalysisResult[];
  syntheseGlobale: {
    avancementMoyen: number;
    anomaliesParType: Record<string, number>;
    pointsAttention: string[];
    recommandations: string[];
  };
}

export class PhotoAnalysisAgent {
  private model: string = 'gpt-4o';

  /**
   * Appel vision sécurisé via Edge Function
   */
  private async callVision(prompt: string, imageUrls: string[]): Promise<string> {
    const content: any[] = [{ type: 'text', text: prompt }];
    imageUrls.forEach(url => {
      content.push({ type: 'image_url', image_url: { url, detail: 'high' } });
    });

    // Utiliser l'Edge Function directement avec le format vision
    const { data, error } = await supabase.functions.invoke('llm-completion', {
      body: {
        messages: [{ role: 'user', content }],
        model: this.model,
        provider: 'openai',
        max_tokens: 2000,
        response_format: { type: 'json_object' },
      },
    });

    if (error) throw new Error(error.message);
    return data?.content || '';
  }

  /**
   * Analyse une photo de chantier
   */
  async analyzePhoto(
    photoUrl: string,
    context: {
      projetId: string;
      lotId?: string;
      zone?: string;
      typeAttendu?: string;
    }
  ): Promise<PhotoAnalysisResult> {
    const prompt = `Tu es un expert en contrôle de chantier BTP. Analyse cette photo de chantier et fournis une évaluation détaillée.

Contexte:
- Zone: ${context.zone || 'Non spécifiée'}
- Type de travaux attendu: ${context.typeAttendu || 'Général'}

Analyse la photo et retourne un JSON avec:
1. "elementsDetectes": liste des éléments visibles avec {type, description, zone, etat, confiance}
   - etat: "bon", "acceptable", "deteriore", "critique"
   - confiance: 0-100
2. "anomalies": liste des problèmes détectés avec {type, severite, description, localisation, actionRequise, priorite}
   - type: "securite", "qualite", "avancement", "organisation"
   - severite: "faible", "moyenne", "elevee", "critique"
   - priorite: 1-5 (1 = le plus urgent)
3. "avancementEstime": estimation du % d'avancement visible (0-100)
4. "conformiteGenerale": "conforme", "attention", "non_conforme"
5. "commentaireIA": synthèse de l'analyse en 2-3 phrases
6. "tagsAutomatiques": liste de tags descriptifs
7. "confiance": niveau de confiance global de l'analyse (0-100)

Sois particulièrement attentif aux:
- Équipements de sécurité (EPI, garde-corps, signalisation)
- Qualité des travaux visibles (alignements, finitions)
- Organisation du chantier (stockage, propreté)
- Conformité aux bonnes pratiques BTP

Réponds uniquement en JSON valide.`;

    try {
      const content = await this.callVision(prompt, [photoUrl]);
      if (!content) throw new Error('No AI response');

      const analysis = JSON.parse(content);

      const result: PhotoAnalysisResult = {
        photoId: crypto.randomUUID(),
        url: photoUrl,
        dateAnalyse: new Date(),
        ...analysis,
      };

      // Sauvegarder l'analyse
      await this.saveAnalysis(context.projetId, result);

      return result;
    } catch (error) {
      console.error('Photo analysis error:', error);
      throw error;
    }
  }

  /**
   * Analyse un lot de photos
   */
  async analyzeBatch(
    photos: Array<{ url: string; zone?: string; lotId?: string }>,
    projetId: string
  ): Promise<BatchAnalysisResult> {
    const resultats: PhotoAnalysisResult[] = [];

    // Analyser chaque photo (avec limitation du parallélisme)
    const batchSize = 3;
    for (let i = 0; i < photos.length; i += batchSize) {
      const batch = photos.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(photo =>
          this.analyzePhoto(photo.url, {
            projetId,
            lotId: photo.lotId,
            zone: photo.zone,
          })
        )
      );
      resultats.push(...batchResults);
    }

    // Générer la synthèse
    const syntheseGlobale = this.generateSynthesis(resultats);

    return {
      projetId,
      dateAnalyse: new Date(),
      nombrePhotos: photos.length,
      resultats,
      syntheseGlobale,
    };
  }

  /**
   * Génère une synthèse des analyses
   */
  private generateSynthesis(resultats: PhotoAnalysisResult[]): BatchAnalysisResult['syntheseGlobale'] {
    // Calcul de l'avancement moyen
    const avancementMoyen =
      resultats.reduce((sum, r) => sum + r.avancementEstime, 0) / resultats.length;

    // Comptage des anomalies par type
    const anomaliesParType: Record<string, number> = {};
    resultats.forEach(r => {
      r.anomalies.forEach(a => {
        anomaliesParType[a.type] = (anomaliesParType[a.type] || 0) + 1;
      });
    });

    // Points d'attention (anomalies critiques ou élevées)
    const pointsAttention: string[] = [];
    resultats.forEach(r => {
      r.anomalies
        .filter(a => a.severite === 'critique' || a.severite === 'elevee')
        .forEach(a => {
          pointsAttention.push(`${a.type}: ${a.description}`);
        });
    });

    // Recommandations basées sur les anomalies
    const recommandations: string[] = [];
    if (anomaliesParType['securite'] > 0) {
      recommandations.push('Renforcer les contrôles de sécurité sur le chantier');
    }
    if (anomaliesParType['qualite'] > 2) {
      recommandations.push('Planifier une revue qualité avec les entreprises concernées');
    }
    if (anomaliesParType['organisation'] > 1) {
      recommandations.push("Améliorer l'organisation et le rangement du chantier");
    }

    return {
      avancementMoyen: Math.round(avancementMoyen),
      anomaliesParType,
      pointsAttention: pointsAttention.slice(0, 5),
      recommandations,
    };
  }

  /**
   * Compare deux photos avant/après
   */
  async comparePhotos(
    photoBefore: string,
    photoAfter: string,
    context: { projetId: string; description?: string }
  ): Promise<{
    progression: number;
    changements: string[];
    qualiteProgression: 'excellente' | 'bonne' | 'moyenne' | 'insuffisante';
    commentaire: string;
  }> {
    const prompt = `Tu es un expert en suivi de chantier BTP. Compare ces deux photos (avant/après) et évalue la progression des travaux.

${context.description ? `Contexte: ${context.description}` : ''}

Analyse les deux images et retourne un JSON avec:
1. "progression": estimation du % de progression entre les deux photos (0-100)
2. "changements": liste des changements observés
3. "qualiteProgression": "excellente", "bonne", "moyenne", "insuffisante"
4. "commentaire": synthèse de la comparaison en 2-3 phrases

Réponds uniquement en JSON valide.`;

    try {
      const content = await this.callVision(prompt, [photoBefore, photoAfter]);
      if (!content) throw new Error('No AI response');

      return JSON.parse(content);
    } catch (error) {
      console.error('Photo comparison error:', error);
      throw error;
    }
  }

  /**
   * Sauvegarde l'analyse en base
   */
  private async saveAnalysis(projetId: string, analysis: PhotoAnalysisResult): Promise<void> {
    await supabase.from('photo_analyses').insert({
      projet_id: projetId,
      photo_url: analysis.url,
      elements_detectes: analysis.elementsDetectes,
      anomalies: analysis.anomalies,
      avancement_estime: analysis.avancementEstime,
      conformite_generale: analysis.conformiteGenerale,
      commentaire_ia: analysis.commentaireIA,
      tags: analysis.tagsAutomatiques,
      confiance: analysis.confiance,
    });
  }
}

export const photoAnalysisAgent = new PhotoAnalysisAgent();
