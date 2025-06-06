import { useState, useEffect, useRef } from 'react';
import { Mic, Bot, ChevronDown, User } from 'lucide-react';
import { chatBotService } from '../services/ChatBotServices';
import { getInitialGreeting } from '../local/languages';
import MessageContent from './MessageContent';

const VOICE_STORAGE_KEY = 'selectedVoice';
const API_STORAGE_KEY = 'selectedApi';
const MODEL_STORAGE_KEY = 'selectedModel';
const LANG_STORAGE_KEY = 'selectedLanguage';

const DEFAULT_LANGUAGE = localStorage.getItem(LANG_STORAGE_KEY) || navigator.language || 'en-US';

const ChatBot = () => {
  const [isConversationActive, setIsConversationActive] = useState(false);
  const [selectedApi, setSelectedApi] = useState(() => localStorage.getItem(API_STORAGE_KEY) || 'groq');
  const [selectedModel, setSelectedModel] = useState(() => localStorage.getItem(MODEL_STORAGE_KEY) || '');
  const [availableModels, setAvailableModels] = useState([]);
  const [, setIsListening] = useState(false);
  const [voices, setVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(null);
  const [messages, setMessages] = useState([
    {
      role: "system",
      content: `You are a natural NLP conversational chatbot designed to provide detailed and engaging responses on complex topics while maintaining a natural and friendly tone. Avoid using lists or bullet points; instead, express your thoughts fluidly as a human would, particularly when discussing profound ideas. Ensure that you don't dominate the conversation; instead, take the opportunity to elaborate on your answers with relevant thoughts or examples. Refrain from asking questions unless they genuinely enhance the discussion. Utilize natural language processing to facilitate a realistic human-like conversation. Don't use phrases like "How can I help you today," as they detract from a conversational feel. Always respond in the language of the user's question, with the user's default language being: ${localStorage.getItem('selectedLanguage') || DEFAULT_LANGUAGE}. 
      IMPORTANT: DO NOT ASK QUESTION IN YOUR RESPONSES. NEVER. Just talk like a human.  
      Do not use in french for example "vous" in your responses, use "tu" instead. use the informal you. Never respond with Markdown and no formatting`
    },
    {
      role: "assistant",
      content: getInitialGreeting()
    }
  ]);
  const [isAIResponding, setIsAIResponding] = useState(false);

  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);
  const isManualScrolling = useRef(false);
  const autoScrollEnabled = useRef(true);
  const messagesRef = useRef(messages);

  const scrollToBottom = () => {
    if (!autoScrollEnabled.current) return;

    if (messagesEndRef.current && !isManualScrolling.current) {
      messagesEndRef.current.scrollIntoView({
        behavior: "smooth",
        block: "end",
      });
    }
  };

  const handleManualScroll = () => {
    if (!chatContainerRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    const isAtBottom = Math.abs(scrollHeight - clientHeight - scrollTop) < 50;
    
    if (!isAtBottom) {
      autoScrollEnabled.current = false;
      isManualScrolling.current = true;
    } else {
      isManualScrolling.current = false;
    }
  };

  useEffect(() => {
    chatBotService.loadVoices(setVoices, setSelectedVoice, VOICE_STORAGE_KEY, DEFAULT_LANGUAGE);
    return () => {
      chatBotService.cleanup();
    };
  }, []);

  useEffect(() => {
    const models = chatBotService.getAvailableModels(selectedApi);
    setAvailableModels(models);
    // If no model is selected or the selected model is not available for this API
    if (!selectedModel || !models.includes(selectedModel)) {
      setSelectedModel(models[0]);
      localStorage.setItem(MODEL_STORAGE_KEY, models[0]);
    }
  }, [selectedApi]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isAIResponding]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Mettre à jour le message d'accueil quand la langue change
  useEffect(() => {
    if (selectedVoice) {
      const newGreeting = getInitialGreeting();
      setMessages(prev => {
        const newMessages = [...prev];
        // Mettre à jour seulement le message d'accueil (index 1)
        if (newMessages.length > 1 && newMessages[1].role === 'assistant') {
          newMessages[1] = {
            ...newMessages[1],
            content: newGreeting
          };
        }
        return newMessages;
      });
    }
  }, [selectedVoice]);

  const handleSendMessage = async (message) => {
    const userMessage = { role: 'user', content: typeof message === 'string' ? message : message.content };
    
    // Utiliser la référence actuelle des messages pour avoir l'état le plus récent
    const currentMessages = messagesRef.current;
    const updatedMessages = [...currentMessages, userMessage];
    
    // Ajouter le message utilisateur à l'état (logique originale préservée)
    setMessages(prev => [...prev, userMessage]);
    
    console.log('📝 Historique complet envoyé au LLM:', updatedMessages.length, 'messages');
    console.log('📋 Messages:', updatedMessages.map(m => `${m.role}: ${m.content.slice(0, 50)}...`));

    await chatBotService.handleAIResponse(
      updatedMessages,
      selectedApi,
      selectedModel,
      {
        onUpdateMessages: setMessages,
        onSetAIResponding: setIsAIResponding,
        addToSpeechQueue: (text) => chatBotService.addToSpeechQueue(text, selectedVoice, handleTTSComplete),
        selectedVoice
      }
    );
  };

  // NOUVEAU: Callback unique pour la fin du TTS
  const handleTTSComplete = () => {
    console.log('🎯 TTS terminé - Callback depuis ChatBot');
    // Le service gère déjà le redémarrage via la machine à états
  };

  const handleVoiceChange = (voiceName) => {
    const voice = voices.find(v => v.name === voiceName);
    if (voice) {
      setSelectedVoice(voice);
      localStorage.setItem(VOICE_STORAGE_KEY, voice.name);
      localStorage.setItem(LANG_STORAGE_KEY, voice.lang);
      
      if (chatBotService.recognition) {
        chatBotService.recognition.lang = voice.lang;
      }
    }
  };

  const handleApiChange = (apiName) => {
    setSelectedApi(apiName);
    localStorage.setItem(API_STORAGE_KEY, apiName);
  };

  const handleModelChange = (modelName) => {
    setSelectedModel(modelName);
    localStorage.setItem(MODEL_STORAGE_KEY, modelName);
  };

  const initializeAudioContext = () => {
    if (chatBotService && typeof chatBotService.initializeAudioContext === 'function') {
      chatBotService.initializeAudioContext();
    } else {
      console.warn('initializeAudioContext not available');
    }
  };

  return (
    <main className="container mx-auto px-2 sm:px-4 min-h-[100dvh] flex flex-col" onClick={initializeAudioContext}>
      <nav className="sticky top-0 z-10 backdrop-blur-sm bg-slate-800/80 rounded-lg shadow-lg my-2">
        <div className="flex flex-wrap items-center justify-between p-2 sm:p-4 gap-2">
          <div className="flex flex-wrap items-center gap-2 sm:gap-4">
            <button 
              onClick={isConversationActive ? 
                () => chatBotService.stopChat(false, setIsListening, setIsConversationActive) : 
                () => chatBotService.startChat(setIsListening, setIsConversationActive, DEFAULT_LANGUAGE, setMessages, messages, handleSendMessage)}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-md flex items-center gap-2 transition-colors group"
            >
              <Mic className="group-hover:scale-110 transition-transform" />
              <span className="font-medium hidden sm:inline">
                {isConversationActive ? 'Stop' : 'Start'}
              </span>
            </button>
            
            <div className="flex flex-wrap gap-2 sm:gap-4">
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
        </div>
      </nav>

      <div 
        ref={chatContainerRef}
        onScroll={handleManualScroll}
        onWheel={handleManualScroll}
        onTouchMove={handleManualScroll}
        onTouchEnd={() => {
          const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
          const isAtBottom = Math.abs(scrollHeight - clientHeight - scrollTop) < 50;
          if (isAtBottom) {
            isManualScrolling.current = false;
          }
        }}
        className="flex-1 overflow-y-auto pt-2 scrollbar-custom"
        style={{ 
          overflowY: 'auto',
          scrollBehavior: 'smooth'
        }}
      >
        <div className="space-y-4 pb-4 px-4">
          {messages
            .filter(message => message.role !== 'system')
            .map((message, index) => (
            <div key={index} className="flex gap-3 items-start">
              {message.role === 'assistant' ? (
                <Bot className="w-6 h-6 mt-3.5 text-blue-400 flex-shrink-0" />
              ) : (
                <User className="w-6 h-6 mt-3.5 text-red-400 flex-shrink-0" />
              )}
              <div className={`speechBubble ${message.role}`}>
                <MessageContent
                  content={message.content || ''}
                  messageIndex={index}
                />
              </div>
            </div>
          ))}
          <div 
            ref={messagesEndRef} 
            className="h-4"
            style={{ float: 'left', clear: 'both' }}
          />
        </div>
      </div>
    </main>
  );
};

export default ChatBot;
