import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { getDb } from "@/lib/db";
import { seedToolsIfNeeded } from "@/lib/seed-tools";

interface DbContextValue {
  ready: boolean;
  version: number;
  bump: () => void;
}

const DbContext = createContext<DbContextValue>({ ready: false, version: 0, bump: () => {} });

export const DbProvider = ({ children }: { children: ReactNode }) => {
  const [ready, setReady] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    getDb().then(() => {
      try {
        const result = seedToolsIfNeeded();
        if (result.imported > 0) {
          console.log(`[seed] Imported ${result.imported} new tools (skipped ${result.skipped} already present)`);
        }
      } catch (e) {
        console.error("[seed] Failed to import initial tools", e);
      }
      setReady(true);
    });
  }, []);

  return (
    <DbContext.Provider value={{ ready, version, bump: () => setVersion((v) => v + 1) }}>
      {children}
    </DbContext.Provider>
  );
};

export const useDb = () => useContext(DbContext);
