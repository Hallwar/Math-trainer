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

const clientDist = join(__dirname, "../../client/dist");
if (existsSync(clientDist)) {
  app.use(express.static(clientDist));
}

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });

// ─── Types ────────────────────────────────────────────────────────────────────
interface Round { type: "normal" | "demo" | "poll"; topicId: string; goalTasks?: number; answerMode?: "multiple_choice" | "input" }

// ─── Poll state ───────────────────────────────────────────────────────────────
interface PollState {
  question: { id: string; text: string; answer: number; options: number[]; optionLabels?: string[] };
  votes: number[];
  voterIds: Set<string>;
  revealed: boolean;
}
const pollSessions = new Map<string, PollState>();

// ─── Helpers ──────────────────────────────────────────────────────────────────
function parseRounds(json: string): Round[] {
  try { return JSON.parse(json); } catch { return []; }
}

function makeCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function makeId() {
  return randomBytes(8).toString("hex");
}

function getSessionStats(sessionId: string) {
  const session = db.prepare("SELECT * FROM sessions WHERE id = ?").get(sessionId) as any;
  if (!session) return null;
  const rounds = parseRounds(session.rounds);
  const currentRound: number = session.current_round;
  const currentGoal = rounds[currentRound]?.goalTasks ?? null;

  const students = db
    .prepare("SELECT id, username FROM students WHERE session_id = ?")
    .all(sessionId) as { id: string; username: string }[];

  const studentStats = students.map((s) => {
    const roundRows = db
      .prepare("SELECT is_correct FROM answers WHERE student_id = ? AND round_index = ?")
      .all(s.id, currentRound) as { is_correct: number }[];
    const roundCorrect = roundRows.filter((r) => r.is_correct).length;
    const roundTotal = roundRows.length;
    const roundDone = currentGoal !== null && roundCorrect >= currentGoal;

    const allRows = db
      .prepare("SELECT is_correct FROM answers WHERE student_id = ?")
      .all(s.id) as { is_correct: number }[];
    const allCorrect = allRows.filter((r) => r.is_correct).length;

    return { id: s.id, username: s.username, roundCorrect, roundTotal, roundDone, allCorrect };
  });

  const isDemo = rounds[currentRound]?.type === "demo";
  const doneCount = isDemo ? students.length : studentStats.filter((s) => s.roundDone).length;
  const totalCorrect = studentStats.reduce((sum, s) => sum + s.roundCorrect, 0);

  const wrongQuestions = db
    .prepare(`
      SELECT question_text, correct_answer, COUNT(*) as error_count
      FROM answers
      WHERE session_id = ? AND round_index = ? AND is_correct = 0
      GROUP BY question_text, correct_answer
      ORDER BY error_count DESC
    `)
    .all(sessionId, currentRound) as { question_text: string; correct_answer: number; error_count: number }[];

  return {
    students: studentStats,
    totalCorrect,
    doneCount,
    wrongQuestions,
    currentRound,
    totalRounds: rounds.length,
    rounds,
  };
}

// ─── REST ─────────────────────────────────────────────────────────────────────
app.get("/api/topics", (_req, res) => {
  res.json(TOPICS.map(({ id, name, description, grade }) => ({ id, name, description, grade })));
});

app.post("/api/sessions", (req, res) => {
  const { rounds, countdownMinutes } = req.body as {
    rounds: Round[];
    countdownMinutes?: number;
  };
  if (!rounds?.length) return res.status(400).json({ error: "Minst én runde kreves" });
  for (const r of rounds) {
    if (!TOPICS.find((t) => t.id === r.topicId)) return res.status(400).json({ error: `Ukjent tema: ${r.topicId}` });
  }
  const id = makeId();
  const code = makeCode();
  db.prepare(
    "INSERT INTO sessions (id, code, rounds, countdown_minutes) VALUES (?, ?, ?, ?)"
  ).run(id, code, JSON.stringify(rounds), countdownMinutes ?? null);
  res.json({ sessionId: id, code });
});

// ─── Socket ───────────────────────────────────────────────────────────────────
io.on("connection", (socket) => {

  // Teacher joins session
  socket.on("teacher:join", (sessionId: string) => {
    const session = db.prepare("SELECT * FROM sessions WHERE id = ?").get(sessionId) as any;
    if (!session) return;
    socket.join(`session:${sessionId}`);
    const stats = getSessionStats(sessionId);
    socket.emit("session:state", { session, ...stats });
  });

  // Teacher starts session (round 0)
  socket.on("teacher:start", (sessionId: string) => {
    const session = db.prepare("SELECT * FROM sessions WHERE id = ?").get(sessionId) as any;
    if (!session || session.status !== "waiting") return;
    db.prepare("UPDATE sessions SET status = 'active', started_at = unixepoch() WHERE id = ?").run(sessionId);
    const updated = db.prepare("SELECT * FROM sessions WHERE id = ?").get(sessionId) as any;
    const rounds = parseRounds(updated.rounds);
    io.to(`session:${sessionId}`).emit("session:started", {
      session: updated,
      round: { index: 0, total: rounds.length, ...rounds[0] },
    });
  });

  // Teacher advances to next round
  socket.on("teacher:next_round", (sessionId: string) => {
    const session = db.prepare("SELECT * FROM sessions WHERE id = ?").get(sessionId) as any;
    if (!session || session.status !== "active") return;
    const rounds = parseRounds(session.rounds);
    const nextIndex = session.current_round + 1;
    if (nextIndex >= rounds.length) return;
    db.prepare("UPDATE sessions SET current_round = ? WHERE id = ?").run(nextIndex, sessionId);
    pollSessions.delete(sessionId);
    io.to(`session:${sessionId}`).emit("round:changed", {
      index: nextIndex,
      total: rounds.length,
      ...rounds[nextIndex],
    });
    const stats = getSessionStats(sessionId);
    io.to(`session:${sessionId}`).emit("stats:update", stats);
  });

  // Teacher requests next demo question (broadcast to students too)
  socket.on("teacher:demo_question", (sessionId: string, callback: (q: any) => void) => {
    const session = db.prepare("SELECT * FROM sessions WHERE id = ?").get(sessionId) as any;
    if (!session) return;
    const rounds = parseRounds(session.rounds);
    const topic = TOPICS.find((t) => t.id === rounds[session.current_round]?.topicId);
    if (!topic) return;
    const q = topic.generate();
    // Broadcast question to students (they see it on their screen)
    socket.to(`session:${sessionId}`).emit("demo:question", q);
    callback(q);
  });

  // Teacher reveals answer in demo mode
  socket.on("teacher:demo_reveal", (sessionId: string, answer: number) => {
    io.to(`session:${sessionId}`).emit("demo:reveal", { answer });
  });

  // Teacher ends session
  socket.on("teacher:end", (sessionId: string) => {
    db.prepare("UPDATE sessions SET status = 'ended', ended_at = unixepoch() WHERE id = ?").run(sessionId);
    pollSessions.delete(sessionId);
    const stats = getSessionStats(sessionId);
    io.to(`session:${sessionId}`).emit("session:ended", stats);
  });

  // Teacher restarts with existing students (new session, same students, same rounds)
  socket.on("teacher:restart_with_students", (sessionId: string, callback: (res: any) => void) => {
    const session = db.prepare("SELECT * FROM sessions WHERE id = ?").get(sessionId) as any;
    if (!session) return callback({ error: "Økt ikke funnet" });
    const newId = makeId();
    const newCode = makeCode();
    db.prepare(
      "INSERT INTO sessions (id, code, rounds, countdown_minutes) VALUES (?, ?, ?, ?)"
    ).run(newId, newCode, session.rounds, session.countdown_minutes);

    // Move all students to new session
    db.prepare("UPDATE students SET session_id = ? WHERE session_id = ?").run(newId, sessionId);

    // Update socket rooms for all connected students
    const students = db
      .prepare("SELECT socket_id FROM students WHERE session_id = ?")
      .all(newId) as { socket_id: string | null }[];

    for (const { socket_id } of students) {
      if (!socket_id) continue;
      const studentSocket = io.sockets.sockets.get(socket_id);
      if (studentSocket) {
        studentSocket.leave(`session:${sessionId}`);
        studentSocket.join(`session:${newId}`);
        studentSocket.data.sessionId = newId;
        studentSocket.emit("session:restarted", { sessionId: newId, code: newCode });
      }
    }

    callback({ newSessionId: newId, newCode });
  });

  // Student rejoins existing session (from localStorage)
  socket.on("student:rejoin", ({ studentId, sessionId }: { studentId: string; sessionId: string }, callback: (res: any) => void) => {
    const session = db.prepare("SELECT * FROM sessions WHERE id = ?").get(sessionId) as any;
    if (!session || session.status === "ended") return callback({ error: "Økten er avsluttet" });
    const student = db.prepare("SELECT * FROM students WHERE id = ? AND session_id = ?").get(studentId, sessionId) as any;
    if (!student) return callback({ error: "Fant ikke brukeren" });

    db.prepare("UPDATE students SET socket_id = ? WHERE id = ?").run(socket.id, studentId);
    socket.join(`session:${sessionId}`);
    socket.data.studentId = studentId;
    socket.data.sessionId = sessionId;

    const rounds = parseRounds(session.rounds);
    const currentRound: number = session.current_round;

    // How many correct answers has this student given this round?
    const roundCorrect = (db.prepare(
      "SELECT COUNT(*) as n FROM answers WHERE student_id = ? AND round_index = ? AND is_correct = 1"
    ).get(studentId, currentRound) as any).n;

    io.to(`session:${sessionId}`).emit("student:joined", { id: studentId, username: student.username });

    callback({
      ok: true,
      studentId,
      username: student.username,
      sessionId,
      status: session.status,
      currentRound,
      totalRounds: rounds.length,
      topicName: TOPICS.find((t) => t.id === rounds[currentRound]?.topicId)?.name ?? "",
      topicType: rounds[currentRound]?.type ?? "normal",
      goalTasks: rounds[currentRound]?.goalTasks ?? null,
      countdownMinutes: session.countdown_minutes,
      roundCorrect,
    });
  });

  // Student joins by code
  socket.on("student:join", ({ code }: { code: string }, callback: (res: any) => void) => {
    const session = db.prepare("SELECT * FROM sessions WHERE code = ?").get(code) as any;
    if (!session) return callback({ error: "Feil kode – prøv igjen" });
    if (session.status === "ended") return callback({ error: "Denne økten er avsluttet" });

    const adjectives = ["Glad", "Rask", "Smart", "Modig", "Sterk", "Lur", "Snill", "Kjekk"];
    const animals = ["Rev", "Ulv", "Bjørn", "Ørn", "Hai", "Løve", "Tiger", "Panda", "Koala", "Ape"];
    let username = "";
    for (let i = 0; i < 20; i++) {
      const candidate = adjectives[Math.floor(Math.random() * adjectives.length)] +
        animals[Math.floor(Math.random() * animals.length)];
      if (!db.prepare("SELECT id FROM students WHERE session_id = ? AND username = ?").get(session.id, candidate)) {
        username = candidate; break;
      }
    }
    if (!username) username = "Elev" + Math.floor(Math.random() * 9999);

    const studentId = makeId();
    db.prepare("INSERT INTO students (id, session_id, username, socket_id) VALUES (?, ?, ?, ?)")
      .run(studentId, session.id, username, socket.id);

    socket.join(`session:${session.id}`);
    socket.data.studentId = studentId;
    socket.data.sessionId = session.id;

    io.to(`session:${session.id}`).emit("student:joined", { id: studentId, username });

    const rounds = parseRounds(session.rounds);
    const currentRound: number = session.current_round;
    callback({
      ok: true,
      studentId,
      username,
      sessionId: session.id,
      status: session.status,
      currentRound,
      totalRounds: rounds.length,
      topicName: TOPICS.find((t) => t.id === rounds[currentRound]?.topicId)?.name ?? "",
      topicType: rounds[currentRound]?.type ?? "normal",
      goalTasks: rounds[currentRound]?.goalTasks ?? null,
      countdownMinutes: session.countdown_minutes,
      roundCorrect: 0,
    });
  });

  // Teacher issues poll question
  socket.on("teacher:poll_question", (sessionId: string, callback: (q: any) => void) => {
    const session = db.prepare("SELECT * FROM sessions WHERE id = ?").get(sessionId) as any;
    if (!session || session.status !== "active") return;
    const rounds = parseRounds(session.rounds);
    const topic = TOPICS.find((t) => t.id === rounds[session.current_round]?.topicId);
    if (!topic) return;
    const q = topic.generate();
    if (!q.options?.length) return;
    pollSessions.set(sessionId, {
      question: q,
      votes: new Array(q.options.length).fill(0),
      voterIds: new Set(),
      revealed: false,
    });
    const { answer, ...qForStudents } = q;
    socket.to(`session:${sessionId}`).emit("poll:question", qForStudents);
    callback(q);
  });

  // Teacher reveals poll answer
  socket.on("teacher:poll_reveal", (sessionId: string) => {
    const state = pollSessions.get(sessionId);
    if (!state) return;
    state.revealed = true;
    io.to(`session:${sessionId}`).emit("poll:reveal", {
      correctAnswer: state.question.answer,
      votes: state.votes,
      total: state.voterIds.size,
      options: state.question.options,
      optionLabels: state.question.optionLabels,
    });
  });

  // Student submits poll vote
  socket.on("student:poll_answer", ({ questionId, optionIndex, givenAnswer }: { questionId: string; optionIndex: number; givenAnswer: number }) => {
    const { studentId, sessionId } = socket.data;
    if (!studentId || !sessionId) return;
    const state = pollSessions.get(sessionId);
    if (!state || state.revealed || state.question.id !== questionId) return;
    if (state.voterIds.has(studentId)) return;
    state.voterIds.add(studentId);
    if (optionIndex >= 0 && optionIndex < state.votes.length) state.votes[optionIndex]++;
    const session = db.prepare("SELECT * FROM sessions WHERE id = ?").get(sessionId) as any;
    if (session) {
      const isCorrect = givenAnswer === state.question.answer ? 1 : 0;
      db.prepare(`INSERT INTO answers (id, student_id, session_id, round_index, question_id, question_text, correct_answer, given_answer, is_correct) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(makeId(), studentId, sessionId, session.current_round, questionId, state.question.text, state.question.answer, givenAnswer, isCorrect);
    }
    const studentCount = (db.prepare("SELECT COUNT(*) as n FROM students WHERE session_id = ?").get(sessionId) as any).n;
    io.to(`session:${sessionId}`).emit("poll:votes", {
      votes: state.votes,
      total: state.voterIds.size,
      studentCount,
      options: state.question.options,
      optionLabels: state.question.optionLabels,
    });
    const stats = getSessionStats(sessionId);
    io.to(`session:${sessionId}`).emit("stats:update", stats);
  });

  // Student requests next question
  socket.on("student:next_question", (_: any, callback: (q: any) => void) => {
    const { sessionId } = socket.data;
    if (!sessionId) return;
    const session = db.prepare("SELECT * FROM sessions WHERE id = ?").get(sessionId) as any;
    if (!session || session.status !== "active") return;
    const rounds = parseRounds(session.rounds);
    const topic = TOPICS.find((t) => t.id === rounds[session.current_round]?.topicId);
    if (!topic) return;
    const q = topic.generate();
    const answerMode = rounds[session.current_round]?.answerMode ?? "multiple_choice";
    if (answerMode === "input") {
      const { options: _o, optionLabels: _ol, ...rest } = q;
      callback(rest);
    } else {
      callback(q);
    }
  });

  // Student submits answer
  socket.on("student:answer", ({ questionId, questionText, correctAnswer, givenAnswer }: {
    questionId: string; questionText: string; correctAnswer: number; givenAnswer: number;
  }) => {
    const { studentId, sessionId } = socket.data;
    if (!studentId || !sessionId) return;
    const session = db.prepare("SELECT * FROM sessions WHERE id = ?").get(sessionId) as any;
    if (!session) return;

    const isCorrect = givenAnswer === correctAnswer ? 1 : 0;
    db.prepare(`
      INSERT INTO answers (id, student_id, session_id, round_index, question_id, question_text, correct_answer, given_answer, is_correct)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(makeId(), studentId, sessionId, session.current_round, questionId, questionText, correctAnswer, givenAnswer, isCorrect);

    socket.emit("answer:result", { isCorrect: isCorrect === 1, correctAnswer });

    // Check goal for current round
    const rounds = parseRounds(session.rounds);
    const currentGoal = rounds[session.current_round]?.goalTasks;
    if (currentGoal) {
      const roundCorrect = (db.prepare(
        "SELECT COUNT(*) as n FROM answers WHERE student_id = ? AND round_index = ? AND is_correct = 1"
      ).get(studentId, session.current_round) as any).n;
      if (roundCorrect >= currentGoal) {
        const isLastRound = session.current_round >= rounds.length - 1;
        socket.emit("round:complete", { roundIndex: session.current_round, isLastRound });
      }
    }

    // Push updated stats to teacher
    const stats = getSessionStats(sessionId);
    io.to(`session:${sessionId}`).emit("stats:update", stats);
  });

  socket.on("disconnect", () => {
    const { studentId } = socket.data;
    if (studentId) db.prepare("UPDATE students SET socket_id = NULL WHERE id = ?").run(studentId);
  });
});

if (existsSync(clientDist)) {
  app.get("*", (_req, res) => res.sendFile(join(clientDist, "index.html")));
}

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => console.log(`Server kjører på port ${PORT}`));
