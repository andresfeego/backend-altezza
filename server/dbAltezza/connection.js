const mysql = require('mysql2');

const pool = mysql.createPool({
  host: process.env.ALTEZZA_DB_HOST || '127.0.0.1',
  port: Number(process.env.ALTEZZA_DB_PORT || 3306),
  user: process.env.ALTEZZA_DB_USER,
  password: process.env.ALTEZZA_DB_PASS,
  database: process.env.ALTEZZA_DB_NAME,
  waitForConnections: true,
  connectionLimit: Number(process.env.ALTEZZA_DB_POOL || 10),
  queueLimit: 0,
  charset: 'utf8mb4',
});

module.exports = pool;
