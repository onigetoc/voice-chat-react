// TODO
// recognition.start() after 30 second

const DEFAULT_LANGUAGE = navigator.language || 'en-US';
const TOGGLE_BTN = document.getElementById("toggleBtn")
const USER_VISUALIZER = document.getElementById("userVisualizer")
const CHAT_HISTORY = document.getElementById("chatHistory")

const VOICE = window.speechSynthesis

let isChatting = false;
let speechObj = null;
let context = new AudioContext();
let stream = null
let animationId = null
let currentlySpeaking = null

const chatHistory = [{
  role: "system",
  content: "You are a helpful and conversational chatbot. When faced with a complex topic, engage with detailed responses as needed, but always maintain a conversational tone—avoid lists or bullet points. Express your thoughts naturally, as a human would, especially when exploring deep ideas. However, refrain from dominating the conversation. Always respond in the language of the user's question. The user's default language is: "+DEFAULT_LANGUAGE
  // content: "You are conversational and give short responses of no more than 3 sentences, no matter how complex the question. If you get a complex topic, you will engage in conversation rather than give a long response. ALWAYS RESPOND IN THE USER LANGUAGE QUESTION. The user default languagle is: "+DEFAULT_LANGUAGE
}]

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition // SpeechRecognition | undefined

// Déclaration de la file d'attente TTS et des variables associées
const ttsQueue = [];
let isTTSBusy = false;
let accumulatedTextForTTS = ''; // Variable globale pour accumuler le texte

// Déclaration de la variable globale pour la minuterie
let recognitionTimeoutId = null;
let timerStartTime = null; // Ajouter cette ligne pour stocker le temps de démarrage

// Supprimer ces lignes car le select est maintenant dans le HTML
// const VOICE_SELECT = document.createElement('select');
// VOICE_SELECT.id = 'voiceSelect';
// TOGGLE_BTN.parentNode.insertBefore(VOICE_SELECT, TOGGLE_BTN.nextSibling);

// Ajouter après la déclaration des constantes
const VOICE_SELECT = document.getElementById('voiceSelect');
const STORAGE_KEY = 'selectedVoice';

// Ajouter cette fonction pour sélectionner la voix au démarrage
function loadSavedVoice() {
  const savedVoiceName = localStorage.getItem(STORAGE_KEY);
  const voices = VOICE.getVoices();
  
  if (savedVoiceName && voices.length > 0) {
    const savedVoice = voices.find(voice => voice.name === savedVoiceName);
    if (savedVoice) {
      VOICE_SELECT.value = savedVoice.name;
      return;
    }
  }
  
  // Si pas de voix sauvegardée ou non trouvée, sélectionner la voix par défaut
  const defaultVoice = voices.find(voice => voice.lang.startsWith(DEFAULT_LANGUAGE));
  if (defaultVoice) {
    VOICE_SELECT.value = defaultVoice.name;
    localStorage.setItem(STORAGE_KEY, defaultVoice.name);
  }
}

// Fonction pour peupler le menu des voix
function populateVoiceList() {
  const voices = VOICE.getVoices();
  console.log("Voix disponibles:", voices);
  
  if (voices.length === 0) return; // Attendre que les voix soient chargées
  
  VOICE_SELECT.innerHTML = '';
  voices.forEach(voice => {
    const option = document.createElement('option');
    option.value = voice.name;
    option.textContent = `${voice.name} (${voice.lang})`;
    VOICE_SELECT.appendChild(option);
  });
  
  loadSavedVoice(); // Charger la voix sauvegardée après avoir peuplé le select
}

// Attendre que les voix soient chargées
if (VOICE.getVoices().length > 0) {
  populateVoiceList();
} else {
  VOICE.addEventListener('voiceschanged', populateVoiceList);
}

// Ajouter après l'initialisation de VOICE_SELECT
VOICE_SELECT.addEventListener('change', () => {
  const selectedVoice = VOICE.getVoices().find(voice => voice.name === VOICE_SELECT.value);
  if (selectedVoice) {
    localStorage.setItem(STORAGE_KEY, selectedVoice.name);
    // Sauvegarder la sélection
    localStorage.setItem(STORAGE_KEY, VOICE_SELECT.value);
    
    if (isChatting) {
      console.log("Changement de voix - Redémarrage de la conversation");
      stopChat(true); // Passer true pour garder le TTS actif
      setTimeout(() => {
        startChat();
      }, 100); // Petit délai pour assurer la bonne réinitialisation
    } else {
      console.log("Changement de voix - Conversation inactive, pas de redémarrage nécessaire");
    }
  }
});

// Fonction pour démarrer la minuterie
function startTimeout() {
  clearTimeout(recognitionTimeoutId); // S'assurer qu'il n'y a pas de timer existant
  console.log('Minuterie démarrée : 30 secondes');
  timerStartTime = Date.now();
  recognitionTimeoutId = setTimeout(() => {
    console.log('Minuterie déclenchée : Arrêt de la reconnaissance vocale');
    if (speechObj && currentlySpeaking === "user") {
      speechObj.stop();
    }
  }, 30000);
}

// Fonction pour réinitialiser la minuterie
function resetTimeout() {
  if (recognitionTimeoutId) {
    clearTimeout(recognitionTimeoutId);
    console.log('Minuterie réinitialisée');
  }
  if (isChatting) { // Seulement si la conversation est active
    startTimeout();
  }
}

async function startChat() {
  TOGGLE_BTN.innerHTML = '<i data-lucide="mic-off"></i><span>Stop</span>';
  lucide.createIcons();
  speechObj = new SpeechRecognition();
  letUserSpeak();
}

// Modifier la fonction stopChat pour accepter un paramètre
function stopChat(keepTTS = false) {
  if (currentlySpeaking === "user") stopUserRecording();
  if (VOICE.speaking && !keepTTS) {
    VOICE.cancel();
    // Vider la file d'attente TTS seulement si on arrête complètement
    if (!keepTTS) {
      ttsQueue.length = 0;
      isTTSBusy = false;
    }
  }
  // Arrêter la minuterie
  if (recognitionTimeoutId) {
    clearTimeout(recognitionTimeoutId);
    recognitionTimeoutId = null;
    timerStartTime = null;
    console.log('Minuterie arrêtée et réinitialisée lors de l\'arrêt du chat');
  }
  currentlySpeaking = null;
  speechObj = null;
  TOGGLE_BTN.innerHTML = '<i data-lucide="mic"></i><span>Start</span>';
  lucide.createIcons();
}

function appendContent({ role, content }) {
  chatHistory.push({ role, content })
  
  const wrapper = document.createElement('div')
  wrapper.className = 'flex gap-3 items-start'
  
  const icon = document.createElement('i')
  icon.setAttribute('data-lucide', role === 'assistant' ? 'bot' : 'user')
  icon.className = 'w-6 h-6 mt-3.5 text-' + (role === 'assistant' ? 'blue' : 'red') + '-400'
  
  const contentEl = document.createElement('div') // Changé de 'p' à 'div'
  contentEl.innerText = content
  contentEl.className = `speechBubble ${role} bg-slate-800 p-4 rounded-lg shadow flex-1`
  
  wrapper.appendChild(icon)
  wrapper.appendChild(contentEl)
  CHAT_HISTORY.appendChild(wrapper)
  lucide.createIcons()
}

let currentTranscriptEl = null; // Suivre l'élément de transcription en cours

async function letUserSpeak() {
  currentlySpeaking = "user"
  const newStream = await navigator.mediaDevices.getUserMedia({
    // echoCancellation: true, 
    // noiseSuppression: true, 
    // autoGainControl: false,
    // audio: true,

    audio: { 
      echoCancellation: true, 
      noiseSuppression: true, 
      autoGainControl: false  // Désactivé pour une meilleure précision
    }

  })
  stream = newStream
  const source = context.createMediaStreamSource(newStream)
  const analyzer = context.createAnalyser()
  source.connect(analyzer)
  animationId = updateUserBubble(analyzer)
  
  speechObj.start()
  startTimeout(); // Démarrer la minuterie lorsque la reconnaissance vocale commence

  ///// GC continuous - interimResults - lang
  // speechObj.continuous = true;
  // speechObj.interimResults = true;
  speechObj.lang = DEFAULT_LANGUAGE;
  ///////////////////////////////

  // Réactive le gestionnaire onresult pour la transcription
  speechObj.onresult = function transcribe(e) { // e: SpeechRecognitionEvent
    let interimTranscript = '';
    let finalTranscript = '';

    for (let i = e.resultIndex; i < e.results.length; i++) {
      const transcript = e.results[i][0].transcript;
      if (e.results[i].isFinal) {
        finalTranscript += transcript;
      } else {
        interimTranscript += transcript;
      }
    }

    if (finalTranscript) {
      if (currentTranscriptEl) {
        CHAT_HISTORY.removeChild(currentTranscriptEl);
        currentTranscriptEl = null;
      }
      appendContent({ role: currentlySpeaking, content: finalTranscript });
      stopUserRecording();
      resetTimeout();
      letAISpeak();
    }

    if (interimTranscript) {
      resetTimeout(); // Réinitialiser le timer à chaque transcription intermédiaire
      if (!currentTranscriptEl) {
        currentTranscriptEl = document.createElement('p');
        currentTranscriptEl.classList.add('speechBubble', 'user'); // Assurer la classe correcte
        CHAT_HISTORY.append(currentTranscriptEl);
      }
      currentTranscriptEl.innerText = interimTranscript;
    } else {
      if (currentTranscriptEl) {
        CHAT_HISTORY.removeChild(currentTranscriptEl);
        currentTranscriptEl = null;
      }
    }
  }

  // Gérer l'événement d'arrêt de reconnaissance vocale
  speechObj.onend = () => {
    console.log('Reconnaissance vocale arrêtée');
    const elapsedTime = Date.now() - timerStartTime;
    console.log('Temps écoulé : ' + elapsedTime + ' ms');
    
    // Réinitialiser l'interface si l'arrêt n'est pas causé par un clic sur le bouton
    if (currentlySpeaking === "user") {
      isChatting = false;
      TOGGLE_BTN.innerHTML = '<i data-lucide="mic"></i><span>Start</span>';
      lucide.createIcons();
    }
    
    stopUserRecording();
    resetTimeout();
  }
}

// Nouvelle file d'attente pour les phrases à lire
// let isTTSBusy = false;
// let accumulatedTextForTTS = ''; // Variable globale pour accumuler le texte

function addToSpeechQueue(text) {
  ttsQueue.push(text);
  if (!isTTSBusy) {
    processSpeechQueue();
  }
}

function processSpeechQueue() {
  if (ttsQueue.length === 0) {
    isTTSBusy = false;
    console.log('File d\'attente TTS vide. Redémarrage de la reconnaissance vocale.');
    if (isChatting) { // Seulement si la conversation est active
      letUserSpeak();
    }
    return;
  }
  isTTSBusy = true;
  const text = ttsQueue.shift();
  const utterance = new SpeechSynthesisUtterance(text);
  
  // Mise à jour de la sélection de la voix
  const voices = VOICE.getVoices();
  const selectedVoice = voices.find(voice => voice.name === VOICE_SELECT.value);
  console.log("Voix sélectionnée:", selectedVoice); // Debug
  
  if (selectedVoice) {
    utterance.voice = selectedVoice;
    utterance.lang = selectedVoice.lang;
  } else {
    console.warn("Aucune voix sélectionnée, utilisation de la voix par défaut");
  }
  
  utterance.onend = () => {
    processSpeechQueue();
  };
  
  VOICE.speak(utterance);
}

// Fonction pour découper le texte en phrases et les ajouter à la file d'attente
function handleTTSStreaming(text) {
  accumulatedTextForTTS += text; // Accumuler le texte reçu

  // Utiliser une expression régulière pour trouver les fins de phrases
  const sentenceEndRegex = /([.!?:;])\s+/g;
  let match;
  let lastIndex = 0;
  const sentences = [];

  while ((match = sentenceEndRegex.exec(accumulatedTextForTTS)) !== null) {
    const end = match.index + match[1].length;
    const sentence = accumulatedTextForTTS.substring(lastIndex, end).trim();
    if (sentence) {
      sentences.push(sentence);
      console.log('Phrase complétée:', sentence); // Pour le débogage
    }
    lastIndex = sentenceEndRegex.lastIndex;
  }

  // Ajouter les phrases complètes à la file d'attente TTS
  sentences.forEach(sentence => addToSpeechQueue(sentence));

  // Garder le reste du texte qui ne se termine pas par une ponctuation
  accumulatedTextForTTS = accumulatedTextForTTS.substring(lastIndex).trim();

  // Debugging: afficher le texte accumulé restant
  if (accumulatedTextForTTS.length > 0) {
    // console.log('Texte accumulé restant:', accumulatedTextForTTS);
  }
}

async function letAISpeak() {
  currentlySpeaking = "assistant"
  const chatCompletion = "/chat/completions"
  
  const response = await fetch("https://api.x.ai/v1"+chatCompletion, {
    method: "POST",
    body: JSON.stringify({
      model: "grok-beta",
      messages: chatHistory,
      stream: true
    }),
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${GROK_API_KEY}`
    }
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let content = '';
  
  // Créer la structure complète du message comme dans appendContent
  const wrapper = document.createElement('div')
  wrapper.className = 'flex gap-3 items-start'
  
  const icon = document.createElement('i')
  icon.setAttribute('data-lucide', 'bot')
  icon.className = 'w-6 h-6 mt-3.5 text-blue-400'
  
  const contentEl = document.createElement('div')
  contentEl.className = 'speechBubble assistant bg-slate-800 p-4 rounded-lg shadow flex-1'
  
  wrapper.appendChild(icon)
  wrapper.appendChild(contentEl)
  CHAT_HISTORY.appendChild(wrapper)
  lucide.createIcons()

  accumulatedTextForTTS = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split('\n').filter(line => line.trim() !== '');

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') continue;
        
        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices[0].delta.content;
          if (delta) {
            content += delta;
            contentEl.innerText = content;
            handleTTSStreaming(delta); // Envoi des phrases complètes au TTS
          }
        } catch (e) {
          console.error('Error parsing chunk:', e);
        }
      }
    }
  }

  // Envoyer toute phrase restante qui n'a pas été terminée par une ponctuation
  if (accumulatedTextForTTS.trim() !== '') {
    addToSpeechQueue(accumulatedTextForTTS.trim());
    console.log('Phrase finale sans ponctuation:', accumulatedTextForTTS.trim()); // Pour le débogage
    accumulatedTextForTTS = '';
  }

  if (content.trim() !== '') {
    chatHistory.push({ role: 'assistant', content });
    // Optionnel : Vous pouvez désactiver cette partie si vous utilisez uniquement le TTS séparé
    /*
    const spokenResponse = new SpeechSynthesisUtterance(content);
    spokenResponse.onend = () => letUserSpeak();
    VOICE.speak(spokenResponse);
    */
  }
}

function updateUserBubble(analyzer) {
  const fbcArray = new Uint8Array(analyzer.frequencyBinCount)
  analyzer.getByteFrequencyData(fbcArray)
  const level = fbcArray.reduce((accum, val) => accum + val, 0) / fbcArray.length

  USER_VISUALIZER.style.transform = `scale(${level / 10})`
  
  animationId = requestAnimationFrame(() => updateUserBubble(analyzer))
}

function stopUserRecording() {
  cancelAnimationFrame(animationId)
  animationId = null
  if (stream) { // Vérifier si stream existe
    stream.getTracks().forEach(s => s.stop())
    stream = null
  }
  USER_VISUALIZER.style.transform = 'scale(0)'
}

// Corriger le gestionnaire d'événements TOGGLE_BTN pour éviter les duplications
TOGGLE_BTN.addEventListener("click", () => {
  isChatting = !isChatting;
  isChatting ? startChat() : stopChat(false); // Passer false pour arrêter le TTS
});

// Déplacer l'initialisation des voix après le chargement du DOM
document.addEventListener('DOMContentLoaded', () => {
  const voiceSelect = document.getElementById('voiceSelect');
  
  function initVoices() {
    const voices = VOICE.getVoices();
    voiceSelect.innerHTML = '';
    voices.forEach(voice => {
      const option = document.createElement('option');
      option.value = voice.name;
      option.textContent = `${voice.name} (${voice.lang})`;
      if (voice.lang.startsWith(DEFAULT_LANGUAGE)) {
        option.selected = true;
      }
      voiceSelect.appendChild(option);
    });
  }

  if (VOICE.getVoices().length > 0) {
    initVoices();
  }
  VOICE.addEventListener('voiceschanged', initVoices);
});

// Modifier l'initialisation au chargement du DOM
document.addEventListener('DOMContentLoaded', () => {
  // Attendre que les voix soient disponibles
  function initVoices() {
    const voices = VOICE.getVoices();
    const savedVoice = localStorage.getItem(STORAGE_KEY);
    
    if (voices.length === 0) return;
    
    VOICE_SELECT.innerHTML = '';
    voices.forEach(voice => {
      const option = document.createElement('option');
      option.value = voice.name;
      option.textContent = `${voice.name} (${voice.lang})`;
      VOICE_SELECT.appendChild(option);
    });

    // Sélectionner la voix sauvegardée ou la voix par défaut
    if (savedVoice) {
      const savedVoiceExists = voices.find(v => v.name === savedVoice);
      if (savedVoiceExists) {
        VOICE_SELECT.value = savedVoice;
      }
    } else {
      // Sélectionner la première voix correspondant à la langue par défaut
      const defaultVoice = voices.find(voice => voice.lang.startsWith(DEFAULT_LANGUAGE));
      if (defaultVoice) {
        VOICE_SELECT.value = defaultVoice.name;
        localStorage.setItem(STORAGE_KEY, defaultVoice.name);
      }
    }
  }

  // Premier essai
  if (VOICE.getVoices().length > 0) {
    initVoices();
  }
  
  // Écouter les changements de voix disponibles
  VOICE.addEventListener('voiceschanged', initVoices);
});