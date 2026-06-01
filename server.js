const express = require('express');
const db = require('./database');

const app = express();
app.use(express.json());
app.use(express.static('.'));

// ── TRANSACTION ROUTES ──

// Save a new transaction
app.post('/transaction', (req, res) => {
  const { type, description, quantity, price, cost } = req.body;
  db.prepare(`
    INSERT INTO transactions (type, description, quantity, price, cost)
    VALUES (?, ?, ?, ?, ?)
  `).run(type, description, quantity, price, cost);
  res.json({ message: 'Transaction saved successfully' });
});

// Get all transactions
app.get('/transactions', (req, res) => {
  const rows = db.prepare('SELECT * FROM transactions').all();
  res.json(rows);
});

// Edit a transaction
app.put('/transaction/:id', (req, res) => {
  const { type, description, quantity, price, date } = req.body;
  db.prepare(`
    UPDATE transactions
    SET type = ?, description = ?, quantity = ?, price = ?, date = ?
    WHERE id = ?
  `).run(type, description, quantity, price, date, req.params.id);
  res.json({ message: 'Transaction updated' });
});

// Delete a transaction
app.delete('/transaction/:id', (req, res) => {
  db.prepare('DELETE FROM transactions WHERE id = ?').run(req.params.id);
  res.json({ message: 'Transaction deleted' });
});

// ── EXPENSE ROUTES ──

// Save a new expense
app.post('/expense', (req, res) => {
  const { category, description, amount } = req.body;
  db.prepare(`
    INSERT INTO expenses (category, description, amount)
    VALUES (?, ?, ?)
  `).run(category, description || '', amount);
  res.json({ message: 'Expense saved successfully' });
});

// Get all expenses
app.get('/expenses', (req, res) => {
  const rows = db.prepare('SELECT * FROM expenses').all();
  res.json(rows);
});

// Edit an expense
app.put('/expense/:id', (req, res) => {
  const { category, description, amount, date } = req.body;
  db.prepare(`
    UPDATE expenses
    SET category = ?, description = ?, amount = ?, date = ?
    WHERE id = ?
  `).run(category, description || '', amount, date, req.params.id);
  res.json({ message: 'Expense updated' });
});

// Delete an expense
app.delete('/expense/:id', (req, res) => {
  db.prepare('DELETE FROM expenses WHERE id = ?').run(req.params.id);
  res.json({ message: 'Expense deleted' });
});

// ── DAILY REPORT ROUTE ──
app.get('/report/today', (req, res) => {
  const transactions = db.prepare(`
    SELECT * FROM transactions
    WHERE date = date('now')
    ORDER BY id DESC
  `).all();

  const expenses = db.prepare(`
    SELECT * FROM expenses
    WHERE date = date('now')
    ORDER BY id DESC
  `).all();

  const totalIncome = transactions.reduce((sum, t) => sum + (t.price * t.quantity), 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  const byService = {};
  transactions.forEach(t => {
    if (!byService[t.description]) byService[t.description] = 0;
    byService[t.description] += t.price * t.quantity;
  });

  const topService = Object.entries(byService)
    .sort((a, b) => b[1] - a[1])
    .map(([name, income]) => ({ name, income }));

  res.json({ transactions, expenses, totalIncome, totalExpenses, netProfit: totalIncome - totalExpenses, topService });
});

// ── WEEKLY REPORT ROUTE ──
app.get('/report/week', (req, res) => {
  const transactions = db.prepare(`
    SELECT * FROM transactions
    WHERE date >= date('now', '-6 days')
    ORDER BY date DESC
  `).all();

  const expenses = db.prepare(`
    SELECT * FROM expenses
    WHERE date >= date('now', '-6 days')
    ORDER BY date DESC
  `).all();

  const totalIncome = transactions.reduce((sum, t) => sum + (t.price * t.quantity), 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  res.json({ transactions, expenses, totalIncome, totalExpenses, netProfit: totalIncome - totalExpenses });
});

// ── MONTHLY REPORT ROUTE ──
app.get('/report/month', (req, res) => {
  const transactions = db.prepare(`
    SELECT * FROM transactions
    WHERE strftime('%Y-%m', date) = strftime('%Y-%m', 'now')
    ORDER BY date DESC
  `).all();

  const expenses = db.prepare(`
    SELECT * FROM expenses
    WHERE strftime('%Y-%m', date) = strftime('%Y-%m', 'now')
    ORDER BY date DESC
  `).all();

  const totalIncome = transactions.reduce((sum, t) => sum + (t.price * t.quantity), 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  const byService = {};
  transactions.forEach(t => {
    if (!byService[t.description]) byService[t.description] = 0;
    byService[t.description] += t.price * t.quantity;
  });

  const topService = Object.entries(byService)
    .sort((a, b) => b[1] - a[1])
    .map(([name, income]) => ({ name, income }));

  res.json({ transactions, expenses, totalIncome, totalExpenses, netProfit: totalIncome - totalExpenses, topService });
});

// ── WEEKLY BREAKDOWN BY DAY ──
app.get('/report/week-days', (req, res) => {
  const days = [];

  for (let i = 6; i >= 0; i--) {
    const transactions = db.prepare(`
      SELECT * FROM transactions
      WHERE date = date('now', '-${i} days')
      ORDER BY id DESC
    `).all();

    const expenses = db.prepare(`
      SELECT * FROM expenses
      WHERE date = date('now', '-${i} days')
      ORDER BY id DESC
    `).all();

    const date = db.prepare(`SELECT date('now', '-${i} days') as d`).get().d;

    const grouped = {};
    transactions.forEach(t => {
      if (!grouped[t.description]) {
        grouped[t.description] = {
          description: t.description,
          type: t.type,
          totalQty: 0,
          totalIncome: 0
        };
      }
      grouped[t.description].totalQty += t.quantity;
      grouped[t.description].totalIncome += t.price * t.quantity;
    });

    const totalIncome = transactions.reduce((s, t) => s + t.price * t.quantity, 0);
    const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);

    days.push({
      date,
      totalIncome,
      totalExpenses,
      netProfit: totalIncome - totalExpenses,
      grouped: Object.values(grouped),
      expenses
    });
  }

  res.json(days);
});

// Start the server
app.listen(3000, () => {
  console.log('Server is running on http://localhost:3000');
});