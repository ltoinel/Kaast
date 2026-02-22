import { useState, useEffect, memo } from "react";
import { useTranslation } from "react-i18next";
import { safeInvoke, getTauriErrorMessage } from "../utils/tauri";
import { SUPPORTED_LANGUAGES } from "../i18n";
import "./Settings.css";

interface SettingsProps {
  onClose?: () => void;
}

const GEMINI_API_KEY_STORAGE = "gemini_api_key";
const PEXELS_API_KEY_STORAGE = "pexels_api_key";

function Settings({ onClose }: SettingsProps) {
  const { t, i18n } = useTranslation();
  const [apiKey, setApiKey] = useState("");
  const [isSaved, setIsSaved] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [pexelsApiKey, setPexelsApiKey] = useState("");
  const [isPexelsSaved, setIsPexelsSaved] = useState(false);
  const [showPexelsKey, setShowPexelsKey] = useState(false);
  const [ffmpegStatus, setFfmpegStatus] = useState<string>("");
  const [ffmpegAvailable, setFfmpegAvailable] = useState<boolean>(false);

  useEffect(() => {
    const savedKey = localStorage.getItem(GEMINI_API_KEY_STORAGE);
    if (savedKey) {
      setApiKey(savedKey);
    }
    const savedPexelsKey = localStorage.getItem(PEXELS_API_KEY_STORAGE);
    if (savedPexelsKey) {
      setPexelsApiKey(savedPexelsKey);
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

  const handlePexelsSave = () => {
    if (pexelsApiKey.trim()) {
      localStorage.setItem(PEXELS_API_KEY_STORAGE, pexelsApiKey.trim());
      setIsPexelsSaved(true);
      setTimeout(() => setIsPexelsSaved(false), 3000);
    }
  };

  const handlePexelsClear = () => {
    if (confirm(t('settings.confirmDeletePexelsKey'))) {
      localStorage.removeItem(PEXELS_API_KEY_STORAGE);
      setPexelsApiKey("");
      setIsPexelsSaved(false);
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
                <button
                  onClick={handleClear}
                  className="btn btn-secondary btn-icon"
                  title={t('settings.delete')}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M2 4h12M5.333 4V2.667a1.333 1.333 0 0 1 1.334-1.334h2.666a1.333 1.333 0 0 1 1.334 1.334V4m2 0v9.333a1.333 1.333 0 0 1-1.334 1.334H4.667a1.333 1.333 0 0 1-1.334-1.334V4h9.334Z" stroke="currentColor" strokeWidth="1.33" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              )}
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="external-link-btn settings-actions-right"
              >
                {t('settings.openGoogleAIStudio')}
              </a>
            </div>

            {isSaved && (
              <div className="success-message">
                {t('settings.apiKeySaved')}
              </div>
            )}
          </section>

          {/* Pexels API Section */}
          <section className="settings-section">
            <div className="section-header">
              <span className="section-icon">🎬</span>
              <div>
                <h3>{t('settings.pexelsApiKeyTitle')}</h3>
                <p className="section-description">
                  {t('settings.pexelsApiKeyDescription')}
                </p>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="pexels-api-key-setting">{t('settings.apiKeyLabel')}</label>
              <div className="input-with-toggle">
                <input
                  id="pexels-api-key-setting"
                  type={showPexelsKey ? "text" : "password"}
                  placeholder={t('settings.pexelsApiKeyPlaceholder')}
                  value={pexelsApiKey}
                  onChange={(e) => setPexelsApiKey(e.target.value)}
                  className="input-field"
                />
                <button
                  type="button"
                  onClick={() => setShowPexelsKey(!showPexelsKey)}
                  className="btn-toggle"
                  title={showPexelsKey ? t('settings.hideKey') : t('settings.showKey')}
                >
                  {showPexelsKey ? "👁️" : "👁️‍🗨️"}
                </button>
              </div>
            </div>

            <div className="settings-actions">
              <button
                onClick={handlePexelsSave}
                disabled={!pexelsApiKey.trim()}
                className="btn btn-primary"
              >
                {t('settings.save')}
              </button>
              {pexelsApiKey && (
                <button
                  onClick={handlePexelsClear}
                  className="btn btn-secondary btn-icon"
                  title={t('settings.delete')}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M2 4h12M5.333 4V2.667a1.333 1.333 0 0 1 1.334-1.334h2.666a1.333 1.333 0 0 1 1.334 1.334V4m2 0v9.333a1.333 1.333 0 0 1-1.334 1.334H4.667a1.333 1.333 0 0 1-1.334-1.334V4h9.334Z" stroke="currentColor" strokeWidth="1.33" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              )}
              <a
                href="https://www.pexels.com/api/new/"
                target="_blank"
                rel="noopener noreferrer"
                className="external-link-btn settings-actions-right"
              >
                {t('settings.openPexels')}
              </a>
            </div>

            {isPexelsSaved && (
              <div className="success-message">
                {t('settings.pexelsApiKeySaved')}
              </div>
            )}
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
              <p className="text-muted">
                {t('settings.licenseText')}
              </p>
              <p className="text-muted">
                {t('settings.ffmpegNotice')}
              </p>
              <p className="text-muted">
                {t('settings.thirdPartyNotices')}
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

export function getStoredPexelsApiKey(): string | null {
  return localStorage.getItem(PEXELS_API_KEY_STORAGE);
}

export default memo(Settings);
