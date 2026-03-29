import { Button } from "@/components/ui/button";
import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfQuarter,
  endOfQuarter,
  startOfYear,
  endOfYear,
  subMonths,
  subQuarters,
  subYears,
  subWeeks,
  format,
} from "date-fns";

export type DateRange = {
  startDate: string;
  endDate: string;
  prevStartDate: string;
  prevEndDate: string;
  label: string;
};

type Preset = "week" | "month" | "quarter" | "year";

function getRange(preset: Preset): DateRange {
  const now = new Date();
  let start: Date, end: Date, prevStart: Date, prevEnd: Date;

  switch (preset) {
    case "week":
      start = startOfWeek(now);
      end = endOfWeek(now);
      prevStart = startOfWeek(subWeeks(now, 1));
      prevEnd = endOfWeek(subWeeks(now, 1));
      break;
    case "month":
      start = startOfMonth(now);
      end = endOfMonth(now);
      prevStart = startOfMonth(subMonths(now, 1));
      prevEnd = endOfMonth(subMonths(now, 1));
      break;
    case "quarter":
      start = startOfQuarter(now);
      end = endOfQuarter(now);
      prevStart = startOfQuarter(subQuarters(now, 1));
      prevEnd = endOfQuarter(subQuarters(now, 1));
      break;
    case "year":
      start = startOfYear(now);
      end = endOfYear(now);
      prevStart = startOfYear(subYears(now, 1));
      prevEnd = endOfYear(subYears(now, 1));
      break;
  }

  return {
    startDate: format(start, "yyyy-MM-dd"),
    endDate: format(end, "yyyy-MM-dd"),
    prevStartDate: format(prevStart, "yyyy-MM-dd"),
    prevEndDate: format(prevEnd, "yyyy-MM-dd"),
    label: preset,
  };
}

interface Props {
  selected: string;
  onChange: (range: DateRange) => void;
}

export default function DateRangePicker({ selected, onChange }: Props) {
  const presets: { key: Preset; label: string }[] = [
    { key: "week", label: "This Week" },
    { key: "month", label: "This Month" },
    { key: "quarter", label: "This Quarter" },
    { key: "year", label: "This Year" },
  ];

  return (
    <div className="flex gap-1">
      {presets.map(({ key, label }) => (
        <Button
          key={key}
          variant={selected === key ? "default" : "outline"}
          size="sm"
          onClick={() => onChange(getRange(key))}
        >
          {label}
        </Button>
      ))}
    </div>
  );
}

export { getRange };
