# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/README.md) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

```javascript
// To start the development server, run the following command:
npm run dev;
```

## 🔧 Dépannage - Problème de voix qui se chevauche

### Symptômes
- La synthèse vocale recommence à parler pendant qu'elle parle déjà
- Le texte se réécrit en boucle
- Conflit entre reconnaissance vocale et synthèse vocale

### Solutions techniques

#### 1. Gestion des états de synthèse vocale
```javascript
// Arrêter toute synthèse en cours avant d'en démarrer une nouvelle
const stopAllSpeech = () => {
  window.speechSynthesis.cancel();
};

// Vérifier si la synthèse est en cours
const isSpeaking = () => {
  return window.speechSynthesis.speaking;
};
```

#### 2. Gestion de la reconnaissance vocale
```javascript
// Arrêter la reconnaissance pendant la synthèse
const pauseListeningDuringSpeech = () => {
  if (recognition && recognition.continuous) {
    recognition.stop();
  }
};

// Reprendre l'écoute après la synthèse
speechUtterance.onend = () => {
  if (recognition && isListening) {
    recognition.start();
  }
};
```

#### 3. État de verrouillage (mutex pattern)
```javascript
const [isProcessing, setIsProcessing] = useState(false);

const handleSpeechToText = async () => {
  if (isProcessing) return; // Éviter les appels multiples
  setIsProcessing(true);
  
  // ... logique de traitement ...
  
  setIsProcessing(false);
};
```

#### 4. Débouncing pour éviter les déclenchements multiples
```javascript
import { useCallback } from 'react';
import { debounce } from 'lodash';

const debouncedProcessSpeech = useCallback(
  debounce((text) => {
    // Traitement du texte
  }, 300),
  []
);
```

### Vérifications recommandées
- [ ] Vérifier que `speechSynthesis.cancel()` est appelé avant chaque nouvelle synthèse
- [ ] S'assurer que la reconnaissance vocale s'arrête pendant la synthèse
- [ ] Implémenter un système d'état pour éviter les appels concurrents
- [ ] Ajouter des logs pour déboguer la séquence d'événements