// =====================================================================
// TELEGRAM BOT — Cloudflare Worker
// =====================================================================
// ENV, які треба виставити в Cloudflare (Settings → Variables):
//   BOT_TOKEN            — токен бота (обов'язково)
//   GROQ_API_KEY          — ключ Groq для ІІ-відповідей (обов'язково)
//   WEBHOOK_SECRET        — (опційно) секрет для перевірки заголовка
//                           X-Telegram-Bot-Api-Secret-Token (setWebhook secret_token)
// =====================================================================

const ADMIN_ID = 8382236562;

// --- Групи ---------------------------------------------------------
// Боту НЕ треба знати наперед, у яких групах він перебуває — кожна подія
// (заявка на вступ, повідомлення) сама несе chat_id, і рішення приймається
// на льоту. Єдине виключення — одна конкретна група, для якої вступ платний:
// для неї треба знати її chat_id, щоб відрізнити від усіх інших.
// Усі решта груп, куди просто доданий бот, автоматично отримують
// безкоштовний автоприйом — без жодного реєстру чи зовнішньої БД.

// ⚠️ TODO: встав сюди реальний numeric chat_id групи https://t.me/+3YdPDtgufellNWNi
// Дізнатись його просто: бот вже логує update.chat_join_request.chat.id
// при будь-якій заявці (дивись `wrangler tail` / Cloudflare Logs), візьми
// значення звідти і встав нижче замість 0. Поки тут 0 — жодна заявка НЕ
// потрапить у платний сценарій (щоб нічого не зламати).
const PAID_GROUP_CHAT_ID = 0; // TODO: заповнити
const PAID_GROUP_INVITE_LINK = 'https://t.me/+3YdPDtgufellNWNi';
const PAID_GROUP_STARS_PRICE = 3284; // у Telegram Stars (XTR)

function isPaidGroup(chatId) {
  return chatId === PAID_GROUP_CHAT_ID;
}

// --- Тексти команд ---------------------------------------------------
const RULES_TEXT =
  `ᴘᴇᴋʌᴀᴍᴀ / пᴏʌіᴛиᴋᴀ - зᴀбᴏᴘᴏнᴇні.\n\nᴀᴘхіʙ ᴄᴛᴘуᴋᴛуᴘᴏʙᴀних ᴍᴀᴛᴇᴘіᴀʌіʙ`;

// TODO: заглушки — заміни на реальний текст команд, коли буде відомо, що саме має відповідати бот
const COMMAND_REPLIES = {
  invite: `🔓Апрув`,
  welcome: `🤬 ᴏнбᴏᴘдинг`,
  rules: `⚠️ пᴘᴀʙиʌᴀ\n\n${RULES_TEXT}`
};

// Стартовий пуш (DM), який бачить юзер
const START_PUSH_TEXT =
  `⊹ ᴋᴀᴛᴀй дʌя ᴀɪ ᴀуᴛпуᴛу\n\n` +
  `⊹ юзᴀй / дʌя зᴀᴄᴇᴛᴀпу ᴄпіʌьнᴏᴛи\n` +
  `⊹ ᴏᴛᴘиᴍуй ᴘᴇᴀᴋції нᴀ ?`;

// --- ІІ ---------------------------------------------------------------
// Автопромт додається до кожної ІІ-відповіді
const SYSTEM_PROMPT =
  `Відповідай виключно українською мовою, просунутою грамотною лексикою. ` +
  `Формат відповіді: рівно 2 короткі конструктивні речення, і одразу після них — ` +
  `один доречний за контекстом емодзі. Без зайвого преамбулу.`;

// --- Реакції ------------------------------------------------------------
// Куратований список безкоштовних (не-преміум) емодзі-реакцій Telegram.
// Якщо Telegram відхилить якусь — це просто ловиться try/catch і ігнорується.
const REACTION_EMOJIS = [
  '👍', '❤️', '🔥', '🥰', '👏', '😁', '🎉', '🤩',
  '🙏', '👌', '😍', '💯', '🤝', '😢', '🤣', '⚡'
];
function randomReaction() {
  return REACTION_EMOJIS[Math.floor(Math.random() * REACTION_EMOJIS.length)];
}

// =====================================================================
// БЕЗПЕКА / ЗАПОБІЖНИКИ НА ВИСОКИХ НАВАНТАЖЕННЯХ (best-effort, in-memory)
// =====================================================================
// Cloudflare Workers isolate може перевикористовуватись між запитами,
// тож ці Map працюють як "best effort" кеш, а не гарантоване сховище.
// Це нормально: мета — згладити пікові навантаження і дублікати, а не
// забезпечити 100% консистентність.

const seenUpdateIds = new Map(); // update_id -> timestamp (анти-дубль від Telegram retries)
const lastAiCallByUser = new Map(); // user_id -> timestamp (кулдаун на ІІ-відповіді)

const DEDUP_TTL_MS = 5 * 60 * 1000;
const AI_COOLDOWN_MS = 4000;

function cleanupOldEntries(map, ttlMs) {
  const now = Date.now();
  if (map.size < 2000) return; // чистимо лише коли назбиралось забагато
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
// TELEGRAM API HELPER (з таймаутом, ніколи не кидає — повертає null при фейлі)
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
// GROQ — ІІ-відповідь (з таймаутом і фолбеком)
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

  // Завжди шлемо стартовий пуш одразу
  await tg(BOT_TOKEN, 'sendMessage', { chat_id: userChatId, text: START_PUSH_TEXT });

  if (!isPaidGroup(chatId)) {
    // Будь-яка інша група (в т.ч. невідома, куди просто додали бота) — автоприйом
    await tg(BOT_TOKEN, 'approveChatJoinRequest', { chat_id: chatId, user_id: userId });
    await tg(BOT_TOKEN, 'sendMessage', {
      chat_id: userChatId,
      text: `✅ зᴀявку схвᴀʌᴇно!`
    });
    return;
  }

  // Платна група — окремим пушем шлемо інвойс на Telegram Stars.
  // Approve НЕ робимо тут — він відбудеться лише після successful_payment.
  const payload = `join_${chatId}_${userId}`;

  await tg(BOT_TOKEN, 'sendInvoice', {
    chat_id: userChatId,
    title: 'Вступ до групи',
    description: `Оплата дає доступ до заявки на вступ.`,
    payload,
    currency: 'XTR',
    prices: [{ label: 'Доступ до групи', amount: PAID_GROUP_STARS_PRICE }]
    // provider_token навмисно не передаємо — для Stars (XTR) він не потрібен
  });
}

async function handlePreCheckout(pcq, env) {
  // Для Stars нема зовнішнього провайдера, який треба звіряти —
  // просто підтверджуємо, що готові прийняти оплату.
  await tg(env.BOT_TOKEN, 'answerPreCheckoutQuery', {
    pre_checkout_query_id: pcq.id,
    ok: true
  });
}

async function handleSuccessfulPayment(msg, env) {
  const payment = msg.successful_payment;
  const userId = msg.from.id;
  const match = /^join_(-?\d+)_(\d+)$/.exec(payment.invoice_payload || '');

  if (!match) {
    console.error('[PAYMENT] unrecognized payload:', payment.invoice_payload);
    return;
  }

  const chatId = Number(match[1]);
  const payloadUserId = Number(match[2]);

  if (payloadUserId !== userId) {
    console.error('[PAYMENT] user mismatch, ignoring');
    return;
  }

  await tg(env.BOT_TOKEN, 'approveChatJoinRequest', { chat_id: chatId, user_id: userId });
  await tg(env.BOT_TOKEN, 'sendMessage', {
    chat_id: msg.chat.id,
    text: `✅ ᴏпʌᴀᴛу ᴏᴛᴘиᴍᴀнᴏ, зᴀявку схвᴀʌᴇно!`
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
// РЕАКЦІЯ НА ВСІ ПОВІДОМЛЕННЯ В ГРУПІ
// =====================================================================
async function reactToMessage(msg, env) {
  try {
    await tg(env.BOT_TOKEN, 'setMessageReaction', {
      chat_id: msg.chat.id,
      message_id: msg.message_id,
      reaction: [{ type: 'emoji', emoji: randomReaction() }]
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

  if (isDuplicateUpdate(update.update_id)) {
    console.log('[DEDUP] duplicate update, skipping:', update.update_id);
    return;
  }

  // --- Заявки на вступ ---
  if (update.chat_join_request) {
    await handleJoinRequest(update.chat_join_request, env);
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

    // Реакція на будь-яке повідомлення в групі (від людей, не від сервісних подій)
    if (isGroupChat && isRealUserMessage) {
      await reactToMessage(msg, env);
    }

    if (!msg.text) return; // далі йде текстова логіка (команди/ІІ)

    // --- Команди ---
    const cmdMatch = /^\/(invite|welcome|rules|start)(@\w+)?/i.exec(msg.text.trim());
    if (cmdMatch) {
      const cmd = cmdMatch[1].toLowerCase();
      const text = cmd === 'start' ? START_PUSH_TEXT : COMMAND_REPLIES[cmd];
      await tg(BOT_TOKEN, 'sendMessage', {
        chat_id: msg.chat.id,
        text,
        message_thread_id: msg.message_thread_id
      });
      return;
    }

    // --- ІІ-відповідь: в приваті на все, в групі — тільки на "?" ---
    const hasQuestionMark = /[?？]/.test(msg.text);
    const shouldReplyWithAi = isPrivate || (isGroupChat && hasQuestionMark);

    if (shouldReplyWithAi) {
      if (isAiOnCooldown(msg.from.id)) {
        console.log('[AI] cooldown hit for user', msg.from.id);
        return;
      }
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
    const method = request.method;

    if (method === 'POST' && url.pathname === '/webhook') {
      // Опційна перевірка секрету вебхука (Telegram шле його заголовком,
      // якщо він був заданий при setWebhook(secret_token=...))
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
      // Завжди 200, щоб Telegram не заспамив ретраями
      return new Response('OK');
    }

    return new Response('OK');
  }
};
