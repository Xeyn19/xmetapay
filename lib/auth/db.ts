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
    host: envValue("DB_HOST", "MYSQL_HOST", "127.0.0.1"),
    port: Number(envValue("DB_PORT", "MYSQL_PORT", "3306")),
    database: envValue("DB_NAME", "MYSQL_DATABASE", "xmetapay_db"),
    user: envValue("DB_USER", "MYSQL_USER", "root"),
    password: envValue("DB_PASSWORD", "MYSQL_PASSWORD", ""),
    waitForConnections: true,
    connectionLimit: 10,
    maxIdle: 10,
    idleTimeout: 60_000,
    queueLimit: 0,
    namedPlaceholders: true,
  });
}

function envValue(hostedName: string, localName: string, localFallback: string) {
  const value = process.env[hostedName] || process.env[localName];

  if (value !== undefined && value !== "") {
    return value;
  }

  if (isProduction && !isProductionBuild) {
    throw new Error(`${hostedName} or ${localName} must be set in production.`);
  }

  return localFallback;
}
