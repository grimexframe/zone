// =====================================================================
// TELEGRAM BOT — Cloudflare Worker (Reactions Fixed + Anon Admin)
// =====================================================================

const RULES_TEXT_DEFAULT = `⊹ ᴋᴀᴛᴀй ? дʌя ᴀɪ ᴀуᴛпуᴛу\n\n⊹ юзᴀй / дʌя ᴄᴇᴛᴀпу`;
const WELCOME_TEXT_DEFAULT = `нᴀдᴀйᴛᴇ бᴏᴛу пᴘᴀʙᴀ `;
const START_PUSH_TEXT = `ᴀʙᴛᴏпᴘийᴏм зᴀяʙᴏᴋ у ᴄпіʌьнᴏᴛу`;

const groupWelcomeCache = new Map();
const groupRulesCache = new Map();
const groupInviteLinksCache = new Map();

function getWelcomeText(chatId) { return groupWelcomeCache.get(chatId) || WELCOME_TEXT_DEFAULT; }
function getRulesText(chatId) { return groupRulesCache.get(chatId) || RULES_TEXT_DEFAULT; }

const SYSTEM_PROMPT = `Відповідай виключно українською мовою, просунутою грамотною лексикою. Формат: 2 короткі конструктивні речення без зайвих деталей.`;

const ALL_REACTIONS = [
  '👍','👎','❤️','🔥','🥰','👏','😁','🤔','🤯','😱','🤬','😢','🎉','🤩','🤮','💩','🙏','👌','🕊️','🤡','🥱','🥴','😍','🐳','❤️‍🔥','🌚','🌭','💯','🤣','⚡','🍌','🏆','💔','🤨','😐','🍓','🍾','💋','🖕','😈','😴','😭','🤓','👻','💻','👀','🎃','🙈','😇','😨','🤝','✍️','🤗','🫡','🎅','🎄','⛄','💅','🤪','🗿','🆒','💘','🙉','🦄','😘','💊','🙊','😎','👾','🤷‍♂️','🤷','🤷‍♀️','😡'
];

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

async function deleteMessageDelayed(token, chatId, messageId, delayMs = 6000) {
  setTimeout(async () => {
    await tg(token, 'deleteMessage', { chat_id: chatId, message_id: messageId });
  }, delayMs);
}

let cachedBotUsername = null;
async function getBotUsername(env) {
  if (!cachedBotUsername) {
    const res = await tg(env.BOT_TOKEN, 'getMe', {});
    cachedBotUsername = res?.result?.username;
  }
  return cachedBotUsername;
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
  const chatId = msg.chat.id;
  const messageId = msg.message_id;
  const isGroup = msg.chat.type === 'group' || msg.chat.type === 'supergroup';
  const isPrivate = msg.chat.type === 'private';
  const text = msg.text || msg.caption || '';
  const threadId = msg.message_thread_id;

  // 1. РЕДАГУВАННЯ ТЕКСТІВ ЧЕРЕЗ REPLY
  if (isGroup && msg.reply_to_message && msg.reply_to_message.from.is_bot) {
    const repliedText = msg.reply_to_message.text || msg.reply_to_message.caption || '';
    if (repliedText && repliedText.includes("Надішліть новий текст привітання")) {
      groupWelcomeCache.set(chatId, text);
      const sent = await tg(BOT_TOKEN, 'sendMessage', { chat_id: chatId, message_thread_id: threadId, text: "✅ **Вітальний текст успішно оновлено!**", parse_mode: 'Markdown' });
      if (sent?.result?.message_id) deleteMessageDelayed(BOT_TOKEN, chatId, sent.result.message_id, 5000);
      await tg(BOT_TOKEN, 'deleteMessage', { chat_id: chatId, message_id: messageId });
      return;
    }
    if (repliedText && repliedText.includes("Надішліть новий текст правил")) {
      groupRulesCache.set(chatId, text);
      const sent = await tg(BOT_TOKEN, 'sendMessage', { chat_id: chatId, message_thread_id: threadId, text: "✅ **Правила успішно оновлено!**", parse_mode: 'Markdown' });
      if (sent?.result?.message_id) deleteMessageDelayed(BOT_TOKEN, chatId, sent.result.message_id, 5000);
      await tg(BOT_TOKEN, 'deleteMessage', { chat_id: chatId, message_id: messageId });
      return;
    }
  }

  // 2. КОМАНДИ
  if (text.startsWith('/')) {
    const cmdMatch = /^\/(invite|welcome|rules|start)/i.exec(text.trim());
    if (!cmdMatch) return;
    const cmd = cmdMatch[1].toLowerCase();

    if (isGroup) {
      await tg(BOT_TOKEN, 'deleteMessage', { chat_id: chatId, message_id: messageId });
    }

    if (cmd === 'start') {
      if (isPrivate) {
        const username = await getBotUsername(env);
        const kb = { inline_keyboard: [[{ text: 'дᴏдᴀᴛи', url: `https://t.me/${username}?startgroup=true` }]] };
        await tg(BOT_TOKEN, 'sendMessage', { chat_id: chatId, text: START_PUSH_TEXT, reply_markup: kb });
      }
      return;
    }

    if (!isGroup) {
      const username = await getBotUsername(env);
      const kb = { inline_keyboard: [[{ text: 'дᴏдᴀᴛи', url: `https://t.me/${username}?startgroup=true` }]] };
      await tg(BOT_TOKEN, 'sendMessage', { chat_id: chatId, text: "⚠️ Ця команда працює лише у групах.", reply_markup: kb });
      return;
    }

    if (cmd === 'invite') {
      const res = await tg(BOT_TOKEN, 'createChatInviteLink', { chat_id: chatId, name: 'Авто-інвайт', creates_join_request: true });
      const link = res?.result?.invite_link;
      let sent;
      if (link) {
        groupInviteLinksCache.set(chatId, link);
        sent = await tg(BOT_TOKEN, 'sendMessage', {
          chat_id: chatId,
          message_thread_id: threadId,
          text: `🔓 **Інвайт-посилання для цієї групи:**\n\n${link}\n\nБот автоматично прийматиме заявки та вітатиме новачків.`,
          parse_mode: 'Markdown'
        });
      } else {
        sent = await tg(BOT_TOKEN, 'sendMessage', { chat_id: chatId, message_thread_id: threadId, text: "❌ Помилка. Надайте боту права 'Запрошувати користувачів'." });
      }
      if (sent?.result?.message_id) deleteMessageDelayed(BOT_TOKEN, chatId, sent.result.message_id, 15000);
      return;
    }

    if (cmd === 'welcome') {
      const currentText = getWelcomeText(chatId);
      await tg(BOT_TOKEN, 'sendMessage', {
        chat_id: chatId,
        message_thread_id: threadId,
        text: `📝 **Поточний текст привітання:**\n\n${currentText}`,
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[{ text: '✏️ Редагувати', callback_data: 'edit_welcome' }]] }
      });
      return;
    }

    if (cmd === 'rules') {
      const currentRules = getRulesText(chatId);
      await tg(BOT_TOKEN, 'sendMessage', {
        chat_id: chatId,
        message_thread_id: threadId,
        text: `⚠️ **Поточні правила групи:**\n\n${currentRules}`,
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[{ text: '✏️ Редагувати', callback_data: 'edit_rules' }]] }
      });
      return;
    }
  }

  // 3. РАНДОМНІ РЕАКЦІЇ (тепер і для анонімних адмінів)
  if (isGroup && !msg.from?.is_bot) {
    // Обычное сообщение от реального пользователя
    const emoji = ALL_REACTIONS[Math.floor(Math.random() * ALL_REACTIONS.length)];
    await tg(BOT_TOKEN, 'setMessageReaction', {
      chat_id: chatId,
      message_id: messageId,
      reaction: [{ type: 'emoji', emoji }]
    });
  } else if (isGroup && msg.sender_chat) {
    // Сообщение от имени группы/канала (анонимный админ)
    const emoji = ALL_REACTIONS[Math.floor(Math.random() * ALL_REACTIONS.length)];
    await tg(BOT_TOKEN, 'setMessageReaction', {
      chat_id: chatId,
      message_id: messageId,
      reaction: [{ type: 'emoji', emoji }]
    });
  }

  // 4. ШІ-ВІДПОВІДІ
  if (text && (isPrivate || (isGroup && /[?？]/.test(text)))) {
    const reply = await getGroqReply(text, GROQ_API_KEY);
    await tg(BOT_TOKEN, 'sendMessage', {
      chat_id: chatId,
      message_thread_id: threadId,
      text: reply,
      reply_to_message_id: messageId
    });
  }
}

// =====================================================================
// ДИСПЕТЧЕР ОНОВЛЕНЬ
// =====================================================================
async function handleUpdate(update, env) {
  const { BOT_TOKEN } = env;

  // --- Бота додали в групу ---
  if (update.my_chat_member) {
    const myChatMember = update.my_chat_member;
    const newStatus = myChatMember.new_chat_member.status;
    const oldStatus = myChatMember.old_chat_member.status;
    
    const isAdded = (oldStatus === 'left' || oldStatus === 'kicked') && 
                    (newStatus === 'member' || newStatus === 'administrator');

    if (isAdded) {
      const chatId = myChatMember.chat.id;
      await tg(BOT_TOKEN, 'sendMessage', {
        chat_id: chatId,
        text: WELCOME_TEXT_DEFAULT,
        reply_markup: {
          inline_keyboard: [[{ text: 'пᴘᴀʙиʌᴀ', callback_data: 'show_rules' }]]
        }
      });
    }
    return;
  }

  // --- Кнопки (Callback Queries) ---
  if (update.callback_query) {
    const cb = update.callback_query;
    const chatId = cb.message.chat.id;
    const threadId = cb.message.message_thread_id;

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

  // --- Заявка на вступ ---
  if (update.chat_join_request) {
    const req = update.chat_join_request;
    const userId = req.from.id;
    const chatId = req.chat.id;

    await tg(BOT_TOKEN, 'sendMessage', {
      chat_id: userId,
      text: `👋 **Вітаємо!**\n\n${START_PUSH_TEXT}\n\n⚠️ **Правила спільноти:**\n${getRulesText(chatId)}`,
      parse_mode: 'Markdown'
    });

    await tg(BOT_TOKEN, 'approveChatJoinRequest', { chat_id: chatId, user_id: userId });

    const name = req.from.first_name || 'користувач';
    await tg(BOT_TOKEN, 'sendMessage', {
      chat_id: chatId,
      text: `Вітаємо, [${name}](tg://user?id=${userId})!\n\n${getWelcomeText(chatId)}`,
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [[{ text: 'пᴘᴀʙиʌᴀ', callback_data: 'show_rules' }]] }
    });
    return;
  }

  // --- Повідомлення (всі типи) ---
  const msg = update.message || update.edited_message || update.channel_post || update.edited_channel_post;
  if (msg) {
    await handleMessage(msg, env);
  }
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'POST') {
      try {
        const update = await request.json();
        ctx.waitUntil(handleUpdate(update, env));
      } catch (e) {
        console.error('Webhook Error:', e);
      }
    }
    return new Response('OK', { status: 200 });
  }
};