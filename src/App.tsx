import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppProvider, useApp } from "@/context/AppContext";
import { FeedbackWidget } from "@/components/feedback/FeedbackWidget";
import ErrorBoundary from "@/components/ErrorBoundary";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Analyze from "./pages/Analyze";
import Results from "./pages/Results";
import ResultsInteractive from "./pages/ResultsInteractive";
import DashboardPage from "./pages/DashboardPage";
import Pricing from "./pages/Pricing";
import Demo from "./pages/Demo";
import ProjectTracking from "./pages/ProjectTracking";
import FormulaPicker from "./pages/FormulaPicker";
import AdminDashboard from "./pages/AdminDashboard";
import ProjectDashboard from "./pages/ProjectDashboard";
import PrescripteursDashboard from "./pages/PrescripteursDashboard";
import ProDashboard from "@/pages/pro/ProDashboard";
import ProOnboarding from "@/pages/pro/ProOnboarding";
import NewProAnalysis from "@/pages/pro/NewProAnalysis";
import B2CDashboard from "./pages/B2CDashboard";
import NotFound from "./pages/NotFound";
import DiscoveryFlow from "./pages/DiscoveryFlow";
import TorpCompleteFlow from "./pages/TorpCompleteFlow";
import AlgorithmicSegments from "./pages/AlgorithmicSegments";
import KnowledgeBase from "./pages/KnowledgeBase";
import AdminAnalytics from "./pages/AdminAnalytics";
import AdminDiagnostic from "./pages/AdminDiagnostic";

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
          <Route path="/analyze" element={<Analyze />} />
          <Route path="/results" element={<Results />} />
          <Route path="/results-interactive" element={<ResultsInteractive />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/demo" element={<Demo />} />
          <Route path="/project-tracking" element={<ProjectTracking />} />
          <Route path="/formula-picker" element={<FormulaPicker />} />
          <Route path="/admin-dashboard" element={<AdminDashboard />} />
          <Route path="/admin/analytics" element={<AdminAnalytics />} />
          <Route path="/admin/diagnostic" element={<AdminDiagnostic />} />
          <Route path="/project-dashboard" element={<ProjectDashboard />} />
          {/* Routes B2B Pro - Module professionnel */}
          <Route path="/pro/dashboard" element={<ProDashboard />} />
          <Route path="/pro/onboarding" element={<ProOnboarding />} />
          <Route path="/pro/new-analysis" element={<NewProAnalysis />} />
          <Route path="/improved-b2b-dashboard" element={<ProDashboard />} /> {/* Redirection ancienne URL */}
          <Route path="/b2c-dashboard" element={<B2CDashboard />} />
          {/* Route désactivée - wizard obsolète */}
          {/* <Route path="/discovery" element={<DiscoveryFlow />} /> */}
          <Route path="/torp-complete" element={<TorpCompleteFlow />} />
          <Route path="/segments" element={<AlgorithmicSegments />} />
          <Route path="/knowledge-base" element={<KnowledgeBase />} />
          <Route path="*" element={<NotFound />} />
        </Routes>

        {/* 🎉 Widget de feedback pour testeurs */}
        {(userType === 'B2C' || userType === 'B2B') && (
          <FeedbackWidget userType={userType} />
        )}
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
