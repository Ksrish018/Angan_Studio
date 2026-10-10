import "server-only";

// INTERNAL ONLY, from pricing.md. "No number from this guide should be quoted to a client."
// Used for two things: spotting a clearly-too-low volunteered budget, and giving designers and Nikhil
// an indicative range for planning. It must never reach the voice agent, the caller, or any caller message.

export const BANDS = {
  residential: { standard: [1800, 2400], premium: [2400, 3500], luxury: [3500, 5000] },
  commercial: { basic: [1200, 1800], mid: [1800, 2800], premium: [2800, 4000] },
  singleRoom: [350_000, 800_000],
} as const;

export type Kind =
  | "residential_full" | "residential_partial" | "single_room" | "commercial_office"
  | "advice_only" | "out_of_scope" | "unknown";

// Rough share of the flat being designed in a partial project, when only the flat size is known.
const PARTIAL_SHARE = 0.5;

export function indicativeRange(kind: Kind | null, sqft: number | null): { low: number; high: number; basis: string } | null {
  if (kind === "single_room") return { low: BANDS.singleRoom[0], high: BANDS.singleRoom[1], basis: "Single room, all-in" };
  if (!sqft) return null;
  if (kind === "residential_full")
    return { low: sqft * BANDS.residential.standard[0], high: sqft * BANDS.residential.premium[1], basis: "Standard to premium spec, carpet area" };
  if (kind === "residential_partial") {
    const s = Math.round(sqft * PARTIAL_SHARE);
    return { low: s * BANDS.residential.standard[0], high: s * BANDS.residential.premium[1], basis: `About half of ${sqft} sq ft, standard to premium` };
  }
  if (kind === "commercial_office")
    return { low: sqft * BANDS.commercial.basic[0], high: sqft * BANDS.commercial.mid[1], basis: "Basic to mid-range fitout" };
  return null;
}

// The lowest a project of this scope could plausibly cost (criterion 4 in qualified.md).
export function budgetFloor(kind: Kind | null, sqft: number | null): number | null {
  if (kind === "single_room") return BANDS.singleRoom[0];
  if (kind === "residential_partial") return sqft ? Math.round(sqft * PARTIAL_SHARE) * BANDS.residential.standard[0] : 2 * BANDS.singleRoom[0];
  if (kind === "residential_full" && sqft) return sqft * BANDS.residential.standard[0];
  if (kind === "commercial_office" && sqft) return sqft * BANDS.commercial.basic[0];
  return null;
}

export const lakh = (n: number) => `₹${(n / 100_000).toFixed(n >= 10_000_000 ? 0 : 1)} lakh`;
