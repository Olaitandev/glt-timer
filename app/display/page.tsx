"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";



interface StageTimer {
  id: number;
  start_time: string | null;
  duration: number;
  status: "running" | "paused" | "stopped";
  updated_at: string;
}

function fmt(sec: number) {
  if (sec < 0) sec = 0;
  const s = sec % 60;
  const m = Math.floor(sec / 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function DisplayPage() {
  const [timer, setTimer] = useState<StageTimer | null>(null);
  const [offsetMs, setOffsetMs] = useState(0);
  const [remaining, setRemaining] = useState(0);

  const intervalRef = useRef<NodeJS.Timer | null>(null);

  const loadTimer = async () => {
    const { data } = await supabase
      .from("stage_timer")
      .select("*")
      .eq("id", 1)
      .single();

    if (data) setTimer(data);
  };

  const computeOffset = async () => {
    const t0 = Date.now();
    const res = await fetch("/api/time");
    const t1 = Date.now();

    const json = await res.json();
    const serverMs = json.now_ms;

    const midpoint = Math.round((t0 + t1) / 2);
    setOffsetMs(serverMs - midpoint);
  };

  useEffect(() => {
    loadTimer();
    computeOffset();

    const channel = supabase
      .channel("stage_timer_display")
      .on(
        "postgres_changes" as const,
        { event: "UPDATE", schema: "public", table: "stage_timer" },
        (payload) => {
          setTimer(payload.new as StageTimer);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (!timer) return;

    const computeRemaining = (): number => {
      if (!timer) return 0;

      if (timer.status === "running" && timer.start_time) {
        const start = new Date(timer.start_time).getTime();
        const serverNow = Date.now() + offsetMs;
        const elapsed = Math.floor((serverNow - start) / 1000);
        return Math.max(0, timer.duration - elapsed);
      }

      return Math.max(0, timer.duration);
    };

    if (intervalRef.current) clearInterval(intervalRef.current);

    setRemaining(computeRemaining());

    intervalRef.current = setInterval(() => {
      setRemaining(computeRemaining());
    }, 200);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [timer, offsetMs]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex flex-col items-center justify-center p-8">
      <div className="text-center space-y-8">
        <h1 className="text-6xl md:text-8xl font-bold text-white/90 tracking-tight">
          Stage Timer
        </h1>

        <div className="relative">
          <div
            className={`text-[12rem] md:text-[20rem] lg:text-[28rem] font-bold tabular-nums leading-none transition-colors duration-300 ${
              remaining <= 60 && remaining > 0
                ? "text-red-500 animate-pulse"
                : remaining === 0
                ? "text-red-600"
                : "text-white"
            }`}
            style={{
              textShadow: "0 0 60px rgba(255,255,255,0.3)",
            }}
          >
            {fmt(remaining)}
          </div>
          
          {remaining <= 10 && remaining > 0 && (
            <div className="absolute inset-0 bg-red-500/20 blur-3xl animate-pulse" />
          )}
        </div>

        <div className="flex items-center justify-center gap-8 text-2xl md:text-4xl">
          <div className="px-8 py-4 bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20">
            <span className="text-white/60 font-medium">Status: </span>
            <span
              className={`font-bold uppercase ${
                timer?.status === "running"
                  ? "text-green-400"
                  : timer?.status === "paused"
                  ? "text-yellow-400"
                  : "text-gray-400"
              }`}
            >
              {timer?.status}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
