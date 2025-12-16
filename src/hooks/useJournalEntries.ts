/**
 * useJournalEntries - Hook React pour la gestion du journal de chantier
 * ZÉRO MOCK - Données réelles depuis Supabase
 *
 * Supporte les deux tables:
 * - site_journal (Phase 3)
 * - phase2_journal_chantier (Phase 2)
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { format, startOfWeek, endOfWeek, subDays, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

// =============================================================================
// TYPES
// =============================================================================

export type WeatherCondition = 'ensoleille' | 'nuageux' | 'pluie' | 'neige' | 'gel' | 'vent_fort';
export type EntryStatus = 'brouillon' | 'valide' | 'cloture';
export type EntryType = 'visite' | 'reunion' | 'incident' | 'decision' | 'observation' | 'meteo' | 'quotidien';
export type IncidentGravite = 'mineur' | 'moyen' | 'majeur';

export interface MeteoData {
  condition: WeatherCondition;
  temperature?: number;
  temperature_min?: number;
  temperature_max?: number;
  intemperies?: boolean;
  arret_chantier?: boolean;
}

export interface EffectifEntry {
  id: string;
  entreprise: string;
  lot: string;
  nombre_personnes: number;
  heures_presence: number;
  taches?: string;
}

export interface ActiviteEntry {
  id: string;
  lot: string;
  description: string;
  avancement: number;
  zone?: string;
  statut: 'en_cours' | 'termine' | 'bloque';
}

export interface LivraisonEntry {
  id: string;
  fournisseur: string;
  materiaux: string;
  quantite: string;
  conforme: boolean;
  commentaire?: string;
}

export interface IncidentEntry {
  id: string;
  type: string;
  description: string;
  gravite: IncidentGravite;
  entreprise_concernee?: string;
  mesures_prises?: string;
  photos?: string[];
}

export interface SecuriteData {
  port_epi: boolean;
  balisage_ok: boolean;
  stockage_materiaux_ok: boolean;
  proprete_site: boolean;
  incidents_securite?: string;
}

export interface JournalEntry {
  id: string;
  project_id?: string;
  chantier_id?: string;
  date: string;
  type?: EntryType;

  // Météo
  meteo?: MeteoData;

  // Effectifs
  effectifs?: EffectifEntry[];

  // Activités
  activites?: ActiviteEntry[];

  // Livraisons
  livraisons?: LivraisonEntry[];

  // Incidents
  incidents?: IncidentEntry[];

  // Sécurité
  securite?: SecuriteData;

  // Observations
  observations?: string;

  // Photos
  photos?: string[];

  // Validation
  status: EntryStatus;
  valide_par?: string;
  valide_date?: string;

  // Métadonnées
  created_at: string;
  updated_at?: string;
  created_by?: string;
}

export interface JournalStats {
  totalEntries: number;
  entriesThisWeek: number;
  incidentsOuverts: number;
  joursSansIncident: number;
  tauxValidation: number;
}

// =============================================================================
// HOOK
// =============================================================================

interface UseJournalEntriesOptions {
  projectId?: string;
  chantierId?: string;
  startDate?: Date;
  endDate?: Date;
  enabled?: boolean;
}

export function useJournalEntries({
  projectId,
  chantierId,
  startDate,
  endDate,
  enabled = true,
}: UseJournalEntriesOptions = {}) {
  const queryClient = useQueryClient();

  // Query keys
  const queryKey = ['journal-entries', projectId || chantierId, startDate?.toISOString(), endDate?.toISOString()];

  // Récupérer les entrées du journal
  const entriesQuery = useQuery({
    queryKey,
    queryFn: async () => {
      // Essayer d'abord site_journal (phase 3), puis phase2_journal_chantier
      let data: any[] = [];
      let error: any = null;

      // Try site_journal first (Phase 3 table)
      if (projectId) {
        let query = supabase
          .from('site_journal')
          .select('*')
          .eq('project_id', projectId)
          .order('journal_date', { ascending: false });

        if (startDate) {
          query = query.gte('journal_date', format(startDate, 'yyyy-MM-dd'));
        }
        if (endDate) {
          query = query.lte('journal_date', format(endDate, 'yyyy-MM-dd'));
        }

        const result = await query;

        if (!result.error && result.data?.length > 0) {
          data = result.data.map(mapSiteJournalToEntry);
        } else if (result.error) {
          console.warn('[useJournalEntries] site_journal not found, trying phase2_journal_chantier');
        }
      }

      // Try phase2_journal_chantier (Phase 2 table) if no data from site_journal
      if (data.length === 0 && chantierId) {
        let query = supabase
          .from('phase2_journal_chantier')
          .select('*')
          .eq('chantier_id', chantierId)
          .order('date_journal', { ascending: false });

        if (startDate) {
          query = query.gte('date_journal', format(startDate, 'yyyy-MM-dd'));
        }
        if (endDate) {
          query = query.lte('date_journal', format(endDate, 'yyyy-MM-dd'));
        }

        const result = await query;

        if (!result.error && result.data) {
          data = result.data.map(mapPhase2JournalToEntry);
        } else if (result.error) {
          console.warn('[useJournalEntries] phase2_journal_chantier error:', result.error);
        }
      }

      return data as JournalEntry[];
    },
    enabled: enabled && !!(projectId || chantierId),
    staleTime: 2 * 60 * 1000,
  });

  const entries = entriesQuery.data || [];

  // Grouper par date
  const entriesByDate = entries.reduce((acc, entry) => {
    const date = entry.date.split('T')[0];
    if (!acc[date]) acc[date] = [];
    acc[date].push(entry);
    return acc;
  }, {} as Record<string, JournalEntry[]>);

  // Calculer les statistiques
  const stats: JournalStats = {
    totalEntries: entries.length,
    entriesThisWeek: entries.filter(e => {
      const entryDate = parseISO(e.date);
      const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
      const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
      return entryDate >= weekStart && entryDate <= weekEnd;
    }).length,
    incidentsOuverts: entries.reduce((count, e) =>
      count + (e.incidents?.filter(i => i.gravite === 'majeur' || i.gravite === 'moyen').length || 0),
    0),
    joursSansIncident: calculateDaysWithoutIncident(entries),
    tauxValidation: entries.length > 0
      ? Math.round((entries.filter(e => e.status === 'valide').length / entries.length) * 100)
      : 0,
  };

  // Mutation: Créer une entrée
  const createEntryMutation = useMutation({
    mutationFn: async (entry: Partial<JournalEntry>) => {
      // Déterminer quelle table utiliser
      if (projectId) {
        const { data, error } = await supabase
          .from('site_journal')
          .insert({
            project_id: projectId,
            journal_date: entry.date || format(new Date(), 'yyyy-MM-dd'),
            weather: entry.meteo?.condition,
            temperature_min: entry.meteo?.temperature_min,
            temperature_max: entry.meteo?.temperature_max,
            weather_stop: entry.meteo?.arret_chantier || false,
            personnel: entry.effectifs,
            activities: entry.activites,
            deliveries: entry.livraisons,
            incidents: entry.incidents,
            safety_check: entry.securite,
            observations: entry.observations,
            photos: entry.photos || [],
            status: entry.status || 'brouillon',
          })
          .select()
          .single();

        if (error) throw error;
        return data;
      } else if (chantierId) {
        const { data, error } = await supabase
          .from('phase2_journal_chantier')
          .insert({
            chantier_id: chantierId,
            date_journal: entry.date || format(new Date(), 'yyyy-MM-dd'),
            meteo: entry.meteo,
            effectifs: entry.effectifs,
            travaux_realises: entry.activites,
            livraisons: entry.livraisons,
            incidents: entry.incidents,
            securite: entry.securite,
            observations: entry.observations,
            photos: entry.photos || [],
            statut: entry.status || 'brouillon',
          })
          .select()
          .single();

        if (error) throw error;
        return data;
      }

      throw new Error('projectId ou chantierId requis');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success('Entrée de journal créée');
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  // Mutation: Mettre à jour une entrée
  const updateEntryMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<JournalEntry> & { id: string }) => {
      // Essayer d'abord site_journal
      if (projectId) {
        const { error } = await supabase
          .from('site_journal')
          .update({
            weather: updates.meteo?.condition,
            temperature_min: updates.meteo?.temperature_min,
            temperature_max: updates.meteo?.temperature_max,
            weather_stop: updates.meteo?.arret_chantier,
            personnel: updates.effectifs,
            activities: updates.activites,
            deliveries: updates.livraisons,
            incidents: updates.incidents,
            safety_check: updates.securite,
            observations: updates.observations,
            photos: updates.photos,
            status: updates.status,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id);

        if (error) throw error;
      } else if (chantierId) {
        const { error } = await supabase
          .from('phase2_journal_chantier')
          .update({
            meteo: updates.meteo,
            effectifs: updates.effectifs,
            travaux_realises: updates.activites,
            livraisons: updates.livraisons,
            incidents: updates.incidents,
            securite: updates.securite,
            observations: updates.observations,
            photos: updates.photos,
            statut: updates.status,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success('Entrée mise à jour');
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  // Mutation: Valider une entrée
  const validateEntryMutation = useMutation({
    mutationFn: async ({ id, validateur }: { id: string; validateur: string }) => {
      const updates = {
        status: 'valide',
        valide_par: validateur,
        valide_date: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (projectId) {
        const { error } = await supabase
          .from('site_journal')
          .update({ status: 'valide', validated_by: validateur, validated_at: new Date().toISOString() })
          .eq('id', id);
        if (error) throw error;
      } else if (chantierId) {
        const { error } = await supabase
          .from('phase2_journal_chantier')
          .update({ statut: 'valide', valide_par: validateur, valide_date: new Date().toISOString() })
          .eq('id', id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success('Entrée validée');
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  // Mutation: Supprimer une entrée
  const deleteEntryMutation = useMutation({
    mutationFn: async (id: string) => {
      if (projectId) {
        const { error } = await supabase.from('site_journal').delete().eq('id', id);
        if (error) throw error;
      } else if (chantierId) {
        const { error } = await supabase.from('phase2_journal_chantier').delete().eq('id', id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success('Entrée supprimée');
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  return {
    // Data
    entries,
    entriesByDate,
    stats,

    // Loading
    isLoading: entriesQuery.isLoading,
    error: entriesQuery.error,

    // Mutations
    createEntry: createEntryMutation.mutate,
    updateEntry: updateEntryMutation.mutate,
    validateEntry: validateEntryMutation.mutate,
    deleteEntry: deleteEntryMutation.mutate,

    // Mutation states
    isCreating: createEntryMutation.isPending,
    isUpdating: updateEntryMutation.isPending,
    isValidating: validateEntryMutation.isPending,
    isDeleting: deleteEntryMutation.isPending,

    // Refetch
    refetch: entriesQuery.refetch,
  };
}

// =============================================================================
// HELPERS
// =============================================================================

function mapSiteJournalToEntry(row: any): JournalEntry {
  return {
    id: row.id,
    project_id: row.project_id,
    date: row.journal_date,
    type: 'quotidien',
    meteo: {
      condition: row.weather as WeatherCondition,
      temperature_min: row.temperature_min,
      temperature_max: row.temperature_max,
      arret_chantier: row.weather_stop,
    },
    effectifs: row.personnel || [],
    activites: row.activities || [],
    livraisons: row.deliveries || [],
    incidents: row.incidents || [],
    securite: row.safety_check,
    observations: row.observations,
    photos: row.photos || [],
    status: row.status as EntryStatus || 'brouillon',
    valide_par: row.validated_by,
    valide_date: row.validated_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapPhase2JournalToEntry(row: any): JournalEntry {
  const meteo = row.meteo || {};
  return {
    id: row.id,
    chantier_id: row.chantier_id,
    date: row.date_journal,
    type: 'quotidien',
    meteo: {
      condition: meteo.matin || meteo.condition || 'nuageux',
      temperature_min: meteo.temperature_min,
      temperature_max: meteo.temperature_max,
      intemperies: meteo.intemperie,
      arret_chantier: meteo.arret_chantier,
    },
    effectifs: row.effectifs || [],
    activites: row.travaux_realises || [],
    livraisons: row.livraisons || [],
    incidents: row.incidents || [],
    securite: row.securite,
    observations: row.observations,
    photos: row.photos || [],
    status: (row.statut || 'brouillon') as EntryStatus,
    valide_par: row.valide_par,
    valide_date: row.valide_date,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function calculateDaysWithoutIncident(entries: JournalEntry[]): number {
  if (entries.length === 0) return 0;

  const sortedEntries = [...entries].sort((a, b) =>
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  let days = 0;
  for (const entry of sortedEntries) {
    const hasIncident = entry.incidents && entry.incidents.some(i =>
      i.gravite === 'majeur' || i.gravite === 'moyen'
    );
    if (hasIncident) break;
    days++;
  }

  return days;
}

export default useJournalEntries;
