/**
 * useProjectUsers - Hook React pour la gestion des utilisateurs d'un projet
 * ZÉRO MOCK - Données réelles depuis Supabase
 *
 * Utilise la table project_actors pour les membres actifs
 * et project_invitations pour les invitations en attente
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useApp } from '@/context/AppContext';

// =============================================================================
// TYPES
// =============================================================================

export type UserRole = 'owner' | 'admin' | 'manager' | 'collaborator' | 'viewer';
export type ActorStatus = 'active' | 'inactive' | 'pending' | 'suspended';

export interface ProjectUser {
  id: string;
  user_id: string;
  project_id: string;
  role: UserRole;
  status: ActorStatus;

  // Informations utilisateur
  display_name: string;
  email: string;
  phone?: string;
  avatar?: string;

  // Entreprise (si B2B)
  company_name?: string;
  company_siret?: string;
  user_type: string;

  // Permissions personnalisées
  permissions?: string[];

  // Activité
  last_active_at?: string;
  joined_at: string;
  created_at: string;
}

export interface ProjectInvitation {
  id: string;
  project_id: string;
  email: string;
  role: UserRole;
  invited_by: string;
  invited_by_name?: string;
  message?: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired' | 'cancelled';
  expires_at: string;
  created_at: string;
}

export interface ProjectUserStats {
  total: number;
  owners: number;
  admins: number;
  collaborators: number;
  viewers: number;
  pendingInvitations: number;
  activeLastWeek: number;
}

// =============================================================================
// HOOK
// =============================================================================

interface UseProjectUsersOptions {
  projectId: string;
  includeInvitations?: boolean;
  enabled?: boolean;
}

export function useProjectUsers({
  projectId,
  includeInvitations = true,
  enabled = true,
}: UseProjectUsersOptions) {
  const queryClient = useQueryClient();
  const { user } = useApp();

  // Query keys
  const keys = {
    users: ['project-users', projectId] as const,
    invitations: ['project-invitations', projectId] as const,
    stats: ['project-users-stats', projectId] as const,
  };

  // Récupérer les utilisateurs du projet
  const usersQuery = useQuery({
    queryKey: keys.users,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_actors')
        .select('*')
        .eq('project_id', projectId)
        .order('role', { ascending: true })
        .order('display_name', { ascending: true });

      if (error) {
        console.error('[useProjectUsers] Error:', error);
        return [];
      }

      return (data || []).map(actor => ({
        id: actor.id,
        user_id: actor.user_id,
        project_id: actor.project_id,
        role: actor.role as UserRole,
        status: actor.status as ActorStatus,
        display_name: actor.display_name,
        email: actor.email,
        phone: actor.phone,
        avatar: actor.avatar,
        company_name: actor.company_name,
        company_siret: actor.company_siret,
        user_type: actor.user_type,
        permissions: actor.custom_permissions,
        last_active_at: actor.last_active_at,
        joined_at: actor.joined_at,
        created_at: actor.created_at,
      })) as ProjectUser[];
    },
    enabled: enabled && !!projectId,
    staleTime: 2 * 60 * 1000,
  });

  // Récupérer les invitations en attente
  const invitationsQuery = useQuery({
    queryKey: keys.invitations,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_invitations')
        .select('*')
        .eq('project_id', projectId)
        .in('status', ['pending'])
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[useProjectUsers] Invitations error:', error);
        return [];
      }

      return (data || []) as ProjectInvitation[];
    },
    enabled: enabled && !!projectId && includeInvitations,
    staleTime: 2 * 60 * 1000,
  });

  const users = usersQuery.data || [];
  const invitations = invitationsQuery.data || [];

  // Calculer les statistiques
  const stats: ProjectUserStats = {
    total: users.length,
    owners: users.filter(u => u.role === 'owner').length,
    admins: users.filter(u => u.role === 'admin').length,
    collaborators: users.filter(u => u.role === 'collaborator' || u.role === 'manager').length,
    viewers: users.filter(u => u.role === 'viewer').length,
    pendingInvitations: invitations.length,
    activeLastWeek: users.filter(u => {
      if (!u.last_active_at) return false;
      const lastWeek = new Date();
      lastWeek.setDate(lastWeek.getDate() - 7);
      return new Date(u.last_active_at) >= lastWeek;
    }).length,
  };

  // Mutation: Inviter un utilisateur
  const inviteUserMutation = useMutation({
    mutationFn: async ({
      email,
      role,
      message,
    }: {
      email: string;
      role: UserRole;
      message?: string;
    }) => {
      // Vérifier si l'utilisateur est déjà membre
      const existingMember = users.find(u => u.email.toLowerCase() === email.toLowerCase());
      if (existingMember) {
        throw new Error('Cet utilisateur est déjà membre du projet');
      }

      // Vérifier si une invitation est déjà en attente
      const existingInvitation = invitations.find(i =>
        i.email.toLowerCase() === email.toLowerCase() && i.status === 'pending'
      );
      if (existingInvitation) {
        throw new Error('Une invitation est déjà en attente pour cet email');
      }

      // Calculer la date d'expiration (7 jours)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const { data, error } = await supabase
        .from('project_invitations')
        .insert({
          project_id: projectId,
          email: email.toLowerCase(),
          role,
          invited_by: user?.id,
          message,
          expires_at: expiresAt.toISOString(),
          status: 'pending',
        })
        .select()
        .single();

      if (error) throw error;

      // TODO: Envoyer un email d'invitation via service email
      console.log('[useProjectUsers] Invitation created, email should be sent to:', email);

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.invitations });
      toast.success('Invitation envoyée');
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  // Mutation: Mettre à jour le rôle d'un utilisateur
  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: UserRole }) => {
      // Empêcher de retirer le dernier owner
      if (role !== 'owner') {
        const owners = users.filter(u => u.role === 'owner');
        const targetUser = users.find(u => u.user_id === userId);
        if (owners.length === 1 && targetUser?.role === 'owner') {
          throw new Error('Impossible de retirer le dernier propriétaire du projet');
        }
      }

      const { error } = await supabase
        .from('project_actors')
        .update({ role, updated_at: new Date().toISOString() })
        .eq('project_id', projectId)
        .eq('user_id', userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.users });
      toast.success('Rôle mis à jour');
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  // Mutation: Retirer un utilisateur du projet
  const removeUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      // Empêcher de retirer le dernier owner
      const owners = users.filter(u => u.role === 'owner');
      const targetUser = users.find(u => u.user_id === userId);
      if (owners.length === 1 && targetUser?.role === 'owner') {
        throw new Error('Impossible de retirer le dernier propriétaire du projet');
      }

      // Empêcher de se retirer soi-même si owner
      if (userId === user?.id && targetUser?.role === 'owner') {
        throw new Error('Vous ne pouvez pas vous retirer en tant que propriétaire');
      }

      const { error } = await supabase
        .from('project_actors')
        .delete()
        .eq('project_id', projectId)
        .eq('user_id', userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.users });
      toast.success('Utilisateur retiré du projet');
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  // Mutation: Annuler une invitation
  const cancelInvitationMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      const { error } = await supabase
        .from('project_invitations')
        .update({ status: 'cancelled' })
        .eq('id', invitationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.invitations });
      toast.success('Invitation annulée');
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  // Mutation: Renvoyer une invitation
  const resendInvitationMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      const invitation = invitations.find(i => i.id === invitationId);
      if (!invitation) {
        throw new Error('Invitation non trouvée');
      }

      // Mettre à jour la date d'expiration
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const { error } = await supabase
        .from('project_invitations')
        .update({
          expires_at: expiresAt.toISOString(),
          status: 'pending',
        })
        .eq('id', invitationId);

      if (error) throw error;

      // TODO: Renvoyer l'email d'invitation
      console.log('[useProjectUsers] Invitation resent to:', invitation.email);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.invitations });
      toast.success('Invitation renvoyée');
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  // Vérifier si l'utilisateur courant peut gérer les membres
  const currentUserRole = users.find(u => u.user_id === user?.id)?.role;
  const canManageUsers = currentUserRole === 'owner' || currentUserRole === 'admin';

  return {
    // Data
    users,
    invitations,
    stats,

    // Current user context
    currentUserRole,
    canManageUsers,

    // Loading
    isLoading: usersQuery.isLoading,
    isLoadingInvitations: invitationsQuery.isLoading,
    error: usersQuery.error,

    // Mutations
    inviteUser: inviteUserMutation.mutate,
    updateRole: updateRoleMutation.mutate,
    removeUser: removeUserMutation.mutate,
    cancelInvitation: cancelInvitationMutation.mutate,
    resendInvitation: resendInvitationMutation.mutate,

    // Mutation states
    isInviting: inviteUserMutation.isPending,
    isUpdatingRole: updateRoleMutation.isPending,
    isRemoving: removeUserMutation.isPending,
    isCancellingInvitation: cancelInvitationMutation.isPending,
    isResendingInvitation: resendInvitationMutation.isPending,

    // Refetch
    refetch: () => {
      usersQuery.refetch();
      invitationsQuery.refetch();
    },
  };
}

export default useProjectUsers;
