import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useCountries() {
  return useQuery({
    queryKey: ["countries"],
    queryFn: async () => {
      const { data, error } = await supabase.from("countries").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });
}

export function usePlatforms() {
  return useQuery({
    queryKey: ["platforms"],
    queryFn: async () => {
      const { data, error } = await supabase.from("platforms").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });
}

export function useFoodCategories() {
  return useQuery({
    queryKey: ["food_categories"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("food_categories").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });
}

export function useProvinces(countryId?: string | null) {
  return useQuery({
    queryKey: ["provinces", countryId],
    enabled: !!countryId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("provinces")
        .select("*")
        .eq("country_id", countryId!)
        .order("name");
      if (error) throw error;
      return data;
    },
  });
}

export function useCities(provinceId?: string | null) {
  return useQuery({
    queryKey: ["cities", provinceId],
    enabled: !!provinceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cities")
        .select("*")
        .eq("province_id", provinceId!)
        .order("name");
      if (error) throw error;
      return data;
    },
  });
}

export function useExpenseCategories() {
  return useQuery({
    queryKey: ["expense_categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("expense_categories").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });
}

export function useContactChannels() {
  return useQuery({
    queryKey: ["contact_channels"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("contact_channels").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });
}

export function useLostReasons() {
  return useQuery({
    queryKey: ["lost_reasons"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("lost_reasons").select("*").order("reason");
      if (error) throw error;
      return data;
    },
  });
}

export function useFunnelStages() {
  return useQuery({
    queryKey: ["funnel_stages"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("funnel_stages").select("*").order("stage_order");
      if (error) throw error;
      return data;
    },
  });
}
