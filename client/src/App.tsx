import { useState } from "react";
import Home from "./pages/Home";
import TeacherDashboard from "./pages/TeacherDashboard";
import StudentGame from "./pages/StudentGame";
import { socket } from "./socket";

export interface RoundConfig { topicId: string; goalTasks: number }

export type AppView =
  | { page: "home" }
  | { page: "teacher"; sessionId: string; code: string; rounds: RoundConfig[]; topicLabel: string; countdownMinutes?: number }
  | { page: "student"; sessionId: string; studentId: string; username: string; topicName: string; goalTasks?: number; countdownMinutes?: number; currentRound: number; totalRounds: number };

export default function App() {
  const [view, setView] = useState<AppView>({ page: "home" });

  if (view.page === "teacher") {
    async function handleRestartWithStudents() {
      if (view.page !== "teacher") return;
      return new Promise<void>((resolve) => {
        socket.emit("teacher:restart_with_students", view.sessionId, (res: any) => {
          if (res.newSessionId) {
            setView({ ...view, sessionId: res.newSessionId, code: res.newCode });
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
        onHome={() => setView({ page: "home" })}
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
        onHome={() => setView({ page: "home" })}
      />
    );
  }

  return <Home onNavigate={setView} />;
}
