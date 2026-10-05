import { AsyncLocalStorage } from "node:async_hooks";
import * as ultimaDb from "@/lib/ultima/server/db";

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
  return strictDb(ultimaDb.getUltimaDb());
}

const jobContext = new AsyncLocalStorage();

/** Names the route or cron job for every logged read error inside `fn`. */
export function withReadContext(name, fn) {
  return jobContext.run(name, fn);
}

/** One line per swallowed Supabase error, so Vercel logs show what failed and where. */
export function logReadError(label, table, error) {
  const where = jobContext.getStore() ?? label;
  console.error(`[ultima/read-error] ${where} ${table}: ${error?.message ?? error}`);
}

function loggedThenable(builder, label, table) {
  return new Proxy(builder, {
    get(target, prop) {
      if (prop === "then") {
        return (resolve, reject) =>
          Promise.resolve(target)
            .then((result) => {
              if (result?.error) logReadError(label, table, result.error);
              return result;
            })
            .then(resolve, reject);
      }
      const value = Reflect.get(target, prop, target);
      if (typeof value !== "function") return value;
      return (...args) => {
        const out = value.apply(target, args);
        return out && typeof out.then === "function" ? loggedThenable(out, label, table) : out;
      };
    },
  });
}

/**
 * For paths that tolerate read errors on purpose (cron, bots, draft, notifications).
 * Behaviour is unchanged: the caller still gets { data, error }. The error is
 * also logged with the job or module name and the Supabase message.
 */
export function loggedDb(db, label) {
  if (!db) return db;
  return new Proxy(db, {
    get(target, prop) {
      if (prop === "from") {
        return (table) => {
          const builder = target.from(table);
          return new Proxy(builder, {
            get(b, method) {
              const value = Reflect.get(b, method, b);
              if (typeof value !== "function") return value;
              if (["select", "insert", "update", "upsert", "delete"].includes(method)) {
                return (...args) => loggedThenable(value.apply(b, args), label, table);
              }
              return value.bind(b);
            },
          });
        };
      }
      if (prop === "rpc") {
        return (name, ...rest) => loggedThenable(target.rpc(name, ...rest), label, `rpc ${name}`);
      }
      const value = Reflect.get(target, prop, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

export function getLoggedDb(label) {
  return loggedDb(ultimaDb.getUltimaDb(), label);
}
