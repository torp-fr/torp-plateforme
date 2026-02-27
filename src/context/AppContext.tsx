import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { supabase } from '@/lib/supabase';
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
  const [isLoading, setIsLoading] = useState(true); // ONLY represents session bootstrap timing
  const [isAuthenticated, setIsAuthenticated] = useState(false); // Session exists (auth token valid)

  // PHASE 3: StrictMode safety - prevent double bootstrap
  const didBootstrap = useRef(false);

  // Compute isAdmin from user
  const isAdmin = user?.isAdmin === true;

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE 1 + 2 + 3: CRITICAL BOOTSTRAP - SESSION ONLY (non-blocking)
  // ════════════════════════════════════════════════════════════════════════════
  // Rules:
  // 1. ZERO network calls before setIsLoading(false)
  // 2. ZERO DB fetches during bootstrap
  // 3. ZERO profile loading during bootstrap
  // 4. ZERO side effects except auth listener setup
  // 5. setIsLoading(true) appears ONLY in initial useState (line 124)
  // ════════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    // PHASE 3: Prevent double execution in StrictMode
    if (didBootstrap.current) {
      log('[Bootstrap] Already bootstrapped, skipping');
      return;
    }
    didBootstrap.current = true;

    let isMounted = true;

    const bootstrapSession = async () => {
      try {
        // PHASE 7: Performance logging
        time('SESSION_BOOTSTRAP');

        // PHASE 1: Get session ONLY - no network, no DB
        const { data } = await supabase.auth.getSession();

        timeEnd('SESSION_BOOTSTRAP');

        if (!isMounted) return;

        // Set authenticated state from session
        if (data.session) {
          log('[Bootstrap] ✓ Session found:', data.session.user?.email);
          setIsAuthenticated(true);
          // Set minimal user - profile loads in background
          setUser({
            id: data.session.user.id,
            email: data.session.user.email || 'unknown',
            name: '', // Will be set from profile
            type: 'B2C', // Will be set from profile
          });
        } else {
          log('[Bootstrap] ℹ️ No active session');
          setIsAuthenticated(false);
        }
      } catch (err) {
        if (!isMounted) return;
        error('[Bootstrap] Session check failed:', err);
        setIsAuthenticated(false);
      } finally {
        if (isMounted) {
          // CRITICAL: Set isLoading(false) immediately after session check
          // Profile loading happens SEPARATELY and asynchronously
          setIsLoading(false);
        }
      }
    };

    bootstrapSession();

    // Setup auth state change listener
    // This triggers on login/logout/refresh (NOT during bootstrap)
    const { data } = authService.onAuthStateChange((sessionUser) => {
      if (!isMounted) return;

      if (sessionUser) {
        log('[Auth Event] User signed in:', sessionUser.email);
        setIsAuthenticated(true);
        setUser(sessionUser);
        setUserType(sessionUser.type);
      } else {
        log('[Auth Event] User signed out');
        setIsAuthenticated(false);
        setUser(null);
        setUserType('B2C');
        setProjects([]);
        setCurrentProject(null);
      }
    });

    // Cleanup
    return () => {
      isMounted = false;
      try {
        data?.subscription?.unsubscribe();
      } catch (err) {
        console.error('[Bootstrap] Unsubscribe error:', err);
      }
    };
  }, []);

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE 2: BACKGROUND PROFILE LOADING (non-blocking, separate effect)
  // ════════════════════════════════════════════════════════════════════════════
  // This effect runs AFTER bootstrap completes and UI renders.
  // It fetches profile data asynchronously without touching isLoading.
  // ════════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    // Only fetch profile if authenticated
    if (!isAuthenticated || !user?.id) {
      return;
    }

    let isMounted = true;

    const loadProfileInBackground = async () => {
      try {
        log('[Profile] Loading profile for user:', user.id);
        const userProfile = await authService.getUserProfile(user.id);
        if (!isMounted) return;

        if (userProfile) {
          log('[Profile] ✓ Loaded:', userProfile.email);
          setUser(userProfile);
          setUserType(userProfile.type);
        }
      } catch (err) {
        if (!isMounted) return;
        log('[Profile] ⚠️ Load failed:', err instanceof Error ? err.message : String(err));
        // Continue even if profile fails - user is still authenticated
      }
    };

    // Start profile load (no await - non-blocking)
    loadProfileInBackground();

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, user?.id]);

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