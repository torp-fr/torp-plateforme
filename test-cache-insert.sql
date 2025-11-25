-- Insert manuel d'une entreprise de test dans le cache
-- À exécuter dans l'éditeur SQL Supabase

INSERT INTO company_data_cache (
  siret,
  siren,
  company_name,
  legal_name,
  cached_data,
  quality_score,
  data_source,
  risk_level,
  risk_indicators,
  last_fetched_at,
  next_refresh_at,
  refresh_strategy,
  fetch_count
) VALUES (
  '44306184100047',
  '443061841',
  'GOOGLE FRANCE',
  'GOOGLE FRANCE SARL',
  '{"nom_entreprise":"GOOGLE FRANCE","siren":"443061841","siret":"44306184100047","siege":{"siret":"44306184100047","adresse":"8 Rue de Londres, 75009 Paris","code_postal":"75009","ville":"Paris"},"date_creation":"2002-02-01","effectif":1500,"chiffre_affaires":900000000,"resultat":150000000,"statut_rcs":"Inscrit","activite_principale":"62.02A - Conseil en systemes et logiciels informatiques","forme_juridique":"SARL","capital":10000000}'::jsonb,
  95,
  'manual_test',
  'low',
  ARRAY[]::text[],
  NOW(),
  NOW() + INTERVAL '90 days',
  'standard',
  0
)
ON CONFLICT (siret)
DO UPDATE SET
  last_fetched_at = NOW(),
  fetch_count = company_data_cache.fetch_count + 1;

-- Vérifier l'insertion
SELECT
  siret,
  company_name,
  quality_score,
  risk_level,
  data_source,
  last_fetched_at
FROM company_data_cache
WHERE siret = '44306184100047';
