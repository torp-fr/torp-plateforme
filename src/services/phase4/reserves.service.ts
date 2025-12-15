/**
 * Service Levée des Réserves
 * Gestion du suivi, contrôle et levée des réserves après réception
 */

import { supabase } from '@/lib/supabase';
import {
  Reserve,
  ReserveStatut,
  ReserveGravite,
  ReservePhoto,
  VisiteLeveeReserves,
  ReserveControle,
  OPRParticipant,
} from '@/types/phase4.types';
import { emailService } from '@/services/email/email.service';
import { v4 as uuidv4 } from 'uuid';

// =====================================================
// SERVICE
// =====================================================

class ReservesService {
  // =====================================================
  // GESTION DES RÉSERVES
  // =====================================================

  /**
   * Récupère une réserve par ID
   */
  async getReserve(reserveId: string): Promise<Reserve | null> {
    const { data, error } = await supabase
      .from('reserves')
      .select('*')
      .eq('id', reserveId)
      .single();

    if (error || !data) {
      return null;
    }

    return this.mapDbToReserve(data);
  }

  /**
   * Liste les réserves d'un chantier
   */
  async getReservesByChantier(chantierId: string): Promise<Reserve[]> {
    const { data, error } = await supabase
      .from('reserves')
      .select('*')
      .eq('chantier_id', chantierId)
      .order('numero', { ascending: true });

    if (error || !data) {
      return [];
    }

    return data.map(this.mapDbToReserve);
  }

  /**
   * Liste les réserves par statut
   */
  async getReservesByStatut(
    chantierId: string,
    statut: ReserveStatut
  ): Promise<Reserve[]> {
    const { data, error } = await supabase
      .from('reserves')
      .select('*')
      .eq('chantier_id', chantierId)
      .eq('statut', statut)
      .order('numero', { ascending: true });

    if (error || !data) {
      return [];
    }

    return data.map(this.mapDbToReserve);
  }

  /**
   * Liste les réserves d'une entreprise
   */
  async getReservesByEntreprise(entrepriseId: string): Promise<Reserve[]> {
    const { data, error } = await supabase
      .from('reserves')
      .select('*')
      .eq('entreprise_id', entrepriseId)
      .order('date_echeance', { ascending: true });

    if (error || !data) {
      return [];
    }

    return data.map(this.mapDbToReserve);
  }

  /**
   * Liste les réserves en retard
   */
  async getReservesEnRetard(chantierId?: string): Promise<Reserve[]> {
    let query = supabase
      .from('reserves')
      .select('*')
      .in('statut', ['ouverte', 'en_cours'])
      .lt('date_echeance', new Date().toISOString());

    if (chantierId) {
      query = query.eq('chantier_id', chantierId);
    }

    const { data, error } = await query.order('date_echeance', { ascending: true });

    if (error || !data) {
      return [];
    }

    return data.map(this.mapDbToReserve);
  }

  // =====================================================
  // MISE À JOUR DES RÉSERVES
  // =====================================================

  /**
   * Met à jour le statut d'une réserve
   */
  async updateStatut(
    reserveId: string,
    nouveauStatut: ReserveStatut,
    commentaire?: string
  ): Promise<Reserve | null> {
    const updateData: Record<string, unknown> = {
      statut: nouveauStatut,
      updated_at: new Date().toISOString(),
    };

    if (nouveauStatut === 'levee') {
      updateData.date_levee = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('reserves')
      .update(updateData)
      .eq('id', reserveId)
      .select()
      .single();

    if (error || !data) {
      return null;
    }

    // Enregistrer l'historique
    await this.logHistorique(reserveId, {
      action: 'changement_statut',
      ancienStatut: undefined,
      nouveauStatut,
      commentaire,
    });

    return this.mapDbToReserve(data);
  }

  /**
   * Marque une réserve comme en cours de traitement
   */
  async startTraitement(reserveId: string): Promise<Reserve | null> {
    return this.updateStatut(reserveId, 'en_cours');
  }

  /**
   * Marque une réserve comme levée
   */
  async leverReserve(
    reserveId: string,
    params: {
      leveePar: string;
      commentaire?: string;
      photosApres?: string[];
    }
  ): Promise<Reserve | null> {
    const { data, error } = await supabase
      .from('reserves')
      .update({
        statut: 'levee',
        date_levee: new Date().toISOString(),
        levee_par: params.leveePar,
        commentaire_levee: params.commentaire,
        photos_apres: params.photosApres || [],
        updated_at: new Date().toISOString(),
      })
      .eq('id', reserveId)
      .select()
      .single();

    if (error || !data) {
      return null;
    }

    // Notifier le maître d'ouvrage
    await this.notifyReserveLevee(reserveId);

    return this.mapDbToReserve(data);
  }

  /**
   * Conteste une réserve (par l'entreprise)
   */
  async contesterReserve(
    reserveId: string,
    params: {
      motif: string;
      documents?: string[];
    }
  ): Promise<Reserve | null> {
    const { data, error } = await supabase
      .from('reserves')
      .update({
        statut: 'contestee',
        contestee: true,
        motif_contestation: params.motif,
        date_contestation: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', reserveId)
      .select()
      .single();

    if (error || !data) {
      return null;
    }

    // Notifier le maître d'ouvrage
    await this.notifyContestation(reserveId, params.motif);

    return this.mapDbToReserve(data);
  }

  /**
   * Prolonge le délai d'une réserve
   */
  async prolongerDelai(
    reserveId: string,
    joursSupplementaires: number,
    motif: string
  ): Promise<Reserve | null> {
    const reserve = await this.getReserve(reserveId);
    if (!reserve) return null;

    const nouvelleEcheance = new Date(reserve.dateEcheance);
    nouvelleEcheance.setDate(nouvelleEcheance.getDate() + joursSupplementaires);

    const { data, error } = await supabase
      .from('reserves')
      .update({
        date_echeance: nouvelleEcheance.toISOString(),
        delai_levee_jours: reserve.delaiLeveeJours + joursSupplementaires,
        updated_at: new Date().toISOString(),
      })
      .eq('id', reserveId)
      .select()
      .single();

    if (error || !data) {
      return null;
    }

    await this.logHistorique(reserveId, {
      action: 'prolongation_delai',
      joursSupplementaires,
      motif,
    });

    return this.mapDbToReserve(data);
  }

  // =====================================================
  // PHOTOS
  // =====================================================

  /**
   * Ajoute une photo à une réserve
   */
  async addPhoto(
    reserveId: string,
    photo: {
      url: string;
      legende?: string;
      type: 'avant' | 'apres' | 'detail';
    }
  ): Promise<ReservePhoto> {
    const reserve = await this.getReserve(reserveId);
    if (!reserve) {
      throw new Error('Réserve non trouvée');
    }

    const newPhoto: ReservePhoto = {
      id: uuidv4(),
      url: photo.url,
      legende: photo.legende,
      dateCapture: new Date().toISOString(),
      type: photo.type,
    };

    reserve.photos.push(newPhoto);

    await supabase
      .from('reserves')
      .update({
        photos: reserve.photos,
        updated_at: new Date().toISOString(),
      })
      .eq('id', reserveId);

    return newPhoto;
  }

  /**
   * Ajoute une photo "après" pour la levée
   */
  async addPhotoApres(
    reserveId: string,
    photoUrl: string,
    legende?: string
  ): Promise<void> {
    const reserve = await this.getReserve(reserveId);
    if (!reserve) {
      throw new Error('Réserve non trouvée');
    }

    const photosApres = reserve.photosApres || [];
    photosApres.push(photoUrl);

    await supabase
      .from('reserves')
      .update({
        photos_apres: photosApres,
        updated_at: new Date().toISOString(),
      })
      .eq('id', reserveId);

    // Ajouter aussi à la collection photos
    await this.addPhoto(reserveId, {
      url: photoUrl,
      legende,
      type: 'apres',
    });
  }

  // =====================================================
  // VISITES DE LEVÉE
  // =====================================================

  /**
   * Planifie une visite de levée des réserves
   */
  async planifierVisite(
    chantierId: string,
    receptionId: string,
    params: {
      dateVisite: string;
      reserveIds: string[];
      participants: OPRParticipant[];
    }
  ): Promise<VisiteLeveeReserves> {
    const visitId = uuidv4();

    // Récupérer les réserves concernées
    const reserves: Reserve[] = [];
    for (const id of params.reserveIds) {
      const reserve = await this.getReserve(id);
      if (reserve) {
        reserves.push(reserve);
      }
    }

    const visite: VisiteLeveeReserves = {
      id: visitId,
      chantierId,
      receptionId,
      dateVisite: params.dateVisite,
      participants: params.participants,
      reservesControlees: reserves.map(r => ({
        reserveId: r.id,
        reserve: r,
        statut: 'non_levee',
      })),
      toutesLevees: false,
      nouvellesReserves: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const { error } = await supabase.from('visites_levee_reserves').insert({
      id: visite.id,
      chantier_id: visite.chantierId,
      reception_id: visite.receptionId,
      date_visite: visite.dateVisite,
      participants: visite.participants,
      reserves_controlees: visite.reservesControlees,
      toutes_levees: visite.toutesLevees,
      nouvelles_reserves: visite.nouvellesReserves,
      created_at: visite.createdAt,
      updated_at: visite.updatedAt,
    });

    if (error) {
      throw new Error('Impossible de planifier la visite');
    }

    // Notifier les participants
    await this.notifyVisitePlanifiee(visite);

    return visite;
  }

  /**
   * Récupère une visite
   */
  async getVisite(visiteId: string): Promise<VisiteLeveeReserves | null> {
    const { data, error } = await supabase
      .from('visites_levee_reserves')
      .select('*')
      .eq('id', visiteId)
      .single();

    if (error || !data) {
      return null;
    }

    return this.mapDbToVisite(data);
  }

  /**
   * Liste les visites d'un chantier
   */
  async getVisitesByChantier(chantierId: string): Promise<VisiteLeveeReserves[]> {
    const { data, error } = await supabase
      .from('visites_levee_reserves')
      .select('*')
      .eq('chantier_id', chantierId)
      .order('date_visite', { ascending: false });

    if (error || !data) {
      return [];
    }

    return data.map(this.mapDbToVisite);
  }

  /**
   * Enregistre le résultat du contrôle d'une réserve lors d'une visite
   */
  async enregistrerControle(
    visiteId: string,
    controle: {
      reserveId: string;
      statut: 'levee' | 'non_levee' | 'partiellement_levee';
      commentaire?: string;
      photos?: string[];
      nouveauDelai?: number;
    }
  ): Promise<void> {
    const visite = await this.getVisite(visiteId);
    if (!visite) {
      throw new Error('Visite non trouvée');
    }

    const index = visite.reservesControlees.findIndex(
      rc => rc.reserveId === controle.reserveId
    );

    if (index === -1) {
      throw new Error('Réserve non trouvée dans cette visite');
    }

    visite.reservesControlees[index] = {
      ...visite.reservesControlees[index],
      statut: controle.statut,
      commentaire: controle.commentaire,
      photos: controle.photos,
      nouveauDelai: controle.nouveauDelai,
    };

    // Mettre à jour le statut de la réserve
    if (controle.statut === 'levee') {
      await this.leverReserve(controle.reserveId, {
        leveePar: 'Visite de contrôle',
        commentaire: controle.commentaire,
        photosApres: controle.photos,
      });
    } else if (controle.statut === 'partiellement_levee') {
      await this.updateStatut(controle.reserveId, 'en_cours', controle.commentaire);
    }

    // Si nouveau délai demandé
    if (controle.nouveauDelai && controle.statut !== 'levee') {
      await this.prolongerDelai(
        controle.reserveId,
        controle.nouveauDelai,
        'Prolongation suite à visite de contrôle'
      );
    }

    await supabase
      .from('visites_levee_reserves')
      .update({
        reserves_controlees: visite.reservesControlees,
        updated_at: new Date().toISOString(),
      })
      .eq('id', visiteId);
  }

  /**
   * Finalise une visite de levée
   */
  async finaliserVisite(visiteId: string): Promise<VisiteLeveeReserves | null> {
    const visite = await this.getVisite(visiteId);
    if (!visite) return null;

    const toutesLevees = visite.reservesControlees.every(
      rc => rc.statut === 'levee'
    );

    const { data, error } = await supabase
      .from('visites_levee_reserves')
      .update({
        toutes_levees: toutesLevees,
        updated_at: new Date().toISOString(),
      })
      .eq('id', visiteId)
      .select()
      .single();

    if (error || !data) {
      return null;
    }

    // Mettre à jour le compteur sur la réception
    await this.updateReceptionReservesCount(visite.receptionId);

    return this.mapDbToVisite(data);
  }

  /**
   * Génère le PV de levée des réserves
   */
  async generatePVLevee(visiteId: string): Promise<string> {
    const visite = await this.getVisite(visiteId);
    if (!visite) {
      throw new Error('Visite non trouvée');
    }

    // Récupérer les infos du chantier
    const { data: chantier } = await supabase
      .from('chantiers')
      .select('*')
      .eq('id', visite.chantierId)
      .single();

    let pvContent = `
# PROCÈS-VERBAL DE LEVÉE DES RÉSERVES

## Identification du chantier
- **Référence**: ${chantier?.reference || visite.chantierId}
- **Adresse**: ${chantier?.adresse || 'Non spécifiée'}

## Date de visite
${new Date(visite.dateVisite).toLocaleDateString('fr-FR', {
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
})}

## Participants présents

${visite.participants
  .filter(p => p.present)
  .map(p => `- ${p.prenom} ${p.nom} (${p.role})`)
  .join('\n')}

## Réserves contrôlées

| N° | Nature | Localisation | Statut | Commentaire |
|----|--------|--------------|--------|-------------|
${visite.reservesControlees
  .map(
    rc =>
      `| ${rc.reserve.numero} | ${rc.reserve.nature} | ${rc.reserve.localisation} | ${this.translateStatutControle(rc.statut)} | ${rc.commentaire || '-'} |`
  )
  .join('\n')}

## Résumé

- **Réserves levées**: ${visite.reservesControlees.filter(rc => rc.statut === 'levee').length}
- **Réserves partiellement levées**: ${visite.reservesControlees.filter(rc => rc.statut === 'partiellement_levee').length}
- **Réserves non levées**: ${visite.reservesControlees.filter(rc => rc.statut === 'non_levee').length}
- **Toutes les réserves levées**: ${visite.toutesLevees ? '✓ OUI' : '✗ NON'}

---
*Document généré automatiquement par TORP le ${new Date().toLocaleDateString('fr-FR')}*
`;

    // Sauvegarder le lien du PV
    await supabase
      .from('visites_levee_reserves')
      .update({
        pv_levee_url: `pv-levee-${visiteId}.md`,
        updated_at: new Date().toISOString(),
      })
      .eq('id', visiteId);

    return pvContent;
  }

  // =====================================================
  // STATISTIQUES
  // =====================================================

  /**
   * Calcule les statistiques des réserves d'un chantier
   */
  async getStatistiques(chantierId: string): Promise<{
    total: number;
    ouvertes: number;
    enCours: number;
    levees: number;
    contestees: number;
    expirees: number;
    enRetard: number;
    parGravite: Record<ReserveGravite, number>;
    parEntreprise: Record<string, { total: number; levees: number }>;
    tauxLevee: number;
    delaiMoyenLevee: number;
  }> {
    const reserves = await this.getReservesByChantier(chantierId);
    const now = new Date();

    const stats = {
      total: reserves.length,
      ouvertes: 0,
      enCours: 0,
      levees: 0,
      contestees: 0,
      expirees: 0,
      enRetard: 0,
      parGravite: {
        mineure: 0,
        majeure: 0,
        grave: 0,
        non_conformite_substantielle: 0,
      } as Record<ReserveGravite, number>,
      parEntreprise: {} as Record<string, { total: number; levees: number }>,
      tauxLevee: 0,
      delaiMoyenLevee: 0,
    };

    let totalDelaiLevee = 0;
    let nombreLevees = 0;

    for (const reserve of reserves) {
      // Par statut
      switch (reserve.statut) {
        case 'ouverte':
          stats.ouvertes++;
          break;
        case 'en_cours':
          stats.enCours++;
          break;
        case 'levee':
          stats.levees++;
          nombreLevees++;
          // Calculer le délai de levée
          if (reserve.dateLevee) {
            const dateCreation = new Date(reserve.createdAt);
            const dateLevee = new Date(reserve.dateLevee);
            totalDelaiLevee += Math.ceil(
              (dateLevee.getTime() - dateCreation.getTime()) / (1000 * 60 * 60 * 24)
            );
          }
          break;
        case 'contestee':
          stats.contestees++;
          break;
        case 'expiree':
          stats.expirees++;
          break;
      }

      // En retard
      if (
        ['ouverte', 'en_cours'].includes(reserve.statut) &&
        new Date(reserve.dateEcheance) < now
      ) {
        stats.enRetard++;
      }

      // Par gravité
      stats.parGravite[reserve.gravite]++;

      // Par entreprise
      if (!stats.parEntreprise[reserve.entrepriseId]) {
        stats.parEntreprise[reserve.entrepriseId] = { total: 0, levees: 0 };
      }
      stats.parEntreprise[reserve.entrepriseId].total++;
      if (reserve.statut === 'levee') {
        stats.parEntreprise[reserve.entrepriseId].levees++;
      }
    }

    // Calculs finaux
    stats.tauxLevee = stats.total > 0
      ? Math.round((stats.levees / stats.total) * 100)
      : 0;
    stats.delaiMoyenLevee = nombreLevees > 0
      ? Math.round(totalDelaiLevee / nombreLevees)
      : 0;

    return stats;
  }

  // =====================================================
  // ALERTES ET RAPPELS
  // =====================================================

  /**
   * Envoie des rappels pour les réserves proches de l'échéance
   */
  async sendRappelsEcheance(joursAvant: number = 7): Promise<number> {
    const dateLimit = new Date();
    dateLimit.setDate(dateLimit.getDate() + joursAvant);

    const { data: reserves, error } = await supabase
      .from('reserves')
      .select('*')
      .in('statut', ['ouverte', 'en_cours'])
      .lte('date_echeance', dateLimit.toISOString())
      .gt('date_echeance', new Date().toISOString());

    if (error || !reserves) return 0;

    let count = 0;

    for (const reserveData of reserves) {
      const reserve = this.mapDbToReserve(reserveData);
      await this.notifyRappelEcheance(reserve);
      count++;
    }

    return count;
  }

  /**
   * Marque les réserves expirées
   */
  async marquerReservesExpirees(): Promise<number> {
    const { data: reserves, error } = await supabase
      .from('reserves')
      .select('*')
      .in('statut', ['ouverte', 'en_cours'])
      .lt('date_echeance', new Date().toISOString());

    if (error || !reserves) return 0;

    for (const reserve of reserves) {
      await supabase
        .from('reserves')
        .update({
          statut: 'expiree',
          updated_at: new Date().toISOString(),
        })
        .eq('id', reserve.id);

      await this.notifyReserveExpiree(reserve.id);
    }

    return reserves.length;
  }

  // =====================================================
  // NOTIFICATIONS
  // =====================================================

  private async notifyReserveLevee(reserveId: string): Promise<void> {
    const reserve = await this.getReserve(reserveId);
    if (!reserve) return;

    // Récupérer les infos du chantier et du MO
    const { data: chantier } = await supabase
      .from('chantiers')
      .select('*, user:users(*)')
      .eq('id', reserve.chantierId)
      .single();

    if (chantier?.user?.email) {
      try {
        await emailService.sendTemplatedEmail(
          chantier.user.email,
          'reserve_levee',
          {
            userName: chantier.user.full_name || 'Maître d\'ouvrage',
            reserveNumero: reserve.numero,
            reserveNature: reserve.nature,
            entrepriseNom: reserve.entrepriseNom,
            chantierReference: chantier.reference,
          }
        );
      } catch (error) {
        console.error('[Reserves] Erreur notification levée:', error);
      }
    }
  }

  private async notifyContestation(reserveId: string, motif: string): Promise<void> {
    const reserve = await this.getReserve(reserveId);
    if (!reserve) return;

    // Récupérer les infos du chantier et du MO
    const { data: chantier } = await supabase
      .from('chantiers')
      .select('*, user:users(*)')
      .eq('id', reserve.chantierId)
      .single();

    if (chantier?.user?.email) {
      try {
        await emailService.sendTemplatedEmail(
          chantier.user.email,
          'reserve_contestee',
          {
            userName: chantier.user.full_name || 'Maître d\'ouvrage',
            reserveNumero: reserve.numero,
            reserveNature: reserve.nature,
            entrepriseNom: reserve.entrepriseNom,
            motifContestation: motif,
            chantierReference: chantier.reference,
          }
        );
      } catch (error) {
        console.error('[Reserves] Erreur notification contestation:', error);
      }
    }
  }

  private async notifyVisitePlanifiee(visite: VisiteLeveeReserves): Promise<void> {
    for (const participant of visite.participants) {
      if (participant.email) {
        try {
          await emailService.sendTemplatedEmail(
            participant.email,
            'visite_levee_planifiee',
            {
              participantNom: `${participant.prenom} ${participant.nom}`,
              dateVisite: new Date(visite.dateVisite).toLocaleDateString('fr-FR'),
              nombreReserves: visite.reservesControlees.length,
            }
          );
        } catch (error) {
          console.error('[Reserves] Erreur notification visite:', error);
        }
      }
    }
  }

  private async notifyRappelEcheance(reserve: Reserve): Promise<void> {
    // Récupérer l'entreprise
    const { data: entreprise } = await supabase
      .from('entreprises')
      .select('email, contact_email')
      .eq('id', reserve.entrepriseId)
      .single();

    const email = entreprise?.contact_email || entreprise?.email;
    if (email) {
      try {
        await emailService.sendTemplatedEmail(
          email,
          'rappel_echeance_reserve',
          {
            reserveNumero: reserve.numero,
            reserveNature: reserve.nature,
            dateEcheance: new Date(reserve.dateEcheance).toLocaleDateString('fr-FR'),
            joursRestants: Math.ceil(
              (new Date(reserve.dateEcheance).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
            ),
          }
        );
      } catch (error) {
        console.error('[Reserves] Erreur notification rappel:', error);
      }
    }
  }

  private async notifyReserveExpiree(reserveId: string): Promise<void> {
    const reserve = await this.getReserve(reserveId);
    if (!reserve) return;

    // Récupérer les infos du chantier et du MO
    const { data: chantier } = await supabase
      .from('chantiers')
      .select('*, user:users(*)')
      .eq('id', reserve.chantierId)
      .single();

    if (chantier?.user?.email) {
      try {
        await emailService.sendTemplatedEmail(
          chantier.user.email,
          'reserve_expiree',
          {
            userName: chantier.user.full_name || 'Maître d\'ouvrage',
            reserveNumero: reserve.numero,
            reserveNature: reserve.nature,
            entrepriseNom: reserve.entrepriseNom,
            chantierReference: chantier.reference,
          }
        );
      } catch (error) {
        console.error('[Reserves] Erreur notification expiration:', error);
      }
    }
  }

  // =====================================================
  // MÉTHODES PRIVÉES
  // =====================================================

  private async logHistorique(
    reserveId: string,
    event: Record<string, unknown>
  ): Promise<void> {
    await supabase.from('reserves_historique').insert({
      id: uuidv4(),
      reserve_id: reserveId,
      event_type: event.action as string,
      event_data: event,
      created_at: new Date().toISOString(),
    });
  }

  private async updateReceptionReservesCount(receptionId: string): Promise<void> {
    const { data: reception } = await supabase
      .from('receptions')
      .select('chantier_id')
      .eq('id', receptionId)
      .single();

    if (!reception) return;

    const reserves = await this.getReservesByChantier(reception.chantier_id);
    const levees = reserves.filter(r => r.statut === 'levee').length;

    await supabase
      .from('receptions')
      .update({
        nombre_reserves_levees: levees,
        updated_at: new Date().toISOString(),
      })
      .eq('id', receptionId);
  }

  private translateStatutControle(statut: string): string {
    const translations: Record<string, string> = {
      levee: '✓ Levée',
      non_levee: '✗ Non levée',
      partiellement_levee: '◐ Partiellement levée',
    };
    return translations[statut] || statut;
  }

  private mapDbToReserve(data: Record<string, unknown>): Reserve {
    return {
      id: data.id as string,
      oprId: data.opr_id as string,
      chantierId: data.chantier_id as string,
      numero: data.numero as number,
      lot: data.lot as string,
      piece: data.piece as string | undefined,
      localisation: data.localisation as string,
      coordonneesPhoto: data.coordonnees_photo as { x: number; y: number } | undefined,
      nature: data.nature as string,
      description: data.description as string,
      gravite: data.gravite as ReserveGravite,
      photos: (data.photos as ReservePhoto[]) || [],
      statut: data.statut as ReserveStatut,
      entrepriseId: data.entreprise_id as string,
      entrepriseNom: data.entreprise_nom as string,
      delaiLeveeJours: data.delai_levee_jours as number,
      dateEcheance: data.date_echeance as string,
      dateLevee: data.date_levee as string | undefined,
      leveePar: data.levee_par as string | undefined,
      commentaireLevee: data.commentaire_levee as string | undefined,
      photosApres: data.photos_apres as string[] | undefined,
      pvLeveeId: data.pv_levee_id as string | undefined,
      contestee: data.contestee as boolean,
      motifContestation: data.motif_contestation as string | undefined,
      dateContestation: data.date_contestation as string | undefined,
      coutEstime: data.cout_estime as number | undefined,
      createdAt: data.created_at as string,
      updatedAt: data.updated_at as string,
    };
  }

  private mapDbToVisite(data: Record<string, unknown>): VisiteLeveeReserves {
    return {
      id: data.id as string,
      chantierId: data.chantier_id as string,
      receptionId: data.reception_id as string,
      dateVisite: data.date_visite as string,
      participants: (data.participants as OPRParticipant[]) || [],
      reservesControlees: (data.reserves_controlees as ReserveControle[]) || [],
      toutesLevees: data.toutes_levees as boolean,
      nouvellesReserves: (data.nouvelles_reserves as Reserve[]) || [],
      pvLeveeUrl: data.pv_levee_url as string | undefined,
      createdAt: data.created_at as string,
      updatedAt: data.updated_at as string,
    };
  }
}

export const reservesService = new ReservesService();
export default reservesService;
