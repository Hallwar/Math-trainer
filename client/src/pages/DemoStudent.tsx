import { useEffect, useState } from "react";
import { socket } from "../socket";
import { renderMathText } from "../utils/math";
import s from "./DemoStudent.module.css";

interface Question { id: string; text: string; answer: number }

interface Props {
  username: string;
  topicName: string;
  roundIndex: number;
  totalRounds: number;
}

export default function DemoStudent({ username, topicName, roundIndex, totalRounds }: Props) {
  const [question, setQuestion] = useState<Question | null>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    socket.on("demo:question", (q: Question) => {
      setQuestion(q);
      setRevealed(false);
    });
    socket.on("demo:reveal", ({ answer }: { answer: number }) => {
      setRevealed(true);
    });
    return () => {
      socket.off("demo:question");
      socket.off("demo:reveal");
    };
  }, []);

  return (
    <div className={s.container}>
      <header className={s.header}>
        <div className={s.userInfo}>
          <span className={s.avatar}>{username[0]}</span>
          <span>{username}</span>
        </div>
        <div className={s.rightInfo}>
          {totalRounds > 1 && <span className={s.roundPill}>R{roundIndex + 1}/{totalRounds}</span>}
          <span className={s.demoTag}>Tavlerunde</span>
        </div>
      </header>

      <main className={s.main}>
        {!question ? (
          <div className={s.waiting}>
            <div className={s.spinner} />
            <h2>Følg med på tavla!</h2>
            <p>{topicName}</p>
          </div>
        ) : (
          <div className={s.card}>
            <p className={s.label}>Oppgave</p>
            <p className={s.questionText}>{renderMathText(question.text)}</p>
            {revealed ? (
              <div className={s.answer}>
                <span className={s.answerLabel}>Svar:</span>
                <span className={s.answerValue}>{question.answer}</span>
              </div>
            ) : (
              <div className={s.thinking}>
                <div className={s.dot} /><div className={s.dot} /><div className={s.dot} />
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
