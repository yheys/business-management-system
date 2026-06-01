const express = require('express');
const db = require('./database');

const app = express();
app.use(express.json());
app.use(express.static('.'));

// ── TRANSACTION ROUTES ──
app.post('/transaction', (req, res) => {
  const { type, description, quantity, price, cost } = req.body;
  db.prepare(`
    INSERT INTO transactions (type, description, quantity, price, cost)
    VALUES (?, ?, ?, ?, ?)
  `).run(type, description, quantity, price, cost);
  res.json({ message: 'Transaction saved successfully' });
});

app.get('/transactions', (req, res) => {
  res.json(db.prepare('SELECT * FROM transactions').all());
});

app.put('/transaction/:id', (req, res) => {
  const { type, description, quantity, price, date } = req.body;
  db.prepare(`
    UPDATE transactions SET type=?, description=?, quantity=?, price=?, date=? WHERE id=?
  `).run(type, description, quantity, price, date, req.params.id);
  res.json({ message: 'Transaction updated' });
});

app.delete('/transaction/:id', (req, res) => {
  db.prepare('DELETE FROM transactions WHERE id=?').run(req.params.id);
  res.json({ message: 'Transaction deleted' });
});

// ── EXPENSE ROUTES ──
app.post('/expense', (req, res) => {
  const { category, description, amount } = req.body;
  db.prepare(`
    INSERT INTO expenses (category, description, amount)
    VALUES (?, ?, ?)
  `).run(category, description || '', amount);
  res.json({ message: 'Expense saved successfully' });
});

app.get('/expenses', (req, res) => {
  res.json(db.prepare('SELECT * FROM expenses').all());
});

app.put('/expense/:id', (req, res) => {
  const { category, description, amount, date } = req.body;
  db.prepare(`
    UPDATE expenses SET category=?, description=?, amount=?, date=? WHERE id=?
  `).run(category, description || '', amount, date, req.params.id);
  res.json({ message: 'Expense updated' });
});

app.delete('/expense/:id', (req, res) => {
  db.prepare('DELETE FROM expenses WHERE id=?').run(req.params.id);
  res.json({ message: 'Expense deleted' });
});

// ── HELPER: build topService from transactions ──
function buildTopService(transactions) {
  const byService = {};
  transactions.forEach(t => {
    if (!byService[t.description]) byService[t.description] = 0;
    byService[t.description] += t.price * t.quantity;
  });
  return Object.entries(byService)
    .sort((a, b) => b[1] - a[1])
    .map(([name, income]) => ({ name, income }));
}

// ── DAILY REPORT ──
app.get('/report/today', (req, res) => {
  const transactions = db.prepare(`
    SELECT * FROM transactions WHERE date = date('now') ORDER BY id DESC
  `).all();
  const expenses = db.prepare(`
    SELECT * FROM expenses WHERE date = date('now') ORDER BY id DESC
  `).all();
  const totalIncome = transactions.reduce((s, t) => s + t.price * t.quantity, 0);
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  res.json({
    transactions, expenses, totalIncome, totalExpenses,
    netProfit: totalIncome - totalExpenses,
    topService: buildTopService(transactions)
  });
});

// ── WEEKLY BREAKDOWN BY DAY (Mon–Sat of current week) ──
app.get('/report/week-days', (req, res) => {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const transactions = db.prepare(`
      SELECT * FROM transactions WHERE date = date('now', '-${i} days') ORDER BY id DESC
    `).all();
    const expenses = db.prepare(`
      SELECT * FROM expenses WHERE date = date('now', '-${i} days') ORDER BY id DESC
    `).all();
    const date = db.prepare(`SELECT date('now', '-${i} days') as d`).get().d;
    const grouped = {};
    transactions.forEach(t => {
      if (!grouped[t.description]) grouped[t.description] = { description: t.description, type: t.type, totalQty: 0, totalIncome: 0 };
      grouped[t.description].totalQty += t.quantity;
      grouped[t.description].totalIncome += t.price * t.quantity;
    });
    const totalIncome = transactions.reduce((s, t) => s + t.price * t.quantity, 0);
    const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
    days.push({ date, totalIncome, totalExpenses, netProfit: totalIncome - totalExpenses, grouped: Object.values(grouped), expenses });
  }
  res.json(days);
});

// ── MONTHLY BREAKDOWN BY WEEK ──
app.get('/report/month-weeks', (req, res) => {
  // Get first day of current month
  const firstDay = db.prepare(`SELECT date('now', 'start of month') as d`).get().d;
  const lastDay = db.prepare(`SELECT date('now', 'start of month', '+1 month', '-1 day') as d`).get().d;

  // Get all transactions and expenses for this month
  const allTx = db.prepare(`
    SELECT * FROM transactions
    WHERE strftime('%Y-%m', date) = strftime('%Y-%m', 'now')
    ORDER BY date ASC
  `).all();
  const allExp = db.prepare(`
    SELECT * FROM expenses
    WHERE strftime('%Y-%m', date) = strftime('%Y-%m', 'now')
    ORDER BY date ASC
  `).all();

  // Split into weeks
  const weeks = [];
  let weekStart = new Date(firstDay + 'T00:00:00');
  const end = new Date(lastDay + 'T00:00:00');
  let weekNum = 1;

  while (weekStart <= end) {
    let weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    if (weekEnd > end) weekEnd = new Date(end);

    const ws = weekStart.toISOString().split('T')[0];
    const we = weekEnd.toISOString().split('T')[0];

    const txs = allTx.filter(t => t.date >= ws && t.date <= we);
    const exps = allExp.filter(e => e.date >= ws && e.date <= we);

    const totalIncome = txs.reduce((s, t) => s + t.price * t.quantity, 0);
    const totalExpenses = exps.reduce((s, e) => s + e.amount, 0);

    // Group by description
    const grouped = {};
    txs.forEach(t => {
      if (!grouped[t.description]) grouped[t.description] = { description: t.description, type: t.type, totalQty: 0, totalIncome: 0 };
      grouped[t.description].totalQty += t.quantity;
      grouped[t.description].totalIncome += t.price * t.quantity;
    });

    weeks.push({
      weekNum,
      weekStart: ws,
      weekEnd: we,
      totalIncome,
      totalExpenses,
      netProfit: totalIncome - totalExpenses,
      grouped: Object.values(grouped),
      expenses: exps
    });

    weekNum++;
    weekStart.setDate(weekStart.getDate() + 7);
  }

  // Summary
  const totalIncome = allTx.reduce((s, t) => s + t.price * t.quantity, 0);
  const totalExpenses = allExp.reduce((s, e) => s + e.amount, 0);

  res.json({
    weeks,
    totalIncome,
    totalExpenses,
    netProfit: totalIncome - totalExpenses,
    topService: buildTopService(allTx)
  });
});

// ── ANNUAL BREAKDOWN BY MONTH ──
app.get('/report/annual', (req, res) => {
  const year = new Date().getFullYear();
  const months = [];
  const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  const allTx = db.prepare(`
    SELECT * FROM transactions
    WHERE strftime('%Y', date) = '${year}'
    ORDER BY date ASC
  `).all();
  const allExp = db.prepare(`
    SELECT * FROM expenses
    WHERE strftime('%Y', date) = '${year}'
    ORDER BY date ASC
  `).all();

  for (let m = 0; m < 12; m++) {
    const monthStr = String(m + 1).padStart(2, '0');
    const key = `${year}-${monthStr}`;

    const txs = allTx.filter(t => t.date.startsWith(key));
    const exps = allExp.filter(e => e.date.startsWith(key));

    const totalIncome = txs.reduce((s, t) => s + t.price * t.quantity, 0);
    const totalExpenses = exps.reduce((s, e) => s + e.amount, 0);

    const grouped = {};
    txs.forEach(t => {
      if (!grouped[t.description]) grouped[t.description] = { description: t.description, type: t.type, totalQty: 0, totalIncome: 0 };
      grouped[t.description].totalQty += t.quantity;
      grouped[t.description].totalIncome += t.price * t.quantity;
    });

    months.push({
      monthNum: m + 1,
      monthName: MONTH_NAMES[m],
      monthKey: key,
      totalIncome,
      totalExpenses,
      netProfit: totalIncome - totalExpenses,
      grouped: Object.values(grouped),
      expenses: exps
    });
  }

  const totalIncome = allTx.reduce((s, t) => s + t.price * t.quantity, 0);
  const totalExpenses = allExp.reduce((s, e) => s + e.amount, 0);

  res.json({
    year,
    months,
    totalIncome,
    totalExpenses,
    netProfit: totalIncome - totalExpenses,
    topService: buildTopService(allTx)
  });
});

// Start the server
app.listen(3000, () => {
  console.log('Server is running on http://localhost:3000');
});