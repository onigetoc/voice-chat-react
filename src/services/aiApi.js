const API_CONFIGS = {
  groq: {
    url: 'https://api.groq.com/openai/v1/chat/completions',
    models: ['deepseek-r1-distill-llama-70b', 'llama-3.3-70b-versatile', 'meta-llama/llama-4-scout-17b-16e-instruct',
       'meta-llama/llama-4-maverick-17b-128e-instruct','mistral-saba-24b', 'qwen-qwq-32b'],
    getHeaders: () => ({
      'Authorization': `Bearer ${import.meta.env.VITE_GROQ_API_KEY}`,
      'Content-Type': 'application/json'
    })
  },
  openai: {
    url: 'https://api.openai.com/v1/chat/completions',
    models: ['gpt-4o-mini', 'gpt-4.1-mini-2025-04-14'],
    getHeaders: () => ({
      'Authorization': `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    })
  },
  xai: {
    url: 'https://api.x.ai/v1/chat/completions',
    models: ['grok-beta'],
    getHeaders: () => ({
      'Authorization': `Bearer ${import.meta.env.VITE_GROK_API_KEY}`,
      'Content-Type': 'application/json'
    })
  },
  anthropic: {
    url: 'https://api.anthropic.com/v1/messages',
    models: ['claude-3-5-sonnet-latest', 'claude-3-haiku-20240307'],
    getHeaders: () => ({
      'anthropic-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json'
    })
  }
};

// Ajout des fonctions de gestion du streaming des phrases
const sentenceEndRegex = /([.!?:;])\s+/g;
// const sentenceEndRegex = /([.!?:;,])\s+/g;

export const handleTTSStreaming = (text, accumulatedText = '', onSentenceComplete) => {
  const newAccumulatedText = accumulatedText + text;
  let lastIndex = 0;
  const sentences = [];

  let match;
  while ((match = sentenceEndRegex.exec(newAccumulatedText)) !== null) {
    const end = match.index + match[1].length;
    const sentence = newAccumulatedText.substring(lastIndex, end).trim();
    if (sentence) {
      sentences.push(sentence);
      console.log('🗣️ Nouvelle phrase complète:', sentence);
      onSentenceComplete(sentence);
    }
    lastIndex = sentenceEndRegex.lastIndex;
  }

  // Retourner le texte restant pour la prochaine itération
  return {
    sentences,
    remainingText: newAccumulatedText.substring(lastIndex)
  };
};

export const getAvailableProviders = () => Object.keys(API_CONFIGS);
export const getAvailableModels = (provider) => API_CONFIGS[provider]?.models || [];

export const getChatCompletion = async (messages, provider = 'groq', model = 'llama-3.3-70b-versatile') => {
  console.log(`🤖 API ${provider} - ${messages.length} messages dans l'historique`);
  console.log('📋 Détail historique:');
  messages.forEach((msg, i) => {
    console.log(`  ${i+1}. ${msg.role}: ${msg.content.slice(0, 100)}...`);
  });
  
  if (messages.length < 2) {
    console.warn('⚠️ Pas assez de messages pour une conversation');
    return;
  }

  const config = API_CONFIGS[provider];
  if (!config) throw new Error(`Provider ${provider} non supporté`);

  try {
    console.log('📡 Envoi de la requête avec', messages.length, 'messages...');
    const response = await fetch(config.url, {
      method: 'POST',
      headers: config.getHeaders(),
      body: JSON.stringify({
        model: model,
        messages: messages,
        stream: true,
        max_tokens: 4096,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      throw new Error(`Erreur API: ${response.status}`);
    }

    return response.body;
  } catch (error) {
    console.error('❌ Erreur API:', error);
    throw error;
  }
};
