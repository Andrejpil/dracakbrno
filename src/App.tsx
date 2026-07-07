import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { GameProvider } from "@/contexts/GameContext";
import { CalendarProvider } from "@/contexts/CalendarContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { WorldProvider } from "@/contexts/WorldContext";
import AppSidebar from "@/components/AppSidebar";
import HeroesPage from "@/pages/HeroesPage";
import BestiaryPage from "@/pages/BestiaryPage";
import BattlePage from "@/pages/BattlePage";
import XPPage from "@/pages/XPPage";
import StatsPage from "@/pages/StatsPage";
import ExportPage from "@/pages/ExportPage";
import AdminPage from "@/pages/AdminPage";
import MapPage from "@/pages/MapPage";
import NPCPage from "@/pages/NPCPage";
import EncounterPage from "@/pages/EncounterPage";
import ChroniclePage from "@/pages/ChroniclePage";
import WorldsPage from "@/pages/WorldsPage";
import EmptyWorldsState from "@/components/EmptyWorldsState";
import { useWorld } from "@/contexts/WorldContext";
import { Skeleton } from "@/components/ui/skeleton";

import AuthPage from "@/pages/AuthPage";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

function AppLoadingSkeleton() {
  return (
    <div className="flex min-h-screen">
      <div className="w-56 border-r p-4 space-y-3">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-6 w-full" />
      </div>
      <main className="flex-1 p-6 space-y-4">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-24 w-full" />
      </main>
    </div>
  );
}

function WorldGate() {
  const { worlds, loading: worldsLoading } = useWorld();
  const { pathname } = useLocation();
  if (worldsLoading) return <AppLoadingSkeleton />;
  if (worlds.length === 0 && pathname !== '/svety') return <EmptyWorldsState />;
  return (
    <CalendarProvider>
      <div className="flex min-h-screen">
        <AppSidebar />
        <main className="flex-1 p-6 overflow-auto">
          <Routes>
            <Route path="/" element={<HeroesPage />} />
            <Route path="/bestiar" element={<BestiaryPage />} />
            <Route path="/boj" element={<BattlePage />} />
            <Route path="/setkani" element={<EncounterPage />} />
            <Route path="/zkusenosti" element={<XPPage />} />
            <Route path="/statistika" element={<StatsPage />} />
            <Route path="/zabiti" element={<StatsPage />} />
            <Route path="/npc" element={<NPCPage />} />
            <Route path="/kronika" element={<ChroniclePage />} />
            <Route path="/export" element={<ExportPage />} />
            <Route path="/mapa" element={<MapPage />} />
            <Route path="/svety" element={<WorldsPage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
      </div>
    </CalendarProvider>
  );
}

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) return <AppLoadingSkeleton />;
  if (!user) return <AuthPage />;

  return (
    <GameProvider>
      <WorldProvider>
        <WorldGate />
      </WorldProvider>
    </GameProvider>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <AppContent />
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
