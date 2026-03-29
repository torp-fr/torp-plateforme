/**
 * ProjetFormPage — 3-step project creation wizard
 * Step 1: BAN address search
 * Step 2: Project details (name, work type, budget, surface)
 * Step 3: Review + submit
 *
 * Inserts into `projects` table with correct column names:
 * nom_projet, type_travaux, adresse (jsonb), budget, surface, description, status
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MapPin, FileText, Hammer, AlertCircle, CheckCircle2, ChevronLeft, Loader2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useApp } from '@/context/AppContext';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

// ── BAN API types ─────────────────────────────────────────────────────────────

interface BANFeature {
  properties: {
    label: string;
    name: string;
    city: string;
    postcode: string;
    id: string;
    score: number;
  };
  geometry: {
    coordinates: [number, number]; // [lng, lat]
  };
}

// ── Work type options (consistent with Dashboard.tsx) ─────────────────────────

const WORK_TYPES = [
  { value: 'renovation',   label: 'Rénovation complète' },
  { value: 'plomberie',    label: 'Plomberie' },
  { value: 'electricite',  label: 'Électricité' },
  { value: 'peinture',     label: 'Peinture / finitions' },
  { value: 'cuisine',      label: 'Cuisine' },
  { value: 'salle-de-bain', label: 'Salle de bain' },
  { value: 'toiture',      label: 'Toiture / charpente' },
  { value: 'isolation',    label: 'Isolation thermique' },
  { value: 'extension',    label: 'Extension / agrandissement' },
  { value: 'construction', label: 'Construction neuve' },
  { value: 'autre',        label: 'Autre' },
];

// ── Component ─────────────────────────────────────────────────────────────────

export function ProjetFormPage() {
  const navigate = useNavigate();
  const { user } = useApp();
  const { toast } = useToast();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);

  // Step 1: BAN
  const [addressQuery, setAddressQuery]       = useState('');
  const [banSuggestions, setBanSuggestions]   = useState<BANFeature[]>([]);
  const [banLoading, setBanLoading]           = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<BANFeature | null>(null);

  // Step 2: Project details
  const [nomProjet,   setNomProjet]   = useState('');
  const [typeTravaux, setTypeTravaux] = useState('');
  const [budget,      setBudget]      = useState('');
  const [surface,     setSurface]     = useState('');
  const [description, setDescription] = useState('');

  // ── BAN search ──────────────────────────────────────────────────────────────

  async function searchBAN(query: string) {
    setAddressQuery(query);
    if (query.length < 3) { setBanSuggestions([]); return; }

    setBanLoading(true);
    try {
      const res = await fetch(
        `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(query)}&limit=5`
      );
      const data = await res.json();
      setBanSuggestions((data.features ?? []) as BANFeature[]);
    } catch {
      setBanSuggestions([]);
    } finally {
      setBanLoading(false);
    }
  }

  function selectAddress(feature: BANFeature) {
    setSelectedAddress(feature);
    setAddressQuery(feature.properties.label);
    setBanSuggestions([]);
  }

  // ── Submit ──────────────────────────────────────────────────────────────────

  async function handleCreate() {
    if (!user?.id || !selectedAddress || !nomProjet || !typeTravaux) return;

    setLoading(true);
    try {
      const { data: projet, error } = await supabase
        .from('projects')
        .insert({
          user_id:      user.id,
          nom_projet:   nomProjet.trim(),
          type_travaux: typeTravaux,
          adresse: {
            label:    selectedAddress.properties.label,
            city:     selectedAddress.properties.city,
            postcode: selectedAddress.properties.postcode,
            ban_id:   selectedAddress.properties.id,
            lat:      selectedAddress.geometry.coordinates[1],
            lng:      selectedAddress.geometry.coordinates[0],
          },
          budget:      budget  ? parseFloat(budget)  : null,
          surface:     surface ? parseFloat(surface) : null,
          description: description.trim() || null,
          status:      'draft',
        })
        .select('id')
        .single();

      if (error) throw error;

      toast({ title: 'Projet créé', description: `"${nomProjet}" a été créé avec succès.` });
      navigate(`/project/${projet.id}`);
    } catch (err) {
      console.error('[ProjetFormPage] create error:', err);
      toast({
        title: 'Erreur',
        description: 'Impossible de créer le projet. Réessayez.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  // ── Step indicators ─────────────────────────────────────────────────────────

  const STEPS = [
    { n: 1 as const, label: 'Adresse' },
    { n: 2 as const, label: 'Détails' },
    { n: 3 as const, label: 'Validation' },
  ];

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/projects')}>
          <ChevronLeft className="h-4 w-4 mr-1" />
          Retour
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Nouveau projet</h1>
          <p className="text-muted-foreground text-sm">Renseignez les informations de votre projet BTP</p>
        </div>
      </div>

      {/* Step progress */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s.n} className="flex items-center gap-2">
            <div className={`flex items-center gap-1.5 text-sm font-medium ${
              step === s.n ? 'text-primary' : step > s.n ? 'text-muted-foreground' : 'text-muted-foreground/50'
            }`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                step > s.n
                  ? 'bg-primary text-primary-foreground'
                  : step === s.n
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
              }`}>
                {step > s.n ? <CheckCircle2 className="h-3.5 w-3.5" /> : s.n}
              </div>
              <span className="hidden sm:inline">{s.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`h-px flex-1 min-w-[24px] ${step > s.n ? 'bg-primary' : 'bg-muted'}`} />
            )}
          </div>
        ))}
      </div>

      {/* ── Step 1: Address ── */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              Adresse du chantier
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Rechercher l'adresse (Base Adresse Nationale)</Label>
              <div className="relative">
                <Input
                  value={addressQuery}
                  onChange={(e) => searchBAN(e.target.value)}
                  placeholder="Ex: 42 rue de la Paix, Paris"
                  autoComplete="off"
                />
                {banLoading && (
                  <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </div>

              {/* BAN suggestions dropdown */}
              {banSuggestions.length > 0 && (
                <div className="border rounded-lg overflow-hidden shadow-sm">
                  {banSuggestions.map((feat) => (
                    <button
                      key={feat.properties.id}
                      type="button"
                      className="w-full text-left p-3 hover:bg-muted transition-colors border-b last:border-b-0 flex items-center justify-between group"
                      onClick={() => selectAddress(feat)}
                    >
                      <div>
                        <p className="font-medium text-sm">{feat.properties.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {feat.properties.postcode} {feat.properties.city}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-xs opacity-0 group-hover:opacity-100">
                        Sélectionner
                      </Badge>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Selected address confirmation */}
            {selectedAddress && (
              <div className="flex items-start gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
                <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0 text-green-600" />
                <div>
                  <p className="font-medium">{selectedAddress.properties.label}</p>
                  <p className="text-xs text-green-700">
                    {selectedAddress.properties.postcode} {selectedAddress.properties.city}
                    &ensp;·&ensp;
                    lat {selectedAddress.geometry.coordinates[1].toFixed(4)},
                    lng {selectedAddress.geometry.coordinates[0].toFixed(4)}
                  </p>
                </div>
              </div>
            )}

            <Button
              className="w-full"
              disabled={!selectedAddress}
              onClick={() => setStep(2)}
            >
              Continuer
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Step 2: Details ── */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Hammer className="h-5 w-5 text-primary" />
              Détails du projet
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nom-projet">Nom du projet *</Label>
              <Input
                id="nom-projet"
                value={nomProjet}
                onChange={(e) => setNomProjet(e.target.value)}
                placeholder="Ex: Rénovation salle de bain — Appartement Lyon"
              />
            </div>

            <div className="space-y-2">
              <Label>Type de travaux *</Label>
              <Select value={typeTravaux} onValueChange={setTypeTravaux}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner le type" />
                </SelectTrigger>
                <SelectContent>
                  {WORK_TYPES.map((wt) => (
                    <SelectItem key={wt.value} value={wt.value}>
                      {wt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="budget">Budget estimé (€)</Label>
                <Input
                  id="budget"
                  type="number"
                  min="0"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  placeholder="Ex: 15000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="surface">Surface (m²)</Label>
                <Input
                  id="surface"
                  type="number"
                  min="0"
                  value={surface}
                  onChange={(e) => setSurface(e.target.value)}
                  placeholder="Ex: 45"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (optionnel)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Décrivez vos besoins, contraintes ou objectifs..."
                rows={3}
                className="resize-none"
              />
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                Retour
              </Button>
              <Button
                className="flex-1"
                disabled={!nomProjet.trim() || !typeTravaux}
                onClick={() => setStep(3)}
              >
                Vérifier
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Step 3: Review ── */}
      {step === 3 && selectedAddress && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Récapitulatif
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3 p-4 bg-muted/50 rounded-lg border text-sm">
              <Row label="Adresse" value={selectedAddress.properties.label} />
              <Row label="Ville" value={`${selectedAddress.properties.postcode} ${selectedAddress.properties.city}`} />
              <Row label="Nom du projet" value={nomProjet} highlight />
              <Row label="Type de travaux" value={WORK_TYPES.find(w => w.value === typeTravaux)?.label ?? typeTravaux} />
              {budget  && <Row label="Budget" value={`${parseFloat(budget).toLocaleString('fr-FR')} €`} />}
              {surface && <Row label="Surface" value={`${surface} m²`} />}
              {description && <Row label="Description" value={description} />}
            </div>

            {!user?.id && (
              <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded text-sm text-destructive">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                Vous devez être connecté pour créer un projet.
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep(2)} disabled={loading}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                Modifier
              </Button>
              <Button
                className="flex-1"
                disabled={loading || !user?.id}
                onClick={handleCreate}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Création...
                  </>
                ) : (
                  'Créer le projet'
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Helper ────────────────────────────────────────────────────────────────────

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className={`text-right ${highlight ? 'font-semibold' : ''}`}>{value}</span>
    </div>
  );
}

export default ProjetFormPage;
