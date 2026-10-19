// The branded opening and closing card, in place of the plain title and end cards.
//
// Opening: the mark assembles, the line rises under it, the sting plays once, and the card fades
// into the walkthrough. Closing: the same lockup, already settled, held silent and then cut.
import React from "react";
import { AbsoluteFill, Audio, Easing, interpolate, staticFile, useCurrentFrame } from "remotion";
import { brandCardOpacity, brandPieceState, DEFAULT_VIEW_BOX, type Brand } from "./model";

// The settled mark on its own, small. The caption band wears it on every frame, so the film is
// quietly the brand's rather than captioned as the brand's.
export const BrandMark: React.FC<{ brand: Brand; size: number }> = ({ brand, size }) => (
  <svg viewBox={brand.viewBox ?? DEFAULT_VIEW_BOX} width={size} height={size} fill="currentColor" aria-label={brand.name}>
    {brand.parts.map(({ kind, ...attrs }, i) => React.createElement(kind, { key: i, ...attrs }))}
  </svg>
);

export const BrandCard: React.FC<{ brand: Brand; total: number; closing?: boolean; narrated?: boolean; notice?: boolean }> = ({
  brand,
  total,
  closing = false,
  narrated = false,
  notice = brand.aiNotice === true,
}) => {
  const frame = useCurrentFrame();
  // The line arrives after the mark has settled, so the eye reads one thing at a time.
  const reveal = interpolate(frame, [24, 43], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  return (
    <AbsoluteFill
      style={{
        background: brand.primary,
        color: "white",
        fontFamily: "-apple-system, 'Helvetica Neue', Arial, sans-serif",
        justifyContent: "center",
        alignItems: "center",
        opacity: closing ? 1 : brandCardOpacity(frame, total),
      }}
    >
      {!closing && brand.sound ? <Audio src={staticFile(brand.sound)} /> : null}
      <div style={{ display: "flex", gap: 38, alignItems: "center", marginTop: -65 }}>
        <svg viewBox={brand.viewBox ?? DEFAULT_VIEW_BOX} width={260} height={260} fill="currentColor" aria-label={brand.name}>
          {brand.parts.map((part, i) => {
            const state = closing ? { x: 0, y: 0, opacity: 1 } : brandPieceState(frame, i);
            const { kind, ...attrs } = part;
            return (
              <g key={i} transform={`translate(${state.x},${state.y})`} opacity={state.opacity}>
                {React.createElement(kind, attrs)}
              </g>
            );
          })}
        </svg>
        <div style={{ fontSize: 94, fontWeight: 650, letterSpacing: -3 }}>{brand.name}</div>
      </div>
      <div style={{ height: 60, overflow: "hidden", marginTop: 20 }}>
        <div style={{ fontSize: 40, letterSpacing: 0.2, transform: `translateY(${closing ? 0 : (1 - reveal) * 55}px)` }}>
          {brand.slogan}
        </div>
      </div>
      {/* A visible notice is an explicit presentation choice, not inferred from the voice. */}
      {narrated && notice ? (
        <div style={{ position: "absolute", bottom: 38, fontSize: 17, opacity: 0.65, letterSpacing: 1 }}>AI NARRATION</div>
      ) : null}
    </AbsoluteFill>
  );
};
