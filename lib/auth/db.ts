import "server-only";

import mysql from "mysql2/promise";

export const pool = mysql.createPool({
  host: process.env.MYSQL_HOST ?? "127.0.0.1",
  port: Number(process.env.MYSQL_PORT ?? "3306"),
  database: process.env.MYSQL_DATABASE ?? "xmetapay_db",
  user: process.env.MYSQL_USER ?? "root",
  password: process.env.MYSQL_PASSWORD ?? "",
  waitForConnections: true,
  connectionLimit: 10,
  namedPlaceholders: true,
});
