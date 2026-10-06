// Inside the chat, CopilotKit redefines --muted, so this takes the chat's own
// aliases (app/globals.css), like the tool call lines.

/**
 * How much of a whole is done, as a labelled bar with its percentage. Values
 * outside 0..max are clamped; a max of 0 shows an empty bar.
 */
export function ProgressBar({
  value,
  max,
  label,
}: {
  value: number;
  max: number;
  label: string;
}) {
  const whole = Math.max(max, 0);
  const done = Math.min(Math.max(value, 0), whole);
  const percent = whole > 0 ? Math.round((done / whole) * 100) : 0;
  return (
    <div className="m-2 flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-4 text-xs font-semibold tracking-wide text-(--chat-quiet) uppercase">
        <span>{label}</span>
        <span className="tabular-nums">{percent}%</span>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={whole}
        aria-valuenow={done}
        aria-valuetext={`${done} of ${whole}`}
        className="h-2 overflow-hidden rounded-full bg-(--chat-line)"
      >
        <div
          className="h-full rounded-full bg-(--chat-ink) transition-[width] motion-reduce:transition-none"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
