import "server-only";

import mysql, { type Pool } from "mysql2/promise";

const isProduction = process.env.NODE_ENV === "production";
const isProductionBuild = process.env.NEXT_PHASE === "phase-production-build";

const globalForDatabase = globalThis as typeof globalThis & {
  xmetaPayDatabasePool?: Pool;
};

export const pool = globalForDatabase.xmetaPayDatabasePool ?? createDatabasePool();

if (!isProduction) {
  globalForDatabase.xmetaPayDatabasePool = pool;
}

function createDatabasePool() {
  return mysql.createPool({
    host: envValue("MYSQL_HOST", "127.0.0.1"),
    port: Number(process.env.MYSQL_PORT || "3306"),
    database: envValue("MYSQL_DATABASE", "xmetapay_db"),
    user: envValue("MYSQL_USER", "root"),
    password: envValue("MYSQL_PASSWORD", ""),
    waitForConnections: true,
    connectionLimit: 10,
    maxIdle: 10,
    idleTimeout: 60_000,
    queueLimit: 0,
    namedPlaceholders: true,
  });
}

function envValue(name: string, localFallback: string) {
  const value = process.env[name];

  if (value !== undefined && value !== "") {
    return value;
  }

  if (isProduction && !isProductionBuild) {
    throw new Error(`${name} must be set in production.`);
  }

  return localFallback;
}
