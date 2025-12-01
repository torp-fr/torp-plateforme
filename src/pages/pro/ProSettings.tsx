/**
 * TORP B2B - Paramètres du Profil Entreprise
 * @route /pro/settings
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
  ArrowLeft,
  Building2,
  Mail,
  Phone,
  MapPin,
  Globe,
  Save,
  AlertCircle,
  CheckCircle2,
  User,
  Shield,
  Bell,
  CreditCard,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';

interface CompanyProfile {
  id: string;
  siret: string;
  siren: string;
  raison_sociale: string;
  forme_juridique: string | null;
  code_naf: string | null;
  adresse: string | null;
  code_postal: string | null;
  ville: string | null;
  telephone: string | null;
  email: string;
  site_web: string | null;
  date_creation: string | null;
  capital_social: number | null;
  effectif: string | null;
  dirigeant_nom: string | null;
  siret_verifie: boolean;
  siret_verifie_le: string | null;
  metadata: any;
}

export default function ProSettings() {
  const navigate = useNavigate();
  const { userType, user } = useApp();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [profile, setProfile] = useState<CompanyProfile | null>(null);

  // Formulaire
  const [formData, setFormData] = useState({
    raison_sociale: '',
    forme_juridique: '',
    adresse: '',
    code_postal: '',
    ville: '',
    telephone: '',
    email: '',
    site_web: '',
    dirigeant_nom: '',
  });

  // Préférences notifications
  const [notifications, setNotifications] = useState({
    email_analyse_completed: true,
    email_document_expiring: true,
    email_weekly_report: false,
  });

  useEffect(() => {
    if (userType !== 'B2B') {
      navigate('/dashboard');
      return;
    }
    loadProfile();
  }, [userType, navigate, user]);

  const loadProfile = async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('pro_company_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (fetchError) throw fetchError;

      setProfile(data);
      setFormData({
        raison_sociale: data.raison_sociale || '',
        forme_juridique: data.forme_juridique || '',
        adresse: data.adresse || '',
        code_postal: data.code_postal || '',
        ville: data.ville || '',
        telephone: data.telephone || '',
        email: data.email || '',
        site_web: data.site_web || '',
        dirigeant_nom: data.dirigeant_nom || '',
      });

      // Charger les préférences depuis metadata
      if (data.metadata?.notifications) {
        setNotifications(data.metadata.notifications);
      }
    } catch (err) {
      console.error('Erreur chargement profil:', err);
      setError('Impossible de charger le profil entreprise');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!profile) return;

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const { error: updateError } = await supabase
        .from('pro_company_profiles')
        .update({
          raison_sociale: formData.raison_sociale,
          forme_juridique: formData.forme_juridique || null,
          adresse: formData.adresse || null,
          code_postal: formData.code_postal || null,
          ville: formData.ville || null,
          telephone: formData.telephone || null,
          email: formData.email,
          site_web: formData.site_web || null,
          dirigeant_nom: formData.dirigeant_nom || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', profile.id);

      if (updateError) throw updateError;

      setSuccess('Informations sauvegardées avec succès');
      await loadProfile();

      // Auto-hide success message
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Erreur sauvegarde:', err);
      setError('Impossible de sauvegarder les modifications');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveNotifications = async () => {
    if (!profile) return;

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const { error: updateError } = await supabase
        .from('pro_company_profiles')
        .update({
          metadata: {
            ...profile.metadata,
            notifications,
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', profile.id);

      if (updateError) throw updateError;

      setSuccess('Préférences de notifications sauvegardées');
      await loadProfile();

      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Erreur sauvegarde notifications:', err);
      setError('Impossible de sauvegarder les préférences');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Chargement des paramètres...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-red-800">
                <AlertCircle className="w-5 h-5" />
                <p>Profil entreprise introuvable</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-5xl mx-auto">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/pro/dashboard')}
          className="mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour au dashboard
        </Button>

        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Paramètres</h1>
          <p className="text-muted-foreground">
            Gérez les informations de votre entreprise et vos préférences
          </p>
        </div>

        {/* Messages */}
        {error && (
          <Card className="mb-6 border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-red-800">
                <AlertCircle className="w-5 h-5" />
                <p>{error}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {success && (
          <Card className="mb-6 border-green-200 bg-green-50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-green-800">
                <CheckCircle2 className="w-5 h-5" />
                <p>{success}</p>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="company" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="company">
              <Building2 className="w-4 h-4 mr-2" />
              Entreprise
            </TabsTrigger>
            <TabsTrigger value="notifications">
              <Bell className="w-4 h-4 mr-2" />
              Notifications
            </TabsTrigger>
            <TabsTrigger value="security">
              <Shield className="w-4 h-4 mr-2" />
              Sécurité
            </TabsTrigger>
            <TabsTrigger value="subscription">
              <CreditCard className="w-4 h-4 mr-2" />
              Abonnement
            </TabsTrigger>
          </TabsList>

          {/* Onglet Entreprise */}
          <TabsContent value="company">
            <Card>
              <CardHeader>
                <CardTitle>Informations de l'entreprise</CardTitle>
                <CardDescription>
                  Modifiez les informations de votre entreprise
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Informations vérifiées (non modifiables) */}
                <div>
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    Informations vérifiées (non modifiables)
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg">
                    <div>
                      <Label className="text-muted-foreground">SIRET</Label>
                      <p className="font-mono font-medium">{profile.siret}</p>
                      {profile.siret_verifie && (
                        <p className="text-xs text-green-600 flex items-center gap-1 mt-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Vérifié le{' '}
                          {profile.siret_verifie_le
                            ? new Date(profile.siret_verifie_le).toLocaleDateString('fr-FR')
                            : 'N/A'}
                        </p>
                      )}
                    </div>
                    <div>
                      <Label className="text-muted-foreground">SIREN</Label>
                      <p className="font-mono font-medium">{profile.siren}</p>
                    </div>
                    {profile.code_naf && (
                      <div>
                        <Label className="text-muted-foreground">Code NAF</Label>
                        <p className="font-medium">{profile.code_naf}</p>
                      </div>
                    )}
                    {profile.date_creation && (
                      <div>
                        <Label className="text-muted-foreground">Date de création</Label>
                        <p className="font-medium">
                          {new Date(profile.date_creation).toLocaleDateString('fr-FR')}
                        </p>
                      </div>
                    )}
                    {profile.capital_social && (
                      <div>
                        <Label className="text-muted-foreground">Capital social</Label>
                        <p className="font-medium">{profile.capital_social.toFixed(2)} €</p>
                      </div>
                    )}
                    {profile.effectif && (
                      <div>
                        <Label className="text-muted-foreground">Effectif</Label>
                        <p className="font-medium">{profile.effectif} employés</p>
                      </div>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Informations modifiables */}
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="raison_sociale">Raison sociale *</Label>
                    <Input
                      id="raison_sociale"
                      value={formData.raison_sociale}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, raison_sociale: e.target.value }))
                      }
                      placeholder="Nom de l'entreprise"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="forme_juridique">Forme juridique</Label>
                      <Input
                        id="forme_juridique"
                        value={formData.forme_juridique}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, forme_juridique: e.target.value }))
                        }
                        placeholder="SARL, SAS, EI..."
                      />
                    </div>
                    <div>
                      <Label htmlFor="dirigeant_nom">Nom du dirigeant</Label>
                      <Input
                        id="dirigeant_nom"
                        value={formData.dirigeant_nom}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, dirigeant_nom: e.target.value }))
                        }
                        placeholder="Prénom NOM"
                      />
                    </div>
                  </div>

                  <Separator />

                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    Adresse
                  </h3>

                  <div>
                    <Label htmlFor="adresse">Adresse complète</Label>
                    <Textarea
                      id="adresse"
                      value={formData.adresse}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, adresse: e.target.value }))
                      }
                      placeholder="Numéro, rue, bâtiment..."
                      rows={2}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="code_postal">Code postal</Label>
                      <Input
                        id="code_postal"
                        value={formData.code_postal}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, code_postal: e.target.value }))
                        }
                        placeholder="75001"
                      />
                    </div>
                    <div>
                      <Label htmlFor="ville">Ville</Label>
                      <Input
                        id="ville"
                        value={formData.ville}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, ville: e.target.value }))
                        }
                        placeholder="Paris"
                      />
                    </div>
                  </div>

                  <Separator />

                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    Contact
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="telephone">Téléphone</Label>
                      <Input
                        id="telephone"
                        type="tel"
                        value={formData.telephone}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, telephone: e.target.value }))
                        }
                        placeholder="01 23 45 67 89"
                      />
                    </div>
                    <div>
                      <Label htmlFor="email">Email *</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, email: e.target.value }))
                        }
                        placeholder="contact@entreprise.fr"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="site_web">Site web</Label>
                    <Input
                      id="site_web"
                      type="url"
                      value={formData.site_web}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, site_web: e.target.value }))
                      }
                      placeholder="https://www.entreprise.fr"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <Button onClick={handleSaveProfile} disabled={saving}>
                    <Save className="w-4 h-4 mr-2" />
                    {saving ? 'Sauvegarde...' : 'Sauvegarder les modifications'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Onglet Notifications */}
          <TabsContent value="notifications">
            <Card>
              <CardHeader>
                <CardTitle>Préférences de notifications</CardTitle>
                <CardDescription>
                  Choisissez les notifications que vous souhaitez recevoir par email
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="notif-analyse">Analyse terminée</Label>
                      <p className="text-sm text-muted-foreground">
                        Recevez un email lorsqu'une analyse de devis est terminée
                      </p>
                    </div>
                    <Switch
                      id="notif-analyse"
                      checked={notifications.email_analyse_completed}
                      onCheckedChange={(checked) =>
                        setNotifications((prev) => ({ ...prev, email_analyse_completed: checked }))
                      }
                    />
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="notif-document">Documents expirants</Label>
                      <p className="text-sm text-muted-foreground">
                        Recevez une alerte 30 jours avant l'expiration d'un document
                      </p>
                    </div>
                    <Switch
                      id="notif-document"
                      checked={notifications.email_document_expiring}
                      onCheckedChange={(checked) =>
                        setNotifications((prev) => ({ ...prev, email_document_expiring: checked }))
                      }
                    />
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="notif-weekly">Rapport hebdomadaire</Label>
                      <p className="text-sm text-muted-foreground">
                        Recevez un résumé de vos analyses chaque lundi matin
                      </p>
                    </div>
                    <Switch
                      id="notif-weekly"
                      checked={notifications.email_weekly_report}
                      onCheckedChange={(checked) =>
                        setNotifications((prev) => ({ ...prev, email_weekly_report: checked }))
                      }
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <Button onClick={handleSaveNotifications} disabled={saving}>
                    <Save className="w-4 h-4 mr-2" />
                    {saving ? 'Sauvegarde...' : 'Sauvegarder les préférences'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Onglet Sécurité */}
          <TabsContent value="security">
            <Card>
              <CardHeader>
                <CardTitle>Sécurité et confidentialité</CardTitle>
                <CardDescription>
                  Gérez les paramètres de sécurité de votre compte
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold mb-2">Mot de passe</h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      Vous pouvez modifier votre mot de passe depuis les paramètres de votre compte
                      Supabase.
                    </p>
                    <Button variant="outline">Modifier le mot de passe</Button>
                  </div>

                  <Separator />

                  <div>
                    <h3 className="text-sm font-semibold mb-2">Sessions actives</h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      Vous êtes actuellement connecté sur cet appareil.
                    </p>
                    <Button variant="outline" disabled>
                      Déconnecter les autres appareils
                    </Button>
                  </div>

                  <Separator />

                  <div>
                    <h3 className="text-sm font-semibold mb-2 text-red-600">Zone de danger</h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      Supprimer définitivement votre compte et toutes vos données.
                    </p>
                    <Button variant="destructive" disabled>
                      Supprimer mon compte
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Onglet Abonnement */}
          <TabsContent value="subscription">
            <Card>
              <CardHeader>
                <CardTitle>Abonnement</CardTitle>
                <CardDescription>Gérez votre abonnement TORP B2B</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="bg-gradient-to-br from-primary/10 to-primary/5 p-6 rounded-lg">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-bold mb-1">Plan Professionnel</h3>
                      <p className="text-sm text-muted-foreground">
                        Accès illimité aux analyses et fonctionnalités B2B
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold">49€</p>
                      <p className="text-sm text-muted-foreground">par mois</p>
                    </div>
                  </div>

                  <Separator className="my-4" />

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                      Analyses de devis illimitées
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                      Génération de tickets TORP
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                      Gestion des documents administratifs
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                      Support prioritaire
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" disabled>
                      Gérer l'abonnement
                    </Button>
                    <Button variant="outline" disabled>
                      Historique de facturation
                    </Button>
                  </div>
                </div>

                <div className="text-xs text-muted-foreground">
                  <p>
                    La gestion des abonnements sera disponible prochainement. Pour toute question,
                    contactez notre support.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
