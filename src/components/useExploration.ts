import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

/** Mirrors `ExplorationData` in src-tauri/src/exploration.rs (camelCase). */
export type ExplorationData = {
  areaCount: number;
  roomsX: number;
  roomsY: number;
  /** areas[area][rx * roomsY + ry] = raw save value */
  areas: number[][];
  warnings: string[];
};

type State = {
  data: ExplorationData | null;
  loading: boolean;
  error: string | null;
};

/** Loads the exploration grid of the selected save slot; reloads when it changes. */
export function useExploration(savePath: string | null | undefined): State {
  const [state, setState] = useState<State>({
    data: null,
    loading: false,
    error: null,
  });

  useEffect(() => {
    if (!savePath) {
      setState({ data: null, loading: false, error: null });
      return;
    }

    let cancelled = false;
    setState({ data: null, loading: true, error: null });

    invoke<ExplorationData>("read_exploration", { path: savePath })
      .then((data) => {
        if (!cancelled) setState({ data, loading: false, error: null });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({ data: null, loading: false, error: String(error) });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [savePath]);

  return state;
}
