import { useEffect, useRef, useState } from "react";
import { socket } from "../socket";
import DemoStudent from "./DemoStudent";
import PollStudent from "./PollStudent";
import s from "./StudentGame.module.css";

interface Question {
  id: string; text: string; answer: number;
  options?: number[]; optionLabels?: string[];
}

interface Props {
  sessionId: string; studentId: string; username: string;
  topicName: string; goalTasks?: number; countdownMinutes?: number;
  currentRound: number; totalRounds: number;
  initialCorrect?: number;
  onHome: () => void;
}

type GameState = "waiting" | "playing" | "answered" | "round_complete" | "ended";
type RoundType = "normal" | "demo" | "poll";

export default function StudentGame({ username, topicName: initialTopicName, goalTasks: initialGoal, countdownMinutes, currentRound: initialRound, totalRounds: initialTotal, initialCorrect = 0, onHome }: Props) {
  const [gameState, setGameState] = useState<GameState>("waiting");
  const [roundType, setRoundType] = useState<RoundType>("normal");
  const [question, setQuestion] = useState<Question | null>(null);
  const [feedback, setFeedback] = useState<{ isCorrect: boolean; correctAnswer: number } | null>(null);
  const [correctCount, setCorrectCount] = useState(initialCorrect);
  const [totalCount, setTotalCount] = useState(0);
  const [timeLeft, setTimeLeft] = useState<number | null>(countdownMinutes ? countdownMinutes * 60 : null);
  const [selected, setSelected] = useState<number | null>(null);
  const [roundIndex, setRoundIndex] = useState(initialRound);
  const [totalRounds, setTotalRounds] = useState(initialTotal);
  const [topicName, setTopicName] = useState(initialTopicName);
  const [goalTasks, setGoalTasks] = useState(initialGoal);
  const [roundStats, setRoundStats] = useState<{ correct: number; total: number } | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const nextRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    socket.on("session:started", (data: any) => {
      if (countdownMinutes) startTimer(countdownMinutes * 60);
      if (data.round) {
        setRoundIndex(data.round.index);
        setTotalRounds(data.round.total);
        setGoalTasks(data.round.goalTasks);
        setRoundType(data.round.type ?? "normal");
        if (data.round.type === "demo" || data.round.type === "poll") {
          setGameState("waiting");
        } else {
          setGameState("playing");
          requestQuestion();
        }
      } else {
        setGameState("playing");
        requestQuestion();
      }
    });

    socket.on("round:changed", (round: any) => {
      setRoundIndex(round.index);
      setTotalRounds(round.total);
      setGoalTasks(round.goalTasks);
      setRoundType(round.type ?? "normal");
      setTopicName(round.topicName ?? topicName);
      setCorrectCount(0);
      setTotalCount(0);
      setFeedback(null);
      setSelected(null);
      if (round.type === "demo" || round.type === "poll") {
        setGameState("waiting");
      } else {
        setGameState("playing");
        requestQuestion();
      }
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

    socket.on("round:complete", ({ roundIndex: ri, isLastRound }: { roundIndex: number; isLastRound: boolean }) => {
      if (nextRef.current) clearTimeout(nextRef.current);
      setRoundStats({ correct: 0, total: 0 }); // will be overwritten below
      setGameState(isLastRound ? "ended" : "round_complete");
    });

    socket.on("session:restarted", () => {
      setCorrectCount(0);
      setTotalCount(0);
      setRoundIndex(0);
      setFeedback(null);
      setSelected(null);
      setQuestion(null);
      setGameState("waiting");
    });

    // If we rejoin an already-active session, start playing immediately
    if (initialCorrect > 0) {
      setGameState("playing");
      requestQuestion();
    }

    return () => {
      ["session:started","round:changed","session:ended","answer:result","round:complete","session:restarted"]
        .forEach((e) => socket.off(e));
      if (timerRef.current) clearInterval(timerRef.current);
      if (nextRef.current) clearTimeout(nextRef.current);
    };
  }, [countdownMinutes]);

  // Keep roundStats in sync with correctCount/totalCount
  useEffect(() => {
    if (gameState === "round_complete" || gameState === "ended") {
      setRoundStats({ correct: correctCount, total: totalCount });
    }
  }, [gameState]);

  function startTimer(seconds: number) {
    setTimeLeft(seconds);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev === null || prev <= 1) { clearInterval(timerRef.current!); return 0; }
        return prev - 1;
      });
    }, 1000);
  }

  function requestQuestion() {
    socket.emit("student:next_question", {}, (q: Question) => setQuestion(q));
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
    return `${Math.floor(secs / 60).toString().padStart(2, "0")}:${(secs % 60).toString().padStart(2, "0")}`;
  }

  const progress = goalTasks ? Math.min(1, correctCount / goalTasks) : null;

  // Demo round: show demo student view
  if (roundType === "demo" && gameState !== "ended") {
    return (
      <DemoStudent
        username={username}
        topicName={topicName}
        roundIndex={roundIndex}
        totalRounds={totalRounds}
      />
    );
  }

  // Poll round: show poll student view
  if (roundType === "poll" && gameState !== "ended") {
    return (
      <PollStudent
        username={username}
        topicName={topicName}
        roundIndex={roundIndex}
        totalRounds={totalRounds}
      />
    );
  }

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
          {totalRounds > 1 && gameState !== "waiting" && (
            <div className={s.roundPill}>R{roundIndex + 1}/{totalRounds}</div>
          )}
          {timeLeft !== null && (
            <div className={`${s.timer} ${timeLeft < 60 ? s.timerRed : ""}`}>{formatTime(timeLeft)}</div>
          )}
          <div className={s.scorePill}>
            <span className={s.scoreCorrect}>{correctCount}</span>
            <span className={s.scoreTotal}>/{totalCount}</span>
          </div>
        </div>
      </header>

      {progress !== null && gameState === "playing" && (
        <div className={s.progressWrapper}>
          <div className={s.progressBar}>
            <div className={s.progressFill} style={{ width: `${progress * 100}%` }} />
          </div>
          <span className={s.progressLabel}>{Math.min(correctCount, goalTasks!!)}/{goalTasks} rette</span>
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
                  } else if (opt === selected) cls = `${s.option} ${s.optionSelected}`;
                  const label = question.optionLabels ? question.optionLabels[i] : String(opt);
                  return (
                    <button key={opt} className={cls} onClick={() => submitAnswer(opt)} disabled={gameState === "answered"}>
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

        {gameState === "round_complete" && (
          <RoundCompleteScreen
            username={username}
            roundIndex={roundIndex}
            totalRounds={totalRounds}
            correct={roundStats?.correct ?? correctCount}
            total={roundStats?.total ?? totalCount}
            goal={goalTasks}
          />
        )}

        {gameState === "ended" && (
          <PauseScreen
            username={username}
            correct={roundStats?.correct ?? correctCount}
            total={roundStats?.total ?? totalCount}
            onHome={onHome}
          />
        )}
      </main>
    </div>
  );
}

function RoundCompleteScreen({ username, roundIndex, totalRounds, correct, total, goal }: {
  username: string; roundIndex: number; totalRounds: number;
  correct: number; total: number; goal?: number;
}) {
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
  return (
    <div className={s.roundComplete}>
      <div className={s.celebrateEmoji}>
        {pct >= 80 ? "🌟" : pct >= 60 ? "👍" : "💪"}
      </div>
      <h2>Runde {roundIndex + 1} fullført!</h2>
      <div className={s.roundStats}>
        <div className={s.pauseStat}><span>{correct}</span><label>Rette svar</label></div>
        {goal && <div className={s.pauseStat}><span>{goal}</span><label>Mål</label></div>}
        <div className={s.pauseStat}><span>{pct}%</span><label>Prosent</label></div>
      </div>
      <div className={s.waitingNext}>
        <div className={s.spinner} />
        <p>Venter på at læreren starter runde {roundIndex + 2} av {totalRounds}...</p>
      </div>
    </div>
  );
}

function PauseScreen({ username, correct, total, onHome }: {
  username: string; correct: number; total: number; onHome: () => void;
}) {
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
  const stars = pct >= 80 ? 3 : pct >= 60 ? 2 : pct >= 40 ? 1 : 0;
  const messages = ["Bra forsøkt! Øvelse gjør mester.", "Ikke verst! Fortsett å øve.", "Bra jobbet!", "Strålende innsats!"];
  return (
    <div className={s.pauseScreen}>
      <div className={s.pauseAvatar}>{username[0]}</div>
      <h2 className={s.pauseName}>{username}</h2>
      <div className={s.pauseStars}>
        {[1, 2, 3].map((n) => <span key={n} className={n <= stars ? s.starOn : s.starOff}>★</span>)}
      </div>
      <p className={s.pauseMsg}>{messages[stars]}</p>
      <div className={s.pauseStats}>
        <div className={s.pauseStat}><span>{correct}</span><label>Rette svar</label></div>
        <div className={s.pauseStat}><span>{total}</span><label>Totalt</label></div>
        <div className={s.pauseStat}><span>{pct}%</span><label>Prosent</label></div>
      </div>
      <p className={s.pauseHint}>Spør læreren om ny kode for å spille igjen</p>
      <button className={s.btnHome} onClick={onHome}>Tilbake til start</button>
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
        type="number" value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && !disabled && submit()}
        disabled={disabled}
        style={{ flex: 1, fontSize: "1.5rem", textAlign: "center", border: "2px solid #e5e7eb", borderRadius: "0.5rem", padding: "0.5rem" }}
        autoFocus
      />
      <button onClick={submit} disabled={disabled || val === ""}
        style={{ background: "#2563eb", color: "white", border: "none", borderRadius: "0.5rem", padding: "0.5rem 1.5rem", fontSize: "1rem", fontWeight: 700, cursor: "pointer" }}>
        Svar
      </button>
    </div>
  );
}
