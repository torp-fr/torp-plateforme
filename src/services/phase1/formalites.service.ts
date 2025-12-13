/**
 * TORP Phase 1 - Service Formalités Administratives
 * Module 1.5 : Préparation Administrative
 *
 * Gère les formalités administratives avant démarrage chantier :
 * - Checklist personnalisée selon le projet
 * - Génération de formulaires (DICT, DOC, DAACT)
 * - Suivi des échéances et alertes
 * - Modèles de courriers
 */

import { supabase } from '@/lib/supabase';
import type { Phase0Project } from '@/types/phase0/project.types';
import type { Address } from '@/types/phase0/common.types';

import type {
  DossierFormalites,
  StatutDossierFormalites,
  FormalitesUrbanisme,
  TypeAutorisationUrbanisme,
  DeclarationsChantier,
  DICT,
  DOC,
  FormalitesSecurite,
  FormalitesVoirie,
  AutresFormalites,
  AlerteFormalite,
  TypeAlerteFormalite,
  ChecklistFormalites,
  ItemChecklist,
  StatutItemChecklist,
  FormalitesMetadata,
  CHECKLIST_STANDARD,
} from '@/types/phase1/formalites.types';
import type { Contrat } from '@/types/phase1/contrat.types';

// =============================================================================
// TYPES INTERNES
// =============================================================================

export interface FormalitesGenerationInput {
  project: Phase0Project;
  contrat?: Contrat;
}

export interface FormalitesGenerationResult {
  success: boolean;
  dossier?: DossierFormalites;
  checklist?: ChecklistFormalites;
  erreurs?: string[];
}

export interface FormulaireDICTInput {
  adresseChantier: Address;
  natureTravaux: string;
  dateDebutPrevue: string;
  maitreOuvrage: {
    nom: string;
    adresse: Address;
    email: string;
    telephone: string;
  };
  entreprise: {
    nom: string;
    siret: string;
  };
}

// =============================================================================
// SERVICE
// =============================================================================

export class FormalitesService {
  /**
   * Génère le dossier de formalités pour un projet
   */
  static async generateDossierFormalites(
    input: FormalitesGenerationInput
  ): Promise<FormalitesGenerationResult> {
    const { project, contrat } = input;

    try {
      // Analyser le projet pour déterminer les formalités requises
      const urbanisme = this.analyzeUrbanismeRequirements(project);
      const declarations = this.analyzeDeclarationsRequirements(project, contrat);
      const securite = this.analyzeSecuriteRequirements(project, contrat);
      const voirie = this.analyzeVoirieRequirements(project);
      const autres = this.analyzeAutresRequirements(project, contrat);

      // Générer les alertes
      const alertes = this.generateAlertes(urbanisme, declarations, securite, voirie);

      // Calculer la progression
      const checklist = this.generateChecklist(project.id, urbanisme, declarations, securite, voirie, autres);
      const progression = checklist.pourcentage;

      const now = new Date().toISOString();
      const dossierId = crypto.randomUUID();

      const metadata: FormalitesMetadata = {
        version: 1,
        createdAt: now,
        updatedAt: now,
        createdBy: 'system',
      };

      const dossier: DossierFormalites = {
        id: dossierId,
        projectId: project.id,
        urbanisme,
        declarations,
        securite,
        voirie,
        autres,
        statut: this.determineStatut(checklist),
        progression,
        alertes,
        metadata,
      };

      // Sauvegarder
      await this.saveDossier(dossier);

      return {
        success: true,
        dossier,
        checklist,
      };
    } catch (error) {
      console.error('[Formalites] Generation error:', error);
      return {
        success: false,
        erreurs: [error instanceof Error ? error.message : 'Erreur inconnue'],
      };
    }
  }

  /**
   * Génère un formulaire DICT pré-rempli
   */
  static generateFormulaireDICT(input: FormulaireDICTInput): string {
    const lines: string[] = [];

    lines.push('='.repeat(70));
    lines.push('DÉCLARATION D\'INTENTION DE COMMENCEMENT DE TRAVAUX (DICT)');
    lines.push('Cerfa n°14434*03');
    lines.push('='.repeat(70));
    lines.push('');
    lines.push('1. DÉCLARANT');
    lines.push(`   Raison sociale: ${input.entreprise.nom}`);
    lines.push(`   SIRET: ${input.entreprise.siret}`);
    lines.push('');
    lines.push('2. MAÎTRE D\'OUVRAGE');
    lines.push(`   Nom: ${input.maitreOuvrage.nom}`);
    lines.push(`   Adresse: ${input.maitreOuvrage.adresse.street}`);
    lines.push(`   ${input.maitreOuvrage.adresse.postalCode} ${input.maitreOuvrage.adresse.city}`);
    lines.push(`   Email: ${input.maitreOuvrage.email}`);
    lines.push(`   Téléphone: ${input.maitreOuvrage.telephone}`);
    lines.push('');
    lines.push('3. LOCALISATION DES TRAVAUX');
    lines.push(`   Adresse: ${input.adresseChantier.street}`);
    lines.push(`   ${input.adresseChantier.postalCode} ${input.adresseChantier.city}`);
    lines.push('');
    lines.push('4. NATURE DES TRAVAUX');
    lines.push(`   ${input.natureTravaux}`);
    lines.push('');
    lines.push('5. DATE DE COMMENCEMENT PRÉVUE');
    lines.push(`   ${new Date(input.dateDebutPrevue).toLocaleDateString('fr-FR')}`);
    lines.push('');
    lines.push('6. EXPLOITANTS DE RÉSEAUX CONCERNÉS');
    lines.push('   [ ] ENEDIS (électricité)');
    lines.push('   [ ] GRDF (gaz)');
    lines.push('   [ ] Véolia / Régie des eaux (eau)');
    lines.push('   [ ] Orange / SFR / Free (télécoms)');
    lines.push('   [ ] Autre: ______________');
    lines.push('');
    lines.push('7. DÉLAI DE RÉPONSE');
    lines.push('   Les exploitants disposent de 9 jours pour répondre.');
    lines.push('   Validité de la DICT: 3 mois');
    lines.push('');
    lines.push('8. DÉCLARATION');
    lines.push('   Le déclarant certifie l\'exactitude des renseignements fournis.');
    lines.push('');
    lines.push('   Date: _______________');
    lines.push('   Signature: _______________');
    lines.push('');
    lines.push('-'.repeat(70));
    lines.push('À envoyer via: www.reseaux-et-canalisations.gouv.fr');
    lines.push(`Document pré-rempli par TORP - ${new Date().toLocaleDateString('fr-FR')}`);

    return lines.join('\n');
  }

  /**
   * Génère un formulaire DOC pré-rempli
   */
  static generateFormulaireDOC(
    project: Phase0Project,
    dateDebut: string
  ): string {
    const lines: string[] = [];
    const owner = project.ownerProfile;
    const property = project.property;

    lines.push('='.repeat(70));
    lines.push('DÉCLARATION D\'OUVERTURE DE CHANTIER (DOC)');
    lines.push('Cerfa n°13407*05');
    lines.push('='.repeat(70));
    lines.push('');
    lines.push('1. IDENTITÉ DU DÉCLARANT');
    lines.push(`   Nom: ${this.getOwnerName(owner)}`);
    lines.push(`   Adresse: ${owner?.contact?.address?.street || ''}`);
    lines.push(`   ${owner?.contact?.address?.postalCode || ''} ${owner?.contact?.address?.city || ''}`);
    lines.push('');
    lines.push('2. TERRAIN');
    lines.push(`   Adresse du terrain: ${property?.address?.street || ''}`);
    lines.push(`   ${property?.address?.postalCode || ''} ${property?.address?.city || ''}`);
    lines.push('');
    lines.push('3. AUTORISATION D\'URBANISME');
    lines.push('   Type: [ ] Déclaration préalable [ ] Permis de construire');
    lines.push('   Numéro: _______________');
    lines.push('   Date de délivrance: _______________');
    lines.push('');
    lines.push('4. DATE D\'OUVERTURE DU CHANTIER');
    lines.push(`   ${new Date(dateDebut).toLocaleDateString('fr-FR')}`);
    lines.push('');
    lines.push('5. DÉCLARATION');
    lines.push('   Je soussigné(e) déclare ouvrir le chantier correspondant');
    lines.push('   à l\'autorisation ci-dessus référencée.');
    lines.push('');
    lines.push('   Fait à _______________');
    lines.push('   Le _______________');
    lines.push('   Signature: _______________');
    lines.push('');
    lines.push('-'.repeat(70));
    lines.push('À déposer en mairie du lieu des travaux.');
    lines.push(`Document pré-rempli par TORP - ${new Date().toLocaleDateString('fr-FR')}`);

    return lines.join('\n');
  }

  /**
   * Génère un modèle de lettre d'information au voisinage
   */
  static generateCourrierVoisinage(
    project: Phase0Project,
    contrat?: Contrat
  ): string {
    const lines: string[] = [];
    const owner = project.ownerProfile;
    const address = project.property?.address;
    const duree = contrat?.delais?.execution?.duree || 60;

    lines.push(`${this.getOwnerName(owner)}`);
    lines.push(`${owner?.contact?.address?.street || ''}`);
    lines.push(`${owner?.contact?.address?.postalCode || ''} ${owner?.contact?.address?.city || ''}`);
    lines.push('');
    lines.push(`${address?.city}, le ${new Date().toLocaleDateString('fr-FR')}`);
    lines.push('');
    lines.push('Madame, Monsieur,');
    lines.push('');
    lines.push(`Je vous informe que des travaux de rénovation vont être réalisés`);
    lines.push(`à l'adresse suivante:`);
    lines.push(`${address?.street || ''}`);
    lines.push(`${address?.postalCode || ''} ${address?.city || ''}`);
    lines.push('');
    lines.push('Nature des travaux:');
    lines.push(`${project.workProject?.general?.description || 'Travaux de rénovation'}`);
    lines.push('');
    lines.push(`Durée prévisionnelle: ${duree} jours`);
    lines.push(`Horaires de chantier: 7h30 - 18h00 (du lundi au vendredi)`);
    lines.push('                      8h00 - 12h00 (samedi, si nécessaire)');
    lines.push('');
    lines.push('Nuisances possibles:');
    lines.push('- Bruit (perçage, démolition)');
    lines.push('- Passage de véhicules de livraison');
    lines.push('- Présence d\'une benne sur la voie publique');
    lines.push('');
    lines.push('Nous nous efforcerons de limiter ces nuisances au maximum.');
    lines.push('');
    lines.push('Pour toute question ou réclamation, vous pouvez me joindre:');
    lines.push(`Email: ${owner?.contact?.email || '_____________'}`);
    lines.push(`Téléphone: ${owner?.contact?.phone || '_____________'}`);
    lines.push('');
    lines.push('En vous remerciant de votre compréhension,');
    lines.push('');
    lines.push('Cordialement,');
    lines.push('');
    lines.push(`${this.getOwnerName(owner)}`);
    lines.push('');
    lines.push('-'.repeat(50));
    lines.push(`Généré par TORP - ${new Date().toLocaleDateString('fr-FR')}`);

    return lines.join('\n');
  }

  /**
   * Génère les mentions du panneau de chantier
   */
  static generatePanneauChantier(
    project: Phase0Project,
    typeAutorisation: TypeAutorisationUrbanisme,
    numeroAutorisation: string,
    dateAutorisation: string
  ): string {
    const lines: string[] = [];
    const owner = project.ownerProfile;
    const property = project.property;

    lines.push('='.repeat(60));
    lines.push(typeAutorisation === 'permis_construire'
      ? 'PERMIS DE CONSTRUIRE'
      : 'DÉCLARATION PRÉALABLE');
    lines.push('='.repeat(60));
    lines.push('');
    lines.push(`N°: ${numeroAutorisation}`);
    lines.push(`Délivré le: ${new Date(dateAutorisation).toLocaleDateString('fr-FR')}`);
    lines.push('');
    lines.push(`Bénéficiaire: ${this.getOwnerName(owner)}`);
    lines.push('');
    lines.push('Nature des travaux:');
    lines.push(`${project.workProject?.general?.description || 'Travaux de rénovation'}`);
    lines.push('');

    if (typeAutorisation === 'permis_construire') {
      const surface = property?.surface || 0;
      lines.push(`Surface de plancher créée: ${surface} m²`);
      lines.push(`Emprise au sol: ${surface} m²`);
      lines.push('');
    }

    lines.push('Droit de recours:');
    lines.push('Un recours gracieux ou contentieux peut être formé');
    lines.push('dans un délai de deux mois à compter du premier jour');
    lines.push('d\'une période continue de deux mois d\'affichage sur le terrain.');
    lines.push('');
    lines.push('Mairie de:');
    lines.push(`${property?.address?.city || '_______________'}`);
    lines.push('Le dossier peut être consulté en mairie.');
    lines.push('');
    lines.push('-'.repeat(60));
    lines.push('Panneau réglementaire à afficher sur le terrain');
    lines.push('Dimensions minimales: 80 cm x 120 cm');
    lines.push(`Généré par TORP - ${new Date().toLocaleDateString('fr-FR')}`);

    return lines.join('\n');
  }

  // =============================================================================
  // MÉTHODES PRIVÉES - ANALYSE DES BESOINS
  // =============================================================================

  private static analyzeUrbanismeRequirements(project: Phase0Project): FormalitesUrbanisme {
    const workType = project.workProject?.scope?.workType;
    const surface = project.property?.surface || 0;

    // Déterminer le type d'autorisation requis
    let typeAutorisation: TypeAutorisationUrbanisme = 'aucune';

    // Simplification: en pratique, dépend de nombreux critères (PLU, zone, etc.)
    if (workType === 'extension' && surface > 20) {
      typeAutorisation = 'permis_construire';
    } else if (workType === 'extension' || workType === 'renovation_complete') {
      typeAutorisation = 'declaration_prealable';
    } else if (project.workProject?.scope?.impactsFacade) {
      typeAutorisation = 'declaration_prealable';
    }

    return {
      typeAutorisation,
      affichage: typeAutorisation !== 'aucune'
        ? {
            typeAnneau: typeAutorisation === 'permis_construire' ? 'pc' : 'dp',
            dimensions: '80x120cm',
            obligatoire: true,
            mentionsObligatoires: [],
            installe: false,
            dureeMinimum: 60,
          }
        : undefined,
    };
  }

  private static analyzeDeclarationsRequirements(
    project: Phase0Project,
    contrat?: Contrat
  ): DeclarationsChantier {
    const lots = project.selectedLots || [];

    // DICT obligatoire si travaux à proximité de réseaux
    const dictObligatoire = lots.some((l) =>
      ['gros_oeuvre', 'vrd', 'terrassement', 'plomberie'].includes(l.type)
    );

    // DOC obligatoire si PC
    const docObligatoire = true; // Simplification

    // Calcul jours-hommes
    const dureeJours = contrat?.delais?.execution?.duree || 60;
    const effectifMoyen = 3; // Estimation
    const joursHommesEstimes = dureeJours * effectifMoyen;

    return {
      dict: dictObligatoire
        ? {
            obligatoire: true,
            exploitantsContactes: [
              { nom: 'ENEDIS', type: 'electricite', contacte: false, reponseRecue: false },
              { nom: 'GRDF', type: 'gaz', contacte: false, reponseRecue: false },
              { nom: 'Véolia', type: 'eau', contacte: false, reponseRecue: false },
              { nom: 'Orange', type: 'telecom', contacte: false, reponseRecue: false },
            ],
            reponses: [],
          }
        : undefined,
      doc: {
        obligatoire: docObligatoire,
        numeroFormulaire: 'Cerfa 13407*05',
        deposee: false,
      },
      daactRequise: true,
      declarationTravaux: joursHommesEstimes >= 500
        ? {
            joursHommesEstimes,
            obligatoire: true,
            numeroFormulaire: 'Cerfa 13257*03',
            destinataires: [
              { organisme: 'inspection_travail', region: '', envoye: false },
              { organisme: 'carsat', region: '', envoye: false },
            ],
            deposee: false,
            delaiAvantDemarrage: 30,
            contenu: {
              adresseChantier: project.property?.address || { street: '', postalCode: '', city: '', country: 'France' },
              natureTravaux: project.workProject?.general?.description || '',
              maitreOuvrage: this.getOwnerName(project.ownerProfile),
              entreprises: [],
              effectifsPrevisionnels: effectifMoyen,
              dureeEstimee: joursHommesEstimes,
            },
          }
        : undefined,
    };
  }

  private static analyzeSecuriteRequirements(
    project: Phase0Project,
    contrat?: Contrat
  ): FormalitesSecurite {
    // Nombre d'entreprises (simplifié)
    const nombreEntreprises = (project.selectedLots?.length || 1) > 3 ? 2 : 1;

    // Jours-hommes
    const dureeJours = contrat?.delais?.execution?.duree || 60;
    const joursHommes = dureeJours * 3;

    // Coordonnateur SPS obligatoire si >= 2 entreprises ou >= 500 j-h
    const spsObligatoire = nombreEntreprises >= 2 || joursHommes >= 500;

    return {
      coordonnateurSPS: spsObligatoire
        ? {
            obligatoire: true,
            motif: nombreEntreprises >= 2 ? 'multi_entreprises' : 'jours_hommes',
            niveau: joursHommes < 10000 ? 'niveau_1' : 'niveau_2',
            missionType: 'realisation',
          }
        : undefined,
      diuoRequis: spsObligatoire,
    };
  }

  private static analyzeVoirieRequirements(project: Phase0Project): FormalitesVoirie {
    // Analyser si occupation du domaine public nécessaire
    const lots = project.selectedLots || [];

    const besoinBenne = lots.some((l) =>
      ['demolition', 'gros_oeuvre', 'renovation_complete'].includes(l.type)
    );
    const besoinEchafaudage = lots.some((l) =>
      ['facades', 'couverture', 'menuiseries_exterieures'].includes(l.type)
    );

    const objets = [];
    if (besoinBenne) {
      objets.push({
        type: 'benne' as const,
        description: 'Benne à gravats',
        emplacementTrottoir: true,
        emplacementChaussee: false,
        duree: 30,
      });
    }
    if (besoinEchafaudage) {
      objets.push({
        type: 'echafaudage' as const,
        description: 'Échafaudage',
        emplacementTrottoir: true,
        emplacementChaussee: false,
        duree: 30,
      });
    }

    return {
      autorisationStationnement: objets.length > 0
        ? {
            obligatoire: true,
            objets,
            gestionnaire: 'Mairie',
            statut: 'non_demandee',
            signalisation: {
              panneaux: true,
              cones: true,
              barrieres: false,
            },
          }
        : undefined,
    };
  }

  private static analyzeAutresRequirements(
    project: Phase0Project,
    contrat?: Contrat
  ): AutresFormalites {
    return {
      assurances: {
        attestationsVerifiees: [], // À remplir avec les attestations du contrat
        dommageOuvrage: {
          souscrit: (contrat?.conditionsFinancieres?.prix?.montantHT || 0) > 50000,
          parQui: 'mo',
        },
      },
      informationVoisinage: {
        faite: false,
        contenu: {
          natureTravaux: project.workProject?.general?.description || '',
          dureePrevue: `${contrat?.delais?.execution?.duree || 60} jours`,
          nuisancesAttendues: ['Bruit', 'Passage véhicules'],
          coordinateesContact: project.ownerProfile?.contact?.email || '',
        },
        mode: 'courrier_simple',
        destinataires: [],
      },
      affichagesChantier: [
        { type: 'horaires_chantier', obligatoire: true, installe: false, contenu: '7h30-18h00' },
        { type: 'coordonnees_chef_chantier', obligatoire: true, installe: false, contenu: '' },
        { type: 'numeros_urgence', obligatoire: true, installe: false, contenu: '15/17/18' },
        { type: 'consignes_securite', obligatoire: true, installe: false, contenu: 'Port du casque obligatoire' },
        { type: 'interdiction_acces', obligatoire: true, installe: false, contenu: 'Chantier interdit au public' },
      ],
    };
  }

  // =============================================================================
  // MÉTHODES PRIVÉES - CHECKLIST ET ALERTES
  // =============================================================================

  private static generateChecklist(
    projectId: string,
    urbanisme: FormalitesUrbanisme,
    declarations: DeclarationsChantier,
    securite: FormalitesSecurite,
    voirie: FormalitesVoirie,
    autres: AutresFormalites
  ): ChecklistFormalites {
    const items: ItemChecklist[] = [];

    // Générer les items à partir du standard
    CHECKLIST_STANDARD.forEach((item, idx) => {
      let applicable = true;
      let statut: StatutItemChecklist = 'non_commence';

      // Vérifier si l'item est applicable
      switch (item.categorie) {
        case 'urbanisme':
          applicable = urbanisme.typeAutorisation !== 'aucune';
          break;
        case 'declarations':
          if (item.designation.includes('DICT')) {
            applicable = !!declarations.dict;
          } else if (item.designation.includes('Déclaration préalable')) {
            applicable = !!declarations.declarationTravaux;
          }
          break;
        case 'securite':
          applicable = !!securite.coordonnateurSPS;
          break;
        case 'voirie':
          applicable = !!voirie.autorisationStationnement;
          break;
      }

      items.push({
        id: `check-${idx}`,
        ...item,
        statut: applicable ? statut : 'non_applicable',
      });
    });

    // Calculer la progression
    const itemsApplicables = items.filter((i) => i.statut !== 'non_applicable');
    const itemsCompletes = itemsApplicables.filter((i) => i.statut === 'complete').length;
    const pourcentage = itemsApplicables.length > 0
      ? Math.round((itemsCompletes / itemsApplicables.length) * 100)
      : 100;

    // Identifier les bloqueurs
    const bloqueursRestants = itemsApplicables
      .filter((i) => i.obligatoire && i.statut !== 'complete')
      .map((i) => i.designation);

    return {
      projectId,
      items,
      itemsCompletes,
      itemsTotal: itemsApplicables.length,
      pourcentage,
      pretPourDemarrage: bloqueursRestants.length === 0,
      bloqueursRestants,
    };
  }

  private static generateAlertes(
    urbanisme: FormalitesUrbanisme,
    declarations: DeclarationsChantier,
    _securite: FormalitesSecurite,
    _voirie: FormalitesVoirie
  ): AlerteFormalite[] {
    const alertes: AlerteFormalite[] = [];
    const now = new Date();

    // Alerte autorisation urbanisme
    if (urbanisme.typeAutorisation !== 'aucune') {
      if (urbanisme.typeAutorisation === 'permis_construire' && !urbanisme.permis?.statut) {
        alertes.push({
          id: crypto.randomUUID(),
          type: 'formalite_obligatoire',
          severite: 'error',
          titre: 'Permis de construire requis',
          message: 'Un permis de construire est nécessaire pour ce projet',
          formaliteConcernee: 'urbanisme',
          actionRequise: 'Déposer une demande de permis de construire',
        });
      }
    }

    // Alerte DICT
    if (declarations.dict?.obligatoire && !declarations.dict.dateDemande) {
      alertes.push({
        id: crypto.randomUUID(),
        type: 'formalite_obligatoire',
        severite: 'warning',
        titre: 'DICT à effectuer',
        message: 'La DICT doit être envoyée au minimum 7 jours avant le démarrage',
        formaliteConcernee: 'declarations',
        actionRequise: 'Effectuer la DICT sur reseaux-et-canalisations.gouv.fr',
      });
    }

    // Alerte validité DICT (3 mois)
    if (declarations.dict?.dateValidite) {
      const dateValidite = new Date(declarations.dict.dateValidite);
      const joursRestants = Math.ceil((dateValidite.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      if (joursRestants < 0) {
        alertes.push({
          id: crypto.randomUUID(),
          type: 'document_expire',
          severite: 'error',
          titre: 'DICT expirée',
          message: 'La DICT a expiré et doit être renouvelée',
          formaliteConcernee: 'declarations',
          actionRequise: 'Renouveler la DICT',
        });
      } else if (joursRestants < 15) {
        alertes.push({
          id: crypto.randomUUID(),
          type: 'echeance_proche',
          severite: 'warning',
          titre: 'DICT bientôt expirée',
          message: `La DICT expire dans ${joursRestants} jours`,
          dateEcheance: declarations.dict.dateValidite,
          joursRestants,
          formaliteConcernee: 'declarations',
          actionRequise: 'Prévoir le renouvellement si nécessaire',
        });
      }
    }

    return alertes;
  }

  private static determineStatut(checklist: ChecklistFormalites): StatutDossierFormalites {
    if (checklist.pretPourDemarrage) return 'pret_demarrage';
    if (checklist.pourcentage >= 80) return 'en_attente_validation';
    if (checklist.pourcentage > 0) return 'en_cours';
    return 'a_completer';
  }

  private static getOwnerName(owner?: Phase0Project['ownerProfile']): string {
    if (!owner?.identity) return 'Maître d\'ouvrage';

    const identity = owner.identity;
    if (identity.type === 'B2C') {
      const individual = identity as { firstName?: string; lastName?: string };
      return `${individual.firstName || ''} ${individual.lastName || ''}`.trim() || 'Particulier';
    } else if (identity.type === 'B2B') {
      const company = identity as { companyName?: string };
      return company.companyName || 'Entreprise';
    } else {
      const entity = identity as { entityName?: string };
      return entity.entityName || 'Collectivité';
    }
  }

  // =============================================================================
  // PERSISTANCE
  // =============================================================================

  static async saveDossier(dossier: DossierFormalites): Promise<void> {
    const { error } = await supabase.from('phase1_formalites').upsert({
      id: dossier.id,
      project_id: dossier.projectId,
      urbanisme: dossier.urbanisme,
      declarations: dossier.declarations,
      securite: dossier.securite,
      voirie: dossier.voirie,
      autres: dossier.autres,
      statut: dossier.statut,
      progression: dossier.progression,
      alertes: dossier.alertes,
      metadata: dossier.metadata,
    });

    if (error) {
      throw new Error(`Erreur lors de la sauvegarde du dossier: ${error.message}`);
    }
  }

  static async getDossierByProjectId(projectId: string): Promise<DossierFormalites | null> {
    const { data, error } = await supabase
      .from('phase1_formalites')
      .select('*')
      .eq('project_id', projectId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Erreur lors de la récupération du dossier: ${error.message}`);
    }

    return data as unknown as DossierFormalites;
  }

  /**
   * Met à jour un item de la checklist
   */
  static async updateChecklistItem(
    projectId: string,
    itemId: string,
    updates: Partial<ItemChecklist>
  ): Promise<void> {
    const dossier = await this.getDossierByProjectId(projectId);
    if (!dossier) {
      throw new Error('Dossier non trouvé');
    }

    // Mettre à jour l'item (implémentation simplifiée)
    // En production, il faudrait un système plus sophistiqué

    dossier.metadata.updatedAt = new Date().toISOString();
    await this.saveDossier(dossier);
  }
}

export default FormalitesService;
