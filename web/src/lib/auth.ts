import { cookies } from "next/headers";
import { sql } from "./db";

// Open access by the founder's choice: no sign-in. A "Viewing as" switch (a cookie) decides which view you get.
// founder: everything · front_desk: no pricing or costs · designer: only their own consultations.

export type Role = "founder" | "front_desk" | "designer";
export type Viewer = { name: string; role: Role; designerId: number | null };

export const VIEW_COOKIE = "view";

export async function viewer(): Promise<Viewer> {
  const v = (await cookies()).get(VIEW_COOKIE)?.value ?? "founder";
  if (v === "front_desk") return { name: "Front desk", role: "front_desk", designerId: null };
  if (v.startsWith("designer:")) {
    const id = Number(v.slice("designer:".length));
    const [d] = (await sql`select id, name from designers where id = ${id} and active`) as { id: number; name: string }[];
    if (d) return { name: d.name, role: "designer", designerId: d.id };
  }
  return { name: "Nikhil", role: "founder", designerId: null };
}

export const canSeeMoney = (v: Viewer) => v.role === "founder";
export const canManage = (v: Viewer) => v.role !== "designer";
