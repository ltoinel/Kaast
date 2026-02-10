# 🚀 Guide de démarrage

## ⚠️ Important : Comment lancer l'application

### ✅ COMMANDE CORRECTE
```bash
npm run tauri dev
```

### ❌ NE PAS UTILISER
```bash
npm run dev        # ❌ Lance uniquement le frontend web (Tauri non disponible)
npm start          # ❌ Même problème
```

## 🔍 Pourquoi cette différence ?

### `npm run tauri dev` (CORRECT ✅)
- Lance l'application Tauri complète
- Backend Rust + Frontend React
- Accès à toutes les fonctionnalités :
  - ✅ Génération de scripts via Gemini API
  - ✅ Traitement vidéo avec FFmpeg
  - ✅ Toutes les commandes Tauri

### `npm run dev` (INCORRECT ❌)
- Lance uniquement Vite en mode développement web
- Pas de backend Rust
- Erreur : `Cannot read properties of undefined (reading 'invoke')`
- Les commandes Tauri ne fonctionnent pas

## 📋 Étapes de démarrage

### 1. Installation initiale (première fois uniquement)
```bash
# Installer les dépendances frontend
npm install

# Installer Rust (si pas déjà fait)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

### 2. Lancer l'application
```bash
# Depuis le répertoire du projet
cd c:\Users\ltoin\Desktop\Podcast

# Lancer l'application Tauri
npm run tauri dev
```

### 3. Première utilisation
1. L'application se lance
2. Une fenêtre native s'ouvre
3. Le modal de génération de script apparaît
4. Cliquez sur ⚙️ pour configurer votre clé API Gemini
5. Sauvegardez la clé
6. Fermez les paramètres
7. Saisissez une URL et générez votre script !

## 🐞 Résolution des erreurs courantes

### Erreur : `Cannot read properties of undefined (reading 'invoke')`

**Cause** : Vous avez lancé `npm run dev` au lieu de `npm run tauri dev`

**Solution** :
```bash
# Arrêter le serveur actuel (Ctrl+C)
# Puis lancer :
npm run tauri dev
```

### Erreur : `command not found: cargo`

**Cause** : Rust n'est pas installé

**Solution** :
```bash
# Windows (PowerShell)
# Télécharger et installer depuis : https://rustup.rs/

# Linux/Mac
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env
```

### Erreur : FFmpeg non trouvé

**Cause** : FFmpeg n'est pas installé ou pas dans le PATH

**Solution** : Voir [FFMPEG_INSTALL.md](FFMPEG_INSTALL.md)

### Erreur de compilation Rust

**Cause** : Dépendances Rust manquantes ou version trop ancienne

**Solution** :
```bash
# Mettre à jour Rust
rustup update

# Recompiler
npm run tauri dev
```

## 🔧 Commandes disponibles

### Développement
```bash
# Lancer l'application en mode développement
npm run tauri dev

# Compiler uniquement le frontend (sans lancer)
npm run build
```

### Production
```bash
# Créer un exécutable de production
npm run tauri build

# L'exécutable sera dans : src-tauri/target/release/
```

### Nettoyage
```bash
# Nettoyer les builds
npm run clean

# Nettoyer et reinstaller
npm run clean && npm install
```

## 💡 Astuces

### Hot Reload automatique
Lorsque vous lancez `npm run tauri dev` :
- ✅ Les modifications React sont rechargées automatiquement
- ✅ Les modifications Rust recompilent automatiquement
- ⚡ Pas besoin de redémarrer manuellement

### Messages de debugging
Ouvrez les outils développeur (F12 dans l'application) pour voir :
- Console JavaScript
- Erreurs réseau
- Messages de log

### Vérifier l'environnement Tauri
```javascript
// Dans la console du navigateur de l'application
console.log('__TAURI__' in window); // Doit afficher : true
```

## 📊 Workflow de développement recommandé

```
1. Ouvrir le terminal
   ↓
2. cd c:\Users\ltoin\Desktop\Podcast
   ↓
3. npm run tauri dev
   ↓
4. Attendre la compilation (Rust + Vite)
   ↓
5. L'application s'ouvre automatiquement
   ↓
6. Modifier le code (hot reload automatique)
   ↓
7. Tester les changements
   ↓
8. Répéter 6-7
   ↓
9. Ctrl+C pour arrêter
```

## 🎯 Checklist avant de commencer

- [ ] Node.js installé (v18+)
- [ ] Rust installé (v1.70+)
- [ ] FFmpeg installé et dans le PATH
- [ ] Dépendances installées (`npm install`)
- [ ] Terminal dans le bon répertoire
- [ ] **Utiliser `npm run tauri dev` (pas `npm run dev`)**

## ⚡ Démarrage rapide (TL;DR)

```bash
# 1. Aller dans le projet
cd c:\Users\ltoin\Desktop\Podcast

# 2. Installer (première fois)
npm install

# 3. Lancer
npm run tauri dev

# 4. Profit! 🎉
```

---

**💡 Rappel important** : Toujours utiliser `npm run tauri dev` pour lancer l'application complète avec toutes les fonctionnalités !
