/**
 * Admin Settings Page — Phase 3B Jalon 3
 * Fully connected to GET/PUT /api/v1/admin/settings (JWT)
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Globe, Bell, Lock, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { adminSettingsService } from '@/services/api/adminSettings.service';

type Settings = Record<string, unknown>;

export function AdminSettingsPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    adminSettingsService
      .getSettings()
      .then(setSettings)
      .catch((err: unknown) => {
        toast({
          title: 'Erreur',
          description: err instanceof Error ? err.message : 'Impossible de charger les paramètres',
          variant: 'destructive',
        });
      })
      .finally(() => setLoading(false));
  }, [toast]);

  const set = (key: string, value: unknown) =>
    setSettings(prev => (prev ? { ...prev, [key]: value } : prev));

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const updated = await adminSettingsService.updateSettings(settings);
      setSettings(updated);
      toast({ title: 'Paramètres enregistrés' });
    } catch (err) {
      toast({
        title: 'Erreur',
        description: err instanceof Error ? err.message : 'Échec de la sauvegarde',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="space-y-6 max-w-2xl">
        <h1 className="text-3xl font-bold text-foreground">Paramètres d'Administration</h1>
        <p className="text-destructive">Impossible de charger les paramètres.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Paramètres d'Administration</h1>
        <p className="text-muted-foreground mt-1">Configuration globale de la plateforme</p>
      </div>

      {/* ── Général ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Globe className="h-4 w-4" />
            Général
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Nom de la plateforme</label>
            <input
              type="text"
              value={String(settings.platform_name ?? '')}
              onChange={e => set('platform_name', e.target.value)}
              className="w-full px-3 py-2 border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">URL de la plateforme</label>
            <input
              type="url"
              value={String(settings.platform_url ?? '')}
              onChange={e => set('platform_url', e.target.value)}
              className="w-full px-3 py-2 border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(settings.maintenance_mode)}
                onChange={e => set('maintenance_mode', e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              <span className="text-sm font-medium">Mode maintenance</span>
            </label>
          </div>

          {Boolean(settings.maintenance_mode) && (
            <div>
              <label className="block text-sm font-medium mb-1">Message de maintenance</label>
              <textarea
                value={String(settings.maintenance_message ?? '')}
                onChange={e => set('maintenance_message', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Notifications ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="h-4 w-4" />
            Notifications
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { key: 'email_notifications_enabled', label: 'Notifications email' },
            { key: 'daily_summary_enabled',        label: 'Résumé quotidien' },
            { key: 'security_alerts_enabled',      label: 'Alertes de sécurité' },
          ].map(({ key, label }) => (
            <label key={key} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(settings[key])}
                onChange={e => set(key, e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              <span className="text-sm">{label}</span>
            </label>
          ))}
        </CardContent>
      </Card>

      {/* ── Sécurité ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Lock className="h-4 w-4" />
            Sécurité
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Timeout de session (minutes)
            </label>
            <input
              type="number"
              min={1}
              max={1440}
              value={Number(settings.session_timeout_minutes ?? 60)}
              onChange={e => set('session_timeout_minutes', parseInt(e.target.value, 10))}
              className="w-32 px-3 py-2 border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={Boolean(settings.require_2fa_for_admins)}
              onChange={e => set('require_2fa_for_admins', e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            <span className="text-sm font-medium">Exiger 2FA pour les admins</span>
          </label>
        </CardContent>
      </Card>

      {/* ── Actions ── */}
      <div className="flex gap-3 justify-end">
        <button
          type="button"
          onClick={() => navigate('/admin')}
          className="px-4 py-2 border rounded-md text-sm hover:bg-muted transition-colors"
        >
          Annuler
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center gap-2"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </div>
  );
}

export default AdminSettingsPage;
