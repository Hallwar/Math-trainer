import { useState } from "react";
import { loadHistory, deleteHistory, clearHistory, type HistorySession } from "../session";
import s from "./HistoryPage.module.css";

interface Props { onBack: () => void }

export default function HistoryPage({ onBack }: Props) {
  const [history, setHistory] = useState<HistorySession[]>(loadHistory);
  const [selected, setSelected] = useState<HistorySession | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  function handleDelete(id: string) {
    deleteHistory(id);
    setHistory(loadHistory());
    if (selected?.id === id) setSelected(null);
  }

  function handleClearAll() {
    clearHistory();
    setHistory([]);
    setSelected(null);
    setConfirmClear(false);
  }

  function formatDate(ts: number) {
    const d = new Date(ts);
    return d.toLocaleDateString("nb-NO", { day: "2-digit", month: "short", year: "numeric" }) +
      " kl. " + d.toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit" });
  }

  return (
    <div className={s.container}>
      <header className={s.header}>
        <button className={s.backBtn} onClick={onBack}>← Tilbake</button>
        <h1>Tidligere økter</h1>
        {history.length > 0 && (
          <button className={s.clearBtn} onClick={() => setConfirmClear(true)}>Slett alle</button>
        )}
      </header>

      {history.length === 0 ? (
        <div className={s.empty}>
          <p>Ingen lagrede økter ennå.</p>
          <p>Resultater lagres automatisk når en økt avsluttes.</p>
        </div>
      ) : (
        <div className={s.layout}>
          {/* List */}
          <div className={s.list}>
            {history.map((h) => (
              <button
                key={h.id}
                className={`${s.listItem} ${selected?.id === h.id ? s.listItemActive : ""}`}
                onClick={() => setSelected(h)}
              >
                <div className={s.listItemTop}>
                  <span className={s.listLabel}>{h.topicLabel}</span>
                  <span className={s.listDate}>{formatDate(h.endedAt)}</span>
                </div>
                <div className={s.listItemBottom}>
                  <span>{h.studentCount} elev{h.studentCount !== 1 ? "er" : ""}</span>
                  <span>·</span>
                  <span>{h.totalCorrect} rette totalt</span>
                  {h.countdownMinutes && <><span>·</span><span>{h.countdownMinutes} min</span></>}
                </div>
              </button>
            ))}
          </div>

          {/* Detail */}
          <div className={s.detail}>
            {!selected ? (
              <p className={s.selectHint}>Velg en økt fra listen for å se detaljer</p>
            ) : (
              <>
                <div className={s.detailHeader}>
                  <div>
                    <h2>{selected.topicLabel}</h2>
                    <p className={s.detailDate}>{formatDate(selected.endedAt)}</p>
                  </div>
                  <button className={s.deleteBtn} onClick={() => handleDelete(selected.id)}>🗑 Slett</button>
                </div>

                <div className={s.detailStats}>
                  <div className={s.statCard}><span>{selected.studentCount}</span><label>Elever</label></div>
                  <div className={s.statCard}><span>{selected.totalCorrect}</span><label>Rette totalt</label></div>
                  {selected.countdownMinutes && <div className={s.statCard}><span>{selected.countdownMinutes} min</span><label>Varighet</label></div>}
                </div>

                {/* Rounds */}
                {selected.rounds.length > 1 && (
                  <div className={s.section}>
                    <h3>Runder</h3>
                    {selected.rounds.map((r, i) => (
                      <div key={i} className={s.roundLine}>
                        <span className={r.type === "demo" ? s.tagDemo : r.type === "poll" ? s.tagPoll : s.tagNormal}>
                          {r.type === "demo" ? "Tavle" : r.type === "poll" ? "Avstemming" : r.answerMode === "input" ? "Innskrivning" : "Flervalg"}
                        </span>
                        <span className={s.roundTopicName}>{r.topicName}</span>
                        {r.goalTasks && <span className={s.roundGoal}>mål {r.goalTasks}</span>}
                      </div>
                    ))}
                  </div>
                )}

                {/* Student results */}
                {selected.students.length > 0 && (
                  <div className={s.section}>
                    <h3>Elevresultater</h3>
                    <table className={s.table}>
                      <thead>
                        <tr><th>#</th><th>Elev</th><th>Rette svar</th></tr>
                      </thead>
                      <tbody>
                        {[...selected.students]
                          .sort((a, b) => b.allCorrect - a.allCorrect)
                          .map((st, i) => (
                            <tr key={i}>
                              <td className={s.rank}>{i + 1}</td>
                              <td>{st.username}</td>
                              <td className={s.correct}>{st.allCorrect}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Wrong questions */}
                {selected.rounds.flatMap((r) => r.wrongQuestions).length > 0 && (
                  <div className={s.section}>
                    <h3>Vanligste feil</h3>
                    <table className={s.table}>
                      <thead>
                        <tr><th>Oppgave</th><th>Svar</th><th>Feil</th></tr>
                      </thead>
                      <tbody>
                        {selected.rounds
                          .flatMap((r) => r.wrongQuestions)
                          .sort((a, b) => b.error_count - a.error_count)
                          .slice(0, 20)
                          .map((wq, i) => (
                            <tr key={i}>
                              <td>{wq.question_text}</td>
                              <td className={s.correct}>{wq.correct_answer}</td>
                              <td><span className={s.errorBadge}>{wq.error_count}</span></td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {confirmClear && (
        <div className={s.overlay} onClick={() => setConfirmClear(false)}>
          <div className={s.confirmModal} onClick={(e) => e.stopPropagation()}>
            <h3>Slett all historikk?</h3>
            <p>Dette kan ikke angres.</p>
            <div className={s.confirmActions}>
              <button className={s.btnSecondary} onClick={() => setConfirmClear(false)}>Avbryt</button>
              <button className={s.btnDanger} onClick={handleClearAll}>Slett alle</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
