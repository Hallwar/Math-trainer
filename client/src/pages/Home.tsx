import { useState } from "react";
import type { AppView } from "../App";
import { socket } from "../socket";
import { loadTemplates, saveTemplate, deleteTemplate, type SessionTemplate } from "../session";
import s from "./Home.module.css";

interface Topic { id: string; name: string; description: string; grade: string }
interface RoundConfig { type: "normal" | "demo"; topicId: string; goalTasks: string }

export default function Home({ onNavigate, resumeError }: { onNavigate: (v: AppView) => void; resumeError?: string }) {
  const [mode, setMode] = useState<"choose" | "teacher" | "student">("choose");
  const [topics, setTopics] = useState<Topic[]>([]);
  const [rounds, setRounds] = useState<RoundConfig[]>([{ type: "normal", topicId: "", goalTasks: "" }]);
  const [countdown, setCountdown] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [templates, setTemplates] = useState<SessionTemplate[]>([]);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");

  async function loadTopics() {
    const res = await fetch("/api/topics");
    const data: Topic[] = await res.json();
    setTopics(data);
    setRounds([{ type: "normal", topicId: data[0]?.id ?? "", goalTasks: "" }]);
    setTemplates(loadTemplates());
    setMode("teacher");
  }

  function updateRound(i: number, field: keyof RoundConfig, value: string) {
    setRounds((prev) => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r));
  }

  function addRound(type: "normal" | "demo" = "normal") {
    setRounds((prev) => [...prev, { type, topicId: topics[0]?.id ?? "", goalTasks: "" }]);
  }

  function removeRound(i: number) {
    setRounds((prev) => prev.filter((_, idx) => idx !== i));
  }

  function loadTemplate(t: SessionTemplate) {
    setRounds(t.rounds.map((r) => ({
      type: r.type,
      topicId: r.topicId,
      goalTasks: r.goalTasks?.toString() ?? "",
    })));
    setCountdown(t.countdownMinutes?.toString() ?? "");
  }

  function handleSaveTemplate() {
    const name = templateName.trim();
    if (!name) return;
    saveTemplate({
      name,
      rounds: rounds.map((r) => ({
        type: r.type,
        topicId: r.topicId,
        goalTasks: r.type === "normal" ? parseInt(r.goalTasks) || undefined : undefined,
      })),
      countdownMinutes: countdown ? parseInt(countdown) : undefined,
    });
    setTemplates(loadTemplates());
    setTemplateName("");
    setSaveModalOpen(false);
  }

  function handleDeleteTemplate(id: string) {
    deleteTemplate(id);
    setTemplates(loadTemplates());
  }

  function topicName(id: string) {
    return topics.find((t) => t.id === id)?.name ?? id;
  }

  function templateSummary(t: SessionTemplate) {
    return t.rounds.map((r, i) =>
      `R${i + 1}: ${r.type === "demo" ? "Tavle – " : ""}${topicName(r.topicId)}${r.goalTasks ? ` (${r.goalTasks})` : ""}`
    ).join(" · ");
  }

  async function createSession() {
    for (const r of rounds) {
      if (!r.topicId) { setError("Velg tema for alle runder"); return; }
      if (r.type === "normal" && (!r.goalTasks || parseInt(r.goalTasks) < 1)) {
        setError("Sett et mål (min. 1) for alle vanlige runder"); return;
      }
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rounds: rounds.map((r) => ({
            type: r.type,
            topicId: r.topicId,
            goalTasks: r.type === "normal" ? parseInt(r.goalTasks) : undefined,
          })),
          countdownMinutes: countdown ? parseInt(countdown) : undefined,
        }),
      });
      const data = await res.json();
      const label = rounds.length === 1
        ? (topics.find((t) => t.id === rounds[0].topicId)?.name ?? "")
        : `${rounds.length} runder`;
      onNavigate({
        page: "teacher",
        sessionId: data.sessionId,
        code: data.code,
        rounds: rounds.map((r) => ({ type: r.type, topicId: r.topicId, goalTasks: r.type === "normal" ? parseInt(r.goalTasks) : undefined })),
        topicLabel: label,
        countdownMinutes: countdown ? parseInt(countdown) : undefined,
      });
    } catch {
      setError("Klarte ikke å opprette økt. Prøv igjen.");
    } finally {
      setLoading(false);
    }
  }

  function joinSession() {
    if (joinCode.length !== 6) { setError("Koden må være 6 sifre"); return; }
    setLoading(true);
    setError("");
    socket.connect();
    socket.emit("student:join", { code: joinCode }, (res: any) => {
      setLoading(false);
      if (res.error) { setError(res.error); return; }
      onNavigate({
        page: "student",
        sessionId: res.sessionId,
        roundCorrect: res.roundCorrect ?? 0,
        studentId: res.studentId,
        username: res.username,
        topicName: res.topicName,
        goalTasks: res.goalTasks ?? undefined,
        countdownMinutes: res.countdownMinutes ?? undefined,
        currentRound: res.currentRound,
        totalRounds: res.totalRounds,
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
          <div className={s.formHeader}>
            <h2>Opprett økt</h2>
            <button className={s.btnSaveTemplate} onClick={() => setSaveModalOpen(true)} title="Lagre som mal">
              💾 Lagre mal
            </button>
          </div>

          {/* Saved templates */}
          {templates.length > 0 && (
            <div className={s.templatesSection}>
              <p className={s.templatesLabel}>Lagrede maler</p>
              <div className={s.templatesList}>
                {templates.map((t) => (
                  <div key={t.id} className={s.templateItem}>
                    <button className={s.templateLoad} onClick={() => loadTemplate(t)}>
                      <span className={s.templateName}>{t.name}</span>
                      <span className={s.templateSummary}>{templateSummary(t)}</span>
                    </button>
                    <button className={s.templateDelete} onClick={() => handleDeleteTemplate(t.id)} title="Slett mal">✕</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Rounds */}
          <div className={s.roundsList}>
            {rounds.map((r, i) => (
              <div key={i} className={`${s.roundRow} ${r.type === "demo" ? s.roundRowDemo : ""}`}>
                <span className={s.roundNum}>Runde {i + 1}</span>
                <select value={r.type} onChange={(e) => updateRound(i, "type", e.target.value)} className={s.typeSelect}>
                  <option value="normal">Øving</option>
                  <option value="demo">Tavle</option>
                </select>
                <select value={r.topicId} onChange={(e) => updateRound(i, "topicId", e.target.value)} className={s.roundSelect}>
                  {topics.map((t) => (
                    <option key={t.id} value={t.id}>{t.name} — {t.grade}</option>
                  ))}
                </select>
                {r.type === "normal" && (
                  <>
                    <input
                      type="number" min={1} placeholder="Mål"
                      value={r.goalTasks}
                      onChange={(e) => updateRound(i, "goalTasks", e.target.value)}
                      className={s.roundGoal}
                    />
                    <span className={s.roundGoalLabel}>rette</span>
                  </>
                )}
                {rounds.length > 1 && (
                  <button className={s.removeRound} onClick={() => removeRound(i)}>✕</button>
                )}
              </div>
            ))}
          </div>

          <div className={s.addRoundRow}>
            <button className={s.addRound} onClick={() => addRound("normal")}>+ Øvingsrunde</button>
            <button className={s.addRoundDemo} onClick={() => addRound("demo")}>+ Tavlerunde</button>
          </div>

          <label>
            Nedtelling (minutter, valgfritt)
            <input type="number" min={1} placeholder="Ingen nedtelling" value={countdown} onChange={(e) => setCountdown(e.target.value)} />
          </label>

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
              type="text" maxLength={6} placeholder="123456"
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

      {/* Save template modal */}
      {saveModalOpen && (
        <div className={s.modalOverlay} onClick={() => setSaveModalOpen(false)}>
          <div className={s.modal} onClick={(e) => e.stopPropagation()}>
            <h3>Lagre øktmal</h3>
            <input
              type="text"
              placeholder="F.eks. «7A – Gangetabell + Brøk»"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSaveTemplate()}
              autoFocus
              className={s.modalInput}
            />
            <div className={s.modalSummary}>
              {rounds.map((r, i) => (
                <div key={i} className={s.modalRoundLine}>
                  <span className={r.type === "demo" ? s.tagDemo : s.tagNormal}>
                    {r.type === "demo" ? "Tavle" : "Øving"}
                  </span>
                  {topics.find((t) => t.id === r.topicId)?.name}
                  {r.type === "normal" && r.goalTasks && <span className={s.modalGoal}>– mål {r.goalTasks}</span>}
                </div>
              ))}
              {countdown && <div className={s.modalCountdown}>Nedtelling: {countdown} min</div>}
            </div>
            <div className={s.actions}>
              <button className={s.btnSecondary} onClick={() => setSaveModalOpen(false)}>Avbryt</button>
              <button className={s.btnPrimary} onClick={handleSaveTemplate} disabled={!templateName.trim()}>Lagre</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
