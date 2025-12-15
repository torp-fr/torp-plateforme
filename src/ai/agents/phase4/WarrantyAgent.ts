/**
 * WarrantyAgent - Agent IA pour la gestion des garanties Phase 4
 * Vérification éligibilité, analyse jurisprudence, recommandations
 */

import OpenAI from 'openai';
import { supabase } from '@/lib/supabase';
import type { GarantieType, Desordre, Garantie } from '@/types/phase4.types';

// Types spécifiques à l'agent
interface WarrantyEligibility {
  eligible: boolean;
  garantieApplicable: GarantieType | null;
  raison: string;
  delaiRestant: number | null;
  recommandations: string[];
  demarchesRequises: string[];
  jurisprudenceRelevante?: string[];
  montantEstime?: number;
}

interface ClaimAnalysis {
  typeDesordre: string;
  gravitePotentielle: 'faible' | 'moyenne' | 'elevee' | 'critique';
  urgence: boolean;
  expertiseRequise: boolean;
  causesProbables: string[];
  actionsRecommandees: string[];
  precedents?: string[];
}

interface MaintenanceRecommendation {
  equipement: string;
  action: string;
  priorite: 'haute' | 'moyenne' | 'basse';
  delai: string;
  coutEstime?: number;
  justification: string;
}

export class WarrantyAgent {
  private openai: OpenAI;
  private model: string = 'gpt-4o';

  constructor() {
    this.openai = new OpenAI({
      apiKey: import.meta.env.VITE_OPENAI_API_KEY,
    });
  }

  /**
   * Vérification de l'éligibilité garantie pour un désordre
   */
  async checkWarrantyEligibility(
    claim: {
      description: string;
      typeDesordre: string;
      dateDecouverte: string;
      localisation?: string;
      gravite?: string;
    },
    chantierId: string
  ): Promise<WarrantyEligibility> {
    // Récupérer les données de réception et garanties
    const { data: reception } = await supabase
      .from('receptions')
      .select('*')
      .eq('chantier_id', chantierId)
      .single();

    if (!reception) {
      return {
        eligible: false,
        garantieApplicable: null,
        raison: 'Aucune réception trouvée pour ce projet. La réception est le point de départ des garanties.',
        delaiRestant: null,
        recommandations: ['Vérifier que la réception des travaux a bien été prononcée'],
        demarchesRequises: [],
      };
    }

    // Calculer les délais
    const dateDecouverte = new Date(claim.dateDecouverte);
    const dateReception = new Date(reception.date_reception);
    const joursEcoules = Math.floor(
      (dateDecouverte.getTime() - dateReception.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Dates de fin des garanties
    const finPA = reception.date_fin_parfait_achevement
      ? new Date(reception.date_fin_parfait_achevement)
      : null;
    const finBiennale = reception.date_fin_biennale
      ? new Date(reception.date_fin_biennale)
      : null;
    const finDecennale = reception.date_fin_decennale
      ? new Date(reception.date_fin_decennale)
      : null;

    // Analyse IA pour déterminer l'éligibilité
    const prompt = `Tu es un expert juridique en garanties de construction (Code Civil Art. 1792 et suivants).

DÉSORDRE DÉCLARÉ :
- Description : ${claim.description}
- Type : ${claim.typeDesordre}
- Localisation : ${claim.localisation || 'Non précisée'}
- Date de découverte : ${claim.dateDecouverte}
- Jours depuis réception : ${joursEcoules}
- Gravité estimée : ${claim.gravite || 'Non évaluée'}

DATES DES GARANTIES :
- Date de réception : ${reception.date_reception}
- Fin parfait achèvement (1 an) : ${reception.date_fin_parfait_achevement || 'N/A'}
- Fin biennale (2 ans) : ${reception.date_fin_biennale || 'N/A'}
- Fin décennale (10 ans) : ${reception.date_fin_decennale || 'N/A'}

CRITÈRES LÉGAUX DES GARANTIES :

1. PARFAIT ACHÈVEMENT (Art. 1792-6) - 1 AN :
   - Tous défauts signalés lors de la réception ou dans l'année
   - Réparation à la charge de l'entreprise

2. GARANTIE BIENNALE (Art. 1792-3) - 2 ANS :
   - Éléments d'équipement DISSOCIABLES du bâti
   - Ex: robinetterie, volets, radiateurs, portes intérieures, interrupteurs
   - Ne compromet pas la solidité

3. GARANTIE DÉCENNALE (Art. 1792) - 10 ANS :
   - Atteinte à la SOLIDITÉ de l'ouvrage
   - Ou le rend IMPROPRE À SA DESTINATION
   - Ex: fissures structurelles, infiltrations majeures, défauts d'isolation importants

ANALYSE ET DÉTERMINE :
1. Si le désordre est éligible à une garantie
2. Quelle garantie s'applique prioritairement
3. Les démarches légales à suivre
4. La jurisprudence pertinente si connue

Réponds en JSON :
{
  "eligible": true/false,
  "garantieApplicable": "parfait_achevement|biennale|decennale|vices_caches|null",
  "raison": "Explication juridique claire",
  "delaiRestant": nombre de jours ou null,
  "recommandations": ["Conseil 1", "Conseil 2"],
  "demarchesRequises": ["1. Démarche légale", "2. ..."],
  "jurisprudenceRelevante": ["Cass. civ. 3e, date, résumé", ...]
}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.2,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error('No AI response');

      return JSON.parse(content) as WarrantyEligibility;
    } catch (error) {
      console.error('[WarrantyAgent] Eligibility check error:', error);
      // Analyse algorithmique en fallback
      return this.algorithmicEligibilityCheck(claim, reception, joursEcoules, finPA, finBiennale, finDecennale);
    }
  }

  /**
   * Analyse approfondie d'un désordre/sinistre
   */
  async analyzeWarrantyClaim(claim: {
    description: string;
    typeDesordre: string;
    localisation?: string;
    photos?: string[];
    gravite?: string;
  }): Promise<ClaimAnalysis> {
    const prompt = `Tu es un expert en pathologies du bâtiment et sinistres construction.

DÉSORDRE SIGNALÉ :
- Description : ${claim.description}
- Type : ${claim.typeDesordre}
- Localisation : ${claim.localisation || 'Non précisée'}
- Gravité déclarée : ${claim.gravite || 'Non évaluée'}

ANALYSE CE DÉSORDRE ET DÉTERMINE :

1. Classification précise du type de pathologie
2. Gravité potentielle réelle (faible/moyenne/elevee/critique)
3. Caractère d'urgence (risque pour la sécurité ou aggravation rapide)
4. Nécessité d'une expertise technique
5. Causes probables
6. Actions recommandées par ordre de priorité

TYPES DE PATHOLOGIES COURANTS :
- Structurelles : fissures, tassements, déformations
- Étanchéité : infiltrations, remontées capillaires, condensation
- Thermiques : ponts thermiques, défauts d'isolation
- Équipements : dysfonctionnements, pannes, défauts
- Finitions : décollements, fissures légères, défauts esthétiques

Réponds en JSON :
{
  "typeDesordre": "classification précise",
  "gravitePotentielle": "faible|moyenne|elevee|critique",
  "urgence": true/false,
  "expertiseRequise": true/false,
  "causesProbables": ["Cause 1", "Cause 2"],
  "actionsRecommandees": ["1. Action prioritaire", "2. ..."],
  "precedents": ["Cas similaires connus..."]
}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error('No AI response');

      return JSON.parse(content) as ClaimAnalysis;
    } catch (error) {
      console.error('[WarrantyAgent] Claim analysis error:', error);
      return {
        typeDesordre: claim.typeDesordre,
        gravitePotentielle: 'moyenne',
        urgence: false,
        expertiseRequise: true,
        causesProbables: ['Cause à déterminer par expertise'],
        actionsRecommandees: [
          'Documenter le désordre avec photos',
          'Contacter l\'entreprise concernée',
          'Demander une expertise si nécessaire',
          'Déclarer à l\'assurance si garantie applicable',
        ],
      };
    }
  }

  /**
   * Génération de recommandations de maintenance préventive
   */
  async getMaintenanceRecommendations(
    equipements: {
      nom: string;
      categorie: string;
      marque?: string;
      dateInstallation?: string;
      garantieFin?: string;
    }[],
    historiqueEntretiens: {
      equipement: string;
      date: string;
      type: string;
    }[]
  ): Promise<{
    urgents: MaintenanceRecommendation[];
    programmes: MaintenanceRecommendation[];
    estimationCoutsAnnuels: number;
  }> {
    const prompt = `Tu es un expert en maintenance préventive de bâtiments.

ÉQUIPEMENTS INSTALLÉS :
${equipements.map(e => `- ${e.nom} (${e.categorie})${e.marque ? ` - ${e.marque}` : ''}${e.dateInstallation ? ` - Installé: ${e.dateInstallation}` : ''}${e.garantieFin ? ` - Garantie jusqu'au: ${e.garantieFin}` : ''}`).join('\n')}

HISTORIQUE ENTRETIENS RÉCENTS :
${historiqueEntretiens.slice(0, 10).map(h => `- ${h.date}: ${h.type} sur ${h.equipement}`).join('\n') || 'Aucun historique'}

GÉNÈRE DES RECOMMANDATIONS :

1. Actions URGENTES (à faire immédiatement ou dans le mois)
2. Programme d'entretien RÉGULIER avec fréquences
3. Estimation des coûts annuels

PÉRIODICITÉS STANDARDS :
- Chaudière/PAC : contrôle annuel obligatoire
- VMC : nettoyage filtres trimestriel, contrôle annuel
- Cumulus : détartrage tous les 2-3 ans
- Toiture : inspection annuelle
- Menuiseries : graissage gonds annuel, joints tous les 5 ans
- Ramonage : obligatoire annuel ou semestriel

Réponds en JSON :
{
  "urgents": [{"equipement": "...", "action": "...", "priorite": "haute", "delai": "immédiat|1 mois", "coutEstime": 100, "justification": "..."}],
  "programmes": [{"equipement": "...", "action": "...", "priorite": "moyenne|basse", "delai": "annuel|semestriel|...", "coutEstime": 50, "justification": "..."}],
  "estimationCoutsAnnuels": 500
}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.4,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error('No AI response');

      return JSON.parse(content);
    } catch (error) {
      console.error('[WarrantyAgent] Maintenance recommendations error:', error);
      // Recommandations par défaut
      return {
        urgents: [],
        programmes: equipements.map(e => ({
          equipement: e.nom,
          action: 'Contrôle et entretien annuel',
          priorite: 'moyenne' as const,
          delai: 'annuel',
          coutEstime: 100,
          justification: 'Entretien préventif standard',
        })),
        estimationCoutsAnnuels: equipements.length * 100,
      };
    }
  }

  /**
   * Estimation du coût de réparation d'un désordre
   */
  async estimateRepairCost(desordre: {
    type: string;
    description: string;
    localisation: string;
    surface?: number;
  }): Promise<{
    fourchetteBasse: number;
    fourchetteHaute: number;
    facteursPrix: string[];
    recommandationDevis: boolean;
  }> {
    const prompt = `Tu es un économiste de la construction spécialisé en travaux de réparation.

DÉSORDRE À RÉPARER :
- Type : ${desordre.type}
- Description : ${desordre.description}
- Localisation : ${desordre.localisation}
${desordre.surface ? `- Surface concernée : ${desordre.surface} m²` : ''}

Estime le coût de réparation en tenant compte :
- Main d'œuvre
- Matériaux
- Complexité d'accès
- Finitions à reprendre

Prix de référence 2024-2025 en France métropolitaine.

Réponds en JSON :
{
  "fourchetteBasse": montant en euros,
  "fourchetteHaute": montant en euros,
  "facteursPrix": ["Facteur 1", "Facteur 2"],
  "recommandationDevis": true si montant > 1000 ou travaux complexes
}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error('No AI response');

      return JSON.parse(content);
    } catch (error) {
      console.error('[WarrantyAgent] Cost estimation error:', error);
      return {
        fourchetteBasse: 500,
        fourchetteHaute: 2000,
        facteursPrix: ['Estimation à affiner avec devis'],
        recommandationDevis: true,
      };
    }
  }

  // =====================================================
  // MÉTHODES PRIVÉES
  // =====================================================

  private algorithmicEligibilityCheck(
    claim: { description: string; typeDesordre: string },
    reception: Record<string, unknown>,
    joursEcoules: number,
    finPA: Date | null,
    finBiennale: Date | null,
    finDecennale: Date | null
  ): WarrantyEligibility {
    const today = new Date();

    // Mots-clés pour classification
    const decennaleKeywords = [
      'fissure', 'infiltration', 'structure', 'fondation', 'toiture',
      'etancheite', 'effondrement', 'stabilite', 'porteur', 'charpente',
    ];
    const biennaleKeywords = [
      'robinet', 'radiateur', 'volet', 'porte', 'fenetre', 'interrupteur',
      'prise', 'chaudiere', 'ballon', 'cumulus', 'vmc', 'serrure',
    ];

    const descLower = claim.description.toLowerCase();
    const typeLower = claim.typeDesordre.toLowerCase();

    const isDecennale = decennaleKeywords.some(kw => descLower.includes(kw) || typeLower.includes(kw));
    const isBiennale = biennaleKeywords.some(kw => descLower.includes(kw) || typeLower.includes(kw));

    // Vérifier parfait achèvement (1 an)
    if (finPA && today <= finPA) {
      const delaiRestant = Math.ceil((finPA.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return {
        eligible: true,
        garantieApplicable: 'parfait_achevement',
        raison: 'Le désordre a été découvert pendant la période de garantie de parfait achèvement (1 an après réception).',
        delaiRestant,
        recommandations: [
          'Signaler rapidement à l\'entreprise',
          'Envoyer une mise en demeure par LRAR si pas de réponse sous 15 jours',
        ],
        demarchesRequises: [
          'Notifier le désordre à l\'entreprise par LRAR',
          'Délai légal de 60 jours pour intervention',
          'Mise en demeure si inaction',
        ],
      };
    }

    // Vérifier biennale (2 ans) - équipements
    if (finBiennale && today <= finBiennale && isBiennale) {
      const delaiRestant = Math.ceil((finBiennale.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return {
        eligible: true,
        garantieApplicable: 'biennale',
        raison: 'Élément d\'équipement dissociable - La garantie biennale de bon fonctionnement s\'applique.',
        delaiRestant,
        recommandations: [
          'Constater le dysfonctionnement',
          'Contacter le fabricant ou installateur',
        ],
        demarchesRequises: [
          'Notifier l\'entreprise concernée',
          'Demander intervention sous 30 jours',
          'Conserver factures et preuves',
        ],
      };
    }

    // Vérifier décennale (10 ans) - structure
    if (finDecennale && today <= finDecennale && isDecennale) {
      const delaiRestant = Math.ceil((finDecennale.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return {
        eligible: true,
        garantieApplicable: 'decennale',
        raison: 'Désordre pouvant affecter la solidité ou la destination de l\'ouvrage - Garantie décennale applicable.',
        delaiRestant,
        recommandations: [
          'Déclarer rapidement le sinistre à votre assurance dommages-ouvrage',
          'Faire constater par un expert indépendant',
          'Ne pas engager de travaux avant accord assurance',
        ],
        demarchesRequises: [
          'Déclarer le sinistre à votre assurance DO sous 5 jours',
          'Notifier le constructeur par LRAR',
          'Faire établir un constat par expert',
          'Conserver toutes preuves et photos',
        ],
      };
    }

    // Hors garantie
    return {
      eligible: false,
      garantieApplicable: null,
      raison: 'Le délai de garantie applicable semble dépassé, ou le type de désordre ne relève pas des garanties légales.',
      delaiRestant: null,
      recommandations: [
        'Vérifier les dates exactes de réception',
        'Consulter un avocat spécialisé si doute sur les délais',
        'Envisager une action en vices cachés si découverte récente d\'un défaut antérieur',
      ],
      demarchesRequises: [
        'Faire établir un diagnostic par un professionnel',
        'Obtenir des devis de réparation',
      ],
    };
  }
}

export const warrantyAgent = new WarrantyAgent();
