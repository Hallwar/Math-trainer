import React from "react";

const fracStyle: React.CSSProperties = {
  display: "inline-flex",
  flexDirection: "column",
  alignItems: "center",
  verticalAlign: "middle",
  lineHeight: 1,
  margin: "0 0.05em",
};
const numStyle: React.CSSProperties = {
  borderBottom: "0.1em solid currentColor",
  padding: "0 0.15em",
  lineHeight: 1.25,
};
const denStyle: React.CSSProperties = {
  padding: "0 0.15em",
  lineHeight: 1.25,
};

/**
 * Splits a string on N/D fraction patterns and renders them as
 * proper stacked fractions. Plain text segments are returned as-is.
 */
export function renderMathText(text: string): React.ReactNode {
  const parts = text.split(/(\d+\/\d+)/g);
  if (parts.length === 1) return text;
  return (
    <>
      {parts.map((part, i) => {
        const m = part.match(/^(\d+)\/(\d+)$/);
        if (m) {
          return (
            <span key={i} style={fracStyle}>
              <span style={numStyle}>{m[1]}</span>
              <span style={denStyle}>{m[2]}</span>
            </span>
          );
        }
        return <React.Fragment key={i}>{part}</React.Fragment>;
      })}
    </>
  );
}
