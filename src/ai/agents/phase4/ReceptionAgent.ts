/**
 * ReceptionAgent - Agent IA pour la Phase 4 Réception
 * Classification des réserves, génération de PV, analyse de conformité
 */

import OpenAI from 'openai';
import { supabase } from '@/lib/supabase';
import type {
  OPRSession,
  Reserve,
  ReserveGravite,
  Reception,
  ReceptionDecision,
} from '@/types/phase4.types';

// Types spécifiques à l'agent
interface ReserveClassification {
  gravite: ReserveGravite;
  categorie: 'esthetique' | 'fonctionnel' | 'conformite' | 'securite';
  lotConcerne: string;
  delaiRecommande: number;
  justification: string;
  referencesNormatives: string[];
}

interface GeneratedPV {
  contenu: string;
  decision: ReceptionDecision;
  reserves: {
    numero: number;
    description: string;
    gravite: string;
    localisation: string;
    entreprise: string;
    delai: number;
  }[];
  signataires: { nom: string; qualite: string }[];
  dateEffet: string;
  mentions: string[];
}

interface ConformityAnalysis {
  tauxConformite: number;
  pointsBloquants: string[];
  pointsAmelioration: string[];
  recommandations: string[];
  apteReception: boolean;
  decision: ReceptionDecision;
}

export class ReceptionAgent {
  private openai: OpenAI;
  private model: string = 'gpt-4o';

  constructor() {
    this.openai = new OpenAI({
      apiKey: import.meta.env.VITE_OPENAI_API_KEY,
      dangerouslyAllowBrowser: true,
    });
  }

  /**
   * Classification automatique d'une réserve via IA
   */
  async classifyReserve(reserveData: {
    description: string;
    localisation: string;
    lot?: string;
    nature?: string;
    photos?: string[];
  }): Promise<ReserveClassification> {
    const prompt = `Tu es un expert en réception de travaux BTP (construction neuve et rénovation).

Classifie cette réserve selon les critères professionnels du secteur :

Description du défaut : ${reserveData.description}
Localisation : ${reserveData.localisation}
Lot concerné : ${reserveData.lot || 'Non spécifié'}
Nature : ${reserveData.nature || 'Non spécifiée'}

CRITÈRES DE GRAVITÉ (selon pratiques du secteur) :
- mineure : Défaut purement esthétique, n'affecte pas l'usage (rayure légère, teinte légèrement différente, finition à reprendre)
- majeure : Défaut fonctionnel mais usage possible (robinet qui goutte, porte qui frotte, prise mal fixée)
- grave : Usage compromis nécessitant intervention rapide (infiltration légère, équipement non fonctionnel, non-conformité DTU)
- non_conformite_substantielle : Bloquant - empêche la réception (défaut structurel, sécurité compromise, non-conformité réglementaire majeure)

RÉFÉRENCES NORMATIVES À CONSIDÉRER :
- DTU selon le lot concerné
- NF C 15-100 pour l'électricité
- DTU 60.1/60.11 pour la plomberie
- RT/RE 2020 pour la thermique
- Règles de l'art du secteur

Réponds UNIQUEMENT en JSON valide :
{
  "gravite": "mineure|majeure|grave|non_conformite_substantielle",
  "categorie": "esthetique|fonctionnel|conformite|securite",
  "lotConcerne": "code du lot (GO, ELEC, PLOMB, etc.)",
  "delaiRecommande": nombre de jours (30, 60, 90 ou 0 si bloquant),
  "justification": "Explication technique de la classification",
  "referencesNormatives": ["DTU...", "NF..."]
}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.2, // Basse température pour plus de cohérence
      });

      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error('No AI response');

      return JSON.parse(content) as ReserveClassification;
    } catch (error) {
      console.error('[ReceptionAgent] Classification error:', error);
      // Classification par défaut en cas d'erreur
      return {
        gravite: 'majeure',
        categorie: 'fonctionnel',
        lotConcerne: reserveData.lot || 'GENERAL',
        delaiRecommande: 60,
        justification: 'Classification automatique par défaut suite à erreur technique',
        referencesNormatives: [],
      };
    }
  }

  /**
   * Génération du PV d'OPR ou de réception
   */
  async generatePV(
    type: 'opr' | 'reception',
    session: OPRSession,
    reserves: Reserve[],
    decision?: ReceptionDecision
  ): Promise<GeneratedPV> {
    // Préparer le résumé des réserves
    const reservesSummary = reserves.map((r, i) => ({
      numero: r.numero || i + 1,
      description: r.description,
      gravite: r.gravite,
      localisation: r.localisation,
      lot: r.lot,
      entreprise: r.entrepriseNom,
      delai: r.delaiLeveeJours,
    }));

    // Calculer les statistiques
    const stats = {
      total: reserves.length,
      mineures: reserves.filter(r => r.gravite === 'mineure').length,
      majeures: reserves.filter(r => r.gravite === 'majeure').length,
      graves: reserves.filter(r => r.gravite === 'grave').length,
      bloquantes: reserves.filter(r => r.gravite === 'non_conformite_substantielle').length,
    };

    // Déterminer la décision si non fournie
    const actualDecision = decision || this.determineDecision(stats);

    const pvType = type === 'opr'
      ? 'Procès-Verbal d\'Opérations Préalables à la Réception (OPR)'
      : 'Procès-Verbal de Réception des Travaux';

    const prompt = `Tu es un expert juridique en réception de travaux BTP.
Génère un ${pvType} professionnel et juridiquement valide.

DATE : ${new Date(session.dateOPR).toLocaleDateString('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})}
LIEU : ${session.lieu}
PARTICIPANTS : ${session.participants.map(p => `${p.prenom} ${p.nom} (${translateRole(p.role)})`).join(', ')}

STATISTIQUES DES RÉSERVES :
- Total : ${stats.total}
- Mineures : ${stats.mineures}
- Majeures : ${stats.majeures}
- Graves : ${stats.graves}
- Non-conformités substantielles (bloquantes) : ${stats.bloquantes}

RÉSERVES ÉMISES :
${JSON.stringify(reservesSummary, null, 2)}

DÉCISION : ${actualDecision}

Le PV doit contenir :
1. En-tête officiel avec objet, date, lieu
2. Liste des parties convoquées et présentes
3. Rappel de l'objet de la visite
4. Constatations générales
5. Liste numérotée des réserves avec :
   - N° de réserve
   - Localisation
   - Description
   - Lot et entreprise concernés
   - Gravité
   - Délai de levée
6. Décision motivée
7. Conséquences juridiques (${type === 'reception' ? 'démarrage garanties, transfert de garde' : 'suite à donner'})
8. Mentions légales obligatoires
9. Espace pour signatures

Génère le contenu complet du PV en français professionnel.

Réponds en JSON :
{
  "contenu": "TEXTE COMPLET DU PV formaté...",
  "decision": "${actualDecision}",
  "reserves": [...],
  "signataires": [{"nom": "...", "qualite": "..."}],
  "dateEffet": "YYYY-MM-DD",
  "mentions": ["Mention légale 1", "..."]
}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        max_tokens: 4000,
        temperature: 0.3,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error('No AI response');

      return JSON.parse(content) as GeneratedPV;
    } catch (error) {
      console.error('[ReceptionAgent] PV generation error:', error);
      // PV par défaut
      return this.generateDefaultPV(type, session, reserves, actualDecision);
    }
  }

  /**
   * Analyse de conformité globale avant réception
   */
  async analyzeConformity(
    chantierId: string,
    controlResults: {
      checkpoint: string;
      lot: string;
      resultat: 'conforme' | 'non_conforme' | 'reserve' | 'non_verifie';
      commentaire?: string;
      obligatoire: boolean;
    }[]
  ): Promise<ConformityAnalysis> {
    // Statistiques de base
    const total = controlResults.length;
    const verifies = controlResults.filter(c => c.resultat !== 'non_verifie');
    const conformes = controlResults.filter(c => c.resultat === 'conforme');
    const nonConformes = controlResults.filter(c => c.resultat === 'non_conforme');
    const obligatoiresNonConformes = nonConformes.filter(c => c.obligatoire);

    const tauxConformite = verifies.length > 0
      ? Math.round((conformes.length / verifies.length) * 100)
      : 0;

    // Points bloquants
    const pointsBloquants = obligatoiresNonConformes.map(c =>
      `${c.lot} - ${c.checkpoint}${c.commentaire ? ` : ${c.commentaire}` : ''}`
    );

    // Utiliser l'IA pour une analyse approfondie
    const prompt = `Tu es un expert en contrôle qualité BTP.
Analyse ces résultats de contrôle et fournis des recommandations.

Taux de conformité : ${tauxConformite}%
Points vérifiés : ${verifies.length}/${total}
Conformes : ${conformes.length}
Non-conformes : ${nonConformes.length}
Points bloquants : ${pointsBloquants.length}

Détail des non-conformités :
${nonConformes.map(c => `- ${c.lot} : ${c.checkpoint} ${c.commentaire ? `(${c.commentaire})` : ''}`).join('\n')}

Génère un JSON avec :
{
  "pointsAmelioration": ["Liste des points à améliorer (non bloquants)"],
  "recommandations": ["Recommandations pour la suite"],
  "apteReception": true/false,
  "decision": "acceptee_sans_reserve|acceptee_avec_reserves|reportee|refusee"
}

Critères :
- Réception sans réserve si taux >= 98% et aucun bloquant
- Réception avec réserves si taux >= 90% et aucun bloquant
- Report si bloquants corrigeables
- Refus si problèmes structurels ou de sécurité`;

    try {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error('No AI response');

      const aiAnalysis = JSON.parse(content);

      return {
        tauxConformite,
        pointsBloquants,
        pointsAmelioration: aiAnalysis.pointsAmelioration || [],
        recommandations: aiAnalysis.recommandations || [],
        apteReception: aiAnalysis.apteReception ?? pointsBloquants.length === 0,
        decision: aiAnalysis.decision || this.determineDecisionFromTaux(tauxConformite, pointsBloquants.length),
      };
    } catch (error) {
      console.error('[ReceptionAgent] Conformity analysis error:', error);
      return {
        tauxConformite,
        pointsBloquants,
        pointsAmelioration: nonConformes.filter(c => !c.obligatoire).map(c => `${c.lot} - ${c.checkpoint}`),
        recommandations: pointsBloquants.length > 0
          ? ['Corriger les points bloquants avant réception']
          : ['Procéder à la réception'],
        apteReception: pointsBloquants.length === 0 && tauxConformite >= 90,
        decision: this.determineDecisionFromTaux(tauxConformite, pointsBloquants.length),
      };
    }
  }

  /**
   * Suggestion de délai de levée pour une réserve
   */
  suggestDelai(gravite: ReserveGravite, lot: string): number {
    const baseDelais: Record<ReserveGravite, number> = {
      mineure: 30,
      majeure: 60,
      grave: 90,
      non_conformite_substantielle: 0, // Bloquant
    };

    let delai = baseDelais[gravite];

    // Ajustements selon le lot
    const lotsComplexes = ['GO', 'CHARP', 'COUV', 'CVC']; // Lots nécessitant plus de temps
    if (lotsComplexes.includes(lot.toUpperCase()) && delai > 0) {
      delai += 15; // 15 jours supplémentaires pour les lots complexes
    }

    return delai;
  }

  // =====================================================
  // MÉTHODES PRIVÉES
  // =====================================================

  private determineDecision(stats: {
    total: number;
    mineures: number;
    majeures: number;
    graves: number;
    bloquantes: number;
  }): ReceptionDecision {
    if (stats.bloquantes > 0) {
      return 'refusee';
    }
    if (stats.graves > 0) {
      return 'reportee';
    }
    if (stats.total === 0) {
      return 'acceptee_sans_reserve';
    }
    return 'acceptee_avec_reserves';
  }

  private determineDecisionFromTaux(taux: number, bloquants: number): ReceptionDecision {
    if (bloquants > 0) return 'refusee';
    if (taux >= 98) return 'acceptee_sans_reserve';
    if (taux >= 90) return 'acceptee_avec_reserves';
    if (taux >= 70) return 'reportee';
    return 'refusee';
  }

  private generateDefaultPV(
    type: 'opr' | 'reception',
    session: OPRSession,
    reserves: Reserve[],
    decision: ReceptionDecision
  ): GeneratedPV {
    const dateStr = new Date(session.dateOPR).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    const pvTitle = type === 'opr'
      ? 'PROCÈS-VERBAL D\'OPÉRATIONS PRÉALABLES À LA RÉCEPTION'
      : 'PROCÈS-VERBAL DE RÉCEPTION DES TRAVAUX';

    const contenu = `
${pvTitle}

Date : ${dateStr}
Lieu : ${session.lieu}

PARTICIPANTS :
${session.participants.map(p => `- ${p.prenom} ${p.nom} (${translateRole(p.role)})${p.entreprise ? ` - ${p.entreprise}` : ''}`).join('\n')}

OBJET :
Visite de contrôle préalable à la réception des travaux.

CONSTATATIONS :
La visite a permis de constater l'état d'avancement et de qualité des travaux.
${reserves.length} réserve(s) ont été émises.

LISTE DES RÉSERVES :
${reserves.length === 0 ? 'Aucune réserve.' : reserves.map((r, i) => `
${i + 1}. Réserve n°${r.numero || i + 1}
   - Localisation : ${r.localisation}
   - Lot : ${r.lot || 'Non précisé'}
   - Description : ${r.description}
   - Gravité : ${r.gravite}
   - Entreprise : ${r.entrepriseNom}
   - Délai de levée : ${r.delaiLeveeJours} jours
`).join('')}

DÉCISION :
${formatDecision(decision)}

${type === 'reception' ? `
EFFETS JURIDIQUES :
- Transfert de garde : ${decision.includes('acceptee') ? 'OUI - à compter de ce jour' : 'NON'}
- Démarrage des garanties : ${decision.includes('acceptee') ? 'OUI' : 'NON'}
  * Parfait achèvement : 1 an
  * Biennale : 2 ans
  * Décennale : 10 ans
` : ''}

SIGNATURES :

${session.participants.filter(p => ['maitre_ouvrage', 'maitre_oeuvre', 'entreprise'].includes(p.role)).map(p => `
${translateRole(p.role)} : ${p.prenom} ${p.nom}
Signature : ________________________
Date : ____________________________
`).join('')}

---
Document généré le ${new Date().toLocaleDateString('fr-FR')}
    `.trim();

    return {
      contenu,
      decision,
      reserves: reserves.map((r, i) => ({
        numero: r.numero || i + 1,
        description: r.description,
        gravite: r.gravite,
        localisation: r.localisation,
        entreprise: r.entrepriseNom,
        delai: r.delaiLeveeJours,
      })),
      signataires: session.participants
        .filter(p => ['maitre_ouvrage', 'maitre_oeuvre', 'entreprise'].includes(p.role))
        .map(p => ({
          nom: `${p.prenom} ${p.nom}`,
          qualite: translateRole(p.role),
        })),
      dateEffet: session.dateOPR,
      mentions: [
        'Ce document a valeur de procès-verbal.',
        'Les réserves doivent être levées dans les délais indiqués.',
        decision.includes('acceptee') && type === 'reception'
          ? 'La réception entraîne le transfert de garde et le démarrage des garanties légales.'
          : '',
      ].filter(Boolean),
    };
  }
}

// Helpers
function translateRole(role: string): string {
  const translations: Record<string, string> = {
    maitre_ouvrage: 'Maître d\'ouvrage',
    maitre_oeuvre: 'Maître d\'œuvre',
    entreprise: 'Entreprise',
    bureau_controle: 'Bureau de contrôle',
    coordonnateur_sps: 'Coordonnateur SPS',
    expert: 'Expert',
    assureur: 'Assureur',
  };
  return translations[role] || role;
}

function formatDecision(decision: ReceptionDecision): string {
  const descriptions: Record<ReceptionDecision, string> = {
    acceptee_sans_reserve: 'Réception ACCEPTÉE sans réserve. Les travaux sont conformes.',
    acceptee_avec_reserves: 'Réception ACCEPTÉE avec réserves. Les réserves devront être levées dans les délais impartis.',
    reportee: 'Réception REPORTÉE. Des corrections sont nécessaires avant nouvelle visite.',
    refusee: 'Réception REFUSÉE. Des non-conformités majeures empêchent la réception.',
  };
  return descriptions[decision] || decision;
}

export const receptionAgent = new ReceptionAgent();
