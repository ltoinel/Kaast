# Prochaines étapes 🚀

## 1. Installer FFmpeg (REQUIS)

L'intégration FFmpeg est maintenant **fonctionnelle** ! Installez-le :

### Windows
```powershell
choco install ffmpeg
```
Ou téléchargez depuis : https://www.gyan.dev/ffmpeg/builds/

### macOS
```bash
brew install ffmpeg
```

### Linux
```bash
sudo apt install ffmpeg
```

Vérifiez l'installation :
```bash
ffmpeg -version
```

📖 Guide détaillé : [FFMPEG_INSTALL.md](FFMPEG_INSTALL.md)

## 2. Installer Rust (si pas encore fait)

### Windows
Téléchargez et exécutez : https://win.rustup.rs/

### macOS/Linux
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

Après installation, redémarrez votre terminal et vérifiez :
```bash
rustc --version
```

## 3. Lancer l'application

```bash
npm run tauri dev
```

La première compilation prendra 5-10 minutes (compilation des dépendances Rust).

## 4. Utiliser l'export FFmpeg

L'export MP4 est **maintenant fonctionnel** ! 

### Dans l'interface :
1. Cliquez sur "Charger vidéo"
2. Sélectionnez une vidéo
3. Cliquez sur "Exporter MP4"
4. Choisissez le nom et l'emplacement du fichier
5. FFmpeg générera le MP4 final

### Fonctionnalités implémentées dans le backend :

#### ✅ `check_ffmpeg()` 
Vérifie si FFmpeg est installé (utilisé au démarrage)

#### ✅ `export_project(clips, output_path, quality)`
Exporte le projet final en MP4
- `clips`: Liste des chemins de vidéos
- `output_path`: Chemin de sortie
- `quality`: "ultrafast", "fast", "medium", "slow", "veryslow"

#### ✅ `cut_video(input_path, start, end, output_path)`
Découpe une vidéo
- `start`: Temps de début en secondes
- `end`: Temps de fin en secondes

#### ✅ `merge_videos(input_paths, output_path)`
Fusionne plusieurs vidéos

#### ✅ `add_transition(video1, video2, transition_type, duration, output_path)`
Ajoute une transition entre deux vidéos
- `transition_type`: "fade", "dissolve", "wipeleft"
- `duration`: Durée en secondes

#### ✅ `get_video_info(video_path)`
Obtient les informations d'une vidéo (format JSON)

### Exemple d'utilisation depuis React :

```typescript
import { invoke } from "@tauri-apps/api/core";

// Découper une vidéo
const cutVideo = async () => {
  try {
    const result = await invoke<string>("cut_video", {
      inputPath: "C:/videos/input.mp4",
      start: 10.0,
      end: 30.0,
      outputPath: "C:/videos/output.mp4"
    });
    console.log(result); // "Vidéo découpée avec succès: ..."
  } catch (error) {
    console.error("Erreur:", error);
  }
};

// Fusionner des vidéos
const mergeVideos = async () => {
  const result = await invoke<string>("merge_videos", {
    inputPaths: [
      "C:/videos/clip1.mp4",
      "C:/videos/clip2.mp4",
      "C:/videos/clip3.mp4"
    ],
    outputPath: "C:/videos/merged.mp4"
  });
};

// Exporter le projet
const exportProject = async () => {
  const result = await invoke<string>("export_project", {
    clips: ["C:/videos/clip1.mp4"],
    outputPath: "C:/videos/final.mp4",
    quality: "medium" // ou "fast", "slow", etc.
  }6;
};

// Ajouter une transition
const addTransition = async () => {
  const result = await invoke<string>("add_transition", {
    video1: "C:/videos/clip1.mp4",
    video2: "C:/videos/clip2.mp4",
    transitionType: "fade",
    duration: 1.5,
    outputPath: "C:/videos/with_transition.mp4"
  });
};
```

## 5. Développement avancé

### Timeline interactive

Actuellement la timeline est statique. Pour la rendre fonctionnelle :

1. Ajouter la gestion du drag & drop
2. Implémenter le scrubbing (déplacement dans la vidéo)
3. Afficher les clips avec leur durée
4. Permettre le redimensionnement des clips

### Améliorer le prévisualisateur

1. Ajouter des contrôles play/pause
2. Implémenter la navigation frame par frame
3. Ajouter des marqueurs de début/fin de sélection

## 4. Build pour distribution

Une fois Rust installé et l'application fonctionnelle :

```bash
npm run tauri build
```

L'exécutable sera dans `src-tauri/target/release/bundle/`

## Structure du projet

```
📁 Podcast/
├── 📁 src/                    # Code React/TypeScript
│   ├── 📁 components/         # Composants UI
│   │   ├── VideoPreview.tsx   # Aperçu vidéo
│   │   ├── Timeline.tsx       # Timeline d'édition
│   │   └── Controls.tsx       # Boutons de contrôle
│   ├── App.tsx               # Composant principal
│   └── main.tsx              # Point d'entrée React
├── 📁 src-tauri/              # Code Rust/Tauri
│   ├── 📁 src/
│   │   └── main.rs           # Backend Tauri
│   ├── Cargo.toml            # Dépendances Rust
│   └── tauri.conf.json       # Configuration Tauri
├── package.json              # Dépendances npm
└── README.md                 # Documentation

```

## Ressources utiles

- [Documentation Tauri](https://tauri.app/)
- [FFmpeg Documentation](https://ffmpeg.org/documentation.html)
- [React Documentation](https://react.dev/)
- [Guide Tauri + FFmpeg](https://github.com/tauri-apps/tauri/discussions/3972)

## Questions ?

Consultez le [README.md](README.md) pour plus d'informations.
