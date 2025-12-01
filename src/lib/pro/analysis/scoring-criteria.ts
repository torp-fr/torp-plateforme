/**
 * Grille de critères de scoring TORP B2B
 * 6 axes, 1000 points total
 */

import type { AxisDefinition } from './scoring-engine';

// ===== AXE 1 : FIABILITÉ ENTREPRISE (250 pts) =====

export const FIABILITE_AXIS: AxisDefinition = {
  code: 'fiabilite',
  label: 'Fiabilité entreprise',
  maxPoints: 250,
  criteres: [
    {
      code: 'SIRET_VALIDE',
      label: 'SIRET valide et vérifié',
      points: 60,
      bloquant: true,
      evaluate: (data, enriched) => {
        if (!data.entreprise.siret) {
          return { score: 0, status: 'missing', detail: 'SIRET non mentionné dans le devis' };
        }
        if (!enriched.profil.siretVerifie) {
          return { score: 30, status: 'warning', detail: 'SIRET présent mais non vérifié' };
        }
        return { score: 60, status: 'ok' };
      },
    },
    {
      code: 'ANCIENNETE',
      label: 'Ancienneté de l\'entreprise',
      points: 50,
      evaluate: (data, enriched) => {
        const annees = enriched.profil.ancienneteAnnees;
        if (annees >= 10) return { score: 50, status: 'ok', detail: `${annees} ans d'activité` };
        if (annees >= 5) return { score: 40, status: 'ok', detail: `${annees} ans d'activité` };
        if (annees >= 2) return { score: 25, status: 'warning', detail: `${annees} ans d'activité` };
        return { score: 10, status: 'warning', detail: `Entreprise récente (${annees} an(s))` };
      },
    },
    {
      code: 'FORME_JURIDIQUE',
      label: 'Forme juridique mentionnée',
      points: 30,
      evaluate: (data, enriched) => {
        if (data.entreprise.formeJuridique) {
          return { score: 30, status: 'ok', detail: data.entreprise.formeJuridique };
        }
        if (enriched.profil.formeJuridique && enriched.profil.formeJuridique !== 'Non renseignée') {
          return { score: 15, status: 'warning', detail: 'Présente dans profil mais absente du devis' };
        }
        return { score: 0, status: 'missing', detail: 'Forme juridique non mentionnée' };
      },
    },
    {
      code: 'COORDONNEES_COMPLETES',
      label: 'Coordonnées complètes',
      points: 40,
      evaluate: (data, enriched) => {
        let score = 0;
        const details = [];
        if (data.entreprise.adresse) {
          score += 15;
        } else {
          details.push('adresse manquante');
        }
        if (data.entreprise.telephone) {
          score += 10;
        } else {
          details.push('téléphone manquant');
        }
        if (data.entreprise.email) {
          score += 15;
        } else {
          details.push('email manquant');
        }
        return {
          score,
          status: score >= 30 ? 'ok' : score >= 15 ? 'warning' : 'error',
          detail: details.length ? details.join(', ') : undefined,
        };
      },
    },
    {
      code: 'RCS_TVA',
      label: 'RCS et TVA intracommunautaire',
      points: 30,
      evaluate: (data, enriched) => {
        let score = 0;
        const details = [];
        if (data.entreprise.rcs) {
          score += 15;
          details.push('RCS OK');
        }
        if (data.entreprise.tvaIntra) {
          score += 15;
          details.push('TVA intra OK');
        }
        return {
          score,
          status: score === 30 ? 'ok' : score >= 15 ? 'warning' : 'missing',
          detail: details.length ? details.join(', ') : 'RCS et TVA manquants',
        };
      },
    },
    {
      code: 'KBIS_VALIDE',
      label: 'Kbis à jour dans le profil TORP',
      points: 40,
      evaluate: (data, enriched) => {
        const kbis = enriched.documents.kbis;
        if (kbis.present && kbis.valide) {
          return { score: 40, status: 'ok' };
        }
        if (kbis.present && !kbis.valide) {
          return { score: 10, status: 'warning', detail: 'Kbis expiré' };
        }
        return { score: 0, status: 'missing', detail: 'Kbis non fourni dans le profil TORP' };
      },
    },
  ],
};

// ===== AXE 2 : ASSURANCES (200 pts) =====

export const ASSURANCES_AXIS: AxisDefinition = {
  code: 'assurances',
  label: 'Assurances',
  maxPoints: 200,
  criteres: [
    {
      code: 'DECENNALE_MENTIONNEE',
      label: 'Assurance décennale mentionnée',
      points: 80,
      bloquant: true,
      evaluate: (data, enriched) => {
        if (data.assurances.decennale?.numero) {
          return { score: 80, status: 'ok', detail: `N°${data.assurances.decennale.numero}` };
        }
        if (enriched.documents.decennale.present) {
          return {
            score: 40,
            status: 'warning',
            detail: 'Présente dans profil TORP mais non mentionnée dans le devis',
          };
        }
        return { score: 0, status: 'error', detail: 'Décennale non mentionnée - OBLIGATOIRE' };
      },
    },
    {
      code: 'DECENNALE_VALIDE',
      label: 'Décennale vérifiée et à jour',
      points: 50,
      evaluate: (data, enriched) => {
        const dec = enriched.documents.decennale;
        if (dec.present && dec.valide) {
          return { score: 50, status: 'ok' };
        }
        if (dec.present && !dec.valide) {
          return { score: 10, status: 'error', detail: 'Décennale expirée !' };
        }
        return { score: 0, status: 'missing' };
      },
    },
    {
      code: 'RC_PRO',
      label: 'Responsabilité Civile Professionnelle',
      points: 40,
      evaluate: (data, enriched) => {
        if (data.assurances.rcPro?.numero) {
          return { score: 40, status: 'ok', detail: `N°${data.assurances.rcPro.numero}` };
        }
        if (enriched.documents.rcPro.present && enriched.documents.rcPro.valide) {
          return { score: 25, status: 'warning', detail: 'Non mentionnée dans le devis' };
        }
        return { score: 0, status: 'missing', detail: 'RC Pro non mentionnée' };
      },
    },
    {
      code: 'ASSUREUR_IDENTIFIE',
      label: 'Assureur clairement identifié',
      points: 30,
      evaluate: (data, enriched) => {
        if (data.assurances.decennale?.assureur) {
          return { score: 30, status: 'ok', detail: data.assurances.decennale.assureur };
        }
        if (enriched.documents.decennale.assureur) {
          return { score: 15, status: 'warning', detail: 'Présent dans profil TORP' };
        }
        return { score: 0, status: 'missing' };
      },
    },
  ],
};

// ===== AXE 3 : JUSTESSE TARIFAIRE (200 pts) =====

export const TARIFS_AXIS: AxisDefinition = {
  code: 'tarifs',
  label: 'Justesse tarifaire',
  maxPoints: 200,
  criteres: [
    {
      code: 'MONTANTS_PRESENTS',
      label: 'Montants HT et TTC présents',
      points: 50,
      evaluate: (data, enriched) => {
        let score = 0;
        if (data.financier.montantHT) score += 25;
        if (data.financier.montantTTC) score += 25;
        return { score, status: score === 50 ? 'ok' : 'warning' };
      },
    },
    {
      code: 'TVA_CORRECTE',
      label: 'TVA correctement calculée',
      points: 40,
      evaluate: (data, enriched) => {
        if (!data.financier.montantHT || !data.financier.montantTTC) {
          return { score: 0, status: 'missing', detail: 'Impossible de vérifier sans HT et TTC' };
        }
        // Vérifier cohérence calcul TVA
        const tvaCalculee = data.financier.montantTTC - data.financier.montantHT;
        const tvaMentionnee = data.financier.montantTVA;
        if (tvaMentionnee && Math.abs(tvaCalculee - tvaMentionnee) < 1) {
          return { score: 40, status: 'ok' };
        }
        return { score: 20, status: 'warning', detail: 'Écart détecté dans le calcul TVA' };
      },
    },
    {
      code: 'DETAIL_LIGNES',
      label: 'Prestations détaillées ligne par ligne',
      points: 60,
      evaluate: (data, enriched) => {
        const nbLignes = data.lignes.length;
        if (nbLignes >= 5) {
          return { score: 60, status: 'ok', detail: `${nbLignes} lignes détaillées` };
        }
        if (nbLignes >= 3) {
          return { score: 40, status: 'warning', detail: 'Détail limité' };
        }
        if (nbLignes >= 1) {
          return { score: 20, status: 'warning', detail: 'Peu de détail' };
        }
        return { score: 0, status: 'error', detail: 'Aucun détail des prestations' };
      },
    },
    {
      code: 'PRIX_UNITAIRES',
      label: 'Prix unitaires mentionnés',
      points: 30,
      evaluate: (data, enriched) => {
        const lignesAvecPU = data.lignes.filter((l) => l.prixUnitaireHT).length;
        const ratio = data.lignes.length > 0 ? lignesAvecPU / data.lignes.length : 0;
        if (ratio >= 0.8) return { score: 30, status: 'ok' };
        if (ratio >= 0.5) return { score: 20, status: 'warning' };
        return { score: 10, status: 'warning', detail: 'Prix unitaires peu détaillés' };
      },
    },
    {
      code: 'CONDITIONS_PAIEMENT',
      label: 'Conditions de paiement précisées',
      points: 20,
      evaluate: (data, enriched) => {
        if (data.financier.conditionsPaiement) {
          return { score: 20, status: 'ok' };
        }
        if (data.financier.acompte || data.financier.acomptePourcentage) {
          const acompteStr = data.financier.acomptePourcentage
            ? `${data.financier.acomptePourcentage}%`
            : `${data.financier.acompte}¬`;
          return { score: 15, status: 'ok', detail: `Acompte: ${acompteStr}` };
        }
        return { score: 0, status: 'missing' };
      },
    },
  ],
};

// ===== AXE 4 : QUALITÉ DU DEVIS (150 pts) =====

export const QUALITE_AXIS: AxisDefinition = {
  code: 'qualite',
  label: 'Qualité du devis',
  maxPoints: 150,
  criteres: [
    {
      code: 'NUMERO_DATE',
      label: 'Numéro et date du devis',
      points: 30,
      evaluate: (data, enriched) => {
        let score = 0;
        if (data.devis.numero) score += 15;
        if (data.devis.date) score += 15;
        return { score, status: score === 30 ? 'ok' : 'warning' };
      },
    },
    {
      code: 'VALIDITE',
      label: 'Durée de validité mentionnée',
      points: 20,
      evaluate: (data, enriched) => {
        if (data.devis.validite) {
          return { score: 20, status: 'ok', detail: data.devis.validite };
        }
        return { score: 0, status: 'missing' };
      },
    },
    {
      code: 'OBJET_CLAIR',
      label: 'Objet des travaux clairement défini',
      points: 30,
      evaluate: (data, enriched) => {
        if (data.devis.objet && data.devis.objet.length > 20) {
          return { score: 30, status: 'ok' };
        }
        if (data.devis.objet) {
          return { score: 15, status: 'warning', detail: 'Objet succinct' };
        }
        return { score: 0, status: 'missing' };
      },
    },
    {
      code: 'CLIENT_IDENTIFIE',
      label: 'Client clairement identifié',
      points: 25,
      evaluate: (data, enriched) => {
        let score = 0;
        if (data.client.nom) score += 15;
        if (data.client.adresse) score += 10;
        return { score, status: score >= 20 ? 'ok' : 'warning' };
      },
    },
    {
      code: 'LISIBILITE',
      label: 'Document lisible et structuré',
      points: 25,
      evaluate: (data, enriched) => {
        // Basé sur la confiance OCR
        if (data.confidence >= 0.9) return { score: 25, status: 'ok' };
        if (data.confidence >= 0.7) return { score: 15, status: 'warning' };
        return { score: 5, status: 'error', detail: 'Document peu lisible' };
      },
    },
    {
      code: 'DELAI_EXECUTION',
      label: 'Délai d\'exécution mentionné',
      points: 20,
      evaluate: (data, enriched) => {
        if (data.mentionsLegales.delaiExecution) {
          return { score: 20, status: 'ok', detail: data.mentionsLegales.delaiExecution };
        }
        return { score: 0, status: 'missing' };
      },
    },
  ],
};

// ===== AXE 5 : CONFORMITÉ LÉGALE (120 pts) =====

export const CONFORMITE_AXIS: AxisDefinition = {
  code: 'conformite',
  label: 'Conformité légale',
  maxPoints: 120,
  criteres: [
    {
      code: 'MENTIONS_OBLIGATOIRES',
      label: 'Mentions légales obligatoires',
      points: 40,
      bloquant: true,
      evaluate: (data, enriched) => {
        // Doit contenir : raison sociale, SIRET, adresse, forme juridique
        let score = 0;
        if (data.entreprise.raisonSociale) score += 10;
        if (data.entreprise.siret) score += 15;
        if (data.entreprise.adresse) score += 10;
        if (data.entreprise.formeJuridique) score += 5;
        return {
          score,
          status: score >= 30 ? 'ok' : score >= 15 ? 'warning' : 'error',
        };
      },
    },
    {
      code: 'CGV',
      label: 'Conditions générales de vente',
      points: 25,
      evaluate: (data, enriched) => {
        if (data.mentionsLegales.cgv) {
          return { score: 25, status: 'ok' };
        }
        return { score: 0, status: 'missing', detail: 'CGV absentes ou non détectées' };
      },
    },
    {
      code: 'DROIT_RETRACTATION',
      label: 'Droit de rétractation (si applicable)',
      points: 25,
      evaluate: (data, enriched) => {
        // Obligatoire pour démarchage à domicile
        if (data.mentionsLegales.droitRetractation) {
          return { score: 25, status: 'ok' };
        }
        return {
          score: 10,
          status: 'warning',
          detail: 'Non mentionné (obligatoire si démarchage)',
        };
      },
    },
    {
      code: 'MEDIATEUR',
      label: 'Médiateur de la consommation',
      points: 15,
      evaluate: (data, enriched) => {
        if (data.mentionsLegales.mediateur) {
          return { score: 15, status: 'ok' };
        }
        return { score: 0, status: 'missing' };
      },
    },
    {
      code: 'PENALITES_RETARD',
      label: 'Pénalités de retard mentionnées',
      points: 15,
      evaluate: (data, enriched) => {
        if (data.mentionsLegales.penalitesRetard) {
          return { score: 15, status: 'ok' };
        }
        return { score: 0, status: 'missing' };
      },
    },
  ],
};

// ===== AXE 6 : TRANSPARENCE (80 pts) =====

export const TRANSPARENCE_AXIS: AxisDefinition = {
  code: 'transparence',
  label: 'Transparence',
  maxPoints: 80,
  criteres: [
    {
      code: 'CERTIFICATIONS_MENTIONNEES',
      label: 'Certifications professionnelles',
      points: 30,
      evaluate: (data, enriched) => {
        const nbCertifs = data.certifications.length;
        if (nbCertifs >= 2) {
          return { score: 30, status: 'ok', detail: data.certifications.join(', ') };
        }
        if (nbCertifs === 1) {
          return { score: 20, status: 'ok', detail: data.certifications[0] };
        }
        return { score: 0, status: 'missing' };
      },
    },
    {
      code: 'GARANTIES',
      label: 'Garanties clairement énoncées',
      points: 25,
      evaluate: (data, enriched) => {
        if (data.mentionsLegales.garanties && data.mentionsLegales.garanties.length > 0) {
          return { score: 25, status: 'ok', detail: data.mentionsLegales.garanties.join(', ') };
        }
        return { score: 0, status: 'missing' };
      },
    },
    {
      code: 'PROFIL_TORP_COMPLET',
      label: 'Profil TORP vérifié',
      points: 25,
      evaluate: (data, enriched) => {
        const completude = enriched.completudeProfil;
        if (completude >= 90) {
          return { score: 25, status: 'ok', detail: 'Profil Premium' };
        }
        if (completude >= 70) {
          return { score: 18, status: 'ok', detail: 'Profil Vérifié' };
        }
        if (completude >= 50) {
          return { score: 10, status: 'warning', detail: 'Profil Basique' };
        }
        return { score: 0, status: 'error', detail: 'Profil incomplet' };
      },
    },
  ],
};

// ===== EXPORT GLOBAL =====

export const ALL_AXES: AxisDefinition[] = [
  FIABILITE_AXIS,
  ASSURANCES_AXIS,
  TARIFS_AXIS,
  QUALITE_AXIS,
  CONFORMITE_AXIS,
  TRANSPARENCE_AXIS,
];
