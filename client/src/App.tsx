import { useEffect, useState } from "react";
import Home from "./pages/Home";
import TeacherDashboard from "./pages/TeacherDashboard";
import StudentGame from "./pages/StudentGame";
import HistoryPage from "./pages/HistoryPage";
import { socket } from "./socket";
import { saveStudent, loadStudent, clearStudent, saveTeacher, loadTeacher, clearTeacher } from "./session";

export interface RoundConfig {
  type: "normal" | "demo" | "poll";
  topicId: string;
  goalTasks?: number;
  answerMode?: "multiple_choice" | "input" | "mixed";
}

export type AppView =
  | { page: "home" }
  | { page: "history" }
  | { page: "teacher"; sessionId: string; code: string; rounds: RoundConfig[]; topicLabel: string; countdownMinutes?: number }
  | { page: "student"; sessionId: string; studentId: string; username: string; topicName: string; goalTasks?: number; countdownMinutes?: number; currentRound: number; totalRounds: number; roundCorrect?: number };

type ResumeState = "checking" | "none" | "resuming";

export default function App() {
  const [view, setView] = useState<AppView>({ page: "home" });
  const [resumeState, setResumeState] = useState<ResumeState>("checking");
  const [resumeError, setResumeError] = useState("");

  // On mount: check localStorage for saved session
  useEffect(() => {
    const savedStudent = loadStudent();
    const savedTeacher = loadTeacher();

    if (savedStudent) {
      // Try to rejoin as student
      socket.connect();
      socket.emit("student:rejoin", {
        studentId: savedStudent.studentId,
        sessionId: savedStudent.sessionId,
      }, (res: any) => {
        if (res.error) {
          clearStudent();
          setResumeState("none");
        } else {
          setView({
            page: "student",
            sessionId: res.sessionId,
            studentId: res.studentId,
            username: res.username,
            topicName: res.topicName,
            goalTasks: res.goalTasks ?? undefined,
            countdownMinutes: res.countdownMinutes ?? undefined,
            currentRound: res.currentRound,
            totalRounds: res.totalRounds,
            roundCorrect: res.roundCorrect,
          });
          setResumeState("none");
        }
      });
    } else if (savedTeacher) {
      // Restore teacher view directly (no socket needed to verify)
      setView({
        page: "teacher",
        sessionId: savedTeacher.sessionId,
        code: savedTeacher.code,
        rounds: savedTeacher.rounds,
        topicLabel: savedTeacher.topicLabel,
        countdownMinutes: savedTeacher.countdownMinutes,
      });
      setResumeState("none");
    } else {
      setResumeState("none");
    }
  }, []);

  function handleNavigate(v: AppView) {
    // Persist to localStorage
    if (v.page === "student") {
      saveStudent({ studentId: v.studentId, sessionId: v.sessionId, username: v.username });
    } else if (v.page === "teacher") {
      saveTeacher({ sessionId: v.sessionId, code: v.code, rounds: v.rounds, topicLabel: v.topicLabel, countdownMinutes: v.countdownMinutes });
    }
    setView(v);
  }

  function handleHome() {
    clearStudent();
    clearTeacher();
    setView({ page: "home" });
  }

  if (resumeState === "checking") {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", flexDirection: "column", gap: "1rem", color: "#6b7280" }}>
        <div style={{ width: "2.5rem", height: "2.5rem", border: "4px solid #e5e7eb", borderTopColor: "#2563eb", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <p>Gjenoppretter økt...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (view.page === "teacher") {
    async function handleRestartWithStudents() {
      if (view.page !== "teacher") return;
      return new Promise<void>((resolve) => {
        socket.emit("teacher:restart_with_students", view.sessionId, (res: any) => {
          if (res.newSessionId) {
            const updated: AppView = { ...view, sessionId: res.newSessionId, code: res.newCode };
            saveTeacher({ sessionId: res.newSessionId, code: res.newCode, rounds: view.rounds, topicLabel: view.topicLabel, countdownMinutes: view.countdownMinutes });
            setView(updated);
          }
          resolve();
        });
      });
    }
    return (
      <TeacherDashboard
        sessionId={view.sessionId}
        code={view.code}
        rounds={view.rounds}
        topicLabel={view.topicLabel}
        countdownMinutes={view.countdownMinutes}
        onRestartWithStudents={handleRestartWithStudents}
        onHome={handleHome}
      />
    );
  }

  if (view.page === "student") {
    return (
      <StudentGame
        sessionId={view.sessionId}
        studentId={view.studentId}
        username={view.username}
        topicName={view.topicName}
        goalTasks={view.goalTasks}
        countdownMinutes={view.countdownMinutes}
        currentRound={view.currentRound}
        totalRounds={view.totalRounds}
        initialCorrect={view.roundCorrect ?? 0}
        onHome={handleHome}
      />
    );
  }

  if (view.page === "history") {
    return <HistoryPage onBack={() => setView({ page: "home" })} />;
  }

  return <Home onNavigate={handleNavigate} onHistory={() => setView({ page: "history" })} resumeError={resumeError} />;
}
