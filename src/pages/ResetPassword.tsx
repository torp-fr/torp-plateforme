import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Lock, CheckCircle, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { BRANDING } from '@/config/branding';
import { authService } from '@/services/api/supabase/auth.service';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isValidToken, setIsValidToken] = useState(true);

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  // Supabase handles the token automatically via the URL hash
  // The user is redirected with access_token and refresh_token in the URL
  useEffect(() => {
    // Check if there's a hash fragment with tokens (Supabase auth)
    const hash = window.location.hash;
    if (hash && hash.includes('access_token')) {
      // Token is valid, user can proceed
      setIsValidToken(true);
    } else if (hash && hash.includes('error')) {
      // Token is invalid or expired
      setIsValidToken(false);
      toast({
        title: 'Lien invalide',
        description: 'Ce lien de réinitialisation est invalide ou a expiré.',
        variant: 'destructive',
      });
    }
  }, [toast]);

  const validatePassword = (pwd: string): string[] => {
    const errors: string[] = [];
    if (pwd.length < 8) errors.push('Au moins 8 caractères');
    if (!/[A-Z]/.test(pwd)) errors.push('Au moins une majuscule');
    if (!/[a-z]/.test(pwd)) errors.push('Au moins une minuscule');
    if (!/[0-9]/.test(pwd)) errors.push('Au moins un chiffre');
    return errors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate passwords
    const passwordErrors = validatePassword(password);
    if (passwordErrors.length > 0) {
      toast({
        title: 'Mot de passe invalide',
        description: passwordErrors.join(', '),
        variant: 'destructive',
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: 'Les mots de passe ne correspondent pas',
        description: 'Veuillez vérifier que les deux mots de passe sont identiques.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      // The token is handled automatically by Supabase via the URL hash
      await authService.resetPassword('', password);
      setIsSuccess(true);
      toast({
        title: 'Mot de passe modifié',
        description: 'Votre mot de passe a été réinitialisé avec succès.',
      });

      // Redirect to login after 3 seconds
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (error) {
      console.error('[ResetPassword] Error:', error);
      toast({
        title: 'Erreur',
        description: error instanceof Error ? error.message : 'Une erreur est survenue. Veuillez réessayer.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Invalid token state
  if (!isValidToken) {
    return (
      <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/20"></div>

        <div className="w-full max-w-md relative z-10">
          <Link to="/login" className="inline-flex items-center text-white hover:text-white/80 mb-8">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour à la connexion
          </Link>

          <Card className="backdrop-blur-sm bg-white/95 shadow-strong">
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <div className="p-4 bg-destructive/10 rounded-full">
                  <AlertCircle className="h-12 w-12 text-destructive" />
                </div>
              </div>
              <CardTitle className="text-2xl font-bold">Lien invalide</CardTitle>
              <CardDescription className="text-base mt-2">
                Ce lien de réinitialisation est invalide ou a expiré.
              </CardDescription>
            </CardHeader>

            <CardContent className="text-center space-y-4">
              <p className="text-sm text-muted-foreground">
                Les liens de réinitialisation sont valides pendant 24 heures. Veuillez demander un nouveau lien.
              </p>

              <div className="pt-4 space-y-3">
                <Link to="/forgot-password" className="block">
                  <Button className="w-full">
                    Demander un nouveau lien
                  </Button>
                </Link>
                <Link to="/login" className="block">
                  <Button variant="ghost" className="w-full">
                    Retour à la connexion
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Success state
  if (isSuccess) {
    return (
      <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/20"></div>

        <div className="w-full max-w-md relative z-10">
          <Card className="backdrop-blur-sm bg-white/95 shadow-strong">
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <div className="p-4 bg-success/10 rounded-full">
                  <CheckCircle className="h-12 w-12 text-success" />
                </div>
              </div>
              <CardTitle className="text-2xl font-bold">Mot de passe modifié !</CardTitle>
              <CardDescription className="text-base mt-2">
                Votre mot de passe a été réinitialisé avec succès.
              </CardDescription>
            </CardHeader>

            <CardContent className="text-center space-y-4">
              <p className="text-sm text-muted-foreground">
                Vous allez être redirigé vers la page de connexion dans quelques secondes...
              </p>

              <div className="pt-4">
                <Link to="/login" className="block">
                  <Button className="w-full">
                    Se connecter maintenant
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Reset password form
  return (
    <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/20"></div>

      <div className="w-full max-w-md relative z-10">
        <Link to="/login" className="inline-flex items-center text-white hover:text-white/80 mb-8">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour à la connexion
        </Link>

        <Card className="backdrop-blur-sm bg-white/95 shadow-strong">
          <CardHeader className="text-center">
            <div className="flex items-center justify-center gap-3 mb-4">
              <img src={BRANDING.logoPrimary} alt="TORP" className="h-12 w-auto" />
              <div>
                <CardTitle className="text-2xl font-bold text-primary">TORP</CardTitle>
                <p className="text-xs text-muted-foreground">Nouveau mot de passe</p>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <div className="mb-6">
              <div className="flex justify-center mb-4">
                <div className="p-3 bg-primary/10 rounded-full">
                  <Lock className="h-8 w-8 text-primary" />
                </div>
              </div>
              <p className="text-center text-muted-foreground">
                Créez un nouveau mot de passe sécurisé pour votre compte.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Nouveau mot de passe</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoFocus
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Au moins 8 caractères, une majuscule, une minuscule et un chiffre
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={isLoading}
              >
                {isLoading ? 'Modification en cours...' : 'Modifier le mot de passe'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
