"use client";

import { useActionState, useEffect, useRef } from "react";
import { addDesigner, type FormState } from "@/app/actions";

export const field =
  "w-full rounded-xl border border-hairline bg-paper px-4 py-2.5 text-[15px] outline-none transition-colors placeholder:text-stone focus:border-ink";

export function AddDesignerForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(addDesigner, {});
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.ok) form.current?.reset(); }, [state]);

  return (
    <form ref={form} action={action} className="card p-7">
      <h2 className="font-serif text-[26px]">Add a designer</h2>
      <p className="mt-1 text-[14px] text-stone">They start receiving new consultations straight away.</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="eyebrow mb-2 block">Full name</span>
          <input name="name" required className={field} placeholder="e.g. Ananya Kulkarni" autoComplete="off" />
        </label>
        <label className="block">
          <span className="eyebrow mb-2 block">Work email</span>
          <input name="email" type="email" required className={field} placeholder="ananya@aanganstudio.in" autoComplete="off" />
        </label>
        <label className="block">
          <span className="eyebrow mb-2 block">Phone (optional)</span>
          <input name="phone" type="tel" className={field} placeholder="+91 98…" autoComplete="off" />
        </label>
        <label className="block">
          <span className="eyebrow mb-2 block">Speciality (optional)</span>
          <input name="specialty" className={field} placeholder="e.g. Kitchens and wardrobes" autoComplete="off" />
        </label>
      </div>
      <label className="mt-4 flex items-center gap-2.5 text-[14px] text-ink-2">
        <input type="checkbox" name="principal" className="h-4 w-4 accent-[var(--terracotta)]" />
        Principal designer (gets close referrals first)
      </label>
      <div className="mt-6 flex flex-wrap items-center gap-4">
        <button disabled={pending} className="rounded-full bg-ink px-5 py-2.5 text-[14px] text-paper transition-opacity hover:opacity-90 disabled:opacity-60">
          {pending ? "Adding…" : "Add to team"}
        </button>
        {state.error && <p role="alert" className="text-[14px] text-rose-ink">{state.error}</p>}
        {state.ok && <p role="status" className="text-[14px] text-sage-ink">{state.ok}</p>}
      </div>
    </form>
  );
}
