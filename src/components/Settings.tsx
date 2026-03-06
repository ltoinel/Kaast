import { useState, useEffect, memo } from "react";
import { useTranslation } from "react-i18next";
import { safeInvoke, getTauriErrorMessage } from "../utils/tauri";
import {
  getSecureValue, setSecureValue, removeSecureValue,
  migrateToSecureStore, GEMINI_API_KEY, PEXELS_API_KEY, SENSITIVE_KEYS,
} from "../utils/secureStore";
import { SUPPORTED_LANGUAGES } from "../i18n";
import { IconKey, IconFilm, IconWrench, IconGlobe, IconMicrophone } from "./Icons";
import ApiKeySection from "./ApiKeySection";
import "./Settings.css";

interface SettingsProps {
  onClose?: () => void;
}

function Settings({ onClose }: SettingsProps) {
  const { t, i18n } = useTranslation();
  const [apiKey, setApiKey] = useState("");
  const [isSaved, setIsSaved] = useState(false);
  const [pexelsApiKey, setPexelsApiKey] = useState("");
  const [isPexelsSaved, setIsPexelsSaved] = useState(false);
  const [ffmpegStatus, setFfmpegStatus] = useState<string>("");
  const [ffmpegAvailable, setFfmpegAvailable] = useState<boolean>(false);

  useEffect(() => {
    const init = async () => {
      // Migrate legacy localStorage keys to secure store
      await migrateToSecureStore(SENSITIVE_KEYS);

      const savedKey = await getSecureValue(GEMINI_API_KEY);
      if (savedKey) setApiKey(savedKey);
      const savedPexelsKey = await getSecureValue(PEXELS_API_KEY);
      if (savedPexelsKey) setPexelsApiKey(savedPexelsKey);

      try {
        const result = await safeInvoke<string>("check_ffmpeg");
        setFfmpegStatus(result);
        setFfmpegAvailable(true);
      } catch (error) {
        setFfmpegStatus(getTauriErrorMessage(error));
        setFfmpegAvailable(false);
      }
    };
    init();
  }, []);

  const handleSave = async () => {
    if (apiKey.trim()) {
      await setSecureValue(GEMINI_API_KEY, apiKey.trim());
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    }
  };

  const handleClear = async () => {
    if (confirm(t('settings.confirmDeleteKey'))) {
      await removeSecureValue(GEMINI_API_KEY);
      setApiKey("");
      setIsSaved(false);
    }
  };

  const handlePexelsSave = async () => {
    if (pexelsApiKey.trim()) {
      await setSecureValue(PEXELS_API_KEY, pexelsApiKey.trim());
      setIsPexelsSaved(true);
      setTimeout(() => setIsPexelsSaved(false), 3000);
    }
  };

  const handlePexelsClear = async () => {
    if (confirm(t('settings.confirmDeletePexelsKey'))) {
      await removeSecureValue(PEXELS_API_KEY);
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
          {/* Gemini API Key */}
          <ApiKeySection
            icon={<IconKey />}
            title={t('settings.apiKeyTitle')}
            description={t('settings.apiKeyDescription')}
            inputId="api-key-setting"
            placeholder={t('settings.apiKeyPlaceholder')}
            value={apiKey}
            onChange={setApiKey}
            onSave={handleSave}
            onClear={handleClear}
            isSaved={isSaved}
            savedMessage={t('settings.apiKeySaved')}
            externalUrl="https://aistudio.google.com/app/apikey"
            externalLabel={t('settings.openGoogleAIStudio')}
          />

          {/* Pexels API Key */}
          <ApiKeySection
            icon={<IconFilm />}
            title={t('settings.pexelsApiKeyTitle')}
            description={t('settings.pexelsApiKeyDescription')}
            inputId="pexels-api-key-setting"
            placeholder={t('settings.pexelsApiKeyPlaceholder')}
            value={pexelsApiKey}
            onChange={setPexelsApiKey}
            onSave={handlePexelsSave}
            onClear={handlePexelsClear}
            isSaved={isPexelsSaved}
            savedMessage={t('settings.pexelsApiKeySaved')}
            externalUrl="https://www.pexels.com/api/new/"
            externalLabel={t('settings.openPexels')}
          />

          {/* FFmpeg Section */}
          <section className="settings-section">
            <div className="section-header">
              <span className="section-icon"><IconWrench /></span>
              <div>
                <h3>{t('settings.ffmpegTitle')}</h3>
                <p className="section-description">{t('settings.ffmpegDescription')}</p>
              </div>
            </div>
            <div className="ffmpeg-info">
              <div className={`ffmpeg-badge ${ffmpegAvailable ? "available" : "missing"}`} role="status">
                <span className="ffmpeg-dot" aria-hidden="true" />
                {ffmpegAvailable ? t('settings.ffmpegInstalled') : t('settings.ffmpegMissing')}
              </div>
              <p className="ffmpeg-detail">{ffmpegStatus || t('settings.ffmpegChecking')}</p>
              {!ffmpegAvailable && (
                <p className="text-muted">{t('settings.ffmpegHelp')}</p>
              )}
            </div>
          </section>

          {/* Language Section */}
          <section className="settings-section">
            <div className="section-header">
              <span className="section-icon"><IconGlobe /></span>
              <div>
                <h3>{t('settings.languageTitle')}</h3>
                <p className="section-description">{t('settings.languageDescription')}</p>
              </div>
            </div>
            <div className="form-group">
              <select
                value={i18n.language?.substring(0, 2)}
                onChange={(e) => i18n.changeLanguage(e.target.value)}
                className="input-field"
                aria-label={t('settings.languageTitle')}
              >
                {SUPPORTED_LANGUAGES.map(lang => (
                  <option key={lang.code} value={lang.code}>{lang.label}</option>
                ))}
              </select>
            </div>
          </section>

          {/* About Section */}
          <section className="settings-section">
            <div className="section-header">
              <span className="section-icon"><IconMicrophone /></span>
              <div>
                <h3>{t('settings.aboutTitle')}</h3>
                <p className="section-description">{t('settings.aboutDescription')}</p>
              </div>
            </div>
            <div className="about-content">
              <p>Version 1.0.0</p>
              <p className="text-muted">{t('settings.aboutText')}</p>
              <p className="text-muted">{t('settings.licenseText')}</p>
              <p className="text-muted">{t('settings.ffmpegNotice')}</p>
              <p className="text-muted">{t('settings.thirdPartyNotices')}</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

/** Get the stored Gemini API key (async, from secure store). */
export async function getStoredApiKey(): Promise<string | null> {
  return getSecureValue(GEMINI_API_KEY);
}

/** Get the stored Pexels API key (async, from secure store). */
export async function getStoredPexelsApiKey(): Promise<string | null> {
  return getSecureValue(PEXELS_API_KEY);
}

export default memo(Settings);
