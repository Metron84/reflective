import { getUltimaDb } from "@/lib/ultima/server/db";

/** A read that Supabase refused. Pages turn this into a "did not load" notice. */
export class UltimaReadError extends Error {
  constructor(label, cause) {
    super(`Ultima read failed: ${label}`);
    this.name = "UltimaReadError";
    this.label = label;
    this.cause = cause;
  }
}

function strictThenable(builder, label) {
  return new Proxy(builder, {
    get(target, prop) {
      if (prop === "then") {
        return (resolve, reject) =>
          Promise.resolve(target)
            .then((result) => {
              if (result?.error) {
                console.error(`[ultima/read] ${label}: ${result.error.message ?? result.error}`);
                throw new UltimaReadError(label, result.error);
              }
              return result;
            })
            .then(resolve, reject);
      }
      const value = Reflect.get(target, prop, target);
      if (typeof value !== "function") return value;
      return (...args) => {
        const out = value.apply(target, args);
        return out && typeof out.then === "function" ? strictThenable(out, label) : out;
      };
    },
  });
}

/**
 * The service client with one change: a select (or rpc) that comes back with an
 * error rejects instead of resolving to { data: null, error }. Use it in read
 * paths so a failed query can never render as an empty list. Writes
 * (insert, update, upsert, delete) are left exactly as they were.
 */
export function strictDb(db) {
  if (!db) return null;
  return {
    from(table) {
      const builder = db.from(table);
      return new Proxy(builder, {
        get(target, prop) {
          const value = Reflect.get(target, prop, target);
          if (typeof value !== "function") return value;
          if (prop === "select") {
            return (...args) => strictThenable(value.apply(target, args), table);
          }
          return value.bind(target);
        },
      });
    },
    rpc(name, ...rest) {
      return strictThenable(db.rpc(name, ...rest), `rpc ${name}`);
    },
  };
}

export function getReadDb() {
  return strictDb(getUltimaDb());
}
