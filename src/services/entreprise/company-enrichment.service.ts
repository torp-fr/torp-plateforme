/**
 * Service d'enrichissement des données entreprise
 *
 * Ce service orchestre l'enrichissement complet d'une entreprise :
 * 1. Sirene INSEE → données légales de base
 * 2. Pappers → données financières, dirigeants, labels
 * 3. IGN Géoplateforme → géocodage et localisation
 * 4. Google Places → réputation (à implémenter)
 *
 * Les données enrichies sont persistées dans Supabase.
 */

import { supabase } from '@/lib/supabase';
import { entrepriseUnifiedService, EntrepriseUnifiee, GetEntrepriseOptions } from './entreprise-unified.service';
import { geocodingService, GeocodingResult } from '@/services/api/geocoding.service';
import { rgeAdemeService, RGEEntreprise } from '@/services/api/rge-ademe.service';

// ============================================
// TYPES
// ============================================

export interface CompanyEnrichmentData {
  // Identification
  id?: string;
  siret: string;
  siren: string;
  name: string;

  // Données Sirene
  sirene?: {
    nic?: string;
    denominationUsuelle?: string;
    codeNaf?: string;
    libelleNaf?: string;
    trancheEffectifs?: string;
    dateCreation?: Date;
    etatAdministratif?: 'A' | 'F';
    adresseComplete?: string;
    codePostal?: string;
    commune?: string;
  };

  // Données géographiques
  geo?: {
    latitude?: number;
    longitude?: number;
    departementCode?: string;
    departementNom?: string;
    regionCode?: string;
    regionNom?: string;
    geoScore?: number;
    geoSource?: string;
  };

  // Données Pappers
  pappers?: {
    chiffreAffaires?: number;
    chiffreAffairesAnnee?: number;
    resultatNet?: number;
    capitalSocial?: number;
    formeJuridique?: string;
    pappersScore?: number;
    labelsRge?: string[];
    conventionsCollectives?: any[];
    dirigeants?: any[];
    beneficiairesEffectifs?: any[];
    etablissementsCount?: number;
    proceduresCollectives?: any[];
    derniersComptes?: any;
  };

  // Données Google (future)
  google?: {
    placeId?: string;
    rating?: number;
    reviewsCount?: number;
    reviewsSample?: any[];
    sentimentScore?: number;
    photosUrl?: string[];
  };

  // Données RGE ADEME
  rge?: RGEEntreprise;

  // Métadonnées
  dataSources: string[];
  dataQualityScore: number;
  lastEnrichedAt: Date;
  enrichmentErrors?: any[];
  scoringDetails?: any;
}

export interface EnrichmentResult {
  success: boolean;
  data?: CompanyEnrichmentData;
  error?: string;
  sourcesUsed: string[];
  warnings: string[];
}

export interface EnrichmentOptions extends GetEntrepriseOptions {
  // Géocodage
  geocodeAddress?: boolean;

  // Google (future)
  fetchGoogleReviews?: boolean;

  // RGE ADEME
  verifyRGE?: boolean;

  // Persistance
  persist?: boolean;

  // Forcer le rafraîchissement même si données récentes
  forceRefresh?: boolean;
}

// ============================================
// SERVICE
// ============================================

class CompanyEnrichmentService {

  /**
   * Enrichit une entreprise à partir de son SIRET
   *
   * @param siret SIRET (14 chiffres) ou SIREN (9 chiffres)
   * @param options Options d'enrichissement
   */
  async enrichCompany(
    siret: string,
    options: EnrichmentOptions = {}
  ): Promise<EnrichmentResult> {
    const {
      enrichirFinances = true,
      enrichirDirigeants = true,
      enrichirLabels = true,
      enrichirScoring = false,
      enrichirProcedures = false,
      geocodeAddress = true,
      fetchGoogleReviews = false,
      verifyRGE = true,
      persist = true,
      forceRefresh = false,
    } = options;

    const sourcesUsed: string[] = [];
    const warnings: string[] = [];
    const errors: any[] = [];

    console.log(`[CompanyEnrichment] Démarrage enrichissement pour ${siret}`);

    // Vérifier si données récentes existent
    if (!forceRefresh) {
      const existing = await this.getExistingData(siret);
      if (existing && this.isDataFresh(existing.lastEnrichedAt)) {
        console.log('[CompanyEnrichment] Données récentes trouvées, skip enrichissement');
        return {
          success: true,
          data: existing,
          sourcesUsed: existing.dataSources,
          warnings: ['Données existantes utilisées (< 30 jours)'],
        };
      }
    }

    // ==========================================
    // ÉTAPE 1: Données Sirene + Pappers
    // ==========================================

    const entrepriseResult = await entrepriseUnifiedService.getEntreprise(siret, {
      enrichirFinances,
      enrichirDirigeants,
      enrichirLabels,
      enrichirScoring,
      enrichirProcedures,
    });

    if (!entrepriseResult.success || !entrepriseResult.data) {
      return {
        success: false,
        error: entrepriseResult.error || 'Entreprise non trouvée',
        sourcesUsed,
        warnings,
      };
    }

    const entreprise = entrepriseResult.data;

    if (entrepriseResult.sources.sirene.success) sourcesUsed.push('sirene');
    if (entrepriseResult.sources.pappers.success) sourcesUsed.push('pappers');

    // Construire les données d'enrichissement
    const enrichmentData: CompanyEnrichmentData = {
      siret: entreprise.siret,
      siren: entreprise.siren,
      name: entreprise.raisonSociale,

      sirene: {
        denominationUsuelle: entreprise.nomCommercial || undefined,
        codeNaf: entreprise.codeNAF || undefined,
        libelleNaf: entreprise.libelleNAF || undefined,
        trancheEffectifs: entreprise.trancheEffectif || undefined,
        dateCreation: entreprise.dateCreation ? new Date(entreprise.dateCreation) : undefined,
        etatAdministratif: entreprise.estActif ? 'A' : 'F',
        adresseComplete: entreprise.adresseComplete || undefined,
        codePostal: entreprise.adresse?.codePostal || undefined,
        commune: entreprise.adresse?.ville || undefined,
      },

      dataSources: sourcesUsed,
      dataQualityScore: 0,
      lastEnrichedAt: new Date(),
      enrichmentErrors: errors,
    };

    // Extraire SIREN depuis SIRET si nécessaire
    if (!enrichmentData.siren && enrichmentData.siret?.length === 14) {
      enrichmentData.siren = enrichmentData.siret.substring(0, 9);
      enrichmentData.sirene!.nic = enrichmentData.siret.substring(9);
    }

    // ==========================================
    // ÉTAPE 2: Enrichissement Pappers
    // ==========================================

    if (entreprise.dernieresFinances) {
      enrichmentData.pappers = {
        chiffreAffaires: entreprise.dernieresFinances.chiffreAffaires || undefined,
        chiffreAffairesAnnee: entreprise.dernieresFinances.annee,
        resultatNet: entreprise.dernieresFinances.resultat || undefined,
        capitalSocial: entreprise.capital || undefined,
        formeJuridique: entreprise.formeJuridique || undefined,
        pappersScore: entreprise.scoringFinancier?.score || undefined,
        labelsRge: entreprise.labelsRGE || undefined,
        dirigeants: entreprise.dirigeants || undefined,
        proceduresCollectives: entreprise.proceduresCollectives || undefined,
      };
    }

    // ==========================================
    // ÉTAPE 3: Géocodage IGN
    // ==========================================

    if (geocodeAddress && entreprise.adresseComplete) {
      try {
        const geoResult = await geocodingService.geocode(entreprise.adresseComplete, { limit: 1 });

        if (geoResult.success && geoResult.bestMatch) {
          const geo = geoResult.bestMatch;
          sourcesUsed.push('ign');

          enrichmentData.geo = {
            latitude: geo.latitude,
            longitude: geo.longitude,
            departementCode: geo.departementCode,
            departementNom: geo.departement,
            regionCode: undefined, // À calculer depuis departementCode
            regionNom: geo.region,
            geoScore: geo.score * 100, // Score 0-1 → 0-100
            geoSource: 'ign-geoplateforme',
          };

          // Calculer le code région
          if (geo.departementCode) {
            const regionMapping: Record<string, string> = {
              '75': '11', '77': '11', '78': '11', '91': '11', '92': '11', '93': '11', '94': '11', '95': '11',
              '69': '84', '13': '93', '31': '76', '33': '75', '59': '32', '06': '93', '44': '52', '34': '76',
              // ... (simplification - voir geocoding.service.ts pour mapping complet)
            };
            enrichmentData.geo.regionCode = regionMapping[geo.departementCode];
          }

          console.log('[CompanyEnrichment] Géocodage OK:', geo.label);
        } else {
          warnings.push('Géocodage partiel ou échec');
        }
      } catch (err) {
        console.error('[CompanyEnrichment] Erreur géocodage:', err);
        errors.push({ source: 'ign', error: err instanceof Error ? err.message : 'Erreur géocodage' });
        warnings.push('Erreur lors du géocodage');
      }
    }

    // ==========================================
    // ÉTAPE 4: Google Reviews (future)
    // ==========================================

    if (fetchGoogleReviews) {
      // TODO: Implémenter l'intégration Google Places API
      warnings.push('Google Reviews non implémenté');
    }

    // ==========================================
    // ÉTAPE 4.5: Vérification RGE ADEME
    // ==========================================

    if (verifyRGE) {
      try {
        console.log('[CompanyEnrichment] Vérification RGE ADEME...');
        const rgeResult = await rgeAdemeService.getQualificationsBySiret(siret);

        if (rgeResult.success && rgeResult.data) {
          sourcesUsed.push('ademe_rge');
          enrichmentData.rge = rgeResult.data;

          console.log('[CompanyEnrichment] RGE:', rgeResult.data.estRGE ? 'OUI' : 'NON');
          console.log('[CompanyEnrichment] Score RGE:', rgeResult.data.scoreRGE);

          if (rgeResult.data.estRGE) {
            console.log('[CompanyEnrichment] Qualifications actives:', rgeResult.data.nombreQualificationsActives);
          }
        } else {
          warnings.push(`Vérification RGE: ${rgeResult.error || 'Non disponible'}`);
        }
      } catch (err) {
        console.error('[CompanyEnrichment] Erreur vérification RGE:', err);
        errors.push({ source: 'ademe_rge', error: err instanceof Error ? err.message : 'Erreur RGE' });
        warnings.push('Erreur lors de la vérification RGE');
      }
    }

    // ==========================================
    // ÉTAPE 5: Calcul du score de qualité
    // ==========================================

    enrichmentData.dataQualityScore = this.calculateDataQualityScore(enrichmentData);
    enrichmentData.dataSources = sourcesUsed;
    enrichmentData.enrichmentErrors = errors.length > 0 ? errors : undefined;

    // ==========================================
    // ÉTAPE 6: Persistance Supabase
    // ==========================================

    if (persist) {
      try {
        await this.persistToSupabase(enrichmentData);
        console.log('[CompanyEnrichment] Données persistées');
      } catch (err) {
        console.error('[CompanyEnrichment] Erreur persistance:', err);
        warnings.push('Échec de la persistance (données non sauvegardées)');
      }
    }

    return {
      success: true,
      data: enrichmentData,
      sourcesUsed,
      warnings,
    };
  }

  /**
   * Récupère les données existantes pour un SIRET
   */
  async getExistingData(siret: string): Promise<CompanyEnrichmentData | null> {
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .eq('siret', siret)
        .single();

      if (error || !data) return null;

      return {
        id: data.id,
        siret: data.siret,
        siren: data.siren || data.siret?.substring(0, 9),
        name: data.name,
        sirene: {
          nic: data.nic,
          denominationUsuelle: data.denomination_usuelle,
          codeNaf: data.code_naf,
          libelleNaf: data.libelle_naf,
          trancheEffectifs: data.tranche_effectifs,
          dateCreation: data.date_creation_etablissement,
          etatAdministratif: data.etat_administratif,
          adresseComplete: data.adresse_complete,
          codePostal: data.code_postal,
          commune: data.commune,
        },
        geo: {
          latitude: data.latitude,
          longitude: data.longitude,
          departementCode: data.departement_code,
          departementNom: data.departement_nom,
          regionCode: data.region_code,
          regionNom: data.region_nom,
          geoScore: data.geo_score,
          geoSource: data.geo_source,
        },
        pappers: {
          chiffreAffaires: data.chiffre_affaires,
          chiffreAffairesAnnee: data.chiffre_affaires_annee,
          resultatNet: data.resultat_net,
          capitalSocial: data.capital_social,
          formeJuridique: data.forme_juridique,
          pappersScore: data.pappers_score,
          labelsRge: data.labels_rge,
          dirigeants: data.dirigeants,
          proceduresCollectives: data.procedures_collectives,
        },
        google: data.google_place_id ? {
          placeId: data.google_place_id,
          rating: data.google_rating,
          reviewsCount: data.google_reviews_count,
          reviewsSample: data.google_reviews_sample,
          sentimentScore: data.google_sentiment_score,
        } : undefined,
        dataSources: data.data_sources || [],
        dataQualityScore: data.data_quality_score || 0,
        lastEnrichedAt: data.last_enriched_at ? new Date(data.last_enriched_at) : new Date(),
        enrichmentErrors: data.enrichment_errors,
        scoringDetails: data.scoring_details,
      };
    } catch (err) {
      console.error('[CompanyEnrichment] Erreur lecture:', err);
      return null;
    }
  }

  /**
   * Vérifie si les données sont fraîches (< 30 jours)
   */
  private isDataFresh(lastEnrichedAt?: Date): boolean {
    if (!lastEnrichedAt) return false;
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return lastEnrichedAt > thirtyDaysAgo;
  }

  /**
   * Calcule le score de qualité des données (0-100)
   */
  private calculateDataQualityScore(data: CompanyEnrichmentData): number {
    let score = 0;

    // Données de base obligatoires (25 points)
    if (data.siret) score += 8;
    if (data.name) score += 8;
    if (data.sirene?.adresseComplete) score += 9;

    // Données Sirene (15 points)
    if (data.sirene?.codeNaf) score += 4;
    if (data.sirene?.dateCreation) score += 4;
    if (data.sirene?.trancheEffectifs) score += 3;
    if (data.sirene?.etatAdministratif === 'A') score += 4;

    // Géocodage (15 points)
    if (data.geo?.latitude && data.geo?.longitude) score += 10;
    if (data.geo?.departementCode) score += 5;

    // Pappers (20 points)
    if (data.pappers?.chiffreAffaires) score += 10;
    if (data.pappers?.formeJuridique) score += 5;
    if (data.pappers?.dirigeants && data.pappers.dirigeants.length > 0) score += 5;

    // RGE ADEME (15 points)
    if (data.rge) {
      score += 5; // Données RGE disponibles
      if (data.rge.estRGE) score += 10; // Bonus si entreprise RGE
    }

    // Google (10 points)
    if (data.google?.rating) score += 7;
    if (data.google?.reviewsCount && data.google.reviewsCount > 0) score += 3;

    return Math.min(score, 100);
  }

  /**
   * Persiste les données enrichies dans Supabase
   */
  private async persistToSupabase(data: CompanyEnrichmentData): Promise<void> {
    const updateData: any = {
      siret: data.siret,
      siren: data.siren,
      name: data.name,

      // Sirene
      nic: data.sirene?.nic,
      denomination_usuelle: data.sirene?.denominationUsuelle,
      code_naf: data.sirene?.codeNaf,
      libelle_naf: data.sirene?.libelleNaf,
      tranche_effectifs: data.sirene?.trancheEffectifs,
      date_creation_etablissement: data.sirene?.dateCreation,
      etat_administratif: data.sirene?.etatAdministratif,
      adresse_complete: data.sirene?.adresseComplete,
      code_postal: data.sirene?.codePostal,
      commune: data.sirene?.commune,

      // Géocodage
      latitude: data.geo?.latitude,
      longitude: data.geo?.longitude,
      departement_code: data.geo?.departementCode,
      departement_nom: data.geo?.departementNom,
      region_code: data.geo?.regionCode,
      region_nom: data.geo?.regionNom,
      geo_score: data.geo?.geoScore,
      geo_source: data.geo?.geoSource,
      geo_updated_at: data.geo ? new Date().toISOString() : undefined,

      // Pappers
      chiffre_affaires: data.pappers?.chiffreAffaires,
      chiffre_affaires_annee: data.pappers?.chiffreAffairesAnnee,
      resultat_net: data.pappers?.resultatNet,
      capital_social: data.pappers?.capitalSocial,
      forme_juridique: data.pappers?.formeJuridique,
      pappers_score: data.pappers?.pappersScore,
      labels_rge: data.pappers?.labelsRge,
      dirigeants: data.pappers?.dirigeants,
      procedures_collectives: data.pappers?.proceduresCollectives,
      pappers_updated_at: data.pappers ? new Date().toISOString() : undefined,

      // Google
      google_place_id: data.google?.placeId,
      google_rating: data.google?.rating,
      google_reviews_count: data.google?.reviewsCount,
      google_reviews_sample: data.google?.reviewsSample,
      google_sentiment_score: data.google?.sentimentScore,
      google_updated_at: data.google?.placeId ? new Date().toISOString() : undefined,

      // Tracking
      data_sources: data.dataSources,
      data_quality_score: data.dataQualityScore,
      last_enriched_at: new Date().toISOString(),
      enrichment_errors: data.enrichmentErrors,
      scoring_details: data.scoringDetails,

      // Timestamp
      updated_at: new Date().toISOString(),
    };

    // Upsert basé sur le SIRET
    const { error } = await supabase
      .from('companies')
      .upsert(updateData, {
        onConflict: 'siret',
        ignoreDuplicates: false,
      });

    if (error) {
      console.error('[CompanyEnrichment] Erreur upsert:', error);
      throw error;
    }
  }

  /**
   * Enrichit les données d'un devis avec localisation et distance
   */
  async enrichDevis(
    devisId: string,
    companyId: string,
    adresseChantier: string
  ): Promise<{
    success: boolean;
    distance?: number;
    zone?: string;
    coefficient?: number;
    error?: string;
  }> {
    try {
      // 1. Récupérer les données de l'entreprise
      const { data: company } = await supabase
        .from('companies')
        .select('latitude, longitude, adresse_complete')
        .eq('id', companyId)
        .single();

      if (!company?.latitude || !company?.longitude) {
        return { success: false, error: 'Coordonnées entreprise manquantes' };
      }

      // 2. Géocoder l'adresse du chantier
      const geoResult = await geocodingService.geocode(adresseChantier, { limit: 1 });
      if (!geoResult.success || !geoResult.bestMatch) {
        return { success: false, error: 'Adresse chantier non trouvée' };
      }

      const chantier = geoResult.bestMatch;

      // 3. Calculer la distance
      const distanceResult = geocodingService.calculateDistanceFromCoords(
        { lat: company.latitude, lng: company.longitude },
        { lat: chantier.latitude, lng: chantier.longitude }
      );

      if (!distanceResult.success || !distanceResult.data) {
        return { success: false, error: 'Erreur calcul distance' };
      }

      const distance = distanceResult.data;

      // 4. Déterminer la zone et le coefficient
      let zoneProximite: string;
      if (distance.distanceKm < 15) zoneProximite = 'proximite_immediate';
      else if (distance.distanceKm < 30) zoneProximite = 'zone_locale';
      else if (distance.distanceKm < 75) zoneProximite = 'zone_departementale';
      else if (distance.distanceKm < 150) zoneProximite = 'zone_regionale';
      else zoneProximite = 'zone_nationale';

      // Coefficient régional
      const coefficients: Record<string, number> = {
        '11': 1.15, '93': 1.10, '84': 1.05, '44': 1.03, '32': 1.02,
        '28': 1.00, '52': 1.00, '53': 0.98, '75': 1.02, '76': 0.97,
      };
      const regionCode = chantier.departementCode
        ? this.getDepartementToRegion(chantier.departementCode)
        : '';
      const coefficient = coefficients[regionCode] || 1.00;

      // 5. Mettre à jour le devis
      const { error: updateError } = await supabase
        .from('devis')
        .update({
          adresse_chantier: chantier.label,
          chantier_latitude: chantier.latitude,
          chantier_longitude: chantier.longitude,
          chantier_code_postal: chantier.postcode,
          chantier_commune: chantier.city,
          chantier_departement_code: chantier.departementCode,
          chantier_departement_nom: chantier.departement,
          chantier_region_code: regionCode,
          chantier_region_nom: chantier.region,
          chantier_geo_score: chantier.score * 100,
          distance_km: distance.distanceKm,
          duree_trajet_minutes: distance.estimatedDurationMinutes,
          zone_proximite: zoneProximite,
          coefficient_regional: coefficient,
          coefficient_source: 'FFB',
          geo_enriched_at: new Date().toISOString(),
        })
        .eq('id', devisId);

      if (updateError) {
        console.error('[CompanyEnrichment] Erreur update devis:', updateError);
        return { success: false, error: 'Erreur mise à jour devis' };
      }

      return {
        success: true,
        distance: distance.distanceKm,
        zone: zoneProximite,
        coefficient,
      };

    } catch (err) {
      console.error('[CompanyEnrichment] Erreur enrichDevis:', err);
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Erreur inconnue',
      };
    }
  }

  /**
   * Mapping département → région
   */
  private getDepartementToRegion(deptCode: string): string {
    const mapping: Record<string, string> = {
      '75': '11', '77': '11', '78': '11', '91': '11', '92': '11', '93': '11', '94': '11', '95': '11',
      '69': '84', '38': '84', '42': '84', '01': '84', '73': '84', '74': '84', '63': '84',
      '13': '93', '06': '93', '83': '93', '84': '93', '04': '93', '05': '93',
      '31': '76', '34': '76', '30': '76', '66': '76', '11': '76', '09': '76',
      '33': '75', '64': '75', '40': '75', '47': '75', '24': '75',
      '59': '32', '62': '32', '60': '32', '80': '32', '02': '32',
      '44': '52', '49': '52', '53': '52', '72': '52', '85': '52',
      '35': '53', '22': '53', '29': '53', '56': '53',
      '67': '44', '68': '44', '57': '44', '54': '44', '55': '44', '88': '44', '51': '44', '52': '44', '10': '44', '08': '44',
      '76': '28', '27': '28', '14': '28', '50': '28', '61': '28',
    };
    return mapping[deptCode] || '';
  }

  /**
   * Vérifier le statut des APIs configurées
   */
  getStatus(): {
    sirene: boolean;
    pappers: boolean;
    geocoding: boolean;
    google: boolean;
    allConfigured: boolean;
  } {
    const entrepriseStatus = entrepriseUnifiedService.getStatus();

    return {
      sirene: entrepriseStatus.sirene,
      pappers: entrepriseStatus.pappers,
      geocoding: true, // API IGN toujours disponible (gratuite)
      google: false, // À implémenter
      allConfigured: entrepriseStatus.anyConfigured,
    };
  }
}

export const companyEnrichmentService = new CompanyEnrichmentService();
export default companyEnrichmentService;
