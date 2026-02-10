import { useState } from "react";
import "./ScriptViewer.css";

interface ScriptViewerProps {
  script: string;
}

function ScriptViewer({ script }: ScriptViewerProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const handleCopy = () => {
    navigator.clipboard.writeText(script);
    alert("Script copié dans le presse-papiers !");
  };

  if (!script) {
    return null;
  }

  return (
    <div className={`script-viewer ${isExpanded ? 'expanded' : 'collapsed'}`}>
      <div className="script-header">
        <h3>📝 Script de Podcast Généré</h3>
        <div className="script-actions">
          <button onClick={handleCopy} className="btn-icon" title="Copier">
            📋
          </button>
          <button 
            onClick={() => setIsExpanded(!isExpanded)} 
            className="btn-icon"
            title={isExpanded ? "Réduire" : "Étendre"}
          >
            {isExpanded ? "▼" : "▲"}
          </button>
        </div>
      </div>
      
      {isExpanded && (
        <div className="script-content">
          <pre>{script}</pre>
        </div>
      )}
    </div>
  );
}

export default ScriptViewer;
