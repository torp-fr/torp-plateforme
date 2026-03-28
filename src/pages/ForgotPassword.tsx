import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Mail, CheckCircle } from 'lucide-react';
import { BRANDING } from '@/config/branding';
import { authService } from '@/services/api/supabase/auth.service';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email) {
      toast({
        title: 'Email requis',
        description: 'Veuillez entrer votre adresse email.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      await authService.requestPasswordReset(email);
      setIsSuccess(true);
      toast({
        title: 'Email envoyé',
        description: 'Un lien de réinitialisation a été envoyé à votre adresse email.',
      });
    } catch (error) {
      console.error('[ForgotPassword] Error:', error);
      toast({
        title: 'Erreur',
        description: error instanceof Error ? error.message : 'Une erreur est survenue. Veuillez réessayer.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
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
                <div className="p-4 bg-success/10 rounded-full">
                  <CheckCircle className="h-12 w-12 text-success" />
                </div>
              </div>
              <CardTitle className="text-2xl font-bold">Email envoyé !</CardTitle>
              <CardDescription className="text-base mt-2">
                Un email de réinitialisation a été envoyé à <strong>{email}</strong>
              </CardDescription>
            </CardHeader>

            <CardContent className="text-center space-y-4">
              <p className="text-sm text-muted-foreground">
                Vérifiez votre boîte de réception et cliquez sur le lien pour créer un nouveau mot de passe.
              </p>
              <p className="text-sm text-muted-foreground">
                Si vous ne recevez pas l'email dans les prochaines minutes, vérifiez votre dossier spam.
              </p>

              <div className="pt-4 space-y-3">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setIsSuccess(false)}
                >
                  Renvoyer l'email
                </Button>
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
                <p className="text-xs text-muted-foreground">Réinitialisation du mot de passe</p>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <div className="mb-6">
              <div className="flex justify-center mb-4">
                <div className="p-3 bg-primary/10 rounded-full">
                  <Mail className="h-8 w-8 text-primary" />
                </div>
              </div>
              <p className="text-center text-muted-foreground">
                Entrez votre adresse email et nous vous enverrons un lien pour réinitialiser votre mot de passe.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Adresse email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="votre@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={isLoading}
              >
                {isLoading ? 'Envoi en cours...' : 'Envoyer le lien de réinitialisation'}
              </Button>
            </form>

            <div className="mt-6 pt-4 border-t text-center">
              <p className="text-sm text-muted-foreground">
                Vous vous souvenez de votre mot de passe ?{' '}
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
