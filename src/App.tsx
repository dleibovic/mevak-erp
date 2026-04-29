import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import AppLayout from "./layouts/AppLayout";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Clients from "./pages/Clients";
import Billing from "./pages/Billing";
import Employees from "./pages/Employees";
import Expenses from "./pages/Expenses";
import Analytics from "./pages/Analytics";
import Alerts from "./pages/Alerts";
import Admin from "./pages/Admin";
import Prospecting from "./pages/Prospecting";
import NotFound from "./pages/NotFound.tsx";
import { CountryFilterProvider } from "./hooks/useCountryFilter";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <CountryFilterProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route element={<AppLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/clientes" element={<Clients />} />
            <Route path="/prospecting" element={<Prospecting />} />
            <Route path="/facturacion" element={<Billing />} />
            <Route path="/empleados" element={<Employees />} />
            <Route path="/gastos" element={<Expenses />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/alertas" element={<Alerts />} />
            <Route path="/admin" element={<Admin />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
      </CountryFilterProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
