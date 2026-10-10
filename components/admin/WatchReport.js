"use client";

import { useMemo, useState } from "react";

const CATEGORIES = [
  { id: "all", label: "All" },
  { id: "player", label: "Players" },
  { id: "manager", label: "Managers" },
  { id: "celebrity", label: "Celebrities" },
];

function rate(value) {
  return `${Math.round((value || 0) * 100)}%`;
}

function pairList(list) {
  if (!list?.length) return "None yet";
  return list.map((item) => `${item.name} (${item.count})`).join(", ");
}

export default function WatchReport({ club, rows, totals }) {
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState("fanRank");
  const [direction, setDirection] = useState("asc");
  const visible = useMemo(() => {
    const pool = rows.filter((row) => category === "all" || row.category === category);
    const factor = direction === "asc" ? 1 : -1;
    return [...pool].sort((a, b) => {
      const left = a[sort];
      const right = b[sort];
      if (left == null && right == null) return a.name.localeCompare(b.name);
      if (left == null) return 1;
      if (right == null) return -1;
      if (typeof left === "string") return left.localeCompare(right) * factor;
      return (left - right) * factor;
    });
  }, [rows, category, sort, direction]);

  function chooseSort(key) {
    if (sort === key) setDirection((value) => (value === "asc" ? "desc" : "asc"));
    else {
      setSort(key);
      setDirection(key === "name" || key === "category" ? "asc" : "asc");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="grid gap-3 sm:grid-cols-4">
        <Stat label="Fans saved" value={totals.fans} />
        <Stat label="Verified fans" value={totals.verified} />
        <Stat label="Completed runs" value={totals.runs} />
        <Stat label="Picks" value={totals.picks} />
      </section>

      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setCategory(item.id)}
            className={category === item.id ? on : off}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[64rem] text-left text-sm">
          <thead>
            <tr>
              <Sort label="Name" column="name" sort={sort} onSort={chooseSort} />
              <Sort label="Category" column="category" sort={sort} onSort={chooseSort} />
              <Sort label="Fans rank" column="fanRank" sort={sort} onSort={chooseSort} />
              <Sort label="Everyone rank" column="allRank" sort={sort} onSort={chooseSort} />
              <Sort label="Verified rank" column="verifiedRank" sort={sort} onSort={chooseSort} />
              <Sort label="Votes" column="votes" sort={sort} onSort={chooseSort} />
              <Sort label="Win rate" column="winRate" sort={sort} onSort={chooseSort} />
              <Sort label="Elo" column="elo" sort={sort} onSort={chooseSort} />
              <th className="px-2 py-2">Beats most</th>
              <th className="px-2 py-2">Loses to most</th>
              <th className="px-2 py-2">Card</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={row.id} className="border-t border-[#0A111F]/15 align-top">
                <td className="py-2 pr-2 font-medium">{row.name}</td>
                <td className="px-2 py-2">{row.category}</td>
                <td className="px-2 py-2">{row.fanRank ?? "still counting"}</td>
                <td className="px-2 py-2">{row.allRank ?? "still counting"}</td>
                <td className="px-2 py-2">{row.verifiedRank ?? "still counting"}</td>
                <td className="px-2 py-2">{row.votes}</td>
                <td className="px-2 py-2">{rate(row.winRate)}</td>
                <td className="px-2 py-2">{row.elo}</td>
                <td className="px-2 py-2">{pairList(row.beats)}</td>
                <td className="px-2 py-2">{pairList(row.loses)}</td>
                <td className="px-2 py-2">
                  <a className="font-semibold underline-offset-4 hover:underline" href={`/watch-with/${club}/card/${row.id}`}>
                    Download card
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-[14px] border-2 border-[#0A111F] p-4">
      <p className="text-sm">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
    </div>
  );
}

function Sort({ label, column, sort, onSort }) {
  return (
    <th className="px-2 py-2">
      <button type="button" onClick={() => onSort(column)} className="font-semibold underline-offset-4 hover:underline">
        {label}
      </button>
    </th>
  );
}

const off = "min-h-11 rounded-full border-2 border-[#0A111F] px-4 text-sm font-semibold";
const on = "min-h-11 rounded-full border-2 border-[#D8232A] bg-[#D8232A] px-4 text-sm font-semibold text-[#F2EDE4]";
