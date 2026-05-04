import { Globe2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCountryFilter } from "@/hooks/useCountryFilter";
import { flagForCountry } from "@/lib/countries";

type Props = {
  /** When true, hides the "Todos" option (forces a specific country). */
  required?: boolean;
  /** Local override value (uncontrolled by global filter). When provided, behaves as controlled local select. */
  value?: string | null;
  onChange?: (id: string | null) => void;
  className?: string;
  size?: "sm" | "md";
};

export function CountryFilterSelect({ required, value, onChange, className, size = "md" }: Props) {
  const { countries, countryId, setCountryId } = useCountryFilter();
  const isControlled = value !== undefined;
  const current = isControlled ? value : countryId;

  const handle = (v: string) => {
    const next = v === "all" ? null : v;
    if (isControlled) onChange?.(next);
    else setCountryId(next);
  };

  return (
    <Select value={current ?? "all"} onValueChange={handle}>
      <SelectTrigger className={`gap-2 ${size === "sm" ? "h-8 text-xs" : ""} ${className ?? "w-[180px]"}`}>
        <Globe2 className="h-3.5 w-3.5 text-muted-foreground" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {!required && <SelectItem value="all">Todos los países</SelectItem>}
        {countries.map((c) => (
          <SelectItem key={c.id} value={c.id}>
            <span className="mr-2">{flagForCountry(c.name)}</span>{c.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
