import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useApp, UserType } from '@/context/AppContext';
import { useToast } from '@/hooks/use-toast';
import { Building, Users, ArrowLeft, Landmark, Info } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import torpLogo from '@/assets/torp-logo-red.png';
import { authService } from '@/services/api';

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [phone, setPhone] = useState('');
  // B2G specific fields
  const [entityName, setEntityName] = useState('');
  const [siret, setSiret] = useState('');
  const [entityType, setEntityType] = useState<'commune' | 'departement' | 'region' | 'epci' | 'other'>('commune');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { setUser, userType, setUserType } = useApp();
  const { toast } = useToast();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (password !== confirmPassword) {
      toast({
        title: 'Erreur',
        description: 'Les mots de passe ne correspondent pas',
        variant: 'destructive',
      });
      return;
    }

    if (password.length < 8) {
      toast({
        title: 'Erreur',
        description: 'Le mot de passe doit contenir au moins 8 caractères',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      // Register using real Supabase auth service
      const response = await authService.register({
        email,
        password,
        name,
        type: userType,
        company: (userType === 'B2B') ? company : (userType === 'B2G') ? entityName : undefined,
        phone: phone || undefined,
        // B2G specific fields stored in metadata
        entityName: (userType === 'B2G') ? entityName : undefined,
        siret: (userType === 'B2G') ? siret : undefined,
        entityType: (userType === 'B2G') ? entityType : undefined,
      });

      setUser(response.user);

      toast({
        title: 'Compte créé avec succès!',
        description: `Bienvenue ${response.user.name}! Vérifiez votre email pour confirmer votre compte.`,
      });

      // Redirect to dashboard
      navigate('/dashboard');
    } catch (error) {
      console.error('Registration error:', error);
      toast({
        title: 'Erreur lors de l\'inscription',
        description: error instanceof Error ? error.message : 'Une erreur est survenue',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/20"></div>

      <div className="w-full max-w-md relative z-10">
        <Link to="/" className="inline-flex items-center text-white hover:text-white/80 mb-8">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour à l'accueil
        </Link>

        <Card className="backdrop-blur-sm bg-white/95 shadow-strong">
          <CardHeader className="text-center">
            <div className="flex items-center justify-center gap-3 mb-4">
              <img src={torpLogo} alt="TORP" className="h-12 w-auto" />
              <div>
                <CardTitle className="text-2xl font-bold text-primary">TORP</CardTitle>
                <p className="text-xs text-muted-foreground">Créer votre compte</p>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <Tabs defaultValue={userType} onValueChange={(value) => setUserType(value as UserType)}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="B2C" className="flex items-center gap-1 text-xs sm:text-sm">
                  <Users className="w-4 h-4" />
                  <span className="hidden sm:inline">Particulier</span>
                  <span className="sm:hidden">Partic.</span>
                </TabsTrigger>
                <TabsTrigger value="B2B" className="flex items-center gap-1 text-xs sm:text-sm">
                  <Building className="w-4 h-4" />
                  <span className="hidden sm:inline">Professionnel</span>
                  <span className="sm:hidden">Pro</span>
                </TabsTrigger>
                <TabsTrigger value="B2G" className="flex items-center gap-1 text-xs sm:text-sm">
                  <Landmark className="w-4 h-4" />
                  <span className="hidden sm:inline">Collectivité</span>
                  <span className="sm:hidden">Public</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="B2C" className="space-y-4 mt-6">
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nom complet</Label>
                    <Input
                      id="name"
                      type="text"
                      placeholder="Jean Dupont"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="votre@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Téléphone (optionnel)</Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="06 12 34 56 78"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Mot de passe</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                    />
                    <p className="text-xs text-muted-foreground">Minimum 8 caractères</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirmer le mot de passe</Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isLoading}
                  >
                    {isLoading ? 'Création du compte...' : 'Créer mon compte'}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="B2B" className="space-y-4 mt-6">
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name-pro">Nom complet</Label>
                    <Input
                      id="name-pro"
                      type="text"
                      placeholder="Marie Martin"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="company-pro">Entreprise</Label>
                    <Input
                      id="company-pro"
                      type="text"
                      placeholder="BTP Excellence SARL"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email-pro">Email professionnel</Label>
                    <Input
                      id="email-pro"
                      type="email"
                      placeholder="contact@entreprise.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone-pro">Téléphone (optionnel)</Label>
                    <Input
                      id="phone-pro"
                      type="tel"
                      placeholder="06 12 34 56 78"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password-pro">Mot de passe</Label>
                    <Input
                      id="password-pro"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                    />
                    <p className="text-xs text-muted-foreground">Minimum 8 caractères</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password-pro">Confirmer le mot de passe</Label>
                    <Input
                      id="confirm-password-pro"
                      type="password"
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isLoading}
                  >
                    {isLoading ? 'Création du compte...' : 'Créer mon compte professionnel'}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="B2G" className="space-y-4 mt-6">
                <Alert className="bg-purple-50 border-purple-200">
                  <Landmark className="h-4 w-4 text-purple-600" />
                  <AlertDescription className="text-purple-800">
                    <strong>Espace Collectivités</strong> : Structurez vos consultations
                    et recevez des offres conformes au Code de la commande publique.
                  </AlertDescription>
                </Alert>
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="entity-name">Nom de la collectivité *</Label>
                    <Input
                      id="entity-name"
                      type="text"
                      placeholder="Mairie de Lyon, Conseil Départemental 69..."
                      value={entityName}
                      onChange={(e) => setEntityName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="entity-type">Type d'entité *</Label>
                      <Select
                        value={entityType}
                        onValueChange={(value) => setEntityType(value as typeof entityType)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionnez..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="commune">Commune</SelectItem>
                          <SelectItem value="epci">EPCI / Interco</SelectItem>
                          <SelectItem value="departement">Département</SelectItem>
                          <SelectItem value="region">Région</SelectItem>
                          <SelectItem value="other">Autre établissement public</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="siret">SIRET *</Label>
                      <Input
                        id="siret"
                        type="text"
                        placeholder="123 456 789 00012"
                        value={siret}
                        onChange={(e) => setSiret(e.target.value)}
                        required
                        maxLength={17}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="name-b2g">Nom du contact *</Label>
                    <Input
                      id="name-b2g"
                      type="text"
                      placeholder="Jean Dupont"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email-b2g">Email professionnel *</Label>
                    <Input
                      id="email-b2g"
                      type="email"
                      placeholder="contact@mairie.fr"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone-b2g">Téléphone (optionnel)</Label>
                    <Input
                      id="phone-b2g"
                      type="tel"
                      placeholder="04 72 00 00 00"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password-b2g">Mot de passe *</Label>
                    <Input
                      id="password-b2g"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                    />
                    <p className="text-xs text-muted-foreground">Minimum 8 caractères</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password-b2g">Confirmer le mot de passe *</Label>
                    <Input
                      id="confirm-password-b2g"
                      type="password"
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full bg-purple-600 hover:bg-purple-700"
                    disabled={isLoading}
                  >
                    {isLoading ? 'Création du compte...' : 'Créer mon espace collectivité'}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>

            <div className="mt-6 pt-4 border-t text-center">
              <p className="text-sm text-muted-foreground">
                Vous avez déjà un compte ?{' '}
                <Link to="/login">
                  <Button variant="link" className="p-0 h-auto">
                    Se connecter
                  </Button>
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
