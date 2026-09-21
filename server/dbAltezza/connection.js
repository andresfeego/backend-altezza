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
  timezone: process.env.ALTEZZA_DB_TIMEZONE || '-05:00',
});

// TIMESTAMP columns use the MySQL session timezone, whereas DATETIME does not.
// Match it to mysql2's decoder so confirmation deadlines are not shifted twice.
pool.on('connection', (connection) => {
  connection.query('SET time_zone = ?', [process.env.ALTEZZA_DB_TIMEZONE || '-05:00'], (error) => {
    if (error) connection.destroy();
  });
});

module.exports = pool;
