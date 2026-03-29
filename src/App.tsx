import React from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppProvider, useApp } from "@/context/AppContext";
import { ErrorBoundary } from "@/components/error/ErrorBoundary";

// Layouts - ISOLATED
import AdminLayout from "./components/layout/AdminLayout";
import UserLayout from "./components/layout/UserLayout";

// Pages - Core MVP (Public)
import LandingPage from "./pages/LandingPage";
import QuotePage from "./pages/QuotePage";
import QuoteSuccessPage from "./pages/QuoteSuccessPage";
import QuoteUploadPage from "./pages/QuoteUploadPage";
import QuoteAnalysisPage from "./pages/QuoteAnalysisPage";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";

// Auth - Route Protection
import { ProtectedRoute } from "@/components/auth/ProRoute";
import { AdminRoute } from "@/components/auth/AdminRoute";

// User Pages
import Dashboard from "./pages/Dashboard";
import Settings from "./pages/Settings";
import ProjetPage from "./pages/projet/ProjetPage";
import ProjetsListePage from "./pages/projet/ProjetsListePage";
import Profile from "./pages/Profile";
import Analyze from "./pages/Analyze";
import Results from "./pages/Results";
import JobStatusPage from "./pages/analysis/JobStatusPage";

// Admin Pages
import { DashboardPage } from "./pages/admin/DashboardPage";
import { SystemHealthPage } from "./pages/admin/SystemHealthPage";
import { LiveIntelligencePage } from "./pages/admin/LiveIntelligencePage";
import { OrchestrationsPage } from "./pages/admin/OrchestrationsPage";
import { KnowledgeBasePage } from "./pages/admin/KnowledgeBasePage";
import { AdminUsersPage } from "./pages/admin/AdminUsersPage";
import { AdminSettingsPage } from "./pages/admin/AdminSettingsPage";
import { KnowledgeControlCenter } from "./features/knowledge/KnowledgeControlCenter";
import { APIMonitoringPage } from "./pages/admin/APIMonitoringPage";
import { CostTrackingPage } from "./pages/admin/CostTrackingPage";
import { PipelineHealthPage } from "./pages/admin/PipelineHealthPage";
import { SecurityPage } from "./pages/admin/SecurityPage";
import RenovationAidsPage from "./pages/admin/RenovationAidsPage";
import NaturalHazardsPage from "./pages/admin/NaturalHazardsPage";

const queryClient = new QueryClient();

const AppContent = () => {
  const { isLoading } = useApp();

  // Show a full-page spinner while auth initialises.
  // This prevents route guards from redirecting to /login before the session
  // has been read — which would cause a flash-of-unauthenticated-state.
  if (isLoading) {
    return (
      <>
        <Toaster />
        <Sonner />
        <div className="flex items-center justify-center h-screen bg-background">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
            <p className="text-muted-foreground text-sm">Initialisation...</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* ============================================ */}
          {/* PUBLIC ROUTES - No authentication required */}
          {/* ============================================ */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/quote" element={<QuotePage />} />
          <Route path="/quote-success" element={<QuoteSuccessPage />} />
          <Route path="/quote-upload" element={<QuoteUploadPage />} />
          <Route path="/quote-analysis" element={<QuoteAnalysisPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* ============================================ */}
          {/* ADMIN ROUTES - Admin-only protection */}
          {/* ============================================ */}
          <Route element={<AdminRoute><AdminLayout /></AdminRoute>}>
            <Route path="/admin">
              <Route index element={<DashboardPage />} />
              <Route path="system" element={<SystemHealthPage />} />
              <Route path="intelligence" element={<LiveIntelligencePage />} />
              <Route path="orchestrations" element={<OrchestrationsPage />} />
              <Route path="knowledge" element={<KnowledgeBasePage />} />
              <Route path="knowledge-debug" element={<KnowledgeControlCenter />} />
              <Route path="users" element={<AdminUsersPage />} />
              <Route path="settings" element={<AdminSettingsPage />} />
              <Route path="api-monitoring" element={<APIMonitoringPage />} />
              <Route path="costs" element={<CostTrackingPage />} />
              <Route path="pipeline-health" element={<PipelineHealthPage />} />
              <Route path="security" element={<SecurityPage />} />
              <Route path="aids" element={<RenovationAidsPage />} />
              <Route path="hazards" element={<NaturalHazardsPage />} />
            </Route>
          </Route>

          {/* Backward-compatibility redirect */}
          <Route path="/analytics/*" element={<Navigate to="/admin" replace />} />

          {/* ============================================ */}
          {/* USER ROUTES - Authenticated user protection */}
          {/* ============================================ */}
          <Route element={<ProtectedRoute><UserLayout /></ProtectedRoute>}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/analyze" element={<Analyze />} />
            <Route path="/analysis/job/:jobId" element={<JobStatusPage />} />
            <Route path="/projects" element={<ProjetsListePage />} />
            <Route path="/project/:projectId" element={<ProjetPage />} />
            <Route path="/company" element={<Settings />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/results" element={<Results />} />
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
