import React from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppProvider, useApp } from "@/context/AppContext";
import { ErrorBoundary } from "@/components/error/ErrorBoundary";

// ============================================
// IMPORTS STATIQUES - Toutes les pages
// ============================================

// Pages critiques
import LandingPage from "./pages/LandingPage";
import Login from "./pages/Login";
import Register from "./pages/Register";
import NotFound from "./pages/NotFound";
import { ProRoute, ProtectedRoute } from "@/components/auth/ProRoute";
import ChantierLayout from "./components/layout/ChantierLayout";

// Pages Utilitaires
import Index from "./pages/Index";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Profile from "./pages/Profile";
import Analyze from "./pages/Analyze";
import Results from "./pages/Results";
import ResultsInteractive from "./pages/ResultsInteractive";
import DashboardPage from "./pages/DashboardPage";
import UnifiedDashboard from "./pages/UnifiedDashboard";
import Pricing from "./pages/Pricing";
import Demo from "./pages/Demo";
import ProjectTracking from "./pages/ProjectTracking";
import FormulaPicker from "./pages/FormulaPicker";
import AdminDashboard from "./pages/AdminDashboard";
import ProjectDashboard from "./pages/ProjectDashboard";
import ImprovedB2BDashboard from "@/pages/ImprovedB2BDashboard";
import B2CDashboard from "./pages/B2CDashboard";
import TorpCompleteFlow from "./pages/TorpCompleteFlow";
import AlgorithmicSegments from "./pages/AlgorithmicSegments";
import KnowledgeBase from "./pages/KnowledgeBase";
import AdminAnalytics from "./pages/AdminAnalytics";
import AdminDiagnostic from "./pages/AdminDiagnostic";
import Compare from "./pages/Compare";
import EntreprisesPage from "./pages/EntreprisesPage";

// B2B Pro Pages
import ProDashboard from "./pages/pro/ProDashboard";
import ProOnboarding from "./pages/pro/ProOnboarding";
import ProAnalyses from "./pages/pro/ProAnalyses";
import ProNewAnalysis from "./pages/pro/ProNewAnalysis";
import ProDocuments from "./pages/pro/ProDocuments";
import ProTickets from "./pages/pro/ProTickets";
import ProTicketDetail from "./pages/pro/ProTicketDetail";
import ProSettings from "./pages/pro/ProSettings";
import ProProjects from "./pages/pro/ProProjects";
import ProNewProject from "./pages/pro/ProNewProject";
import ProCompanyProfile from "./pages/pro/ProCompanyProfile";
import ProTeam from "./pages/pro/ProTeam";

// Phase 0 (Conception)
import Phase0Landing from "./pages/phase0/Phase0Landing";
import Phase0Wizard from "./pages/phase0/Phase0Wizard";
import Phase0Professional from "./pages/phase0/Phase0Professional";
import Phase0Dashboard from "./pages/phase0/Phase0Dashboard";
import Phase0ProjectPage from "./pages/phase0/Phase0Project";
import Phase0AnalyzeDevis from "./pages/phase0/Phase0AnalyzeDevis";

// Phase 1 (Consultation)
import Phase1Consultation from "./pages/phase1/Phase1Consultation";

// Phase 2 (Préparation)
import Phase2Dashboard from "./pages/phase2/Phase2Dashboard";
import PlanningPage from "./pages/phase2/PlanningPage";
import ReunionsPage from "./pages/phase2/ReunionsPage";
import JournalPage from "./pages/phase2/JournalPage";
import ChantiersListPage from "./pages/phase2/ChantiersListPage";

// Phase 3 (Exécution)
import Phase3Dashboard from "./pages/phase3/Phase3Dashboard";
import ControlesPage from "./pages/phase3/ControlesPage";
import CoordinationPage from "./pages/phase3/CoordinationPage";
import SituationsPage from "./pages/phase3/SituationsPage";

// Phase 4 (Réception)
import Phase4Dashboard from "./pages/phase4/Phase4Dashboard";
import OPRPage from "./pages/phase4/OPRPage";
import ReservesPage from "./pages/phase4/ReservesPage";
import GarantiesPage from "./pages/phase4/GarantiesPage";
import DOEPage from "./pages/phase4/DOEPage";

// Phase 5 (Maintenance)
import Phase5Dashboard from "./pages/phase5/Phase5Dashboard";
import DiagnosticsPage from "./pages/phase5/DiagnosticsPage";
import EntretienPage from "./pages/phase5/EntretienPage";
import SinistresPage from "./pages/phase5/SinistresPage";

// Tenders & B2B
import TendersPage from "./pages/tenders/TendersPage";
import TenderDetailPage from "./pages/tenders/TenderDetailPage";
import B2BTendersPage from "./pages/b2b/B2BTendersPage";
import B2BTenderViewPage from "./pages/b2b/B2BTenderViewPage";
import B2BResponseFormPage from "./pages/b2b/B2BResponseFormPage";

const queryClient = new QueryClient();

// Composant interne pour accéder au contexte
const AppContent = () => {
  const { userType } = useApp();

  return (
    <>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Routes publiques */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
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
          <Route path="/entreprises" element={<ProtectedRoute><EntreprisesPage /></ProtectedRoute>} />
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
