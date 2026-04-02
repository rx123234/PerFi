import { cn } from "@/lib/utils";

interface SliderProps {
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
  label: string;
  formatValue?: (value: number) => string;
  className?: string;
}

export function Slider({
  min,
  max,
  step,
  value,
  onChange,
  label,
  formatValue,
  className,
}: SliderProps) {
  const displayValue = formatValue ? formatValue(value) : String(value);

  // Compute fill percentage for the track gradient
  const fillPercent = ((value - min) / (max - min)) * 100;

  return (
    <div className={cn("w-full space-y-2", className)}>
      {/* Label row */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <span className="text-sm font-semibold text-primary">{displayValue}</span>
      </div>

      {/* Range input */}
      <div className="relative flex items-center">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label={label}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
          aria-valuetext={displayValue}
          style={{
            background: `linear-gradient(to right, var(--color-primary) ${fillPercent}%, var(--color-secondary) ${fillPercent}%)`,
          }}
          className={cn(
            "w-full h-2 rounded-full appearance-none cursor-pointer",
            "transition-all duration-150",
            // Thumb — Webkit
            "[&::-webkit-slider-thumb]:appearance-none",
            "[&::-webkit-slider-thumb]:h-4",
            "[&::-webkit-slider-thumb]:w-4",
            "[&::-webkit-slider-thumb]:rounded-full",
            "[&::-webkit-slider-thumb]:bg-primary",
            "[&::-webkit-slider-thumb]:border-2",
            "[&::-webkit-slider-thumb]:border-background",
            "[&::-webkit-slider-thumb]:shadow-sm",
            "[&::-webkit-slider-thumb]:transition-transform",
            "[&::-webkit-slider-thumb]:duration-150",
            "[&::-webkit-slider-thumb:hover]:scale-110",
            "[&::-webkit-slider-thumb:active]:scale-95",
            // Thumb — Firefox
            "[&::-moz-range-thumb]:h-4",
            "[&::-moz-range-thumb]:w-4",
            "[&::-moz-range-thumb]:rounded-full",
            "[&::-moz-range-thumb]:bg-primary",
            "[&::-moz-range-thumb]:border-2",
            "[&::-moz-range-thumb]:border-background",
            "[&::-moz-range-thumb]:shadow-sm",
            "[&::-moz-range-thumb]:cursor-pointer",
            // Track — Firefox
            "[&::-moz-range-track]:h-2",
            "[&::-moz-range-track]:rounded-full",
            // Focus ring
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          )}
        />
      </div>

      {/* Min / max labels */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {formatValue ? formatValue(min) : String(min)}
        </span>
        <span className="text-xs text-muted-foreground">
          {formatValue ? formatValue(max) : String(max)}
        </span>
      </div>
    </div>
  );
}
