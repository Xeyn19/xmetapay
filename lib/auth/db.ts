import "server-only";

import mysql from "mysql2/promise";

const isProduction = process.env.NODE_ENV === "production";

export const pool = mysql.createPool({
  host: envValue("MYSQL_HOST", "127.0.0.1"),
  port: Number(envValue("MYSQL_PORT", "3306")),
  database: envValue("MYSQL_DATABASE", "xmetapay_db"),
  user: envValue("MYSQL_USER", "root"),
  password: envValue("MYSQL_PASSWORD", ""),
  ssl: mysqlSslConfig(),
  waitForConnections: true,
  connectionLimit: 10,
  namedPlaceholders: true,
});

function envValue(name: string, localFallback: string) {
  const value = process.env[name];

  if (value !== undefined && value !== "") {
    return value;
  }

  if (isProduction) {
    throw new Error(`${name} must be set in production.`);
  }

  return localFallback;
}

function mysqlSslConfig() {
  const enabled = process.env.MYSQL_SSL?.toLowerCase();
  const ca = process.env.MYSQL_SSL_CA?.replaceAll("\\n", "\n");

  if (!ca && enabled !== "true" && enabled !== "1" && enabled !== "required") {
    return undefined;
  }

  return {
    ca,
    rejectUnauthorized: process.env.MYSQL_SSL_REJECT_UNAUTHORIZED !== "false",
  };
}
