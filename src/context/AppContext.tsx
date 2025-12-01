import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authService } from '@/services/api/supabase/auth.service';
import { devisService } from '@/services/api/supabase/devis.service';

// User types - Simplifié: Particulier (B2C) et Professionnel (B2B)
export type UserType = 'B2C' | 'B2B' | 'admin';

export interface User {
  id: string;
  email: string;
  name: string;
  type: UserType;
  company?: string;
}

export interface Project {
  id: string;
  name: string;
  type: string;
  status: 'draft' | 'analyzing' | 'completed' | 'accepted' | 'rejected';
  score?: number;
  grade?: string;
  amount: string;
  createdAt: string;
  company?: string;
  analysisResult?: any;
}

interface AppContextType {
  user: User | null;
  userType: UserType;
  projects: Project[];
  currentProject: Project | null;
  isAnalyzing: boolean;
  setUser: (user: User | null) => void;
  setUserType: (type: UserType) => void;
  setProjects: (projects: Project[]) => void;
  setCurrentProject: (project: Project | null) => void;
  setIsAnalyzing: (analyzing: boolean) => void;
  addProject: (project: Project) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// Mock data
const mockProjects: Project[] = [
  {
    id: '1',
    name: 'Rénovation salle de bain',
    type: 'Plomberie',
    status: 'completed',
    score: 85,
    grade: 'A',
    amount: '15 200€',
    createdAt: '2024-03-15',
    company: 'Plombier Pro SARL',
    analysisResult: {
      strengths: [
        'Entreprise certifiée RGE avec 15 ans d\'expérience',
        'Prix cohérent avec le marché local',
        'Garanties décennale et biennale mentionnées',
        'Matériaux de qualité spécifiés'
      ],
      warnings: [
        'Délais de livraison non précisés dans le devis',
        'Modalités de paiement à négocier (30% d\'acompte élevé)'
      ],
      recommendations: {
        questions: [
          'Quel est le délai exact de réalisation des travaux ?',
          'Puis-je obtenir des références de chantiers similaires ?',
          'Les matériaux sont-ils garantis séparément ?'
        ],
        negotiation: 'L\'acompte de 30% peut être ramené à 20%. Demandez un échelonnement des paiements selon l\'avancement.'
      },
      priceComparison: {
        low: 12500,
        current: 15200,
        high: 18900
      }
    }
  },
  {
    id: '2',
    name: 'Installation électrique',
    type: 'Électricité',
    status: 'completed',
    score: 72,
    grade: 'B',
    amount: '8 900€',
    createdAt: '2024-03-08',
    company: 'ElectricMax SARL',
    analysisResult: {
      strengths: [
        'Entreprise certifiée Qualifelec',
        'Devis détaillé avec références matériaux'
      ],
      warnings: [
        'Prix légèrement au-dessus de la moyenne',
        'Garantie limitée à 2 ans'
      ],
      recommendations: {
        questions: ['Possibilité d\'étendre la garantie ?'],
        negotiation: 'Négocier une réduction de 5% sur le total.'
      },
      priceComparison: {
        low: 7500,
        current: 8900,
        high: 10200
      }
    }
  },
  {
    id: '3',
    name: 'Pose carrelage cuisine',
    type: 'Carrelage',
    status: 'analyzing',
    amount: '4 200€',
    createdAt: '2024-03-20',
    company: 'Carrelage Expert'
  },
  {
    id: '4',
    name: 'Peinture salon',
    type: 'Peinture',
    status: 'completed',
    score: 78,
    grade: 'B',
    amount: '3 500€',
    createdAt: '2024-02-28',
    company: 'Peinture Plus',
    analysisResult: {
      strengths: ['Prix compétitif', 'Bonne réputation locale'],
      warnings: ['Pas de garantie sur la peinture'],
      recommendations: {
        questions: ['Quelle marque de peinture utilisez-vous ?'],
        negotiation: 'Demander une garantie minimale de 1 an.'
      },
      priceComparison: {
        low: 2800,
        current: 3500,
        high: 4200
      }
    }
  },
  {
    id: '5',
    name: 'Rénovation cuisine complète',
    type: 'Cuisine',
    status: 'completed',
    score: 91,
    grade: 'A',
    amount: '28 500€',
    createdAt: '2024-01-15',
    company: 'Cuisines Design SARL',
    analysisResult: {
      strengths: [
        'Entreprise reconnue avec 20 ans d\'expérience',
        'Devis très détaillé avec plan 3D',
        'Garantie complète 10 ans',
        'Prix excellent pour la qualité proposée'
      ],
      warnings: [],
      recommendations: {
        questions: ['Délai de livraison des meubles ?'],
        negotiation: 'Excellent devis, pas de négociation nécessaire.'
      },
      priceComparison: {
        low: 25000,
        current: 28500,
        high: 35000
      }
    }
  }
];

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userType, setUserType] = useState<UserType>('B2C');
  const [projects, setProjects] = useState<Project[]>([]); // Start with empty array - will load from Supabase
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Check for existing session on mount and listen for auth changes
  useEffect(() => {
    let isMounted = true;
    let subscription: any = null;

    // Check initial session
    const loadUser = async () => {
      try {
        const currentUser = await authService.getCurrentUser();
        if (!isMounted) return;

        if (currentUser) {
          console.log('✓ Session restaurée:', currentUser.email);
          setUser(currentUser);
          setUserType(currentUser.type);
        } else {
          console.log('ℹ️ Aucune session active');
        }
      } catch (error) {
        console.error('⚠️ Erreur lors de la restauration de session:', error);
        // Ne pas crasher, continuer sans session
      }
    };

    // Setup auth state listener
    const setupAuthListener = () => {
      try {
        const { data } = authService.onAuthStateChange((sessionUser) => {
          if (!isMounted) return;

          if (sessionUser) {
            console.log('✓ Utilisateur connecté:', sessionUser.email);
            setUser(sessionUser);
            setUserType(sessionUser.type);
          } else {
            console.log('ℹ️ Utilisateur déconnecté');
            setUser(null);
            setProjects([]);
            setCurrentProject(null);
          }
        });

        subscription = data?.subscription;
      } catch (error) {
        console.error('⚠️ Erreur setup auth listener:', error);
        // Ne pas crasher, continuer sans listener
      }
    };

    // Execute initialization
    loadUser();
    setupAuthListener();

    // Cleanup subscription on unmount
    return () => {
      isMounted = false;
      try {
        subscription?.unsubscribe();
      } catch (error) {
        console.error('⚠️ Erreur unsubscribe:', error);
      }
    };
  }, []);

  // Load user's analyzed devis when user changes
  useEffect(() => {
    const loadUserDevis = async () => {
      if (!user?.id) {
        setProjects([]);
        return;
      }

      try {
        console.log('[AppContext] Loading analyzed devis for user:', user.id);
        const analyzedDevis = await devisService.getUserAnalyzedDevis(user.id, 50);

        // Transform devis to Project format for compatibility
        const devisProjects: Project[] = analyzedDevis.map(devis => ({
          id: devis.id,
          name: (devis as any).projectName || devis.fileName?.replace('.pdf', '') || `Devis ${(devis as any).devisNumber || 'sans numéro'}`,
          company: (devis as any).entreprise?.nom || 'Entreprise',
          type: 'Analyse devis',
          status: devis.status === 'analyzed' ? 'completed' : devis.status as any,
          score: devis.score_total || 0,
          grade: devis.grade || '?',
          amount: `${((devis as any).recommendations?.budgetRealEstime || devis.amount || 0).toLocaleString('fr-FR')}€`,
          createdAt: devis.created_at || new Date().toISOString(),
          analysisResult: {
            detailedScores: {
              entreprise: (devis.score_entreprise as any)?.scoreTotal || 0,
              prix: (devis.score_prix as any)?.scoreTotal || 0,
              completude: (devis.score_completude as any)?.scoreTotal || 0,
              conformite: (devis.score_conformite as any)?.scoreTotal || 0,
              delais: (devis.score_delais as any)?.scoreTotal || 0,
            },
            rawData: {
              scoreEntreprise: devis.score_entreprise,
              scorePrix: devis.score_prix,
              scoreCompletude: devis.score_completude,
              scoreConformite: devis.score_conformite,
              scoreDelais: devis.score_delais,
              montantTotal: devis.recommendations?.budgetRealEstime || devis.amount || 0,
              margeNegociation: devis.recommendations?.margeNegociation,
              surcoutsDetectes: devis.detected_overcosts || 0,
              budgetRealEstime: devis.recommendations?.budgetRealEstime || devis.amount || 0,
            },
          },
        }));

        console.log(`[AppContext] Loaded ${devisProjects.length} analyzed devis`);
        setProjects(devisProjects);
      } catch (error) {
        console.error('[AppContext] Error loading user devis:', error);
        setProjects([]);
      }
    };

    loadUserDevis();
  }, [user?.id]);

  const addProject = (project: Project) => {
    setProjects(prev => [project, ...prev]);
  };

  const updateProject = (id: string, updates: Partial<Project>) => {
    setProjects(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
    if (currentProject?.id === id) {
      setCurrentProject(prev => prev ? { ...prev, ...updates } : null);
    }
  };

  return (
    <AppContext.Provider value={{
      user,
      userType,
      projects,
      currentProject,
      isAnalyzing,
      setUser,
      setUserType,
      setProjects,
      setCurrentProject,
      setIsAnalyzing,
      addProject,
      updateProject
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};