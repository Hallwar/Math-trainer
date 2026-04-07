import { useState } from "react";
import type { AppView } from "../App";
import { socket } from "../socket";
import s from "./Home.module.css";

interface Topic {
  id: string;
  name: string;
  description: string;
  grade: string;
}

export default function Home({ onNavigate }: { onNavigate: (v: AppView) => void }) {
  const [mode, setMode] = useState<"choose" | "teacher" | "student">("choose");
  const [topics, setTopics] = useState<Topic[]>([]);
  const [selectedTopic, setSelectedTopic] = useState("");
  const [goalTasks, setGoalTasks] = useState("");
  const [countdown, setCountdown] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [joinCode, setJoinCode] = useState("");

  async function loadTopics() {
    const res = await fetch("/api/topics");
    const data = await res.json();
    setTopics(data);
    setSelectedTopic(data[0]?.id ?? "");
    setMode("teacher");
  }

  async function createSession() {
    if (!selectedTopic) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topicId: selectedTopic,
          goalTasks: goalTasks ? parseInt(goalTasks) : undefined,
          countdownMinutes: countdown ? parseInt(countdown) : undefined,
        }),
      });
      const data = await res.json();
      const topicName = topics.find((t) => t.id === selectedTopic)?.name ?? "";
      onNavigate({ page: "teacher", sessionId: data.sessionId, code: data.code, topicName });
    } catch {
      setError("Klarte ikke å opprette økt. Prøv igjen.");
    } finally {
      setLoading(false);
    }
  }

  function joinSession() {
    if (joinCode.length !== 6) {
      setError("Koden må være 6 sifre");
      return;
    }
    setLoading(true);
    setError("");
    socket.connect();
    socket.emit("student:join", { code: joinCode }, (res: any) => {
      setLoading(false);
      if (res.error) {
        setError(res.error);
        return;
      }
      onNavigate({
        page: "student",
        sessionId: res.sessionId,
        studentId: res.studentId,
        username: res.username,
        topicName: res.topic?.name ?? "",
        goalTasks: res.goalTasks ?? undefined,
        countdownMinutes: res.countdownMinutes ?? undefined,
      });
    });
  }

  return (
    <div className={s.container}>
      <header className={s.header}>
        <div className={s.logo}>➕➗</div>
        <h1>MatteTrening</h1>
        <p>Matematikkøvelse for klassen</p>
      </header>

      {mode === "choose" && (
        <div className={s.cards}>
          <button className={s.card} onClick={loadTopics}>
            <div className={s.cardIcon}>👩‍🏫</div>
            <h2>Jeg er lærer</h2>
            <p>Opprett en ny økt og inviter elevene</p>
          </button>
          <button className={s.card} onClick={() => setMode("student")}>
            <div className={s.cardIcon}>🎒</div>
            <h2>Jeg er elev</h2>
            <p>Skriv inn koden fra læreren</p>
          </button>
        </div>
      )}

      {mode === "teacher" && (
        <div className={s.form}>
          <h2>Opprett økt</h2>

          <label>
            Velg tema
            <select value={selectedTopic} onChange={(e) => setSelectedTopic(e.target.value)}>
              {topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} — {t.grade}
                </option>
              ))}
            </select>
          </label>

          <div className={s.row}>
            <label>
              Mål (antall rette)
              <input
                type="number"
                min={1}
                placeholder="Valgfritt"
                value={goalTasks}
                onChange={(e) => setGoalTasks(e.target.value)}
              />
            </label>
            <label>
              Nedtelling (minutter)
              <input
                type="number"
                min={1}
                placeholder="Valgfritt"
                value={countdown}
                onChange={(e) => setCountdown(e.target.value)}
              />
            </label>
          </div>

          {error && <p className={s.error}>{error}</p>}
          <div className={s.actions}>
            <button className={s.btnSecondary} onClick={() => setMode("choose")}>Tilbake</button>
            <button className={s.btnPrimary} onClick={createSession} disabled={loading}>
              {loading ? "Oppretter..." : "Opprett økt"}
            </button>
          </div>
        </div>
      )}

      {mode === "student" && (
        <div className={s.form}>
          <h2>Bli med i økt</h2>
          <label>
            Skriv inn koden fra læreren
            <input
              type="text"
              maxLength={6}
              placeholder="123456"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.replace(/\D/g, ""))}
              onKeyDown={(e) => e.key === "Enter" && joinSession()}
              className={s.codeInput}
              autoFocus
            />
          </label>
          {error && <p className={s.error}>{error}</p>}
          <div className={s.actions}>
            <button className={s.btnSecondary} onClick={() => { setMode("choose"); setError(""); }}>Tilbake</button>
            <button className={s.btnPrimary} onClick={joinSession} disabled={loading || joinCode.length !== 6}>
              {loading ? "Kobler til..." : "Bli med"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
