// Prints a sample calendar invite. Run: npx tsx scripts/ics-preview.ts
import { consultationIcs, googleCalendarLink } from "../src/lib/integrations/email";

const h = {
  leadId: 42, designerName: "Isha Bhide", designerEmail: "x@example.com", name: "Meghna Joshi", phone: "+910000000042", locality: "Baner, Pune",
  propertyType: "3BHK apartment", carpetSqft: 1250, scope: "Full home, kitchen; wardrobes", timeline: "By March", decisionMaker: "Meghna and husband",
  source: "Instagram", consultationAt: new Date("2026-10-14T05:30:00Z"), consultationMode: "site_visit", flags: [], summary: "s", designerNotes: null,
};
console.log(consultationIcs(h, "https://aangan-concierge.vercel.app"));
console.log(googleCalendarLink(h, "https://aangan-concierge.vercel.app")?.slice(0, 170));
