// =====================================================================
// TELEGRAM BOT — Cloudflare Worker
// =====================================================================
// ENV, які треба виставити в Cloudflare (Settings → Variables):
//   BOT_TOKEN            — токен бота (обов'язково)
//   GROQ_API_KEY          — ключ Groq для ІІ-відповідей (обов'язково)
//   WEBHOOK_SECRET        — (опційно) секрет для перевірки заголовка
// =====================================================================

const ADMIN_ID = 8382236562;

// --- Платна група ---------------------------------------------------
const PAID_GROUP_CHAT_ID = 0; // TODO: заповнити реальним numeric chat_id
const PAID_GROUP_INVITE_LINK = 'https://t.me/+3YdPDtgufellNWNi';
const PAID_GROUP_STARS_PRICE = 3284; // у Telegram Stars (XTR)

function isPaidGroup(chatId) {
  return chatId === PAID_GROUP_CHAT_ID;
}

// --- Дефолтні тексти команд ------------------------------------------
const RULES_TEXT_DEFAULT =
  `ᴘᴇᴋʌᴀᴍᴀ / пᴏʌіᴛиᴋᴀ - зᴀбᴏᴘᴏнᴇні.\n\nᴀᴘхіʙ ᴄᴛᴘуᴋᴛуᴘᴏʙᴀних ᴍᴀᴛᴇᴘіᴀʌіʌіʙ`;

const COMMAND_REPLIES = {
  invite: `🔓Апрув`,
  welcome: `🤬 ᴏнбᴏᴘдинг`,
  rules: `⚠️ пᴘᴀʙиʌᴀ\n\n${RULES_TEXT_DEFAULT}`
};

// Стартовий пуш (DM), який бачить юзер в ЛС
const START_PUSH_TEXT =
  `⊹ ᴋᴀᴛᴀй дʌя ᴀɪ ᴀуᴛпуᴛу\n\n` +
  `⊹ юзᴀй / дʌя ᴄᴇᴛᴀпу ᴄпіʌьнᴏᴛи\n` +
  `/invite /welcome /rules\n` +
  `⊹ ᴏᴛᴘиᴍуй ᴘᴇᴀᴋції нᴀ ?`;

// --- Динамічне сховище налаштувань груп (у пам'яті ізоляту) -----------
const groupWelcomeCache = new Map(); // chat_id -> welcomeText
const groupRulesCache = new Map();   // chat_id -> rulesText

function getWelcomeText(chatId) {
  return groupWelcomeCache.get(chatId) || COMMAND_REPLIES.welcome;
}

function getRulesText(chatId) {
  return groupRulesCache.get(chatId) || RULES_TEXT_DEFAULT;
}

// --- ІІ ---------------------------------------------------------------
const SYSTEM_PROMPT =
  `Відповідай виключно українською мовою, просунутою грамотною лексикою. ` +
  `Формат відповіді: рівно 2 короткі конструктивні речення, і одразу після них — ` +
  `один доречний за контекстом емодзі. Без зайвого преамбулу.`;

// --- Реакції ------------------------------------------------------------
const REACTION_EMOJIS = [
  '👍', '❤️', '🔥', '🥰', '👏', '😁', '🎉', '🤩',
  '🙏', '👌', '😍', '💯', '🤝', '😢', '🤣', '⚡'
];

const allowedReactionsCache = new Map(); // chat_id -> { emojis, fetchedAt }
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
// ЗАПОБІЖНИКИ ТА КЕШУВАННЯ
// =====================================================================
const seenUpdateIds = new Map();
const lastAiCallByUser = new Map();

const DEDUP_TTL_MS = 5 * 60 * 1000;
const AI_COOLDOWN_MS = 4000;

function cleanupOldEntries(map, ttlMs) {
  const now = Date.now();
  if (map.size < 2000) return;
  for (const [key, ts] of map) {
    if (now - ts > ttlMs) map.delete(key);
  }
}

function isDuplicateUpdate(updateId) {
  if (updateId == null) return false;
  cleanupOldEntries(seenUpdateIds, DEDUP_TTL_MS);
  if (seenUpdateIds.has(updateId)) return true;
  seenUpdateIds.set(updateId, Date.now());
  return false;
}

function isAiOnCooldown(userId) {
  cleanupOldEntries(lastAiCallByUser, AI_COOLDOWN_MS);
  const last = lastAiCallByUser.get(userId);
  const now = Date.now();
  if (last && now - last < AI_COOLDOWN_MS) return true;
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
// ЗАЯВКИ НА ВСТУП
// =====================================================================
async function handleJoinRequest(req, env) {
  const { BOT_TOKEN } = env;
  const userId = req.from.id;
  const chatId = req.chat.id;
  const userChatId = req.user_chat_id;

  console.log(`[JOIN] chat_join_request: chat_id=${chatId} user_id=${userId}`);

  // Шлемо стартовий пуш в приватні повідомлення
  await tg(BOT_TOKEN, 'sendMessage', { chat_id: userChatId, text: START_PUSH_TEXT });

  if (!isPaidGroup(chatId)) {
    // Автоприйом для безкоштовних груп
    await tg(BOT_TOKEN, 'approveChatJoinRequest', { chat_id: chatId, user_id: userId });
    await tg(BOT_TOKEN, 'sendMessage', {
      chat_id: userChatId,
      text: `✅ зᴀявку схвᴀʌᴇно!`
    });

    // Опублікувати велкам-повідомлення з кнопкою правил у саму групу
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

  // Платна група — інвойс
  const payload = `join_${chatId}_${userId}`;
  await tg(BOT_TOKEN, 'sendInvoice', {
    chat_id: userChatId,
    title: 'Вступ до групи',
    description: `Оплата дає доступ до заявки на вступ.`,
    payload,
    currency: 'XTR',
    prices: [{ label: 'Доступ до групи', amount: PAID_GROUP_STARS_PRICE }]
  });
}

async function handlePreCheckout(pcq, env) {
  await tg(env.BOT_TOKEN, 'answerPreCheckoutQuery', {
    pre_checkout_query_id: pcq.id,
    ok: true
  });
}

async function handleSuccessfulPayment(msg, env) {
  const payment = msg.successful_payment;
  const userId = msg.from.id;
  const match = /^join_(-?\d+)_(\d+)$/.exec(payment.invoice_payload || '');

  if (!match) return;

  const chatId = Number(match[1]);
  const payloadUserId = Number(match[2]);

  if (payloadUserId !== userId) return;

  await tg(env.BOT_TOKEN, 'approveChatJoinRequest', { chat_id: chatId, user_id: userId });
  await tg(env.BOT_TOKEN, 'sendMessage', {
    chat_id: msg.chat.id,
    text: `✅ ᴏпʌᴀᴛу ᴏᴛᴘиᴍᴀнᴏ, зᴀявку схвᴀʌᴇно!`
  });

  // Опублікувати велкам у платну групу
  const welcomeText = getWelcomeText(chatId);
  const name = msg.from.first_name || 'користувач';
  const userMention = `[${name}](tg://user?id=${userId})`;

  await tg(env.BOT_TOKEN, 'sendMessage', {
    chat_id: chatId,
    text: `Вітаємо, ${userMention}!\n\n${welcomeText}`,
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [[{ text: 'пᴘᴀʙиʌᴀ', callback_data: 'show_rules' }]]
    }
  });

  try {
    await tg(env.BOT_TOKEN, 'sendMessage', {
      chat_id: ADMIN_ID,
      text:
        `💳 Новий платіж\n` +
        `👤 ${msg.from.first_name} (id ${userId})\n` +
        `💰 ${payment.total_amount} ${payment.currency}\n` +
        `👥 chat_id: ${chatId}`
    });
  } catch (e) {
    console.error('[PAYMENT] admin notify error:', e);
  }
}

// =====================================================================
// КОМАНДИ И УПРАВЛЕНИЕ
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

async function sendAddToGroupPrompt(msg, env) {
  const username = await getBotUsername(env);
  const text =
    `ᴛуᴛ мᴇнᴇ щᴇ нᴇмᴀє ʙ жᴏдній ᴛʙᴏій гᴘупі 🙂\n\n` +
    `дᴏдᴀй бᴏᴛᴀ ʙ ᴄʙᴏю гᴘупу ᴋнᴏпᴋᴏю нижчᴇ, ᴀ пᴏᴛім скᴏᴘиᴄᴛᴀйся цією ж ᴋᴏᴍᴀндᴏю ʙжᴇ ᴛᴀᴍ.`;
  await tg(env.BOT_TOKEN, 'sendMessage', {
    chat_id: msg.chat.id,
    text,
    reply_markup: username
      ? { inline_keyboard: [[{ text: '➕ Додати бота в групу', url: `https://t.me/${username}?startgroup=start` }]] }
      : undefined
  });
}

async function handleInviteCommand(msg, env) {
  if (!isGroupChatType(msg.chat.type)) {
    await sendAddToGroupPrompt(msg, env);
    return;
  }

  const res = await tg(env.BOT_TOKEN, 'createChatInviteLink', {
    chat_id: msg.chat.id,
    name: 'Авто-інвайт (join request)',
    creates_join_request: true
  });
  const link = res?.result?.invite_link;

  const text = link
    ? `🔓Апрув\n\nОсь інвайт-посилання. Кожен, хто зайде по ньому, спершу отримає ` +
      `привітання в особисті, а вступ підтвердиться автоматично:\n${link}`
    : `🔓Апрув\n\nНе вдалось створити посилання. Перевір, що в бота є права ` +
      `адміністратора "Запрошувати користувачів за посиланням".`;

  await tg(env.BOT_TOKEN, 'sendMessage', {
    chat_id: msg.chat.id,
    text,
    message_thread_id: msg.message_thread_id
  });
}

// /welcome — оновлює або надсилає велкам-повідомлення
async function handleWelcomeCommand(msg, env) {
  if (!isGroupChatType(msg.chat.type)) {
    await sendAddToGroupPrompt(msg, env);
    return;
  }

  const newWelcomeText = msg.text.replace(/^\/welcome(@\w+)?\s*/i, '').trim();

  if (newWelcomeText) {
    groupWelcomeCache.set(msg.chat.id, newWelcomeText);
    await tg(env.BOT_TOKEN, 'sendMessage', {
      chat_id: msg.chat.id,
      text: `✅ Привітальний текст для цієї групи оновлено!\n\n${newWelcomeText}`,
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

// /rules — оновлює текст вспливаючої кнопки або виводить її
async function handleRulesCommand(msg, env) {
  if (!isGroupChatType(msg.chat.type)) {
    await sendAddToGroupPrompt(msg, env);
    return;
  }

  const newRulesText = msg.text.replace(/^\/rules(@\w+)?\s*/i, '').trim();

  if (newRulesText) {
    groupRulesCache.set(msg.chat.id, newRulesText);
    await tg(env.BOT_TOKEN, 'sendMessage', {
      chat_id: msg.chat.id,
      text: `✅ Текст правил (для кнопки) оновлено!\n\n${newRulesText}`,
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
// ГОЛОВНИЙ ДИСПЕТЧЕР ОНОВЛЕНЬ
// =====================================================================
async function handleUpdate(update, env) {
  const { BOT_TOKEN, GROQ_API_KEY } = env;

  if (isDuplicateUpdate(update.update_id)) return;

  // --- Заявки на вступ ---
  if (update.chat_join_request) {
    await handleJoinRequest(update.chat_join_request, env);
    return;
  }

  // --- Попап з правилами (кнопка з /rules) ---
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

  // --- Оплата Stars ---
  if (update.pre_checkout_query) {
    await handlePreCheckout(update.pre_checkout_query, env);
    return;
  }
  if (update.message?.successful_payment) {
    await handleSuccessfulPayment(update.message, env);
    return;
  }

  // --- Повідомлення ---
  if (update.message) {
    const msg = update.message;
    const chatType = msg.chat.type;
    const isGroupChat = chatType === 'group' || chatType === 'supergroup';
    const isPrivate = chatType === 'private';
    const isRealUserMessage = msg.from && !msg.from.is_bot;

    // Прямий вступ у групу (не через заявку)
    if (isGroupChat && msg.new_chat_members?.length) {
      for (const member of msg.new_chat_members) {
        if (member.is_bot) continue;
        const welcomeText = getWelcomeText(msg.chat.id);
        const name = member.first_name || 'користувач';
        const userMention = `[${name}](tg://user?id=${member.id})`;

        await tg(BOT_TOKEN, 'sendMessage', {
          chat_id: msg.chat.id,
          text: `Вітаємо, ${userMention}!\n\n${welcomeText}`,
          parse_mode: 'Markdown',
          message_thread_id: msg.message_thread_id,
          reply_markup: {
            inline_keyboard: [[{ text: 'пᴘᴀʙиʌᴀ', callback_data: 'show_rules' }]]
          }
        });
        await tg(BOT_TOKEN, 'sendMessage', { chat_id: member.id, text: START_PUSH_TEXT });
      }
      return;
    }

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
      await tg(BOT_TOKEN, 'sendMessage', {
        chat_id: msg.chat.id,
        text: START_PUSH_TEXT,
        message_thread_id: msg.message_thread_id
      });
      return;
    }

    // --- ІІ-відповідь ---
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
// EXPORT
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
