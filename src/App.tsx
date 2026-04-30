import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import AppLayout from "./layouts/AppLayout";
import { CountryFilterProvider } from "./hooks/useCountryFilter";

const queryClient = new QueryClient();

const Auth = lazy(() => import("./pages/Auth"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Clients = lazy(() => import("./pages/Clients"));
const Billing = lazy(() => import("./pages/Billing"));
const Employees = lazy(() => import("./pages/Employees"));
const Expenses = lazy(() => import("./pages/Expenses"));
const Analytics = lazy(() => import("./pages/Analytics"));
const Alerts = lazy(() => import("./pages/Alerts"));
const Admin = lazy(() => import("./pages/Admin"));
const Prospecting = lazy(() => import("./pages/Prospecting"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));

function AppLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
      <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <CountryFilterProvider>
      <BrowserRouter>
        <Suspense fallback={<AppLoading />}>
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
        </Suspense>
      </BrowserRouter>
      </CountryFilterProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
