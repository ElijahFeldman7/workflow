import { useEffect, useRef } from "react";

const shortDate = (date) => new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

export default function GradeTrend({ points }) {
  const canvas = useRef(null);
  const start = points[0];
  const end = points[points.length - 1];
  const minimum = Math.min(90, Math.floor(Math.min(...points.map(({ percent }) => percent)) / 10) * 10);
  const maximum = Math.max(100, Math.ceil(Math.max(...points.map(({ percent }) => percent)) / 10) * 10);

  useEffect(() => {
    const element = canvas.current;
    const context = element?.getContext("2d");
    if (!context || !start || !end) return;
    const { width, height } = element;
    const styles = getComputedStyle(element);
    const firstDate = Date.parse(start.date);
    const range = Date.parse(end.date) - firstDate;
    const padding = 5;
    context.clearRect(0, 0, width, height);
    context.lineWidth = 1;
    context.strokeStyle = `hsl(${styles.getPropertyValue("--border")})`;
    for (const y of [padding, height / 2, height - padding]) {
      context.beginPath();
      context.moveTo(padding, y);
      context.lineTo(width - padding, y);
      context.stroke();
    }
    context.strokeStyle = `hsl(${styles.getPropertyValue("--primary")})`;
    context.lineWidth = 3;
    context.lineJoin = "round";
    context.beginPath();
    points.forEach(({ date, percent }, index) => {
      const x = padding + (Date.parse(date) - firstDate) / range * (width - 2 * padding);
      const y = padding + (maximum - percent) / (maximum - minimum) * (height - 2 * padding);
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    });
    context.stroke();
  }, [points, start, end, minimum, maximum]);

  if (points.length < 2) return null;

  return (
    <figure className="border-b border-border py-3">
      <figcaption className="mb-2 text-xs font-medium text-muted-foreground">Estimated trend</figcaption>
      <div className="flex gap-2 text-xs tabular-nums text-muted-foreground">
        <div aria-hidden="true" className="flex flex-col justify-between py-0.5">
          <span>{maximum}%</span>
          <span>{minimum}%</span>
        </div>
        <canvas role="img"
          aria-label={`Estimated grade trend from ${Number(start.percent.toFixed(1))}% to ${Number(end.percent.toFixed(1))}%`}
          ref={canvas} width={640} height={170} className="h-auto min-w-0 flex-1" />
      </div>
      <div className="ml-9 mt-1 flex justify-between text-xs text-muted-foreground" aria-hidden="true">
        <span>{shortDate(start.date)}</span>
        <span>{shortDate(end.date)}</span>
      </div>
    </figure>
  );
}
