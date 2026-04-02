interface ProgressRingProps {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  label?: string;
  sublabel?: string;
}

export function ProgressRing({
  percentage,
  size = 80,
  strokeWidth = 6,
  color,
  label,
  sublabel,
}: ProgressRingProps) {
  const clampedPct = Math.min(100, Math.max(0, percentage));

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clampedPct / 100) * circumference;

  const center = size / 2;

  // Determine font sizes relative to ring size
  const labelFontSize = Math.max(10, size * 0.2);
  const sublabelFontSize = Math.max(8, size * 0.14);
  const pctFontSize = Math.max(10, size * 0.2);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={label ?? `${clampedPct}%`}
    >
      {/* Background track */}
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke="var(--color-secondary)"
        strokeWidth={strokeWidth}
      />

      {/* Progress arc */}
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke={color ?? "var(--color-primary)"}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${center} ${center})`}
        style={{ transition: "stroke-dashoffset 0.4s ease" }}
      />

      {/* Center text */}
      {label ? (
        <>
          <text
            x={center}
            y={sublabel ? center - sublabelFontSize * 0.6 : center}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="var(--color-foreground)"
            fontSize={labelFontSize}
            fontWeight={600}
            fontFamily="inherit"
          >
            {label}
          </text>
          {sublabel && (
            <text
              x={center}
              y={center + labelFontSize * 0.7}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="var(--color-muted-foreground)"
              fontSize={sublabelFontSize}
              fontFamily="inherit"
            >
              {sublabel}
            </text>
          )}
        </>
      ) : (
        <text
          x={center}
          y={center}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="var(--color-foreground)"
          fontSize={pctFontSize}
          fontWeight={600}
          fontFamily="inherit"
        >
          {clampedPct}%
        </text>
      )}
    </svg>
  );
}
