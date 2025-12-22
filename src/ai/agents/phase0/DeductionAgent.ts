/**
 * DeductionAgent - Agent IA Phase 0
 * Analyse des besoins et déduction automatique des lots de travaux
 * Utilise l'IA pour identifier les travaux nécessaires à partir de la description du projet
 */

import { secureAI } from '@/services/ai/secure-ai.service';

// =============================================================================
// TYPES
// =============================================================================

export interface DeductionInput {
  description: string;
  type_projet: 'renovation' | 'extension' | 'construction' | 'amenagement' | 'entretien';
  type_bien?: 'maison' | 'appartement' | 'immeuble' | 'local_commercial' | 'terrain';
  surface?: number;
  budget_max?: number;
  contraintes?: string[];
  photos?: string[];
  adresse?: string;
}

export interface LotSuggere {
  code: string;
  nom: string;
  description: string;
  budget_estime: number;
  fourchette_basse: number;
  fourchette_haute: number;
  priorite: 'haute' | 'moyenne' | 'basse';
  justification: string;
  dependances: string[];
  duree_estimee_jours: number;
}

export interface DeductionResult {
  lots_suggeres: LotSuggere[];
  contraintes_detectees: string[];
  risques_identifies: {
    risque: string;
    niveau: 'faible' | 'moyen' | 'eleve';
    mitigation: string;
  }[];
  recommandations: string[];
  budget_total_estime: number;
  fourchette_budget: {
    min: number;
    max: number;
  };
  duree_totale_estimee: number;
  score_confiance: number;
  avertissements: string[];
}

export interface PhotoAnalysisResult {
  elements_detectes: string[];
  etat_general: 'bon' | 'moyen' | 'mauvais' | 'a_evaluer';
  pathologies: {
    type: string;
    localisation: string;
    gravite: 'mineure' | 'moyenne' | 'importante';
    action_requise: string;
  }[];
  travaux_suggeres: string[];
  diagnostics_recommandes: string[];
}

// =============================================================================
// AGENT
// =============================================================================

export class DeductionAgent {
  private readonly systemPrompt = `Tu es un expert BTP spécialisé dans l'analyse de projets de rénovation et construction.
Tu dois analyser les besoins du projet et proposer une liste structurée des lots de travaux nécessaires.

CODES LOTS STANDARDS:
- DEMO: Démolition et curage
- GO: Gros œuvre (maçonnerie, béton)
- CHAR: Charpente et couverture
- COUV: Couverture et étanchéité
- ISOL: Isolation thermique et acoustique
- MENU_EXT: Menuiseries extérieures (fenêtres, portes)
- MENU_INT: Menuiseries intérieures
- ELEC: Électricité
- PLOMB: Plomberie et sanitaires
- CVC: Chauffage, ventilation, climatisation
- PLAT: Plâtrerie, cloisons, faux-plafonds
- CARRE: Carrelage et faïence
- PEINT: Peinture et finitions
- SOLS: Revêtements de sols
- CUISI: Cuisine (équipements)
- SDB: Salle de bains (équipements)
- PAYSAG: Aménagements extérieurs
- SECU: Sécurité (alarme, vidéo)
- DOMO: Domotique

RÈGLES:
1. Toujours justifier les lots proposés
2. Indiquer les dépendances entre lots
3. Être réaliste sur les budgets (prix marché français)
4. Identifier les risques potentiels
5. Recommander les diagnostics nécessaires`;

  /**
   * Analyse les besoins et déduit les lots de travaux
   */
  async analyzeNeeds(input: DeductionInput): Promise<DeductionResult> {
    const prompt = `
## PROJET À ANALYSER

**Type de projet:** ${input.type_projet}
**Type de bien:** ${input.type_bien || 'Non spécifié'}
**Surface:** ${input.surface ? `${input.surface} m²` : 'Non spécifiée'}
**Budget maximum:** ${input.budget_max ? `${input.budget_max.toLocaleString('fr-FR')} €` : 'Non spécifié'}
**Description:** ${input.description}
${input.contraintes?.length ? `**Contraintes signalées:** ${input.contraintes.join(', ')}` : ''}
${input.adresse ? `**Adresse:** ${input.adresse}` : ''}

## INSTRUCTIONS

Analyse ce projet et fournis:
1. La liste des lots de travaux nécessaires avec codes, budgets et priorités
2. Les contraintes techniques détectées
3. Les risques potentiels et leurs mitigations
4. Des recommandations générales
5. Un budget total estimé avec fourchette

Réponds UNIQUEMENT en JSON valide avec cette structure:
{
  "lots_suggeres": [
    {
      "code": "string",
      "nom": "string",
      "description": "string",
      "budget_estime": number,
      "fourchette_basse": number,
      "fourchette_haute": number,
      "priorite": "haute" | "moyenne" | "basse",
      "justification": "string",
      "dependances": ["string"],
      "duree_estimee_jours": number
    }
  ],
  "contraintes_detectees": ["string"],
  "risques_identifies": [
    {
      "risque": "string",
      "niveau": "faible" | "moyen" | "eleve",
      "mitigation": "string"
    }
  ],
  "recommandations": ["string"],
  "budget_total_estime": number,
  "fourchette_budget": { "min": number, "max": number },
  "duree_totale_estimee": number,
  "score_confiance": number (0-100),
  "avertissements": ["string"]
}`;

    try {
      const response = await secureAI.complete({
        messages: [{ role: 'user', content: prompt }],
        model: 'gpt-4o',
        provider: 'openai',
        temperature: 0.3,
        max_tokens: 4000,
        system: this.systemPrompt,
        response_format: { type: 'json_object' },
      });

      const result = JSON.parse(response);
      return this.validateResult(result);
    } catch (error) {
      console.error('DeductionAgent.analyzeNeeds error:', error);
      return this.getFallbackResult(input);
    }
  }

  /**
   * Analyse des photos du bien
   */
  async analyzePhotos(photos: string[]): Promise<PhotoAnalysisResult> {
    if (!photos.length) {
      return {
        elements_detectes: [],
        etat_general: 'a_evaluer',
        pathologies: [],
        travaux_suggeres: [],
        diagnostics_recommandes: ['Visite technique recommandée'],
      };
    }

    const prompt = `Analyse ces photos de bâtiment pour un projet de rénovation.

Pour chaque photo, identifie:
1. Les éléments visibles (murs, sols, plafonds, menuiseries, équipements)
2. L'état général apparent
3. Les pathologies éventuelles (fissures, humidité, vétusté)
4. Les travaux qui semblent nécessaires
5. Les diagnostics recommandés

Réponds en JSON:
{
  "elements_detectes": ["string"],
  "etat_general": "bon" | "moyen" | "mauvais" | "a_evaluer",
  "pathologies": [
    {
      "type": "string",
      "localisation": "string",
      "gravite": "mineure" | "moyenne" | "importante",
      "action_requise": "string"
    }
  ],
  "travaux_suggeres": ["string"],
  "diagnostics_recommandes": ["string"]
}`;

    try {
      // Note: Vision API via secureAI (à adapter selon l'implémentation)
      const response = await secureAI.complete({
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              ...photos.map(url => ({ type: 'image_url' as const, image_url: { url } })),
            ],
          },
        ],
        model: 'gpt-4o',
        provider: 'openai',
        temperature: 0.3,
        max_tokens: 2000,
        response_format: { type: 'json_object' },
      });

      return JSON.parse(response);
    } catch (error) {
      console.error('DeductionAgent.analyzePhotos error:', error);
      return {
        elements_detectes: [],
        etat_general: 'a_evaluer',
        pathologies: [],
        travaux_suggeres: [],
        diagnostics_recommandes: ['Analyse photo non disponible - visite recommandée'],
      };
    }
  }

  /**
   * Suggestion rapide de lots basée sur le type de projet
   */
  async quickSuggestion(typeProjet: string, budget?: number): Promise<string[]> {
    const commonLots: Record<string, string[]> = {
      renovation: ['DEMO', 'ELEC', 'PLOMB', 'PLAT', 'PEINT', 'SOLS'],
      extension: ['GO', 'CHAR', 'COUV', 'ISOL', 'MENU_EXT', 'ELEC', 'PLOMB', 'CVC', 'PLAT', 'PEINT'],
      construction: ['GO', 'CHAR', 'COUV', 'ISOL', 'MENU_EXT', 'MENU_INT', 'ELEC', 'PLOMB', 'CVC', 'PLAT', 'PEINT', 'SOLS'],
      amenagement: ['PLAT', 'ELEC', 'PEINT', 'SOLS', 'MENU_INT'],
      entretien: ['PEINT', 'SOLS'],
    };

    return commonLots[typeProjet] || commonLots.renovation;
  }

  /**
   * Valide et complète le résultat
   */
  private validateResult(result: any): DeductionResult {
    return {
      lots_suggeres: result.lots_suggeres || [],
      contraintes_detectees: result.contraintes_detectees || [],
      risques_identifies: result.risques_identifies || [],
      recommandations: result.recommandations || [],
      budget_total_estime: result.budget_total_estime || 0,
      fourchette_budget: result.fourchette_budget || { min: 0, max: 0 },
      duree_totale_estimee: result.duree_totale_estimee || 0,
      score_confiance: result.score_confiance || 50,
      avertissements: result.avertissements || [],
    };
  }

  /**
   * Résultat de fallback en cas d'erreur
   */
  private getFallbackResult(input: DeductionInput): DeductionResult {
    const baseLots = this.quickSuggestion(input.type_projet);

    return {
      lots_suggeres: baseLots.slice(0, 5).map((code, i) => ({
        code,
        nom: this.getLotName(code),
        description: `Travaux de ${this.getLotName(code).toLowerCase()}`,
        budget_estime: 5000,
        fourchette_basse: 3000,
        fourchette_haute: 10000,
        priorite: i < 2 ? 'haute' as const : 'moyenne' as const,
        justification: 'Suggestion basée sur le type de projet',
        dependances: [],
        duree_estimee_jours: 5,
      })),
      contraintes_detectees: ['Analyse automatique non disponible'],
      risques_identifies: [],
      recommandations: [
        'Consulter un professionnel pour affiner l\'analyse',
        'Prévoir une visite technique du bien',
      ],
      budget_total_estime: 25000,
      fourchette_budget: { min: 15000, max: 50000 },
      duree_totale_estimee: 30,
      score_confiance: 30,
      avertissements: ['Estimation approximative - analyse IA non disponible'],
    };
  }

  private getLotName(code: string): string {
    const names: Record<string, string> = {
      DEMO: 'Démolition',
      GO: 'Gros œuvre',
      CHAR: 'Charpente',
      COUV: 'Couverture',
      ISOL: 'Isolation',
      MENU_EXT: 'Menuiseries extérieures',
      MENU_INT: 'Menuiseries intérieures',
      ELEC: 'Électricité',
      PLOMB: 'Plomberie',
      CVC: 'Chauffage/Ventilation',
      PLAT: 'Plâtrerie',
      PEINT: 'Peinture',
      SOLS: 'Sols',
      CARRE: 'Carrelage',
    };
    return names[code] || code;
  }
}

export const deductionAgent = new DeductionAgent();
export default DeductionAgent;
