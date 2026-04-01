import { useState } from "react";
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
  addMonths,
  addQuarters,
  addYears,
  addWeeks,
  subMonths,
  subQuarters,
  subYears,
  subWeeks,
  format,
  getQuarter,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";

export type DateRange = {
  startDate: string;
  endDate: string;
  prevStartDate: string;
  prevEndDate: string;
  label: string;
};

type Preset = "week" | "month" | "quarter" | "year";

function getRangeForAnchor(preset: Preset, anchor: Date): DateRange {
  let start: Date, end: Date, prevStart: Date, prevEnd: Date;

  switch (preset) {
    case "week":
      start = startOfWeek(anchor);
      end = endOfWeek(anchor);
      prevStart = startOfWeek(subWeeks(anchor, 1));
      prevEnd = endOfWeek(subWeeks(anchor, 1));
      break;
    case "month":
      start = startOfMonth(anchor);
      end = endOfMonth(anchor);
      prevStart = startOfMonth(subMonths(anchor, 1));
      prevEnd = endOfMonth(subMonths(anchor, 1));
      break;
    case "quarter":
      start = startOfQuarter(anchor);
      end = endOfQuarter(anchor);
      prevStart = startOfQuarter(subQuarters(anchor, 1));
      prevEnd = endOfQuarter(subQuarters(anchor, 1));
      break;
    case "year":
      start = startOfYear(anchor);
      end = endOfYear(anchor);
      prevStart = startOfYear(subYears(anchor, 1));
      prevEnd = endOfYear(subYears(anchor, 1));
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

function getRange(preset: Preset): DateRange {
  return getRangeForAnchor(preset, new Date());
}

function formatPeriodLabel(preset: Preset, anchor: Date): string {
  switch (preset) {
    case "week": {
      const s = startOfWeek(anchor);
      const e = endOfWeek(anchor);
      return `${format(s, "MMM d")} – ${format(e, "MMM d, yyyy")}`;
    }
    case "month":
      return format(anchor, "MMMM yyyy");
    case "quarter":
      return `Q${getQuarter(anchor)} ${format(anchor, "yyyy")}`;
    case "year":
      return format(anchor, "yyyy");
  }
}

function shiftAnchor(preset: Preset, anchor: Date, direction: -1 | 1): Date {
  switch (preset) {
    case "week":
      return direction === 1 ? addWeeks(anchor, 1) : subWeeks(anchor, 1);
    case "month":
      return direction === 1 ? addMonths(anchor, 1) : subMonths(anchor, 1);
    case "quarter":
      return direction === 1 ? addQuarters(anchor, 1) : subQuarters(anchor, 1);
    case "year":
      return direction === 1 ? addYears(anchor, 1) : subYears(anchor, 1);
  }
}

interface Props {
  selected: string;
  onChange: (range: DateRange) => void;
}

export default function DateRangePicker({ selected, onChange }: Props) {
  const [anchor, setAnchor] = useState(new Date());
  const preset = (selected as Preset) || "month";

  const presets: { key: Preset; label: string }[] = [
    { key: "week", label: "Week" },
    { key: "month", label: "Month" },
    { key: "quarter", label: "Quarter" },
    { key: "year", label: "Year" },
  ];

  const handlePresetClick = (key: Preset) => {
    const now = new Date();
    setAnchor(now);
    onChange(getRangeForAnchor(key, now));
  };

  const handleNav = (direction: -1 | 1) => {
    const newAnchor = shiftAnchor(preset, anchor, direction);
    setAnchor(newAnchor);
    onChange(getRangeForAnchor(preset, newAnchor));
  };

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleNav(-1)}
          className="h-7 w-7 p-0"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm text-muted-foreground min-w-[140px] text-center">
          {formatPeriodLabel(preset, anchor)}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleNav(1)}
          className="h-7 w-7 p-0"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex gap-1 rounded-lg bg-secondary p-1">
        {presets.map(({ key, label }) => (
          <Button
            key={key}
            variant={selected === key ? "default" : "ghost"}
            size="sm"
            onClick={() => handlePresetClick(key)}
            className="h-7 px-3 text-xs"
          >
            {label}
          </Button>
        ))}
      </div>
    </div>
  );
}

export { getRange };
