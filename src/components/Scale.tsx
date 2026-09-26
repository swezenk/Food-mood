"use client";

export default function Scale({
  min,
  max,
  value,
  onChange,
  labels,
}: {
  min: number;
  max: number;
  value: number | null;
  onChange: (v: number) => void;
  labels?: [string, string];
}) {
  const values = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  return (
    <div className="stack" style={{ gap: 6 }}>
      <div className="scale" style={{ gridTemplateColumns: `repeat(${values.length}, 1fr)` }} role="radiogroup">
        {values.map((v) => (
          <button key={v} type="button" role="radio" aria-checked={value === v} aria-pressed={value === v} onClick={() => onChange(v)}>
            {v}
          </button>
        ))}
      </div>
      {labels && (
        <div className="row small muted" style={{ justifyContent: "space-between" }}>
          <span>{labels[0]}</span>
          <span>{labels[1]}</span>
        </div>
      )}
    </div>
  );
}
