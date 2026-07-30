// =====================================================================
// TELEGRAM BOT — Cloudflare Worker (Auto-Link & Supergroup Support)
// =====================================================================
// ENV у Cloudflare (Settings → Variables):
//   BOT_TOKEN      — токен бота від @BotFather (обов'язково)
//   GROQ_API_KEY   — ключ Groq API (обов'язково)
//   WEBHOOK_SECRET — (опційно) секретний токен
// =====================================================================

const ADMIN_ID = 8382236562;

// --- Платна група (за потреби) ---------------------------------------
const PAID_GROUP_CHAT_ID = 0; 
const PAID_GROUP_STARS_PRICE = 3284;

function isPaidGroup(chatId) {
  return chatId === PAID_GROUP_CHAT_ID;
}

// --- Дефолтні тексти -------------------------------------------------
const RULES_TEXT_DEFAULT = `ᴘᴇᴋʌᴀᴍᴀ / пᴏʌіᴛиᴋᴀ - зᴀбᴏᴘᴏнᴇні.\n\nᴀᴘхіʙ ᴄᴛᴘуᴋᴛуᴘᴏʙᴀних ᴍᴀᴛᴇᴘіᴀʌіʌіʙ`;
const WELCOME_TEXT_DEFAULT = `🤬 ᴏнбᴏᴘдинг`;

const START_PUSH_TEXT =
  `⊹ ᴋᴀᴛᴀй ? дʌя ᴀɪ ᴀуᴛпуᴛу\n\n` +
  `⊹ юзᴀй / дʌя ᴄᴇᴛᴀпу ᴄпіʌьнᴏᴛи\n` +
  `/invite /welcome /rules\n\n`;

// --- Динамічний кеш налаштувань груп (За чатами) --------------------
const groupWelcomeCache = new Map(); 
const groupRulesCache = new Map();   
const groupInviteLinksCache = new Map(); // Кеш збережених посилань для кожної групи

function getWelcomeText(chatId) {
  return groupWelcomeCache.get(chatId) || WELCOME_TEXT_DEFAULT;
}

function getRulesText(chatId) {
  return groupRulesCache.get(chatId) || RULES_TEXT_DEFAULT;
}

// --- ШІ & Реакції -----------------------------------------------------
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
// ЗАПОБІЖНИКИ
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
// СТВОРЕННЯ/ОНОВЛЕННЯ ІНВАЙТ-ПОСИЛАННЯ ГРУПИ
// =====================================================================
async function generateAndSaveGroupInvite(chatId, env) {
  const res = await tg(env.BOT_TOKEN, 'createChatInviteLink', {
    chat_id: chatId,
    name: 'Авто-інвайт (join request)',
    creates_join_request: true
  });

  if (res?.result?.invite_link) {
    const link = res.result.invite_link;
    groupInviteLinksCache.set(chatId, link);
    return link;
  }
  return null;
}

// =====================================================================
// ПОДІЯ: БОТА ДОДАНО В ГРУПУ / СУПЕРГРУПУ
// =====================================================================
async function handleBotAddedToGroup(myChatMember, env) {
  const chatId = myChatMember.chat.id;
  const newStatus = myChatMember.new_chat_member.status;
  const oldStatus = myChatMember.old_chat_member.status;

  // Перевіряємо, чи бота щойно додали (member або administrator)
  const isAdded = (oldStatus === 'left' || oldStatus === 'kicked') && 
                  (newStatus === 'member' || newStatus === 'administrator');

  if (!isAdded) return;

  console.log(`[BOT ADDED] Bot added to chat_id=${chatId}`);

  // Спробуємо відразу згенерувати інвайт-посилання
  const inviteLink = await generateAndSaveGroupInvite(chatId, env);

  let startMsg = 
    `👋 **Дякую за додавання бота в групу!**\n\n` +
    `${START_PUSH_TEXT}`;

  if (inviteLink) {
    startMsg += `\n🔓 **Автоматично створене інвайт-посилання:**\n${inviteLink}`;
  } else {
    startMsg += `\n⚠️ *Надайте боту права адміністратора ("Запрошувати користувачів"), щоб він міг приймати заявки.*`;
  }

  const keyboard = await getAddBotKeyboard(env);

  await tg(env.BOT_TOKEN, 'sendMessage', {
    chat_id: chatId,
    text: startMsg,
    parse_mode: 'Markdown',
    reply_markup: keyboard
  });
}

// =====================================================================
// ПРИЙОМ ЗАЯВОК У ГРУПУ
// =====================================================================
async function handleJoinRequest(req, env) {
  const { BOT_TOKEN } = env;
  const userId = req.from.id;
  const chatId = req.chat.id;

  console.log(`[JOIN] chat_join_request: chat_id=${chatId} user_id=${userId}`);

  // 1. Приватний пуш у ЛС
  const currentRules = getRulesText(chatId);
  const privateWelcomeMessage = 
    `👋 **Вітаємо!**\n\n` +
    `${START_PUSH_TEXT}` +
    `⚠️ **Правила спільноти:**\n${currentRules}`;

  try {
    await tg(BOT_TOKEN, 'sendMessage', {
      chat_id: userId,
      text: privateWelcomeMessage,
      parse_mode: 'Markdown'
    });
  } catch (e) {
    console.error(`[JOIN] Failed DM to user ${userId}:`, e.message);
  }

  // 2. Схвалюємо заявку для безкоштовної групи
  if (!isPaidGroup(chatId)) {
    await tg(BOT_TOKEN, 'approveChatJoinRequest', { chat_id: chatId, user_id: userId });

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

  // 3. Інвойс для платної групи
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
// КОМАНДИ Й ІНТЕРАКТИВ
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

async function getAddBotKeyboard(env) {
  const username = await getBotUsername(env);
  if (!username) return undefined;
  const addUrl = `https://t.me/${username}?startgroup=select&admin=invite_users+manage_chat`;
  return { inline_keyboard: [[{ text: '➕ Додати бота в групу', url: addUrl }]] };
}

// --- /invite ---
async function handleInviteCommand(msg, env) {
  const isGroup = isGroupChatType(msg.chat.type);
  const keyboard = await getAddBotKeyboard(env);

  if (!isGroup) {
    const text = 
      `🤖 **Як підключити групу:**\n\n` +
      `1. Натисни кнопку **«Додати бота в групу»** нижче і обери групу.\n` +
      `2. Надай боту права адміністратора ("Запрошувати користувачів").\n` +
      `3. Бот автоматично створить посилання або зроби це командою **/invite** у групі!`;
    
    await tg(env.BOT_TOKEN, 'sendMessage', {
      chat_id: msg.chat.id,
      text,
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
    return;
  }

  // Отримуємо або перестворюємо посилання для конкретної групи/супергрупи
  let link = groupInviteLinksCache.get(msg.chat.id);
  if (!link) {
    link = await generateAndSaveGroupInvite(msg.chat.id, env);
  }

  const text = link
    ? `🔓 **Актуальне інвайт-посилання для цієї групи:**\n\n${link}\n\n` +
      `За цим посиланням бот автоматично приймає всі заявки на вступ!`
    : `❌ Не вдалось отримати посилання. Перевірте, чи бот має права адміністратора "Запрошувати користувачів за посиланням".`;

  await tg(env.BOT_TOKEN, 'sendMessage', {
    chat_id: msg.chat.id,
    text,
    parse_mode: 'Markdown',
    message_thread_id: msg.message_thread_id,
    reply_markup: keyboard
  });
}

// --- /welcome ---
async function handleWelcomeCommand(msg, env) {
  const keyboard = await getAddBotKeyboard(env);
  if (!isGroupChatType(msg.chat.type)) {
    await tg(env.BOT_TOKEN, 'sendMessage', {
      chat_id: msg.chat.id,
      text: `Команду /welcome потрібно використовувати в групі для налаштування привітання.`,
      reply_markup: keyboard
    });
    return;
  }

  const newWelcomeText = msg.text.replace(/^\/welcome(@\w+)?\s*/i, '').trim();

  if (newWelcomeText) {
    groupWelcomeCache.set(msg.chat.id, newWelcomeText);
    await tg(env.BOT_TOKEN, 'sendMessage', {
      chat_id: msg.chat.id,
      text: `✅ **Вітальний текст успішно оновлено!**\n\nНові учасники бачитимуть:\n\n${newWelcomeText}`,
      parse_mode: 'Markdown',
      message_thread_id: msg.message_thread_id
    });
  } else {
    const currentText = getWelcomeText(msg.chat.id);
    const helpText = 
      `📝 **Поточний текст привітання у цій групі:**\n\n${currentText}\n\n` +
      `💡 *Щоб встановити новий текст, напишіть команду разом з текстом:*\n` +
      `\`/welcome Ваше нове привітання тут...\``;

    await tg(env.BOT_TOKEN, 'sendMessage', {
      chat_id: msg.chat.id,
      text: helpText,
      parse_mode: 'Markdown',
      message_thread_id: msg.message_thread_id
    });
  }
}

// --- /rules ---
async function handleRulesCommand(msg, env) {
  const keyboard = await getAddBotKeyboard(env);
  if (!isGroupChatType(msg.chat.type)) {
    await tg(env.BOT_TOKEN, 'sendMessage', {
      chat_id: msg.chat.id,
      text: `Команду /rules потрібно використовувати в групі для налаштування правил.`,
      reply_markup: keyboard
    });
    return;
  }

  const newRulesText = msg.text.replace(/^\/rules(@\w+)?\s*/i, '').trim();

  if (newRulesText) {
    groupRulesCache.set(msg.chat.id, newRulesText);
    await tg(env.BOT_TOKEN, 'sendMessage', {
      chat_id: msg.chat.id,
      text: `✅ **Правила групи успішно оновлено!**\n\nЦей текст бачитимуть нові користувачі:\n\n${newRulesText}`,
      parse_mode: 'Markdown',
      message_thread_id: msg.message_thread_id
    });
  } else {
    const currentRules = getRulesText(msg.chat.id);
    const helpText = 
      `⚠️ **Поточні правила цієї групи:**\n\n${currentRules}\n\n` +
      `💡 *Щоб змінити правила, напишіть команду разом з новим текстом:*\n` +
      `\`/rules Ваши правила тут...\``;

    await tg(env.BOT_TOKEN, 'sendMessage', {
      chat_id: msg.chat.id,
      text: helpText,
      parse_mode: 'Markdown',
      message_thread_id: msg.message_thread_id
    });
  }
}

// =====================================================================
// РЕАКЦІЇ
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

  // --- Подія додавання бота у групу або супергрупу ---
  if (update.my_chat_member) {
    await handleBotAddedToGroup(update.my_chat_member, env);
    return;
  }

  // --- Перехід за посиланням (Заявка) ---
  if (update.chat_join_request) {
    await handleJoinRequest(update.chat_join_request, env);
    return;
  }

  // --- Попап кнопки "Правила" ---
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
    const isGroupChat = isGroupChatType(chatType);
    const isPrivate = chatType === 'private';
    const isRealUserMessage = msg.from && !msg.from.is_bot;

    if (isGroupChat && isRealUserMessage && !msg.left_chat_member && !msg.pinned_message) {
      await reactToMessage(msg, env);
    }

    if (!msg.text) return;

    // --- Обробка команд ---
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

    // --- Groq ШІ ---
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
