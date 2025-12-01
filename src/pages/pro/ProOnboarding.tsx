/**
 * TORP B2B - Page d'Onboarding Professionnel
 *
 * Permet aux nouveaux utilisateurs B2B de créer leur profil entreprise
 * en vérifiant leur SIRET et en complétant leurs informations.
 *
 * @route /pro/onboarding
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import { verifySiret, createCompanyProfile } from '@/services/api/pro/companyService';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Building2, CheckCircle2, Loader2, AlertTriangle, ArrowRight } from 'lucide-react';
import type { VerifySiretData } from '@/types/pro';

type OnboardingStep = 'siret' | 'form' | 'success';

export default function ProOnboarding() {
  const navigate = useNavigate();
  const { user } = useApp();

  const [step, setStep] = useState<OnboardingStep>('siret');
  const [siret, setSiret] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verifiedData, setVerifiedData] = useState<VerifySiretData | null>(null);

  // Données du formulaire
  const [formData, setFormData] = useState({
    adresse: '',
    code_postal: '',
    ville: '',
    telephone: '',
    email: '',
    site_web: '',
    description: '',
    nombre_employes: '',
    capital_social: '',
  });

  const handleVerifySiret = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setVerifying(true);

    try {
      const response = await verifySiret(siret);

      if (!response.valid) {
        setError(response.error || 'SIRET invalide');
        setVerifying(false);
        return;
      }

      if (response.data) {
        setVerifiedData(response.data);

        // Pré-remplir le formulaire avec les données vérifiées
        setFormData({
          adresse: response.data.adresse || '',
          code_postal: response.data.code_postal || '',
          ville: response.data.ville || '',
          telephone: '',
          email: '',
          site_web: '',
          description: '',
          nombre_employes: response.data.nombre_employes?.toString() || '',
          capital_social: response.data.capital_social?.toString() || '',
        });

        setStep('form');
      }
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la vérification du SIRET');
    } finally {
      setVerifying(false);
    }
  };

  const handleCreateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setCreating(true);

    if (!verifiedData) {
      setError('Données de vérification manquantes');
      setCreating(false);
      return;
    }

    try {
      await createCompanyProfile({
        siret: verifiedData.siret,
        siren: verifiedData.siren,
        raison_sociale: verifiedData.raison_sociale,
        forme_juridique: verifiedData.forme_juridique,
        adresse: formData.adresse,
        code_postal: formData.code_postal,
        ville: formData.ville,
        telephone: formData.telephone || undefined,
        email: formData.email || undefined,
        site_web: formData.site_web || undefined,
        description: formData.description || undefined,
        nombre_employes: formData.nombre_employes ? parseInt(formData.nombre_employes) : undefined,
        capital_social: formData.capital_social ? parseFloat(formData.capital_social) : undefined,
      });

      setStep('success');

      // Rediriger vers le dashboard après 2 secondes
      setTimeout(() => {
        navigate('/pro/dashboard');
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la création du profil');
    } finally {
      setCreating(false);
    }
  };

  // Étape 1 : Vérification SIRET
  if (step === 'siret') {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                <Building2 className="w-8 h-8 text-primary" />
              </div>
              <CardTitle className="text-2xl">Créer votre profil professionnel</CardTitle>
              <CardDescription className="text-base mt-2">
                Commencez par vérifier votre numéro SIRET
              </CardDescription>
            </CardHeader>

            <form onSubmit={handleVerifySiret}>
              <CardContent className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Erreur</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="siret">Numéro SIRET *</Label>
                  <Input
                    id="siret"
                    type="text"
                    placeholder="123 456 789 00012"
                    value={siret}
                    onChange={(e) => setSiret(e.target.value)}
                    disabled={verifying}
                    maxLength={17}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    14 chiffres (avec ou sans espaces)
                  </p>
                </div>

                <div className="bg-muted/50 rounded-lg p-4">
                  <h4 className="text-sm font-semibold mb-2">À quoi sert le SIRET ?</h4>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    <li>• Vérifier l'existence légale de votre entreprise</li>
                    <li>• Récupérer automatiquement vos informations officielles</li>
                    <li>• Garantir l'authenticité de votre profil TORP Pro</li>
                  </ul>
                </div>
              </CardContent>

              <CardFooter>
                <Button type="submit" className="w-full" disabled={verifying || siret.length < 14}>
                  {verifying ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Vérification en cours...
                    </>
                  ) : (
                    <>
                      Vérifier mon SIRET
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </div>
      </div>
    );
  }

  // Étape 2 : Formulaire de complétion
  if (step === 'form' && verifiedData) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="default" className="bg-green-600">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  SIRET vérifié
                </Badge>
              </div>
              <CardTitle className="text-2xl">Complétez votre profil</CardTitle>
              <CardDescription>
                Informations officielles récupérées pour <strong>{verifiedData.raison_sociale}</strong>
              </CardDescription>
            </CardHeader>

            <form onSubmit={handleCreateProfile}>
              <CardContent className="space-y-6">
                {error && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Erreur</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                {/* Informations vérifiées (lecture seule) */}
                <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                  <h3 className="font-semibold text-sm">Informations vérifiées</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">SIRET :</span>{' '}
                      <span className="font-medium">{verifiedData.siret}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">SIREN :</span>{' '}
                      <span className="font-medium">{verifiedData.siren}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Raison sociale :</span>{' '}
                      <span className="font-medium">{verifiedData.raison_sociale}</span>
                    </div>
                    {verifiedData.forme_juridique && (
                      <div className="col-span-2">
                        <span className="text-muted-foreground">Forme juridique :</span>{' '}
                        <span className="font-medium">{verifiedData.forme_juridique}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Adresse */}
                <div className="space-y-4">
                  <h3 className="font-semibold">Adresse</h3>

                  <div className="space-y-2">
                    <Label htmlFor="adresse">Adresse complète *</Label>
                    <Input
                      id="adresse"
                      value={formData.adresse}
                      onChange={(e) => setFormData({ ...formData, adresse: e.target.value })}
                      placeholder="12 rue de la Paix"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="code_postal">Code postal *</Label>
                      <Input
                        id="code_postal"
                        value={formData.code_postal}
                        onChange={(e) => setFormData({ ...formData, code_postal: e.target.value })}
                        placeholder="75001"
                        maxLength={5}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ville">Ville *</Label>
                      <Input
                        id="ville"
                        value={formData.ville}
                        onChange={(e) => setFormData({ ...formData, ville: e.target.value })}
                        placeholder="Paris"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Contact */}
                <div className="space-y-4">
                  <h3 className="font-semibold">Contact</h3>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="telephone">Téléphone</Label>
                      <Input
                        id="telephone"
                        type="tel"
                        value={formData.telephone}
                        onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
                        placeholder="01 23 45 67 89"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email professionnel</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="contact@entreprise.fr"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="site_web">Site web</Label>
                    <Input
                      id="site_web"
                      type="url"
                      value={formData.site_web}
                      onChange={(e) => setFormData({ ...formData, site_web: e.target.value })}
                      placeholder="https://www.entreprise.fr"
                    />
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <Label htmlFor="description">Description de l'entreprise</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Présentez votre activité, vos spécialités, votre expérience..."
                    rows={4}
                  />
                  <p className="text-xs text-muted-foreground">
                    Cette description sera visible sur vos tickets TORP
                  </p>
                </div>

                {/* Informations complémentaires */}
                <div className="space-y-4">
                  <h3 className="font-semibold">Informations complémentaires</h3>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="nombre_employes">Nombre d'employés</Label>
                      <Input
                        id="nombre_employes"
                        type="number"
                        value={formData.nombre_employes}
                        onChange={(e) => setFormData({ ...formData, nombre_employes: e.target.value })}
                        placeholder="10"
                        min="0"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="capital_social">Capital social (€)</Label>
                      <Input
                        id="capital_social"
                        type="number"
                        value={formData.capital_social}
                        onChange={(e) => setFormData({ ...formData, capital_social: e.target.value })}
                        placeholder="10000"
                        min="0"
                        step="0.01"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>

              <CardFooter className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep('siret')}
                  disabled={creating}
                >
                  Retour
                </Button>
                <Button type="submit" className="flex-1" disabled={creating}>
                  {creating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Création en cours...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Créer mon profil
                    </>
                  )}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </div>
      </div>
    );
  }

  // Étape 3 : Succès
  if (step === 'success') {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <Card className="text-center">
            <CardHeader>
              <div className="mx-auto w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <CheckCircle2 className="w-10 h-10 text-green-600" />
              </div>
              <CardTitle className="text-2xl">Profil créé avec succès !</CardTitle>
              <CardDescription className="text-base mt-2">
                Bienvenue sur TORP Pro. Redirection vers votre dashboard...
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return null;
}
