/**
 * Générateur de recommandations actionnables
 * Analyse les critères non remplis et génère des recommandations
 */

import type { ExtractedDevisData } from '../ocr/extract-devis';
import type { EnrichedCompanyData } from './enrich-company-data';
import type { ScoringResult, Recommendation, AxisCode } from './scoring-engine';

/**
 * Génère des recommandations basées sur le scoring
 */
export function generateRecommendations(
  scoringResult: Omit<ScoringResult, 'recommandations' | 'pointsBloquants'>,
  extractedData: ExtractedDevisData,
  enrichedData: EnrichedCompanyData
): Recommendation[] {
  const recommendations: Recommendation[] = [];

  // Parcourir tous les axes et critères
  Object.entries(scoringResult.axes).forEach(([axisCode, axisResult]) => {
    axisResult.criteres.forEach((critere) => {
      // Générer une recommandation si le critère n'est pas parfait
      if (critere.statut !== 'ok') {
        const recommendation = generateRecommendationForCritere(
          critere.code,
          critere,
          axisCode as AxisCode,
          extractedData,
          enrichedData
        );

        if (recommendation) {
          recommendations.push(recommendation);
        }
      }
    });
  });

  // Trier par priorité puis par impact
  return recommendations.sort((a, b) => {
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    if (priorityOrder[a.priorite] !== priorityOrder[b.priorite]) {
      return priorityOrder[a.priorite] - priorityOrder[b.priorite];
    }
    return b.impactEstime - a.impactEstime;
  });
}

/**
 * Génère une recommandation pour un critère spécifique
 */
function generateRecommendationForCritere(
  critereCode: string,
  critere: { pointsMax: number; pointsObtenus: number; statut: string },
  axisCode: AxisCode,
  extractedData: ExtractedDevisData,
  enrichedData: EnrichedCompanyData
): Recommendation | null {
  const pointsPerdus = critere.pointsMax - critere.pointsObtenus;

  // Seuil minimum pour créer une recommandation
  if (pointsPerdus < 5) return null;

  // Déterminer la priorité
  const priorite = determinePriorite(pointsPerdus, critere.statut);

  // Générer le contenu de la recommandation
  const content = getRecommendationContent(critereCode, extractedData, enrichedData);

  if (!content) return null;

  return {
    id: `rec_${critereCode.toLowerCase()}`,
    priorite,
    categorie: content.categorie,
    titre: content.titre,
    description: content.description,
    actionnable: content.actionnable,
    action: content.action,
    impactEstime: pointsPerdus,
    axeConcerne: axisCode,
  };
}

/**
 * Détermine la priorité d'une recommandation
 */
function determinePriorite(
  pointsPerdus: number,
  statut: string
): 'critical' | 'high' | 'medium' | 'low' {
  if (statut === 'error' && pointsPerdus >= 40) return 'critical';
  if (statut === 'error' || pointsPerdus >= 30) return 'high';
  if (pointsPerdus >= 15) return 'medium';
  return 'low';
}

/**
 * Retourne le contenu d'une recommandation pour un critère donné
 */
function getRecommendationContent(
  critereCode: string,
  extractedData: ExtractedDevisData,
  enrichedData: EnrichedCompanyData
): {
  categorie: string;
  titre: string;
  description: string;
  actionnable: boolean;
  action?: Recommendation['action'];
} | null {
  const recommendations: Record<string, any> = {
    SIRET_VALIDE: {
      categorie: 'Identification',
      titre: 'Ajouter et vérifier votre SIRET sur le devis',
      description:
        'Le numéro SIRET doit obligatoirement figurer sur tous vos devis. Il permet d\'identifier légalement votre entreprise et rassure vos clients.',
      actionnable: true,
      action: {
        type: 'edit_devis',
        label: 'Comment ajouter le SIRET',
      },
    },

    DECENNALE_MENTIONNEE: {
      categorie: 'Assurances',
      titre: 'Mentionner le numéro d\'assurance décennale',
      description:
        'L\'attestation d\'assurance décennale est OBLIGATOIRE sur les devis BTP. Son absence peut entraîner des sanctions et fait perdre la confiance du client. Ajoutez le numéro de police et le nom de l\'assureur.',
      actionnable: true,
      action: {
        type: 'edit_devis',
        label: 'Voir modèle de mention',
      },
    },

    DECENNALE_VALIDE: {
      categorie: 'Documents',
      titre: 'Mettre à jour votre attestation décennale',
      description:
        'Votre attestation décennale dans le profil TORP est expirée ou va expirer bientôt. Uploadez la nouvelle version pour maintenir votre score et votre crédibilité.',
      actionnable: true,
      action: {
        type: 'add_document',
        label: 'Mettre à jour le document',
        href: '/pro/documents',
      },
    },

    RC_PRO: {
      categorie: 'Assurances',
      titre: 'Mentionner votre RC Professionnelle',
      description:
        'L\'assurance RC Pro, bien que non obligatoire, est fortement recommandée et rassure vos clients. Mentionnez-la sur votre devis si vous en avez une.',
      actionnable: true,
      action: {
        type: 'edit_devis',
        label: 'Comment la mentionner',
      },
    },

    ASSUREUR_IDENTIFIE: {
      categorie: 'Assurances',
      titre: 'Identifier clairement votre assureur',
      description:
        'Mentionnez le nom de votre compagnie d\'assurance décennale (ex: AXA, Allianz, MAAF...) pour plus de transparence.',
      actionnable: true,
      action: {
        type: 'edit_devis',
        label: 'Exemple de mention',
      },
    },

    CGV: {
      categorie: 'Conformité légale',
      titre: 'Ajouter vos Conditions Générales de Vente',
      description:
        'Les CGV sont obligatoires et protègent juridiquement votre entreprise. Elles doivent figurer au verso ou en annexe du devis. Elles définissent vos modalités de paiement, garanties, et responsabilités.',
      actionnable: true,
      action: {
        type: 'info',
        label: 'Télécharger modèle CGV BTP',
      },
    },

    MENTIONS_OBLIGATOIRES: {
      categorie: 'Conformité légale',
      titre: 'Compléter les mentions légales obligatoires',
      description:
        'Votre devis doit contenir : raison sociale, forme juridique, SIRET, adresse du siège social, montant du capital social, numéro RCS. Ces informations sont obligatoires par la loi.',
      actionnable: true,
      action: {
        type: 'edit_devis',
        label: 'Liste complète des mentions',
      },
    },

    DETAIL_LIGNES: {
      categorie: 'Tarification',
      titre: 'Détailler davantage les prestations',
      description:
        'Un devis détaillé ligne par ligne inspire confiance et évite les litiges. Décrivez chaque poste de travail, les quantités, et les prix unitaires. Plus votre devis est précis, plus il est convaincant.',
      actionnable: true,
      action: {
        type: 'edit_devis',
        label: 'Voir exemple de devis détaillé',
      },
    },

    PRIX_UNITAIRES: {
      categorie: 'Tarification',
      titre: 'Préciser les prix unitaires',
      description:
        'Indiquez le prix unitaire pour chaque ligne (ex: 15€/m² au lieu d\'un forfait global). Cela permet au client de comprendre votre tarification et facilite les ajustements.',
      actionnable: true,
      action: {
        type: 'edit_devis',
        label: 'Exemple de présentation',
      },
    },

    CONDITIONS_PAIEMENT: {
      categorie: 'Tarification',
      titre: 'Préciser les conditions de paiement',
      description:
        'Indiquez clairement : acompte à la commande, échéances de paiement, moyens de paiement acceptés. Par exemple : "Acompte de 30% à la commande, solde à réception des travaux".',
      actionnable: true,
      action: {
        type: 'edit_devis',
        label: 'Modèles de conditions',
      },
    },

    VALIDITE: {
      categorie: 'Qualité',
      titre: 'Indiquer la durée de validité du devis',
      description:
        'Mentionnez la durée pendant laquelle votre devis reste valable (généralement 1 à 3 mois). Cela protège votre entreprise des variations de prix et incite le client à se décider.',
      actionnable: true,
      action: {
        type: 'edit_devis',
        label: 'Comment le mentionner',
      },
    },

    OBJET_CLAIR: {
      categorie: 'Qualité',
      titre: 'Définir clairement l\'objet des travaux',
      description:
        'Décrivez précisément la nature du projet en quelques phrases : type de travaux, pièces concernées, objectif. Exemple : "Rénovation complète d\'une salle de bain de 6m² : dépose, plomberie, carrelage, sanitaires".',
      actionnable: true,
      action: {
        type: 'edit_devis',
        label: 'Exemples de descriptions',
      },
    },

    DELAI_EXECUTION: {
      categorie: 'Qualité',
      titre: 'Préciser le délai d\'exécution',
      description:
        'Indiquez la durée prévisionnelle des travaux (ex: "5 jours ouvrés") et éventuellement la date de début. Cela permet au client de s\'organiser.',
      actionnable: true,
      action: {
        type: 'edit_devis',
        label: 'Comment le formuler',
      },
    },

    CERTIFICATIONS_MENTIONNEES: {
      categorie: 'Transparence',
      titre: 'Mettre en avant vos certifications',
      description:
        'Si vous avez des certifications (RGE, Qualibat, Qualifelec...), mentionnez-les sur votre devis ! Elles sont des gages de qualité et peuvent donner droit à des aides pour vos clients.',
      actionnable: true,
      action: {
        type: 'edit_devis',
        label: 'Comment les valoriser',
      },
    },

    GARANTIES: {
      categorie: 'Transparence',
      titre: 'Énoncer clairement les garanties',
      description:
        'Mentionnez les garanties applicables : garantie décennale, biennale, de parfait achèvement. Cela rassure le client sur la qualité de vos prestations.',
      actionnable: true,
      action: {
        type: 'edit_devis',
        label: 'Liste des garanties légales',
      },
    },

    PROFIL_TORP_COMPLET: {
      categorie: 'Profil',
      titre: 'Compléter votre profil TORP',
      description: `Votre profil TORP est à ${enrichedData.completudeProfil}% de complétude. Plus votre profil est complet (documents, certifications), plus votre score sur les devis sera élevé.`,
      actionnable: true,
      action: {
        type: 'complete_profile',
        label: 'Compléter mon profil',
        href: '/pro/settings',
      },
    },

    DROIT_RETRACTATION: {
      categorie: 'Conformité légale',
      titre: 'Mentionner le droit de rétractation',
      description:
        'Si le devis fait suite à un démarchage (à domicile, téléphonique...), vous devez obligatoirement mentionner le droit de rétractation de 14 jours.',
      actionnable: true,
      action: {
        type: 'info',
        label: 'Texte légal à copier',
      },
    },

    MEDIATEUR: {
      categorie: 'Conformité légale',
      titre: 'Indiquer le médiateur de la consommation',
      description:
        'Depuis 2016, vous devez mentionner les coordonnées du médiateur de la consommation dont vous dépendez (ex: CNPM, Médicys...).',
      actionnable: true,
      action: {
        type: 'info',
        label: 'Trouver mon médiateur',
      },
    },

    KBIS_VALIDE: {
      categorie: 'Documents',
      titre: 'Mettre à jour votre Kbis',
      description:
        'Votre Kbis dans le profil TORP est expiré ou manquant. Un Kbis de moins de 3 mois renforce la crédibilité de votre entreprise.',
      actionnable: true,
      action: {
        type: 'add_document',
        label: 'Télécharger un nouveau Kbis',
        href: '/pro/documents',
      },
    },
  };

  return recommendations[critereCode] || null;
}
