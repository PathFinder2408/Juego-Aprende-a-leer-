import { useState } from 'react';
import { PLAYER_SKINS } from '../config/skins';
import type { AccessibilitySettings, PlayerSkinId } from '../types/game';

interface SettingsModalProps {
  settings: AccessibilitySettings;
  playerSkin: PlayerSkinId;
  onSelectSkin: (skinId: PlayerSkinId) => void;
  onToggle: (key: keyof AccessibilitySettings) => void;
  onResetProgress: () => void;
  onClose: () => void;
}

const OPTIONS: Array<{ key: keyof AccessibilitySettings; label: string; hint: string }> = [
  { key: 'voiceEnabled', label: 'Voz en español (CL)', hint: 'Pronuncia cada letra y palabra' },
  { key: 'sfxEnabled', label: 'Sonidos suaves', hint: 'Campanitas y rebotes' },
  { key: 'musicEnabled', label: 'Música ambiental', hint: 'Melodía tranquila de fondo' },
  { key: 'slowFloating', label: 'Flotación lenta', hint: 'Letras más despacio en la cúpula' },
  { key: 'reducedMotion', label: 'Reducir movimiento', hint: 'Menos brillos y animaciones' },
  { key: 'highContrast', label: 'Alto contraste', hint: 'Bordes y textos más marcados' },
];

export function SettingsModal({
  settings,
  playerSkin,
  onSelectSkin,
  onToggle,
  onResetProgress,
  onClose,
}: SettingsModalProps) {
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetDone, setResetDone] = useState(false);

  const handleConfirmReset = () => {
    onResetProgress();
    setConfirmReset(false);
    setResetDone(true);
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Ajustes">
      <div className="capture-modal settings-modal">
        <h2>Ajustes y Accesibilidad</h2>
        <div className="settings-skin-section">
          <span className="settings-section-title">Estilo del Explorador</span>
          <div className="settings-skin-grid" role="group" aria-label="Elegir estilo del personaje">
            {PLAYER_SKINS.map((skin) => {
              const active = skin.id === playerSkin;
              return (
                <button
                  key={skin.id}
                  type="button"
                  aria-pressed={active}
                  className={`settings-skin-card ${active ? 'settings-skin-card--active' : ''}`}
                  onClick={() => onSelectSkin(skin.id)}
                >
                  <img src={skin.sprite} alt={skin.name} className="settings-skin-thumb" />
                  <strong>
                    {skin.badge} {skin.name}
                  </strong>
                  <small>{skin.subtitle}</small>
                </button>
              );
            })}
          </div>
        </div>
        <div className="settings-list">
          {OPTIONS.map((opt) => {
            const active = settings[opt.key] ?? true;
            return (
              <button
                key={opt.key}
                type="button"
                role="switch"
                aria-checked={active}
                className={`toggle-row ${active ? 'toggle-row--on' : ''}`}
                onClick={() => onToggle(opt.key)}
              >
                <span className="toggle-text">
                  <strong>{opt.label}</strong>
                  <small>{opt.hint}</small>
                </span>
                <span className="toggle-pill">{active ? 'SÍ' : 'NO'}</span>
              </button>
            );
          })}
        </div>

        <div className="settings-reset-box">
          {!confirmReset ? (
            <button
              type="button"
              className="btn btn-danger-outline"
              onClick={() => {
                setResetDone(false);
                setConfirmReset(true);
              }}
            >
              Reiniciar progreso
            </button>
          ) : (
            <div className="settings-reset-confirm" role="alert">
              <p>¿Borrar cartas, álbum y nivel? Tus ajustes de accesibilidad se conservan.</p>
              <div className="settings-reset-actions">
                <button type="button" className="btn btn-danger" onClick={handleConfirmReset}>
                  Sí, reiniciar
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setConfirmReset(false)}>
                  Cancelar
                </button>
              </div>
            </div>
          )}
          {resetDone && <p className="settings-reset-done">¡Progreso reiniciado!</p>}
        </div>

        <button type="button" className="btn btn-primary" onClick={onClose}>
          Listo
        </button>
      </div>
    </div>
  );
}
