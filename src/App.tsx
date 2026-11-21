
import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import FileSelect from "./components/FileSelect";
import { PixelIcon, type PixelIconName } from "./components/PixelIcon";
import "./App.css";

type Page =
  | "Dashboard"
  | "Game Status"
  | "Playthroughs"
  | "Session History"
  | "Notes"
  | "Settings";

type Note = {
  id: string;
  title: string;
  content: string;
  updatedAt: string;
};

type PlaySession = {
  id: string;
  startTime: string;
  endTime: string;
  duration: number;
};

type SaveSlot = {
  slot: number;
  file_name: string;
  last_modified: number;
  thumbnail: number[] | null;
  thumbnailUrl?: string | null;
  game_mode: string;
};

const pageIcons: Record<Page, PixelIconName> = {
  Dashboard: "home",
  "Game Status": "game",
  Playthroughs: "book",
  "Session History": "clock",
  Notes: "note",
  Settings: "settings",
};

const noteTones = ["pink", "lavender", "mint", "butter"] as const;

function formatPlaytime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  return `${hours}h ${String(minutes).padStart(2, "0")}m`;
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatTime(date: string): string {
  return new Date(date).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatMonth(date: string): string {
  return new Date(date).toLocaleDateString(undefined, { month: "short" });
}

function formatDay(date: string): string {
  return String(new Date(date).getDate());
}

function App() {
  const [activePage, setActivePage] = useState<Page>("Dashboard");

    // Rabi-Ribi save slots
  const [saveSlots, setSaveSlots] = useState<SaveSlot[]>([]);
  const [saveLoading, setSaveLoading] = useState(true);
  const [saveError, setSaveError] = useState("");

  // Game detection
  const [gameRunning, setGameRunning] = useState<boolean | null>(null);
  const [detectionError, setDetectionError] = useState(false);

  // Total playtime
  const [totalPlaytime, setTotalPlaytime] = useState<number>(() => {
    const saved = localStorage.getItem("rabi-ribi-playtime");
    return saved ? Number(saved) || 0 : 0;
  });

  const [sessionPlaytime, setSessionPlaytime] = useState(0);

  // Session history
  const [sessions, setSessions] = useState<PlaySession[]>(() => {
    try {
      const saved = localStorage.getItem("rabi-ribi-sessions");
      return saved ? (JSON.parse(saved) as PlaySession[]) : [];
    } catch {
      return [];
    }
  });

  const sessionStartRef = useRef<number | null>(null);
  const [showClearHistory, setShowClearHistory] = useState(false);

  // Notes
  const [notes, setNotes] = useState<Note[]>(() => {
    try {
      const savedNotes = localStorage.getItem("rabi-ribi-notes");
      return savedNotes ? (JSON.parse(savedNotes) as Note[]) : [];
    } catch {
      return [];
    }
  });

  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Note | null>(null);

  // Save notes
  useEffect(() => {
    localStorage.setItem("rabi-ribi-notes", JSON.stringify(notes));
  }, [notes]);

  // Save session history
  useEffect(() => {
    localStorage.setItem("rabi-ribi-sessions", JSON.stringify(sessions));
  }, [sessions]);

  // Detect Rabi-Ribi
  useEffect(() => {
    let isMounted = true;

    const checkGame = async () => {
      try {
        const running = await invoke<boolean>("check_rabi_ribi");

        if (isMounted) {
          setGameRunning(running);
          setDetectionError(false);
        }
      } catch (error) {
        console.error("Game detection failed:", error);

        if (isMounted) {
          setDetectionError(true);
        }
      }
    };

    checkGame();

    const interval = window.setInterval(checkGame, 2000);

    return () => {
      isMounted = false;
      window.clearInterval(interval);
    };
  }, []);

  // Load Rabi-Ribi save slots
useEffect(() => {
  let isMounted = true;
  let imageUrls: string[] = [];

  async function loadSaveSlots() {
    try {
      setSaveLoading(true);
      setSaveError("");

      const saves = await invoke<SaveSlot[]>("get_save_slots");

      const formattedSaves = saves.map((save) => {
        let thumbnailUrl: string | null = null;

        if (save.thumbnail && save.thumbnail.length > 0) {
          const imageBytes = new Uint8Array(save.thumbnail);

          const imageBlob = new Blob([imageBytes], {
            type: "image/bmp",
          });

          thumbnailUrl = URL.createObjectURL(imageBlob);
          imageUrls.push(thumbnailUrl);
        }

        return {
          ...save,
          thumbnailUrl,
        };
      });

      if (isMounted) {
        setSaveSlots(formattedSaves);
      }
    } catch (error) {
      console.error("Save detection failed:", error);

      if (isMounted) {
        setSaveError(String(error));
      }
    } finally {
      if (isMounted) {
        setSaveLoading(false);
      }
    }
  }

  loadSaveSlots();

  return () => {
    isMounted = false;
    imageUrls.forEach((url) => URL.revokeObjectURL(url));
  };
}, []);

  // Track total playtime
  useEffect(() => {
    if (!gameRunning) {
      setSessionPlaytime(0);
      return;
    }

    const interval = window.setInterval(() => {
      setTotalPlaytime((previous) => {
        const updated = previous + 1;
        localStorage.setItem("rabi-ribi-playtime", String(updated));
        return updated;
      });

      setSessionPlaytime((previous) => previous + 1);
    }, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, [gameRunning]);

  // Record a session when the game starts and finishes
  useEffect(() => {
    if (gameRunning === true) {
      if (sessionStartRef.current === null) {
        sessionStartRef.current = Date.now();
      }
      return;
    }

    if (gameRunning === false && sessionStartRef.current !== null) {
      const startTimestamp = sessionStartRef.current;
      const endTimestamp = Date.now();

      const newSession: PlaySession = {
        id: crypto.randomUUID(),
        startTime: new Date(startTimestamp).toISOString(),
        endTime: new Date(endTimestamp).toISOString(),
        duration: Math.max(
          0,
          Math.floor((endTimestamp - startTimestamp) / 1000)
        ),
      };

      setSessions((previous) => [newSession, ...previous]);
      sessionStartRef.current = null;
    }
  }, [gameRunning]);

  const navigation: Page[] = [
    "Dashboard",
    "Game Status",
    "Playthroughs",
    "Session History",
    "Notes",
    "Settings",
  ];

  function resetEditor() {
    setNoteTitle("");
    setNoteContent("");
    setEditingId(null);
  }

  function saveNote() {
    if (!noteTitle.trim() || !noteContent.trim()) {
      window.alert("Please enter both a title and note content.");
      return;
    }

    if (editingId) {
      setNotes((currentNotes) =>
        currentNotes.map((note) =>
          note.id === editingId
            ? {
                ...note,
                title: noteTitle.trim(),
                content: noteContent.trim(),
                updatedAt: new Date().toISOString(),
              }
            : note
        )
      );
    } else {
      const newNote: Note = {
        id: crypto.randomUUID(),
        title: noteTitle.trim(),
        content: noteContent.trim(),
        updatedAt: new Date().toISOString(),
      };

      setNotes((currentNotes) => [newNote, ...currentNotes]);
    }

    resetEditor();
  }

  function editNote(note: Note) {
    setNoteTitle(note.title);
    setNoteContent(note.content);
    setEditingId(note.id);
  }

  function confirmDelete() {
    if (!deleteTarget) return;

    setNotes((currentNotes) =>
      currentNotes.filter((note) => note.id !== deleteTarget.id)
    );

    if (editingId === deleteTarget.id) {
      resetEditor();
    }

    setDeleteTarget(null);
  }

  function clearHistory() {
    setSessions([]);
    setShowClearHistory(false);
  }

  const gameStatusTitle = detectionError
    ? "Detection Error"
    : gameRunning === null
      ? "Checking..."
      : gameRunning
        ? "Running"
        : "Not detected";

  const gameStatusDescription = detectionError
    ? "Unable to check the game."
    : gameRunning === null
      ? "Checking for Rabi-Ribi..."
      : gameRunning
        ? "Rabi-Ribi is currently open!"
        : "Waiting for Rabi-Ribi";

  const recordedSessionTime = sessions.reduce(
    (total, session) => total + session.duration,
    0
  );

  const detectionState = detectionError
    ? "error"
    : gameRunning === null
      ? "checking"
      : gameRunning
        ? "running"
        : "idle";

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="pixel brand-icon" aria-hidden="true">
            <PixelIcon name="bunny" />
          </div>
          <div>
            <h2>Rabi-Ribi</h2>
            <span>COMPANION</span>
          </div>
        </div>

        <div className="nav-label">MENU</div>

        <nav aria-label="Main">
          {navigation.map((page) => (
            <button
              key={page}
              className={`nav-button ${activePage === page ? "active" : ""}`}
              onClick={() => setActivePage(page)}
              title={page}
              aria-current={activePage === page ? "page" : undefined}
            >
              <PixelIcon name={pageIcons[page]} />
              <span>{page}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="status-dot" />
          Companion v0.1.0
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <span>Rabi-Ribi Companion / {activePage}</span>
          <div
            className="pixel topbar-status"
            data-state={detectionState}
            role="status"
          >
            <div className="status-dot" />
            Game: {gameStatusTitle}
          </div>
        </header>

        {/* DASHBOARD */}
        {activePage === "Dashboard" && (
          <section className="page">
            <div className="pixel welcome">
              <div>
                <span className="eyebrow">YOUR ADVENTURE STARTS HERE</span>
                <h1>Welcome, Adventurer!</h1>
                <p>
                  Your personal companion for your{" "}
                  <span className="nowrap">Rabi-Ribi</span> journey.
                </p>
              </div>

              <div className="rabbit-mascot" aria-hidden="true">
                <div className="rabbit-ear rabbit-ear-left">
                  <div className="rabbit-ear-inner" />
                </div>
                <div className="rabbit-ear rabbit-ear-right">
                  <div className="rabbit-ear-inner" />
                </div>

                <div className="rabbit-head">
                  <span className="rabbit-eye rabbit-eye-left" />
                  <span className="rabbit-eye rabbit-eye-right" />
                  <span className="rabbit-cheek rabbit-cheek-left" />
                  <span className="rabbit-cheek rabbit-cheek-right" />
                  <span className="rabbit-nose" />
                </div>
              </div>

              <div className="welcome-decoration" aria-hidden="true">
                <PixelIcon name="heart" />
              </div>
            </div>

            <h2 className="section-title">Adventure Overview</h2>

            <div className="stats-grid">
              <div className="pixel stat-card tone-mint">
                <span className="stat-icon">
                  <PixelIcon name="game" />
                </span>
                <p>GAME STATUS</p>
                <h2>{gameStatusTitle}</h2>
                <span>{gameStatusDescription}</span>
              </div>

              <div className="pixel stat-card tone-lavender">
                <span className="stat-icon">
                  <PixelIcon name="clock" />
                </span>
                <p>TOTAL PLAYTIME</p>
                <h2>{formatPlaytime(totalPlaytime)}</h2>
                <span>
                  {gameRunning
                    ? `Current session: ${formatPlaytime(sessionPlaytime)}`
                    : "Your recorded game time"}
                </span>
              </div>

              <div className="pixel stat-card tone-butter">
                <span className="stat-icon">
                  <PixelIcon name="star" />
                </span>
                <p>PERSONAL NOTES</p>
                <h2>{notes.length}</h2>
                <span>Your saved discoveries</span>
              </div>
            </div>

            <h2 className="section-title">Quick Access</h2>

            <div className="quick-grid">
              <button
                className="pixel quick-tile tone-mint"
                onClick={() => setActivePage("Game Status")}
              >
                <span className="stat-icon">
                  <PixelIcon name="game" />
                </span>
                <strong>Game Status</strong>
                <small>Check your game detection</small>
              </button>

              <button
                className="pixel quick-tile tone-pink"
                onClick={() => setActivePage("Playthroughs")}
              >
                <span className="stat-icon">
                  <PixelIcon name="book" />
                </span>
                <strong>Playthroughs</strong>
                <small>Manage your adventures</small>
              </button>

              <button
                className="pixel quick-tile tone-lavender"
                onClick={() => setActivePage("Session History")}
              >
                <span className="stat-icon">
                  <PixelIcon name="clock" />
                </span>
                <strong>Session History</strong>
                <small>Review your gaming sessions</small>
              </button>

              <button
                className="pixel quick-tile tone-butter"
                onClick={() => setActivePage("Notes")}
              >
                <span className="stat-icon">
                  <PixelIcon name="note" />
                </span>
                <strong>Personal Notes</strong>
                <small>Keep track of discoveries</small>
              </button>
            </div>
          </section>
        )}

        {/* GAME STATUS */}
        {activePage === "Game Status" && (
          <section className="page">
            <span className="eyebrow">GAME MONITOR</span>
            <h1>Game Status</h1>

            <div className="pixel status-panel" data-state={detectionState}>
              <div className="status-orb" aria-hidden="true">
                {detectionError ? "!" : <PixelIcon name="game" />}
              </div>

              <div className="status-body">
                <h2>
                  {detectionError
                    ? "Detection Error"
                    : gameRunning === null
                      ? "Checking Rabi-Ribi..."
                      : gameRunning
                        ? "Rabi-Ribi is running!"
                        : "Rabi-Ribi is not running"}
                </h2>

                <p>
                  {detectionError
                    ? "The companion could not communicate with the game detection command."
                    : gameRunning
                      ? "Your game has been detected. Enjoy your adventure!"
                      : "Launch Rabi-Ribi through Steam or its executable. The companion will detect it automatically."}
                </p>

                <dl className="status-facts">
                  <div>
                    <dt>Detection</dt>
                    <dd>Checks every 2 seconds</dd>
                  </div>
                  <div>
                    <dt>Total recorded playtime</dt>
                    <dd>{formatPlaytime(totalPlaytime)}</dd>
                  </div>
                  {gameRunning && (
                    <div>
                      <dt>Current session</dt>
                      <dd>{formatPlaytime(sessionPlaytime)}</dd>
                    </div>
                  )}
                </dl>
              </div>
            </div>
          </section>
        )}

        {/* PLAYTHROUGHS */}
        {activePage === "Playthroughs" && (
          <section className="page">
            <span className="eyebrow">YOUR ADVENTURES</span>
            <h1>Playthroughs</h1>

            <p className="notes-description">
              View your Rabi-Ribi save files and their saved thumbnails.
            </p>

            <FileSelect
              slots={saveSlots}
              loading={saveLoading}
              error={saveError}
            />
          </section>
        )}

        {/* SESSION HISTORY */}
        {activePage === "Session History" && (
          <section className="page">
            <span className="eyebrow">YOUR GAMING ACTIVITY</span>
            <h1>Session History</h1>
            <p className="notes-description">
              Review your previous Rabi-Ribi gaming sessions.
            </p>

            <div className="stats-grid">
              <div className="pixel stat-card tone-lavender">
                <span className="stat-icon">
                  <PixelIcon name="clock" />
                </span>
                <p>RECORDED SESSIONS</p>
                <h2>{sessions.length}</h2>
                <span>Completed gaming sessions</span>
              </div>

              <div className="pixel stat-card tone-mint">
                <span className="stat-icon">
                  <PixelIcon name="hourglass" />
                </span>
                <p>RECORDED SESSION TIME</p>
                <h2>{formatPlaytime(recordedSessionTime)}</h2>
                <span>Time from saved session records</span>
              </div>
            </div>

            <div className="section-title">
              <h2>Recent Sessions</h2>
            </div>

            {sessions.length === 0 ? (
              <div className="pixel stat-card empty-notes tone-lavender">
                <span className="stat-icon">
                  <PixelIcon name="clock" />
                </span>
                <h2>No sessions recorded yet</h2>
                <p>
                  Open Rabi-Ribi and play. Your session will appear here after
                  you close the game.
                </p>
              </div>
            ) : (
              <>
                <ul className="session-list">
                  {sessions.map((session) => (
                    <li className="pixel session-row" key={session.id}>
                      <div className="session-date" aria-hidden="true">
                        <span>{formatMonth(session.startTime)}</span>
                        <strong>{formatDay(session.startTime)}</strong>
                      </div>

                      <div className="session-main">
                        <h3>{formatDate(session.startTime)}</h3>
                        <p>
                          Start: {formatTime(session.startTime)} · End:{" "}
                          {formatTime(session.endTime)}
                        </p>
                        <small>Completed session</small>
                      </div>

                      <strong className="session-duration">
                        Duration: {formatPlaytime(session.duration)}
                      </strong>
                    </li>
                  ))}
                </ul>

                <div className="note-actions session-actions">
                  <button
                    className="clear-history-button"
                    onClick={() => setShowClearHistory(true)}
                  >
                    Clear History
                  </button>
                </div>
              </>
            )}
          </section>
        )}

        {/* NOTES */}
        {activePage === "Notes" && (
          <section className="page">
            <span className="eyebrow">YOUR JOURNAL</span>
            <h1>Personal Notes</h1>
            <p className="notes-description">
              Keep track of boss strategies, discoveries and reminders.
            </p>

            {!editingId && (
              <div className="pixel note-editor">
                <h2>Create a New Note</h2>

                <label htmlFor="note-title">Note Title</label>
                <input
                  id="note-title"
                  className="note-input"
                  value={noteTitle}
                  onChange={(event) => setNoteTitle(event.target.value)}
                  placeholder="Example: Rita boss strategy"
                  maxLength={100}
                />

                <label htmlFor="note-content">Note Content</label>
                <textarea
                  id="note-content"
                  className="note-textarea"
                  value={noteContent}
                  onChange={(event) => setNoteContent(event.target.value)}
                  placeholder="Write down your discoveries..."
                  rows={5}
                  maxLength={10000}
                />

                <div className="note-actions">
                  <button className="save-note-button" onClick={saveNote}>
                    Save Note
                  </button>
                </div>
              </div>
            )}

            <h2 className="section-title">Saved Notes ({notes.length})</h2>

            {notes.length === 0 ? (
              <div className="pixel stat-card empty-notes tone-pink">
                <span className="stat-icon">
                  <PixelIcon name="note" />
                </span>
                <h2>No notes yet</h2>
                <p>Your first adventure note will appear here.</p>
              </div>
            ) : (
              <div className="notes-grid">
                {notes.map((note, index) => (
                  <article
                    className={`pixel note-card tone-${noteTones[index % noteTones.length]}`}
                    key={note.id}
                  >
                    <h3>{note.title}</h3>
                    <p className="note-card-content">{note.content}</p>

                    <small>
                      Updated: {new Date(note.updatedAt).toLocaleString()}
                    </small>

                    <div className="note-card-actions">
                      <button onClick={() => editNote(note)}>Edit</button>
                      <button
                        className="delete-note-button"
                        onClick={() => setDeleteTarget(note)}
                      >
                        Delete
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {/* SETTINGS */}
        {activePage === "Settings" && (
          <section className="page">
            <span className="eyebrow">APPLICATION</span>
            <h1>Settings</h1>
            <div className="pixel about-card">
              <div className="about-logo" aria-hidden="true">
                <PixelIcon name="bunny" />
              </div>
              <div>
                <h2>Rabi-Ribi Companion</h2>
                <p>Version 0.1.0</p>
                <p>Windows Desktop Application</p>
                <p>Built with Tauri, React, TypeScript and Rust.</p>
              </div>
            </div>
          </section>
        )}

        <footer className="footer">
          Rabi-Ribi Companion · Made for your adventure ♡
        </footer>
      </main>

      {/* EDIT NOTE MODAL */}
      {editingId && (
        <div className="modal-backdrop" onClick={resetEditor}>
          <div
            className="pixel modal-window edit-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-heading">
              <span className="modal-icon">
                <PixelIcon name="note" />
              </span>
              <div>
                <h2>Edit Note</h2>
                <p>Make changes to your adventure journal.</p>
              </div>
              <button
                className="modal-close"
                onClick={resetEditor}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <label htmlFor="edit-note-title">Note Title</label>
            <input
              id="edit-note-title"
              className="note-input"
              value={noteTitle}
              onChange={(event) => setNoteTitle(event.target.value)}
              maxLength={100}
            />

            <label htmlFor="edit-note-content">Note Content</label>
            <textarea
              id="edit-note-content"
              className="note-textarea"
              value={noteContent}
              onChange={(event) => setNoteContent(event.target.value)}
              rows={7}
              maxLength={10000}
            />

            <div className="modal-actions">
              <button className="cancel-note-button" onClick={resetEditor}>
                Cancel
              </button>
              <button className="save-note-button" onClick={saveNote}>
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE NOTE CONFIRMATION */}
      {deleteTarget && (
        <div className="modal-backdrop" onClick={() => setDeleteTarget(null)}>
          <div
            className="pixel modal-window delete-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="delete-icon">!</div>
            <h2>Delete this note?</h2>
            <p>
              Are you sure you want to delete
              <strong> "{deleteTarget.title}"</strong>?
              This action cannot be undone.
            </p>

            <div className="modal-actions">
              <button
                className="cancel-note-button"
                onClick={() => setDeleteTarget(null)}
              >
                Cancel
              </button>
              <button
                className="confirm-delete-button"
                onClick={confirmDelete}
              >
                Delete Note
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CLEAR HISTORY CONFIRMATION */}
      {showClearHistory && (
        <div
          className="modal-backdrop"
          onClick={() => setShowClearHistory(false)}
        >
          <div
            className="pixel modal-window delete-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="delete-icon">!</div>
            <h2>Clear session history?</h2>
            <p>
              Are you sure you want to delete all recorded gaming sessions?
              Your Total Playtime will not be affected.
            </p>

            <div className="modal-actions">
              <button
                className="cancel-note-button"
                onClick={() => setShowClearHistory(false)}
              >
                Cancel
              </button>
              <button
                className="confirm-delete-button"
                onClick={clearHistory}
              >
                Clear History
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
