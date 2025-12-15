/**
 * Service Réception des Travaux
 * Gestion de la réception formelle, PV, signatures et effets juridiques
 */

import { supabase } from '@/lib/supabase';
import {
  Reception,
  ReceptionDecision,
  ReceptionSignataire,
  Reserve,
  OPRSession,
  ParticipantRole,
} from '@/types/phase4.types';
import { oprService } from './opr.service';
import { emailService } from '@/services/email/email.service';
import { v4 as uuidv4 } from 'uuid';

// =====================================================
// TEMPLATES PV
// =====================================================

const PV_RECEPTION_TEMPLATE = `
# PROCÈS-VERBAL DE RÉCEPTION DES TRAVAUX

## Identification du chantier
- **Référence**: {{chantierReference}}
- **Adresse**: {{chantierAdresse}}
- **Maître d'ouvrage**: {{maitreOuvrage}}

## Date et lieu
- **Date de réception**: {{dateReception}}
- **Lieu**: {{lieu}}

## Participants présents

{{#each participants}}
- {{nom}} ({{role}}) {{#if entreprise}}- {{entreprise}}{{/if}}
{{/each}}

## Constatations

Suite aux opérations préalables à la réception effectuées le {{dateOPR}}, les parties constatent :

### Travaux réalisés
{{travauxDescription}}

### Documents fournis
{{#each documentsVerifies}}
- {{nom}}: {{#if present}}✓ Présent{{else}}✗ Absent{{/if}}
{{/each}}

## Réserves

{{#if reserves.length}}
Les réserves suivantes ont été émises :

| N° | Nature | Localisation | Gravité | Entreprise | Délai |
|----|--------|--------------|---------|------------|-------|
{{#each reserves}}
| {{numero}} | {{nature}} | {{localisation}} | {{gravite}} | {{entrepriseNom}} | {{delaiLeveeJours}} jours |
{{/each}}

**Nombre total de réserves**: {{reserves.length}}
{{else}}
Aucune réserve n'a été émise.
{{/if}}

## Décision

**La réception est prononcée**: {{decisionText}}

{{#if motifRefus}}
**Motif**: {{motifRefus}}
{{/if}}

{{#if dateNouvelleOPR}}
**Date de nouvelle visite**: {{dateNouvelleOPR}}
{{/if}}

## Effets juridiques

{{#if transfertGarde}}
- Le transfert de garde est effectif à compter du {{dateTransfertGarde}}
{{/if}}
{{#if demarrageGaranties}}
- Les garanties légales (parfait achèvement, biennale, décennale) démarrent à compter du {{dateDemarrageGaranties}}
{{/if}}

## Aspects financiers

- **Solde dû**: {{soldeDu}} €
- **Retenue de garantie (5%)**: {{retenueGarantie}} €
{{#if montantReservesRetenu}}
- **Montant retenu pour réserves**: {{montantReservesRetenu}} €
{{/if}}

## Signatures

{{#each signataires}}
### {{nom}} - {{role}}
{{#if entreprise}}Entreprise: {{entreprise}}{{/if}}

{{#if mentionManuscrite}}_{{mentionManuscrite}}_{{/if}}

Signé le {{dateSignature}}

[Signature]

---
{{/each}}

---
*Document généré automatiquement par TORP le {{dateGeneration}}*
`;

// =====================================================
// SERVICE
// =====================================================

class ReceptionService {
  // =====================================================
  // CRÉATION DE LA RÉCEPTION
  // =====================================================

  /**
   * Crée une réception à partir d'une session OPR
   */
  async createReception(
    oprSessionId: string,
    params: {
      decision: ReceptionDecision;
      motifRefus?: string;
      dateNouvelleOPR?: string;
      soldeDu: number;
      retenueGarantie: number;
      montantReservesRetenu?: number;
    }
  ): Promise<Reception> {
    const session = await oprService.getSession(oprSessionId);
    if (!session) {
      throw new Error('Session OPR non trouvée');
    }

    // Vérifier que la session est terminée
    if (session.statut !== 'terminee') {
      throw new Error('La session OPR doit être terminée pour créer une réception');
    }

    // Vérifier les conditions selon la décision
    if (params.decision === 'acceptee_sans_reserve' && session.reserves.length > 0) {
      throw new Error('Impossible de prononcer une réception sans réserve avec des réserves existantes');
    }

    if (params.decision === 'refusee' && !params.motifRefus) {
      throw new Error('Un motif est requis pour refuser la réception');
    }

    if (params.decision === 'reportee' && !params.dateNouvelleOPR) {
      throw new Error('Une date de nouvelle OPR est requise pour reporter la réception');
    }

    const receptionId = uuidv4();
    const now = new Date().toISOString();

    // Déterminer les effets juridiques selon la décision
    const isAccepted = params.decision === 'acceptee_sans_reserve' || params.decision === 'acceptee_avec_reserves';

    const reception: Reception = {
      id: receptionId,
      chantierId: session.chantierId,
      oprId: oprSessionId,
      dateReception: now,
      lieu: session.lieu,
      decision: params.decision,
      motifRefus: params.motifRefus,
      dateNouvelleOPR: params.dateNouvelleOPR,
      signataires: [],
      reserves: session.reserves,
      nombreReserves: session.reserves.length,
      nombreReservesLevees: 0,
      pvGenere: false,
      pvSigne: false,
      transfertGarde: isAccepted,
      dateTransfertGarde: isAccepted ? now : undefined,
      demarragGaranties: isAccepted,
      dateDemarageGaranties: isAccepted ? now : undefined,
      soldeDu: params.soldeDu,
      retenueGarantie: params.retenueGarantie,
      montantReservesRetenu: params.montantReservesRetenu || 0,
      createdAt: now,
      updatedAt: now,
    };

    // Sauvegarder en base
    const { error } = await supabase.from('receptions').insert({
      id: reception.id,
      chantier_id: reception.chantierId,
      opr_id: reception.oprId,
      date_reception: reception.dateReception,
      lieu: reception.lieu,
      decision: reception.decision,
      motif_refus: reception.motifRefus,
      date_nouvelle_opr: reception.dateNouvelleOPR,
      signataires: reception.signataires,
      reserves: reception.reserves,
      nombre_reserves: reception.nombreReserves,
      nombre_reserves_levees: reception.nombreReservesLevees,
      pv_genere: reception.pvGenere,
      pv_signe: reception.pvSigne,
      transfert_garde: reception.transfertGarde,
      date_transfert_garde: reception.dateTransfertGarde,
      demarrage_garanties: reception.demarragGaranties,
      date_demarrage_garanties: reception.dateDemarageGaranties,
      solde_du: reception.soldeDu,
      retenue_garantie: reception.retenueGarantie,
      montant_reserves_retenu: reception.montantReservesRetenu,
      created_at: reception.createdAt,
      updated_at: reception.updatedAt,
    });

    if (error) {
      console.error('[Reception] Erreur création:', error);
      throw new Error('Impossible de créer la réception');
    }

    // Si acceptée, créer les garanties automatiquement
    if (isAccepted) {
      await this.initializeGaranties(reception);
    }

    return reception;
  }

  /**
   * Récupère une réception
   */
  async getReception(receptionId: string): Promise<Reception | null> {
    const { data, error } = await supabase
      .from('receptions')
      .select('*')
      .eq('id', receptionId)
      .single();

    if (error || !data) {
      return null;
    }

    return this.mapDbToReception(data);
  }

  /**
   * Récupère la réception d'un chantier
   */
  async getReceptionByChantier(chantierId: string): Promise<Reception | null> {
    const { data, error } = await supabase
      .from('receptions')
      .select('*')
      .eq('chantier_id', chantierId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return null;
    }

    return this.mapDbToReception(data);
  }

  // =====================================================
  // SIGNATURES
  // =====================================================

  /**
   * Ajoute une signature à la réception
   */
  async addSignature(
    receptionId: string,
    signataire: {
      participantId: string;
      role: ParticipantRole;
      nom: string;
      entreprise?: string;
      signatureBase64: string;
      mentionManuscrite?: string;
    }
  ): Promise<ReceptionSignataire> {
    const reception = await this.getReception(receptionId);
    if (!reception) {
      throw new Error('Réception non trouvée');
    }

    const newSignataire: ReceptionSignataire = {
      id: uuidv4(),
      participantId: signataire.participantId,
      role: signataire.role,
      nom: signataire.nom,
      entreprise: signataire.entreprise,
      signature: signataire.signatureBase64,
      dateSignature: new Date().toISOString(),
      mentionManuscrite: signataire.mentionManuscrite,
    };

    reception.signataires.push(newSignataire);

    await supabase
      .from('receptions')
      .update({
        signataires: reception.signataires,
        updated_at: new Date().toISOString(),
      })
      .eq('id', receptionId);

    return newSignataire;
  }

  /**
   * Vérifie si toutes les signatures nécessaires sont présentes
   */
  async checkSignaturesComplete(receptionId: string): Promise<{
    complete: boolean;
    missing: ParticipantRole[];
  }> {
    const reception = await this.getReception(receptionId);
    if (!reception) {
      throw new Error('Réception non trouvée');
    }

    // Rôles obligatoires
    const rolesObligatoires: ParticipantRole[] = ['maitre_ouvrage'];

    // Au moins une entreprise doit signer
    const hasEntreprise = reception.signataires.some(s => s.role === 'entreprise');

    const signedRoles = reception.signataires.map(s => s.role);
    const missing: ParticipantRole[] = [];

    for (const role of rolesObligatoires) {
      if (!signedRoles.includes(role)) {
        missing.push(role);
      }
    }

    if (!hasEntreprise) {
      missing.push('entreprise');
    }

    return {
      complete: missing.length === 0,
      missing,
    };
  }

  /**
   * Finalise la réception (marque le PV comme signé)
   */
  async finalizeReception(receptionId: string): Promise<Reception | null> {
    const { complete, missing } = await this.checkSignaturesComplete(receptionId);

    if (!complete) {
      throw new Error(`Signatures manquantes: ${missing.join(', ')}`);
    }

    const { data, error } = await supabase
      .from('receptions')
      .update({
        pv_signe: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', receptionId)
      .select()
      .single();

    if (error || !data) {
      return null;
    }

    // Envoyer les notifications
    await this.sendReceptionNotifications(receptionId);

    return this.mapDbToReception(data);
  }

  // =====================================================
  // GÉNÉRATION DU PV
  // =====================================================

  /**
   * Génère le PV de réception
   */
  async generatePV(receptionId: string): Promise<string> {
    const reception = await this.getReception(receptionId);
    if (!reception) {
      throw new Error('Réception non trouvée');
    }

    const session = await oprService.getSession(reception.oprId);
    if (!session) {
      throw new Error('Session OPR non trouvée');
    }

    // Récupérer les infos du chantier
    const { data: chantier } = await supabase
      .from('chantiers')
      .select('*')
      .eq('id', reception.chantierId)
      .single();

    // Préparer les données pour le template
    const templateData = {
      chantierReference: chantier?.reference || reception.chantierId,
      chantierAdresse: chantier?.adresse || session.lieu,
      maitreOuvrage: this.getMaitreOuvrageNom(session.participants),
      dateReception: new Date(reception.dateReception).toLocaleDateString('fr-FR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
      lieu: reception.lieu,
      participants: session.participants.filter(p => p.present).map(p => ({
        nom: `${p.prenom} ${p.nom}`,
        role: this.translateRole(p.role),
        entreprise: p.entreprise,
      })),
      dateOPR: new Date(session.dateOPR).toLocaleDateString('fr-FR'),
      travauxDescription: 'Travaux de construction/rénovation',
      documentsVerifies: session.documentsVerifies,
      reserves: reception.reserves.map(r => ({
        ...r,
        gravite: this.translateGravite(r.gravite),
      })),
      decisionText: this.translateDecision(reception.decision),
      motifRefus: reception.motifRefus,
      dateNouvelleOPR: reception.dateNouvelleOPR
        ? new Date(reception.dateNouvelleOPR).toLocaleDateString('fr-FR')
        : undefined,
      transfertGarde: reception.transfertGarde,
      dateTransfertGarde: reception.dateTransfertGarde
        ? new Date(reception.dateTransfertGarde).toLocaleDateString('fr-FR')
        : undefined,
      demarrageGaranties: reception.demarragGaranties,
      dateDemarrageGaranties: reception.dateDemarageGaranties
        ? new Date(reception.dateDemarageGaranties).toLocaleDateString('fr-FR')
        : undefined,
      soldeDu: reception.soldeDu.toLocaleString('fr-FR'),
      retenueGarantie: reception.retenueGarantie.toLocaleString('fr-FR'),
      montantReservesRetenu: reception.montantReservesRetenu.toLocaleString('fr-FR'),
      signataires: reception.signataires.map(s => ({
        ...s,
        role: this.translateRole(s.role),
        dateSignature: new Date(s.dateSignature).toLocaleDateString('fr-FR'),
      })),
      dateGeneration: new Date().toLocaleDateString('fr-FR'),
    };

    // Générer le contenu (simple remplacement de variables)
    let pvContent = PV_RECEPTION_TEMPLATE;
    pvContent = this.processTemplate(pvContent, templateData);

    // Mettre à jour la réception
    await supabase
      .from('receptions')
      .update({
        pv_genere: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', receptionId);

    return pvContent;
  }

  /**
   * Sauvegarde le PV généré
   */
  async savePV(receptionId: string, pvUrl: string): Promise<void> {
    await supabase
      .from('receptions')
      .update({
        pv_reception_url: pvUrl,
        pv_genere: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', receptionId);
  }

  // =====================================================
  // NOTIFICATIONS
  // =====================================================

  /**
   * Envoie les notifications de réception
   */
  async sendReceptionNotifications(receptionId: string): Promise<void> {
    const reception = await this.getReception(receptionId);
    if (!reception) return;

    const session = await oprService.getSession(reception.oprId);
    if (!session) return;

    const { data: chantier } = await supabase
      .from('chantiers')
      .select('*')
      .eq('id', reception.chantierId)
      .single();

    // Envoyer à tous les participants
    for (const participant of session.participants) {
      if (participant.email) {
        try {
          await emailService.sendTemplatedEmail(
            participant.email,
            'reception_prononcee',
            {
              participantNom: `${participant.prenom} ${participant.nom}`,
              chantierReference: chantier?.reference || reception.chantierId,
              dateReception: new Date(reception.dateReception).toLocaleDateString('fr-FR'),
              decision: this.translateDecision(reception.decision),
              nombreReserves: reception.nombreReserves,
              linkPV: `https://torp.fr/chantier/${reception.chantierId}/reception/${reception.id}`,
            }
          );
        } catch (error) {
          console.error(`[Reception] Erreur envoi notification à ${participant.email}:`, error);
        }
      }
    }
  }

  // =====================================================
  // CALCULS FINANCIERS
  // =====================================================

  /**
   * Calcule la retenue de garantie standard (5%)
   */
  calculateRetenueGarantie(montantMarche: number): number {
    return Math.round(montantMarche * 0.05 * 100) / 100;
  }

  /**
   * Calcule le montant à retenir pour les réserves
   */
  calculateMontantReserves(reserves: Reserve[]): number {
    return reserves.reduce((total, reserve) => {
      return total + (reserve.coutEstime || 0);
    }, 0);
  }

  /**
   * Calcule le solde à payer
   */
  calculateSolde(
    montantMarche: number,
    acomptesDejaPaes: number,
    retenueGarantie: number,
    montantReserves: number
  ): number {
    return montantMarche - acomptesDejaPaes - retenueGarantie - montantReserves;
  }

  // =====================================================
  // GARANTIES
  // =====================================================

  /**
   * Initialise les garanties après réception
   */
  private async initializeGaranties(reception: Reception): Promise<void> {
    const dateDebut = new Date(reception.dateReception);

    // Garantie de parfait achèvement (1 an)
    const finPA = new Date(dateDebut);
    finPA.setFullYear(finPA.getFullYear() + 1);

    // Garantie biennale (2 ans)
    const finBi = new Date(dateDebut);
    finBi.setFullYear(finBi.getFullYear() + 2);

    // Garantie décennale (10 ans)
    const finDe = new Date(dateDebut);
    finDe.setFullYear(finDe.getFullYear() + 10);

    const garanties = [
      {
        id: uuidv4(),
        chantier_id: reception.chantierId,
        reception_id: reception.id,
        type: 'parfait_achevement',
        duree_annees: 1,
        date_debut: dateDebut.toISOString(),
        date_fin: finPA.toISOString(),
        perimetre: 'Tous désordres apparents ou signalés dans l\'année suivant la réception',
        exclusions: ['Usure normale', 'Défaut d\'entretien'],
        active: true,
        expiree: false,
        desordres: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: uuidv4(),
        chantier_id: reception.chantierId,
        reception_id: reception.id,
        type: 'biennale',
        duree_annees: 2,
        date_debut: dateDebut.toISOString(),
        date_fin: finBi.toISOString(),
        perimetre: 'Éléments d\'équipement dissociables du bâtiment',
        exclusions: ['Éléments inertes', 'Structure'],
        active: true,
        expiree: false,
        desordres: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: uuidv4(),
        chantier_id: reception.chantierId,
        reception_id: reception.id,
        type: 'decennale',
        duree_annees: 10,
        date_debut: dateDebut.toISOString(),
        date_fin: finDe.toISOString(),
        perimetre: 'Désordres compromettant la solidité ou rendant l\'ouvrage impropre à sa destination',
        exclusions: ['Désordres esthétiques', 'Équipements dissociables'],
        active: true,
        expiree: false,
        desordres: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    for (const garantie of garanties) {
      await supabase.from('garanties').insert(garantie);
    }
  }

  // =====================================================
  // MÉTHODES PRIVÉES
  // =====================================================

  private getMaitreOuvrageNom(participants: OPRSession['participants']): string {
    const mo = participants.find(p => p.role === 'maitre_ouvrage');
    return mo ? `${mo.prenom} ${mo.nom}` : 'Non spécifié';
  }

  private translateRole(role: ParticipantRole): string {
    const translations: Record<ParticipantRole, string> = {
      maitre_ouvrage: 'Maître d\'ouvrage',
      maitre_oeuvre: 'Maître d\'œuvre',
      entreprise: 'Entreprise',
      bureau_controle: 'Bureau de contrôle',
      coordonnateur_sps: 'Coordonnateur SPS',
      expert: 'Expert',
      assureur: 'Assureur',
    };
    return translations[role] || role;
  }

  private translateDecision(decision: ReceptionDecision): string {
    const translations: Record<ReceptionDecision, string> = {
      acceptee_sans_reserve: 'ACCEPTÉE sans réserve',
      acceptee_avec_reserves: 'ACCEPTÉE avec réserves',
      refusee: 'REFUSÉE',
      reportee: 'REPORTÉE',
    };
    return translations[decision] || decision;
  }

  private translateGravite(gravite: string): string {
    const translations: Record<string, string> = {
      mineure: 'Mineure',
      majeure: 'Majeure',
      grave: 'Grave',
      non_conformite_substantielle: 'Non-conformité substantielle',
    };
    return translations[gravite] || gravite;
  }

  private processTemplate(template: string, data: Record<string, unknown>): string {
    let result = template;

    // Remplacer les variables simples {{variable}}
    result = result.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      const value = data[key];
      if (value === undefined || value === null) return '';
      return String(value);
    });

    // Traiter les boucles {{#each items}}...{{/each}}
    result = result.replace(
      /\{\{#each (\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g,
      (match, arrayName, itemTemplate) => {
        const array = data[arrayName] as unknown[];
        if (!Array.isArray(array)) return '';

        return array.map(item => {
          let itemResult = itemTemplate;
          if (typeof item === 'object' && item !== null) {
            for (const [key, value] of Object.entries(item)) {
              itemResult = itemResult.replace(
                new RegExp(`\\{\\{${key}\\}\\}`, 'g'),
                String(value ?? '')
              );
            }
          }
          return itemResult;
        }).join('');
      }
    );

    // Traiter les conditions {{#if condition}}...{{/if}}
    result = result.replace(
      /\{\{#if (\w+(?:\.\w+)*)\}\}([\s\S]*?)\{\{\/if\}\}/g,
      (match, condition, content) => {
        const value = this.getNestedValue(data, condition);
        if (value && (Array.isArray(value) ? value.length > 0 : true)) {
          return content;
        }
        return '';
      }
    );

    return result;
  }

  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce((current: unknown, key) => {
      if (current && typeof current === 'object') {
        return (current as Record<string, unknown>)[key];
      }
      return undefined;
    }, obj);
  }

  private mapDbToReception(data: Record<string, unknown>): Reception {
    return {
      id: data.id as string,
      chantierId: data.chantier_id as string,
      oprId: data.opr_id as string,
      dateReception: data.date_reception as string,
      lieu: data.lieu as string,
      decision: data.decision as ReceptionDecision,
      motifRefus: data.motif_refus as string | undefined,
      dateNouvelleOPR: data.date_nouvelle_opr as string | undefined,
      signataires: (data.signataires as ReceptionSignataire[]) || [],
      reserves: (data.reserves as Reserve[]) || [],
      nombreReserves: data.nombre_reserves as number,
      nombreReservesLevees: data.nombre_reserves_levees as number,
      pvReceptionUrl: data.pv_reception_url as string | undefined,
      pvGenere: data.pv_genere as boolean,
      pvSigne: data.pv_signe as boolean,
      transfertGarde: data.transfert_garde as boolean,
      dateTransfertGarde: data.date_transfert_garde as string | undefined,
      demarragGaranties: data.demarrage_garanties as boolean,
      dateDemarageGaranties: data.date_demarrage_garanties as string | undefined,
      soldeDu: data.solde_du as number,
      retenueGarantie: data.retenue_garantie as number,
      montantReservesRetenu: data.montant_reserves_retenu as number,
      createdAt: data.created_at as string,
      updatedAt: data.updated_at as string,
    };
  }
}

export const receptionService = new ReceptionService();
export default receptionService;
