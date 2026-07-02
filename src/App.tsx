import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import Login from "@/pages/Login";
import React, { Suspense } from "react";
import NotFound from "./pages/NotFound";

const Dashboard = React.lazy(() => import("./pages/dashboard").then((module) => ({ default: module.Dashboard })));
const Users = React.lazy(() => import("./pages/dashboard/Users"));
const Vehicles = React.lazy(() => import("./pages/dashboard/Vehicles"));
const CreateDelivery = React.lazy(() => import("./pages/dashboard/CreateDelivery"));
const Deliveries = React.lazy(() => import("./pages/dashboard/Deliveries"));
const UserManagement = React.lazy(() => import("./pages/dashboard/UserManagement"));
const Tracking = React.lazy(() => import("./pages/dashboard/Tracking"));
const Reports = React.lazy(() => import("./pages/dashboard/Reports"));
const Companies = React.lazy(() => import("./pages/dashboard/Companies"));
const ReceiptsReport = React.lazy(() => import("./pages/dashboard/ReceiptsReport").then((module) => ({ default: module.ReceiptsReport })));


const queryClient = new QueryClient();

let serviceWorkerReloading = false;

if (typeof window !== "undefined" && "serviceWorker" in navigator) {
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (serviceWorkerReloading) return;
    serviceWorkerReloading = true;
    window.location.reload();
  });
}

const PageFallback = () => (
  <div className="flex items-center justify-center h-full min-h-96">
    <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
  </div>
);

const PageSuspense = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={<PageFallback />}>
    {children}
  </Suspense>
);

// Route wrapper component to handle initial redirect
const AppRoutes = () => {
  const { isAuthenticated, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">Carregando sistema...</p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route 
        path="/" 
        element={
          isAuthenticated ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />
        } 
      />
      <Route 
        path="/login" 
        element={
          isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />
        } 
      />
      <Route 
        path="/dashboard" 
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <PageSuspense>
                <Dashboard />
              </PageSuspense>
            </DashboardLayout>
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/dashboard/usuarios" 
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <PageSuspense>
                <Users />
              </PageSuspense>
            </DashboardLayout>
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/dashboard/veiculos" 
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <PageSuspense>
                <Vehicles />
              </PageSuspense>
            </DashboardLayout>
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/dashboard/rastreamento" 
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <PageSuspense>
                <Tracking />
              </PageSuspense>
            </DashboardLayout>
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/dashboard/relatorios" 
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <PageSuspense>
                <Reports />
              </PageSuspense>
            </DashboardLayout>
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/dashboard/empresas" 
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <PageSuspense>
                <Companies />
              </PageSuspense>
            </DashboardLayout>
          </ProtectedRoute>
        } 
      />
      <Route
        path="/dashboard/receipts-report"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <PageSuspense>
                <ReceiptsReport />
              </PageSuspense>
            </DashboardLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/entregas"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <PageSuspense>
                <Deliveries />
              </PageSuspense>
            </DashboardLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/entregas-do-dia"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <PageSuspense>
                <CreateDelivery />
              </PageSuspense>
            </DashboardLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/gerenciamento-usuarios"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <PageSuspense>
                <UserManagement />
              </PageSuspense>
            </DashboardLayout>
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
