import { getChatCompletion, handleTTSStreaming, getAvailableModels } from './aiApi';
import { getContentForTTS } from '../utils/messageParser';

// Machine à états pour la conversation
const CHAT_STATES = {
  IDLE: 'idle',
  LISTENING: 'listening', 
  PROCESSING: 'processing',
  SPEAKING: 'speaking',
  COOLDOWN: 'cooldown'
};

// Transitions autorisées
const ALLOWED_TRANSITIONS = {
  [CHAT_STATES.IDLE]: [CHAT_STATES.LISTENING],
  [CHAT_STATES.LISTENING]: [CHAT_STATES.PROCESSING, CHAT_STATES.IDLE],
  [CHAT_STATES.PROCESSING]: [CHAT_STATES.SPEAKING, CHAT_STATES.IDLE],
  [CHAT_STATES.SPEAKING]: [CHAT_STATES.COOLDOWN, CHAT_STATES.IDLE],
  [CHAT_STATES.COOLDOWN]: [CHAT_STATES.LISTENING, CHAT_STATES.IDLE]
};

// Configuration
const CONFIG = {
  COOLDOWN_DELAY: 1500,        // ms après TTS avant STT
  MIN_TRANSCRIPT_LENGTH: 3,     // Caractères minimum
  DEBOUNCE_DELAY: 1000,        // ms pour debounce
  RECOGNITION_TIMEOUT: 30000,   // ms timeout général
  MAX_RETRY_ATTEMPTS: 3        // Tentatives de redémarrage STT
};

class ChatBotService {
  constructor() {
    this.recognition = null;
    this.stream = null;
    this.context = null;
    this.ttsQueue = [];
    this.isTTSBusy = false;
    this.accumulatedText = '';
    this.streamBuffer = ''; // Buffer pour gérer les balises <think> incomplètes
    this.insideThinking = false; // Flag pour savoir si on est dans une balise <think>
    this.recognitionTimeout = null;
    this.debounceTimer = null;
    this.lastTranscript = '';
    
    // États existants
    this.isConversationActive = false;
    this.isTTSSpeaking = false;
    
    // NOUVEAUX ÉTATS pour la machine à états
    this.currentState = CHAT_STATES.IDLE;
    this.isProcessingUserInput = false;
    this.sttShouldRestart = true;
    this.ttsCompletionTimeout = null;
    this.lastUserTranscript = '';
    this.cooldownActive = false;
    this.retryAttempts = 0;
  }

  // Nouvelle méthode pour gérer les transitions d'état
  transitionToState(newState) {
    const currentTransitions = ALLOWED_TRANSITIONS[this.currentState] || [];
    
    if (!currentTransitions.includes(newState)) {
      console.warn(`⚠️ Transition non autorisée: ${this.currentState} → ${newState}`);
      return false;
    }
    
    console.log(`🔄 Transition d'état: ${this.currentState} → ${newState}`);
    this.currentState = newState;
    return true;
  }

  // Détection si l'IA s'entend parler
  isLikelyBotVoice(transcript) {
    const lowerTranscript = transcript.toLowerCase();
    const botIndicators = [
      lowerTranscript.includes('en tant qu\'assistant'),
      lowerTranscript.includes('je peux vous aider'),
      lowerTranscript.includes('intelligence artificielle'),
      lowerTranscript.includes('je suis ici pour'),
      lowerTranscript.includes('comment puis-je'),
      // Détecter des répétitions de la dernière réponse
      lowerTranscript === this.lastUserTranscript.toLowerCase()
    ];
    
    return botIndicators.some(indicator => indicator);
  }

  // Nouvelle méthode pour extraire le texte sûr pour TTS (sans balises <think> incomplètes)
  extractSafeTextForTTS() {
    let buffer = this.streamBuffer;
    let safeText = '';
    
    while (buffer.length > 0) {
      // Chercher les balises <think>
      const thinkStartIndex = buffer.indexOf('<think>');
      const thinkEndIndex = buffer.indexOf('</think>');
      
      if (thinkStartIndex === -1) {
        // Pas de balise <think>, tout le buffer est sûr
        safeText += buffer;
        this.streamBuffer = '';
        break;
      }
      
      if (thinkStartIndex > 0) {
        // Il y a du texte avant <think>, c'est sûr
        safeText += buffer.substring(0, thinkStartIndex);
        buffer = buffer.substring(thinkStartIndex);
      }
      
      // Maintenant buffer commence par <think>
      if (thinkEndIndex === -1) {
        // <think> n'est pas fermé, on garde tout dans le buffer
        this.streamBuffer = buffer;
        break;
      }
      
      // <think> est fermé, on supprime tout le bloc thinking
      const fullThinkBlock = buffer.substring(0, thinkEndIndex + 8); // +8 pour </think>
      console.log('🧠 Bloc thinking détecté et supprimé:', fullThinkBlock);
      buffer = buffer.substring(thinkEndIndex + 8);
    }
    
    return safeText;
  }

  // Méthodes améliorées pour contrôler la reconnaissance vocale
  pauseListening() {
    console.log('⏸️ Pause STT - État actuel:', this.currentState);
    this.sttShouldRestart = false;
    
    if (this.recognition) {
      try {
        this.recognition.stop();
        this.recognition.abort();
      } catch (e) {
        console.warn('Erreur lors de l\'arrêt STT:', e);
      }
    }
  }

  resumeListening() {
    console.log('▶️ Reprise STT - État actuel:', this.currentState, {
      cooldownActive: this.cooldownActive,
      isConversationActive: this.isConversationActive,
      recognitionExists: !!this.recognition,
      sttShouldRestart: this.sttShouldRestart
    });
    
    // Ne reprend QUE si on est en état LISTENING et pas en cooldown
    if (this.currentState === CHAT_STATES.LISTENING && !this.cooldownActive && this.isConversationActive) {
      this.sttShouldRestart = true;
      
      try {
        if (this.recognition && this.retryAttempts < CONFIG.MAX_RETRY_ATTEMPTS) {
          console.log('🎤 Redémarrage effectif de la reconnaissance vocale');
          this.recognition.start();
          this.retryAttempts = 0; // Reset sur succès
        } else {
          console.log('⚠️ Impossible de redémarrer STT:', {
            recognitionExists: !!this.recognition,
            retryAttempts: this.retryAttempts,
            maxRetry: CONFIG.MAX_RETRY_ATTEMPTS
          });
        }
      } catch (e) {
        console.warn('❌ Erreur lors du redémarrage STT:', e);
        this.retryAttempts++;
        
        if (this.retryAttempts < CONFIG.MAX_RETRY_ATTEMPTS) {
          console.log(`🔄 Nouvelle tentative dans 500ms (tentative ${this.retryAttempts}/${CONFIG.MAX_RETRY_ATTEMPTS})`);
          setTimeout(() => this.resumeListening(), 500);
        } else {
          console.error('❌ Nombre maximum de tentatives atteint pour STT');
        }
      }
    } else {
      console.log('🚫 Conditions non remplies pour reprendre STT:', {
        stateOK: this.currentState === CHAT_STATES.LISTENING,
        cooldownOK: !this.cooldownActive,
        conversationOK: this.isConversationActive
      });
    }
  }

  // Période de cooldown après TTS
  startCooldownPeriod(onQueueEmpty) {
    console.log('❄️ Début période de cooldown');
    this.cooldownActive = true;
    
    // Nettoyer le timeout précédent si existant
    if (this.ttsCompletionTimeout) {
      clearTimeout(this.ttsCompletionTimeout);
    }
    
    this.ttsCompletionTimeout = setTimeout(() => {
      console.log('✅ Fin de cooldown - Redémarrage STT autorisé');
      this.cooldownActive = false;
      
      if (this.isConversationActive && this.currentState === CHAT_STATES.COOLDOWN) {
        console.log('🔄 Transition COOLDOWN → LISTENING');
        this.transitionToState(CHAT_STATES.LISTENING);
        this.resumeListening();
        
        // IMPORTANT: Relancer le timer de 30s maintenant que l'utilisateur peut parler
        this.startTimeout();
        console.log('⏲️ Timer de 30s relancé après cooldown');
      } else {
        console.log('⚠️ Conditions non remplies pour redémarrage STT:', {
          isConversationActive: this.isConversationActive,
          currentState: this.currentState
        });
      }
      
      if (onQueueEmpty) {
        console.log('📞 Appel du callback onQueueEmpty');
        onQueueEmpty();
      } else {
        console.log('⚠️ onQueueEmpty non défini');
      }
    }, CONFIG.COOLDOWN_DELAY);
  }

  async startAudioStream() {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });
    this.stream = stream;
    return stream;
  }

  initializeSpeechRecognition(language, onResult) {
    if (!('webkitSpeechRecognition' in window)) {
      throw new Error("Speech Recognition n'est pas supporté");
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    
    // Use saved language from localStorage or fallback to provided language
    const savedLang = localStorage.getItem('selectedLanguage');
    this.recognition.lang = savedLang || language;
    
    // NOUVELLE LOGIQUE onend avec gestion d'état
    this.recognition.onend = () => {
      console.log('🔄 STT terminé - État:', this.currentState, 'ShouldRestart:', this.sttShouldRestart);
      
      // Ne redémarre QUE si on est en mode LISTENING et autorisé
      if (this.currentState === CHAT_STATES.LISTENING && this.sttShouldRestart && this.isConversationActive) {
        setTimeout(() => {
          if (this.currentState === CHAT_STATES.LISTENING && this.sttShouldRestart) {
            try {
              this.recognition.start();
            } catch (e) {
              console.warn('Erreur redémarrage STT:', e);
            }
          }
        }, 100);
      }
    };
    
    this.recognition.onresult = onResult;
    this.recognition.onerror = (event) => {
      console.error('❌ Erreur STT:', event.error);
      if (event.error === 'aborted') return; // Ignore les erreurs d'arrêt volontaire
      
      // Retry avec délai
      if (this.retryAttempts < CONFIG.MAX_RETRY_ATTEMPTS) {
        this.retryAttempts++;
        setTimeout(() => {
          if (this.currentState === CHAT_STATES.LISTENING) {
            this.resumeListening();
          }
        }, 1000);
      }
    };
  }

  startRecognition() {
    if (this.recognition && this.currentState === CHAT_STATES.LISTENING) {
      try {
        this.recognition.start();
      } catch (e) {
        console.warn('STT déjà en cours:', e);
      }
    }
  }

  stopRecognition() {
    if (this.recognition) {
      this.recognition.stop();
      this.recognition.abort();
    }
  }

  stopAudioStream() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
  }

  initializeAudioContext() {
    this.context = new (window.AudioContext || window.webkitAudioContext)();
  }

  clearTimers() {
    if (this.recognitionTimeout) {
      clearTimeout(this.recognitionTimeout);
      this.recognitionTimeout = null;
    }
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.ttsCompletionTimeout) {
      clearTimeout(this.ttsCompletionTimeout);
      this.ttsCompletionTimeout = null;
    }
  }

  async processSpeechQueue(selectedVoice, onQueueEmpty) {
    if (this.ttsQueue.length === 0) {
      console.log('🏁 Queue TTS terminée');
      this.isTTSBusy = false;
      this.isTTSSpeaking = false;
      
      // Transition vers COOLDOWN au lieu de redémarrer immédiatement
      if (this.currentState === CHAT_STATES.SPEAKING) {
        this.transitionToState(CHAT_STATES.COOLDOWN);
        this.startCooldownPeriod(onQueueEmpty);
      }
      return;
    }

    this.isTTSBusy = true;
    const text = this.ttsQueue.shift();
    
    const utterance = new SpeechSynthesisUtterance(text);
    if (selectedVoice) {
      console.log('🗣️ Utilisation de la voix:', selectedVoice.name);
      utterance.voice = selectedVoice;
    }
    
    utterance.onend = () => {
      // Continue la queue sans redémarrer STT immédiatement
      this.processSpeechQueue(selectedVoice, onQueueEmpty);
    };
    
    utterance.onerror = (event) => {
      console.error('❌ Erreur TTS:', event);
      this.processSpeechQueue(selectedVoice, onQueueEmpty);
    };

    window.speechSynthesis.speak(utterance);
  }

  addToSpeechQueue(text, selectedVoice, onQueueEmpty) {
    // Le filtrage est maintenant fait en amont, donc on peut utiliser le texte directement
    if (!text.trim()) {
      console.log('🚫 Texte vide, pas d\'ajout au TTS');
      return;
    }
    
    console.log('➕ Ajout à la file TTS:', text);
    
    // Si on n'est pas encore en mode SPEAKING, y aller
    if (this.currentState === CHAT_STATES.PROCESSING) {
      this.transitionToState(CHAT_STATES.SPEAKING);
    }
    
    // Si TTS n'est pas encore actif, arrêter STT
    if (!this.isTTSSpeaking) {
      this.isTTSSpeaking = true;
      this.pauseListening();
    }
    
    this.ttsQueue.push(text);
    if (!this.isTTSBusy) {
      this.processSpeechQueue(selectedVoice, onQueueEmpty);
    }
  }

  async handleAIResponse(chatHistory, selectedApi, selectedModel, callbacks) {
    const { onUpdateMessages, onSetAIResponding, addToSpeechQueue, selectedVoice, onQueueEmpty } = callbacks;
    
    try {
      onSetAIResponding(true);
      
      // Réinitialiser le buffer de streaming
      this.streamBuffer = '';
      this.insideThinking = false;
      
      // S'assurer que chatHistory est un tableau
      const history = Array.isArray(chatHistory) ? chatHistory : [chatHistory];
      
      // Validation de l'historique
      if (history.length < 2) {
        console.error('❌ Historique invalide:', history.length, 'messages');
        return;
      }
      
      console.log('✅ Historique reçu dans ChatBotService:', history.length, 'messages');
      console.log('📊 Types de messages:', history.map(m => m.role).join(' → '));
      
      const reader = await getChatCompletion(history, selectedApi, selectedModel).then(body => body.getReader());
      const decoder = new TextDecoder();
      let aiResponse = '';

      // Créer un message vide pour l'assistant
      onUpdateMessages(prev => [...prev, { role: 'assistant', content: '' }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          // Traiter le buffer restant à la fin du stream
          if (this.streamBuffer.trim()) {
            const finalText = getContentForTTS(this.streamBuffer.trim());
            if (finalText.trim()) {
              addToSpeechQueue(finalText, selectedVoice, onQueueEmpty);
            }
          }
          
          if (this.accumulatedText.trim()) {
            // Filtrer le contenu accumulé final avant de l'envoyer au TTS
            const filteredAccumulated = getContentForTTS(this.accumulatedText.trim());
            if (filteredAccumulated.trim()) {
              addToSpeechQueue(filteredAccumulated, selectedVoice, onQueueEmpty);
            }
            this.accumulatedText = '';
          }
          
          // Réinitialiser le buffer
          this.streamBuffer = '';
          this.insideThinking = false;
          
          // IMPORTANT: Marquer la fin du traitement utilisateur ici
          this.isProcessingUserInput = false;
          break;
        }

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim() !== '');

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices[0].delta.content;
            if (!delta) continue;

            aiResponse += delta;

            onUpdateMessages(prev => {
              const newMessages = [...prev];
              newMessages[newMessages.length - 1].content = aiResponse;
              return newMessages;
            });

            // Nouveau système pour gérer les balises <think> incomplètes
            this.streamBuffer += delta;
            
            // Traiter seulement le texte qui ne contient pas de balises <think> incomplètes
            const safeTextForTTS = this.extractSafeTextForTTS();
            
            if (safeTextForTTS) {
              const { remainingText } = handleTTSStreaming(
                safeTextForTTS,
                this.accumulatedText,
                (text) => {
                  console.log('🔊 Envoi au TTS (sûr):', text);
                  this.addToSpeechQueue(text, selectedVoice, onQueueEmpty);
                }
              );
              this.accumulatedText = remainingText;
            }

          } catch (e) {
            console.error('❌ Erreur parsing:', e);
          }
        }
      }

    } catch (error) {
      console.error('❌ Erreur AI:', error);
      this.isProcessingUserInput = false;
      // En cas d'erreur, revenir à l'état LISTENING
      if (this.isConversationActive) {
        this.transitionToState(CHAT_STATES.LISTENING);
        this.resumeListening();
      }
    } finally {
      setTimeout(() => onSetAIResponding(false), 1000);
    }
  }

  cleanup() {
    console.log('🧹 Nettoyage complet du service');
    
    this.transitionToState(CHAT_STATES.IDLE);
    this.clearTimers();
    
    if (this.recognition) {
      this.recognition.stop();
      this.recognition.abort();
    }
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
    }
    window.speechSynthesis.cancel();
    
    // Reset de tous les états
    this.ttsQueue = [];
    this.isTTSBusy = false;
    this.isTTSSpeaking = false;
    this.accumulatedText = '';
    this.streamBuffer = '';
    this.insideThinking = false;
    this.isConversationActive = false;
    this.isProcessingUserInput = false;
    this.sttShouldRestart = true;
    this.lastUserTranscript = '';
    this.cooldownActive = false;
    this.retryAttempts = 0;
  }

  loadVoices(setVoices, setSelectedVoice) {
    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      setVoices(availableVoices);
      
      const savedVoice = localStorage.getItem('selectedVoice');
      const savedLang = localStorage.getItem('selectedLanguage');
      
      let selectedVoice;
      if (savedVoice) {
        selectedVoice = availableVoices.find(v => v.name === savedVoice);
      }
      if (!selectedVoice && savedLang) {
        selectedVoice = availableVoices.find(v => v.lang.startsWith(savedLang));
      }
      if (!selectedVoice) {
        selectedVoice = availableVoices.find(v => v.lang.startsWith(navigator.language)) || availableVoices[0];
      }
      
      setSelectedVoice(selectedVoice);
      if (selectedVoice) {
        localStorage.setItem('selectedVoice', selectedVoice.name);
        localStorage.setItem('selectedLanguage', selectedVoice.lang);
      }
    };

    window.speechSynthesis.onvoiceschanged = loadVoices;
    loadVoices();
  }

  handleVoiceChange(voiceName, voices, setSelectedVoice) {
    const voice = voices.find(v => v.name === voiceName);
    if (voice) {
      setSelectedVoice(voice);
      localStorage.setItem('selectedVoice', voice.name);
      localStorage.setItem('selectedLanguage', voice.lang);
      
      if (this.recognition) {
        this.recognition.lang = voice.lang;
      }
    }
  }

  getAvailableModels(selectedApi) {
    return getAvailableModels(selectedApi);
  }

  startTimeout() {
    if (this.recognitionTimeout) {
      clearTimeout(this.recognitionTimeout);
    }
    
    console.log('⏲️ Démarrage minuterie 30s');
    this.recognitionTimeout = setTimeout(() => {
      console.log('⌛ Temps écoulé sans parole, arrêt de la conversation');
      this.stopChat(false);
    }, CONFIG.RECOGNITION_TIMEOUT);
  }

  stopTimeout() {
    if (this.recognitionTimeout) {
      console.log('⏹️ Arrêt de la minuterie');
      clearTimeout(this.recognitionTimeout);
      this.recognitionTimeout = null;
    }
  }

  debouncedResetTimeout(transcript) {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      console.log('🎤 Activité vocale significative détectée');
      this.startTimeout();
      this.lastTranscript = transcript;
    }, CONFIG.DEBOUNCE_DELAY);
  }

  handleSpeechResult(event, setMessages, messages, handleAIResponse) {
    try {
      if (!event.results[event.resultIndex].isFinal) {
        const transcript = event.results[event.resultIndex][0].transcript.trim();
        if (transcript && transcript.length > 2) {
          this.debouncedResetTimeout(transcript);
        }
        return;
      }

      const transcript = event.results[event.resultIndex][0].transcript.trim();
      if (!transcript) return;

      // NOUVEAU: Vérifications anti-boucle
      if (transcript.length < CONFIG.MIN_TRANSCRIPT_LENGTH) {
        console.log('🚫 Transcript trop court ignoré:', transcript);
        return;
      }

      if (transcript === this.lastUserTranscript) {
        console.log('🚫 Transcript dupliqué ignoré:', transcript);
        return;
      }

      if (this.isLikelyBotVoice(transcript)) {
        console.log('🚫 Transcript suspect (voix IA) ignoré:', transcript);
        return;
      }

      if (this.isProcessingUserInput) {
        console.log('🚫 Traitement en cours, transcript ignoré:', transcript);
        return;
      }

      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
      }

      console.log('✅ Transcription utilisateur valide:', transcript);
      this.lastUserTranscript = transcript;
      this.isProcessingUserInput = true;
      
      // CRUCIAL: Arrêter le timer de timeout car l'IA va traiter
      this.stopTimeout();
      
      // CRUCIAL: Transition immédiate vers PROCESSING
      this.transitionToState(CHAT_STATES.PROCESSING);
      this.pauseListening();
      
      const newMessage = { role: 'user', content: transcript };
      handleAIResponse(newMessage);

    } catch (error) {
      console.error('❌ Erreur transcription:', error);
      this.isProcessingUserInput = false;
      if (this.isConversationActive) {
        this.transitionToState(CHAT_STATES.LISTENING);
        this.resumeListening();
      }
    }
  }

  startChat = async (setIsListening, setIsConversationActive, DEFAULT_LANGUAGE, setMessages, messages, handleAIResponse) => {
    try {
      if (this.isConversationActive) {
        console.log('⚠️ Conversation déjà active');
        return;
      }

      console.log('🎤 Démarrage du chat...');
      this.transitionToState(CHAT_STATES.LISTENING);
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false
        } 
      });
      
      this.stream = stream;
      if (!this.context) {
        this.initializeAudioContext();
      }
      const source = this.context.createMediaStreamSource(stream);
      const analyzer = this.context.createAnalyser();
      source.connect(analyzer);
      
      this.isConversationActive = true;
      this.isProcessingUserInput = false;
      this.sttShouldRestart = true;
      this.retryAttempts = 0;
      
      // Get the current saved language
      const savedLang = localStorage.getItem('selectedLanguage');
      
      if (!this.recognition) {
        this.initializeSpeechRecognition(
          savedLang || DEFAULT_LANGUAGE,
          (event) => this.handleSpeechResult(event, setMessages, messages, handleAIResponse)
        );
      } else {
        // Update the language if it has changed
        this.recognition.lang = savedLang || DEFAULT_LANGUAGE;
      }
      
      this.recognition.start();
      setIsListening(true);
      setIsConversationActive(true);
      this.startTimeout();
      console.log('✅ Chat démarré avec succès - État:', this.currentState);
    } catch (error) {
      console.error('❌ Erreur au démarrage:', error);
      this.transitionToState(CHAT_STATES.IDLE);
      setIsListening(false);
      setIsConversationActive(false);
    }
  };

  stopChat = (keepTTS = false, setIsListening = null, setIsConversationActive = null) => {
    try {
      console.log('🛑 Arrêt complet du chat...');
      
      this.transitionToState(CHAT_STATES.IDLE);
      this.isConversationActive = false;
      this.isProcessingUserInput = false;
      this.sttShouldRestart = false;
      this.cooldownActive = false;
      
      this.clearTimers();
      
      if (this.recognition) {
        this.recognition.stop();
        this.recognition.abort();
      }
      
      if (this.stream) {
        this.stream.getTracks().forEach(track => track.stop());
        this.stream = null;
      }
      
      if (!keepTTS) {
        window.speechSynthesis.cancel();
        this.ttsQueue = [];
        this.isTTSBusy = false;
        this.isTTSSpeaking = false;
        this.accumulatedText = '';
      }
      
      if (setIsListening) setIsListening(false);
      if (setIsConversationActive) setIsConversationActive(false);
      console.log('✅ Chat arrêté avec succès');
    } catch (error) {
      console.error('❌ Erreur à l\'arrêt:', error);
    }
  };
}

export const chatBotService = new ChatBotService();
