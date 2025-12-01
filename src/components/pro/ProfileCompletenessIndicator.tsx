/**
 * Profile Completeness Indicator
 * Affiche l'indicateur de complétude du profil entreprise
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckCircle2, AlertTriangle, FileText, ArrowRight, TrendingUp } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { calculateProfileCompleteness, getLevelLabel, getLevelColor } from '@/lib/pro/profile-completeness';
import type { ProfileCompleteness } from '@/lib/pro/profile-completeness';

interface ProfileCompletenessIndicatorProps {
  companyId: string;
  compact?: boolean; // Si true, affichage compact sans détails
}

export const ProfileCompletenessIndicator = ({ companyId, compact = false }: ProfileCompletenessIndicatorProps) => {
  const [completeness, setCompleteness] = useState<ProfileCompleteness | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCompleteness();
  }, [companyId]);

  const loadCompleteness = async () => {
    try {
      setLoading(true);

      // Charger le profil entreprise
      const { data: company, error: companyError } = await supabase
        .from('pro_company_profiles')
        .select('*')
        .eq('id', companyId)
        .single();

      if (companyError) throw companyError;

      // Charger les documents
      const { data: documents, error: docsError } = await supabase
        .from('company_documents')
        .select('*')
        .eq('company_id', companyId);

      if (docsError) throw docsError;

      // Calculer la complétude
      const result = calculateProfileCompleteness(company, documents || []);
      setCompleteness(result);
    } catch (error) {
      console.error('Erreur chargement complétude:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-8 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!completeness) {
    return null;
  }

  // Version compacte (pour header/sidebar)
  if (compact) {
    return (
      <Link to="/pro/settings">
        <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Complétude du profil</span>
              <Badge className={getLevelColor(completeness.level)}>
                {getLevelLabel(completeness.level)}
              </Badge>
            </div>
            <Progress value={completeness.score} className="h-2" />
            <p className="text-xs text-muted-foreground mt-2">{completeness.score}% complété</p>
          </CardContent>
        </Card>
      </Link>
    );
  }

  // Version complète (pour dashboard)
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Complétude du profil
          </CardTitle>
          <Badge className={getLevelColor(completeness.level)}>
            {getLevelLabel(completeness.level)}
          </Badge>
        </div>
        <CardDescription>
          Complétez votre profil pour maximiser votre crédibilité
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Barre de progression */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-2xl font-bold">{completeness.score}%</span>
            <span className="text-sm text-muted-foreground">
              {completeness.score < 100 ? `${100 - completeness.score}% restant` : 'Profil complet !'}
            </span>
          </div>
          <Progress value={completeness.score} className="h-3" />
        </div>

        {/* Alertes documents manquants/expirés */}
        {(completeness.missingRequired.length > 0 || completeness.expired.length > 0 || completeness.expiringSoon.length > 0) && (
          <div className="space-y-2">
            {completeness.missingRequired.length > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Documents obligatoires manquants</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc list-inside text-sm mt-1">
                    {completeness.missingRequired.map((doc) => (
                      <li key={doc}>{doc}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {completeness.expired.length > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Documents expirés</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc list-inside text-sm mt-1">
                    {completeness.expired.map((doc) => (
                      <li key={doc}>{doc}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {completeness.expiringSoon.length > 0 && (
              <Alert className="border-orange-200 bg-orange-50 dark:bg-orange-950/20">
                <AlertTriangle className="h-4 w-4 text-orange-600" />
                <AlertTitle className="text-orange-900 dark:text-orange-100">
                  Documents expirant bientôt
                </AlertTitle>
                <AlertDescription className="text-orange-800 dark:text-orange-200">
                  <ul className="list-disc list-inside text-sm mt-1">
                    {completeness.expiringSoon.map((doc) => (
                      <li key={doc}>{doc} (expire dans moins de 30 jours)</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* Détails de complétude */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold mb-3">Détails</h4>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex items-center gap-2">
              {completeness.details.basicInfo ? (
                <CheckCircle2 className="w-4 h-4 text-green-600" />
              ) : (
                <div className="w-4 h-4 rounded-full border-2 border-gray-300" />
              )}
              <span>Informations de base</span>
            </div>
            <div className="flex items-center gap-2">
              {completeness.details.siretVerified ? (
                <CheckCircle2 className="w-4 h-4 text-green-600" />
              ) : (
                <div className="w-4 h-4 rounded-full border-2 border-gray-300" />
              )}
              <span>SIRET vérifié</span>
            </div>
            <div className="flex items-center gap-2">
              {completeness.details.kbis ? (
                <CheckCircle2 className="w-4 h-4 text-green-600" />
              ) : (
                <div className="w-4 h-4 rounded-full border-2 border-gray-300" />
              )}
              <span>KBIS</span>
            </div>
            <div className="flex items-center gap-2">
              {completeness.details.decennale ? (
                <CheckCircle2 className="w-4 h-4 text-green-600" />
              ) : (
                <div className="w-4 h-4 rounded-full border-2 border-gray-300" />
              )}
              <span>Assurance décennale</span>
            </div>
            <div className="flex items-center gap-2">
              {completeness.details.rcPro ? (
                <CheckCircle2 className="w-4 h-4 text-green-600" />
              ) : (
                <div className="w-4 h-4 rounded-full border-2 border-gray-300" />
              )}
              <span>RC Pro</span>
            </div>
            <div className="flex items-center gap-2">
              {completeness.details.urssaf ? (
                <CheckCircle2 className="w-4 h-4 text-green-600" />
              ) : (
                <div className="w-4 h-4 rounded-full border-2 border-gray-300" />
              )}
              <span>URSSAF / Vigilance</span>
            </div>
            <div className="flex items-center gap-2 col-span-2">
              {completeness.details.certifications ? (
                <CheckCircle2 className="w-4 h-4 text-green-600" />
              ) : (
                <div className="w-4 h-4 rounded-full border-2 border-gray-300" />
              )}
              <span>Certifications (RGE, Qualibat...)</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          {completeness.score < 100 && (
            <Link to="/pro/documents" className="flex-1">
              <Button variant="outline" className="w-full">
                <FileText className="w-4 h-4 mr-2" />
                Gérer les documents
              </Button>
            </Link>
          )}
          <Link to="/pro/settings" className="flex-1">
            <Button variant="outline" className="w-full">
              <ArrowRight className="w-4 h-4 mr-2" />
              Modifier le profil
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
};
