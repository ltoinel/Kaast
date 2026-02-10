import { useState, useEffect, useCallback } from "react";
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

function ScriptEditor({ onAudioGenerated, onOpenSettings }: ScriptEditorProps) {
  const [script, setScript] = useState<string>("");
  const [url, setUrl] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");
  const [lastSaved, setLastSaved] = useState<string>("");

  // Charger le script au démarrage depuis le projet
  useEffect(() => {
    loadScript();
  }, []);

  // Auto-save avec debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (script.trim()) {
        saveScript();
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [script]);

  const loadScript = async () => {
    const project = getCurrentProject();
    if (!project) return;

    try {
      const { readTextFile } = await import("@tauri-apps/plugin-fs");
      const scriptPath = `${project.path}/script.md`;
      const content = await readTextFile(scriptPath);
      setScript(content);
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
    } catch (e) {
      console.error("Erreur sauvegarde script:", e);
    }
  };

  const getApiKey = useCallback((): string | null => {
    return localStorage.getItem("gemini_api_key");
  }, []);

  const generateScript = async () => {
    const apiKey = getApiKey();
    if (!apiKey) {
      setError("Clé API Gemini non configurée. Allez dans les paramètres.");
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
      // Étape 1: Extraire le contenu de l'URL
      const pageContent = await safeInvoke<string>("fetch_url_content", {
        url: url.trim(),
      });

      // Étape 2: Générer le script avec Gemini
      const generatedScript = await safeInvoke<string>("generate_podcast_script", {
        content: pageContent,
        apiKey,
      });

      setScript(generatedScript);
      setSuccess("Script généré avec succès !");
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
      setError("Clé API Gemini non configurée. Allez dans les paramètres.");
      if (onOpenSettings) onOpenSettings();
      return;
    }

    if (!script.trim()) {
      setError("Le script est vide");
      return;
    }

    const project = getCurrentProject();
    if (!project) {
      setError("Aucun projet sélectionné");
      return;
    }

    setIsGeneratingAudio(true);
    setError("");
    setSuccess("");

    try {
      const { mkdir } = await import("@tauri-apps/plugin-fs");
      
      // Créer le dossier audio
      const audioDir = `${project.path}/audio`;
      try {
        await mkdir(audioDir, { recursive: true });
      } catch {
        // Le dossier existe déjà
      }

      const timestamp = Date.now();
      const outputPath = `${audioDir}/podcast_${timestamp}.wav`;

      // Générer l'audio avec Gemini TTS
      const resultPath = await safeInvoke<string>("generate_voice", {
        text: script,
        apiKey,
        outputPath,
      });

      setSuccess(`Audio généré : ${resultPath}`);
      
      // Estimer la durée (environ 150 mots par minute)
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

  return (
    <div className="script-editor">
      <div className="script-editor-header">
        <h2>📝 Éditeur de Script</h2>
        {lastSaved && (
          <span className="last-saved">Sauvegardé à {lastSaved}</span>
        )}
      </div>

      <div className="url-input-section">
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
            className="btn-generate"
          >
            {isGenerating ? (
              <>
                <span className="spinner"></span>
                Génération...
              </>
            ) : (
              "🤖 Générer le script"
            )}
          </button>
        </div>
        <p className="url-hint">
          Collez l'URL d'un article pour générer automatiquement un script podcast
        </p>
      </div>

      {error && <div className="message error">{error}</div>}
      {success && <div className="message success">{success}</div>}

      <div className="script-content">
        <textarea
          value={script}
          onChange={(e) => setScript(e.target.value)}
          placeholder="Votre script de podcast apparaîtra ici...

Vous pouvez :
- Générer un script depuis une URL
- Écrire ou modifier manuellement
- Le script est sauvegardé automatiquement"
          className="script-textarea"
        />
      </div>

      <div className="script-editor-footer">
        <div className="script-stats">
          <span>{script.split(/\s+/).filter(w => w).length} mots</span>
          <span>~{Math.ceil(script.split(/\s+/).filter(w => w).length / 150)} min</span>
        </div>
        <div className="script-actions">
          <button
            onClick={saveScript}
            className="btn-secondary"
            disabled={!script.trim()}
          >
            💾 Sauvegarder
          </button>
          <button
            onClick={generateAudio}
            disabled={isGeneratingAudio || !script.trim()}
            className="btn-primary"
          >
            {isGeneratingAudio ? (
              <>
                <span className="spinner"></span>
                Génération audio...
              </>
            ) : (
              "🎙️ Générer l'audio"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ScriptEditor;
