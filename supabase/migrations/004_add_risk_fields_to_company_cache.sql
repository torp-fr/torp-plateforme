-- Migration: Add Risk Assessment Fields to Company Cache
-- Description: Adds risk_level and risk_indicators columns for better risk tracking
-- Date: 2025-11-25

-- Add risk_level column
ALTER TABLE public.company_data_cache
ADD COLUMN IF NOT EXISTS risk_level TEXT
CHECK (risk_level IN ('low', 'medium', 'high', 'critical'))
DEFAULT 'low';

-- Add risk_indicators column (array of text)
ALTER TABLE public.company_data_cache
ADD COLUMN IF NOT EXISTS risk_indicators TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Add index for risk_level for faster filtering
CREATE INDEX IF NOT EXISTS idx_company_cache_risk_level
ON public.company_data_cache(risk_level);

-- Add comment
COMMENT ON COLUMN public.company_data_cache.risk_level IS 'Risk assessment level: low, medium, high, or critical';
COMMENT ON COLUMN public.company_data_cache.risk_indicators IS 'Array of risk indicators/alerts for this company';
