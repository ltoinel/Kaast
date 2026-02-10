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

// Révoquer une Blob URL pour libérer la mémoire
export function revokeBlobUrl(url: string | null): void {
  if (url && url.startsWith('blob:')) {
    URL.revokeObjectURL(url);
  }
}

// Charger un fichier audio via la commande Rust (contourne le scope FS)
export async function loadAudioAsBlob(filePath: string): Promise<string> {
  if (!isTauriAvailable()) {
    throw new Error("Tauri non disponible");
  }

  // Méthode principale : commande Rust qui retourne un data URI
  const dataUri = await safeInvoke<string>('read_audio_file', { filePath });
  return dataUri;
}
