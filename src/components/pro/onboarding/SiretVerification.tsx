import { useState, useEffect } from 'react';
import { sireneService, SireneEntreprise } from '@/services/api/sirene.service';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Building2,
  MapPin,
  Calendar,
  Users,
  AlertTriangle,
} from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';

interface Props {
  onVerified: (data: SireneEntreprise) => void;
  onError: (error: string) => void;
  initialSiret?: string;
}

export function SiretVerification({ onVerified, onError, initialSiret = '' }: Props) {
  const [siret, setSiret] = useState(initialSiret);
  const [loading, setLoading] = useState(false);
  const [verified, setVerified] = useState(false);
  const [entreprise, setEntreprise] = useState<SireneEntreprise | null>(null);
  const [error, setError] = useState<string | null>(null);

  const debouncedSiret = useDebounce(siret.replace(/\s/g, ''), 500);

  // Formatage du SIRET pour l'affichage (XXX XXX XXX XXXXX)
  function formatSiretInput(value: string): string {
    const digits = value.replace(/\D/g, '').slice(0, 14);
    const parts = [
      digits.slice(0, 3),
      digits.slice(3, 6),
      digits.slice(6, 9),
      digits.slice(9, 14),
    ].filter(Boolean);
    return parts.join(' ');
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const formatted = formatSiretInput(e.target.value);
    setSiret(formatted);
    setVerified(false);
    setEntreprise(null);
    setError(null);
  }

  // Vérification automatique quand 14 chiffres saisis
  useEffect(() => {
    if (debouncedSiret.length === 14) {
      verifySiret(debouncedSiret);
    }
  }, [debouncedSiret]);

  async function verifySiret(siretToVerify: string) {
    setLoading(true);
    setError(null);

    try {
      const result = await sireneService.getEtablissementBySiret(siretToVerify);

      if (result.success && result.data) {
        setEntreprise(result.data);
        setVerified(true);
        onVerified(result.data);

        // Alerte si entreprise cessée
        if (!result.data.estActif) {
          setError('Attention : cette entreprise n\'est plus active');
        }
      } else {
        setError(result.error || 'SIRET non trouvé');
        setVerified(false);
        onError(result.error || 'SIRET non trouvé');
      }
    } catch (err) {
      const errorMessage = 'Erreur lors de la vérification';
      setError(errorMessage);
      onError(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Champ SIRET */}
      <div className="space-y-2">
        <Label htmlFor="siret">
          Numéro SIRET <span className="text-red-500">*</span>
        </Label>
        <div className="relative">
          <Input
            id="siret"
            value={siret}
            onChange={handleChange}
            placeholder="XXX XXX XXX XXXXX"
            className={`pr-10 font-mono text-lg ${
              verified ? 'border-green-500 bg-green-50' :
              error ? 'border-red-500 bg-red-50' : ''
            }`}
            disabled={loading}
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {loading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
            {verified && !loading && <CheckCircle2 className="h-5 w-5 text-green-500" />}
            {error && !loading && !verified && <XCircle className="h-5 w-5 text-red-500" />}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          14 chiffres - La vérification est automatique
        </p>
      </div>

      {/* Message d'erreur */}
      {error && (
        <Alert variant={entreprise?.estActif === false ? 'default' : 'destructive'}>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Données entreprise vérifiées */}
      {entreprise && (
        <Card className={`p-4 ${entreprise.estActif ? 'bg-green-50 border-green-200' : 'bg-orange-50 border-orange-200'}`}>
          <div className="space-y-3">
            {/* En-tête */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">
                  {entreprise.raisonSociale || entreprise.denominationUsuelle || 'Entreprise'}
                </h3>
              </div>
              <Badge variant={entreprise.estActif ? 'default' : 'destructive'}>
                {entreprise.estActif ? 'Active' : 'Cessée'}
              </Badge>
            </div>

            {/* Informations */}
            <div className="grid sm:grid-cols-2 gap-2 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <span className="font-medium">SIRET :</span>
                <span className="font-mono">{entreprise.siret}</span>
              </div>

              {entreprise.categorieJuridiqueLibelle && (
                <div className="text-muted-foreground">
                  <span className="font-medium">Forme :</span> {entreprise.categorieJuridiqueLibelle}
                </div>
              )}

              {entreprise.codeNAF && (
                <div className="text-muted-foreground">
                  <span className="font-medium">NAF :</span> {entreprise.codeNAF}
                  {entreprise.libelleNAF && ` - ${entreprise.libelleNAF}`}
                </div>
              )}

              {entreprise.dateCreationFormatee && (
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>Créée le {entreprise.dateCreationFormatee}</span>
                  {entreprise.ancienneteAnnees !== null && (
                    <span>({entreprise.ancienneteAnnees} ans)</span>
                  )}
                </div>
              )}

              {entreprise.trancheEffectifLibelle && entreprise.trancheEffectifLibelle !== 'Non renseigné' && (
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Users className="h-4 w-4" />
                  <span>{entreprise.trancheEffectifLibelle}</span>
                </div>
              )}
            </div>

            {/* Adresse */}
            {entreprise.adresseComplete && entreprise.adresseComplete !== 'Non renseignée' && (
              <div className="flex items-start gap-2 text-sm text-muted-foreground pt-2 border-t">
                <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{entreprise.adresseComplete}</span>
              </div>
            )}

            {/* Badges */}
            <div className="flex flex-wrap gap-2 pt-2">
              {entreprise.estSiege && (
                <Badge variant="outline">Siège social</Badge>
              )}
              {entreprise.categorieEntreprise && (
                <Badge variant="outline">{entreprise.categorieEntreprise}</Badge>
              )}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
