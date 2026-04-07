import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import { randomBytes } from "crypto";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";
import db from "./db.js";
import { TOPICS } from "./topics.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(cors());
app.use(express.json());

// Serve built React app in production
const clientDist = join(__dirname, "../../client/dist");
if (existsSync(clientDist)) {
  app.use(express.static(clientDist));
}

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*" },
});

// ─── REST: list topics ────────────────────────────────────────────────────────
app.get("/api/topics", (_req, res) => {
  res.json(TOPICS.map(({ id, name, description, grade }) => ({ id, name, description, grade })));
});

// ─── REST: create session ────────────────────────────────────────────────────
app.post("/api/sessions", (req, res) => {
  const { topicId, goalTasks, countdownMinutes } = req.body as {
    topicId: string;
    goalTasks?: number;
    countdownMinutes?: number;
  };
  const topic = TOPICS.find((t) => t.id === topicId);
  if (!topic) return res.status(400).json({ error: "Ukjent tema" });

  const id = randomBytes(8).toString("hex");
  const code = Math.floor(100000 + Math.random() * 900000).toString();

  db.prepare(
    `INSERT INTO sessions (id, code, topic_id, goal_tasks, countdown_minutes)
     VALUES (?, ?, ?, ?, ?)`
  ).run(id, code, topicId, goalTasks ?? null, countdownMinutes ?? null);

  res.json({ sessionId: id, code });
});

// ─── REST: get session info (for teacher to poll/check) ──────────────────────
app.get("/api/sessions/:id", (req, res) => {
  const session = db.prepare("SELECT * FROM sessions WHERE id = ?").get(req.params.id) as any;
  if (!session) return res.status(404).json({ error: "Økt ikke funnet" });
  res.json(session);
});

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getSessionStats(sessionId: string) {
  const students = db
    .prepare("SELECT id, username FROM students WHERE session_id = ?")
    .all(sessionId) as { id: string; username: string }[];

  const studentStats = students.map((s) => {
    const rows = db
      .prepare("SELECT is_correct FROM answers WHERE student_id = ?")
      .all(s.id) as { is_correct: number }[];
    const correct = rows.filter((r) => r.is_correct).length;
    const total = rows.length;
    return { id: s.id, username: s.username, correct, total };
  });

  const totalCorrect = studentStats.reduce((sum, s) => sum + s.correct, 0);

  // Wrong questions sorted by error count
  const wrongQuestions = db
    .prepare(`
      SELECT question_text, correct_answer, COUNT(*) as error_count
      FROM answers
      WHERE session_id = ? AND is_correct = 0
      GROUP BY question_text, correct_answer
      ORDER BY error_count DESC
    `)
    .all(sessionId) as { question_text: string; correct_answer: number; error_count: number }[];

  return { students: studentStats, totalCorrect, wrongQuestions };
}

// ─── Socket.io ───────────────────────────────────────────────────────────────
const teacherSockets = new Map<string, string>(); // sessionId → socketId

io.on("connection", (socket) => {
  // Teacher joins their session room
  socket.on("teacher:join", (sessionId: string) => {
    const session = db.prepare("SELECT * FROM sessions WHERE id = ?").get(sessionId) as any;
    if (!session) return;
    socket.join(`session:${sessionId}`);
    teacherSockets.set(sessionId, socket.id);
    socket.emit("session:state", {
      session,
      topic: TOPICS.find((t) => t.id === session.topic_id),
      ...getSessionStats(sessionId),
    });
  });

  // Teacher starts session
  socket.on("teacher:start", (sessionId: string) => {
    const session = db.prepare("SELECT * FROM sessions WHERE id = ?").get(sessionId) as any;
    if (!session || session.status !== "waiting") return;

    db.prepare("UPDATE sessions SET status = 'active', started_at = unixepoch() WHERE id = ?").run(sessionId);
    const updated = db.prepare("SELECT * FROM sessions WHERE id = ?").get(sessionId) as any;
    io.to(`session:${sessionId}`).emit("session:started", updated);
  });

  // Teacher ends session
  socket.on("teacher:end", (sessionId: string) => {
    db.prepare("UPDATE sessions SET status = 'ended', ended_at = unixepoch() WHERE id = ?").run(sessionId);
    const stats = getSessionStats(sessionId);
    io.to(`session:${sessionId}`).emit("session:ended", stats);
  });

  // Student joins by code
  socket.on("student:join", ({ code }: { code: string }, callback: (res: any) => void) => {
    const session = db.prepare("SELECT * FROM sessions WHERE code = ?").get(code) as any;
    if (!session) return callback({ error: "Feil kode – prøv igjen" });
    if (session.status === "ended") return callback({ error: "Denne økten er avsluttet" });

    const adjectives = ["Glad", "Rask", "Smart", "Modig", "Sterk", "Lur", "Snill", "Kjekk"];
    const animals = ["Rev", "Ulv", "Bjørn", "Ørn", "Hai", "Løve", "Tiger", "Panda", "Koala", "Ape"];
    let username = "";
    let attempts = 0;
    while (attempts < 20) {
      const candidate =
        adjectives[Math.floor(Math.random() * adjectives.length)] +
        animals[Math.floor(Math.random() * animals.length)];
      const exists = db
        .prepare("SELECT id FROM students WHERE session_id = ? AND username = ?")
        .get(session.id, candidate);
      if (!exists) { username = candidate; break; }
      attempts++;
    }
    if (!username) username = "Elev" + Math.floor(Math.random() * 9999);

    const studentId = randomBytes(8).toString("hex");
    db.prepare(
      "INSERT INTO students (id, session_id, username, socket_id) VALUES (?, ?, ?, ?)"
    ).run(studentId, session.id, username, socket.id);

    socket.join(`session:${session.id}`);
    socket.data.studentId = studentId;
    socket.data.sessionId = session.id;

    // Notify teacher
    io.to(`session:${session.id}`).emit("student:joined", { id: studentId, username });

    callback({
      ok: true,
      studentId,
      username,
      sessionId: session.id,
      status: session.status,
      topic: TOPICS.find((t) => t.id === session.topic_id)
        ? { id: session.topic_id, name: TOPICS.find((t) => t.id === session.topic_id)!.name }
        : null,
      goalTasks: session.goal_tasks,
      countdownMinutes: session.countdown_minutes,
    });
  });

  // Student requests a new question
  socket.on("student:next_question", (_, callback: (q: any) => void) => {
    const { sessionId } = socket.data;
    if (!sessionId) return;
    const session = db.prepare("SELECT * FROM sessions WHERE id = ?").get(sessionId) as any;
    if (!session || session.status !== "active") return;
    const topic = TOPICS.find((t) => t.id === session.topic_id);
    if (!topic) return;
    callback(topic.generate());
  });

  // Student submits an answer
  socket.on("student:answer", ({ questionId, questionText, correctAnswer, givenAnswer }: {
    questionId: string;
    questionText: string;
    correctAnswer: number;
    givenAnswer: number;
  }) => {
    const { studentId, sessionId } = socket.data;
    if (!studentId || !sessionId) return;

    const isCorrect = givenAnswer === correctAnswer ? 1 : 0;
    const answerId = randomBytes(8).toString("hex");

    db.prepare(`
      INSERT INTO answers (id, student_id, session_id, question_id, question_text, correct_answer, given_answer, is_correct)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(answerId, studentId, sessionId, questionId, questionText, correctAnswer, givenAnswer, isCorrect);

    socket.emit("answer:result", { isCorrect: isCorrect === 1, correctAnswer });

    // Update teacher with fresh stats
    const stats = getSessionStats(sessionId);
    io.to(`session:${sessionId}`).emit("stats:update", stats);

    // Check if goal is reached
    const session = db.prepare("SELECT * FROM sessions WHERE id = ?").get(sessionId) as any;
    if (session.goal_tasks) {
      const myCorrect = (db.prepare("SELECT COUNT(*) as n FROM answers WHERE student_id = ? AND is_correct = 1").get(studentId) as any).n;
      if (myCorrect >= session.goal_tasks) {
        socket.emit("student:goal_reached", { correct: myCorrect });
      }
    }
  });

  socket.on("disconnect", () => {
    const { studentId, sessionId } = socket.data;
    if (studentId && sessionId) {
      db.prepare("UPDATE students SET socket_id = NULL WHERE id = ?").run(studentId);
    }
  });
});

// Fallback: send React app for all non-API routes
if (existsSync(clientDist)) {
  app.get("*", (_req, res) => {
    res.sendFile(join(clientDist, "index.html"));
  });
}

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => console.log(`Server kjører på port ${PORT}`));
