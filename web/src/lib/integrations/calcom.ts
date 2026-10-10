// Cal.com API v2. Each endpoint has its own cal-api-version (docs: cal.com/docs/api-reference/v2).
// Vaani books the consultation during the call through its Cal.com integration; after the call we find that
// booking so the lead, designer and calendar block line up.
const BASE = "https://api.cal.com/v2";

const VERSION = { bookings: "2026-05-01", cancel: "2026-02-25", eventTypes: "2026-06-12", me: "2024-08-13" };

export type Booking = {
  uid: string;
  start: string;
  status: string;
  createdAt?: string;
  hosts?: { email?: string; name?: string }[];
  attendees?: { name?: string; email?: string; phoneNumber?: string }[];
  location?: string;
};

function headers(version: string) {
  return { Authorization: `Bearer ${process.env.CALCOM_API_KEY}`, "cal-api-version": version };
}

const digits = (s?: string | null) => (s ?? "").replace(/\D/g, "").slice(-10);

export async function findBookingForCall(opts: { phone?: string | null; name?: string | null; callEnded: Date }): Promise<Booking | null> {
  if (!process.env.CALCOM_API_KEY) return null;
  const after = new Date(opts.callEnded.getTime() - 30 * 60_000).toISOString();
  const res = await fetch(`${BASE}/bookings?status=upcoming&afterCreatedAt=${encodeURIComponent(after)}&limit=100`, {
    headers: headers(VERSION.bookings),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Cal.com bookings ${res.status}`);
  const body = await res.json();
  const bookings: Booking[] = body.data ?? [];
  const phone = digits(opts.phone);
  const name = (opts.name ?? "").toLowerCase().split(" ")[0];
  return (
    bookings.find((b) => b.attendees?.some((a) => phone && digits(a.phoneNumber) === phone)) ??
    bookings.find((b) => name && b.attendees?.some((a) => (a.name ?? "").toLowerCase().includes(name))) ??
    null
  );
}

// Used when the front desk agrees a caller isn't a fit but the agent had already booked them.
export async function cancelBooking(uid: string, reason: string) {
  if (!process.env.CALCOM_API_KEY) throw new Error("Cal.com key missing");
  const res = await fetch(`${BASE}/bookings/${encodeURIComponent(uid)}/cancel`, {
    method: "POST",
    headers: { ...headers(VERSION.cancel), "Content-Type": "application/json" },
    body: JSON.stringify({ cancellationReason: reason }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Cal.com ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

// Health check for the Connections page: who the key belongs to.
export async function calcomMe(): Promise<{ username?: string; email?: string }> {
  const res = await fetch(`${BASE}/me`, { headers: headers(VERSION.me), cache: "no-store" });
  if (!res.ok) throw new Error(`Cal.com ${res.status}`);
  return (await res.json()).data ?? {};
}

export async function listEventTypes(): Promise<{ id: number; slug: string; title: string; lengthInMinutes: number }[]> {
  const res = await fetch(`${BASE}/event-types`, { headers: headers(VERSION.eventTypes), cache: "no-store" });
  if (!res.ok) throw new Error(`Cal.com ${res.status}`);
  const body = await res.json();
  return Array.isArray(body.data) ? body.data : [];
}
