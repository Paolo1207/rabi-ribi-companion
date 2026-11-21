
import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
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
};

type IconName =
  | "home"
  | "game"
  | "book"
  | "note"
  | "settings"
  | "sparkles"
  | "clock";

function AppIcon({ name }: { name: IconName }) {
  return (
    <svg
      className="app-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {name === "home" && (
        <>
          <path d="m3 10 9-7 9 7" />
          <path d="M5 9v12h14V9" />
          <path d="M9 21v-7h6v7" />
        </>
      )}

      {name === "game" && (
        <>
          <rect x="3" y="6" width="18" height="13" rx="4" />
          <path d="M8 10v5M5.5 12.5h5" />
          <circle cx="16" cy="11" r="1" />
          <circle cx="18.5" cy="14" r="1" />
        </>
      )}

      {name === "book" && (
        <>
          <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v17H6.5A2.5 2.5 0 0 0 4 22z" />
          <path d="M4 5.5v14A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M9 7h7M9 11h7" />
        </>
      )}

      {name === "note" && (
        <>
          <path d="M7 3h8l5 5v13H7a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3z" />
          <path d="M15 3v6h5M8 13h8M8 17h6" />
        </>
      )}

      {name === "settings" && (
        <>
          <circle cx="12" cy="12" r="3" />
          <path
            d="m19.4 15 .1.1 1.2 1-1.5 2.6-1.5-.6a8 8 0 0 1-1.7 1l-.3 1.6h-3l-.3-1.6a8 8 0 0 1-1.7-1l-1.5.6-1.5-2.6 1.3-1a8 8 0 0 1 0-2l-1.3-1 1.5-2.6 1.5.6a8 8 0 0 1 1.7-1l.3-1.6h3l.3 1.6a8 8 0 0 1 1.7 1l1.5-.6 1.5 2.6-1.3 1a8 8 0 0 1 0 2z"
            transform="translate(-1 -1)"
          />
        </>
      )}

      {name === "sparkles" && (
        <>
          <path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />
          <path d="m19 15 .9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z" />
          <path d="m5 2 .7 1.8L7.5 4.5l-1.8.7L5 7l-.7-1.8-1.8-.7 1.8-.7z" />
        </>
      )}

      {name === "clock" && (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </>
      )}
    </svg>
  );
}

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

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">R</div>
          <div>
            <h2>Rabi-Ribi</h2>
            <span>COMPANION</span>
          </div>
        </div>

        <div className="nav-label">MENU</div>

        <nav>
          {navigation.map((page) => (
            <button
              key={page}
              className={`nav-button ${activePage === page ? "active" : ""}`}
              onClick={() => setActivePage(page)}
            >
              <AppIcon
                name={
                  page === "Dashboard"
                    ? "home"
                    : page === "Game Status"
                      ? "game"
                      : page === "Playthroughs"
                        ? "book"
                        : page === "Session History"
                          ? "clock"
                          : page === "Notes"
                            ? "note"
                            : "settings"
                }
              />
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
          <div className="topbar-status">
            <div className="status-dot" />
            Offline
          </div>
        </header>

        {/* DASHBOARD */}
        {activePage === "Dashboard" && (
          <section className="page">
            <div className="welcome">
              <div>
                <span className="eyebrow">YOUR ADVENTURE STARTS HERE</span>
                <h1>Welcome, Adventurer!</h1>
                <p>Your personal companion for your Rabi-Ribi journey.</p>
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

              <div className="welcome-decoration">♡</div>
            </div>

            <h2 className="section-title">Adventure Overview</h2>

            <div className="stats-grid">
              <div className="stat-card">
                <span className="stat-icon">◈</span>
                <p>GAME STATUS</p>
                <h2>{gameStatusTitle}</h2>
                <span>{gameStatusDescription}</span>
              </div>

              <div className="stat-card">
                <span className="stat-icon">◷</span>
                <p>TOTAL PLAYTIME</p>
                <h2>{formatPlaytime(totalPlaytime)}</h2>
                <span>
                  {gameRunning
                    ? `Current session: ${formatPlaytime(sessionPlaytime)}`
                    : "Your recorded game time"}
                </span>
              </div>

              <div className="stat-card">
                <span className="stat-icon">✧</span>
                <p>PERSONAL NOTES</p>
                <h2>{notes.length}</h2>
                <span>Your saved discoveries</span>
              </div>
            </div>

            <h2 className="section-title">Quick Access</h2>

            <div className="quick-grid">
              <button onClick={() => setActivePage("Game Status")}>
                <span>◈</span>
                <strong>Game Status</strong>
                <small>Check your game detection</small>
              </button>

              <button onClick={() => setActivePage("Playthroughs")}>
                <span>▤</span>
                <strong>Playthroughs</strong>
                <small>Manage your adventures</small>
              </button>

              <button onClick={() => setActivePage("Session History")}>
                <span>◷</span>
                <strong>Session History</strong>
                <small>Review your gaming sessions</small>
              </button>

              <button onClick={() => setActivePage("Notes")}>
                <span>✎</span>
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

            <div className="stat-card large-card">
              <span className="stat-icon">◈</span>

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

              <p>Detection checks every 2 seconds.</p>
              <p>Total recorded playtime: {formatPlaytime(totalPlaytime)}</p>

              {gameRunning && (
                <p>Current session: {formatPlaytime(sessionPlaytime)}</p>
              )}
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

    {saveLoading ? (
      <div className="stat-card large-card">
        <h2>Checking save files...</h2>
        <p>Looking inside your Rabi-Ribi save folder.</p>
      </div>
    ) : saveError ? (
      <div className="stat-card large-card">
        <h2>Unable to load save files</h2>
        <p>{saveError}</p>
      </div>
    ) : saveSlots.length === 0 ? (
      <div className="stat-card large-card">
        <h2>No save files found</h2>
        <p>
          No Rabi-Ribi save files were found in your save folder.
        </p>
      </div>
    ) : (
      <>
        <div className="stats-grid">
          <div className="stat-card">
            <span className="stat-icon">▤</span>
            <p>DETECTED SAVE SLOTS</p>
            <h2>{saveSlots.length}</h2>
            <span>Available save files</span>
          </div>
        </div>

        <h2 className="section-title">Your Saved Adventures</h2>

        <div className="notes-grid">
          {saveSlots.map((save) => {
            const latestSave = saveSlots.reduce(
              (latest, current) =>
                current.last_modified > latest.last_modified
                  ? current
                  : latest,
              saveSlots[0]
            );

            const isLatest = save.slot === latestSave.slot;

            return (
              <article className="note-card" key={save.slot}>
                {save.thumbnailUrl ? (
                  <img
                    src={save.thumbnailUrl}
                    alt={`Rabi-Ribi Save Slot ${save.slot} thumbnail`}
                    style={{
                      width: "100%",
                      aspectRatio: "16 / 9",
                      objectFit: "contain",
                      borderRadius: "12px",
                      background: "#f5edf4",
                      marginBottom: "15px",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: "100%",
                      aspectRatio: "16 / 9",
                      borderRadius: "12px",
                      background: "#f5edf4",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      marginBottom: "15px",
                      color: "#a58a9e",
                    }}
                  >
                    No thumbnail available
                  </div>
                )}

                <h3>Save Slot {save.slot}</h3>

                {isLatest && (
                  <span className="eyebrow">LAST SAVED</span>
                )}

                <p className="note-card-content">
                  File: {save.file_name}
                </p>

                <small>
                  Last modified:{" "}
                  {save.last_modified > 0
                    ? new Date(
                        save.last_modified * 1000
                      ).toLocaleString()
                    : "Unknown"}
                </small>
              </article>
            );
          })}
        </div>
      </>
    )}
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
              <div className="stat-card">
                <span className="stat-icon">◷</span>
                <p>RECORDED SESSIONS</p>
                <h2>{sessions.length}</h2>
                <span>Completed gaming sessions</span>
              </div>

              <div className="stat-card">
                <span className="stat-icon">⌛</span>
                <p>RECORDED SESSION TIME</p>
                <h2>{formatPlaytime(recordedSessionTime)}</h2>
                <span>Time from saved session records</span>
              </div>
            </div>

            <div className="section-title">
              <h2>Recent Sessions</h2>
            </div>

            {sessions.length === 0 ? (
              <div className="stat-card empty-notes">
                <span className="stat-icon">◷</span>
                <h2>No sessions recorded yet</h2>
                <p>
                  Open Rabi-Ribi and play. Your session will appear here after
                  you close the game.
                </p>
              </div>
            ) : (
              <>
                <div className="notes-grid">
                  {sessions.map((session) => (
                    <article className="note-card" key={session.id}>
                      <h3>{formatDate(session.startTime)}</h3>

                      <p className="note-card-content">
                        Start: {formatTime(session.startTime)}
                        {"\n"}
                        End: {formatTime(session.endTime)}
                      </p>

                      <strong>
                        Duration: {formatPlaytime(session.duration)}
                      </strong>

                      <small>Completed session</small>
                    </article>
                  ))}
                </div>

             
                <div className="note-actions">
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
              <div className="note-editor">
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
              <div className="stat-card empty-notes">
                <span className="stat-icon">✎</span>
                <h2>No notes yet</h2>
                <p>Your first adventure note will appear here.</p>
              </div>
            ) : (
              <div className="notes-grid">
                {notes.map((note) => (
                  <article className="note-card" key={note.id}>
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
            <div className="stat-card large-card">
              <h2>Rabi-Ribi Companion</h2>
              <p>Version 0.1.0</p>
              <p>Windows Desktop Application</p>
              <p>Built with Tauri, React, TypeScript and Rust.</p>
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
            className="modal-window edit-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-heading">
              <span className="modal-icon">✎</span>
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
            className="modal-window delete-modal"
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
            className="modal-window delete-modal"
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
