// Helpers para mostrar valores monetarios en USD o en moneda local del país filtrado.

export type CountryLite = { id: string; name: string; currency_code: string };

export function getDisplayCurrency(countryId: string | "all" | null, countries: CountryLite[]): string {
  if (!countryId || countryId === "all") return "USD";
  const c = countries.find((x) => x.id === countryId);
  return c?.currency_code ?? "USD";
}

export function getDisplayCountryName(countryId: string | "all" | null, countries: CountryLite[]): string | null {
  if (!countryId || countryId === "all") return null;
  return countries.find((x) => x.id === countryId)?.name ?? null;
}

const CURRENCY_LOCALE: Record<string, string> = {
  USD: "en-US", ARS: "es-AR", BRL: "pt-BR", MXN: "es-MX",
  CLP: "es-CL", COP: "es-CO", PEN: "es-PE", UYU: "es-UY",
  PYG: "es-PY", BOB: "es-BO", VES: "es-VE", DOP: "es-DO",
  GTQ: "es-GT", HNL: "es-HN", NIO: "es-NI", PAB: "es-PA",
  CRC: "es-CR", EUR: "es-ES", GBP: "en-GB", CAD: "en-CA",
};

/**
 * Convierte un monto en USD al currency de display y lo formatea.
 * latestRate: rate base→USD donde rate = unidades de base por 1 USD (i.e. USD * rate = local).
 */
export function fmtDisplay(
  amountUsd: number,
  displayCurrency: string,
  latestRate: Map<string, number>,
  opts: { decimals?: number } = {},
): string {
  const decimals = opts.decimals ?? 0;
  let amt = amountUsd || 0;
  if (displayCurrency !== "USD") {
    const r = latestRate.get(displayCurrency);
    if (!r || r === 0) {
      // Fallback a USD si no hay cotización
      return new Intl.NumberFormat("en-US", {
        style: "currency", currency: "USD",
        minimumFractionDigits: decimals, maximumFractionDigits: decimals,
      }).format(amountUsd || 0);
    }
    amt = (amountUsd || 0) * r;
  }
  const locale = CURRENCY_LOCALE[displayCurrency] ?? "en-US";
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency", currency: displayCurrency,
      minimumFractionDigits: decimals, maximumFractionDigits: decimals,
    }).format(amt);
  } catch {
    return `${displayCurrency} ${amt.toLocaleString(locale, { maximumFractionDigits: decimals })}`;
  }
}
