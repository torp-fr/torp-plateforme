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
import { authService } from '@/services/api';

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

    try {
      console.log('[Login] Tentative de connexion avec:', email);

      // Login using real Supabase auth service
      const response = await authService.login({
        email,
        password,
      });

      console.log('[Login] Connexion réussie, utilisateur:', response.user.email, 'Type:', response.user.type);

      setUser(response.user);

      toast({
        title: 'Connexion réussie',
        description: `Bienvenue ${response.user.name || response.user.email}!`,
      });

      // Attendre un petit délai pour que le contexte soit bien mis à jour
      await new Promise(resolve => setTimeout(resolve, 100));

      console.log('[Login] Redirection selon le type utilisateur...');

      // Redirection selon le type d'utilisateur
      if (response.user.type === 'admin' || response.user.type === 'super_admin') {
        console.log('[Login] Admin détecté, redirection vers /analytics');
        navigate('/analytics');
      } else {
        console.log('[Login] Utilisateur, redirection vers /dashboard');
        navigate('/dashboard');
      }
    } catch (error) {
      console.error('[Login] Erreur de connexion:', error);
      toast({
        title: 'Erreur de connexion',
        description: error instanceof Error ? error.message : 'Email ou mot de passe incorrect',
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
                <p className="text-xs text-muted-foreground">Connexion à votre espace</p>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <Tabs defaultValue={userType} onValueChange={(value) => setUserType(value as UserType)}>
              <TabsList className="grid w-full grid-cols-2">
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

                  <div className="text-center">
                    <Link to="/forgot-password">
                      <Button variant="link" className="text-sm text-muted-foreground">
                        Mot de passe oublié ?
                      </Button>
                    </Link>
                  </div>
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
                    {isLoading ? 'Connexion...' : 'Accéder à mon espace professionnel'}
                  </Button>

                  <div className="text-center">
                    <Link to="/forgot-password">
                      <Button variant="link" className="text-sm text-muted-foreground">
                        Mot de passe oublié ?
                      </Button>
                    </Link>
                  </div>
                </form>
              </TabsContent>
            </Tabs>

            <div className="mt-6 pt-4 border-t text-center">
              <p className="text-sm text-muted-foreground">
                Pas encore de compte ?{' '}
                <Link to="/register">
                  <Button variant="link" className="p-0 h-auto">
                    Créer un compte
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