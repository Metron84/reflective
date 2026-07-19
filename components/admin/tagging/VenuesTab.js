"use client";

import { useState } from "react";
import VenueForm from "./VenueForm";

export default function VenuesTab({ venues, setVenues }) {
  const [editingId, setEditingId] = useState(null);

  return (
    <div className="space-y-6">
      <section>
        <h2 className="font-display text-xl text-navy">Add venue</h2>
        <div className="mt-3">
          <VenueForm
            onSaved={(venue) => {
              setVenues((list) =>
                [...list.filter((v) => v.id !== venue.id), venue].sort((a, b) =>
                  a.name.localeCompare(b.name)
                )
              );
            }}
          />
        </div>
      </section>

      <section>
        <h2 className="font-display text-xl text-navy">
          Venues ({venues.length})
        </h2>
        <div className="mt-3 overflow-x-auto border border-navy/15">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-navy/[0.04] text-xs uppercase tracking-wider text-navy/50">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Area</th>
                <th className="px-3 py-2">Setting</th>
                <th className="px-3 py-2">Vibe</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {venues.map((v) => (
                <tr key={v.id} className="border-t border-navy/10 align-top">
                  {editingId === v.id ? (
                    <td colSpan={5} className="p-3">
                      <VenueForm
                        initial={v}
                        submitLabel="Update venue"
                        onCancel={() => setEditingId(null)}
                        onSaved={(venue) => {
                          setVenues((list) =>
                            list
                              .map((x) => (x.id === venue.id ? venue : x))
                              .sort((a, b) => a.name.localeCompare(b.name))
                          );
                          setEditingId(null);
                        }}
                      />
                    </td>
                  ) : (
                    <>
                      <td className="px-3 py-2 font-medium text-navy">
                        {v.name}
                        <div className="text-xs font-normal text-navy/45">
                          {v.city}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-navy/70">{v.area ?? "-"}</td>
                      <td className="px-3 py-2 text-navy/70">
                        {v.setting ?? "-"}
                      </td>
                      <td className="px-3 py-2 text-navy/70">
                        {v.capacity_vibe ?? "-"}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => setEditingId(v.id)}
                          className="text-xs uppercase tracking-widest text-signal"
                        >
                          Edit
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
              {venues.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-navy/50">
                    No venues yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
