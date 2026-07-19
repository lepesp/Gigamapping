import { useState, useRef } from "react";
import useGigaStore from "../store/useGigaStore";

// Kartets formål. Legges øverst i AI-eksporten, slik at agenten leser
// resten av kartet i lys av hva det faktisk er til for — i stedet for
// å måtte gjette intensjonen ut fra strukturen alene.
export default function MapInfoModal({ onClose, readOnly = false }) {
  const currentMapId = useGigaStore((s) => s.currentMapId);
  const currentMap = useGigaStore((s) =>
    s.maps.find((m) => m.id === s.currentMapId)
  );
  const updateMapMeta = useGigaStore((s) => s.updateMapMeta);

  // Kladd som seedes én gang. Ingen synk-effekt, så teksten kan ikke
  // rykke tilbake mens man skriver fordi et snapshot kom inn.
  const [text, setText] = useState(currentMap?.description || "");
  const saved = useRef(currentMap?.description || "");

  const save = () => {
    const value = text.trim();
    if (readOnly || value === saved.current) return;
    saved.current = value;
    updateMapMeta(currentMapId, { description: value });
  };

  const closeAndSave = () => {
    save();
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={closeAndSave}>
      <div
        className="modal glass-card"
        style={{ width: 520 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <span style={{ fontSize: 20 }}>ⓘ</span>
          <span style={{ fontFamily: "Outfit", fontSize: 18, fontWeight: 700, flex: 1 }}>
            Om kartet
          </span>
          <button className="btn btn-ghost btn-icon" onClick={closeAndSave} title="Lukk">
            ✕
          </button>
        </div>

        <div className="modal-body">
          <div className="modal-section">
            <label>🎯 Hva er dette kartet til for?</label>
            {readOnly ? (
              <div style={{ fontSize: 13, color: "var(--text-secondary)", whiteSpace: "pre-wrap", minHeight: 60 }}>
                {currentMap?.description || (
                  <span style={{ opacity: 0.4 }}>Ingen beskrivelse ennå</span>
                )}
              </div>
            ) : (
              <textarea
                autoFocus
                value={text}
                onChange={(e) => setText(e.target.value)}
                onBlur={save}
                placeholder="F.eks: Kartlegging av fakturaflyten fra mottak til godkjent betaling. Vi vurderer å skille attestering fra kontroll, og vil se hvor flaskehalsene ligger."
                style={{ minHeight: 130 }}
              />
            )}
          </div>

          <div className="page-box">
            <div className="page-box-text">
              Teksten legges øverst i AI-eksporten, så agenten forstår
              hensikten med kartet og ikke bare strukturen.
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
            <button className="btn btn-primary" onClick={closeAndSave}>
              Ferdig
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
