import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { ThemeProvider } from "next-themes";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { AuthGuard } from "@/components/AuthGuard";
import { ColdStartRedirect } from "@/components/ColdStartRedirect";
import Dashboard from "./pages/Dashboard";
import Clients from "./pages/Clients";
import EstimationPage from "./pages/Estimation";
import Jobs from "./pages/Jobs";
import JobDetailEditor from "@/components/jobs/JobDetailEditor";
import CalendarPage from "./pages/Calendar";
import Invoices from "./pages/Invoices";
import Finance from "./pages/Finance";
import FinanceApercu from "./pages/FinanceApercu";
import FinanceDepenses from "./pages/FinanceDepenses";
import FinancePaie from "./pages/FinancePaie";
import FinanceHistorique from "./pages/FinanceHistorique";
import Employees from "./pages/Employees";
import Reminders from "./pages/Reminders";
import Analytics from "./pages/Analytics";
import Settings from "./pages/Settings";
import Messagerie from "./pages/Messagerie";
import Auth from "./pages/Auth";
import Unauthorized from "./pages/Unauthorized";
import Unsubscribe from "./pages/Unsubscribe";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ErrorBoundary>
    <ThemeProvider attribute="class" defaultTheme="light">
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <ColdStartRedirect />
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route path="/unauthorized" element={<Unauthorized />} />
          <Route path="/unsubscribe" element={<Unsubscribe />} />
          <Route
            path="/*"
            element={
              <AuthGuard>
                <AppLayout>
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/clients" element={<Clients />} />
                    <Route path="/clients/estimation" element={<Clients />} />
                    <Route path="/estimation" element={<EstimationPage />} />
                    <Route path="/jobs" element={<Jobs />} />
                    <Route path="/jobs/:jobId/edit-details" element={<JobDetailEditor />} />
                    <Route path="/calendar" element={<CalendarPage />} />
                    <Route path="/invoices" element={<Invoices />} />
                    <Route path="/finance" element={<Finance />} />
                    <Route path="/finance/apercu" element={<FinanceApercu />} />
                    <Route path="/finance/depenses" element={<FinanceDepenses />} />
                    <Route path="/finance/paie" element={<FinancePaie />} />
                    <Route path="/finance/historique" element={<FinanceHistorique />} />
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
    </ThemeProvider>
    </ErrorBoundary>
  </QueryClientProvider>
);

export default App;
