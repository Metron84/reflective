"use client";

import { useState } from "react";
import FanGroupForm from "./FanGroupForm";

export default function FanGroupsTab({ fanGroups, setFanGroups }) {
  const [editingId, setEditingId] = useState(null);

  return (
    <div className="space-y-6">
      <section>
        <h2 className="font-display text-xl text-navy">Add fan group</h2>
        <div className="mt-3">
          <FanGroupForm
            onSaved={(fg) => {
              setFanGroups((list) =>
                [...list.filter((x) => x.id !== fg.id), fg].sort((a, b) =>
                  a.name.localeCompare(b.name)
                )
              );
            }}
          />
        </div>
      </section>

      <section>
        <h2 className="font-display text-xl text-navy">
          Fan groups ({fanGroups.length})
        </h2>
        <div className="mt-3 overflow-x-auto border border-navy/15">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="bg-navy/[0.04] text-xs uppercase tracking-wider text-navy/50">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Club</th>
                <th className="px-3 py-2">Country</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {fanGroups.map((fg) => (
                <tr key={fg.id} className="border-t border-navy/10 align-top">
                  {editingId === fg.id ? (
                    <td colSpan={4} className="p-3">
                      <FanGroupForm
                        initial={fg}
                        submitLabel="Update fan group"
                        onCancel={() => setEditingId(null)}
                        onSaved={(row) => {
                          setFanGroups((list) =>
                            list
                              .map((x) => (x.id === row.id ? row : x))
                              .sort((a, b) => a.name.localeCompare(b.name))
                          );
                          setEditingId(null);
                        }}
                      />
                    </td>
                  ) : (
                    <>
                      <td className="px-3 py-2 font-medium text-navy">
                        {fg.name}
                      </td>
                      <td className="px-3 py-2 text-navy/70">
                        {fg.club ?? "-"}
                      </td>
                      <td className="px-3 py-2 text-navy/70">
                        {fg.country ?? "-"}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => setEditingId(fg.id)}
                          className="text-xs uppercase tracking-widest text-signal"
                        >
                          Edit
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
              {fanGroups.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-navy/50">
                    No fan groups yet.
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
