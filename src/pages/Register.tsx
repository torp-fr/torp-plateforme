import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useApp } from '@/context/AppContext';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft } from 'lucide-react';
import { BRANDING } from '@/config/branding';
import { authService } from '@/services/api';
import { log, warn, error, time, timeEnd } from '@/lib/logger';

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { setUser } = useApp();
  const { toast } = useToast();

  const handleRegister = async (e: React.FormEvent) => {
    log('[Register] Form submitted');
    e.preventDefault();

    // Validation
    log('[Register] Validating form:', { email, name, passwordLength: password.length });

    if (!email || !name || !password) {
      log('[Register] Missing required fields');
      toast({
        title: 'Erreur',
        description: 'Veuillez remplir tous les champs obligatoires',
        variant: 'destructive',
      });
      return;
    }

    if (password !== confirmPassword) {
      log('[Register] Passwords do not match');
      toast({
        title: 'Erreur',
        description: 'Les mots de passe ne correspondent pas',
        variant: 'destructive',
      });
      return;
    }

    if (password.length < 8) {
      log('[Register] Password too short');
      toast({
        title: 'Erreur',
        description: 'Le mot de passe doit contenir au moins 8 caractères',
        variant: 'destructive',
      });
      return;
    }

    log('[Register] Validation passed, calling authService.register()');
    setIsLoading(true);

    try {
      // Register with B2B as default (user can change in settings)
      log('[Register] Starting registration...');
      const response = await authService.register({
        email,
        password,
        name,
        type: 'B2B', // Default to B2B for "B2B-first" approach
        phone: phone || undefined,
      });

      log('[Register] Registration successful:', response.user.email);
      setUser(response.user);

      toast({
        title: 'Compte créé avec succès!',
        description: `Bienvenue ${response.user.name}! Configurez votre profil dans les paramètres.`,
      });

      // Redirect to dashboard (they can set role in settings)
      log('[Register] Redirecting to dashboard');
      navigate('/dashboard');
    } catch (error) {
      console.error('[Register] Error:', error);
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
              <img src={BRANDING.logoPrimary} alt="TORP" className="h-12 w-auto" />
              <div>
                <CardTitle className="text-2xl font-bold text-primary">TORP</CardTitle>
                <CardDescription>Créer votre compte</CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent>
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
                onClick={(e) => {
                  log('[Register] Button clicked:', { isLoading, email, name, passwordLength: password.length });
                  if (isLoading) {
                    e.preventDefault();
                  }
                }}
              >
                {isLoading ? 'Création du compte...' : 'Créer mon compte'}
              </Button>
            </form>

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
