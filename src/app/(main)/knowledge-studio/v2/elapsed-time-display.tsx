"use client";

import { useState, useEffect } from "react";
import { formatElapsedTime, type Ks2TextFn } from "./utils";

export function ElapsedTimeDisplay({
  startTime,
  label,
}: {
  startTime: number;
  label: Ks2TextFn;
}) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  return (
    <span>{label("elapsedTime", { time: formatElapsedTime(elapsed) })}</span>
  );
}
