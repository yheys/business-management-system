const express = require('express');
const db = require('./database');

const app = express();
app.use(express.json());
app.use(express.static('.'));

// Route 1 — Save a new transaction
app.post('/transaction', (req, res) => {
const { type, description, quantity, price, cost } = req.body;

const insert = db.prepare(`
    INSERT INTO transactions (type, description, quantity, price, cost)
    VALUES (?, ?, ?, ?, ?)
`);

insert.run(type, description, quantity, price, cost);
res.json({ message: 'Transaction saved successfully' });
});

// Route 2 — Get all transactions
app.get('/transactions', (req, res) => {
  const rows = db.prepare('SELECT * FROM transactions').all();
res.json(rows);
});

// Start the server
app.listen(3000, () => {
console.log('Server is running on http://localhost:3000');
});