/**
 * Composant d'affichage public du ticket TORP
 * Utilisé dans la page /t/:code accessible sans authentification
 */

import {
  Shield,
  Building2,
  CheckCircle2,
  AlertTriangle,
  FileCheck,
  Award,
  Calendar,
  MapPin,
  BadgeCheck,
  ChevronRight,
  Info,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export interface PublicTicketViewData {
  ticketCode: string;
  grade: 'A' | 'B' | 'C' | 'D' | 'E';
  scoreTotal: number;
  gradeLabel: string;
  gradeDescription: string;
  entreprise: {
    raisonSociale: string;
    ville: string;
    siretPartiel: string;
    anciennete: string;
    siretVerifie: boolean;
  };
  referenceDevis: string;
  dateAnalyse: string;
  axes: Array<{
    label: string;
    score: number;
    status: 'excellent' | 'bon' | 'moyen' | 'faible';
  }>;
  pointsForts: string[];
  documentsVerifies: Array<{
    type: string;
    statut: 'valide' | 'present';
  }>;
  certifications: string[];
}

interface Props {
  data: PublicTicketViewData;
}

const GRADE_STYLES = {
  A: {
    bg: 'bg-green-500',
    bgLight: 'bg-green-50 dark:bg-green-950/20',
    border: 'border-green-200 dark:border-green-800',
    text: 'text-green-700 dark:text-green-300',
    icon: CheckCircle2,
  },
  B: {
    bg: 'bg-green-400',
    bgLight: 'bg-green-50 dark:bg-green-950/20',
    border: 'border-green-200 dark:border-green-800',
    text: 'text-green-600 dark:text-green-400',
    icon: CheckCircle2,
  },
  C: {
    bg: 'bg-yellow-400',
    bgLight: 'bg-yellow-50 dark:bg-yellow-950/20',
    border: 'border-yellow-200 dark:border-yellow-800',
    text: 'text-yellow-700 dark:text-yellow-300',
    icon: Info,
  },
  D: {
    bg: 'bg-orange-500',
    bgLight: 'bg-orange-50 dark:bg-orange-950/20',
    border: 'border-orange-200 dark:border-orange-800',
    text: 'text-orange-700 dark:text-orange-300',
    icon: AlertTriangle,
  },
  E: {
    bg: 'bg-red-500',
    bgLight: 'bg-red-50 dark:bg-red-950/20',
    border: 'border-red-200 dark:border-red-800',
    text: 'text-red-700 dark:text-red-300',
    icon: AlertTriangle,
  },
};

const STATUS_COLORS = {
  excellent: 'bg-green-500',
  bon: 'bg-green-400',
  moyen: 'bg-yellow-400',
  faible: 'bg-red-400',
};

export function PublicTicketView({ data }: Props) {
  const gradeStyle = GRADE_STYLES[data.grade];
  const GradeIcon = gradeStyle.icon;

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* ===== HERO SCORE ===== */}
        <Card className={`${gradeStyle.bgLight} ${gradeStyle.border} border-2`}>
          <CardContent className="p-6 md:p-8">
            <div className="flex flex-col md:flex-row items-center gap-6">
              {/* Score visuel */}
              <div className="flex-shrink-0 text-center">
                <div
                  className={`
                    w-28 h-28 rounded-full ${gradeStyle.bg} 
                    flex items-center justify-center shadow-lg
                  `}
                >
                  <span className="text-5xl font-bold text-white">{data.grade}</span>
                </div>
                <p className="mt-2 text-2xl font-bold">
                  {data.scoreTotal}
                  <span className="text-lg text-muted-foreground">/1000</span>
                </p>
              </div>

              {/* Description */}
              <div className="flex-1 text-center md:text-left">
                <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
                  <GradeIcon className={`h-5 w-5 ${gradeStyle.text}`} />
                  <span className={`text-xl font-semibold ${gradeStyle.text}`}>
                    {data.gradeLabel}
                  </span>
                </div>
                <p className="text-muted-foreground">{data.gradeDescription}</p>
                <p className="mt-3 text-sm text-muted-foreground">
                  Analyse effectuée le {data.dateAnalyse}
                </p>
              </div>

              {/* Badge vérifié */}
              <div className="flex-shrink-0">
                <Badge variant="outline" className="gap-1 px-3 py-1">
                  <BadgeCheck className="h-4 w-4 text-primary" />
                  Vérifié TORP
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ===== ENTREPRISE ===== */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <Building2 className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold mb-1">
                  {data.entreprise.raisonSociale}
                </h2>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {data.entreprise.ville}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {data.entreprise.anciennete}
                  </span>
                </div>

                {/* SIRET vérifié */}
                <div className="mt-3 flex items-center gap-2">
                  <code className="text-sm bg-muted px-2 py-1 rounded">
                    SIRET : {data.entreprise.siretPartiel}
                  </code>
                  {data.entreprise.siretVerifie && (
                    <Tooltip>
                      <TooltipTrigger>
                        <Badge variant="secondary" className="gap-1">
                          <CheckCircle2 className="h-3 w-3 text-green-500" />
                          Vérifié
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>SIRET vérifié auprès de l'INSEE</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>

                {/* Certifications */}
                {data.certifications.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {data.certifications.map((cert) => (
                      <Badge key={cert} variant="outline" className="gap-1">
                        <Award className="h-3 w-3 text-yellow-500" />
                        {cert}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ===== DÉTAIL DES AXES ===== */}
        <Card>
          <CardContent className="p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <FileCheck className="h-5 w-5 text-primary" />
              Détail de l'analyse
            </h3>

            <div className="space-y-4">
              {data.axes.map((axe) => (
                <div key={axe.label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">{axe.label}</span>
                    <span className="text-sm text-muted-foreground">{axe.score}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full ${STATUS_COLORS[axe.status]} transition-all`}
                      style={{ width: `${axe.score}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ===== POINTS FORTS ===== */}
        {data.pointsForts.length > 0 && (
          <Card className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
            <CardContent className="p-6">
              <h3 className="font-semibold mb-3 flex items-center gap-2 text-green-700 dark:text-green-300">
                <CheckCircle2 className="h-5 w-5" />
                Points forts
              </h3>
              <ul className="space-y-2">
                {data.pointsForts.map((point, i) => (
                  <li key={i} className="flex items-start gap-2 text-green-800 dark:text-green-200">
                    <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* ===== DOCUMENTS VÉRIFIÉS ===== */}
        {data.documentsVerifies.length > 0 && (
          <Card>
            <CardContent className="p-6">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Documents vérifiés
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {data.documentsVerifies.map((doc) => (
                  <div
                    key={doc.type}
                    className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg"
                  >
                    <CheckCircle2
                      className={`h-4 w-4 ${
                        doc.statut === 'valide' ? 'text-green-500' : 'text-blue-500'
                      }`}
                    />
                    <span className="text-sm">{doc.type}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ===== RÉFÉRENCE DEVIS ===== */}
        <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
          <div>
            <p className="text-sm text-muted-foreground">Référence du devis analysé</p>
            <p className="font-mono font-medium">{data.referenceDevis}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Code vérification</p>
            <p className="font-mono font-medium text-primary">{data.ticketCode}</p>
          </div>
        </div>

        {/* ===== CTA TORP ===== */}
        <Card className="bg-primary text-primary-foreground">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row items-center gap-4">
              <div className="flex-1 text-center md:text-left">
                <h3 className="text-lg font-semibold mb-1">
                  Vous aussi, analysez vos devis
                </h3>
                <p className="text-primary-foreground/80 text-sm">
                  TORP analyse et compare vos devis BTP pour vous aider à faire le bon choix.
                </p>
              </div>
              <Button
                variant="secondary"
                size="lg"
                className="gap-2 whitespace-nowrap"
                onClick={() => (window.location.href = '/signup')}
              >
                Essayer gratuitement
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* ===== DISCLAIMER ===== */}
        <p className="text-xs text-center text-muted-foreground px-4">
          Cette analyse reflète la qualité du devis à la date indiquée. Elle ne constitue
          pas une garantie sur la réalisation des travaux. Vérifiez toujours les
          informations auprès de l'entreprise.
        </p>
      </div>
    </TooltipProvider>
  );
}
