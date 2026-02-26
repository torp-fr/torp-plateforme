import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Shield,
  CheckCircle,
  Clock,
  Calendar,
  Phone,
  AlertTriangle,
  Link as LinkIcon,
  Mail,
  Bell,
  FileText
} from "lucide-react";

interface PaymentStage {
  name: string;
  amount: number;
  status: 'completed' | 'pending' | 'upcoming';
  date: string;
  description?: string;
}

interface PaymentProject {
  id: string;
  projectName: string;
  company: string;
  totalAmount: number;
  paidAmount: number;
  stages: PaymentStage[];
  createdDate: string;
  status: 'active' | 'completed' | 'suspended';
}

interface PaymentTrackingProps {
  userType: 'B2C' | 'B2B';
  projects?: PaymentProject[];
}

export default function PaymentTrackingComponent({ userType, projects = [] }: PaymentTrackingProps) {
  const [selectedProject, setSelectedProject] = useState<string | null>(null);

  // Utilise uniquement les projets réels fournis - pas de données mockées
  const activeProjects = projects;

  const getPaymentProgress = (paidAmount: number, totalAmount: number) => {
    return Math.round((paidAmount / totalAmount) * 100);
  };

  const getStatusIcon = (status: PaymentStage['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-success" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-warning" />;
      case 'upcoming':
        return <Calendar className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: PaymentStage['status']) => {
    switch (status) {
      case 'completed':
        return <Badge variant="success">Payé</Badge>;
      case 'pending':
        return <Badge variant="warning">En attente</Badge>;
      case 'upcoming':
        return <Badge variant="secondary">À venir</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Innovation explanation */}
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Innovation TORP : Suivi Paiements Tiers de Confiance
          </CardTitle>
          <CardDescription>
            Service gratuit - Position neutre - Zéro commission
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium mb-3">Comment ça fonctionne :</h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <LinkIcon className="h-4 w-4 text-primary" />
                  <span>Génération lien paiement sécurisé</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-success" />
                  <span>Invitation automatique entrepreneur</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-warning" />
                  <span>Jalons de paiement par étapes</span>
                </div>
                <div className="flex items-center gap-2">
                  <Bell className="h-4 w-4 text-info" />
                  <span>Notifications temps réel SMS/Email</span>
                </div>
              </div>
            </div>
            <div>
              <h4 className="font-medium mb-3">Avantages :</h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-success" />
                  <span>Protection contre les arnaques</span>
                </div>
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  <span>Traçabilité complète des versements</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-warning" />
                  <span>Position de force en négociation</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="success" className="text-xs">0% Commission</Badge>
                  <span>Service gratuit TORP</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Active payment tracking */}
      <Card>
        <CardHeader>
          <CardTitle>Projets avec Suivi Paiements Actif</CardTitle>
          <CardDescription>
            Vos paiements sécurisés par étapes - {activeProjects.length} projet(s) en cours
          </CardDescription>
        </CardHeader>
        <CardContent>
          {activeProjects.length === 0 ? (
            <div className="text-center py-8">
              <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h4 className="font-medium text-muted-foreground mb-2">Aucun projet avec suivi paiements actif</h4>
              <p className="text-sm text-muted-foreground">
                Lancez une analyse TORP pour activer le suivi sécurisé de vos paiements.
              </p>
            </div>
          ) : (
          <div className="space-y-6">
            {activeProjects.map((project) => (
              <div key={project.id} className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h4 className="font-medium">{project.projectName}</h4>
                    <p className="text-sm text-muted-foreground">{project.company}</p>
                    <p className="text-xs text-muted-foreground">Créé le {project.createdDate}</p>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-lg">
                      €{project.paidAmount.toLocaleString()} / €{project.totalAmount.toLocaleString()}
                    </div>
                    <Progress value={getPaymentProgress(project.paidAmount, project.totalAmount)} className="w-32 mt-1" />
                    <p className="text-xs text-muted-foreground mt-1">
                      {getPaymentProgress(project.paidAmount, project.totalAmount)}% payé
                    </p>
                  </div>
                </div>

                {/* Payment stages */}
                <div className="space-y-3">
                  <h5 className="font-medium text-sm flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Échéancier de paiement :
                  </h5>
                  {project.stages.map((stage, index) => (
                    <div key={`stage-${index}`} className={`p-3 rounded border-l-4 ${
                      stage.status === 'completed' ? 'border-l-success bg-success/5' :
                      stage.status === 'pending' ? 'border-l-warning bg-warning/5' :
                      'border-l-muted bg-muted/5'
                    }`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {getStatusIcon(stage.status)}
                          <div>
                            <div className="font-medium text-sm">{stage.name}</div>
                            <div className="text-xs text-muted-foreground">Prévu le {stage.date}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="font-medium">€{stage.amount.toLocaleString()}</div>
                          {getStatusBadge(stage.status)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 mt-4 pt-4 border-t">
                  <Button variant="outline" size="sm">
                    <Phone className="h-4 w-4 mr-1" />
                    Contacter entreprise
                  </Button>
                  <Button variant="outline" size="sm">
                    <FileText className="h-4 w-4 mr-1" />
                    Historique complet
                  </Button>
                  <Button variant="outline" size="sm">
                    <AlertTriangle className="h-4 w-4 mr-1" />
                    Signaler problème
                  </Button>
                  {userType === 'B2C' && (
                    <Button variant="outline" size="sm">
                      <Bell className="h-4 w-4 mr-1" />
                      Notifications
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
          )}
        </CardContent>
      </Card>

      {/* Setup new tracking */}
      <Card>
        <CardHeader>
          <CardTitle>Créer un Nouveau Suivi</CardTitle>
          <CardDescription>
            Sécurisez votre prochain projet avec le suivi paiements TORP
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="p-4 border rounded-lg text-center">
              <div className="text-2xl mb-2">1️⃣</div>
              <h4 className="font-medium mb-1">Analyse TORP</h4>
              <p className="text-sm text-muted-foreground">
                {userType === 'B2C' ? 'Commandez une analyse (19,90€+)' : 'Analysez votre devis client'}
              </p>
            </div>
            <div className="p-4 border rounded-lg text-center">
              <div className="text-2xl mb-2">2️⃣</div>
              <h4 className="font-medium mb-1">Lien Sécurisé</h4>
              <p className="text-sm text-muted-foreground">TORP génère un lien de paiement unique</p>
            </div>
            <div className="p-4 border rounded-lg text-center">
              <div className="text-2xl mb-2">3️⃣</div>
              <h4 className="font-medium mb-1">Suivi Actif</h4>
              <p className="text-sm text-muted-foreground">Notifications et médiation automatiques</p>
            </div>
          </div>
          <Button className="w-full mt-4">
            <Shield className="h-4 w-4 mr-2" />
            Activer sur mon prochain projet
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}