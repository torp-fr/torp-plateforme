import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppProvider, useApp } from "@/context/AppContext";
import ErrorBoundary from "@/components/ErrorBoundary";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Register from "./pages/Register";
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
import NotFound from "./pages/NotFound";
// Note: DiscoveryFlow obsolète, remplacé par Phase0Wizard
import TorpCompleteFlow from "./pages/TorpCompleteFlow";
import AlgorithmicSegments from "./pages/AlgorithmicSegments";
import KnowledgeBase from "./pages/KnowledgeBase";
import AdminAnalytics from "./pages/AdminAnalytics";
import AdminDiagnostic from "./pages/AdminDiagnostic";
import Compare from "./pages/Compare";
// B2B Pro Pages
import { ProRoute, ProtectedRoute } from "@/components/auth/ProRoute";
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
// Phase 0 Pages
import {
  Phase0Landing,
  Phase0Wizard,
  Phase0Professional,
  Phase0Dashboard,
  Phase0ProjectPage,
  Phase0AnalyzeDevis,
} from "./pages/phase0";
// Tender Pages (Appels d'Offres)
import { TendersPage, TenderDetailPage } from "./pages/tenders";
// B2B Enterprise Pages (Consultation AO)
import { B2BTendersPage, B2BTenderViewPage, B2BResponseFormPage } from "./pages/b2b";
// Phase 1 Pages (Consultation & Sélection Entreprises)
import { Phase1Consultation } from "./pages/phase1";
// Phase 2 Pages (Préparation de Chantier)
import { Phase2Dashboard } from "./pages/phase2";

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
          <Route path="/" element={<Index />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/analyze" element={<Analyze />} />
          <Route path="/results" element={<Results />} />
          <Route path="/results-interactive" element={<ResultsInteractive />} />
          <Route path="/dashboard" element={<ProtectedRoute><UnifiedDashboard /></ProtectedRoute>} />
          <Route path="/dashboard-legacy" element={<DashboardPage />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/demo" element={<Demo />} />
          <Route path="/project-tracking" element={<ProjectTracking />} />
          <Route path="/formula-picker" element={<FormulaPicker />} />
          <Route path="/admin-dashboard" element={<AdminDashboard />} />
          <Route path="/admin/analytics" element={<AdminAnalytics />} />
          <Route path="/admin/diagnostic" element={<AdminDiagnostic />} />
          <Route path="/project-dashboard" element={<ProjectDashboard />} />
          <Route path="/improved-b2b-dashboard" element={<ImprovedB2BDashboard />} />
          <Route path="/b2c-dashboard" element={<B2CDashboard />} />
          <Route path="/compare" element={<Compare />} />
          <Route path="/torp-complete" element={<TorpCompleteFlow />} />
          <Route path="/segments" element={<AlgorithmicSegments />} />
          <Route path="/knowledge-base" element={<KnowledgeBase />} />
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
          {/* Routes Phase 0 - Conception et Définition (protégées) */}
          <Route path="/phase0" element={<ProtectedRoute><Phase0Dashboard /></ProtectedRoute>} />
          <Route path="/phase0/dashboard" element={<ProtectedRoute><Phase0Dashboard /></ProtectedRoute>} />
          <Route path="/phase0/new" element={<ProtectedRoute><Phase0Wizard /></ProtectedRoute>} />
          <Route path="/phase0/wizard/:projectId" element={<ProtectedRoute><Phase0Wizard /></ProtectedRoute>} />
          <Route path="/phase0/professional" element={<ProtectedRoute><Phase0Professional /></ProtectedRoute>} />
          <Route path="/phase0/project/:projectId" element={<ProtectedRoute><Phase0ProjectPage /></ProtectedRoute>} />
          <Route path="/phase0/project/:projectId/analyze" element={<ProtectedRoute><Phase0AnalyzeDevis /></ProtectedRoute>} />
          {/* Routes Phase 1 - Consultation & Sélection Entreprises (protégées) */}
          <Route path="/phase1/project/:projectId" element={<ProtectedRoute><Phase1Consultation /></ProtectedRoute>} />
          <Route path="/phase1/project/:projectId/consultation" element={<ProtectedRoute><Phase1Consultation /></ProtectedRoute>} />
          {/* Routes Phase 2 - Préparation de Chantier (protégées) */}
          <Route path="/phase2/:projectId" element={<ProtectedRoute><Phase2Dashboard /></ProtectedRoute>} />
          <Route path="/phase2/:projectId/dashboard" element={<ProtectedRoute><Phase2Dashboard /></ProtectedRoute>} />
          {/* Routes Appels d'Offres (MOA) */}
          <Route path="/tenders" element={<ProtectedRoute><TendersPage /></ProtectedRoute>} />
          <Route path="/tenders/:tenderId" element={<ProtectedRoute><TenderDetailPage /></ProtectedRoute>} />
          {/* Routes B2B Enterprise (Consultation AO) */}
          <Route path="/b2b/ao" element={<ProRoute><B2BTendersPage /></ProRoute>} />
          <Route path="/b2b/ao/:tenderId" element={<ProRoute><B2BTenderViewPage /></ProRoute>} />
          <Route path="/b2b/ao/:tenderId/response/:responseId" element={<ProRoute><B2BResponseFormPage /></ProRoute>} />
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
