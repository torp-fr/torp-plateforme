export { BaseAPIClient } from './BaseAPIClient.js';
export { PappersClient } from './PappersClient.js';
export { DataGouvClient } from './DataGouvClient.js';
export { IGNClient } from './IGNClient.js';
export { NominatimClient } from './NominatimClient.js';
export { TrustpilotClient } from './TrustpilotClient.js';

import { PappersClient } from './PappersClient.js';
import { DataGouvClient } from './DataGouvClient.js';
import { IGNClient } from './IGNClient.js';
import { NominatimClient } from './NominatimClient.js';
import { TrustpilotClient } from './TrustpilotClient.js';

/**
 * Singleton API clients — initialized once with env vars.
 * trustpilot is null if key not set (optional paid API).
 */
export const apiClients = {
  pappers:    new PappersClient(process.env['PAPPERS_API_KEY'] ?? ''),
  datagouv:   new DataGouvClient(),
  ign:        new IGNClient(process.env['IGN_API_KEY'] ?? ''),
  nominatim:  new NominatimClient(),
  trustpilot: process.env['TRUSTPILOT_API_KEY']
    ? new TrustpilotClient(process.env['TRUSTPILOT_API_KEY'])
    : null,
} as const;

export type APIClients = typeof apiClients;
