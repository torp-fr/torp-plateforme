/**
 * External APIs Services (P1)
 * Exporte tous les services externes
 * Ces services sont prêts pour implémentation P1
 */

export { INSEEService, inseeService } from './INSEEService';
export type { INSEECompanyData, INSEEGeoData } from './INSEEService';

export { PappersService, pappersService } from './PappersService';
export type { PappersCompanyData, PappersFinancialMetrics } from './PappersService';

export { BANService, banService } from './BANService';
export type { AddressResult, GeocodeResult } from './BANService';

export { GeorisquesService, georisquesService } from './GeorisquesService';
export type { GeorisquesData, EnvironmentalConstraints } from './GeorisquesService';
