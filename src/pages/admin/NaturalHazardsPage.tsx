/**
 * NaturalHazardsPage — Natural hazards lookup via Géorisques API.
 * Enter coordinates or address → displays natural + technological risks + seismic zone.
 */

import { useState } from 'react';
import {
  AlertTriangle, MapPin, Search, Shield, Zap, Waves, Mountain, Wind,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

// ── Types ─────────────────────────────────────────────────────────────────────

interface NaturalHazard {
  type:        string;
  present:     boolean;
  description: string | null;
}

interface SeismicZone {
  code_zone:      string;
  zone_sismicite: string;
}

interface RiskReport {
  lat:                    number;
  lng:                    number;
  commune:                string | null;
  url_rapport:            string | null;
  risques_naturels:       NaturalHazard[];
  risques_technologiques: NaturalHazard[];
  seismic_zone:           SeismicZone | null;
  source:                 string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function hazardIcon(type: string) {
  const t = type.toLowerCase();
  if (t.includes('inondation') || t.includes('flood')) return <Waves className="h-4 w-4" />;
  if (t.includes('séisme') || t.includes('sismique'))  return <Zap className="h-4 w-4" />;
  if (t.includes('mouvement') || t.includes('glissement')) return <Mountain className="h-4 w-4" />;
  if (t.includes('vent') || t.includes('tempête'))    return <Wind className="h-4 w-4" />;
  return <AlertTriangle className="h-4 w-4" />;
}

function seismicColor(code: string) {
  const n = parseInt(code, 10);
  if (n <= 1) return 'bg-green-100 text-green-800';
  if (n === 2) return 'bg-yellow-100 text-yellow-800';
  if (n === 3) return 'bg-orange-100 text-orange-800';
  return 'bg-red-100 text-red-800';
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function NaturalHazardsPage() {
  const [lat,     setLat]     = useState('');
  const [lng,     setLng]     = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [report,  setReport]  = useState<RiskReport | null>(null);

  async function handleSearch() {
    const latN = parseFloat(lat);
    const lngN = parseFloat(lng);
    if (isNaN(latN) || isNaN(lngN)) {
      setError('Coordonnées invalides. Exemple : lat=48.8566, lng=2.3522 (Paris)');
      return;
    }

    setLoading(true);
    setError(null);
    setReport(null);

    try {
      // Call Géorisques directly from the browser (CORS-permissive open API)
      const [riskResp, seismResp] = await Promise.all([
        fetch(`https://www.georisques.gouv.fr/api/v1/resultats_rapport_risque?latlon=${lngN},${latN}&rayon=100`),
        fetch(`https://www.georisques.gouv.fr/api/v1/zonage_sismique?latlon=${lngN},${latN}`),
      ]);

      if (!riskResp.ok) throw new Error(`Géorisques returned ${riskResp.status}`);
      const riskData = await riskResp.json();

      let seismicZone: SeismicZone | null = null;
      if (seismResp.ok) {
        const seismData = await seismResp.json();
        const z = seismData.data?.[0];
        if (z) seismicZone = { code_zone: z.code_zone ?? '?', zone_sismicite: z.zone_sismicite ?? '?' };
      }

      setReport({
        lat: latN,
        lng: lngN,
        commune:   riskData.commune  ?? null,
        url_rapport: riskData.url    ?? null,
        risques_naturels: (riskData.risquesNaturels ?? []).map((r: any) => ({
          type:        r.type ?? r.lib_risque_jo ?? 'Inconnu',
          present:     r.present ?? false,
          description: r.lib_risque_jo ?? null,
        })),
        risques_technologiques: (riskData.risquesTechnologiques ?? []).map((r: any) => ({
          type:        r.type ?? r.lib_risque_jo ?? 'Inconnu',
          present:     r.present ?? false,
          description: r.lib_risque_jo ?? null,
        })),
        seismic_zone: seismicZone,
        source: 'georisques',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la requête');
    } finally {
      setLoading(false);
    }
  }

  const presentNatural = report?.risques_naturels.filter(r => r.present) ?? [];
  const presentTechno  = report?.risques_technologiques.filter(r => r.present) ?? [];

  return (
    <div className="p-6 space-y-6 max-w-4xl">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Shield className="h-6 w-6 text-orange-500" />
          Risques Naturels — Géorisques
        </h1>
        <p className="text-muted-foreground mt-1">
          Consultation des risques naturels et technologiques (source BRGM / MTES)
        </p>
      </div>

      {/* Search */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="h-4 w-4" /> Localisation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 flex-wrap">
            <Input
              placeholder="Latitude (ex: 48.8566)"
              value={lat}
              onChange={e => setLat(e.target.value)}
              className="w-48"
            />
            <Input
              placeholder="Longitude (ex: 2.3522)"
              value={lng}
              onChange={e => setLng(e.target.value)}
              className="w-48"
            />
            <Button onClick={handleSearch} disabled={loading}>
              <Search className="h-4 w-4 mr-2" />
              {loading ? 'Chargement…' : 'Consulter'}
            </Button>
          </div>
          {error && (
            <p className="text-red-600 text-sm mt-3">{error}</p>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {report && (
        <div className="space-y-4">
          {/* Location summary */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-4 flex-wrap">
                <span className="font-semibold">
                  {report.commune ?? `${report.lat}, ${report.lng}`}
                </span>
                {report.seismic_zone && (
                  <Badge className={seismicColor(report.seismic_zone.code_zone)}>
                    Zone sismique {report.seismic_zone.code_zone} — {report.seismic_zone.zone_sismicite}
                  </Badge>
                )}
                {report.url_rapport && (
                  <a
                    href={report.url_rapport}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 text-sm underline"
                  >
                    Rapport complet Géorisques
                  </a>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Natural hazards */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Risques naturels ({presentNatural.length} présents / {report.risques_naturels.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {report.risques_naturels.length === 0 ? (
                <p className="text-muted-foreground text-sm">Aucune donnée disponible</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {report.risques_naturels.map((r, i) => (
                    <div
                      key={i}
                      className={`flex items-center gap-2 p-2 rounded text-sm ${
                        r.present
                          ? 'bg-red-50 text-red-800 border border-red-200'
                          : 'bg-gray-50 text-gray-500'
                      }`}
                    >
                      {hazardIcon(r.type)}
                      <span className="flex-1">{r.description ?? r.type}</span>
                      {r.present && <Badge variant="destructive" className="text-xs">Présent</Badge>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Technological hazards */}
          {report.risques_technologiques.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Risques technologiques ({presentTechno.length} présents)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {report.risques_technologiques.map((r, i) => (
                    <div
                      key={i}
                      className={`flex items-center gap-2 p-2 rounded text-sm ${
                        r.present
                          ? 'bg-orange-50 text-orange-800 border border-orange-200'
                          : 'bg-gray-50 text-gray-500'
                      }`}
                    >
                      <AlertTriangle className="h-4 w-4" />
                      <span className="flex-1">{r.description ?? r.type}</span>
                      {r.present && <Badge className="bg-orange-500 text-xs">Présent</Badge>}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
