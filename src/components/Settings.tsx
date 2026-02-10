import { useState, useEffect } from "react";
import { safeInvoke, getTauriErrorMessage } from "../utils/tauri";
import "./Settings.css";

interface SettingsProps {
  onClose?: () => void;
}

const GEMINI_API_KEY_STORAGE = "gemini_api_key";

function Settings({ onClose }: SettingsProps) {
  const [apiKey, setApiKey] = useState("");
  const [isSaved, setIsSaved] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [ffmpegStatus, setFfmpegStatus] = useState<string>("");
  const [ffmpegAvailable, setFfmpegAvailable] = useState<boolean>(false);

  useEffect(() => {
    const savedKey = localStorage.getItem(GEMINI_API_KEY_STORAGE);
    if (savedKey) {
      setApiKey(savedKey);
    }
    // Vérifier FFmpeg
    const checkFfmpeg = async () => {
      try {
        const result = await safeInvoke<string>("check_ffmpeg");
        setFfmpegStatus(result);
        setFfmpegAvailable(true);
      } catch (error) {
        setFfmpegStatus(getTauriErrorMessage(error));
        setFfmpegAvailable(false);
      }
    };
    checkFfmpeg();
  }, []);

  const handleSave = () => {
    if (apiKey.trim()) {
      localStorage.setItem(GEMINI_API_KEY_STORAGE, apiKey.trim());
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    }
  };

  const handleClear = () => {
    if (confirm("Êtes-vous sûr de vouloir supprimer votre clé API ?")) {
      localStorage.removeItem(GEMINI_API_KEY_STORAGE);
      setApiKey("");
      setIsSaved(false);
    }
  };

  return (
    <div className="settings-panel">
      <div className="settings-header">
        <h2>Paramètres</h2>
        {onClose && (
          <button onClick={onClose} className="btn btn-secondary">
            ← Retour
          </button>
        )}
      </div>

      <div className="settings-content">
        <div className="settings-grid">
          {/* API Section */}
          <section className="settings-section">
            <div className="section-header">
              <span className="section-icon">🔑</span>
              <div>
                <h3>Clé API Gemini</h3>
                <p className="section-description">
                  Nécessaire pour la génération de scripts et de voix
                </p>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="api-key-setting">Clé API</label>
              <div className="input-with-toggle">
                <input
                  id="api-key-setting"
                  type={showKey ? "text" : "password"}
                  placeholder="AIzaSy..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="input-field"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="btn-toggle"
                  title={showKey ? "Masquer" : "Afficher"}
                >
                  {showKey ? "👁️" : "👁️‍🗨️"}
                </button>
              </div>
            </div>

            <div className="settings-actions">
              <button
                onClick={handleSave}
                disabled={!apiKey.trim()}
                className="btn btn-primary"
              >
                Sauvegarder
              </button>
              {apiKey && (
                <button onClick={handleClear} className="btn btn-secondary">
                  Supprimer
                </button>
              )}
            </div>

            {isSaved && (
              <div className="success-message">
                ✓ Clé API sauvegardée
              </div>
            )}
          </section>

          {/* Info Section */}
          <section className="settings-section">
            <div className="section-header">
              <span className="section-icon">ℹ️</span>
              <div>
                <h3>Obtenir une clé API</h3>
                <p className="section-description">
                  Gratuit avec un compte Google
                </p>
              </div>
            </div>

            <div className="info-steps">
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="external-link-btn"
              >
                Ouvrir Google AI Studio →
              </a>
              
              <ol className="steps-list">
                <li>Connectez-vous avec votre compte Google</li>
                <li>Cliquez sur "Create API Key"</li>
                <li>Copiez la clé générée</li>
                <li>Collez-la dans le champ ci-dessus</li>
              </ol>
            </div>
          </section>

          {/* FFmpeg Section */}
          <section className="settings-section">
            <div className="section-header">
              <span className="section-icon">🔧</span>
              <div>
                <h3>FFmpeg</h3>
                <p className="section-description">
                  Requis pour le montage vidéo et l'export
                </p>
              </div>
            </div>
            <div className="ffmpeg-info">
              <div className={`ffmpeg-badge ${ffmpegAvailable ? "available" : "missing"}`}>
                <span className="ffmpeg-dot" />
                {ffmpegAvailable ? "Installé" : "Non disponible"}
              </div>
              <p className="ffmpeg-detail">{ffmpegStatus || "Vérification en cours..."}</p>
              {!ffmpegAvailable && (
                <p className="text-muted">
                  FFmpeg embarqué introuvable. Lancez <code>npm run download-ffmpeg</code> puis relancez l'application.
                </p>
              )}
            </div>
          </section>

          {/* About Section */}
          <section className="settings-section">
            <div className="section-header">
              <span className="section-icon">🎙️</span>
              <div>
                <h3>À propos de Kaast</h3>
                <p className="section-description">
                  Éditeur de podcasts avec IA
                </p>
              </div>
            </div>
            <div className="about-content">
              <p>Version 1.0.0</p>
              <p className="text-muted">
                Kaast utilise l'API Gemini pour générer des scripts de podcasts
                et des voix naturelles à partir de vos sources.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export function getStoredApiKey(): string | null {
  return localStorage.getItem(GEMINI_API_KEY_STORAGE);
}

export default Settings;
