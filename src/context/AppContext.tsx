import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface User {
  id: string;
  email: string;
  name: string;
  type: 'particulier' | 'entreprise' | 'admin' | 'collectivites';
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
  userType: 'particulier' | 'entreprise' | 'admin' | 'collectivites';
  projects: Project[];
  currentProject: Project | null;
  isAnalyzing: boolean;
  setUser: (user: User | null) => void;
  setUserType: (type: 'particulier' | 'entreprise' | 'admin' | 'collectivites') => void;
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
  const [userType, setUserType] = useState<'particulier' | 'entreprise' | 'admin' | 'collectivites'>('particulier');
  const [projects, setProjects] = useState<Project[]>(mockProjects);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

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