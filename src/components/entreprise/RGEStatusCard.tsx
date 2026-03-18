import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Shield,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Calendar,
  Building2,
  Award,
  ExternalLink,
  Clock,
  Flame,
  Zap,
  ThermometerSun,
  FileCheck,
} from 'lucide-react';
import type { RGEEntreprise, RGEQualification } from '@/services/api/rge-ademe.service';
import type { RGEVerificationData, RGEQualificationData } from '@/types/torp';

// Support both RGEEntreprise (from service) and RGEVerificationData (from analysis result)
type RGEData = RGEEntreprise | RGEVerificationData;

interface Props {
  rgeData: RGEData | null;
  loading?: boolean;
  showDetails?: boolean;
}

export function RGEStatusCard({ rgeData, loading = false, showDetails = true }: Props) {
  if (loading) {
    return (
      <Card className="border-blue-200/50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-600 animate-pulse" />
            <span>Verification RGE en cours...</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!rgeData) {
    return (
      <Card className="border-gray-200/50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-gray-500">
            <Shield className="h-5 w-5" />
            <span>Statut RGE</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Aucune donnee RGE disponible. Fournissez un SIRET pour verifier.
          </p>
        </CardContent>
      </Card>
    );
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-blue-600';
    if (score >= 40) return 'text-yellow-600';
    if (score >= 20) return 'text-orange-600';
    return 'text-red-600';
  };

  const getScoreBgColor = (score: number) => {
    if (score >= 80) return 'bg-green-100 border-green-200';
    if (score >= 60) return 'bg-blue-100 border-blue-200';
    if (score >= 40) return 'bg-yellow-100 border-yellow-200';
    if (score >= 20) return 'bg-orange-100 border-orange-200';
    return 'bg-red-100 border-red-200';
  };

  const getMetaDomaineIcon = (metaDomaine: string) => {
    switch (metaDomaine) {
      case "Travaux d'efficacite energetique":
        return <ThermometerSun className="h-4 w-4 text-orange-500" />;
      case "Installations d'energies renouvelables":
        return <Zap className="h-4 w-4 text-green-500" />;
      case 'Etudes energetiques':
        return <FileCheck className="h-4 w-4 text-blue-500" />;
      case 'Renovation globale':
        return <Flame className="h-4 w-4 text-purple-500" />;
      default:
        return <Award className="h-4 w-4 text-gray-500" />;
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <Card className={`border-2 ${rgeData.estRGE ? 'border-green-200' : 'border-orange-200'}`}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className={`h-5 w-5 ${rgeData.estRGE ? 'text-green-600' : 'text-orange-500'}`} />
            <span>Label RGE</span>
          </div>
          <div className="flex items-center gap-2">
            {rgeData.estRGE ? (
              <Badge className="bg-green-100 text-green-700 border-green-200">
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                RGE Verifie
              </Badge>
            ) : (
              <Badge className="bg-orange-100 text-orange-700 border-orange-200">
                <XCircle className="h-3.5 w-3.5 mr-1" />
                Non RGE
              </Badge>
            )}
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Score RGE global */}
        <div className={`p-3 rounded-lg border ${getScoreBgColor(rgeData.scoreRGE)}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Score RGE</span>
            <span className={`text-2xl font-bold ${getScoreColor(rgeData.scoreRGE)}`}>
              {rgeData.scoreRGE}/100
            </span>
          </div>
          <Progress value={rgeData.scoreRGE} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>{rgeData.nombreQualificationsActives} qualification(s) active(s)</span>
            <span>{rgeData.nombreQualificationsTotales} total</span>
          </div>
        </div>

        {/* Alertes */}
        {rgeData.alertes.length > 0 && (
          <div className="space-y-2">
            {rgeData.alertes.map((alerte, i) => (
              <div
                key={`item-${i}`}
                className={`flex items-start gap-2 p-2 rounded-lg text-sm ${
                  alerte.type === 'expiration_proche'
                    ? 'bg-yellow-50 border border-yellow-200'
                    : alerte.type === 'qualification_expiree'
                    ? 'bg-red-50 border border-red-200'
                    : 'bg-gray-50 border border-gray-200'
                }`}
              >
                <AlertTriangle
                  className={`h-4 w-4 mt-0.5 flex-shrink-0 ${
                    alerte.type === 'expiration_proche'
                      ? 'text-yellow-600'
                      : alerte.type === 'qualification_expiree'
                      ? 'text-red-600'
                      : 'text-gray-500'
                  }`}
                />
                <span>{alerte.message}</span>
              </div>
            ))}
          </div>
        )}

        {/* Prochaine expiration */}
        {rgeData.prochaineExpiration && (
          <div className="flex items-center justify-between p-2 bg-blue-50 rounded-lg border border-blue-100">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-600" />
              <span className="text-sm">Prochaine expiration</span>
            </div>
            <div className="text-right">
              <div className="text-sm font-medium">{rgeData.prochaineExpiration.qualification}</div>
              <div className="text-xs text-muted-foreground">
                {formatDate(rgeData.prochaineExpiration.dateFin)} ({rgeData.prochaineExpiration.joursRestants} jours)
              </div>
            </div>
          </div>
        )}

        {showDetails && rgeData.estRGE && (
          <>
            {/* Domaines actifs */}
            <div>
              <h5 className="text-sm font-medium mb-2 flex items-center gap-1.5">
                <Award className="h-4 w-4 text-green-600" />
                Domaines certifies
              </h5>
              <div className="flex flex-wrap gap-1.5">
                {rgeData.metaDomainesActifs.map((domaine, i) => (
                  <Badge
                    key={`item-${i}`}
                    variant="outline"
                    className="text-xs bg-green-50 border-green-200 flex items-center gap-1"
                  >
                    {getMetaDomaineIcon(domaine)}
                    {domaine}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Organismes certificateurs */}
            <div>
              <h5 className="text-sm font-medium mb-2 flex items-center gap-1.5">
                <Building2 className="h-4 w-4 text-blue-600" />
                Organismes certificateurs
              </h5>
              <div className="flex flex-wrap gap-1.5">
                {rgeData.organismesCertificateurs.map((org, i) => (
                  <Badge key={`item-${i}`} variant="secondary" className="text-xs capitalize">
                    {org}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Qualifications detaillees */}
            <div className="pt-2 border-t">
              <h5 className="text-sm font-medium mb-2 flex items-center gap-1.5">
                <FileCheck className="h-4 w-4 text-purple-600" />
                Qualifications actives ({rgeData.qualificationsActives.length})
              </h5>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {rgeData.qualificationsActives.map((qual, i) => (
                  <QualificationItem key={`item-${i}`} qualification={qual} />
                ))}
              </div>
            </div>

            {/* Certificats */}
            {'certificats' in rgeData && rgeData.certificats && rgeData.certificats.length > 0 && (
              <div className="pt-2 border-t">
                <h5 className="text-sm font-medium mb-2 flex items-center gap-1.5">
                  <ExternalLink className="h-4 w-4 text-indigo-600" />
                  Certificats
                </h5>
                <div className="flex flex-wrap gap-2">
                  {rgeData.certificats.slice(0, 3).map((cert, i) => (
                    <a
                      key={`item-${i}`}
                      href={cert.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                    >
                      <ExternalLink className="h-3 w-3" />
                      {cert.qualification}
                    </a>
                  ))}
                  {rgeData.certificats.length > 3 && (
                    <span className="text-xs text-muted-foreground">
                      +{rgeData.certificats.length - 3} autres
                    </span>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* Source */}
        <div className="pt-2 border-t text-xs text-muted-foreground flex items-center justify-between">
          <span>Source: ADEME Open Data</span>
          <span>Mis a jour: {formatDate(rgeData.lastUpdate)}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function QualificationItem({ qualification }: { qualification: RGEQualification | RGEQualificationData }) {
  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const getExpirationColor = (jours: number) => {
    if (jours > 180) return 'text-green-600';
    if (jours > 90) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="p-2 bg-gray-50 rounded-lg border border-gray-100 text-sm">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="font-medium text-gray-900">
            {qualification.nomQualification || qualification.codeQualification}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {qualification.domaine} - {qualification.organisme}
          </div>
        </div>
        <div className="text-right">
          <div className={`text-xs font-medium ${getExpirationColor(qualification.joursRestants)}`}>
            {qualification.joursRestants} jours
          </div>
          <div className="text-xs text-muted-foreground">
            <Calendar className="h-3 w-3 inline mr-0.5" />
            {formatDate(qualification.dateFin)}
          </div>
        </div>
      </div>
      {'urlCertificat' in qualification && qualification.urlCertificat && (
        <a
          href={qualification.urlCertificat}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-600 hover:underline mt-1 inline-flex items-center gap-1"
        >
          <ExternalLink className="h-3 w-3" />
          Voir certificat
        </a>
      )}
    </div>
  );
}

export default RGEStatusCard;
