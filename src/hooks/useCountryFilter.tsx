import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type Country = { id: string; name: string; currency_code: string; currency_symbol: string };

type Ctx = {
  countryId: string | null; // null = all countries
  setCountryId: (id: string | null) => void;
  countries: Country[];
  current: Country | null;
};

const CountryFilterContext = createContext<Ctx | undefined>(undefined);
const STORAGE_KEY = "mevak.country_filter";

export function CountryFilterProvider({ children }: { children: ReactNode }) {
  const { data: countries = [] } = useQuery({
    queryKey: ["countries"],
    queryFn: async () => {
      const { data, error } = await supabase.from("countries").select("*").order("name");
      if (error) throw error;
      return data as Country[];
    },
  });

  const [countryId, setCountryIdState] = useState<string | null>(() => {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      return v && v !== "all" ? v : null;
    } catch { return null; }
  });

  const setCountryId = (id: string | null) => {
    setCountryIdState(id);
    try { localStorage.setItem(STORAGE_KEY, id ?? "all"); } catch {}
  };

  // If selected country no longer exists, reset
  useEffect(() => {
    if (countryId && countries.length > 0 && !countries.find(c => c.id === countryId)) {
      setCountryId(null);
    }
  }, [countries, countryId]);

  const current = countries.find(c => c.id === countryId) ?? null;

  return (
    <CountryFilterContext.Provider value={{ countryId, setCountryId, countries, current }}>
      {children}
    </CountryFilterContext.Provider>
  );
}

export function useCountryFilter() {
  const ctx = useContext(CountryFilterContext);
  if (!ctx) throw new Error("useCountryFilter must be used inside CountryFilterProvider");
  return ctx;
}
