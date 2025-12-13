/**
 * Carte entreprise Phase 1
 * Affiche les informations d'une entreprise recommandée
 * Adapté selon le profil utilisateur (B2C, B2B, B2G)
 */

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Star, Award, Shield, CheckCircle2, MapPin, Phone, Mail,
  Send, Eye, Building2, Users, Calendar, Euro, AlertTriangle,
  ExternalLink
} from 'lucide-react';
import type { RecommandationEntreprise, Entreprise, ScoreEntreprise } from '@/types/phase1/entreprise.types';
import type { UserType } from '@/context/AppContext';

interface EntrepriseCardProps {
  recommandation: RecommandationEntreprise;
  userType: UserType;
  onConsult?: (entreprise: Entreprise) => void;
  onViewDetails?: (entreprise: Entreprise) => void;
  isSelected?: boolean;
  showDetails?: boolean;
}

// Labels selon le profil
const getLabels = (userType: UserType) => ({
  consultButton: userType === 'B2C' ? 'Demander un devis' : 'Consulter',
  viewButton: userType === 'B2C' ? 'Voir la fiche' : 'Voir le profil',
  scoreLabel: userType === 'B2C' ? 'Note TORP' : 'Score TORP',
  qualificationsLabel: userType === 'B2C' ? 'Certifications' : 'Qualifications',
  experienceLabel: userType === 'B2C' ? 'Expérience' : 'Références',
  capacityLabel: userType === 'B2B' || userType === 'B2G' ? 'Capacité' : null,
});

export function EntrepriseCard({
  recommandation,
  userType,
  onConsult,
  onViewDetails,
  isSelected = false,
  showDetails = false,
}: EntrepriseCardProps) {
  const { entreprise, score, priorite, pointsForts, pointsAttention, lots } = recommandation;
  const labels = getLabels(userType);

  // Couleur du score
  const getScoreColor = (value: number) => {
    if (value >= 80) return 'text-green-600 bg-green-100';
    if (value >= 60) return 'text-blue-600 bg-blue-100';
    if (value >= 40) return 'text-orange-600 bg-orange-100';
    return 'text-red-600 bg-red-100';
  };

  // Badge de priorité
  const getPriorityBadge = () => {
    switch (priorite) {
      case 'haute':
        return <Badge className="bg-green-500">Recommandé</Badge>;
      case 'moyenne':
        return <Badge variant="secondary">Compatible</Badge>;
      case 'basse':
        return <Badge variant="outline">À considérer</Badge>;
      default:
        return null;
    }
  };

  return (
    <Card className={`transition-all hover:shadow-md ${isSelected ? 'ring-2 ring-primary' : ''}`}>
      <CardContent className="p-4">
        {/* En-tête */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              {getPriorityBadge()}
            </div>
            <h3 className="font-semibold text-lg">
              {entreprise.identite.raisonSociale}
            </h3>
            {entreprise.identite.enseigne && entreprise.identite.enseigne !== entreprise.identite.raisonSociale && (
              <p className="text-sm text-muted-foreground">
                {entreprise.identite.enseigne}
              </p>
            )}
          </div>

          {/* Score global */}
          <div className={`flex items-center gap-1 px-3 py-2 rounded-lg ${getScoreColor(score.global)}`}>
            <Star className="w-5 h-5 fill-current" />
            <span className="font-bold text-xl">{score.global}</span>
          </div>
        </div>

        {/* Localisation */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
          <MapPin className="w-4 h-4" />
          <span>
            {entreprise.identite.adresse?.ville}
            {entreprise.identite.adresse?.codePostal && ` (${entreprise.identite.adresse.codePostal})`}
          </span>
          {score.details?.proximite !== undefined && (
            <span className="text-xs bg-muted px-2 py-0.5 rounded">
              ~{Math.round(score.details.proximite * 100)}% proximité
            </span>
          )}
        </div>

        {/* Qualifications */}
        <div className="flex flex-wrap gap-2 mb-3">
          {entreprise.qualifications?.rge?.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              <Award className="w-3 h-3 mr-1 text-green-600" />
              RGE {entreprise.qualifications.rge.length > 1 && `(${entreprise.qualifications.rge.length})`}
            </Badge>
          )}
          {entreprise.qualifications?.qualibat?.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              <Shield className="w-3 h-3 mr-1 text-blue-600" />
              Qualibat
            </Badge>
          )}
          {entreprise.assurances?.decennale?.valide && (
            <Badge variant="outline" className="text-xs">
              <CheckCircle2 className="w-3 h-3 mr-1 text-green-500" />
              Décennale
            </Badge>
          )}
          {entreprise.assurances?.rcPro?.valide && (
            <Badge variant="outline" className="text-xs">
              RC Pro ✓
            </Badge>
          )}
        </div>

        {/* Points forts */}
        {pointsForts.length > 0 && (
          <div className="mb-3">
            {pointsForts.slice(0, showDetails ? 4 : 2).map((point, i) => (
              <div key={i} className="flex items-start gap-2 text-sm mb-1">
                <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                <span>{point}</span>
              </div>
            ))}
          </div>
        )}

        {/* Points d'attention (mode détaillé ou B2B/B2G) */}
        {(showDetails || userType !== 'B2C') && pointsAttention.length > 0 && (
          <div className="mb-3">
            {pointsAttention.slice(0, 2).map((point, i) => (
              <div key={i} className="flex items-start gap-2 text-sm mb-1 text-orange-600">
                <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{point}</span>
              </div>
            ))}
          </div>
        )}

        {/* Scores détaillés (mode B2B/B2G ou détaillé) */}
        {(showDetails || (userType !== 'B2C' && score.details)) && (
          <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
            {score.details?.rge !== undefined && (
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-muted-foreground">RGE</span>
                  <span>{Math.round(score.details.rge * 100)}%</span>
                </div>
                <Progress value={score.details.rge * 100} className="h-1" />
              </div>
            )}
            {score.details?.qualibat !== undefined && (
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-muted-foreground">Qualibat</span>
                  <span>{Math.round(score.details.qualibat * 100)}%</span>
                </div>
                <Progress value={score.details.qualibat * 100} className="h-1" />
              </div>
            )}
            {score.details?.references !== undefined && (
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-muted-foreground">Références</span>
                  <span>{Math.round(score.details.references * 100)}%</span>
                </div>
                <Progress value={score.details.references * 100} className="h-1" />
              </div>
            )}
            {score.details?.avis !== undefined && (
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-muted-foreground">Avis clients</span>
                  <span>{Math.round(score.details.avis * 100)}%</span>
                </div>
                <Progress value={score.details.avis * 100} className="h-1" />
              </div>
            )}
          </div>
        )}

        {/* Capacités (B2B/B2G seulement) */}
        {(userType === 'B2B' || userType === 'B2G') && entreprise.capacites && (
          <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3 p-2 bg-muted/50 rounded">
            {entreprise.capacites.effectif && (
              <div className="flex items-center gap-1">
                <Users className="w-3 h-3" />
                {entreprise.capacites.effectif} pers.
              </div>
            )}
            {entreprise.capacites.chiffreAffaires && (
              <div className="flex items-center gap-1">
                <Euro className="w-3 h-3" />
                {(entreprise.capacites.chiffreAffaires / 1000000).toFixed(1)}M€
              </div>
            )}
            {entreprise.capacites.capaciteMarcheMax && (
              <div className="flex items-center gap-1">
                <Building2 className="w-3 h-3" />
                Max {(entreprise.capacites.capaciteMarcheMax / 1000).toFixed(0)}k€
              </div>
            )}
          </div>
        )}

        {/* Lots concernés */}
        {lots && lots.length > 0 && (
          <div className="flex items-center gap-2 text-sm mb-3">
            <span className="text-muted-foreground">Lots:</span>
            <div className="flex flex-wrap gap-1">
              {lots.slice(0, 3).map((lot, i) => (
                <Badge key={i} variant="outline" className="text-xs">
                  {lot}
                </Badge>
              ))}
              {lots.length > 3 && (
                <Badge variant="outline" className="text-xs">
                  +{lots.length - 3}
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-3 border-t">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onViewDetails?.(entreprise)}
          >
            <Eye className="w-4 h-4 mr-1" />
            {labels.viewButton}
          </Button>
          <Button
            size="sm"
            onClick={() => onConsult?.(entreprise)}
          >
            <Send className="w-4 h-4 mr-1" />
            {labels.consultButton}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default EntrepriseCard;
