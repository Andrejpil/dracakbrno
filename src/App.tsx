import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { GameProvider } from "@/contexts/GameContext";
import AppSidebar from "@/components/AppSidebar";
import HeroesPage from "@/pages/HeroesPage";
import BestiaryPage from "@/pages/BestiaryPage";
import BattlePage from "@/pages/BattlePage";
import XPPage from "@/pages/XPPage";
import StatsPage from "@/pages/StatsPage";
import ExportPage from "@/pages/ExportPage";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <GameProvider>
          <div className="flex min-h-screen">
            <AppSidebar />
            <main className="flex-1 p-6 overflow-auto">
              <Routes>
                <Route path="/" element={<HeroesPage />} />
                <Route path="/bestiar" element={<BestiaryPage />} />
                <Route path="/boj" element={<BattlePage />} />
                <Route path="/zkusenosti" element={<XPPage />} />
                <Route path="/statistika" element={<StatsPage />} />
                <Route path="/export" element={<ExportPage />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </main>
          </div>
        </GameProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
