/**
 * Service d'enrichissement des données entreprise
 * Croise les données extraites du devis avec le profil TORP de l'entreprise
 */

import { supabase } from '@/lib/supabase';
import { calculateProfileCompleteness } from '@/lib/pro/profile-completeness';
import type { ExtractedDevisData } from '../ocr/extract-devis';

export interface EnrichedCompanyData {
  // Données du profil TORP
  profil: {
    companyId: string;
    siret: string;
    siretVerifie: boolean;
    raisonSociale: string;
    dateCreation: Date | null;
    ancienneteAnnees: number;
    formeJuridique: string;
    effectif: string | null;
  };

  // Documents disponibles et leur statut
  documents: {
    kbis: { present: boolean; valide: boolean; dateExpiration?: Date };
    decennale: {
      present: boolean;
      valide: boolean;
      dateExpiration?: Date;
      assureur?: string;
      numero?: string;
    };
    rcPro: { present: boolean; valide: boolean; dateExpiration?: Date };
    urssaf: { present: boolean; valide: boolean; dateExpiration?: Date };
    vigilance: { present: boolean; valide: boolean; dateExpiration?: Date };
  };

  // Certifications vérifiées
  certifications: Array<{
    type: string; // "RGE", "Qualibat", etc.
    valide: boolean;
    dateExpiration?: Date;
    documentPresent: boolean;
  }>;

  // Score de complétude profil
  completudeProfil: number; // 0-100
}

/**
 * Enrichit les données extraites avec le profil entreprise TORP
 */
export async function enrichWithCompanyData(
  companyId: string,
  extractedData: ExtractedDevisData
): Promise<EnrichedCompanyData> {
  // 1. Charger le profil entreprise depuis la base
  const { data: company, error: companyError } = await supabase
    .from('pro_company_profiles')
    .select('*')
    .eq('id', companyId)
    .single();

  if (companyError || !company) {
    throw new Error(`Company profile not found: ${companyId}`);
  }

  // 2. Charger tous les documents de l'entreprise
  const { data: documents, error: docsError } = await supabase
    .from('company_documents')
    .select('*')
    .eq('company_id', companyId);

  if (docsError) {
    throw new Error(`Error loading documents: ${docsError.message}`);
  }

  const docs = documents || [];

  // 3. Calculer l'ancienneté de l'entreprise
  const dateCreation = company.date_creation ? new Date(company.date_creation) : null;
  const ancienneteAnnees = dateCreation
    ? Math.floor((Date.now() - dateCreation.getTime()) / (1000 * 60 * 60 * 24 * 365))
    : 0;

  // 4. Analyser les documents par type
  const now = new Date();

  const getDocumentStatus = (type: string) => {
    const doc = docs.find((d) => d.type === type);

    if (!doc) {
      return { present: false, valide: false };
    }

    // Vérifier la date d'expiration
    if (doc.date_expiration) {
      const expirationDate = new Date(doc.date_expiration);
      const valide = expirationDate > now && doc.statut === 'VALID';

      return {
        present: true,
        valide,
        dateExpiration: expirationDate,
      };
    }

    // Si pas de date d'expiration, vérifier le statut
    return {
      present: true,
      valide: doc.statut === 'VALID',
    };
  };

  // Documents principaux
  const kbis = getDocumentStatus('KBIS');
  const decennale = getDocumentStatus('ASSURANCE_DECENNALE');
  const rcPro = getDocumentStatus('ASSURANCE_RC_PRO');
  const urssaf = getDocumentStatus('ATTESTATION_URSSAF');
  const vigilance = getDocumentStatus('ATTESTATION_VIGILANCE');

  // Ajouter infos complémentaires pour la décennale
  const decennaleDoc = docs.find((d) => d.type === 'ASSURANCE_DECENNALE');
  const decennaleEnriched = {
    ...decennale,
    assureur: decennaleDoc?.metadata?.assureur as string | undefined,
    numero: decennaleDoc?.metadata?.numero as string | undefined,
  };

  // 5. Identifier les certifications
  const certificationTypes = [
    'CERTIFICATION_RGE',
    'CERTIFICATION_QUALIBAT',
    'CERTIFICATION_QUALIFELEC',
    'CERTIFICATION_QUALIPAC',
  ];

  const certifications = certificationTypes.map((type) => {
    const doc = docs.find((d) => d.type === type);

    if (!doc) {
      return null;
    }

    const valide =
      doc.statut === 'VALID' &&
      (!doc.date_expiration || new Date(doc.date_expiration) > now);

    return {
      type: type.replace('CERTIFICATION_', ''),
      valide,
      dateExpiration: doc.date_expiration ? new Date(doc.date_expiration) : undefined,
      documentPresent: true,
    };
  }).filter(Boolean) as EnrichedCompanyData['certifications'];

  // 6. Calculer la complétude du profil
  const completenessResult = calculateProfileCompleteness(company, docs);

  // 7. Retourner les données enrichies
  return {
    profil: {
      companyId: company.id,
      siret: company.siret,
      siretVerifie: company.siret_verifie,
      raisonSociale: company.raison_sociale,
      dateCreation,
      ancienneteAnnees,
      formeJuridique: company.forme_juridique || 'Non renseignée',
      effectif: company.effectif,
    },
    documents: {
      kbis,
      decennale: decennaleEnriched,
      rcPro,
      urssaf,
      vigilance,
    },
    certifications,
    completudeProfil: completenessResult.score,
  };
}

/**
 * Vérifie la cohérence entre les données du devis et le profil TORP
 */
export function checkDataCoherence(
  extractedData: ExtractedDevisData,
  enrichedData: EnrichedCompanyData
): {
  coherent: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];

  // Vérifier SIRET
  if (extractedData.entreprise.siret && enrichedData.profil.siret) {
    if (extractedData.entreprise.siret !== enrichedData.profil.siret) {
      warnings.push(
        `SIRET du devis (${extractedData.entreprise.siret}) différent du profil TORP (${enrichedData.profil.siret})`
      );
    }
  }

  // Vérifier raison sociale
  if (extractedData.entreprise.raisonSociale && enrichedData.profil.raisonSociale) {
    const normalized1 = extractedData.entreprise.raisonSociale.toLowerCase().trim();
    const normalized2 = enrichedData.profil.raisonSociale.toLowerCase().trim();

    if (!normalized1.includes(normalized2) && !normalized2.includes(normalized1)) {
      warnings.push(
        `Raison sociale du devis différente du profil TORP (peut être normal si changement récent)`
      );
    }
  }

  // Vérifier décennale
  if (extractedData.assurances.decennale?.numero && enrichedData.documents.decennale.numero) {
    if (extractedData.assurances.decennale.numero !== enrichedData.documents.decennale.numero) {
      warnings.push(
        `Numéro de décennale du devis différent du profil TORP - Vérifiez que le document TORP est à jour`
      );
    }
  }

  return {
    coherent: warnings.length === 0,
    warnings,
  };
}
