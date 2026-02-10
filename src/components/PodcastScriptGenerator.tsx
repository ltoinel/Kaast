import { useState, useEffect } from "react";
import { getStoredApiKey } from "./Settings";
import { safeInvoke, getTauriErrorMessage } from "../utils/tauri";
import "./PodcastScriptGenerator.css";

interface PodcastScriptGeneratorProps {
  onScriptGenerated: (script: string) => void;
  onOpenSettings: () => void;
}

function PodcastScriptGenerator({ onScriptGenerated, onOpenSettings }: PodcastScriptGeneratorProps) {
  const [url, setUrl] = useState("");
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(true);

  useEffect(() => {
    // Charger la clé API sauvegardée
    const savedKey = getStoredApiKey();
    if (savedKey) {
      setGeminiApiKey(savedKey);
    }
  }, []);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!url.trim()) {
      setError("Veuillez entrer une URL");
      return;
    }

    if (!geminiApiKey.trim()) {
      setError("Veuillez entrer votre clé API Gemini");
      return;
    }

    try {
      setIsGenerating(true);
      setError("");

      const script = await safeInvoke<string>("generate_podcast_script", {
        url: url.trim(),
        apiKey: geminiApiKey.trim()
      });

      onScriptGenerated(script);
      setShowForm(false);
    } catch (err) {
      const errorMsg = getTauriErrorMessage(err);
      setError(`⚠️ ${errorMsg}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSkip = () => {
    setShowForm(false);
  };

  if (!showForm) {
    return null;
  }

  return (
    <div className="podcast-overlay">
      <div className="podcast-dialog">
        <h2>🎙️ Générateur de Script Podcast</h2>
        <p className="subtitle">Transformez n'importe quel site web en script de podcast avec l'IA</p>
        
        <form onSubmit={handleGenerate}>
          <div className="form-group">
            <label htmlFor="url">URL du site web</label>
            <input
              id="url"
              type="url"
              placeholder="https://example.com/article"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={isGenerating}
              className="input-field"
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="apiKey">
              Clé API Gemini
              {geminiApiKey ? (
                <span className="saved-indicator">✅ Clé sauvegardée</span>
              ) : (
                <a 
                  href="https://aistudio.google.com/app/apikey" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="api-link"
                >
                  (Obtenir une clé)
                </a>
              )}
            </label>
            <div className="api-key-field">
              <input
                id="apiKey"
                type="password"
                placeholder={geminiApiKey ? "••••••••••••••••" : "Votre clé API Gemini"}
                value={geminiApiKey}
                onChange={(e) => setGeminiApiKey(e.target.value)}
                disabled={isGenerating}
                className="input-field"
              />
              <button
                type="button"
                onClick={onOpenSettings}
                className="btn-settings-inline"
                title="Gérer dans les paramètres"
              >
                ⚙️
              </button>
            </div>
          </div>

          {error && (
            <div className="error-message">
              ⚠️ {error}
            </div>
          )}

          <div className="button-group">
            <button
              type="button"
              onClick={handleSkip}
              disabled={isGenerating}
              className="btn btn-secondary"
            >
              Passer
            </button>
            <button
              type="submit"
              disabled={isGenerating}
              className="btn btn-primary"
            >
              {isGenerating ? "Génération en cours..." : "Générer le script"}
            </button>
          </div>

          {isGenerating && (
            <div className="loading">
              <div className="spinner"></div>
              <p>Analyse du site et génération du script...</p>
            </div>
          )}
        </form>

        <div className="info-box">
          <h4>ℹ️ Comment ça marche ?</h4>
          <ol>
            <li>Entrez l'URL d'un article, blog ou page web</li>
            <li>L'outil extrait le contenu de la page</li>
            <li>Gemini AI génère un script de podcast professionnel</li>
            <li>Utilisez le script pour enregistrer votre podcast</li>
          </ol>
        </div>
      </div>
    </div>
  );
}

export default PodcastScriptGenerator;
