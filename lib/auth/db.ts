import "server-only";

import mysql from "mysql2/promise";

const isProduction = process.env.NODE_ENV === "production";
const isProductionBuild = process.env.NEXT_PHASE === "phase-production-build";

export const pool = mysql.createPool({
  host: envValue("MYSQL_HOST", "127.0.0.1"),
  port: Number(process.env.MYSQL_PORT || "3306"),
  database: envValue("MYSQL_DATABASE", "xmetapay_db"),
  user: envValue("MYSQL_USER", "root"),
  password: envValue("MYSQL_PASSWORD", ""),
  waitForConnections: true,
  connectionLimit: 10,
  namedPlaceholders: true,
});

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
