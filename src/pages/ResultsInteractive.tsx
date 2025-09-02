import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useApp } from '@/context/AppContext';
import { Header } from '@/components/Header';
import ChatAI from '@/components/ChatAI';
import { PaymentManager } from '@/components/PaymentManager';
import { ProjectComparison } from '@/components/ProjectComparison';
import { CCTPGenerator } from '@/components/CCTPGenerator';
import { ArrowLeft, MessageSquare, CreditCard, BarChart3, FileText } from 'lucide-react';

export default function ResultsInteractive() {
  const { currentProject, userType } = useApp();
  const navigate = useNavigate();

  if (!currentProject || !currentProject.analysisResult) {
    navigate('/analyze');
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-4 mb-8">
            <Button variant="outline" onClick={() => navigate('/results')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retour aux résultats
            </Button>
          </div>

          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-4">
              Accompagnement personnalisé
            </h1>
            <p className="text-lg text-muted-foreground">
              Posez vos questions, gérez les paiements, comparez vos devis et générez votre CCTP
            </p>
          </div>

          <Tabs defaultValue="chat" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="chat" className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                Assistant IA
              </TabsTrigger>
              <TabsTrigger value="cctp" className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                CCTP
              </TabsTrigger>
              <TabsTrigger value="payments" className="flex items-center gap-2">
                <CreditCard className="w-4 h-4" />
                Paiements
              </TabsTrigger>
              <TabsTrigger value="compare" className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Comparaison
              </TabsTrigger>
            </TabsList>

            <TabsContent value="chat">
              <ChatAI 
                projectId={currentProject.id} 
                analysisResult={currentProject.analysisResult} 
              />
            </TabsContent>

            <TabsContent value="cctp">
              <CCTPGenerator 
                projectId={currentProject.id} 
                analysisResult={currentProject.analysisResult} 
              />
            </TabsContent>

            <TabsContent value="payments">
              <PaymentManager 
                projectId={currentProject.id} 
                userType={userType}
                projectAmount={currentProject.amount}
              />
            </TabsContent>

            <TabsContent value="compare">
              <ProjectComparison currentProjectId={currentProject.id} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}