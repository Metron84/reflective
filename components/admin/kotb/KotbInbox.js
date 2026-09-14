"use client";

import { useState } from "react";
import AdminNav from "@/components/admin/AdminNav";
import styles from "./KotbInbox.module.css";

const STATUSES = ["new", "reviewing", "accepted", "declined"];

function yesNo(value) {
  if (value === true) return "Yes";
  if (value === false) return "No";
  return "-";
}

export default function KotbInbox({ initialRows }) {
  const [rows, setRows] = useState(initialRows);
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState("");

  async function patchRow(id, next) {
    setSavingId(id);
    setError("");
    try {
      const res = await fetch("/api/admin/kotb", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, ...next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message || "Could not save.");
        return;
      }
      setRows((prev) =>
        prev.map((row) => (row.id === id ? { ...row, ...data.row } : row)),
      );
    } catch {
      setError("Could not save.");
    } finally {
      setSavingId("");
    }
  }

  return (
    <div className={styles.wrap}>
      <AdminNav active="kotb" />
      <h1 className={styles.title}>King of the Burgers</h1>
      <p className={styles.sub}>{rows.length} entries</p>
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
      <div className={styles.scroller}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Venue</th>
              <th>Area</th>
              <th>Contact</th>
              <th>Burger</th>
              <th>Halal</th>
              <th>Screens</th>
              <th>Footfall</th>
              <th>Status</th>
              <th>Seed</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9}>No entries yet.</td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.venue_name}</td>
                  <td>{row.area}</td>
                  <td>
                    <div>{row.contact_name}</div>
                    <div className={styles.muted}>{row.contact_email}</div>
                    <div className={styles.muted}>{row.contact_mobile}</div>
                  </td>
                  <td>{row.burger_name}</td>
                  <td>{yesNo(row.is_halal)}</td>
                  <td>{row.screen_count ?? "-"}</td>
                  <td>{row.matchday_footfall ?? "-"}</td>
                  <td>
                    <select
                      className={styles.control}
                      value={row.status}
                      disabled={savingId === row.id}
                      onChange={(e) =>
                        patchRow(row.id, { status: e.target.value })
                      }
                    >
                      {!STATUSES.includes(row.status) ? (
                        <option value={row.status}>{row.status}</option>
                      ) : null}
                      {STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      className={styles.seed}
                      type="number"
                      inputMode="numeric"
                      defaultValue={row.seed ?? ""}
                      disabled={savingId === row.id}
                      onBlur={(e) => {
                        const raw = e.target.value.trim();
                        const seed = raw === "" ? null : Number(raw);
                        if (raw !== "" && !Number.isInteger(seed)) return;
                        if (seed === row.seed) return;
                        patchRow(row.id, { seed });
                      }}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
