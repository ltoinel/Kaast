# 🔑 Guide des Paramètres - Clé API Gemini

## Vue d'ensemble

Le Studio Podcast permet maintenant de sauvegarder votre clé API Gemini dans les paramètres, afin de ne pas avoir à la ressaisir à chaque démarrage.

## ✨ Fonctionnalités

### Sauvegarde de la clé API
- **Stockage local** : Votre clé est stockée uniquement dans votre navigateur (localStorage)
- **Sécurité** : La clé n'est jamais envoyée à nos serveurs
- **Persistance** : Une fois sauvegardée, elle est automatiquement chargée au démarrage
- **Gestion facile** : Modifier ou supprimer votre clé en quelques clics

### Interfaces disponibles

#### 1. Page de Paramètres ⚙️
Accès depuis le bouton ⚙️ dans l'en-tête de l'application.

**Fonctions disponibles :**
- Saisir une nouvelle clé API
- Afficher/masquer la clé avec le bouton 👁️
- Sauvegarder la clé pour une utilisation future
- Supprimer définitivement la clé stockée
- Lien direct vers Google AI Studio pour obtenir une clé

#### 2. Modal de génération de script
Le modal de génération affiche maintenant :
- ✅ Indicateur "Clé sauvegardée" si une clé existe
- Accès rapide aux paramètres via le bouton ⚙️
- Possibilité d'utiliser la clé sauvegardée ou d'en saisir une nouvelle

## 📝 Guide d'utilisation

### Première utilisation

1. **Ouvrir les paramètres**
   - Cliquez sur le bouton ⚙️ dans l'en-tête
   - OU cliquez sur ⚙️ dans le modal de génération

2. **Obtenir une clé API Gemini**
   - Suivez le lien vers [Google AI Studio](https://aistudio.google.com/app/apikey)
   - Connectez-vous avec votre compte Google
   - Cliquez sur "Create API Key"
   - Copiez la clé générée (format : `AIzaSy...`)

3. **Sauvegarder votre clé**
   - Collez la clé dans le champ "Clé API Gemini"
   - Cliquez sur 💾 Sauvegarder
   - Vous verrez le message : ✅ Clé API sauvegardée avec succès !

4. **Utiliser votre clé**
   - Fermez les paramètres
   - La clé sera automatiquement utilisée pour générer vos scripts
   - Plus besoin de la ressaisir !

### Utiliser une clé sauvegardée

Lorsque vous avez déjà sauvegardé une clé :

1. Au démarrage, le modal affiche **✅ Clé sauvegardée**
2. Il vous suffit de saisir l'URL du site
3. Cliquez sur **Générer** sans ressaisir la clé
4. Le système utilise automatiquement votre clé sauvegardée

### Modifier votre clé

1. Ouvrez les paramètres ⚙️
2. Le champ affiche la clé actuelle (masquée par •••)
3. Cliquez sur 👁️ pour afficher la clé
4. Modifiez la clé
5. Cliquez sur 💾 Sauvegarder

### Supprimer votre clé

1. Ouvrez les paramètres ⚙️
2. Cliquez sur 🗑️ Supprimer
3. Confirmez la suppression
4. La clé est définitivement supprimée de votre navigateur

## 🔒 Sécurité et confidentialité

### Où est stockée ma clé ?
- **LocalStorage du navigateur** : Stockage local uniquement
- **Jamais dans le cloud** : Aucune synchronisation externe
- **Jamais sur nos serveurs** : Votre clé reste sur votre machine

### Comment est-elle protégée ?
- Champ de saisie masqué par défaut (type password)
- Bouton pour afficher/masquer temporairement
- Stockage chiffré par le navigateur selon les standards HTML5

### Que se passe-t-il si je supprime les données du navigateur ?
Si vous videz le cache ou les données de navigation :
- La clé sera supprimée
- Vous devrez la ressaisir dans les paramètres
- Aucune donnée n'est perdue ailleurs (elle n'existe que localement)

## 🔄 Flux de travail recommandé

### Configuration initiale
```
1. Premier lancement
   ↓
2. Modal de génération s'affiche
   ↓
3. Clic sur ⚙️ dans le modal
   ↓
4. Saisir et sauvegarder la clé API
   ↓
5. Fermer les paramètres
   ↓
6. La clé est maintenant pré-remplie !
```

### Utilisation quotidienne
```
1. Lancer l'application
   ↓
2. Modal affiche "✅ Clé sauvegardée"
   ↓
3. Saisir uniquement l'URL
   ↓
4. Générer le script
```

## 🛠️ Détails techniques

### Technologies utilisées
- **localStorage API** : Stockage clé-valeur natif du navigateur
- **React hooks** : useState, useEffect pour la gestion d'état
- **Validation** : Vérification de présence de la clé avant sauvegarde

### Structure de stockage
```javascript
// Clé de stockage
const STORAGE_KEY = "gemini_api_key";

// Sauvegarder
localStorage.setItem(STORAGE_KEY, apiKey);

// Charger
const savedKey = localStorage.getItem(STORAGE_KEY);

// Supprimer
localStorage.removeItem(STORAGE_KEY);
```

### Fonction utilitaire exportée
```typescript
// Dans Settings.tsx
export function getStoredApiKey(): string | null {
  return localStorage.getItem("gemini_api_key");
}

// Utilisable dans d'autres composants
import { getStoredApiKey } from "./components/Settings";
const apiKey = getStoredApiKey();
```

## ❓ FAQ

### Q : Puis-je avoir plusieurs clés API ?
**R :** Non, une seule clé peut être sauvegardée à la fois. Vous pouvez la modifier à tout moment dans les paramètres.

### Q : Ma clé fonctionne-t-elle sur plusieurs machines ?
**R :** Non, la clé est stockée localement dans le navigateur de chaque machine. Vous devrez la saisir sur chaque ordinateur.

### Q : Que faire si ma clé API expire ?
**R :** 
1. Obtenez une nouvelle clé sur Google AI Studio
2. Ouvrez les paramètres ⚙️
3. Remplacez l'ancienne clé par la nouvelle
4. Sauvegardez

### Q : Puis-je utiliser une clé différente ponctuellement ?
**R :** Oui ! Dans le modal de génération, vous pouvez :
- Effacer le champ de clé API
- Saisir une autre clé temporaire
- Générer le script
- La clé sauvegardée ne sera pas modifiée

### Q : Comment vérifier quelle clé est sauvegardée ?
**R :** 
1. Ouvrez les paramètres ⚙️
2. Cliquez sur le bouton 👁️ pour afficher la clé

### Q : La clé est-elle partagée entre différents navigateurs ?
**R :** Non, chaque navigateur a son propre localStorage. La clé sauvegardée dans Chrome ne sera pas accessible dans Firefox.

## 🎯 Raccourcis utiles

| Action | Chemin |
|--------|--------|
| Ouvrir paramètres | Bouton ⚙️ dans l'en-tête |
| Accès rapide depuis modal | Bouton ⚙️ à côté du champ clé API |
| Nouveau script | Bouton 📝 dans l'en-tête |
| Afficher/masquer clé | Bouton 👁️ dans les paramètres |

## ✅ Bonnes pratiques

1. **Sauvegardez votre clé dès la première utilisation**
   - Gain de temps considérable
   - Évite les erreurs de saisie

2. **Gardez votre clé confidentielle**
   - Ne la partagez jamais
   - Ne la publiez pas sur GitHub ou forums

3. **Vérifiez la clé si les générations échouent**
   - La clé peut avoir expiré
   - Vérifiez les quotas sur Google AI Studio

4. **Supprimez la clé si vous partagez la machine**
   - Utilisez 🗑️ Supprimer avant de prêter l'ordinateur
   - Ressaisissez-la quand vous récupérez la machine

## 🚀 Mises à jour futures possibles

- [ ] Export/import de configuration
- [ ] Gestion de plusieurs profils
- [ ] Synchronisation cloud optionnelle (chiffrée)
- [ ] Test de validité de la clé
- [ ] Historique des clés utilisées

---

**💡 Astuce finale** : Une fois la clé sauvegardée, vous n'avez plus qu'à saisir l'URL du site pour générer un script de podcast instantanément !
