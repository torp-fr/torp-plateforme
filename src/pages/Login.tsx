import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useApp } from '@/context/AppContext';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import torpLogo from '@/assets/torp-logo-red.png';
import { authService } from '@/services/api';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { setUser } = useApp();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      console.log('[Login] Connexion avec:', email);

      const response = await authService.login({
        email,
        password,
      });

      console.log('[Login] Connexion réussie:', response.user.email, 'Role:', response.user.role, 'isAdmin:', response.user.isAdmin, 'type:', response.user.type, '(typeof isAdmin:', typeof response.user.isAdmin, ')');

      setUser(response.user);

      toast({
        title: 'Connexion réussie',
        description: `Bienvenue ${response.user.name || response.user.email}!`,
      });

      // Redirection selon le statut admin et le type d'utilisateur
      await new Promise(resolve => setTimeout(resolve, 100));

      if (response.user.isAdmin === true) {
        console.log('[Login] Admin détecté, redirection vers /analytics');
        navigate('/analytics');
      } else if (response.user.type === 'B2B') {
        console.log('[Login] Utilisateur B2B, redirection vers /projets');
        navigate('/projets');
      } else {
        console.log('[Login] Utilisateur B2C, redirection vers /dashboard');
        navigate('/dashboard');
      }
    } catch (error) {
      console.error('[Login] Erreur:', error);
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
                <CardDescription>Connexion à votre espace</CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent>
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
                  <Button variant="link" className="text-sm text-muted-foreground p-0 h-auto">
                    Mot de passe oublié ?
                  </Button>
                </Link>
              </div>
            </form>

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
