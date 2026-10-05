/**
 * A tiny stand-in for the Supabase client. Every query is recorded, then answered
 * by the handler a test passes in: handler(query) -> { data, error, count }.
 * query = { table, op, payload, filters: [[method, ...args]], selected, options }
 */
export function makeFakeDb(handler = () => ({ data: [], error: null })) {
  const log = [];

  function builder(table) {
    const query = { table, op: "select", payload: null, filters: [], selected: null, options: null };
    const api = {
      select(columns, options) {
        query.selected = columns;
        query.options = options ?? null;
        return api;
      },
      insert(payload) {
        query.op = "insert";
        query.payload = payload;
        return api;
      },
      upsert(payload, options) {
        query.op = "upsert";
        query.payload = payload;
        query.options = options ?? null;
        return api;
      },
      update(payload) {
        query.op = "update";
        query.payload = payload;
        return api;
      },
      delete() {
        query.op = "delete";
        return api;
      },
      rpc() {
        return api;
      },
    };
    for (const method of ["eq", "neq", "in", "gte", "lte", "lt", "gt", "or", "order", "limit", "range", "is"]) {
      api[method] = (...args) => {
        query.filters.push([method, ...args]);
        return api;
      };
    }
    const settle = () => {
      log.push(query);
      return Promise.resolve(handler(query) ?? { data: null, error: null });
    };
    api.maybeSingle = () => settle().then((r) => ({ ...r, data: Array.isArray(r.data) ? (r.data[0] ?? null) : (r.data ?? null) }));
    api.single = api.maybeSingle;
    api.then = (resolve, reject) => settle().then(resolve, reject);
    return api;
  }

  return {
    log,
    from: builder,
    rpc(name, args) {
      const query = { table: `rpc:${name}`, op: "rpc", payload: args, filters: [], selected: null, options: null };
      log.push(query);
      return Promise.resolve(handler(query) ?? { data: null, error: null });
    },
  };
}

export const has = (query, method, ...args) =>
  query.filters.some(
    (f) => f[0] === method && args.every((a, i) => JSON.stringify(f[i + 1]) === JSON.stringify(a)),
  );
