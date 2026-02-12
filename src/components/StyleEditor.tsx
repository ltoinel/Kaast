/**
 * StyleEditor — Dedicated page for editing the podcast generation style prompt.
 * The user writes a free-form text that is persisted in localStorage and
 * injected automatically when generating a script on the Script page.
 */
import { useState, useEffect, useCallback, memo } from "react";
import { useTranslation } from "react-i18next";
import "./StyleEditor.css";

const STYLE_PROMPT_STORAGE = "style_prompt";

/** Default style prompt (solo monologue — most versatile) */
const DEFAULT_STYLE_PROMPT = `Tu es un scénariste de podcast professionnel. À partir du contenu suivant extrait d'un site web, crée un script de podcast en monologue pour un seul présentateur.

Le script doit:
- Avoir une introduction accrocheuse où le présentateur se présente
- Présenter les points clés de manière conversationnelle, comme si le présentateur parlait directement à l'auditeur
- Inclure des transitions naturelles entre les sujets
- Se terminer par une conclusion mémorable avec un appel à l'action
- Durer environ 5-10 minutes à la lecture
- Être écrit en français
- Utiliser un ton personnel et engageant`;

/** Retrieve the stored style prompt, falling back to the default */
export function getStoredStylePrompt(): string {
  return localStorage.getItem(STYLE_PROMPT_STORAGE) || DEFAULT_STYLE_PROMPT;
}

function StyleEditor() {
  const { t } = useTranslation();
  const [prompt, setPrompt] = useState<string>("");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [lastSaved, setLastSaved] = useState<string>("");

  useEffect(() => {
    setPrompt(getStoredStylePrompt());
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [prompt]);

  const handleChange = useCallback((value: string) => {
    setPrompt(value);
    setHasUnsavedChanges(true);
  }, []);

  const handleSave = useCallback(() => {
    localStorage.setItem(STYLE_PROMPT_STORAGE, prompt);
    setLastSaved(new Date().toLocaleTimeString());
    setHasUnsavedChanges(false);
  }, [prompt]);

  const handleReset = useCallback(() => {
    if (!confirm(t("style.confirmReset"))) return;
    localStorage.removeItem(STYLE_PROMPT_STORAGE);
    setPrompt(DEFAULT_STYLE_PROMPT);
    setHasUnsavedChanges(false);
    setLastSaved("");
  }, [t]);

  return (
    <div className="style-editor">
      {/* Toolbar */}
      <div className="style-toolbar">
        <div className="style-toolbar-left">
          <h3 className="style-title">{t("app.style")}</h3>
          <span className="style-description">{t("style.description")}</span>
        </div>
        <div className="style-toolbar-right">
          <button
            onClick={handleReset}
            className="btn btn-secondary toolbar-btn"
          >
            {t("style.reset")}
          </button>
          <button
            onClick={handleSave}
            className={`btn btn-primary toolbar-btn ${hasUnsavedChanges ? "btn-unsaved" : ""}`}
          >
            {hasUnsavedChanges ? t("style.saveUnsaved") : t("style.save")}
          </button>
        </div>
      </div>

      {/* Textarea */}
      <textarea
        value={prompt}
        onChange={(e) => handleChange(e.target.value)}
        className="style-textarea"
        spellCheck={false}
      />

      {/* Status Bar */}
      <div className="style-statusbar">
        <div className="statusbar-left">
          <span className="status-item">
            {prompt.length} {t("style.chars")}
          </span>
        </div>
        <div className="statusbar-right">
          {lastSaved && (
            <span className="status-saved">
              {t("style.savedAt", { time: lastSaved })}
            </span>
          )}
          {hasUnsavedChanges && (
            <span className="status-unsaved">
              {t("style.unsavedChanges")}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default memo(StyleEditor);
