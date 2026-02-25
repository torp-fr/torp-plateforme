import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useApp } from '@/context/AppContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
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
  Crown,
  FileText,
  MapPin,
  Home,
  Landmark,
  Briefcase,
  Users,
  Calendar,
  Ruler,
  Building2,
  UserCircle,
  Loader2
} from 'lucide-react';

// Types pour les champs de profil étendus
interface ExtendedUserProfile {
  // Commun
  name: string;
  email: string;
  phone: string;
  city: string;
  postal_code: string;
  department: string;
  bio: string;
  notification_email: boolean;
  notification_sms: boolean;
  // B2C - Bien immobilier
  property_type: 'house' | 'apartment' | 'building' | 'other' | null;
  property_surface: number | null;
  property_year: number | null;
  property_rooms: number | null;
  property_address: string;
  property_energy_class: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | null;
  is_owner: boolean;
  // B2B - Entreprise
  company: string;
  company_siret: string;
  company_activity: string;
  company_size: '1-10' | '11-50' | '51-200' | '200+' | null;
  company_role: string;
  company_address: string;
  company_code_ape: string;
  company_rcs: string;
  // B2G - Collectivité
  entity_name: string;
  entity_type: 'commune' | 'departement' | 'region' | 'epci' | 'other' | null;
  siret: string;
  entity_function: string;
  entity_address: string;
  entity_code_insee: string;
  entity_code_ape: string;
  entity_strate: 'moins_1000' | '1000_3500' | '3500_10000' | '10000_20000' | '20000_50000' | '50000_100000' | 'plus_100000' | null;
  entity_service_name: string;
  entity_service_email: string;
  // Meta
  profile_completion_percentage: number;
}

const PROPERTY_TYPES = [
  { value: 'house', label: 'Maison' },
  { value: 'apartment', label: 'Appartement' },
  { value: 'building', label: 'Immeuble' },
  { value: 'other', label: 'Autre' },
];

const COMPANY_SIZES = [
  { value: '1-10', label: '1-10 salariés' },
  { value: '11-50', label: '11-50 salariés' },
  { value: '51-200', label: '51-200 salariés' },
  { value: '200+', label: 'Plus de 200 salariés' },
];

const ENTITY_TYPES = [
  { value: 'commune', label: 'Commune' },
  { value: 'departement', label: 'Département' },
  { value: 'region', label: 'Région' },
  { value: 'epci', label: 'EPCI / Intercommunalité' },
  { value: 'other', label: 'Autre établissement public' },
];

const ENTITY_STRATES = [
  { value: 'moins_1000', label: 'Moins de 1 000 hab.' },
  { value: '1000_3500', label: '1 000 à 3 500 hab.' },
  { value: '3500_10000', label: '3 500 à 10 000 hab.' },
  { value: '10000_20000', label: '10 000 à 20 000 hab.' },
  { value: '20000_50000', label: '20 000 à 50 000 hab.' },
  { value: '50000_100000', label: '50 000 à 100 000 hab.' },
  { value: 'plus_100000', label: 'Plus de 100 000 hab.' },
];

const ENERGY_CLASSES = [
  { value: 'A', label: 'A - Excellent' },
  { value: 'B', label: 'B - Très bon' },
  { value: 'C', label: 'C - Bon' },
  { value: 'D', label: 'D - Moyen' },
  { value: 'E', label: 'E - Passable' },
  { value: 'F', label: 'F - Mauvais' },
  { value: 'G', label: 'G - Très mauvais' },
];

export default function Profile() {
  const { user, setUser, logout, userType } = useApp();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Form states
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [formData, setFormData] = useState<ExtendedUserProfile>({
    name: '',
    email: '',
    phone: '',
    city: '',
    postal_code: '',
    department: '',
    bio: '',
    notification_email: true,
    notification_sms: false,
    // B2C
    property_type: null,
    property_surface: null,
    property_year: null,
    property_rooms: null,
    property_address: '',
    property_energy_class: null,
    is_owner: true,
    // B2B
    company: '',
    company_siret: '',
    company_activity: '',
    company_size: null,
    company_role: '',
    company_address: '',
    company_code_ape: '',
    company_rcs: '',
    // B2G
    entity_name: '',
    entity_type: null,
    siret: '',
    entity_function: '',
    entity_address: '',
    entity_code_insee: '',
    entity_code_ape: '',
    entity_strate: null,
    entity_service_name: '',
    entity_service_email: '',
    profile_completion_percentage: 0,
  });

  // Password change states
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [passwordData, setPasswordData] = useState({
    newPassword: '',
    confirmPassword: '',
  });
  const [showPasswords, setShowPasswords] = useState({
    new: false,
    confirm: false,
  });

  // Redirect if not authenticated
  useEffect(() => {
    if (!user) {
      navigate('/login');
    }
  }, [user, navigate]);

  // Fetch extended profile data
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user?.id) {
        setIsFetching(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (error) throw error;

        if (data) {
          setFormData({
            name: data.full_name || '',
            email: data.email || '',
            phone: data.phone || '',
            city: data.city || '',
            postal_code: data.postal_code || '',
            department: data.department || '',
            bio: data.bio || '',
            notification_email: data.notification_email ?? true,
            notification_sms: data.notification_sms ?? false,
            // B2C
            property_type: data.property_type || null,
            property_surface: data.property_surface || null,
            property_year: data.property_year || null,
            property_rooms: data.property_rooms || null,
            property_address: data.property_address || '',
            property_energy_class: data.property_energy_class || null,
            is_owner: data.is_owner ?? true,
            // B2B
            company: data.company || '',
            company_siret: data.company_siret || '',
            company_activity: data.company_activity || '',
            company_size: data.company_size || null,
            company_role: data.company_role || '',
            company_address: data.company_address || '',
            company_code_ape: data.company_code_ape || '',
            company_rcs: data.company_rcs || '',
            // B2G
            entity_name: data.entity_name || '',
            entity_type: data.entity_type || null,
            siret: data.siret || '',
            entity_function: data.entity_function || '',
            entity_address: data.entity_address || '',
            entity_code_insee: data.entity_code_insee || '',
            entity_code_ape: data.entity_code_ape || '',
            entity_strate: data.entity_strate || null,
            entity_service_name: data.entity_service_name || '',
            entity_service_email: data.entity_service_email || '',
            profile_completion_percentage: data.profile_completion_percentage || 0,
          });
        }
      } catch (error) {
        console.error('[Profile] Error fetching profile:', error);
      } finally {
        setIsFetching(false);
      }
    };

    fetchProfile();
  }, [user?.id]);

  const handleSaveProfile = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const updates: Record<string, unknown> = {
        name: formData.name,
        phone: formData.phone,
        city: formData.city,
        postal_code: formData.postal_code,
        department: formData.department,
        bio: formData.bio,
        notification_email: formData.notification_email,
        notification_sms: formData.notification_sms,
        updated_at: new Date().toISOString(),
      };

      // Champs B2C
      if (userType === 'B2C') {
        updates.property_type = formData.property_type;
        updates.property_surface = formData.property_surface;
        updates.property_year = formData.property_year;
        updates.property_rooms = formData.property_rooms;
        updates.property_address = formData.property_address;
        updates.property_energy_class = formData.property_energy_class;
        updates.is_owner = formData.is_owner;
      }

      // Champs B2B
      if (userType === 'B2B') {
        updates.company = formData.company;
        updates.company_siret = formData.company_siret;
        updates.company_activity = formData.company_activity;
        updates.company_size = formData.company_size;
        updates.company_role = formData.company_role;
        updates.company_address = formData.company_address;
        updates.company_code_ape = formData.company_code_ape;
        updates.company_rcs = formData.company_rcs;
      }

      // Champs B2G
      if (userType === 'B2G') {
        updates.entity_name = formData.entity_name;
        updates.entity_type = formData.entity_type;
        updates.siret = formData.siret;
        updates.entity_function = formData.entity_function;
        updates.entity_address = formData.entity_address;
        updates.entity_code_insee = formData.entity_code_insee;
        updates.entity_code_ape = formData.entity_code_ape;
        updates.entity_strate = formData.entity_strate;
        updates.entity_service_name = formData.entity_service_name;
        updates.entity_service_email = formData.entity_service_email;
      }

      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id)
        .select()
        .single();

      if (error) throw error;

      // Update local user state
      if (data) {
        setUser({
          ...user,
          name: data.name,
          phone: data.phone,
          company: data.company,
        });
        setFormData(prev => ({
          ...prev,
          profile_completion_percentage: data.profile_completion_percentage || 0,
        }));
      }

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
      const { error } = await supabase.auth.updateUser({
        password: passwordData.newPassword,
      });

      if (error) throw error;

      setShowPasswordForm(false);
      setPasswordData({ newPassword: '', confirmPassword: '' });
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

  // Afficher le chargement pendant que l'utilisateur est récupéré ou le profil est chargé
  if (isFetching || !user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const userTypeLabel = userType === 'B2C' ? 'Particulier' : userType === 'B2B' ? 'Professionnel' : userType === 'B2G' ? 'Collectivité' : 'Administrateur';
  const userTypeIcon = userType === 'B2C' ? User : userType === 'B2B' ? Building : userType === 'B2G' ? Landmark : Crown;
  const UserTypeIcon = userTypeIcon;

  return (
    <>
      {/* Header Section */}
      <div className="mb-8">
        <div className="flex items-center gap-4">
          <div className="p-4 bg-primary/10 rounded-full">
            <UserCircle className="h-8 w-8 text-primary" />
          </div>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-foreground">Mon Profil</h1>
            <p className="text-muted-foreground">Gérez vos informations personnelles et paramètres</p>
          </div>
          {/* Profile completion */}
          <div className="hidden md:block text-right">
            <div className="text-sm text-muted-foreground mb-1">
              Profil complété à {formData.profile_completion_percentage}%
            </div>
            <Progress value={formData.profile_completion_percentage} className="w-32" />
          </div>
        </div>
      </div>

      <Tabs defaultValue="info" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
          <TabsTrigger value="info" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">Informations</span>
          </TabsTrigger>
          <TabsTrigger value="details" className="flex items-center gap-2">
            {userType === 'B2C' ? <Home className="h-4 w-4" /> : userType === 'B2B' ? <Briefcase className="h-4 w-4" /> : <Landmark className="h-4 w-4" />}
            <span className="hidden sm:inline">{userType === 'B2C' ? 'Mon bien' : userType === 'B2B' ? 'Entreprise' : 'Collectivité'}</span>
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            <span className="hidden sm:inline">Sécurité</span>
          </TabsTrigger>
          <TabsTrigger value="preferences" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Préférences</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab: Informations personnelles */}
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
                    Vos coordonnées et informations de base
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
                <Badge variant="outline">{userType}</Badge>
              </div>

              <Separator />

              {/* Form fields */}
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="name">Nom complet *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Votre nom"
                    disabled={!isEditing}
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
                  <Label htmlFor="phone">Téléphone *</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="06 12 34 56 78"
                    disabled={!isEditing}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city">Ville *</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    placeholder="Paris"
                    disabled={!isEditing}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="postal_code">Code postal</Label>
                  <Input
                    id="postal_code"
                    value={formData.postal_code}
                    onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                    placeholder="75001"
                    disabled={!isEditing}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="department">Département</Label>
                  <Input
                    id="department"
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    placeholder="Paris (75)"
                    disabled={!isEditing}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio">Bio / Notes</Label>
                <Textarea
                  id="bio"
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  placeholder="Quelques mots sur vous ou vos projets..."
                  disabled={!isEditing}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Détails spécifiques au type */}
        <TabsContent value="details">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {userType === 'B2C' ? (
                      <><Home className="h-5 w-5" /> Mon bien immobilier</>
                    ) : userType === 'B2B' ? (
                      <><Building2 className="h-5 w-5" /> Mon entreprise</>
                    ) : (
                      <><Landmark className="h-5 w-5" /> Ma collectivité</>
                    )}
                  </CardTitle>
                  <CardDescription>
                    {userType === 'B2C'
                      ? 'Informations sur votre bien pour personnaliser nos recommandations'
                      : userType === 'B2B'
                      ? 'Informations sur votre entreprise'
                      : 'Informations sur votre collectivité et établissement'}
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
              {/* B2C Fields */}
              {userType === 'B2C' && (
                <div className="space-y-4">
                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-sm">Type de bien *</Label>
                      <Select
                        value={formData.property_type || ''}
                        onValueChange={(value) => setFormData({ ...formData, property_type: value as ExtendedUserProfile['property_type'] })}
                        disabled={!isEditing}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Sélectionner..." />
                        </SelectTrigger>
                        <SelectContent>
                          {PROPERTY_TYPES.map((type) => (
                            <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm">Surface (m²) *</Label>
                      <Input
                        type="number"
                        value={formData.property_surface || ''}
                        onChange={(e) => setFormData({ ...formData, property_surface: parseInt(e.target.value) || null })}
                        placeholder="120"
                        disabled={!isEditing}
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm">Nombre de pièces</Label>
                      <Input
                        type="number"
                        value={formData.property_rooms || ''}
                        onChange={(e) => setFormData({ ...formData, property_rooms: parseInt(e.target.value) || null })}
                        placeholder="5"
                        disabled={!isEditing}
                        className="h-9"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm">Adresse du bien</Label>
                    <Input
                      value={formData.property_address}
                      onChange={(e) => setFormData({ ...formData, property_address: e.target.value })}
                      placeholder="12 Rue de la Paix, 75001 Paris"
                      disabled={!isEditing}
                      className="h-9"
                    />
                  </div>
                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-sm">Année construction</Label>
                      <Input
                        type="number"
                        value={formData.property_year || ''}
                        onChange={(e) => setFormData({ ...formData, property_year: parseInt(e.target.value) || null })}
                        placeholder="1985"
                        disabled={!isEditing}
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm">DPE</Label>
                      <Select
                        value={formData.property_energy_class || ''}
                        onValueChange={(value) => setFormData({ ...formData, property_energy_class: value as ExtendedUserProfile['property_energy_class'] })}
                        disabled={!isEditing}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Classe..." />
                        </SelectTrigger>
                        <SelectContent>
                          {ENERGY_CLASSES.map((ec) => (
                            <SelectItem key={ec.value} value={ec.value}>{ec.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm">Statut</Label>
                      <div className="flex items-center space-x-2 h-9 pt-1">
                        <Switch
                          checked={formData.is_owner}
                          onCheckedChange={(checked) => setFormData({ ...formData, is_owner: checked })}
                          disabled={!isEditing}
                        />
                        <span className="text-sm">{formData.is_owner ? 'Propriétaire' : 'Locataire'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* B2B Fields */}
              {userType === 'B2B' && (
                <div className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-sm">Nom de l'entreprise *</Label>
                      <Input
                        value={formData.company}
                        onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                        placeholder="Ma Société SAS"
                        disabled={!isEditing}
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm">Votre fonction *</Label>
                      <Input
                        value={formData.company_role}
                        onChange={(e) => setFormData({ ...formData, company_role: e.target.value })}
                        placeholder="Gérant, Directeur technique..."
                        disabled={!isEditing}
                        className="h-9"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm">Adresse du siège</Label>
                    <Input
                      value={formData.company_address}
                      onChange={(e) => setFormData({ ...formData, company_address: e.target.value })}
                      placeholder="10 Avenue des Champs-Élysées, 75008 Paris"
                      disabled={!isEditing}
                      className="h-9"
                    />
                  </div>
                  <div className="grid md:grid-cols-4 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-sm">SIRET *</Label>
                      <Input
                        value={formData.company_siret}
                        onChange={(e) => setFormData({ ...formData, company_siret: e.target.value })}
                        placeholder="123 456 789 00012"
                        disabled={!isEditing}
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm">Code APE</Label>
                      <Input
                        value={formData.company_code_ape}
                        onChange={(e) => setFormData({ ...formData, company_code_ape: e.target.value })}
                        placeholder="4399C"
                        disabled={!isEditing}
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm">RCS</Label>
                      <Input
                        value={formData.company_rcs}
                        onChange={(e) => setFormData({ ...formData, company_rcs: e.target.value })}
                        placeholder="Paris B 123 456 789"
                        disabled={!isEditing}
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm">Effectif</Label>
                      <Select
                        value={formData.company_size || ''}
                        onValueChange={(value) => setFormData({ ...formData, company_size: value as ExtendedUserProfile['company_size'] })}
                        disabled={!isEditing}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Taille..." />
                        </SelectTrigger>
                        <SelectContent>
                          {COMPANY_SIZES.map((size) => (
                            <SelectItem key={size.value} value={size.value}>{size.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm">Activité principale</Label>
                    <Input
                      value={formData.company_activity}
                      onChange={(e) => setFormData({ ...formData, company_activity: e.target.value })}
                      placeholder="Construction, Rénovation, Maîtrise d'œuvre..."
                      disabled={!isEditing}
                      className="h-9"
                    />
                  </div>
                </div>
              )}

              {/* B2G Fields */}
              {userType === 'B2G' && (
                <div className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-sm">Nom de la collectivité *</Label>
                      <Input
                        value={formData.entity_name}
                        onChange={(e) => setFormData({ ...formData, entity_name: e.target.value })}
                        placeholder="Ville de Lyon"
                        disabled={!isEditing}
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm">Type d'entité *</Label>
                      <Select
                        value={formData.entity_type || ''}
                        onValueChange={(value) => setFormData({ ...formData, entity_type: value as ExtendedUserProfile['entity_type'] })}
                        disabled={!isEditing}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Sélectionner..." />
                        </SelectTrigger>
                        <SelectContent>
                          {ENTITY_TYPES.map((type) => (
                            <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm">Adresse du siège</Label>
                    <Input
                      value={formData.entity_address}
                      onChange={(e) => setFormData({ ...formData, entity_address: e.target.value })}
                      placeholder="1 Place de la Mairie, 69001 Lyon"
                      disabled={!isEditing}
                      className="h-9"
                    />
                  </div>
                  <div className="grid md:grid-cols-4 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-sm">SIRET</Label>
                      <Input
                        value={formData.siret}
                        onChange={(e) => setFormData({ ...formData, siret: e.target.value })}
                        placeholder="213 750 000 00012"
                        disabled={!isEditing}
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm">Code INSEE</Label>
                      <Input
                        value={formData.entity_code_insee}
                        onChange={(e) => setFormData({ ...formData, entity_code_insee: e.target.value })}
                        placeholder="69123"
                        disabled={!isEditing}
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm">Code APE</Label>
                      <Input
                        value={formData.entity_code_ape}
                        onChange={(e) => setFormData({ ...formData, entity_code_ape: e.target.value })}
                        placeholder="84.11Z"
                        disabled={!isEditing}
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm">Strate démographique</Label>
                      <Select
                        value={formData.entity_strate || ''}
                        onValueChange={(value) => setFormData({ ...formData, entity_strate: value as ExtendedUserProfile['entity_strate'] })}
                        disabled={!isEditing}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Population..." />
                        </SelectTrigger>
                        <SelectContent>
                          {ENTITY_STRATES.map((s) => (
                            <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Separator />
                  <p className="text-sm font-medium">Votre contact</p>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-sm">Votre fonction *</Label>
                      <Input
                        value={formData.entity_function}
                        onChange={(e) => setFormData({ ...formData, entity_function: e.target.value })}
                        placeholder="Directeur des services techniques"
                        disabled={!isEditing}
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm">Service</Label>
                      <Input
                        value={formData.entity_service_name}
                        onChange={(e) => setFormData({ ...formData, entity_service_name: e.target.value })}
                        placeholder="Direction des Services Techniques"
                        disabled={!isEditing}
                        className="h-9"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm">Email du service</Label>
                    <Input
                      type="email"
                      value={formData.entity_service_email}
                      onChange={(e) => setFormData({ ...formData, entity_service_email: e.target.value })}
                      placeholder="services-techniques@mairie.fr"
                      disabled={!isEditing}
                      className="h-9"
                    />
                  </div>
                </div>
              )}

              <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-900">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  <strong>Pourquoi ces informations ?</strong><br />
                  Ces données nous permettent de personnaliser votre expérience et d'adapter nos recommandations à votre contexte spécifique.
                </p>
              </div>
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
                      <p className="text-sm text-muted-foreground">Modifiez votre mot de passe</p>
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
                  <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                    <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
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
              <div className="p-4 border rounded-lg space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Bell className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">Notifications</p>
                    <p className="text-sm text-muted-foreground">
                      Gérez vos préférences de notifications
                    </p>
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Notifications par email</Label>
                      <p className="text-sm text-muted-foreground">
                        Recevez des alertes et mises à jour par email
                      </p>
                    </div>
                    <Switch
                      checked={formData.notification_email}
                      onCheckedChange={(checked) => {
                        setFormData({ ...formData, notification_email: checked });
                        handleSaveProfile();
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Notifications SMS</Label>
                      <p className="text-sm text-muted-foreground">
                        Recevez des alertes urgentes par SMS
                      </p>
                    </div>
                    <Switch
                      checked={formData.notification_sms}
                      onCheckedChange={(checked) => {
                        setFormData({ ...formData, notification_sms: checked });
                        handleSaveProfile();
                      }}
                    />
                  </div>
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

              {/* Abonnement */}
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <CreditCard className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">Abonnement</p>
                    <p className="text-sm text-muted-foreground">
                      Statut: Phase de test gratuite
                    </p>
                  </div>
                </div>
                <Badge variant="secondary">Accès complet gratuit</Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
