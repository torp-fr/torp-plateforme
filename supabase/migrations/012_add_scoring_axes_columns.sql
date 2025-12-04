-- Migration: Add Innovation/Durable and Transparence scoring axes columns to devis table
-- These store the new TORP scoring axes: Innovation & Développement Durable (50 pts) and Transparence (100 pts)

-- Add score_innovation_durable column (JSONB to store full scoring details)
ALTER TABLE devis
ADD COLUMN IF NOT EXISTS score_innovation_durable JSONB DEFAULT NULL;

-- Add score_transparence column (JSONB to store full scoring details)
ALTER TABLE devis
ADD COLUMN IF NOT EXISTS score_transparence JSONB DEFAULT NULL;

-- Add comments for documentation
COMMENT ON COLUMN devis.score_innovation_durable IS 'Score Innovation & Développement Durable (0-50 pts) with sub-axes details';
COMMENT ON COLUMN devis.score_transparence IS 'Score Transparence Documentation (0-100 pts) with 8 criteria details';
