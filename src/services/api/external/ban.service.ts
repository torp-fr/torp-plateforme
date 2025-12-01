/**
 * Service Base Adresse Nationale (BAN) - Open Data gratuite
 * Documentation: https://adresse.data.gouv.fr/api-doc/adresse
 *
 * Données disponibles:
 * - Recherche d'adresses françaises
 * - Géocodage (conversion adresse → coordonnées GPS)
 * - Validation et normalisation d'adresses
 */

export interface BANAddress {
  label: string; // Adresse complète formatée
  score: number; // Score de confiance (0-1)
  housenumber?: string;
  street?: string;
  postcode?: string;
  city?: string;
  citycode?: string; // Code INSEE commune
  coordinates: {
    lat: number;
    lon: number;
  };
}

/**
 * Rechercher et valider une adresse via BAN
 * Gratuit, sans authentification
 */
export async function searchAddress(query: string): Promise<BANAddress[]> {
  try {
    const response = await fetch(
      `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(query)}&limit=5`
    );

    if (!response.ok) {
      console.warn(`❌ BAN API: ${response.status}`);
      return [];
    }

    const data = await response.json();

    return data.features?.map((feature: any) => ({
      label: feature.properties.label,
      score: feature.properties.score,
      housenumber: feature.properties.housenumber,
      street: feature.properties.street,
      postcode: feature.properties.postcode,
      city: feature.properties.city,
      citycode: feature.properties.citycode,
      coordinates: {
        lat: feature.geometry.coordinates[1],
        lon: feature.geometry.coordinates[0],
      }
    })) || [];
  } catch (error) {
    console.error('❌ Erreur BAN API:', error);
    return [];
  }
}

/**
 * Enrichir une adresse incomplète
 * Exemple: "123 rue de la Paix Paris" → adresse complète avec code postal
 */
export async function enrichAddress(
  street?: string,
  city?: string,
  postcode?: string
): Promise<BANAddress | null> {
  const parts = [street, postcode, city].filter(Boolean);
  if (parts.length === 0) return null;

  const query = parts.join(' ');
  const results = await searchAddress(query);

  // Retourner le résultat avec le meilleur score
  return results.length > 0 ? results[0] : null;
}
