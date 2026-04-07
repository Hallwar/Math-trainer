import { DatabaseSync } from "node:sqlite";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DB_PATH ?? join(__dirname, "../../data.db");
const db = new DatabaseSync(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    rounds TEXT NOT NULL DEFAULT '[]',
    current_round INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'waiting',
    countdown_minutes INTEGER,
    started_at INTEGER,
    ended_at INTEGER,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS students (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    username TEXT NOT NULL,
    socket_id TEXT,
    joined_at INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (session_id) REFERENCES sessions(id)
  );

  CREATE TABLE IF NOT EXISTS answers (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    round_index INTEGER NOT NULL DEFAULT 0,
    question_id TEXT NOT NULL,
    question_text TEXT NOT NULL,
    correct_answer INTEGER NOT NULL,
    given_answer INTEGER NOT NULL,
    is_correct INTEGER NOT NULL,
    answered_at INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (student_id) REFERENCES students(id)
  );
`);

export default db;
