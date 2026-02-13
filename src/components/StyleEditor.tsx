/**
 * StyleEditor — Tabbed editor for the three AI style prompts:
 * Script generation, Scene analysis, and Voice synthesis.
 * Each tab persists its own prompt in localStorage and exposes
 * a getter used by other components before calling Gemini.
 */
import { useState, useEffect, useCallback, memo } from "react";
import { useTranslation } from "react-i18next";
import "./StyleEditor.css";

// ---------------------------------------------------------------------------
// Tab definitions
// ---------------------------------------------------------------------------

type StyleTab = "script" | "scenes" | "voice";

const TABS: StyleTab[] = ["script", "scenes", "voice"];

/** localStorage key for each tab */
const STORAGE_KEYS: Record<StyleTab, string> = {
  script: "style_prompt",
  scenes: "scene_style_prompt",
  voice: "voice_style_prompt",
};

/** i18n key for the tab label */
const TAB_LABEL_KEYS: Record<StyleTab, string> = {
  script: "style.tabScript",
  scenes: "style.tabScenes",
  voice: "style.tabVoice",
};

/** i18n key for the tab description */
const TAB_DESCRIPTION_KEYS: Record<StyleTab, string> = {
  script: "style.descriptionScript",
  scenes: "style.descriptionScenes",
  voice: "style.descriptionVoice",
};

// ---------------------------------------------------------------------------
// Default prompts (English — the canonical language)
// ---------------------------------------------------------------------------

const DEFAULT_PROMPTS: Record<StyleTab, string> = {
  script: `You are a professional podcast scriptwriter. From the following content extracted from a website, create a podcast script as a solo monologue for a single host.

The script must:
- Have a catchy introduction where the host presents themselves
- Present the key points conversationally, as if the host were speaking directly to the listener
- Include natural transitions between topics
- End with a memorable conclusion and call to action
- Be approximately 5-10 minutes when read aloud
- Use a personal and engaging tone`,

  scenes: `Generate cinematic, visually rich scenes that complement the podcast narration.
Prefer wide establishing shots, dynamic camera angles, and evocative imagery.
Mix between documentary-style footage, abstract visuals, and real-world b-roll.
Each scene should feel like a professional video production.`,

  voice: `Read the text aloud with a natural and engaging voice, like a professional podcast host.
Use a warm, conversational tone with varied pacing.
Emphasize key points with slight changes in rhythm and intonation.`,
};

// ---------------------------------------------------------------------------
// Public getters — used by ScriptEditor, ScenesPage, etc.
// ---------------------------------------------------------------------------

/** Retrieve the stored script style prompt, falling back to the default. */
export function getStoredStylePrompt(): string {
  return localStorage.getItem(STORAGE_KEYS.script) || DEFAULT_PROMPTS.script;
}

/** Retrieve the stored scene style prompt, falling back to the default. */
export function getStoredSceneStylePrompt(): string {
  return localStorage.getItem(STORAGE_KEYS.scenes) || DEFAULT_PROMPTS.scenes;
}

/** Retrieve the stored voice style prompt, falling back to the default. */
export function getStoredVoiceStylePrompt(): string {
  return localStorage.getItem(STORAGE_KEYS.voice) || DEFAULT_PROMPTS.voice;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/** Load all prompts from localStorage into a Record keyed by tab. */
function loadPrompts(): Record<StyleTab, string> {
  return {
    script: getStoredStylePrompt(),
    scenes: getStoredSceneStylePrompt(),
    voice: getStoredVoiceStylePrompt(),
  };
}

function StyleEditor() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<StyleTab>("script");
  const [prompts, setPrompts] = useState<Record<StyleTab, string>>(loadPrompts);
  const [unsaved, setUnsaved] = useState<Record<StyleTab, boolean>>({
    script: false,
    scenes: false,
    voice: false,
  });
  const [lastSaved, setLastSaved] = useState<string>("");

  // Ctrl+S / Cmd+S shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeTab, prompts]);

  /** Update the active tab's prompt text. */
  const handleChange = useCallback(
    (value: string) => {
      setPrompts((prev) => ({ ...prev, [activeTab]: value }));
      setUnsaved((prev) => ({ ...prev, [activeTab]: true }));
    },
    [activeTab],
  );

  /** Persist the active tab's prompt to localStorage. */
  const handleSave = useCallback(() => {
    localStorage.setItem(STORAGE_KEYS[activeTab], prompts[activeTab]);
    setLastSaved(new Date().toLocaleTimeString());
    setUnsaved((prev) => ({ ...prev, [activeTab]: false }));
  }, [activeTab, prompts]);

  /** Reset the active tab's prompt to the built-in default. */
  const handleReset = useCallback(() => {
    if (!confirm(t("style.confirmReset"))) return;
    localStorage.removeItem(STORAGE_KEYS[activeTab]);
    setPrompts((prev) => ({ ...prev, [activeTab]: DEFAULT_PROMPTS[activeTab] }));
    setUnsaved((prev) => ({ ...prev, [activeTab]: false }));
    setLastSaved("");
  }, [activeTab, t]);

  const currentPrompt = prompts[activeTab];
  const hasUnsavedChanges = unsaved[activeTab];

  return (
    <div className="style-editor">
      {/* Toolbar */}
      <div className="style-toolbar">
        <div className="style-toolbar-left">
          <h3 className="style-title">{t("app.style")}</h3>

          {/* Tabs */}
          <div className="style-tabs">
            {TABS.map((tab) => (
              <button
                key={tab}
                className={`toggle-btn${activeTab === tab ? " active" : ""}${unsaved[tab] ? " unsaved" : ""}`}
                onClick={() => setActiveTab(tab)}
              >
                {t(TAB_LABEL_KEYS[tab])}
              </button>
            ))}
          </div>

          <span className="style-description">
            {t(TAB_DESCRIPTION_KEYS[activeTab])}
          </span>
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
        value={currentPrompt}
        onChange={(e) => handleChange(e.target.value)}
        className="style-textarea"
        spellCheck={false}
      />

      {/* Status Bar */}
      <div className="style-statusbar">
        <div className="statusbar-left">
          <span className="status-item">
            {currentPrompt.length} {t("style.chars")}
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
