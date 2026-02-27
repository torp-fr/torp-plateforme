import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authService } from '@/services/api/supabase/auth.service';
import { devisService } from '@/services/api/supabase/devis.service';
import { log, warn, error, time, timeEnd } from '@/lib/logger';

// User types - Particulier (B2C), Professionnel (B2B), Admin
export type UserType = 'B2C' | 'B2B' | 'admin' | 'super_admin';

export interface User {
  id: string;
  email: string;
  name: string;
  type: UserType;
  isAdmin?: boolean;
  role?: 'user' | 'admin' | 'super_admin';
  canUploadKb?: boolean;
  phone?: string;
  city?: string;
  postal_code?: string;
  // B2C
  company?: string; // Legacy, also used for B2B
  property_type?: string;
  property_surface?: number;
  property_year?: number;
  property_rooms?: number;
  property_address?: string;
  property_energy_class?: string;
  is_owner?: boolean;
  // B2B - Identification
  company_siret?: string;
  company_activity?: string;
  company_size?: string;
  company_role?: string;
  company_address?: string;
  company_code_ape?: string;
  company_rcs?: string;
  company_capital?: string;
  company_creation_date?: string;
  company_effectif?: number;
  company_ca_annuel?: number;
  // B2B - Mémoire technique (profil enrichi)
  company_description?: string;
  company_human_resources?: string;
  company_material_resources?: string;
  company_methodology?: string;
  company_quality_commitments?: string;
  company_certifications?: CompanyCertification[];
  company_references?: CompanyReference[];
  company_documents?: CompanyDocument[];
}

// Types pour les données B2B enrichies
export interface CompanyCertification {
  type: string;
  name: string;
  number?: string;
  issuer?: string;
  issue_date?: string;
  expiry_date?: string;
  is_valid?: boolean;
}

export interface CompanyReference {
  project_name: string;
  client_name?: string;
  description?: string;
  amount?: number;
  year?: number;
  duration_months?: number;
  contact_name?: string;
  contact_phone?: string;
  contact_email?: string;
}

export interface CompanyDocument {
  type: string;
  name: string;
  file_url?: string;
  issue_date?: string;
  expiry_date?: string;
  is_valid?: boolean;
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
  isAdmin: boolean;
  projects: Project[]; // Analyses de devis
  currentProject: Project | null;
  isAnalyzing: boolean;
  isLoading: boolean; // État de chargement de l'authentification
  isAuthenticated: boolean; // Session exists (auth token valid)
  setUser: (user: User | null) => void;
  setUserType: (type: UserType) => void;
  setProjects: (projects: Project[]) => void;
  setCurrentProject: (project: Project | null) => void;
  setIsAnalyzing: (analyzing: boolean) => void;
  addProject: (project: Project) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
  logout: () => Promise<void>; // Fonction de déconnexion centralisée
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userType, setUserType] = useState<UserType>('B2C');
  const [projects, setProjects] = useState<Project[]>([]); // Analyses de devis
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isLoading, setIsLoading] = useState(true); // Chargement initial de l'auth
  const [isAuthenticated, setIsAuthenticated] = useState(false); // Session exists (auth token valid)

  // Compute isAdmin from user
  const isAdmin = user?.isAdmin === true;

  // Bootstrap auth: Check initial session and setup listener
  // isLoading represents ONLY initial bootstrap, never set to true after mount
  useEffect(() => {
    let isMounted = true;

    const bootstrapAuth = async () => {
      try {
        // Get initial session
        const currentUser = await authService.getCurrentUser();
        if (!isMounted) return;

        if (currentUser) {
          log('✓ Session restaurée:', currentUser.email);
          setIsAuthenticated(true);
          setUser(currentUser);
          setUserType(currentUser.type);
        } else {
          log('ℹ️ Aucune session active');
          setIsAuthenticated(false);
        }
      } catch (error) {
        console.error('⚠️ Erreur lors de la restauration de session:', error);
        setIsAuthenticated(false);
      } finally {
        if (isMounted) {
          setIsLoading(false); // Only set once at end of bootstrap
        }
      }
    };

    bootstrapAuth();

    // Setup listener for auth state changes (login/logout/refresh)
    // This updates state without touching isLoading
    const { data } = authService.onAuthStateChange((sessionUser) => {
      if (!isMounted) return;

      if (sessionUser) {
        log('✓ Auth event - user signed in:', sessionUser.email);
        setIsAuthenticated(true);
        setUser(sessionUser);
        setUserType(sessionUser.type);
      } else {
        log('ℹ️ Auth event - user signed out');
        setIsAuthenticated(false);
        setUser(null);
        setUserType('B2C');
        setProjects([]);
        setCurrentProject(null);
      }
    });

    // Cleanup listener on unmount
    return () => {
      isMounted = false;
      try {
        data?.subscription?.unsubscribe();
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
        log('[AppContext] Loading analyzed devis for user:', user.id);
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

        log(`[AppContext] Loaded ${devisProjects.length} analyzed devis`);
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

  // Fonction de déconnexion centralisée
  const logout = async () => {
    try {
      // D'abord nettoyer l'état local pour feedback immédiat
      setUser(null);
      setProjects([]);
      setCurrentProject(null);
      setUserType('B2C');

      // Ensuite appeler le service de déconnexion
      await authService.logout();
      log('✓ Déconnexion réussie');
    } catch (error) {
      console.error('⚠️ Erreur lors de la déconnexion:', error);
      // Même en cas d'erreur, l'état est déjà nettoyé
    }
  };

  return (
    <AppContext.Provider value={{
      user,
      userType,
      isAdmin,
      projects,
      currentProject,
      isAnalyzing,
      isLoading,
      isAuthenticated,
      setUser,
      setUserType,
      setProjects,
      setCurrentProject,
      setIsAnalyzing,
      addProject,
      updateProject,
      logout,
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