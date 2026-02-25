/**
 * Settings - Paramètres utilisateur
 * Permet à l'utilisateur de configurer son profil et son rôle
 */

import { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Building, Users, AlertCircle, Save } from 'lucide-react';

export default function Settings() {
  const { user, setUser } = useApp();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  // Form state
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [userType, setUserType] = useState(user?.type || 'B2B');

  // Track changes
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    // Check if anything changed
    const changed =
      name !== (user?.name || '') ||
      email !== (user?.email || '') ||
      phone !== (user?.phone || '') ||
      userType !== (user?.type || 'B2B');

    setHasChanges(changed);
  }, [name, email, phone, userType, user]);

  const handleSave = async () => {
    if (!user?.id) return;

    setIsLoading(true);

    try {
      // Update user in database
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: name,
          phone,
        })
        .eq('id', user.id);

      if (error) throw error;

      // Update context
      setUser({
        ...user,
        name,
        phone,
        type: userType as any,
      });

      toast({
        title: 'Paramètres sauvegardés',
        description: 'Vos modifications ont été enregistrées avec succès.',
      });

      setHasChanges(false);
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: 'Erreur',
        description: error instanceof Error ? error.message : 'Erreur lors de la sauvegarde',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground font-display">Paramètres</h1>
        <p className="text-muted-foreground mt-1">Configurez votre profil et vos préférences</p>
      </div>

      {/* Profile Section */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-primary">Profil personnel</CardTitle>
          <CardDescription>Informations de base de votre compte</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Nom complet</Label>
              <Input
                id="name"
                type="text"
                placeholder="Jean Dupont"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            {/* Email (read-only) */}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                L'email ne peut pas être changé. Contactez le support pour modifier.
              </p>
            </div>

            {/* Phone */}
            <div className="space-y-2">
              <Label htmlFor="phone">Téléphone</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="06 12 34 56 78"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Role Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-primary">Rôle utilisateur</CardTitle>
          <CardDescription>
            Sélectionnez votre statut pour accéder aux fonctionnalités appropriées
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Info Alert */}
          <Alert className="bg-blue-50 border-blue-200">
            <AlertCircle className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-900">
              <strong>À propos des rôles :</strong> Sélectionnez le rôle qui correspond à votre
              utilisation de TORP. Vous pouvez le modifier à tout moment.
            </AlertDescription>
          </Alert>

          {/* Role Selection */}
          <div className="space-y-3">
            <Label htmlFor="user-type">Votre rôle</Label>
            <Select value={userType} onValueChange={(value) => setUserType(value)}>
              <SelectTrigger id="user-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="B2C">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    <span>Particulier</span>
                  </div>
                </SelectItem>
                <SelectItem value="B2B">
                  <div className="flex items-center gap-2">
                    <Building className="h-4 w-4" />
                    <span>Professionnel (Entreprise BTP)</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Role Description */}
          <div className="mt-6 p-4 rounded-lg bg-muted/50 border border-border">
            {userType === 'B2C' ? (
              <div>
                <h4 className="font-semibold text-foreground mb-2">📋 Particulier</h4>
                <p className="text-sm text-muted-foreground">
                  Vous êtes propriétaire ou locataire. Vous pouvez analyser vos devis et bénéficier
                  de recommandations pour vos travaux.
                </p>
              </div>
            ) : (
              <div>
                <h4 className="font-semibold text-foreground mb-2">🏢 Professionnel</h4>
                <p className="text-sm text-muted-foreground">
                  Vous êtes une entreprise BTP. Vous pouvez accéder aux outils avancés, gérer vos
                  projets et vos analyses.
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end gap-3">
        <Button
          variant="outline"
          onClick={() => {
            // Reset to current user values
            setName(user?.name || '');
            setEmail(user?.email || '');
            setPhone(user?.phone || '');
            setUserType(user?.type || 'B2B');
            setHasChanges(false);
          }}
          disabled={!hasChanges || isLoading}
        >
          Annuler
        </Button>
        <Button
          onClick={handleSave}
          disabled={!hasChanges || isLoading}
          className="gap-2"
        >
          <Save className="h-4 w-4" />
          {isLoading ? 'Sauvegarde...' : 'Sauvegarder les modifications'}
        </Button>
      </div>
    </div>
  );
}
