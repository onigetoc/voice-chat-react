export const translations = {
  en: "Hi! I'm an AI assistant ready to chat with you in a natural, human-like way. Just press Start to begin our conversation.",
  fr: "Salut! Je suis ton assistant IA, prêt à discuter avec toi de manière naturelle et humaine. Appuie sur Start pour commencer notre conversation.",
  es: "¡Hola! Soy tu asistente de IA, listo para charlar contigo de manera natural y humana. Presiona Start para comenzar nuestra conversación.",
  de: "Hallo! Ich bin dein KI-Assistent und freue mich auf ein natürliches Gespräch mit dir. Drücke auf Start, um unsere Unterhaltung zu beginnen.",
  it: "Ciao, come posso aiutarti oggi? Premi il pulsante \"Start\" per chattare.",
  pt: "Olá, como posso te ajudar hoje? Aperte o botão \"Start\" para conversar.",
  ru: "Привет, чем я могу помочь сегодня? Нажмите кнопку \"Start\", чтобы начать чат.",
  zh: "你好，需要我帮你什么吗？按下\"Start\"按钮即可聊天。",
  ja: "こんにちは、今日はどうされましたか？「Start」ボタンを押してチャットを始めてください。",
  ko: "안녕하세요, 무엇을 도와드릴까요? \"Start\" 버튼을 눌러 채팅을 시작하세요.",
  ar: "مرحباً، كيف يمكنني مساعدتك اليوم؟ اضغط زر \"Start\" للدردشة.",
  hi: "नमस्ते, मैं आपकी किस प्रकार सहायता कर सकता हूँ? चैट शुरू करने के लिए \"Start\" बटन दबाएँ।",
  pl: "Cześć, w czym mogę pomóc? Naciśnij przycisk \"Start\", aby rozpocząć czat.",
  nl: "Hallo, hoe kan ik je vandaag helpen? Druk op de knop \"Start\" om te chatten.",
  sv: "Hej, hur kan jag hjälpa dig idag? Tryck på \"Start\"-knappen för att chatta.",
  no: "Hei, hvordan kan jeg hjelpe deg i dag? Trykk på \"Start\"-knappen for å chatte.",
  da: "Hej, hvordan kan jeg hjælpe dig i dag? Tryk på knappen \"Start\" for at chatte.",
  fi: "Hei, miten voin auttaa sinua tänään? Paina \"Start\"-painiketta aloittaaksesi keskustelun.",
  cs: "Ahoj, jak ti mohu dnes pomoci? Stiskni tlačítko \"Start\" pro chat.",
  sk: "Ahoj, ako ti môžem pomôcť dnes? Stlač tlačidlo \"Start\" na chatovanie.",
  hu: "Szia, miben segíthetek ma? Nyomd meg a \"Start\" gombot a csevegéshez.",
  ro: "Bună, cu ce te pot ajuta astăzi? Apasă butonul \"Start\" pentru a conversa.",
  el: "Γεια σου, πώς μπορώ να σε βοηθήσω σήμερα; Πάτησε το κουμπί \"Start\" για να συνομιλήσεις.",
  tr: "Merhaba, bugün size nasıl yardımcı olabilirim? Sohbet başlatmak için \"Start\" düğmesine basın.",
  he: "שלום, איך אוכל לעזור לך היום? לחץ על כפתור \"Start\" כדי לשוחח.",
  bn: "হ্যালো, আমি আজ কিভাবে সাহায্য করতে পারি? চ্যাট শুরু করতে \"Start\" বাটন টিপুন।",
  th: "สวัสดีค่ะ มีอะไรให้ช่วยไหมคะ? กดปุ่ม \"Start\" เพื่อเริ่มสนทนาได้เลย",
  vi: "Xin chào, mình có thể giúp gì cho bạn hôm nay? Nhấn nút \"Start\" để trò chuyện.",
  id: "Halo, bagaimana saya bisa membantu Anda hari ini? Tekan tombol \"Start\" untuk berbincang.",
  ms: "Hai, bagaimana saya boleh membantu anda hari ini? Tekan butang \"Start\" untuk berbual.",
  tl: "Kamusta, paano kita matutulungan ngayon? I-tap ang \"Start\" button upang makipag-chat.",
  uk: "Привіт, чим можу допомогти? Натисніть кнопку \"Start\", щоб почати чат."
};

// Traductions pour "Processus de réflexion"
export const thinkingLabels = {
  en: "Thinking...",
  fr: "Réflexion...",
  es: "Pensando...",
  de: "Denken...",
  it: "Pensando...",
  pt: "Pensando...",
  ru: "Размышление...",
  zh: "思考中...",
  ja: "考え中...",
  ko: "생각 중...",
  ar: "تفكير...",
  hi: "सोच रहा हूं...",
  pl: "Myślenie...",
  nl: "Denken...",
  sv: "Tänker...",
  no: "Tenker...",
  da: "Tænker...",
  fi: "Ajattelen...",
  cs: "Myšlení...",
  sk: "Myslenie...",
  hu: "Gondolkodás...",
  ro: "Gândire...",
  el: "Σκέψη...",
  tr: "Düşünme...",
  he: "חושב...",
  bn: "চিন্তা করা...",
  th: "กำลังคิด...",
  vi: "Đang suy nghĩ...",
  id: "Berpikir...",
  ms: "Berfikir...",
  tl: "Nag-iisip...",
  uk: "Розмірковування..."
};

// Get the initial greeting based on saved language or browser language
export const getInitialGreeting = () => {
  const savedLang = localStorage.getItem('selectedLanguage');
  const browserLang = (navigator.language || 'en-US').split('-')[0].toLowerCase();
  const lang = savedLang ? savedLang.split('-')[0].toLowerCase() : browserLang;
  
  return translations[lang] || translations.en;
};

// Get the thinking label based on saved language or browser language
export const getThinkingLabel = () => {
  const savedLang = localStorage.getItem('selectedLanguage');
  const browserLang = (navigator.language || 'en-US').split('-')[0].toLowerCase();
  const lang = savedLang ? savedLang.split('-')[0].toLowerCase() : browserLang;
  
  return thinkingLabels[lang] || thinkingLabels.en;
};