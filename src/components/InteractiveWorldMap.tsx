
import { useRef, useState } from "react";

type InteractiveWorldMapProps = {
  savePath: string;
};

function InteractiveWorldMap(_props: InteractiveWorldMapProps) {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const dragRef = useRef<{
    pointerX: number;
    pointerY: number;
    startX: number;
    startY: number;
  } | null>(null);

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

  const handlePointerDown = (
    event: React.PointerEvent<HTMLDivElement>
  ) => {
    if (event.button !== 0) return;

    event.currentTarget.setPointerCapture(event.pointerId);

    dragRef.current = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      startX: position.x,
      startY: position.y,
    };
  };

  const handlePointerMove = (
    event: React.PointerEvent<HTMLDivElement>
  ) => {
    if (!dragRef.current) return;

    setPosition({
      x:
        dragRef.current.startX +
        event.clientX -
        dragRef.current.pointerX,
      y:
        dragRef.current.startY +
        event.clientY -
        dragRef.current.pointerY,
    });
  };

  const handlePointerUp = () => {
    dragRef.current = null;
  };

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();

    setScale((current) => {
      const change = event.deltaY < 0 ? 0.1 : -0.1;
      return Math.min(4, Math.max(0.5, current + change));
    });
  };

  return (
    <section className="world-map-section">
      <div className="world-map-heading">
        <span className="eyebrow">EXPLORE YOUR ADVENTURE</span>
        <h2>Interactive World Map</h2>
        <p>
          View your explored and unexplored areas in Rabi-Ribi.
        </p>
      </div>

      <div className="pixel world-map-container">
        <div className="world-map-toolbar">
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

        <div
          className="world-map-viewer"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onWheel={handleWheel}
        >
          <div
            className="world-map-stage"
            style={{
              transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            }}
          >
            <img
              src="/maps/area0.png"
              alt="Rabi-Ribi Area 0 Map"
              className="world-map-image"
              draggable={false}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

export default InteractiveWorldMap;
