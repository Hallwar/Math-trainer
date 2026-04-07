import { useEffect, useRef, useState } from "react";
import { socket } from "../socket";
import s from "./TeacherDashboard.module.css";

interface StudentStat {
  id: string;
  username: string;
  correct: number;
  total: number;
}

interface WrongQuestion {
  question_text: string;
  correct_answer: number;
  error_count: number;
}

interface Props {
  sessionId: string;
  code: string;
  topicName: string;
  goalTasks?: number;
  countdownMinutes?: number;
  onNewSession: () => Promise<void>;
  onHome: () => void;
}

const TOP_N = 10;

export default function TeacherDashboard({ sessionId, code, topicName, goalTasks, countdownMinutes, onNewSession, onHome }: Props) {
  const [status, setStatus] = useState<"waiting" | "active" | "ended">("waiting");
  const [students, setStudents] = useState<StudentStat[]>([]);
  const [totalCorrect, setTotalCorrect] = useState(0);
  const [wrongQuestions, setWrongQuestions] = useState<WrongQuestion[]>([]);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [reviewMode, setReviewMode] = useState(false);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [minErrors, setMinErrors] = useState(1);
  const [showAllErrors, setShowAllErrors] = useState(false);
  const [newSessionLoading, setNewSessionLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    socket.connect();
    socket.emit("teacher:join", sessionId);

    socket.on("session:state", (data: any) => {
      setStatus(data.session.status);
      setStudents(data.students);
      setTotalCorrect(data.totalCorrect);
      setWrongQuestions(data.wrongQuestions);
      if (data.session.status === "active" && data.session.countdown_minutes) {
        const elapsed = Math.floor(Date.now() / 1000) - data.session.started_at;
        const remaining = data.session.countdown_minutes * 60 - elapsed;
        if (remaining > 0) startTimer(remaining);
      }
    });

    socket.on("student:joined", (student: { id: string; username: string }) => {
      setStudents((prev) => {
        if (prev.find((s) => s.id === student.id)) return prev;
        return [...prev, { ...student, correct: 0, total: 0 }];
      });
    });

    socket.on("session:started", (session: any) => {
      setStatus("active");
      if (session.countdown_minutes) startTimer(session.countdown_minutes * 60);
    });

    socket.on("session:ended", (data: any) => {
      setStatus("ended");
      setStudents(data.students);
      setTotalCorrect(data.totalCorrect);
      setWrongQuestions(data.wrongQuestions);
      if (timerRef.current) clearInterval(timerRef.current);
    });

    socket.on("stats:update", (data: any) => {
      setStudents(data.students);
      setTotalCorrect(data.totalCorrect);
      setWrongQuestions(data.wrongQuestions);
    });

    return () => {
      socket.off("session:state");
      socket.off("student:joined");
      socket.off("session:started");
      socket.off("session:ended");
      socket.off("stats:update");
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
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const sec = (secs % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  }

  async function handleNewSession() {
    setNewSessionLoading(true);
    await onNewSession();
  }

  const sortedStudents = [...students].sort((a, b) => b.correct - a.correct);
  const filteredErrors = wrongQuestions.filter((wq) => wq.error_count >= minErrors);
  const visibleErrors = showAllErrors ? filteredErrors : filteredErrors.slice(0, TOP_N);
  const hiddenCount = filteredErrors.length - TOP_N;

  // ── Review mode ────────────────────────────────────────────────────────────
  const reviewList = wrongQuestions.filter((wq) => wq.error_count >= minErrors);
  const currentWrong = reviewList[reviewIndex];

  if (reviewMode) {
    return (
      <div className={s.container}>
        <div className={s.reviewBar}>
          <span>Gjennomgang av feil ({reviewIndex + 1}/{reviewList.length})</span>
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
        ) : (
          <p className={s.empty}>Ingen feil å gjennomgå.</p>
        )}
      </div>
    );
  }

  // ── Main view ──────────────────────────────────────────────────────────────
  return (
    <div className={s.container}>
      <header className={s.header}>
        <div>
          <h1>Læreroversikt</h1>
          <p className={s.topicLabel}>{topicName}</p>
        </div>
        <div className={s.headerRight}>
          {timeLeft !== null && (
            <div className={`${s.timer} ${timeLeft < 60 ? s.timerRed : ""}`}>
              {formatTime(timeLeft)}
            </div>
          )}
          <div className={s.codeBox}>
            <span>Kode</span>
            <strong>{code}</strong>
          </div>
        </div>
      </header>

      <div className={s.statsRow}>
        <div className={s.statCard}>
          <span>{students.length}</span>
          <label>Elever</label>
        </div>
        <div className={s.statCard}>
          <span>{totalCorrect}</span>
          <label>Rette svar totalt</label>
        </div>
        {goalTasks && (
          <div className={s.statCard}>
            <span>{goalTasks}</span>
            <label>Mål per elev</label>
          </div>
        )}
        <div className={s.statCard}>
          <span className={`${s.statusBadge} ${s[status]}`}>
            {status === "waiting" ? "Venter" : status === "active" ? "Aktiv" : "Avsluttet"}
          </span>
          <label>Status</label>
        </div>
      </div>

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
        <button className={s.btnEnd} onClick={() => socket.emit("teacher:end", sessionId)}>
          Avslutt økt
        </button>
      )}

      {status === "ended" && (
        <div className={s.endedActions}>
          <p className={s.endedLabel}>Økten er avsluttet</p>
          <button
            className={s.btnStart}
            onClick={handleNewSession}
            disabled={newSessionLoading}
          >
            {newSessionLoading ? "Oppretter..." : "Ny økt – samme tema"}
          </button>
        </div>
      )}

      <div className={s.grid}>
        <section className={s.panel}>
          <h2>Elevene</h2>
          {sortedStudents.length === 0 ? (
            <p className={s.empty}>Ingen elever ennå</p>
          ) : (
            <table className={s.table}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Brukernavn</th>
                  <th>Rette</th>
                  <th>Totalt</th>
                  {goalTasks && <th>Fremgang</th>}
                </tr>
              </thead>
              <tbody>
                {sortedStudents.map((st, i) => (
                  <tr key={st.id}>
                    <td className={s.rank}>{i + 1}</td>
                    <td className={s.username}>{st.username}</td>
                    <td className={s.correct}>{st.correct}</td>
                    <td>{st.total}</td>
                    {goalTasks && (
                      <td>
                        <div className={s.progressBar}>
                          <div
                            className={s.progressFill}
                            style={{ width: `${Math.min(100, (st.correct / goalTasks) * 100)}%` }}
                          />
                        </div>
                        <span className={s.progressText}>{Math.min(st.correct, goalTasks)}/{goalTasks}</span>
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
            <h2>Vanlige feil</h2>
            {status === "ended" && reviewList.length > 0 && (
              <button className={s.btnReview} onClick={() => { setReviewMode(true); setReviewIndex(0); }}>
                Gå igjennom på tavla →
              </button>
            )}
          </div>

          <div className={s.filterRow}>
            <label className={s.filterLabel}>
              Vis kun feil gjort av minst
              <select
                value={minErrors}
                onChange={(e) => { setMinErrors(Number(e.target.value)); setShowAllErrors(false); }}
                className={s.filterSelect}
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>{n} elev{n !== 1 ? "er" : ""}</option>
                ))}
              </select>
            </label>
            <span className={s.filterCount}>{filteredErrors.length} oppgaver</span>
          </div>

          {filteredErrors.length === 0 ? (
            <p className={s.empty}>Ingen feil med dette filteret</p>
          ) : (
            <>
              <table className={s.table}>
                <thead>
                  <tr>
                    <th>Oppgave</th>
                    <th>Svar</th>
                    <th>Feil</th>
                  </tr>
                </thead>
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
              {!showAllErrors && hiddenCount > 0 && (
                <button className={s.showMoreBtn} onClick={() => setShowAllErrors(true)}>
                  Vis alle ({hiddenCount} til) ↓
                </button>
              )}
              {showAllErrors && filteredErrors.length > TOP_N && (
                <button className={s.showMoreBtn} onClick={() => setShowAllErrors(false)}>
                  Vis færre ↑
                </button>
              )}
            </>
          )}
        </section>
      </div>

      <button className={s.homeBtn} onClick={onHome}>Tilbake til start</button>
    </div>
  );
}
