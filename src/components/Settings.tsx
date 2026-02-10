import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { safeInvoke, getTauriErrorMessage } from "../utils/tauri";
import { SUPPORTED_LANGUAGES } from "../i18n";
import "./Settings.css";

interface SettingsProps {
  onClose?: () => void;
}

const GEMINI_API_KEY_STORAGE = "gemini_api_key";

function Settings({ onClose }: SettingsProps) {
  const { t, i18n } = useTranslation();
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
    if (confirm(t('settings.confirmDeleteKey'))) {
      localStorage.removeItem(GEMINI_API_KEY_STORAGE);
      setApiKey("");
      setIsSaved(false);
    }
  };

  return (
    <div className="settings-panel">
      <div className="settings-header">
        <h2>{t('settings.title')}</h2>
        {onClose && (
          <button onClick={onClose} className="btn btn-secondary">
            {t('settings.back')}
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
                <h3>{t('settings.apiKeyTitle')}</h3>
                <p className="section-description">
                  {t('settings.apiKeyDescription')}
                </p>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="api-key-setting">{t('settings.apiKeyLabel')}</label>
              <div className="input-with-toggle">
                <input
                  id="api-key-setting"
                  type={showKey ? "text" : "password"}
                  placeholder={t('settings.apiKeyPlaceholder')}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="input-field"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="btn-toggle"
                  title={showKey ? t('settings.hideKey') : t('settings.showKey')}
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
                {t('settings.save')}
              </button>
              {apiKey && (
                <button onClick={handleClear} className="btn btn-secondary">
                  {t('settings.delete')}
                </button>
              )}
            </div>

            {isSaved && (
              <div className="success-message">
                {t('settings.apiKeySaved')}
              </div>
            )}
          </section>

          {/* Info Section */}
          <section className="settings-section">
            <div className="section-header">
              <span className="section-icon">ℹ️</span>
              <div>
                <h3>{t('settings.getApiKeyTitle')}</h3>
                <p className="section-description">
                  {t('settings.getApiKeyDescription')}
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
                {t('settings.openGoogleAIStudio')}
              </a>

              <ol className="steps-list">
                <li>{t('settings.step1')}</li>
                <li>{t('settings.step2')}</li>
                <li>{t('settings.step3')}</li>
                <li>{t('settings.step4')}</li>
              </ol>
            </div>
          </section>

          {/* FFmpeg Section */}
          <section className="settings-section">
            <div className="section-header">
              <span className="section-icon">🔧</span>
              <div>
                <h3>{t('settings.ffmpegTitle')}</h3>
                <p className="section-description">
                  {t('settings.ffmpegDescription')}
                </p>
              </div>
            </div>
            <div className="ffmpeg-info">
              <div className={`ffmpeg-badge ${ffmpegAvailable ? "available" : "missing"}`}>
                <span className="ffmpeg-dot" />
                {ffmpegAvailable ? t('settings.ffmpegInstalled') : t('settings.ffmpegMissing')}
              </div>
              <p className="ffmpeg-detail">{ffmpegStatus || t('settings.ffmpegChecking')}</p>
              {!ffmpegAvailable && (
                <p className="text-muted">
                  {t('settings.ffmpegHelp')}
                </p>
              )}
            </div>
          </section>

          {/* Language Section */}
          <section className="settings-section">
            <div className="section-header">
              <span className="section-icon">🌐</span>
              <div>
                <h3>{t('settings.languageTitle')}</h3>
                <p className="section-description">
                  {t('settings.languageDescription')}
                </p>
              </div>
            </div>
            <div className="form-group">
              <select
                value={i18n.language?.substring(0, 2)}
                onChange={(e) => i18n.changeLanguage(e.target.value)}
                className="input-field"
              >
                {SUPPORTED_LANGUAGES.map(lang => (
                  <option key={lang.code} value={lang.code}>
                    {lang.label}
                  </option>
                ))}
              </select>
            </div>
          </section>

          {/* About Section */}
          <section className="settings-section">
            <div className="section-header">
              <span className="section-icon">🎙️</span>
              <div>
                <h3>{t('settings.aboutTitle')}</h3>
                <p className="section-description">
                  {t('settings.aboutDescription')}
                </p>
              </div>
            </div>
            <div className="about-content">
              <p>Version 1.0.0</p>
              <p className="text-muted">
                {t('settings.aboutText')}
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
