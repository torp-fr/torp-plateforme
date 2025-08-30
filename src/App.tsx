import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppProvider } from "@/context/AppContext";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Analyze from "./pages/Analyze";
import Results from "./pages/Results";
import ResultsInteractive from "./pages/ResultsInteractive";
import DashboardPage from "./pages/DashboardPage";
import Projects from "./pages/Projects";
import Pricing from "./pages/Pricing";
import Demo from "./pages/Demo";
import ProjectTracking from "./pages/ProjectTracking";
import FinancingPlatform from "./pages/FinancingPlatform";
import NotFound from "./pages/NotFound";

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
            <Route path="/analyze" element={<Analyze />} />
            <Route path="/results" element={<Results />} />
            <Route path="/results-interactive" element={<ResultsInteractive />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/demo" element={<Demo />} />
            <Route path="/project-tracking" element={<ProjectTracking />} />
            <Route path="/financing" element={<FinancingPlatform />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AppProvider>
  </QueryClientProvider>
);

export default App;
