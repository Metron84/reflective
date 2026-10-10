"use client";

import { useState } from "react";

const LOCATIONS = [
  { id: "", label: "Where do you watch?" },
  { id: "dubai", label: "Dubai" },
  { id: "uae-other", label: "Elsewhere in the UAE" },
  { id: "uk", label: "UK" },
  { id: "elsewhere", label: "Elsewhere" },
];

export default function SaveResult({ club, runId, accountEmail = "", preview = "" }) {
  const [open, setOpen] = useState(true);
  const [email, setEmail] = useState(accountEmail);
  const [firstName, setFirstName] = useState("");
  const [location, setLocation] = useState("");
  const [supportersClub, setSupportersClub] = useState("");
  const [consentSave, setConsentSave] = useState(false);
  const [consentMarketing, setConsentMarketing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [failed, setFailed] = useState("");

  if (!open) return null;

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setFailed("");
    try {
      const response = await fetch(`/api/watch-with/${club}/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          runId,
          email,
          firstName,
          location,
          supportersClub,
          consentSave,
          consentMarketing,
          preview,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "fail");
      setNote(data?.verified ? "Saved. Your vote is verified." : "Saved. Check your inbox to verify.");
    } catch (error) {
      setFailed(error.message || "Something went wrong. Tap to try again.");
    }
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-[14px] border-2 border-[#0A111F] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-[#0A111F]">Save your result</h2>
          <p className="mt-1 text-sm leading-snug text-[#0A111F]">Get your matchday companion by email and join the ranking as a verified fan.</p>
        </div>
        <button type="button" onClick={() => setOpen(false)} className="text-sm font-semibold underline-offset-4 hover:underline">
          Skip
        </button>
      </div>
      {note ? <p className="text-sm font-semibold">{note}</p> : (
        <>
          <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" className="min-h-12 rounded-[14px] border-2 border-[#0A111F] bg-transparent px-3 text-base text-[#0A111F]" />
          <input value={firstName} onChange={(event) => setFirstName(event.target.value)} placeholder="First name" className="min-h-12 rounded-[14px] border-2 border-[#0A111F] bg-transparent px-3 text-base text-[#0A111F]" />
          <select value={location} onChange={(event) => setLocation(event.target.value)} className="min-h-12 rounded-[14px] border-2 border-[#0A111F] bg-[#F2EDE4] px-3 text-base text-[#0A111F]">
            {LOCATIONS.map((item) => (
              <option key={item.id || "blank"} value={item.id}>{item.label}</option>
            ))}
          </select>
          <input value={supportersClub} onChange={(event) => setSupportersClub(event.target.value)} placeholder="Supporters club you belong to" className="min-h-12 rounded-[14px] border-2 border-[#0A111F] bg-transparent px-3 text-base text-[#0A111F]" />
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={consentSave} onChange={(event) => setConsentSave(event.target.checked)} className="mt-1" />
            Save my result and verify my vote
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={consentMarketing} onChange={(event) => setConsentMarketing(event.target.checked)} className="mt-1" />
            Send me TRF updates
          </label>
          <p className="text-xs text-[#0A111F]/80">We never show your email publicly. Ask us to delete it any time.</p>
          {failed ? <p className="text-sm">{failed}</p> : null}
          <button type="submit" disabled={busy || !consentSave} className="min-h-12 rounded-[14px] bg-[#D8232A] px-4 text-base font-semibold text-[#F2EDE4] disabled:opacity-60">
            Save
          </button>
        </>
      )}
    </form>
  );
}
