import { useState } from "react";
import { PixelIcon, type PixelIconName } from "./PixelIcon";

type CharacterStatusCardProps = {
  tone: "lavender" | "pink";
  /** Character name shown on the tag, e.g. "Erina". */
  name: string;
  /** Stat label, e.g. "HEALTH (HP)". */
  label: string;
  /** The stored value, or null when the save has none. */
  value: number | null;
  caption: string;
  /** Portrait image under /public. It is optional: if the file is missing
      the card shows `fallbackIcon` instead. */
  portrait: string;
  fallbackIcon: PixelIconName;
};

const SEGMENTS = 20;

export default function CharacterStatusCard({
  tone,
  name,
  label,
  value,
  caption,
  portrait,
  fallbackIcon,
}: CharacterStatusCardProps) {
  const [portraitFailed, setPortraitFailed] = useState(false);
  const hasValue = value !== null;

  return (
    <div className={`pixel status-card status-card--${tone}`}>
      <div className="status-card__head">
        <span className="status-card__portrait">
          {portraitFailed ? (
            <PixelIcon name={fallbackIcon} />
          ) : (
            <img
              src={portrait}
              alt=""
              draggable={false}
              onError={() => setPortraitFailed(true)}
            />
          )}
        </span>

        <div className="status-card__names">
          <span className="status-card__name">{name.toUpperCase()}</span>
          <p className="status-card__label">{label}</p>
        </div>
      </div>

      <p className={`status-card__value${hasValue ? "" : " is-empty"}`}>
        {hasValue ? value : "Unknown"}
      </p>

      {/* The save stores a single value (no current / max pair), so the bar
          is full when a value exists and empty when it does not. */}
      <div
        className="status-card__bar"
        role="img"
        aria-label={hasValue ? `${label} bar, full` : `${label} bar, empty`}
      >
        {Array.from({ length: SEGMENTS }, (_, index) => (
          <span key={index} className={hasValue ? "is-on" : undefined} />
        ))}
      </div>

      <span className="status-card__caption">{caption}</span>
    </div>
  );
}
