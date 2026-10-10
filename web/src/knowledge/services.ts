// Aangan Studio's services, service area and timelines, from services.md and qualified.md.
// Everything in this file is safe to say to a caller.

export const SERVICE_AREAS = [
  // Pune city
  "pune", "kothrud", "baner", "aundh", "wakad", "koregaon park", "kalyani nagar", "viman nagar",
  "hadapsar", "magarpatta", "nibm", "kondhwa", "undri", "shivane", "warje", "erandwane", "deccan",
  "sunderban", "dahanukar", "nanded city", "balewadi", "pashan", "bavdhan", "kharadi", "camp",
  "shivaji nagar", "sinhagad road", "katraj", "bibwewadi", "wagholi",
  // PCMC
  "pcmc", "pimpri", "chinchwad", "pimple saudagar", "pimple nilakh", "ravet", "hinjewadi", "akurdi", "nigdi",
];

export const EXCLUDED_AREAS = ["talegaon", "lonavala", "nashik", "mumbai", "thane", "navi mumbai", "satara", "nagpur"];

export const OUT_OF_SCOPE_KINDS = ["restaurant", "hotel", "retail", "gym", "cafe", "hospitality", "shop", "showroom"];

export const MIN_LEAD_WEEKS = 6;
export const COMMERCIAL_MIN_SQFT = 500;
export const COMMERCIAL_MAX_SQFT = 3000;
export const OFFICE_HOURS = { start: 10, end: 19 }; // IST

export const PRICE_DEFLECTION =
  "Pricing depends on the site, the materials you choose, and the scope. Your designer will walk you through it in detail at the consultation. I can book that for you right now if you'd like.";

export const DECLINE_LINE =
  "This sounds like it may not be the right fit for us right now, but please do reach out if your timeline or scope changes.";

export const SERVICES_BRIEF = `Aangan Studio does end-to-end interior design with execution for homes and small offices in Pune city and PCMC.
What we do: space planning and layout; material selection (flooring, wall finishes, ceilings); furniture design and curation (custom and sourced); lighting design; kitchen and wardrobe design; execution supervision with our own contractors and vendors.
Residential: apartments, independent houses, villas. Full home (2BHK onwards), a full floor or 2+ rooms, or a single bedroom/living room as a complete redesign with execution.
Commercial: offices, clinics, studios from about 500 up to about 3,000 sq ft.
We do not do: architecture or structural work (no moving walls, no structural permits); decor, colour advice or styling only; standalone furniture sourcing; standalone Vastu advice (we do include Vastu in our designs); restaurants, hotels, retail stores, gyms; anything outside Pune and PCMC (not Talegaon, Lonavala, Nashik, Mumbai).
Timelines: design takes 3–4 weeks from the first consultation; execution takes 8–16 weeks. We cannot take on a project that must be ready in under 6 weeks.
The first consultation is free with no obligation, at the studio or as a site visit.`;

// Answers to the questions callers actually ask (from the September transcripts).
export const FAQ: { q: string; a: string }[] = [
  { q: "How much will it cost? / What are your rates? / Give me a ballpark or a range", a: PRICE_DEFLECTION },
  { q: "I'm in a rented flat. Can you still do it?", a: "Yes, as long as there are no structural changes. Kitchens can be modular so they come out cleanly, and the rest is largely reversible. Please check with your landlord." },
  { q: "Can someone just come and give us ideas / advice?", a: "We're a full-service studio, so our projects include design and execution together. We don't do advice-only visits. If you're planning a full redesign with execution, we'd love to help." },
  { q: "Can you do a project outside Pune (Nashik, Mumbai, Talegaon, Lonavala)?", a: "We only work in Pune and PCMC at the moment. Our execution depends on our own contractors being on site, so we can't do justice to projects further away." },
  { q: "Can you finish before a date that is only a few weeks away?", a: "Design alone takes 3–4 weeks and execution follows, so we wouldn't be able to do it well in that time. If you can start after that, we'd be glad to plan it." },
  { q: "Do you do restaurants, cafes, shops, gyms or hotels?", a: "Those spaces are outside our scope. We focus on homes and offices, and hospitality or fitness spaces need specialists." },
  { q: "Do you do Vastu?", a: "We incorporate your Vastu requirements into the design, but we don't offer Vastu advice on its own." },
  { q: "Can you just source furniture for us?", a: "We only source furniture as part of a design project." },
  { q: "Can you move walls / do structural work?", a: "We're interior designers, not architects, so we don't do structural changes." },
  { q: "How long does a project take?", a: "Design takes 3–4 weeks from the first consultation, and execution usually 8–16 weeks depending on size and site readiness." },
  { q: "Is the consultation free?", a: "Yes. The first consultation is free with no obligation. It can be at the studio or a site visit." },
];
