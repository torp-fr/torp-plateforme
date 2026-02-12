import React from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppProvider, useApp } from "@/context/AppContext";
import { ErrorBoundary } from "@/components/error/ErrorBoundary";

// ============================================
// LAYOUTS
// ============================================
import MainLayout from "./components/layout/MainLayout";
import ChantierLayout from "./components/layout/ChantierLayout";

// ============================================
// PAGES PUBLIQUES
// ============================================
import LandingPage from "./pages/LandingPage";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Pricing from "./pages/Pricing";
import NotFound from "./pages/NotFound";

// ============================================
// AUTH & PROTECTION
// ============================================
import { ProRoute, ProtectedRoute } from "@/components/auth/ProRoute";

// ============================================
// NOUVEAU PARCOURS UNIFIÉ
// ============================================
import DashboardUnifie from "./pages/DashboardUnifie";
import ProjetPage from "./pages/projet/ProjetPage";
import ProjetsListePage from "./pages/projet/ProjetsListePage";

// ============================================
// PAGES UTILITAIRES
// ============================================
import Profile from "./pages/Profile";
import Analyze from "./pages/Analyze";
import Results from "./pages/Results";
import ResultsInteractive from "./pages/ResultsInteractive";
import Compare from "./pages/Compare";

// ============================================
// PAGES B2B PRO
// ============================================
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

// ============================================
// PAGES PHASES (pour compatibilité)
// ============================================
import Phase2Dashboard from "./pages/phase2/Phase2Dashboard";
import PlanningPage from "./pages/phase2/PlanningPage";
import ReunionsPage from "./pages/phase2/ReunionsPage";
import JournalPage from "./pages/phase2/JournalPage";
import ChantiersListPage from "./pages/phase2/ChantiersListPage";
import Phase5Dashboard from "./pages/phase5/Phase5Dashboard";
import DiagnosticsPage from "./pages/phase5/DiagnosticsPage";
import EntretienPage from "./pages/phase5/EntretienPage";
import SinistresPage from "./pages/phase5/SinistresPage";

// ============================================
// PAGES B2B TENDERS
// ============================================
import TendersPage from "./pages/tenders/TendersPage";
import TenderDetailPage from "./pages/tenders/TenderDetailPage";
import B2BTendersPage from "./pages/b2b/B2BTendersPage";
import B2BTenderViewPage from "./pages/b2b/B2BTenderViewPage";
import B2BResponseFormPage from "./pages/b2b/B2BResponseFormPage";

// ============================================
// PAGES ADMIN
// ============================================

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
          {/* ============================================ */}
          {/* ROUTES PUBLIQUES */}
          {/* ============================================ */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/pricing" element={<Pricing />} />

          {/* ============================================ */}
          {/* ROUTES PROTÉGÉES AVEC MAINLAYOUT */}
          {/* ============================================ */}
          <Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
            {/* Dashboard principal */}
            <Route path="/dashboard" element={<DashboardUnifie />} />

            {/* Projets - Nouveau parcours unifié */}
            <Route path="/projets" element={<ProjetsListePage />} />
            <Route path="/projet/:projectId" element={<ProjetPage />} />

            {/* Outils */}
            <Route path="/analyze" element={<Analyze />} />
            <Route path="/results" element={<Results />} />
            <Route path="/results-interactive" element={<ResultsInteractive />} />
            <Route path="/compare" element={<Compare />} />

            {/* Profil et paramètres */}
            <Route path="/profile" element={<Profile />} />
            <Route path="/parametres" element={<Profile />} />

            {/* Liste des chantiers */}
            <Route path="/chantiers" element={<ChantiersListPage />} />
          </Route>

          {/* ============================================ */}
          {/* ROUTES B2B PRO */}
          {/* ============================================ */}
          <Route element={<ProRoute><MainLayout /></ProRoute>}>
            <Route path="/pro" element={<ProDashboard />} />
            <Route path="/pro/onboarding" element={<ProOnboarding />} />
            <Route path="/pro/projects" element={<ProProjects />} />
            <Route path="/pro/projects/new" element={<ProNewProject />} />
            <Route path="/pro/analyses" element={<ProAnalyses />} />
            <Route path="/pro/analyses/new" element={<ProNewAnalysis />} />
            <Route path="/pro/documents" element={<ProDocuments />} />
            <Route path="/pro/company" element={<ProCompanyProfile />} />
            <Route path="/pro/team" element={<ProTeam />} />
            <Route path="/pro/tickets" element={<ProTickets />} />
            <Route path="/pro/tickets/:id" element={<ProTicketDetail />} />
            <Route path="/pro/settings" element={<ProSettings />} />
            <Route path="/b2b/ao" element={<B2BTendersPage />} />
            <Route path="/b2b/ao/:tenderId" element={<B2BTenderViewPage />} />
            <Route path="/b2b/ao/:tenderId/response/:responseId" element={<B2BResponseFormPage />} />
          </Route>


          {/* Routes Phases 2-5 avec ChantierLayout */}
          <Route path="/phase2/:projectId" element={<ProtectedRoute><ChantierLayout /></ProtectedRoute>}>
            <Route index element={<Phase2Dashboard />} />
            <Route path="dashboard" element={<Phase2Dashboard />} />
            <Route path="planning" element={<PlanningPage />} />
            <Route path="reunions" element={<ReunionsPage />} />
            <Route path="journal" element={<JournalPage />} />
          </Route>
          <Route path="/phase5/:projectId" element={<ProtectedRoute><ChantierLayout /></ProtectedRoute>}>
            <Route index element={<Phase5Dashboard />} />
            <Route path="carnet" element={<Phase5Dashboard />} />
            <Route path="diagnostics" element={<DiagnosticsPage />} />
            <Route path="entretien" element={<EntretienPage />} />
            <Route path="sinistres" element={<SinistresPage />} />
          </Route>

          {/* Tenders */}
          <Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
            <Route path="/tenders" element={<TendersPage />} />
            <Route path="/tenders/:tenderId" element={<TenderDetailPage />} />
          </Route>


          {/* ============================================ */}
          {/* FALLBACK */}
          {/* ============================================ */}
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
