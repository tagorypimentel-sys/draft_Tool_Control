import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Button } from "@/components/ui/button";
import { Moon, Sun, Languages } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { useDb } from "@/hooks/useDb";
import { useLanguage } from "@/hooks/useLanguage";

const AppLayout = () => {
  const { theme, toggle } = useTheme();
  const { lang, toggle: toggleLang } = useLanguage();
  const { ready } = useDb();

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-1">
          <span className="text-[15px] font-bold">Loading database…</span>
          <span className="text-[11px] italic text-muted-foreground">Carregando banco de dados…</span>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-muted/30">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center justify-between border-b bg-background px-4 sticky top-0 z-10">
            <SidebarTrigger />
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={toggleLang}
                aria-label="Toggle language"
                className="h-8 gap-1 px-2 font-bold"
              >
                <Languages className="h-4 w-4" />
                {lang === "en" ? "EN" : "PT"}
              </Button>
              <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">
                {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
              </Button>
            </div>
          </header>
          <main className="flex-1 p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default AppLayout;
