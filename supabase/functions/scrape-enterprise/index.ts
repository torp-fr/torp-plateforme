import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import {
  searchEntreprise,
  getRGECertifications,
  getBODACCAnnonces,
  getQualibatCertification,
  getQualifelecCertification,
  getOPQIBICertification,
  getURSSAFAttestation,
  getDGFIPAttestation,
  getDGFIPChiffresAffaires,
  getInfogreffeKbis,
  type APIEntrepriseConfig,
  type RechercheEntrepriseResult
} from '../_shared/api-clients.ts';

interface EnterpriseFullData {
  // Identité
  siren: string;
  siret: string;
  nom: string;
  formeJuridique?: string;
  dateCreation?: string;
  etatAdministratif: string;

  // Adresse
  adresse?: string;
  codePostal?: string;
  ville?: string;
  latitude?: string;
  longitude?: string;

  // Données économiques
  categorieEntreprise?: string;
  effectif?: string;
  activitePrincipale?: string;
  chiffreAffaires?: { annee: string; montant: number }[];

  // Dirigeants
  dirigeants?: {
    nom: string;
    prenom?: string;
    qualite: string;
    dateNaissance?: string;
  }[];

  // Certifications
  certifications: {
    rge: {
      actif: boolean;
      qualifications: {
        nom: string;
        organisme: string;
        domaine: string;
        dateDebut: string;
        dateFin: string;
      }[];
    };
    qualibat?: any;
    qualifelec?: any;
    opqibi?: any;
  };

  // Conformité
  conformite: {
    urssaf?: { valide: boolean; dateValidite?: string };
    dgfip?: { valide: boolean; dateValidite?: string };
  };

  // Annonces légales
  annoncesLegales?: {
    type: string;
    date: string;
    tribunal?: string;
  }[];

  // Scores et alertes
  score: {
    global: number;
    details: {
      anciennete: number;
      certifications: number;
      conformite: number;
      stabilite: number;
    };
  };
  alertes: string[];
}

function calculateScore(data: Partial<EnterpriseFullData>): {
  global: number;
  details: { anciennete: number; certifications: number; conformite: number; stabilite: number };
} {
  const details = {
    anciennete: 0,
    certifications: 0,
    conformite: 0,
    stabilite: 0
  };

  // Ancienneté (max 25 pts)
  if (data.dateCreation) {
    const years = new Date().getFullYear() - new Date(data.dateCreation).getFullYear();
    details.anciennete = Math.min(25, years * 2.5);
  }

  // Certifications (max 35 pts)
  if (data.certifications?.rge?.actif) {
    details.certifications += 20;
    details.certifications += Math.min(15, (data.certifications.rge.qualifications?.length || 0) * 3);
  }
  if (data.certifications?.qualibat) details.certifications = Math.min(35, details.certifications + 10);
  if (data.certifications?.qualifelec) details.certifications = Math.min(35, details.certifications + 10);

  // Conformité (max 25 pts)
  if (data.conformite?.urssaf?.valide) details.conformite += 12;
  if (data.conformite?.dgfip?.valide) details.conformite += 13;

  // Stabilité (max 15 pts)
  if (data.etatAdministratif === 'A') details.stabilite += 10;
  if (!data.annoncesLegales?.some(a => a.type.includes('liquidation') || a.type.includes('redressement'))) {
    details.stabilite += 5;
  }

  return {
    global: Math.round(details.anciennete + details.certifications + details.conformite + details.stabilite),
    details
  };
}

function generateAlertes(data: Partial<EnterpriseFullData>): string[] {
  const alertes: string[] = [];

  if (data.etatAdministratif !== 'A') {
    alertes.push('CRITIQUE: Entreprise cessée ou en cours de cessation');
  }

  if (!data.certifications?.rge?.actif) {
    alertes.push('ATTENTION: Pas de certification RGE active - Vérifier éligibilité aides');
  }

  if (!data.conformite?.urssaf?.valide) {
    alertes.push('ATTENTION: Attestation URSSAF non vérifiée');
  }

  if (data.dateCreation) {
    const years = new Date().getFullYear() - new Date(data.dateCreation).getFullYear();
    if (years < 2) {
      alertes.push('INFO: Entreprise récente (< 2 ans)');
    }
  }

  // Check RGE expiration
  data.certifications?.rge?.qualifications?.forEach(q => {
    const expDate = new Date(q.dateFin);
    const now = new Date();
    const daysUntilExp = (expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    if (daysUntilExp < 0) {
      alertes.push(`ATTENTION: Certification RGE "${q.nom}" expirée`);
    } else if (daysUntilExp < 90) {
      alertes.push(`INFO: Certification RGE "${q.nom}" expire dans ${Math.round(daysUntilExp)} jours`);
    }
  });

  return alertes;
}

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const { siret, siren, nom, codePostal, includeAPIs = [] } = await req.json();

    if (!siret && !siren && !nom) {
      return new Response(
        JSON.stringify({ error: 'siret, siren ou nom requis' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result: Partial<EnterpriseFullData> = {
      certifications: { rge: { actif: false, qualifications: [] } },
      conformite: {},
      alertes: []
    };
    const sources: string[] = [];
    const errors: string[] = [];

    // 1. API Recherche Entreprises (gratuite, ouverte)
    try {
      const searchResult = await searchEntreprise({
        siret,
        siren,
        q: nom,
        code_postal: codePostal
      });

      if (searchResult.results.length > 0) {
        const entreprise = searchResult.results[0];
        result.siren = entreprise.siren;
        result.siret = entreprise.siege?.siret || siret || '';
        result.nom = entreprise.nom_complet;
        result.formeJuridique = entreprise.nature_juridique;
        result.dateCreation = entreprise.date_creation;
        result.etatAdministratif = entreprise.etat_administratif;
        result.adresse = entreprise.siege?.adresse;
        result.codePostal = entreprise.siege?.code_postal;
        result.ville = entreprise.siege?.libelle_commune;
        result.latitude = entreprise.siege?.latitude;
        result.longitude = entreprise.siege?.longitude;
        result.categorieEntreprise = entreprise.categorie_entreprise;
        result.effectif = entreprise.tranche_effectif_salarie;
        result.activitePrincipale = entreprise.activite_principale;

        if (entreprise.dirigeants) {
          result.dirigeants = entreprise.dirigeants.map((d: any) => ({
            nom: d.nom || d.denomination,
            prenom: d.prenoms,
            qualite: d.qualite,
            dateNaissance: d.date_de_naissance
          }));
        }

        if (entreprise.finances) {
          result.chiffreAffaires = Object.entries(entreprise.finances).map(([annee, data]: [string, any]) => ({
            annee,
            montant: data.ca
          }));
        }

        sources.push('API Recherche Entreprises (gouv.fr)');
      }
    } catch (e) {
      errors.push(`Recherche Entreprises: ${e}`);
    }

    // 2. API RGE ADEME (gratuite, ouverte)
    try {
      const rgeData = await getRGECertifications({
        siret: result.siret || siret,
        nom: result.nom || nom,
        code_postal: result.codePostal || codePostal
      });

      if (rgeData.length > 0) {
        result.certifications!.rge = {
          actif: true,
          qualifications: rgeData.map(r => ({
            nom: r.nom_qualification,
            organisme: r.organisme,
            domaine: r.domaine,
            dateDebut: r.date_debut,
            dateFin: r.date_fin
          }))
        };
        sources.push('ADEME - Liste RGE');
      }
    } catch (e) {
      errors.push(`RGE ADEME: ${e}`);
    }

    // 3. BODACC - Annonces légales (gratuit, ouvert)
    if (result.siren || siren) {
      try {
        const bodaccData = await getBODACCAnnonces(result.siren || siren);
        if (bodaccData.length > 0) {
          result.annoncesLegales = bodaccData.map(a => ({
            type: a.typeavis || a.familleavis,
            date: a.dateparution,
            tribunal: a.tribunal
          }));
          sources.push('BODACC');
        }
      } catch (e) {
        errors.push(`BODACC: ${e}`);
      }
    }

    // 4. APIs avec token (API Entreprise)
    const apiEntrepriseToken = Deno.env.get('API_ENTREPRISE_TOKEN');
    if (apiEntrepriseToken && result.siret) {
      const config: APIEntrepriseConfig = {
        token: apiEntrepriseToken,
        context: 'Analyse devis TORP',
        recipient: Deno.env.get('API_ENTREPRISE_RECIPIENT') || '00000000000000'
      };

      // Qualibat
      if (includeAPIs.includes('qualibat') || includeAPIs.includes('all')) {
        try {
          const qualibat = await getQualibatCertification(result.siret, config);
          if (qualibat) {
            result.certifications!.qualibat = qualibat;
            sources.push('Qualibat (API Entreprise)');
          }
        } catch (e) {
          errors.push(`Qualibat: ${e}`);
        }
      }

      // Qualifelec
      if (includeAPIs.includes('qualifelec') || includeAPIs.includes('all')) {
        try {
          const qualifelec = await getQualifelecCertification(result.siret, config);
          if (qualifelec) {
            result.certifications!.qualifelec = qualifelec;
            sources.push('Qualifelec (API Entreprise)');
          }
        } catch (e) {
          errors.push(`Qualifelec: ${e}`);
        }
      }

      // OPQIBI
      if ((includeAPIs.includes('opqibi') || includeAPIs.includes('all')) && result.siren) {
        try {
          const opqibi = await getOPQIBICertification(result.siren, config);
          if (opqibi) {
            result.certifications!.opqibi = opqibi;
            sources.push('OPQIBI (API Entreprise)');
          }
        } catch (e) {
          errors.push(`OPQIBI: ${e}`);
        }
      }

      // URSSAF
      if ((includeAPIs.includes('urssaf') || includeAPIs.includes('all')) && result.siren) {
        try {
          const urssaf = await getURSSAFAttestation(result.siren, config);
          if (urssaf) {
            result.conformite!.urssaf = {
              valide: urssaf.data?.entity_status === 'ok',
              dateValidite: urssaf.data?.date_fin_validite
            };
            sources.push('URSSAF (API Entreprise)');
          }
        } catch (e) {
          errors.push(`URSSAF: ${e}`);
        }
      }

      // DGFIP
      if ((includeAPIs.includes('dgfip') || includeAPIs.includes('all')) && result.siren) {
        try {
          const dgfip = await getDGFIPAttestation(result.siren, config);
          if (dgfip) {
            result.conformite!.dgfip = {
              valide: dgfip.data?.entity_status === 'ok',
              dateValidite: dgfip.data?.date_fin_validite
            };
            sources.push('DGFIP (API Entreprise)');
          }
        } catch (e) {
          errors.push(`DGFIP: ${e}`);
        }
      }

      // Chiffres d'affaires (si pas déjà récupérés)
      if (includeAPIs.includes('ca') || includeAPIs.includes('all')) {
        try {
          const ca = await getDGFIPChiffresAffaires(result.siret, config);
          if (ca?.data) {
            result.chiffreAffaires = ca.data.map((d: any) => ({
              annee: d.annee,
              montant: d.chiffre_affaires
            }));
            sources.push('DGFIP CA (API Entreprise)');
          }
        } catch (e) {
          errors.push(`DGFIP CA: ${e}`);
        }
      }

      // Kbis
      if ((includeAPIs.includes('kbis') || includeAPIs.includes('all')) && result.siren) {
        try {
          const kbis = await getInfogreffeKbis(result.siren, config);
          if (kbis) {
            sources.push('Infogreffe Kbis (API Entreprise)');
          }
        } catch (e) {
          errors.push(`Kbis: ${e}`);
        }
      }
    }

    // Calculate score and alerts
    result.score = calculateScore(result);
    result.alertes = generateAlertes(result);

    return new Response(
      JSON.stringify({
        success: true,
        enterprise: result,
        sources,
        warnings: errors.length > 0 ? errors : undefined,
        apiEntrepriseAvailable: !!apiEntrepriseToken
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
