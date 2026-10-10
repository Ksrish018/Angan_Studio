// Picks illustrative imagery for an enquiry: a room photo and a starting palette of materials.
// All images are generated mood references, not the client's site.

// `seed` (e.g. the lead id) varies the photo between similar homes so galleries don't repeat.
export function roomImage(type: string | null, kind: string | null, seed = 0) {
  const t = (type ?? "").toLowerCase();
  if (/villa|bungalow/.test(t)) return "/rooms/villa.jpg";
  if (/house|row ?house/.test(t)) return "/rooms/house.jpg";
  if (/clinic/.test(t)) return "/rooms/clinic.jpg";
  if (kind === "commercial_office" || /office|studio|cowork|pod/.test(t)) return "/rooms/office.jpg";
  if (kind === "single_room" || /bedroom/.test(t)) return "/rooms/bedroom.jpg";
  if (kind === "residential_partial") return /kitchen/.test(t) ? "/rooms/kitchen.jpg" : "/rooms/living.jpg";
  const homes = ["/rooms/apartment.jpg", "/rooms/living.jpg", "/rooms/dining.jpg"];
  return homes[Math.abs(seed) % homes.length];
}

export const MATERIALS: Record<string, { name: string; note: string }> = {
  limewash: { name: "Limewash", note: "Soft, breathable walls" },
  teak: { name: "Teak", note: "Warm, lasting joinery" },
  terracotta: { name: "Terracotta", note: "Handmade, earthy" },
  cane: { name: "Cane", note: "Light, airy weaves" },
  terrazzo: { name: "Terrazzo", note: "Durable, playful floors" },
  brass: { name: "Brass", note: "Quiet glow in fittings" },
  kota: { name: "Kota stone", note: "Cool, local, hard-wearing" },
  marble: { name: "Marble", note: "Calm, luminous surfaces" },
};

// A starting palette for the designer's first mood board, by type of space.
export function materialsFor(type: string | null, kind: string | null): string[] {
  const t = (type ?? "").toLowerCase();
  if (kind === "commercial_office" || /office|clinic|studio/.test(t)) return ["kota", "teak", "brass", "limewash"];
  if (/villa|bungalow|house/.test(t)) return ["marble", "teak", "brass", "terracotta"];
  if (kind === "residential_partial" || kind === "single_room") return ["limewash", "cane", "teak", "terracotta"];
  return ["limewash", "teak", "terrazzo", "brass"];
}
