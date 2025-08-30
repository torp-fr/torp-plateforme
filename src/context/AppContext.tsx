import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface User {
  id: string;
  email: string;
  name: string;
  type: 'particulier' | 'entreprise';
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
  userType: 'particulier' | 'entreprise';
  projects: Project[];
  currentProject: Project | null;
  isAnalyzing: boolean;
  setUser: (user: User | null) => void;
  setUserType: (type: 'particulier' | 'entreprise') => void;
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
    amount: '12 500€',
    createdAt: '2024-03-15',
    company: 'Plombier Pro SARL',
    analysisResult: {
      strengths: ['Entreprise certifiée RGE', 'Prix cohérent', 'Garanties complètes'],
      warnings: ['Délais non précisés'],
      recommendations: ['Demander les références']
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
    company: 'ElectricMax SARL'
  },
  {
    id: '3',
    name: 'Pose carrelage cuisine',
    type: 'Carrelage',
    status: 'analyzing',
    amount: '4 200€',
    createdAt: '2024-03-20',
    company: 'Carrelage Expert'
  }
];

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userType, setUserType] = useState<'particulier' | 'entreprise'>('particulier');
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