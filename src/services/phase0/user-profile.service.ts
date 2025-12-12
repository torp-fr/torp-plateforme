/**
 * Service de récupération des données utilisateur pour pré-remplissage
 * Récupère les données du profil utilisateur et de son entreprise (B2B)
 */

import { supabase } from '@/lib/supabase';
import type { User } from '@/context/AppContext';
import type { MasterOwnerProfile, IndividualIdentity, CompanyIdentity } from '@/types/phase0/owner.types';

// =============================================================================
// TYPES
// =============================================================================

export interface UserCompanyData {
  // Données utilisateur
  userId: string;
  userName?: string;
  userEmail: string;
  userType: 'B2C' | 'B2B' | 'admin';

  // Données entreprise (B2B uniquement)
  companyId?: string;
  companyName?: string;
  siret?: string;
  siren?: string;
  telephone?: string;
  email?: string;
  adresse?: string;
  codePostal?: string;
  ville?: string;
  formeJuridique?: string;
  codeNaf?: string;
  libelleNaf?: string;

  // Données enrichies
  labelsRge?: string[];
  chiffreAffaires?: number;
  effectif?: string;
}

export interface PrefilledOwnerProfile {
  ownerType: 'b2c' | 'b2b' | 'b2g' | 'investor';
  identity: Partial<IndividualIdentity | CompanyIdentity>;
  contact: {
    email?: string;
    phone?: string;
    preferredContactMethod?: 'email' | 'phone' | 'sms';
  };
}

// =============================================================================
// SERVICE
// =============================================================================

class UserProfileService {
  /**
   * Récupère les données complètes de l'utilisateur et de son entreprise
   */
  async getUserData(userId: string): Promise<UserCompanyData | null> {
    try {
      // 1. Récupérer les données utilisateur
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, email, name, type')
        .eq('id', userId)
        .single();

      if (userError || !userData) {
        console.error('[UserProfileService] Erreur récupération utilisateur:', userError);
        return null;
      }

      const result: UserCompanyData = {
        userId: userData.id,
        userName: userData.name,
        userEmail: userData.email,
        userType: userData.type || 'B2C',
      };

      // 2. Si B2B, récupérer les données entreprise
      if (userData.type === 'B2B') {
        const { data: companyData, error: companyError } = await supabase
          .from('companies')
          .select(`
            id,
            name,
            raison_sociale,
            siret,
            siren,
            telephone,
            email,
            adresse,
            code_postal,
            ville,
            forme_juridique,
            code_naf,
            libelle_naf,
            labels_rge,
            chiffre_affaires,
            tranche_effectifs
          `)
          .eq('user_id', userId)
          .single();

        if (!companyError && companyData) {
          result.companyId = companyData.id;
          result.companyName = companyData.raison_sociale || companyData.name;
          result.siret = companyData.siret;
          result.siren = companyData.siren;
          result.telephone = companyData.telephone;
          result.email = companyData.email;
          result.adresse = companyData.adresse;
          result.codePostal = companyData.code_postal;
          result.ville = companyData.ville;
          result.formeJuridique = companyData.forme_juridique;
          result.codeNaf = companyData.code_naf;
          result.libelleNaf = companyData.libelle_naf;
          result.labelsRge = companyData.labels_rge;
          result.chiffreAffaires = companyData.chiffre_affaires;
          result.effectif = companyData.tranche_effectifs;
        }
      }

      return result;
    } catch (err) {
      console.error('[UserProfileService] Erreur:', err);
      return null;
    }
  }

  /**
   * Convertit les données utilisateur en profil pré-rempli pour le wizard
   */
  convertToOwnerProfile(userData: UserCompanyData): PrefilledOwnerProfile {
    const isB2B = userData.userType === 'B2B';
    const ownerType = isB2B ? 'b2b' : 'b2c' as const;

    let identity: Partial<IndividualIdentity | CompanyIdentity>;

    if (isB2B && userData.companyName) {
      identity = {
        type: 'B2B',
        companyName: userData.companyName,
        siret: this.formatSiret(userData.siret) || '',
        siren: userData.siren,
        legalForm: (userData.formeJuridique as any) || 'Autre',
        nafCode: userData.codeNaf,
        representativeName: userData.userName || '',
        representativeRole: 'manager',
      } as Partial<CompanyIdentity>;
    } else {
      // B2C - extraire prénom/nom du nom complet
      const nameParts = (userData.userName || '').split(' ');
      identity = {
        type: 'B2C',
        civility: 'M' as const,
        firstName: nameParts[0] || '',
        lastName: nameParts.slice(1).join(' ') || '',
      } as Partial<IndividualIdentity>;
    }

    return {
      ownerType,
      identity,
      contact: {
        email: userData.companyId ? userData.email : userData.userEmail,
        phone: userData.telephone,
        preferredContactMethod: 'email',
      },
    };
  }

  /**
   * Génère les réponses initiales du wizard à partir des données utilisateur
   */
  generateInitialAnswers(userData: UserCompanyData): Record<string, unknown> {
    const isB2B = userData.userType === 'B2B';
    const answers: Record<string, unknown> = {};

    // Type de propriétaire
    answers['owner.identity.type'] = isB2B ? 'b2b' : 'b2c';

    if (isB2B && userData.companyName) {
      // Données B2B
      answers['owner.identity.companyName'] = userData.companyName;
      answers['owner.identity.siret'] = this.formatSiret(userData.siret);
      answers['owner.identity.contactName'] = userData.userName;
      answers['owner.contact.email'] = userData.email || userData.userEmail;
      answers['owner.contact.phone'] = userData.telephone;

      // Expérience - professionnels ont généralement plus d'expérience
      answers['owner.experience.previousProjects'] = 5;
      answers['owner.experience.technicalKnowledge'] = 'intermediate';
    } else {
      // Données B2C
      const nameParts = (userData.userName || '').split(' ');
      answers['owner.identity.firstName'] = nameParts[0] || '';
      answers['owner.identity.lastName'] = nameParts.slice(1).join(' ') || '';
      answers['owner.contact.email'] = userData.userEmail;
    }

    // Préférence de contact par défaut
    answers['owner.contact.preferredContactMethod'] = 'email';

    return answers;
  }

  /**
   * Génère le projet initial pré-rempli
   */
  generateInitialProject(userData: UserCompanyData): Partial<MasterOwnerProfile> {
    const isB2B = userData.userType === 'B2B';
    const now = new Date().toISOString();

    if (isB2B && userData.companyName) {
      return {
        identity: {
          type: 'B2B',
          companyName: userData.companyName,
          siret: this.formatSiret(userData.siret) || '',
          siren: userData.siren,
          legalForm: (userData.formeJuridique as any) || 'Autre',
          nafCode: userData.codeNaf,
          representativeName: userData.userName || '',
          representativeRole: 'manager',
        } as CompanyIdentity,
        contact: {
          email: userData.email || userData.userEmail,
          phone: userData.telephone,
          preferredContact: 'email',
        },
        torpMetadata: {
          createdAt: now,
          updatedAt: now,
          createdBy: userData.userId,
          version: 1,
          source: 'auto_prefill',
          completeness: 30,
          aiEnriched: false,
        },
      } as Partial<MasterOwnerProfile>;
    }

    // B2C
    const nameParts = (userData.userName || '').split(' ');
    return {
      identity: {
        type: 'B2C',
        civility: 'M' as const,
        firstName: nameParts[0] || '',
        lastName: nameParts.slice(1).join(' ') || '',
      } as IndividualIdentity,
      contact: {
        email: userData.userEmail,
        preferredContact: 'email',
      },
      torpMetadata: {
        createdAt: now,
        updatedAt: now,
        createdBy: userData.userId,
        version: 1,
        source: 'auto_prefill',
        completeness: 10,
        aiEnriched: false,
      },
    } as Partial<MasterOwnerProfile>;
  }

  /**
   * Formate un SIRET avec espaces (XXX XXX XXX XXXXX)
   */
  private formatSiret(siret?: string): string {
    if (!siret) return '';
    const cleaned = siret.replace(/\s/g, '');
    if (cleaned.length !== 14) return siret;
    return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6, 9)} ${cleaned.slice(9)}`;
  }
}

export const userProfileService = new UserProfileService();
export default userProfileService;
