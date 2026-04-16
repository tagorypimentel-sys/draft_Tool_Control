import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export type Lang = "en" | "pt";

interface LanguageCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  toggle: () => void;
}

const Ctx = createContext<LanguageCtx>({
  lang: "en",
  setLang: () => {},
  toggle: () => {},
});

const STORAGE_KEY = "tool-control-lang";

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const stored = (typeof localStorage !== "undefined" && localStorage.getItem(STORAGE_KEY)) as Lang | null;
    return stored === "pt" || stored === "en" ? stored : "en";
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, lang);
      document.documentElement.lang = lang;
    } catch {
      /* ignore */
    }
  }, [lang]);

  const setLang = (l: Lang) => setLangState(l);
  const toggle = () => setLangState((p) => (p === "en" ? "pt" : "en"));

  return <Ctx.Provider value={{ lang, setLang, toggle }}>{children}</Ctx.Provider>;
}

export const useLanguage = () => useContext(Ctx);
