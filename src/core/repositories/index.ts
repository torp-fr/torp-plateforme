export { BaseRepository } from './BaseRepository.js';
export { EntrepriseRepository, type Entreprise } from './EntrepriseRepository.js';
export { ClientRepository, type Client } from './ClientRepository.js';
export { ProjetRepository, type Projet } from './ProjetRepository.js';
export { DevisRepository, type Devis } from './DevisRepository.js';
export { AuditRepository, type Audit, type QRCode } from './AuditRepository.js';

import type { SupabaseClient } from '@supabase/supabase-js';
import { EntrepriseRepository } from './EntrepriseRepository.js';
import { ClientRepository } from './ClientRepository.js';
import { ProjetRepository } from './ProjetRepository.js';
import { DevisRepository } from './DevisRepository.js';
import { AuditRepository } from './AuditRepository.js';

export function initRepositories(db: SupabaseClient) {
  return {
    entreprise: new EntrepriseRepository(db),
    client:     new ClientRepository(db),
    projet:     new ProjetRepository(db),
    devis:      new DevisRepository(db),
    audit:      new AuditRepository(db),
  } as const;
}

export type Repositories = ReturnType<typeof initRepositories>;
