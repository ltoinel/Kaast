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

/** Floppy-disk save icon matching the ScriptEditor toolbar. */
const IconSave = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
    <polyline points="17 21 17 13 7 13 7 21" />
    <polyline points="7 3 7 8 15 8" />
  </svg>
);

/** Script/document icon. */
const IconScript = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);

/** Film/scenes icon. */
const IconScenes = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
    <line x1="7" y1="2" x2="7" y2="22" />
    <line x1="17" y1="2" x2="17" y2="22" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <line x1="2" y1="7" x2="7" y2="7" />
    <line x1="2" y1="17" x2="7" y2="17" />
    <line x1="17" y1="17" x2="22" y2="17" />
    <line x1="17" y1="7" x2="22" y2="7" />
  </svg>
);

/** Microphone/voice icon. */
const IconVoice = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" y1="19" x2="12" y2="23" />
    <line x1="8" y1="23" x2="16" y2="23" />
  </svg>
);

type StyleTab = "script" | "scenes" | "voice";

/** Icon component for each tab. */
const TAB_ICONS: Record<StyleTab, React.FC> = {
  script: IconScript,
  scenes: IconScenes,
  voice: IconVoice,
};

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
  script: `You are an expert podcast scriptwriter crafting a compelling solo-host episode from web content.

Structure:
- Hook: Open with a bold statement, surprising fact, or thought-provoking question that grabs the listener in the first 10 seconds.
- Introduction: The host briefly introduces themselves and frames the topic with context and relevance.
- Body: Break down the source material into 3-5 clear segments. Use storytelling, real-world examples, and rhetorical questions to keep the listener engaged. Add smooth transitions between segments.
- Conclusion: Summarize the key takeaways, share a personal reflection or opinion, and end with a clear call to action.

Tone & Style:
- Conversational and authentic — as if talking to a friend over coffee.
- Energetic but not over-the-top. Vary rhythm between punchy short sentences and longer explanatory ones.
- Use vivid language, analogies, and occasional humor to make complex ideas accessible.

Target length: 5-10 minutes when read aloud.
Write the script in the same language as the source content.`,

  scenes: `Generate cinematic, visually rich scenes that complement the podcast narration.

Visual direction:
- Prefer wide establishing shots, dynamic camera angles, and evocative imagery.
- Mix between documentary-style footage, abstract visuals, and real-world b-roll.
- Each scene should feel like a professional video production.
- Use contrasting moods: alternate between calm, contemplative shots and dynamic, high-energy visuals.
- Include close-ups on details that reinforce the narration.`,

  voice: `Read the text aloud with a natural and engaging voice, like a professional podcast host.

Delivery:
- Use a warm, conversational tone with varied pacing.
- Emphasize key points with slight changes in rhythm and intonation.
- Add brief pauses before important statements for dramatic effect.
- Keep the energy consistent but not monotone — vary between enthusiastic and reflective moments.`,
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
            {TABS.map((tab) => {
              const Icon = TAB_ICONS[tab];
              return (
                <button
                  key={tab}
                  className={`style-tab${activeTab === tab ? " active" : ""}${unsaved[tab] ? " unsaved" : ""}`}
                  onClick={() => setActiveTab(tab)}
                >
                  <Icon />
                  {t(TAB_LABEL_KEYS[tab])}
                </button>
              );
            })}
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
            className={`btn btn-secondary toolbar-btn ${hasUnsavedChanges ? "btn-unsaved" : ""}`}
          >
            <IconSave />
            {hasUnsavedChanges ? t("style.saveUnsaved") : t("style.saved")}
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
