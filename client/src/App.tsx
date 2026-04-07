import { useState } from "react";
import Home from "./pages/Home";
import TeacherDashboard from "./pages/TeacherDashboard";
import StudentGame from "./pages/StudentGame";

export type AppView =
  | { page: "home" }
  | { page: "teacher"; sessionId: string; code: string; topicName: string }
  | { page: "student"; sessionId: string; studentId: string; username: string; topicName: string; goalTasks?: number; countdownMinutes?: number };

export default function App() {
  const [view, setView] = useState<AppView>({ page: "home" });

  if (view.page === "teacher") {
    return (
      <TeacherDashboard
        sessionId={view.sessionId}
        code={view.code}
        topicName={view.topicName}
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
        onHome={() => setView({ page: "home" })}
      />
    );
  }

  return <Home onNavigate={setView} />;
}
