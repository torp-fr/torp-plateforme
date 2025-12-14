/**
 * Text Optimizer Service
 * Optimisation IA des textes de présentation entreprise
 */

import { supabase } from '@/lib/supabase';

export type OptimizationType =
  | 'company_description'
  | 'human_resources'
  | 'material_resources'
  | 'methodology'
  | 'quality_commitments';

interface OptimizationPrompt {
  type: OptimizationType;
  systemPrompt: string;
  maxLength?: number;
}

const OPTIMIZATION_PROMPTS: Record<OptimizationType, OptimizationPrompt> = {
  company_description: {
    type: 'company_description',
    systemPrompt: `Tu es un expert en rédaction professionnelle pour le secteur du BTP.
Optimise le texte de présentation d'entreprise fourni pour le rendre plus professionnel, impactant et adapté aux appels d'offres.
Conserve les informations factuelles mais améliore la formulation.
Le texte doit être concis (max 500 mots), professionnel et mettre en valeur les points forts.
Utilise un ton formel mais accessible. Structure le texte en paragraphes clairs.
N'invente pas d'informations, améliore uniquement ce qui est fourni.`,
    maxLength: 2000,
  },
  human_resources: {
    type: 'human_resources',
    systemPrompt: `Tu es un expert RH dans le secteur du BTP.
Optimise la description des moyens humains de l'entreprise.
Met en valeur l'expertise, les qualifications et l'organisation de l'équipe.
Structure les informations de manière claire: effectifs, qualifications clés, organisation.
Conserve les chiffres exacts fournis mais améliore la présentation.`,
    maxLength: 1500,
  },
  material_resources: {
    type: 'material_resources',
    systemPrompt: `Tu es un expert en logistique BTP.
Optimise la description des moyens matériels de l'entreprise.
Met en valeur le parc de matériel, véhicules et équipements.
Structure les informations par catégorie: véhicules, outillage, équipements spécialisés.
Conserve les données exactes mais améliore la présentation.`,
    maxLength: 1500,
  },
  methodology: {
    type: 'methodology',
    systemPrompt: `Tu es un expert en gestion de projet BTP.
Optimise la description de la méthodologie de travail de l'entreprise.
Met en valeur les processus, l'organisation des chantiers et les bonnes pratiques.
Structure autour: préparation, exécution, suivi qualité, coordination.`,
    maxLength: 1500,
  },
  quality_commitments: {
    type: 'quality_commitments',
    systemPrompt: `Tu es un expert en démarche qualité BTP.
Optimise la description des engagements qualité de l'entreprise.
Met en valeur les certifications, labels, et engagements concrets.
Structure autour: certifications, processus qualité, engagements clients.`,
    maxLength: 1500,
  },
};

export interface OptimizationResult {
  originalText: string;
  optimizedText: string;
  improvements: string[];
}

export class TextOptimizerService {
  /**
   * Optimiser un texte avec l'IA
   */
  static async optimizeText(
    text: string,
    type: OptimizationType,
    context?: {
      companyName?: string;
      activity?: string;
      certifications?: string[];
    }
  ): Promise<OptimizationResult> {
    if (!text || text.trim().length < 20) {
      throw new Error('Le texte est trop court pour être optimisé (minimum 20 caractères)');
    }

    const promptConfig = OPTIMIZATION_PROMPTS[type];
    if (!promptConfig) {
      throw new Error('Type d\'optimisation non supporté');
    }

    // Construire le contexte additionnel
    let contextInfo = '';
    if (context) {
      if (context.companyName) contextInfo += `\nEntreprise: ${context.companyName}`;
      if (context.activity) contextInfo += `\nActivité: ${context.activity}`;
      if (context.certifications?.length) {
        contextInfo += `\nCertifications: ${context.certifications.join(', ')}`;
      }
    }

    // Appeler la fonction Edge pour l'optimisation IA
    try {
      const { data, error } = await supabase.functions.invoke('optimize-text', {
        body: {
          text,
          systemPrompt: promptConfig.systemPrompt,
          context: contextInfo,
          maxLength: promptConfig.maxLength,
        },
      });

      if (error) {
        console.error('[TextOptimizer] Edge function error:', error);
        // Fallback: retourner le texte formaté manuellement
        return this.fallbackOptimization(text, type);
      }

      return {
        originalText: text,
        optimizedText: data.optimizedText || text,
        improvements: data.improvements || [],
      };
    } catch (error) {
      console.error('[TextOptimizer] Error:', error);
      return this.fallbackOptimization(text, type);
    }
  }

  /**
   * Fallback d'optimisation basique (sans IA)
   */
  private static fallbackOptimization(text: string, type: OptimizationType): OptimizationResult {
    let optimized = text.trim();

    // Corrections basiques
    const improvements: string[] = [];

    // Capitalisation des phrases
    optimized = optimized.replace(/(^\s*\w|[.!?]\s*\w)/g, (c) => c.toUpperCase());

    // Suppression des espaces multiples
    const hadMultipleSpaces = /\s{2,}/.test(optimized);
    optimized = optimized.replace(/\s{2,}/g, ' ');
    if (hadMultipleSpaces) improvements.push('Espaces multiples supprimés');

    // Ajout de ponctuation finale
    if (!/[.!?]$/.test(optimized)) {
      optimized += '.';
      improvements.push('Ponctuation finale ajoutée');
    }

    // Formatage en paragraphes si texte long
    if (optimized.length > 300 && !optimized.includes('\n\n')) {
      const sentences = optimized.match(/[^.!?]+[.!?]+/g) || [];
      if (sentences.length > 4) {
        const mid = Math.floor(sentences.length / 2);
        optimized = sentences.slice(0, mid).join(' ').trim() + '\n\n' + sentences.slice(mid).join(' ').trim();
        improvements.push('Texte structuré en paragraphes');
      }
    }

    if (improvements.length === 0) {
      improvements.push('Texte déjà bien formaté');
    }

    return {
      originalText: text,
      optimizedText: optimized,
      improvements,
    };
  }

  /**
   * Suggestions de contenu basées sur le type d'activité
   */
  static getSuggestions(type: OptimizationType, activity?: string): string[] {
    const suggestions: Record<OptimizationType, string[]> = {
      company_description: [
        'Historique et création de l\'entreprise',
        'Domaines d\'expertise et spécialités',
        'Zone d\'intervention géographique',
        'Valeurs et engagements de l\'entreprise',
        'Chiffres clés (CA, projets réalisés)',
      ],
      human_resources: [
        'Effectif total et répartition par métier',
        'Qualifications et formations',
        'Organigramme simplifié',
        'Politique de formation continue',
        'Encadrement des équipes terrain',
      ],
      material_resources: [
        'Parc véhicules (type et nombre)',
        'Équipements et outillage',
        'Matériel spécialisé',
        'Locaux et entrepôts',
        'Investissements récents',
      ],
      methodology: [
        'Préparation de chantier',
        'Suivi et coordination',
        'Contrôle qualité',
        'Gestion des délais',
        'Communication avec le client',
      ],
      quality_commitments: [
        'Certifications obtenues (Qualibat, RGE...)',
        'Démarche environnementale',
        'Garanties proposées',
        'Satisfaction client',
        'Sécurité et prévention',
      ],
    };

    return suggestions[type] || [];
  }
}

export default TextOptimizerService;
