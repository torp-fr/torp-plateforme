/**
 * ProSettings Page
 * Paramètres du compte professionnel B2B
 */

import { useState, useEffect } from 'react';
import { ProLayout } from '@/components/pro/ProLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useApp } from '@/context/AppContext';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import {
  Building2,
  User,
  Bell,
  Lock,
  Save,
  Loader2,
  Mail,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

interface CompanyInfo {
  raison_sociale: string;
  siret: string;
  telephone: string;
  email: string;
  site_web: string;
  adresse: string;
  code_postal: string;
  ville: string;
}

export default function ProSettings() {
  const { user, setUser } = useApp();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);

  // Préférences notifications
  const [emailAnalyse, setEmailAnalyse] = useState(true);
  const [emailDocuments, setEmailDocuments] = useState(true);
  const [savingNotifications, setSavingNotifications] = useState(false);

  // Changement mot de passe
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  // Changement email
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [changingEmail, setChangingEmail] = useState(false);

  // Modification nom
  const [userName, setUserName] = useState('');
  const [savingName, setSavingName] = useState(false);

  useEffect(() => {
    if (user?.id) {
      loadSettings();
      setUserName(user.name || '');
    }
  }, [user?.id]);

  async function loadSettings() {
    try {
      const { data: company } = await supabase
        .from('companies')
        .select('*')
        .eq('user_id', user!.id)
        .single();

      if (company) {
        setCompanyId(company.id);
        setCompanyInfo({
          raison_sociale: company.raison_sociale || '',
          siret: company.siret || '',
          telephone: company.telephone || '',
          email: company.email || '',
          site_web: company.site_web || '',
          adresse: company.adresse || '',
          code_postal: company.code_postal || '',
          ville: company.ville || '',
        });
      }
    } catch (error) {
      console.error('[ProSettings] Erreur:', error);
    } finally {
      setLoading(false);
    }
  }

  async function saveCompanyInfo() {
    if (!companyId || !companyInfo) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('companies')
        .update({
          telephone: companyInfo.telephone,
          email: companyInfo.email,
          site_web: companyInfo.site_web,
          adresse: companyInfo.adresse,
          code_postal: companyInfo.code_postal,
          ville: companyInfo.ville,
        })
        .eq('id', companyId);

      if (error) throw error;

      toast({
        title: 'Enregistré',
        description: 'Les informations ont été mises à jour.',
      });
    } catch (error) {
      console.error('[ProSettings] Erreur sauvegarde:', error);
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Impossible de sauvegarder.',
      });
    } finally {
      setSaving(false);
    }
  }

  async function handlePasswordChange() {
    if (newPassword !== confirmPassword) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Les mots de passe ne correspondent pas.',
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Le mot de passe doit contenir au moins 6 caractères.',
      });
      return;
    }

    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      toast({
        title: 'Mot de passe modifié',
        description: 'Votre mot de passe a été mis à jour avec succès.',
      });

      setPasswordDialogOpen(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      console.error('[ProSettings] Erreur changement mot de passe:', error);
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: error.message || 'Impossible de changer le mot de passe.',
      });
    } finally {
      setChangingPassword(false);
    }
  }

  async function handleEmailChange() {
    if (!newEmail || !newEmail.includes('@')) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Veuillez saisir une adresse email valide.',
      });
      return;
    }

    setChangingEmail(true);
    try {
      const { error } = await supabase.auth.updateUser({
        email: newEmail,
      });

      if (error) throw error;

      toast({
        title: 'Email de confirmation envoyé',
        description: `Un email de confirmation a été envoyé à ${newEmail}. Cliquez sur le lien pour confirmer le changement.`,
      });

      setEmailDialogOpen(false);
      setNewEmail('');
      setEmailPassword('');
    } catch (error: any) {
      console.error('[ProSettings] Erreur changement email:', error);
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: error.message || 'Impossible de changer l\'adresse email.',
      });
    } finally {
      setChangingEmail(false);
    }
  }

  async function handleNameChange() {
    if (!userName.trim()) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Le nom ne peut pas être vide.',
      });
      return;
    }

    setSavingName(true);
    try {
      // Mettre à jour dans la table users
      const { error } = await supabase
        .from('users')
        .update({ name: userName.trim() })
        .eq('id', user!.id);

      if (error) throw error;

      // Mettre à jour le contexte local
      if (user) {
        setUser({ ...user, name: userName.trim() });
      }

      toast({
        title: 'Nom mis à jour',
        description: 'Votre nom a été modifié avec succès.',
      });
    } catch (error: any) {
      console.error('[ProSettings] Erreur changement nom:', error);
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: error.message || 'Impossible de modifier le nom.',
      });
    } finally {
      setSavingName(false);
    }
  }

  async function saveNotificationPreferences() {
    setSavingNotifications(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({
          preferences: {
            notifications: {
              email_analyse: emailAnalyse,
              email_documents: emailDocuments,
            },
          },
        })
        .eq('id', user!.id);

      if (error) throw error;

      toast({
        title: 'Préférences enregistrées',
        description: 'Vos préférences de notifications ont été mises à jour.',
      });
    } catch (error) {
      console.error('[ProSettings] Erreur sauvegarde notifications:', error);
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Impossible de sauvegarder les préférences.',
      });
    } finally {
      setSavingNotifications(false);
    }
  }

  if (loading) {
    return (
      <ProLayout>
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </ProLayout>
    );
  }

  return (
    <ProLayout>
      <div className="space-y-6 max-w-3xl">
        <h1 className="text-2xl font-bold">Paramètres</h1>

        <Tabs defaultValue="entreprise">
          <TabsList>
            <TabsTrigger value="entreprise">
              <Building2 className="h-4 w-4 mr-2" />
              Entreprise
            </TabsTrigger>
            <TabsTrigger value="compte">
              <User className="h-4 w-4 mr-2" />
              Compte
            </TabsTrigger>
            <TabsTrigger value="notifications">
              <Bell className="h-4 w-4 mr-2" />
              Notifications
            </TabsTrigger>
          </TabsList>

          {/* Onglet Entreprise */}
          <TabsContent value="entreprise" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Informations entreprise</CardTitle>
                <CardDescription>
                  Ces informations apparaissent sur vos tickets TORP
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {companyInfo && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2">
                        <Label>Raison sociale</Label>
                        <Input value={companyInfo.raison_sociale} disabled />
                      </div>
                      <div>
                        <Label>SIRET</Label>
                        <Input value={companyInfo.siret} disabled />
                      </div>
                      <div>
                        <Label>Téléphone</Label>
                        <Input
                          value={companyInfo.telephone}
                          onChange={(e) =>
                            setCompanyInfo({ ...companyInfo, telephone: e.target.value })
                          }
                        />
                      </div>
                      <div>
                        <Label>Email entreprise</Label>
                        <Input
                          value={companyInfo.email}
                          onChange={(e) =>
                            setCompanyInfo({ ...companyInfo, email: e.target.value })
                          }
                        />
                      </div>
                      <div>
                        <Label>Site web</Label>
                        <Input
                          value={companyInfo.site_web}
                          onChange={(e) =>
                            setCompanyInfo({ ...companyInfo, site_web: e.target.value })
                          }
                          placeholder="https://..."
                        />
                      </div>
                      <div className="col-span-2">
                        <Label>Adresse</Label>
                        <Input
                          value={companyInfo.adresse}
                          onChange={(e) =>
                            setCompanyInfo({ ...companyInfo, adresse: e.target.value })
                          }
                        />
                      </div>
                      <div>
                        <Label>Code postal</Label>
                        <Input
                          value={companyInfo.code_postal}
                          onChange={(e) =>
                            setCompanyInfo({ ...companyInfo, code_postal: e.target.value })
                          }
                        />
                      </div>
                      <div>
                        <Label>Ville</Label>
                        <Input
                          value={companyInfo.ville}
                          onChange={(e) =>
                            setCompanyInfo({ ...companyInfo, ville: e.target.value })
                          }
                        />
                      </div>
                    </div>

                    <Button onClick={saveCompanyInfo} disabled={saving}>
                      {saving ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Save className="h-4 w-4 mr-2" />
                      )}
                      Enregistrer
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Onglet Compte */}
          <TabsContent value="compte" className="space-y-6 mt-6">
            {/* Informations personnelles */}
            <Card>
              <CardHeader>
                <CardTitle>Informations personnelles</CardTitle>
                <CardDescription>
                  Gérez vos informations de compte
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="userName">Nom complet</Label>
                  <div className="flex gap-2">
                    <Input
                      id="userName"
                      value={userName}
                      onChange={(e) => setUserName(e.target.value)}
                      placeholder="Votre nom"
                    />
                    <Button
                      onClick={handleNameChange}
                      disabled={savingName || userName === user?.name}
                    >
                      {savingName ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Adresse email */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Adresse email
                </CardTitle>
                <CardDescription>
                  Email utilisé pour la connexion et les notifications
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div>
                    <p className="font-medium">{user?.email}</p>
                    <p className="text-sm text-muted-foreground">Email actuel</p>
                  </div>
                  <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline">
                        <Mail className="h-4 w-4 mr-2" />
                        Modifier
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Changer l'adresse email</DialogTitle>
                        <DialogDescription>
                          Un email de confirmation sera envoyé à la nouvelle adresse.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="newEmail">Nouvelle adresse email</Label>
                          <Input
                            id="newEmail"
                            type="email"
                            placeholder="nouvelle@email.com"
                            value={newEmail}
                            onChange={(e) => setNewEmail(e.target.value)}
                          />
                        </div>
                        <div className="p-3 bg-blue-50 rounded-lg flex gap-2">
                          <AlertCircle className="h-5 w-5 text-blue-500 shrink-0" />
                          <p className="text-sm text-blue-700">
                            Vous devrez cliquer sur le lien de confirmation envoyé
                            à votre nouvelle adresse email pour finaliser le changement.
                          </p>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setEmailDialogOpen(false)}>
                          Annuler
                        </Button>
                        <Button onClick={handleEmailChange} disabled={changingEmail}>
                          {changingEmail ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : null}
                          Envoyer la confirmation
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardContent>
            </Card>

            {/* Mot de passe */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="h-5 w-5" />
                  Mot de passe
                </CardTitle>
                <CardDescription>
                  Modifiez votre mot de passe de connexion
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline">
                      <Lock className="h-4 w-4 mr-2" />
                      Changer le mot de passe
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Changer le mot de passe</DialogTitle>
                      <DialogDescription>
                        Choisissez un nouveau mot de passe sécurisé.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="newPassword">Nouveau mot de passe</Label>
                        <Input
                          id="newPassword"
                          type="password"
                          placeholder="••••••••"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
                        <Input
                          id="confirmPassword"
                          type="password"
                          placeholder="••••••••"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                        />
                      </div>
                      {newPassword && confirmPassword && newPassword !== confirmPassword && (
                        <p className="text-sm text-red-500 flex items-center gap-1">
                          <AlertCircle className="h-4 w-4" />
                          Les mots de passe ne correspondent pas
                        </p>
                      )}
                      {newPassword && newPassword === confirmPassword && newPassword.length >= 6 && (
                        <p className="text-sm text-green-500 flex items-center gap-1">
                          <CheckCircle2 className="h-4 w-4" />
                          Les mots de passe correspondent
                        </p>
                      )}
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setPasswordDialogOpen(false)}>
                        Annuler
                      </Button>
                      <Button
                        onClick={handlePasswordChange}
                        disabled={changingPassword || newPassword !== confirmPassword || newPassword.length < 6}
                      >
                        {changingPassword ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : null}
                        Modifier
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Onglet Notifications */}
          <TabsContent value="notifications" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Préférences de notifications</CardTitle>
                <CardDescription>
                  Gérez les emails que vous souhaitez recevoir
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Analyse terminée</p>
                    <p className="text-sm text-muted-foreground">
                      Recevoir un email quand une analyse est terminée
                    </p>
                  </div>
                  <Switch
                    checked={emailAnalyse}
                    onCheckedChange={setEmailAnalyse}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Documents expirant</p>
                    <p className="text-sm text-muted-foreground">
                      Recevoir un rappel avant expiration des documents
                    </p>
                  </div>
                  <Switch
                    checked={emailDocuments}
                    onCheckedChange={setEmailDocuments}
                  />
                </div>

                <Button onClick={saveNotificationPreferences} disabled={savingNotifications}>
                  {savingNotifications ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Enregistrer les préférences
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </ProLayout>
  );
}
