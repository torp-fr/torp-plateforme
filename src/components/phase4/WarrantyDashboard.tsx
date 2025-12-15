/**
 * WarrantyDashboard - Dashboard complet des garanties
 * Timeline, alertes, sinistres
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Shield,
  Clock,
  AlertTriangle,
  FileWarning,
  Plus,
  Calendar,
  CheckCircle2,
  XCircle,
  Building2,
  Phone,
  ExternalLink,
} from 'lucide-react';
import { useWarrantyClaims } from '@/hooks/phase4/useWarrantyClaims';
import { WarrantyClaimForm } from './WarrantyClaimForm';
import { differenceInDays, format, addYears } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { GarantieType, DesordreStatut } from '@/types/phase4.types';

interface WarrantyDashboardProps {
  chantierId: string;
}

const GARANTIE_CONFIG: Record<
  GarantieType,
  { label: string; duree: string; color: string; icon: typeof Shield }
> = {
  parfait_achevement: {
    label: 'Parfait achèvement',
    duree: '1 an',
    color: 'text-blue-500',
    icon: CheckCircle2,
  },
  biennale: {
    label: 'Biennale',
    duree: '2 ans',
    color: 'text-green-500',
    icon: Shield,
  },
  decennale: {
    label: 'Décennale',
    duree: '10 ans',
    color: 'text-purple-500',
    icon: Shield,
  },
  vices_caches: {
    label: 'Vices cachés',
    duree: '10 ans (découverte)',
    color: 'text-orange-500',
    icon: AlertTriangle,
  },
};

const STATUT_CONFIG: Record<
  DesordreStatut,
  { label: string; color: string; bgColor: string }
> = {
  signale: { label: 'Signalé', color: 'text-orange-600', bgColor: 'bg-orange-100' },
  diagnostic: { label: 'En diagnostic', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  en_reparation: { label: 'En réparation', color: 'text-purple-600', bgColor: 'bg-purple-100' },
  repare: { label: 'Réparé', color: 'text-green-600', bgColor: 'bg-green-100' },
  conteste: { label: 'Contesté', color: 'text-red-600', bgColor: 'bg-red-100' },
  prescrit: { label: 'Prescrit', color: 'text-gray-600', bgColor: 'bg-gray-100' },
};

export function WarrantyDashboard({ chantierId }: WarrantyDashboardProps) {
  const {
    garanties,
    desordres,
    alertes,
    garantiesActives,
    desordresOuverts,
    isLoading,
    createDesordre,
    updateDesordreStatus,
    isCreating,
  } = useWarrantyClaims({ chantierId });

  const [showClaimForm, setShowClaimForm] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  // Calculer les progressions des garanties
  const getGarantieProgress = (dateFin: string | null) => {
    if (!dateFin) return 0;
    const dateDebut = garanties[0]?.date_debut;
    if (!dateDebut) return 0;

    const debut = new Date(dateDebut);
    const fin = new Date(dateFin);
    const now = new Date();

    if (now >= fin) return 100;
    if (now <= debut) return 0;

    const total = fin.getTime() - debut.getTime();
    const elapsed = now.getTime() - debut.getTime();
    return Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));
  };

  const getDaysRemaining = (dateFin: string | null) => {
    if (!dateFin) return null;
    const fin = new Date(dateFin);
    const now = new Date();
    if (now >= fin) return 0;
    return differenceInDays(fin, now);
  };

  return (
    <div className="space-y-6">
      {/* Alertes */}
      {alertes.length > 0 && (
        <Alert variant={alertes.some((a) => a.severity === 'danger') ? 'destructive' : 'default'}>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Alertes garanties</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-4 mt-2 space-y-1">
              {alertes.slice(0, 5).map((alerte, i) => (
                <li key={i} className={alerte.severity === 'danger' ? 'font-medium' : ''}>
                  {alerte.message}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Shield className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{garantiesActives.length}</div>
                <div className="text-sm text-muted-foreground">Garanties actives</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-orange-100 rounded-lg">
                <FileWarning className="h-6 w-6 text-orange-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{desordresOuverts.length}</div>
                <div className="text-sm text-muted-foreground">Sinistres en cours</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-100 rounded-lg">
                <Calendar className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">
                  {garanties[0]?.date_debut
                    ? format(new Date(garanties[0].date_debut), 'dd/MM/yyyy')
                    : 'N/A'}
                </div>
                <div className="text-sm text-muted-foreground">Date réception</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => setShowClaimForm(true)}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-primary/10 rounded-lg">
                <Plus className="h-6 w-6 text-primary" />
              </div>
              <div>
                <div className="text-lg font-semibold">Déclarer</div>
                <div className="text-sm text-muted-foreground">un sinistre</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="garanties">
        <TabsList>
          <TabsTrigger value="garanties">
            <Shield className="h-4 w-4 mr-2" />
            Garanties
          </TabsTrigger>
          <TabsTrigger value="sinistres">
            <FileWarning className="h-4 w-4 mr-2" />
            Sinistres ({desordres.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="garanties" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Vos garanties légales</CardTitle>
              <CardDescription>
                Suivi des garanties depuis la réception des travaux
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {garanties.map((garantie) => {
                const config = GARANTIE_CONFIG[garantie.type];
                const Icon = config.icon;
                const progress = getGarantieProgress(garantie.date_fin);
                const daysRemaining = getDaysRemaining(garantie.date_fin);
                const isExpired = daysRemaining !== null && daysRemaining <= 0;
                const isExpiringSoon = daysRemaining !== null && daysRemaining <= 90 && !isExpired;

                return (
                  <div key={garantie.id} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Icon className={cn('h-5 w-5', config.color)} />
                        <div>
                          <div className="font-medium flex items-center gap-2">
                            {config.label}
                            <Badge variant="outline">{config.duree}</Badge>
                          </div>
                          {garantie.perimetre && (
                            <p className="text-sm text-muted-foreground">{garantie.perimetre}</p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        {isExpired ? (
                          <Badge variant="secondary" className="bg-gray-200">
                            Expirée
                          </Badge>
                        ) : isExpiringSoon ? (
                          <Badge variant="destructive">
                            <Clock className="h-3 w-3 mr-1" />
                            {daysRemaining} jours
                          </Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            {daysRemaining} jours restants
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Progress
                        value={progress}
                        className={cn('h-2', isExpired && 'opacity-50')}
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>
                          {garantie.date_debut &&
                            format(new Date(garantie.date_debut), 'dd/MM/yyyy', { locale: fr })}
                        </span>
                        <span>
                          {garantie.date_fin &&
                            format(new Date(garantie.date_fin), 'dd/MM/yyyy', { locale: fr })}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}

              {garanties.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Shield className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <p>Aucune garantie enregistrée</p>
                  <p className="text-sm">Les garanties démarrent à la réception des travaux</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Contacts utiles */}
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-base">Contacts utiles</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-3">
                    <Building2 className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <div className="font-medium">Assurance Dommages-Ouvrage</div>
                      <div className="text-sm text-muted-foreground">
                        Votre interlocuteur principal en cas de sinistre décennal
                      </div>
                    </div>
                  </div>
                  <Button variant="outline" size="sm">
                    <Phone className="h-4 w-4 mr-1" />
                    Contacter
                  </Button>
                </div>
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-3">
                    <Building2 className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <div className="font-medium">Constructeur / MOE</div>
                      <div className="text-sm text-muted-foreground">
                        Pour les réserves et garantie parfait achèvement
                      </div>
                    </div>
                  </div>
                  <Button variant="outline" size="sm">
                    <Phone className="h-4 w-4 mr-1" />
                    Contacter
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sinistres" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Sinistres déclarés</CardTitle>
                  <CardDescription>
                    Historique des désordres signalés et leur traitement
                  </CardDescription>
                </div>
                <Button onClick={() => setShowClaimForm(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Déclarer un sinistre
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {desordres.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-500" />
                  <p className="font-medium">Aucun sinistre déclaré</p>
                  <p className="text-sm">
                    Déclarez un désordre dès que vous en constatez un
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {desordres.map((desordre) => {
                    const statutConfig = STATUT_CONFIG[desordre.statut];

                    return (
                      <div
                        key={desordre.id}
                        className="border rounded-lg p-4 hover:border-primary/50 transition-colors"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-start gap-3">
                            <Badge className={cn(statutConfig.bgColor, statutConfig.color)}>
                              {statutConfig.label}
                            </Badge>
                            <div>
                              <div className="font-medium">{desordre.nature}</div>
                              <div className="text-sm text-muted-foreground">
                                Réf: {desordre.numero}
                              </div>
                            </div>
                          </div>
                          {desordre.garantie_applicable && (
                            <Badge variant="outline">
                              {GARANTIE_CONFIG[desordre.garantie_applicable]?.label}
                            </Badge>
                          )}
                        </div>

                        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                          {desordre.description}
                        </p>

                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-4 text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              {format(new Date(desordre.date_decouverte), 'dd/MM/yyyy')}
                            </span>
                            {desordre.localisation && (
                              <span>{desordre.localisation}</span>
                            )}
                          </div>
                          <Button variant="ghost" size="sm">
                            Voir détails
                            <ExternalLink className="h-4 w-4 ml-1" />
                          </Button>
                        </div>

                        {desordre.assureur_notifie && (
                          <div className="mt-3 p-2 bg-blue-50 rounded text-sm text-blue-700">
                            Assurance notifiée - Réf: {desordre.assureur_reference || 'En attente'}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Formulaire de déclaration */}
      <WarrantyClaimForm
        open={showClaimForm}
        onOpenChange={setShowClaimForm}
        chantierId={chantierId}
        onSubmit={(data) => {
          createDesordre(data);
          setShowClaimForm(false);
        }}
        isSubmitting={isCreating}
      />
    </div>
  );
}
