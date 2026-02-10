import { useState, useEffect, useCallback, useMemo } from "react";
import { marked } from "marked";
import { safeInvoke, getTauriErrorMessage } from "../utils/tauri";
import { getCurrentProject } from "../utils/project";
import "./ScriptEditor.css";

// Types pour le plugin fs
declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

interface ScriptEditorProps {
  onAudioGenerated?: (audioPath: string, duration: number) => void;
  onOpenSettings?: () => void;
}

type ViewMode = "edit" | "preview" | "split";

// Configure marked for safe rendering
marked.setOptions({
  breaks: true,
  gfm: true,
});

// SVG icons for the toolbar
const IconEdit = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const IconEye = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const IconColumns = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <line x1="12" y1="3" x2="12" y2="21" />
  </svg>
);

const IconSave = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
    <polyline points="17 21 17 13 7 13 7 21" />
    <polyline points="7 3 7 8 15 8" />
  </svg>
);

function ScriptEditor({ onAudioGenerated, onOpenSettings }: ScriptEditorProps) {
  const [script, setScript] = useState<string>("");
  const [url, setUrl] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");
  const [lastSaved, setLastSaved] = useState<string>("");
  const [viewMode, setViewMode] = useState<ViewMode>("split");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);

  // Charger le script au demarrage depuis le projet
  useEffect(() => {
    loadScript();
  }, []);

  // Tracker les changements non sauvegardés
  const handleScriptChange = useCallback((value: string) => {
    setScript(value);
    setHasUnsavedChanges(true);
  }, []);

  // Raccourci Ctrl+S pour sauvegarder
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        saveScript();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [script]);

  const loadScript = async () => {
    const project = getCurrentProject();
    if (!project) return;

    try {
      const { readTextFile } = await import("@tauri-apps/plugin-fs");
      const scriptPath = `${project.path}/script.md`;
      const content = await readTextFile(scriptPath);
      setScript(content);
      setHasUnsavedChanges(false);
    } catch {
      // Le fichier n'existe pas encore, c'est normal
    }
  };

  const saveScript = async () => {
    const project = getCurrentProject();
    if (!project || !script.trim()) return;

    try {
      const { writeTextFile, mkdir } = await import("@tauri-apps/plugin-fs");
      const scriptPath = `${project.path}/script.md`;

      // S'assurer que le dossier existe
      try {
        await mkdir(project.path, { recursive: true });
      } catch {
        // Le dossier existe déjà
      }

      await writeTextFile(scriptPath, script);
      setLastSaved(new Date().toLocaleTimeString());
      setHasUnsavedChanges(false);
    } catch (e) {
      console.error("Erreur sauvegarde script:", e);
    }
  };

  // Rendu Markdown mémoïsé
  const renderedMarkdown = useMemo(() => {
    if (!script.trim()) return "";
    return marked.parse(script) as string;
  }, [script]);

  const getApiKey = useCallback((): string | null => {
    return localStorage.getItem("gemini_api_key");
  }, []);

  const generateScript = async () => {
    const apiKey = getApiKey();
    if (!apiKey) {
      setError("Cle API Gemini non configuree. Allez dans les parametres.");
      if (onOpenSettings) onOpenSettings();
      return;
    }

    if (!url.trim()) {
      setError("Veuillez entrer une URL valide");
      return;
    }

    setIsGenerating(true);
    setError("");
    setSuccess("");

    try {
      let generatedScript = await safeInvoke<string>("generate_podcast_script", {
        url: url.trim(),
        apiKey,
      });

      // Supprimer les code fences Markdown (```markdown ... ``` ou ``` ... ```)
      generatedScript = generatedScript.replace(/^```(?:markdown|md)?\s*\n?/, "").replace(/\n?```\s*$/, "");

      setScript(generatedScript);
      setHasUnsavedChanges(true);
      setSuccess("Script genere avec succes !");
      setUrl("");
    } catch (err) {
      setError(getTauriErrorMessage(err));
    } finally {
      setIsGenerating(false);
    }
  };

  const generateAudio = async () => {
    const apiKey = getApiKey();
    if (!apiKey) {
      setError("Cle API Gemini non configuree. Allez dans les parametres.");
      if (onOpenSettings) onOpenSettings();
      return;
    }

    if (!script.trim()) {
      setError("Le script est vide");
      return;
    }

    const project = getCurrentProject();
    if (!project) {
      setError("Aucun projet selectionne");
      return;
    }

    setIsGeneratingAudio(true);
    setError("");
    setSuccess("");

    try {
      const { mkdir } = await import("@tauri-apps/plugin-fs");

      const audioDir = `${project.path}/audio`;
      try {
        await mkdir(audioDir, { recursive: true });
      } catch {
        // Le dossier existe déjà
      }

      const timestamp = Date.now();
      const outputPath = `${audioDir}/podcast_${timestamp}.wav`;

      const resultPath = await safeInvoke<string>("generate_voice", {
        text: script,
        apiKey,
        outputPath,
      });

      setSuccess(`Audio genere : ${resultPath}`);

      const wordCount = script.split(/\s+/).length;
      const estimatedDuration = (wordCount / 150) * 60;

      if (onAudioGenerated) {
        onAudioGenerated(resultPath, estimatedDuration);
      }
    } catch (err) {
      setError(getTauriErrorMessage(err));
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  const wordCount = useMemo(() => script.split(/\s+/).filter(w => w).length, [script]);
  const charCount = script.length;
  const estimatedMinutes = Math.ceil(wordCount / 150);

  return (
    <div className="script-editor">
      {/* Toolbar */}
      <div className="editor-toolbar">
        <div className="toolbar-left">
          <div className="url-input-group">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://exemple.com/article"
              className="url-input"
              disabled={isGenerating}
            />
            <button
              onClick={generateScript}
              disabled={isGenerating || !url.trim()}
              className="btn btn-primary toolbar-btn"
            >
              {isGenerating ? (
                <>
                  <span className="spinner" />
                  Generation...
                </>
              ) : (
                "Generer"
              )}
            </button>
          </div>
        </div>

        <div className="toolbar-center">
          <div className="view-toggle">
            <button
              className={`toggle-btn ${viewMode === "edit" ? "active" : ""}`}
              onClick={() => setViewMode("edit")}
              title="Editeur"
            >
              <IconEdit />
            </button>
            <button
              className={`toggle-btn ${viewMode === "split" ? "active" : ""}`}
              onClick={() => setViewMode("split")}
              title="Editeur + Apercu"
            >
              <IconColumns />
            </button>
            <button
              className={`toggle-btn ${viewMode === "preview" ? "active" : ""}`}
              onClick={() => setViewMode("preview")}
              title="Apercu"
            >
              <IconEye />
            </button>
          </div>
        </div>

        <div className="toolbar-right">
          <button
            onClick={saveScript}
            className={`btn btn-secondary toolbar-btn ${hasUnsavedChanges ? "btn-unsaved" : ""}`}
            disabled={!script.trim()}
            title="Sauvegarder (Ctrl+S)"
          >
            <IconSave />
            {hasUnsavedChanges ? "Sauvegarder*" : "Sauvegarde"}
          </button>
          <button
            onClick={generateAudio}
            disabled={isGeneratingAudio || !script.trim()}
            className="btn btn-success toolbar-btn"
          >
            {isGeneratingAudio ? (
              <>
                <span className="spinner" />
                Audio...
              </>
            ) : (
              "Generer l'audio"
            )}
          </button>
        </div>
      </div>

      {error && <div className="message error">{error}</div>}
      {success && <div className="message success">{success}</div>}

      {/* Editor Area */}
      <div className={`editor-area mode-${viewMode}`}>
        {/* Editor Pane */}
        {viewMode !== "preview" && (
          <div className="editor-pane">
            <div className="pane-header">
              <span className="pane-label">Markdown</span>
            </div>
            <textarea
              value={script}
              onChange={(e) => handleScriptChange(e.target.value)}
              placeholder="# Mon podcast&#10;&#10;Ecrivez votre script en Markdown...&#10;&#10;## Section 1&#10;&#10;Contenu de la premiere section.&#10;&#10;## Section 2&#10;&#10;Contenu de la deuxieme section."
              className="editor-textarea"
              spellCheck={false}
            />
          </div>
        )}

        {/* Preview Pane */}
        {viewMode !== "edit" && (
          <div className="preview-pane">
            <div className="pane-header">
              <span className="pane-label">Apercu</span>
            </div>
            <div
              className="markdown-preview"
              dangerouslySetInnerHTML={{ __html: renderedMarkdown }}
            />
          </div>
        )}
      </div>

      {/* Status Bar */}
      <div className="editor-statusbar">
        <div className="statusbar-left">
          <span className="status-item">{wordCount} mots</span>
          <span className="status-item">{charCount} car.</span>
          <span className="status-item">~{estimatedMinutes} min</span>
        </div>
        <div className="statusbar-right">
          {lastSaved && (
            <span className="status-saved">Sauvegarde {lastSaved}</span>
          )}
          {hasUnsavedChanges && (
            <span className="status-unsaved">Modifications non sauvegardees</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default ScriptEditor;
