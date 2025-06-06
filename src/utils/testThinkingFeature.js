// Test de la fonctionnalité <think> pour les modèles deep-seekers
import { parseMessageContent, getContentForTTS } from './messageParser';

// Exemples de messages avec balises <think>
const testMessages = [
  {
    content: "Bonjour ! <think>L'utilisateur me salue, je dois répondre de manière amicale et naturelle.</think> Comment allez-vous aujourd'hui ?",
    expected: {
      normalContent: "Bonjour ! Comment allez-vous aujourd'hui ?",
      hasThinking: true
    }
  },
  {
    content: "<think>Cette question est complexe, je dois analyser plusieurs aspects avant de répondre.</think> Pour répondre à votre question, il faut considérer plusieurs facteurs importants.",
    expected: {
      normalContent: "Pour répondre à votre question, il faut considérer plusieurs facteurs importants.",
      hasThinking: true
    }
  },
  {
    content: "Voici ma réponse simple sans réflexion.",
    expected: {
      normalContent: "Voici ma réponse simple sans réflexion.",
      hasThinking: false
    }
  },
  {
    content: "Premier paragraphe. <think>Je réfléchis à la suite de ma réponse. Comment puis-je mieux expliquer ce concept ?</think> Deuxième paragraphe avec l'explication. <think>Je pense que c'est suffisant pour maintenant.</think> Conclusion finale.",
    expected: {
      normalContent: "Premier paragraphe. Deuxième paragraphe avec l'explication. Conclusion finale.",
      hasThinking: true
    }
  }
];

// Fonction de test
export const testThinkingFeature = () => {
  console.log('🧪 Test de la fonctionnalité <think>');
  console.log('=====================================\n');

  testMessages.forEach((testCase, index) => {
    console.log(`Test ${index + 1}:`);
    console.log('📝 Message original:', testCase.content);
    
    const parsed = parseMessageContent(testCase.content);
    const ttsContent = getContentForTTS(testCase.content);
    
    console.log('✅ Contenu normal (affiché):', parsed.normalContent);
    console.log('🧠 Contenu thinking:', parsed.thinkingContent || 'Aucun');
    console.log('🔊 Contenu TTS:', ttsContent);
    console.log('🎯 A des sections thinking:', parsed.hasThinking);
    
    // Vérification des attentes
    const normalOK = parsed.normalContent.trim() === testCase.expected.normalContent.trim();
    const thinkingOK = parsed.hasThinking === testCase.expected.hasThinking;
    
    console.log('✓ Test réussi:', normalOK && thinkingOK ? '✅' : '❌');
    console.log('─'.repeat(50));
  });
  
  console.log('\n🎉 Tests terminés !');
};

// Exporter pour utilisation dans la console
if (typeof window !== 'undefined') {
  window.testThinkingFeature = testThinkingFeature;
}