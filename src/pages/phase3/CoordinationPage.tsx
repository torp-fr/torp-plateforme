/**
 * TORP Phase 3 - Page Coordination
 * Gestion de la coordination multi-entreprises
 */

import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Users,
  Calendar,
  MessageSquare,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  GitMerge,
  BookOpen,
  Lightbulb,
  Wrench,
  Send,
  Plus,
  Eye,
  ChevronRight,
  Zap,
  Construction,
} from 'lucide-react';

import { CoordinationService } from '@/services/phase3';
import type {
  CreneauIntervention,
  ConflitPlanning,
  CarnetLiaison,
  Conversation,
  MessageChat,
  InterfaceTechnique,
  Degradation,
  AlerteCoordination,
} from '@/types/phase3';

// ============================================
// HELPERS
// ============================================

const STATUT_CRENEAU: Record<string, { label: string; color: string }> = {
  disponible: { label: 'Disponible', color: 'bg-gray-500' },
  reserve: { label: 'Réservé', color: 'bg-blue-500' },
  confirme: { label: 'Confirmé', color: 'bg-green-500' },
  en_cours: { label: 'En cours', color: 'bg-purple-500' },
  termine: { label: 'Terminé', color: 'bg-gray-500' },
  conflit: { label: 'Conflit', color: 'bg-red-500' },
};

const IMPACT_CONFLIT: Record<string, { label: string; color: string }> = {
  faible: { label: 'Faible', color: 'text-green-600 bg-green-50' },
  moyen: { label: 'Moyen', color: 'text-yellow-600 bg-yellow-50' },
  fort: { label: 'Fort', color: 'text-orange-600 bg-orange-50' },
  bloquant: { label: 'Bloquant', color: 'text-red-600 bg-red-50' },
};

const TYPE_ENTREE_CARNET: Record<string, { label: string; icon: React.ElementType }> = {
  arrivee: { label: 'Arrivée', icon: Clock },
  depart: { label: 'Départ', icon: Clock },
  travaux_realises: { label: 'Travaux', icon: Wrench },
  probleme: { label: 'Problème', icon: AlertTriangle },
  demande: { label: 'Demande', icon: MessageSquare },
  information: { label: 'Information', icon: Lightbulb },
  incident: { label: 'Incident', icon: AlertTriangle },
  livraison: { label: 'Livraison', icon: Construction },
};

const GRAVITE_DEGRADATION: Record<string, { label: string; color: string }> = {
  mineure: { label: 'Mineure', color: 'text-yellow-600 bg-yellow-50' },
  importante: { label: 'Importante', color: 'text-orange-600 bg-orange-50' },
  grave: { label: 'Grave', color: 'text-red-600 bg-red-50' },
};

// ============================================
// COMPOSANT PRINCIPAL
// ============================================

export default function CoordinationPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const chantierId = projectId || 'chantier-1';

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('planning');

  // Données
  const [creneaux, setCreneaux] = useState<CreneauIntervention[]>([]);
  const [conflits, setConflits] = useState<ConflitPlanning[]>([]);
  const [carnetDuJour, setCarnetDuJour] = useState<CarnetLiaison | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationActive, setConversationActive] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<MessageChat[]>([]);
  const [interfaces, setInterfaces] = useState<InterfaceTechnique[]>([]);
  const [degradations, setDegradations] = useState<Degradation[]>([]);
  const [alertes, setAlertes] = useState<AlerteCoordination[]>([]);
  const [statistiques, setStatistiques] = useState<Awaited<ReturnType<typeof CoordinationService.getStatistiques>> | null>(null);

  // Chat
  const [newMessage, setNewMessage] = useState('');

  useEffect(() => {
    loadData();
  }, [chantierId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [
        creneauxData,
        conflitsData,
        carnetData,
        conversationsData,
        interfacesData,
        degradationsData,
        alertesData,
        statsData,
      ] = await Promise.all([
        CoordinationService.listCreneaux({ chantierId }),
        CoordinationService.listConflits({ chantierId }),
        CoordinationService.getCarnetDuJour(chantierId),
        CoordinationService.listConversations(chantierId),
        CoordinationService.listInterfaces({ chantierId }),
        CoordinationService.listDegradations({ chantierId }),
        CoordinationService.getAlertes(chantierId),
        CoordinationService.getStatistiques(chantierId),
      ]);

      setCreneaux(creneauxData);
      setConflits(conflitsData);
      setCarnetDuJour(carnetData);
      setConversations(conversationsData);
      setInterfaces(interfacesData);
      setDegradations(degradationsData);
      setAlertes(alertesData);
      setStatistiques(statsData);

      // Charger les messages de la première conversation
      if (conversationsData.length > 0) {
        setConversationActive(conversationsData[0]);
        const messagesData = await CoordinationService.listMessages(conversationsData[0].id);
        setMessages(messagesData);
      }
    } catch (error) {
      console.error('Erreur chargement données coordination:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectConversation = async (conv: Conversation) => {
    setConversationActive(conv);
    const messagesData = await CoordinationService.listMessages(conv.id);
    setMessages(messagesData);
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !conversationActive) return;

    await CoordinationService.envoyerMessage(conversationActive.id, {
      auteurId: 'user-1',
      auteurNom: 'Vous',
      auteurEntreprise: 'MOE',
      contenu: newMessage,
      type: 'texte',
    });

    setNewMessage('');
    // Recharger les messages
    const messagesData = await CoordinationService.listMessages(conversationActive.id);
    setMessages(messagesData);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6" />
            Coordination
          </h1>
          <p className="text-muted-foreground">
            Coordination multi-entreprises, planning et communication
          </p>
        </div>
      </div>

      {/* Alertes */}
      {alertes.filter(a => !a.lu && a.niveau === 'critical').length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Conflits critiques</AlertTitle>
          <AlertDescription>
            {alertes.filter(a => !a.lu && a.niveau === 'critical').length} conflit(s) bloquant(s) à résoudre
          </AlertDescription>
        </Alert>
      )}

      {/* Statistiques */}
      {statistiques && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Créneaux</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statistiques.creneaux.confirmes}</div>
              <p className="text-xs text-muted-foreground">
                sur {statistiques.creneaux.total} planifiés
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Conflits</CardTitle>
              <Zap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {statistiques.conflits.enAttente}
              </div>
              <p className="text-xs text-muted-foreground">
                {statistiques.conflits.resolus} résolus sur {statistiques.conflits.total}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Interfaces</CardTitle>
              <GitMerge className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statistiques.interfaces.definies}</div>
              <p className="text-xs text-muted-foreground">
                {statistiques.interfaces.enProbleme} en problème
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Dégradations</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {statistiques.degradations.enAttente}
              </div>
              <p className="text-xs text-muted-foreground">
                {statistiques.degradations.reparees} réparées
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Onglets */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="planning">Planning</TabsTrigger>
          <TabsTrigger value="conflits">Conflits</TabsTrigger>
          <TabsTrigger value="carnet">Carnet liaison</TabsTrigger>
          <TabsTrigger value="chat">Chat</TabsTrigger>
          <TabsTrigger value="interfaces">Interfaces</TabsTrigger>
        </TabsList>

        {/* Planning collaboratif */}
        <TabsContent value="planning" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Planning des interventions</CardTitle>
                  <CardDescription>
                    Créneaux réservés par les entreprises
                  </CardDescription>
                </div>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Nouveau créneau
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {creneaux.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Aucun créneau planifié
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Période</TableHead>
                      <TableHead>Entreprise</TableHead>
                      <TableHead>Lot</TableHead>
                      <TableHead>Zone</TableHead>
                      <TableHead>Effectif</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {creneaux.map(creneau => {
                      const statutInfo = STATUT_CRENEAU[creneau.statut];
                      return (
                        <TableRow key={creneau.id}>
                          <TableCell>
                            <div className="font-medium">
                              {new Date(creneau.dateDebut).toLocaleDateString('fr-FR')}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              au {new Date(creneau.dateFin).toLocaleDateString('fr-FR')}
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">{creneau.entrepriseNom}</TableCell>
                          <TableCell>{creneau.lotNom}</TableCell>
                          <TableCell>{creneau.zone}</TableCell>
                          <TableCell>{creneau.effectifPrevu || '-'}</TableCell>
                          <TableCell>
                            <Badge className={statutInfo?.color}>
                              {statutInfo?.label || creneau.statut}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {creneau.conflits.length > 0 && (
                                <Badge variant="destructive" className="text-xs">
                                  {creneau.conflits.length} conflit(s)
                                </Badge>
                              )}
                              <Button variant="ghost" size="sm">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Conflits */}
        <TabsContent value="conflits" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Conflits de planning</CardTitle>
              <CardDescription>
                Conflits détectés et suggestions de résolution IA
              </CardDescription>
            </CardHeader>
            <CardContent>
              {conflits.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-4" />
                  <p className="text-muted-foreground">Aucun conflit détecté</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {conflits.map(conflit => {
                    const impactInfo = IMPACT_CONFLIT[conflit.impact];
                    return (
                      <Card key={conflit.id} className="border-l-4 border-l-orange-500">
                        <CardContent className="pt-4">
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-4">
                              <div className="p-2 rounded-lg bg-orange-100">
                                <Zap className="h-5 w-5 text-orange-600" />
                              </div>
                              <div>
                                <div className="font-medium">{conflit.description}</div>
                                <div className="text-sm text-muted-foreground mt-1">
                                  Détecté le {new Date(conflit.dateDetection).toLocaleDateString('fr-FR')}
                                  {' • '}
                                  {conflit.detectePar === 'systeme' ? 'Détection automatique' : 'Signalé manuellement'}
                                </div>
                              </div>
                            </div>
                            <Badge className={impactInfo?.color}>
                              Impact {impactInfo?.label || conflit.impact}
                            </Badge>
                          </div>

                          {/* Suggestions IA */}
                          {conflit.suggestionsIA && conflit.suggestionsIA.length > 0 && (
                            <div className="mt-4 pt-4 border-t">
                              <h4 className="text-sm font-medium flex items-center gap-2 mb-2">
                                <Lightbulb className="h-4 w-4 text-yellow-500" />
                                Suggestions de résolution
                              </h4>
                              <div className="space-y-2">
                                {conflit.suggestionsIA.map(sug => (
                                  <div
                                    key={sug.id}
                                    className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm">{sug.description}</span>
                                      {sug.impactDelai > 0 && (
                                        <Badge variant="outline" className="text-xs">
                                          +{sug.impactDelai}j
                                        </Badge>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs text-muted-foreground">
                                        Pertinence: {sug.scorePertinence}%
                                      </span>
                                      <Button size="sm" variant="outline">
                                        Appliquer
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Carnet de liaison */}
        <TabsContent value="carnet" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5" />
                    Carnet de liaison - {carnetDuJour ? new Date(carnetDuJour.date).toLocaleDateString('fr-FR') : 'Aujourd\'hui'}
                  </CardTitle>
                  <CardDescription>
                    Journal quotidien des entreprises
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {carnetDuJour?.cloture ? (
                    <Badge>Clôturé</Badge>
                  ) : (
                    <Button variant="outline">Clôturer le jour</Button>
                  )}
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Nouvelle entrée
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {carnetDuJour && carnetDuJour.entrees.length > 0 ? (
                <div className="space-y-4">
                  {/* Résumé */}
                  {carnetDuJour.resume && (
                    <div className="p-4 rounded-lg bg-muted/50 mb-4">
                      <div className="grid grid-cols-4 gap-4 text-center">
                        <div>
                          <div className="text-2xl font-bold">{carnetDuJour.resume.entreprisesPresentes.length}</div>
                          <div className="text-xs text-muted-foreground">Entreprises</div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold">{carnetDuJour.resume.effectifTotal}</div>
                          <div className="text-xs text-muted-foreground">Personnes</div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-orange-600">{carnetDuJour.resume.problemesSignales}</div>
                          <div className="text-xs text-muted-foreground">Problèmes</div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-blue-600">{carnetDuJour.resume.demandesOuvertes}</div>
                          <div className="text-xs text-muted-foreground">Demandes</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Entrées */}
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-3">
                      {carnetDuJour.entrees.map(entree => {
                        const typeInfo = TYPE_ENTREE_CARNET[entree.type];
                        const EntreeIcon = typeInfo?.icon || MessageSquare;
                        return (
                          <div
                            key={entree.id}
                            className={`p-3 rounded-lg border ${entree.urgent ? 'border-red-300 bg-red-50' : ''}`}
                          >
                            <div className="flex items-start gap-3">
                              <div className="p-2 rounded-lg bg-primary/10">
                                <EntreeIcon className="h-4 w-4 text-primary" />
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{entree.entreprise}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {new Date(entree.dateHeure).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                  {entree.urgent && (
                                    <Badge variant="destructive" className="text-xs">Urgent</Badge>
                                  )}
                                </div>
                                <p className="text-sm mt-1">{entree.contenu}</p>

                                {/* Réponse */}
                                {entree.reponse && (
                                  <div className="mt-2 p-2 rounded bg-muted">
                                    <div className="text-xs text-muted-foreground">
                                      Réponse de {entree.reponse.par}
                                    </div>
                                    <p className="text-sm">{entree.reponse.contenu}</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Aucune entrée pour aujourd'hui
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Chat */}
        <TabsContent value="chat" className="space-y-4">
          <div className="grid grid-cols-3 gap-4 h-[500px]">
            {/* Liste des conversations */}
            <Card className="col-span-1">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Conversations</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[420px]">
                  {conversations.map(conv => (
                    <div
                      key={conv.id}
                      className={`p-3 cursor-pointer hover:bg-muted/50 border-b ${
                        conversationActive?.id === conv.id ? 'bg-muted' : ''
                      }`}
                      onClick={() => handleSelectConversation(conv)}
                    >
                      <div className="font-medium text-sm">{conv.nom}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {conv.dernierMessage || conv.description}
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs text-muted-foreground">
                          {conv.participants.length} participants
                        </span>
                        {conv.participants.some(p => p.messagesNonLus > 0) && (
                          <Badge variant="destructive" className="text-xs">
                            {conv.participants.reduce((sum, p) => sum + p.messagesNonLus, 0)}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Zone de chat */}
            <Card className="col-span-2 flex flex-col">
              <CardHeader className="pb-2 border-b">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm">{conversationActive?.nom || 'Sélectionnez une conversation'}</CardTitle>
                    <CardDescription className="text-xs">
                      {conversationActive?.description}
                    </CardDescription>
                  </div>
                  {conversationActive && (
                    <div className="flex -space-x-2">
                      {conversationActive.participants.slice(0, 4).map(p => (
                        <Avatar key={p.id} className="h-6 w-6 border-2 border-background">
                          <AvatarFallback className="text-xs">
                            {p.nom.split(' ').map(n => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                      ))}
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="flex-1 p-0 flex flex-col">
                {/* Messages */}
                <ScrollArea className="flex-1 p-4">
                  <div className="space-y-4">
                    {messages.map(msg => (
                      <div
                        key={msg.id}
                        className={`flex gap-3 ${
                          msg.auteurId === 'user-1' ? 'flex-row-reverse' : ''
                        }`}
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs">
                            {msg.auteurNom.split(' ').map(n => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <div className={`max-w-[70%] ${msg.auteurId === 'user-1' ? 'text-right' : ''}`}>
                          <div className="text-xs text-muted-foreground mb-1">
                            {msg.auteurNom} • {msg.auteurEntreprise}
                          </div>
                          <div
                            className={`p-2 rounded-lg ${
                              msg.auteurId === 'user-1'
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted'
                            }`}
                          >
                            <p className="text-sm">{msg.contenu}</p>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {new Date(msg.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>

                {/* Input message */}
                {conversationActive && (
                  <div className="p-4 border-t">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Votre message..."
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                      />
                      <Button onClick={handleSendMessage}>
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Interfaces techniques */}
        <TabsContent value="interfaces" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Interfaces techniques</CardTitle>
                  <CardDescription>
                    Points de jonction entre les lots
                  </CardDescription>
                </div>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Nouvelle interface
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {interfaces.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Aucune interface définie
                </div>
              ) : (
                <div className="space-y-4">
                  {interfaces.map(iface => (
                    <div
                      key={iface.id}
                      className={`p-4 rounded-lg border ${
                        iface.statut === 'probleme' ? 'border-red-300 bg-red-50' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <GitMerge className="h-5 w-5 text-primary" />
                          <div>
                            <div className="font-medium">
                              {iface.lot1.lotNom} ↔ {iface.lot2.lotNom}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {iface.description} • {iface.zone}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={iface.statut === 'valide' ? 'default' : 'outline'}>
                            {iface.statut.replace('_', ' ')}
                          </Badge>
                          <Button variant="ghost" size="sm">
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Validations */}
                      <div className="flex items-center gap-4 mt-3 pt-3 border-t">
                        <div className="flex items-center gap-2">
                          {iface.valideLot1 ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          ) : (
                            <Clock className="h-4 w-4 text-muted-foreground" />
                          )}
                          <span className="text-sm">{iface.lot1.entreprise}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {iface.valideLot2 ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          ) : (
                            <Clock className="h-4 w-4 text-muted-foreground" />
                          )}
                          <span className="text-sm">{iface.lot2.entreprise}</span>
                        </div>
                        <span className="text-xs text-muted-foreground ml-auto">
                          Requis avant le {new Date(iface.dateRequise).toLocaleDateString('fr-FR')}
                        </span>
                      </div>

                      {/* Problème */}
                      {iface.probleme && (
                        <div className="mt-3 p-2 rounded bg-red-100 text-red-800 text-sm">
                          <AlertTriangle className="h-4 w-4 inline mr-2" />
                          {iface.probleme.description}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Dégradations */}
          {degradations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-600">
                  <AlertTriangle className="h-5 w-5" />
                  Dégradations signalées
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {degradations.map(deg => {
                    const graviteInfo = GRAVITE_DEGRADATION[deg.gravite];
                    return (
                      <div key={deg.id} className="p-3 rounded-lg border border-red-200 bg-red-50">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium">{deg.description}</div>
                            <div className="text-sm text-muted-foreground">
                              {deg.zone} • Victime: {deg.entrepriseVictime}
                              {deg.entrepriseResponsable && ` • Responsable: ${deg.entrepriseResponsable}`}
                            </div>
                          </div>
                          <Badge className={graviteInfo?.color}>
                            {graviteInfo?.label || deg.gravite}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
