const express = require("express");
const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const path = require("path");

const PORT = process.env.PORT || 3000;
// In production, set JWT_SECRET as an environment variable. Never commit a real secret.
const JWT_SECRET = process.env.JWT_SECRET || "dev-only-secret-change-me";

const db = new Database(path.join(__dirname, "taskflow.db"));
db.pragma("journal_mode = WAL");
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'medium',
    done INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ---------- Auth middleware ----------
// Reads "Authorization: Bearer <token>", verifies it, and attaches req.userId.
function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Missing token" });
  try {
    req.userId = jwt.verify(token, JWT_SECRET).userId;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

const isEmail = (s) => typeof s === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

// ---------- Auth routes ----------
app.post("/api/register", (req, res) => {
  const { email, password } = req.body;
  if (!isEmail(email)) return res.status(400).json({ error: "Valid email required" });
  if (typeof password !== "string" || password.length < 6)
    return res.status(400).json({ error: "Password must be at least 6 characters" });

  const hash = bcrypt.hashSync(password, 10);
  try {
    const info = db.prepare("INSERT INTO users (email, password_hash) VALUES (?, ?)").run(email.toLowerCase(), hash);
    const token = jwt.sign({ userId: info.lastInsertRowid }, JWT_SECRET, { expiresIn: "7d" });
    res.status(201).json({ token });
  } catch (e) {
    if (String(e.message).includes("UNIQUE")) return res.status(409).json({ error: "Email already registered" });
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/login", (req, res) => {
  const { email, password } = req.body;
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(String(email || "").toLowerCase());
  if (!user || !bcrypt.compareSync(String(password || ""), user.password_hash))
    return res.status(401).json({ error: "Wrong email or password" });
  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "7d" });
  res.json({ token });
});

// ---------- Task routes (all protected, scoped to the logged-in user) ----------
app.get("/api/tasks", requireAuth, (req, res) => {
  const tasks = db
    .prepare("SELECT id, title, priority, done, created_at FROM tasks WHERE user_id = ? ORDER BY done ASC, id DESC")
    .all(req.userId);
  res.json(tasks.map((t) => ({ ...t, done: !!t.done })));
});

app.post("/api/tasks", requireAuth, (req, res) => {
  const title = String(req.body.title || "").trim();
  const priority = ["low", "medium", "high"].includes(req.body.priority) ? req.body.priority : "medium";
  if (!title) return res.status(400).json({ error: "Title required" });
  if (title.length > 200) return res.status(400).json({ error: "Title too long" });
  const info = db.prepare("INSERT INTO tasks (user_id, title, priority) VALUES (?, ?, ?)").run(req.userId, title, priority);
  res.status(201).json({ id: info.lastInsertRowid, title, priority, done: false });
});

app.patch("/api/tasks/:id", requireAuth, (req, res) => {
  const task = db.prepare("SELECT * FROM tasks WHERE id = ? AND user_id = ?").get(req.params.id, req.userId);
  if (!task) return res.status(404).json({ error: "Task not found" });
  const title = req.body.title !== undefined ? String(req.body.title).trim() : task.title;
  const done = req.body.done !== undefined ? (req.body.done ? 1 : 0) : task.done;
  if (!title) return res.status(400).json({ error: "Title required" });
  db.prepare("UPDATE tasks SET title = ?, done = ? WHERE id = ?").run(title, done, task.id);
  res.json({ id: task.id, title, done: !!done });
});

app.delete("/api/tasks/:id", requireAuth, (req, res) => {
  const info = db.prepare("DELETE FROM tasks WHERE id = ? AND user_id = ?").run(req.params.id, req.userId);
  if (info.changes === 0) return res.status(404).json({ error: "Task not found" });
  res.status(204).end();
});

app.listen(PORT, () => console.log(`TaskFlow running at http://localhost:${PORT}`));
