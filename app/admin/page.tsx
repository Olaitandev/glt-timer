"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

type TimerStatus = "running" | "paused" | "stopped";

interface StageTimer {
  id: number;
  duration: number; // seconds
  start_time: string | null;
  status: TimerStatus;
}

function formatTime(sec: number) {
  if (sec < 0) sec = 0;
  const s = sec % 60;
  const m = Math.floor(sec / 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function AdminPage() {
  const [timer, setTimer] = useState<StageTimer | null>(null);
  const [minutesInput, setMinutesInput] = useState("");
  const [currentTime, setCurrentTime] = useState(Date.now());

  // Memoized fetch timer
  const fetchTimer = useCallback(async () => {
    const { data } = await supabase.from("stage_timer").select("*").single();
    if (data) setTimer(data);
  }, []);

  // Realtime subscription
  useEffect(() => {
    fetchTimer();

    const channel = supabase
      .channel("timer-changes")
      .on(
        "postgres_changes",
        { event: "*", table: "stage_timer" },
        (payload) => {
          setTimer(payload.new as StageTimer);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchTimer]);

  // Update current time every 200ms
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 200);

    return () => clearInterval(interval);
  }, []);

  const startTimer = useCallback(async () => {
    if (!timer || timer.duration <= 0) return;
    const startTime = new Date().toISOString();

    await supabase
      .from("stage_timer")
      .update({
        status: "running",
        start_time: startTime,
      })
      .eq("id", timer.id);
  }, [timer]);

  const pauseTimer = useCallback(async () => {
    if (!timer || !timer.start_time) return;

    const startMs = new Date(timer.start_time).getTime();
    const elapsed = Math.floor((Date.now() - startMs) / 1000);
    const remaining = Math.max(0, timer.duration - elapsed);

    await supabase
      .from("stage_timer")
      .update({
        status: "paused",
        start_time: null,
        duration: remaining,
      })
      .eq("id", timer.id);
  }, [timer]);

  const resetTimer = useCallback(async () => {
    if (!timer) return;

    await supabase
      .from("stage_timer")
      .update({
        status: "stopped",
        start_time: null,
      })
      .eq("id", timer.id);
  }, [timer]);

  const updateDuration = useCallback(async () => {
    if (!timer) return;
    const mins = parseInt(minutesInput);
    if (isNaN(mins)) return;

    await supabase
      .from("stage_timer")
      .update({
        duration: mins * 60,
      })
      .eq("id", timer.id);

    setMinutesInput("");
  }, [timer, minutesInput]);

  const getRemainingTime = useCallback(() => {
    if (!timer) return 0;
    if (timer.status !== "running" || !timer.start_time) return timer.duration;

    const startMs = new Date(timer.start_time).getTime();
    const elapsed = Math.floor((currentTime - startMs) / 1000);
    const remaining = Math.max(0, timer.duration - elapsed);

    return remaining;
  }, [timer, currentTime]);

  if (!timer) return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white text-2xl">Loading timer…</div>;

  const remainingTime = getRemainingTime();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white/10 backdrop-blur-lg rounded-3xl border border-white/20 p-8 shadow-2xl">
          <h1 className="text-5xl font-bold text-white mb-8 text-center">Admin Control Panel</h1>

          <div className="space-y-6">
            {/* Status Display */}
            <div className="bg-black/30 rounded-2xl p-6 text-center">
              <h2 className="text-xl text-white/60 mb-2">Status</h2>
              <div
                className={`text-4xl font-bold uppercase ${
                  timer.status === "running"
                    ? "text-green-400"
                    : timer.status === "paused"
                    ? "text-yellow-400"
                    : "text-gray-400"
                }`}
              >
                {timer.status}
              </div>
            </div>

            {/* Timer Display */}
            <div className="bg-black/30 rounded-2xl p-8 text-center">
              <h3 className="text-2xl text-white/60 mb-4">Time Remaining</h3>
              <div className="text-8xl font-bold text-white tabular-nums">
                {formatTime(remainingTime)}
              </div>
              <div className="text-xl text-white/40 mt-2">
                {remainingTime} seconds
              </div>
            </div>

            {/* Control Buttons */}
            <div className="flex gap-4 justify-center flex-wrap">
              <button
                onClick={startTimer}
                disabled={timer.duration <= 0 || timer.status === "running"}
                className="px-8 py-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-xl text-lg transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 disabled:hover:scale-100"
              >
                Start
              </button>
              <button
                onClick={pauseTimer}
                className="px-8 py-4 bg-yellow-600 hover:bg-yellow-700 text-white font-semibold rounded-xl text-lg transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105 active:scale-95"
              >
                Pause
              </button>
              <button
                onClick={resetTimer}
                className="px-8 py-4 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl text-lg transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105 active:scale-95"
              >
                Reset
              </button>
            </div>

            {/* Duration Input */}
            <div className="bg-black/30 rounded-2xl p-6">
              <h3 className="text-xl text-white/80 mb-4 text-center">Update Duration</h3>
              <div className="flex gap-4 justify-center items-center flex-wrap">
                <input
                  type="number"
                  placeholder="Set minutes"
                  value={minutesInput}
                  onChange={(e) => setMinutesInput(e.target.value)}
                  className="px-6 py-3 bg-white/10 border border-white/30 rounded-xl text-white placeholder-white/40 text-lg w-48 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
                <button
                  onClick={updateDuration}
                  className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-lg transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105 active:scale-95"
                >
                  Update Duration
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
