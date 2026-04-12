import { useEffect, useState } from "react";
import { socket } from "../socket";
import { renderMathText } from "../utils/math";
import s from "./PollMode.module.css";

interface PollQuestion {
  id: string; text: string; answer: number;
  options: number[]; optionLabels?: string[];
}
interface VoteData {
  votes: number[]; total: number; studentCount: number;
  options: number[]; optionLabels?: string[];
}
interface Props {
  sessionId: string; topicName: string;
  roundIndex: number; totalRounds: number;
  onNextRound: () => void; onEndSession: () => void;
}

export default function PollMode({ sessionId, topicName, roundIndex, totalRounds, onNextRound, onEndSession }: Props) {
  const [question, setQuestion] = useState<PollQuestion | null>(null);
  const [votes, setVotes] = useState<number[]>([]);
  const [totalVotes, setTotalVotes] = useState(0);
  const [studentCount, setStudentCount] = useState(0);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    socket.on("poll:votes", (data: VoteData) => {
      setVotes(data.votes);
      setTotalVotes(data.total);
      setStudentCount(data.studentCount);
    });
    return () => { socket.off("poll:votes"); };
  }, []);

  function nextQuestion() {
    socket.emit("teacher:poll_question", sessionId, (q: PollQuestion) => {
      setQuestion(q);
      setVotes(new Array(q.options.length).fill(0));
      setTotalVotes(0);
      setRevealed(false);
    });
  }

  function reveal() {
    socket.emit("teacher:poll_reveal", sessionId);
    setRevealed(true);
  }

  const isLastRound = roundIndex >= totalRounds - 1;
  const options = question?.options ?? [];
  const optionLabels = question?.optionLabels;
  const maxVotes = Math.max(...votes, 1);

  return (
    <div className={s.container}>
      <div className={s.header}>
        <div>
          <h1 className={s.title}>Avstemming</h1>
          <p className={s.topicName}>{topicName}</p>
        </div>
        <div className={s.headerRight}>
          {totalRounds > 1 && <div className={s.roundBadge}>Runde {roundIndex + 1}/{totalRounds}</div>}
          {question && (
            <div className={s.voteCounter}>
              <span className={s.voteNum}>{totalVotes}</span>
              <span className={s.voteOf}>/ {studentCount} svart</span>
            </div>
          )}
        </div>
      </div>

      {!question ? (
        <div className={s.noQuestion}>
          <p className={s.hint}>Klikk for å vise første oppgave til elevene</p>
          <button className={s.btnShowQuestion} onClick={nextQuestion}>Vis oppgave →</button>
        </div>
      ) : (
        <div className={s.main}>
          <div className={s.questionBox}>
            <p className={s.questionText}>{renderMathText(question.text)}</p>
          </div>

          <div className={s.bars}>
            {options.map((opt, i) => {
              const count = votes[i] ?? 0;
              const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
              const barWidth = Math.round((count / maxVotes) * 100);
              const isCorrect = opt === question.answer;
              const label = optionLabels ? optionLabels[i] : String(opt);
              const labelNode = renderMathText(label);
              return (
                <div key={i} className={`${s.barRow} ${revealed && isCorrect ? s.barRowCorrect : ""} ${revealed && !isCorrect ? s.barRowWrong : ""}`}>
                  <div className={s.barLabel}>{labelNode}</div>
                  <div className={s.barTrack}>
                    <div
                      className={`${s.barFill} ${revealed && isCorrect ? s.barFillCorrect : ""}`}
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                  <div className={s.barCount}>{count}</div>
                  <div className={s.barPct}>{pct}%</div>
                  {revealed && isCorrect && <div className={s.correctMark}>✓ Riktig</div>}
                </div>
              );
            })}
          </div>

          <div className={s.actions}>
            {!revealed ? (
              <button
                className={s.btnReveal}
                onClick={reveal}
                disabled={totalVotes === 0}
                title={totalVotes === 0 ? "Venter på svar..." : undefined}
              >
                Vis svar
              </button>
            ) : (
              <button className={s.btnNext} onClick={nextQuestion}>Ny oppgave →</button>
            )}
            {revealed && (
              <button className={s.btnRound} onClick={onNextRound}>
                {isLastRound ? "Avslutt runde →" : `Start runde ${roundIndex + 2} →`}
              </button>
            )}
            <button className={s.btnEnd} onClick={onEndSession}>Avslutt økt</button>
          </div>
        </div>
      )}
    </div>
  );
}
