import { forwardRef, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import AppLayout from "./layouts/AppLayout";
import { CountryFilterProvider } from "./hooks/useCountryFilter";
import { lazyWithRetry } from "@/lib/lazyWithRetry";

const queryClient = new QueryClient();

const Auth = lazyWithRetry(() => import("./pages/Auth"));
const Dashboard = lazyWithRetry(() => import("./pages/Dashboard"));
const Clients = lazyWithRetry(() => import("./pages/Clients"));
const Billing = lazyWithRetry(() => import("./pages/Billing"));
const Employees = lazyWithRetry(() => import("./pages/Employees"));
const Expenses = lazyWithRetry(() => import("./pages/Expenses"));
const Analytics = lazyWithRetry(() => import("./pages/Analytics"));
const Alerts = lazyWithRetry(() => import("./pages/Alerts"));
const Admin = lazyWithRetry(() => import("./pages/Admin"));
const Prospecting = lazyWithRetry(() => import("./pages/Prospecting"));
const MetricasSaaS = lazyWithRetry(() => import("./pages/MetricasSaaS"));
const Churn = lazyWithRetry(() => import("./pages/Churn"));
const LtvRentabilidad = lazyWithRetry(() => import("./pages/LtvRentabilidad"));
const NotFound = lazyWithRetry(() => import("./pages/NotFound.tsx"));

const AppLoading = forwardRef<HTMLDivElement>((_, ref) => {
  return (
    <div ref={ref} className="min-h-screen flex items-center justify-center bg-background text-foreground">
      <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  );
});

AppLoading.displayName = "AppLoading";

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
              <Route path="/metricas-saas" element={<MetricasSaaS />} />
              <Route path="/churn" element={<Churn />} />
              <Route path="/ltv-rentabilidad" element={<LtvRentabilidad />} />
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
