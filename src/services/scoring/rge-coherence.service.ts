/**
 * Service de Coherence RGE
 *
 * Verifie la coherence entre les qualifications RGE d'une entreprise
 * et les travaux proposes dans un devis.
 */

import type { RGEEntreprise, RGEQualification } from '@/services/api/rge-ademe.service';

// ============================================
// TYPES
// ============================================

export interface RGECoherenceResult {
  // Score global de coherence (0-100)
  scoreCoherence: number;

  // Travaux detectes dans le devis
  travauxDetectes: TravauxDetecte[];

  // Verification de coherence
  coherences: CoherenceItem[];
  incoherences: IncoherenceItem[];

  // Resume
  resume: {
    travauxCouverts: number;
    travauxNonCouverts: number;
    qualificationsUtilisees: number;
    qualificationsNonUtilisees: number;
  };

  // Alertes specifiques
  alertes: AlerteCoherence[];

  // Recommandations
  recommandations: string[];
}

export interface TravauxDetecte {
  type: string;
  categorie: DomaineRGE;
  keywords: string[];
  lignesDevis: string[];
  montantEstime?: number;
}

export interface CoherenceItem {
  travaux: string;
  qualification: string;
  organisme: string;
  validiteRestante: number; // jours
  score: number; // 0-100
}

export interface IncoherenceItem {
  travaux: string;
  probleme: 'non_couvert' | 'qualification_expiree' | 'domaine_different';
  message: string;
  severite: 'critique' | 'important' | 'mineur';
  qualificationManquante?: string;
}

export interface AlerteCoherence {
  type: 'rge_manquant' | 'rge_expire' | 'domaine_partiel' | 'risque_subvention';
  severite: 'critique' | 'important' | 'info';
  titre: string;
  message: string;
  impact?: string;
}

export type DomaineRGE =
  | 'isolation'
  | 'chauffage'
  | 'ventilation'
  | 'menuiseries'
  | 'photovoltaique'
  | 'pompe_chaleur'
  | 'chauffe_eau_solaire'
  | 'chauffe_eau_thermodynamique'
  | 'biomasse'
  | 'renovation_globale'
  | 'audit_energetique'
  | 'autre';

// ============================================
// MAPPING KEYWORDS -> DOMAINES RGE
// ============================================

const DOMAINE_KEYWORDS: Record<DomaineRGE, string[]> = {
  isolation: [
    'isolation',
    'isolant',
    'laine de verre',
    'laine de roche',
    'ouate de cellulose',
    'polyurethane',
    'polystyrene',
    'ite',
    'iti',
    'combles',
    'toiture',
    'rampants',
    'plancher',
    'mur',
    'facade',
    'sarking',
    'bardage',
    'r =',
    'resistance thermique',
    'coefficient r',
  ],
  chauffage: [
    'chaudiere',
    'chauffage',
    'radiateur',
    'plancher chauffant',
    'convecteur',
    'poele',
    'insert',
    'foyer ferme',
    'bois',
    'granules',
    'pellets',
    'gaz',
    'condensation',
    'basse temperature',
    'regulation',
    'thermostat',
    'programmateur',
  ],
  ventilation: [
    'vmc',
    'ventilation',
    'simple flux',
    'double flux',
    'hygro',
    'autoregable',
    'extracteur',
    'bouche',
    'gaine',
    'caisson',
    'recuperateur',
    'echangeur',
  ],
  menuiseries: [
    'fenetre',
    'porte fenetre',
    'baie vitree',
    'vitrage',
    'double vitrage',
    'triple vitrage',
    'uw',
    'sw',
    'volet',
    'volet roulant',
    'porte entree',
    'chassis',
    'huisserie',
    'dormant',
    'ouvrant',
    'alu',
    'pvc',
    'bois',
  ],
  photovoltaique: [
    'photovoltaique',
    'panneau solaire',
    'module pv',
    'onduleur',
    'micro-onduleur',
    'autoconsommation',
    'injection',
    'kwc',
    'cellule',
    'silicium',
    'monocristallin',
    'polycristallin',
  ],
  pompe_chaleur: [
    'pompe a chaleur',
    'pac',
    'air-eau',
    'air-air',
    'eau-eau',
    'geothermie',
    'aerothermie',
    'cop',
    'scop',
    'unite exterieure',
    'unite interieure',
    'groupe exterieur',
    'split',
    'gainable',
    'multisplit',
  ],
  chauffe_eau_solaire: [
    'chauffe-eau solaire',
    'cesi',
    'ssc',
    'capteur solaire',
    'capteur thermique',
    'ballon solaire',
    'echangeur solaire',
  ],
  chauffe_eau_thermodynamique: [
    'chauffe-eau thermodynamique',
    'cet',
    'ballon thermodynamique',
    'ecs thermodynamique',
  ],
  biomasse: [
    'biomasse',
    'bois energie',
    'chaudiere bois',
    'chaudiere granules',
    'poele granules',
    'buches',
    'plaquettes',
  ],
  renovation_globale: [
    'renovation globale',
    'renovation energetique',
    'bbc renovation',
    'performance energetique',
    'bouquet travaux',
  ],
  audit_energetique: [
    'audit energetique',
    'dpe',
    'diagnostic performance',
    'etude thermique',
    'bilan energetique',
  ],
  autre: [],
};

// Mapping domaines -> meta-domaines RGE ADEME
const DOMAINE_TO_META: Record<DomaineRGE, string[]> = {
  isolation: ["Travaux d'efficacite energetique", "Travaux d'efficacité énergétique"],
  chauffage: ["Travaux d'efficacite energetique", "Travaux d'efficacité énergétique", "Installations d'energies renouvelables", "Installations d'énergies renouvelables"],
  ventilation: ["Travaux d'efficacite energetique", "Travaux d'efficacité énergétique"],
  menuiseries: ["Travaux d'efficacite energetique", "Travaux d'efficacité énergétique"],
  photovoltaique: ["Installations d'energies renouvelables", "Installations d'énergies renouvelables"],
  pompe_chaleur: ["Installations d'energies renouvelables", "Installations d'énergies renouvelables"],
  chauffe_eau_solaire: ["Installations d'energies renouvelables", "Installations d'énergies renouvelables"],
  chauffe_eau_thermodynamique: ["Installations d'energies renouvelables", "Installations d'énergies renouvelables"],
  biomasse: ["Installations d'energies renouvelables", "Installations d'énergies renouvelables"],
  renovation_globale: ['Renovation globale', 'Rénovation globale'],
  audit_energetique: ['Etudes energetiques', 'Études énergétiques'],
  autre: [],
};

// ============================================
// SERVICE
// ============================================

class RGECoherenceService {
  /**
   * Analyse la coherence RGE pour un devis
   */
  analyzeCoherence(
    devisText: string,
    lignesDevis: { description: string; montant?: number }[],
    rgeData: RGEEntreprise | null
  ): RGECoherenceResult {
    // Detecter les travaux dans le devis
    const travauxDetectes = this.detecterTravaux(devisText, lignesDevis);

    // Si pas de RGE, tout est incoherent
    if (!rgeData || !rgeData.estRGE) {
      return this.buildNonRGEResult(travauxDetectes, rgeData);
    }

    // Verifier la coherence de chaque type de travaux
    const coherences: CoherenceItem[] = [];
    const incoherences: IncoherenceItem[] = [];
    const alertes: AlerteCoherence[] = [];
    const recommandations: string[] = [];

    const qualificationsUtilisees = new Set<string>();

    for (const travail of travauxDetectes) {
      const metaDomainesRequis = DOMAINE_TO_META[travail.categorie];

      // Chercher une qualification correspondante
      const qualificationMatch = rgeData.qualificationsActives.find((q) =>
        metaDomainesRequis.some(
          (meta) =>
            q.metaDomaine.toLowerCase().includes(meta.toLowerCase()) ||
            meta.toLowerCase().includes(q.metaDomaine.toLowerCase()) ||
            q.domaine.toLowerCase().includes(travail.type.toLowerCase())
        )
      );

      if (qualificationMatch) {
        qualificationsUtilisees.add(qualificationMatch.codeQualification);

        coherences.push({
          travaux: travail.type,
          qualification: qualificationMatch.nomQualification || qualificationMatch.codeQualification,
          organisme: qualificationMatch.organisme,
          validiteRestante: qualificationMatch.joursRestants,
          score: this.calculateQualificationScore(qualificationMatch),
        });

        // Alerte si expiration proche
        if (qualificationMatch.joursRestants <= 90) {
          alertes.push({
            type: 'rge_expire',
            severite: qualificationMatch.joursRestants <= 30 ? 'critique' : 'important',
            titre: `Qualification RGE bientot expiree`,
            message: `La qualification "${qualificationMatch.nomQualification}" expire dans ${qualificationMatch.joursRestants} jours`,
            impact: 'Risque de non-eligibilite aux aides (MaPrimeRenov, CEE)',
          });
        }
      } else {
        // Travaux non couverts par une qualification RGE
        incoherences.push({
          travaux: travail.type,
          probleme: 'non_couvert',
          message: `Les travaux "${travail.type}" ne sont pas couverts par les qualifications RGE de l'entreprise`,
          severite: this.determinerSeverite(travail.categorie),
          qualificationManquante: metaDomainesRequis[0],
        });

        if (this.isSubventionnable(travail.categorie)) {
          alertes.push({
            type: 'risque_subvention',
            severite: 'critique',
            titre: `Eligibilite aides compromise`,
            message: `Les travaux "${travail.type}" ne pourront pas beneficier des aides (MaPrimeRenov, CEE) car l'entreprise n'est pas RGE pour ce domaine`,
            impact: 'Perte potentielle de plusieurs milliers d\'euros d\'aides',
          });
        }
      }
    }

    // Qualifications non utilisees
    const qualificationsNonUtilisees = rgeData.qualificationsActives.filter(
      (q) => !qualificationsUtilisees.has(q.codeQualification)
    );

    if (qualificationsNonUtilisees.length > 0 && travauxDetectes.length > 0) {
      recommandations.push(
        `L'entreprise possede ${qualificationsNonUtilisees.length} qualification(s) RGE non utilisees dans ce devis. Verifiez si des travaux supplementaires seraient pertinents.`
      );
    }

    // Calculer le score de coherence
    const scoreCoherence = this.calculateScoreCoherence(coherences, incoherences, travauxDetectes);

    // Generer les recommandations
    this.generateRecommandations(recommandations, incoherences, rgeData);

    return {
      scoreCoherence,
      travauxDetectes,
      coherences,
      incoherences,
      resume: {
        travauxCouverts: coherences.length,
        travauxNonCouverts: incoherences.length,
        qualificationsUtilisees: qualificationsUtilisees.size,
        qualificationsNonUtilisees: qualificationsNonUtilisees.length,
      },
      alertes,
      recommandations,
    };
  }

  /**
   * Detecte les types de travaux dans le devis
   */
  private detecterTravaux(
    devisText: string,
    lignesDevis: { description: string; montant?: number }[]
  ): TravauxDetecte[] {
    const travaux: TravauxDetecte[] = [];
    const textLower = devisText.toLowerCase();
    const travauxDetectes = new Set<DomaineRGE>();

    for (const [domaine, keywords] of Object.entries(DOMAINE_KEYWORDS) as [DomaineRGE, string[]][]) {
      if (domaine === 'autre') continue;

      const matchedKeywords: string[] = [];
      const matchedLignes: string[] = [];

      for (const keyword of keywords) {
        if (textLower.includes(keyword.toLowerCase())) {
          matchedKeywords.push(keyword);
        }
      }

      // Chercher dans les lignes de devis
      for (const ligne of lignesDevis) {
        const ligneLower = ligne.description.toLowerCase();
        for (const keyword of keywords) {
          if (ligneLower.includes(keyword.toLowerCase())) {
            if (!matchedLignes.includes(ligne.description)) {
              matchedLignes.push(ligne.description);
            }
          }
        }
      }

      if (matchedKeywords.length >= 2 || matchedLignes.length > 0) {
        if (!travauxDetectes.has(domaine)) {
          travauxDetectes.add(domaine);

          // Calculer montant estime
          let montantEstime = 0;
          for (const ligne of lignesDevis) {
            const ligneLower = ligne.description.toLowerCase();
            for (const keyword of keywords) {
              if (ligneLower.includes(keyword.toLowerCase())) {
                montantEstime += ligne.montant || 0;
                break;
              }
            }
          }

          travaux.push({
            type: this.formatDomaineName(domaine),
            categorie: domaine,
            keywords: matchedKeywords.slice(0, 5),
            lignesDevis: matchedLignes.slice(0, 3),
            montantEstime: montantEstime > 0 ? montantEstime : undefined,
          });
        }
      }
    }

    return travaux;
  }

  /**
   * Construit le resultat pour une entreprise non RGE
   */
  private buildNonRGEResult(
    travauxDetectes: TravauxDetecte[],
    rgeData: RGEEntreprise | null
  ): RGECoherenceResult {
    const incoherences: IncoherenceItem[] = travauxDetectes
      .filter((t) => this.isSubventionnable(t.categorie))
      .map((t) => ({
        travaux: t.type,
        probleme: 'non_couvert' as const,
        message: `Entreprise non RGE : les travaux "${t.type}" ne pourront pas beneficier des aides`,
        severite: 'critique' as const,
      }));

    const alertes: AlerteCoherence[] = [];

    if (travauxDetectes.some((t) => this.isSubventionnable(t.categorie))) {
      alertes.push({
        type: 'rge_manquant',
        severite: 'critique',
        titre: 'Entreprise non qualifiee RGE',
        message: "Cette entreprise n'a aucune qualification RGE active",
        impact: 'Aucune aide (MaPrimeRenov, CEE) ne sera accessible avec ce prestataire',
      });
    }

    return {
      scoreCoherence: 0,
      travauxDetectes,
      coherences: [],
      incoherences,
      resume: {
        travauxCouverts: 0,
        travauxNonCouverts: incoherences.length,
        qualificationsUtilisees: 0,
        qualificationsNonUtilisees: 0,
      },
      alertes,
      recommandations: [
        "Choisissez une entreprise RGE pour beneficier des aides a la renovation energetique",
        "Verifiez le statut RGE sur le site officiel : france-renov.gouv.fr",
      ],
    };
  }

  /**
   * Calcule le score d'une qualification
   */
  private calculateQualificationScore(qualification: RGEQualification): number {
    let score = 50; // Base

    // Bonus validite
    if (qualification.joursRestants > 365) score += 30;
    else if (qualification.joursRestants > 180) score += 20;
    else if (qualification.joursRestants > 90) score += 10;
    else score -= 20; // Malus expiration proche

    // Bonus certificat accessible
    if (qualification.urlCertificat) score += 10;

    // Bonus organisme reconnu
    const organismesPremium = ['qualibat', 'qualitenr', 'qualifelec', 'qualit\'enr'];
    if (organismesPremium.some((o) => qualification.organisme.toLowerCase().includes(o))) {
      score += 10;
    }

    return Math.min(100, Math.max(0, score));
  }

  /**
   * Calcule le score global de coherence
   */
  private calculateScoreCoherence(
    coherences: CoherenceItem[],
    incoherences: IncoherenceItem[],
    travauxDetectes: TravauxDetecte[]
  ): number {
    if (travauxDetectes.length === 0) return 100; // Pas de travaux energetiques

    const total = coherences.length + incoherences.length;
    if (total === 0) return 100;

    // Calcul base
    const tauxCouverture = coherences.length / total;
    let score = tauxCouverture * 100;

    // Bonus qualite des qualifications
    if (coherences.length > 0) {
      const moyenneScoreQual = coherences.reduce((acc, c) => acc + c.score, 0) / coherences.length;
      score = score * 0.7 + moyenneScoreQual * 0.3;
    }

    // Malus incoherences critiques
    const incoherencesCritiques = incoherences.filter((i) => i.severite === 'critique').length;
    score -= incoherencesCritiques * 15;

    return Math.min(100, Math.max(0, Math.round(score)));
  }

  /**
   * Determine la severite d'une incoherence
   */
  private determinerSeverite(domaine: DomaineRGE): 'critique' | 'important' | 'mineur' {
    // Travaux eligibles aux aides = critique
    const domainesCritiques: DomaineRGE[] = [
      'isolation',
      'chauffage',
      'pompe_chaleur',
      'photovoltaique',
      'chauffe_eau_solaire',
      'chauffe_eau_thermodynamique',
      'biomasse',
      'renovation_globale',
    ];

    if (domainesCritiques.includes(domaine)) return 'critique';

    const domainesImportants: DomaineRGE[] = ['ventilation', 'menuiseries'];
    if (domainesImportants.includes(domaine)) return 'important';

    return 'mineur';
  }

  /**
   * Verifie si un domaine est subventionnable
   */
  private isSubventionnable(domaine: DomaineRGE): boolean {
    const domainesSubventionnables: DomaineRGE[] = [
      'isolation',
      'chauffage',
      'ventilation',
      'menuiseries',
      'pompe_chaleur',
      'photovoltaique',
      'chauffe_eau_solaire',
      'chauffe_eau_thermodynamique',
      'biomasse',
      'renovation_globale',
    ];
    return domainesSubventionnables.includes(domaine);
  }

  /**
   * Formate le nom d'un domaine
   */
  private formatDomaineName(domaine: DomaineRGE): string {
    const noms: Record<DomaineRGE, string> = {
      isolation: 'Isolation thermique',
      chauffage: 'Systeme de chauffage',
      ventilation: 'Ventilation',
      menuiseries: 'Menuiseries exterieures',
      photovoltaique: 'Panneaux photovoltaiques',
      pompe_chaleur: 'Pompe a chaleur',
      chauffe_eau_solaire: 'Chauffe-eau solaire',
      chauffe_eau_thermodynamique: 'Chauffe-eau thermodynamique',
      biomasse: 'Chauffage biomasse',
      renovation_globale: 'Renovation globale',
      audit_energetique: 'Audit energetique',
      autre: 'Autres travaux',
    };
    return noms[domaine] || domaine;
  }

  /**
   * Genere les recommandations
   */
  private generateRecommandations(
    recommandations: string[],
    incoherences: IncoherenceItem[],
    rgeData: RGEEntreprise
  ): void {
    // Travaux non couverts
    if (incoherences.length > 0) {
      const travauxNonCouverts = incoherences.map((i) => i.travaux).join(', ');
      recommandations.push(
        `Demandez a l'entreprise de justifier sa capacite a realiser : ${travauxNonCouverts}, ou faites appel a un autre artisan RGE qualifie.`
      );
    }

    // Expiration proche
    if (rgeData.prochaineExpiration && rgeData.prochaineExpiration.joursRestants <= 90) {
      recommandations.push(
        `Verifiez que l'entreprise a bien renouvele sa qualification "${rgeData.prochaineExpiration.qualification}" avant le debut des travaux.`
      );
    }

    // Conseil general
    if (recommandations.length === 0 && rgeData.estRGE) {
      recommandations.push(
        "Demandez une copie du certificat RGE et verifiez sa validite sur france-renov.gouv.fr avant de signer."
      );
    }
  }
}

export const rgeCoherenceService = new RGECoherenceService();
export default rgeCoherenceService;
