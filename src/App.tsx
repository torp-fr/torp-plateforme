import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppProvider } from "@/context/AppContext";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Analyze from "./pages/Analyze";
import Results from "./pages/Results";
import ResultsInteractive from "./pages/ResultsInteractive";
import DashboardPage from "./pages/DashboardPage";
import Projects from "./pages/Projects";
import Pricing from "./pages/Pricing";
import Demo from "./pages/Demo";
import ProjectTracking from "./pages/ProjectTracking";
import FormulaPicker from "./pages/FormulaPicker";
import AdminDashboard from "./pages/AdminDashboard";
import ProjectDashboard from "./pages/ProjectDashboard";
import PrescripteursDashboard from "./pages/PrescripteursDashboard";
import ImprovedB2BDashboard from "@/pages/ImprovedB2BDashboard";
import B2CDashboard from "./pages/B2CDashboard";
import NotFound from "./pages/NotFound";
import DiscoveryFlow from "./pages/DiscoveryFlow";
import TorpCompleteFlow from "./pages/TorpCompleteFlow";
import AlgorithmicSegments from "./pages/AlgorithmicSegments";
import KnowledgeBase from "./pages/KnowledgeBase";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AppProvider>
      <TooltipProvider>
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
            <Route path="/projects" element={<Projects />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/demo" element={<Demo />} />
            <Route path="/project-tracking" element={<ProjectTracking />} />
            <Route path="/formula-picker" element={<FormulaPicker />} />
            <Route path="/admin-dashboard" element={<AdminDashboard />} />
            <Route path="/project-dashboard" element={<ProjectDashboard />} />
            <Route path="/improved-b2b-dashboard" element={<ImprovedB2BDashboard />} />
            <Route path="/b2c-dashboard" element={<B2CDashboard />} />
            {/* Route désactivée - wizard obsolète */}
            {/* <Route path="/discovery" element={<DiscoveryFlow />} /> */}
            <Route path="/torp-complete" element={<TorpCompleteFlow />} />
            <Route path="/segments" element={<AlgorithmicSegments />} />
            <Route path="/knowledge-base" element={<KnowledgeBase />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AppProvider>
  </QueryClientProvider>
);

export default App;
import { FeedbackWidget } from '@/components/feedback/FeedbackWidget';

// Dans votre fonction App():
return (
  <BrowserRouter>
    {/* Vos routes existantes */}
    <Routes>
      {/* ... */}
    </Routes>

    {/* 👇 Ajoutez ceci à la fin */}
    <FeedbackWidget userType={currentUserType} />
  </BrowserRouter>
);
import AdminAnalytics from './pages/AdminAnalytics';

// Dans vos routes:
<Route path="/admin/analytics" element={<AdminAnalytics />} />
