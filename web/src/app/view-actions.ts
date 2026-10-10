"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { VIEW_COOKIE } from "@/lib/auth";

export async function setView(formData: FormData) {
  const v = String(formData.get("view") ?? "founder");
  if (!/^(founder|front_desk|designer:\d+)$/.test(v)) return;
  (await cookies()).set(VIEW_COOKIE, v, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  redirect(v.startsWith("designer:") ? "/me" : v === "front_desk" ? "/review" : "/");
}
