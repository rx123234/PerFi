import { useState, useRef, type ReactNode } from "react";

interface TooltipProps {
  content: string;
  side?: "right" | "top" | "bottom" | "left";
  children: ReactNode;
}

export function Tooltip({ content, side = "right", children }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const show = () => {
    timeoutRef.current = setTimeout(() => setVisible(true), 200);
  };

  const hide = () => {
    clearTimeout(timeoutRef.current);
    setVisible(false);
  };

  const positionClasses = {
    right: "left-full ml-2 top-1/2 -translate-y-1/2",
    left: "right-full mr-2 top-1/2 -translate-y-1/2",
    top: "bottom-full mb-2 left-1/2 -translate-x-1/2",
    bottom: "top-full mt-2 left-1/2 -translate-x-1/2",
  };

  return (
    <div className="relative inline-flex" onMouseEnter={show} onMouseLeave={hide}>
      {children}
      {visible && (
        <div
          className={`absolute z-50 px-2.5 py-1.5 text-xs font-medium rounded-md bg-popover text-popover-foreground shadow-md border border-border whitespace-nowrap pointer-events-none ${positionClasses[side]}`}
        >
          {content}
        </div>
      )}
    </div>
  );
}
