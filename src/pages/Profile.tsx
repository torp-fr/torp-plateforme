import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/Header';
import { BackButton } from '@/components/BackButton';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { useApp } from '@/context/AppContext';
import { useToast } from '@/hooks/use-toast';
import { authService } from '@/services/api/supabase/auth.service';
import { DataField, DataFieldGroup, formatters } from '@/components/ui/DataField';
import {
  User,
  Mail,
  Phone,
  Building,
  Shield,
  CreditCard,
  Bell,
  Settings,
  LogOut,
  Save,
  Eye,
  EyeOff,
  Key,
  CheckCircle,
  AlertCircle,
  Crown,
  FileText
} from 'lucide-react';

export default function Profile() {
  const { user, setUser, logout } = useApp();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Form states
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    company: user?.company || '',
  });

  // Password change states
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });

  // Redirect if not authenticated
  useEffect(() => {
    if (!user) {
      navigate('/login');
    }
  }, [user, navigate]);

  // Update form data when user changes
  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || '',
        company: user.company || '',
      });
    }
  }, [user]);

  const handleSaveProfile = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const updatedUser = await authService.updateProfile(user.id, {
        name: formData.name,
        phone: formData.phone,
        company: formData.company,
      });

      setUser(updatedUser);
      setIsEditing(false);
      toast({
        title: 'Profil mis à jour',
        description: 'Vos informations ont été enregistrées avec succès.',
      });
    } catch (error) {
      console.error('[Profile] Update error:', error);
      toast({
        title: 'Erreur',
        description: error instanceof Error ? error.message : 'Une erreur est survenue.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangePassword = async () => {
    // Validate passwords
    if (passwordData.newPassword.length < 8) {
      toast({
        title: 'Mot de passe trop court',
        description: 'Le mot de passe doit contenir au moins 8 caractères.',
        variant: 'destructive',
      });
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast({
        title: 'Les mots de passe ne correspondent pas',
        description: 'Veuillez vérifier que les deux mots de passe sont identiques.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      await authService.resetPassword('', passwordData.newPassword);
      setShowPasswordForm(false);
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      toast({
        title: 'Mot de passe modifié',
        description: 'Votre mot de passe a été mis à jour avec succès.',
      });
    } catch (error) {
      console.error('[Profile] Password change error:', error);
      toast({
        title: 'Erreur',
        description: error instanceof Error ? error.message : 'Une erreur est survenue.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
      toast({
        title: 'Déconnexion réussie',
        description: 'À bientôt sur TORP !',
      });
    } catch (error) {
      console.error('[Profile] Logout error:', error);
    }
  };

  if (!user) {
    return null;
  }

  const userTypeLabel = user.type === 'B2C' ? 'Particulier' : user.type === 'B2B' ? 'Professionnel' : 'Administrateur';
  const userTypeIcon = user.type === 'B2C' ? User : user.type === 'B2B' ? Building : Crown;
  const UserTypeIcon = userTypeIcon;

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="container mx-auto px-4 py-8">
        <BackButton />

        {/* Header Section */}
        <div className="mb-8">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-primary/10 rounded-full">
              <User className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Mon Profil</h1>
              <p className="text-muted-foreground">Gérez vos informations personnelles et paramètres</p>
            </div>
          </div>
        </div>

        <Tabs defaultValue="info" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
            <TabsTrigger value="info" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">Informations</span>
            </TabsTrigger>
            <TabsTrigger value="security" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              <span className="hidden sm:inline">Sécurité</span>
            </TabsTrigger>
            <TabsTrigger value="subscription" className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              <span className="hidden sm:inline">Abonnement</span>
            </TabsTrigger>
            <TabsTrigger value="preferences" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Préférences</span>
            </TabsTrigger>
          </TabsList>

          {/* Tab: Informations */}
          <TabsContent value="info">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <User className="h-5 w-5" />
                      Informations personnelles
                    </CardTitle>
                    <CardDescription>
                      Gérez vos coordonnées et informations de compte
                    </CardDescription>
                  </div>
                  {!isEditing ? (
                    <Button variant="outline" onClick={() => setIsEditing(true)}>
                      Modifier
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => setIsEditing(false)}>
                        Annuler
                      </Button>
                      <Button onClick={handleSaveProfile} disabled={isLoading}>
                        <Save className="h-4 w-4 mr-2" />
                        {isLoading ? 'Enregistrement...' : 'Enregistrer'}
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Type de compte */}
                <div className="p-4 bg-muted/50 rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <UserTypeIcon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">Type de compte</p>
                      <p className="text-sm text-muted-foreground">{userTypeLabel}</p>
                    </div>
                  </div>
                  <Badge variant="outline">{user.type}</Badge>
                </div>

                <Separator />

                {/* Form fields */}
                {isEditing ? (
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="name">Nom complet</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Votre nom"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        disabled
                        className="bg-muted"
                      />
                      <p className="text-xs text-muted-foreground">L'email ne peut pas être modifié</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Téléphone</Label>
                      <Input
                        id="phone"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        placeholder="06 12 34 56 78"
                      />
                    </div>
                    {user.type === 'B2B' && (
                      <div className="space-y-2">
                        <Label htmlFor="company">Entreprise</Label>
                        <Input
                          id="company"
                          value={formData.company}
                          onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                          placeholder="Nom de l'entreprise"
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <DataFieldGroup columns={2}>
                    <DataField
                      label="Nom complet"
                      value={user.name}
                      icon={<User className="h-4 w-4" />}
                      variant="card"
                    />
                    <DataField
                      label="Email"
                      value={user.email}
                      icon={<Mail className="h-4 w-4" />}
                      variant="card"
                    />
                    <DataField
                      label="Téléphone"
                      value={user.phone}
                      icon={<Phone className="h-4 w-4" />}
                      variant="card"
                      formatter={formatters.phone}
                    />
                    {user.type === 'B2B' && (
                      <DataField
                        label="Entreprise"
                        value={user.company}
                        icon={<Building className="h-4 w-4" />}
                        variant="card"
                      />
                    )}
                  </DataFieldGroup>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Sécurité */}
          <TabsContent value="security">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Sécurité du compte
                </CardTitle>
                <CardDescription>
                  Gérez votre mot de passe et les options de sécurité
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Password section */}
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <Key className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">Mot de passe</p>
                        <p className="text-sm text-muted-foreground">Dernière modification: Non renseigné</p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => setShowPasswordForm(!showPasswordForm)}
                    >
                      {showPasswordForm ? 'Annuler' : 'Modifier'}
                    </Button>
                  </div>

                  {showPasswordForm && (
                    <div className="space-y-4 pt-4 border-t">
                      <div className="space-y-2">
                        <Label htmlFor="newPassword">Nouveau mot de passe</Label>
                        <div className="relative">
                          <Input
                            id="newPassword"
                            type={showPasswords.new ? 'text' : 'password'}
                            value={passwordData.newPassword}
                            onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                            placeholder="••••••••"
                          />
                          <button
                            type="button"
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                          >
                            {showPasswords.new ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                        <p className="text-xs text-muted-foreground">Au moins 8 caractères</p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="confirmPassword">Confirmer le nouveau mot de passe</Label>
                        <div className="relative">
                          <Input
                            id="confirmPassword"
                            type={showPasswords.confirm ? 'text' : 'password'}
                            value={passwordData.confirmPassword}
                            onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                            placeholder="••••••••"
                          />
                          <button
                            type="button"
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
                          >
                            {showPasswords.confirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                      <Button onClick={handleChangePassword} disabled={isLoading}>
                        {isLoading ? 'Modification...' : 'Modifier le mot de passe'}
                      </Button>
                    </div>
                  )}
                </div>

                {/* Session info */}
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-success/10 rounded-lg">
                      <CheckCircle className="h-5 w-5 text-success" />
                    </div>
                    <div>
                      <p className="font-medium">Session active</p>
                      <p className="text-sm text-muted-foreground">Vous êtes connecté depuis cet appareil</p>
                    </div>
                  </div>
                </div>

                {/* Logout button */}
                <div className="pt-4">
                  <Button variant="destructive" onClick={handleLogout} className="w-full sm:w-auto">
                    <LogOut className="h-4 w-4 mr-2" />
                    Se déconnecter
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Abonnement */}
          <TabsContent value="subscription">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Mon abonnement
                </CardTitle>
                <CardDescription>
                  Gérez votre formule et vos crédits d'analyse
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Current plan */}
                <div className="p-6 border rounded-lg bg-primary/5 border-primary/20">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-primary/10 rounded-lg">
                        <Crown className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold text-lg">
                          {user.subscriptionPlan || 'Gratuit'}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Statut: {user.subscriptionStatus === 'active' ? 'Actif' : 'Non renseigné'}
                        </p>
                      </div>
                    </div>
                    <Badge variant={user.subscriptionStatus === 'active' ? 'success' : 'secondary'}>
                      {user.subscriptionStatus === 'active' ? 'Actif' : 'Gratuit'}
                    </Badge>
                  </div>

                  <Separator className="my-4" />

                  <p className="text-sm text-muted-foreground mb-4">
                    TORP est actuellement en phase de test gratuite. Profitez de toutes les fonctionnalités sans frais !
                  </p>

                  <Button variant="outline" disabled>
                    Gérer l'abonnement (bientôt disponible)
                  </Button>
                </div>

                {/* Usage stats */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center gap-3 mb-2">
                      <FileText className="h-5 w-5 text-primary" />
                      <span className="font-medium">Analyses effectuées</span>
                    </div>
                    <p className="text-2xl font-bold">Non renseigné</p>
                    <p className="text-sm text-muted-foreground">Ce mois-ci</p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center gap-3 mb-2">
                      <CreditCard className="h-5 w-5 text-primary" />
                      <span className="font-medium">Crédits restants</span>
                    </div>
                    <p className="text-2xl font-bold">Illimité</p>
                    <p className="text-sm text-muted-foreground">Phase de test gratuite</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Préférences */}
          <TabsContent value="preferences">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Préférences
                </CardTitle>
                <CardDescription>
                  Personnalisez votre expérience TORP
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Notifications */}
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Bell className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">Notifications</p>
                      <p className="text-sm text-muted-foreground">
                        Gérez vos préférences de notifications par email
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3 text-sm text-muted-foreground">
                    <p>Les préférences de notification seront bientôt disponibles.</p>
                  </div>
                </div>

                {/* Data & Privacy */}
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Shield className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">Données & Confidentialité</p>
                      <p className="text-sm text-muted-foreground">
                        Vos données sont stockées de manière sécurisée
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Button variant="outline" size="sm" disabled>
                      Exporter mes données (bientôt)
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
