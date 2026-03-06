/**
 * ApiKeySection — Reusable form section for managing an API key.
 *
 * Handles save, clear, show/hide toggle, and an external link to get a key.
 * Used for both Gemini and Pexels keys in the Settings page.
 */
import { useState, memo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

/** Trash icon for delete button. */
const IconTrash = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M2 4h12M5.333 4V2.667a1.333 1.333 0 0 1 1.334-1.334h2.666a1.333 1.333 0 0 1 1.334 1.334V4m2 0v9.333a1.333 1.333 0 0 1-1.334 1.334H4.667a1.333 1.333 0 0 1-1.334-1.334V4h9.334Z" stroke="currentColor" strokeWidth="1.33" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

/** Eye icon for showing password. */
const IconEyeOpen = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

/** Eye-off icon for hiding password. */
const IconEyeClosed = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

interface ApiKeySectionProps {
  icon: ReactNode;
  title: string;
  description: string;
  inputId: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
  onClear: () => void;
  isSaved: boolean;
  savedMessage: string;
  externalUrl: string;
  externalLabel: string;
}

function ApiKeySection({
  icon, title, description, inputId, placeholder,
  value, onChange, onSave, onClear,
  isSaved, savedMessage, externalUrl, externalLabel,
}: ApiKeySectionProps) {
  const { t } = useTranslation();
  const [showKey, setShowKey] = useState(false);

  return (
    <section className="settings-section">
      <div className="section-header">
        <span className="section-icon">{icon}</span>
        <div>
          <h3>{title}</h3>
          <p className="section-description">{description}</p>
        </div>
      </div>

      <div className="form-group">
        <label htmlFor={inputId}>{t('settings.apiKeyLabel')}</label>
        <div className="input-with-toggle">
          <input
            id={inputId}
            type={showKey ? "text" : "password"}
            placeholder={placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="input-field"
          />
          <button
            type="button"
            onClick={() => setShowKey(!showKey)}
            className="btn-toggle"
            title={showKey ? t('settings.hideKey') : t('settings.showKey')}
            aria-label={showKey ? t('settings.hideKey') : t('settings.showKey')}
            aria-pressed={showKey}
          >
            {showKey ? <IconEyeOpen /> : <IconEyeClosed />}
          </button>
        </div>
      </div>

      <div className="settings-actions">
        <button
          onClick={onSave}
          disabled={!value.trim()}
          className="btn btn-primary"
        >
          {t('settings.save')}
        </button>
        {value && (
          <button
            onClick={onClear}
            className="btn btn-secondary btn-icon"
            title={t('settings.delete')}
          >
            <IconTrash />
          </button>
        )}
        <a
          href={externalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="external-link-btn settings-actions-right"
        >
          {externalLabel}
        </a>
      </div>

      {isSaved && (
        <div className="success-message">{savedMessage}</div>
      )}
    </section>
  );
}

export default memo(ApiKeySection);
