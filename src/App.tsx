import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { AuthGuard } from "@/components/AuthGuard";
import Dashboard from "./pages/Dashboard";
import Clients from "./pages/Clients";
import EstimationPage from "./pages/Estimation";
import Jobs from "./pages/Jobs";
import CalendarPage from "./pages/Calendar";
import Invoices from "./pages/Invoices";
import Finance from "./pages/Finance";
import Employees from "./pages/Employees";
import Reminders from "./pages/Reminders";
import Analytics from "./pages/Analytics";
import Settings from "./pages/Settings";
import Messagerie from "./pages/Messagerie";
import Auth from "./pages/Auth";
import Unauthorized from "./pages/Unauthorized";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route path="/unauthorized" element={<Unauthorized />} />
          <Route
            path="/*"
            element={
              <AuthGuard>
                <AppLayout>
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/clients" element={<Clients />} />
                    <Route path="/estimation" element={<EstimationPage />} />
                    <Route path="/jobs" element={<Jobs />} />
                    <Route path="/calendar" element={<CalendarPage />} />
                    <Route path="/invoices" element={<Invoices />} />
                    <Route path="/finance" element={<Finance />} />
                    <Route path="/employees" element={<Employees />} />
                    <Route path="/reminders" element={<Reminders />} />
                    <Route path="/messagerie" element={<Messagerie />} />
                    <Route path="/analytics" element={<Analytics />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </AppLayout>
              </AuthGuard>
            }
          />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
