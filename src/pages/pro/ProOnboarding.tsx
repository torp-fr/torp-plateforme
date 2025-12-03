/**
 * ProOnboarding Page
 * Wizard de création du profil entreprise B2B
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useApp } from '@/context/AppContext';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import torpLogo from '@/assets/torp-logo-red.png';
import {
  Building2,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Search,
} from 'lucide-react';
import { pappersService } from '@/services/api/pappers.service';

interface CompanyData {
  siret: string;
  siren: string;
  raisonSociale: string;
  formeJuridique: string;
  codeNaf: string;
  libelleNaf: string;
  adresse: string;
  codePostal: string;
  ville: string;
  telephone: string;
  email: string;
  siteWeb: string;
  dateCreation: string;
  capitalSocial: number;
  dirigeantNom: string;
  dirigeantPrenom: string;
}

export default function ProOnboarding() {
  const { user } = useApp();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [siretInput, setSiretInput] = useState('');
  const [companyData, setCompanyData] = useState<CompanyData | null>(null);

  // Recherche SIRET via Pappers
  async function searchSiret() {
    const cleanSiret = siretInput.replace(/\s/g, '');
    if (cleanSiret.length !== 14) {
      toast({
        variant: 'destructive',
        title: 'SIRET invalide',
        description: 'Le SIRET doit contenir 14 chiffres.',
      });
      return;
    }

    setLoading(true);
    try {
      const data = await pappersService.getEntrepriseBySiret(cleanSiret);

      if (data) {
        setCompanyData({
          siret: data.siret,
          siren: data.siren,
          raisonSociale: data.nom,
          formeJuridique: data.formeJuridique,
          codeNaf: data.codeNAF,
          libelleNaf: data.libelleNAF,
          adresse: data.adresse.ligne1,
          codePostal: data.adresse.codePostal,
          ville: data.adresse.ville,
          telephone: '',
          email: user?.email || '',
          siteWeb: '',
          dateCreation: data.dateCreation,
          capitalSocial: data.capital,
          dirigeantNom: data.dirigeants[0]?.nom || '',
          dirigeantPrenom: data.dirigeants[0]?.prenom || '',
        });
        setStep(2);
      } else {
        // Entreprise non trouvée, permettre saisie manuelle
        setCompanyData({
          siret: cleanSiret,
          siren: cleanSiret.substring(0, 9),
          raisonSociale: '',
          formeJuridique: '',
          codeNaf: '',
          libelleNaf: '',
          adresse: '',
          codePostal: '',
          ville: '',
          telephone: '',
          email: user?.email || '',
          siteWeb: '',
          dateCreation: '',
          capitalSocial: 0,
          dirigeantNom: '',
          dirigeantPrenom: '',
        });
        setStep(2);
        toast({
          title: 'Entreprise non trouvée',
          description: 'Vous pouvez compléter les informations manuellement.',
        });
      }
    } catch (error) {
      console.error('[ProOnboarding] Erreur recherche:', error);
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Impossible de rechercher le SIRET.',
      });
    } finally {
      setLoading(false);
    }
  }

  // Créer l'entreprise
  async function createCompany() {
    if (!companyData || !user?.id) return;

    if (!companyData.raisonSociale) {
      toast({
        variant: 'destructive',
        title: 'Champ requis',
        description: 'La raison sociale est obligatoire.',
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('companies')
        .insert({
          user_id: user.id,
          siret: companyData.siret,
          siren: companyData.siren,
          raison_sociale: companyData.raisonSociale,
          forme_juridique: companyData.formeJuridique || null,
          code_naf: companyData.codeNaf || null,
          libelle_naf: companyData.libelleNaf || null,
          adresse: companyData.adresse || null,
          code_postal: companyData.codePostal || null,
          ville: companyData.ville || null,
          telephone: companyData.telephone || null,
          email: companyData.email || null,
          site_web: companyData.siteWeb || null,
          date_creation: companyData.dateCreation || null,
          capital_social: companyData.capitalSocial || null,
          dirigeant_nom: companyData.dirigeantNom || null,
          dirigeant_prenom: companyData.dirigeantPrenom || null,
          siret_verifie: !!pappersService.isConfigured(),
          siret_verifie_le: pappersService.isConfigured() ? new Date().toISOString() : null,
        })
        .select()
        .single();

      if (error) throw error;

      // Mettre à jour le user avec company_id
      await supabase
        .from('users')
        .update({ company_id: data.id })
        .eq('id', user.id);

      toast({
        title: 'Profil créé !',
        description: 'Votre entreprise est maintenant enregistrée.',
      });

      setStep(3);
    } catch (error) {
      console.error('[ProOnboarding] Erreur création:', error);
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Impossible de créer le profil entreprise.',
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <img src={torpLogo} alt="TORP" className="h-12 w-auto" />
          </div>
          <CardTitle>Créer mon profil entreprise</CardTitle>
          <CardDescription>
            Étape {step} sur 3
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Step 1: SIRET */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="text-center">
                <Building2 className="h-12 w-12 text-primary mx-auto mb-4" />
                <p className="text-muted-foreground">
                  Entrez votre numéro SIRET pour pré-remplir automatiquement
                  les informations de votre entreprise.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="siret">Numéro SIRET</Label>
                <div className="flex gap-2">
                  <Input
                    id="siret"
                    placeholder="123 456 789 00012"
                    value={siretInput}
                    onChange={(e) => setSiretInput(e.target.value)}
                    maxLength={17}
                  />
                  <Button onClick={searchSiret} disabled={loading}>
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  14 chiffres, espaces ignorés
                </p>
              </div>
            </div>
          )}

          {/* Step 2: Vérification/Complétion */}
          {step === 2 && companyData && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="raisonSociale">Raison sociale *</Label>
                  <Input
                    id="raisonSociale"
                    value={companyData.raisonSociale}
                    onChange={(e) =>
                      setCompanyData({ ...companyData, raisonSociale: e.target.value })
                    }
                  />
                </div>

                <div>
                  <Label>SIRET</Label>
                  <Input value={companyData.siret} disabled />
                </div>

                <div>
                  <Label>Forme juridique</Label>
                  <Input
                    value={companyData.formeJuridique}
                    onChange={(e) =>
                      setCompanyData({ ...companyData, formeJuridique: e.target.value })
                    }
                  />
                </div>

                <div className="col-span-2">
                  <Label>Adresse</Label>
                  <Input
                    value={companyData.adresse}
                    onChange={(e) =>
                      setCompanyData({ ...companyData, adresse: e.target.value })
                    }
                  />
                </div>

                <div>
                  <Label>Code postal</Label>
                  <Input
                    value={companyData.codePostal}
                    onChange={(e) =>
                      setCompanyData({ ...companyData, codePostal: e.target.value })
                    }
                  />
                </div>

                <div>
                  <Label>Ville</Label>
                  <Input
                    value={companyData.ville}
                    onChange={(e) =>
                      setCompanyData({ ...companyData, ville: e.target.value })
                    }
                  />
                </div>

                <div>
                  <Label>Téléphone</Label>
                  <Input
                    value={companyData.telephone}
                    onChange={(e) =>
                      setCompanyData({ ...companyData, telephone: e.target.value })
                    }
                  />
                </div>

                <div>
                  <Label>Email</Label>
                  <Input
                    value={companyData.email}
                    onChange={(e) =>
                      setCompanyData({ ...companyData, email: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button variant="outline" onClick={() => setStep(1)}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Retour
                </Button>
                <Button className="flex-1" onClick={createCompany} disabled={loading}>
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  Créer mon profil
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Succès */}
          {step === 3 && (
            <div className="text-center space-y-6">
              <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
              <div>
                <h3 className="text-lg font-semibold">Profil créé avec succès !</h3>
                <p className="text-muted-foreground mt-2">
                  Vous pouvez maintenant analyser vos devis et générer des
                  tickets TORP pour vos clients.
                </p>
              </div>

              <div className="space-y-3">
                <Button className="w-full" onClick={() => navigate('/pro/analyses/new')}>
                  Analyser un devis
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
                <Button variant="outline" className="w-full" onClick={() => navigate('/pro')}>
                  Aller au dashboard
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
