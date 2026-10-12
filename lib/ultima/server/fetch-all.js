const PAGE = 1000;

/**
 * Read every row of a query. Supabase returns at most 1000 rows per request,
 * so a bigger result is fetched in ranges. `build()` returns a fresh query
 * each time and should already be ordered by a unique column.
 */
export async function fetchAll(build, { page = PAGE } = {}) {
  const rows = [];
  for (let from = 0; ; from += page) {
    const { data, error } = await build().range(from, from + page - 1);
    if (error) throw new Error(error.message ?? "read_failed");
    rows.push(...(data ?? []));
    if ((data ?? []).length < page) break;
  }
  return rows;
}

/** Same, over id chunks, for `.in()` lists that would blow the URL limit. */
export async function fetchAllIn(build, ids, { chunk = 150 } = {}) {
  const rows = [];
  for (let i = 0; i < ids.length; i += chunk) {
    rows.push(...(await fetchAll(() => build(ids.slice(i, i + chunk)))));
  }
  return rows;
}
