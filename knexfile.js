const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

module.exports = {
  client: 'mysql2',
  connection: {
    host: process.env.ALTEZZA_DB_HOST || '127.0.0.1',
    port: Number(process.env.ALTEZZA_DB_PORT || 3306),
    user: process.env.ALTEZZA_DB_USER,
    password: process.env.ALTEZZA_DB_PASS,
    database: process.env.ALTEZZA_DB_NAME,
    charset: 'utf8mb4',
  },
  pool: {
    min: 0,
    max: Number(process.env.ALTEZZA_DB_POOL || 10),
  },
  migrations: {
    directory: path.resolve(__dirname, 'migrations'),
    tableName: 'knex_migrations',
    extension: 'js',
  },
};
