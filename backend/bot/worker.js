// =====================================================================
// TELEGRAM BOT — Cloudflare Worker (Final Version: V4)
// =====================================================================
// Функціонал: Автоприйом заявок, ЛС з правилами, кастомні привітання 
// для кожної групи, інлайн-редагування кнопок, ШІ-відповіді (Llama 3.3),
// рандомні реакції, підтримка супергруп та форумів.
// =====================================================================

// --- Дефолтні тексти ---
const RULES_TEXT_DEFAULT = `ᴘᴇᴋʌᴀᴍᴀ / пᴏʌіᴛиᴋᴀ - зᴀбᴏᴘᴏнᴇні.\n\nᴀᴘхіʙ ᴄᴛᴘуᴋᴛуᴘᴏʙᴀних ᴍᴀᴛᴇᴘіᴀʌіʌіʙ`;
const WELCOME_TEXT_DEFAULT = `🤬 ᴏнбᴏᴘдинг`;
const START_PUSH_TEXT =
  `⊹ ᴋᴀᴛᴀй ? дʌя ᴀɪ ᴀуᴛпуᴛу\n\n` +
  `⊹ юзᴀй / дʌя ᴄᴇᴛᴀпу ᴄпіʌьнᴏᴛи\n` +
  `/invite /welcome /rules\n\n`;

// --- Динамічний кеш (В пам'яті Worker-а) ---
const groupWelcomeCache = new Map(); 
const groupRulesCache = new Map();   
const groupInviteLinksCache = new Map(); 

function getWelcomeText(chatId) { return groupWelcomeCache.get(chatId) || WELCOME_TEXT_DEFAULT; }
function getRulesText(chatId) { return groupRulesCache.get(chatId) || RULES_TEXT_DEFAULT; }

// --- Налаштування ШІ та Емодзі ---
const SYSTEM_PROMPT = `Відповідай виключно українською мовою, просунутою грамотною лексикою. Формат: 2 короткі конструктивні речення і один емодзі.`;
const SAFE_EMOJIS = ['👍', '❤️', '🔥', '🥰', '👏', '😁', '🎉', '🤩', '🙏', '👌', '💯'];

// =====================================================================
// TELEGRAM API HELPER
// =====================================================================
async function tg(token, method, body) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return await res.json();
  } catch (e) {
    console.error(`[TG] ${method} error:`, e.message);
    return null;
  }
}

// =====================================================================
// ДОПОМІЖНІ ФУНКЦІЇ
// =====================================================================
let cachedBotUsername = null;
async function getBotUsername(env) {
  if (!cachedBotUsername) {
    const res = await tg(env.BOT_TOKEN, 'getMe', {});
    cachedBotUsername = res?.result?.username;
  }
  return cachedBotUsername;
}

async function getAddBotKeyboard(env) {
  const username = await getBotUsername(env);
  if (!username) return undefined;
  return { inline_keyboard: [[{ text: '➕ Додати бота в групу', url: `https://t.me/${username}?startgroup=true` }]] };
}

async function getGroqReply(userMessage, apiKey) {
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.7,
        max_tokens: 150
      })
    });
    const data = await res.json();
    return data.choices?.[0]?.message?.content || 'спробуйте попізніше 🫩';
  } catch (e) {
    return 'спробуйте попізніше 🫩';
  }
}

// =====================================================================
// ОБРОБКА ПОВІДОМЛЕНЬ
// =====================================================================
async function handleMessage(msg, env) {
  const { BOT_TOKEN, GROQ_API_KEY } = env;
  const isGroup = msg.chat.type === 'group' || msg.chat.type === 'supergroup';
  const isPrivate = msg.chat.type === 'private';
  const text = msg.text || '';
  const threadId = msg.message_thread_id; // Для форумів

  // 1. ПЕРЕВІРКА НА ВІДПОВІДЬ (REPLY) ДЛЯ РЕДАГУВАННЯ ТЕКСТІВ
  if (isGroup && msg.reply_to_message && msg.reply_to_message.from.is_bot) {
    const repliedText = msg.reply_to_message.text;
    if (repliedText && repliedText.includes("Надішліть новий текст привітання")) {
      groupWelcomeCache.set(msg.chat.id, text);
      await tg(BOT_TOKEN, 'sendMessage', { chat_id: msg.chat.id, message_thread_id: threadId, text: "✅ **Вітальний текст успішно оновлено!**", parse_mode: 'Markdown' });
      return;
    }
    if (repliedText && repliedText.includes("Надішліть новий текст правил")) {
      groupRulesCache.set(msg.chat.id, text);
      await tg(BOT_TOKEN, 'sendMessage', { chat_id: msg.chat.id, message_thread_id: threadId, text: "✅ **Правила успішно оновлено!**", parse_mode: 'Markdown' });
      return;
    }
  }

  // 2. ОБРОБКА КОМАНД
  if (text.startsWith('/')) {
    const cmdMatch = /^\/(invite|welcome|rules|start)/i.exec(text.trim());
    if (!cmdMatch) return;
    const cmd = cmdMatch[1].toLowerCase();
    const keyboard = await getAddBotKeyboard(env);

    if (cmd === 'start') {
      await tg(BOT_TOKEN, 'sendMessage', { chat_id: msg.chat.id, text: START_PUSH_TEXT, reply_markup: isPrivate ? keyboard : undefined });
      return;
    }

    if (!isGroup) {
      await tg(BOT_TOKEN, 'sendMessage', { chat_id: msg.chat.id, text: "⚠️ Ця команда працює лише у групах.", reply_markup: keyboard });
      return;
    }

    if (cmd === 'invite') {
      const res = await tg(BOT_TOKEN, 'createChatInviteLink', { chat_id: msg.chat.id, name: 'Авто-інвайт', creates_join_request: true });
      const link = res?.result?.invite_link;
      if (link) {
        groupInviteLinksCache.set(msg.chat.id, link);
        await tg(BOT_TOKEN, 'sendMessage', {
          chat_id: msg.chat.id,
          message_thread_id: threadId,
          text: `🔓 **Інвайт-посилання для цієї групи:**\n\n${link}\n\nБот автоматично прийматиме всі заявки та вітатиме новачків.`,
          parse_mode: 'Markdown'
        });
      } else {
        await tg(BOT_TOKEN, 'sendMessage', { chat_id: msg.chat.id, message_thread_id: threadId, text: "❌ Помилка. Надайте боту права адміністратора 'Запрошувати користувачів'." });
      }
      return;
    }

    if (cmd === 'welcome') {
      const currentText = getWelcomeText(msg.chat.id);
      await tg(BOT_TOKEN, 'sendMessage', {
        chat_id: msg.chat.id,
        message_thread_id: threadId,
        text: `📝 **Поточний текст привітання:**\n\n${currentText}`,
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[{ text: '✏️ Редагувати', callback_data: 'edit_welcome' }]] }
      });
      return;
    }

    if (cmd === 'rules') {
      const currentRules = getRulesText(msg.chat.id);
      await tg(BOT_TOKEN, 'sendMessage', {
        chat_id: msg.chat.id,
        message_thread_id: threadId,
        text: `⚠️ **Поточні правила групи:**\n\n${currentRules}`,
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[{ text: '✏️ Редагувати', callback_data: 'edit_rules' }]] }
      });
      return;
    }
  }

  // 3. РАНДОМНІ РЕАКЦІЇ (50% шанс, щоб уникнути спам-лімітів)
  if (isGroup && msg.from && !msg.from.is_bot && Math.random() > 0.5) {
    const emoji = SAFE_EMOJIS[Math.floor(Math.random() * SAFE_EMOJIS.length)];
    await tg(BOT_TOKEN, 'setMessageReaction', {
      chat_id: msg.chat.id,
      message_id: msg.message_id,
      reaction: [{ type: 'emoji', emoji }]
    }); 
  }

  // 4. ШІ-ВІДПОВІДІ (Groq) - в ЛС на все, в групах на питання
  if (text && (isPrivate || (isGroup && /[?？]/.test(text)))) {
    const reply = await getGroqReply(text, GROQ_API_KEY);
    await tg(BOT_TOKEN, 'sendMessage', {
      chat_id: msg.chat.id,
      message_thread_id: threadId,
      text: reply,
      reply_to_message_id: msg.message_id
    });
  }
}

// =====================================================================
// ДИСПЕТЧЕР ОНОВЛЕНЬ (WEBHOOK)
// =====================================================================
async function handleUpdate(update, env) {
  const { BOT_TOKEN } = env;

  // --- 1. Подія: Бота додали в групу ---
  if (update.my_chat_member) {
    const myChatMember = update.my_chat_member;
    const newStatus = myChatMember.new_chat_member.status;
    const oldStatus = myChatMember.old_chat_member.status;
    
    const isAdded = (oldStatus === 'left' || oldStatus === 'kicked') && 
                    (newStatus === 'member' || newStatus === 'administrator');

    if (isAdded) {
      const chatId = myChatMember.chat.id;
      const keyboard = await getAddBotKeyboard(env);
      let textMsg = `👋 **Дякую за додавання бота в групу!**\n\n${START_PUSH_TEXT}\n⚠️ *Надайте боту права адміністратора ("Запрошувати користувачів"), і напишіть /invite для створення закритого посилання.*`;
      
      await tg(BOT_TOKEN, 'sendMessage', { chat_id: chatId, text: textMsg, parse_mode: 'Markdown', reply_markup: keyboard });
    }
    return;
  }

  // --- 2. Кнопки (Callback Queries) ---
  if (update.callback_query) {
    const cb = update.callback_query;
    const chatId = cb.message.chat.id;
    const threadId = cb.message.message_thread_id; // Підтримка топіків

    if (cb.data === 'show_rules') {
      await tg(BOT_TOKEN, 'answerCallbackQuery', { callback_query_id: cb.id, text: getRulesText(chatId), show_alert: true });
    } 
    else if (cb.data === 'edit_welcome') {
      await tg(BOT_TOKEN, 'sendMessage', {
        chat_id: chatId,
        message_thread_id: threadId,
        text: "✏️ **Надішліть новий текст привітання у відповідь (Reply) на це повідомлення:**",
        parse_mode: 'Markdown',
        reply_markup: { force_reply: true, selective: true }
      });
      await tg(BOT_TOKEN, 'answerCallbackQuery', { callback_query_id: cb.id });
    }
    else if (cb.data === 'edit_rules') {
      await tg(BOT_TOKEN, 'sendMessage', {
        chat_id: chatId,
        message_thread_id: threadId,
        text: "✏️ **Надішліть новий текст правил у відповідь (Reply) на це повідомлення:**",
        parse_mode: 'Markdown',
        reply_markup: { force_reply: true, selective: true }
      });
      await tg(BOT_TOKEN, 'answerCallbackQuery', { callback_query_id: cb.id });
    }
    return;
  }

  // --- 3. Заявка на вступ (Join Request) ---
  if (update.chat_join_request) {
    const req = update.chat_join_request;
    const userId = req.from.id;
    const chatId = req.chat.id;

    // Пуш у ЛС (Намагаємося відправити)
    await tg(BOT_TOKEN, 'sendMessage', {
      chat_id: userId,
      text: `👋 **Вітаємо!**\n\n${START_PUSH_TEXT}\n⚠️ **Правила спільноти:**\n${getRulesText(chatId)}`,
      parse_mode: 'Markdown'
    });

    // Автоприйом
    await tg(BOT_TOKEN, 'approveChatJoinRequest', { chat_id: chatId, user_id: userId });

    // Привітання в загальній групі з кнопкою правил
    const name = req.from.first_name || 'користувач';
    await tg(BOT_TOKEN, 'sendMessage', {
      chat_id: chatId,
      text: `Вітаємо, [${name}](tg://user?id=${userId})!\n\n${getWelcomeText(chatId)}`,
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [[{ text: 'пᴘᴀʙиʌᴀ', callback_data: 'show_rules' }]] }
    });
    return;
  }

  // --- 4. Текстові повідомлення ---
  if (update.message && update.message.text) {
    await handleMessage(update.message, env);
  }
}

export default {
  async fetch(request, env) {
    if (request.method === 'POST') {
      try {
        const update = await request.json();
        await handleUpdate(update, env);
      } catch (e) {
        console.error('Webhook Error:', e);
      }
    }
    // Відповідаємо "ОК", щоб Telegram не дублював хуки
    return new Response('OK', { status: 200 });
  }
};
