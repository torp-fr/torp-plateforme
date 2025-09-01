import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import { useToast } from '@/hooks/use-toast';
import { Header } from '@/components/Header';
import { CheckCircle } from 'lucide-react';

export default function AnalyzingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { addProject, setCurrentProject } = useApp();
  const { toast } = useToast();

  useEffect(() => {
    // Vérifier que l'utilisateur vient d'un paiement valide
    if (!location.state?.paymentCompleted) {
      navigate('/analyze');
      return;
    }

    const { uploadedFile, projectData, formula } = location.state;
    
    if (!uploadedFile || !projectData || !formula) {
      navigate('/analyze');
      return;
    }

    // Créer le projet
    const newProject = {
      id: Date.now().toString(),
      name: projectData.name || 'Projet sans nom',
      type: projectData.type || 'renovation',
      status: 'analyzing' as const,
      amount: projectData.budget || 'Non spécifié',
      createdAt: new Date().toISOString().split('T')[0],
      company: `Entreprise ${Math.floor(Math.random() * 1000)}`,
      formulaType: formula.formula,
      paidAmount: formula.price
    };

    addProject(newProject);
    setCurrentProject(newProject);

    // Simulation d'analyse basée sur la formule choisie
    const analysisTime = formula.formula === 'cctp' ? 10000 : 
                        formula.formula === 'premium' ? 5000 : 3000;

    setTimeout(() => {
      const score = formula.formula === 'cctp' ? Math.floor(Math.random() * 20) + 80 : // 80-100 pour CCTP
                   formula.formula === 'premium' ? Math.floor(Math.random() * 30) + 60 : // 60-90 pour Premium
                   Math.floor(Math.random() * 40) + 50; // 50-90 pour Simple
      
      const grade = score >= 80 ? 'A' : score >= 70 ? 'B' : score >= 60 ? 'C' : 'D';
      
      const analysisResult = {
        score,
        grade,
        formulaUsed: formula.formula,
        strengths: [
          'Entreprise certifiée RGE avec 15 ans d\'expérience',
          'Prix dans la fourchette marché pour ce type de travaux',
          'Garanties décennale et biennale mentionnées',
          'Matériaux de qualité spécifiés dans le devis'
        ],
        warnings: formula.formula === 'simple' ? [
          'Analyse basique - détails limités',
          'Délais de livraison non précisés dans le devis'
        ] : [
          'Délais de livraison non précisés dans le devis',
          'Modalités de paiement à négocier (30% d\'acompte élevé)',
          'Pas de plan détaillé des interventions'
        ],
        recommendations: {
          questions: formula.formula === 'cctp' ? [
            'Quel est le délai exact de réalisation des travaux ?',
            'Puis-je obtenir des références de chantiers similaires ?',
            'Les matériaux sont-ils garantis séparément ?',
            'Un plan détaillé peut-il être fourni ?',
            'Quelles sont les normes DTU respectées ?',
            'Comment sera organisé le suivi de chantier ?'
          ] : formula.formula === 'premium' ? [
            'Quel est le délai exact de réalisation des travaux ?',
            'Puis-je obtenir des références de chantiers similaires ?',
            'Les matériaux sont-ils garantis séparément ?',
            'Un plan détaillé peut-il être fourni ?'
          ] : [
            'Quel est le délai exact de réalisation des travaux ?',
            'Puis-je obtenir des références de chantiers similaires ?'
          ],
          negotiation: formula.formula !== 'simple' ? 
            'L\'acompte de 30% peut être ramené à 20%. Demandez un échelonnement des paiements selon l\'avancement des travaux.' : 
            'Négociez les délais et modalités de paiement.'
        },
        priceComparison: formula.formula !== 'simple' ? {
          low: Math.floor(Math.random() * 3000) + 10000,
          current: parseInt(projectData.budget?.split('-')[1]?.replace(/[^0-9]/g, '') || '15000'),
          high: Math.floor(Math.random() * 5000) + 18000
        } : null,
        cctp: formula.formula === 'cctp' ? {
          generated: true,
          downloadUrl: '/download/cctp-example.pdf'
        } : null
      };

      const updatedProject = {
        ...newProject,
        status: 'completed' as const,
        score,
        grade,
        analysisResult
      };

      addProject(updatedProject);
      setCurrentProject(updatedProject);

      toast({
        title: 'Analyse terminée !',
        description: `Votre devis a obtenu la note ${grade} (${score}/100)`,
      });

      navigate('/results');
    }, analysisTime);
  }, [location, navigate, addProject, setCurrentProject, toast]);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto text-center">
          <div className="mb-8">
            <div className="relative w-32 h-32 mx-auto mb-6">
              <div className="w-32 h-32 border-4 border-muted rounded-full"></div>
              <div className="w-32 h-32 border-4 border-primary rounded-full border-t-transparent absolute top-0 left-0 animate-spin"></div>
            </div>
            <h2 className="text-3xl font-bold text-foreground mb-4">
              Analyse TORP en cours...
            </h2>
            <p className="text-lg text-muted-foreground mb-8">
              Notre IA analyse votre devis selon plus de 80 critères de qualité
            </p>
          </div>

          <div className="space-y-4">
            {[
              'Extraction des données du document', 
              'Vérification de l\'entreprise', 
              'Analyse des prix et prestations', 
              'Génération du rapport',
              ...(location.state?.formula?.formula === 'cctp' ? ['Génération du CCTP'] : []),
              ...(location.state?.formula?.formula === 'premium' || location.state?.formula?.formula === 'cctp' ? ['Comparaison marché'] : [])
            ].map((step, index) => (
              <div key={index} className="flex items-center space-x-3 p-4 bg-card rounded-lg">
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                  <CheckCircle className="w-4 h-4 text-white" />
                </div>
                <span className="text-foreground font-medium">{step}</span>
              </div>
            ))}
          </div>

          <div className="mt-8 p-4 bg-info/10 border border-info/20 rounded-lg">
            <p className="text-sm text-muted-foreground">
              Formule sélectionnée: <span className="font-semibold text-foreground">
                {location.state?.formula?.formula === 'cctp' ? 'Avec CCTP' : 
                 location.state?.formula?.formula === 'premium' ? 'Analyse Premium' : 
                 'Analyse Simple'}
              </span>
            </p>
            {location.state?.formula?.insurances?.length > 0 && (
              <p className="text-sm text-muted-foreground mt-1">
                Assurances souscrites: {location.state.formula.insurances.length}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}