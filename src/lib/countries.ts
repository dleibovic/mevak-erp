// ISO country list with flag emoji and default currency.
export type CountryOption = {
  name: string;
  iso2: string;
  flag: string;
  currency_code: string;
  currency_symbol: string;
};

export const COUNTRY_OPTIONS: CountryOption[] = [
  { name: "Argentina", iso2: "AR", flag: "🇦🇷", currency_code: "ARS", currency_symbol: "$" },
  { name: "Bolivia", iso2: "BO", flag: "🇧🇴", currency_code: "BOB", currency_symbol: "Bs" },
  { name: "Brasil", iso2: "BR", flag: "🇧🇷", currency_code: "BRL", currency_symbol: "R$" },
  { name: "Canadá", iso2: "CA", flag: "🇨🇦", currency_code: "CAD", currency_symbol: "C$" },
  { name: "Chile", iso2: "CL", flag: "🇨🇱", currency_code: "CLP", currency_symbol: "$" },
  { name: "Colombia", iso2: "CO", flag: "🇨🇴", currency_code: "COP", currency_symbol: "$" },
  { name: "Costa Rica", iso2: "CR", flag: "🇨🇷", currency_code: "CRC", currency_symbol: "₡" },
  { name: "Ecuador", iso2: "EC", flag: "🇪🇨", currency_code: "USD", currency_symbol: "US$" },
  { name: "El Salvador", iso2: "SV", flag: "🇸🇻", currency_code: "USD", currency_symbol: "US$" },
  { name: "España", iso2: "ES", flag: "🇪🇸", currency_code: "EUR", currency_symbol: "€" },
  { name: "Estados Unidos", iso2: "US", flag: "🇺🇸", currency_code: "USD", currency_symbol: "US$" },
  { name: "Francia", iso2: "FR", flag: "🇫🇷", currency_code: "EUR", currency_symbol: "€" },
  { name: "Guatemala", iso2: "GT", flag: "🇬🇹", currency_code: "GTQ", currency_symbol: "Q" },
  { name: "Honduras", iso2: "HN", flag: "🇭🇳", currency_code: "HNL", currency_symbol: "L" },
  { name: "Italia", iso2: "IT", flag: "🇮🇹", currency_code: "EUR", currency_symbol: "€" },
  { name: "México", iso2: "MX", flag: "🇲🇽", currency_code: "MXN", currency_symbol: "$" },
  { name: "Nicaragua", iso2: "NI", flag: "🇳🇮", currency_code: "NIO", currency_symbol: "C$" },
  { name: "Panamá", iso2: "PA", flag: "🇵🇦", currency_code: "PAB", currency_symbol: "B/." },
  { name: "Paraguay", iso2: "PY", flag: "🇵🇾", currency_code: "PYG", currency_symbol: "₲" },
  { name: "Perú", iso2: "PE", flag: "🇵🇪", currency_code: "PEN", currency_symbol: "S/" },
  { name: "Portugal", iso2: "PT", flag: "🇵🇹", currency_code: "EUR", currency_symbol: "€" },
  { name: "Reino Unido", iso2: "GB", flag: "🇬🇧", currency_code: "GBP", currency_symbol: "£" },
  { name: "República Dominicana", iso2: "DO", flag: "🇩🇴", currency_code: "DOP", currency_symbol: "RD$" },
  { name: "Uruguay", iso2: "UY", flag: "🇺🇾", currency_code: "UYU", currency_symbol: "$U" },
  { name: "Venezuela", iso2: "VE", flag: "🇻🇪", currency_code: "VES", currency_symbol: "Bs" },
];

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
const NAME_MAP = new Map(COUNTRY_OPTIONS.map((c) => [norm(c.name), c]));
// English aliases
const ALIASES: Record<string, string> = {
  "united states": "Estados Unidos",
  "usa": "Estados Unidos",
  "spain": "España",
  "brazil": "Brasil",
  "mexico": "México",
  "peru": "Perú",
  "panama": "Panamá",
  "canada": "Canadá",
  "united kingdom": "Reino Unido",
  "uk": "Reino Unido",
  "france": "Francia",
  "italy": "Italia",
  "dominican republic": "República Dominicana",
};

export function flagForCountry(name?: string | null): string {
  if (!name) return "🏳️";
  const k = norm(name);
  const direct = NAME_MAP.get(k);
  if (direct) return direct.flag;
  const aliased = ALIASES[k];
  if (aliased) return NAME_MAP.get(norm(aliased))?.flag ?? "🏳️";
  return "🏳️";
}
