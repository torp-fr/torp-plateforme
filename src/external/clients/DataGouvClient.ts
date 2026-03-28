import { BaseAPIClient } from './BaseAPIClient.js';
import type { APICallResult, DataGouvCertification } from '../types/index.js';

interface ODS_Record {
  fields: Record<string, unknown>;
}

interface ODS_Response {
  nhits?: number;
  records?: ODS_Record[];
}

export class DataGouvClient extends BaseAPIClient {
  constructor() {
    super({
      apiKey: '',
      baseUrl: 'https://data.opendatasoft.com/api/v2/catalog/datasets',
      timeout: 10000,
      retries: 2,
      backoffMs: 1000,
    });
  }

  async getCertificationsBySIRET(siret: string): Promise<APICallResult<DataGouvCertification[]>> {
    const certifications: DataGouvCertification[] = [];

    // Query RGE dataset (Reconnu Garant Environnement)
    const rgeResult = await this.callAPI<ODS_Response>('GET',
      '/liste-des-entreprises-rge-2/records', {
        query: { where: `siret='${siret}'`, limit: 50 },
        cacheKey: `datagouv:rge:${siret}`,
        cacheTTLSeconds: 86400 * 30,
      });

    if (rgeResult.success && rgeResult.data?.records) {
      for (const rec of rgeResult.data.records) {
        const f = rec.fields;
        certifications.push({
          id:           `rge:${f['numero_de_certification'] ?? crypto.randomUUID()}`,
          name:         'Reconnu Garant Environnement (RGE)',
          type:         'rge',
          issued_date:  String(f['date_obtention'] ?? ''),
          valid_until:  String(f['date_validite'] ?? ''),
          metadata: {
            numero:    f['numero_de_certification'],
            secteurs:  f['secteurs_activites'],
            domaines:  f['domaines_travaux'],
          },
        });
      }
    }

    // Query Qualiopi providers
    const qualiResult = await this.callAPI<ODS_Response>('GET',
      '/liste_organismes_qualiopi/records', {
        query: { where: `siret='${siret}'`, limit: 10 },
        cacheKey: `datagouv:qualiopi:${siret}`,
        cacheTTLSeconds: 86400 * 30,
      });

    if (qualiResult.success && qualiResult.data?.records) {
      for (const rec of qualiResult.data.records) {
        const f = rec.fields;
        certifications.push({
          id:          `qualiopi:${f['numero_certification'] ?? crypto.randomUUID()}`,
          name:        'Qualiopi',
          type:        'qualiopi',
          issued_date: String(f['date_certification'] ?? ''),
          valid_until: String(f['date_fin_validite'] ?? ''),
          metadata: { numero: f['numero_certification'] },
        });
      }
    }

    return { success: true, data: certifications, executionTimeMs: rgeResult.executionTimeMs };
  }
}
