-- Project Context - TORP
-- Migration pour stocker le contexte des projets par pièce

-- 1. Créer table: project_contexts
CREATE TABLE IF NOT EXISTS project_contexts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  address VARCHAR NOT NULL,
  coordinates JSONB,
  region VARCHAR,
  project_type VARCHAR NOT NULL,
  budget DECIMAL,
  square_meters_total DECIMAL NOT NULL,
  climate_zone VARCHAR,
  construction_year INTEGER,
  timeline VARCHAR,
  urgency VARCHAR,
  constraints TEXT[],
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- 2. Créer table: rooms
CREATE TABLE IF NOT EXISTS rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES project_contexts(id) ON DELETE CASCADE,
  name VARCHAR NOT NULL,
  surface DECIMAL NOT NULL,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- 3. Créer table: room_works
CREATE TABLE IF NOT EXISTS room_works (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  type VARCHAR NOT NULL,
  scope VARCHAR NOT NULL,
  scope_description TEXT,
  details TEXT NOT NULL,
  materials TEXT[],
  specific_constraints TEXT,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- 4. Créer index pour recherche rapide
CREATE INDEX IF NOT EXISTS idx_project_contexts_user_id ON project_contexts(user_id);
CREATE INDEX IF NOT EXISTS idx_project_contexts_created_at ON project_contexts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rooms_project_id ON rooms(project_id);
CREATE INDEX IF NOT EXISTS idx_room_works_room_id ON room_works(room_id);
CREATE INDEX IF NOT EXISTS idx_room_works_type ON room_works(type);

-- 5. Activer RLS
ALTER TABLE project_contexts ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_works ENABLE ROW LEVEL SECURITY;

-- 6. Créer policies pour sécurité
-- Les users ne peuvent voir/modifier que leurs propres contextes
CREATE POLICY "users_can_view_own_contexts" ON project_contexts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "users_can_create_contexts" ON project_contexts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_can_update_own_contexts" ON project_contexts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "users_can_delete_own_contexts" ON project_contexts
  FOR DELETE USING (auth.uid() = user_id);

-- Rooms: hérité via foreign key
CREATE POLICY "users_can_view_own_rooms" ON rooms
  FOR SELECT USING (
    project_id IN (SELECT id FROM project_contexts WHERE user_id = auth.uid())
  );

CREATE POLICY "users_can_create_rooms" ON rooms
  FOR INSERT WITH CHECK (
    project_id IN (SELECT id FROM project_contexts WHERE user_id = auth.uid())
  );

CREATE POLICY "users_can_update_rooms" ON rooms
  FOR UPDATE USING (
    project_id IN (SELECT id FROM project_contexts WHERE user_id = auth.uid())
  );

CREATE POLICY "users_can_delete_rooms" ON rooms
  FOR DELETE USING (
    project_id IN (SELECT id FROM project_contexts WHERE user_id = auth.uid())
  );

-- Room works: hérité via rooms
CREATE POLICY "users_can_view_own_works" ON room_works
  FOR SELECT USING (
    room_id IN (
      SELECT r.id FROM rooms r
      JOIN project_contexts p ON r.project_id = p.id
      WHERE p.user_id = auth.uid()
    )
  );

CREATE POLICY "users_can_create_works" ON room_works
  FOR INSERT WITH CHECK (
    room_id IN (
      SELECT r.id FROM rooms r
      JOIN project_contexts p ON r.project_id = p.id
      WHERE p.user_id = auth.uid()
    )
  );

CREATE POLICY "users_can_update_works" ON room_works
  FOR UPDATE USING (
    room_id IN (
      SELECT r.id FROM rooms r
      JOIN project_contexts p ON r.project_id = p.id
      WHERE p.user_id = auth.uid()
    )
  );

CREATE POLICY "users_can_delete_works" ON room_works
  FOR DELETE USING (
    room_id IN (
      SELECT r.id FROM rooms r
      JOIN project_contexts p ON r.project_id = p.id
      WHERE p.user_id = auth.uid()
    )
  );

-- 7. Créer fonction pour récupérer un contexte complet avec pièces et travaux
CREATE OR REPLACE FUNCTION get_project_context_complete(project_id UUID)
RETURNS TABLE (
  context_id UUID,
  user_id UUID,
  address VARCHAR,
  coordinates JSONB,
  region VARCHAR,
  project_type VARCHAR,
  budget DECIMAL,
  square_meters_total DECIMAL,
  climate_zone VARCHAR,
  construction_year INTEGER,
  timeline VARCHAR,
  urgency VARCHAR,
  constraints TEXT[],
  context_created_at TIMESTAMP,
  context_updated_at TIMESTAMP,
  rooms_data JSONB
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.user_id,
    p.address,
    p.coordinates,
    p.region,
    p.project_type,
    p.budget,
    p.square_meters_total,
    p.climate_zone,
    p.construction_year,
    p.timeline,
    p.urgency,
    p.constraints,
    p.created_at,
    p.updated_at,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', r.id,
          'projectId', r.project_id,
          'name', r.name,
          'surface', r.surface,
          'works', (
            SELECT jsonb_agg(
              jsonb_build_object(
                'id', w.id,
                'type', w.type,
                'scope', w.scope,
                'scopeDescription', w.scope_description,
                'details', w.details,
                'materials', w.materials,
                'specificConstraints', w.specific_constraints,
                'createdAt', w.created_at
              )
            )
            FROM room_works w
            WHERE w.room_id = r.id
          ),
          'createdAt', r.created_at
        )
      ) FILTER (WHERE r.id IS NOT NULL),
      '[]'::jsonb
    ) as rooms_data
  FROM project_contexts p
  LEFT JOIN rooms r ON p.id = r.project_id
  WHERE p.id = project_id
  GROUP BY p.id, p.user_id, p.address, p.coordinates, p.region, p.project_type,
           p.budget, p.square_meters_total, p.climate_zone, p.construction_year,
           p.timeline, p.urgency, p.constraints, p.created_at, p.updated_at;
END;
$$;

-- 8. Grants
GRANT SELECT ON project_contexts TO anon;
GRANT SELECT ON rooms TO anon;
GRANT SELECT ON room_works TO anon;
GRANT EXECUTE ON FUNCTION get_project_context_complete TO anon;
