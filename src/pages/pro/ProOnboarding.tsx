/**
 * ProOnboarding Page
 * Wizard de création du profil entreprise B2B
 * Utilise l'API Sirene INSEE pour la vérification SIRET
 * Permet la saisie manuelle si entreprise non trouvée
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
  Edit3,
} from 'lucide-react';
import { SiretVerification } from '@/components/pro/onboarding/SiretVerification';
import { SireneEntreprise } from '@/services/api/sirene.service';

type Step = 'siret' | 'manual' | 'details' | 'success';

interface ManualCompanyData {
  siret: string;
  siren: string;
  raisonSociale: string;
  formeJuridique: string;
  codeNaf: string;
  adresse: string;
  codePostal: string;
  ville: string;
}

export default function ProOnboarding() {
  const { user } = useApp();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>('siret');
  const [loading, setLoading] = useState(false);

  // Données entreprise depuis Sirene (auto)
  const [entrepriseData, setEntrepriseData] = useState<SireneEntreprise | null>(null);

  // Données entreprise saisie manuelle
  const [manualData, setManualData] = useState<ManualCompanyData>({
    siret: '',
    siren: '',
    raisonSociale: '',
    formeJuridique: '',
    codeNaf: '',
    adresse: '',
    codePostal: '',
    ville: '',
  });

  // Données complémentaires
  const [formData, setFormData] = useState({
    telephone: '',
    emailPro: '',
    siteWeb: '',
    description: '',
    dirigeantNom: '',
  });

  // Mode: 'auto' (données Sirene) ou 'manual' (saisie manuelle)
  const isManualMode = step === 'manual' || (step === 'details' && !entrepriseData);

  function handleSiretVerified(data: SireneEntreprise) {
    setEntrepriseData(data);
    setStep('details');
  }

  function handleSiretNotFound(siret: string) {
    setManualData({
      siret,
      siren: siret.substring(0, 9),
      raisonSociale: '',
      formeJuridique: '',
      codeNaf: '',
      adresse: '',
      codePostal: '',
      ville: '',
    });
    setStep('manual');
  }

  function handleSiretError(error: string) {
    toast({
      variant: 'destructive',
      title: 'Erreur de vérification',
      description: error,
    });
  }

  function handleManualContinue() {
    if (!manualData.raisonSociale.trim()) {
      toast({
        variant: 'destructive',
        title: 'Champ requis',
        description: 'La raison sociale est obligatoire.',
      });
      return;
    }
    setStep('details');
  }

  async function handleSubmit() {
    if (!user?.id) return;

    // Vérifier les données requises
    const raisonSociale = entrepriseData?.raisonSociale || manualData.raisonSociale;
    if (!raisonSociale) {
      toast({
        variant: 'destructive',
        title: 'Champ requis',
        description: 'La raison sociale est obligatoire.',
      });
      return;
    }

    setLoading(true);

    try {
      // Construire les données à insérer
      const companyInsert = entrepriseData ? {
        // Mode auto - données Sirene
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
      } : {
        // Mode manuel - saisie utilisateur
        user_id: user.id,
        siret: manualData.siret,
        siren: manualData.siren,
        raison_sociale: manualData.raisonSociale,
        forme_juridique: manualData.formeJuridique || null,
        code_naf: manualData.codeNaf || null,
        adresse: manualData.adresse || null,
        code_postal: manualData.codePostal || null,
        ville: manualData.ville || null,
        telephone: formData.telephone || null,
        email: formData.emailPro || user.email || null,
        site_web: formData.siteWeb || null,
        dirigeant_nom: formData.dirigeantNom || null,
        siret_verifie: false, // Non vérifié car saisie manuelle
        siret_verifie_le: null,
      };

      // 1. Créer l'entreprise
      const { data: company, error: companyError } = await supabase
        .from('companies')
        .insert(companyInsert)
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

  const stepNumber = step === 'siret' ? 1 : step === 'manual' ? 2 : step === 'details' ? (isManualMode ? 3 : 2) : 3;
  const totalSteps = isManualMode ? 4 : 3;

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <img src={torpLogo} alt="TORP" className="h-12 w-auto" />
          </div>
          <CardTitle>Créer mon profil entreprise</CardTitle>
          <CardDescription>
            Étape {stepNumber} sur {totalSteps}
          </CardDescription>

          {/* Stepper */}
          <div className="flex items-center justify-center mt-4">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div key={i} className="flex items-center">
                <div className={`
                  w-10 h-10 rounded-full flex items-center justify-center font-medium text-sm
                  ${stepNumber === i + 1 ? 'bg-primary text-white' :
                    (i + 1 < stepNumber
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-200 text-gray-500')}
                `}>
                  {i + 1 < stepNumber ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    i + 1
                  )}
                </div>
                {i < totalSteps - 1 && (
                  <div className={`w-12 sm:w-16 h-1 mx-1 sm:mx-2 ${
                    i + 1 < stepNumber
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
                onNotFound={handleSiretNotFound}
                onError={handleSiretError}
              />
            </div>
          )}

          {/* Étape 2 (manuel) : Saisie manuelle des infos entreprise */}
          {step === 'manual' && (
            <div className="space-y-6">
              <div className="flex items-center gap-2 mb-4">
                <Edit3 className="h-5 w-5 text-primary" />
                <h2 className="font-semibold">Informations entreprise</h2>
              </div>

              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm text-orange-700 mb-4">
                Votre entreprise n'a pas été trouvée dans les bases publiques.
                Veuillez compléter les informations manuellement.
              </div>

              <div className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="siret">SIRET</Label>
                    <Input
                      id="siret"
                      value={manualData.siret}
                      disabled
                      className="font-mono bg-gray-50"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="siren">SIREN</Label>
                    <Input
                      id="siren"
                      value={manualData.siren}
                      disabled
                      className="font-mono bg-gray-50"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="raisonSociale">
                    Raison sociale <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="raisonSociale"
                    placeholder="Nom de votre entreprise"
                    value={manualData.raisonSociale}
                    onChange={e => setManualData(prev => ({ ...prev, raisonSociale: e.target.value }))}
                  />
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="formeJuridique">Forme juridique</Label>
                    <Input
                      id="formeJuridique"
                      placeholder="SAS, SARL, etc."
                      value={manualData.formeJuridique}
                      onChange={e => setManualData(prev => ({ ...prev, formeJuridique: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="codeNaf">Code NAF</Label>
                    <Input
                      id="codeNaf"
                      placeholder="6201Z"
                      value={manualData.codeNaf}
                      onChange={e => setManualData(prev => ({ ...prev, codeNaf: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="adresse">Adresse</Label>
                  <Input
                    id="adresse"
                    placeholder="Numéro et rue"
                    value={manualData.adresse}
                    onChange={e => setManualData(prev => ({ ...prev, adresse: e.target.value }))}
                  />
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="codePostal">Code postal</Label>
                    <Input
                      id="codePostal"
                      placeholder="75001"
                      value={manualData.codePostal}
                      onChange={e => setManualData(prev => ({ ...prev, codePostal: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="ville">Ville</Label>
                    <Input
                      id="ville"
                      placeholder="Paris"
                      value={manualData.ville}
                      onChange={e => setManualData(prev => ({ ...prev, ville: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-between mt-6">
                <Button variant="outline" onClick={() => setStep('siret')}>
                  <ArrowLeft className="mr-2 h-4 w-4" /> Retour
                </Button>
                <Button onClick={handleManualContinue}>
                  Continuer <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Étape 2/3 : Informations complémentaires */}
          {step === 'details' && (
            <div className="space-y-6">
              <div className="flex items-center gap-2 mb-4">
                <FileCheck className="h-5 w-5 text-primary" />
                <h2 className="font-semibold">Informations complémentaires</h2>
              </div>

              {/* Récap entreprise */}
              <div className="bg-muted p-4 rounded-lg">
                <p className="font-medium">
                  {entrepriseData?.raisonSociale || manualData.raisonSociale}
                </p>
                <p className="text-sm text-muted-foreground font-mono">
                  {entrepriseData?.siret || manualData.siret}
                </p>
                {(entrepriseData?.adresseComplete || manualData.adresse) && (
                  <p className="text-sm text-muted-foreground">
                    {entrepriseData?.adresseComplete ||
                      [manualData.adresse, manualData.codePostal, manualData.ville].filter(Boolean).join(' ')}
                  </p>
                )}
                {(entrepriseData?.categorieJuridiqueLibelle || manualData.formeJuridique) && (
                  <p className="text-sm text-muted-foreground">
                    {entrepriseData?.categorieJuridiqueLibelle || manualData.formeJuridique}
                  </p>
                )}
                {!entrepriseData && (
                  <p className="text-xs text-orange-600 mt-2">
                    Saisie manuelle - SIRET non vérifié automatiquement
                  </p>
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
                <Button variant="outline" onClick={() => setStep(isManualMode ? 'manual' : 'siret')}>
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

          {/* Étape finale : Succès */}
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
