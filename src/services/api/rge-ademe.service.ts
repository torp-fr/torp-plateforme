import { log, warn, error, time, timeEnd } from '@/lib/logger';

/**
 * Service API RGE ADEME
 *
 * Vérifie les qualifications RGE des entreprises via l'API Open Data ADEME.
 * API GRATUITE - Licence Ouverte / Open Licence
 *
 * Documentation : https://data.ademe.fr/datasets/historique-rge
 * Base URL : https://data.ademe.fr/data-fair/api/v1/datasets/historique-rge
 */

const RGE_API_BASE = 'https://data.ademe.fr/data-fair/api/v1/datasets/historique-rge';

// ============================================
// TYPES
// ============================================

export interface RGEQualification {
  // Identification
  siret: string;
  nomEntreprise: string;

  // Qualification
  codeQualification: string;
  nomQualification: string;
  domaine: string;
  metaDomaine: 'Travaux d\'efficacité énergétique' | 'Installations d\'énergies renouvelables' | 'Etudes énergétiques' | 'Rénovation globale' | 'Inconnu' | 'Non renseigné';

  // Validité
  dateDebut: string;        // Format ISO
  dateFin: string;          // Format ISO
  estActive: boolean;       // Calculé : dateFin > aujourd'hui ET traitement_termine = false
  joursRestants: number;    // Nombre de jours avant expiration

  // Organisme
  organisme: string;        // qualibat, qualitenr, qualifelec, etc.

  // Certificat
  urlCertificat: string | null;

  // Contact entreprise (bonus)
  telephone: string | null;
  email: string | null;
  siteInternet: string | null;

  // Localisation
  adresse: string | null;
  codePostal: string | null;
  commune: string | null;
  latitude: number | null;
  longitude: number | null;

  // Particuliers
  travailleParticuliers: boolean;
}

export interface RGEEntreprise {
  siret: string;
  nomEntreprise: string;

  // Statut global
  estRGE: boolean;                    // Au moins 1 qualification active
  nombreQualificationsActives: number;
  nombreQualificationsTotales: number;

  // Qualifications actives
  qualificationsActives: RGEQualification[];

  // Domaines couverts (actifs)
  domainesActifs: string[];
  metaDomainesActifs: string[];

  // Organismes
  organismesCertificateurs: string[];

  // Alertes
  alertes: {
    type: 'expiration_proche' | 'qualification_expiree' | 'aucune_qualification';
    message: string;
    qualification?: string;
    dateFin?: string;
  }[];

  // Prochaine expiration
  prochaineExpiration: {
    qualification: string;
    dateFin: string;
    joursRestants: number;
  } | null;

  // URLs des certificats
  certificats: {
    qualification: string;
    url: string;
  }[];

  // Contact
  telephone: string | null;
  email: string | null;
  siteInternet: string | null;

  // Score RGE (pour le scoring TORP)
  scoreRGE: number;  // 0-100

  // Métadonnées
  lastUpdate: string;
  source: 'ademe_rge';
}

// ============================================
// SERVICE
// ============================================

class RGEAdemeService {

  /**
   * Vérifie si l'API est accessible
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${RGE_API_BASE}?size=1`);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Recherche les qualifications RGE d'une entreprise par SIRET
   */
  async getQualificationsBySiret(siret: string): Promise<{
    success: boolean;
    data?: RGEEntreprise;
    error?: string;
  }> {
    // Nettoyer le SIRET
    const cleanSiret = siret.replace(/\s/g, '');

    if (cleanSiret.length !== 14) {
      return { success: false, error: 'SIRET invalide (14 chiffres requis)' };
    }

    try {
      log('[RGE ADEME] Recherche qualifications pour SIRET:', cleanSiret);

      // Requête API - récupérer TOUTES les qualifications (actives et expirées)
      const params = new URLSearchParams({
        qs: `siret:${cleanSiret}`,
        size: '100',
        select: [
          'siret',
          'nom_entreprise',
          'adresse',
          'code_postal',
          'commune',
          'latitude',
          'longitude',
          'telephone',
          'email',
          'site_internet',
          'code_qualification',
          'nom_qualification',
          'domaine',
          'meta_domaine',
          'organisme',
          'lien_date_debut',
          'lien_date_fin',
          'url_qualification',
          'traitement_termine',
          'particulier',
        ].join(','),
      });

      const response = await fetch(`${RGE_API_BASE}/lines?${params}`);

      if (!response.ok) {
        console.error('[RGE ADEME] Erreur API:', response.status);
        return {
          success: false,
          error: `Erreur API ADEME: ${response.status}`,
        };
      }

      const data = await response.json();

      log('[RGE ADEME] Résultats:', data.results?.length || 0, 'qualifications');

      // Pas de résultat = entreprise non RGE
      if (!data.results || data.results.length === 0) {
        return {
          success: true,
          data: {
            siret: cleanSiret,
            nomEntreprise: '',
            estRGE: false,
            nombreQualificationsActives: 0,
            nombreQualificationsTotales: 0,
            qualificationsActives: [],
            domainesActifs: [],
            metaDomainesActifs: [],
            organismesCertificateurs: [],
            alertes: [{
              type: 'aucune_qualification',
              message: 'Aucune qualification RGE trouvée pour cette entreprise',
            }],
            prochaineExpiration: null,
            certificats: [],
            telephone: null,
            email: null,
            siteInternet: null,
            scoreRGE: 0,
            lastUpdate: new Date().toISOString(),
            source: 'ademe_rge',
          },
        };
      }

      // Mapper les résultats
      const entreprise = this.mapToEntreprise(data.results, cleanSiret);

      log('[RGE ADEME] Entreprise:', entreprise.nomEntreprise);
      log('[RGE ADEME] Est RGE:', entreprise.estRGE);
      log('[RGE ADEME] Qualifications actives:', entreprise.nombreQualificationsActives);
      log('[RGE ADEME] Score RGE:', entreprise.scoreRGE);

      return { success: true, data: entreprise };

    } catch (error) {
      console.error('[RGE ADEME] Erreur:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur de connexion',
      };
    }
  }

  /**
   * Recherche par nom d'entreprise
   */
  async searchByName(nom: string, options?: {
    codePostal?: string;
    domaine?: string;
    limit?: number;
  }): Promise<{
    success: boolean;
    data?: RGEEntreprise[];
    total?: number;
    error?: string;
  }> {
    try {
      // Construire la requête
      let query = `nom_entreprise:*${nom}* AND traitement_termine:false`;

      if (options?.codePostal) {
        query += ` AND code_postal:${options.codePostal}`;
      }

      if (options?.domaine) {
        query += ` AND domaine:"${options.domaine}"`;
      }

      const params = new URLSearchParams({
        qs: query,
        size: String(options?.limit || 20),
        select: 'siret,nom_entreprise,adresse,code_postal,commune,domaine,meta_domaine,organisme,lien_date_fin',
      });

      const response = await fetch(`${RGE_API_BASE}/lines?${params}`);

      if (!response.ok) {
        return { success: false, error: `Erreur API: ${response.status}` };
      }

      const data = await response.json();

      // Grouper par SIRET
      const parSiret = new Map<string, any[]>();
      for (const result of data.results || []) {
        const siret = result.siret;
        if (!parSiret.has(siret)) {
          parSiret.set(siret, []);
        }
        parSiret.get(siret)!.push(result);
      }

      // Mapper chaque entreprise
      const entreprises: RGEEntreprise[] = [];
      for (const [siret, results] of parSiret) {
        entreprises.push(this.mapToEntreprise(results, siret));
      }

      return {
        success: true,
        data: entreprises,
        total: data.total,
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur de connexion',
      };
    }
  }

  /**
   * Vérifie si une entreprise a une qualification pour un domaine spécifique
   */
  async verifyQualificationForDomaine(
    siret: string,
    domaine: string
  ): Promise<{
    qualified: boolean;
    qualification?: RGEQualification;
    message: string;
  }> {
    const result = await this.getQualificationsBySiret(siret);

    if (!result.success || !result.data) {
      return {
        qualified: false,
        message: result.error || 'Impossible de vérifier la qualification',
      };
    }

    // Chercher une qualification active pour ce domaine
    const qualification = result.data.qualificationsActives.find(q =>
      q.domaine.toLowerCase().includes(domaine.toLowerCase()) ||
      domaine.toLowerCase().includes(q.domaine.toLowerCase())
    );

    if (qualification) {
      return {
        qualified: true,
        qualification,
        message: `Qualification RGE "${qualification.nomQualification}" valide jusqu'au ${new Date(qualification.dateFin).toLocaleDateString('fr-FR')}`,
      };
    }

    return {
      qualified: false,
      message: `Aucune qualification RGE active pour le domaine "${domaine}"`,
    };
  }

  /**
   * Calcule le score RGE pour le scoring TORP
   */
  calculateRGEScore(entreprise: RGEEntreprise): number {
    let score = 0;

    // Base : est RGE (50 pts)
    if (entreprise.estRGE) {
      score += 50;
    } else {
      return 0;
    }

    // Nombre de qualifications actives (jusqu'à 20 pts)
    // 1 qualification = 5pts, 2 = 10pts, 3 = 15pts, 4+ = 20pts
    score += Math.min(20, entreprise.nombreQualificationsActives * 5);

    // Diversité des domaines (jusqu'à 15 pts)
    const nbMetaDomaines = entreprise.metaDomainesActifs.length;
    if (nbMetaDomaines >= 3) score += 15;
    else if (nbMetaDomaines >= 2) score += 10;
    else if (nbMetaDomaines >= 1) score += 5;

    // Pérennité : qualifications loin de l'expiration (jusqu'à 15 pts)
    if (entreprise.prochaineExpiration) {
      const jours = entreprise.prochaineExpiration.joursRestants;
      if (jours > 365) score += 15;       // > 1 an
      else if (jours > 180) score += 10;  // > 6 mois
      else if (jours > 90) score += 5;    // > 3 mois
      // < 3 mois = 0 pts (risque)
    }

    return Math.min(100, score);
  }

  /**
   * Mappe les résultats bruts vers notre format
   */
  private mapToEntreprise(results: any[], siret: string): RGEEntreprise {
    const today = new Date();
    const alertes: RGEEntreprise['alertes'] = [];
    const qualificationsActives: RGEQualification[] = [];
    const certificats: { qualification: string; url: string }[] = [];

    // Premier résultat pour les infos générales
    const first = results[0] || {};

    // Traiter chaque qualification
    for (const row of results) {
      const dateFin = row.lien_date_fin ? new Date(row.lien_date_fin) : null;
      const estTraitementTermine = row.traitement_termine === true || row.traitement_termine === 'true';
      const estActive = !estTraitementTermine && dateFin && dateFin > today;

      // Calculer les jours restants
      const joursRestants = dateFin
        ? Math.ceil((dateFin.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
        : 0;

      const qualification: RGEQualification = {
        siret: row.siret,
        nomEntreprise: row.nom_entreprise || '',
        codeQualification: row.code_qualification || '',
        nomQualification: row.nom_qualification || '',
        domaine: row.domaine || 'Non renseigné',
        metaDomaine: row.meta_domaine || 'Non renseigné',
        dateDebut: row.lien_date_debut || '',
        dateFin: row.lien_date_fin || '',
        estActive: estActive || false,
        joursRestants: Math.max(0, joursRestants),
        organisme: row.organisme || 'Non renseigné',
        urlCertificat: row.url_qualification || null,
        telephone: row.telephone || null,
        email: row.email || null,
        siteInternet: row.site_internet || null,
        adresse: row.adresse || null,
        codePostal: row.code_postal || null,
        commune: row.commune || null,
        latitude: row.latitude || null,
        longitude: row.longitude || null,
        travailleParticuliers: row.particulier === true || row.particulier === 'true',
      };

      if (estActive) {
        qualificationsActives.push(qualification);

        // Alerte si expiration proche (< 90 jours)
        if (joursRestants > 0 && joursRestants <= 90) {
          alertes.push({
            type: 'expiration_proche',
            message: `Qualification "${row.nom_qualification}" expire dans ${joursRestants} jours`,
            qualification: row.nom_qualification,
            dateFin: row.lien_date_fin,
          });
        }

        // Ajouter le certificat
        if (row.url_qualification) {
          certificats.push({
            qualification: row.nom_qualification || row.domaine,
            url: row.url_qualification,
          });
        }
      } else if (dateFin && dateFin <= today && !estTraitementTermine) {
        // Qualification expirée récemment
        alertes.push({
          type: 'qualification_expiree',
          message: `Qualification "${row.nom_qualification}" expirée depuis le ${dateFin.toLocaleDateString('fr-FR')}`,
          qualification: row.nom_qualification,
          dateFin: row.lien_date_fin,
        });
      }
    }

    // Domaines et méta-domaines actifs (sans doublons)
    const domainesActifs = [...new Set(qualificationsActives.map(q => q.domaine))];
    const metaDomainesActifs = [...new Set(qualificationsActives.map(q => q.metaDomaine))];
    const organismes = [...new Set(qualificationsActives.map(q => q.organisme))];

    // Trouver la prochaine expiration
    let prochaineExpiration: RGEEntreprise['prochaineExpiration'] = null;
    if (qualificationsActives.length > 0) {
      const sorted = [...qualificationsActives].sort((a, b) => a.joursRestants - b.joursRestants);
      const premiere = sorted[0];
      prochaineExpiration = {
        qualification: premiere.nomQualification || premiere.domaine,
        dateFin: premiere.dateFin,
        joursRestants: premiere.joursRestants,
      };
    }

    // Construire l'objet entreprise
    const entreprise: RGEEntreprise = {
      siret,
      nomEntreprise: first.nom_entreprise || '',
      estRGE: qualificationsActives.length > 0,
      nombreQualificationsActives: qualificationsActives.length,
      nombreQualificationsTotales: results.length,
      qualificationsActives,
      domainesActifs,
      metaDomainesActifs,
      organismesCertificateurs: organismes,
      alertes,
      prochaineExpiration,
      certificats,
      telephone: first.telephone || null,
      email: first.email || null,
      siteInternet: first.site_internet || null,
      scoreRGE: 0, // Calculé après
      lastUpdate: new Date().toISOString(),
      source: 'ademe_rge',
    };

    // Calculer le score
    entreprise.scoreRGE = this.calculateRGEScore(entreprise);

    return entreprise;
  }
}

export const rgeAdemeService = new RGEAdemeService();
export default rgeAdemeService;
