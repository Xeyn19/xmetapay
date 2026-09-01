# cPanel/phpMyAdmin production schema

Import `xmetapay-production-schema.sql` when setting up a new, empty production database in cPanel/phpMyAdmin. It contains the complete current table structure, indexes, foreign keys, and guarded compatibility statements, but no seed accounts or application row data.

## Safe import

1. Create the production database and database user in cPanel.
2. Grant that user the required privileges for the database.
3. Open phpMyAdmin and select the exact empty target database in the left sidebar.
4. Make a recoverable backup if the target has ever been used.
5. Use **Import** and upload `xmetapay-production-schema.sql`.
6. Confirm the import completed without errors, then configure the app's deployment-only `MYSQL_*` environment values.

The bundle deliberately contains no `CREATE DATABASE` or `USE xmetapay_db` statement because cPanel often prefixes database names. It never drops or truncates tables and contains no `INSERT`, `UPDATE`, `DELETE`, `REPLACE`, or `LOAD DATA` statements. Do not use this fresh-install bundle as a substitute for a reviewed migration on a database that already contains application tables or real records.

## Maintenance

`database/auth-schema.sql` and `database/full-schema-v1.sql` remain canonical. The committed production bundle is generated from those files by `generate-phpmyadmin-schema.mjs`; tests fail if it becomes stale or contains row-data statements. Regenerate it only after the canonical fresh schema has been updated and reviewed.
