/**
 * Phase 4 Services - Réception & Garanties
 * Index d'exportation de tous les services Phase 4
 */

export { oprService } from './opr.service';
export { receptionService } from './reception.service';
export { reservesService } from './reserves.service';
export { garantiesService } from './garanties.service';
export { doeDiuoService } from './doe-diuo.service';

// Re-export des types
export type {
  OPRSession,
  OPRParticipant,
  OPRControle,
  DocumentVerification,
  Reserve,
  ReserveGravite,
  ReserveStatut,
  ReservePhoto,
  Reception,
  ReceptionDecision,
  ReceptionSignataire,
  VisiteLeveeReserves,
  ReserveControle,
  Garantie,
  GarantieType,
  Desordre,
  DesordreStatut,
  RetenueGarantie,
  DOE,
  DocumentDOE,
  DocumentDOEType,
  CarnetSante,
  EntretienProgramme,
  EntretienRealise,
  DIUO,
  ZoneRisque,
  CheckListOPR,
  ParticipantRole,
} from '@/types/phase4.types';
