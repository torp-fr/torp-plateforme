import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authService } from '@/services/api/supabase/auth.service';
import { devisService } from '@/services/api/supabase/devis.service';

// User types - Particulier (B2C), Professionnel (B2B), Secteur Public (B2G), Admin
export type UserType = 'B2C' | 'B2B' | 'B2G' | 'admin' | 'super_admin';

export interface User {
  id: string;
  email: string;
  name: string;
  type: UserType;
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
  // B2G
  entity_name?: string;
  entity_type?: string;
  entity_address?: string;
  siret?: string;
  entity_function?: string;
  entity_code_insee?: string;
  entity_code_ape?: string;
  entity_strate?: string;
  entity_service_name?: string;
  entity_service_email?: string;
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
  projects: Project[]; // Analyses de devis
  currentProject: Project | null;
  isAnalyzing: boolean;
  isLoading: boolean; // État de chargement de l'authentification
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
      console.log('✓ Déconnexion réussie');
    } catch (error) {
      console.error('⚠️ Erreur lors de la déconnexion:', error);
      // Même en cas d'erreur, l'état est déjà nettoyé
    }
  };

  return (
    <AppContext.Provider value={{
      user,
      userType,
      projects,
      currentProject,
      isAnalyzing,
      isLoading,
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