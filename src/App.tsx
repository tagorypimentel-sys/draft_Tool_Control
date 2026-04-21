import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/hooks/useTheme";
import { DbProvider } from "@/hooks/useDb";
import { LanguageProvider } from "@/hooks/useLanguage";
import AppLayout from "@/components/AppLayout";
import Inventory from "./pages/Inventory";
import Technicians from "./pages/Technicians";
import Clients from "./pages/Clients";
import Settings from "./pages/Settings";
import Movements from "./pages/Movements";
import Calibration from "./pages/Calibration";
import Reports from "./pages/Reports";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <LanguageProvider>
        <DbProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route element={<AppLayout />}>
                  <Route path="/" element={<Inventory />} />
                  <Route path="/movements" element={<Movements />} />
                  <Route path="/calibration" element={<Calibration />} />
                  <Route path="/reports" element={<Reports />} />
                  <Route path="/technicians" element={<Technicians />} />
                  <Route path="/clients" element={<Clients />} />
                  <Route path="/settings" element={<Settings />} />
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </DbProvider>
      </LanguageProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
