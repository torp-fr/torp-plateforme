import type { SupabaseClient } from '@supabase/supabase-js';
import { BaseRepository } from './BaseRepository.js';

export interface Client extends Record<string, unknown> {
  id: string;
  entreprise_id: string;
  nom: string;
  prenom: string | null;
  email: string | null;
  telephone: string | null;
  localisation: unknown;
  contexte_local: unknown;
  created_at: string;
  updated_at: string;
  pipeline_status: unknown;
}

export class ClientRepository extends BaseRepository<Client> {
  constructor(db: SupabaseClient) {
    super(db, 'clients');
  }

  async findByEntrepriseId(entrepriseId: string): Promise<Client[]> {
    return this.findMany({ entreprise_id: entrepriseId });
  }

  async updateLocalization(clientId: string, localisation: unknown): Promise<Client> {
    return this.update(clientId, {
      localisation,
      pipeline_status: { localization_status: 'completed', last_localization: new Date().toISOString() },
    });
  }
}
