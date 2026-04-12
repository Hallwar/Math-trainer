import { useEffect, useState } from "react";
import { socket } from "../socket";
import { renderMathText } from "../utils/math";
import s from "./PollStudent.module.css";

interface PollQuestion {
  id: string; text: string;
  options: number[]; optionLabels?: string[];
}
interface RevealData {
  correctAnswer: number;
  votes: number[];
  total: number;
  options: number[];
  optionLabels?: string[];
}
interface Props {
  username: string;
  topicName: string;
  roundIndex: number;
  totalRounds: number;
}

export default function PollStudent({ username, topicName, roundIndex, totalRounds }: Props) {
  const [question, setQuestion] = useState<PollQuestion | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [voted, setVoted] = useState(false);
  const [reveal, setReveal] = useState<RevealData | null>(null);

  useEffect(() => {
    socket.on("poll:question", (q: PollQuestion) => {
      setQuestion(q);
      setSelectedIndex(null);
      setVoted(false);
      setReveal(null);
    });
    socket.on("poll:reveal", (data: RevealData) => {
      setReveal(data);
    });
    return () => {
      socket.off("poll:question");
      socket.off("poll:reveal");
    };
  }, []);

  function vote(optionIndex: number, option: number) {
    if (voted || !question) return;
    setVoted(true);
    setSelectedIndex(optionIndex);
    socket.emit("student:poll_answer", {
      questionId: question.id,
      optionIndex,
      givenAnswer: option,
    });
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
        {totalRounds > 1 && (
          <div className={s.roundPill}>R{roundIndex + 1}/{totalRounds}</div>
        )}
      </header>

      <main className={s.main}>
        {!question ? (
          <div className={s.waiting}>
            <div className={s.spinner} />
            <h2>Venter på oppgave...</h2>
            <p>Læreren viser neste spørsmål snart</p>
          </div>
        ) : (
          <div className={s.questionCard}>
            <p className={s.questionText}>{renderMathText(question.text)}</p>
            <div className={s.options}>
              {question.options.map((opt, i) => {
                const label = question.optionLabels ? question.optionLabels[i] : String(opt);
                const isSelected = selectedIndex === i;
                const isCorrect = reveal && opt === reveal.correctAnswer;
                const isWrong = reveal && isSelected && opt !== reveal.correctAnswer;
                let cls = s.option;
                if (isCorrect) cls = `${s.option} ${s.optionCorrect}`;
                else if (isWrong) cls = `${s.option} ${s.optionWrong}`;
                else if (isSelected && !reveal) cls = `${s.option} ${s.optionSelected}`;
                else if (reveal) cls = `${s.option} ${s.optionDimmed}`;
                return (
                  <button
                    key={i}
                    className={cls}
                    onClick={() => vote(i, opt)}
                    disabled={voted}
                  >
                    {renderMathText(label)}
                  </button>
                );
              })}
            </div>

            {voted && !reveal && (
              <div className={s.votedMsg}>
                <div className={s.spinner} />
                <span>Svaret er sendt! Venter på at læreren viser resultatet...</span>
              </div>
            )}

            {reveal && (
              <div className={`${s.revealMsg} ${selectedIndex !== null && question.options[selectedIndex] === reveal.correctAnswer ? s.revealCorrect : s.revealWrong}`}>
                {selectedIndex !== null && question.options[selectedIndex] === reveal.correctAnswer
                  ? "Riktig! 🎉"
                  : `Fasit: ${reveal.optionLabels
                      ? reveal.optionLabels[reveal.options.indexOf(reveal.correctAnswer)]
                      : reveal.correctAnswer}`
                }
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
