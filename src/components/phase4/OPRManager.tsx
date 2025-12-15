/**
 * OPRManager - Gestionnaire complet des OPR
 * Démarrage, participants, contrôles, réserves
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ClipboardCheck,
  Users,
  Calendar as CalendarIcon,
  FileText,
  Play,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Send,
  StopCircle,
  Eye,
} from 'lucide-react';
import { useOPR } from '@/hooks/phase4/useOPR';
import { OPRChecklist } from './OPRChecklist';
import { ReserveForm } from './ReserveForm';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { ParticipantRole } from '@/types/phase4.types';

interface OPRManagerProps {
  chantierId: string;
  onReceptionReady?: () => void;
}

const PARTICIPANT_ROLES: { value: ParticipantRole; label: string }[] = [
  { value: 'maitre_ouvrage', label: 'Maître d\'ouvrage' },
  { value: 'maitre_oeuvre', label: 'Maître d\'œuvre' },
  { value: 'entreprise', label: 'Entreprise' },
  { value: 'bureau_controle', label: 'Bureau de contrôle' },
  { value: 'coordonnateur_sps', label: 'Coordonnateur SPS' },
  { value: 'expert', label: 'Expert' },
  { value: 'assureur', label: 'Assureur' },
];

const LOTS = [
  'gros_oeuvre',
  'charpente',
  'couverture',
  'plomberie',
  'electricite',
  'chauffage',
  'menuiseries_ext',
  'menuiseries_int',
  'platrerie',
  'carrelage',
  'peinture',
];

export function OPRManager({ chantierId, onReceptionReady }: OPRManagerProps) {
  const {
    sessions,
    activeSession,
    checklists,
    isLoading,
    stats,
    receptionCheck,
    createSession,
    startSession,
    endSession,
    addParticipant,
    markParticipantPresent,
    sendConvocations,
    isCreating,
    isStarting,
    isEnding,
    isSendingConvocations,
  } = useOPR({ chantierId });

  const [showNewSession, setShowNewSession] = useState(false);
  const [showAddParticipant, setShowAddParticipant] = useState(false);
  const [newSessionDate, setNewSessionDate] = useState<Date>();
  const [newSessionTime, setNewSessionTime] = useState('09:00');
  const [newSessionLieu, setNewSessionLieu] = useState('');
  const [selectedLots, setSelectedLots] = useState<string[]>([]);
  const [newParticipant, setNewParticipant] = useState({
    nom: '',
    prenom: '',
    role: '' as ParticipantRole,
    entreprise: '',
    email: '',
    telephone: '',
  });

  const handleCreateSession = () => {
    if (!newSessionDate || !newSessionLieu || selectedLots.length === 0) return;

    createSession({
      dateOPR: newSessionDate.toISOString().split('T')[0],
      heureDebut: newSessionTime,
      lieu: newSessionLieu,
      lots: selectedLots,
      createdBy: '', // TODO: Get current user
    });

    setShowNewSession(false);
    setNewSessionDate(undefined);
    setNewSessionLieu('');
    setSelectedLots([]);
  };

  const handleAddParticipant = () => {
    if (!activeSession || !newParticipant.nom || !newParticipant.role) return;

    addParticipant({
      sessionId: activeSession.id,
      participant: {
        ...newParticipant,
        userId: undefined,
      },
    });

    setShowAddParticipant(false);
    setNewParticipant({
      nom: '',
      prenom: '',
      role: '' as ParticipantRole,
      entreprise: '',
      email: '',
      telephone: '',
    });
  };

  const handleSendConvocations = () => {
    if (!activeSession) return;
    sendConvocations({ sessionId: activeSession.id, mode: ['email'] });
  };

  const handleStart = () => {
    if (!activeSession) return;
    startSession(activeSession.id);
  };

  const handleEnd = () => {
    if (!activeSession) return;
    endSession(activeSession.id);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Opérations Préalables à Réception</h2>
          <p className="text-muted-foreground">
            Gérez les visites OPR et préparez la réception des travaux
          </p>
        </div>

        <Dialog open={showNewSession} onOpenChange={setShowNewSession}>
          <DialogTrigger asChild>
            <Button disabled={!!activeSession && activeSession.statut !== 'terminee'}>
              <Plus className="h-4 w-4 mr-2" />
              Planifier OPR
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Planifier une nouvelle OPR</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Date de l'OPR</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal',
                        !newSessionDate && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {newSessionDate ? (
                        format(newSessionDate, 'PPP', { locale: fr })
                      ) : (
                        'Sélectionner une date'
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={newSessionDate}
                      onSelect={setNewSessionDate}
                      locale={fr}
                      disabled={(date) => date < new Date()}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>Heure de début</Label>
                <Input
                  type="time"
                  value={newSessionTime}
                  onChange={(e) => setNewSessionTime(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Lieu / Adresse</Label>
                <Input
                  value={newSessionLieu}
                  onChange={(e) => setNewSessionLieu(e.target.value)}
                  placeholder="Adresse du chantier"
                />
              </div>

              <div className="space-y-2">
                <Label>Lots à contrôler</Label>
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                  {LOTS.map((lot) => (
                    <label
                      key={lot}
                      className="flex items-center gap-2 p-2 border rounded cursor-pointer hover:bg-muted"
                    >
                      <input
                        type="checkbox"
                        checked={selectedLots.includes(lot)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedLots([...selectedLots, lot]);
                          } else {
                            setSelectedLots(selectedLots.filter((l) => l !== lot));
                          }
                        }}
                      />
                      <span className="text-sm capitalize">{lot.replace('_', ' ')}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowNewSession(false)}>
                Annuler
              </Button>
              <Button
                onClick={handleCreateSession}
                disabled={!newSessionDate || !newSessionLieu || selectedLots.length === 0 || isCreating}
              >
                Créer la session
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Session active */}
      {activeSession && (
        <Card className="border-primary">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2">
                  {activeSession.statut === 'en_cours' ? (
                    <Play className="h-5 w-5 text-green-500" />
                  ) : (
                    <CalendarIcon className="h-5 w-5 text-primary" />
                  )}
                  OPR du {format(new Date(activeSession.dateOPR), 'dd MMMM yyyy', { locale: fr })}
                </CardTitle>
                <CardDescription>
                  {activeSession.lieu} - {activeSession.heureDebut}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  variant={
                    activeSession.statut === 'en_cours'
                      ? 'default'
                      : activeSession.statut === 'terminee'
                      ? 'secondary'
                      : 'outline'
                  }
                >
                  {activeSession.statut === 'planifiee' && 'Planifiée'}
                  {activeSession.statut === 'en_cours' && 'En cours'}
                  {activeSession.statut === 'terminee' && 'Terminée'}
                </Badge>

                {activeSession.statut === 'planifiee' && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSendConvocations}
                      disabled={isSendingConvocations || activeSession.convocationEnvoyee}
                    >
                      <Send className="h-4 w-4 mr-1" />
                      {activeSession.convocationEnvoyee ? 'Envoyées' : 'Convoquer'}
                    </Button>
                    <Button size="sm" onClick={handleStart} disabled={isStarting}>
                      <Play className="h-4 w-4 mr-1" />
                      Démarrer
                    </Button>
                  </>
                )}

                {activeSession.statut === 'en_cours' && (
                  <Button variant="destructive" size="sm" onClick={handleEnd} disabled={isEnding}>
                    <StopCircle className="h-4 w-4 mr-1" />
                    Terminer
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="checklist">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="checklist">
                  <ClipboardCheck className="h-4 w-4 mr-2" />
                  Contrôles
                </TabsTrigger>
                <TabsTrigger value="reserves">
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Réserves ({activeSession.reserves?.length || 0})
                </TabsTrigger>
                <TabsTrigger value="participants">
                  <Users className="h-4 w-4 mr-2" />
                  Participants
                </TabsTrigger>
                <TabsTrigger value="synthese">
                  <FileText className="h-4 w-4 mr-2" />
                  Synthèse
                </TabsTrigger>
              </TabsList>

              <TabsContent value="checklist" className="mt-4">
                <OPRChecklist
                  sessionId={activeSession.id}
                  controles={activeSession.controles || []}
                  disabled={activeSession.statut !== 'en_cours'}
                />
              </TabsContent>

              <TabsContent value="reserves" className="mt-4">
                <ReserveForm
                  chantierId={chantierId}
                  oprSessionId={activeSession.id}
                  reserves={activeSession.reserves || []}
                  disabled={activeSession.statut !== 'en_cours'}
                />
              </TabsContent>

              <TabsContent value="participants" className="mt-4">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="font-medium">Participants convoqués</h4>
                    <Dialog open={showAddParticipant} onOpenChange={setShowAddParticipant}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Plus className="h-4 w-4 mr-1" />
                          Ajouter
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Ajouter un participant</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>Prénom</Label>
                              <Input
                                value={newParticipant.prenom}
                                onChange={(e) =>
                                  setNewParticipant({ ...newParticipant, prenom: e.target.value })
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Nom *</Label>
                              <Input
                                value={newParticipant.nom}
                                onChange={(e) =>
                                  setNewParticipant({ ...newParticipant, nom: e.target.value })
                                }
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label>Rôle *</Label>
                            <Select
                              value={newParticipant.role}
                              onValueChange={(v) =>
                                setNewParticipant({
                                  ...newParticipant,
                                  role: v as ParticipantRole,
                                })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Sélectionner un rôle" />
                              </SelectTrigger>
                              <SelectContent>
                                {PARTICIPANT_ROLES.map((role) => (
                                  <SelectItem key={role.value} value={role.value}>
                                    {role.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Entreprise / Société</Label>
                            <Input
                              value={newParticipant.entreprise}
                              onChange={(e) =>
                                setNewParticipant({ ...newParticipant, entreprise: e.target.value })
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Email</Label>
                            <Input
                              type="email"
                              value={newParticipant.email}
                              onChange={(e) =>
                                setNewParticipant({ ...newParticipant, email: e.target.value })
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Téléphone</Label>
                            <Input
                              value={newParticipant.telephone}
                              onChange={(e) =>
                                setNewParticipant({ ...newParticipant, telephone: e.target.value })
                              }
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setShowAddParticipant(false)}>
                            Annuler
                          </Button>
                          <Button
                            onClick={handleAddParticipant}
                            disabled={!newParticipant.nom || !newParticipant.role}
                          >
                            Ajouter
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>

                  <div className="space-y-2">
                    {(activeSession.participants || []).map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              'w-3 h-3 rounded-full',
                              p.present ? 'bg-green-500' : 'bg-gray-300'
                            )}
                          />
                          <div>
                            <div className="font-medium">
                              {p.prenom} {p.nom}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {PARTICIPANT_ROLES.find((r) => r.value === p.role)?.label}
                              {p.entreprise && ` - ${p.entreprise}`}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {p.signature && (
                            <Badge variant="outline" className="text-green-600">
                              Signé
                            </Badge>
                          )}
                          {activeSession.statut === 'en_cours' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                markParticipantPresent({
                                  sessionId: activeSession.id,
                                  participantId: p.id,
                                  present: !p.present,
                                })
                              }
                            >
                              {p.present ? 'Présent' : 'Absent'}
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}

                    {(activeSession.participants || []).length === 0 && (
                      <p className="text-center text-muted-foreground py-4">
                        Aucun participant ajouté
                      </p>
                    )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="synthese" className="mt-4">
                <div className="space-y-6">
                  {/* Statistiques */}
                  {stats && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <Card>
                        <CardContent className="pt-6 text-center">
                          <div className="text-3xl font-bold">{stats.pourcentageAvancement}%</div>
                          <div className="text-sm text-muted-foreground">Avancement</div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-6 text-center">
                          <div className="text-3xl font-bold">{stats.controlesConformes}</div>
                          <div className="text-sm text-muted-foreground">Conformes</div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-6 text-center">
                          <div className="text-3xl font-bold text-orange-500">
                            {stats.totalReserves}
                          </div>
                          <div className="text-sm text-muted-foreground">Réserves</div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-6 text-center">
                          <div className="text-3xl font-bold text-red-500">
                            {stats.reservesGraves}
                          </div>
                          <div className="text-sm text-muted-foreground">Bloquantes</div>
                        </CardContent>
                      </Card>
                    </div>
                  )}

                  {/* Aptitude réception */}
                  {receptionCheck && (
                    <Card
                      className={cn(
                        'border-2',
                        receptionCheck.canProceed ? 'border-green-500' : 'border-red-500'
                      )}
                    >
                      <CardContent className="pt-6">
                        <div className="flex items-center gap-3 mb-4">
                          {receptionCheck.canProceed ? (
                            <CheckCircle2 className="h-8 w-8 text-green-500" />
                          ) : (
                            <AlertTriangle className="h-8 w-8 text-red-500" />
                          )}
                          <div>
                            <h4 className="font-semibold">
                              {receptionCheck.canProceed
                                ? 'Réception possible'
                                : 'Réception non possible'}
                            </h4>
                            <p className="text-sm text-muted-foreground">
                              {receptionCheck.canProceed
                                ? 'Les conditions sont réunies pour procéder à la réception'
                                : 'Des points bloquants empêchent la réception'}
                            </p>
                          </div>
                        </div>

                        {receptionCheck.blockers.length > 0 && (
                          <div className="space-y-2 mb-4">
                            <h5 className="font-medium text-red-600">Points bloquants :</h5>
                            <ul className="list-disc pl-5 text-sm">
                              {receptionCheck.blockers.map((b, i) => (
                                <li key={i}>{b}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {receptionCheck.warnings.length > 0 && (
                          <div className="space-y-2">
                            <h5 className="font-medium text-orange-600">Avertissements :</h5>
                            <ul className="list-disc pl-5 text-sm">
                              {receptionCheck.warnings.map((w, i) => (
                                <li key={i}>{w}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {receptionCheck.canProceed && activeSession.statut === 'terminee' && (
                          <Button className="mt-4 w-full" onClick={onReceptionReady}>
                            Procéder à la réception
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* Historique des sessions */}
      {sessions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Historique des OPR</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {sessions
                .filter((s) => s.id !== activeSession?.id)
                .map((session) => (
                  <div
                    key={session.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <CalendarIcon className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <div className="font-medium">
                          {format(new Date(session.dateOPR), 'dd MMMM yyyy', { locale: fr })}
                        </div>
                        <div className="text-sm text-muted-foreground">{session.lieu}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="secondary">{session.statut}</Badge>
                      <span className="text-sm text-muted-foreground">
                        {session.reserves?.length || 0} réserves
                      </span>
                      <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* État vide */}
      {!activeSession && sessions.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <ClipboardCheck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-2">Aucune OPR planifiée</h3>
              <p className="text-muted-foreground mb-4">
                Planifiez une visite OPR pour démarrer le processus de réception
              </p>
              <Button onClick={() => setShowNewSession(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Planifier une OPR
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
