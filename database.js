const Database = require('better-sqlite3');

// This creates the database file automatically
// if it doesn't exist yet
const db = new Database('yordi_printing.db');

// Create the transactions table
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

console.log('Database and table created successfully!');

module.exports = db;