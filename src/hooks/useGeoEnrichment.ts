import { useState, useCallback } from 'react';
import {
  geocodingService,
  GeocodingResult,
  DistanceResult,
  GeoZone,
} from '@/services/api/geocoding.service';

export interface GeoEnrichmentData {
  // Adresse entreprise géocodée
  entreprise?: {
    address: string;
    coordinates: { lat: number; lng: number } | null;
    departement?: string;
    region?: string;
    codePostal?: string;
    ville?: string;
  };

  // Adresse chantier géocodée
  chantier?: {
    address: string;
    coordinates: { lat: number; lng: number } | null;
    departement?: string;
    region?: string;
    codePostal?: string;
    ville?: string;
  };

  // Distance calculée
  distance?: DistanceResult;

  // Zone géographique du chantier
  geoZone?: GeoZone;
}

export interface UseGeoEnrichmentResult {
  data: GeoEnrichmentData;
  loading: boolean;
  error: string | null;

  // Actions
  geocodeEntreprise: (address: string) => Promise<GeocodingResult | null>;
  geocodeChantier: (address: string) => Promise<GeocodingResult | null>;
  calculateDistance: () => Promise<DistanceResult | null>;
  enrichFromAnalysis: (analysis: {
    entreprise?: { adresse?: string };
    chantier?: { adresse?: string };
  }) => Promise<void>;
  reset: () => void;
}

export function useGeoEnrichment(): UseGeoEnrichmentResult {
  const [data, setData] = useState<GeoEnrichmentData>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const geocodeEntreprise = useCallback(async (address: string): Promise<GeocodingResult | null> => {
    setLoading(true);
    setError(null);

    try {
      const result = await geocodingService.geocode(address, { limit: 1 });

      if (result.success && result.data && result.data.length > 0) {
        const geo = result.data[0];
        setData(prev => ({
          ...prev,
          entreprise: {
            address: geo.label,
            coordinates: geo.coordinates,
            departement: geo.departement,
            region: geo.region,
            codePostal: geo.postcode,
            ville: geo.city,
          },
        }));
        return geo;
      } else {
        setError(result.error || 'Adresse entreprise non trouvée');
        return null;
      }
    } catch (err) {
      setError('Erreur lors du géocodage entreprise');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const geocodeChantier = useCallback(async (address: string): Promise<GeocodingResult | null> => {
    setLoading(true);
    setError(null);

    try {
      const result = await geocodingService.geocode(address, { limit: 1 });

      if (result.success && result.data && result.data.length > 0) {
        const geo = result.data[0];

        // Récupérer aussi la zone géographique
        let geoZone: GeoZone | undefined;
        if (geo.postcode) {
          const zoneResult = geocodingService.getGeoZone(geo.postcode);
          if (zoneResult.success && zoneResult.data) {
            geoZone = zoneResult.data;
          }
        }

        setData(prev => ({
          ...prev,
          chantier: {
            address: geo.label,
            coordinates: geo.coordinates,
            departement: geo.departement,
            region: geo.region,
            codePostal: geo.postcode,
            ville: geo.city,
          },
          geoZone,
        }));
        return geo;
      } else {
        setError(result.error || 'Adresse chantier non trouvée');
        return null;
      }
    } catch (err) {
      setError('Erreur lors du géocodage chantier');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const calculateDistance = useCallback(async (): Promise<DistanceResult | null> => {
    const entrepriseCoords = data.entreprise?.coordinates;
    const chantierCoords = data.chantier?.coordinates;

    if (!entrepriseCoords || !chantierCoords) {
      setError('Coordonnées manquantes pour calculer la distance');
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const result = geocodingService.calculateDistanceFromCoords(
        entrepriseCoords,
        chantierCoords
      );

      if (result.success && result.data) {
        setData(prev => ({
          ...prev,
          distance: result.data,
        }));
        return result.data;
      } else {
        setError(result.error || 'Erreur calcul distance');
        return null;
      }
    } catch (err) {
      setError('Erreur lors du calcul de distance');
      return null;
    } finally {
      setLoading(false);
    }
  }, [data.entreprise?.coordinates, data.chantier?.coordinates]);

  const enrichFromAnalysis = useCallback(async (analysis: {
    entreprise?: { adresse?: string };
    chantier?: { adresse?: string };
  }): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const promises: Promise<GeocodingResult | null>[] = [];

      if (analysis.entreprise?.adresse) {
        promises.push(geocodeEntreprise(analysis.entreprise.adresse));
      }

      if (analysis.chantier?.adresse) {
        promises.push(geocodeChantier(analysis.chantier.adresse));
      }

      const results = await Promise.all(promises);

      // Si les deux adresses sont géocodées, calculer la distance
      const hasEntreprise = results[0] !== null || data.entreprise?.coordinates;
      const hasChantier = analysis.chantier?.adresse
        ? results[results.length - 1] !== null
        : data.chantier?.coordinates;

      if (hasEntreprise && hasChantier) {
        // Attendre que le state soit mis à jour puis calculer
        setTimeout(async () => {
          await calculateDistance();
        }, 100);
      }
    } catch (err) {
      setError('Erreur lors de l\'enrichissement géographique');
    } finally {
      setLoading(false);
    }
  }, [geocodeEntreprise, geocodeChantier, calculateDistance, data]);

  const reset = useCallback(() => {
    setData({});
    setError(null);
    setLoading(false);
  }, []);

  return {
    data,
    loading,
    error,
    geocodeEntreprise,
    geocodeChantier,
    calculateDistance,
    enrichFromAnalysis,
    reset,
  };
}

export default useGeoEnrichment;
