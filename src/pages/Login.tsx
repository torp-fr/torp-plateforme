import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useApp, UserType } from '@/context/AppContext';
import { useToast } from '@/hooks/use-toast';
import { Building, Users, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import torpLogo from '@/assets/torp-logo-red.png';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { setUser, userType, setUserType } = useApp();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // Simulation de connexion
    setTimeout(() => {
      const mockUser = {
        id: '1',
        email,
        name: userType === 'B2C' ? 'Jean Dupont' : 'Marie Martin',
        type: userType,
        company: (userType === 'B2B' || userType === 'B2B2C') ? 'BTP Excellence SARL' : undefined
      };

      setUser(mockUser);
      toast({
        title: 'Connexion réussie',
        description: `Bienvenue ${mockUser.name}!`,
      });
      
      setIsLoading(false);
      navigate('/dashboard');
    }, 1500);
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
                <p className="text-xs text-muted-foreground">Connexion à votre espace</p>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <Tabs defaultValue={userType} onValueChange={(value) => setUserType(value as UserType)}>
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="B2C" className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  B2C
                </TabsTrigger>
                <TabsTrigger value="B2B" className="flex items-center gap-2">
                  <Building className="w-4 h-4" />
                  B2B
                </TabsTrigger>
                <TabsTrigger value="B2G" className="flex items-center gap-2">
                  <Building className="w-4 h-4" />
                  B2G
                </TabsTrigger>
                <TabsTrigger value="B2B2C" className="flex items-center gap-2">
                  <Building className="w-4 h-4" />
                  B2B2C
                </TabsTrigger>
              </TabsList>

              <TabsContent value="B2C" className="space-y-4 mt-6">
                <form onSubmit={handleLogin} className="space-y-4">
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
                    <Label htmlFor="password">Mot de passe</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={isLoading}
                  >
                    {isLoading ? 'Connexion...' : 'Se connecter'}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="B2B" className="space-y-4 mt-6">
                <form onSubmit={handleLogin} className="space-y-4">
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
                    <Label htmlFor="password-pro">Mot de passe</Label>
                    <Input
                      id="password-pro"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={isLoading}
                  >
                    {isLoading ? 'Connexion...' : 'Accéder à mon espace pro'}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="B2G" className="space-y-4 mt-6">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email-b2g">Email collectivité</Label>
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
                    <Label htmlFor="password-b2g">Mot de passe</Label>
                    <Input
                      id="password-b2g"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={isLoading}
                  >
                    {isLoading ? 'Connexion...' : 'Accéder à l\'observatoire'}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="B2B2C" className="space-y-4 mt-6">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email-b2b2c">Email prescripteur</Label>
                    <Input
                      id="email-b2b2c"
                      type="email"
                      placeholder="contact@cabinet-archi.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password-b2b2c">Mot de passe</Label>
                    <Input
                      id="password-b2b2c"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={isLoading}
                  >
                    {isLoading ? 'Connexion...' : 'Dashboard Prescripteur'}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>

            <div className="mt-6 pt-4 border-t text-center">
              <p className="text-sm text-muted-foreground">
                Pas encore de compte ?{' '}
                <Button variant="link" className="p-0 h-auto">
                  Créer un compte
                </Button>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}