/**
 * ProOnboarding Page
 * Wizard de création du profil entreprise B2B
 * Utilise l'API Sirene INSEE pour la vérification SIRET
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  FileCheck,
  Check,
} from 'lucide-react';
import { SiretVerification } from '@/components/pro/onboarding/SiretVerification';
import { SireneEntreprise } from '@/services/api/sirene.service';

type Step = 'siret' | 'details' | 'success';

export default function ProOnboarding() {
  const { user } = useApp();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>('siret');
  const [loading, setLoading] = useState(false);

  // Données entreprise depuis Sirene
  const [entrepriseData, setEntrepriseData] = useState<SireneEntreprise | null>(null);

  // Données complémentaires
  const [formData, setFormData] = useState({
    telephone: '',
    emailPro: '',
    siteWeb: '',
    description: '',
    dirigeantNom: '',
  });

  function handleSiretVerified(data: SireneEntreprise) {
    setEntrepriseData(data);
  }

  function handleSiretError(error: string) {
    toast({
      variant: 'destructive',
      title: 'Erreur de vérification',
      description: error,
    });
  }

  async function handleSubmit() {
    if (!entrepriseData || !user?.id) return;

    if (!entrepriseData.raisonSociale) {
      toast({
        variant: 'destructive',
        title: 'Champ requis',
        description: 'La raison sociale est obligatoire.',
      });
      return;
    }

    setLoading(true);

    try {
      // 1. Créer l'entreprise
      const { data: company, error: companyError } = await supabase
        .from('companies')
        .insert({
          user_id: user.id,
          siret: entrepriseData.siret,
          siren: entrepriseData.siren,
          raison_sociale: entrepriseData.raisonSociale || 'Non renseigné',
          forme_juridique: entrepriseData.categorieJuridiqueLibelle || null,
          code_naf: entrepriseData.codeNAF || null,
          libelle_naf: entrepriseData.libelleNAF || null,
          adresse: entrepriseData.adresseComplete || null,
          code_postal: entrepriseData.adresse.codePostal || null,
          ville: entrepriseData.adresse.commune || null,
          telephone: formData.telephone || null,
          email: formData.emailPro || user.email || null,
          site_web: formData.siteWeb || null,
          date_creation: entrepriseData.dateCreation || null,
          effectif: entrepriseData.trancheEffectifLibelle || null,
          dirigeant_nom: formData.dirigeantNom || null,
          siret_verifie: true,
          siret_verifie_le: new Date().toISOString(),
        })
        .select()
        .single();

      if (companyError) throw companyError;

      // 2. Mettre à jour l'utilisateur avec le company_id
      const { error: userError } = await supabase
        .from('users')
        .update({ company_id: company.id })
        .eq('id', user.id);

      if (userError) throw userError;

      toast({
        title: 'Profil créé !',
        description: 'Votre entreprise est maintenant enregistrée.',
      });

      setStep('success');

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

  const stepNumber = step === 'siret' ? 1 : step === 'details' ? 2 : 3;

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <img src={torpLogo} alt="TORP" className="h-12 w-auto" />
          </div>
          <CardTitle>Créer mon profil entreprise</CardTitle>
          <CardDescription>
            Étape {stepNumber} sur 3
          </CardDescription>

          {/* Stepper */}
          <div className="flex items-center justify-center mt-4">
            {(['siret', 'details', 'success'] as Step[]).map((s, i) => (
              <div key={s} className="flex items-center">
                <div className={`
                  w-10 h-10 rounded-full flex items-center justify-center font-medium text-sm
                  ${step === s ? 'bg-primary text-white' :
                    (i < ['siret', 'details', 'success'].indexOf(step)
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-200 text-gray-500')}
                `}>
                  {i < ['siret', 'details', 'success'].indexOf(step) ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    i + 1
                  )}
                </div>
                {i < 2 && (
                  <div className={`w-12 sm:w-16 h-1 mx-1 sm:mx-2 ${
                    i < ['siret', 'details', 'success'].indexOf(step)
                      ? 'bg-green-500'
                      : 'bg-gray-200'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </CardHeader>

        <CardContent>
          {/* Étape 1 : Vérification SIRET */}
          {step === 'siret' && (
            <div className="space-y-6">
              <div className="flex items-center gap-2 mb-4">
                <Building2 className="h-5 w-5 text-primary" />
                <h2 className="font-semibold">Vérification SIRET</h2>
              </div>

              <div className="text-center mb-6">
                <p className="text-muted-foreground">
                  Entrez votre numéro SIRET pour pré-remplir automatiquement
                  les informations de votre entreprise via l'API Sirene INSEE.
                </p>
              </div>

              <SiretVerification
                onVerified={handleSiretVerified}
                onError={handleSiretError}
              />

              <div className="flex justify-end mt-6">
                <Button
                  onClick={() => setStep('details')}
                  disabled={!entrepriseData}
                >
                  Continuer <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Étape 2 : Informations complémentaires */}
          {step === 'details' && entrepriseData && (
            <div className="space-y-6">
              <div className="flex items-center gap-2 mb-4">
                <FileCheck className="h-5 w-5 text-primary" />
                <h2 className="font-semibold">Informations complémentaires</h2>
              </div>

              {/* Récap entreprise */}
              <div className="bg-muted p-4 rounded-lg">
                <p className="font-medium">{entrepriseData.raisonSociale}</p>
                <p className="text-sm text-muted-foreground font-mono">{entrepriseData.siret}</p>
                {entrepriseData.adresseComplete && entrepriseData.adresseComplete !== 'Non renseignée' && (
                  <p className="text-sm text-muted-foreground">{entrepriseData.adresseComplete}</p>
                )}
                {entrepriseData.categorieJuridiqueLibelle && (
                  <p className="text-sm text-muted-foreground">{entrepriseData.categorieJuridiqueLibelle}</p>
                )}
              </div>

              <div className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="telephone">Téléphone professionnel</Label>
                    <Input
                      id="telephone"
                      type="tel"
                      placeholder="01 23 45 67 89"
                      value={formData.telephone}
                      onChange={e => setFormData(prev => ({ ...prev, telephone: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="emailPro">Email professionnel</Label>
                    <Input
                      id="emailPro"
                      type="email"
                      placeholder="contact@entreprise.fr"
                      value={formData.emailPro}
                      onChange={e => setFormData(prev => ({ ...prev, emailPro: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="siteWeb">Site web</Label>
                  <Input
                    id="siteWeb"
                    type="url"
                    placeholder="https://www.entreprise.fr"
                    value={formData.siteWeb}
                    onChange={e => setFormData(prev => ({ ...prev, siteWeb: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dirigeant">Nom du dirigeant</Label>
                  <Input
                    id="dirigeant"
                    placeholder="Jean Dupont"
                    value={formData.dirigeantNom}
                    onChange={e => setFormData(prev => ({ ...prev, dirigeantNom: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description de l'activité</Label>
                  <Textarea
                    id="description"
                    placeholder="Décrivez brièvement votre activité..."
                    rows={3}
                    value={formData.description}
                    onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  />
                </div>
              </div>

              <div className="flex justify-between mt-6">
                <Button variant="outline" onClick={() => setStep('siret')}>
                  <ArrowLeft className="mr-2 h-4 w-4" /> Retour
                </Button>
                <Button onClick={handleSubmit} disabled={loading}>
                  {loading ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Création...</>
                  ) : (
                    <>Créer mon profil <ArrowRight className="ml-2 h-4 w-4" /></>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Étape 3 : Succès */}
          {step === 'success' && (
            <div className="text-center space-y-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-10 w-10 text-green-500" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Profil créé avec succès !</h3>
                <p className="text-muted-foreground mt-2">
                  Vous pouvez maintenant analyser vos devis et générer des
                  tickets TORP pour vos clients.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button variant="outline" onClick={() => navigate('/pro/documents')}>
                  Ajouter mes documents
                </Button>
                <Button onClick={() => navigate('/pro')}>
                  Accéder au dashboard
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
