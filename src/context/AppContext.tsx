import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authService } from '@/services/api/supabase/auth.service';
import { devisService } from '@/services/api/supabase/devis.service';
import { Phase0ProjectService, Phase0Summary } from '@/services/phase0';

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
  projects: Project[]; // Analyses de devis
  phase0Projects: Phase0Summary[]; // Projets Phase 0 (cadrage)
  currentProject: Project | null;
  isAnalyzing: boolean;
  isLoading: boolean; // État de chargement de l'authentification
  setUser: (user: User | null) => void;
  setUserType: (type: UserType) => void;
  setProjects: (projects: Project[]) => void;
  setPhase0Projects: (projects: Phase0Summary[]) => void;
  setCurrentProject: (project: Project | null) => void;
  setIsAnalyzing: (analyzing: boolean) => void;
  addProject: (project: Project) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
  refreshPhase0Projects: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userType, setUserType] = useState<UserType>('B2C');
  const [projects, setProjects] = useState<Project[]>([]); // Analyses de devis
  const [phase0Projects, setPhase0Projects] = useState<Phase0Summary[]>([]); // Projets Phase 0
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isLoading, setIsLoading] = useState(true); // Chargement initial de l'auth

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
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
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

  // Fonction pour charger les projets Phase0
  const loadPhase0Projects = async () => {
    if (!user?.id) {
      setPhase0Projects([]);
      return;
    }

    try {
      console.log('[AppContext] Loading Phase0 projects for user:', user.id);
      const userPhase0Projects = await Phase0ProjectService.getUserProjects(user.id);

      // Transformer en Phase0Summary
      const summaries: Phase0Summary[] = userPhase0Projects.map(p => ({
        id: p.id,
        reference: p.reference,
        title: p.workProject?.general?.title || 'Projet sans titre',
        status: p.status,
        propertyAddress: p.property?.address ?
          `${p.property.address.postalCode} ${p.property.address.city}` : undefined,
        selectedLotsCount: p.selectedLots?.length || 0,
        completeness: p.completeness || 0,
        estimatedBudget: p.workProject?.budget?.totalEnvelope,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      }));

      console.log(`[AppContext] Loaded ${summaries.length} Phase0 projects`);
      setPhase0Projects(summaries);
    } catch (error) {
      console.error('[AppContext] Error loading Phase0 projects:', error);
      setPhase0Projects([]);
    }
  };

  // Charger les projets Phase0 quand l'utilisateur change
  useEffect(() => {
    loadPhase0Projects();
  }, [user?.id]);

  // Fonction pour rafraîchir les projets Phase0 (utilisable depuis les composants)
  const refreshPhase0Projects = async () => {
    await loadPhase0Projects();
  };

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
      phase0Projects,
      currentProject,
      isAnalyzing,
      isLoading,
      setUser,
      setUserType,
      setProjects,
      setPhase0Projects,
      setCurrentProject,
      setIsAnalyzing,
      addProject,
      updateProject,
      refreshPhase0Projects,
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