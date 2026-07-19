"use client";

import { useState } from "react";
import { CAPACITY_VIBES, VENUE_SETTINGS } from "@/lib/admin/constants";

const empty = {
  name: "",
  area: "",
  city: "Dubai",
  setting: "",
  capacity_vibe: "",
  outdoor_seating: false,
  typical_group_max: "",
  food_drink_notes: "",
  notes: "",
};

export default function VenueForm({
  initial = null,
  onSaved,
  onCancel,
  submitLabel = "Save venue",
}) {
  const [form, setForm] = useState(
    initial
      ? {
          name: initial.name ?? "",
          area: initial.area ?? "",
          city: initial.city ?? "Dubai",
          setting: initial.setting ?? "",
          capacity_vibe: initial.capacity_vibe ?? "",
          outdoor_seating: Boolean(initial.outdoor_seating),
          typical_group_max: initial.typical_group_max ?? "",
          food_drink_notes: initial.food_drink_notes ?? "",
          notes: initial.notes ?? "",
        }
      : empty
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/tagging/venues", {
        method: initial?.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: initial?.id,
          ...form,
          typical_group_max:
            form.typical_group_max === "" ? null : Number(form.typical_group_max),
          setting: form.setting || null,
          capacity_vibe: form.capacity_vibe || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message ?? "Could not save.");
        return;
      }
      onSaved?.(data.venue);
      if (!initial?.id) setForm(empty);
    } catch {
      setError("Could not save.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 border border-navy/15 bg-white/40 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs text-navy/60">
          Name
          <input
            required
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            className="mt-1 w-full border border-navy/20 bg-paper px-2 py-1.5 text-sm text-navy"
          />
        </label>
        <label className="block text-xs text-navy/60">
          Area
          <input
            value={form.area}
            onChange={(e) => set("area", e.target.value)}
            placeholder="JLT"
            className="mt-1 w-full border border-navy/20 bg-paper px-2 py-1.5 text-sm text-navy"
          />
        </label>
        <label className="block text-xs text-navy/60">
          City
          <input
            value={form.city}
            onChange={(e) => set("city", e.target.value)}
            className="mt-1 w-full border border-navy/20 bg-paper px-2 py-1.5 text-sm text-navy"
          />
        </label>
        <label className="block text-xs text-navy/60">
          Setting
          <select
            value={form.setting}
            onChange={(e) => set("setting", e.target.value)}
            className="mt-1 w-full border border-navy/20 bg-paper px-2 py-1.5 text-sm text-navy"
          >
            <option value="">-</option>
            {VENUE_SETTINGS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-navy/60">
          Capacity vibe
          <select
            value={form.capacity_vibe}
            onChange={(e) => set("capacity_vibe", e.target.value)}
            className="mt-1 w-full border border-navy/20 bg-paper px-2 py-1.5 text-sm text-navy"
          >
            <option value="">-</option>
            {CAPACITY_VIBES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-navy/60">
          Typical group max
          <input
            type="number"
            min={0}
            value={form.typical_group_max}
            onChange={(e) => set("typical_group_max", e.target.value)}
            className="mt-1 w-full border border-navy/20 bg-paper px-2 py-1.5 text-sm text-navy"
          />
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm text-navy/70">
        <input
          type="checkbox"
          checked={form.outdoor_seating}
          onChange={(e) => set("outdoor_seating", e.target.checked)}
        />
        Outdoor seating
      </label>
      <label className="block text-xs text-navy/60">
        Food / drink notes
        <textarea
          value={form.food_drink_notes}
          onChange={(e) => set("food_drink_notes", e.target.value)}
          rows={2}
          className="mt-1 w-full border border-navy/20 bg-paper px-2 py-1.5 text-sm text-navy"
        />
      </label>
      <label className="block text-xs text-navy/60">
        Notes
        <textarea
          value={form.notes}
          onChange={(e) => set("notes", e.target.value)}
          rows={2}
          className="mt-1 w-full border border-navy/20 bg-paper px-2 py-1.5 text-sm text-navy"
        />
      </label>
      {error ? <p className="text-sm text-signal">{error}</p> : null}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-navy px-4 py-1.5 text-xs font-medium uppercase tracking-widest text-paper disabled:opacity-50"
        >
          {pending ? "Saving…" : submitLabel}
        </button>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-navy/25 px-4 py-1.5 text-xs uppercase tracking-widest text-navy/70"
          >
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}
