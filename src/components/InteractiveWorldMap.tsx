import { useEffect, useMemo, useRef, useState } from "react";
import {
  WORLD_IMAGE_HEIGHT,
  WORLD_IMAGE_WIDTH,
  ROOMS_X,
  ROOMS_Y,
  isDiscovered,
  roomAt,
  roomIndex,
  roomRect,
  type RoomId,
} from "./roomGrid";
import { useExploration } from "./useExploration";

type InteractiveWorldMapProps = {
  savePath: string;
};

type SelectedRoom = { area: number; rx: number; ry: number };

/** Pointer travel (px) below which a press counts as a click, not a pan. */
const CLICK_TOLERANCE = 4;

function InteractiveWorldMap({ savePath }: InteractiveWorldMapProps) {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [selectedRoom, setSelectedRoom] = useState<SelectedRoom | null>(null);
  const [areaChoice, setAreaChoice] = useState<number | null>(null);
  const [hoveredRoom, setHoveredRoom] = useState<RoomId | null>(null);
  const [roomImages, setRoomImages] = useState<Record<string, string[]> | null>(
    null
  );

  const stageRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const movedRef = useRef(false);

  const dragRef = useRef<{
    pointerX: number;
    pointerY: number;
    startX: number;
    startY: number;
  } | null>(null);

  const { data, loading, error } = useExploration(savePath);

  // Only areas with at least one discovered room are offered.
  const availableAreas = useMemo(() => {
    if (!data) return [];
    return data.areas
      .map((values, area) => ({
        area,
        discovered: values.filter((value) => isDiscovered(value)).length,
      }))
      .filter((entry) => entry.discovered > 0);
  }, [data]);

  // Current area: the user's choice if still available, else the first one.
  const currentArea =
    areaChoice !== null && availableAreas.some((a) => a.area === areaChoice)
      ? areaChoice
      : (availableAreas[0]?.area ?? null);

  const areaValues =
    data && currentArea !== null ? data.areas[currentArea] : null;

  // A different save slot means a different map: leave any open room.
  useEffect(() => {
    setSelectedRoom(null);
    setAreaChoice(null);
    setHoveredRoom(null);
  }, [savePath]);

  // Which rooms have a rendered image (generated from the *_test.png renders).
  useEffect(() => {
    let cancelled = false;
    fetch("/maps/rooms/manifest.json")
      .then((response) => (response.ok ? response.json() : null))
      .then((json: Record<string, string[]> | null) => {
        if (!cancelled) setRoomImages(json);
      })
      .catch(() => {
        if (!cancelled) setRoomImages(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Fog of war: draw ONLY discovered rooms. Undiscovered rooms stay black and
  // their pixels are never copied to the visible canvas.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || currentArea === null || !areaValues || selectedRoom) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    let cancelled = false;
    const image = new Image();

    image.onload = () => {
      if (cancelled) return;
      context.imageSmoothingEnabled = false;
      context.fillStyle = "#000";
      context.fillRect(0, 0, WORLD_IMAGE_WIDTH, WORLD_IMAGE_HEIGHT);

      for (let rx = 0; rx < ROOMS_X; rx++) {
        for (let ry = 0; ry < ROOMS_Y; ry++) {
          if (!isDiscovered(areaValues[roomIndex(rx, ry)])) continue;
          const { x, y, w, h } = roomRect(rx, ry);
          context.drawImage(image, x, y, w, h, x, y, w, h);
        }
      }
    };

    image.src = `/maps/area${currentArea}.png`;

    return () => {
      cancelled = true;
    };
  }, [currentArea, areaValues, selectedRoom]);

  const zoomIn = () => {
    setScale((current) => Math.min(current + 0.25, 4));
  };

  const zoomOut = () => {
    setScale((current) => Math.max(current - 0.25, 0.5));
  };

  const resetView = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  /** Room under a pointer position, from the stage's on-screen rectangle. */
  const roomFromPointer = (clientX: number, clientY: number): RoomId | null => {
    const stage = stageRef.current;
    if (!stage) return null;
    const rect = stage.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    const x = ((clientX - rect.left) / rect.width) * WORLD_IMAGE_WIDTH;
    const y = ((clientY - rect.top) / rect.height) * WORLD_IMAGE_HEIGHT;
    return roomAt(x, y);
  };

  const discoveredRoomAt = (clientX: number, clientY: number): RoomId | null => {
    const room = roomFromPointer(clientX, clientY);
    if (!room || !areaValues) return null;
    return isDiscovered(areaValues[roomIndex(room.rx, room.ry)]) ? room : null;
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    movedRef.current = false;

    dragRef.current = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      startX: position.x,
      startY: position.y,
    };
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) {
      // Not dragging: highlight the discovered room under the pointer.
      const room = discoveredRoomAt(event.clientX, event.clientY);
      setHoveredRoom((current) =>
        current?.rx === room?.rx && current?.ry === room?.ry ? current : room
      );
      return;
    }

    const dx = event.clientX - dragRef.current.pointerX;
    const dy = event.clientY - dragRef.current.pointerY;
    if (Math.abs(dx) > CLICK_TOLERANCE || Math.abs(dy) > CLICK_TOLERANCE) {
      movedRef.current = true;
    }

    setPosition({
      x: dragRef.current.startX + dx,
      y: dragRef.current.startY + dy,
    });
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const wasDragging = dragRef.current !== null;
    dragRef.current = null;

    // A press that did not travel is a click: open the room if discovered.
    if (wasDragging && !movedRef.current && currentArea !== null) {
      const room = discoveredRoomAt(event.clientX, event.clientY);
      if (room) {
        setSelectedRoom({ area: currentArea, rx: room.rx, ry: room.ry });
      }
    }
  };

  const handlePointerCancel = () => {
    dragRef.current = null;
  };

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();

    setScale((current) => {
      const change = event.deltaY < 0 ? 0.1 : -0.1;
      return Math.min(4, Math.max(0.5, current + change));
    });
  };

  const roomKey = selectedRoom ? `${selectedRoom.rx}_${selectedRoom.ry}` : "";
  const roomHasImage =
    selectedRoom !== null &&
    roomImages !== null &&
    (roomImages[String(selectedRoom.area)] ?? []).includes(roomKey);

  const hoverRect = hoveredRoom ? roomRect(hoveredRoom.rx, hoveredRoom.ry) : null;

  return (
    <section className="world-map-section">
      <div className="world-map-heading">
        <span className="eyebrow">EXPLORE YOUR ADVENTURE</span>
        <h2>Interactive World Map</h2>
        <p>View your explored and unexplored areas in Rabi-Ribi.</p>
      </div>

      <div className="pixel world-map-container">
        {selectedRoom ? (
          <div className="room-preview">
            <button onClick={() => setSelectedRoom(null)}>
              ← Back to World Map
            </button>

            <h3>
              Area {selectedRoom.area} - Room ({selectedRoom.rx},{" "}
              {selectedRoom.ry})
            </h3>

            {roomHasImage ? (
              <img
                src={`/maps/rooms/area${selectedRoom.area}/${roomKey}.webp`}
                alt={`Rabi-Ribi Area ${selectedRoom.area} Room ${selectedRoom.rx}, ${selectedRoom.ry}`}
                style={{
                  display: "block",
                  width: "100%",
                  maxWidth: "960px",
                  height: "auto",
                  margin: "20px auto",
                  imageRendering: "pixelated",
                }}
              />
            ) : (
              <p style={{ margin: "20px" }}>
                This room has no rendered image.
              </p>
            )}
          </div>
        ) : (
          <>
            <div className="world-map-toolbar">
              {availableAreas.length > 1 &&
                availableAreas.map((entry) => (
                  <button
                    key={entry.area}
                    onClick={() => setAreaChoice(entry.area)}
                    title={`${entry.discovered} rooms discovered`}
                    style={{
                      opacity: entry.area === currentArea ? 1 : 0.6,
                    }}
                  >
                    Area {entry.area}
                  </button>
                ))}

              <button onClick={zoomIn} title="Zoom in">
                +
              </button>

              <span>{Math.round(scale * 100)}%</span>

              <button onClick={zoomOut} title="Zoom out">
                −
              </button>

              <button onClick={resetView} title="Reset map view">
                Reset
              </button>
            </div>

            {loading && <p style={{ margin: "20px" }}>Reading save file…</p>}

            {error && (
              <p style={{ margin: "20px" }}>
                Could not read the exploration data: {error}
              </p>
            )}

            {!loading && !error && data && availableAreas.length === 0 && (
              <p style={{ margin: "20px" }}>
                This save has no discovered rooms yet.
              </p>
            )}

            {currentArea !== null && areaValues && (
              <div
                className="world-map-viewer"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerCancel}
                onPointerLeave={() => setHoveredRoom(null)}
                onWheel={handleWheel}
              >
                <div
                  ref={stageRef}
                  className="world-map-stage"
                  style={{
                    position: "relative",
                    width: WORLD_IMAGE_WIDTH,
                    height: WORLD_IMAGE_HEIGHT,
                    transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                  }}
                >
                  <canvas
                    ref={canvasRef}
                    width={WORLD_IMAGE_WIDTH}
                    height={WORLD_IMAGE_HEIGHT}
                    className="world-map-image"
                    style={{
                      display: "block",
                      width: WORLD_IMAGE_WIDTH,
                      height: WORLD_IMAGE_HEIGHT,
                      imageRendering: "pixelated",
                    }}
                  />

                  {hoverRect && (
                    <div
                      style={{
                        position: "absolute",
                        left: hoverRect.x,
                        top: hoverRect.y,
                        width: hoverRect.w,
                        height: hoverRect.h,
                        boxSizing: "border-box",
                        background: "rgba(255, 215, 0, 0.25)",
                        border: "2px solid gold",
                        pointerEvents: "none",
                        zIndex: 2,
                      }}
                    />
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

export default InteractiveWorldMap;
