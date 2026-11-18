import type { AccessibilitySettings } from '../types/game';

interface SettingsModalProps {
  settings: AccessibilitySettings;
  onToggle: (key: keyof AccessibilitySettings) => void;
  onClose: () => void;
}

const OPTIONS: Array<{ key: keyof AccessibilitySettings; label: string; hint: string }> = [
  { key: 'voiceEnabled', label: 'Voz en español (CL)', hint: 'Pronuncia cada letra y palabra' },
  { key: 'sfxEnabled', label: 'Sonidos suaves', hint: 'Campanitas y rebotes' },
  { key: 'slowFloating', label: 'Flotación lenta', hint: 'Letras más despacio en la cúpula' },
  { key: 'reducedMotion', label: 'Reducir movimiento', hint: 'Menos brillos y animaciones' },
  { key: 'highContrast', label: 'Alto contraste', hint: 'Bordes y textos más marcados' },
];

export function SettingsModal({ settings, onToggle, onClose }: SettingsModalProps) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Ajustes">
      <div className="capture-modal settings-modal">
        <h2>Ajustes y Accesibilidad</h2>
        <div className="settings-list">
          {OPTIONS.map((opt) => {
            const active = settings[opt.key];
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
        <button type="button" className="btn btn-primary" onClick={onClose}>
          Listo
        </button>
      </div>
    </div>
  );
}
