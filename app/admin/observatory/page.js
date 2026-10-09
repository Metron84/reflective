import Link from "next/link";
import AdminNav from "@/components/admin/AdminNav";
import { requireAdminPage } from "@/lib/auth/admin";
import { percent, studyDashboard } from "@/lib/observatory/admin-view";
import { STUDY_SLUG } from "@/lib/observatory/footballer-001";
import { getServiceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Observatory",
  robots: { index: false, follow: false },
};

const day = new Date().toISOString().slice(0, 10);

export default async function ObservatoryAdminPage() {
  await requireAdminPage();
  const client = getServiceClient();
  let view = null;
  if (client) {
    const { data: responses } = await client
      .from("study_results_v")
      .select("*")
      .eq("study_slug", STUDY_SLUG);
    const { count } = await client
      .from("study_responses")
      .select("id", { count: "exact", head: true })
      .eq("study_slug", STUDY_SLUG);
    const { data: answers } = await client
      .from("study_answers")
      .select("question_id, shown_position, response_id, study_responses!inner(study_slug)")
      .eq("study_responses.study_slug", STUDY_SLUG);
    const completed = responses ?? [];
    const started = count ?? completed.length;
    const rows = [
      ...completed,
      ...Array.from({ length: Math.max(0, started - completed.length) }, () => ({ completed_at: null })),
    ];
    view = studyDashboard(rows, answers ?? []);
  }

  return (
    <main className="min-h-screen bg-[#F2EDE4] px-4 py-8 text-[#0A111F]" style={{ fontFamily: "var(--font-body), Archivo, sans-serif" }}>
      <div className="mx-auto flex max-w-5xl flex-col gap-8">
        <AdminNav active="observatory" />
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm">My Programme</p>
            <h1 className="text-3xl font-semibold">Observatory</h1>
            <p className="mt-1">Study 001. What should a footballer be?</p>
          </div>
          <div className="flex gap-3">
            <a className="rounded-[14px] bg-[#D8232A] px-4 py-2 text-sm font-semibold text-[#F2EDE4]" href={`/api/admin/observatory/footballer-001/export?file=responses`}>
              Download responses
            </a>
            <a className="rounded-[14px] border-2 border-[#0A111F] px-4 py-2 text-sm font-semibold" href={`/api/admin/observatory/footballer-001/export?file=answers`}>
              Download answers
            </a>
          </div>
        </header>
        {!view ? <p>The study store is not connected.</p> : <Dashboard view={view} />}
        <p className="text-xs text-[#0A111F]/60">Export files use the date {day}.</p>
        <Link href="/account" className="text-sm underline-offset-4 hover:underline">Back to My Programme</Link>
      </div>
    </main>
  );
}

function Dashboard({ view }) {
  return (
    <>
      <section className="grid gap-3 sm:grid-cols-4">
        <Stat label="Started" value={view.started} />
        <Stat label="Completed" value={view.completed} />
        <Stat label="Completion" value={percent(view.completed, view.started)} />
        <Stat label="Median seconds" value={view.medianSeconds ?? "-"} />
      </section>

      <section>
        <h2 className="mb-3 text-xl font-semibold">Primary archetype</h2>
        <table className="w-full text-left text-sm">
          <tbody>
            {view.order.map((key) => (
              <tr key={key} className="border-t border-[#0A111F]/15">
                <td className="py-2">{view.archetypes[key].name}</td>
                <td>{view.primary[key]}</td>
                <td>{percent(view.primary[key], view.completed)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2 className="mb-1 text-xl font-semibold">Want vs see</h2>
        <p className="mb-3 text-sm">Match rate {percent(Math.round(view.matchRate * 100), 100)}</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead>
              <tr>
                <th className="py-2 pr-2">Want</th>
                {view.order.map((key) => (
                  <th key={key} className="px-2 py-2">{key}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {view.order.map((row) => (
                <tr key={row} className="border-t border-[#0A111F]/15">
                  <th className="py-2 pr-2 font-medium">{view.archetypes[row].name}</th>
                  {view.order.map((col) => (
                    <td key={col} className="px-2 py-2">{view.grid[row][col]}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-xl font-semibold">The Gentle One by Ted Lasso</h2>
        <table className="w-full text-left text-sm">
          <tbody>
            {Object.entries(view.gentle).map(([label, cell]) => (
              <tr key={label} className="border-t border-[#0A111F]/15">
                <td className="py-2">{label}</td>
                <td>{cell.gentle} of {cell.total}</td>
                <td>{percent(cell.gentle, cell.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <Split title="By age" groups={view.byAge} order={view.order} names={view.archetypes} />
      <Split title="By branch" groups={view.byBranch} order={view.order} names={view.archetypes} />

      <section>
        <h2 className="mb-3 text-xl font-semibold">Position bias</h2>
        <table className="w-full text-left text-sm">
          <thead>
            <tr>
              <th className="py-2">Question</th>
              <th>Position 1</th>
              <th>Position 2</th>
              <th>Position 3</th>
            </tr>
          </thead>
          <tbody>
            {Object.keys(view.questions).map((id) => {
              const cell = view.positions[id] ?? { 1: 0, 2: 0, 3: 0 };
              return (
                <tr key={id} className="border-t border-[#0A111F]/15">
                  <td className="py-2">{id}</td>
                  <td>{cell[1]}</td>
                  <td>{cell[2]}</td>
                  <td>{cell[3]}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="flex flex-col gap-6">
        <h2 className="text-xl font-semibold">Study map</h2>
        <p>
          {view.paths.total} paths. Tension questions:{" "}
          {view.order.map((key) => `${key} ${view.paths.leaderCounts[key]}`).join(", ")}.
          Land on: {view.order.map((key) => `${key} ${view.paths.primaryCounts[key]}`).join(", ")}.
        </p>
        {Object.entries(view.questions).map(([id, question]) => {
          const doubled = id.startsWith("t");
          return (
            <article key={id}>
              <h3 className="font-semibold">{id}. {question.text}{doubled ? " (counts double)" : ""}</h3>
              <ul className="mt-2 flex flex-col gap-1 text-sm">
                {question.options.map((option) => (
                  <li key={option.id}>
                    {option.text}{" "}
                    {Object.entries(option.points).map(([key, value]) => `${key}:${value * (doubled ? 2 : 1)}`).join(" ")}
                  </li>
                ))}
              </ul>
            </article>
          );
        })}
      </section>
    </>
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

function Split({ title, groups, order, names }) {
  return (
    <section>
      <h2 className="mb-3 text-xl font-semibold">{title}</h2>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[36rem] text-left text-sm">
          <thead>
            <tr>
              <th className="py-2 pr-2">Group</th>
              {order.map((key) => (
                <th key={key} className="px-2">{names[key].name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.entries(groups).map(([label, counts]) => (
              <tr key={label} className="border-t border-[#0A111F]/15">
                <th className="py-2 pr-2 font-medium">{label}</th>
                {order.map((key) => (
                  <td key={key} className="px-2 py-2">{counts[key]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
