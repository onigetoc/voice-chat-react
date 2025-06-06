// Test de débogage pour vérifier le filtrage TTS
import { getContentForTTS } from './messageParser';

export const debugTTSFiltering = () => {
  console.log('🧪 Test de filtrage TTS');
  console.log('======================');
  
  const testCases = [
    "Bonjour ! <think>Je dois répondre poliment</think> Comment ça va ?",
    "<think>Réflexion complète</think>",
    "Juste du texte normal",
    "Début <think>milieu</think> fin",
    "Multiple <think>un</think> test <think>deux</think> final"
  ];
  
  testCases.forEach((test, index) => {
    console.log(`\nTest ${index + 1}:`);
    console.log('📝 Original:', test);
    console.log('🔊 Pour TTS:', getContentForTTS(test));
    console.log('✅ Filtré:', test.includes('<think>') ? 'OUI' : 'NON');
  });
};

// Ajouter à window pour tests dans la console
if (typeof window !== 'undefined') {
  window.debugTTSFiltering = debugTTSFiltering;
}