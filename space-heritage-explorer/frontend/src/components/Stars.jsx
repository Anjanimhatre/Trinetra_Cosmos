import { useMemo } from "react";

/* Small twinkling stars. Styles (.bd-stars, .bd-star, bd-twinkle) are in auth.css. */
export default function Stars({ count = 45 }) {
  const stars = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        top: Math.random() * 100,
        left: Math.random() * 100,
        size: 1 + Math.random() * 1.8,
        delay: Math.random() * 5,
        duration: 3 + Math.random() * 4,
      })),
    [count]
  );

  return (
    <div className="bd-stars" style={{ position: "fixed" }} aria-hidden="true">
      {stars.map((s) => (
        <span
          key={s.id}
          className="bd-star"
          style={{
            top: `${s.top}%`,
            left: `${s.left}%`,
            width: s.size,
            height: s.size,
            animationDelay: `${s.delay}s`,
            animationDuration: `${s.duration}s`,
          }}
        />
      ))}
    </div>
  );
}