/**
 * Parse le contenu d'un message pour extraire les sections de réflexion (<think>)
 * et le contenu normal qui sera lu par le TTS
 * @param {string} content - Le contenu du message à parser
 * @returns {Object} - { normalContent, thinkingContent, hasThinkg }
 */
export const parseMessageContent = (content) => {
  if (!content || typeof content !== 'string') {
    return {
      normalContent: content || '',
      thinkingContent: null,
      hasThinking: false
    };
  }

  // Regex pour trouver toutes les balises <think>...</think>
  const thinkRegex = /<think>([\s\S]*?)<\/think>/gi;
  const thinkMatches = [];
  let match;

  // Reset regex pour extraire le contenu
  thinkRegex.lastIndex = 0;
  
  // Extraire tout le contenu des balises <think>
  while ((match = thinkRegex.exec(content)) !== null) {
    thinkMatches.push(match[1].trim());
  }

  // Reset regex pour supprimer les balises
  thinkRegex.lastIndex = 0;
  
  // Supprimer toutes les balises <think> du contenu normal (pour le TTS)
  const normalContent = content.replace(thinkRegex, ' ').replace(/\s+/g, ' ').trim();

  // Combiner tous les contenus de réflexion
  const thinkingContent = thinkMatches.length > 0 ? thinkMatches.join('\n\n---\n\n') : null;

  return {
    normalContent,
    thinkingContent,
    hasThinking: thinkMatches.length > 0
  };
};

/**
 * Retourne seulement le contenu qui doit être lu par le TTS
 * (excluant les balises <think>)
 * @param {string} content - Le contenu du message
 * @returns {string} - Le contenu sans les balises <think>
 */
export const getContentForTTS = (content) => {
  if (!content) return '';
  
  const { normalContent } = parseMessageContent(content);
  return normalContent;
};