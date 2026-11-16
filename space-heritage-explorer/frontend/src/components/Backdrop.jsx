import { useMemo } from "react";

export default function Backdrop() {
  const stars = useMemo(
    () =>
      Array.from({ length: 70 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        top: Math.random() * 100,
        size: 1 + Math.random() * 1.8,
        delay: Math.random() * 6,
        dur: 3 + Math.random() * 4,
      })),
    []
  );

  return (
    <div className="bd" aria-hidden="true">
      <div className="bd-sky" />
      <div className="bd-stars">
        {stars.map((s) => (
          <span
            key={s.id}
            className="bd-star"
            style={{
              left: `${s.left}%`,
              top: `${s.top}%`,
              width: s.size,
              height: s.size,
              animationDelay: `${s.delay}s`,
              animationDuration: `${s.dur}s`,
            }}
          />
        ))}
      </div>
      <div className="bd-moon" />
      <div className="bd-art bd-left" />
      <div className="bd-art bd-right" />
    </div>
  );
}