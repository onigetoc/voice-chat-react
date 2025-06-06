import { useState, useEffect, useRef } from 'react';
import { Mic, Bot, ChevronDown, User } from 'lucide-react';
import { getChatCompletion, getAvailableModels, handleTTSStreaming } from '../services/aiApi';
import { translations } from '../local/languages';

const DEFAULT_LANGUAGE = navigator.language || 'en-US';
const STORAGE_KEY = 'selectedVoice';

const shortLang = (navigator.language || 'en-US').split('-')[0].toLowerCase();
const initialGreeting = translations[shortLang] || translations.en;

const ChatBot = () => {
  const [isConversationActive, setIsConversationActive] = useState(false);
  const [selectedApi, setSelectedApi] = useState('groq');
  const [selectedModel, setSelectedModel] = useState('');
  const [availableModels, setAvailableModels] = useState([]);
  const [isListening, setIsListening] = useState(false);
  const [voices, setVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(null);
  const [messages, setMessages] = useState([
    {
      role: "system",
      content: `You are a natural NLP conversational chatbot designed to provide detailed and engaging responses on complex topics while maintaining a natural and friendly tone. Avoid using lists or bullet points; instead, express your thoughts fluidly as a human would, particularly when discussing profound ideas. Ensure that you don't dominate the conversation; instead, take the opportunity to elaborate on your answers with relevant thoughts or examples. Refrain from asking questions unless they genuinely enhance the discussion. Utilize natural language processing to facilitate a realistic human-like conversation. Don't use phrases like "How can I help you today," as they detract from a conversational feel. Always respond in the language of the user's question, with the user's default language being: ${DEFAULT_LANGUAGE}. 
      IMPORTANT: DO NOT ASK QUESTION IN YOUR RESPONSES. NEVER. Just talk like a human.  
      Do not use in french for example "vous" in your responses, use "tu" instead. use the informal you`
    },
    {
      role: "assistant", 
      content: initialGreeting
    }
  ]);

  // Refs pour l'audio
  const recognitionRef = useRef(null);
  const streamRef = useRef(null);
  const contextRef = useRef(null);
  const visualizerRef = useRef(null);

  // Ajout des refs pour le TTS
  const ttsQueueRef = useRef([]);
  const isTTSBusyRef = useRef(false);
  const accumulatedTextRef = useRef('');

  const messagesEndRef = useRef(null); // Ajouter cette ref pour le scroll

  // Ajouter une ref pour le timer
  const recognitionTimeoutRef = useRef(null);

  // Ajouter une ref pour le debounce
  const debounceTimerRef = useRef(null);
  const lastTranscriptRef = useRef('');

  // Ajouter un état pour contrôler le scroll automatique
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const chatContainerRef = useRef(null);

  // Ajouter un état pour suivre si l'AI est en train de répondre
  const [isAIResponding, setIsAIResponding] = useState(false);
  const isManualScrolling = useRef(false);

  // Ajouter cette ref pour activer/désactiver le scroll automatique
  const autoScrollEnabled = useRef(true);

  const scrollToBottom = () => {
    if (!autoScrollEnabled.current) return;

    if (messagesEndRef.current && !isManualScrolling.current) {
      messagesEndRef.current.scrollIntoView({
        behavior: "smooth",
        block: "end",
      });
    }
  };

  // Gérer le scroll manuel
  const handleScroll = (e) => {
    if (!chatContainerRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    const isAtBottom = Math.abs(scrollHeight - clientHeight - scrollTop) < 50;
    
    // Réactiver le scroll auto si on est en bas
    isManualScrolling.current = !isAtBottom;
    
    if (isAtBottom) {
      console.log('🔄 Réactivation du scroll automatique');
    }
  };

  // Gérer le scroll manuel de manière plus directe
  const handleManualScroll = () => {
    if (!chatContainerRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    const isAtBottom = Math.abs(scrollHeight - clientHeight - scrollTop) < 50;
    
    if (!isAtBottom) {
      console.log('🖱️ Scroll manuel détecté');
      autoScrollEnabled.current = false; // Désactiver le scroll auto
      isManualScrolling.current = true;
    } else {
      console.log('📜 Retour en bas détecté');
      isManualScrolling.current = false;
    }
  };

  // Modifier l'effet de scroll
  useEffect(() => {}, [messages, isAIResponding]);

  useEffect(() => {
    // Initialisation de base
    if (!('webkitSpeechRecognition' in window)) {
      console.error("Speech Recognition n'est pas supporté");
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.continuous = true;
    recognitionRef.current.interimResults = true;
    recognitionRef.current.lang = DEFAULT_LANGUAGE;

    // Audio Context
    contextRef.current = new (window.AudioContext || window.webkitAudioContext)();

    // Chargement des voix
    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      console.log('Voix disponibles:', availableVoices);
      setVoices(availableVoices);
      
      // Charger la voix sauvegardée ou définir la voix par défaut
      const savedVoice = localStorage.getItem(STORAGE_KEY);
      const defaultVoice = availableVoices.find(v => v.lang.startsWith(DEFAULT_LANGUAGE));
      setSelectedVoice(savedVoice ? availableVoices.find(v => v.name === savedVoice) : defaultVoice);
    };

    window.speechSynthesis.onvoiceschanged = loadVoices;
    loadVoices();

    return () => cleanup();
  }, []);

  // Mettre à jour les modèles disponibles quand l'API change
  useEffect(() => {
    const models = getAvailableModels(selectedApi);
    setAvailableModels(models);
    setSelectedModel(models[0]); // Sélectionner le premier modèle par défaut
  }, [selectedApi]);

  const cleanup = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    window.speechSynthesis.cancel();
  };

  const startTimeout = () => {
    if (recognitionTimeoutRef.current) {
      clearTimeout(recognitionTimeoutRef.current);
    }
    
    console.log('⏲️ Démarrage minuterie 30s');
    recognitionTimeoutRef.current = setTimeout(() => {
      console.log('⌛ Temps écoulé sans parole, arrêt de la conversation');
      setIsConversationActive(false);
      stopChat(false);
    }, 30000);
  };

  const debouncedResetTimeout = (transcript) => {
    // Éviter les réinitialisations trop fréquentes
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Ne réinitialiser que si le transcript a changé significativement
    if (transcript !== lastTranscriptRef.current) {
      debounceTimerRef.current = setTimeout(() => {
        console.log('🎤 Activité vocale significative détectée');
        startTimeout();
        lastTranscriptRef.current = transcript;
      }, 1000); // Attendre 1 seconde avant de réinitialiser
    }
  };

  const handleSpeechResult = (event) => {
    try {
      if (!event.results[event.resultIndex].isFinal) {
        const transcript = event.results[event.resultIndex][0].transcript.trim();
        
        // Ne réinitialiser que si on a un nouveau contenu significatif
        if (transcript && transcript.length > 2) {
          debouncedResetTimeout(transcript);
        }
        return;
      }

      const transcript = event.results[event.resultIndex][0].transcript;
      if (!transcript.trim()) {
        return;
      }

      // Nettoyer les timers
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      console.log('✅ Transcription finale:', transcript);
      stopChat(true);
      
      const newMessage = { role: 'user', content: transcript };
      setMessages(prev => [...prev, newMessage]);
      handleAIResponse([...messages, newMessage]);

    } catch (error) {
      console.error('❌ Erreur transcription:', error);
      stopChat(false);
    }
  };

  const startChat = async () => {
    try {
      if (isConversationActive) {
        console.log('⚠️ Conversation déjà active');
        return;
      }

      console.log('🎤 Démarrage du chat...');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false
        } 
      });
      
      streamRef.current = stream;
      const source = contextRef.current.createMediaStreamSource(stream);
      const analyzer = contextRef.current.createAnalyser();
      source.connect(analyzer);
      
      // Configurer la reconnaissance vocale avant de la démarrer
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = selectedVoice?.lang || DEFAULT_LANGUAGE;
      
      recognitionRef.current.onresult = handleSpeechResult;
      recognitionRef.current.onend = () => {
        console.log('🔄 Reconnaissance terminée');
        // Ne pas redémarrer automatiquement
        setIsListening(false);
      };
      
      recognitionRef.current.start();
      setIsListening(true);
      setIsConversationActive(true);
      startTimeout(); // Un seul démarrage initial du timer
      console.log('✅ Chat démarré avec succès');
    } catch (error) {
      console.error('❌ Erreur au démarrage:', error);
      setIsListening(false);
      setIsConversationActive(false);
    }
  };

  const stopChat = (keepTTS = false) => {
    try {
      console.log('🛑 Arrêt complet du chat...');
      
      // Arrêter le timer
      if (recognitionTimeoutRef.current) {
        clearTimeout(recognitionTimeoutRef.current);
        recognitionTimeoutRef.current = null;
      }

      // Arrêter la reconnaissance vocale
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current.abort(); // Forcer l'arrêt immédiat
      }

      // Arrêter le stream audio
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }

      // Arrêter le TTS sauf si keepTTS est true
      if (!keepTTS) {
        window.speechSynthesis.cancel(); // Arrêter la synthèse vocale en cours
        ttsQueueRef.current = []; // Vider la file d'attente
        isTTSBusyRef.current = false;
        accumulatedTextRef.current = '';
      }

      // Réinitialiser tous les états
      setIsListening(false);
      setIsConversationActive(false); // Marquer la conversation comme terminée

    } catch (error) {
      console.error('❌ Erreur lors de l\'arrêt:', error);
      setIsListening(false);
      setIsConversationActive(false);
    }
  };

  const addToSpeechQueue = (text) => {
    console.log('➕ Ajout à la file TTS:', text);
    ttsQueueRef.current.push(text);
    if (!isTTSBusyRef.current) {
      processSpeechQueue();
    }
  };

  const processSpeechQueue = async () => {
    if (ttsQueueRef.current.length === 0) {
      isTTSBusyRef.current = false;
      console.log('✅ File TTS vide, redémarrage de l\'écoute');
      // Relancer l'écoute quand la file TTS est vide
      startChat();
      return;
    }

    isTTSBusyRef.current = true;
    const text = ttsQueueRef.current.shift();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = selectedVoice;
    utterance.onend = () => {
      console.log('✅ TTS terminé pour:', text);
      processSpeechQueue();
    };

    window.speechSynthesis.speak(utterance);
  };

  // Modifier handleAIResponse pour utiliser l'API et le modèle sélectionnés
  const handleAIResponse = async (chatHistory) => {
    try {
      autoScrollEnabled.current = true; // Réactiver le scroll auto
      setIsAIResponding(true);
      isManualScrolling.current = false;
      let aiResponse = '';
      
      const reader = await getChatCompletion(chatHistory, selectedApi, selectedModel).then(body => body.getReader());
      const decoder = new TextDecoder();

      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          console.log('✅ Réponse AI terminée, traitement du texte restant');
          // Traiter le texte restant et continuer la conversation
          if (accumulatedTextRef.current.trim()) {
            addToSpeechQueue(accumulatedTextRef.current.trim());
            accumulatedTextRef.current = '';
          }
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

            // Mise à jour du dernier message uniquement
            setMessages(prev => {
              const newMessages = [...prev];
              newMessages[newMessages.length - 1].content = aiResponse;
              return newMessages;
            });

            // Gestion TTS phrase par phrase
            const { sentences, remainingText } = handleTTSStreaming(
              delta,
              accumulatedTextRef.current,
              addToSpeechQueue
            );
            accumulatedTextRef.current = remainingText;

          } catch (e) {
            console.error('❌ Erreur parsing:', e);
          }
        }
        // Dans la boucle, scroller si autoScrollEnabled est actif
        if (autoScrollEnabled.current && !isManualScrolling.current) {
          scrollToBottom();
        }
      }

    } catch (error) {
      console.error('❌ Erreur AI:', error);
    } finally {
      // Attendre un peu avant de désactiver isAIResponding
      setTimeout(() => {
        setIsAIResponding(false);
      }, 1000);
      
      if (!isTTSBusyRef.current) {
        startChat();
      }
    }
  };

  const handleVoiceChange = (voiceName) => {
    const voice = voices.find(v => v.name === voiceName);
    if (voice) {
      console.log('🔄 Changement de voix:', voice.name, voice.lang);
      setSelectedVoice(voice);
      localStorage.setItem(STORAGE_KEY, voice.name);
      
      // Arrêter la conversation en cours
      if (isListening) {
        console.log('🛑 Arrêt de la conversation pour changement de voix');
        stopChat(true); // true pour garder le TTS actif
        setTimeout(() => {
          // Mettre à jour la langue de reconnaissance
          if (recognitionRef.current) {
            recognitionRef.current.lang = voice.lang;
            console.log('🌍 Nouvelle langue de reconnaissance:', voice.lang);
          }
          startChat();
        }, 100);
      }
    }
  };

  // Ajouter la fonction de changement d'API
  const handleApiChange = (apiName) => {
    console.log('🔄 Changement d\'API:', apiName);
    setSelectedApi(apiName);
  };

  // Ajouter la fonction handleModelChange
  const handleModelChange = (modelName) => {
    console.log('🤖 Changement de modèle:', modelName);
    setSelectedModel(modelName);
  };

  return (
    <main className="container mx-auto px-2 sm:px-4 min-h-[100dvh] flex flex-col">
      <nav className="sticky top-0 z-10 backdrop-blur-sm bg-slate-800/80 rounded-lg shadow-lg my-2">
        <div className="flex flex-wrap items-center justify-between p-2 sm:p-4 gap-2">
          <div className="flex flex-wrap items-center gap-2 sm:gap-4">
            <button 
              onClick={isConversationActive ? () => stopChat(false) : startChat}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-md flex items-center gap-2 transition-colors group"
            >
              <Mic className="group-hover:scale-110 transition-transform" />
              <span className="font-medium hidden sm:inline">
                {isConversationActive ? 'Stop' : 'Start'}
              </span>
            </button>
            
            {/* Container pour les menus déroulants */}
            <div className="flex flex-wrap gap-2 sm:gap-4">
              {/* Menu des voix */}
              <div className="relative min-w-[140px] sm:min-w-[200px]">
                <select 
                  className="w-full appearance-none bg-slate-700 text-gray-100 border border-slate-600 rounded-md px-2 py-2 pr-8 hover:bg-slate-600 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base"
                  value={selectedVoice?.name || ''}
                  onChange={(e) => handleVoiceChange(e.target.value)}
                >
                  {voices.map(voice => (
                    <option key={voice.name} value={voice.name}>
                      {`${voice.name.split(' ')[0]} (${voice.lang})`}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none text-gray-400" />
              </div>

              {/* Menu des APIs */}
              <div className="relative min-w-[100px] sm:min-w-[120px]">
                <select
                  className="w-full appearance-none bg-slate-700 text-gray-100 border border-slate-600 rounded-md px-2 py-2 pr-8 hover:bg-slate-600 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base"
                  value={selectedApi}
                  onChange={(e) => handleApiChange(e.target.value)}
                >
                  <option value="groq">Groq</option>
                  <option value="openai">OpenAI</option>
                  <option value="xai">X.AI</option>
                  <option value="anthropic">Anthropic</option>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none text-gray-400" />
              </div>

              {/* Menu des modèles */}
              <div className="relative min-w-[140px] sm:min-w-[180px]">
                <select
                  className="w-full appearance-none bg-slate-700 text-gray-100 border border-slate-600 rounded-md px-2 py-2 pr-8 hover:bg-slate-600 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base"
                  value={selectedModel}
                  onChange={(e) => handleModelChange(e.target.value)}
                >
                  {availableModels.map(model => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none text-gray-400" />
              </div>
            </div>
          </div>

          <div 
            ref={visualizerRef}
            className="w-8 h-8 rounded-full bg-red-600/80 transition-transform scale-0 flex-shrink-0"
          />
        </div>
      </nav>

      {/* Modifier le container de messages */}
      <div 
        ref={chatContainerRef}
        onScroll={handleManualScroll}
        onWheel={handleManualScroll} // Ajouter la détection de la molette
        onTouchMove={handleManualScroll} // Ajouter la détection du touch
        onTouchEnd={() => {
          // Vérifier si on est retourné en bas après un touch
          const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
          const isAtBottom = Math.abs(scrollHeight - clientHeight - scrollTop) < 50;
          if (isAtBottom) {
            isManualScrolling.current = false;
          }
        }}
        className="flex-1 overflow-y-auto pt-2 scrollbar-custom"
        style={{ 
          overflowY: 'auto', // Changer 'overlay' en 'auto'
          scrollBehavior: 'smooth'
        }}
      >
        <div className="space-y-4 pb-4 px-4">
          {messages
            .filter(message => message.role !== 'system') // Filtrer les messages système
            .map((message, index) => (
            <div key={index} className="flex gap-3 items-start">
              {message.role === 'assistant' ? (
                <Bot className="w-6 h-6 mt-3.5 text-blue-400 flex-shrink-0" />
              ) : (
                <User className="w-6 h-6 mt-3.5 text-red-400 flex-shrink-0" />
              )}
              <div className={`speechBubble ${message.role}`}>
                {message.content}
              </div>
            </div>
          ))}
          {/* Élément invisible pour le scroll automatique */}
          <div 
            ref={messagesEndRef} 
            className="h-4" // Augmenter la hauteur pour un meilleur scroll
            style={{ float: 'left', clear: 'both' }}
          />
        </div>
      </div>
    </main>
  );
};

export default ChatBot;
