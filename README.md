# Kaast

Kaast : un éditeur vidéo moderne et performant inspiré de DaVinci Resolve, construit avec Tauri et React.

## Fonctionnalités

- ✂️ **Découper des vidéos** avec FFmpeg
- 🔗 **Fusionner plusieurs vidéos** en une seule
- ✨ **Ajouter des transitions** (fade, dissolve, wipe)
- 📤 **Exporter en MP4** avec différentes qualités
- 🎬 **Aperçu en temps réel**
- ⚡ **Interface réactive** et intuitive
- 🔍 **Vérification FFmpeg** au démarrage

## Technologies

- **Frontend**: React + TypeScript + Vite
- **Backend**: Rust + Tauri 2.0
- **Traitement vidéo**: FFmpeg (via commandes système)
- **Formats supportés**: MP4, AVI, MOV, MKV, WebM

## Prérequis

- [Node.js](https://nodejs.org/) (v18 ou supérieur) ✅
- [Rust](https://www.rust-lang.org/tools/install) ⚠️ **Installez si pas encore fait**
- **FFmpeg** ⚠️ **Requis pour l'export vidéo**
- NPM ou Yarn ✅

### Installation de FFmpeg

**FFmpeg est REQUIS** pour toutes les fonctionnalités de traitement vidéo.

**Windows (avec Chocolatey)** :
```powershell
choco install ffmpeg
```

**macOS** :
```bash
brew install ffmpeg
```

**Linux (Ubuntu/Debian)** :
```bash
sudo apt install ffmpeg
```

📖 Guide complet : [FFMPEG_INSTALL.md](FFMPEG_INSTALL.md)

### Installation de Rust (si pas encore installé)

1. Téléchargez et exécutez [rustup-init.exe](https://win.rustup.rs/)
2. Suivez les instructions de l'installateur
3. Redémarrez votre terminal
4. Vérifiez l'installation : `rustc --version`

### Installation de Rust (macOS/Linux)

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

## Installation

1. Les dépendances npm sont déjà installées ✅
2. Si besoin de réinstaller :
```bash
npm install
```

## Développement

**⚠️ IMPORTANT** : Pour lancer l'application avec toutes les fonctionnalités :

```bash
# ✅ COMMANDE CORRECTE
npm run tauri dev

# ❌ NE PAS UTILISER
npm run dev    # Erreur : Tauri non disponible
```

**Pourquoi ?** `npm run dev` lance uniquement le frontend web sans le backend Rust. Vous obtiendrez l'erreur `Cannot read properties of undefined (reading 'invoke')`.

📖 **Guide complet** : [DEMARRAGE.md](DEMARRAGE.md)

Note : La première compilation peut prendre plusieurs minutes car Rust compile toutes les dépendances.

## Build

Compilez l'application pour production :

```bash
npm run tauri build
```

L'exécutable sera généré dans `src-tauri/target/release/`.

## État du projet

✅ Structure du projet créée  
✅ Frontend React configuré  
✅ Backend Rust/Tauri concomplète  
✅ Composants: Timeline, Aperçu vidéo, Contrôles  
✅ **Intégration FFmpeg fonctionnelle**
✅ **Export MP4 implémenté**
✅ Vérification FFmpeg au démarrage
⏳ Fonctions de découpage et fusion (code prêt, UI à connecter)
⏳ Timeline interactive (à développer)saire  
⏳ Intégration FFmpeg à venir  

## Plateformes supportées

- ✅ Windows 10/11
- ✅ macOS (à tester)
- 🔜 Linux (potentiel)

## Roadmap

- [ ] Intégration FFmpeg pour le traitement vidéo
- [ ] Gestion de la timeline avancée
- [ ] Effets et filtres
- [ ] Export dans différents formats
- [ ] Prévisualisation multi-caméra

## Licence

MIT
