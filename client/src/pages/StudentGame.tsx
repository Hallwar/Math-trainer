import { useEffect, useRef, useState } from "react";
import { socket } from "../socket";
import s from "./StudentGame.module.css";

interface Question {
  id: string;
  text: string;
  answer: number;
  options?: number[];
  optionLabels?: string[];
}

interface Props {
  sessionId: string;
  studentId: string;
  username: string;
  topicName: string;
  goalTasks?: number;
  countdownMinutes?: number;
  onHome: () => void;
}

type GameState = "waiting" | "playing" | "answered" | "ended" | "goal_reached";

export default function StudentGame({ username, topicName, goalTasks, countdownMinutes, onHome }: Props) {
  const [gameState, setGameState] = useState<GameState>("waiting");
  const [question, setQuestion] = useState<Question | null>(null);
  const [feedback, setFeedback] = useState<{ isCorrect: boolean; correctAnswer: number } | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [timeLeft, setTimeLeft] = useState<number | null>(countdownMinutes ? countdownMinutes * 60 : null);
  const [selected, setSelected] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const nextRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    socket.on("session:started", () => {
      setGameState("playing");
      if (countdownMinutes) startTimer(countdownMinutes * 60);
      requestQuestion();
    });

    socket.on("session:ended", () => {
      setGameState("ended");
      if (timerRef.current) clearInterval(timerRef.current);
    });

    socket.on("answer:result", (res: { isCorrect: boolean; correctAnswer: number }) => {
      setFeedback(res);
      setTotalCount((n) => n + 1);
      if (res.isCorrect) setCorrectCount((n) => n + 1);
      setGameState("answered");
      nextRef.current = setTimeout(() => {
        setGameState("playing");
        setFeedback(null);
        setSelected(null);
        requestQuestion();
      }, 1500);
    });

    socket.on("student:goal_reached", () => {
      setGameState("goal_reached");
      if (timerRef.current) clearInterval(timerRef.current);
    });

    return () => {
      socket.off("session:started");
      socket.off("session:ended");
      socket.off("answer:result");
      socket.off("student:goal_reached");
      if (timerRef.current) clearInterval(timerRef.current);
      if (nextRef.current) clearTimeout(nextRef.current);
    };
  }, [countdownMinutes]);

  function startTimer(seconds: number) {
    setTimeLeft(seconds);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(timerRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  function requestQuestion() {
    socket.emit("student:next_question", {}, (q: Question) => {
      setQuestion(q);
    });
  }

  function submitAnswer(answer: number) {
    if (!question || gameState !== "playing") return;
    setSelected(answer);
    socket.emit("student:answer", {
      questionId: question.id,
      questionText: question.text,
      correctAnswer: question.answer,
      givenAnswer: answer,
    });
  }

  function formatTime(secs: number) {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const sec = (secs % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  }

  const progress = goalTasks ? Math.min(1, correctCount / goalTasks) : null;

  return (
    <div className={s.container}>
      <header className={s.header}>
        <div className={s.userInfo}>
          <span className={s.avatar}>{username[0]}</span>
          <div>
            <strong>{username}</strong>
            <span className={s.topic}>{topicName}</span>
          </div>
        </div>
        <div className={s.headerStats}>
          {timeLeft !== null && (
            <div className={`${s.timer} ${timeLeft < 60 ? s.timerRed : ""}`}>
              {formatTime(timeLeft)}
            </div>
          )}
          <div className={s.scorePill}>
            <span className={s.scoreCorrect}>{correctCount}</span>
            <span className={s.scoreTotal}>/{totalCount}</span>
          </div>
        </div>
      </header>

      {progress !== null && (
        <div className={s.progressWrapper}>
          <div className={s.progressBar}>
            <div className={s.progressFill} style={{ width: `${progress * 100}%` }} />
          </div>
          <span className={s.progressLabel}>{correctCount}/{goalTasks} rette</span>
        </div>
      )}

      <main className={s.main}>
        {gameState === "waiting" && (
          <div className={s.waiting}>
            <div className={s.spinner} />
            <h2>Venter på at læreren starter...</h2>
            <p>Du er logget inn som <strong>{username}</strong></p>
          </div>
        )}

        {(gameState === "playing" || gameState === "answered") && question && (
          <div className={s.questionCard}>
            <p className={s.questionText}>{question.text}</p>
            {question.options ? (
              <div className={s.options}>
                {question.options.map((opt, i) => {
                  let cls = s.option;
                  if (gameState === "answered") {
                    if (opt === question.answer) cls = `${s.option} ${s.optionCorrect}`;
                    else if (opt === selected) cls = `${s.option} ${s.optionWrong}`;
                  } else if (opt === selected) {
                    cls = `${s.option} ${s.optionSelected}`;
                  }
                  const label = question.optionLabels ? question.optionLabels[i] : String(opt);
                  return (
                    <button
                      key={opt}
                      className={cls}
                      onClick={() => submitAnswer(opt)}
                      disabled={gameState === "answered"}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            ) : (
              <FreeInput onSubmit={submitAnswer} disabled={gameState === "answered"} />
            )}
            {feedback && (
              <div className={`${s.feedback} ${feedback.isCorrect ? s.feedbackCorrect : s.feedbackWrong}`}>
                {feedback.isCorrect ? "Riktig! 🎉" : `Feil — svaret er ${feedback.correctAnswer}`}
              </div>
            )}
          </div>
        )}

        {gameState === "goal_reached" && (
          <div className={s.celebrate}>
            <div className={s.celebrateEmoji}>🏆</div>
            <h2>Målet nådd!</h2>
            <p>Du svarte riktig på {correctCount} av {goalTasks} oppgaver. Bra jobbet!</p>
          </div>
        )}

        {gameState === "ended" && (
          <div className={s.ended}>
            <div className={s.celebrateEmoji}>✅</div>
            <h2>Økten er avsluttet</h2>
            <p>Du svarte riktig på <strong>{correctCount}</strong> av <strong>{totalCount}</strong> oppgaver.</p>
            <button className={s.btnHome} onClick={onHome}>Tilbake til start</button>
          </div>
        )}
      </main>
    </div>
  );
}

function FreeInput({ onSubmit, disabled }: { onSubmit: (n: number) => void; disabled: boolean }) {
  const [val, setVal] = useState("");
  function submit() {
    const n = parseFloat(val);
    if (!isNaN(n)) { onSubmit(n * (val.includes(".") ? 10 : 1)); setVal(""); }
  }
  return (
    <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem" }}>
      <input
        type="number"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && !disabled && submit()}
        disabled={disabled}
        style={{
          flex: 1, fontSize: "1.5rem", textAlign: "center", border: "2px solid #e5e7eb",
          borderRadius: "0.5rem", padding: "0.5rem"
        }}
        autoFocus
      />
      <button
        onClick={submit}
        disabled={disabled || val === ""}
        style={{
          background: "#2563eb", color: "white", border: "none", borderRadius: "0.5rem",
          padding: "0.5rem 1.5rem", fontSize: "1rem", fontWeight: 700, cursor: "pointer"
        }}
      >
        Svar
      </button>
    </div>
  );
}
