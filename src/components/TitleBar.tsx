import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
// The existing application icon, used as-is (not copied or modified).
import appIcon from "../../src-tauri/icons/128x128.png";

/* Window control glyphs: 12x12 pixel grids drawn with crisp rectangles so
   they match the app's pixel style at any scale. */
function Glyph({ kind }: { kind: "minimize" | "maximize" | "restore" | "close" }) {
  const rects: Record<typeof kind, [number, number, number, number][]> = {
    minimize: [[2, 8, 8, 2]],
    maximize: [
      [2, 2, 8, 2],
      [2, 8, 8, 2],
      [2, 2, 2, 8],
      [8, 2, 2, 8],
    ],
    restore: [
      [4, 1, 7, 2],
      [9, 1, 2, 7],
      [1, 4, 7, 2],
      [1, 9, 7, 2],
      [1, 4, 2, 7],
      [6, 4, 2, 7],
    ],
    close: Array.from({ length: 9 }, (_, i): [number, number, number, number] => [1 + i, 1 + i, 2, 2]).concat(
      Array.from({ length: 9 }, (_, i): [number, number, number, number] => [9 - i, 1 + i, 2, 2]),
    ),
  };

  return (
    <svg
      className="titlebar-glyph"
      viewBox="0 0 12 12"
      width="12"
      height="12"
      shapeRendering="crispEdges"
      aria-hidden="true"
      focusable="false"
    >
      {rects[kind].map(([x, y, w, h], i) => (
        <rect key={`${x}-${y}-${w}-${h}-${i}`} x={x} y={y} width={w} height={h} fill="currentColor" />
      ))}
    </svg>
  );
}

// getCurrentWindow() throws outside Tauri (e.g. a plain browser tab), so
// every call goes through this guard and the bar stays harmless there.
function withWindow(action: (win: ReturnType<typeof getCurrentWindow>) => unknown) {
  try {
    void Promise.resolve(action(getCurrentWindow())).catch(() => undefined);
  } catch {
    /* not running inside Tauri */
  }
}

export default function TitleBar() {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;

    try {
      const win = getCurrentWindow();
      const sync = () =>
        win
          .isMaximized()
          .then((value) => {
            if (!cancelled) setMaximized(value);
          })
          .catch(() => undefined);

      void sync();
      win
        .onResized(() => void sync())
        .then((stop) => {
          if (cancelled) stop();
          else unlisten = stop;
        })
        .catch(() => undefined);
    } catch {
      /* not running inside Tauri */
    }

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  return (
    <header className="titlebar" data-tauri-drag-region>
      <div className="titlebar-brand">
        <img className="titlebar-icon" src={appIcon} alt="" draggable={false} />
        <span className="titlebar-name">Rabi-Ribi Companion</span>
      </div>

      <div className="titlebar-controls">
        <button
          type="button"
          className="titlebar-button"
          onClick={() => withWindow((win) => win.minimize())}
          aria-label="Minimize"
          title="Minimize"
        >
          <Glyph kind="minimize" />
        </button>
        <button
          type="button"
          className="titlebar-button"
          onClick={() => withWindow((win) => win.toggleMaximize())}
          aria-label={maximized ? "Restore" : "Maximize"}
          title={maximized ? "Restore" : "Maximize"}
        >
          <Glyph kind={maximized ? "restore" : "maximize"} />
        </button>
        <button
          type="button"
          className="titlebar-button titlebar-button--close"
          onClick={() => withWindow((win) => win.close())}
          aria-label="Close"
          title="Close"
        >
          <Glyph kind="close" />
        </button>
      </div>
    </header>
  );
}
