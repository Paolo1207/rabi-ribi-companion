
import { useMemo, useState, type KeyboardEvent } from "react";
import { PixelIcon } from "./PixelIcon";

export type FileSelectSlot = {
  slot: number;
  file_name: string;
  last_modified: number;
  thumbnailUrl?: string | null;
  game_mode: string;
};

type FileSelectProps = {
  slots: FileSelectSlot[];
  loading: boolean;
  error: string;
  onSelect: (save: FileSelectSlot) => void;
};

function formatModified(seconds: number): string {
  return seconds > 0 ? new Date(seconds * 1000).toLocaleString() : "Unknown";
}

function formatRelative(seconds: number): string | null {
  if (seconds <= 0) return null;

  const diffSeconds = seconds - Date.now() / 1000;
  const formatter = new Intl.RelativeTimeFormat(undefined, {
    numeric: "auto",
  });

  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31536000],
    ["month", 2592000],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];

  for (const [unit, size] of units) {
    if (Math.abs(diffSeconds) >= size) {
      return formatter.format(Math.round(diffSeconds / size), unit);
    }
  }

  return "just now";
}

function FileSelect({
  slots,
  loading,
  error,
  onSelect,
}: FileSelectProps) {
  const latestSlot = useMemo(() => {
    if (slots.length === 0) return null;

    return slots.reduce(
      (latest, current) =>
        current.last_modified > latest.last_modified ? current : latest,
      slots[0]
    ).slot;
  }, [slots]);

  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);

  const activeSlot =
    selectedSlot !== null && slots.some((save) => save.slot === selectedSlot)
      ? selectedSlot
      : latestSlot;

  function selectSave(save: FileSelectSlot) {
    setSelectedSlot(save.slot);
    onSelect(save);
  }

  function moveCursor(nextIndex: number) {
    const target = slots[nextIndex];
    if (!target) return;

    setSelectedSlot(target.slot);

    window.requestAnimationFrame(() => {
      document
        .getElementById(`file-slot-${target.slot}`)
        ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLUListElement>) {
    if (slots.length === 0) return;

    const currentIndex = Math.max(
      0,
      slots.findIndex((save) => save.slot === activeSlot)
    );

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        moveCursor(Math.min(slots.length - 1, currentIndex + 1));
        break;

      case "ArrowUp":
        event.preventDefault();
        moveCursor(Math.max(0, currentIndex - 1));
        break;

      case "Home":
        event.preventDefault();
        moveCursor(0);
        break;

      case "End":
        event.preventDefault();
        moveCursor(slots.length - 1);
        break;

      case "Enter":
      case " ":
        event.preventDefault();
        {
          const target = slots.find((save) => save.slot === activeSlot);
          if (target) selectSave(target);
        }
        break;
    }
  }

  return (
    <div className="pixel file-select">
      <div className="fs-titlebar">
        <span className="fs-title">
          <PixelIcon name="book" />
          File Select
        </span>

        {!loading && !error && slots.length > 0 && (
          <span className="fs-count">
            <strong>{slots.length}</strong> detected save{" "}
            {slots.length === 1 ? "slot" : "slots"}
          </span>
        )}
      </div>

      {loading ? (
        <div className="fs-state" role="status">
          <span className="loader" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <h2>Checking save files...</h2>
          <p>Looking inside your Rabi-Ribi save folder.</p>
        </div>
      ) : error ? (
        <div className="fs-state fs-state-error" role="alert">
          <span className="fs-state-icon">!</span>
          <h2>Unable to load save files</h2>
          <p>{error}</p>
        </div>
      ) : slots.length === 0 ? (
        <div className="fs-state">
          <span className="fs-state-icon">
            <PixelIcon name="book" />
          </span>
          <h2>No save files found</h2>
          <p>No Rabi-Ribi save files were found in your save folder.</p>
        </div>
      ) : (
        <>
          <ul
            className="fs-list"
            role="listbox"
            aria-label="Rabi-Ribi save files"
            aria-activedescendant={
              activeSlot !== null ? `file-slot-${activeSlot}` : undefined
            }
            tabIndex={0}
            onKeyDown={handleKeyDown}
          >
            {slots.map((save, index) => {
              const isSelected = save.slot === activeSlot;
              const isLatest = save.slot === latestSlot;
              const relative = formatRelative(save.last_modified);

              return (
                <li
                  key={save.slot}
                  id={`file-slot-${save.slot}`}
                  className={`pixel fs-row ${isSelected ? "selected" : ""} ${
                    save.thumbnailUrl ? "has-thumbnail" : "no-thumbnail"
                  }`}
                  role="option"
                  aria-selected={isSelected}
                  style={{
                    animationDelay: `${Math.min(index, 8) * 45}ms`,
                    cursor: "pointer",
                  }}
                  onClick={() => selectSave(save)}
                >
                  <span className="fs-cursor" aria-hidden="true">
                    <PixelIcon name="cursor" />
                  </span>

                  {save.thumbnailUrl && (
                    <div className="fs-thumb">
                      <img
                        src={save.thumbnailUrl}
                        alt={`Rabi-Ribi Save Slot ${save.slot} thumbnail`}
                      />
                    </div>
                  )}

                  <div className="fs-info">
                    <div className="fs-headline">
                      <h3>Save Slot {save.slot}</h3>
                      {isLatest && <span className="badge">LAST SAVED</span>}
                    </div>

                    <p className="fs-file">File: {save.file_name}</p>

                    <p className="fs-file">
                      Game Mode: <strong>{save.game_mode}</strong>
                    </p>

                    <p className="fs-modified">
                      Last modified: {formatModified(save.last_modified)}
                      {relative && (
                        <span className="fs-relative">{relative}</span>
                      )}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="fs-help">
            <span>
              <kbd>↑</kbd>
              <kbd>↓</kbd> Move cursor
            </span>
            <span>
              <kbd>Home</kbd>
              <kbd>End</kbd> Jump
            </span>
            <span>
              <kbd>Enter</kbd> Open save
            </span>
          </div>
        </>
      )}
    </div>
  );
}

export default FileSelect;
