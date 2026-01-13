import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { AuthProvider } from "@/contexts/AuthContext";
import { PrivateRoute } from "@/components/PrivateRoute";
import Dashboard from "./pages/Dashboard";
import Evaluation from "./pages/Evaluation";
import TeamStatus from "./pages/TeamStatus";
import HRAdmin from "./pages/HRAdmin";
import AuthCallback from "./pages/AuthCallback";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner position="top-center" />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              {/* Auth callback must be OUTSIDE PrivateRoute */}
              <Route path="/auth/callback" element={<AuthCallback />} />
              
              {/* Protected routes */}
              <Route element={<PrivateRoute><Dashboard /></PrivateRoute>} path="/" />
              <Route path="/evaluation" element={<PrivateRoute><Evaluation /></PrivateRoute>} />
              <Route path="/team-status" element={<PrivateRoute><TeamStatus /></PrivateRoute>} />
              <Route path="/hr-admin" element={<PrivateRoute><HRAdmin /></PrivateRoute>} />
              
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </HelmetProvider>
);

export default App;