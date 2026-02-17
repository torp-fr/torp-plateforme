/**
 * Admin Settings Page - Platform configuration
 * Configure platform settings, preferences, and system options
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Settings, Bell, Lock, Globe } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function AdminSettingsPage() {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      // Simulate save
      await new Promise(resolve => setTimeout(resolve, 1000));
      toast({
        title: 'Settings saved',
        description: 'Your changes have been saved successfully.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save settings.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Admin Settings</h1>
        <p className="text-muted-foreground">Configure platform settings and preferences</p>
      </div>

      {/* General Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            General Settings
          </CardTitle>
          <CardDescription>Platform-wide configuration</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="platform-name">Platform Name</Label>
            <Input
              id="platform-name"
              placeholder="TORP"
              defaultValue="TORP"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="platform-url">Platform URL</Label>
            <Input
              id="platform-url"
              placeholder="https://torp.example.com"
              defaultValue="https://torp.example.com"
            />
          </div>
          <div className="space-y-2">
            <Label>Maintenance Mode</Label>
            <div className="flex items-center space-x-2">
              <Switch />
              <span className="text-sm text-muted-foreground">Enable maintenance mode</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notification Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notifications
          </CardTitle>
          <CardDescription>Configure notification preferences</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Email Notifications</Label>
              <Switch defaultChecked />
            </div>
            <p className="text-xs text-muted-foreground">Receive email alerts for important events</p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Daily Summary</Label>
              <Switch defaultChecked />
            </div>
            <p className="text-xs text-muted-foreground">Receive daily platform summary</p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Security Alerts</Label>
              <Switch defaultChecked />
            </div>
            <p className="text-xs text-muted-foreground">Receive critical security alerts</p>
          </div>
        </CardContent>
      </Card>

      {/* Security Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Security
          </CardTitle>
          <CardDescription>Security and privacy settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Two-Factor Authentication</Label>
              <Switch defaultChecked />
            </div>
            <p className="text-xs text-muted-foreground">Require 2FA for admin access</p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>IP Whitelist</Label>
              <Switch />
            </div>
            <p className="text-xs text-muted-foreground">Restrict admin access to whitelisted IPs</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="session-timeout">Session Timeout (minutes)</Label>
            <Input
              id="session-timeout"
              type="number"
              placeholder="60"
              defaultValue="60"
            />
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <Button onClick={handleSaveSettings} disabled={isSaving}>
        {isSaving ? 'Saving...' : 'Save Settings'}
      </Button>
    </div>
  );
}

export default AdminSettingsPage;
