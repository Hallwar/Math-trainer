import { useEffect, useRef, useState, useCallback } from "react";
import { socket } from "../socket";
import { renderMathText } from "../utils/math";
import s from "./DemoMode.module.css";

interface Question {
  id: string; text: string; answer: number;
  options?: number[]; optionLabels?: string[];
}

interface Props {
  sessionId: string;
  topicName: string;
  roundIndex: number;
  totalRounds: number;
  onNextRound: () => void;
  onEndSession: () => void;
}

type Tool = "pen" | "eraser";

export default function DemoMode({ sessionId, topicName, roundIndex, totalRounds, onNextRound, onEndSession }: Props) {
  const [question, setQuestion] = useState<Question | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState("#1e40af");
  const [lineWidth, setLineWidth] = useState(4);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  // ── Canvas setup ──────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      // Save current drawing
      const img = canvas.toDataURL();
      canvas.width = rect.width;
      canvas.height = rect.height;
      // Restore drawing
      const image = new Image();
      image.src = img;
      image.onload = () => canvas.getContext("2d")?.drawImage(image, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  // ── Drawing helpers ───────────────────────────────────────────────────────
  function getPos(e: React.MouseEvent | React.TouchEvent): { x: number; y: number } {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      const t = e.touches[0];
      return { x: t.clientX - rect.left, y: t.clientY - rect.top };
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  }

  const startDraw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    drawing.current = true;
    lastPos.current = getPos(e);
  }, []);

  const draw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!drawing.current) return;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(lastPos.current!.x, lastPos.current!.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = tool === "eraser" ? "#ffffff" : color;
    ctx.lineWidth = tool === "eraser" ? lineWidth * 5 : lineWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
    lastPos.current = pos;
  }, [tool, color, lineWidth]);

  const stopDraw = useCallback(() => { drawing.current = false; lastPos.current = null; }, []);

  function clearCanvas() {
    const canvas = canvasRef.current!;
    canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height);
  }

  // ── Question fetching ─────────────────────────────────────────────────────
  function fetchQuestion() {
    setRevealed(false);
    clearCanvas();
    socket.emit("teacher:demo_question", sessionId, (q: Question) => setQuestion(q));
  }

  function reveal() {
    if (!question) return;
    setRevealed(true);
    socket.emit("teacher:demo_reveal", sessionId, question.answer);
  }

  useEffect(() => { fetchQuestion(); }, []);

  const isLastRound = roundIndex >= totalRounds - 1;

  const colors = ["#1e40af", "#dc2626", "#059669", "#d97706", "#7c3aed", "#000000"];

  return (
    <div className={s.container}>
      <header className={s.header}>
        <div className={s.headerLeft}>
          <span className={s.demoTag}>Tavlerunde</span>
          <span className={s.topicName}>{topicName}</span>
          {totalRounds > 1 && <span className={s.roundBadge}>Runde {roundIndex + 1}/{totalRounds}</span>}
        </div>
        <div className={s.headerRight}>
          <button className={s.btnDanger} onClick={onEndSession}>Avslutt økt</button>
        </div>
      </header>

      <div className={s.layout}>
        {/* Question area */}
        <div className={s.questionArea}>
          {question ? (
            <p className={s.questionText}>{renderMathText(question.text)}</p>
          ) : (
            <p className={s.placeholder}>Trykk "Ny oppgave" for å starte</p>
          )}
          {revealed && question && (
            <div className={s.answerReveal}>Svar: <strong>{question.answer}</strong></div>
          )}
          <div className={s.questionActions}>
            <button className={s.btnPrimary} onClick={fetchQuestion}>Ny oppgave</button>
            {question && !revealed && (
              <button className={s.btnReveal} onClick={reveal}>Vis svar</button>
            )}
            <button
              className={s.btnNext}
              onClick={onNextRound}
            >
              {isLastRound ? "Avslutt tavlerunde" : `Start runde ${roundIndex + 2} →`}
            </button>
          </div>
        </div>

        {/* Drawing canvas */}
        <div className={s.canvasWrapper}>
          <div className={s.toolbar}>
            <div className={s.toolGroup}>
              <button
                className={`${s.toolBtn} ${tool === "pen" ? s.toolActive : ""}`}
                onClick={() => setTool("pen")}
                title="Penn"
              >✏️</button>
              <button
                className={`${s.toolBtn} ${tool === "eraser" ? s.toolActive : ""}`}
                onClick={() => setTool("eraser")}
                title="Viskelær"
              >🧹</button>
            </div>
            <div className={s.toolGroup}>
              {colors.map((c) => (
                <button
                  key={c}
                  className={`${s.colorBtn} ${color === c && tool === "pen" ? s.colorActive : ""}`}
                  style={{ background: c }}
                  onClick={() => { setColor(c); setTool("pen"); }}
                />
              ))}
            </div>
            <div className={s.toolGroup}>
              {[2, 4, 8, 14].map((w) => (
                <button
                  key={w}
                  className={`${s.sizeBtn} ${lineWidth === w ? s.toolActive : ""}`}
                  onClick={() => setLineWidth(w)}
                >
                  <span style={{ width: w, height: w, borderRadius: "50%", background: "#374151", display: "block" }} />
                </button>
              ))}
            </div>
            <button className={s.clearBtn} onClick={clearCanvas} title="Tøm">🗑️ Tøm</button>
          </div>
          <canvas
            ref={canvasRef}
            className={s.canvas}
            onMouseDown={startDraw}
            onMouseMove={draw}
            onMouseUp={stopDraw}
            onMouseLeave={stopDraw}
            onTouchStart={startDraw}
            onTouchMove={draw}
            onTouchEnd={stopDraw}
            style={{ cursor: tool === "eraser" ? "cell" : "crosshair" }}
          />
        </div>
      </div>
    </div>
  );
}
