/**
 * Utilitaires pour gérer les appels Tauri en toute sécurité
 */

// Vérifier si nous sommes dans un environnement Tauri v2
export function isTauriAvailable(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

// Wrapper sécurisé pour invoke
export async function safeInvoke<T>(
  command: string,
  args?: Record<string, unknown>
): Promise<T> {
  if (!isTauriAvailable()) {
    throw new Error(
      "L'application doit être lancée avec Tauri. Utilisez 'npm run tauri dev' au lieu de 'npm run dev'"
    );
  }

  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<T>(command, args);
  } catch (error) {
    console.error(`Erreur lors de l'appel à ${command}:`, error);
    throw error;
  }
}

// Obtenir un message d'erreur convivial
export function getTauriErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.message.includes("doit être lancée avec Tauri")) {
      return "⚠️ L'application doit être lancée avec 'npm run tauri dev'";
    }
    return error.message;
  }
  return String(error);
}

// Convertir un chemin de fichier en URL utilisable par le webview
export async function convertToAssetUrl(filePath: string): Promise<string> {
  if (!isTauriAvailable()) {
    // En mode navigateur, tenter file:// (ne fonctionnera probablement pas)
    return `file://${filePath}`;
  }

  try {
    // Essayer d'abord convertFileSrc
    const { convertFileSrc } = await import('@tauri-apps/api/core');
    return convertFileSrc(filePath);
  } catch (error) {
    console.error("Erreur convertFileSrc:", error);
    return `file://${filePath}`;
  }
}

// Charger un fichier audio en tant que Blob URL (plus fiable)
export async function loadAudioAsBlob(filePath: string): Promise<string> {
  if (!isTauriAvailable()) {
    throw new Error("Tauri non disponible");
  }

  try {
    const { readFile } = await import('@tauri-apps/plugin-fs');
    const bytes = await readFile(filePath);
    
    // Déterminer le type MIME
    const ext = filePath.split('.').pop()?.toLowerCase() || '';
    const mimeTypes: Record<string, string> = {
      'mp3': 'audio/mpeg',
      'wav': 'audio/wav',
      'm4a': 'audio/mp4',
      'ogg': 'audio/ogg',
      'flac': 'audio/flac',
    };
    const mimeType = mimeTypes[ext] || 'audio/mpeg';
    
    // Créer un Blob et une URL
    const blob = new Blob([bytes], { type: mimeType });
    return URL.createObjectURL(blob);
  } catch (error) {
    console.error("Erreur chargement audio:", error);
    throw error;
  }
}
