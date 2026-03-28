import type { SupabaseClient } from '@supabase/supabase-js';

export class BaseRepository<T extends Record<string, unknown>> {
  constructor(
    protected db: SupabaseClient,
    protected tableName: string
  ) {}

  async findById(id: string): Promise<T | null> {
    const { data, error } = await this.db
      .from(this.tableName)
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return (data as T) ?? null;
  }

  async findMany(filter?: Record<string, unknown>, limit = 100): Promise<T[]> {
    let q = this.db.from(this.tableName).select('*').limit(limit);
    if (filter) {
      for (const [k, v] of Object.entries(filter)) q = q.eq(k, v as string);
    }
    const { data, error } = await q;
    if (error) throw error;
    return (data as T[]) ?? [];
  }

  async create(payload: Omit<T, 'id' | 'created_at' | 'updated_at'>): Promise<T> {
    const { data, error } = await this.db
      .from(this.tableName)
      .insert(payload)
      .select()
      .single();

    if (error) throw error;
    return data as T;
  }

  async update(id: string, payload: Partial<T>): Promise<T> {
    const { data, error } = await this.db
      .from(this.tableName)
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as T;
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.db.from(this.tableName).delete().eq('id', id);
    if (error) throw error;
  }
}
