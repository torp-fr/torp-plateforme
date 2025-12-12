/**
 * Service de récupération des données utilisateur pour pré-remplissage
 * Récupère les données du profil utilisateur et de son entreprise (B2B)
 *
 * WORKFLOW B2B:
 * - Les professionnels (B2B) créent des projets POUR leurs clients
 * - Le profil client est à renseigner (particulier ou entreprise)
 * - Les données de l'entreprise B2B servent à identifier le prestataire
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
  userPhone?: string;
  userType: 'B2C' | 'B2B' | 'admin';
  userPreferences?: Record<string, unknown>;

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

  // Historique projets (pour suggestions intelligentes)
  previousProjectsCount?: number;
  lastProjectType?: string;
  frequentLots?: string[];
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

/**
 * Contexte du prestataire B2B (pour les projets créés par un pro)
 */
export interface B2BProviderContext {
  providerId: string;
  providerCompanyName: string;
  providerSiret?: string;
  providerContactName?: string;
  providerEmail?: string;
  providerPhone?: string;
  isRge?: boolean;
  labelsRge?: string[];
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
        .select('id, email, name, phone, type, preferences')
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
        userPhone: userData.phone,
        userType: userData.type || 'B2C',
        userPreferences: userData.preferences,
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
            tranche_effectifs,
            rge_certified
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

      // 3. Récupérer l'historique des projets pour suggestions
      await this.enrichWithProjectHistory(result);

      return result;
    } catch (err) {
      console.error('[UserProfileService] Erreur:', err);
      return null;
    }
  }

  /**
   * Enrichit les données utilisateur avec l'historique des projets
   */
  private async enrichWithProjectHistory(userData: UserCompanyData): Promise<void> {
    try {
      // Compter les projets précédents
      const { count } = await supabase
        .from('phase0_projects')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userData.userId);

      userData.previousProjectsCount = count || 0;

      // Récupérer le dernier projet pour suggérer des lots similaires
      if (count && count > 0) {
        const { data: lastProject } = await supabase
          .from('phase0_projects')
          .select('work_project, selected_lots')
          .eq('user_id', userData.userId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (lastProject) {
          // Extraire le type de projet et les lots fréquents
          const workProject = lastProject.work_project as Record<string, unknown>;
          userData.lastProjectType = workProject?.general?.type as string;

          // Analyser les lots fréquemment utilisés
          const lots = lastProject.selected_lots as Array<{ lotId: string }>;
          if (lots && lots.length > 0) {
            userData.frequentLots = lots.slice(0, 5).map(l => l.lotId);
          }
        }
      }
    } catch (err) {
      console.warn('[UserProfileService] Erreur enrichissement historique:', err);
    }
  }

  /**
   * Génère le contexte du prestataire B2B
   * Utilisé quand un professionnel crée un projet pour un client
   */
  getProviderContext(userData: UserCompanyData): B2BProviderContext | null {
    if (userData.userType !== 'B2B' || !userData.companyName) {
      return null;
    }

    return {
      providerId: userData.userId,
      providerCompanyName: userData.companyName,
      providerSiret: userData.siret,
      providerContactName: userData.userName,
      providerEmail: userData.email || userData.userEmail,
      providerPhone: userData.telephone,
      isRge: !!(userData.labelsRge && userData.labelsRge.length > 0),
      labelsRge: userData.labelsRge,
    };
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
   *
   * IMPORTANT: Pour les B2B, le projet est pour un CLIENT
   * - Le prestataire B2B est stocké dans 'provider' (contexte du projet)
   * - Le client (owner) est à saisir par le professionnel
   * - On pré-remplit uniquement les infos du prestataire et suggestions
   */
  generateInitialAnswers(userData: UserCompanyData): Record<string, unknown> {
    const isB2B = userData.userType === 'B2B';
    const answers: Record<string, unknown> = {};

    if (isB2B && userData.companyName) {
      // ========================================
      // WORKFLOW B2B: Projet pour un CLIENT
      // ========================================

      // Le prestataire B2B est pré-rempli (pas le client)
      answers['provider.companyName'] = userData.companyName;
      answers['provider.siret'] = this.formatSiret(userData.siret);
      answers['provider.contactName'] = userData.userName;
      answers['provider.email'] = userData.email || userData.userEmail;
      answers['provider.phone'] = userData.telephone;
      answers['provider.isRge'] = !!(userData.labelsRge && userData.labelsRge.length > 0);
      answers['provider.labelsRge'] = userData.labelsRge;

      // Pour le client (owner), on laisse le type vide pour que le pro choisisse
      // mais on suggère 'b2c' comme type par défaut (particulier)
      answers['owner.identity.type'] = 'b2c';

      // Expérience du prestataire (pour scoring)
      answers['provider.experience.previousProjects'] = userData.previousProjectsCount || 0;
      answers['provider.experience.technicalKnowledge'] = 'expert';

      // Suggestions basées sur l'historique
      if (userData.lastProjectType) {
        answers['workProject.general.type_suggestion'] = userData.lastProjectType;
      }
      if (userData.frequentLots && userData.frequentLots.length > 0) {
        answers['selectedLots.suggestions'] = userData.frequentLots;
      }

    } else {
      // ========================================
      // WORKFLOW B2C: Projet pour SOI-MÊME
      // ========================================

      answers['owner.identity.type'] = 'b2c';

      // Pré-remplir les données du particulier
      const nameParts = (userData.userName || '').split(' ');
      answers['owner.identity.firstName'] = nameParts[0] || '';
      answers['owner.identity.lastName'] = nameParts.slice(1).join(' ') || '';
      answers['owner.contact.email'] = userData.userEmail;
      answers['owner.contact.phone'] = userData.userPhone || '';

      // Expérience du particulier
      const projectCount = userData.previousProjectsCount || 0;
      answers['owner.experience.previousProjects'] = projectCount;
      answers['owner.experience.technicalKnowledge'] = projectCount > 2 ? 'intermediate' : 'basic';
    }

    // Préférences communes
    answers['owner.contact.preferredContactMethod'] = 'email';

    return answers;
  }

  /**
   * Génère les données initiales spécifiques pour le mode B2B (prestataire)
   * Stocke le contexte du prestataire dans le projet
   */
  generateB2BProjectContext(userData: UserCompanyData): Record<string, unknown> {
    if (userData.userType !== 'B2B') {
      return {};
    }

    return {
      providerContext: {
        providerId: userData.userId,
        companyId: userData.companyId,
        companyName: userData.companyName,
        siret: userData.siret,
        contactName: userData.userName,
        email: userData.email || userData.userEmail,
        phone: userData.telephone,
        isRge: !!(userData.labelsRge && userData.labelsRge.length > 0),
        labelsRge: userData.labelsRge,
        codeNaf: userData.codeNaf,
        libelleNaf: userData.libelleNaf,
      },
      // Le projet est créé par un professionnel pour un client
      createdByProfessional: true,
      professionalWorkflowEnabled: true,
    };
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
