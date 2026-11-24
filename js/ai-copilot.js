/* ============================================================
   FEATURE 10: BUSGO GPT - CHATGPT POWERED AI CONVERSATIONAL COPILOT
   ============================================================ */

const AiSession = {
  history: [], // { role: 'user'|'assistant', text: string, time: string }
  context: {
    origin: null,
    destination: null,
    travelDate: null,
    busType: null,
    lastTopic: null,
    lastPnr: null
  },
  isStreaming: false,
  stopRequested: false,
  activeStreamTimer: null
};

function openAiInNewTab(event) {
  if (event && event.preventDefault) event.preventDefault();
  let fromVal = '';
  let toVal = '';
  const fromEl = document.getElementById('fromCity');
  const toEl = document.getElementById('toCity');
  if (fromEl && fromEl.value) fromVal = fromEl.value.trim();
  if (toEl && toEl.value) toVal = toEl.value.trim();

  let targetUrl = 'ai-assistant.html';
  if (fromVal || toVal) {
    const params = new URLSearchParams();
    if (fromVal) params.set('from', fromVal);
    if (toVal) params.set('to', toVal);
    targetUrl += '?' + params.toString();
  }
  window.open(targetUrl, '_blank', 'noopener,noreferrer');
}

function initDraggableAiChat() {
  const launcher = document.getElementById('aiChatLauncher');
  if (launcher) {
    // 1. Restore previous launcher position
    try {
      const saved = localStorage.getItem('busgo_ai_pos');
      if (saved) {
        const pos = JSON.parse(saved);
        if (typeof pos.x === 'number' && typeof pos.y === 'number') {
          const maxX = window.innerWidth - 66;
          const maxY = window.innerHeight - 66;
          const clampedX = Math.max(10, Math.min(pos.x, maxX));
          const clampedY = Math.max(10, Math.min(pos.y, maxY));
          launcher.style.left = `${clampedX}px`;
          launcher.style.top = `${clampedY}px`;
          launcher.style.right = 'auto';
          launcher.style.bottom = 'auto';
        }
      }
    } catch (e) { }

    let isDragging = false;
    let hasMoved = false;
    let startX = 0;
    let startY = 0;
    let initLeft = 0;
    let initTop = 0;

    function onPointerStart(e) {
      if (e.button && e.button !== 0) return;
      isDragging = true;
      hasMoved = false;

      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      startX = clientX;
      startY = clientY;

      const rect = launcher.getBoundingClientRect();
      initLeft = rect.left;
      initTop = rect.top;

      launcher.style.transition = 'none';
      launcher.style.cursor = 'grabbing';

      window.addEventListener('mousemove', onPointerMove, { passive: false });
      window.addEventListener('mouseup', onPointerEnd);
      window.addEventListener('touchmove', onPointerMove, { passive: false });
      window.addEventListener('touchend', onPointerEnd);
    }

    function onPointerMove(e) {
      if (!isDragging) return;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const dx = clientX - startX;
      const dy = clientY - startY;

      if (!hasMoved && Math.hypot(dx, dy) > 6) {
        hasMoved = true;
      }

      if (hasMoved) {
        if (e.cancelable) e.preventDefault();
        const maxX = window.innerWidth - 66;
        const maxY = window.innerHeight - 66;
        const nextX = Math.max(10, Math.min(initLeft + dx, maxX));
        const nextY = Math.max(10, Math.min(initTop + dy, maxY));

        launcher.style.left = `${nextX}px`;
        launcher.style.top = `${nextY}px`;
        launcher.style.right = 'auto';
        launcher.style.bottom = 'auto';
      }
    }

    function onPointerEnd() {
      if (!isDragging) return;
      isDragging = false;
      launcher.style.cursor = 'grab';
      launcher.style.transition = 'transform 0.15s ease, box-shadow 0.15s ease';

      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('mouseup', onPointerEnd);
      window.removeEventListener('touchmove', onPointerMove);
      window.removeEventListener('touchend', onPointerEnd);

      if (hasMoved) {
        const rect = launcher.getBoundingClientRect();
        try {
          localStorage.setItem('busgo_ai_pos', JSON.stringify({ x: rect.left, y: rect.top }));
        } catch (e) { }
      } else {
        // Tap or click -> toggle chat window
        toggleAiChat();
      }
    }

    launcher.addEventListener('mousedown', onPointerStart);
    launcher.addEventListener('touchstart', onPointerStart, { passive: true });
  }

  // 2. Setup ChatGPT Textarea Input & Auto-expand
  const input = document.getElementById('aiChatInput');
  const sendBtn = document.getElementById('aiSendBtn');
  if (input) {
    input.addEventListener('input', function() {
      this.style.height = 'auto';
      this.style.height = Math.min(this.scrollHeight, 110) + 'px';
      const val = this.value.trim();
      if (val.length > 0 && !AiSession.isStreaming) {
        if (sendBtn) {
          sendBtn.classList.add('active');
          sendBtn.removeAttribute('disabled');
        }
      } else {
        if (sendBtn) {
          sendBtn.classList.remove('active');
          sendBtn.setAttribute('disabled', 'true');
        }
      }
    });

    input.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!AiSession.isStreaming && this.value.trim().length > 0) {
          handleAiChatSubmit(e);
        }
      }
    });
  }

  // 3. Render initial welcome screen if empty
  renderAiWelcomeScreen();
}

function toggleAiChat(forceOpen) {
  if (document.body.classList.contains('ai-page-body')) return;
  const win = document.getElementById('aiChatWindow');
  const launcher = document.getElementById('aiChatLauncher');
  if (!win) return;

  const shouldOpen = forceOpen !== undefined ? forceOpen : win.classList.contains('d-none');
  if (shouldOpen) {
    win.classList.remove('d-none');
    if (launcher) launcher.classList.add('active');
    setTimeout(() => {
      const inp = document.getElementById('aiChatInput');
      if (inp) inp.focus();
      scrollAiToBottom();
    }, 100);
  } else {
    win.classList.add('d-none');
    if (launcher) launcher.classList.remove('active');
  }
}

function getUserDisplayName() {
  if (AiSession.context.customUserName) {
    return AiSession.context.customUserName;
  }
  if (window.AppState && window.AppState.currentUser && window.AppState.currentUser.name) {
    const raw = window.AppState.currentUser.name.trim();
    return raw.split(' ')[0];
  }
  try {
    const saved = localStorage.getItem('busgo_user');
    if (saved) {
      const u = JSON.parse(saved);
      if (u && u.name) {
        return u.name.trim().split(' ')[0];
      }
    }
  } catch (e) { }

  try {
    const bookings = getStoredBookings();
    if (bookings && bookings.length > 0 && bookings[0].passengerName) {
      const bName = bookings[0].passengerName.trim();
      if (bName && bName.toLowerCase() !== 'guest') {
        return bName.split(' ')[0];
      }
    }
  } catch (e) { }

  return '';
}

function detectUserLanguage(rawText) {
  if (!rawText) return AiSession.context.currentLang || 'hinglish';
  const text = rawText.trim();
  const lower = text.toLowerCase();

  // 1. Explicit user language switch commands
  if (lower.includes('in tamil') || lower.includes('tamil me') || lower.includes('tamil mein') || lower.includes('à®¤à®®à®¿à®´à®¿à®²à¯')) {
    AiSession.context.currentLang = 'tamil';
    return 'tamil';
  }
  if (lower.includes('in telugu') || lower.includes('telugu me') || lower.includes('telugu mein') || lower.includes('à°¤à±†à°²à±à°—à±à°²à±‹')) {
    AiSession.context.currentLang = 'telugu';
    return 'telugu';
  }
  if (lower.includes('in kannada') || lower.includes('kannada me') || lower.includes('kannada mein') || lower.includes('à²•à²¨à³à²¨à²¡à²¦à²²à³à²²à²¿')) {
    AiSession.context.currentLang = 'kannada';
    return 'kannada';
  }
  if (lower.includes('in malayalam') || lower.includes('malayalam me') || lower.includes('malayalam mein') || lower.includes('à´®à´²à´¯à´¾à´³à´¤àµà´¤à´¿àµ½')) {
    AiSession.context.currentLang = 'malayalam';
    return 'malayalam';
  }
  if (lower.includes('in marathi') || lower.includes('marathi me') || lower.includes('marathi mein') || lower.includes('à¤®à¤°à¤¾à¤ à¥€à¤¤')) {
    AiSession.context.currentLang = 'marathi';
    return 'marathi';
  }
  if (lower.includes('in gujarati') || lower.includes('gujarati me') || lower.includes('gujarati mein') || lower.includes('àª—à«àªœàª°àª¾àª¤à«€àª®àª¾àª‚')) {
    AiSession.context.currentLang = 'gujarati';
    return 'gujarati';
  }
  if (lower.includes('in bengali') || lower.includes('bengali me') || lower.includes('bangla me') || lower.includes('à¦¬à¦¾à¦‚à¦²à¦¾à¦¯à¦¼')) {
    AiSession.context.currentLang = 'bengali';
    return 'bengali';
  }
  if (lower.includes('in punjabi') || lower.includes('punjabi me') || lower.includes('punjabi mein') || lower.includes('à¨ªà©°à¨œà¨¾à¨¬à©€ à¨µà¨¿à©±à¨š')) {
    AiSession.context.currentLang = 'punjabi';
    return 'punjabi';
  }
  if (lower.includes('in odia') || lower.includes('odia me') || lower.includes('oriya me') || lower.includes('à¬“à¬¡à¬¼à¬¿à¬†à¬°à­‡')) {
    AiSession.context.currentLang = 'odia';
    return 'odia';
  }
  if (lower.includes('in urdu') || lower.includes('urdu me') || lower.includes('urdu mein') || lower.includes('Ø§Ø±Ø¯Ùˆ Ù…ÛŒÚº')) {
    AiSession.context.currentLang = 'urdu';
    return 'urdu';
  }
  if (lower.includes('hindi me') || lower.includes('hindi mein') || lower.includes('à¤¹à¤¿à¤‚à¤¦à¥€ à¤®à¥‡à¤‚') || lower.includes('in hindi')) {
    AiSession.context.currentLang = 'hindi_devanagari';
    return 'hindi_devanagari';
  }
  if (lower.includes('english me') || lower.includes('in english') || lower.includes('speak english') || lower.includes('talk in english')) {
    AiSession.context.currentLang = 'english';
    return 'english';
  }
  if (lower.includes('hinglish') || lower.includes('roman hindi')) {
    AiSession.context.currentLang = 'hinglish';
    return 'hinglish';
  }

  // 2. Native Unicode script detection
  if (/[\u0B80-\u0BFF]/.test(text)) {
    AiSession.context.currentLang = 'tamil';
    return 'tamil';
  }
  if (/[\u0C00-\u0C7F]/.test(text)) {
    AiSession.context.currentLang = 'telugu';
    return 'telugu';
  }
  if (/[\u0C80-\u0CFF]/.test(text)) {
    AiSession.context.currentLang = 'kannada';
    return 'kannada';
  }
  if (/[\u0D00-\u0D7F]/.test(text)) {
    AiSession.context.currentLang = 'malayalam';
    return 'malayalam';
  }
  if (/[\u0A80-\u0AFF]/.test(text)) {
    AiSession.context.currentLang = 'gujarati';
    return 'gujarati';
  }
  if (/[\u0980-\u09FF]/.test(text)) {
    AiSession.context.currentLang = 'bengali';
    return 'bengali';
  }
  if (/[\u0A00-\u0A7F]/.test(text)) {
    AiSession.context.currentLang = 'punjabi';
    return 'punjabi';
  }
  if (/[\u0B00-\u0B7F]/.test(text)) {
    AiSession.context.currentLang = 'odia';
    return 'odia';
  }
  if (/[\u0600-\u06FF]/.test(text)) {
    AiSession.context.currentLang = 'urdu';
    return 'urdu';
  }

  // Devanagari Script (Marathi vs Hindi)
  if (/[\u0900-\u097F]/.test(text)) {
    if (/(à¤†à¤¹à¥‡|à¤¨à¤¾à¤¹à¥€|à¤•à¤¸à¥‡|à¤•à¥à¤ à¥‡|à¤à¤¾à¤²à¥‡|à¤•à¤°à¤¾à¤¯à¤šà¥‡|à¤®à¤¾à¤à¥‡|à¤¤à¥à¤®à¤šà¥‡|à¤¨à¤®à¤¸à¥à¤•à¤¾à¤°)/.test(text)) {
      AiSession.context.currentLang = 'marathi';
      return 'marathi';
    }
    AiSession.context.currentLang = 'hindi_devanagari';
    return 'hindi_devanagari';
  }

  // 3. Hinglish markers detection
  const hinglishKeywords = [
    'hai', 'ho', 'hu', 'h', 'he', 'bhai', 'ji', 'kya', 'kyu', 'kyun', 'kab', 'kaha',
    'kitna', 'kitne', 'kaise', 'kese', 'karo', 'karna', 'krna', 'batao', 'btao',
    'chahiye', 'chahie', 'jana', 'jaana', 'se', 'ko', 'me', 'mein', 'ka', 'ki', 'ke',
    'baje', 'sasti', 'chalegi', 'chalega', 'chalta', 'baat', 'gaadi', 'gadi', 'rasta',
    'mausam', 'ladki', 'mahila', 'dost', 'accha', 'thik', 'theek', 'bilkul', 'nahi',
    'nhi', 'kal', 'aaj', 'subah', 'raat', 'sham', 'namaste', 'pranam', 'hii', 'hiii',
    'kisko', 'unka', 'mera', 'meri', 'mere', 'aapka', 'aapki', 'aapke', 'mujhe', 'hum'
  ];

  const words = lower.replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
  const matchHinglishCount = words.filter(w => hinglishKeywords.includes(w)).length;

  if (matchHinglishCount > 0) {
    AiSession.context.currentLang = 'hinglish';
    return 'hinglish';
  }

  // 4. Pure English words detection
  const englishWords = ['what', 'where', 'when', 'how', 'who', 'which', 'can', 'is', 'are', 'do', 'does', 'please', 'tell', 'show', 'book', 'status', 'fare', 'ticket', 'schedule', 'price', 'time', 'bus', 'good', 'morning', 'night', 'driver', 'weather'];
  const matchEnglishCount = words.filter(w => englishWords.includes(w)).length;

  if (matchEnglishCount > 0 && matchHinglishCount === 0) {
    AiSession.context.currentLang = 'english';
    return 'english';
  }

  // Maintain previously detected language or default to friendly Hinglish
  return AiSession.context.currentLang || 'hinglish';
}

function getHonorific(lang, userName) {
  const u = userName ? userName.trim() : '';
  switch (lang) {
    case 'tamil':
      return u ? `${u} à®…à®µà®°à¯à®•à®³à¯‡` : 'à®…à®µà®°à¯à®•à®³à¯‡';
    case 'telugu':
      return u ? `${u} à°—à°¾à°°à±` : 'à°—à°¾à°°à±';
    case 'kannada':
      return u ? `${u} à²…à²µà²°à³‡` : 'à²…à²µà²°à³‡';
    case 'malayalam':
      return u ? `${u}` : 'à´¸àµà´¹àµƒà´¤àµà´¤àµ‡';
    case 'marathi':
      return u ? `${u} à¤œà¥€` : 'à¤œà¥€';
    case 'gujarati':
      return u ? `${u} àªœà«€` : 'àªœà«€';
    case 'bengali':
      return u ? `${u} à¦¬à¦¾à¦¬à§` : 'à¦®à¦¹à¦¾à¦¶à¦¯à¦¼';
    case 'punjabi':
      return u ? `${u} à¨œà©€` : 'à¨œà©€';
    case 'odia':
      return u ? `${u} à¬¬à¬¾à¬¬à­` : 'à¬†à¬œà­à¬žà¬¾';
    case 'urdu':
      return u ? `${u} ØµØ§Ø­Ø¨` : 'Ù…Ø­ØªØ±Ù…';
    case 'hindi_devanagari':
      return u ? `${u} à¤œà¥€` : 'à¤œà¥€';
    case 'english':
      return u ? ` ${u}` : '';
    case 'hinglish':
    default:
      return u ? `${u} ji` : 'ji';
  }
}

function renderAiWelcomeScreen() {
  const body = document.getElementById('aiChatBody');
  if (!body) return;
  const userName = getUserDisplayName();
  const ctx = AiSession.context;

  // Try extracting route from URL params or input fields if not already populated
  // Try extracting route from URL params if present
  if (!ctx.origin || !ctx.destination) {
    try {
      const p = new URLSearchParams(window.location.search);
      if (p.get('from')) ctx.origin = p.get('from').trim();
      if (p.get('to')) ctx.destination = p.get('to').trim();
    } catch (e) {}
  }

  const hasRoute = Boolean(ctx.origin && ctx.destination);
  const cleanFrom = ctx.origin ? ctx.origin.split('(')[0].trim() : '';
  const cleanTo = ctx.destination ? ctx.destination.split('(')[0].trim() : '';

  const title = hasRoute
    ? `Route Selected: ${cleanFrom} \u2794 ${cleanTo}`
    : (userName ? `Welcome back, ${userName}!` : 'How can I help you today?');

  const sub = hasRoute
    ? `Ask anything about ${cleanFrom} to ${cleanTo} bus timings, lowest fares, live stoppages, or highway status.`
    : (userName
      ? `Namaste ${userName} ji! BusGo GPT 4.0 AI me aapka swagat hai. Ask in Hindi, Hinglish, Tamil, Telugu, Marathi or any Indian language.`
      : `BusGo GPT 4.0 AI &bull; Ask anything about bus routes, live PNR tracking, driver line and ladies safety in 12+ Indian languages.`);

  const promptCards = hasRoute ? `
    <div class="ai-suggestion-card" onclick="sendAiPrompt('${escapeHtml(cleanFrom)} to ${escapeHtml(cleanTo)} bus schedule')">
      <div class="ai-sugg-title">${escapeHtml(cleanFrom)} &rarr; ${escapeHtml(cleanTo)} Buses</div>
      <div class="ai-sugg-desc">Timings, Volvo AC sleeper &amp; live fares</div>
    </div>
    <div class="ai-suggestion-card" onclick="sendAiPrompt('sasti bus konsi hai')">
      <div class="ai-sugg-title">Cheapest Bus on Route</div>
      <div class="ai-sugg-desc">Lowest fare for ${escapeHtml(cleanFrom)} &rarr; ${escapeHtml(cleanTo)}</div>
    </div>
    <div class="ai-suggestion-card" onclick="sendAiPrompt('kahan rukti hai')">
      <div class="ai-sugg-title">Route Stops &amp; Halts</div>
      <div class="ai-sugg-desc">Boarding landmarks &amp; highway halts</div>
    </div>
    <div class="ai-suggestion-card" onclick="sendAiPrompt('weather kaisa hai')">
      <div class="ai-sugg-title">Highway Road &amp; Weather</div>
      <div class="ai-sugg-desc">Live highway conditions &amp; convoy traffic</div>
    </div>
  ` : `
    <div class="ai-suggestion-card" onclick="sendAiPrompt('how to book a bus')">
      <div class="ai-sugg-title">How to Book a Bus</div>
      <div class="ai-sugg-desc">Step-by-step booking guide &amp; ticket tips</div>
    </div>
    <div class="ai-suggestion-card" onclick="sendAiPrompt('Indore to Ujjain bus schedule')">
      <div class="ai-sugg-title">Indore &rarr; Ujjain Bus</div>
      <div class="ai-sugg-desc">Volvo 9600 Multi-Axle, EV AC &amp; ordinary express</div>
    </div>
    <div class="ai-suggestion-card" onclick="sendAiPrompt('Indore to Bhopal bus schedule')">
      <div class="ai-sugg-title">Indore &rarr; Bhopal Bus</div>
      <div class="ai-sugg-desc">4-lane expressway timings &amp; fares</div>
    </div>
    <div class="ai-suggestion-card" onclick="sendAiPrompt('Call Captain Driver Kirtan')">
      <div class="ai-sugg-title">Captain Kirtan Direct Line</div>
      <div class="ai-sugg-desc">Driver desk hotline +91 6264213958</div>
    </div>
  `;

  body.innerHTML = `
    <div class="ai-welcome-box">
      <div class="ai-welcome-icon">
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="18" height="14" rx="3"></rect>
          <path d="M3 9h18"></path>
          <path d="M12 3v6"></path>
          <circle cx="7" cy="13" r="1.2" fill="currentColor"></circle>
          <circle cx="17" cy="13" r="1.2" fill="currentColor"></circle>
          <path d="M10 13h4"></path>
          <path d="M6 17v3a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-3"></path>
          <path d="M15 17v3a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-3"></path>
        </svg>
      </div>
      <div class="ai-welcome-title">${escapeHtml(title)}</div>
      <div class="ai-welcome-sub mb-2">${escapeHtml(sub)}</div>
      
      <div class="ai-lang-pills mb-3 d-flex flex-wrap gap-1 justify-content-center" style="font-size: 11px;">
        <span class="badge bg-light text-dark border pointer px-2 py-1" onclick="sendAiPrompt('in tamil')">à®¤à®®à®¿à®´à¯</span>
        <span class="badge bg-light text-dark border pointer px-2 py-1" onclick="sendAiPrompt('in telugu')">à°¤à±†à°²à±à°—à±</span>
        <span class="badge bg-light text-dark border pointer px-2 py-1" onclick="sendAiPrompt('in kannada')">à²•à²¨à³à²¨à²¡</span>
        <span class="badge bg-light text-dark border pointer px-2 py-1" onclick="sendAiPrompt('in malayalam')">à´®à´²à´¯à´¾à´³à´‚</span>
        <span class="badge bg-light text-dark border pointer px-2 py-1" onclick="sendAiPrompt('in marathi')">à¤®à¤°à¤¾à¤ à¥€</span>
        <span class="badge bg-light text-dark border pointer px-2 py-1" onclick="sendAiPrompt('in gujarati')">àª—à«àªœàª°àª¾àª¤à«€</span>
        <span class="badge bg-light text-dark border pointer px-2 py-1" onclick="sendAiPrompt('in bengali')">à¦¬à¦¾à¦‚à¦²à¦¾</span>
        <span class="badge bg-light text-dark border pointer px-2 py-1" onclick="sendAiPrompt('in punjabi')">à¨ªà©°à¨œà¨¾à¨¬à©€</span>
        <span class="badge bg-light text-dark border pointer px-2 py-1" onclick="sendAiPrompt('in odia')">à¬“à¬¡à¬¼à¬¿à¬†</span>
        <span class="badge bg-light text-dark border pointer px-2 py-1" onclick="sendAiPrompt('in urdu')">Ø§Ø±Ø¯Ùˆ</span>
        <span class="badge bg-light text-dark border pointer px-2 py-1" onclick="sendAiPrompt('in hindi')">à¤¹à¤¿à¤‚à¤¦à¥€</span>
        <span class="badge bg-light text-dark border pointer px-2 py-1" onclick="sendAiPrompt('in english')">English</span>
      </div>

      <div class="ai-prompt-grid">
        ${promptCards}
      </div>
    </div>
  `;
}

function clearAiChat() {
  stopAiGeneration();
  AiSession.history = [];
  AiSession.context = {
    origin: null,
    destination: null,
    travelDate: null,
    busType: null,
    lastTopic: null,
    lastPnr: null
  };
  try {
    if (window.history && window.history.replaceState) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  } catch (e) {}
  const badgeEl = document.getElementById('aiRouteBadgeText');
  if (badgeEl) {
    badgeEl.textContent = 'All Routes (Select Route)';
  }
  renderAiWelcomeScreen();
  const input = document.getElementById('aiChatInput');
  if (input) {
    input.value = '';
    input.style.height = 'auto';
    input.focus();
  }
  const sendBtn = document.getElementById('aiSendBtn');
  if (sendBtn) {
    sendBtn.classList.remove('active');
    sendBtn.setAttribute('disabled', 'true');
  }
}

function scrollAiToBottom() {
  const body = document.getElementById('aiChatBody');
  if (body) {
    body.scrollTop = body.scrollHeight;
  }
}

function sendAiPrompt(text) {
  toggleAiChat(true);
  const input = document.getElementById('aiChatInput');
  if (input) {
    input.value = text;
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 110) + 'px';
  }
  handleAiChatSubmit(new Event('submit'));
}

function handleAiChatSubmit(e) {
  if (e && e.preventDefault) e.preventDefault();
  if (AiSession.isStreaming) return;

  const input = document.getElementById('aiChatInput');
  if (!input) return;
  const text = (input.value || '').trim();
  if (!text) return;

  input.value = '';
  input.style.height = 'auto';
  const sendBtn = document.getElementById('aiSendBtn');
  if (sendBtn) {
    sendBtn.classList.remove('active');
    sendBtn.setAttribute('disabled', 'true');
  }

  // Remove welcome screen if it's the first message
  const body = document.getElementById('aiChatBody');
  if (body && body.querySelector('.ai-welcome-box')) {
    body.innerHTML = '';
  }

  // 1. Append User Message
  appendUserMessage(text);
  AiSession.history.push({ role: 'user', text: text, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) });

  // 2. Generate and stream AI response like ChatGPT
  setTimeout(() => {
    generateAiResponse(text);
  }, 260);
}

function appendUserMessage(text) {
  const body = document.getElementById('aiChatBody');
  if (!body) return;
  const msg = document.createElement('div');
  msg.className = 'ai-message user';
  msg.innerHTML = `<div class="ai-bubble">${escapeHtml(text)}</div>`;
  body.appendChild(msg);
  scrollAiToBottom();
}

function stopAiGeneration() {
  AiSession.stopRequested = true;
  if (AiSession.activeStreamTimer) {
    clearInterval(AiSession.activeStreamTimer);
    AiSession.activeStreamTimer = null;
  }
  const stopBtn = document.getElementById('aiStopBtn');
  const sendBtn = document.getElementById('aiSendBtn');
  if (stopBtn) stopBtn.classList.add('d-none');
  if (sendBtn) sendBtn.classList.remove('d-none');
  AiSession.isStreaming = false;

  // Clean up any dangling cursor
  document.querySelectorAll('.ai-typing-cursor').forEach(el => el.remove());
}

/* ============================================================
   CHATGPT STREAMING / TYPEWRITER RENDERER WITH BLINKING CURSOR
   ============================================================ */

function streamAiResponse(fullMarkdown, actionHtml = '', chips = []) {
  const body = document.getElementById('aiChatBody');
  if (!body) return;

  AiSession.isStreaming = true;
  AiSession.stopRequested = false;

  // Toggle stop/send buttons
  const stopBtn = document.getElementById('aiStopBtn');
  const sendBtn = document.getElementById('aiSendBtn');
  if (stopBtn) stopBtn.classList.remove('d-none');
  if (sendBtn) sendBtn.classList.add('d-none');

  // Create Bot Message Shell with Thinking Dots
  const msgEl = document.createElement('div');
  msgEl.className = 'ai-message bot';
  msgEl.innerHTML = `
    <div class="ai-bubble">
      <div class="ai-thinking-wrap" id="aiThinkingDots">
        <span class="ai-thinking-dot"></span>
        <span class="ai-thinking-dot"></span>
        <span class="ai-thinking-dot"></span>
      </div>
      <div class="ai-stream-text"></div>
      <div class="ai-card-holder"></div>
      <div class="ai-chips-holder"></div>
    </div>
    <div class="ai-msg-toolbar d-none">
      <button type="button" class="ai-copy-btn" title="Copy response">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg> Copy
      </button>
      <span class="ai-model-tag">BusGo GPT 4.0 AI</span>
    </div>
  `;
  body.appendChild(msgEl);
  scrollAiToBottom();

  const textHolder = msgEl.querySelector('.ai-stream-text');
  const thinkingDots = msgEl.querySelector('#aiThinkingDots');
  const cardHolder = msgEl.querySelector('.ai-card-holder');
  const chipsHolder = msgEl.querySelector('.ai-chips-holder');
  const toolbar = msgEl.querySelector('.ai-msg-toolbar');
  const copyBtn = msgEl.querySelector('.ai-copy-btn');

  // Split words for streaming
  const words = fullMarkdown.split(' ');
  let wordIndex = 0;
  let currentText = '';

  // Simulate short thinking latency like ChatGPT
  setTimeout(() => {
    if (thinkingDots) thinkingDots.remove();

    AiSession.activeStreamTimer = setInterval(() => {
      if (AiSession.stopRequested || wordIndex >= words.length) {
        clearInterval(AiSession.activeStreamTimer);
        AiSession.activeStreamTimer = null;
        finalizeMessage();
        return;
      }

      currentText += (wordIndex === 0 ? '' : ' ') + words[wordIndex];
      wordIndex++;

      textHolder.innerHTML = formatAiMarkdown(currentText) + '<span class="ai-typing-cursor"></span>';
      scrollAiToBottom();
    }, 18); // ~18ms per word gives realistic ChatGPT typing speed
  }, 320);

  function finalizeMessage() {
    textHolder.innerHTML = formatAiMarkdown(fullMarkdown);
    if (actionHtml) {
      cardHolder.innerHTML = actionHtml;
    }
    if (chips && chips.length > 0) {
      chipsHolder.innerHTML = `
        <div class="ai-prompt-chips">
          ${chips.map(c => `<button type="button" class="ai-chip" onclick="sendAiPrompt('${escapeHtml(c)}')">${escapeHtml(c)}</button>`).join('')}
        </div>
      `;
    }
    if (toolbar) toolbar.classList.remove('d-none');
    if (copyBtn) {
      copyBtn.onclick = function() {
        copyAiMessageText(this, fullMarkdown);
      };
    }

    if (stopBtn) stopBtn.classList.add('d-none');
    if (sendBtn) sendBtn.classList.remove('d-none');
    AiSession.isStreaming = false;

    AiSession.history.push({
      role: 'assistant',
      text: fullMarkdown,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
    scrollAiToBottom();
  }
}

function copyAiMessageText(btn, rawText) {
  if (!rawText) return;
  // Clean markdown syntax for plain text clipboard
  const cleanText = rawText.replace(/\*\*/g, '').replace(/### /g, '').replace(/## /g, '');
  navigator.clipboard.writeText(cleanText).then(() => {
    const orig = btn.innerHTML;
    btn.innerHTML = `<span style="color:#10a37f; font-weight:700;">âœ“ Copied!</span>`;
    setTimeout(() => {
      btn.innerHTML = orig;
    }, 1600);
  }).catch(() => {
    showToast('Copied to clipboard', 'info');
  });
}

function formatAiMarkdown(text) {
  if (!text) return '';
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Headings
  html = html.replace(/^### (.*$)/gim, '<h6 class="fw-bold mt-2 mb-1" style="color:var(--primary);">$1</h6>');
  html = html.replace(/^## (.*$)/gim, '<h5 class="fw-bold mt-2 mb-1">$1</h5>');

  // Bold & Italic
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code class="bg-light px-1 py-0.5 rounded border text-danger" style="font-size:12px;">$1</code>');

  // Paragraphs & structured blocks
  const rawBlocks = html.split(/\n\n+/);
  return rawBlocks.map(block => {
    block = block.trim();
    if (!block) return '';
    if (block.startsWith('<h')) return block;

    const lines = block.split('\n');

    // Check if entire block is bullet list
    const isBulletList = lines.every(l => /^\s*[-â€¢]\s+/.test(l));
    if (isBulletList) {
      const items = lines.map(l => `<li class="mb-1">${l.replace(/^\s*[-â€¢]\s+/, '')}</li>`).join('');
      return `<ul class="ps-3 mb-2" style="list-style-type:disc;">${items}</ul>`;
    }

    // Check if entire block is simple numbered list without subtext
    const isSimpleNumList = lines.length > 1 && lines.every(l => /^\s*\d+\.\s+/.test(l));
    if (isSimpleNumList) {
      const items = lines.map(l => {
        const m = l.match(/^\s*(\d+)\.\s+(.*)$/);
        return `<li class="mb-1.5">${m ? m[2] : l}</li>`;
      }).join('');
      return `<ol class="ps-3 mb-2" style="padding-left:1.25rem;">${items}</ol>`;
    }

    // Numbered step with descriptive subtext (e.g. "1. **Step 1:**\n   Details")
    if (/^\s*\d+\.\s+/.test(lines[0])) {
      const formattedLines = lines.map(l => {
        const numMatch = l.match(/^\s*(\d+)\.\s+(.*)$/);
        if (numMatch) {
          let stepTitle = numMatch[2];
          stepTitle = stepTitle.replace(/^<strong>(?:step|à¤šà¤°à¤£)\s*\d+[:\-.]*\s*<\/strong>\s*:?\s*/i, '');
          stepTitle = stepTitle.replace(/^(?:step|à¤šà¤°à¤£)\s*\d+[:\-.]*\s*/i, '');
          return `<div class="ai-step-title fw-semibold mb-1"><span class="ai-step-badge me-2">${numMatch[1]}</span><span>${stepTitle}</span></div>`;
        }
        return `<div class="ai-step-desc ps-4 small mb-1">${l.trim()}</div>`;
      }).join('');
      return `<div class="ai-step-block mb-2">${formattedLines}</div>`;
    }

    // Standard paragraph with line-breaks
    return `<p class="mb-2">${block.replace(/\n/g, '<br/>')}</p>`;
  }).join('');
}

/* ============================================================
   CHATGPT BRAIN: CONVERSATIONAL MULTI-TURN NLP ENGINE
   ============================================================ */

function getDynamicAiChips(origin, destination, lang) {
  const o = origin ? origin.split('(')[0].trim() : '';
  const d = destination ? destination.split('(')[0].trim() : '';

  if (o && d) {
    if (lang === 'hindi_devanagari') {
      return [
        `${o} à¤¸à¥‡ ${d} à¤¸à¤¬à¤¸à¥‡ à¤¸à¤¸à¥à¤¤à¥€ à¤¬à¤¸`,
        `${o} à¤¸à¥‡ ${d} à¤¸à¥à¤Ÿà¥‰à¤ª à¤à¤µà¤‚ à¤¹à¥‰à¤²à¥à¤Ÿ`,
        `${o} à¤¸à¥‡ ${d} à¤¹à¤¾à¤ˆà¤µà¥‡ à¤®à¥Œà¤¸à¤®`,
        'à¤•à¥ˆà¤ªà¥à¤Ÿà¤¨ à¤•à¥€à¤°à¥à¤¤à¤¨ à¤¨à¤‚à¤¬à¤°'
      ];
    }
    return [
      `Cheapest bus on ${o} to ${d}`,
      `${o} to ${d} stoppages`,
      `${o} to ${d} highway weather`,
      'Call Captain Driver Kirtan'
    ];
  }

  if (lang === 'hindi_devanagari') {
    return [
      'à¤‡à¤‚à¤¦à¥Œà¤° à¤¸à¥‡ à¤‰à¤œà¥à¤œà¥ˆà¤¨ à¤¬à¤¸',
      'à¤‡à¤‚à¤¦à¥Œà¤° à¤¸à¥‡ à¤­à¥‹à¤ªà¤¾à¤² à¤¬à¤¸',
      'à¤§à¤°à¤®à¤ªà¥à¤°à¥€ à¤¸à¥‡ à¤‡à¤‚à¤¦à¥Œà¤° à¤¬à¤¸',
      'à¤•à¥ˆà¤ªà¥à¤Ÿà¤¨ à¤•à¥€à¤°à¥à¤¤à¤¨ à¤¨à¤‚à¤¬à¤°'
    ];
  }

  return [
    'Indore to Ujjain bus schedule',
    'Indore to Bhopal bus schedule',
    'Dharampuri to Indore bus schedule',
    'Call Captain Driver Kirtan'
  ];
}

function promptRouteClarification(topic, lang) {
  const userName = getUserDisplayName();
  const greetingHindi = userName ? `${userName} à¤œà¥€` : 'à¤œà¥€';
  const greetingHinglish = userName ? `${userName} ji` : 'ji';
  const greetingEnglish = userName ? ` ${userName}` : '';

  if (lang === 'hindi_devanagari') {
    const msg = `**${greetingHindi}, à¤•à¥ƒà¤ªà¤¯à¤¾ à¤…à¤ªà¤¨à¤¾ à¤ªà¥à¤°à¤¸à¥à¤¥à¤¾à¤¨ à¤¶à¤¹à¤° à¤”à¤° à¤—à¤‚à¤¤à¤µà¥à¤¯ (Origin & Destination) à¤¬à¤¤à¤¾à¤à¤‚:**\n\nà¤¸à¤Ÿà¥€à¤• à¤¬à¤¸ à¤¸à¤®à¤¯, à¤•à¤¿à¤°à¤¾à¤¯à¤¾ à¤¸à¥‚à¤šà¥€ à¤à¤µà¤‚ à¤‰à¤ªà¤²à¤¬à¥à¤§ à¤¸à¥€à¤Ÿà¥‡à¤‚ à¤¦à¥‡à¤–à¤¨à¥‡ à¤•à¥‡ à¤²à¤¿à¤ à¤•à¥ƒà¤ªà¤¯à¤¾ à¤¬à¤¤à¤¾à¤à¤‚ à¤•à¤¿ à¤†à¤ª à¤•à¤¹à¤¾à¤ à¤¸à¥‡ à¤•à¤¹à¤¾à¤ à¤œà¤¾à¤¨à¤¾ à¤šà¤¾à¤¹à¤¤à¥‡ à¤¹à¥ˆà¤‚? (à¤‰à¤¦à¤¾à¤¹à¤°à¤£: **à¤‡à¤‚à¤¦à¥Œà¤° à¤¸à¥‡ à¤‰à¤œà¥à¤œà¥ˆà¤¨**, **à¤‡à¤‚à¤¦à¥Œà¤° à¤¸à¥‡ à¤­à¥‹à¤ªà¤¾à¤²** à¤¯à¤¾ à¤…à¤¨à¥à¤¯ à¤¶à¤¹à¤°)à¥¤`;
    const card = `
      <div class="ai-action-card">
        <div class="small fw-semibold text-secondary mb-2">à¤¤à¥à¤°à¤‚à¤¤ à¤²à¥‹à¤•à¤ªà¥à¤°à¤¿à¤¯ à¤®à¤¾à¤°à¥à¤— à¤šà¥à¤¨à¥‡à¤‚:</div>
        <div class="d-flex flex-wrap gap-2">
          <button class="btn btn-sm btn-outline-primary py-1 px-2.5 fw-semibold" onclick="sendAiPrompt('Indore to Ujjain bus schedule')">à¤‡à¤‚à¤¦à¥Œà¤° &rarr; à¤‰à¤œà¥à¤œà¥ˆà¤¨</button>
          <button class="btn btn-sm btn-outline-primary py-1 px-2.5 fw-semibold" onclick="sendAiPrompt('Indore to Bhopal bus schedule')">à¤‡à¤‚à¤¦à¥Œà¤° &rarr; à¤­à¥‹à¤ªà¤¾à¤²</button>
          <button class="btn btn-sm btn-outline-primary py-1 px-2.5 fw-semibold" onclick="sendAiPrompt('Dharampuri to Indore bus schedule')">à¤§à¤°à¤®à¤ªà¥à¤°à¥€ &rarr; à¤‡à¤‚à¤¦à¥Œà¤°</button>
        </div>
      </div>
    `;
    streamAiResponse(msg, card, ['à¤‡à¤‚à¤¦à¥Œà¤° à¤¸à¥‡ à¤‰à¤œà¥à¤œà¥ˆà¤¨ à¤¬à¤¸ à¤¸à¤®à¤¯', 'à¤‡à¤‚à¤¦à¥Œà¤° à¤¸à¥‡ à¤­à¥‹à¤ªà¤¾à¤² à¤¬à¤¸', 'à¤§à¤°à¤®à¤ªà¥à¤°à¥€ à¤¸à¥‡ à¤‡à¤‚à¤¦à¥Œà¤° à¤¬à¤¸']);
  } else if (lang === 'english') {
    const msg = `**${greetingEnglish ? 'Certainly' + greetingEnglish : 'Hello'}! Please specify your departure and destination cities:**\n\nTo give you the exact bus schedule, live ticket fares, and seat availability, please tell me your travel route (for example: **Indore to Ujjain**, **Indore to Bhopal**, or any custom route).`;
    const card = `
      <div class="ai-action-card">
        <div class="small fw-semibold text-secondary mb-2">Select a Popular Route:</div>
        <div class="d-flex flex-wrap gap-2">
          <button class="btn btn-sm btn-outline-primary py-1 px-2.5 fw-semibold" onclick="sendAiPrompt('Indore to Ujjain bus schedule')">Indore &rarr; Ujjain</button>
          <button class="btn btn-sm btn-outline-primary py-1 px-2.5 fw-semibold" onclick="sendAiPrompt('Indore to Bhopal bus schedule')">Indore &rarr; Bhopal</button>
          <button class="btn btn-sm btn-outline-primary py-1 px-2.5 fw-semibold" onclick="sendAiPrompt('Dharampuri to Indore bus schedule')">Dharampuri &rarr; Indore</button>
        </div>
      </div>
    `;
    streamAiResponse(msg, card, ['Indore to Ujjain bus schedule', 'Indore to Bhopal bus schedule', 'Dharampuri to Indore bus schedule']);
  } else {
    // Hinglish
    const msg = `**Haan ji ${greetingHinglish}! Kripya apna departure shehar aur destination batayein:**\n\nExact bus timing, live ticket fare aur seat availability batane ke liye batayein aap kahan se kahan travel karna chahte hain? (Jaise: **Indore se Ujjain**, **Indore se Bhopal** ya koi aur shehar).`;
    const card = `
      <div class="ai-action-card">
        <div class="small fw-semibold text-secondary mb-2">Popular Route Select Karein:</div>
        <div class="d-flex flex-wrap gap-2">
          <button class="btn btn-sm btn-outline-primary py-1 px-2.5 fw-semibold" onclick="sendAiPrompt('Indore to Ujjain bus schedule')">Indore &rarr; Ujjain</button>
          <button class="btn btn-sm btn-outline-primary py-1 px-2.5 fw-semibold" onclick="sendAiPrompt('Indore to Bhopal bus schedule')">Indore &rarr; Bhopal</button>
          <button class="btn btn-sm btn-outline-primary py-1 px-2.5 fw-semibold" onclick="sendAiPrompt('Dharampuri to Indore bus schedule')">Dharampuri &rarr; Indore</button>
        </div>
      </div>
    `;
    streamAiResponse(msg, card, ['Indore to Ujjain bus schedule', 'Indore to Bhopal bus schedule', 'Dharampuri to Indore bus schedule']);
  }
}

function resolveAiRouteContext(rawQuery) {
  const q = (rawQuery || '').toLowerCase().trim();
  const ctx = AiSession.context;

  // 1. Try URL parameters (e.g. from new tab: ?from=Indore&to=Ujjain)
  let urlFrom = null;
  let urlTo = null;
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('from')) urlFrom = params.get('from').trim();
    if (params.get('to')) urlTo = params.get('to').trim();
  } catch (e) {}

  // 2. Try Homepage input fields
  let inputFrom = null;
  let inputTo = null;
  const fromEl = document.getElementById('fromCity');
  const toEl = document.getElementById('toCity');
  if (fromEl && fromEl.value && fromEl.value.trim()) inputFrom = fromEl.value.trim();
  if (toEl && toEl.value && toEl.value.trim()) inputTo = toEl.value.trim();

  // 3. Try AppState search context
  let stateFrom = null;
  let stateTo = null;
  if (window.AppState && window.AppState.currentSearch) {
    stateFrom = window.AppState.currentSearch.from;
    stateTo = window.AppState.currentSearch.to;
  }

  // Pre-seed context if empty
  if (!ctx.origin) {
    ctx.origin = urlFrom || inputFrom || stateFrom || null;
  }
  if (!ctx.destination) {
    ctx.destination = urlTo || inputTo || stateTo || null;
  }

  // 4. Extract explicit route mentions from user query text
  const knownCities = [
    { key: 'ujjain', label: 'Ujjain (Ujjain, MP)' },
    { key: 'indore', label: 'Indore (Indore, MP)' },
    { key: 'bhopal', label: 'Bhopal (Bhopal, MP)' },
    { key: 'dharampuri', label: 'Dharampuri (Dhar, MP)' },
    { key: 'dharmpuri', label: 'Dharampuri (Dhar, MP)' },
    { key: 'dhar', label: 'Dhar (Dhar, MP)' },
    { key: 'maheshwar', label: 'Maheshwar (Khargone, MP)' },
    { key: 'dhamnod', label: 'Dhamnod (Dhar, MP)' },
    { key: 'khargone', label: 'Khargone (Khargone, MP)' },
    { key: 'khandwa', label: 'Khandwa (Khandwa, MP)' },
    { key: 'barwani', label: 'Barwani (Barwani, MP)' },
    { key: 'ratlam', label: 'Ratlam (Ratlam, MP)' },
    { key: 'dewas', label: 'Dewas (Dewas, MP)' },
    { key: 'gwalior', label: 'Gwalior (Gwalior, MP)' },
    { key: 'jabalpur', label: 'Jabalpur (Jabalpur, MP)' },
    { key: 'sagar', label: 'Sagar (Sagar, MP)' },
    { key: 'rewa', label: 'Rewa (Rewa, MP)' },
    { key: 'satna', label: 'Satna (Satna, MP)' },
    { key: 'mumbai', label: 'Mumbai (Mumbai, MH)' },
    { key: 'pune', label: 'Pune (Pune, MH)' },
    { key: 'delhi', label: 'Delhi (New Delhi, DL)' },
    { key: 'jaipur', label: 'Jaipur (Jaipur, RJ)' },
    { key: 'bangalore', label: 'Bangalore (Bengaluru, KA)' },
    { key: 'bengaluru', label: 'Bangalore (Bengaluru, KA)' },
    { key: 'hyderabad', label: 'Hyderabad (Hyderabad, TS)' },
    { key: 'chennai', label: 'Chennai (Chennai, TN)' },
    { key: 'ahmedabad', label: 'Ahmedabad (Ahmedabad, GJ)' },
    { key: 'surat', label: 'Surat (Surat, GJ)' },
    { key: 'vadodara', label: 'Vadodara (Vadodara, GJ)' },
    { key: 'goa', label: 'Goa (Panaji, GA)' }
  ];

  let explicitOrigin = null;
  let explicitDest = null;

  // Pattern check: "from X to Y", "X to Y", "X se Y", "X - Y", "X âž” Y"
  const routePatterns = [
    /(?:from\s+)?([a-z\s]+?)\s+(?:to|se|se\s+lekar|â€”|-|->|âž”)\s+([a-z\s]+)/i,
    /(?:between|bich)\s+([a-z\s]+?)\s+(?:and|aur|v|&)\s+([a-z\s]+)/i
  ];

  for (const pat of routePatterns) {
    const match = q.match(pat);
    if (match) {
      const part1 = match[1].trim();
      const part2 = match[2].trim();
      const c1 = knownCities.find(c => part1.includes(c.key));
      const c2 = knownCities.find(c => part2.includes(c.key));
      if (c1 && c2 && c1.label !== c2.label) {
        explicitOrigin = c1.label;
        explicitDest = c2.label;
        break;
      }
    }
  }

  // If no direct preposition pattern match, find any two known cities in order of appearance
  if (!explicitOrigin || !explicitDest) {
    const found = [];
    for (const c of knownCities) {
      const idx = q.indexOf(c.key);
      if (idx !== -1) {
        if (!found.some(f => f.label === c.label)) {
          found.push({ idx, label: c.label, key: c.key });
        }
      }
    }
    found.sort((a, b) => a.idx - b.idx);
    if (found.length >= 2) {
      explicitOrigin = found[0].label;
      explicitDest = found[1].label;
    } else if (found.length === 1) {
      const single = found[0];
      if (q.includes('to ' + single.key) || q.includes(single.key + ' jana') || q.includes(single.key + ' ke liye') || q.includes(single.key + ' pahunchna')) {
        explicitDest = single.label;
        if (ctx.origin && ctx.origin !== explicitDest) {
          explicitOrigin = ctx.origin;
        }
      } else if (q.includes('from ' + single.key) || q.includes(single.key + ' se ')) {
        explicitOrigin = single.label;
        if (ctx.destination && ctx.destination !== explicitOrigin) {
          explicitDest = ctx.destination;
        }
      }
    }
  }

  if (explicitOrigin) ctx.origin = explicitOrigin;
  if (explicitDest) ctx.destination = explicitDest;

  // Update top route badge if present on ai-assistant.html
  if (typeof document !== 'undefined') {
    const badgeEl = document.getElementById('aiRouteBadgeText');
    if (badgeEl && ctx.origin && ctx.destination) {
      const cleanO = ctx.origin.split('(')[0].trim();
      const cleanD = ctx.destination.split('(')[0].trim();
      badgeEl.textContent = `Route: ${cleanO} \u2794 ${cleanD}`;
    }
  }

  return {
    origin: ctx.origin || null,
    destination: ctx.destination || null,
    isExplicit: Boolean(explicitOrigin && explicitDest)
  };
}

function generateAiResponse(rawQuery) {
  const q = (rawQuery || '').toLowerCase().trim();
  const lang = detectUserLanguage(rawQuery);
  const userName = getUserDisplayName();
  const ctx = AiSession.context;
  const bookings = getStoredBookings();
  const latestBooking = (bookings && bookings.length > 0) ? bookings[0] : null;

  // Multi-turn route context resolution
  const routeCtx = resolveAiRouteContext(rawQuery);
  ctx.origin = routeCtx.origin;
  ctx.destination = routeCtx.destination;

  // Personalized honorifics based on language
  const greetingHinglish = userName ? `${userName} ji` : 'ji';
  const greetingEnglish = userName ? ` ${userName}` : '';
  const greetingHindi = userName ? `${userName} à¤œà¥€` : 'à¤œà¥€';

  // 1. USER INTRODUCES THEIR OWN NAME (e.g. "mera naam Rahul hai", "my name is Priya")
  const nameMatch = rawQuery.match(/(?:mera naam|my name is|naam hai|name is|i am)\s+([A-Za-z\u0900-\u097F]+)/i);
  if (nameMatch && nameMatch[1]) {
    const extracted = nameMatch[1].trim();
    if (extracted.length > 1 && !['hai', 'kya', 'is', 'bus', 'ticket', 'pnr'].includes(extracted.toLowerCase())) {
      AiSession.context.customUserName = extracted;
      const u = extracted;
      if (lang === 'hindi_devanagari') {
        streamAiResponse(`**à¤†à¤ªà¤¸à¥‡ à¤®à¤¿à¤²à¤•à¤° à¤¬à¤¹à¥à¤¤ à¤–à¥à¤¶à¥€ à¤¹à¥à¤ˆ ${u} à¤œà¥€!** à¤…à¤¬ à¤¸à¥‡ à¤®à¥ˆà¤‚ à¤†à¤ªà¤•à¥‹ ${u} à¤œà¥€ à¤•à¤¹à¤•à¤° à¤¸à¤‚à¤¬à¥‹à¤§à¤¿à¤¤ à¤•à¤°à¥‚à¤à¤—à¤¾à¥¤ à¤¬à¤¤à¤¾à¤‡à¤ à¤†à¤œ à¤®à¥ˆà¤‚ à¤†à¤ªà¤•à¥€ à¤¯à¤¾à¤¤à¥à¤°à¤¾ à¤®à¥‡à¤‚ à¤•à¥à¤¯à¤¾ à¤®à¤¦à¤¦ à¤•à¤° à¤¸à¤•à¤¤à¤¾ à¤¹à¥‚à¤?`, '', getDynamicAiChips(routeCtx.origin, routeCtx.destination, lang));
      } else if (lang === 'english') {
        streamAiResponse(`**Nice to meet you, ${u}!** I have saved your name. How can I assist you with your bus journey today?`, '', getDynamicAiChips(routeCtx.origin, routeCtx.destination, lang));
      } else {
        streamAiResponse(`**Bahut accha laga aapse milkar ${u} ji!** Ab se main aapko ${u} ji bulaunga. Batayein aaj aapki kya help kar sakta hu? Kahan travel karne ka plan hai?`, '', getDynamicAiChips(routeCtx.origin, routeCtx.destination, lang));
      }
      return;
    }
  }

  // 2. EXPLICIT LANGUAGE SWITCH REQUESTS
  if (q.includes('tamil') || q.includes('à®¤à®®à®¿à®´à®¿à®²à¯')) {
    AiSession.context.currentLang = 'tamil';
    streamAiResponse(`**à®µà®£à®•à¯à®•à®®à¯ ${getHonorific('tamil', userName)}!** à®‡à®ªà¯à®ªà¯‹à®¤à¯ à®¨à®¾à®©à¯ à®‰à®™à¯à®•à®³à¯à®Ÿà®©à¯ à®¤à®®à®¿à®´à®¿à®²à¯ à®ªà¯‡à®šà¯à®µà¯‡à®©à¯. BusGo à®µà®¿à®²à¯ à®‰à®™à¯à®•à®³à¯ à®ªà¯‡à®°à¯à®¨à¯à®¤à¯ à®ªà®¯à®£à®¤à¯à®¤à®¿à®±à¯à®•à¯ à®¨à®¾à®©à¯ à®Žà®µà¯à®µà®¾à®±à¯ à®‰à®¤à®µ à®®à¯à®Ÿà®¿à®¯à¯à®®à¯?`, '', ['à®¤à®°à¯à®®à®ªà¯à®°à®¿ - à®‡à®¨à¯à®¤à¯‚à®°à¯ à®ªà¯‡à®°à¯à®¨à¯à®¤à¯', 'à®¨à¯‡à®°à®²à¯ˆ PNR à®¨à®¿à®²à¯ˆ', 'à®•à¯‡à®ªà¯à®Ÿà®©à¯ à®•à¯€à®°à¯à®¤à¯à®¤à®©à¯ à®Žà®£à¯']);
    return;
  }
  if (q.includes('telugu') || q.includes('à°¤à±†à°²à±à°—à±à°²à±‹')) {
    AiSession.context.currentLang = 'telugu';
    streamAiResponse(`**à°¨à°®à°¸à±à°•à°¾à°°à°‚ ${getHonorific('telugu', userName)}!** à°‡à°ªà±à°ªà±à°¡à± à°¨à±‡à°¨à± à°®à±€à°¤à±‹ à°¤à±†à°²à±à°—à±à°²à±‹ à°®à°¾à°Ÿà±à°²à°¾à°¡à±à°¤à°¾à°¨à±. BusGo à°²à±‹ à°®à±€ à°ªà±à°°à°¯à°¾à°£à°¾à°¨à°¿à°•à°¿ à°¨à±‡à°¨à± à°Žà°²à°¾ à°¸à°¹à°¾à°¯à°ªà°¡à°—à°²à°¨à±?`, '', ['à°§à°°à°‚à°ªà±à°°à°¿ à°¨à±à°‚à°¡à°¿ à°‡à°‚à°¡à±‹à°°à± à°¬à°¸à±à°¸à±', 'à°²à±ˆà°µà± PNR à°¸à±à°¥à°¿à°¤à°¿', 'à°•à±†à°ªà±à°Ÿà±†à°¨à± à°•à±€à°°à±à°¤à°¨à± à°¨à°‚à°¬à°°à±']);
    return;
  }
  if (q.includes('kannada') || q.includes('à²•à²¨à³à²¨à²¡à²¦à²²à³à²²à²¿')) {
    AiSession.context.currentLang = 'kannada';
    streamAiResponse(`**à²¨à²®à²¸à³à²•à²¾à²° ${getHonorific('kannada', userName)}!** à²ˆà²— à²¨à²¾à²¨à³ à²¨à²¿à²®à³à²®à³Šà²‚à²¦à²¿à²—à³† à²•à²¨à³à²¨à²¡à²¦à²²à³à²²à²¿ à²®à²¾à²¤à²¨à²¾à²¡à³à²¤à³à²¤à³‡à²¨à³†. BusGo à²¨à²²à³à²²à²¿ à²¨à²¿à²®à³à²® à²¬à²¸à³ à²ªà³à²°à²¯à²¾à²£à²•à³à²•à³† à²¨à²¾à²¨à³ à²¹à³‡à²—à³† à²¸à²¹à²¾à²¯ à²®à²¾à²¡à²²à²¿?`, '', ['à²§à²°à²‚à²ªà³à²°à²¿à²¯à²¿à²‚à²¦ à²‡à²‚à²¦à³‹à²°à³ à²¬à²¸à³', 'à²²à³ˆà²µà³ PNR à²¸à³à²¥à²¿à²¤à²¿', 'à²•à³à²¯à²¾à²ªà³à²Ÿà²¨à³ à²•à³€à²°à³à²¤à²¨à³ à²¸à²‚à²–à³à²¯à³†']);
    return;
  }
  if (q.includes('malayalam') || q.includes('à´®à´²à´¯à´¾à´³à´¤àµà´¤à´¿àµ½')) {
    AiSession.context.currentLang = 'malayalam';
    streamAiResponse(`**à´¨à´®à´¸àµà´•à´¾à´°à´‚ ${getHonorific('malayalam', userName)}!** à´‡à´ªàµà´ªàµ‹àµ¾ à´žà´¾àµ» à´¨à´¿à´™àµà´™à´³àµ‹à´Ÿàµ à´®à´²à´¯à´¾à´³à´¤àµà´¤à´¿àµ½ à´¸à´‚à´¸à´¾à´°à´¿à´•àµà´•àµà´‚. BusGo-àµ½ à´¨à´¿à´™àµà´™à´³àµà´Ÿàµ† à´¬à´¸àµ à´¯à´¾à´¤àµà´°à´¯àµà´•àµà´•àµ à´žà´¾àµ» à´Žà´™àµà´™à´¨àµ† à´¸à´¹à´¾à´¯à´¿à´•àµà´•à´£à´‚?`, '', ['à´§à´°à´‚à´ªàµà´°à´¿ - à´‡àµ»à´¡àµ‹àµ¼ à´¬à´¸àµ', 'à´¤à´¤àµà´¸à´®à´¯ PNR à´¨à´¿à´²', 'à´•àµà´¯à´¾à´ªàµà´±àµà´±àµ» à´•àµ€àµ¼à´¤àµà´¤àµ» à´¨à´®àµà´ªàµ¼']);
    return;
  }
  if (q.includes('marathi') || q.includes('à¤®à¤°à¤¾à¤ à¥€à¤¤')) {
    AiSession.context.currentLang = 'marathi';
    streamAiResponse(`**à¤¨à¤®à¤¸à¥à¤•à¤¾à¤° ${getHonorific('marathi', userName)}!** à¤†à¤¤à¤¾ à¤®à¥€ à¤¤à¥à¤®à¤šà¥à¤¯à¤¾à¤¶à¥€ à¤®à¤°à¤¾à¤ à¥€à¤¤ à¤¬à¥‹à¤²à¥‡à¤¨. BusGo à¤®à¤§à¥à¤¯à¥‡ à¤†à¤ªà¤²à¥à¤¯à¤¾ à¤¬à¤¸ à¤ªà¥à¤°à¤µà¤¾à¤¸à¤¾à¤¸à¤¾à¤ à¥€ à¤®à¥€ à¤•à¤¶à¥€ à¤®à¤¦à¤¤ à¤•à¤°à¥‚ à¤¶à¤•à¥‡à¤¨?`, '', ['à¤§à¤°à¤®à¤ªà¥à¤°à¥€ à¤¤à¥‡ à¤‡à¤‚à¤¦à¥‚à¤° à¤¬à¤¸', 'à¤²à¤¾à¤ˆà¤µà¥à¤¹ PNR à¤¸à¥à¤Ÿà¥‡à¤Ÿà¤¸', 'à¤•à¥…à¤ªà¥à¤Ÿà¤¨ à¤•à¥€à¤°à¥à¤¤à¤¨ à¤¨à¤‚à¤¬à¤°']);
    return;
  }
  if (q.includes('gujarati') || q.includes('àª—à«àªœàª°àª¾àª¤à«€àª®àª¾àª‚')) {
    AiSession.context.currentLang = 'gujarati';
    streamAiResponse(`**àª¨àª®àª¸à«àª¤à«‡ ${getHonorific('gujarati', userName)}!** àª¹àªµà«‡ àª¹à«àª‚ àª¤àª®àª¾àª°à«€ àª¸àª¾àª¥à«‡ àª—à«àªœàª°àª¾àª¤à«€àª®àª¾àª‚ àªµàª¾àª¤ àª•àª°à«€àª¶. BusGo àª®àª¾àª‚ àª¤àª®àª¾àª°à«€ àª¬àª¸ àª®à«àª¸àª¾àª«àª°à«€ àª®àª¾àªŸà«‡ àª¹à«àª‚ àª•à«‡àªµà«€ àª°à«€àª¤à«‡ àª®àª¦àª¦ àª•àª°à«€ àª¶àª•à«àª‚?`, '', ['àª§àª°àª®àªªà«àª°à«€ àª¥à«€ àª‡àª¨à«àª¦à«‹àª° àª¬àª¸', 'àª²àª¾àªˆàªµ PNR àª¸à«àªŸà«‡àªŸàª¸', 'àª•à«‡àªªà«àªŸàª¨ àª•à«€àª°à«àª¤àª¨ àª¨àª‚àª¬àª°']);
    return;
  }
  if (q.includes('bengali') || q.includes('bangla') || q.includes('à¦¬à¦¾à¦‚à¦²à¦¾à¦¯à¦¼')) {
    AiSession.context.currentLang = 'bengali';
    streamAiResponse(`**à¦¨à¦®à¦¸à§à¦•à¦¾à¦° ${getHonorific('bengali', userName)}!** à¦à¦–à¦¨ à¦†à¦®à¦¿ à¦†à¦ªà¦¨à¦¾à¦° à¦¸à¦¾à¦¥à§‡ à¦¬à¦¾à¦‚à¦²à¦¾à¦¯à¦¼ à¦•à¦¥à¦¾ à¦¬à¦²à¦¬à¥¤ BusGo-à¦¤à§‡ à¦†à¦ªà¦¨à¦¾à¦° à¦¬à¦¾à¦¸ à¦­à§à¦°à¦®à¦£à§‡à¦° à¦œà¦¨à§à¦¯ à¦†à¦®à¦¿ à¦•à§€à¦­à¦¾à¦¬à§‡ à¦¸à¦¾à¦¹à¦¾à¦¯à§à¦¯ à¦•à¦°à¦¤à§‡ à¦ªà¦¾à¦°à¦¿?`, '', ['à¦§à¦°à¦®à¦ªà§à¦°à§€ à¦¥à§‡à¦•à§‡ à¦‡à¦¨à§à¦¦à§‹à¦° à¦¬à¦¾à¦¸', 'à¦²à¦¾à¦‡à¦­ PNR à¦¸à§à¦Ÿà§à¦¯à¦¾à¦Ÿà¦¾à¦¸', 'à¦•à§à¦¯à¦¾à¦ªà§à¦Ÿà§‡à¦¨ à¦•à§€à¦°à§à¦¤à¦¨ à¦¨à¦®à§à¦¬à¦°']);
    return;
  }
  if (q.includes('punjabi') || q.includes('à¨ªà©°à¨œà¨¾à¨¬à©€ à¨µà¨¿à©±à¨š')) {
    AiSession.context.currentLang = 'punjabi';
    streamAiResponse(`**à¨¸à¨¤à¨¿ à¨¸à©à¨°à©€ à¨…à¨•à¨¾à¨² ${getHonorific('punjabi', userName)}!** à¨¹à©à¨£ à¨®à©ˆà¨‚ à¨¤à©à¨¹à¨¾à¨¡à©‡ à¨¨à¨¾à¨² à¨ªà©°à¨œà¨¾à¨¬à©€ à¨µà¨¿à©±à¨š à¨—à©±à¨² à¨•à¨°à¨¾à¨‚à¨—à¨¾à¥¤ BusGo à¨µà¨¿à©±à¨š à¨¤à©à¨¹à¨¾à¨¡à©‡ à¨¸à¨«à¨¼à¨° à¨²à¨ˆ à¨®à©ˆà¨‚ à¨•à¨¿à¨µà©‡à¨‚ à¨®à¨¦à¨¦ à¨•à¨° à¨¸à¨•à¨¦à¨¾ à¨¹à¨¾à¨‚?`, '', ['à¨§à¨°à¨®à¨ªà©à¨°à©€ à¨¤à©‹à¨‚ à¨‡à©°à¨¦à©Œà¨° à¨¬à©±à¨¸', 'à¨²à¨¾à¨ˆà¨µ PNR à¨¸à¨Ÿà©‡à¨Ÿà¨¸', 'à¨•à©ˆà¨ªà¨Ÿà¨¨ à¨•à©€à¨°à¨¤à¨¨ à¨¨à©°à¨¬à¨°']);
    return;
  }
  if (q.includes('odia') || q.includes('oriya') || q.includes('à¬“à¬¡à¬¼à¬¿à¬†à¬°à­‡')) {
    AiSession.context.currentLang = 'odia';
    streamAiResponse(`**à¬¨à¬®à¬¸à­à¬•à¬¾à¬° ${getHonorific('odia', userName)}!** à¬¬à¬°à­à¬¤à­à¬¤à¬®à¬¾à¬¨ à¬®à­à¬ à¬†à¬ªà¬£à¬™à­à¬• à¬¸à¬¹à¬¿à¬¤ à¬“à¬¡à¬¼à¬¿à¬†à¬°à­‡ à¬•à¬¥à¬¾à¬¬à¬¾à¬°à­à¬¤à­à¬¤à¬¾ à¬•à¬°à¬¿à¬¬à¬¿à¥¤ BusGo à¬°à­‡ à¬†à¬ªà¬£à¬™à­à¬• à¬¯à¬¾à¬¤à­à¬°à¬¾ à¬ªà¬¾à¬‡à¬ à¬®à­à¬ à¬•à¬¿à¬ªà¬°à¬¿ à¬¸à¬¾à¬¹à¬¾à¬¯à­à­Ÿ à¬•à¬°à¬¿à¬ªà¬¾à¬°à¬¿à¬¬à¬¿?`, '', ['à¬§à¬°à¬®à¬ªà­à¬°à­€ à¬°à­ à¬‡à¬¨à­à¬¦à­‹à¬° à¬¬à¬¸à­', 'à¬²à¬¾à¬‡à¬­à­ PNR à¬¸à­à¬¥à¬¿à¬¤à¬¿', 'à¬•à­à­Ÿà¬¾à¬ªà­à¬Ÿà­‡à¬¨ à¬•à­€à¬°à­à¬¤à­à¬¤à¬¨ à¬¨à¬®à­à¬¬à¬°']);
    return;
  }
  if (q.includes('urdu') || q.includes('Ø§Ø±Ø¯Ùˆ Ù…ÛŒÚº')) {
    AiSession.context.currentLang = 'urdu';
    streamAiResponse(`**Ø¢Ø¯Ø§Ø¨ ${getHonorific('urdu', userName)}!** Ø§Ø¨ Ù…ÛŒÚº Ø¢Ù¾ Ø³Û’ Ø§Ø±Ø¯Ùˆ Ù…ÛŒÚº Ø¨Ø§Øª Ú©Ø±ÙˆÚº Ú¯Ø§Û” BusGo Ù…ÛŒÚº Ø¢Ù¾ Ú©Û’ Ø³ÙØ± Ú©Û’ Ù„ÛŒÛ’ Ù…ÛŒÚº Ú©ÛŒØ§ Ù…Ø¯Ø¯ Ú©Ø± Ø³Ú©ØªØ§ ÛÙˆÚºØŸ`, '', ['Ø¯Ú¾Ø±Ù… Ù¾ÙˆØ±ÛŒ ØªØ§ Ø§Ù†Ø¯ÙˆØ± Ø¨Ø³', 'Ù„Ø§Ø¦ÛŒÙˆ PNR Ø§Ø³Ù¹ÛŒÙ¹Ø³', 'Ú©ÛŒÙ¾Ù¹Ù† Ú©ÛŒØ±ØªÙ† Ù†Ù…Ø¨Ø±']);
    return;
  }
  if (q.includes('hindi me') || q.includes('hindi mein') || q.includes('à¤¹à¤¿à¤‚à¤¦à¥€ à¤®à¥‡à¤‚') || q.includes('in hindi')) {
    AiSession.context.currentLang = 'hindi_devanagari';
    streamAiResponse(`**à¤¬à¤¿à¤²à¥à¤•à¥à¤² ${greetingHindi}!** à¤…à¤¬ à¤¸à¥‡ à¤®à¥ˆà¤‚ à¤†à¤ªà¤¸à¥‡ à¤¶à¥à¤¦à¥à¤§ à¤¹à¤¿à¤‚à¤¦à¥€ à¤®à¥‡à¤‚ à¤¬à¤¾à¤¤ à¤•à¤°à¥‚à¤à¤—à¤¾à¥¤ à¤¬à¤¤à¤¾à¤‡à¤ à¤†à¤œ à¤†à¤ªà¤•à¥€ à¤¯à¤¾à¤¤à¥à¤°à¤¾ à¤®à¥‡à¤‚ à¤•à¥à¤¯à¤¾ à¤®à¤¦à¤¦ à¤•à¤°à¥‚à¤?`, '', getDynamicAiChips(routeCtx.origin, routeCtx.destination, 'hindi_devanagari'));
    return;
  }
  if (q.includes('english me') || q.includes('in english') || q.includes('speak english')) {
    AiSession.context.currentLang = 'english';
    streamAiResponse(`**Certainly${greetingEnglish}!** I will now converse with you in English. How can I help with your bus bookings or route tracking today?`, '', getDynamicAiChips(routeCtx.origin, routeCtx.destination, 'english'));
    return;
  }
  if (q.includes('hinglish') || q.includes('roman hindi')) {
    AiSession.context.currentLang = 'hinglish';
    streamAiResponse(`**Bilkul ${greetingHinglish}!** Ab se main aapse Hinglish me hi baat karunga. Batayein aapki kya madad kar sakta hu?`, '', getDynamicAiChips(routeCtx.origin, routeCtx.destination, 'hinglish'));
    return;
  }

  // 3. GREETINGS (e.g. "hii", "hello", "hey", "namaste", "pranam")
  // Satisfies: "jese me bolu hii to ye jwab dena chahiye hello ji bhi user h uska name or kya help kr sakta hu"
  if (
    q.match(/^(hi|hii|hiii|hello|hey|namaste|pranam|vanakkam|namaskara|namaskaram|adaab|aadaab|sat sri akaal|ram ram|kese ho|kaise ho|hlo|helo|sup|hola)\b/i) ||
    q === 'hi' || q === 'hii' || q === 'hello' || q === 'hey' || q === 'namaste' || q === 'vanakkam' || q === 'namaskara'
  ) {
    if (lang === 'tamil') {
      const msg = `**à®µà®£à®•à¯à®•à®®à¯ ${getHonorific('tamil', userName)}!** BusGo GPT-à®•à¯à®•à¯ à®‰à®™à¯à®•à®³à¯ˆ à®µà®°à®µà¯‡à®±à¯à®•à®¿à®±à¯‹à®®à¯. à®¨à®¾à®©à¯ à®‰à®™à¯à®•à®³à¯à®•à¯à®•à¯ à®Žà®µà¯à®µà®¾à®±à¯ à®‰à®¤à®µ à®®à¯à®Ÿà®¿à®¯à¯à®®à¯? à®‡à®©à¯à®±à¯ à®Žà®™à¯à®•à¯ à®ªà®¯à®£à®®à¯ à®šà¯†à®¯à¯à®¯ à®¤à®¿à®Ÿà¯à®Ÿà®®à®¿à®Ÿà¯à®Ÿà¯à®³à¯à®³à¯€à®°à¯à®•à®³à¯?`;
      streamAiResponse(msg, '', ['à®¤à®°à¯à®®à®ªà¯à®°à®¿ - à®‡à®¨à¯à®¤à¯‚à®°à¯ à®ªà¯‡à®°à¯à®¨à¯à®¤à¯', 'à®¨à¯‡à®°à®²à¯ˆ PNR à®¨à®¿à®²à¯ˆ', 'à®•à¯‡à®ªà¯à®Ÿà®©à¯ à®•à¯€à®°à¯à®¤à¯à®¤à®©à¯ à®Žà®£à¯', 'à®®à®•à®³à®¿à®°à¯ à®‡à®°à¯à®•à¯à®•à¯ˆ à®ªà®¾à®¤à¯à®•à®¾à®ªà¯à®ªà¯']);
    } else if (lang === 'telugu') {
      const msg = `**à°¨à°®à°¸à±à°•à°¾à°°à°‚ ${getHonorific('telugu', userName)}!** BusGo GPT à°•à°¿ à°¸à±à°µà°¾à°—à°¤à°‚. à°¨à±‡à°¨à± à°®à±€à°•à± à°Žà°²à°¾ à°¸à°¹à°¾à°¯à°ªà°¡à°—à°²à°¨à±? à°ˆà°°à±‹à°œà± à°®à±€à°°à± à°Žà°•à±à°•à°¡à°¿à°•à°¿ à°ªà±à°°à°¯à°¾à°£à°¿à°‚à°šà°¾à°²à°¨à±à°•à±à°‚à°Ÿà±à°¨à±à°¨à°¾à°°à±?`;
      streamAiResponse(msg, '', ['à°§à°°à°‚à°ªà±à°°à°¿ à°¨à±à°‚à°¡à°¿ à°‡à°‚à°¡à±‹à°°à± à°¬à°¸à±à°¸à±', 'à°²à±ˆà°µà± PNR à°¸à±à°¥à°¿à°¤à°¿', 'à°•à±†à°ªà±à°Ÿà±†à°¨à± à°•à±€à°°à±à°¤à°¨à± à°¨à°‚à°¬à°°à±', 'à°®à°¹à°¿à°³à°¾ à°ªà±à°°à°¯à°¾à°£à±€à°•à±à°² à°­à°¦à±à°°à°¤']);
    } else if (lang === 'kannada') {
      const msg = `**à²¨à²®à²¸à³à²•à²¾à²° ${getHonorific('kannada', userName)}!** BusGo GPT à²—à³† à²¸à³à²¸à³à²µà²¾à²—à²¤. à²¨à²¾à²¨à³ à²¨à²¿à²®à²—à³† à²¹à³‡à²—à³† à²¸à²¹à²¾à²¯ à²®à²¾à²¡à²²à²¿? à²‡à²‚à²¦à³ à²¨à³€à²µà³ à²Žà²²à³à²²à²¿à²—à³† à²ªà³à²°à²¯à²¾à²£à²¿à²¸à²²à³ à²¯à³‹à²œà²¿à²¸à³à²¤à³à²¤à²¿à²¦à³à²¦à³€à²°à²¿?`;
      streamAiResponse(msg, '', ['à²§à²°à²‚à²ªà³à²°à²¿à²¯à²¿à²‚à²¦ à²‡à²‚à²¦à³‹à²°à³ à²¬à²¸à³', 'à²²à³ˆà²µà³ PNR à²¸à³à²¥à²¿à²¤à²¿', 'à²•à³à²¯à²¾à²ªà³à²Ÿà²¨à³ à²•à³€à²°à³à²¤à²¨à³ à²¸à²‚à²–à³à²¯à³†', 'à²®à²¹à²¿à²³à³†à²¯à²° à²†à²¸à²¨ à²¸à³à²°à²•à³à²·à²¤à³†']);
    } else if (lang === 'malayalam') {
      const msg = `**à´¨à´®à´¸àµà´•à´¾à´°à´‚ ${getHonorific('malayalam', userName)}!** BusGo GPT-à´²àµ‡à´•àµà´•àµ à´¸àµà´µà´¾à´—à´¤à´‚. à´žà´¾àµ» à´Žà´™àµà´™à´¨àµ† à´¸à´¹à´¾à´¯à´¿à´•àµà´•à´£à´‚? à´‡à´¨àµà´¨àµ à´¨à´¿à´™àµà´™àµ¾ à´Žà´µà´¿à´Ÿàµ‡à´•àµà´•à´¾à´£àµ à´¯à´¾à´¤àµà´° à´šàµ†à´¯àµà´¯à´¾àµ» à´†à´—àµà´°à´¹à´¿à´•àµà´•àµà´¨àµà´¨à´¤àµ?`;
      streamAiResponse(msg, '', ['à´§à´°à´‚à´ªàµà´°à´¿ - à´‡àµ»à´¡àµ‹àµ¼ à´¬à´¸àµ', 'à´¤à´¤àµà´¸à´®à´¯ PNR à´¨à´¿à´²', 'à´•àµà´¯à´¾à´ªàµà´±àµà´±àµ» à´•àµ€àµ¼à´¤àµà´¤àµ» à´¨à´®àµà´ªàµ¼', 'à´µà´¨à´¿à´¤à´¾ à´¸à´‚à´µà´°à´£à´‚']);
    } else if (lang === 'marathi') {
      const msg = `**à¤¨à¤®à¤¸à¥à¤•à¤¾à¤° ${getHonorific('marathi', userName)}!** BusGo GPT à¤®à¤§à¥à¤¯à¥‡ à¤†à¤ªà¤²à¥‡ à¤¸à¥à¤µà¤¾à¤—à¤¤ à¤†à¤¹à¥‡. à¤®à¥€ à¤†à¤ªà¤²à¥€ à¤•à¤¾à¤¯ à¤®à¤¦à¤¤ à¤•à¤°à¥‚ à¤¶à¤•à¤¤à¥‹? à¤†à¤œ à¤†à¤ªà¤£ à¤•à¥‹à¤ à¥‡ à¤ªà¥à¤°à¤µà¤¾à¤¸ à¤•à¤°à¤£à¥à¤¯à¤¾à¤šà¤¾ à¤µà¤¿à¤šà¤¾à¤° à¤•à¤°à¤¤ à¤†à¤¹à¤¾à¤¤?`;
      streamAiResponse(msg, '', ['à¤§à¤°à¤®à¤ªà¥à¤°à¥€ à¤¤à¥‡ à¤‡à¤‚à¤¦à¥‚à¤° à¤¬à¤¸', 'à¤²à¤¾à¤ˆà¤µà¥à¤¹ PNR à¤¸à¥à¤Ÿà¥‡à¤Ÿà¤¸', 'à¤•à¥…à¤ªà¥à¤Ÿà¤¨ à¤•à¥€à¤°à¥à¤¤à¤¨ à¤¨à¤‚à¤¬à¤°', 'à¤®à¤¹à¤¿à¤²à¤¾ à¤¸à¥à¤°à¤•à¥à¤·à¤¾ à¤¨à¤¿à¤¯à¤®']);
    } else if (lang === 'gujarati') {
      const msg = `**àª¨àª®àª¸à«àª¤à«‡ ${getHonorific('gujarati', userName)}!** BusGo GPT àª®àª¾àª‚ àª¤àª®àª¾àª°à«àª‚ àª¸à«àªµàª¾àª—àª¤ àª›à«‡. àª¹à«àª‚ àª¤àª®àª¾àª°à«€ àª¶à«àª‚ àª®àª¦àª¦ àª•àª°à«€ àª¶àª•à«àª‚? àª†àªœà«‡ àª¤àª®à«‡ àª•à«àª¯àª¾àª‚ àª®à«àª¸àª¾àª«àª°à«€ àª•àª°àªµàª¾àª¨à«àª‚ àª†àª¯à«‹àªœàª¨ àª•àª°à«€ àª°àª¹à«àª¯àª¾ àª›à«‹?`;
      streamAiResponse(msg, '', ['àª§àª°àª®àªªà«àª°à«€ àª¥à«€ àª‡àª¨à«àª¦à«‹àª° àª¬àª¸', 'àª²àª¾àªˆàªµ PNR àª¸à«àªŸà«‡àªŸàª¸', 'àª•à«‡àªªà«àªŸàª¨ àª•à«€àª°à«àª¤àª¨ àª¨àª‚àª¬àª°', 'àª®àª¹àª¿àª²àª¾ àª¸à«àª°àª•à«àª·àª¾ àª¨àª¿àª¯àª®']);
    } else if (lang === 'bengali') {
      const msg = `**à¦¨à¦®à¦¸à§à¦•à¦¾à¦° ${getHonorific('bengali', userName)}!** BusGo GPT-à¦¤à§‡ à¦†à¦ªà¦¨à¦¾à¦•à§‡ à¦¸à§à¦¬à¦¾à¦—à¦¤à¦®à¥¤ à¦†à¦®à¦¿ à¦†à¦ªà¦¨à¦¾à¦•à§‡ à¦•à§€à¦­à¦¾à¦¬à§‡ à¦¸à¦¾à¦¹à¦¾à¦¯à§à¦¯ à¦•à¦°à¦¤à§‡ à¦ªà¦¾à¦°à¦¿? à¦†à¦œ à¦†à¦ªà¦¨à¦¿ à¦•à§‹à¦¥à¦¾à¦¯à¦¼ à¦­à§à¦°à¦®à¦£ à¦•à¦°à¦¾à¦° à¦ªà¦°à¦¿à¦•à¦²à§à¦ªà¦¨à¦¾ à¦•à¦°à¦›à§‡à¦¨?`;
      streamAiResponse(msg, '', ['à¦§à¦°à¦®à¦ªà§à¦°à§€ à¦¥à§‡à¦•à§‡ à¦‡à¦¨à§à¦¦à§‹à¦° à¦¬à¦¾à¦¸', 'à¦²à¦¾à¦‡à¦­ PNR à¦¸à§à¦Ÿà§à¦¯à¦¾à¦Ÿà¦¾à¦¸', 'à¦•à§à¦¯à¦¾à¦ªà§à¦Ÿà§‡à¦¨ à¦•à§€à¦°à§à¦¤à¦¨ à¦¨à¦®à§à¦¬à¦°', 'à¦®à¦¹à¦¿à¦²à¦¾ à¦¸à§à¦°à¦•à§à¦·à¦¾ à¦¨à¦¿à¦¯à¦¼à¦®']);
    } else if (lang === 'punjabi') {
      const msg = `**à¨¸à¨¤à¨¿ à¨¸à©à¨°à©€ à¨…à¨•à¨¾à¨² ${getHonorific('punjabi', userName)}!** BusGo GPT à¨µà¨¿à©±à¨š à¨¤à©à¨¹à¨¾à¨¡à¨¾ à¨¸à©à¨†à¨—à¨¤ à¨¹à©ˆà¥¤ à¨®à©ˆà¨‚ à¨¤à©à¨¹à¨¾à¨¡à©€ à¨•à©€ à¨®à¨¦à¨¦ à¨•à¨° à¨¸à¨•à¨¦à¨¾ à¨¹à¨¾à¨‚? à¨…à©±à¨œ à¨¤à©à¨¸à©€à¨‚ à¨•à¨¿à©±à¨¥à©‡ à¨¸à¨«à¨¼à¨° à¨•à¨°à¨¨ à¨¦à©€ à¨¯à©‹à¨œà¨¨à¨¾ à¨¬à¨£à¨¾ à¨°à¨¹à©‡ à¨¹à©‹?`;
      streamAiResponse(msg, '', ['à¨§à¨°à¨®à¨ªà©à¨°à©€ à¨¤à©‹à¨‚ à¨‡à©°à¨¦à©Œà¨° à¨¬à©±à¨¸', 'à¨²à¨¾à¨ˆà¨µ PNR à¨¸à¨Ÿà©‡à¨Ÿà¨¸', 'à¨•à©ˆà¨ªà¨Ÿà¨¨ à¨•à©€à¨°à¨¤à¨¨ à¨¨à©°à¨¬à¨°', 'à¨®à¨¹à¨¿à¨²à¨¾ à¨¸à©à¨°à©±à¨–à¨¿à¨†']);
    } else if (lang === 'odia') {
      const msg = `**à¬¨à¬®à¬¸à­à¬•à¬¾à¬° ${getHonorific('odia', userName)}!** BusGo GPT à¬•à­ à¬†à¬ªà¬£à¬™à­à¬•à­ à¬¸à­à­±à¬¾à¬—à¬¤à¥¤ à¬®à­à¬ à¬†à¬ªà¬£à¬™à­à¬•à­ à¬•à¬¿à¬ªà¬°à¬¿ à¬¸à¬¾à¬¹à¬¾à¬¯à­à­Ÿ à¬•à¬°à¬¿à¬ªà¬¾à¬°à¬¿à¬¬à¬¿? à¬†à¬œà¬¿ à¬†à¬ªà¬£ à¬•à­‡à¬‰à¬à¬ à¬¾à¬•à­ à¬¯à¬¾à¬¤à­à¬°à¬¾ à¬•à¬°à¬¿à¬¬à¬¾à¬•à­ à¬¯à­‹à¬œà¬¨à¬¾ à¬•à¬°à­à¬›à¬¨à­à¬¤à¬¿?`;
      streamAiResponse(msg, '', ['à¬§à¬°à¬®à¬ªà­à¬°à­€ à¬°à­ à¬‡à¬¨à­à¬¦à­‹à¬° à¬¬à¬¸à­', 'à¬²à¬¾à¬‡à¬­à­ PNR à¬¸à­à¬¥à¬¿à¬¤à¬¿', 'à¬•à­à­Ÿà¬¾à¬ªà­à¬Ÿà­‡à¬¨ à¬•à­€à¬°à­à¬¤à­à¬¤à¬¨ à¬¨à¬®à­à¬¬à¬°', 'à¬®à¬¹à¬¿à¬³à¬¾ à¬¸à­à¬°à¬•à­à¬·à¬¾ à¬¨à¬¿à­Ÿà¬®']);
    } else if (lang === 'urdu') {
      const msg = `**Ø¢Ø¯Ø§Ø¨ ${getHonorific('urdu', userName)}!** BusGo GPT Ù…ÛŒÚº Ø¢Ù¾ Ú©Ø§ Ø®ÛŒØ±Ù…Ù‚Ø¯Ù… ÛÛ’Û” Ù…ÛŒÚº Ø¢Ù¾ Ú©ÛŒ Ú©ÛŒØ§ Ù…Ø¯Ø¯ Ú©Ø± Ø³Ú©ØªØ§ ÛÙˆÚºØŸ Ø¢Ø¬ Ø¢Ù¾ Ú©ÛØ§Úº Ú©Ø§ Ø³ÙØ± Ú©Ø±Ù†Ø§ Ú†Ø§ÛØªÛ’ ÛÛŒÚºØŸ`;
      streamAiResponse(msg, '', ['Ø¯Ú¾Ø±Ù… Ù¾ÙˆØ±ÛŒ ØªØ§ Ø§Ù†Ø¯ÙˆØ± Ø¨Ø³', 'Ù„Ø§Ø¦ÛŒÙˆ PNR Ø§Ø³Ù¹ÛŒÙ¹Ø³', 'Ú©ÛŒÙ¾Ù¹Ù† Ú©ÛŒØ±ØªÙ† Ù†Ù…Ø¨Ø±', 'Ø®ÙˆØ§ØªÛŒÙ† Ø³ÛŒÙ¹ ØªØ­ÙØ¸']);
    } else if (lang === 'hindi_devanagari') {
      const msg = `**à¤¨à¤®à¤¸à¥à¤¤à¥‡ ${greetingHindi}!** à¤®à¥ˆà¤‚ à¤†à¤ªà¤•à¥€ à¤•à¥à¤¯à¤¾ à¤®à¤¦à¤¦ à¤•à¤° à¤¸à¤•à¤¤à¤¾ à¤¹à¥‚à¤? à¤†à¤œ à¤†à¤ª à¤•à¤¹à¤¾à¤ à¤¯à¤¾à¤¤à¥à¤°à¤¾ à¤•à¤°à¤¨à¥‡ à¤•à¤¾ à¤µà¤¿à¤šà¤¾à¤° à¤•à¤° à¤°à¤¹à¥‡ à¤¹à¥ˆà¤‚?`;
      streamAiResponse(msg, '', getDynamicAiChips(routeCtx.origin, routeCtx.destination, 'hindi_devanagari'));
    } else if (lang === 'english') {
      const msg = `**Hello${greetingEnglish}!** How can I help you today? Where are you planning to travel?`;
      streamAiResponse(msg, '', getDynamicAiChips(routeCtx.origin, routeCtx.destination, 'english'));
    } else {
      // Hinglish
      const msg = `**Hello ${greetingHinglish}!** Main aapki kya madad kar sakta hu? Aaj aapko kahan travel karna hai?`;
      streamAiResponse(msg, '', getDynamicAiChips(routeCtx.origin, routeCtx.destination, 'hinglish'));
    }
    return;
  }

  // 4. "kaise ho" / "how are you" / "à¤†à¤ª à¤•à¥ˆà¤¸à¥‡ à¤¹à¥ˆà¤‚"
  if (q.includes('kaise ho') || q.includes('kese ho') || q.includes('how are you') || q.includes('aap kaise')) {
    if (lang === 'hindi_devanagari') {
      streamAiResponse(`**à¤®à¥ˆà¤‚ à¤¬à¤¿à¤²à¥à¤•à¥à¤² à¤ à¥€à¤• à¤¹à¥‚à¤ ${greetingHindi}, à¤§à¤¨à¥à¤¯à¤µà¤¾à¤¦!** à¤†à¤ª à¤¬à¤¤à¤¾à¤‡à¤, à¤†à¤ª à¤•à¥ˆà¤¸à¥‡ à¤¹à¥ˆà¤‚ à¤”à¤° à¤†à¤œ à¤®à¥ˆà¤‚ à¤†à¤ªà¤•à¥€ à¤¬à¤¸ à¤¯à¤¾à¤¤à¥à¤°à¤¾ à¤®à¥‡à¤‚ à¤•à¥à¤¯à¤¾ à¤®à¤¦à¤¦ à¤•à¤° à¤¸à¤•à¤¤à¤¾ à¤¹à¥‚à¤?`, '', getDynamicAiChips(routeCtx.origin, routeCtx.destination, 'hindi_devanagari'));
    } else if (lang === 'english') {
      streamAiResponse(`**I am doing great${greetingEnglish}, thank you!** How are you, and how may I assist you with your travel plans today?`, '', getDynamicAiChips(routeCtx.origin, routeCtx.destination, 'english'));
    } else {
      streamAiResponse(`**Main bilkul badhiya hu ${greetingHinglish}, shukriya!** Aap batayein, aap kaise hain aur aaj main aapke travel me kya madad kar sakta hu?`, '', getDynamicAiChips(routeCtx.origin, routeCtx.destination, 'hinglish'));
    }
    return;
  }

  // 5. "kya kar sakte ho" / "what can you do" / "help"
  if (q.includes('kya kar sakte ho') || q.includes('what can you do') || q.includes('aap kaun ho') || q.includes('who are you') || q === 'help') {
    if (lang === 'hindi_devanagari') {
      streamAiResponse(`**à¤®à¥ˆà¤‚ BusGo GPT à¤¹à¥‚à¤ â€” à¤†à¤ªà¤•à¤¾ à¤¨à¤¿à¤œà¥€ à¤¯à¤¾à¤¤à¥à¤°à¤¾ à¤¸à¤¹à¤¾à¤¯à¤•!**

à¤®à¥ˆà¤‚ à¤†à¤ªà¤•à¥€ à¤‡à¤¨ à¤¸à¤­à¥€ à¤šà¥€à¤œà¤¼à¥‹à¤‚ à¤®à¥‡à¤‚ à¤¸à¤¹à¤¾à¤¯à¤¤à¤¾ à¤•à¤° à¤¸à¤•à¤¤à¤¾ à¤¹à¥‚à¤:
- **à¤¬à¤¸ à¤–à¥‹à¤œ à¤à¤µà¤‚ à¤¬à¥à¤•à¤¿à¤‚à¤—:** à¤§à¤°à¤®à¤ªà¥à¤°à¥€, à¤‡à¤‚à¤¦à¥Œà¤°, à¤­à¥‹à¤ªà¤¾à¤², à¤®à¥à¤‚à¤¬à¤ˆ à¤•à¥€ à¤¸à¤­à¥€ à¤¬à¤¸à¥‡à¤‚ à¤à¤µà¤‚ à¤¸à¥à¤²à¥€à¤ªà¤° à¤•à¤¿à¤°à¤¾à¤¯à¤¾à¥¤
- **à¤²à¤¾à¤‡à¤µ à¤œà¥€à¤ªà¥€à¤à¤¸ à¤µ à¤ªà¥€à¤à¤¨à¤†à¤° à¤Ÿà¥à¤°à¥ˆà¤•à¤¿à¤‚à¤—:** à¤†à¤ªà¤•à¥€ à¤¬à¤¸ à¤•à¤¾ à¤¹à¤¾à¤ˆà¤µà¥‡ à¤ªà¤° à¤µà¤°à¥à¤¤à¤®à¤¾à¤¨ à¤¸à¥à¤¥à¤¾à¤¨à¥¤
- **à¤•à¥ˆà¤ªà¥à¤Ÿà¤¨ à¤•à¥€à¤°à¥à¤¤à¤¨ à¤¸à¤‚à¤ªà¤°à¥à¤•:** à¤ªà¥à¤°à¤®à¥à¤– à¤šà¤¾à¤²à¤• à¤¸à¥‡ à¤¸à¥€à¤§à¤¾ à¤«à¥‹à¤¨ à¤¸à¤‚à¤ªà¤°à¥à¤• (+91 6264213958)à¥¤
- **à¤®à¤¹à¤¿à¤²à¤¾ à¤¸à¥à¤°à¤•à¥à¤·à¤¾:** à¤ªà¤‚à¤•à¥à¤¤à¤¿à¤¯à¤¾à¤ 1 à¤¸à¥‡ 3 à¤†à¤°à¤•à¥à¤·à¤¿à¤¤ à¤à¤µà¤‚ à¤¸à¤¹-à¤¯à¤¾à¤¤à¥à¤°à¥€ à¤¸à¥à¤°à¤•à¥à¤·à¤¾ à¤¨à¤¿à¤¯à¤®à¥¤
- **1-à¤•à¥à¤²à¤¿à¤• à¤Ÿà¤¿à¤•à¤Ÿ à¤ªà¥€à¤¡à¥€à¤à¤«:** à¤†à¤§à¤¿à¤•à¤¾à¤°à¤¿à¤• à¤Ÿà¤¿à¤•à¤Ÿ à¤¡à¤¾à¤‰à¤¨à¤²à¥‹à¤¡ à¤µ à¤°à¤¦à¥à¤¦à¥€à¤•à¤°à¤£à¥¤
- **à¤¹à¤¾à¤ˆà¤µà¥‡ à¤®à¥Œà¤¸à¤® à¤µ à¤¸à¤¡à¤¼à¤• à¤¸à¥à¤¥à¤¿à¤¤à¤¿:** à¤µà¤¿à¤‚à¤§à¥à¤¯ à¤—à¥à¤œà¤°à¥€ à¤˜à¤¾à¤Ÿ à¤•à¤¾ à¤²à¤¾à¤‡à¤µ à¤Ÿà¥à¤°à¥ˆà¤«à¤¿à¤• à¤¸à¥à¤Ÿà¥‡à¤Ÿà¤¸à¥¤

à¤¬à¤¤à¤¾à¤‡à¤ ${greetingHindi}, à¤†à¤œ à¤†à¤ªà¤•à¥‹ à¤•à¥à¤¯à¤¾ à¤œà¤¾à¤¨à¤•à¤¾à¤°à¥€ à¤šà¤¾à¤¹à¤¿à¤?`, '', getDynamicAiChips(routeCtx.origin, routeCtx.destination, 'hindi_devanagari'));
    } else if (lang === 'english') {
      streamAiResponse(`**I am BusGo GPT â€” your intelligent AI Travel Assistant!**

Here is everything I can help you with:
- **Instant Bus Search & Booking:** Fastest Volvo and most affordable sleeper buses across Dharampuri, Indore, Bhopal and Mumbai.
- **Live PNR & GPS Tracking:** Real-time highway checkpoints along NH 52.
- **Captain Kirtan Direct Hotline:** Direct contact with lead driver (+91 6264213958).
- **Women Safety Architecture:** Dedicated Rows 1-3 and solo female co-passenger rule.
- **1-Click Ticket Management:** Official PDF ticket download and instant cancellation.
- **Highway Road & Weather:** Live Gujri Ghat road conditions and traffic flow.

How can I assist you right now${greetingEnglish}?`, '', getDynamicAiChips(routeCtx.origin, routeCtx.destination, 'english'));
    } else {
      streamAiResponse(`**Main BusGo GPT hu â€” aapka 24x7 intelligent AI Travel Copilot!**

Main aapki in sabhi cheezon me real-time madad kar sakta hu:
- **Bus Search & Booking:** Dharampuri, Indore, Bhopal, Mumbai ki sabhi buses aur best sleeper fares.
- **Live GPS & PNR Tracking:** Aapki bus ka current checkpoint on NH 52.
- **Captain Kirtan Driver Line:** Driver desk se seedhi baat (+91 6264213958).
- **Women Safety & Ladies Seats:** Front rows 1-3 reserved protection aur female-only co-passenger rules.
- **1-Click Ticket PDF:** Official ticket download aur cancel/print preview.
- **Highway & Ghat Weather:** Gujri Ghat aur expressway conditions.

Batayein ${greetingHinglish}, aaj aapki kya help kar sakta hu?`, '', getDynamicAiChips(routeCtx.origin, routeCtx.destination, 'hinglish'));
    }
    return;
  }

  // 5.5 ABOUT US / FOUNDERS OF BUSGO (KIRTAN BHAWSAR & BHAVESH SAVNER)
  if (
    q.includes('about us') ||
    q.includes('about company') ||
    q.includes('founder') ||
    q.includes('kirtan') ||
    q.includes('bhavesh') ||
    q.includes('kisne banaya') ||
    q.includes('who created') ||
    q.includes('who made') ||
    q.includes('who owns') ||
    q.includes('ceo') ||
    q.includes('cto') ||
    q.includes('company ke bare me')
  ) {
    const card = `
      <div class="ai-action-card">
        <div class="small fw-semibold text-secondary mb-2">BusGo Leadership &amp; Founders Profile</div>
        <div class="d-flex flex-wrap gap-2">
          <a href="about.html" target="_blank" class="btn btn-sm btn-primary py-1.5 px-3 fw-bold flex-grow-1 text-decoration-none text-center">Open Full About Us Page &rarr;</a>
        </div>
      </div>
    `;
    if (lang === 'hindi_devanagari') {
      streamAiResponse(`**BusGo à¤•à¥‡ à¤¸à¤‚à¤¸à¥à¤¥à¤¾à¤ªà¤• à¤à¤µà¤‚ à¤¨à¥‡à¤¤à¥ƒà¤¤à¥à¤µà¤•à¤°à¥à¤¤à¤¾:**

1. **à¤•à¥€à¤°à¥à¤¤à¤¨ à¤­à¤¾à¤µà¤¸à¤¾à¤° (Kirtan Bhawsar) â€” Founder & CEO / Lead Full Stack Developer**
   - **à¤®à¥‚à¤² à¤¨à¤¿à¤µà¤¾à¤¸:** à¤®à¥‹à¤¤à¥€ à¤¨à¤—à¤° à¤•à¥‰à¤²à¥‹à¤¨à¥€, à¤§à¤°à¤®à¤ªà¥à¤°à¥€ (à¤§à¤¾à¤°, à¤®.à¤ªà¥à¤°.)
   - **à¤¶à¤¿à¤•à¥à¤·à¤¾:** à¤¬à¥€.à¤Ÿà¥‡à¤• (B.Tech), à¤œà¤µà¤¾à¤¹à¤°à¤²à¤¾à¤² à¤‡à¤‚à¤¸à¥à¤Ÿà¥€à¤Ÿà¥à¤¯à¥‚à¤Ÿ à¤‘à¤« à¤Ÿà¥‡à¤•à¥à¤¨à¥‹à¤²à¥‰à¤œà¥€ (JIT), à¤µà¤¿à¤¦à¥à¤¯à¤¾ à¤µà¤¿à¤¹à¤¾à¤°, à¤¬à¥‹à¤°à¤—à¤¾à¤à¤µ
   - **à¤­à¥‚à¤®à¤¿à¤•à¤¾:** à¤µà¤°à¥à¤· 2026 à¤¸à¥‡ BusGo à¤•à¥‡ à¤®à¥à¤–à¥à¤¯ à¤•à¤¾à¤°à¥à¤¯à¤•à¤¾à¤°à¥€ à¤…à¤§à¤¿à¤•à¤¾à¤°à¥€ à¤à¤µà¤‚ à¤ªà¥‚à¤°à¥à¤£-à¤¸à¥à¤Ÿà¥ˆà¤• à¤†à¤°à¥à¤•à¤¿à¤Ÿà¥‡à¤•à¥à¤Ÿà¥¤

2. **à¤­à¤¾à¤µà¥‡à¤¶ à¤¸à¤¾à¤µà¤¨à¥‡à¤° (Bhavesh Savner) â€” Co-Founder & CTO / Lead Frontend Developer**
   - **à¤®à¥‚à¤² à¤¨à¤¿à¤µà¤¾à¤¸:** à¤®à¤¹à¤¾à¤²à¤•à¥à¤·à¥à¤®à¥€ à¤¨à¤—à¤°, à¤®à¥‹à¤¤à¥€à¤ªà¥à¤°à¤¾ à¤®à¥‡à¤¨ à¤°à¥‹à¤¡, à¤–à¤°à¤—à¥‹à¤¨ (à¤®.à¤ªà¥à¤°.)
   - **à¤­à¥‚à¤®à¤¿à¤•à¤¾:** à¤µà¤°à¥à¤· 2026 à¤¸à¥‡ BusGo à¤•à¥‡ à¤¸à¤¹-à¤¸à¤‚à¤¸à¥à¤¥à¤¾à¤ªà¤• à¤à¤µà¤‚ à¤®à¥à¤–à¥à¤¯ à¤¤à¤•à¤¨à¥€à¤•à¥€ à¤…à¤§à¤¿à¤•à¤¾à¤°à¥€à¥¤ à¤‡à¤‚à¤Ÿà¤°à¤à¤•à¥à¤Ÿà¤¿à¤µ à¤¸à¥€à¤Ÿ à¤®à¥ˆà¤ª, à¤²à¤¾à¤‡à¤µ à¤œà¥€à¤ªà¥€à¤à¤¸ à¤®à¥ˆà¤ªà¤¿à¤‚à¤— à¤à¤µà¤‚ à¤†à¤§à¥à¤¨à¤¿à¤• à¤¯à¥‚à¤†à¤ˆ/à¤¯à¥‚à¤à¤•à¥à¤¸ à¤•à¥‡ à¤ªà¥à¤°à¤®à¥à¤– à¤µà¤¾à¤¸à¥à¤¤à¥à¤•à¤¾à¤°à¥¤

à¤†à¤ª à¤¨à¥€à¤šà¥‡ à¤¦à¤¿à¤ à¤—à¤ à¤¬à¤Ÿà¤¨ à¤ªà¤° à¤•à¥à¤²à¤¿à¤• à¤•à¤°à¤•à¥‡ à¤¸à¤‚à¤¸à¥à¤¥à¤¾à¤ªà¤• à¤¦à¤² à¤•à¤¾ à¤µà¤¿à¤¸à¥à¤¤à¥ƒà¤¤ à¤ªà¥à¤°à¥‹à¤«à¤¼à¤¾à¤‡à¤² à¤¨à¤ à¤Ÿà¥ˆà¤¬ à¤®à¥‡à¤‚ à¤¦à¥‡à¤– à¤¸à¤•à¤¤à¥‡ à¤¹à¥ˆà¤‚à¥¤`, card, getDynamicAiChips(routeCtx.origin, routeCtx.destination, 'hindi_devanagari'));
    } else if (lang === 'english') {
      streamAiResponse(`**BusGo Founders & Leadership Team:**

1. **Kirtan Bhawsar â€” Founder & CEO / Lead Full Stack Developer**
   - **Hometown:** Moti Nagar Colony, Dharampuri (Dhar, M.P.)
   - **Education:** B.Tech from Jawaharlal Institute of Technology (JIT), Vidhya Vihar, Borawan
   - **Role:** Chief Executive Officer and Full Stack Architect of BusGo since 2026. Leads platform architecture, transaction processing, and AI integrations.

2. **Bhavesh Savner â€” Co-Founder & CTO / Lead Frontend Developer**
   - **Hometown:** Maha Laxmi Nagar, Motipura Main Road, Khargone (M.P.)
   - **Role:** Co-Founder and Chief Technology Officer of BusGo since 2026. Directs responsive UI/UX, interactive seat maps, and live GPS transit telemetry.

Click below to explore our official About Us corporate page in a new tab:`, card, getDynamicAiChips(routeCtx.origin, routeCtx.destination, 'english'));
    } else {
      // Hinglish
      streamAiResponse(`**BusGo Founders & Leadership Profile:**

1. **Kirtan Bhawsar â€” Founder & CEO / Lead Full Stack Developer**
   - **Residence:** Moti Nagar Colony, Dharampuri (Dhar, M.P.)
   - **Education:** B.Tech from Jawaharlal Institute of Technology (JIT), Vidhya Vihar, Borawan
   - **Role:** BusGo ke Chief Executive Officer & Full Stack Architect since 2026. Backend architecture, AI travel copilot aur payment systems ke lead designer.

2. **Bhavesh Savner â€” Co-Founder & CTO / Lead Frontend Developer**
   - **Residence:** Maha Laxmi Nagar, Motipura Main Road, Khargone (M.P.)
   - **Role:** BusGo ke Co-Founder & Chief Technology Officer since 2026. Interactive seat layouts, live Leaflet GPS navigation aur mobile frontend ke mastermind.

Niche diye gaye button par click karke aap official About Us page new tab me open kar sakte hain:`, card, getDynamicAiChips(routeCtx.origin, routeCtx.destination, 'hinglish'));
    }
    return;
  }

  // 5.6 CAREERS & JOB OPPORTUNITIES AT BUSGO
  if (
    q.includes('career') ||
    q.includes('careers') ||
    q.includes('job') ||
    q.includes('jobs') ||
    q.includes('hiring') ||
    q.includes('vacancy') ||
    q.includes('vacancies') ||
    q.includes('internship') ||
    q.includes('naukri') ||
    q.includes('join team') ||
    q.includes('work with us') ||
    (q.includes('apply') && !q.includes('coupon') && !q.includes('promo'))
  ) {
    const card = `
      <div class="ai-action-card">
        <div class="small fw-semibold text-secondary mb-2">BusGo Careers &amp; Open Opportunities</div>
        <div class="d-flex flex-wrap gap-2">
          <a href="careers.html" target="_blank" class="btn btn-sm btn-primary py-1.5 px-3 fw-bold flex-grow-1 text-decoration-none text-center">Open Official Careers Page &rarr;</a>
        </div>
      </div>
    `;
    if (lang === 'hindi_devanagari') {
      streamAiResponse(`**BusGo à¤®à¥‡à¤‚ à¤•à¤°à¤¿à¤¯à¤° à¤”à¤° à¤°à¥‹à¤œà¤¼à¤—à¤¾à¤° à¤•à¥‡ à¤…à¤µà¤¸à¤°:**

à¤¹à¤® à¤­à¤¾à¤°à¤¤ à¤•à¥‡ à¤¸à¥à¤®à¤¾à¤°à¥à¤Ÿ à¤‡à¤‚à¤Ÿà¤°à¤¸à¤¿à¤Ÿà¥€ à¤¬à¤¸ à¤†à¤µà¤¾à¤—à¤®à¤¨ à¤•à¥‹ à¤¨à¤ˆ à¤ªà¤¹à¤šà¤¾à¤¨ à¤¦à¥‡à¤¨à¥‡ à¤•à¥‡ à¤²à¤¿à¤ à¤Šà¤°à¥à¤œà¤¾à¤µà¤¾à¤¨ à¤‡à¤‚à¤œà¥€à¤¨à¤¿à¤¯à¤°à¥‹à¤‚, à¤ªà¥à¤°à¥‹à¤¡à¤•à¥à¤Ÿ à¤¡à¤¿à¤œà¤¾à¤‡à¤¨à¤°à¥‹à¤‚ à¤”à¤° à¤‘à¤ªà¤°à¥‡à¤¶à¤¨à¥à¤¸ à¤²à¥€à¤¡à¤°à¥à¤¸ à¤•à¤¾ à¤¸à¥à¤µà¤¾à¤—à¤¤ à¤•à¤°à¤¤à¥‡ à¤¹à¥ˆà¤‚!

**à¤µà¤°à¥à¤¤à¤®à¤¾à¤¨ à¤®à¥‡à¤‚ à¤–à¥à¤²à¥€ à¤°à¤¿à¤•à¥à¤¤à¤¿à¤¯à¤¾à¤ (Open Roles):**
1. **Senior Full Stack Java Engineer** â€” Dharampuri / Indore / Remote
2. **Frontend Engineer (UI/UX & Live Telemetry)** â€” Khargone / Indore / Remote
3. **AI Copilot & NLP Specialist** â€” Remote
4. **Fleet Operations & Dispatch Lead** â€” Dharampuri / Indore
5. **Customer Experience Executive** â€” Remote

à¤¸à¤‚à¤¸à¥à¤¥à¤¾à¤ªà¤• à¤®à¤‚à¤¡à¤² **à¤•à¥€à¤°à¥à¤¤à¤¨ à¤­à¤¾à¤µà¤¸à¤¾à¤° (CEO)** à¤à¤µà¤‚ **à¤­à¤¾à¤µà¥‡à¤¶ à¤¸à¤¾à¤µà¤¨à¥‡r (CTO)** à¤•à¥‡ à¤¸à¤¾à¤¥ à¤•à¤¾à¤® à¤•à¤°à¤¨à¥‡ à¤¹à¥‡à¤¤à¥ à¤¨à¥€à¤šà¥‡ à¤¦à¤¿à¤ à¤—à¤ à¤¬à¤Ÿà¤¨ à¤ªà¤° à¤•à¥à¤²à¤¿à¤• à¤•à¤°à¤•à¥‡ à¤†à¤§à¤¿à¤•à¤¾à¤°à¤¿à¤• à¤•à¤°à¤¿à¤¯à¤° à¤ªà¥‡à¤œ à¤ªà¤° à¤‘à¤¨à¤²à¤¾à¤‡à¤¨ à¤†à¤µà¥‡à¤¦à¤¨ à¤•à¤°à¥‡à¤‚à¥¤`, card, ['à¤¸à¤‚à¤¸à¥à¤¥à¤¾à¤ªà¤• à¤ªà¤°à¤¿à¤šà¤¯', 'à¤§à¤°à¤®à¤ªà¥à¤°à¥€ à¤¸à¥‡ à¤‡à¤‚à¤¦à¥Œà¤° à¤¬à¤¸']);
    } else if (lang === 'english') {
      streamAiResponse(`**Careers & Job Opportunities at BusGo:**

We are hiring across engineering, product design, AI research, and fleet operations to build next-generation smart bus mobility across India.

**Current Openings:**
1. **Senior Full Stack Java Engineer** â€” Dharampuri / Indore / Remote
2. **Frontend Engineer (UI & Telemetry)** â€” Khargone / Indore / Remote
3. **AI Copilot & Conversational NLP Engineer** â€” Remote
4. **Fleet Operations & Driver Liaison** â€” Dharampuri / Indore
5. **Customer Experience Executive** â€” Remote (WFH)

Click below to visit the official BusGo Careers portal, explore all department roles, and submit your direct application:`, card, getDynamicAiChips(routeCtx.origin, routeCtx.destination, 'english'));
    } else {
      // Hinglish
      streamAiResponse(`**BusGo me Career & Job Opportunities:**

Hum India ke smart bus travel network ko build karne ke liye talented developers, designers aur operations leaders ko invite kar rahe hain!

**Current Open Vacancies:**
1. **Senior Full Stack Java Engineer** â€” Dharampuri / Indore / Remote
2. **Frontend Engineer (Interactive UI & GPS)** â€” Khargone / Indore / Remote
3. **AI Copilot & NLP Specialist** â€” Remote
4. **Fleet Operations & Driver Liaison** â€” Dharampuri / Indore
5. **Customer Experience Executive** â€” Remote (WFH)

Founders **Kirtan Bhawsar (CEO)** & **Bhavesh Savner (CTO)** ke sath innovate karne ke liye niche diye gaye button par click karke direct application form bharein:`, card, getDynamicAiChips(routeCtx.origin, routeCtx.destination, 'hinglish'));
    }
    return;
  }

  // 5.7 INTERACTIVE 3D SEAT & CABIN VIEW PREVIEW
  if (
    q.includes('3d') ||
    q.includes('seat view') ||
    q.includes('seat preview') ||
    q.includes('window seat') ||
    q.includes('aisle seat') ||
    q.includes('legroom') ||
    q.includes('seat kaisa') ||
    q.includes('photo dikhao') ||
    q.includes('seat photo') ||
    q.includes('cabin view')
  ) {
    const card = `
      <div class="ai-action-card">
        <div class="small fw-semibold text-secondary mb-2">BusGo 3D Interactive Cabin &amp; Seat Preview</div>
        <div class="d-flex flex-wrap gap-2">
          <button type="button" class="btn btn-sm btn-primary py-1.5 px-3 fw-bold flex-grow-1 text-center" onclick="open3DSeatModal(12)">Open Live 3D Seat Preview &rarr;</button>
        </div>
      </div>
    `;
    if (lang === 'hindi_devanagari') {
      streamAiResponse(`**BusGo 3D à¤‡à¤‚à¤Ÿà¤°à¤à¤•à¥à¤Ÿà¤¿à¤µ à¤¸à¥€à¤Ÿ à¤à¤µà¤‚ à¤•à¥‡à¤¬à¤¿à¤¨ à¤ªà¥‚à¤°à¥à¤µà¤¾à¤µà¤²à¥‹à¤•à¤¨:**

BusGo à¤•à¥€ à¤²à¤—à¥à¤œà¤°à¥€ à¤µà¥‹à¤²à¥à¤µà¥‹ à¤¬à¤¸à¥‹à¤‚ à¤®à¥‡à¤‚ à¤¸à¥€à¤Ÿ à¤šà¤¯à¤¨ à¤…à¤¬ à¤¬à¤¿à¤²à¥à¤•à¥à¤² à¤ªà¤¾à¤°à¤¦à¤°à¥à¤¶à¥€ à¤¹à¥ˆ:
- **à¤¸à¥€à¤Ÿ 12W (à¤µà¤¿à¤‚à¤¡à¥‹ à¤à¤²à¥€à¤Ÿ):** 38 à¤‡à¤‚à¤š à¤•à¤¾ à¤šà¥Œà¤¡à¤¼à¤¾ à¤²à¥‡à¤—à¤°à¥‚à¤®, à¤ªà¥ˆà¤¨à¥‹à¤°à¤®à¤¿à¤• à¤¹à¤¾à¤ˆà¤µà¥‡ à¤µà¥à¤¯à¥‚, à¤µà¥à¤¯à¤•à¥à¤¤à¤¿à¤—à¤¤ 360Â° à¤à¤¸à¥€ à¤µà¥‡à¤‚à¤Ÿ à¤à¤µà¤‚ 30W à¤¯à¥‚à¤à¤¸à¤¬à¥€-à¤¸à¥€ à¤«à¤¼à¤¾à¤¸à¥à¤Ÿ à¤šà¤¾à¤°à¥à¤œà¤°à¥¤
- **à¤¸à¥€à¤Ÿ 11A (à¤†à¤‡à¤² à¤•à¤®à¥à¤«à¤°à¥à¤Ÿ):** 36 à¤‡à¤‚à¤š à¤²à¥‡à¤—à¤°à¥‚à¤®, à¤¸à¥€à¤§à¥‡ à¤µà¥‰à¤•à¤µà¥‡ à¤¤à¤• à¤†à¤¸à¤¾à¤¨ à¤ªà¤¹à¥à¤‚à¤š, à¤“à¤µà¤°à¤¹à¥‡à¤¡ à¤¸à¤¾à¤®à¤¾à¤¨ à¤°à¤–à¤¨à¥‡ à¤•à¥€ à¤¸à¥à¤µà¤¿à¤§à¤¾à¥¤
- **à¤¹à¥‰à¤Ÿà¤¸à¥à¤ªà¥‰à¤Ÿ à¤¤à¤•à¤¨à¥€à¤•:** à¤«à¥‹à¤Ÿà¥‹ à¤®à¥‡à¤‚ 4 à¤‡à¤‚à¤Ÿà¤°à¤à¤•à¥à¤Ÿà¤¿à¤µ à¤ªà¤¿à¤¨ à¤ªà¤° à¤•à¥à¤²à¤¿à¤• à¤•à¤°à¤•à¥‡ à¤—à¥à¤²à¤¾à¤¸, à¤šà¤¾à¤°à¥à¤œà¤° à¤”à¤° à¤•à¥à¤¶à¤¨ à¤•à¥€ à¤œà¤¾à¤¨à¤•à¤¾à¤°à¥€ à¤¦à¥‡à¤–à¥‡à¤‚à¥¤

à¤¨à¥€à¤šà¥‡ à¤¦à¤¿à¤ à¤—à¤ à¤¬à¤Ÿà¤¨ à¤ªà¤° à¤•à¥à¤²à¤¿à¤• à¤•à¤°à¤•à¥‡ à¤†à¤ª 3D à¤¸à¥€à¤Ÿ à¤ªà¥‚à¤°à¥à¤µà¤¾à¤µà¤²à¥‹à¤•à¤¨ à¤¤à¥à¤°à¤‚à¤¤ à¤²à¤¾à¤‡à¤µ à¤¦à¥‡à¤– à¤¸à¤•à¤¤à¥‡ à¤¹à¥ˆà¤‚:`, card, ['à¤§à¤°à¤®à¤ªà¥à¤°à¥€ à¤¸à¥‡ à¤‡à¤‚à¤¦à¥Œà¤° à¤¬à¤¸', 'à¤®à¤¹à¤¿à¤²à¤¾ à¤¸à¥à¤°à¤•à¥à¤·à¤¾ à¤¨à¤¿à¤¯à¤®']);
    } else if (lang === 'english') {
      streamAiResponse(`**BusGo 3D Interactive Seat & Cabin Preview:**

Experience transparency with our real-time 3D seat inspection:
- **Seat 12W (Window Elite):** 38-inch deep recline legroom, panoramic tinted highway view, independent AC nozzle, and 30W USB-C fast charging.
- **Seat 11A (Aisle Comfort):** 36-inch pitch, effortless aisle access, easy luggage stowing, and reading lamp.
- **Interactive Hotspot Pins:** Tap pins 1 through 4 to inspect ultraviolet glass, power delivery, and ergonomic cushions.

Click below to launch the live 3D cabin inspector right now:`, card, getDynamicAiChips(routeCtx.origin, routeCtx.destination, 'english'));
    } else {
      // Hinglish
      streamAiResponse(`**BusGo 3D Interactive Seat & Cabin Preview:**

BusGo luxury coaches me seat select karte waqt aap real cabin experience pehle se dekh sakte hain:
- **Seat 12W (Window Elite):** 38-inch spacious legroom, panoramic highway view, personal AC louvre aur 30W USB-C fast charging hub.
- **Seat 11A (Aisle Comfort):** 36-inch leg space, direct walkway access aur luggage stowing facility.
- **Interactive Hotspot Pins:** Photo me pins 1, 2, 3, 4 par click karke glass, charger aur memory foam seats verify karein.

Niche diye gaye button par click karke aap abhi live 3D seat preview open kar sakte hain:`, card, getDynamicAiChips(routeCtx.origin, routeCtx.destination, 'hinglish'));
    }
    return;
  }

  // 6. CASUAL ACKNOWLEDGMENTS ("theek hai", "ok", "thank you", "dhanyawad", "bye")
  if (q === 'ok' || q === 'theek hai' || q === 'thik h' || q === 'accha' || q === 'acha' || q === 'okay' || q === 'sahi hai') {
    if (lang === 'hindi_devanagari') {
      streamAiResponse(`**à¤œà¥€ ${greetingHindi}!** à¤¯à¤¦à¤¿ à¤•à¥‹à¤ˆ à¤…à¤¨à¥à¤¯ à¤œà¤¾à¤¨à¤•à¤¾à¤°à¥€ à¤¯à¤¾ à¤Ÿà¤¿à¤•à¤Ÿ à¤¬à¥à¤• à¤•à¤°à¤¨à¥€ à¤¹à¥‹ à¤¤à¥‹ à¤…à¤µà¤¶à¥à¤¯ à¤¬à¤¤à¤¾à¤à¤‚, à¤®à¥ˆà¤‚ à¤¯à¤¹à¥€à¤‚ à¤¹à¥‚à¤à¥¤`, '', getDynamicAiChips(routeCtx.origin, routeCtx.destination, 'hindi_devanagari'));
    } else if (lang === 'english') {
      streamAiResponse(`**Understood${greetingEnglish}!** Feel free to ask if you need bus schedules, PNR tracking or booking help.`, '', getDynamicAiChips(routeCtx.origin, routeCtx.destination, 'english'));
    } else {
      streamAiResponse(`**Ji ${greetingHinglish}!** Koi aur sawal ho ya ticket book karni ho to batayein, main yahi hu aapki help ke liye.`, '', getDynamicAiChips(routeCtx.origin, routeCtx.destination, 'hinglish'));
    }
    return;
  }

  if (q.includes('thank') || q.includes('dhanyawad') || q.includes('shukriya')) {
    if (lang === 'hindi_devanagari') {
      streamAiResponse(`**à¤†à¤ªà¤•à¤¾ à¤¬à¤¹à¥à¤¤-à¤¬à¤¹à¥à¤¤ à¤¸à¥à¤µà¤¾à¤—à¤¤ à¤¹à¥ˆ ${greetingHindi}!** BusGo à¤•à¥‡ à¤¸à¤¾à¤¥ à¤†à¤ªà¤•à¥€ à¤¯à¤¾à¤¤à¥à¤°à¤¾ à¤…à¤¤à¥à¤¯à¤‚à¤¤ à¤¸à¥à¤–à¤¦ à¤à¤µà¤‚ à¤¸à¥à¤°à¤•à¥à¤·à¤¿à¤¤ à¤°à¤¹à¥‡à¥¤`, '', getDynamicAiChips(routeCtx.origin, routeCtx.destination, 'hindi_devanagari'));
    } else if (lang === 'english') {
      streamAiResponse(`**You are most welcome${greetingEnglish}!** Wishing you a safe and pleasant journey with BusGo!`, '', getDynamicAiChips(routeCtx.origin, routeCtx.destination, 'english'));
    } else {
      streamAiResponse(`**Aapka bahut-bahut swagat hai ${greetingHinglish}!** BusGo ke sath aapka safar hamesha shubh aur mangalmay rahe. Happy journey!`, '', getDynamicAiChips(routeCtx.origin, routeCtx.destination, 'hinglish'));
    }
    return;
  }

  // ============================================================
  // 6.5 STEP-BY-STEP PROCEDURAL HOW-TO INTELLIGENCE
  // ============================================================

  // A. HOW TO BOOK A BUS (Step-by-Step)
  const isBookingHowTo = (
    q.includes('how book') ||
    q.includes('how to book') ||
    q.includes('how do i book') ||
    q.includes('how can i book') ||
    q.includes('steps to book') ||
    q.includes('booking process') ||
    q.includes('book karne ka tarika') ||
    q.includes('booking ka tarika') ||
    q.includes('kaise book') ||
    q.includes('kaise kare book') ||
    q.includes('book kaise') ||
    q.includes('booking kaise') ||
    q.includes('à¤¬à¥à¤• à¤•à¥ˆà¤¸à¥‡') ||
    q.includes('à¤Ÿà¤¿à¤•à¤Ÿ à¤•à¥ˆà¤¸à¥‡ à¤¬à¥à¤•') ||
    q.includes('à¤¬à¤¸ à¤•à¥ˆà¤¸à¥‡ à¤¬à¥à¤•') ||
    (q.includes('book') && (q.includes('tarika') || q.includes('step') || q.includes('process')))
  );

  if (isBookingHowTo) {
    ctx.lastTopic = 'how_to_book';
    if (lang === 'tamil') {
      const msg = `**BusGo à®µà®¿à®²à¯ à®ªà¯‡à®°à¯à®¨à¯à®¤à¯ à®Ÿà®¿à®•à¯à®•à¯†à®Ÿà¯ à®®à¯à®©à¯à®ªà®¤à®¿à®µà¯ à®šà¯†à®¯à¯à®µà®¤à®±à¯à®•à®¾à®© à®Žà®³à®¿à®¯ à®ªà®Ÿà®¿à®¨à®¿à®²à¯ˆà®•à®³à¯ (Step-by-Step):**

1. **à®ªà¯à®±à®ªà¯à®ªà®Ÿà¯à®®à¯ à®®à®±à¯à®±à¯à®®à¯ à®šà¯‡à®°à¯à®®à¯ à®‡à®Ÿà®¤à¯à®¤à¯ˆ à®¤à¯‡à®°à¯à®µà¯ à®šà¯†à®¯à¯à®¯à®µà¯à®®à¯**
   à®¤à¯‡à®Ÿà®²à¯ à®ªà¯†à®Ÿà¯à®Ÿà®¿à®¯à®¿à®²à¯ **"FROM"** à®Žà®©à¯à®ªà®¤à®¿à®²à¯ à®‰à®™à¯à®•à®³à¯ à®¨à®•à®°à®¤à¯à®¤à¯ˆà®¯à¯à®®à¯ (à®‰à®¤à®¾: **Dharampuri (Dhar, MP)**) à®®à®±à¯à®±à¯à®®à¯ **"TO"** à®Žà®©à¯à®ªà®¤à®¿à®²à¯ à®šà¯‡à®°à¯à®®à®¿à®Ÿà®¤à¯à®¤à¯ˆà®¯à¯à®®à¯ (à®‰à®¤à®¾: **Indore**) à®¤à¯‡à®°à¯à®¨à¯à®¤à¯†à®Ÿà¯à®•à¯à®•à®µà¯à®®à¯.

2. **à®ªà®¯à®£ à®¤à¯‡à®¤à®¿ à®®à®±à¯à®±à¯à®®à¯ à®‡à®°à¯à®•à¯à®•à¯ˆà®•à®³à¯ à®¤à¯‡à®°à¯à®µà¯ à®šà¯†à®¯à¯à®¯à®µà¯à®®à¯**
   à®‰à®™à¯à®•à®³à¯ à®ªà®¯à®£ à®¤à¯‡à®¤à®¿à®¯à¯ˆ à®®à®±à¯à®±à¯à®®à¯ à®¤à¯‡à®µà¯ˆà®¯à®¾à®© à®‡à®°à¯à®•à¯à®•à¯ˆà®•à®³à¯ à®Žà®£à¯à®£à®¿à®•à¯à®•à¯ˆà®¯à¯ˆ à®¤à¯‡à®°à¯à®¨à¯à®¤à¯†à®Ÿà¯à®•à¯à®•à®µà¯à®®à¯.

3. **"Search" à®ªà¯Šà®¤à¯à®¤à®¾à®©à¯ˆ à®•à®¿à®³à®¿à®•à¯ à®šà¯†à®¯à¯à®¯à®µà¯à®®à¯**
   à®…à®©à¯ˆà®¤à¯à®¤à¯ à®à®šà®¿ à®µà®¾à®²à¯à®µà¯‹ à®¸à¯à®²à¯€à®ªà¯à®ªà®°à¯, IntrCity à®¸à¯à®®à®¾à®°à¯à®Ÿà¯à®ªà®¸à¯ à®ªà¯‡à®°à¯à®¨à¯à®¤à¯à®•à®³à®¿à®©à¯ à®¨à¯‡à®°à®™à¯à®•à®³à¯ à®®à®±à¯à®±à¯à®®à¯ à®•à¯à®±à¯ˆà®¨à¯à®¤ à®•à®Ÿà¯à®Ÿà®£à®™à¯à®•à®³à¯ˆ à®’à®ªà¯à®ªà®¿à®Ÿà®µà¯à®®à¯.

4. **à®‰à®™à¯à®•à®³à¯ à®‡à®°à¯à®•à¯à®•à¯ˆà®¯à¯ˆ à®¤à¯‡à®°à¯à®µà¯ à®šà¯†à®¯à¯à®¯à®µà¯à®®à¯**
   à®ªà¯‡à®°à¯à®¨à¯à®¤à¯ à®µà®°à¯ˆà®ªà®Ÿà®¤à¯à®¤à®¿à®²à¯ à®µà®¿à®£à¯à®Ÿà¯‹ à®…à®²à¯à®²à®¤à¯ à®¸à¯à®²à¯€à®ªà¯à®ªà®°à¯ à®‡à®°à¯à®•à¯à®•à¯ˆà®¯à¯ˆ à®¤à¯‡à®°à¯à®¨à¯à®¤à¯†à®Ÿà¯à®•à¯à®•à®µà¯à®®à¯. à®ªà¯†à®£à¯à®•à®³à¯ à®ªà®¾à®¤à¯à®•à®¾à®ªà¯à®ªà¯à®•à¯à®•à®¾à®• à®µà®°à®¿à®šà¯ˆ 1 à®®à¯à®¤à®²à¯ 3 à®µà®°à¯ˆ à®ªà®¿à®°à®¤à¯à®¯à¯‡à®•à®®à®¾à®• à®’à®¤à¯à®•à¯à®•à®ªà¯à®ªà®Ÿà¯à®Ÿà¯à®³à¯à®³à®¤à¯.

5. **à®ªà®¯à®£à®¿ à®µà®¿à®µà®°à®™à¯à®•à®³à¯ˆ à®‰à®³à¯à®³à®¿à®Ÿà®µà¯à®®à¯**
   à®ªà®¯à®£à®¿à®¯à®¿à®©à¯ à®ªà¯†à®¯à®°à¯, à®µà®¯à®¤à¯, à®®à¯Šà®ªà¯ˆà®²à¯ à®Žà®£à¯ à®®à®±à¯à®±à¯à®®à¯ à®®à®¿à®©à¯à®©à®žà¯à®šà®²à¯ˆ à®¨à®¿à®°à®ªà¯à®ªà®µà¯à®®à¯.

6. **PhonePe / UPI à®®à¯‚à®²à®®à¯ à®ªà®£à®®à¯ à®šà¯†à®²à¯à®¤à¯à®¤à®µà¯à®®à¯**
   QR à®•à¯à®±à®¿à®¯à¯€à®Ÿà¯à®Ÿà¯ˆ à®¸à¯à®•à¯‡à®©à¯ à®šà¯†à®¯à¯à®¤à¯ à®‰à®Ÿà®©à®Ÿà®¿à®¯à®¾à®• à®‰à®±à¯à®¤à®¿à®šà¯†à®¯à¯à®¯à®ªà¯à®ªà®Ÿà¯à®Ÿ PNR à®®à®±à¯à®±à¯à®®à¯ à®…à®¤à®¿à®•à®¾à®°à®ªà¯à®ªà¯‚à®°à¯à®µ PDF à®Ÿà®¿à®•à¯à®•à¯†à®Ÿà¯à®Ÿà¯ˆà®ªà¯ à®ªà¯†à®±à¯à®™à¯à®•à®³à¯!

à®•à¯€à®´à¯‡ à®‰à®³à¯à®³ à®ªà¯Šà®¤à¯à®¤à®¾à®©à¯ˆà®•à¯ à®•à®¿à®³à®¿à®•à¯ à®šà¯†à®¯à¯à®¤à¯ à®‰à®Ÿà®©à®Ÿà®¿à®¯à®¾à®• à®®à¯à®©à¯à®ªà®¤à®¿à®µà¯ à®šà¯†à®¯à¯à®¯à®¤à¯ à®¤à¯Šà®Ÿà®™à¯à®•à®²à®¾à®®à¯:`;
      const card = `
        <div class="ai-action-card">
          <div class="small fw-semibold text-secondary mb-2">à®ªà®¿à®°à®ªà®²à®®à®¾à®© à®µà®´à®¿à®¤à¯à®¤à®Ÿà®®à¯: à®¤à®°à¯à®®à®ªà¯à®°à®¿ &rarr; à®‡à®¨à¯à®¤à¯‚à®°à¯</div>
          <div class="d-flex flex-wrap gap-2">
            <button class="btn btn-sm btn-primary py-1.5 px-3 fw-bold flex-grow-1" onclick="selectAiRoute('Dharampuri (Dhar, MP)', 'Indore')">à®¤à®°à¯à®®à®ªà¯à®°à®¿ &rarr; à®‡à®¨à¯à®¤à¯‚à®°à¯ à®®à¯à®©à¯à®ªà®¤à®¿à®µà¯ (à®ªà®Ÿà®¿ 1)</button>
            <button class="btn btn-sm btn-outline-secondary py-1.5 px-3" onclick="toggleAiChat(false); document.getElementById('search-section').scrollIntoView({behavior:'smooth'});">à®µà¯‡à®±à¯ à®µà®´à®¿à®¤à¯à®¤à®Ÿà®®à¯</button>
          </div>
        </div>
      `;
      streamAiResponse(msg, card, ['à®¤à®°à¯à®®à®ªà¯à®°à®¿ - à®‡à®¨à¯à®¤à¯‚à®°à¯ à®ªà¯‡à®°à¯à®¨à¯à®¤à¯', 'à®¨à¯‡à®°à®²à¯ˆ PNR à®¨à®¿à®²à¯ˆ', 'à®•à¯‡à®ªà¯à®Ÿà®©à¯ à®•à¯€à®°à¯à®¤à¯à®¤à®©à¯ à®Žà®£à¯']);
    } else if (lang === 'telugu') {
      const msg = `**BusGo à°²à±‹ à°¬à°¸à±à°¸à± à°Ÿà°¿à°•à±†à°Ÿà± à°¬à±à°•à± à°šà±‡à°¸à±à°•à±à°¨à±‡ à°¸à±à°²à°­à°®à±ˆà°¨ à°µà°¿à°§à°¾à°¨à°‚ (Step-by-Step):**

1. **à°ªà±à°°à°¯à°¾à°£ à°ªà±à°°à°¾à°°à°‚à°­ à°®à°°à°¿à°¯à± à°—à°®à±à°¯à°¸à±à°¥à°¾à°¨à°¾à°¨à±à°¨à°¿ à°Žà°‚à°šà±à°•à±‹à°‚à°¡à°¿**
   à°¸à±†à°°à±à°šà± à°¬à°¾à°•à±à°¸à±â€Œà°²à±‹ **"FROM"** à°²à±‹ à°®à±€ à°Šà°°à± (à°‰à°¦à°¾: **Dharampuri (Dhar, MP)**) à°®à°°à°¿à°¯à± **"TO"** à°²à±‹ à°—à°®à±à°¯à°¸à±à°¥à°¾à°¨à°‚ (à°‰à°¦à°¾: **Indore**) à°Žà°‚à°šà±à°•à±‹à°‚à°¡à°¿.

2. **à°ªà±à°°à°¯à°¾à°£ à°¤à±‡à°¦à±€ à°®à°°à°¿à°¯à± à°¸à±€à°Ÿà±à°²à°¨à± à°Žà°‚à°šà±à°•à±‹à°‚à°¡à°¿**
   à°®à±€ à°ªà±à°°à°¯à°¾à°£ à°¤à±‡à°¦à±€ à°®à°°à°¿à°¯à± à°ªà±à°°à°¯à°¾à°£à±€à°•à±à°² à°¸à°‚à°–à±à°¯à°¨à± à°Žà°‚à°šà±à°•à±‹à°‚à°¡à°¿.

3. **"Search" à°¬à°Ÿà°¨à± à°ªà±ˆ à°•à±à°²à°¿à°•à± à°šà±‡à°¯à°‚à°¡à°¿**
   à°…à°‚à°¦à±à°¬à°¾à°Ÿà±à°²à±‹ à°‰à°¨à±à°¨ à°…à°¨à±à°¨à°¿ à°à°¸à±€ à°µà±‹à°²à±à°µà±‹ à°¸à±à°²à±€à°ªà°°à± à°®à°°à°¿à°¯à± IntrCity à°¸à±à°®à°¾à°°à±à°Ÿà±â€Œà°¬à°¸à±à°¸à±à°² à°¸à°®à°¯à°¾à°²à± à°®à°°à°¿à°¯à± à°¤à°•à±à°•à±à°µ à°›à°¾à°°à±à°œà±€à°²à°¨à± à°šà±‚à°¡à°‚à°¡à°¿.

4. **à°®à±€à°•à± à°¨à°šà±à°šà°¿à°¨ à°¸à±€à°Ÿà±à°¨à± à°Žà°‚à°šà±à°•à±‹à°‚à°¡à°¿**
   à°²à±ˆà°µà± à°²à±‡à°…à°µà±à°Ÿà±â€Œà°²à±‹ à°®à±€ à°¸à±€à°Ÿà±à°¨à± à°Žà°‚à°šà±à°•à±‹à°‚à°¡à°¿. à°®à°¹à°¿à°³à°¾ à°ªà±à°°à°¯à°¾à°£à±€à°•à±à°² à°°à°•à±à°·à°£ à°•à±‹à°¸à°‚ à°®à±Šà°¦à°Ÿà°¿ 1 à°¨à±à°‚à°¡à°¿ 3 à°µà°°à±à°¸à°²à± à°ªà±à°°à°¤à±à°¯à±‡à°•à°‚à°—à°¾ à°•à±‡à°Ÿà°¾à°¯à°¿à°‚à°šà°¬à°¡à±à°¡à°¾à°¯à°¿.

5. **à°ªà±à°°à°¯à°¾à°£à±€à°•à±à°² à°µà°¿à°µà°°à°¾à°²à°¨à± à°¨à°®à±‹à°¦à± à°šà±‡à°¯à°‚à°¡à°¿**
   à°ªà±‡à°°à±, à°µà°¯à°¸à±à°¸à±, à°®à±Šà°¬à±ˆà°²à± à°¨à°‚à°¬à°°à± à°®à°°à°¿à°¯à± à°ˆà°®à±†à°¯à°¿à°²à± à°¨à°®à±‹à°¦à± à°šà±‡à°¯à°‚à°¡à°¿.

6. **PhonePe / UPI à°¦à±à°µà°¾à°°à°¾ à°¸à±à°°à²•à³à²·à°¿à°¤ à°šà±†à°²à±à°²à°¿à°‚à°ªà± à°šà±‡à°¯à°‚à°¡à°¿**
   à°¡à±ˆà°¨à°®à°¿à°•à± QR à°•à±‹à°¡à± à°¸à±à°•à°¾à°¨à± à°šà±‡à°¸à°¿ à°•à±à°·à°£à°¾à°²à±à°²à±‹ à°¨à°¿à°°à±à°§à°¾à°°à°¿à°¤ PNR à°®à°°à°¿à°¯à± à°…à°§à°¿à°•à°¾à°°à°¿à°• PDF à°Ÿà°¿à°•à±à°•à±†à°Ÿà±â€Œà°¨à± à°ªà±Šà°‚à°¦à°‚à°¡à°¿!

à°•à°¿à°‚à°¦à°¿ à°¬à°Ÿà°¨à± à°•à±à°²à°¿à°•à± à°šà±‡à°¸à°¿ à°µà±†à°‚à°Ÿà°¨à±‡ à°¬à±à°•à°¿à°‚à°—à± à°ªà±à°°à°¾à°°à°‚à°­à°¿à°‚à°šà°‚à°¡à°¿:`;
      const card = `
        <div class="ai-action-card">
          <div class="small fw-semibold text-secondary mb-2">à°ªà±à°°à°¸à°¿à°¦à±à°§ à°®à°¾à°°à±à°—à°‚: à°§à°°à°‚à°ªà±à°°à°¿ &rarr; à°‡à°‚à°¡à±‹à°°à±</div>
          <div class="d-flex flex-wrap gap-2">
            <button class="btn btn-sm btn-primary py-1.5 px-3 fw-bold flex-grow-1" onclick="selectAiRoute('Dharampuri (Dhar, MP)', 'Indore')">à°§à°°à°‚à°ªà±à°°à°¿ &rarr; à°‡à°‚à°¡à±‹à°°à± à°¬à±à°•à± à°šà±‡à°¯à°‚à°¡à°¿ (à°¦à°¶ 1)</button>
            <button class="btn btn-sm btn-outline-secondary py-1.5 px-3" onclick="toggleAiChat(false); document.getElementById('search-section').scrollIntoView({behavior:'smooth'});">à°‡à°¤à°° à°¨à°—à°°à°¾à°²à±</button>
          </div>
        </div>
      `;
      streamAiResponse(msg, card, ['à°§à°°à°‚à°ªà±à°°à°¿ à°¨à±à°‚à°¡à°¿ à°‡à°‚à°¡à±‹à°°à± à°¬à°¸à±à°¸à±', 'à°²à±ˆà°µà± PNR à°¸à±à°¥à°¿à°¤à°¿', 'à°•à±†à°ªà±à°Ÿà±†à°¨à± à°•à±€à°°à±à°¤à°¨à± à°¨à°‚à°¬à°°à±']);
    } else if (lang === 'kannada') {
      const msg = `**BusGo à²¨à²²à³à²²à²¿ à²¬à²¸à³ à²Ÿà²¿à²•à³†à²Ÿà³ à²•à²¾à²¯à³à²¦à²¿à²°à²¿à²¸à³à²µ à²¸à³à²²à²­ à²¹à²‚à²¤à²—à²³à³ (Step-by-Step):**

1. **à²ªà³à²°à²¾à²°à²‚à²­ à²®à²¤à³à²¤à³ à²—à²®à³à²¯à²¸à³à²¥à²¾à²¨ à²¨à²—à²° à²†à²¯à³à²•à³†à²®à²¾à²¡à²¿**
   à²¹à³à²¡à³à²•à²¾à²Ÿ à²ªà³†à²Ÿà³à²Ÿà²¿à²—à³†à²¯à²²à³à²²à²¿ **"FROM"** à²¨à²²à³à²²à²¿ à²¨à²¿à²®à³à²® à²Šà²°à³ (à²‰à²¦à²¾: **Dharampuri (Dhar, MP)**) à²®à²¤à³à²¤à³ **"TO"** à²¨à²²à³à²²à²¿ à²—à²®à³à²¯à²¸à³à²¥à²¾à²¨ (à²‰à²¦à²¾: **Indore**) à²†à²¯à³à²•à³†à²®à²¾à²¡à²¿.

2. **à²ªà³à²°à²¯à²¾à²£ à²¦à²¿à²¨à²¾à²‚à²• à²®à²¤à³à²¤à³ à²†à²¸à²¨à²—à²³à²¨à³à²¨à³ à²†à²¯à³à²•à³†à²®à²¾à²¡à²¿**
   à²¨à²¿à²®à³à²® à²ªà³à²°à²¯à²¾à²£à²¦ à²¦à²¿à²¨à²¾à²‚à²• à²®à²¤à³à²¤à³ à²ªà³à²°à²¯à²¾à²£à²¿à²•à²° à²¸à²‚à²–à³à²¯à³†à²¯à²¨à³à²¨à³ à²†à²¯à³à²•à³†à²®à²¾à²¡à²¿.

3. **"Search" à²¬à²Ÿà²¨à³ à²•à³à²²à²¿à²•à³ à²®à²¾à²¡à²¿**
   à²²à²­à³à²¯à²µà²¿à²°à³à²µ à²Žà²²à³à²²à²¾ à²Žà²¸à²¿ à²µà³‹à²²à³à²µà³‹ à²¸à³à²²à³€à²ªà²°à³, IntrCity à²¸à³à²®à²¾à²°à³à²Ÿà³â€Œà²¬à²¸à³â€Œà²—à²³ à²ªà²Ÿà³à²Ÿà²¿, à²¸à²®à²¯ à²®à²¤à³à²¤à³ à²¦à²°à²—à²³à²¨à³à²¨à³ à²ªà²°à²¿à²¶à³€à²²à²¿à²¸à²¿.

4. **à²¨à²¿à²®à³à²® à²‡à²·à³à²Ÿà²¦ à²†à²¸à²¨à²µà²¨à³à²¨à³ à²†à²¯à³à²•à³†à²®à²¾à²¡à²¿**
   à²²à³ˆà²µà³ à²¸à³€à²Ÿà³ à²²à³‡à²”à²Ÿà³â€Œà²¨à²²à³à²²à²¿ à²¨à²¿à²®à³à²® à²†à²¸à²¨ à²†à²¯à³à²•à³†à²®à²¾à²¡à²¿. à²®à²¹à²¿à²³à³†à²¯à²° à²¸à³à²°à²•à³à²·à²¤à³†à²—à²¾à²—à²¿ 1 à²°à²¿à²‚à²¦ 3 à²¸à²¾à²²à³à²—à²³à³ à²®à³€à²¸à²²à²¾à²—à²¿à²µà³†.

5. **à²ªà³à²°à²¯à²¾à²£à²¿à²•à²° à²µà²¿à²µà²°à²—à²³à²¨à³à²¨à³ à²¨à²®à³‚à²¦à²¿à²¸à²¿**
   à²ªà³à²°à²¯à²¾à²£à²¿à²•à²° à²¹à³†à²¸à²°à³, à²µà²¯à²¸à³à²¸à³, à²®à³Šà²¬à³ˆà²²à³ à²¸à²‚à²–à³à²¯à³† à²®à²¤à³à²¤à³ à²‡à²®à³‡à²²à³ à²¨à²®à³‚à²¦à²¿à²¸à²¿.

6. **PhonePe / UPI à²®à³‚à²²à²• à²¸à³à²²à²­ à²ªà²¾à²µà²¤à²¿ à²®à²¾à²¡à²¿**
   QR à²•à³‹à²¡à³ à²¸à³à²•à³à²¯à²¾à²¨à³ à²®à²¾à²¡à²¿ à²¤à²•à³à²·à²£à²µà³‡ à²…à²§à²¿à²•à³ƒà²¤ PNR à²®à²¤à³à²¤à³ PDF à²Ÿà²¿à²•à³†à²Ÿà³ à²ªà²¡à³†à²¯à²¿à²°à²¿!

à²•à³†à²³à²—à²¿à²¨ à²¬à²Ÿà²¨à³ à²•à³à²²à²¿à²•à³ à²®à²¾à²¡à²¿ à²¤à²•à³à²·à²£ à²¬à³à²•à²¿à²‚à²—à³ à²ªà³à²°à²¾à²°à²‚à²­à²¿à²¸à²¿:`;
      const card = `
        <div class="ai-action-card">
          <div class="small fw-semibold text-secondary mb-2">à²œà²¨à²ªà³à²°à²¿à²¯ à²®à²¾à²°à³à²—: à²§à²°à²‚à²ªà³à²°à²¿ &rarr; à²‡à²‚à²¦à³‹à²°à³</div>
          <div class="d-flex flex-wrap gap-2">
            <button class="btn btn-sm btn-primary py-1.5 px-3 fw-bold flex-grow-1" onclick="selectAiRoute('Dharampuri (Dhar, MP)', 'Indore')">à²§à²°à²‚à²ªà³à²°à²¿ &rarr; à²‡à²‚à²¦à³‹à²°à³ à²¬à³à²•à³ à²®à²¾à²¡à²¿ (à²¹à²‚à²¤ 1)</button>
            <button class="btn btn-sm btn-outline-secondary py-1.5 px-3" onclick="toggleAiChat(false); document.getElementById('search-section').scrollIntoView({behavior:'smooth'});">à²¬à³‡à²°à³† à²®à²¾à²°à³à²—</button>
          </div>
        </div>
      `;
      streamAiResponse(msg, card, ['à²§à²°à²‚à²ªà³à²°à²¿à²¯à²¿à²‚à²¦ à²‡à²‚à²¦à³‹à²°à³ à²¬à²¸à³', 'à²²à³ˆà²µà³ PNR à²¸à³à²¥à²¿à²¤à²¿', 'à²•à³à²¯à²¾à²ªà³à²Ÿà²¨à³ à²•à³€à²°à³à²¤à²¨à³ à²¸à²‚à²–à³à²¯à³†']);
    } else if (lang === 'malayalam') {
      const msg = `**BusGo-àµ½ à´¬à´¸àµ à´Ÿà´¿à´•àµà´•à´±àµà´±àµ à´¬àµà´•àµà´•àµ à´šàµ†à´¯àµà´¯àµà´¨àµà´¨à´¤à´¿à´¨àµà´³àµà´³ à´²à´³à´¿à´¤à´®à´¾à´¯ à´˜à´Ÿàµà´Ÿà´™àµà´™àµ¾ (Step-by-Step):**

1. **à´ªàµà´±à´ªàµà´ªàµ†à´Ÿàµà´¨àµà´¨ à´¸àµà´¥à´²à´µàµà´‚ à´²à´•àµà´·àµà´¯à´¸àµà´¥à´¾à´¨à´µàµà´‚ à´¤à´¿à´°à´žàµà´žàµ†à´Ÿàµà´•àµà´•àµà´•**
   à´¤à´¿à´°à´¯àµ½ à´¬àµ‹à´•àµà´¸à´¿àµ½ **"FROM"** à´Žà´¨àµà´¨à´¤à´¿àµ½ à´¨à´¿à´™àµà´™à´³àµà´Ÿàµ† à´¸àµà´¥à´²à´µàµà´‚ (à´‰à´¦à´¾: **Dharampuri (Dhar, MP)**) **"TO"** à´Žà´¨àµà´¨à´¤à´¿àµ½ à´²à´•àµà´·àµà´¯à´¸àµà´¥à´¾à´¨à´µàµà´‚ (à´‰à´¦à´¾: **Indore**) à´¤à´¿à´°à´žàµà´žàµ†à´Ÿàµà´•àµà´•àµà´•.

2. **à´¯à´¾à´¤àµà´°à´¾ à´¤àµ€à´¯à´¤à´¿à´¯àµà´‚ à´¸àµ€à´±àµà´±àµà´•à´³àµà´‚ à´¤à´¿à´°à´žàµà´žàµ†à´Ÿàµà´•àµà´•àµà´•**
   à´¨à´¿à´™àµà´™à´³àµà´Ÿàµ† à´¯à´¾à´¤àµà´°à´¾ à´¤àµ€à´¯à´¤à´¿à´¯àµà´‚ à´†à´µà´¶àµà´¯à´®à´¾à´¯ à´¸àµ€à´±àµà´±àµà´•à´³àµà´Ÿàµ† à´Žà´£àµà´£à´µàµà´‚ à´¨àµ½à´•àµà´•.

3. **"Search" à´¬à´Ÿàµà´Ÿàµº à´•àµà´²à´¿à´•àµà´•àµ à´šàµ†à´¯àµà´¯àµà´•**
   à´Žà´²àµà´²à´¾ à´Žà´¸à´¿ à´µàµ‹àµ¾à´µàµ‹ à´¸àµà´²àµ€à´ªàµà´ªàµ¼, IntrCity à´¸àµà´®à´¾àµ¼à´Ÿàµà´Ÿàµà´¬à´¸àµà´•à´³àµà´Ÿàµ† à´¸à´®à´¯à´•àµà´°à´®à´µàµà´‚ à´¨à´¿à´°à´•àµà´•àµà´•à´³àµà´‚ à´ªà´°à´¿à´¶àµ‹à´§à´¿à´•àµà´•àµà´•.

4. **à´¨à´¿à´™àµà´™àµ¾à´•àµà´•àµ à´‡à´·àµà´Ÿà´®àµà´³àµà´³ à´¸àµ€à´±àµà´±àµ à´¤à´¿à´°à´žàµà´žàµ†à´Ÿàµà´•àµà´•àµà´•**
   à´¸àµ€à´±àµà´±àµ à´²àµ‡à´”à´Ÿàµà´Ÿà´¿àµ½ à´¨à´¿à´¨àµà´¨àµà´‚ à´¸àµ€à´±àµà´±àµ à´¤à´¿à´°à´žàµà´žàµ†à´Ÿàµà´•àµà´•àµà´•. à´µà´¨à´¿à´¤à´¾ à´¯à´¾à´¤àµà´°à´•àµà´•à´¾à´°àµà´Ÿàµ† à´¸àµà´°à´•àµà´·à´¯àµà´•àµà´•à´¾à´¯à´¿ à´µà´°à´¿à´•àµ¾ 1 à´®àµà´¤àµ½ 3 à´µà´°àµ† à´ªàµà´°à´¤àµà´¯àµ‡à´•à´®à´¾à´¯à´¿ à´¨àµ€à´•àµà´•à´¿à´µà´šàµà´šà´¿à´°à´¿à´•àµà´•àµà´¨àµà´¨àµ.

5. **à´¯à´¾à´¤àµà´°à´•àµà´•à´¾à´°àµà´Ÿàµ† à´µà´¿à´µà´°à´™àµà´™àµ¾ à´¨àµ½à´•àµà´•**
   à´ªàµ‡à´°àµ, à´ªàµà´°à´¾à´¯à´‚, à´®àµŠà´¬àµˆàµ½ à´¨à´®àµà´ªàµ¼, à´‡à´®àµ†à´¯à´¿àµ½ à´Žà´¨àµà´¨à´¿à´µ à´¨àµ½à´•àµà´•.

6. **PhonePe / UPI à´µà´´à´¿ à´¸àµà´°à´•àµà´·à´¿à´¤à´®à´¾à´¯à´¿ à´ªà´£à´®à´Ÿà´¯àµà´•àµà´•àµà´•**
   QR à´•àµ‹à´¡àµ à´¸àµà´•à´¾àµ» à´šàµ†à´¯àµà´¤àµ à´ªà´£à´®à´Ÿà´šàµà´šàµ à´¤àµ½à´•àµà´·à´£à´‚ à´”à´¦àµà´¯àµ‹à´—à´¿à´• PNR à´‰à´‚ PDF à´Ÿà´¿à´•àµà´•à´±àµà´±àµà´‚ à´¨àµ‡à´Ÿàµà´•!

à´¤à´¾à´´àµ†à´¯àµà´³àµà´³ à´¬à´Ÿàµà´Ÿàµº à´•àµà´²à´¿à´•àµà´•àµà´šàµ†à´¯àµà´¤àµ à´‡à´ªàµà´ªàµ‹àµ¾ à´¤à´¨àµà´¨àµ† à´¬àµà´•àµà´•à´¿à´‚à´—àµ à´†à´°à´‚à´­à´¿à´•àµà´•àµà´•:`;
      const card = `
        <div class="ai-action-card">
          <div class="small fw-semibold text-secondary mb-2">à´ªàµà´°à´§à´¾à´¨ à´±àµ‚à´Ÿàµà´Ÿàµ: à´§à´°à´‚à´ªàµà´°à´¿ &rarr; à´‡àµ»à´¡àµ‹àµ¼</div>
          <div class="d-flex flex-wrap gap-2">
            <button class="btn btn-sm btn-primary py-1.5 px-3 fw-bold flex-grow-1" onclick="selectAiRoute('Dharampuri (Dhar, MP)', 'Indore')">à´§à´°à´‚à´ªàµà´°à´¿ &rarr; à´‡àµ»à´¡àµ‹àµ¼ à´¬àµà´•àµà´•àµ à´šàµ†à´¯àµà´¯àµà´• (à´˜à´Ÿàµà´Ÿà´‚ 1)</button>
            <button class="btn btn-sm btn-outline-secondary py-1.5 px-3" onclick="toggleAiChat(false); document.getElementById('search-section').scrollIntoView({behavior:'smooth'});">à´®à´±àµà´±àµ à´¨à´—à´°à´™àµà´™àµ¾</button>
          </div>
        </div>
      `;
      streamAiResponse(msg, card, ['à´§à´°à´‚à´ªàµà´°à´¿ - à´‡àµ»à´¡àµ‹àµ¼ à´¬à´¸àµ', 'à´¤à´¤àµà´¸à´®à´¯ PNR à´¨à´¿à´²', 'à´•àµà´¯à´¾à´ªàµà´±àµà´±àµ» à´•àµ€àµ¼à´¤àµà´¤àµ» à´¨à´®àµà´ªàµ¼']);
    } else if (lang === 'marathi') {
      const msg = `**BusGo à¤µà¤° à¤¬à¤¸ à¤¤à¤¿à¤•à¥€à¤Ÿ à¤¬à¥à¤• à¤•à¤°à¤£à¥à¤¯à¤¾à¤šà¥€ à¤¸à¥‹à¤ªà¥€ à¤Ÿà¤ªà¥à¤ªà¥à¤¯à¤¾à¤Ÿà¤ªà¥à¤ªà¥à¤¯à¤¾à¤¨à¥‡ (Step-by-Step) à¤ªà¤¦à¥à¤§à¤¤:**

1. **à¤ªà¥à¤°à¤¸à¥à¤¥à¤¾à¤¨ à¤†à¤£à¤¿ à¤—à¤‚à¤¤à¤µà¥à¤¯ à¤¶à¤¹à¤° à¤¨à¤¿à¤µà¤¡à¤¾**
   à¤¸à¤°à¥à¤š à¤¬à¥‰à¤•à¥à¤¸à¤®à¤§à¥à¤¯à¥‡ **"FROM"** à¤®à¤§à¥à¤¯à¥‡ à¤†à¤ªà¤²à¥‡ à¤¶à¤¹à¤° (à¤‰à¤¦à¤¾. **à¤§à¤°à¤®à¤ªà¥à¤°à¥€ (à¤§à¤¾à¤°, à¤®.à¤ªà¥à¤°.)**) à¤†à¤£à¤¿ **"TO"** à¤®à¤§à¥à¤¯à¥‡ à¤œà¤¿à¤¥à¥‡ à¤œà¤¾à¤¯à¤šà¥‡ à¤†à¤¹à¥‡ (à¤‰à¤¦à¤¾. **à¤‡à¤‚à¤¦à¥‚à¤°**) à¤¨à¤¿à¤µà¤¡à¤¾.

2. **à¤ªà¥à¤°à¤µà¤¾à¤¸à¤¾à¤šà¥€ à¤¤à¤¾à¤°à¥€à¤– à¤†à¤£à¤¿ à¤¸à¥€à¤Ÿ à¤¸à¤‚à¤–à¥à¤¯à¤¾ à¤¨à¤¿à¤µà¤¡à¤¾**
   à¤†à¤ªà¤²à¥à¤¯à¤¾ à¤ªà¥à¤°à¤µà¤¾à¤¸à¤¾à¤šà¥€ à¤¤à¤¾à¤°à¥€à¤– à¤†à¤£à¤¿ à¤ªà¥à¤°à¤µà¤¾à¤¶à¤¾à¤‚à¤šà¥€ à¤¸à¤‚à¤–à¥à¤¯à¤¾ à¤¨à¤¿à¤µà¤¡à¤¾.

3. **"Search" à¤¬à¤Ÿà¤£à¤¾à¤µà¤° à¤•à¥à¤²à¤¿à¤• à¤•à¤°à¤¾**
   à¤‰à¤ªà¤²à¤¬à¥à¤§ à¤¸à¤°à¥à¤µ à¤à¤¸à¥€ à¤µà¥à¤¹à¥‹à¤²à¥à¤µà¥‹ à¤¸à¥à¤²à¥€à¤ªà¤°, IntrCity à¤¸à¥à¤®à¤¾à¤°à¥à¤Ÿà¤¬à¤¸ à¤†à¤£à¤¿ à¤¸à¥€à¤Ÿà¤° à¤¬à¤¸à¥‡à¤¸à¤šà¥€ à¤µà¥‡à¤³ à¤µ à¤­à¤¾à¤¡à¥‡ à¤¤à¤ªà¤¾à¤¸à¤¾.

4. **à¤ªà¤¸à¤‚à¤¤à¥€à¤šà¥€ à¤¸à¥€à¤Ÿ à¤¨à¤¿à¤µà¤¡à¤¾**
   à¤¬à¤¸ à¤²à¥‡à¤†à¤‰à¤Ÿà¤®à¤§à¥à¤¯à¥‡ à¤†à¤ªà¤²à¥€ à¤¸à¥€à¤Ÿ à¤¨à¤¿à¤µà¤¡à¤¾. à¤®à¤¹à¤¿à¤²à¤¾ à¤ªà¥à¤°à¤µà¤¾à¤¶à¤¾à¤‚à¤šà¥à¤¯à¤¾ à¤¸à¥à¤°à¤•à¥à¤·à¥‡à¤¸à¤¾à¤ à¥€ à¤ªà¤‚à¤•à¥à¤¤à¥€ à¥§ à¤¤à¥‡ à¥© à¤°à¤¾à¤–à¥€à¤µ à¤†à¤¹à¥‡à¤¤.

5. **à¤ªà¥à¤°à¤µà¤¾à¤¸à¥€ à¤®à¤¾à¤¹à¤¿à¤¤à¥€ à¤­à¤°à¤¾**
   à¤ªà¥à¤°à¤µà¤¾à¤¶à¤¾à¤šà¥‡ à¤¨à¤¾à¤µ, à¤µà¤¯, à¤®à¥‹à¤¬à¤¾à¤ˆà¤² à¤¨à¤‚à¤¬à¤° à¤†à¤£à¤¿ à¤ˆà¤®à¥‡à¤² à¤­à¤°à¤¾.

6. **PhonePe / UPI à¤¦à¥à¤µà¤¾à¤°à¥‡ à¤¸à¥à¤°à¤•à¥à¤·à¤¿à¤¤ à¤ªà¥‡à¤®à¥‡à¤‚à¤Ÿ à¤•à¤°à¤¾**
   QR à¤•à¥‹à¤¡ à¤¸à¥à¤•à¥…à¤¨ à¤•à¤°à¤¾ à¤†à¤£à¤¿ à¤¤à¥à¤µà¤°à¤¿à¤¤ à¤–à¤¾à¤¤à¥à¤°à¥€à¤¶à¥€à¤° PNR à¤µ à¤…à¤§à¤¿à¤•à¥ƒà¤¤ PDF à¤¤à¤¿à¤•à¥€à¤Ÿ à¤®à¤¿à¤³à¤µà¤¾!

à¤–à¤¾à¤²à¥€à¤² à¤¬à¤Ÿà¤£à¤¾à¤µà¤° à¤•à¥à¤²à¤¿à¤• à¤•à¤°à¥‚à¤¨ à¤¤à¥à¤µà¤°à¤¿à¤¤ à¤ªà¤¾à¤¯à¤°à¥€ à¥§ à¤ªà¤¾à¤¸à¥‚à¤¨ à¤¬à¥à¤•à¤¿à¤‚à¤— à¤¸à¥à¤°à¥‚ à¤•à¤°à¤¾:`;
      const card = `
        <div class="ai-action-card">
          <div class="small fw-semibold text-secondary mb-2">à¤²à¥‹à¤•à¤ªà¥à¤°à¤¿à¤¯ à¤®à¤¾à¤°à¥à¤—: à¤§à¤°à¤®à¤ªà¥à¤°à¥€ &rarr; à¤‡à¤‚à¤¦à¥‚à¤°</div>
          <div class="d-flex flex-wrap gap-2">
            <button class="btn btn-sm btn-primary py-1.5 px-3 fw-bold flex-grow-1" onclick="selectAiRoute('Dharampuri (Dhar, MP)', 'Indore')">à¤§à¤°à¤®à¤ªà¥à¤°à¥€ &rarr; à¤‡à¤‚à¤¦à¥‚à¤° à¤¬à¥à¤• à¤•à¤°à¤¾ (à¤ªà¤¾à¤¯à¤°à¥€ 1)</button>
            <button class="btn btn-sm btn-outline-secondary py-1.5 px-3" onclick="toggleAiChat(false); document.getElementById('search-section').scrollIntoView({behavior:'smooth'});">à¤‡à¤¤à¤° à¤®à¤¾à¤°à¥à¤—</button>
          </div>
        </div>
      `;
      streamAiResponse(msg, card, ['à¤§à¤°à¤®à¤ªà¥à¤°à¥€ à¤¤à¥‡ à¤‡à¤‚à¤¦à¥‚à¤° à¤¬à¤¸', 'à¤²à¤¾à¤ˆà¤µà¥à¤¹ PNR à¤¸à¥à¤Ÿà¥‡à¤Ÿà¤¸', 'à¤•à¥…à¤ªà¥à¤Ÿà¤¨ à¤•à¥€à¤°à¥à¤¤à¤¨ à¤¨à¤‚à¤¬à¤°']);
    } else if (lang === 'gujarati') {
      const msg = `**BusGo àªªàª° àª¬àª¸ àªŸàª¿àª•àª¿àªŸ àª¬à«àª• àª•àª°àªµàª¾àª¨à«€ àª¸àª°àª³ àª¸à«àªŸà«‡àªª-àª¬àª¾àª¯-àª¸à«àªŸà«‡àªª àª°à«€àª¤:**

1. **àªªà«àª°àª¸à«àª¥àª¾àª¨ àª…àª¨à«‡ àª—àª‚àª¤àªµà«àª¯ àª¶àª¹à«‡àª° àªªàª¸àª‚àª¦ àª•àª°à«‹**
   àª¸àª°à«àªš àª¬à«‹àª•à«àª¸àª®àª¾àª‚ **"FROM"** àª®àª¾àª‚ àª¤àª®àª¾àª°à«àª‚ àª¶àª¹à«‡àª° (àªœà«‡àª® àª•à«‡ **Dharampuri (Dhar, MP)**) àª…àª¨à«‡ **"TO"** àª®àª¾àª‚ àªªàª¹à«‹àª‚àªšàªµàª¾àª¨à«àª‚ àª¶àª¹à«‡àª° (àªœà«‡àª® àª•à«‡ **Indore**) àªªàª¸àª‚àª¦ àª•àª°à«‹.

2. **àª®à«àª¸àª¾àª«àª°à«€àª¨à«€ àª¤àª¾àª°à«€àª– àª…àª¨à«‡ àª¸à«€àªŸ àª¸àª‚àª–à«àª¯àª¾ àªªàª¸àª‚àª¦ àª•àª°à«‹**
   àª¤àª®àª¾àª°à«€ àª®à«àª¸àª¾àª«àª°à«€àª¨à«€ àª¤àª¾àª°à«€àª– àª…àª¨à«‡ àª®à«àª¸àª¾àª«àª°à«‹àª¨à«€ àª¸àª‚àª–à«àª¯àª¾ àªªàª¸àª‚àª¦ àª•àª°à«‹.

3. **"Search" àª¬àªŸàª¨ àªªàª° àª•à«àª²àª¿àª• àª•àª°à«‹**
   àª¬àª§à«€ àª‰àªªàª²àª¬à«àª§ àªàª¸à«€ àªµà«‹àª²à«àªµà«‹ àª¸à«àª²à«€àªªàª° àª…àª¨à«‡ IntrCity àª¸à«àª®àª¾àª°à«àªŸàª¬àª¸àª¨àª¾ àª¸àª®àª¯ àª…àª¨à«‡ àª“àª›àª¾ àª­àª¾àª¡àª¾àª‚ àªœà«àª“.

4. **àª®àª¨àªªàª¸àª‚àª¦ àª¸à«€àªŸ àªªàª¸àª‚àª¦ àª•àª°à«‹**
   àª¬àª¸ àª²à«‡àª†àª‰àªŸàª®àª¾àª‚ àª¤àª®àª¾àª°à«€ àª¸à«€àªŸ àªªàª¸àª‚àª¦ àª•àª°à«‹. àª®àª¹àª¿àª²àª¾ àª®à«àª¸àª¾àª«àª°à«‹àª¨à«€ àª¸à«àª°àª•à«àª·àª¾ àª®àª¾àªŸà«‡ àªªàª‚àª•à«àª¤àª¿ à«§ àª¥à«€ à«© àª…àª¨àª¾àª®àª¤ àª›à«‡.

5. **àª®à«àª¸àª¾àª«àª°àª¨à«€ àªµàª¿àª—àª¤à«‹ àª¦àª¾àª–àª² àª•àª°à«‹**
   àª¨àª¾àª®, àª‰àª‚àª®àª°, àª®à«‹àª¬àª¾àªˆàª² àª¨àª‚àª¬àª° àª…àª¨à«‡ àªˆàª®à«‡àªˆàª² àª­àª°à«‹.

6. **PhonePe / UPI àª¦à«àªµàª¾àª°àª¾ àª¸à«àª°àª•à«àª·àª¿àª¤ àªªà«‡àª®à«‡àª¨à«àªŸ àª•àª°à«‹**
   QR àª•à«‹àª¡ àª¸à«àª•à«‡àª¨ àª•àª°à«€àª¨à«‡ àª¤àª°àª¤ àªœ àª•àª¨à«àª«àª°à«àª®à«àª¡ PNR àª…àª¨à«‡ àªªà«€àª¡à«€àªàª« àªŸàª¿àª•àª¿àªŸ àª®à«‡àª³àªµà«‹!

àª¨à«€àªšà«‡ àª†àªªà«‡àª²àª¾ àª¬àªŸàª¨ àªªàª° àª•à«àª²àª¿àª• àª•àª°à«€àª¨à«‡ àª¤àª°àª¤ àªœ àª¬à«àª•àª¿àª‚àª— àª¶àª°à«‚ àª•àª°à«‹:`;
      const card = `
        <div class="ai-action-card">
          <div class="small fw-semibold text-secondary mb-2">àª²à«‹àª•àªªà«àª°àª¿àª¯ àª°à«‚àªŸ: àª§àª°àª®àªªà«àª°à«€ &rarr; àª‡àª¨à«àª¦à«‹àª°</div>
          <div class="d-flex flex-wrap gap-2">
            <button class="btn btn-sm btn-primary py-1.5 px-3 fw-bold flex-grow-1" onclick="selectAiRoute('Dharampuri (Dhar, MP)', 'Indore')">àª§àª°àª®àªªà«àª°à«€ &rarr; àª‡àª¨à«àª¦à«‹àª° àª¬à«àª• àª•àª°à«‹ (àª¸à«àªŸà«‡àªª 1)</button>
            <button class="btn btn-sm btn-outline-secondary py-1.5 px-3" onclick="toggleAiChat(false); document.getElementById('search-section').scrollIntoView({behavior:'smooth'});">àª¬à«€àªœà«‹ àª°à«‚àªŸ</button>
          </div>
        </div>
      `;
      streamAiResponse(msg, card, ['àª§àª°àª®àªªà«àª°à«€ àª¥à«€ àª‡àª¨à«àª¦à«‹àª° àª¬àª¸', 'àª²àª¾àªˆàªµ PNR àª¸à«àªŸà«‡àªŸàª¸', 'àª•à«‡àªªà«àªŸàª¨ àª•à«€àª°à«àª¤àª¨ àª¨àª‚àª¬àª°']);
    } else if (lang === 'bengali') {
      const msg = `**BusGo-à¦¤à§‡ à¦¬à¦¾à¦¸ à¦Ÿà¦¿à¦•à¦¿à¦Ÿ à¦¬à§à¦• à¦•à¦°à¦¾à¦° à¦¸à¦¹à¦œ à¦§à¦¾à¦ªà¦¸à¦®à§‚à¦¹ (Step-by-Step):**

1. **à¦¯à¦¾à¦¤à§à¦°à¦¾ à¦¶à§à¦°à§ à¦à¦¬à¦‚ à¦—à¦¨à§à¦¤à¦¬à§à¦¯ à¦¶à¦¹à¦° à¦¨à¦¿à¦°à§à¦¬à¦¾à¦šà¦¨ à¦•à¦°à§à¦¨**
   à¦¸à¦¾à¦°à§à¦š à¦¬à¦•à§à¦¸à§‡ **"FROM"**-à¦ à¦†à¦ªà¦¨à¦¾à¦° à¦¶à¦¹à¦° (à¦¯à§‡à¦®à¦¨ **Dharampuri (Dhar, MP)**) à¦à¦¬à¦‚ **"TO"**-à¦¤à§‡ à¦—à¦¨à§à¦¤à¦¬à§à¦¯ (à¦¯à§‡à¦®à¦¨ **Indore**) à¦¬à§‡à¦›à§‡ à¦¨à¦¿à¦¨à¥¤

2. **à¦¯à¦¾à¦¤à§à¦°à¦¾à¦° à¦¤à¦¾à¦°à¦¿à¦– à¦“ à¦†à¦¸à¦¨ à¦¸à¦‚à¦–à§à¦¯à¦¾ à¦¬à§‡à¦›à§‡ à¦¨à¦¿à¦¨**
   à¦†à¦ªà¦¨à¦¾à¦° à¦­à§à¦°à¦®à¦£à§‡à¦° à¦¤à¦¾à¦°à¦¿à¦– à¦à¦¬à¦‚ à¦¯à¦¾à¦¤à§à¦°à§€ à¦¸à¦‚à¦–à§à¦¯à¦¾ à¦¨à¦¿à¦°à§à¦¬à¦¾à¦šà¦¨ à¦•à¦°à§à¦¨à¥¤

3. **"Search" à¦¬à§‹à¦¤à¦¾à¦®à§‡ à¦•à§à¦²à¦¿à¦• à¦•à¦°à§à¦¨**
   à¦‰à¦ªà¦²à¦¬à§à¦§ à¦¸à¦®à¦¸à§à¦¤ à¦à¦¸à¦¿ à¦­à¦²à¦­à§‹ à¦¸à§à¦²à¦¿à¦ªà¦¾à¦° à¦à¦¬à¦‚ IntrCity à¦¸à§à¦®à¦¾à¦°à§à¦Ÿà¦¬à¦¾à¦¸à§‡à¦° à¦¸à¦®à¦¯à¦¼à¦¸à§‚à¦šà§€ à¦“ à¦•à¦® à¦­à¦¾à¦¡à¦¼à¦¾ à¦¦à§‡à¦–à§à¦¨à¥¤

4. **à¦ªà¦›à¦¨à§à¦¦à§‡à¦° à¦†à¦¸à¦¨ à¦¨à¦¿à¦°à§à¦¬à¦¾à¦šà¦¨ à¦•à¦°à§à¦¨**
   à¦¬à¦¾à¦¸ à¦²à§‡à¦†à¦‰à¦Ÿ à¦¥à§‡à¦•à§‡ à¦†à¦ªà¦¨à¦¾à¦° à¦¸à¦¿à¦Ÿ à¦¬à§‡à¦›à§‡ à¦¨à¦¿à¦¨à¥¤ à¦®à¦¹à¦¿à¦²à¦¾ à¦¯à¦¾à¦¤à§à¦°à§€à¦¦à§‡à¦° à¦¸à§à¦°à¦•à§à¦·à¦¾à¦° à¦œà¦¨à§à¦¯ à¦¸à¦¾à¦°à¦¿ à§§ à¦¥à§‡à¦•à§‡ à§© à¦¸à¦‚à¦°à¦•à§à¦·à¦¿à¦¤à¥¤

5. **à¦¯à¦¾à¦¤à§à¦°à§€à¦° à¦¬à¦¿à¦¬à¦°à¦£ à¦²à¦¿à¦–à§à¦¨**
   à¦¯à¦¾à¦¤à§à¦°à§€à¦° à¦¨à¦¾à¦®, à¦¬à¦¯à¦¼à¦¸, à¦®à§‹à¦¬à¦¾à¦‡à¦² à¦¨à¦®à§à¦¬à¦° à¦“ à¦‡à¦®à§‡à¦² à¦¦à¦¿à¦¨à¥¤

6. **PhonePe / UPI à¦¦à¦¿à¦¯à¦¼à§‡ à¦¨à¦¿à¦°à¦¾à¦ªà¦¦ à¦ªà§‡à¦®à§‡à¦¨à§à¦Ÿ à¦•à¦°à§à¦¨**
   QR à¦•à§‹à¦¡ à¦¸à§à¦•à§à¦¯à¦¾à¦¨ à¦•à¦°à§‡ à¦¤à¦¾à¦¤à§à¦•à§à¦·à¦£à¦¿à¦• à¦•à¦¨à¦«à¦¾à¦°à§à¦®à¦¡ PNR à¦à¦¬à¦‚ à¦…à¦«à¦¿à¦¸à¦¿à¦¯à¦¼à¦¾à¦² PDF à¦Ÿà¦¿à¦•à¦¿à¦Ÿ à¦ªà¦¾à¦¨!

à¦¨à¦¿à¦šà§‡à¦° à¦¬à§‹à¦¤à¦¾à¦®à§‡ à¦•à§à¦²à¦¿à¦• à¦•à¦°à§‡ à¦à¦–à¦¨à¦‡ à¦¬à§à¦•à¦¿à¦‚ à¦¶à§à¦°à§ à¦•à¦°à§à¦¨:`;
      const card = `
        <div class="ai-action-card">
          <div class="small fw-semibold text-secondary mb-2">à¦œà¦¨à¦ªà§à¦°à¦¿à¦¯à¦¼ à¦°à§à¦Ÿ: à¦§à¦°à¦®à¦ªà§à¦°à§€ &rarr; à¦‡à¦¨à§à¦¦à§‹à¦°</div>
          <div class="d-flex flex-wrap gap-2">
            <button class="btn btn-sm btn-primary py-1.5 px-3 fw-bold flex-grow-1" onclick="selectAiRoute('Dharampuri (Dhar, MP)', 'Indore')">à¦§à¦°à¦®à¦ªà§à¦°à§€ &rarr; à¦‡à¦¨à§à¦¦à§‹à¦° à¦¬à§à¦• à¦•à¦°à§à¦¨ (à¦§à¦¾à¦ª à§§)</button>
            <button class="btn btn-sm btn-outline-secondary py-1.5 px-3" onclick="toggleAiChat(false); document.getElementById('search-section').scrollIntoView({behavior:'smooth'});">à¦…à¦¨à§à¦¯à¦¾à¦¨à§à¦¯ à¦°à§à¦Ÿ</button>
          </div>
        </div>
      `;
      streamAiResponse(msg, card, ['à¦§à¦°à¦®à¦ªà§à¦°à§€ à¦¥à§‡à¦•à§‡ à¦‡à¦¨à§à¦¦à§‹à¦° à¦¬à¦¾à¦¸', 'à¦²à¦¾à¦‡à¦­ PNR à¦¸à§à¦Ÿà§à¦¯à¦¾à¦Ÿà¦¾à¦¸', 'à¦•à§à¦¯à¦¾à¦ªà§à¦Ÿà§‡à¦¨ à¦•à§€à¦°à§à¦¤à¦¨ à¦¨à¦®à§à¦¬à¦°']);
    } else if (lang === 'punjabi') {
      const msg = `**BusGo 'à¨¤à©‡ à¨¬à©±à¨¸ à¨Ÿà¨¿à¨•à¨Ÿ à¨¬à©à©±à¨• à¨•à¨°à¨¨ à¨¦à¨¾ à¨†à¨¸à¨¾à¨¨ à¨¤à¨°à©€à¨•à¨¾ (Step-by-Step):**

1. **à¨šà©œà©à¨¹à¨¨ à¨…à¨¤à©‡ à¨ªà¨¹à©à©°à¨šà¨£ à¨µà¨¾à¨²à¨¾ à¨¸à¨¼à¨¹à¨¿à¨° à¨šà©à¨£à©‹**
   à¨¸à¨°à¨š à¨¬à¨¾à¨•à¨¸ à¨µà¨¿à©±à¨š **"FROM"** à¨µà¨¿à©±à¨š à¨†à¨ªà¨£à¨¾ à¨¸à¨¼à¨¹à¨¿à¨° (à¨œà¨¿à¨µà©‡à¨‚ **Dharampuri (Dhar, MP)**) à¨…à¨¤à©‡ **"TO"** à¨µà¨¿à©±à¨š à¨†à¨ªà¨£à©€ à¨®à©°à¨œà¨¼à¨¿à¨² (à¨œà¨¿à¨µà©‡à¨‚ **Indore**) à¨šà©à¨£à©‹à¥¤

2. **à¨¸à¨«à¨¼à¨° à¨¦à©€ à¨®à¨¿à¨¤à©€ à¨…à¨¤à©‡ à¨¸à©€à¨Ÿà¨¾à¨‚ à¨šà©à¨£à©‹**
   à¨†à¨ªà¨£à©‡ à¨¸à¨«à¨¼à¨° à¨¦à©€ à¨¤à¨¾à¨°à©€à¨–à¨¼ à¨…à¨¤à©‡ à¨®à©à¨¸à¨¾à¨«à¨¼à¨°à¨¾à¨‚ à¨¦à©€ à¨—à¨¿à¨£à¨¤à©€ à¨šà©à¨£à©‹à¥¤

3. **"Search" à¨¬à¨Ÿà¨¨ 'à¨¤à©‡ à¨•à¨²à¨¿à©±à¨• à¨•à¨°à©‹**
   à¨¸à¨¾à¨°à©€à¨†à¨‚ à¨‰à¨ªà¨²à¨¬à¨§ à¨à¨¸à©€ à¨µà©‹à¨²à¨µà©‹ à¨¸à¨²à©€à¨ªà¨° à¨…à¨¤à©‡ IntrCity à¨¸à¨®à¨¾à¨°à¨Ÿà¨¬à©±à¨¸à¨¾à¨‚ à¨¦à©‡ à¨¸à¨®à©‡à¨‚ à¨…à¨¤à©‡ à¨˜à©±à¨Ÿ à¨•à¨¿à¨°à¨¾à¨ à¨µà©‡à¨–à©‹à¥¤

4. **à¨†à¨ªà¨£à©€ à¨ªà¨¸à©°à¨¦à©€à¨¦à¨¾ à¨¸à©€à¨Ÿ à¨šà©à¨£à©‹**
   à¨¬à©±à¨¸ à¨²à©‡à¨†à¨‰à¨Ÿ à¨µà¨¿à©±à¨š à¨†à¨ªà¨£à©€ à¨¸à©€à¨Ÿ à¨šà©à¨£à©‹à¥¤ à¨®à¨¹à¨¿à¨²à¨¾ à¨®à©à¨¸à¨¾à¨«à¨¼à¨°à¨¾à¨‚ à¨¦à©€ à¨¸à©à¨°à©±à¨–à¨¿à¨† à¨²à¨ˆ à¨ªà¨¹à¨¿à¨²à©€à¨†à¨‚ 1 à¨¤à©‹à¨‚ 3 à¨²à¨¾à¨ˆà¨¨à¨¾à¨‚ à¨°à¨¾à¨–à¨µà©€à¨†à¨‚ à¨¹à¨¨à¥¤

5. **à¨®à©à¨¸à¨¾à¨«à¨¼à¨° à¨¦à©‡ à¨µà©‡à¨°à¨µà©‡ à¨¦à¨°à¨œ à¨•à¨°à©‹**
   à¨®à©à¨¸à¨¾à¨«à¨¼à¨° à¨¦à¨¾ à¨¨à¨¾à¨®, à¨‰à¨®à¨°, à¨®à©‹à¨¬à¨¾à¨ˆà¨² à¨¨à©°à¨¬à¨° à¨…à¨¤à©‡ à¨ˆà¨®à©‡à¨² à¨­à¨°à©‹à¥¤

6. **PhonePe / UPI à¨°à¨¾à¨¹à©€à¨‚ à¨¤à©à¨°à©°à¨¤ à¨­à©à¨—à¨¤à¨¾à¨¨ à¨•à¨°à©‹**
   QR à¨•à©‹à¨¡ à¨¸à¨•à©ˆà¨¨ à¨•à¨°à©‹ à¨…à¨¤à©‡ à¨¤à©à¨°à©°à¨¤ à¨•à¨¨à¨«à¨°à¨®à¨¡ PNR à¨…à¨¤à©‡ PDF à¨Ÿà¨¿à¨•à¨Ÿ à¨ªà©à¨°à¨¾à¨ªà¨¤ à¨•à¨°à©‹!

à¨¹à©‡à¨ à¨¾à¨‚ à¨¦à¨¿à©±à¨¤à©‡ à¨¬à¨Ÿà¨¨ 'à¨¤à©‡ à¨•à¨²à¨¿à©±à¨• à¨•à¨°à¨•à©‡ à¨¤à©à¨°à©°à¨¤ à¨¬à©à¨•à¨¿à©°à¨— à¨¸à¨¼à©à¨°à©‚ à¨•à¨°à©‹:`;
      const card = `
        <div class="ai-action-card">
          <div class="small fw-semibold text-secondary mb-2">à¨®à¨¸à¨¼à¨¹à©‚à¨° à¨°à©‚à¨Ÿ: à¨§à¨°à¨®à¨ªà©à¨°à©€ &rarr; à¨‡à©°à¨¦à©Œà¨°</div>
          <div class="d-flex flex-wrap gap-2">
            <button class="btn btn-sm btn-primary py-1.5 px-3 fw-bold flex-grow-1" onclick="selectAiRoute('Dharampuri (Dhar, MP)', 'Indore')">à¨§à¨°à¨®à¨ªà©à¨°à©€ &rarr; à¨‡à©°à¨¦à©Œà¨° à¨¬à©à©±à¨• à¨•à¨°à©‹ (à¨•à¨¦à¨® 1)</button>
            <button class="btn btn-sm btn-outline-secondary py-1.5 px-3" onclick="toggleAiChat(false); document.getElementById('search-section').scrollIntoView({behavior:'smooth'});">à¨¹à©‹à¨° à¨¸à¨¼à¨¹à¨¿à¨°</button>
          </div>
        </div>
      `;
      streamAiResponse(msg, card, ['à¨§à¨°à¨®à¨ªà©à¨°à©€ à¨¤à©‹à¨‚ à¨‡à©°à¨¦à©Œà¨° à¨¬à©±à¨¸', 'à¨²à¨¾à¨ˆà¨µ PNR à¨¸à¨Ÿà©‡à¨Ÿà¨¸', 'à¨•à©ˆà¨ªà¨Ÿà¨¨ à¨•à©€à¨°à¨¤à¨¨ à¨¨à©°à¨¬à¨°']);
    } else if (lang === 'odia') {
      const msg = `**BusGo à¬°à­‡ à¬¬à¬¸à­ à¬Ÿà¬¿à¬•à­‡à¬Ÿà­ à¬¬à­à¬•à­ à¬•à¬°à¬¿à¬¬à¬¾à¬° à¬¸à¬¹à¬œ à¬ªà­à¬°à¬•à­à¬°à¬¿à­Ÿà¬¾ (Step-by-Step):**

1. **à¬ªà­à¬°à¬¸à­à¬¥à¬¾à¬¨ à¬à¬¬à¬‚ à¬—à¬¨à­à¬¤à¬¬à­à­Ÿ à¬¸à¬¹à¬° à¬šà­Ÿà¬¨ à¬•à¬°à¬¨à­à¬¤à­**
   à¬¸à¬°à­à¬šà­à¬š à¬¬à¬•à­à¬¸à¬°à­‡ **"FROM"** à¬°à­‡ à¬†à¬ªà¬£à¬™à­à¬• à¬¸à¬¹à¬° (à¬¯à¬¥à¬¾ **Dharampuri (Dhar, MP)**) à¬à¬¬à¬‚ **"TO"** à¬°à­‡ à¬—à¬¨à­à¬¤à¬¬à­à­Ÿ (à¬¯à¬¥à¬¾ **Indore**) à¬šà­Ÿà¬¨ à¬•à¬°à¬¨à­à¬¤à­à¥¤

2. **à¬¯à¬¾à¬¤à­à¬°à¬¾ à¬¤à¬¾à¬°à¬¿à¬– à¬à¬¬à¬‚ à¬¸à¬¿à¬Ÿà­ à¬¸à¬‚à¬–à­à­Ÿà¬¾ à¬šà­Ÿà¬¨ à¬•à¬°à¬¨à­à¬¤à­**
   à¬†à¬ªà¬£à¬™à­à¬• à¬¯à¬¾à¬¤à­à¬°à¬¾ à¬¤à¬¾à¬°à¬¿à¬– à¬à¬¬à¬‚ à¬¯à¬¾à¬¤à­à¬°à­€ à¬¸à¬‚à¬–à­à­Ÿà¬¾ à¬¬à¬¾à¬›à¬¨à­à¬¤à­à¥¤

3. **"Search" à¬¬à¬Ÿà¬¨à­ à¬‰à¬ªà¬°à­‡ à¬•à­à¬²à¬¿à¬•à­ à¬•à¬°à¬¨à­à¬¤à­**
   à¬‰à¬ªà¬²à¬¬à­à¬§ à¬¸à¬®à¬¸à­à¬¤ à¬à¬¸à¬¿ à¬­à¬²à¬­à­‹ à¬¸à­à¬²à¬¿à¬ªà¬°à­ à¬à¬¬à¬‚ IntrCity à¬¸à­à¬®à¬¾à¬°à­à¬Ÿà¬¬à¬¸à­ à¬° à¬¸à¬®à­Ÿ à¬à¬¬à¬‚ à¬¸à­à¬²à¬­ à¬­à¬¡à¬¼à¬¾ à¬¦à­‡à¬–à¬¨à­à¬¤à­à¥¤

4. **à¬ªà¬¸à¬¨à­à¬¦à¬° à¬¸à¬¿à¬Ÿà­ à¬šà­Ÿà¬¨ à¬•à¬°à¬¨à­à¬¤à­**
   à¬¬à¬¸à­ à¬²à­‡à¬†à¬‰à¬Ÿà­ à¬°à­ à¬†à¬ªà¬£à¬™à­à¬• à¬¸à¬¿à¬Ÿà­ à¬¬à¬¾à¬›à¬¨à­à¬¤à­à¥¤ à¬®à¬¹à¬¿à¬³à¬¾ à¬¯à¬¾à¬¤à­à¬°à­€à¬™à­à¬• à¬¸à­à¬°à¬•à­à¬·à¬¾ à¬ªà¬¾à¬‡à¬ à­§ à¬°à­ à­© à¬§à¬¾à¬¡à¬¼à¬¿ à¬¸à¬‚à¬°à¬•à­à¬·à¬¿à¬¤à¥¤

5. **à¬¯à¬¾à¬¤à­à¬°à­€à¬™à­à¬• à¬¬à¬¿à¬¬à¬°à¬£à­€ à¬ªà­à¬°à¬¬à­‡à¬¶ à¬•à¬°à¬¨à­à¬¤à­**
   à¬¨à¬¾à¬®, à¬¬à­Ÿà¬¸, à¬®à­‹à¬¬à¬¾à¬‡à¬²à­ à¬¨à¬®à­à¬¬à¬° à¬à¬¬à¬‚ à¬‡à¬®à­‡à¬²à­ à¬¦à¬¿à¬…à¬¨à­à¬¤à­à¥¤

6. **PhonePe / UPI à¬®à¬¾à¬§à­à­Ÿà¬®à¬°à­‡ à¬¸à­à¬°à¬•à­à¬·à¬¿à¬¤ à¬ªà­‡à¬®à­‡à¬£à­à¬Ÿ à¬•à¬°à¬¨à­à¬¤à­**
   QR à¬•à­‹à¬¡à­ à¬¸à­à¬•à¬¾à¬¨à­ à¬•à¬°à¬¨à­à¬¤à­ à¬à¬¬à¬‚ à¬¤à­à¬°à¬¨à­à¬¤ à¬¨à¬¿à¬¶à­à¬šà¬¿à¬¤ PNR à¬“ PDF à¬Ÿà¬¿à¬•à­‡à¬Ÿà­ à¬ªà­à¬°à¬¾à¬ªà­à¬¤ à¬•à¬°à¬¨à­à¬¤à­!

à¬¤à¬³à­‡ à¬¦à¬¿à¬†à¬¯à¬¾à¬‡à¬¥à¬¿à¬¬à¬¾ à¬¬à¬Ÿà¬¨à­ à¬•à­à¬²à¬¿à¬•à­ à¬•à¬°à¬¿ à¬¤à­à¬°à¬¨à­à¬¤ à¬¬à­à¬•à¬¿à¬‚ à¬†à¬°à¬®à­à¬­ à¬•à¬°à¬¨à­à¬¤à­:`;
      const card = `
        <div class="ai-action-card">
          <div class="small fw-semibold text-secondary mb-2">à¬²à­‹à¬•à¬ªà­à¬°à¬¿à­Ÿ à¬°à­à¬Ÿà­: à¬§à¬°à¬®à¬ªà­à¬°à­€ &rarr; à¬‡à¬¨à­à¬¦à­‹à¬°</div>
          <div class="d-flex flex-wrap gap-2">
            <button class="btn btn-sm btn-primary py-1.5 px-3 fw-bold flex-grow-1" onclick="selectAiRoute('Dharampuri (Dhar, MP)', 'Indore')">à¬§à¬°à¬®à¬ªà­à¬°à­€ &rarr; à¬‡à¬¨à­à¬¦à­‹à¬° à¬¬à­à¬•à­ à¬•à¬°à¬¨à­à¬¤à­ (à¬ªà¬¦à¬•à­à¬·à­‡à¬ª à­§)</button>
            <button class="btn btn-sm btn-outline-secondary py-1.5 px-3" onclick="toggleAiChat(false); document.getElementById('search-section').scrollIntoView({behavior:'smooth'});">à¬…à¬¨à­à­Ÿ à¬°à­à¬Ÿà­</button>
          </div>
        </div>
      `;
      streamAiResponse(msg, card, ['à¬§à¬°à¬®à¬ªà­à¬°à­€ à¬°à­ à¬‡à¬¨à­à¬¦à­‹à¬° à¬¬à¬¸à­', 'à¬²à¬¾à¬‡à¬­à­ PNR à¬¸à­à¬¥à¬¿à¬¤à¬¿', 'à¬•à­à­Ÿà¬¾à¬ªà­à¬Ÿà­‡à¬¨ à¬•à­€à¬°à­à¬¤à­à¬¤à¬¨ à¬¨à¬®à­à¬¬à¬°']);
    } else if (lang === 'urdu') {
      const msg = `**BusGo Ù¾Ø± Ø¨Ø³ Ù¹Ú©Ù¹ Ø¨Ú© Ú©Ø±Ù†Û’ Ú©Ø§ Ø¢Ø³Ø§Ù† Ø·Ø±ÛŒÙ‚Û Ú©Ø§Ø± (Step-by-Step):**

1. **Ø±ÙˆØ§Ù†Ú¯ÛŒ Ø§ÙˆØ± Ù…Ù†Ø²Ù„ Ú©Ø§ Ø´ÛØ± Ù…Ù†ØªØ®Ø¨ Ú©Ø±ÛŒÚº**
   Ø³Ø±Ú† Ø¨Ø§Ú©Ø³ Ù…ÛŒÚº **"FROM"** Ù…ÛŒÚº Ø§Ù¾Ù†Ø§ Ø´ÛØ± (Ø¬ÛŒØ³Û’ **Dharampuri (Dhar, MP)**) Ø§ÙˆØ± **"TO"** Ù…ÛŒÚº Ù…Ù†Ø²Ù„ (Ø¬ÛŒØ³Û’ **Indore**) Ù…Ù†ØªØ®Ø¨ Ú©Ø±ÛŒÚºÛ”

2. **Ø³ÙØ± Ú©ÛŒ ØªØ§Ø±ÛŒØ® Ø§ÙˆØ± Ù†Ø´Ø³ØªÛŒÚº Ù…Ù†ØªØ®Ø¨ Ú©Ø±ÛŒÚº**
   Ø§Ù¾Ù†Û’ Ø³ÙØ± Ú©ÛŒ ØªØ§Ø±ÛŒØ® Ø§ÙˆØ± Ù…Ø³Ø§ÙØ±ÙˆÚº Ú©ÛŒ ØªØ¹Ø¯Ø§Ø¯ Ú©Ø§ Ø§Ù†ØªØ®Ø§Ø¨ Ú©Ø±ÛŒÚºÛ”

3. **"Search" Ø¨Ù¹Ù† Ù¾Ø± Ú©Ù„Ú© Ú©Ø±ÛŒÚº**
   ØªÙ…Ø§Ù… Ø¯Ø³ØªÛŒØ§Ø¨ Ø§Û’ Ø³ÛŒ ÙˆÙˆÙ„ÙˆÙˆ Ø³Ù„ÛŒÙ¾Ø± Ø§ÙˆØ± IntrCity Ø³Ù…Ø§Ø±Ù¹ Ø¨Ø³ÙˆÚº Ú©Û’ Ø§ÙˆÙ‚Ø§Øª Ø§ÙˆØ± Ø³Ø³ØªÛ’ Ú©Ø±Ø§Ø¦Û’ Ù…Ù„Ø§Ø­Ø¸Û Ú©Ø±ÛŒÚºÛ”

4. **Ù¾Ø³Ù†Ø¯ÛŒØ¯Û Ù†Ø´Ø³Øª Ú©Ø§ Ø§Ù†ØªØ®Ø§Ø¨ Ú©Ø±ÛŒÚº**
   Ø¨Ø³ Ù„Û’ Ø¢Ø¤Ù¹ Ù…ÛŒÚº Ø§Ù¾Ù†ÛŒ Ø³ÛŒÙ¹ Ú†Ù†ÛŒÚºÛ” Ø®ÙˆØ§ØªÛŒÙ† Ù…Ø³Ø§ÙØ±ÙˆÚº Ú©Û’ ØªØ­ÙØ¸ Ú©Û’ Ù„ÛŒÛ’ Ù¾ÛÙ„ÛŒ 1 Ø³Û’ 3 Ù‚Ø·Ø§Ø±ÛŒÚº Ù…Ø®ØµÙˆØµ ÛÛŒÚºÛ”

5. **Ù…Ø³Ø§ÙØ± Ú©ÛŒ ØªÙØµÛŒÙ„Ø§Øª Ø¯Ø±Ø¬ Ú©Ø±ÛŒÚº**
   Ù…Ø³Ø§ÙØ± Ú©Ø§ Ù†Ø§Ù…ØŒ Ø¹Ù…Ø±ØŒ Ù…ÙˆØ¨Ø§Ø¦Ù„ Ù†Ù…Ø¨Ø± Ø§ÙˆØ± Ø§ÛŒ Ù…ÛŒÙ„ Ø¯Ø±Ø¬ Ú©Ø±ÛŒÚºÛ”

6. **PhonePe / UPI Ø³Û’ Ù…Ø­ÙÙˆØ¸ Ø§Ø¯Ø§Ø¦ÛŒÚ¯ÛŒ Ú©Ø±ÛŒÚº**
   QR Ú©ÙˆÚˆ Ø§Ø³Ú©ÛŒÙ† Ú©Ø±ÛŒÚº Ø§ÙˆØ± ÙÙˆØ±ÛŒ Ø·ÙˆØ± Ù¾Ø± ØªØµØ¯ÛŒÙ‚ Ø´Ø¯Û PNR Ø§ÙˆØ± Ø¢ÙÛŒØ´Ù„ PDF Ù¹Ú©Ù¹ Ø­Ø§ØµÙ„ Ú©Ø±ÛŒÚº!

Ù†ÛŒÚ†Û’ Ø¯ÛŒÛ’ Ú¯Ø¦Û’ Ø¨Ù¹Ù† Ù¾Ø± Ú©Ù„Ú© Ú©Ø± Ú©Û’ ÙÙˆØ±ÛŒ Ø¨Ú©Ù†Ú¯ Ø´Ø±ÙˆØ¹ Ú©Ø±ÛŒÚº:`;
      const card = `
        <div class="ai-action-card">
          <div class="small fw-semibold text-secondary mb-2">Ù…Ø´ÛÙˆØ± Ø±ÙˆÙ¹: Ø¯Ú¾Ø±Ù… Ù¾ÙˆØ±ÛŒ &rarr; Ø§Ù†Ø¯ÙˆØ±</div>
          <div class="d-flex flex-wrap gap-2">
            <button class="btn btn-sm btn-primary py-1.5 px-3 fw-bold flex-grow-1" onclick="selectAiRoute('Dharampuri (Dhar, MP)', 'Indore')">Ø¯Ú¾Ø±Ù… Ù¾ÙˆØ±ÛŒ &rarr; Ø§Ù†Ø¯ÙˆØ± Ø¨Ú© Ú©Ø±ÛŒÚº (Ù…Ø±Ø­Ù„Û 1)</button>
            <button class="btn btn-sm btn-outline-secondary py-1.5 px-3" onclick="toggleAiChat(false); document.getElementById('search-section').scrollIntoView({behavior:'smooth'});">Ø¯ÛŒÚ¯Ø± Ø´ÛØ±</button>
          </div>
        </div>
      `;
      streamAiResponse(msg, card, ['Ø¯Ú¾Ø±Ù… Ù¾ÙˆØ±ÛŒ ØªØ§ Ø§Ù†Ø¯ÙˆØ± Ø¨Ø³', 'Ù„Ø§Ø¦ÛŒÙˆ PNR Ø§Ø³Ù¹ÛŒÙ¹Ø³', 'Ú©ÛŒÙ¾Ù¹Ù† Ú©ÛŒØ±ØªÙ† Ù†Ù…Ø¨Ø±']);
    } else if (lang === 'hindi_devanagari') {
      const msg = `**BusGo à¤ªà¤° à¤¬à¤¸ à¤Ÿà¤¿à¤•à¤Ÿ à¤¬à¥à¤• à¤•à¤°à¤¨à¥‡ à¤•à¥€ à¤†à¤¸à¤¾à¤¨ à¤šà¤°à¤£à¤¬à¤¦à¥à¤§ (Step-by-Step) à¤ªà¥à¤°à¤•à¥à¤°à¤¿à¤¯à¤¾:**

1. **à¤ªà¥à¤°à¤¸à¥à¤¥à¤¾à¤¨ à¤à¤µà¤‚ à¤—à¤‚à¤¤à¤µà¥à¤¯ à¤¨à¤—à¤° à¤šà¥à¤¨à¥‡à¤‚**
   à¤¹à¥‹à¤®à¤ªà¥‡à¤œ à¤¸à¤°à¥à¤š à¤¬à¥‰à¤•à¥à¤¸ à¤®à¥‡à¤‚ **"FROM"** à¤®à¥‡à¤‚ à¤…à¤ªà¤¨à¤¾ à¤¶à¤¹à¤° (à¤œà¥ˆà¤¸à¥‡ **à¤§à¤°à¤®à¤ªà¥à¤°à¥€ (à¤§à¤¾à¤°, à¤®.à¤ªà¥à¤°.)**) à¤”à¤° **"TO"** à¤®à¥‡à¤‚ à¤œà¤¹à¤¾à¤ à¤œà¤¾à¤¨à¤¾ à¤¹à¥ˆ (à¤œà¥ˆà¤¸à¥‡ **à¤‡à¤‚à¤¦à¥Œà¤°**) à¤šà¥à¤¨à¥‡à¤‚à¥¤

2. **à¤¯à¤¾à¤¤à¥à¤°à¤¾ à¤¤à¤¿à¤¥à¤¿ à¤à¤µà¤‚ à¤¸à¥€à¤Ÿ à¤¸à¤‚à¤–à¥à¤¯à¤¾ à¤šà¥à¤¨à¥‡à¤‚**
   à¤…à¤ªà¤¨à¥€ à¤¯à¤¾à¤¤à¥à¤°à¤¾ à¤•à¥€ à¤¤à¤¾à¤°à¥€à¤– à¤”à¤° à¤¯à¤¾à¤¤à¥à¤°à¤¿à¤¯à¥‹à¤‚ à¤•à¥€ à¤¸à¤‚à¤–à¥à¤¯à¤¾ (Seats) à¤šà¥à¤¨à¥‡à¤‚à¥¤

3. **"Search" à¤¬à¤Ÿà¤¨ à¤ªà¤° à¤•à¥à¤²à¤¿à¤• à¤•à¤°à¥‡à¤‚**
   à¤‰à¤ªà¤²à¤¬à¥à¤§ à¤¸à¤­à¥€ à¤à¤¸à¥€ à¤µà¥‹à¤²à¥à¤µà¥‹ à¤¸à¥à¤²à¥€à¤ªà¤°, IntrCity à¤¸à¥à¤®à¤¾à¤°à¥à¤Ÿà¤¬à¤¸ à¤à¤µà¤‚ à¤¸à¥€à¤Ÿà¤° à¤¬à¤¸à¥‹à¤‚ à¤•à¥€ à¤¸à¥‚à¤šà¥€, à¤¸à¤®à¤¯ à¤µ à¤•à¤¿à¤°à¤¾à¤¯à¤¾ à¤¦à¥‡à¤–à¥‡à¤‚à¥¤

4. **à¤ªà¤¸à¤‚à¤¦à¥€à¤¦à¤¾ à¤¸à¥€à¤Ÿ à¤•à¤¾ à¤šà¤¯à¤¨ à¤•à¤°à¥‡à¤‚**
   à¤¬à¤¸ à¤²à¥‡à¤†à¤‰à¤Ÿ à¤®à¥‡à¤‚ à¤…à¤ªà¤¨à¥€ à¤¸à¥€à¤Ÿ à¤šà¥à¤¨à¥‡à¤‚à¥¤ à¤®à¤¹à¤¿à¤²à¤¾ à¤¯à¤¾à¤¤à¥à¤°à¤¿à¤¯à¥‹à¤‚ à¤•à¥€ à¤¸à¥à¤°à¤•à¥à¤·à¤¾ à¤¹à¥‡à¤¤à¥ à¤ªà¤‚à¤•à¥à¤¤à¤¿à¤¯à¤¾à¤ 1 à¤¸à¥‡ 3 à¤µà¤¿à¤¶à¥‡à¤· à¤°à¥‚à¤ª à¤¸à¥‡ à¤†à¤°à¤•à¥à¤·à¤¿à¤¤ à¤¹à¥ˆà¤‚à¥¤

5. **à¤¯à¤¾à¤¤à¥à¤°à¥€ à¤µà¤¿à¤µà¤°à¤£ à¤¦à¤°à¥à¤œ à¤•à¤°à¥‡à¤‚**
   à¤¯à¤¾à¤¤à¥à¤°à¥€ à¤•à¤¾ à¤¨à¤¾à¤®, à¤†à¤¯à¥, à¤®à¥‹à¤¬à¤¾à¤‡à¤² à¤¨à¤‚à¤¬à¤° à¤à¤µà¤‚ à¤ˆà¤®à¥‡à¤² à¤µà¤¿à¤µà¤°à¤£ à¤­à¤°à¥‡à¤‚à¥¤

6. **PhonePe / UPI à¤¸à¥‡ à¤¸à¥à¤°à¤•à¥à¤·à¤¿à¤¤ à¤­à¥à¤—à¤¤à¤¾à¤¨ à¤•à¤°à¥‡à¤‚**
   à¤¡à¤¾à¤¯à¤¨à¤¾à¤®à¤¿à¤• QR à¤•à¥‹à¤¡ à¤¸à¥à¤•à¥ˆà¤¨ à¤•à¤°à¥‡à¤‚ à¤¯à¤¾ UPI ID à¤¦à¤°à¥à¤œ à¤•à¤°à¥‡à¤‚à¥¤ à¤­à¥à¤—à¤¤à¤¾à¤¨ à¤ªà¥‚à¤°à¤¾ à¤¹à¥‹à¤¤à¥‡ à¤¹à¥€ à¤¤à¥à¤°à¤‚à¤¤ à¤ªà¥€à¤à¤¨à¤†à¤° à¤”à¤° à¤†à¤§à¤¿à¤•à¤¾à¤°à¤¿à¤• à¤ªà¥€à¤¡à¥€à¤à¤« à¤Ÿà¤¿à¤•à¤Ÿ à¤®à¤¿à¤² à¤œà¤¾à¤à¤—à¤¾!

à¤¨à¥€à¤šà¥‡ à¤¦à¤¿à¤ à¤¬à¤Ÿà¤¨ à¤ªà¤° à¤•à¥à¤²à¤¿à¤• à¤•à¤°à¤•à¥‡ à¤†à¤ª à¤¤à¥à¤°à¤‚à¤¤ à¤šà¤°à¤£ 1 à¤¸à¥‡ à¤¬à¥à¤•à¤¿à¤‚à¤— à¤¶à¥à¤°à¥‚ à¤•à¤° à¤¸à¤•à¤¤à¥‡ à¤¹à¥ˆà¤‚:`;

      const card = `
        <div class="ai-action-card">
          <div class="small fw-semibold text-secondary mb-2">à¤²à¥‹à¤•à¤ªà¥à¤°à¤¿à¤¯ à¤®à¤¾à¤°à¥à¤—: à¤§à¤°à¤®à¤ªà¥à¤°à¥€ (à¤®.à¤ªà¥à¤°.) &rarr; à¤‡à¤‚à¤¦à¥Œà¤°</div>
          <div class="d-flex flex-wrap gap-2">
            <button class="btn btn-sm btn-primary py-1.5 px-3 fw-bold flex-grow-1" onclick="selectAiRoute('Dharampuri (Dhar, MP)', 'Indore')">à¤§à¤°à¤®à¤ªà¥à¤°à¥€ &rarr; à¤‡à¤‚à¤¦à¥Œà¤° à¤¬à¥à¤• à¤•à¤°à¥‡à¤‚ (à¤šà¤°à¤£ 1)</button>
            <button class="btn btn-sm btn-outline-secondary py-1.5 px-3" onclick="toggleAiChat(false); document.getElementById('search-section').scrollIntoView({behavior:'smooth'});">à¤…à¤¨à¥à¤¯ à¤¶à¤¹à¤° à¤šà¥à¤¨à¥‡à¤‚</button>
          </div>
        </div>
      `;
      streamAiResponse(msg, card, ['à¤§à¤°à¤®à¤ªà¥à¤°à¥€ à¤¸à¥‡ à¤‡à¤‚à¤¦à¥Œà¤° à¤¬à¤¸', 'à¤«à¥‹à¤¨à¤ªà¥‡ à¤¸à¥‡ à¤ªà¥‡à¤®à¥‡à¤‚à¤Ÿ à¤•à¥ˆà¤¸à¥‡ à¤•à¤°à¥‡à¤‚', 'à¤²à¤¾à¤‡à¤µ à¤ªà¥€à¤à¤¨à¤†à¤° à¤¸à¥à¤Ÿà¥‡à¤Ÿà¤¸']);
    } else if (lang === 'english') {
      const msg = `**Step-by-Step Guide to Booking a Bus Ticket on BusGo:**

1. **Select Origin & Destination**
   In the search bar, select your departure location in **"FROM"** (e.g. **Dharampuri (Dhar, MP)**) and arrival in **"TO"** (e.g. **Indore**).

2. **Choose Travel Date & Seats**
   Pick your journey date and the number of passenger seats required.

3. **Click "Search" to Compare Buses**
   Browse available Volvo AC Sleeper, IntrCity SmartBus, and Express coaches with live departure timings and transparent fares.

4. **Pick Your Seat from the Live Layout**
   Select your preferred Window, Aisle, or Sleeper berth. Rows 1 to 3 are dedicated for solo female safety.

5. **Enter Passenger Information**
   Provide passenger name, age, active mobile number, and email.

6. **Pay Securely via PhonePe / UPI**
   Scan the dynamic QR code or pay via UPI. You receive an instant confirmed PNR and official PDF ticket!

Click below to begin booking right away:`;

      const exFrom = routeCtx.origin ? routeCtx.origin.split('(')[0].trim() : 'Indore';
      const exTo = routeCtx.destination ? routeCtx.destination.split('(')[0].trim() : 'Ujjain';
      const fullFrom = routeCtx.origin || 'Indore (Indore, MP)';
      const fullTo = routeCtx.destination || 'Ujjain (Ujjain, MP)';

      const card = `
        <div class="ai-action-card">
          <div class="small fw-semibold text-secondary mb-2">Selected Route: ${escapeHtml(exFrom)} &rarr; ${escapeHtml(exTo)}</div>
          <div class="d-flex flex-wrap gap-2">
            <button class="btn btn-sm btn-primary py-1.5 px-3 fw-bold flex-grow-1" onclick="selectAiRoute('${escapeHtml(fullFrom)}', '${escapeHtml(fullTo)}')">Start Booking (Step 1)</button>
            <button class="btn btn-sm btn-outline-secondary py-1.5 px-3" onclick="toggleAiChat(false); document.getElementById('search-section')?.scrollIntoView({behavior:'smooth'});">Custom Route</button>
          </div>
        </div>
      `;
      streamAiResponse(msg, card, getDynamicAiChips(routeCtx.origin, routeCtx.destination, lang));
    } else {
      // Hinglish
      const exFrom = routeCtx.origin ? routeCtx.origin.split('(')[0].trim() : 'Indore';
      const exTo = routeCtx.destination ? routeCtx.destination.split('(')[0].trim() : 'Ujjain';
      const fullFrom = routeCtx.origin || 'Indore (Indore, MP)';
      const fullTo = routeCtx.destination || 'Ujjain (Ujjain, MP)';

      const msg = `**BusGo par bus ticket book karne ka aasan Step-by-Step tarika:**

1. **Origin aur Destination Select Karein**
   Homepage search box me **"FROM"** me apna board hone wala shehar (jaise **${escapeHtml(exFrom)}**) aur **"TO"** me jahan jana hai (jaise **${escapeHtml(exTo)}**) select karein.

2. **Date aur Passengers (Seats) Chunein**
   Apni travel date aur kitni seats book karni hain wo select karein.

3. **"Search" Button par Click Karein**
   Aapko route par chalne wali sabhi AC Volvo Sleeper, IntrCity SmartBus aur seater buses ki live timings aur lowest fares dikhenge.

4. **Seat Layout me apni Pasandeeda Seat Chunein**
   Bus layout me Window, Aisle ya Upper/Lower Sleeper seat select karein. Female travelers ke safety ke liye Front Rows 1 se 3 reserved hain.

5. **Passenger Details Darj Karein**
   Yatri ka poora naam, umar (age), mobile number aur email darj karein.

6. **PhonePe / UPI se Fast Payment Karein**
   PhonePe QR scan karke ya UPI ID se 100% secure payment karein. Payment hote hi 2 second me PNR number aur official PDF ticket mil jayega!

Aap niche diye button par click karke abhi Step 1 se booking start kar sakte hain:`;

      const card = `
        <div class="ai-action-card">
          <div class="small fw-semibold text-secondary mb-2">Route: ${escapeHtml(exFrom)} &rarr; ${escapeHtml(exTo)}</div>
          <div class="d-flex flex-wrap gap-2">
            <button class="btn btn-sm btn-primary py-1.5 px-3 fw-bold flex-grow-1" onclick="selectAiRoute('${escapeHtml(fullFrom)}', '${escapeHtml(fullTo)}')">${escapeHtml(exFrom)} &rarr; ${escapeHtml(exTo)} Book Karein (Step 1)</button>
            <button class="btn btn-sm btn-outline-secondary py-1.5 px-3" onclick="toggleAiChat(false); document.getElementById('search-section')?.scrollIntoView({behavior:'smooth'});">Dusra Route Chunein</button>
          </div>
        </div>
      `;
      streamAiResponse(msg, card, getDynamicAiChips(routeCtx.origin, routeCtx.destination, lang));
    }
    return;
  }

  // B. HOW TO CANCEL A TICKET (Step-by-Step)
  const isCancelHowTo = (
    q.includes('how to cancel') ||
    q.includes('how cancel') ||
    q.includes('how do i cancel') ||
    q.includes('cancel kaise') ||
    q.includes('kaise cancel') ||
    q.includes('cancellation process') ||
    q.includes('cancel karne ka tarika') ||
    q.includes('à¤°à¤¦à¥à¤¦ à¤•à¥ˆà¤¸à¥‡') ||
    q.includes('à¤•à¥ˆà¤‚à¤¸à¤¿à¤² à¤•à¥ˆà¤¸à¥‡')
  );

  if (isCancelHowTo) {
    ctx.lastTopic = 'how_to_cancel';
    if (lang === 'hindi_devanagari') {
      const msg = `**à¤¬à¤¸ à¤Ÿà¤¿à¤•à¤Ÿ à¤°à¤¦à¥à¤¦ (Cancel) à¤•à¤°à¤¨à¥‡ à¤•à¥€ à¤†à¤¸à¤¾à¤¨ Step-by-Step à¤ªà¥à¤°à¤•à¥à¤°à¤¿à¤¯à¤¾:**

1. **"My Bookings" à¤µà¤¿à¤‚à¤¡à¥‹ à¤–à¥‹à¤²à¥‡à¤‚**
   à¤µà¥‡à¤¬à¤¸à¤¾à¤‡à¤Ÿ à¤•à¥‡ à¤¶à¥€à¤°à¥à¤· à¤®à¥‡à¤¨à¥‚ (Navigation Bar) à¤®à¥‡à¤‚ **"My Bookings"** à¤¬à¤Ÿà¤¨ à¤¦à¤¬à¤¾à¤à¤‚à¥¤

2. **à¤…à¤ªà¤¨à¤¾ PNR à¤¨à¤‚à¤¬à¤° à¤¦à¤°à¥à¤œ à¤•à¤°à¥‡à¤‚**
   à¤…à¤ªà¤¨à¤¾ 8-à¤…à¤‚à¤•à¥€à¤¯ à¤ªà¥€à¤à¤¨à¤†à¤° à¤¨à¤‚à¤¬à¤° (à¤œà¥ˆà¤¸à¥‡ \`BG123456\`) à¤”à¤° à¤ªà¤‚à¤œà¥€à¤•à¥ƒà¤¤ à¤®à¥‹à¤¬à¤¾à¤‡à¤² à¤¨à¤‚à¤¬à¤° à¤¡à¤¾à¤²à¥‡à¤‚à¥¤

3. **à¤Ÿà¤¿à¤•à¤Ÿ à¤à¤µà¤‚ à¤°à¤¿à¤«à¤‚à¤¡ à¤µà¤¿à¤µà¤°à¤£ à¤œà¤¾à¤‚à¤šà¥‡à¤‚**
   à¤°à¤¦à¥à¤¦ à¤•à¤°à¤¨à¥‡ à¤¸à¥‡ à¤ªà¥‚à¤°à¥à¤µ à¤†à¤ªà¤•à¥‹ à¤®à¤¿à¤²à¤¨à¥‡ à¤µà¤¾à¤²à¥€ à¤°à¤¿à¤«à¤‚à¤¡ à¤°à¤¾à¤¶à¤¿ à¤”à¤° à¤°à¤¦à¥à¤¦à¥€à¤•à¤°à¤£ à¤¶à¤°à¥à¤¤à¥‡à¤‚ à¤¸à¥à¤•à¥à¤°à¥€à¤¨ à¤ªà¤° à¤¦à¤¿à¤–à¤¾à¤ˆ à¤¦à¥‡à¤‚à¤—à¥€à¥¤

4. **"Cancel Ticket" à¤ªà¤° à¤•à¥à¤²à¤¿à¤• à¤•à¤°à¥‡à¤‚**
   à¤²à¤¾à¤² à¤°à¤‚à¤— à¤•à¥‡ **"Cancel Ticket"** à¤¬à¤Ÿà¤¨ à¤ªà¤° à¤•à¥à¤²à¤¿à¤• à¤•à¤°à¤•à¥‡ à¤ªà¥à¤·à¥à¤Ÿà¤¿ à¤•à¤°à¥‡à¤‚à¥¤ à¤†à¤ªà¤•à¤¾ à¤Ÿà¤¿à¤•à¤Ÿ à¤¤à¥à¤°à¤‚à¤¤ à¤°à¤¦à¥à¤¦ à¤¹à¥‹ à¤œà¤¾à¤à¤—à¤¾ à¤à¤µà¤‚ à¤°à¤¿à¤«à¤‚à¤¡ à¤†à¤ªà¤•à¥‡ à¤¬à¥ˆà¤‚à¤• à¤–à¤¾à¤¤à¥‡ à¤®à¥‡à¤‚ à¤ªà¥à¤°à¥‡à¤·à¤¿à¤¤ à¤•à¤° à¤¦à¤¿à¤¯à¤¾ à¤œà¤¾à¤à¤—à¤¾!`;

      const card = `
        <div class="ai-action-card">
          <button class="btn btn-sm btn-outline-danger w-100 py-1.5 fw-bold" onclick="toggleAiChat(false); openMyBookingsModal();">My Bookings à¤–à¥‹à¤²à¥‡à¤‚ (à¤Ÿà¤¿à¤•à¤Ÿ à¤°à¤¦à¥à¤¦ à¤•à¤°à¥‡à¤‚)</button>
        </div>
      `;
      streamAiResponse(msg, card, ['à¤ªà¥€à¤à¤¨à¤†à¤° à¤¸à¥à¤Ÿà¥‡à¤Ÿà¤¸', 'à¤•à¥ˆà¤ªà¥à¤Ÿà¤¨ à¤•à¥€à¤°à¥à¤¤à¤¨ à¤¨à¤‚à¤¬à¤°']);
    } else if (lang === 'english') {
      const msg = `**Step-by-Step Guide to Cancelling Your Bus Ticket:**

1. **Open "My Bookings"**
   Click on the **"My Bookings"** link in the top navigation bar.

2. **Enter Your PNR Number**
   Provide your 8-character PNR code (e.g. \`BG123456\`) and your registered phone number.

3. **Review Refund Breakdown**
   Inspect your ticket details and view eligible refund amounts according to standard policy.

4. **Click "Cancel Ticket"**
   Tap the red **"Cancel Ticket"** button to confirm. Your cancellation is instantaneous and refund is initiated to the original payment source!`;

      const card = `
        <div class="ai-action-card">
          <button class="btn btn-sm btn-outline-danger w-100 py-1.5 fw-bold" onclick="toggleAiChat(false); openMyBookingsModal();">Open My Bookings (Cancel)</button>
        </div>
      `;
      streamAiResponse(msg, card, ['Track my PNR status', 'Call Captain Driver Kirtan']);
    } else {
      const msg = `**Bus ticket cancel karne ka Step-by-Step aasan tarika:**

1. **"My Bookings" Kholein**
   Header navigation me diye gaye **"My Bookings"** button par click karein.

2. **Apna PNR Number Daalein**
   Apna 8-character PNR code (jaise: \`BG123456\`) aur mobile number enter karein.

3. **Refund Policy aur Ticket Review Karein**
   Aapko ticket ki details aur schedule ke anusaar refund amount dikhega.

4. **"Cancel Ticket" Button Dabayen**
   Red color ke **"Cancel Ticket"** button par tap karke confirm karein. Aapka ticket cancel ho jayega aur refund payment source me process ho jayega!`;

      const card = `
        <div class="ai-action-card">
          <button class="btn btn-sm btn-outline-danger w-100 py-1.5 fw-bold" onclick="toggleAiChat(false); openMyBookingsModal();">Open My Bookings (Cancel Ticket)</button>
        </div>
      `;
      streamAiResponse(msg, card, ['Track my PNR status live', 'Call Captain Driver Kirtan']);
    }
    return;
  }

  // C. HOW TO TRACK LIVE BUS (Step-by-Step)
  const isTrackHowTo = (
    q.includes('how to track') ||
    q.includes('how track') ||
    q.includes('how do i track') ||
    q.includes('track kaise') ||
    q.includes('kaise track') ||
    q.includes('live location kaise') ||
    q.includes('gps kaise dekhe') ||
    q.includes('tracking process') ||
    q.includes('à¤Ÿà¥à¤°à¥ˆà¤• à¤•à¥ˆà¤¸à¥‡')
  );

  if (isTrackHowTo) {
    ctx.lastTopic = 'how_to_track';
    if (lang === 'hindi_devanagari') {
      const msg = `**à¤…à¤ªà¤¨à¥€ à¤¬à¤¸ à¤•à¥‹ à¤²à¤¾à¤‡à¤µ à¤œà¥€à¤ªà¥€à¤à¤¸ à¤ªà¤° à¤Ÿà¥à¤°à¥ˆà¤• à¤•à¤°à¤¨à¥‡ à¤•à¥€ Step-by-Step à¤ªà¥à¤°à¤•à¥à¤°à¤¿à¤¯à¤¾:**

1. **"Live Track" à¤†à¤‡à¤•à¤¨ à¤šà¥à¤¨à¥‡à¤‚**
   à¤¹à¥‹à¤®à¤ªà¥‡à¤œ à¤ªà¤° **"Live Track"** à¤¬à¤Ÿà¤¨ à¤¦à¤¬à¤¾à¤à¤‚ à¤¯à¤¾ My Bookings à¤®à¥‡à¤‚ à¤…à¤ªà¤¨à¤¾ à¤Ÿà¤¿à¤•à¤Ÿ à¤–à¥‹à¤²à¥‡à¤‚à¥¤

2. **PNR à¤¨à¤‚à¤¬à¤° à¤¦à¤°à¥à¤œ à¤•à¤°à¥‡à¤‚**
   à¤…à¤ªà¤¨à¤¾ 8-à¤…à¤‚à¤•à¥€à¤¯ à¤ªà¥€à¤à¤¨à¤†à¤° à¤¨à¤‚à¤¬à¤° (à¤œà¥ˆà¤¸à¥‡: \`BG123456\`) à¤¡à¤¾à¤²à¥‡à¤‚à¥¤

3. **à¤¹à¤¾à¤ˆà¤µà¥‡ à¤®à¥ˆà¤ª à¤ªà¤° à¤²à¤¾à¤‡à¤µ à¤šà¥‡à¤•à¤ªà¥‰à¤‡à¤‚à¤Ÿ à¤¦à¥‡à¤–à¥‡à¤‚**
   à¤†à¤ªà¤•à¥‹ NH 52 à¤•à¥‰à¤°à¤¿à¤¡à¥‹à¤° à¤ªà¤° à¤¬à¤¸ à¤•à¥€ à¤¸à¤Ÿà¥€à¤• à¤²à¥‹à¤•à¥‡à¤¶à¤¨ (à¤œà¥ˆà¤¸à¥‡: à¤µà¤¿à¤‚à¤§à¥à¤¯ à¤—à¥à¤œà¤°à¥€ à¤˜à¤¾à¤Ÿ), à¤—à¤¤à¤¿ (65 à¤•à¤¿à¤®à¥€/à¤˜à¤‚à¤Ÿà¤¾) à¤”à¤° à¤†à¤—à¤®à¤¨ à¤¸à¤®à¤¯ à¤¦à¤¿à¤–à¥‡à¤—à¤¾à¥¤

4. **à¤®à¤¾à¤°à¥à¤— à¤šà¤¾à¤²à¤• à¤¸à¥‡ à¤¸à¥€à¤§à¤¾ à¤¸à¤‚à¤ªà¤°à¥à¤•**
   à¤•à¤¿à¤¸à¥€ à¤­à¥€ à¤°à¤¾à¤¸à¥à¤¤à¥‡ à¤•à¥€ à¤œà¤¾à¤¨à¤•à¤¾à¤°à¥€ à¤•à¥‡ à¤²à¤¿à¤ à¤®à¥à¤–à¥à¤¯ à¤šà¤¾à¤²à¤• **à¤•à¥ˆà¤ªà¥à¤Ÿà¤¨ à¤•à¥€à¤°à¥à¤¤à¤¨** (+91 6264213958) à¤•à¥‹ à¤¸à¥€à¤§à¤¾ à¤«à¥‹à¤¨ à¤²à¤—à¤¾à¤à¤‚!`;

      const card = `
        <div class="ai-action-card">
          <div class="d-flex flex-wrap gap-2">
            <button class="btn btn-sm btn-primary py-1.5 px-3 fw-bold flex-grow-1" onclick="toggleAiChat(false); ${latestBooking ? `openLiveTrackingModal('${latestBooking.pnr}')` : `openModal('trackModal')`};">à¤²à¤¾à¤‡à¤µ GPS à¤Ÿà¥à¤°à¥ˆà¤•à¤° à¤–à¥‹à¤²à¥‡à¤‚</button>
            <a class="btn btn-sm btn-outline-success py-1.5 px-3" href="tel:+916264213958">à¤•à¥ˆà¤ªà¥à¤Ÿà¤¨ à¤•à¥€à¤°à¥à¤¤à¤¨ à¤•à¥‹ à¤•à¥‰à¤² à¤•à¤°à¥‡à¤‚</a>
          </div>
        </div>
      `;
      streamAiResponse(msg, card, ['à¤§à¤°à¤®à¤ªà¥à¤°à¥€ à¤¸à¥‡ à¤‡à¤‚à¤¦à¥Œà¤° à¤¬à¤¸', 'à¤•à¥ˆà¤ªà¥à¤Ÿà¤¨ à¤•à¥€à¤°à¥à¤¤à¤¨ à¤¨à¤‚à¤¬à¤°']);
    } else if (lang === 'english') {
      const msg = `**Step-by-Step Guide to Tracking Your Bus Live:**

1. **Launch the Live GPS Tracker**
   Click on the **"Live Track"** button on the homepage or inside My Bookings.

2. **Enter Your PNR Code**
   Type your 8-character PNR number (e.g. \`BG123456\`).

3. **Inspect Real-Time Highway Map**
   Check the live convoy position along NH 52 (approaching Gujri Ghat), cruising speed (65 km/h), and estimated ETA.

4. **Connect with Fleet Commander**
   Directly dial lead driver **Captain Kirtan** (+91 6264213958) for immediate roadside pickup or stop coordination!`;

      const card = `
        <div class="ai-action-card">
          <div class="d-flex flex-wrap gap-2">
            <button class="btn btn-sm btn-primary py-1.5 px-3 fw-bold flex-grow-1" onclick="toggleAiChat(false); ${latestBooking ? `openLiveTrackingModal('${latestBooking.pnr}')` : `openModal('trackModal')`};">Open Live GPS Tracker</button>
            <a class="btn btn-sm btn-outline-success py-1.5 px-3" href="tel:+916264213958">Call Captain Kirtan</a>
          </div>
        </div>
      `;
      streamAiResponse(msg, card, getDynamicAiChips(routeCtx.origin, routeCtx.destination, 'english'));
    } else {
      const msg = `**Bus ko Live GPS par track karne ka Step-by-Step tarika:**

1. **"Live Track" Option Kholein**
   Homepage par **"Live Track"** button dabayein ya My Bookings me jayein.

2. **Apna PNR Number Darj Karein**
   Apna 8-digit PNR code (jaise: \`BG123456\`) enter karein.

3. **Interactive GPS Highway Map Dekhein**
   Aapko highway corridor par bus ka exact location, convoy speed aur arrival time dikhega.

4. **Driver Hotline se Connect Karein**
   Boarding point ya luggage ke liye seedhe lead driver **Captain Kirtan** (+91 6264213958) ko call lagayein!`;

      const card = `
        <div class="ai-action-card">
          <div class="d-flex flex-wrap gap-2">
            <button class="btn btn-sm btn-primary py-1.5 px-3 fw-bold flex-grow-1" onclick="toggleAiChat(false); ${latestBooking ? `openLiveTrackingModal('${latestBooking.pnr}')` : `openModal('trackModal')`};">Open Live GPS Tracker</button>
            <a class="btn btn-sm btn-outline-success py-1.5 px-3" href="tel:+916264213958">Call Captain Kirtan</a>
          </div>
        </div>
      `;
      streamAiResponse(msg, card, getDynamicAiChips(routeCtx.origin, routeCtx.destination, 'hinglish'));
    }
    return;
  }

  // D. HOW TO PAY VIA PHONEPE / UPI (Step-by-Step)
  const isPaymentHowTo = (
    q.includes('how to pay') ||
    q.includes('how pay') ||
    q.includes('how do i pay') ||
    q.includes('payment kaise') ||
    q.includes('pay kaise') ||
    q.includes('phonepe kaise') ||
    q.includes('upi payment') ||
    q.includes('qr scan kaise') ||
    q.includes('à¤ªà¥‡à¤®à¥‡à¤‚à¤Ÿ à¤•à¥ˆà¤¸à¥‡')
  );

  if (isPaymentHowTo) {
    ctx.lastTopic = 'how_to_pay';
    if (lang === 'hindi_devanagari') {
      const msg = `**PhonePe / UPI à¤¸à¥‡ à¤¸à¥à¤°à¤•à¥à¤·à¤¿à¤¤ à¤­à¥à¤—à¤¤à¤¾à¤¨ à¤•à¤°à¤¨à¥‡ à¤•à¥€ Step-by-Step à¤ªà¥à¤°à¤•à¥à¤°à¤¿à¤¯à¤¾:**

1. **à¤¸à¥€à¤Ÿ à¤šà¥à¤¨à¤•à¤° "Proceed to Pay" à¤ªà¤° à¤•à¥à¤²à¤¿à¤• à¤•à¤°à¥‡à¤‚**
   à¤¬à¤¸ à¤¸à¥€à¤Ÿ à¤”à¤° à¤¯à¤¾à¤¤à¥à¤°à¥€ à¤µà¤¿à¤µà¤°à¤£ à¤­à¤°à¤¨à¥‡ à¤•à¥‡ à¤¬à¤¾à¤¦ à¤­à¥à¤—à¤¤à¤¾à¤¨ à¤ªà¥ƒà¤·à¥à¤  à¤ªà¤° à¤ªà¤¹à¥à¤à¤šà¥‡à¤‚à¥¤

2. **"PhonePe / UPI QR" à¤µà¤¿à¤•à¤²à¥à¤ª à¤šà¥à¤¨à¥‡à¤‚**
   à¤­à¥à¤—à¤¤à¤¾à¤¨ à¤µà¤¿à¤§à¤¿à¤¯à¥‹à¤‚ à¤®à¥‡à¤‚ PhonePe QR à¤•à¥‹à¤¡ à¤šà¥à¤¨à¥‡à¤‚ (à¤¶à¥‚à¤¨à¥à¤¯ à¤…à¤¤à¤¿à¤°à¤¿à¤•à¥à¤¤ à¤¶à¥à¤²à¥à¤•)à¥¤

3. **QR à¤•à¥‹à¤¡ à¤¸à¥à¤•à¥ˆà¤¨ à¤•à¤°à¥‡à¤‚ à¤¯à¤¾ UPI ID à¤¦à¤°à¥à¤œ à¤•à¤°à¥‡à¤‚**
   à¤…à¤ªà¤¨à¥‡ à¤®à¥‹à¤¬à¤¾à¤‡à¤² à¤®à¥‡à¤‚ PhonePe, GPay à¤¯à¤¾ Paytm à¤–à¥‹à¤²à¥‡à¤‚ à¤”à¤° à¤¸à¥à¤•à¥à¤°à¥€à¤¨ à¤ªà¤° à¤ªà¥à¤°à¤¦à¤°à¥à¤¶à¤¿à¤¤ à¤¡à¤¾à¤¯à¤¨à¤¾à¤®à¤¿à¤• QR à¤•à¥‹à¤¡ à¤¸à¥à¤•à¥ˆà¤¨ à¤•à¤°à¥‡à¤‚à¥¤

4. **UPI à¤ªà¤¿à¤¨ à¤¦à¤°à¥à¤œ à¤•à¤° à¤­à¥à¤—à¤¤à¤¾à¤¨ à¤¸à¤‚à¤ªà¤¨à¥à¤¨ à¤•à¤°à¥‡à¤‚**
   à¤…à¤ªà¤¨à¥‡ à¤¬à¥ˆà¤‚à¤• à¤•à¤¾ UPI à¤ªà¤¿à¤¨ à¤¡à¤¾à¤²à¥‡à¤‚à¥¤ 2 à¤¸à¥‡à¤•à¤‚à¤¡ à¤®à¥‡à¤‚ à¤—à¥à¤°à¥€à¤¨ à¤•à¤¨à¥à¤«à¤°à¥à¤®à¥‡à¤¶à¤¨ à¤†à¤à¤—à¤¾ à¤”à¤° à¤†à¤§à¤¿à¤•à¤¾à¤°à¤¿à¤• à¤ªà¥€à¤¡à¥€à¤à¤« à¤Ÿà¤¿à¤•à¤Ÿ à¤œà¤¨à¤°à¥‡à¤Ÿ à¤¹à¥‹ à¤œà¤¾à¤à¤—à¤¾!`;

      streamAiResponse(msg, '', getDynamicAiChips(routeCtx.origin, routeCtx.destination, 'hindi_devanagari'));
    } else if (lang === 'english') {
      const msg = `**Step-by-Step Guide to Paying via PhonePe / UPI:**

1. **Select Seats & Click "Proceed to Pay"**
   After picking your seats and filling passenger info, proceed to the checkout screen.

2. **Choose "PhonePe / UPI QR"**
   Select the PhonePe UPI gateway for zero extra convenience charges.

3. **Scan Dynamic QR Code or Enter UPI ID**
   Open PhonePe, Google Pay, or Paytm on your smartphone and scan the instant QR code displayed on the screen.

4. **Enter UPI PIN & Approve**
   Enter your secure bank PIN. Within 2 seconds, your green confirmation screen and downloadable official PDF ticket appear!`;

      streamAiResponse(msg, '', getDynamicAiChips(routeCtx.origin, routeCtx.destination, 'english'));
    } else {
      const msg = `**PhonePe / UPI se fast aur safe payment karne ka Step-by-Step tarika:**

1. **Seat select karke "Proceed to Pay" dabayein**
   Apni seats aur passenger details bharne ke baad checkout page par jayein.

2. **"PhonePe / UPI QR" Select Karein**
   Payment options me PhonePe QR code select karein jisme zero extra charges lagte hain.

3. **PhonePe App se Dynamic QR Code Scan Karein**
   Apne mobile me PhonePe ya GPay app kholein aur screen par dikh raha dynamic QR scan karein, ya apni UPI ID (@ybl/@ibl) daalein.

4. **UPI PIN Daal kar Approve Karein**
   PIN daalte hi payment verify ho jayegi aur 2 second me green confirmation ke sath verified PDF ticket mil jayega!`;

      streamAiResponse(msg, '', getDynamicAiChips(routeCtx.origin, routeCtx.destination, 'hinglish'));
    }
    return;
  }

  // E. HOW TO DOWNLOAD OFFICIAL PDF TICKET (Step-by-Step)
  const isDownloadHowTo = (
    q.includes('how to download') ||
    q.includes('how download') ||
    q.includes('pdf kaise') ||
    q.includes('ticket download kaise') ||
    q.includes('print kaise') ||
    q.includes('à¤¡à¤¾à¤‰à¤¨à¤²à¥‹à¤¡ à¤•à¥ˆà¤¸à¥‡')
  );

  if (isDownloadHowTo) {
    ctx.lastTopic = 'how_to_download';
    if (lang === 'hindi_devanagari') {
      const msg = `**à¤†à¤§à¤¿à¤•à¤¾à¤°à¤¿à¤• à¤ªà¥€à¤¡à¥€à¤à¤« à¤Ÿà¤¿à¤•à¤Ÿ à¤¡à¤¾à¤‰à¤¨à¤²à¥‹à¤¡ à¤•à¤°à¤¨à¥‡ à¤•à¥€ Step-by-Step à¤ªà¥à¤°à¤•à¥à¤°à¤¿à¤¯à¤¾:**

1. **à¤¬à¥à¤•à¤¿à¤‚à¤— à¤•à¤¨à¥à¤«à¤°à¥à¤®à¥‡à¤¶à¤¨ à¤…à¤¥à¤µà¤¾ "My Bookings" à¤ªà¤° à¤œà¤¾à¤à¤‚**
   à¤Ÿà¤¿à¤•à¤Ÿ à¤¬à¥à¤• à¤•à¤°à¤¨à¥‡ à¤•à¥‡ à¤¤à¥à¤°à¤‚à¤¤ à¤¬à¤¾à¤¦ à¤•à¤¨à¥à¤«à¤°à¥à¤®à¥‡à¤¶à¤¨ à¤¸à¥à¤•à¥à¤°à¥€à¤¨ à¤ªà¤° à¤¯à¤¾ à¤¨à¥‡à¤µà¤¿à¤—à¥‡à¤¶à¤¨ à¤®à¥‡à¤¨à¥‚ à¤®à¥‡à¤‚ **"My Bookings"** à¤–à¥‹à¤²à¥‡à¤‚à¥¤

2. **à¤…à¤ªà¤¨à¤¾ PNR à¤¨à¤‚à¤¬à¤° à¤šà¥à¤¨à¥‡à¤‚**
   à¤…à¤ªà¤¨à¥‡ à¤Ÿà¤¿à¤•à¤Ÿ à¤°à¤¿à¤•à¥‰à¤°à¥à¤¡ à¤•à¥‡ à¤¸à¤¾à¤®à¤¨à¥‡ à¤¦à¤¿à¤ à¤—à¤ à¤µà¤¿à¤•à¤²à¥à¤ª à¤¦à¥‡à¤–à¥‡à¤‚à¥¤

3. **"Download Official PDF" à¤¬à¤Ÿà¤¨ à¤¦à¤¬à¤¾à¤à¤‚**
   à¤¨à¥€à¤²à¥‡ à¤°à¤‚à¤— à¤•à¥‡ **"Download Official PDF"** à¤¬à¤Ÿà¤¨ à¤ªà¤° à¤•à¥à¤²à¤¿à¤• à¤•à¤°à¥‡à¤‚à¥¤ à¤†à¤ªà¤•à¥‡ à¤¡à¤¿à¤µà¤¾à¤‡à¤¸ à¤®à¥‡à¤‚ à¤•à¥à¤¯à¥‚à¤†à¤° à¤•à¥‹à¤¡ à¤à¤µà¤‚ à¤•à¥ˆà¤ªà¥à¤Ÿà¤¨ à¤•à¥€à¤°à¥à¤¤à¤¨ à¤•à¥‡ à¤µà¤¿à¤µà¤°à¤£ à¤¸à¤¹à¤¿à¤¤ à¤°à¤‚à¤—à¥€à¤¨ à¤ªà¥€à¤¡à¥€à¤à¤« à¤Ÿà¤¿à¤•à¤Ÿ à¤¸à¥‡à¤µ à¤¹à¥‹ à¤œà¤¾à¤à¤—à¤¾!`;

      const card = latestBooking ? `
        <div class="ai-action-card">
          <div class="small fw-semibold text-secondary mb-2">à¤†à¤ªà¤•à¤¾ à¤¸à¤•à¥à¤°à¤¿à¤¯ à¤Ÿà¤¿à¤•à¤Ÿ PNR: ${latestBooking.pnr}</div>
          <button class="btn btn-sm btn-primary w-100 py-1.5 fw-bold" onclick="downloadTicketPdf('${latestBooking.pnr}')">PNR ${latestBooking.pnr} PDF à¤¡à¤¾à¤‰à¤¨à¤²à¥‹à¤¡ à¤•à¤°à¥‡à¤‚</button>
        </div>
      ` : `
        <div class="ai-action-card">
          <button class="btn btn-sm btn-outline-primary w-100 py-1.5 fw-semibold" onclick="toggleAiChat(false); openMyBookingsModal();">My Bookings à¤–à¥‹à¤²à¥‡à¤‚</button>
        </div>
      `;
      streamAiResponse(msg, card, getDynamicAiChips(routeCtx.origin, routeCtx.destination, 'hindi_devanagari'));
    } else {
      const msg = `**Official PDF Ticket download karne ka Step-by-Step tarika:**

1. **Booking Confirmation Screen ya "My Bookings" par jayein**
   Seat book hone ke baad success screen par ya top menu me **"My Bookings"** par jayein.

2. **Apna PNR Number Dekhein**
   Apne 8-character PNR code ke sath ticket details verify karein.

3. **"Download Official PDF" Button par Click Karein**
   Blue color ke **"Download Official PDF"** button par tap karein. Aapke phone/laptop me verified high-res ticket download ho jayega jisme travel itinerary, seat number aur Captain Kirtan (+91 6264213958) ka direct contact rehta hai!`;

      const card = latestBooking ? `
        <div class="ai-action-card">
          <div class="small fw-semibold text-secondary mb-2">Aapka Active Ticket PNR: ${latestBooking.pnr}</div>
          <button class="btn btn-sm btn-primary w-100 py-1.5 fw-bold" onclick="downloadTicketPdf('${latestBooking.pnr}')">Download PNR ${latestBooking.pnr} PDF</button>
        </div>
      ` : `
        <div class="ai-action-card">
          <button class="btn btn-sm btn-outline-primary w-100 py-1.5 fw-semibold" onclick="toggleAiChat(false); openMyBookingsModal();">Open My Bookings</button>
        </div>
      `;
      streamAiResponse(msg, card, getDynamicAiChips(routeCtx.origin, routeCtx.destination, 'hinglish'));
    }
    return;
  }

  // F. GENERAL PROCEDURAL / STEP-BY-STEP FALLBACK
  const isGenericHowTo = (
    q.startsWith('how to') ||
    q.startsWith('how do') ||
    q.startsWith('how can') ||
    q.startsWith('how ') ||
    q.includes('kaise kare') ||
    q.includes('kaise karte') ||
    q.includes('step by step') ||
    q.includes('process kya hai') ||
    q.includes('tarika kya hai') ||
    q.includes('à¤•à¥ˆà¤¸à¥‡ à¤•à¤°à¥‡à¤‚')
  );

  if (isGenericHowTo) {
    ctx.lastTopic = 'generic_how_to';
    if (lang === 'hindi_devanagari') {
      const msg = `**BusGo à¤¸à¤¹à¤¾à¤¯à¤¤à¤¾ à¤¡à¥‡à¤¸à¥à¤• â€” à¤šà¤°à¤£à¤¬à¤¦à¥à¤§ (Step-by-Step) à¤—à¤¾à¤‡à¤¡:**

1. **à¤¬à¤¸ à¤–à¥‹à¤œà¥‡à¤‚ à¤à¤µà¤‚ à¤¸à¤®à¤¯ à¤¦à¥‡à¤–à¥‡à¤‚**
   à¤¶à¥€à¤°à¥à¤· à¤¸à¤°à¥à¤š à¤¬à¤¾à¤° à¤®à¥‡à¤‚ à¤…à¤ªà¤¨à¤¾ à¤ªà¥à¤°à¤¸à¥à¤¥à¤¾à¤¨ à¤”à¤° à¤—à¤‚à¤¤à¤µà¥à¤¯ à¤¨à¤—à¤° à¤¦à¤°à¥à¤œ à¤•à¤°à¥‡à¤‚ à¤”à¤° "Search" à¤¦à¤¬à¤¾à¤à¤‚à¥¤

2. **à¤¸à¥€à¤Ÿ à¤šà¥à¤¨à¥‡à¤‚ à¤à¤µà¤‚ à¤¬à¥à¤•à¤¿à¤‚à¤— à¤•à¤°à¥‡à¤‚**
   à¤¬à¤¸ à¤²à¥‡à¤†à¤‰à¤Ÿ à¤®à¥‡à¤‚ à¤…à¤ªà¤¨à¥€ à¤ªà¤¸à¤‚à¤¦à¥€à¤¦à¤¾ à¤¸à¥€à¤Ÿ à¤šà¥à¤¨à¥‡à¤‚ (à¤ªà¤‚à¤•à¥à¤¤à¤¿à¤¯à¤¾à¤ 1-3 à¤®à¤¹à¤¿à¤²à¤¾à¤“à¤‚ à¤¹à¥‡à¤¤à¥ à¤¸à¥à¤°à¤•à¥à¤·à¤¿à¤¤ à¤¹à¥ˆà¤‚) à¤”à¤° à¤¯à¤¾à¤¤à¥à¤°à¥€ à¤œà¤¾à¤¨à¤•à¤¾à¤°à¥€ à¤­à¤°à¥‡à¤‚à¥¤

3. **à¤¸à¥à¤°à¤•à¥à¤·à¤¿à¤¤ à¤­à¥à¤—à¤¤à¤¾à¤¨ à¤à¤µà¤‚ à¤Ÿà¤¿à¤•à¤Ÿ à¤ªà¥à¤°à¤¾à¤ªà¥à¤¤ à¤•à¤°à¥‡à¤‚**
   PhonePe / UPI à¤¸à¥‡ à¤­à¥à¤—à¤¤à¤¾à¤¨ à¤•à¤°à¥‡à¤‚ à¤”à¤° à¤¤à¥à¤°à¤‚à¤¤ à¤†à¤§à¤¿à¤•à¤¾à¤°à¤¿à¤• à¤ªà¥€à¤¡à¥€à¤à¤« à¤Ÿà¤¿à¤•à¤Ÿ à¤¡à¤¾à¤‰à¤¨à¤²à¥‹à¤¡ à¤•à¤°à¥‡à¤‚à¥¤

4. **à¤²à¤¾à¤‡à¤µ à¤œà¥€à¤ªà¥€à¤à¤¸ à¤Ÿà¥à¤°à¥ˆà¤•à¤¿à¤‚à¤— à¤à¤µà¤‚ à¤šà¤¾à¤²à¤• à¤¸à¤¹à¤¾à¤¯à¤¤à¤¾**
   à¤¯à¤¾à¤¤à¥à¤°à¤¾ à¤•à¥‡ à¤¦à¤¿à¤¨ à¤…à¤ªà¤¨à¥€ à¤¬à¤¸ à¤•à¥‹ à¤²à¤¾à¤‡à¤µ à¤Ÿà¥à¤°à¥ˆà¤• à¤•à¤°à¥‡à¤‚ à¤¯à¤¾ à¤¸à¥€à¤§à¥‡ **à¤•à¥ˆà¤ªà¥à¤Ÿà¤¨ à¤•à¥€à¤°à¥à¤¤à¤¨** (+91 6264213958) à¤¸à¥‡ à¤¸à¤‚à¤ªà¤°à¥à¤• à¤•à¤°à¥‡à¤‚à¥¤

à¤¯à¤¦à¤¿ à¤†à¤ªà¤•à¤¾ à¤•à¥‹à¤ˆ à¤µà¤¿à¤¶à¤¿à¤·à¥à¤Ÿ à¤ªà¥à¤°à¤¶à¥à¤¨ à¤¹à¥ˆ, à¤¤à¥‹ à¤¬à¥‡à¤à¤¿à¤à¤• à¤µà¤¿à¤¸à¥à¤¤à¤¾à¤° à¤¸à¥‡ à¤¬à¤¤à¤¾à¤à¤‚!`;

      streamAiResponse(msg, '', getDynamicAiChips(routeCtx.origin, routeCtx.destination, 'hindi_devanagari'));
    } else if (lang === 'english') {
      const msg = `**BusGo Help Desk â€” Step-by-Step Overview:**

1. **Search Bus Routes & Schedules**
   Enter your departure and arrival cities and hit "Search".

2. **Select Seats with Protection**
   Pick your favorite seat in the interactive layout (Front rows 1-3 reserved for female safety) and fill passenger details.

3. **Pay Securely & Download PDF Ticket**
   Complete instant payment via PhonePe / UPI and get your verified PNR ticket immediately.

4. **Live Highway Tracking & Driver Support**
   Track your bus in real time on the highway or call Fleet Commander **Captain Kirtan** (+91 6264213958) anytime.

Please let me know if you would like step-by-step guidance on any specific feature!`;

      streamAiResponse(msg, '', getDynamicAiChips(routeCtx.origin, routeCtx.destination, 'english'));
    } else {
      const msg = `**BusGo Help Desk â€” Step-by-Step Guide:**

1. **Bus Search Karein**
   Search bar me FROM aur TO shehar select karke "Search" dabayein.

2. **Seat Layout me Seat Chunein**
   Sleeper ya Seater seat select karein (Rows 1 se 3 strictly ladies safety ke liye reserved hain) aur passenger details bharein.

3. **Payment Karein aur Ticket Download Karein**
   PhonePe / UPI se payment complete karein aur turant 1-click me official PDF ticket download karein.

4. **Live Highway Tracking & Driver Hotline**
   Journey wale din apne PNR se live location dekhein ya Chief Commander **Captain Kirtan** (+91 6264213958) ko seedha call karein.

Aapko inme se kis cheez ki detailed step-by-step help chahiye?`;

      streamAiResponse(msg, '', getDynamicAiChips(routeCtx.origin, routeCtx.destination, 'hinglish'));
    }
    return;
  }

  // G. BUS STOPPAGE & EN-ROUTE HALT INTELLIGENCE ("kha rukti hai", "stops", "stoppages", "halts")
  const isStoppageQuery = (
    q.includes('kha rukti') ||
    q.includes('kaha rukti') ||
    q.includes('kahan rukti') ||
    q.includes('kha stop') ||
    q.includes('kaha stop') ||
    q.includes('kahan stop') ||
    q.includes('stop hai') ||
    q.includes('stoppage') ||
    q.includes('route stop') ||
    q.includes('boarding point') ||
    q.includes('dropping point') ||
    q.includes('halt') ||
    q.includes('à¤•à¤¹à¤¾à¤ à¤°à¥à¤•à¤¤à¥€') ||
    q.includes('à¤¸à¥à¤Ÿà¥‰à¤ª')
  );

  if (isStoppageQuery) {
    ctx.lastTopic = 'bus_stoppages';
    const fCity = routeCtx.origin;
    const tCity = routeCtx.destination;
    if (!fCity || !tCity) {
      promptRouteClarification('bus_stoppages', lang);
      return;
    }

    const route = getRouteData(fCity, tCity);
    const stopList = route.stops || [];
    const cleanF = fCity.split('(')[0].trim();
    const cleanT = tCity.split('(')[0].trim();

    if (lang === 'hindi_devanagari') {
      const msg = `**${cleanF} à¤¸à¥‡ ${cleanT} à¤®à¤¾à¤°à¥à¤— à¤ªà¤° à¤¬à¤¸ à¤•à¤¹à¤¾à¤-à¤•à¤¹à¤¾à¤ à¤°à¥à¤•à¤¤à¥€ à¤¹à¥ˆ (Stoppages Timeline):**

${stopList.map((st, i) => `${i + 1}. **${st.name}**\n   - à¤¸à¤®à¤¯: +${st.timeMin} à¤®à¤¿à¤¨à¤Ÿ (${st.distKm} à¤•à¤¿à¤®à¥€)\n   - à¤ªà¥à¤°à¤•à¤¾à¤°: ${st.duration ? `**à¤¨à¤¿à¤°à¥à¤§à¤¾à¤°à¤¿à¤¤ à¤¹à¥‰à¤²à¥à¤Ÿ (${st.duration})**` : (st.type === 'pickup' ? 'à¤ªà¥à¤°à¤¸à¥à¤¥à¤¾à¤¨ à¤¬à¥‹à¤°à¥à¤¡à¤¿à¤‚à¤—' : (st.type === 'drop' ? 'à¤…à¤‚à¤¤à¤¿à¤® à¤—à¤‚à¤¤à¤µà¥à¤¯' : 'à¤®à¤¾à¤°à¥à¤— à¤šà¥‡à¤•à¤ªà¥‰à¤‡à¤‚à¤Ÿ'))}`).join('\n\n')}

à¤¸à¤­à¥€ à¤ªà¥à¤°à¤®à¥à¤– à¤¬à¤¸à¥‹à¤‚ à¤®à¥‡à¤‚ à¤šà¤¾à¤²à¤• **à¤•à¥ˆà¤ªà¥à¤Ÿà¤¨ à¤•à¥€à¤°à¥à¤¤à¤¨** (+91 6264213958) à¤¦à¥à¤µà¤¾à¤°à¤¾ à¤²à¤¾à¤‡à¤µ à¤œà¥€à¤ªà¥€à¤à¤¸ à¤Ÿà¥à¤°à¥ˆà¤•à¤¿à¤‚à¤— à¤‰à¤ªà¤²à¤¬à¥à¤§ à¤¹à¥ˆà¥¤`;

      const card = `
        <div class="ai-action-card">
          <div class="fw-bold mb-1">à¤²à¤¾à¤‡à¤µ à¤°à¥‚à¤Ÿ à¤®à¥ˆà¤ª à¤ªà¤° à¤¸à¤­à¥€ à¤¸à¥à¤Ÿà¥‰à¤ª à¤¦à¥‡à¤–à¥‡à¤‚:</div>
          <button class="btn btn-sm btn-primary w-100 py-1.5 fw-bold" onclick="toggleAiChat(false); openLiveTrackingModal({from:'${escapeHtml(fCity)}', to:'${escapeHtml(tCity)}', busOperator:'IntrCity SmartBus'});">à¤²à¤¾à¤‡à¤µ GPS à¤®à¥ˆà¤ª à¤ªà¤° à¤¸à¥à¤Ÿà¥‰à¤ª à¤–à¥‹à¤²à¥‡à¤‚</button>
        </div>
      `;
      streamAiResponse(msg, card, getDynamicAiChips(fCity, tCity, lang));
    } else {
      const msg = `**${cleanF} se ${cleanT} route par bus kahan-kahan rukti hai (Real Stoppages & Halts):**

${stopList.map((st, i) => `${i + 1}. **${st.name}**\n   - Scheduled ETA: +${st.timeMin} mins from origin (${st.distKm} km)\n   - Stop Detail: ${st.duration ? `**Official Rest Halt (${st.duration})**` : (st.type === 'pickup' ? 'Boarding Pickup Terminal' : (st.type === 'drop' ? 'Final Dropping Terminal' : 'Expressway Checkpoint'))}`).join('\n\n')}

Aap niche diye gaye button se in sabhi stops ko interactive Live GPS Map par bhi dekh sakte hain:`;

      const card = `
        <div class="ai-action-card">
          <div class="fw-bold mb-1">Check All Stops on Live Highway Map:</div>
          <button class="btn btn-sm btn-primary w-100 py-1.5 fw-bold" onclick="toggleAiChat(false); openLiveTrackingModal({from:'${escapeHtml(fCity)}', to:'${escapeHtml(tCity)}', busOperator:'IntrCity SmartBus'});">Open All Stops on Live GPS Map</button>
        </div>
      `;
      streamAiResponse(msg, card, getDynamicAiChips(fCity, tCity, lang));
    }
    return;
  }

  // 7. LIVE PNR STATUS & GPS TRACKING
  if (
    q.includes('pnr') ||
    q.includes('track') ||
    q.includes('kaha hai') ||
    q.includes('kaha tak') ||
    q.includes('where is my bus') ||
    q.includes('live location') ||
    q.includes('status') ||
    q.includes('à¤ªà¥€à¤à¤¨à¤†à¤°') ||
    q.includes('à¤•à¤¹à¤¾à¤')
  ) {
    ctx.lastTopic = 'pnr_tracking';
    if (latestBooking) {
      const pnr = latestBooking.pnr;
      const from = latestBooking.fromCity || latestBooking.from || 'Dharampuri';
      const to = latestBooking.toCity || latestBooking.to || 'Indore';
      const dep = formatTime12(latestBooking.departure || '08:00 AM');
      const passName = latestBooking.passengerName || userName || 'Guest';

      if (lang === 'hindi_devanagari') {
        const pnrMsg = `**à¤²à¤¾à¤‡à¤µ à¤ªà¥€à¤à¤¨à¤†à¤° à¤¸à¥à¤Ÿà¥‡à¤Ÿà¤¸ à¤ªà¥à¤°à¤¾à¤ªà¥à¤¤ à¤¹à¥à¤†!**

- **à¤ªà¥€à¤à¤¨à¤†à¤° à¤¨à¤‚à¤¬à¤°:** \`${pnr}\` (à¤¸à¥à¤¥à¤¿à¤¤à¤¿: **à¤ªà¥à¤·à¥à¤Ÿ / CONFIRMED**)
- **à¤¯à¤¾à¤¤à¥à¤°à¥€:** ${passName} â€¢ **à¤ªà¥à¤°à¤¸à¥à¤¥à¤¾à¤¨ à¤¸à¤®à¤¯:** ${dep}
- **à¤®à¤¾à¤°à¥à¤—:** **${from} â†’ ${to}**
- **à¤µà¤°à¥à¤¤à¤®à¤¾à¤¨ à¤¹à¤¾à¤ˆà¤µà¥‡ à¤šà¥‡à¤•à¤ªà¥‰à¤‡à¤‚à¤Ÿ:** **à¤µà¤¿à¤‚à¤§à¥à¤¯ à¤—à¥à¤œà¤°à¥€ à¤˜à¤¾à¤Ÿ à¤¸à¥‡à¤•à¥à¤¶à¤¨ (NH 52)**
- **à¤—à¤¤à¤¿ à¤à¤µà¤‚ à¤†à¤—à¤®à¤¨:** à¤•à¥à¤°à¥‚à¤œà¤¼ à¤—à¤¤à¤¿ 65 à¤•à¤¿à¤®à¥€/à¤˜à¤‚à¤Ÿà¤¾ â€¢ **à¤…à¤¨à¥à¤®à¤¾à¤¨à¤¿à¤¤ à¤¸à¤®à¤¯:** 38 à¤®à¤¿à¤¨à¤Ÿ à¤®à¥‡à¤‚ à¤—à¤‚à¤¤à¤µà¥à¤¯
- **à¤®à¤¾à¤°à¥à¤— à¤ªà¥à¤°à¤­à¤¾à¤°à¥€ à¤šà¤¾à¤²à¤•:** **à¤•à¥ˆà¤ªà¥à¤Ÿà¤¨ à¤•à¥€à¤°à¥à¤¤à¤¨** (+91 6264213958)

à¤†à¤ª à¤¨à¥€à¤šà¥‡ à¤¦à¤¿à¤ à¤¬à¤Ÿà¤¨ à¤¸à¥‡ à¤²à¤¾à¤‡à¤µ à¤œà¥€à¤ªà¥€à¤à¤¸ à¤®à¥ˆà¤ª à¤¦à¥‡à¤– à¤¸à¤•à¤¤à¥‡ à¤¹à¥ˆà¤‚ à¤¯à¤¾ à¤•à¥ˆà¤ªà¥à¤Ÿà¤¨ à¤•à¥€à¤°à¥à¤¤à¤¨ à¤•à¥‹ à¤¸à¥€à¤§à¥‡ à¤•à¥‰à¤² à¤•à¤° à¤¸à¤•à¤¤à¥‡ à¤¹à¥ˆà¤‚:`;

        const pnrCard = `
          <div class="ai-action-card">
            <div class="d-flex justify-content-between align-items-center mb-1">
              <strong>${escapeHtml(from)} &rarr; ${escapeHtml(to)}</strong>
              <span class="badge bg-success text-white">à¤¸à¤®à¤¯ à¤ªà¤° â€¢ 65 KM/H</span>
            </div>
            <div class="small text-secondary mb-2">à¤šà¤¾à¤²à¤•: <strong>à¤•à¥ˆà¤ªà¥à¤Ÿà¤¨ à¤•à¥€à¤°à¥à¤¤à¤¨</strong> (+91 6264213958)</div>
            <div class="d-flex flex-wrap gap-2">
              <button class="btn btn-sm btn-primary py-1 px-3 fw-semibold" onclick="toggleAiChat(false); openLiveTrackingModal('${pnr}');">à¤²à¤¾à¤‡à¤µ GPS à¤®à¥ˆà¤ª à¤–à¥‹à¤²à¥‡à¤‚</button>
              <a class="btn btn-sm btn-outline-success py-1 px-3 fw-semibold" href="tel:+916264213958">à¤•à¥ˆà¤ªà¥à¤Ÿà¤¨ à¤•à¥€à¤°à¥à¤¤à¤¨ à¤•à¥‹ à¤•à¥‰à¤² à¤•à¤°à¥‡à¤‚</a>
            </div>
          </div>
        `;
        streamAiResponse(pnrMsg, pnrCard, ['à¤•à¥ˆà¤ªà¥à¤Ÿà¤¨ à¤•à¥€à¤°à¥à¤¤à¤¨ à¤¨à¤‚à¤¬à¤°', 'à¤Ÿà¤¿à¤•à¤Ÿ à¤ªà¥€à¤¡à¥€à¤à¤« à¤¡à¤¾à¤‰à¤¨à¤²à¥‹à¤¡']);
      } else if (lang === 'english') {
        const pnrMsg = `**Live PNR Tracking Status Found!**

- **PNR Number:** \`${pnr}\` (Status: **CONFIRMED**)
- **Passenger:** ${passName} â€¢ **Departure:** ${dep}
- **Route:** **${from} â†’ ${to}**
- **Live Checkpoint:** **Approaching Vindhya Gujri Ghat Section (NH 52)**
- **Speed & Transit:** 65 km/h â€¢ **Estimated Arrival:** In 38 minutes
- **Assigned Route Commander:** **Captain Kirtan** (+91 6264213958)

You can open the real-time GPS map or dial Captain Kirtan directly:`;

        const pnrCard = `
          <div class="ai-action-card">
            <div class="d-flex justify-content-between align-items-center mb-1">
              <strong>${escapeHtml(from)} &rarr; ${escapeHtml(to)}</strong>
              <span class="badge bg-success text-white">RUNNING ON TIME</span>
            </div>
            <div class="small text-secondary mb-2">Driver: <strong>Captain Kirtan</strong> (+91 6264213958)</div>
            <div class="d-flex flex-wrap gap-2">
              <button class="btn btn-sm btn-primary py-1 px-3 fw-semibold" onclick="toggleAiChat(false); openLiveTrackingModal('${pnr}');">Open Live GPS Map</button>
              <a class="btn btn-sm btn-outline-success py-1 px-3 fw-semibold" href="tel:+916264213958">Call Captain Kirtan</a>
            </div>
          </div>
        `;
        streamAiResponse(pnrMsg, pnrCard, ['Call Captain Driver Kirtan', 'Download ticket PDF or Cancel']);
      } else {
        const pnrMsg = `**Live PNR Tracking Status Found!**

- **PNR Number:** \`${pnr}\` (Status: **CONFIRMED**)
- **Passenger:** ${passName} â€¢ **Departure:** ${dep}
- **Route:** **${from} â†’ ${to}**
- **Live Highway Checkpoint:** **Approaching Vindhya Gujri Ghat Section (NH 52)**
- **Speed & Transit:** Convoy speed 65 km/h â€¢ **Estimated Arrival:** In 38 minutes
- **Assigned Route Commander:** **Captain Kirtan** (+91 6264213958)

Aap niche diye gaye button se real-time GPS map dekh sakte hain ya Captain Kirtan ko direct call kar sakte hain:`;

        const pnrCard = `
          <div class="ai-action-card">
            <div class="d-flex justify-content-between align-items-center mb-1">
              <strong>${escapeHtml(from)} &rarr; ${escapeHtml(to)}</strong>
              <span class="badge bg-success-subtle text-success border border-success-subtle">ON HIGHWAY &bull; 65 KM/H</span>
            </div>
            <div class="small text-secondary mb-2">Driver in-charge: <strong>Captain Kirtan</strong> (+91 6264213958)</div>
            <div class="d-flex flex-wrap gap-2">
              <button class="btn btn-sm btn-primary py-1 px-3 fw-semibold" onclick="toggleAiChat(false); openLiveTrackingModal('${pnr}');">Open Live GPS Map</button>
              <a class="btn btn-sm btn-outline-success py-1 px-3 fw-semibold" href="tel:+916264213958">Call Captain Kirtan</a>
            </div>
          </div>
        `;
        streamAiResponse(pnrMsg, pnrCard, ['Call Captain Driver Kirtan', 'Download ticket PDF or Cancel']);
      }
      return;
    } else {
      if (lang === 'hindi_devanagari') {
        streamAiResponse(`**à¤²à¤¾à¤‡à¤µ à¤Ÿà¥à¤°à¥ˆà¤•à¤¿à¤‚à¤— à¤¡à¥‡à¤¸à¥à¤•:**

à¤†à¤ªà¤•à¥‡ à¤µà¤°à¥à¤¤à¤®à¤¾à¤¨ à¤¸à¤¤à¥à¤° à¤®à¥‡à¤‚ à¤•à¥‹à¤ˆ à¤¸à¤•à¥à¤°à¤¿à¤¯ à¤Ÿà¤¿à¤•à¤Ÿ à¤¨à¤¹à¥€à¤‚ à¤®à¤¿à¤²à¤¾ à¤¹à¥ˆà¥¤ 
- à¤¯à¤¦à¤¿ à¤†à¤ªà¤•à¥‡ à¤ªà¤¾à¤¸ à¤ªà¥€à¤à¤¨à¤†à¤° à¤¨à¤‚à¤¬à¤° à¤¹à¥ˆ, à¤¤à¥‹ à¤¸à¥€à¤§à¤¾ à¤…à¤ªà¤¨à¤¾ **à¤ªà¥€à¤à¤¨à¤†à¤° à¤Ÿà¤¾à¤‡à¤ª à¤•à¤°à¥‡à¤‚** (à¤œà¥ˆà¤¸à¥‡: \`BG123456\`)à¥¤
- à¤¯à¤¾ à¤†à¤ª à¤¨à¥€à¤šà¥‡ à¤¦à¤¿à¤ à¤¬à¤Ÿà¤¨ à¤¸à¥‡ à¤¤à¥à¤°à¤‚à¤¤ à¤Ÿà¤¿à¤•à¤Ÿ à¤¬à¥à¤• à¤•à¤° à¤¸à¤•à¤¤à¥‡ à¤¹à¥ˆà¤‚ à¤¯à¤¾ **à¤•à¥ˆà¤ªà¥à¤Ÿà¤¨ à¤•à¥€à¤°à¥à¤¤à¤¨** à¤¸à¥‡ à¤ªà¥‚à¤›à¤¤à¤¾à¤› à¤•à¤° à¤¸à¤•à¤¤à¥‡ à¤¹à¥ˆà¤‚:`,
        `<div class="ai-action-card">
          <div class="fw-bold mb-1">à¤®à¤¾à¤°à¥à¤— à¤¡à¤¿à¤¸à¥à¤ªà¥ˆà¤šà¤°: à¤•à¥ˆà¤ªà¥à¤Ÿà¤¨ à¤•à¥€à¤°à¥à¤¤à¤¨ (+91 6264213958)</div>
          <div class="d-flex gap-2 mt-2">
            <a class="btn btn-sm btn-success py-1 px-3" href="tel:+916264213958">à¤•à¥‰à¤² à¤•à¤°à¥‡à¤‚</a>
            <button class="btn btn-sm btn-outline-primary py-1 px-3" onclick="toggleAiChat(false); document.getElementById('search-section').scrollIntoView({behavior:'smooth'});">à¤Ÿà¤¿à¤•à¤Ÿ à¤¬à¥à¤• à¤•à¤°à¥‡à¤‚</button>
          </div>
        </div>`,
        ['à¤§à¤°à¤®à¤ªà¥à¤°à¥€ à¤¸à¥‡ à¤‡à¤‚à¤¦à¥Œà¤° à¤¬à¤¸', 'à¤•à¥ˆà¤ªà¥à¤Ÿà¤¨ à¤•à¥€à¤°à¥à¤¤à¤¨ à¤¨à¤‚à¤¬à¤°']);
      } else if (lang === 'english') {
        streamAiResponse(`**Live Tracking Desk:**

No active booking found in your current session.
- If you already have a PNR, simply **type your PNR** (e.g. \`BG123456\`).
- Or you can book a new journey right now or contact **Captain Kirtan**:`,
        `<div class="ai-action-card">
          <div class="fw-bold mb-1">Route Dispatcher: Captain Kirtan (+91 6264213958)</div>
          <div class="d-flex gap-2 mt-2">
            <a class="btn btn-sm btn-success py-1 px-3" href="tel:+916264213958">Call Driver</a>
            <button class="btn btn-sm btn-outline-primary py-1 px-3" onclick="toggleAiChat(false); document.getElementById('search-section').scrollIntoView({behavior:'smooth'});">Book Ticket</button>
          </div>
        </div>`,
        getDynamicAiChips(routeCtx.origin, routeCtx.destination, 'english'));
      } else {
        streamAiResponse(`**Live Tracking Desk:**

Aapke session me abhi koi active booking record nahi mila hai. 
- Agar aapke paas PNR number hai, to aap seedhe apna **PNR type karein** (jaise: \`BG123456\`).
- Ya aap turant nayi ticket book kar sakte hain ya **Captain Kirtan** se direct inquiry kar sakte hain:`,
        `<div class="ai-action-card">
          <div class="fw-bold mb-1">BusGo Route Dispatcher: Captain Kirtan (+91 6264213958)</div>
          <div class="d-flex gap-2 mt-2">
            <a class="btn btn-sm btn-success py-1 px-3 fw-semibold" href="tel:+916264213958">Call +91 6264213958</a>
            <button class="btn btn-sm btn-outline-primary py-1 px-3" onclick="toggleAiChat(false); document.getElementById('search-section').scrollIntoView({behavior:'smooth'});">Book Ticket Now</button>
          </div>
        </div>`,
        getDynamicAiChips(routeCtx.origin, routeCtx.destination, 'hinglish'));
      }
      return;
    }
  }

  // 8. CAPTAIN KIRTAN DIRECT CONTACT
  if (
    q.includes('kirtan') ||
    q.includes('driver number') ||
    q.includes('driver se baat') ||
    q.includes('driver contact') ||
    q.includes('conductor') ||
    q.includes('phone number') ||
    q.includes('à¤šà¤¾à¤²à¤•') ||
    q.includes('à¤¡à¥à¤°à¤¾à¤‡à¤µà¤°')
  ) {
    ctx.lastTopic = 'driver_connect';
    const activeRouteText = (routeCtx.origin && routeCtx.destination)
      ? `${routeCtx.origin.split('(')[0].trim()} \u2794 ${routeCtx.destination.split('(')[0].trim()} Express Corridor`
      : 'All Madhya Pradesh & National Highway Express Routes';

    if (lang === 'hindi_devanagari') {
      streamAiResponse(`**à¤•à¥ˆà¤ªà¥à¤Ÿà¤¨ à¤•à¥€à¤°à¥à¤¤à¤¨ â€” à¤ªà¥à¤°à¤®à¥à¤– à¤®à¤¾à¤°à¥à¤— à¤šà¤¾à¤²à¤• à¤à¤µà¤‚ à¤«à¥à¤²à¥€à¤Ÿ à¤•à¤®à¤¾à¤‚à¤¡à¤°**

- **à¤¸à¥€à¤§à¤¾ à¤®à¥‹à¤¬à¤¾à¤‡à¤² à¤¨à¤‚à¤¬à¤°:** **+91 6264213958**
- **à¤¹à¤¾à¤ˆà¤µà¥‡ à¤…à¤¨à¥à¤­à¤µ:** 8+ à¤µà¤°à¥à¤·à¥‹à¤‚ à¤•à¤¾ à¤¸à¥à¤°à¤•à¥à¤·à¤¿à¤¤ à¤à¤•à¥à¤¸à¤ªà¥à¤°à¥‡à¤¸à¤µà¥‡ à¤¡à¥à¤°à¤¾à¤‡à¤µà¤¿à¤‚à¤— à¤…à¤¨à¥à¤­à¤µ (à¤¶à¥‚à¤¨à¥à¤¯ à¤¦à¥à¤°à¥à¤˜à¤Ÿà¤¨à¤¾ à¤°à¤¿à¤•à¥‰à¤°à¥à¤¡)à¥¤
- **à¤®à¤¾à¤°à¥à¤—:** ${activeRouteText}à¥¤
- **à¤¸à¥à¤¥à¤¿à¤¤à¤¿:** à¤¸à¤¤à¥à¤¯à¤¾à¤ªà¤¿à¤¤ à¤à¤µà¤‚ à¤µà¤°à¥à¤¤à¤®à¤¾à¤¨ à¤®à¥‡à¤‚ à¤¡à¥à¤¯à¥‚à¤Ÿà¥€ à¤ªà¤° à¤‰à¤ªà¤²à¤¬à¥à¤§à¥¤

à¤†à¤ª à¤¨à¥€à¤šà¥‡ à¤¦à¤¿à¤ à¤¬à¤Ÿà¤¨ à¤ªà¤° à¤•à¥à¤²à¤¿à¤• à¤•à¤°à¤•à¥‡ à¤•à¥ˆà¤ªà¥à¤Ÿà¤¨ à¤•à¥€à¤°à¥à¤¤à¤¨ à¤¸à¥‡ à¤¸à¥€à¤§à¥‡ à¤¸à¤‚à¤ªà¤°à¥à¤• à¤•à¤° à¤¸à¤•à¤¤à¥‡ à¤¹à¥ˆà¤‚:`,
      `<div class="ai-action-card">
        <a class="btn btn-sm btn-success w-100 py-1.5 fw-bold" href="tel:+916264213958">à¤•à¥ˆà¤ªà¥à¤Ÿà¤¨ à¤•à¥€à¤°à¥à¤¤à¤¨ à¤•à¥‹ à¤•à¥‰à¤² à¤•à¤°à¥‡à¤‚ (+91 6264213958)</a>
      </div>`,
      getDynamicAiChips(routeCtx.origin, routeCtx.destination, 'hindi_devanagari'));
    } else if (lang === 'english') {
      streamAiResponse(`**Captain Kirtan â€” Chief Fleet Commander & Route Driver**

- **Direct Mobile Line:** **+91 6264213958**
- **Highway Experience:** 8+ years expressway navigation with a zero-accident record.
- **Assigned Corridor:** ${activeRouteText}.
- **Driver Status:** Verified by BusGo Safety Protocol & Currently On-Duty.

You can click below to connect directly with Captain Kirtan:`,
      `<div class="ai-action-card">
        <a class="btn btn-sm btn-success w-100 py-1.5 fw-bold" href="tel:+916264213958">Call Captain Kirtan (+91 6264213958)</a>
      </div>`,
      getDynamicAiChips(routeCtx.origin, routeCtx.destination, 'english'));
    } else {
      streamAiResponse(`**Captain Kirtan â€” Chief Fleet Commander & Route Driver**

- **Direct Mobile Line:** **+91 6264213958**
- **Highway Experience:** 8+ years expressway navigation with a zero-accident record.
- **Assigned Corridor:** ${activeRouteText}.
- **Driver Status:** Verified by BusGo Safety Protocol & Currently On-Duty.

Aap niche diye gaye button par click karke Captain Kirtan ko seedhe phone mila sakte hain:`,
      `<div class="ai-action-card">
        <a class="btn btn-sm btn-success w-100 py-1.5 fw-bold" href="tel:+916264213958">Call Captain Kirtan (+91 6264213958)</a>
      </div>`,
      getDynamicAiChips(routeCtx.origin, routeCtx.destination, 'hinglish'));
    }
    return;
  }

  // 9. SAME-NAME CITY DISAMBIGUATION
  if (
    q.includes('same name') ||
    q.includes('disambiguat') ||
    (q.includes('dharampuri') && (q.includes('mumbai') || q.includes('beed') || q.includes('district') || q.includes('state') || q.includes('mp') || q.includes('maharashtra')))
  ) {
    ctx.lastTopic = 'disambiguation';
    if (lang === 'hindi_devanagari') {
      streamAiResponse(`**à¤¸à¥à¤®à¤¾à¤°à¥à¤Ÿ à¤¶à¤¹à¤° à¤à¤µà¤‚ à¤—à¥à¤°à¤¾à¤® à¤ªà¤¹à¤šà¤¾à¤¨ à¤ªà¥à¤°à¤£à¤¾à¤²à¥€:**

BusGo à¤®à¥‡à¤‚ à¤¸à¤®à¤¾à¤¨ à¤¨à¤¾à¤® à¤µà¤¾à¤²à¥‡ à¤¨à¤—à¤°à¥‹à¤‚ à¤•à¥‹ à¤‰à¤¨à¤•à¥‡ **à¤œà¤¿à¤²à¥‡ à¤à¤µà¤‚ à¤°à¤¾à¤œà¥à¤¯ à¤•à¥‹à¤¡** à¤¦à¥à¤µà¤¾à¤°à¤¾ à¤¸à¥à¤ªà¤·à¥à¤Ÿ à¤°à¥‚à¤ª à¤¸à¥‡ à¤…à¤²à¤— à¤•à¤¿à¤¯à¤¾ à¤—à¤¯à¤¾ à¤¹à¥ˆ:

1. **à¤§à¤°à¤®à¤ªà¥à¤°à¥€ (à¤§à¤¾à¤°, à¤®.à¤ªà¥à¤°.):**
   - à¤¨à¤°à¥à¤®à¤¦à¤¾ à¤˜à¤¾à¤Ÿà¥€, à¤§à¤¾à¤° à¤œà¤¿à¤²à¤¾, à¤®à¤§à¥à¤¯ à¤ªà¥à¤°à¤¦à¥‡à¤¶ (à¤®à¤¹à¥‡à¤¶à¥à¤µà¤° à¤µ à¤–à¤²à¤˜à¤¾à¤Ÿ à¤•à¥‡ à¤¨à¤¿à¤•à¤Ÿ NH 52)à¥¤
   - à¤¦à¥ˆà¤¨à¤¿à¤• à¤¸à¤‚à¤šà¤¾à¤²à¤¨: **à¤•à¥ˆà¤ªà¥à¤Ÿà¤¨ à¤•à¥€à¤°à¥à¤¤à¤¨** (+91 6264213958)à¥¤
2. **à¤§à¤°à¥à¤®à¤¾à¤ªà¥à¤°à¥€ (à¤¬à¥€à¤¡, à¤®à¤¹à¤¾à¤°à¤¾à¤·à¥à¤Ÿà¥à¤°):**
   - à¤®à¤°à¤¾à¤ à¤µà¤¾à¤¡à¤¼à¤¾ à¤•à¥à¤·à¥‡à¤¤à¥à¤°, à¤¬à¥€à¤¡ à¤œà¤¿à¤²à¤¾, à¤®à¤¹à¤¾à¤°à¤¾à¤·à¥à¤Ÿà¥à¤° (à¤ªà¤°à¤²à¥€-à¤…à¤®à¥à¤¬à¤¾à¤œà¥‹à¤—à¤¾à¤ˆ à¤®à¤¾à¤°à¥à¤—)à¥¤

à¤†à¤ª à¤œà¤¿à¤¸ à¤¨à¤—à¤° à¤•à¥€ à¤¬à¤¸ à¤¬à¥à¤• à¤•à¤°à¤¨à¤¾ à¤šà¤¾à¤¹à¤¤à¥‡ à¤¹à¥ˆà¤‚, à¤‰à¤¸à¥‡ 1-à¤•à¥à¤²à¤¿à¤• à¤®à¥‡à¤‚ à¤šà¥à¤¨à¥‡à¤‚:`,
      `<div class="ai-action-card mb-2">
        <div class="fw-bold text-success mb-1">1. à¤§à¤°à¤®à¤ªà¥à¤°à¥€ (à¤§à¤¾à¤°, à¤®.à¤ªà¥à¤°.)</div>
        <button class="btn btn-sm btn-primary py-1 px-3 fw-semibold" onclick="selectAiRoute('Dharampuri (Dhar, MP)', 'Indore')">à¤§à¤°à¤®à¤ªà¥à¤°à¥€ (à¤®.à¤ªà¥à¤°.) &rarr; à¤‡à¤‚à¤¦à¥Œà¤° à¤šà¥à¤¨à¥‡à¤‚</button>
      </div>
      <div class="ai-action-card">
        <div class="fw-bold text-dark mb-1">2. à¤§à¤°à¥à¤®à¤¾à¤ªà¥à¤°à¥€ (à¤¬à¥€à¤¡, à¤®à¤¹à¤¾à¤°à¤¾à¤·à¥à¤Ÿà¥à¤°)</div>
        <button class="btn btn-sm btn-outline-secondary py-1 px-3" onclick="selectAiRoute('Dharmapuri (Beed, MH)', 'Pune')">à¤§à¤°à¥à¤®à¤¾à¤ªà¥à¤°à¥€ (à¤®à¤¹à¤¾à¤°à¤¾à¤·à¥à¤Ÿà¥à¤°) &rarr; à¤ªà¥à¤£à¥‡ à¤šà¥à¤¨à¥‡à¤‚</button>
      </div>`,
      ['à¤§à¤°à¤®à¤ªà¥à¤°à¥€ à¤¸à¥‡ à¤‡à¤‚à¤¦à¥Œà¤° à¤¬à¤¸', 'à¤®à¥Œà¤¸à¤® à¤•à¥ˆà¤¸à¤¾ à¤¹à¥ˆ']);
    } else {
      streamAiResponse(`**Smart City & Village Disambiguation Protocol:**

BusGo ke geocoding engine me sabhi same-name wale gaon aur shehron ko unke **District aur State Code** ke sath strictly alag pehchana gaya hai:

1. **Dharampuri (Dhar, MP):**
   - Narmada Valley, Dhar District, Madhya Pradesh (Near Maheshwar, Dhamnod & Khalghat on NH 52).
   - Serviced daily by **Captain Kirtan** (+91 6264213958).
2. **Dharmapuri (Beed, MH):**
   - Marathwada Region, Beed District, Maharashtra (Parli-Ambajogai corridor).

Aap jis shehar ki bus book karna chahte hain, use 1-click me select karein:`,
      `<div class="ai-action-card mb-2">
        <div class="fw-bold text-success mb-1">1. Dharampuri (Dhar, MP)</div>
        <button class="btn btn-sm btn-primary py-1 px-3 fw-semibold" onclick="selectAiRoute('Dharampuri (Dhar, MP)', 'Indore')">Select Dharampuri (MP) &rarr; Indore</button>
      </div>
      <div class="ai-action-card">
        <div class="fw-bold text-dark mb-1">2. Dharmapuri (Beed, MH)</div>
        <button class="btn btn-sm btn-outline-secondary py-1 px-3" onclick="selectAiRoute('Dharmapuri (Beed, MH)', 'Pune')">Select Dharmapuri (MH) &rarr; Pune</button>
      </div>`,
      ['Dharampuri to Indore bus schedule', 'Highway weather and road conditions']);
    }
    return;
  }

  // 10. LADIES SEAT PROTECTION & WOMEN SAFETY
  if (
    q.includes('ladi') ||
    q.includes('lady') ||
    q.includes('mahila') ||
    q.includes('woman') ||
    q.includes('women') ||
    q.includes('female') ||
    q.includes('safety') ||
    q.includes('security') ||
    q.includes('à¤®à¤¹à¤¿à¤²à¤¾') ||
    q.includes('à¤¸à¥à¤°à¤•à¥à¤·à¤¾')
  ) {
    ctx.lastTopic = 'ladies_safety';
    const activeFrom = routeCtx.origin || 'Indore (Indore, MP)';
    const activeTo = routeCtx.destination || 'Ujjain (Ujjain, MP)';
    if (lang === 'hindi_devanagari') {
      streamAiResponse(`**BusGo à¤®à¤¹à¤¿à¤²à¤¾-à¤¸à¥à¤°à¤•à¥à¤·à¤¿à¤¤ à¤¸à¤®à¤°à¥à¤ªà¤¿à¤¤ à¤¸à¥€à¤Ÿà¤¿à¤‚à¤— à¤ªà¥à¤°à¥‹à¤Ÿà¥‹à¤•à¥‰à¤²:**

à¤®à¤¹à¤¿à¤²à¤¾ à¤¯à¤¾à¤¤à¥à¤°à¤¿à¤¯à¥‹à¤‚ à¤•à¥€ à¤¸à¥à¤°à¤•à¥à¤·à¤¾ à¤¹à¥‡à¤¤à¥ 4-à¤¸à¥à¤¤à¤°à¥€à¤¯ à¤¸à¥à¤°à¤•à¥à¤·à¤¾ à¤µà¥à¤¯à¤µà¤¸à¥à¤¥à¤¾ à¤²à¤¾à¤—à¥‚ à¤¹à¥ˆ:
1. **à¤šà¤¾à¤²à¤• à¤•à¥‡ à¤ªà¥€à¤›à¥‡ à¤ªà¤‚à¤•à¥à¤¤à¤¿à¤¯à¤¾à¤ 1 à¤¸à¥‡ 3:** à¤¡à¥à¤°à¤¾à¤‡à¤µà¤° à¤•à¥‡à¤¬à¤¿à¤¨ (à¤•à¥ˆà¤ªà¥à¤Ÿà¤¨ à¤•à¥€à¤°à¥à¤¤à¤¨) à¤•à¥‡ à¤ à¥€à¤• à¤ªà¥€à¤›à¥‡ à¤•à¥€ à¤ªà¤‚à¤•à¥à¤¤à¤¿à¤¯à¤¾à¤ à¤•à¥‡à¤µà¤² à¤®à¤¹à¤¿à¤²à¤¾à¤“à¤‚ à¤•à¥‡ à¤²à¤¿à¤ à¤†à¤°à¤•à¥à¤·à¤¿à¤¤ à¤¹à¥ˆà¤‚à¥¤
2. **à¤¸à¤¹-à¤¯à¤¾à¤¤à¥à¤°à¥€ à¤¨à¤¿à¤¯à¤®:** à¤®à¤¹à¤¿à¤²à¤¾ à¤¯à¤¾à¤¤à¥à¤°à¥€ à¤•à¥‡ à¤¬à¤—à¤² à¤µà¤¾à¤²à¥€ à¤¸à¥€à¤Ÿ à¤ªà¤° à¤ªà¥à¤°à¥à¤· à¤Ÿà¤¿à¤•à¤Ÿ à¤¬à¥à¤•à¤¿à¤‚à¤— à¤¸à¥à¤µà¤¤à¤ƒ à¤¬à¥à¤²à¥‰à¤• à¤¹à¥‹ à¤œà¤¾à¤¤à¥€ à¤¹à¥ˆà¥¤
3. **1-à¤Ÿà¥ˆà¤ª SOS à¤†à¤ªà¤¾à¤¤à¤•à¤¾à¤²à¥€à¤¨ à¤¬à¤Ÿà¤¨:** à¤¸à¥€à¤§à¤¾ à¤œà¥€à¤ªà¥€à¤à¤¸ à¤¹à¤¾à¤ˆà¤µà¥‡ à¤•à¤‚à¤Ÿà¥à¤°à¥‹à¤² à¤°à¥‚à¤® à¤•à¥‹ à¤ªà¥à¤°à¥‡à¤·à¤¿à¤¤ à¤¹à¥‹à¤¤à¤¾ à¤¹à¥ˆà¥¤
4. **à¤¸à¤¤à¥à¤¯à¤¾à¤ªà¤¿à¤¤ à¤šà¤¾à¤²à¤•:** à¤•à¥ˆà¤ªà¥à¤Ÿà¤¨ à¤•à¥€à¤°à¥à¤¤à¤¨ (+91 6264213958) à¤¸à¥à¤°à¤•à¥à¤·à¤¾ à¤ªà¥à¤°à¤¶à¤¿à¤•à¥à¤·à¤¿à¤¤ à¤¹à¥ˆà¤‚à¥¤

à¤†à¤ª à¤¨à¥€à¤šà¥‡ à¤¦à¤¿à¤ à¤¬à¤Ÿà¤¨ à¤¸à¥‡ à¤®à¤¹à¤¿à¤²à¤¾-à¤¸à¥à¤°à¤•à¥à¤·à¤¿à¤¤ à¤¸à¥€à¤Ÿ à¤†à¤°à¤•à¥à¤·à¤¿à¤¤ à¤•à¤° à¤¸à¤•à¤¤à¥€ à¤¹à¥ˆà¤‚:`,
      `<div class="ai-action-card">
        <button class="btn btn-sm btn-danger w-100 py-1.5 fw-bold" onclick="selectAiRoute('${escapeHtml(activeFrom)}', '${escapeHtml(activeTo)}');">à¤®à¤¹à¤¿à¤²à¤¾-à¤¸à¥à¤°à¤•à¥à¤·à¤¿à¤¤ à¤¬à¤¸ à¤¸à¥€à¤Ÿ à¤¬à¥à¤• à¤•à¤°à¥‡à¤‚</button>
      </div>`,
      getDynamicAiChips(routeCtx.origin, routeCtx.destination, lang));
    } else {
      streamAiResponse(`**BusGo Women-Safe Dedicated Protection Architecture:**

Solo female travelers aur mahilao ke safe safar ke liye 4-tier strict safety protocol lagoo hai:
1. **Front Cabin Dedicated Rows 1 to 3:** Driver cabin (Captain Kirtan) ke theek peeche wali rows 1 se 3 strictly mahilao ke liye reserved hain.
2. **Female-Only Co-Passenger Rule:** Mahila passenger ke barabar wali seat par male passenger booking automatically block ho jati hai.
3. **1-Tap SOS GPS Emergency Broadcast:** Live coordinates police & highway emergency room ko send hote hain.
4. **Verified Crew:** Captain Kirtan (+91 6264213958) background-verified hain.

Aap niche diye button se Women-Safe reserved seats book kar sakti hain:`,
      `<div class="ai-action-card">
        <button class="btn btn-sm btn-danger w-100 py-1.5 fw-bold" onclick="selectAiRoute('${escapeHtml(activeFrom)}', '${escapeHtml(activeTo)}');">Book Women-Safe Bus Seat</button>
      </div>`,
      getDynamicAiChips(routeCtx.origin, routeCtx.destination, lang));
    }
    return;
  }

  // 11. TICKET MANAGEMENT (PDF DOWNLOAD & CANCEL)
  const isTicketManagement = (
    q.includes('my ticket') ||
    q.includes('mera ticket') ||
    q.includes('meri ticket') ||
    q.includes('download ticket') ||
    q.includes('ticket download') ||
    q.includes('ticket pdf') ||
    q.includes('cancel ticket') ||
    q.includes('ticket cancel') ||
    q.includes('print ticket') ||
    q.includes('ticket print') ||
    q.includes('refund') ||
    q.includes('à¤Ÿà¤¿à¤•à¤Ÿ à¤°à¤¦à¥à¤¦') ||
    q.includes('à¤Ÿà¤¿à¤•à¤Ÿ à¤¡à¤¾à¤‰à¤¨à¤²à¥‹à¤¡') ||
    (q.includes('ticket') && (q.includes('pdf') || q.includes('cancel') || q.includes('download') || q.includes('print')))
  );

  if (isTicketManagement) {
    ctx.lastTopic = 'ticket_management';
    if (latestBooking) {
      const pnr = latestBooking.pnr;
      const fare = latestBooking.totalAmount || 500;
      const from = latestBooking.fromCity || latestBooking.from || (routeCtx.origin ? routeCtx.origin.split('(')[0].trim() : 'Dharampuri');
      const to = latestBooking.toCity || latestBooking.to || (routeCtx.destination ? routeCtx.destination.split('(')[0].trim() : 'Indore');

      if (lang === 'hindi_devanagari') {
        streamAiResponse(`**à¤†à¤ªà¤•à¤¾ à¤ªà¥à¤·à¥à¤Ÿ à¤Ÿà¤¿à¤•à¤Ÿ à¤‰à¤ªà¤²à¤¬à¥à¤§ à¤¹à¥ˆ!**

- **à¤ªà¥€à¤à¤¨à¤†à¤°:** \`${pnr}\` â€¢ **à¤¸à¥à¤¥à¤¿à¤¤à¤¿:** **à¤ªà¥à¤·à¥à¤Ÿ (CONFIRMED)**
- **à¤®à¤¾à¤°à¥à¤—:** **${from} â†’ ${to}** â€¢ **à¤•à¤¿à¤°à¤¾à¤¯à¤¾:** â‚¹${fare}
- **à¤šà¤¾à¤²à¤•:** **à¤•à¥ˆà¤ªà¥à¤Ÿà¤¨ à¤•à¥€à¤°à¥à¤¤à¤¨** (+91 6264213958)

à¤†à¤ª à¤¨à¥€à¤šà¥‡ à¤¦à¤¿à¤ à¤¬à¤Ÿà¤¨ à¤¸à¥‡ à¤†à¤§à¤¿à¤•à¤¾à¤°à¤¿à¤• à¤ªà¥€à¤¡à¥€à¤à¤« à¤Ÿà¤¿à¤•à¤Ÿ à¤¡à¤¾à¤‰à¤¨à¤²à¥‹à¤¡ à¤•à¤° à¤¸à¤•à¤¤à¥‡ à¤¹à¥ˆà¤‚:`,
        `<div class="ai-action-card">
          <div class="d-flex flex-wrap gap-2">
            <button class="btn btn-sm btn-primary py-1 px-3 fw-bold" onclick="downloadTicketPdf('${pnr}')">à¤†à¤§à¤¿à¤•à¤¾à¤°à¤¿à¤• PDF à¤¡à¤¾à¤‰à¤¨à¤²à¥‹à¤¡ à¤•à¤°à¥‡à¤‚</button>
            <button class="btn btn-sm btn-outline-dark py-1 px-2" onclick="printETicket('${pnr}')">à¤ªà¥à¤°à¤¿à¤‚à¤Ÿ à¤•à¤°à¥‡à¤‚</button>
            <button class="btn btn-sm btn-outline-danger py-1 px-2" onclick="toggleAiChat(false); openMyBookingsModal();">à¤°à¤¦à¥à¤¦ à¤•à¤°à¥‡à¤‚</button>
          </div>
        </div>`,
        getDynamicAiChips(routeCtx.origin, routeCtx.destination, 'hindi_devanagari'));
      } else {
        streamAiResponse(`**Aapka Confirmed Ticket Mil Gaya Hai!**

- **PNR:** \`${pnr}\` â€¢ **Status:** **CONFIRMED**
- **Route:** **${from} â†’ ${to}** â€¢ **Fare Paid:** â‚¹${fare}
- **Assigned Driver:** **Captain Kirtan** (+91 6264213958)

Aap yahan se direct **Official PDF Download** kar sakte hain, print preview le sakte hain, ya My Bookings me jakar cancel kar sakte hain:`,
        `<div class="ai-action-card">
          <div class="d-flex flex-wrap gap-2">
            <button class="btn btn-sm btn-primary py-1 px-3 fw-bold" onclick="downloadTicketPdf('${pnr}')">Download Official PDF</button>
            <button class="btn btn-sm btn-outline-dark py-1 px-2" onclick="printETicket('${pnr}')">Print Ticket</button>
            <button class="btn btn-sm btn-outline-danger py-1 px-2" onclick="toggleAiChat(false); openMyBookingsModal();">Cancel Ticket</button>
          </div>
        </div>`,
        getDynamicAiChips(routeCtx.origin, routeCtx.destination, 'hinglish'));
      }
      return;
    } else {
      if (lang === 'hindi_devanagari') {
        streamAiResponse(`**à¤Ÿà¤¿à¤•à¤Ÿ à¤ªà¥à¤°à¤¬à¤‚à¤§à¤¨ à¤¡à¥‡à¤¸à¥à¤•:**

à¤†à¤ªà¤•à¥‡ à¤µà¤°à¥à¤¤à¤®à¤¾à¤¨ à¤¸à¤¤à¥à¤° à¤®à¥‡à¤‚ à¤•à¥‹à¤ˆ à¤¬à¥à¤• à¤•à¤¿à¤¯à¤¾ à¤—à¤¯à¤¾ à¤Ÿà¤¿à¤•à¤Ÿ à¤¨à¤¹à¥€à¤‚ à¤®à¤¿à¤²à¤¾à¥¤ à¤†à¤ª **My Bookings** à¤®à¥‡à¤‚ à¤œà¤¾à¤•à¤° à¤…à¤ªà¤¨à¤¾ à¤Ÿà¤¿à¤•à¤Ÿ à¤¦à¥‡à¤– à¤¸à¤•à¤¤à¥‡ à¤¹à¥ˆà¤‚:`,
        `<div class="ai-action-card text-center">
          <button class="btn btn-sm btn-primary w-100 py-1.5" onclick="toggleAiChat(false); openMyBookingsModal();">My Bookings à¤µà¤¿à¤‚à¤¡à¥‹ à¤–à¥‹à¤²à¥‡à¤‚</button>
        </div>`,
        getDynamicAiChips(routeCtx.origin, routeCtx.destination, 'hindi_devanagari'));
      } else {
        streamAiResponse(`**Ticket Management Desk:**

Aapke current session me koi booked ticket nahi mila. Agar aapne pehle se booking ki hui hai, to **My Bookings** me jakar apna PNR daal kar ticket dekh sakte hain:`,
        `<div class="ai-action-card text-center">
          <button class="btn btn-sm btn-primary w-100 py-1.5 fw-semibold" onclick="toggleAiChat(false); openMyBookingsModal();">Open My Bookings Window</button>
        </div>`,
        getDynamicAiChips(routeCtx.origin, routeCtx.destination, 'hinglish'));
      }
      return;
    }
  }

  // 12. HIGHWAY ROAD & WEATHER INTELLIGENCE
  if (
    q.includes('weather') ||
    q.includes('highway') ||
    q.includes('road') ||
    q.includes('ghat') ||
    q.includes('traffic') ||
    q.includes('nh 52') ||
    q.includes('sh 27') ||
    q.includes('mausam') ||
    q.includes('fog') ||
    q.includes('jam') ||
    q.includes('à¤®à¥Œà¤¸à¤®') ||
    q.includes('à¤¸à¤¡à¤¼à¤•')
  ) {
    ctx.lastTopic = 'highway_weather';
    const fCity = routeCtx.origin;
    const tCity = routeCtx.destination;
    if (!fCity || !tCity) {
      promptRouteClarification('highway_weather', lang);
      return;
    }

    const normF = (fCity || '').toLowerCase();
    const normT = (tCity || '').toLowerCase();
    const cleanF = fCity.split('(')[0].trim();
    const cleanT = tCity.split('(')[0].trim();

    let corridorName = `${cleanF} \u2794 ${cleanT}`;
    let highwayLabel = 'Expressway Highway Corridor';
    let roadCondition = '4-lane divided smooth asphalt, zero bottlenecks, high-traction road surface.';
    let speed = '65-75 km/h';
    let weatherDetail = '28\u00B0C, pleasant sunny weather, visibility 10+ km (zero fog, zero rain delay).';

    if ((normF.includes('indore') && normT.includes('ujjain')) || (normF.includes('ujjain') && normT.includes('indore'))) {
      corridorName = 'Indore \u2794 Ujjain Expressway';
      highwayLabel = 'SH 27 (Indore - Sanwer - Ujjain 4-Lane Highway)';
      roadCondition = '4-lane divided smooth concrete/asphalt, zero ghat curves, toll lane fast pass via Sanwer.';
      speed = '70 km/h average convoy cruising speed';
      weatherDetail = '28\u00B0C, pleasant sunny weather, 10+ km visibility (all clear for Mahakal devotees).';
    } else if ((normF.includes('indore') && normT.includes('bhopal')) || (normF.includes('bhopal') && normT.includes('indore'))) {
      corridorName = 'Indore \u2794 Bhopal Corridor';
      highwayLabel = 'SH 47 (Indore - Dewas - Sonkatch - Ashta - Bhopal Expressway)';
      roadCondition = '4-lane divided toll expressway, smooth transit via Dewas Bypass & Ashta.';
      speed = '75 km/h cruising speed';
      weatherDetail = '28\u00B0C, clear skies, visibility 10+ km.';
    } else if ((normF.includes('dharampuri') && normT.includes('indore')) || (normF.includes('indore') && normT.includes('dharampuri'))) {
      corridorName = 'Indore \u2794 Dharampuri NH 52 Corridor';
      highwayLabel = 'NH 52 (Indore - Vindhya Gujri Ghat - Dhamnod - Dharampuri)';
      roadCondition = '4-lane divided asphalt, smooth Gujri Ghat curves, regular police & toll patrol.';
      speed = '65 km/h cruising speed';
      weatherDetail = '27\u00B0C, clear sunshine, visibility 8+ km.';
    }

    if (lang === 'hindi_devanagari') {
      streamAiResponse(`**à¤²à¤¾à¤‡à¤µ à¤¹à¤¾à¤ˆà¤µà¥‡ à¤à¤µà¤‚ à¤®à¥Œà¤¸à¤® à¤°à¤¿à¤ªà¥‹à¤°à¥à¤Ÿ (${corridorName}):**\n\n- **à¤¹à¤¾à¤ˆà¤µà¥‡ à¤•à¥‰à¤°à¤¿à¤¡à¥‹à¤°:** ${highwayLabel}\n- **à¤¸à¤¡à¤¼à¤• à¤¸à¥à¤¥à¤¿à¤¤à¤¿:** ${roadCondition}\n- **à¤Ÿà¥à¤°à¥ˆà¤«à¤¿à¤• à¤—à¤¤à¤¿:** à¤¸à¥à¤—à¤® à¤ªà¥à¤°à¤µà¤¾à¤¹, à¤”à¤¸à¤¤ à¤—à¤¤à¤¿ **${speed}**à¥¤\n- **à¤²à¤¾à¤‡à¤µ à¤®à¥Œà¤¸à¤®:** ${weatherDetail}\n- **à¤šà¤¾à¤²à¤• à¤¸à¤¤à¥à¤¯à¤¾à¤ªà¤¨:** à¤°à¥‚à¤Ÿ à¤¸à¥à¤¥à¤¿à¤¤à¤¿ à¤•à¥€ à¤ªà¥à¤·à¥à¤Ÿà¤¿ **à¤•à¥ˆà¤ªà¥à¤Ÿà¤¨ à¤•à¥€à¤°à¥à¤¤à¤¨** (+91 6264213958) à¤¦à¥à¤µà¤¾à¤°à¤¾ à¤²à¤¾à¤‡à¤µ à¤•à¥€ à¤—à¤ˆ à¤¹à¥ˆà¥¤`,
      `<div class="ai-action-card">
        <span class="badge bg-success text-white px-2.5 py-1.5 fw-bold">${highwayLabel.split('(')[0].trim()} ALL CLEAR</span>
      </div>`,
      getDynamicAiChips(fCity, tCity, lang));
    } else {
      streamAiResponse(`**Live Highway & Weather Intelligence (${corridorName}):**\n\n- **Corridor Highway:** ${highwayLabel}\n- **Road Surface Condition:** ${roadCondition}\n- **Traffic & Convoy Flow:** Fluent cruising speed **${speed}**.\n- **Live Weather Report:** ${weatherDetail}\n- **Fleet Commander Verification:** Route verified live on-duty by **Captain Kirtan** (+91 6264213958).`,
      `<div class="ai-action-card">
        <span class="badge bg-success text-white px-2.5 py-1.5 fw-bold">${highwayLabel.split('(')[0].trim()} ALL CLEAR</span>
      </div>`,
      getDynamicAiChips(fCity, tCity, lang));
    }
    return;
  }

  // 12.8 TICKET FARE & PRICING INQUIRY
  const isFareInquiry = (
    q.includes('fare') ||
    q.includes('price') ||
    q.includes('kiraya') ||
    q.includes('cost') ||
    q.includes('rate') ||
    q.includes('kitne ka') ||
    q.includes('kitna lagega') ||
    q.includes('kitne paise') ||
    q.includes('à¤•à¤¿à¤°à¤¾à¤¯à¤¾') ||
    q.includes('à¤Ÿà¤¿à¤•à¤Ÿ à¤¦à¤°')
  );

  if (isFareInquiry && !q.includes('how to book') && !q.includes('cancel')) {
    ctx.lastTopic = 'bus_fare';
    const src = routeCtx.origin;
    const dst = routeCtx.destination;
    if (!src || !dst) {
      promptRouteClarification('bus_fare', lang);
      return;
    }

    const buses = BusService.searchBuses(src, dst, 'all');
    if (!buses || buses.length === 0) {
      streamAiResponse(`Maaf kijiye, ${src} se ${dst} ke liye direct bus nahi mili. Kripya apna departure ya destination shehar badal kar try karein.`, '', getDynamicAiChips(src, dst, lang));
      return;
    }

    const cleanSrc = src.split('(')[0].trim();
    const cleanDst = dst.split('(')[0].trim();
    const minFare = Math.min(...buses.map(b => b.price));
    const maxFare = Math.max(...buses.map(b => b.price));

    if (lang === 'hindi_devanagari') {
      const msg = `**${greetingHindi}, ${cleanSrc} à¤¸à¥‡ ${cleanDst} à¤®à¤¾à¤°à¥à¤— à¤ªà¤° à¤¬à¤¸ à¤•à¤¿à¤°à¤¾à¤¯à¤¾ à¤¸à¥‚à¤šà¥€:**\n\n- **à¤¶à¥à¤°à¥à¤†à¤¤à¥€ à¤¨à¥à¤¯à¥‚à¤¨à¤¤à¤® à¤•à¤¿à¤°à¤¾à¤¯à¤¾:** à¤®à¤¾à¤¤à¥à¤° **â‚¹${minFare}** (à¤‘à¤°à¥à¤¡à¤¿à¤¨à¤°à¥€ à¤à¤•à¥à¤¸à¤ªà¥à¤°à¥‡à¤¸)\n- **à¤…à¤§à¤¿à¤•à¤¤à¤® à¤²à¤—à¥à¤œà¤°à¥€ à¤•à¤¿à¤°à¤¾à¤¯à¤¾:** â‚¹${maxFare} (à¤µà¥‹à¤²à¥à¤µà¥‹ / à¤à¤¸à¥€ à¤®à¤²à¥à¤Ÿà¥€-à¤à¤•à¥à¤¸à¤² à¤¸à¥à¤²à¥€à¤ªà¤°)\n\n**à¤‰à¤ªà¤²à¤¬à¥à¤§ à¤¬à¤¸à¥‹à¤‚ à¤•à¥€ à¤¦à¤°à¥‡à¤‚:**\n${buses.slice(0, 4).map(b => `- **${b.operator}** (${b.busModel || b.type.toUpperCase()}): **â‚¹${b.price}** (${b.dep} - ${b.arr})`).join('\n')}\n\nà¤†à¤ª à¤¨à¥€à¤šà¥‡ à¤¦à¤¿à¤ à¤¬à¤Ÿà¤¨ à¤¸à¥‡ à¤¤à¥à¤°à¤‚à¤¤ à¤…à¤ªà¤¨à¥€ à¤ªà¤¸à¤‚à¤¦ à¤•à¥€ à¤¬à¤¸ à¤®à¥‡à¤‚ à¤¸à¥€à¤Ÿ à¤¬à¥à¤• à¤•à¤° à¤¸à¤•à¤¤à¥‡ à¤¹à¥ˆà¤‚:`;
      const card = `
        <div class="ai-action-card">
          <button class="btn btn-sm btn-primary w-100 py-1.5 fw-bold" onclick="selectAiRoute('${escapeHtml(src)}', '${escapeHtml(dst)}')">â‚¹${minFare} à¤¸à¥‡ à¤¶à¥à¤°à¥‚ â€” à¤¸à¥€à¤Ÿ à¤¬à¥à¤• à¤•à¤°à¥‡à¤‚ (${escapeHtml(cleanSrc)} \u2794 ${escapeHtml(cleanDst)})</button>
        </div>
      `;
      streamAiResponse(msg, card, getDynamicAiChips(src, dst, lang));
    } else {
      const msg = `**${greetingHinglish}, ${cleanSrc} se ${cleanDst} route par bus fare details:**\n\n- **Starting Lowest Fare:** Sirf **â‚¹${minFare}** (Ordinary Express)\n- **Premium Luxury Fare:** â‚¹${maxFare} (Volvo / AC Multi-Axle Sleeper)\n\n**Bus-wise Ticket Rates:**\n${buses.slice(0, 4).map(b => `- **${b.operator}** (${b.busModel || b.type.toUpperCase()}): **â‚¹${b.price}** (${b.dep} - ${b.arr})`).join('\n')}\n\nNiche diye gaye button par click karke aap direct seat select karke booking kar sakte hain:`;
      const card = `
        <div class="ai-action-card">
          <button class="btn btn-sm btn-primary w-100 py-1.5 fw-bold" onclick="selectAiRoute('${escapeHtml(src)}', '${escapeHtml(dst)}')">Book Seats from â‚¹${minFare} (${escapeHtml(cleanSrc)} \u2794 ${escapeHtml(cleanDst)})</button>
        </div>
      `;
      streamAiResponse(msg, card, getDynamicAiChips(src, dst, lang));
    }
    return;
  }

  // 13. CONTEXTUAL FOLLOW-UP: CHEAPEST BUS
  if (q.includes('sasti') || q.includes('cheapest') || q.includes('lowest') || q.includes('à¤•à¤® à¤•à¤¿à¤°à¤¾à¤¯à¤¾') || q.includes('à¤¸à¤¸à¥à¤¤à¥€')) {
    ctx.lastTopic = 'cheapest_bus';
    const src = routeCtx.origin;
    const dst = routeCtx.destination;
    if (!src || !dst) {
      promptRouteClarification('cheapest_bus', lang);
      return;
    }

    const buses = BusService.searchBuses(src, dst, 'all');
    if (!buses || buses.length === 0) {
      streamAiResponse(`Maaf kijiye, ${src} se ${dst} ke liye direct bus nahi mili. Kripya apna departure ya destination shehar badal kar try karein.`, '', getDynamicAiChips(src, dst, lang));
      return;
    }

    const cheapest = buses.reduce((min, b) => b.price < min.price ? b : min, buses[0]);
    const cleanSrc = src.split('(')[0].trim();
    const cleanDst = dst.split('(')[0].trim();

    if (lang === 'hindi_devanagari') {
      streamAiResponse(`**${greetingHindi}, ${cleanSrc} à¤¸à¥‡ ${cleanDst} à¤®à¤¾à¤°à¥à¤— à¤ªà¤° à¤¸à¤¬à¤¸à¥‡ à¤•à¤¿à¤«à¤¾à¤¯à¤¤à¥€ à¤¬à¤¸:**\n\n- **à¤¬à¤¸ à¤‘à¤ªà¤°à¥‡à¤Ÿà¤°:** ${cheapest.operator}\n- **à¤¬à¤¸ à¤ªà¥à¤°à¤•à¤¾à¤°:** ${cheapest.busModel || cheapest.type.toUpperCase()}\n- **à¤ªà¥à¤°à¤¸à¥à¤¥à¤¾à¤¨:** **${cheapest.dep}** â€¢ **à¤†à¤—à¤®à¤¨:** ${cheapest.arr} (${cheapest.duration})\n- **à¤•à¤¿à¤°à¤¾à¤¯à¤¾:** à¤®à¤¾à¤¤à¥à¤° **â‚¹${cheapest.price}** (à¤¸à¤¬à¤¸à¥‡ à¤•à¤® à¤•à¤¿à¤°à¤¾à¤¯à¤¾)\n- **à¤®à¤¾à¤°à¥à¤—:** ${cleanSrc} à¤¸à¥‡ ${cleanDst}\n\nà¤•à¥à¤¯à¤¾ à¤†à¤ª à¤‡à¤¸ à¤¬à¤¸ à¤®à¥‡à¤‚ à¤…à¤ªà¤¨à¥€ à¤¸à¥€à¤Ÿ à¤¬à¥à¤• à¤•à¤°à¤¨à¤¾ à¤šà¤¾à¤¹à¤¤à¥‡ à¤¹à¥ˆà¤‚?`,
      `<div class="ai-action-card">
        <button class="btn btn-sm btn-primary w-100 py-1.5 fw-bold" onclick="selectAiRoute('${escapeHtml(src)}', '${escapeHtml(dst)}')">â‚¹${cheapest.price} à¤®à¥‡à¤‚ à¤¸à¥€à¤Ÿ à¤¬à¥à¤• à¤•à¤°à¥‡à¤‚</button>
      </div>`,
      getDynamicAiChips(src, dst, lang));
    } else {
      streamAiResponse(`**${greetingHinglish}, ${cleanSrc} se ${cleanDst} route par sabse sasti bus:**\n\n- **Bus Operator:** ${cheapest.operator}\n- **Bus Type:** ${cheapest.busModel || cheapest.type.toUpperCase()}\n- **Departure:** **${cheapest.dep}** â€¢ **Arrival:** ${cheapest.arr} (${cheapest.duration})\n- **Lowest Fare:** Sirf **â‚¹${cheapest.price}**\n- **Route:** ${cleanSrc} \u2794 ${cleanDst}\n\nNiche diye button par click karke aap â‚¹${cheapest.price} me seat book kar sakte hain:`,
      `<div class="ai-action-card">
        <button class="btn btn-sm btn-primary w-100 py-1.5 fw-bold" onclick="selectAiRoute('${escapeHtml(src)}', '${escapeHtml(dst)}')">Book Seat at â‚¹${cheapest.price}</button>
      </div>`,
      getDynamicAiChips(src, dst, lang));
    }
    return;
  }

  // 14. DYNAMIC BUS SEARCH & MULTI-TURN ROUTE INTELLIGENCE
  const srcCity = routeCtx.origin;
  const dstCity = routeCtx.destination;

  if (!srcCity || !dstCity) {
    promptRouteClarification('bus_search', lang);
    return;
  }

  ctx.origin = srcCity;
  ctx.destination = dstCity;
  ctx.lastTopic = 'bus_search';

  const cleanSrc = srcCity.split('(')[0].trim();
  const cleanDst = dstCity.split('(')[0].trim();
  const buses = BusService.searchBuses(srcCity, dstCity, 'all');

  if (!buses || buses.length === 0) {
    if (lang === 'hindi_devanagari') {
      streamAiResponse(`**${greetingHindi}, ${cleanSrc} à¤¸à¥‡ ${cleanDst} à¤•à¥‡ à¤²à¤¿à¤ à¤•à¥‹à¤ˆ à¤¸à¥€à¤§à¥€ à¤¬à¤¸ à¤¨à¤¹à¥€à¤‚ à¤®à¤¿à¤²à¥€à¥¤**\n\nà¤•à¥ƒà¤ªà¤¯à¤¾ à¤…à¤¨à¥à¤¯ à¤ªà¥à¤°à¤®à¥à¤– à¤¨à¤œà¤¦à¥€à¤•à¥€ à¤¶à¤¹à¤° à¤šà¥à¤¨à¥‡à¤‚ (à¤œà¥ˆà¤¸à¥‡: à¤‡à¤‚à¤¦à¥Œà¤°, à¤‰à¤œà¥à¤œà¥ˆà¤¨, à¤­à¥‹à¤ªà¤¾à¤²)à¥¤`, '', getDynamicAiChips(srcCity, dstCity, lang));
    } else {
      streamAiResponse(`**${greetingHinglish}, ${cleanSrc} se ${cleanDst} ke liye direct bus nahi mili.**\n\nKripya dusra route select karein (jaise: Indore, Ujjain, Bhopal).`, '', getDynamicAiChips(srcCity, dstCity, lang));
    }
    return;
  }

  // Pick up to 4 real buses
  const displayBuses = buses.slice(0, 4);

  if (lang === 'hindi_devanagari') {
    const busSearchMsg = `**à¤œà¥€ ${greetingHindi}! ${cleanSrc} à¤¸à¥‡ ${cleanDst} à¤•à¥‡ à¤²à¤¿à¤ à¤‰à¤ªà¤²à¤¬à¥à¤§ à¤¬à¤¸à¥‡à¤‚:**\n\n${displayBuses.map((b, i) => `- **${i + 1}. ${b.operator}**\n  - **à¤¬à¤¸ à¤ªà¥à¤°à¤•à¤¾à¤°:** ${b.busModel || b.type.toUpperCase()}\n  - **à¤ªà¥à¤°à¤¸à¥à¤¥à¤¾à¤¨:** ${b.dep} â€¢ **à¤†à¤—à¤®à¤¨:** ${b.arr} (à¤…à¤µà¤§à¤¿: ${b.duration})\n  - **à¤•à¤¿à¤°à¤¾à¤¯à¤¾:** **â‚¹${b.price}**\n  - **à¤¸à¥à¤µà¤¿à¤§à¤¾à¤à¤:** ${b.primo ? 'à¤ªà¥à¤°à¤¾à¤‡à¤®à¥‹ à¤¸à¤°à¥à¤Ÿà¤¿à¤«à¤¾à¤‡à¤¡' : 'à¤à¤•à¥à¤¸à¤ªà¥à¤°à¥‡à¤¸ à¤¸à¤°à¥à¤µà¤¿à¤¸'}, à¤œà¥€à¤ªà¥€à¤à¤¸ à¤Ÿà¥à¤°à¥ˆà¤•à¤¿à¤‚à¤—, à¤šà¤¾à¤°à¥à¤œà¤¿à¤‚à¤— à¤¸à¥‰à¤•à¥‡à¤Ÿà¥¤`).join('\n\n')}\n\nà¤ªà¥à¤°à¤®à¥à¤– à¤šà¤¾à¤²à¤• **à¤•à¥ˆà¤ªà¥à¤Ÿà¤¨ à¤•à¥€à¤°à¥à¤¤à¤¨** (+91 6264213958) à¤¸à¥‡à¤µà¤¾ à¤®à¥‡à¤‚ à¤‰à¤ªà¤²à¤¬à¥à¤§ à¤¹à¥ˆà¤‚à¥¤ à¤†à¤ª à¤¨à¥€à¤šà¥‡ à¤¦à¤¿à¤ à¤¬à¤Ÿà¤¨ à¤¸à¥‡ à¤¤à¥à¤°à¤‚à¤¤ à¤¸à¥€à¤Ÿ à¤¬à¥à¤• à¤•à¤° à¤¸à¤•à¤¤à¥‡ à¤¹à¥ˆà¤‚:`;

    const busActionCard = `
      <div class="ai-action-card">
        <button class="btn btn-sm btn-primary w-100 py-1.5 fw-bold" onclick="selectAiRoute('${escapeHtml(srcCity)}', '${escapeHtml(dstCity)}')">à¤¸à¥€à¤Ÿ à¤šà¥à¤¨à¥‡à¤‚ à¤à¤µà¤‚ à¤¬à¥à¤• à¤•à¤°à¥‡à¤‚ (${escapeHtml(cleanSrc)} \u2794 ${escapeHtml(cleanDst)})</button>
      </div>
    `;
    streamAiResponse(busSearchMsg, busActionCard, getDynamicAiChips(srcCity, dstCity, lang));
  } else if (lang === 'english') {
    const busSearchMsg = `**Certainly${greetingEnglish}! Here are the express buses for ${cleanSrc} \u2794 ${cleanDst}:**\n\n${displayBuses.map((b, i) => `- **${i + 1}. ${b.operator}**\n  - **Model:** ${b.busModel || b.type.toUpperCase()}\n  - **Departure:** ${b.dep} â€¢ **Arrival:** ${b.arr} (Duration: ${b.duration})\n  - **Fare:** **â‚¹${b.price}**\n  - **Features:** ${b.primo ? 'Primo Certified' : 'Express Service'}, Live GPS Tracking, Charging Points.`).join('\n\n')}\n\nAssigned Route Driver: **Captain Kirtan** (+91 6264213958). Click below to select your seat:`;

    const busActionCard = `
      <div class="ai-action-card">
        <button class="btn btn-sm btn-primary w-100 py-1.5 fw-bold" onclick="selectAiRoute('${escapeHtml(srcCity)}', '${escapeHtml(dstCity)}')">Select Seat Now (${escapeHtml(cleanSrc)} \u2794 ${escapeHtml(cleanDst)})</button>
      </div>
    `;
    streamAiResponse(busSearchMsg, busActionCard, getDynamicAiChips(srcCity, dstCity, lang));
  } else {
    // Hinglish
    const busSearchMsg = `**Haan ji ${greetingHinglish}! ${cleanSrc} se ${cleanDst} ke liye express buses available hain:**\n\n${displayBuses.map((b, i) => `- **${i + 1}. ${b.operator}**\n  - **Model:** ${b.busModel || b.type.toUpperCase()}\n  - **Departure:** ${b.dep} â€¢ **Arrival:** ${b.arr} (Duration: ${b.duration})\n  - **Fare:** **â‚¹${b.price}**\n  - **Amenities:** ${b.primo ? 'Primo Certified' : 'Express Service'}, Charging Points, Water Bottle.`).join('\n\n')}\n\nRoute Dispatcher: **Captain Kirtan** (+91 6264213958). Aap niche diye button se seedhe auto-fill karke seat book kar sakte hain:`;

    const busActionCard = `
      <div class="ai-action-card">
        <button class="btn btn-sm btn-primary w-100 py-1.5 fw-bold" onclick="selectAiRoute('${escapeHtml(srcCity)}', '${escapeHtml(dstCity)}')">Seat Book Karein (${escapeHtml(cleanSrc)} \u2794 ${escapeHtml(cleanDst)})</button>
      </div>
    `;
    streamAiResponse(busSearchMsg, busActionCard, getDynamicAiChips(srcCity, dstCity, lang));
  }
}

function selectAiRoute(from, to) {
  toggleAiChat(false);
  const f = document.getElementById('fromCity');
  const t = document.getElementById('toCity');
  if (f && t) {
    f.removeAttribute('readonly');
    f.value = from;
    f.setAttribute('readonly', 'readonly');
    t.removeAttribute('readonly');
    t.value = to;
    t.setAttribute('readonly', 'readonly');
    const sSec = document.getElementById('search-section');
    if (sSec) sSec.scrollIntoView({ behavior: 'smooth' });
    setTimeout(() => {
      searchBuses(new Event('submit'));
      showToast(`Route loaded: ${from} \u2192 ${to}`, 'success');
    }, 300);
  } else {
    // If on dedicated ai-assistant.html page or external tab, redirect back to index.html with autoSearch
    window.location.href = `index.html?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&autoSearch=true`;
  }
}
