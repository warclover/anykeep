"use client";

import { cn } from "@/lib/utils";
import { useAgentHighlight } from "@/lib/fluid-agent";

interface HighlightWrapperProps {
  entityId: string;
  children: React.ReactNode;
  className?: string;
}

export function HighlightWrapper({
  entityId,
  children,
  className,
}: HighlightWrapperProps) {
  const { highlightClassName } = useAgentHighlight(entityId);

  return (
    <div
      className={cn(
        "transition-all duration-300",
        highlightClassName,
        className,
      )}
    >
      {children}
    </div>
  );
}
