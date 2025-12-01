import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building2, Shield, Award, AlertCircle, CheckCircle, ExternalLink, Phone, MapPin, Calendar, Users, TrendingUp, Briefcase } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { pappersService, type EnrichedEntrepriseData } from '@/services/api/pappers.service';

interface EntrepriseInfo {
  nom?: string;
  siret?: string;
  codeNaf?: string;
  adresse?: string;
  telephone?: string;
  age?: number;
  chiffreAffaires?: number;
  certifications?: string[];
  assurances?: {
    decennale?: boolean;
    rcPro?: boolean;
    validite?: string;
  };
  reputation?: number;
  litiges?: number;
}

interface CarteEntrepriseProps {
  entreprise?: EntrepriseInfo;
  scoreEntreprise?: {
    fiabilite?: number;
    santeFinnaciere?: number;
    anciennete?: number;
    assurances?: number;
    certifications?: number;
    reputation?: number;
    risques?: string[];
    benefices?: string[];
  };
}

export function CarteEntreprise({ entreprise, scoreEntreprise }: CarteEntrepriseProps) {
  const [pappersData, setPappersData] = useState<EnrichedEntrepriseData | null>(null);
  const [loadingPappers, setLoadingPappers] = useState(false);

  // Charger les données Pappers si SIRET disponible
  useEffect(() => {
    const loadPappersData = async () => {
      if (!entreprise?.siret || !pappersService.isConfigured()) {
        return;
      }

      setLoadingPappers(true);
      try {
        const data = await pappersService.getEntrepriseBySiret(entreprise.siret);
        setPappersData(data);
      } catch (error) {
        console.error('[CarteEntreprise] Error loading Pappers data:', error);
      } finally {
        setLoadingPappers(false);
      }
    };

    loadPappersData();
  }, [entreprise?.siret]);

  if (!entreprise && !scoreEntreprise) {
    return null;
  }

  const getScoreColor = (score: number | undefined) => {
    if (!score) return 'text-muted-foreground';
    if (score >= 80) return 'text-success';
    if (score >= 60) return 'text-warning';
    return 'text-destructive';
  };

  const getScoreBadgeClass = (score: number | undefined): string => {
    if (!score) return 'bg-muted text-muted-foreground';
    if (score >= 80) return 'bg-success/10 text-success border-success/30';
    if (score >= 60) return 'bg-warning/10 text-warning border-warning/30';
    return 'bg-destructive/10 text-destructive border-destructive/30';
  };

  const formatCurrency = (value: number | null | undefined) => {
    if (!value) return 'N/A';
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 }).format(value);
  };

  const formatDate = (date: string | null | undefined) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  return (
    <Card className="border-primary/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="w-5 h-5 text-primary" />
          Informations Entreprise
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Informations de base */}
        <div className="space-y-3">
          {entreprise?.nom && (
            <div>
              <h3 className="text-xl font-bold text-foreground mb-2">{entreprise.nom}</h3>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-3">
            {entreprise?.siret && (
              <div className="flex items-start gap-2">
                <div className="text-muted-foreground text-sm mt-0.5">SIRET:</div>
                <div className="flex items-center gap-2">
                  <code className="text-sm font-mono bg-muted px-2 py-1 rounded">{entreprise.siret}</code>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => window.open(`https://www.infogreffe.fr/entreprise-societe/${entreprise.siret}`, '_blank')}
                  >
                    <ExternalLink className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            )}

            {entreprise?.codeNaf && (
              <div className="flex items-start gap-2">
                <div className="text-muted-foreground text-sm mt-0.5">Code NAF:</div>
                <code className="text-sm font-mono bg-muted px-2 py-1 rounded">{entreprise.codeNaf}</code>
              </div>
            )}
          </div>

          {entreprise?.adresse && (
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div className="text-sm text-foreground">{entreprise.adresse}</div>
            </div>
          )}

          {entreprise?.telephone && (
            <div className="flex items-start gap-2">
              <Phone className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div className="text-sm text-foreground">{entreprise.telephone}</div>
            </div>
          )}

          {entreprise?.age !== undefined && (
            <div className="flex items-start gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div className="text-sm text-foreground">
                {entreprise.age} {entreprise.age > 1 ? 'ans' : 'an'} d'expérience
              </div>
            </div>
          )}
        </div>

        {/* Scores détaillés */}
        {scoreEntreprise && (
          <div className="space-y-3 pt-4 border-t">
            <h4 className="font-semibold text-foreground flex items-center gap-2">
              <Award className="w-4 h-4" />
              Évaluation détaillée
            </h4>

            <div className="grid gap-2">
              {scoreEntreprise.fiabilite !== undefined && (
                <div className="flex justify-between items-center p-2 bg-muted/30 rounded-lg">
                  <span className="text-sm text-muted-foreground">Fiabilité</span>
                  <Badge variant="outline" className={getScoreBadgeClass(scoreEntreprise.fiabilite)}>
                    {scoreEntreprise.fiabilite}/100
                  </Badge>
                </div>
              )}

              {scoreEntreprise.santeFinnaciere !== undefined && (
                <div className="flex justify-between items-center p-2 bg-muted/30 rounded-lg">
                  <span className="text-sm text-muted-foreground">Santé financière</span>
                  <Badge variant="outline" className={getScoreBadgeClass(scoreEntreprise.santeFinnaciere)}>
                    {scoreEntreprise.santeFinnaciere}/100
                  </Badge>
                </div>
              )}

              {scoreEntreprise.reputation !== undefined && (
                <div className="flex justify-between items-center p-2 bg-muted/30 rounded-lg">
                  <span className="text-sm text-muted-foreground">Réputation</span>
                  <Badge variant="outline" className={getScoreBadgeClass(scoreEntreprise.reputation)}>
                    {scoreEntreprise.reputation}/100
                  </Badge>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Assurances */}
        {entreprise?.assurances && (
          <div className="space-y-3 pt-4 border-t">
            <h4 className="font-semibold text-foreground flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Assurances
            </h4>

            <div className="space-y-2">
              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <span className="text-sm text-foreground">Décennale</span>
                {entreprise.assurances.decennale ? (
                  <Badge variant="default" className="bg-success text-success-foreground">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Valide
                  </Badge>
                ) : (
                  <Badge variant="destructive">
                    <AlertCircle className="w-3 h-3 mr-1" />
                    Non renseignée
                  </Badge>
                )}
              </div>

              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <span className="text-sm text-foreground">RC Pro</span>
                {entreprise.assurances.rcPro ? (
                  <Badge variant="default" className="bg-success text-success-foreground">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Valide
                  </Badge>
                ) : (
                  <Badge variant="destructive">
                    <AlertCircle className="w-3 h-3 mr-1" />
                    Non renseignée
                  </Badge>
                )}
              </div>

              {entreprise.assurances.validite && (
                <div className="text-xs text-muted-foreground mt-2">
                  Validité: {entreprise.assurances.validite}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Certifications */}
        {entreprise?.certifications && entreprise.certifications.length > 0 && (
          <div className="space-y-3 pt-4 border-t">
            <h4 className="font-semibold text-foreground flex items-center gap-2">
              <Award className="w-4 h-4" />
              Certifications
            </h4>

            <div className="flex flex-wrap gap-2">
              {entreprise.certifications.map((cert, index) => (
                <Badge key={index} variant="secondary" className="bg-primary/10 text-primary">
                  {cert}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Bénéfices */}
        {scoreEntreprise?.benefices && scoreEntreprise.benefices.length > 0 && (
          <div className="space-y-2 pt-4 border-t">
            <h4 className="font-semibold text-success flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Points forts
            </h4>
            <ul className="space-y-1">
              {scoreEntreprise.benefices.map((benefice, index) => (
                <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                  <div className="w-1.5 h-1.5 bg-success rounded-full mt-1.5 flex-shrink-0"></div>
                  <span>{benefice}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Risques */}
        {scoreEntreprise?.risques && scoreEntreprise.risques.length > 0 && (
          <div className="space-y-2 pt-4 border-t">
            <h4 className="font-semibold text-warning flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Points de vigilance
            </h4>
            <ul className="space-y-1">
              {scoreEntreprise.risques.map((risque, index) => (
                <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                  <div className="w-1.5 h-1.5 bg-warning rounded-full mt-1.5 flex-shrink-0"></div>
                  <span>{risque}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Données enrichies Pappers */}
        {pappersData && (
          <>
            {/* Informations légales détaillées */}
            <div className="space-y-3 pt-4 border-t">
              <h4 className="font-semibold text-foreground flex items-center gap-2">
                <Briefcase className="w-4 h-4" />
                Informations légales
              </h4>

              <div className="grid md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Forme juridique</p>
                  <p className="text-sm font-medium">{pappersData.formeJuridique}</p>
                </div>

                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Capital social</p>
                  <p className="text-sm font-medium">{formatCurrency(pappersData.capital)}</p>
                </div>

                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Date de création</p>
                  <p className="text-sm font-medium">{formatDate(pappersData.dateCreation)}</p>
                </div>

                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Immatriculée le</p>
                  <p className="text-sm font-medium">{formatDate(pappersData.dateImmatriculation)}</p>
                </div>

                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Secteur d'activité</p>
                  <p className="text-sm font-medium">{pappersData.libelleNAF}</p>
                </div>

                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Statut</p>
                  <Badge variant={pappersData.etatAdministratif === 'Actif' ? 'default' : 'destructive'} className="text-xs">
                    {pappersData.etatAdministratif}
                  </Badge>
                </div>
              </div>

              {pappersData.adresse.ligne1 && (
                <div className="space-y-1 pt-2">
                  <p className="text-xs text-muted-foreground">Adresse du siège social</p>
                  <p className="text-sm font-medium">
                    {pappersData.adresse.ligne1}<br />
                    {pappersData.adresse.codePostal} {pappersData.adresse.ville}
                  </p>
                </div>
              )}
            </div>

            {/* Indicateurs financiers */}
            {(pappersData.chiffreAffaires || pappersData.resultat || pappersData.effectif) && (
              <div className="space-y-3 pt-4 border-t">
                <h4 className="font-semibold text-foreground flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  Indicateurs financiers
                </h4>

                <div className="grid md:grid-cols-3 gap-3">
                  {pappersData.chiffreAffaires !== null && (
                    <div className="p-3 bg-muted/30 rounded-lg">
                      <p className="text-xs text-muted-foreground mb-1">Chiffre d'affaires</p>
                      <p className="text-lg font-bold text-foreground">{formatCurrency(pappersData.chiffreAffaires)}</p>
                    </div>
                  )}

                  {pappersData.resultat !== null && (
                    <div className="p-3 bg-muted/30 rounded-lg">
                      <p className="text-xs text-muted-foreground mb-1">Résultat</p>
                      <p className={`text-lg font-bold ${pappersData.resultat >= 0 ? 'text-success' : 'text-destructive'}`}>
                        {formatCurrency(pappersData.resultat)}
                      </p>
                    </div>
                  )}

                  {pappersData.effectif !== null && (
                    <div className="p-3 bg-muted/30 rounded-lg">
                      <p className="text-xs text-muted-foreground mb-1">Effectif</p>
                      <p className="text-lg font-bold text-foreground flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        {pappersData.effectif}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Dirigeants */}
            {pappersData.dirigeants && pappersData.dirigeants.length > 0 && (
              <div className="space-y-3 pt-4 border-t">
                <h4 className="font-semibold text-foreground flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Direction
                </h4>

                <div className="space-y-2">
                  {pappersData.dirigeants.slice(0, 3).map((dirigeant, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-muted/30 rounded-lg">
                      <span className="text-sm font-medium">
                        {dirigeant.prenom} {dirigeant.nom}
                      </span>
                      <Badge variant="secondary" className="text-xs">
                        {dirigeant.fonction}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Certifications RGE */}
            {pappersData.certificationsRGE && pappersData.certificationsRGE.length > 0 && (
              <div className="space-y-3 pt-4 border-t">
                <h4 className="font-semibold text-foreground flex items-center gap-2">
                  <Award className="w-4 h-4 text-success" />
                  Certifications RGE
                </h4>

                <div className="space-y-2">
                  {pappersData.certificationsRGE.map((cert, index) => (
                    <div key={index} className="p-3 bg-success/10 border border-success/30 rounded-lg">
                      <div className="flex items-start justify-between mb-1">
                        <p className="text-sm font-semibold text-success">{cert.nom}</p>
                        <Badge variant="outline" className="bg-success/20 text-success border-success/30 text-xs">
                          {cert.domaine}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        N° {cert.numero} • {cert.validite}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {loadingPappers && (
          <div className="pt-4 border-t">
            <p className="text-sm text-muted-foreground text-center">
              Chargement des informations détaillées...
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
