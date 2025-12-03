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
  const { user } = useApp();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);

  // Préférences notifications
  const [emailAnalyse, setEmailAnalyse] = useState(true);
  const [emailDocuments, setEmailDocuments] = useState(true);

  useEffect(() => {
    if (user?.id) {
      loadSettings();
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
                        <Label>Email</Label>
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
            <Card>
              <CardHeader>
                <CardTitle>Compte utilisateur</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Email</Label>
                  <Input value={user?.email || ''} disabled />
                </div>
                <div>
                  <Label>Nom</Label>
                  <Input value={user?.name || ''} disabled />
                </div>
                <Button variant="outline" disabled>
                  <Lock className="h-4 w-4 mr-2" />
                  Changer le mot de passe
                </Button>
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
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </ProLayout>
  );
}
