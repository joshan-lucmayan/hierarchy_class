import type { CSSProperties } from "react";

/**
 * Fixed atmospheric background shared by the landing page and the auth pages.
 * Stays pinned while the page scrolls. Purely decorative: crown hero-art in the
 * accent token, floating king/queen chess pieces, flowing ribbon lines, film
 * grain and a vignette so the cards in front read clearly.
 */
function ChessKing({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M11 1.8h2v2h2v1.8h-2v2h-2v-2H9V3.8h2z" />
      <path d="M12 7c-2.9 0-4.9 1.9-4.9 4 0 1.4.6 2.4 1.7 3l-.8 4.4h8l-.8-4.4c1.1-.6 1.7-1.6 1.7-3 0-2.1-2-4-4.9-4z" />
      <path d="M7.1 18.4h9.8l1.1 3.4H6z" />
    </svg>
  );
}

function ChessQueen({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M7.2 4.2l1.8-3.6 1 3.6 2-5 2 5 1-3.6 1.8 3.6.9 2.3-1 5.2H7.3l-1-5.2z" />
      <path d="M7.5 11.7h9l1 2.6H6.5z" />
      <path d="M7.7 16.6h8.6l.9 3.2H6.8z" />
    </svg>
  );
}

const CHESS_PIECES: Array<{
  kind: "king" | "queen";
  size: number;
  top: string;
  left: string;
  r: number;
  delay: number;
  dur: number;
}> = [
  { kind: "king", size: 44, top: "16%", left: "6%", r: -12, delay: 0, dur: 7 },
  { kind: "queen", size: 38, top: "26%", left: "88%", r: 8, delay: 0.6, dur: 8 },
  { kind: "king", size: 30, top: "58%", left: "92%", r: 10, delay: 1.2, dur: 7.5 },
  { kind: "queen", size: 42, top: "72%", left: "7%", r: -8, delay: 0.9, dur: 8.5 },
  { kind: "king", size: 26, top: "40%", left: "3%", r: 6, delay: 1.6, dur: 7 },
  { kind: "queen", size: 32, top: "8%", left: "40%", r: -5, delay: 2, dur: 9 },
  { kind: "king", size: 28, top: "84%", left: "46%", r: 14, delay: 0.3, dur: 8 },
  { kind: "queen", size: 36, top: "12%", left: "72%", r: -10, delay: 1.4, dur: 7.2 },
];

export function LandingBackground() {
  return (
    <div
      className="landing-bg pointer-events-none fixed inset-0 z-0 overflow-hidden bg-[var(--bg)]"
      aria-hidden
    >
      {/* Crown hero-art: the logo silhouette, masked and breathing behind the hero */}
      <div
        className="absolute left-1/2 top-[46%] -translate-x-1/2 -translate-y-1/2"
        style={{ animation: "heroBreath 10s ease-in-out infinite" }}
      >
        <svg
          viewBox="0 0 1400 770"
          className="h-auto w-[900px] max-w-none"
          style={{
            fill: "var(--gold)",
            filter: "grayscale(0.15) brightness(0.85) contrast(1.05)",
            WebkitMaskImage: "radial-gradient(ellipse 55% 60% at 50% 48%, #000 35%, transparent 78%)",
            maskImage: "radial-gradient(ellipse 55% 60% at 50% 48%, #000 35%, transparent 78%)",
          }}
        >
          <polygon points="428,293 585,412 515,565 415,300" />
          <polygon points="701,205 855,565 545,565" />
          <polygon points="978,293 823,412 885,565 985,300" />
        </svg>
      </div>

      {/* Flowing ribbon lines */}
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1440 900" fill="none" preserveAspectRatio="xMidYMid slice">
        <path
          d="M-40 140 C 300 70, 520 240, 820 170 S 1320 110, 1520 190"
          stroke="rgba(158,167,179,0.10)"
          strokeWidth="1.2"
          strokeDasharray="8 12"
          style={{ animation: "flowMove 10s linear infinite" }}
        />
        <path
          d="M-40 640 C 260 560, 540 760, 860 660 S 1360 600, 1520 700"
          stroke="rgba(158,167,179,0.08)"
          strokeWidth="1"
          strokeDasharray="6 14"
          style={{ animation: "flowMove 14s linear infinite" }}
        />
        <path
          d="M-40 400 C 320 330, 600 470, 900 390 S 1400 340, 1520 420"
          stroke="rgba(158,167,179,0.06)"
          strokeWidth="1.4"
          strokeDasharray="10 16"
          style={{ animation: "flowMove 17s linear infinite" }}
        />
      </svg>

      {/* Floating chess pieces - king and queen in the muted slate style */}
      {CHESS_PIECES.map((piece, i) => (
        <div
          key={i}
          className="absolute text-[rgba(158,167,179,0.28)]"
          style={
            {
              top: piece.top,
              left: piece.left,
              width: piece.size,
              animation: `chessFloat ${piece.dur}s ease-in-out ${piece.delay}s infinite`,
              "--r": `${piece.r}deg`,
            } as CSSProperties
          }
        >
          {piece.kind === "king" ? (
            <ChessKing className="h-auto" />
          ) : (
            <ChessQueen className="h-auto" />
          )}
        </div>
      ))}

      {/* Film grain */}
      <div
        className="absolute inset-0 opacity-[0.045] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      {/* Drifting ambient orbs */}
      <div
        className="absolute left-[12%] top-[18%] h-[380px] w-[380px] rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(158,167,179,0.10), transparent 70%)",
          filter: "blur(50px)",
          animation: "orbDrift 14s ease-in-out infinite",
        }}
      />
      <div
        className="absolute bottom-[10%] right-[8%] h-[320px] w-[320px] rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(70,76,85,0.22), transparent 70%)",
          filter: "blur(60px)",
          animation: "orbDrift 18s ease-in-out 2s infinite reverse",
        }}
      />

      {/* Vignette */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 70% at 50% 50%, transparent 40%, rgba(15,15,17,0.85) 100%)",
        }}
      />
    </div>
  );
}
