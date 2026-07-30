// =====================================================================
// TELEGRAM BOT — Cloudflare Worker (Full Featured)
// =====================================================================
// ENV змінна в Cloudflare Worker (Settings → Variables):
//   BOT_TOKEN      — токен вашого бота від @BotFather (обов'язково)
//   GROQ_API_KEY   — ключ Groq API (обов'язково)
//   WEBHOOK_SECRET — (опційно) секретний токен для перевірки вебхука
// =====================================================================

const ADMIN_ID = 8382236562;

// --- Платна група (за потреби) ---------------------------------------
const PAID_GROUP_CHAT_ID = 0; // Наприклад: -100123456789
const PAID_GROUP_STARS_PRICE = 3284; // Ціна в Telegram Stars

function isPaidGroup(chatId) {
  return chatId === PAID_GROUP_CHAT_ID;
}

// --- Дефолтні тексти -------------------------------------------------
const RULES_TEXT_DEFAULT =
  `ᴘᴇᴋʌᴀᴍᴀ / пᴏʌіᴛиᴋᴀ - зᴀбᴏᴘᴏнᴇні.\n\nᴀᴘхіʙ ᴄᴛᴘуᴋᴛуᴘᴏʙᴀних ᴍᴀᴛᴇᴘіᴀʌіʌіʙ`;

const COMMAND_REPLIES = {
  invite: `🔓Апрув`,
  welcome: `🤬 ᴏнбᴏᴘдинг`,
  rules: `⚠️ пᴘᴀʙиʌᴀ\n\n${RULES_TEXT_DEFAULT}`
};

// Стартовий текст для привату
const START_PUSH_TEXT =
  `⊹ ᴋᴀᴛᴀй дʌя ᴀɪ ᴀуᴛпуᴛу\n\n` +
  `⊹ юзᴀй / дʌя зᴀᴄᴇᴛᴀпу ᴄпіʌьнᴏᴛи\n` +
  `⊹ ᴏᴛᴘиᴍуй ᴘᴇᴀᴋції нᴀ ?`;

// --- Динамічний кеш налаштувань груп ----------------------------------
const groupWelcomeCache = new Map(); 
const groupRulesCache = new Map();   

function getWelcomeText(chatId) {
  return groupWelcomeCache.get(chatId) || COMMAND_REPLIES.welcome;
}

function getRulesText(chatId) {
  return groupRulesCache.get(chatId) || RULES_TEXT_DEFAULT;
}

// --- ІІ & Реакції -----------------------------------------------------
const SYSTEM_PROMPT =
  `Відповідай виключно українською мовою, просунутою грамотною лексикою. ` +
  `Формат відповіді: рівно 2 короткі конструктивні речення, і одразу після них — ` +
  `один доречний за контекстом емодзі. Без зайвого преамбулу.`;

const REACTION_EMOJIS = [
  '👍', '❤️', '🔥', '🥰', '👏', '😁', '🎉', '🤩',
  '🙏', '👌', '😍', '💯', '🤝', '😢', '🤣', '⚡'
];

const allowedReactionsCache = new Map();
const REACTIONS_CACHE_TTL_MS = 30 * 60 * 1000;

async function getAllowedReactions(chatId, env) {
  const cached = allowedReactionsCache.get(chatId);
  if (cached && Date.now() - cached.fetchedAt < REACTIONS_CACHE_TTL_MS) {
    return cached.emojis;
  }

  const res = await tg(env.BOT_TOKEN, 'getChat', { chat_id: chatId });
  const ar = res?.result?.available_reactions;

  let emojis;
  if (ar === undefined) {
    emojis = REACTION_EMOJIS;
  } else if (Array.isArray(ar) && ar.length === 0) {
    emojis = [];
  } else {
    const groupEmojis = ar.filter(r => r.type === 'emoji').map(r => r.emoji);
    const intersection = REACTION_EMOJIS.filter(e => groupEmojis.includes(e));
    emojis = intersection.length ? intersection : groupEmojis;
  }

  allowedReactionsCache.set(chatId, { emojis, fetchedAt: Date.now() });
  return emojis;
}

// =====================================================================
// ЗАПОБІЖНИКИ І КЕШ
// =====================================================================
const seenUpdateIds = new Map();
const lastAiCallByUser = new Map();

function cleanupOldEntries(map, ttlMs) {
  const now = Date.now();
  if (map.size < 2000) return;
  for (const [key, ts] of map) {
    if (now - ts > ttlMs) map.delete(key);
  }
}

function isDuplicateUpdate(updateId) {
  if (updateId == null) return false;
  cleanupOldEntries(seenUpdateIds, 5 * 60 * 1000);
  if (seenUpdateIds.has(updateId)) return true;
  seenUpdateIds.set(updateId, Date.now());
  return false;
}

function isAiOnCooldown(userId) {
  cleanupOldEntries(lastAiCallByUser, 4000);
  const last = lastAiCallByUser.get(userId);
  const now = Date.now();
  if (last && now - last < 4000) return true;
  lastAiCallByUser.set(userId, now);
  return false;
}

// =====================================================================
// TELEGRAM API HELPER
// =====================================================================
async function tg(token, method, body, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    const data = await res.json();
    if (!data.ok) console.error(`[TG] ${method} failed:`, JSON.stringify(data));
    return data;
  } catch (e) {
    console.error(`[TG] ${method} error:`, e.message);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// =====================================================================
// GROQ AI
// =====================================================================
async function getGroqReply(userMessage, apiKey) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.7,
        max_tokens: 150
      }),
      signal: controller.signal
    });
    if (!res.ok) return 'спробуйте попізніше 🫩';
    const data = await res.json();
    return data.choices?.[0]?.message?.content || 'не вдалося отримати відповідь 🫩';
  } catch (e) {
    console.error('[GROQ] error:', e.message);
    return 'спробуйте попізніше 🫩';
  } finally {
    clearTimeout(timer);
  }
}

// =====================================================================
// ОБРОБКА ПЕРЕХОДУ ПО ПОСИЛАННЮ (ЗАЯВКА НА ВСТУП)
// =====================================================================
async function handleJoinRequest(req, env) {
  const { BOT_TOKEN } = env;
  const userId = req.from.id;
  const chatId = req.chat.id;

  console.log(`[JOIN] chat_join_request: chat_id=${chatId} user_id=${userId}`);

  // 1. НАДСИЛАЄМО ПРИВАТНЕ СМС КОРИСТУВАЧЕВІ В ЛС
  const privateWelcomeMessage = 
    `👋 **Вітаємо!**\n\n` +
    `Дякуємо за перехід за посиланням. Твою заявку на вступ до групи прийнято!\n\n` +
    `${START_PUSH_TEXT}`;

  try {
    await tg(BOT_TOKEN, 'sendMessage', {
      chat_id: userId,
      text: privateWelcomeMessage,
      parse_mode: 'Markdown'
    });
  } catch (e) {
    console.error(`[JOIN] Не вдалося надіслати ЛС користувачу ${userId}:`, e.message);
  }

  // 2. Безкоштовна група -> автоматичне схвалення заявки
  if (!isPaidGroup(chatId)) {
    await tg(BOT_TOKEN, 'approveChatJoinRequest', { chat_id: chatId, user_id: userId });

    // Повідомлення в саму групу про нового учасника
    const welcomeText = getWelcomeText(chatId);
    const name = req.from.first_name || 'користувач';
    const userMention = `[${name}](tg://user?id=${userId})`;

    await tg(BOT_TOKEN, 'sendMessage', {
      chat_id: chatId,
      text: `Вітаємо, ${userMention}!\n\n${welcomeText}`,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[{ text: 'пᴘᴀʙиʌᴀ', callback_data: 'show_rules' }]]
      }
    });
    return;
  }

  // 3. Платна група -> надсилання інвойсу
  const payload = `join_${chatId}_${userId}`;
  await tg(BOT_TOKEN, 'sendInvoice', {
    chat_id: userId,
    title: 'Вступ до групи',
    description: `Оплата дає доступ до заявки на вступ.`,
    payload,
    currency: 'XTR',
    prices: [{ label: 'Доступ до групи', amount: PAID_GROUP_STARS_PRICE }]
  });
}

// =====================================================================
// КОМАНДИ І КНОПКА "ДОДАТИ В ГРУПУ"
// =====================================================================
let cachedBotUsername = null;
async function getBotUsername(env) {
  if (cachedBotUsername) return cachedBotUsername;
  const res = await tg(env.BOT_TOKEN, 'getMe', {});
  cachedBotUsername = res?.result?.username || null;
  return cachedBotUsername;
}

function isGroupChatType(chatType) {
  return chatType === 'group' || chatType === 'supergroup';
}

// Універсальна кнопка для додавання бота
async function getAddBotKeyboard(env) {
  const username = await getBotUsername(env);
  return username
    ? { inline_keyboard: [[{ text: '➕ Додати бота в групу', url: `https://t.me/${username}?startgroup=start` }]] }
    : undefined;
}

async function handleInviteCommand(msg, env) {
  const isGroup = isGroupChatType(msg.chat.type);
  const keyboard = await getAddBotKeyboard(env);

  if (!isGroup) {
    // ЯКЩО КОМАНДА /invite ВИКЛИКАНА В ОСОБИСТИХ (В ЛС)
    const text = 
      `🤖 **Додавання бота в групу**\n\n` +
      `Щоб додати бота в свій чат і використовувати автоматичний прийом заявок, натисни кнопку нижче:`;
    
    await tg(env.BOT_TOKEN, 'sendMessage', {
      chat_id: msg.chat.id,
      text,
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
    return;
  }

  // ЯКЩО КОМАНДА /invite ВИКЛИКАНА ВСЕРЕДИНІ ГРУПИ
  const res = await tg(env.BOT_TOKEN, 'createChatInviteLink', {
    chat_id: msg.chat.id,
    name: 'Авто-інвайт (join request)',
    creates_join_request: true
  });
  const link = res?.result?.invite_link;

  const text = link
    ? `🔓 **Інвайт-посилання створено!**\n\n${link}\n\n` +
      `Кожен, хто перейде за ним, отримає приватне СМС у ЛС від бота, а його заявку буде автоматично схвалено.`
    : `❌ Не вдалось створити посилання. Перевірте, чи є в бота право "Запрошувати користувачів за посиланням".`;

  await tg(env.BOT_TOKEN, 'sendMessage', {
    chat_id: msg.chat.id,
    text,
    parse_mode: 'Markdown',
    message_thread_id: msg.message_thread_id,
    reply_markup: keyboard // Працююча кнопка додавання бота в іншу групу
  });
}

async function handleWelcomeCommand(msg, env) {
  const keyboard = await getAddBotKeyboard(env);
  if (!isGroupChatType(msg.chat.type)) {
    await tg(env.BOT_TOKEN, 'sendMessage', {
      chat_id: msg.chat.id,
      text: `Скористайся кнопкою нижче, щоб додати бота у свою групу:`,
      reply_markup: keyboard
    });
    return;
  }

  const newWelcomeText = msg.text.replace(/^\/welcome(@\w+)?\s*/i, '').trim();

  if (newWelcomeText) {
    groupWelcomeCache.set(msg.chat.id, newWelcomeText);
    await tg(env.BOT_TOKEN, 'sendMessage', {
      chat_id: msg.chat.id,
      text: `✅ Привітальний текст оновлено!\n\n${newWelcomeText}`,
      message_thread_id: msg.message_thread_id
    });
  } else {
    const welcomeText = getWelcomeText(msg.chat.id);
    await tg(env.BOT_TOKEN, 'sendMessage', {
      chat_id: msg.chat.id,
      text: welcomeText,
      message_thread_id: msg.message_thread_id,
      reply_markup: {
        inline_keyboard: [[{ text: 'пᴘᴀʙиʌᴀ', callback_data: 'show_rules' }]]
      }
    });
  }
}

async function handleRulesCommand(msg, env) {
  const keyboard = await getAddBotKeyboard(env);
  if (!isGroupChatType(msg.chat.type)) {
    await tg(env.BOT_TOKEN, 'sendMessage', {
      chat_id: msg.chat.id,
      text: `Скористайся кнопкою нижче, щоб додати бота у свою групу:`,
      reply_markup: keyboard
    });
    return;
  }

  const newRulesText = msg.text.replace(/^\/rules(@\w+)?\s*/i, '').trim();

  if (newRulesText) {
    groupRulesCache.set(msg.chat.id, newRulesText);
    await tg(env.BOT_TOKEN, 'sendMessage', {
      chat_id: msg.chat.id,
      text: `✅ Текст правил оновлено!\n\n${newRulesText}`,
      message_thread_id: msg.message_thread_id
    });
  } else {
    await tg(env.BOT_TOKEN, 'sendMessage', {
      chat_id: msg.chat.id,
      text: `⚠️ пᴘᴀʙиʌᴀ`,
      message_thread_id: msg.message_thread_id,
      reply_markup: { inline_keyboard: [[{ text: 'пᴘᴀʙиʌᴀ', callback_data: 'show_rules' }]] }
    });
  }
}

// =====================================================================
// РЕАКЦІЇ В ГРУПІ
// =====================================================================
async function reactToMessage(msg, env) {
  try {
    const emojis = await getAllowedReactions(msg.chat.id, env);
    if (!emojis.length) return;
    const emoji = emojis[Math.floor(Math.random() * emojis.length)];
    await tg(env.BOT_TOKEN, 'setMessageReaction', {
      chat_id: msg.chat.id,
      message_id: msg.message_id,
      reaction: [{ type: 'emoji', emoji }]
    });
  } catch (e) {
    console.error('[REACTION] error:', e);
  }
}

// =====================================================================
// ДИСПЕТЧЕР ОНОВЛЕНЬ
// =====================================================================
async function handleUpdate(update, env) {
  const { BOT_TOKEN, GROQ_API_KEY } = env;

  if (isDuplicateUpdate(update.update_id)) return;

  // --- Заявки на вступ (Перехід по посиланню) ---
  if (update.chat_join_request) {
    await handleJoinRequest(update.chat_join_request, env);
    return;
  }

  // --- Кнопка "Правила" ---
  if (update.callback_query?.data === 'show_rules') {
    const chatId = update.callback_query.message?.chat?.id;
    const rulesText = getRulesText(chatId);
    await tg(BOT_TOKEN, 'answerCallbackQuery', {
      callback_query_id: update.callback_query.id,
      text: rulesText,
      show_alert: true
    });
    return;
  }

  // --- Повідомлення ---
  if (update.message) {
    const msg = update.message;
    const chatType = msg.chat.type;
    const isGroupChat = chatType === 'group' || chatType === 'supergroup';
    const isPrivate = chatType === 'private';
    const isRealUserMessage = msg.from && !msg.from.is_bot;

    // Реакція на повідомлення в групі
    if (isGroupChat && isRealUserMessage && !msg.left_chat_member && !msg.pinned_message) {
      await reactToMessage(msg, env);
    }

    if (!msg.text) return;

    // --- Команди ---
    const cmdMatch = /^\/(invite|welcome|rules|start)(@\w+)?/i.exec(msg.text.trim());
    if (cmdMatch) {
      const cmd = cmdMatch[1].toLowerCase();
      if (cmd === 'invite') return void (await handleInviteCommand(msg, env));
      if (cmd === 'welcome') return void (await handleWelcomeCommand(msg, env));
      if (cmd === 'rules') return void (await handleRulesCommand(msg, env));
      
      // /start
      const keyboard = await getAddBotKeyboard(env);
      await tg(BOT_TOKEN, 'sendMessage', {
        chat_id: msg.chat.id,
        text: START_PUSH_TEXT,
        message_thread_id: msg.message_thread_id,
        reply_markup: isPrivate ? keyboard : undefined
      });
      return;
    }

    // --- ШІ-відповідь (Groq Llama) ---
    const hasQuestionMark = /[?？]/.test(msg.text);
    const shouldReplyWithAi = isPrivate || (isGroupChat && hasQuestionMark);

    if (shouldReplyWithAi) {
      if (isAiOnCooldown(msg.from.id)) return;
      const reply = await getGroqReply(msg.text, GROQ_API_KEY);
      await tg(BOT_TOKEN, 'sendMessage', {
        chat_id: msg.chat.id,
        text: reply,
        reply_to_message_id: msg.message_id,
        message_thread_id: msg.message_thread_id
      });
    }
  }
}

// =====================================================================
// EXPORT WORKER
// =====================================================================
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'POST' && url.pathname === '/webhook') {
      if (env.WEBHOOK_SECRET) {
        const header = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
        if (header !== env.WEBHOOK_SECRET) {
          return new Response('Forbidden', { status: 403 });
        }
      }
      try {
        const update = await request.json();
        await handleUpdate(update, env);
      } catch (e) {
        console.error('[handleUpdate] error:', e);
      }
      return new Response('OK');
    }
    return new Response('OK');
  }
};
