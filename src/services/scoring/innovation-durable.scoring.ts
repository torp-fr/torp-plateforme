/**
 * Service de scoring - Axe Innovation & Developpement Durable
 *
 * Analyse le devis et les donnees entreprise pour calculer le score
 * sur les criteres environnementaux et d'innovation.
 */

import type { InnovationDurableScore } from '@/scoring/criteria/innovation-durable.criteria';

export interface ScoringContext {
  // Texte du devis (pour analyse keywords)
  devisText: string;

  // Donnees extraites du devis
  devisExtrait?: {
    prestations?: Array<{
      description: string;
      detail?: string;
    }>;
    typeTravauxPrincipal?: string;
  };

  // Donnees entreprise enrichies
  entreprise?: {
    labelsRGE?: Array<{ nom: string; domaines?: string[] }>;
    labelsQualite?: Array<{ nom: string }>;
    distanceChantierKm?: number;
  };
}

class InnovationDurableScoringService {
  /**
   * Calcule le score Innovation & Developpement Durable
   */
  calculateScore(context: ScoringContext): InnovationDurableScore {
    const { devisText, devisExtrait, entreprise } = context;

    // Normaliser le texte pour la recherche
    const textLower = this.normalizeText(devisText);
    const prestationsText = devisExtrait?.prestations
      ?.map((p) => `${p.description} ${p.detail || ''}`)
      .join(' ')
      .toLowerCase() || '';

    const fullText = `${textLower} ${prestationsText}`;

    // ============================================
    // PERFORMANCE ENVIRONNEMENTALE (30 pts)
    // ============================================

    const envScore = this.scorePerformanceEnvironnementale(fullText, entreprise);

    // ============================================
    // INNOVATION TECHNIQUE (20 pts)
    // ============================================

    const innovScore = this.scoreInnovationTechnique(fullText, entreprise);

    // ============================================
    // CALCUL TOTAL
    // ============================================

    const total = envScore.total + innovScore.total;
    const pourcentage = Math.round((total / 50) * 100);

    // Grade
    let grade: InnovationDurableScore['grade'];
    if (pourcentage >= 80) grade = 'A';
    else if (pourcentage >= 60) grade = 'B';
    else if (pourcentage >= 40) grade = 'C';
    else if (pourcentage >= 20) grade = 'D';
    else grade = 'F';

    // Recommandations
    const recommandations = this.generateRecommandations(envScore, innovScore);

    // Points forts
    const pointsForts = [
      ...envScore.elementsDetectes.slice(0, 3),
      ...innovScore.elementsDetectes.slice(0, 2),
    ];

    return {
      total,
      pourcentage,
      grade,
      sousAxes: {
        performanceEnvironnementale: envScore,
        innovationTechnique: innovScore,
      },
      recommandations,
      pointsForts,
    };
  }

  /**
   * Normalise le texte pour la recherche (minuscules, accents simplifies)
   */
  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, ''); // Supprime les accents
  }

  /**
   * Score Performance Environnementale (30 pts max)
   */
  private scorePerformanceEnvironnementale(
    text: string,
    entreprise?: ScoringContext['entreprise']
  ): InnovationDurableScore['sousAxes']['performanceEnvironnementale'] {
    const elementsDetectes: string[] = [];

    // 1. Materiaux bas carbone (10 pts)
    let materiauxScore = 0;
    const materiauxKeywords = {
      biosource: [
        'laine de bois',
        'fibre de bois',
        'ouate de cellulose',
        'chanvre',
        'lin',
        'liege',
        'paille',
        'biosource',
      ],
      recycle: ['recycle', 'reemploi', 'recuperation', 'seconde vie'],
      labels: ['pefc', 'fsc', 'natureplus', 'ecolabel', 'fdes', 'hqe'],
      beton: ['beton bas carbone', 'cem iii', 'laitier', 'cendres volantes'],
    };

    let materiauxCount = 0;
    Object.entries(materiauxKeywords).forEach(([category, keywords]) => {
      keywords.forEach((kw) => {
        const kwNormalized = this.normalizeText(kw);
        if (text.includes(kwNormalized)) {
          materiauxCount++;
          elementsDetectes.push(`Materiau eco: ${kw}`);
        }
      });
    });

    if (materiauxCount >= 4) materiauxScore = 10;
    else if (materiauxCount >= 3) materiauxScore = 7;
    else if (materiauxCount >= 2) materiauxScore = 5;
    else if (materiauxCount >= 1) materiauxScore = 3;

    // 2. Economies energetiques (10 pts)
    let energieScore = 0;
    const energieSolutions: Record<string, { keywords: string[]; points: number }> = {
      isolation: { keywords: ['isolation', 'ite', 'iti', 'combles perdus', 'toiture', 'plancher bas'], points: 3 },
      menuiseries: { keywords: ['double vitrage', 'triple vitrage', 'uw', 'rupture pont thermique'], points: 2 },
      ventilation: { keywords: ['vmc double flux', 'recuperation chaleur', 'vmc hygro'], points: 2 },
      chauffage: { keywords: ['pompe a chaleur', 'pac', 'chaudiere condensation', 'geothermie'], points: 2 },
      renouvelable: { keywords: ['panneau solaire', 'photovoltaique', 'solaire thermique', 'chauffe-eau solaire'], points: 3 },
      domotique: { keywords: ['thermostat connecte', 'programmation chauffage', 'gestion energie'], points: 1 },
    };

    Object.entries(energieSolutions).forEach(([solution, config]) => {
      const found = config.keywords.some((kw) => text.includes(this.normalizeText(kw)));
      if (found) {
        energieScore = Math.min(10, energieScore + config.points);
        elementsDetectes.push(`Solution energie: ${solution}`);
      }
    });

    // 3. Gestion dechets (5 pts)
    let dechetsScore = 0;
    if (text.includes('tri') && (text.includes('dechet') || text.includes('gravat'))) {
      dechetsScore += 2;
      elementsDetectes.push('Tri des dechets mentionne');
    }
    if (text.includes('valorisation') || text.includes('recyclage')) {
      dechetsScore += 2;
      elementsDetectes.push('Valorisation dechets');
    }
    if (text.includes('evacuation') || text.includes('enlevement')) {
      dechetsScore += 1;
    }
    dechetsScore = Math.min(5, dechetsScore);

    // 4. Circuits courts (5 pts)
    let circuitsScore = 0;
    if (text.includes('local') || text.includes('regional') || text.includes('proximite')) {
      circuitsScore += 2;
      elementsDetectes.push('Approvisionnement local');
    }
    if (
      text.includes('fabrique en france') ||
      text.includes('made in france') ||
      text.includes('origine france') ||
      text.includes('francais')
    ) {
      circuitsScore += 2;
      elementsDetectes.push('Produits francais');
    }
    if (entreprise?.distanceChantierKm && entreprise.distanceChantierKm < 50) {
      circuitsScore += 1;
      elementsDetectes.push('Entreprise locale (<50km)');
    }
    circuitsScore = Math.min(5, circuitsScore);

    return {
      total: materiauxScore + energieScore + dechetsScore + circuitsScore,
      details: {
        materiauxBasCarbone: materiauxScore,
        economiesEnergetiques: energieScore,
        gestionDechets: dechetsScore,
        circuitsCourts: circuitsScore,
      },
      elementsDetectes,
    };
  }

  /**
   * Score Innovation Technique (20 pts max)
   */
  private scoreInnovationTechnique(
    text: string,
    entreprise?: ScoringContext['entreprise']
  ): InnovationDurableScore['sousAxes']['innovationTechnique'] {
    const elementsDetectes: string[] = [];

    // 1. Solutions innovantes (10 pts)
    let solutionsScore = 0;
    const technologies: Record<string, { keywords: string[]; points: number }> = {
      domotique: { keywords: ['domotique', 'smart home', 'connecte', 'knx', 'zigbee', 'maison connectee'], points: 3 },
      performant: { keywords: ['inverter', 'thermodynamique', 'recuperateur', 'ecs thermodynamique'], points: 2 },
      materiaux: { keywords: ['aerogel', 'vip', 'panneau sous vide', 'beton chanvre', 'brique monomur'], points: 2 },
      construction: { keywords: ['prefabrication', 'modulaire', 'ossature bois', 'hors site', 'construction seche'], points: 2 },
      autonomie: { keywords: ['autoconsommation', 'batterie', 'stockage energie', 'autonomie energetique'], points: 2 },
    };

    Object.entries(technologies).forEach(([tech, config]) => {
      const found = config.keywords.some((kw) => text.includes(this.normalizeText(kw)));
      if (found) {
        solutionsScore = Math.min(10, solutionsScore + config.points);
        elementsDetectes.push(`Innovation: ${tech}`);
      }
    });

    // 2. Outils numeriques (5 pts)
    let outilsScore = 0;
    if (text.includes('bim') || text.includes('maquette numerique') || text.includes('building information')) {
      outilsScore += 3;
      elementsDetectes.push('Utilisation BIM');
    }
    if (text.includes('3d') || text.includes('visualisation') || text.includes('visite virtuelle') || text.includes('rendu')) {
      outilsScore += 1;
      elementsDetectes.push('Visualisation 3D');
    }
    if (text.includes('application') || text.includes('suivi digital') || text.includes('planning digital')) {
      outilsScore += 1;
      elementsDetectes.push('Suivi digital');
    }
    outilsScore = Math.min(5, outilsScore);

    // 3. Certifications innovation (5 pts)
    let certifScore = 0;

    // Verifier labels RGE specifiques
    if (entreprise?.labelsRGE && entreprise.labelsRGE.length > 0) {
      certifScore += 2;
      elementsDetectes.push('Certification RGE');
    }

    // Verifier labels qualite/environnement
    const labelsEnv = ['iso 14001', 'eco-artisan', 'eco artisan', 'patrimoine vivant'];
    if (
      entreprise?.labelsQualite?.some((l) =>
        labelsEnv.some((le) => l.nom.toLowerCase().includes(le))
      )
    ) {
      certifScore += 2;
      elementsDetectes.push('Label environnemental entreprise');
    }

    // Mention dans le devis
    if (text.includes('iso 14001') || text.includes('management environnemental')) {
      certifScore += 1;
      elementsDetectes.push('ISO 14001 mentionne');
    }

    // Verifier mentions performance energetique dans le devis
    if (text.includes('performance energetique') || text.includes('efficacite energetique')) {
      certifScore = Math.min(5, certifScore + 1);
    }

    certifScore = Math.min(5, certifScore);

    return {
      total: solutionsScore + outilsScore + certifScore,
      details: {
        solutionsInnovantes: solutionsScore,
        outilsNumeriques: outilsScore,
        certificationsInnovation: certifScore,
      },
      elementsDetectes,
    };
  }

  /**
   * Genere des recommandations basees sur les scores
   */
  private generateRecommandations(
    envScore: InnovationDurableScore['sousAxes']['performanceEnvironnementale'],
    innovScore: InnovationDurableScore['sousAxes']['innovationTechnique']
  ): string[] {
    const recommandations: string[] = [];

    // Recommandations environnementales
    if (envScore.details.materiauxBasCarbone < 5) {
      recommandations.push('Demander des alternatives en materiaux biosources ou bas carbone');
    }
    if (envScore.details.economiesEnergetiques < 5) {
      recommandations.push('Verifier les performances energetiques des equipements proposes');
    }
    if (envScore.details.gestionDechets === 0) {
      recommandations.push('Demander des precisions sur la gestion des dechets de chantier');
    }
    if (envScore.details.circuitsCourts === 0) {
      recommandations.push('Privilegier les materiaux locaux ou francais quand possible');
    }

    // Recommandations innovation
    if (innovScore.details.solutionsInnovantes < 3) {
      recommandations.push('Explorer des solutions techniques plus performantes (PAC, domotique)');
    }
    if (innovScore.details.certificationsInnovation < 2) {
      recommandations.push('Privilegier une entreprise certifiee RGE pour les travaux energetiques');
    }
    if (innovScore.details.outilsNumeriques === 0) {
      recommandations.push('Demander une visualisation 3D ou un suivi de chantier digital');
    }

    return recommandations.slice(0, 4); // Max 4 recommandations
  }
}

export const innovationDurableScoringService = new InnovationDurableScoringService();
export default innovationDurableScoringService;
