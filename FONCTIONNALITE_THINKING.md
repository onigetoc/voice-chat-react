# Fonctionnalité <think> pour les Modèles Deep-Seekers

## Vue d'ensemble

Cette fonctionnalité permet aux modèles d'IA de type "deep-seekers" d'afficher leur processus de réflexion interne tout en gardant une séparation claire entre le contenu visible par défaut et les pensées internes.

## Comment ça fonctionne

### Balises `<think>`

Les modèles peuvent maintenant utiliser des balises `<think>` pour encapsuler leurs processus de réflexion :

```
Voici ma réponse visible. <think>Ici je réfléchis à la meilleure façon de continuer...</think> Et voici la suite de ma réponse.
```

### Affichage

- **Contenu normal** : Affiché directement dans la bulle de conversation
- **Contenu thinking** : Masqué dans un accordéon cliquable avec l'icône 🧠
- **Indicateur visuel** : Une ligne avec "Processus de réflexion" et une flèche pour développer

### TTS (Text-To-Speech)

Le système TTS ne lit **jamais** le contenu des balises `<think>`. Seul le contenu normal est vocalisé.

## Implémentation technique

### Composants créés

1. **`ThinkingAccordion.jsx`** : Composant d'accordéon pour afficher les sections de réflexion
2. **`MessageContent.jsx`** : Composant qui gère l'affichage des messages avec parsing des balises
3. **`messageParser.js`** : Utilitaires pour parser et traiter le contenu des messages

### Fonctions utilitaires

```javascript
// Parse un message et sépare le contenu normal du contenu thinking
parseMessageContent(content) 

// Retourne seulement le contenu pour le TTS (sans les balises <think>)
getContentForTTS(content)
```

### Modifications des services

- **ChatBotServices.js** : Filtrage automatique du contenu TTS
- **Intégration dans le flux de streaming** : Les balises sont filtrées en temps réel

## Utilisation

### Pour les développeurs

1. Les modèles utilisent naturellement les balises `<think>` dans leurs réponses
2. Le système se charge automatiquement du parsing et de l'affichage
3. Le TTS est automatiquement filtré

### Pour les utilisateurs

1. Les messages avec des sections de réflexion affichent un indicateur "Processus de réflexion"
2. Cliquer sur la flèche développe/réduit la section
3. Le contenu de réflexion est stylisé différemment (fond violet, police monospace)

## Styles CSS

Des styles spéciaux ont été ajoutés pour :
- Animation d'ouverture/fermeture de l'accordéon
- Gradient de fond violet pour les sections thinking
- Effets de hover et transitions fluides
- Icônes animées

## Exemple d'utilisation

```javascript
// Message d'exemple d'un modèle
const messageContent = `
Bonjour ! <think>L'utilisateur me salue, je dois répondre de manière amicale. 
Je vais aussi expliquer cette nouvelle fonctionnalité.</think> 
Comment puis-je vous aider aujourd'hui ? 
<think>Je devrais mentionner que mes réflexions sont maintenant visibles.</think>
Vous pouvez voir mes processus de réflexion en cliquant sur les sections accordéon !
`;
```

## Test

Un fichier de test `testThinkingFeature.js` est disponible pour vérifier le bon fonctionnement :

```javascript
import { testThinkingFeature } from './src/utils/testThinkingFeature.js';
testThinkingFeature(); // Lance les tests dans la console
```

## Configuration

La fonctionnalité est automatiquement activée. Aucune configuration supplémentaire n'est nécessaire.

## Compatibilité

- ✅ Fonctionne avec tous les modèles d'IA supportés
- ✅ Compatible avec le streaming de réponses
- ✅ Intégré au système TTS existant
- ✅ Responsive design pour mobile et desktop