/**
 * Calcul de la complétude du profil entreprise B2B
 */

type DocumentType = 'KBIS' | 'ASSURANCE_DECENNALE' | 'ASSURANCE_RC_PRO' | 'ATTESTATION_URSSAF' | 'ATTESTATION_VIGILANCE' | 'CERTIFICATION_QUALIBAT' | 'CERTIFICATION_RGE';
type DocumentStatus = 'PENDING' | 'VALID' | 'EXPIRING' | 'EXPIRED' | 'INVALID';
type ProfileLevel = 'incomplete' | 'basic' | 'verified' | 'premium';

interface CompanyProfile {
  siret: string;
  siren: string;
  raison_sociale: string;
  forme_juridique?: string | null;
  code_naf?: string | null;
  adresse?: string | null;
  code_postal?: string | null;
  ville?: string | null;
  telephone?: string | null;
  email: string;
  site_web?: string | null;
  effectif?: string | null;
  capital_social?: number | null;
  dirigeant_nom?: string | null;
  siret_verifie: boolean;
  siret_verifie_le?: string | null;
}

interface CompanyDocument {
  id: string;
  type: DocumentType;
  statut: DocumentStatus;
  date_expiration?: string | null;
}

export interface ProfileCompleteness {
  score: number; // 0-100
  level: ProfileLevel;
  missingRequired: string[]; // Documents obligatoires manquants
  missingOptional: string[]; // Documents optionnels manquants
  expiringSoon: string[]; // Documents expirant < 30j
  expired: string[]; // Documents expirés
  details: {
    basicInfo: boolean; // Infos entreprise complètes
    siretVerified: boolean; // SIRET vérifié
    kbis: boolean; // KBIS valide
    decennale: boolean; // Décennale valide
    rcPro: boolean; // RC Pro
    urssaf: boolean; // URSSAF/Vigilance
    certifications: boolean; // Certifications (RGE, Qualibat...)
  };
}

/**
 * Configuration des documents et leur pondération
 */
const DOCUMENT_WEIGHTS = {
  KBIS: { obligatoire: true, points: 20, label: 'KBIS' },
  ASSURANCE_DECENNALE: { obligatoire: true, points: 20, label: 'Assurance décennale' },
  ASSURANCE_RC_PRO: { obligatoire: false, points: 10, label: 'RC Professionnelle' },
  ATTESTATION_URSSAF: { obligatoire: false, points: 10, label: 'Attestation URSSAF' },
  ATTESTATION_VIGILANCE: { obligatoire: false, points: 0, label: 'Attestation Vigilance' }, // Bonus dans URSSAF
  CERTIFICATION_QUALIBAT: { obligatoire: false, points: 10, label: 'Certification Qualibat' },
  CERTIFICATION_RGE: { obligatoire: false, points: 10, label: 'Certification RGE' },
};

/**
 * Calcule la complétude du profil entreprise
 */
export function calculateProfileCompleteness(
  company: CompanyProfile,
  documents: CompanyDocument[]
): ProfileCompleteness {
  let score = 0;
  const missingRequired: string[] = [];
  const missingOptional: string[] = [];
  const expiringSoon: string[] = [];
  const expired: string[] = [];

  // 1. Infos entreprise complètes : +20%
  const basicInfoComplete =
    !!company.raison_sociale &&
    !!company.siret &&
    !!company.siren &&
    !!company.adresse &&
    !!company.code_postal &&
    !!company.ville &&
    !!company.email;

  if (basicInfoComplete) {
    score += 20;
  }

  // 2. SIRET vérifié : +10%
  if (company.siret_verifie) {
    score += 10;
  }

  // 3. Documents
  const docsByType = new Map<DocumentType, CompanyDocument>();
  documents.forEach((doc) => {
    docsByType.set(doc.type, doc);
  });

  // Vérifier chaque type de document
  Object.entries(DOCUMENT_WEIGHTS).forEach(([type, config]) => {
    const docType = type as DocumentType;
    const doc = docsByType.get(docType);

    if (!doc) {
      // Document manquant
      if (config.obligatoire) {
        missingRequired.push(config.label);
      } else if (config.points > 0) {
        missingOptional.push(config.label);
      }
    } else {
      // Document présent, vérifier statut
      if (doc.statut === 'VALID') {
        score += config.points;
      } else if (doc.statut === 'EXPIRING') {
        score += config.points; // Compte quand même mais alerter
        expiringSoon.push(config.label);
      } else if (doc.statut === 'EXPIRED') {
        // Ne compte pas
        expired.push(config.label);
        if (config.obligatoire) {
          missingRequired.push(config.label);
        }
      } else if (doc.statut === 'PENDING') {
        // Document en attente de vérification
        score += config.points * 0.5; // 50% des points
      }
    }
  });

  // Déterminer le level
  let level: ProfileLevel;
  if (score < 50) {
    level = 'incomplete';
  } else if (score >= 50 && score < 70) {
    level = 'basic';
  } else if (score >= 70 && score < 90) {
    level = 'verified';
  } else {
    level = 'premium';
  }

  // Détails
  const kbisDoc = docsByType.get('KBIS');
  const decennaleDoc = docsByType.get('ASSURANCE_DECENNALE');
  const rcProDoc = docsByType.get('ASSURANCE_RC_PRO');
  const urssafDoc = docsByType.get('ATTESTATION_URSSAF');
  const vigilanceDoc = docsByType.get('ATTESTATION_VIGILANCE');
  const qualibatDoc = docsByType.get('CERTIFICATION_QUALIBAT');
  const rgeDoc = docsByType.get('CERTIFICATION_RGE');

  return {
    score: Math.round(score),
    level,
    missingRequired,
    missingOptional,
    expiringSoon,
    expired,
    details: {
      basicInfo: basicInfoComplete,
      siretVerified: company.siret_verifie,
      kbis: kbisDoc?.statut === 'VALID' || kbisDoc?.statut === 'EXPIRING',
      decennale: decennaleDoc?.statut === 'VALID' || decennaleDoc?.statut === 'EXPIRING',
      rcPro: rcProDoc?.statut === 'VALID' || rcProDoc?.statut === 'EXPIRING',
      urssaf: urssafDoc?.statut === 'VALID' || urssafDoc?.statut === 'EXPIRING' || vigilanceDoc?.statut === 'VALID',
      certifications: qualibatDoc?.statut === 'VALID' || rgeDoc?.statut === 'VALID',
    },
  };
}

/**
 * Récupère le label du level
 */
export function getLevelLabel(level: ProfileLevel): string {
  const labels: Record<ProfileLevel, string> = {
    incomplete: 'Incomplet',
    basic: 'Basique',
    verified: 'Vérifié',
    premium: 'Premium',
  };
  return labels[level];
}

/**
 * Récupère la couleur du level
 */
export function getLevelColor(level: ProfileLevel): string {
  const colors: Record<ProfileLevel, string> = {
    incomplete: 'text-red-600 bg-red-100',
    basic: 'text-orange-600 bg-orange-100',
    verified: 'text-green-600 bg-green-100',
    premium: 'text-emerald-600 bg-emerald-100',
  };
  return colors[level];
}

/**
 * Calcule les jours avant expiration d'un document
 */
export function getDaysUntilExpiration(dateExpiration: string | null): number | null {
  if (!dateExpiration) return null;

  const expiration = new Date(dateExpiration);
  const now = new Date();
  const diffTime = expiration.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays;
}

/**
 * Détermine le statut d'un document basé sur sa date d'expiration
 */
export function getDocumentStatus(dateExpiration: string | null, currentStatus?: DocumentStatus): DocumentStatus {
  if (!dateExpiration) {
    return currentStatus || 'PENDING';
  }

  const daysUntilExpiration = getDaysUntilExpiration(dateExpiration);

  if (daysUntilExpiration === null) {
    return currentStatus || 'PENDING';
  }

  if (daysUntilExpiration < 0) {
    return 'EXPIRED';
  } else if (daysUntilExpiration <= 30) {
    return 'EXPIRING';
  } else {
    return 'VALID';
  }
}
