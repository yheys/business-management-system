const Database = require("better-sqlite3");

const db = new Database("yordi_printing.db");

// Transactions table
db.exec(`
  CREATE TABLE IF NOT EXISTS transactions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    type        TEXT NOT NULL,
    description TEXT NOT NULL,
    quantity    INTEGER NOT NULL,
    price       REAL NOT NULL,
    cost        REAL NOT NULL DEFAULT 0,
    date        TEXT NOT NULL DEFAULT (date('now'))
  )
`);

// Expenses table
db.exec(`
  CREATE TABLE IF NOT EXISTS expenses (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    category    TEXT NOT NULL,
    description TEXT,
    amount      REAL NOT NULL,
    date        TEXT NOT NULL DEFAULT (date('now'))
  )
`);

console.log("✅ Database ready — both tables created!");

module.exports = db;
