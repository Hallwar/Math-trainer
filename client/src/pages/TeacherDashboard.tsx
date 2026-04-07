import { useEffect, useRef, useState } from "react";
import { socket } from "../socket";
import type { RoundConfig } from "../App";
import s from "./TeacherDashboard.module.css";

interface StudentStat {
  id: string; username: string;
  roundCorrect: number; roundTotal: number; roundDone: boolean; allCorrect: number;
}
interface WrongQuestion { question_text: string; correct_answer: number; error_count: number }
interface Stats {
  students: StudentStat[]; totalCorrect: number; doneCount: number;
  wrongQuestions: WrongQuestion[]; currentRound: number; totalRounds: number;
  rounds: { topicId: string; goalTasks: number }[];
}

interface Props {
  sessionId: string; code: string; rounds: RoundConfig[];
  topicLabel: string; countdownMinutes?: number;
  onRestartWithStudents: () => Promise<void>;
  onHome: () => void;
}

const TOP_N = 10;
const TOPIC_NAMES: Record<string, string> = {};

export default function TeacherDashboard({ sessionId, code, topicLabel, countdownMinutes, onRestartWithStudents, onHome }: Props) {
  const [status, setStatus] = useState<"waiting" | "active" | "ended">("waiting");
  const [stats, setStats] = useState<Stats | null>(null);
  const [students, setStudents] = useState<StudentStat[]>([]);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [reviewMode, setReviewMode] = useState(false);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [minErrors, setMinErrors] = useState(1);
  const [showAllErrors, setShowAllErrors] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Preload topic names
    fetch("/api/topics").then((r) => r.json()).then((topics: any[]) => {
      topics.forEach((t) => { TOPIC_NAMES[t.id] = t.name; });
    });

    socket.connect();
    socket.emit("teacher:join", sessionId);

    socket.on("session:state", (data: any) => {
      setStatus(data.session.status);
      setStats(data);
      setStudents(data.students);
      if (data.session.status === "active" && data.session.countdown_minutes) {
        const elapsed = Math.floor(Date.now() / 1000) - data.session.started_at;
        const remaining = data.session.countdown_minutes * 60 - elapsed;
        if (remaining > 0) startTimer(remaining);
      }
    });

    socket.on("student:joined", (student: { id: string; username: string }) => {
      setStudents((prev) =>
        prev.find((s) => s.id === student.id) ? prev
          : [...prev, { ...student, roundCorrect: 0, roundTotal: 0, roundDone: false, allCorrect: 0 }]
      );
    });

    socket.on("session:started", (data: any) => {
      setStatus("active");
      if (data.session?.countdown_minutes) startTimer(data.session.countdown_minutes * 60);
    });

    socket.on("session:ended", (data: any) => {
      setStatus("ended");
      setStats(data);
      setStudents(data.students);
      if (timerRef.current) clearInterval(timerRef.current);
    });

    socket.on("stats:update", (data: any) => {
      setStats(data);
      setStudents(data.students);
    });

    socket.on("round:changed", () => {
      setShowAllErrors(false);
      setReviewMode(false);
    });

    return () => {
      ["session:state","student:joined","session:started","session:ended","stats:update","round:changed"]
        .forEach((e) => socket.off(e));
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [sessionId]);

  function startTimer(seconds: number) {
    setTimeLeft(seconds);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(timerRef.current!);
          socket.emit("teacher:end", sessionId);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  function formatTime(secs: number) {
    return `${Math.floor(secs / 60).toString().padStart(2, "0")}:${(secs % 60).toString().padStart(2, "0")}`;
  }

  const currentRound = stats?.currentRound ?? 0;
  const totalRounds = stats?.totalRounds ?? 1;
  const currentGoal = stats?.rounds[currentRound]?.goalTasks;
  const currentTopicName = TOPIC_NAMES[stats?.rounds[currentRound]?.topicId ?? ""] ?? topicLabel;
  const doneCount = stats?.doneCount ?? 0;
  const allDone = students.length > 0 && doneCount === students.length;
  const isLastRound = currentRound >= totalRounds - 1;

  const wrongQuestions = stats?.wrongQuestions ?? [];
  const filteredErrors = wrongQuestions.filter((wq) => wq.error_count >= minErrors);
  const visibleErrors = showAllErrors ? filteredErrors : filteredErrors.slice(0, TOP_N);
  const reviewList = filteredErrors;
  const currentWrong = reviewList[reviewIndex];

  if (reviewMode) {
    return (
      <div className={s.container}>
        <div className={s.reviewBar}>
          <span>Gjennomgang – Runde {currentRound + 1} ({reviewIndex + 1}/{reviewList.length})</span>
          <button className={s.btnSecondary} onClick={() => setReviewMode(false)}>Tilbake</button>
        </div>
        {currentWrong ? (
          <div className={s.reviewCard}>
            <div className={s.errorBadge}>{currentWrong.error_count} elev{currentWrong.error_count !== 1 ? "er" : ""} svarte feil</div>
            <h2 className={s.reviewQuestion}>{currentWrong.question_text}</h2>
            <div className={s.reviewAnswer}>Svar: <strong>{currentWrong.correct_answer}</strong></div>
            <div className={s.reviewNav}>
              <button className={s.btnSecondary} disabled={reviewIndex === 0} onClick={() => setReviewIndex((i) => i - 1)}>← Forrige</button>
              <button className={s.btnPrimary} disabled={reviewIndex === reviewList.length - 1} onClick={() => setReviewIndex((i) => i + 1)}>Neste →</button>
            </div>
          </div>
        ) : <p className={s.empty}>Ingen feil å gjennomgå.</p>}
      </div>
    );
  }

  return (
    <div className={s.container}>
      <header className={s.header}>
        <div>
          <h1>Læreroversikt</h1>
          <p className={s.topicLabel}>{currentTopicName}</p>
        </div>
        <div className={s.headerRight}>
          {totalRounds > 1 && (
            <div className={s.roundBadge}>Runde {currentRound + 1}/{totalRounds}</div>
          )}
          {timeLeft !== null && (
            <div className={`${s.timer} ${timeLeft < 60 ? s.timerRed : ""}`}>{formatTime(timeLeft)}</div>
          )}
          <div className={s.codeBox}>
            <span>Kode</span>
            <strong>{code}</strong>
          </div>
        </div>
      </header>

      <div className={s.statsRow}>
        <div className={s.statCard}>
          <span>{students.length}</span><label>Elever</label>
        </div>
        <div className={s.statCard}>
          <span>{stats?.totalCorrect ?? 0}</span><label>Rette (runde {currentRound + 1})</label>
        </div>
        {currentGoal && (
          <div className={s.statCard}>
            <span>{doneCount}/{students.length}</span>
            <label>Ferdig med runden</label>
          </div>
        )}
        <div className={s.statCard}>
          <span className={`${s.statusBadge} ${s[status]}`}>
            {status === "waiting" ? "Venter" : status === "active" ? "Aktiv" : "Avsluttet"}
          </span>
          <label>Status</label>
        </div>
      </div>

      {/* Actions bar */}
      {status === "waiting" && (
        <div className={s.waitingBox}>
          <p>Venter på elever... Del koden <strong>{code}</strong> med klassen.</p>
          <button
            className={s.btnStart}
            disabled={students.length === 0}
            onClick={() => socket.emit("teacher:start", sessionId)}
          >
            {students.length === 0 ? "Venter på elever..." : `Start økt (${students.length} elev${students.length !== 1 ? "er" : ""})`}
          </button>
        </div>
      )}

      {status === "active" && (
        <div className={s.activeBar}>
          {allDone && !isLastRound && (
            <div className={s.allDoneBanner}>
              Alle er ferdige med runde {currentRound + 1}!
              <button className={s.btnStart} onClick={() => socket.emit("teacher:next_round", sessionId)}>
                Start runde {currentRound + 2} →
              </button>
            </div>
          )}
          {allDone && isLastRound && (
            <div className={s.allDoneBanner}>
              Alle er ferdige med alle runder!
              <button
                className={s.btnStart}
                disabled={actionLoading}
                onClick={async () => { setActionLoading(true); await onRestartWithStudents(); setActionLoading(false); }}
              >
                {actionLoading ? "Oppretter..." : "Ny økt med disse elevene"}
              </button>
            </div>
          )}
          {!allDone && !isLastRound && doneCount > 0 && (
            <div className={s.partialDone}>
              {doneCount}/{students.length} elever er ferdige med runde {currentRound + 1}.
              <button className={s.btnNextRound} onClick={() => socket.emit("teacher:next_round", sessionId)}>
                Start runde {currentRound + 2} for alle →
              </button>
            </div>
          )}
          <button className={s.btnEnd} onClick={() => socket.emit("teacher:end", sessionId)}>
            Avslutt økt
          </button>
        </div>
      )}

      {status === "ended" && (
        <div className={s.endedActions}>
          <span className={s.endedLabel}>Økten er avsluttet</span>
          <button
            className={s.btnStart}
            disabled={actionLoading}
            onClick={async () => { setActionLoading(true); await onRestartWithStudents(); setActionLoading(false); }}
          >
            {actionLoading ? "Oppretter..." : "Ny økt med disse elevene"}
          </button>
        </div>
      )}

      <div className={s.grid}>
        <section className={s.panel}>
          <h2>Elevene – runde {currentRound + 1}</h2>
          {students.length === 0 ? <p className={s.empty}>Ingen elever ennå</p> : (
            <table className={s.table}>
              <thead>
                <tr>
                  <th>#</th><th>Brukernavn</th>
                  <th>Rette</th><th>Totalt</th>
                  {currentGoal && <th>Fremgang</th>}
                </tr>
              </thead>
              <tbody>
                {[...students].sort((a, b) => b.roundCorrect - a.roundCorrect).map((st, i) => (
                  <tr key={st.id} className={st.roundDone ? s.rowDone : ""}>
                    <td className={s.rank}>{i + 1}</td>
                    <td className={s.username}>
                      {st.username}
                      {st.roundDone && <span className={s.doneBadge}>✓</span>}
                    </td>
                    <td className={s.correct}>{st.roundCorrect}</td>
                    <td>{st.roundTotal}</td>
                    {currentGoal && (
                      <td>
                        <div className={s.progressBar}>
                          <div className={s.progressFill} style={{ width: `${Math.min(100, (st.roundCorrect / currentGoal) * 100)}%` }} />
                        </div>
                        <span className={s.progressText}>{Math.min(st.roundCorrect, currentGoal)}/{currentGoal}</span>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className={s.panel}>
          <div className={s.panelHeader}>
            <h2>Vanlige feil – runde {currentRound + 1}</h2>
            {reviewList.length > 0 && (
              <button className={s.btnReview} onClick={() => { setReviewMode(true); setReviewIndex(0); }}>
                Tavlegjennomgang →
              </button>
            )}
          </div>
          <div className={s.filterRow}>
            <label className={s.filterLabel}>
              Minst
              <select value={minErrors} onChange={(e) => { setMinErrors(Number(e.target.value)); setShowAllErrors(false); }} className={s.filterSelect}>
                {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} elev{n !== 1 ? "er" : ""}</option>)}
              </select>
              feil
            </label>
            <span className={s.filterCount}>{filteredErrors.length} oppgaver</span>
          </div>
          {filteredErrors.length === 0 ? <p className={s.empty}>Ingen feil med dette filteret</p> : (
            <>
              <table className={s.table}>
                <thead><tr><th>Oppgave</th><th>Svar</th><th>Feil</th></tr></thead>
                <tbody>
                  {visibleErrors.map((wq, i) => (
                    <tr key={i}>
                      <td>{wq.question_text}</td>
                      <td className={s.correct}>{wq.correct_answer}</td>
                      <td><span className={s.errorBadge}>{wq.error_count}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!showAllErrors && filteredErrors.length > TOP_N && (
                <button className={s.showMoreBtn} onClick={() => setShowAllErrors(true)}>Vis alle ({filteredErrors.length - TOP_N} til) ↓</button>
              )}
              {showAllErrors && filteredErrors.length > TOP_N && (
                <button className={s.showMoreBtn} onClick={() => setShowAllErrors(false)}>Vis færre ↑</button>
              )}
            </>
          )}
        </section>
      </div>

      <button className={s.homeBtn} onClick={onHome}>Tilbake til start</button>
    </div>
  );
}
