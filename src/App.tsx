import { lazy, Suspense } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppProvider, useApp } from "@/context/AppContext";
import { ErrorBoundary } from "@/components/error/ErrorBoundary";

// ============================================
// COMPOSANT DE CHARGEMENT
// ============================================
const PageLoader = () => (
  <div className="flex items-center justify-center h-screen bg-background">
    <div className="flex flex-col items-center gap-4">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      <p className="text-muted-foreground text-sm">Chargement...</p>
    </div>
  </div>
);

// ============================================
// IMPORTS STATIQUES (pages critiques chargées immédiatement)
// ============================================
import LandingPage from "./pages/LandingPage";
import Login from "./pages/Login";
import Register from "./pages/Register";
import NotFound from "./pages/NotFound";
import { ProRoute, ProtectedRoute } from "@/components/auth/ProRoute";
import ChantierLayout from "./components/layout/ChantierLayout";

// ============================================
// LAZY IMPORTS - Pages Utilitaires
// ============================================
const Index = lazy(() => import("./pages/Index"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Profile = lazy(() => import("./pages/Profile"));
const Analyze = lazy(() => import("./pages/Analyze"));
const Results = lazy(() => import("./pages/Results"));
const ResultsInteractive = lazy(() => import("./pages/ResultsInteractive"));
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const UnifiedDashboard = lazy(() => import("./pages/UnifiedDashboard"));
const Pricing = lazy(() => import("./pages/Pricing"));
const Demo = lazy(() => import("./pages/Demo"));
const ProjectTracking = lazy(() => import("./pages/ProjectTracking"));
const FormulaPicker = lazy(() => import("./pages/FormulaPicker"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const ProjectDashboard = lazy(() => import("./pages/ProjectDashboard"));
const ImprovedB2BDashboard = lazy(() => import("@/pages/ImprovedB2BDashboard"));
const B2CDashboard = lazy(() => import("./pages/B2CDashboard"));
const TorpCompleteFlow = lazy(() => import("./pages/TorpCompleteFlow"));
const AlgorithmicSegments = lazy(() => import("./pages/AlgorithmicSegments"));
const KnowledgeBase = lazy(() => import("./pages/KnowledgeBase"));
const AdminAnalytics = lazy(() => import("./pages/AdminAnalytics"));
const AdminDiagnostic = lazy(() => import("./pages/AdminDiagnostic"));
const Compare = lazy(() => import("./pages/Compare"));

// ============================================
// LAZY IMPORTS - B2B Pro Pages
// ============================================
const ProDashboard = lazy(() => import("./pages/pro/ProDashboard"));
const ProOnboarding = lazy(() => import("./pages/pro/ProOnboarding"));
const ProAnalyses = lazy(() => import("./pages/pro/ProAnalyses"));
const ProNewAnalysis = lazy(() => import("./pages/pro/ProNewAnalysis"));
const ProDocuments = lazy(() => import("./pages/pro/ProDocuments"));
const ProTickets = lazy(() => import("./pages/pro/ProTickets"));
const ProTicketDetail = lazy(() => import("./pages/pro/ProTicketDetail"));
const ProSettings = lazy(() => import("./pages/pro/ProSettings"));
const ProProjects = lazy(() => import("./pages/pro/ProProjects"));
const ProNewProject = lazy(() => import("./pages/pro/ProNewProject"));
const ProCompanyProfile = lazy(() => import("./pages/pro/ProCompanyProfile"));
const ProTeam = lazy(() => import("./pages/pro/ProTeam"));

// ============================================
// LAZY IMPORTS - Phase 0 (Conception)
// ============================================
const Phase0Landing = lazy(() => import("./pages/phase0/Phase0Landing"));
const Phase0Wizard = lazy(() => import("./pages/phase0/Phase0Wizard"));
const Phase0Professional = lazy(() => import("./pages/phase0/Phase0Professional"));
const Phase0Dashboard = lazy(() => import("./pages/phase0/Phase0Dashboard"));
const Phase0ProjectPage = lazy(() => import("./pages/phase0/Phase0Project"));
const Phase0AnalyzeDevis = lazy(() => import("./pages/phase0/Phase0AnalyzeDevis"));

// ============================================
// LAZY IMPORTS - Phase 1 (Consultation)
// ============================================
const Phase1Consultation = lazy(() => import("./pages/phase1/Phase1Consultation"));

// ============================================
// LAZY IMPORTS - Phase 2 (Préparation)
// ============================================
const Phase2Dashboard = lazy(() => import("./pages/phase2/Phase2Dashboard"));
const PlanningPage = lazy(() => import("./pages/phase2/PlanningPage"));
const ReunionsPage = lazy(() => import("./pages/phase2/ReunionsPage"));
const JournalPage = lazy(() => import("./pages/phase2/JournalPage"));
const ChantiersListPage = lazy(() => import("./pages/phase2/ChantiersListPage"));

// ============================================
// LAZY IMPORTS - Phase 3 (Exécution)
// ============================================
const Phase3Dashboard = lazy(() => import("./pages/phase3/Phase3Dashboard"));
const ControlesPage = lazy(() => import("./pages/phase3/ControlesPage"));
const CoordinationPage = lazy(() => import("./pages/phase3/CoordinationPage"));
const SituationsPage = lazy(() => import("./pages/phase3/SituationsPage"));

// ============================================
// LAZY IMPORTS - Phase 4 (Réception)
// ============================================
const Phase4Dashboard = lazy(() => import("./pages/phase4/Phase4Dashboard"));
const OPRPage = lazy(() => import("./pages/phase4/OPRPage"));
const ReservesPage = lazy(() => import("./pages/phase4/ReservesPage"));
const GarantiesPage = lazy(() => import("./pages/phase4/GarantiesPage"));
const DOEPage = lazy(() => import("./pages/phase4/DOEPage"));

// ============================================
// LAZY IMPORTS - Phase 5 (Maintenance)
// ============================================
const Phase5Dashboard = lazy(() => import("./pages/phase5/Phase5Dashboard"));
const DiagnosticsPage = lazy(() => import("./pages/phase5/DiagnosticsPage"));
const EntretienPage = lazy(() => import("./pages/phase5/EntretienPage"));
const SinistresPage = lazy(() => import("./pages/phase5/SinistresPage"));

// ============================================
// LAZY IMPORTS - Tenders & B2B
// ============================================
const TendersPage = lazy(() => import("./pages/tenders/TendersPage"));
const TenderDetailPage = lazy(() => import("./pages/tenders/TenderDetailPage"));
const B2BTendersPage = lazy(() => import("./pages/b2b/B2BTendersPage"));
const B2BTenderViewPage = lazy(() => import("./pages/b2b/B2BTenderViewPage"));
const B2BResponseFormPage = lazy(() => import("./pages/b2b/B2BResponseFormPage"));

const queryClient = new QueryClient();

// Composant interne pour accéder au contexte
const AppContent = () => {
  const { userType } = useApp();

  return (
    <>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Routes publiques (chargées statiquement) */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* Routes publiques (lazy) */}
            <Route path="/home-old" element={<Index />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/demo" element={<Demo />} />

            {/* Routes utilisateur */}
            <Route path="/profile" element={<Profile />} />
            <Route path="/analyze" element={<Analyze />} />
            <Route path="/results" element={<Results />} />
            <Route path="/results-interactive" element={<ResultsInteractive />} />
            <Route path="/dashboard" element={<ProtectedRoute><UnifiedDashboard /></ProtectedRoute>} />
            <Route path="/dashboard-legacy" element={<DashboardPage />} />
            <Route path="/project-tracking" element={<ProjectTracking />} />
            <Route path="/formula-picker" element={<FormulaPicker />} />
            <Route path="/project-dashboard" element={<ProjectDashboard />} />
            <Route path="/improved-b2b-dashboard" element={<ImprovedB2BDashboard />} />
            <Route path="/b2c-dashboard" element={<B2CDashboard />} />
            <Route path="/compare" element={<Compare />} />
            <Route path="/torp-complete" element={<TorpCompleteFlow />} />
            <Route path="/segments" element={<AlgorithmicSegments />} />
            <Route path="/knowledge-base" element={<KnowledgeBase />} />

            {/* Routes Admin */}
            <Route path="/admin-dashboard" element={<AdminDashboard />} />
            <Route path="/admin/analytics" element={<AdminAnalytics />} />
            <Route path="/admin/diagnostic" element={<AdminDiagnostic />} />

            {/* Routes B2B Pro */}
            <Route path="/pro" element={<ProRoute><ProDashboard /></ProRoute>} />
            <Route path="/pro/onboarding" element={<ProRoute><ProOnboarding /></ProRoute>} />
            <Route path="/pro/projects" element={<ProRoute><ProProjects /></ProRoute>} />
            <Route path="/pro/projects/new" element={<ProRoute><ProNewProject /></ProRoute>} />
            <Route path="/pro/projects/:projectId" element={<ProRoute><Phase0ProjectPage /></ProRoute>} />
            <Route path="/pro/analyses" element={<ProRoute><ProAnalyses /></ProRoute>} />
            <Route path="/pro/analyses/new" element={<ProRoute><ProNewAnalysis /></ProRoute>} />
            <Route path="/pro/documents" element={<ProRoute><ProDocuments /></ProRoute>} />
            <Route path="/pro/company" element={<ProRoute><ProCompanyProfile /></ProRoute>} />
            <Route path="/pro/team" element={<ProRoute><ProTeam /></ProRoute>} />
            <Route path="/pro/tickets" element={<ProRoute><ProTickets /></ProRoute>} />
            <Route path="/pro/tickets/:id" element={<ProRoute><ProTicketDetail /></ProRoute>} />
            <Route path="/pro/settings" element={<ProRoute><ProSettings /></ProRoute>} />

            {/* Routes Phase 0 - Conception et Définition */}
            <Route path="/phase0" element={<ProtectedRoute><Phase0Dashboard /></ProtectedRoute>} />
            <Route path="/phase0/dashboard" element={<ProtectedRoute><Phase0Dashboard /></ProtectedRoute>} />
            <Route path="/phase0/new" element={<ProtectedRoute><Phase0Wizard /></ProtectedRoute>} />
            <Route path="/phase0/wizard/:projectId" element={<ProtectedRoute><Phase0Wizard /></ProtectedRoute>} />
            <Route path="/phase0/professional" element={<ProtectedRoute><Phase0Professional /></ProtectedRoute>} />
            <Route path="/phase0/project/:projectId" element={<ProtectedRoute><Phase0ProjectPage /></ProtectedRoute>} />
            <Route path="/phase0/project/:projectId/analyze" element={<ProtectedRoute><Phase0AnalyzeDevis /></ProtectedRoute>} />

            {/* Routes Phase 1 - Consultation & Sélection Entreprises */}
            <Route path="/phase1/project/:projectId" element={<ProtectedRoute><Phase1Consultation /></ProtectedRoute>} />
            <Route path="/phase1/project/:projectId/consultation" element={<ProtectedRoute><Phase1Consultation /></ProtectedRoute>} />

            {/* Liste des chantiers */}
            <Route path="/chantiers" element={<ProtectedRoute><ChantiersListPage /></ProtectedRoute>} />

            {/* Routes Phase 2 - Préparation de Chantier */}
            <Route path="/phase2/:projectId" element={<ProtectedRoute><ChantierLayout /></ProtectedRoute>}>
              <Route index element={<Phase2Dashboard />} />
              <Route path="dashboard" element={<Phase2Dashboard />} />
              <Route path="planning" element={<PlanningPage />} />
              <Route path="reunions" element={<ReunionsPage />} />
              <Route path="journal" element={<JournalPage />} />
            </Route>

            {/* Routes Phase 3 - Exécution Chantier */}
            <Route path="/phase3/:projectId" element={<ProtectedRoute><ChantierLayout /></ProtectedRoute>}>
              <Route index element={<Phase3Dashboard />} />
              <Route path="dashboard" element={<Phase3Dashboard />} />
              <Route path="controles" element={<ControlesPage />} />
              <Route path="coordination" element={<CoordinationPage />} />
              <Route path="situations" element={<SituationsPage />} />
            </Route>

            {/* Routes Phase 4 - Réception & Garanties */}
            <Route path="/phase4/:projectId" element={<ProtectedRoute><ChantierLayout /></ProtectedRoute>}>
              <Route index element={<Phase4Dashboard />} />
              <Route path="dashboard" element={<Phase4Dashboard />} />
              <Route path="reception" element={<OPRPage />} />
              <Route path="reserves" element={<ReservesPage />} />
              <Route path="garanties" element={<GarantiesPage />} />
              <Route path="doe" element={<DOEPage />} />
            </Route>

            {/* Routes Phase 5 - Maintenance & Exploitation */}
            <Route path="/phase5/:projectId" element={<ProtectedRoute><ChantierLayout /></ProtectedRoute>}>
              <Route index element={<Phase5Dashboard />} />
              <Route path="carnet" element={<Phase5Dashboard />} />
              <Route path="diagnostics" element={<DiagnosticsPage />} />
              <Route path="entretien" element={<EntretienPage />} />
              <Route path="sinistres" element={<SinistresPage />} />
            </Route>

            {/* Routes Appels d'Offres (MOA) */}
            <Route path="/tenders" element={<ProtectedRoute><TendersPage /></ProtectedRoute>} />
            <Route path="/tenders/:tenderId" element={<ProtectedRoute><TenderDetailPage /></ProtectedRoute>} />

            {/* Routes B2B Enterprise (Consultation AO) */}
            <Route path="/b2b/ao" element={<ProRoute><B2BTendersPage /></ProRoute>} />
            <Route path="/b2b/ao/:tenderId" element={<ProRoute><B2BTenderViewPage /></ProRoute>} />
            <Route path="/b2b/ao/:tenderId/response/:responseId" element={<ProRoute><B2BResponseFormPage /></ProRoute>} />

            {/* Fallback */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ErrorBoundary>
      <AppProvider>
        <TooltipProvider>
          <AppContent />
        </TooltipProvider>
      </AppProvider>
    </ErrorBoundary>
  </QueryClientProvider>
);

export default App;
