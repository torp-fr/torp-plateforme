import { useState } from 'react';
import { EntrepriseUnifiee } from '@/services/entreprise/entreprise-unified.service';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { DataField } from '@/components/ui/DataField';
import {
  Building2,
  MapPin,
  Calendar,
  Users,
  Euro,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Award,
  ChevronDown,
  ChevronUp,
  Shield,
  Banknote,
} from 'lucide-react';

interface Props {
  entreprise: EntrepriseUnifiee;
  showFinances?: boolean;
  showLabels?: boolean;
  showDirigeants?: boolean;
  compact?: boolean;
}

export function EntrepriseCard({
  entreprise,
  showFinances = true,
  showLabels = true,
  showDirigeants = false,
  compact = false,
}: Props) {
  const [expanded, setExpanded] = useState(!compact);

  return (
    <Card className={`p-4 ${entreprise.estActif ? '' : 'border-orange-300 bg-orange-50'}`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          <div>
            <h3 className="font-semibold">
              {entreprise.raisonSociale || 'Entreprise'}
            </h3>
            {entreprise.nomCommercial && entreprise.nomCommercial !== entreprise.raisonSociale && (
              <p className="text-sm text-muted-foreground">{entreprise.nomCommercial}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Badge état */}
          {entreprise.estActif ? (
            <Badge variant="outline" className="text-green-600 border-green-200">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Active
            </Badge>
          ) : (
            <Badge variant="destructive">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Cessée
            </Badge>
          )}

          {/* Procédure collective */}
          {entreprise.aProcedureenCours && (
            <Badge variant="destructive">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Procédure
            </Badge>
          )}

          {/* Source */}
          <Badge variant="secondary" className="text-xs">
            {entreprise.source === 'combined' ? 'Sirene + Pappers' :
             entreprise.source === 'pappers' ? 'Pappers' : 'Sirene'}
          </Badge>
        </div>
      </div>

      {/* Alerte entreprise cessée */}
      {!entreprise.estActif && (
        <div className="mb-3 p-2 bg-orange-100 border border-orange-200 rounded text-sm text-orange-800">
          <AlertTriangle className="h-4 w-4 inline mr-1" />
          Attention : cette entreprise a cessé son activité
          {entreprise.dateCessation && ` le ${new Date(entreprise.dateCessation).toLocaleDateString('fr-FR')}`}
        </div>
      )}

      {/* Infos principales */}
      <div className="grid sm:grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <DataField label="SIRET" value={formatSiret(entreprise.siret)} />
        <DataField label="SIREN" value={formatSiren(entreprise.siren)} />
        <DataField label="Forme juridique" value={entreprise.formeJuridique} />
        <DataField label="Code NAF" value={entreprise.codeNAF} />
        {entreprise.libelleNAF && (
          <DataField label="Activité" value={entreprise.libelleNAF} className="col-span-2" />
        )}
      </div>

      {/* Bouton expand si compact */}
      {compact && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full mt-2"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? (
            <><ChevronUp className="h-4 w-4 mr-1" /> Moins de détails</>
          ) : (
            <><ChevronDown className="h-4 w-4 mr-1" /> Plus de détails</>
          )}
        </Button>
      )}

      {expanded && (
        <>
          <Separator className="my-3" />

          {/* Adresse */}
          <div className="flex items-start gap-2 text-sm mb-3">
            <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
            <div>
              {entreprise.adresse.ligne1 && <p>{entreprise.adresse.ligne1}</p>}
              {entreprise.adresse.ligne2 && <p>{entreprise.adresse.ligne2}</p>}
              <p>
                {entreprise.adresse.codePostal} {entreprise.adresse.ville}
              </p>
            </div>
          </div>

          {/* Dates et effectifs */}
          <div className="grid sm:grid-cols-2 gap-4 text-sm mb-3">
            {entreprise.dateCreationFormatee && (
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>
                  Créée le {entreprise.dateCreationFormatee}
                  {entreprise.ancienneteAnnees !== null && (
                    <span className="text-muted-foreground"> ({entreprise.ancienneteAnnees} ans)</span>
                  )}
                </span>
              </div>
            )}

            {entreprise.effectif && (
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span>{entreprise.effectif}</span>
              </div>
            )}

            {entreprise.capitalFormate && (
              <div className="flex items-center gap-2">
                <Banknote className="h-4 w-4 text-muted-foreground" />
                <span>Capital : {entreprise.capitalFormate}</span>
              </div>
            )}

            {entreprise.numeroTVA && (
              <DataField label="TVA Intra" value={entreprise.numeroTVA} />
            )}
          </div>

          {/* Finances (si enrichies) */}
          {showFinances && entreprise.dernieresFinances && (
            <>
              <Separator className="my-3" />
              <div className="space-y-2">
                <h4 className="font-medium flex items-center gap-2">
                  <Euro className="h-4 w-4" />
                  Données financières ({entreprise.dernieresFinances.annee})
                </h4>
                <div className="grid sm:grid-cols-2 gap-4 text-sm">
                  {entreprise.dernieresFinances.chiffreAffairesFormate && (
                    <div className="p-3 bg-muted rounded-lg">
                      <p className="text-xs text-muted-foreground">Chiffre d'affaires</p>
                      <p className="text-lg font-semibold">
                        {entreprise.dernieresFinances.chiffreAffairesFormate}
                      </p>
                    </div>
                  )}

                  {entreprise.dernieresFinances.resultatFormate && (
                    <div className="p-3 bg-muted rounded-lg">
                      <p className="text-xs text-muted-foreground">Résultat net</p>
                      <p className={`text-lg font-semibold flex items-center gap-1 ${
                        entreprise.dernieresFinances.resultat! >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {entreprise.dernieresFinances.resultat! >= 0 ? (
                          <TrendingUp className="h-4 w-4" />
                        ) : (
                          <TrendingDown className="h-4 w-4" />
                        )}
                        {entreprise.dernieresFinances.resultatFormate}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Scoring financier */}
          {entreprise.scoringFinancier && (
            <div className="mt-3 p-3 bg-blue-50 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Score financier Pappers</span>
                <div className="flex items-center gap-2">
                  <span className={`text-lg font-bold ${getScoreColor(entreprise.scoringFinancier.score)}`}>
                    {entreprise.scoringFinancier.score}/100
                  </span>
                  {entreprise.scoringFinancier.risque && (
                    <Badge variant={getRisqueBadgeVariant(entreprise.scoringFinancier.risque)}>
                      Risque {entreprise.scoringFinancier.risque}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Labels RGE / Qualité (important BTP) */}
          {showLabels && (entreprise.labelsRGE?.length || entreprise.labelsQualite?.length) && (
            <>
              <Separator className="my-3" />
              <div className="space-y-2">
                <h4 className="font-medium flex items-center gap-2">
                  <Award className="h-4 w-4" />
                  Certifications & Labels
                </h4>
                <div className="flex flex-wrap gap-2">
                  {entreprise.labelsRGE?.map((label, i) => (
                    <Badge key={`rge-${i}`} variant="outline" className="bg-green-50 text-green-700 border-green-200">
                      <Shield className="h-3 w-3 mr-1" />
                      {label.nom}
                      {label.date_fin_validite && (
                        <span className="ml-1 text-xs opacity-70">
                          (→ {new Date(label.date_fin_validite).toLocaleDateString('fr-FR')})
                        </span>
                      )}
                    </Badge>
                  ))}
                  {entreprise.labelsQualite?.map((label, i) => (
                    <Badge key={`qual-${i}`} variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                      <Award className="h-3 w-3 mr-1" />
                      {label.nom}
                    </Badge>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Dirigeants */}
          {showDirigeants && entreprise.dirigeants && entreprise.dirigeants.length > 0 && (
            <>
              <Separator className="my-3" />
              <div className="space-y-2">
                <h4 className="font-medium">Dirigeants</h4>
                <div className="space-y-1 text-sm">
                  {entreprise.dirigeants.map((d, i) => (
                    <div key={`row-${i}`} className="flex justify-between">
                      <span>{d.prenom} {d.nom}</span>
                      <span className="text-muted-foreground">{d.qualite}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Procédures collectives */}
          {entreprise.proceduresCollectives && entreprise.proceduresCollectives.length > 0 && (
            <>
              <Separator className="my-3" />
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <h4 className="font-medium text-red-800 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Procédures collectives
                </h4>
                <div className="mt-2 space-y-1 text-sm text-red-700">
                  {entreprise.proceduresCollectives.map((p, i) => (
                    <div key={`row-${i}`}>
                      {p.type} - Depuis le {new Date(p.date_debut).toLocaleDateString('fr-FR')}
                      {p.date_fin && ` (terminée le ${new Date(p.date_fin).toLocaleDateString('fr-FR')})`}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </>
      )}
    </Card>
  );
}

// Helpers
function formatSiret(siret: string): string {
  if (!siret) return '';
  const clean = siret.replace(/\s/g, '');
  return `${clean.slice(0, 3)} ${clean.slice(3, 6)} ${clean.slice(6, 9)} ${clean.slice(9)}`;
}

function formatSiren(siren: string): string {
  if (!siren) return '';
  const clean = siren.replace(/\s/g, '');
  return `${clean.slice(0, 3)} ${clean.slice(3, 6)} ${clean.slice(6, 9)}`;
}

function getScoreColor(score: number): string {
  if (score >= 70) return 'text-green-600';
  if (score >= 50) return 'text-yellow-600';
  return 'text-red-600';
}

function getRisqueBadgeVariant(risque: string): 'default' | 'destructive' | 'secondary' {
  switch (risque.toLowerCase()) {
    case 'faible': return 'default';
    case 'modéré': return 'secondary';
    case 'élevé': return 'destructive';
    default: return 'secondary';
  }
}

export default EntrepriseCard;
