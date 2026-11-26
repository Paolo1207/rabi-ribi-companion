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
import { PixelIcon } from "./PixelIcon";
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

  const [fit, setFit] = useState(1);

  const viewerRef = useRef<HTMLDivElement | null>(null);
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

  const hasViewer = !selectedRoom && currentArea !== null && areaValues !== null;

  // Presentation only: scale the world image so the whole map fits the viewer
  // by default. "100%" therefore means "fit"; zoom, pan and reset work on top
  // of it. Room coordinates are untouched (hit-testing uses the stage's
  // on-screen rectangle, which already includes this scale).
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!hasViewer || !viewer) return;

    const update = () => {
      const { clientWidth, clientHeight } = viewer;
      if (clientWidth > 0 && clientHeight > 0) {
        setFit(
          Math.min(
            clientWidth / WORLD_IMAGE_WIDTH,
            clientHeight / WORLD_IMAGE_HEIGHT
          )
        );
      }
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(viewer);
    return () => observer.disconnect();
  }, [hasViewer]);

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

  const discoveredByArea = new Map(
    availableAreas.map((entry) => [entry.area, entry.discovered])
  );

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
            <div className="room-preview-header">
              <button
                className="back-button pixel"
                onClick={() => setSelectedRoom(null)}
                type="button"
              >
                <PixelIcon name="arrow-left" />
                <span>BACK TO WORLD MAP</span>
              </button>

              <h3 className="section-title room-preview-title">
                Area {selectedRoom.area} – Room ({selectedRoom.rx},{" "}
                {selectedRoom.ry})
              </h3>
            </div>

            <div className="room-preview-frame">
              {roomHasImage ? (
                <img
                  className="room-preview-image"
                  src={`/maps/rooms/area${selectedRoom.area}/${roomKey}.webp`}
                  alt={`Rabi-Ribi Area ${selectedRoom.area} Room ${selectedRoom.rx}, ${selectedRoom.ry}`}
                />
              ) : (
                <p className="world-map-message">
                  This room has no rendered image.
                </p>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="world-map-toolbar">
              {data && data.areaCount > 0 && (
                <div className="world-map-areas" role="group" aria-label="Areas">
                  {Array.from({ length: data.areaCount }, (_, area) => {
                    const discovered = discoveredByArea.get(area) ?? 0;
                    const locked = discovered === 0;
                    const active = area === currentArea;
                    return (
                      <button
                        key={area}
                        type="button"
                        className={`map-tab${active ? " is-active" : ""}${
                          locked ? " is-locked" : ""
                        }`}
                        onClick={() => setAreaChoice(area)}
                        disabled={locked}
                        aria-pressed={active}
                        title={
                          locked
                            ? "Not explored yet"
                            : `${discovered} rooms discovered`
                        }
                      >
                        Area {area}
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="world-map-zoom" role="group" aria-label="Zoom">
                <button
                  type="button"
                  className="map-tool"
                  onClick={zoomIn}
                  disabled={scale >= 4}
                  title="Zoom in"
                  aria-label="Zoom in"
                >
                  +
                </button>

                <span className="map-zoom-value">
                  {Math.round(scale * 100)}%
                </span>

                <button
                  type="button"
                  className="map-tool"
                  onClick={zoomOut}
                  disabled={scale <= 0.5}
                  title="Zoom out"
                  aria-label="Zoom out"
                >
                  −
                </button>

                <button
                  type="button"
                  className="map-tool map-tool--reset"
                  onClick={resetView}
                  title="Reset map view"
                >
                  Reset
                </button>
              </div>
            </div>

            {loading && (
              <p className="world-map-message">Reading save file…</p>
            )}

            {error && (
              <p className="world-map-message">
                Could not read the exploration data: {error}
              </p>
            )}

            {!loading && !error && data && availableAreas.length === 0 && (
              <p className="world-map-message">
                This save has no discovered rooms yet.
              </p>
            )}

            {currentArea !== null && areaValues && (
              <>
                <div
                  ref={viewerRef}
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
                      width: WORLD_IMAGE_WIDTH,
                      height: WORLD_IMAGE_HEIGHT,
                      transform: `translate(${position.x}px, ${position.y}px) scale(${fit * scale})`,
                    }}
                  >
                    <canvas
                      ref={canvasRef}
                      width={WORLD_IMAGE_WIDTH}
                      height={WORLD_IMAGE_HEIGHT}
                      className="world-map-image"
                    />

                    {hoverRect && (
                      <div
                        className="world-map-hover"
                        style={{
                          left: hoverRect.x,
                          top: hoverRect.y,
                          width: hoverRect.w,
                          height: hoverRect.h,
                        }}
                      />
                    )}
                  </div>
                </div>

                <p className="world-map-hint">
                  Drag to pan · Scroll to zoom · Click a discovered room to open it
                </p>
              </>
            )}
          </>
        )}
      </div>
    </section>
  );
}

export default InteractiveWorldMap;
