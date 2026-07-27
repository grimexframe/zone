// ===== КОНСТАНТИ =====
const SYSTEM_PROMPT = `Відповідай корисно, культурно, українською мовою, коротко (до 100 слів).`;
const RULES_TEXT = `ᴘᴇᴋʌᴀᴍᴀ / пᴏʌіᴛиᴋᴀ - зᴀбᴏᴘᴏнᴇні.\n\nᴀᴘхіʙ ᴄᴛᴘуᴋᴛуᴘᴏʙᴀних ᴍᴀᴛᴇᴘіᴀʌіʙ`;
const GROUP_CHAT_ID = -1003821287920;

// --- ВАШИ ПРАВИЛЬНЫЕ ID (уже исправлены) ---
const ADMIN_ID = 8382236562;
const AUTH_TOPIC_ID = 20803;
const ARTS_TOPIC_ID = 20827;           // ID топика для артов
// --- КОНЕЦ ID ---

const groupMembers = new Set();

// ===== TELEGRAM API (С ЛОГОМ) =====
async function tg(token, method, body) {
  console.log(`📤 [TG] Sending ${method}:`, JSON.stringify(body));
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  console.log(`📥 [TG] Response for ${method}:`, JSON.stringify(data));
  return data;
}

// ===== ПЕРЕВІРКА ПІДПИСКИ =====
async function isGroupMember(userId, token) {
  if (groupMembers.has(userId)) return true;
  try {
    const res = await tg(token, 'getChatMember', { chat_id: GROUP_CHAT_ID, user_id: userId });
    const status = res.result?.status;
    const ok = ['member', 'administrator', 'creator'].includes(status) ||
                (status === 'restricted' && res.result?.is_member === true);
    if (ok) groupMembers.add(userId);
    return ok;
  } catch (e) {
    console.error('isGroupMember error:', e);
    return false;
  }
}

// ===== GROQ =====
async function getGroqReply(userMessage, apiKey) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
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
    })
  });
  if (!res.ok) return 'спробуйте попізже 🫩';
  const data = await res.json();
  return data.choices[0]?.message?.content || 'Не вдалося отримати відповідь.';
}

// ===== ОБРОБКА ОНОВЛЕНЬ (оригінальна логіка) =====
async function handleUpdate(update, env) {
  const { BOT_TOKEN, GROQ_API_KEY, GOOGLE_SAFE_BROWSING_API_KEY } = env;

  // Inline mode
  if (update.inline_query) {
    const query = update.inline_query.query?.trim();
    if (!query) {
      await tg(BOT_TOKEN, 'answerInlineQuery', {
        inline_query_id: update.inline_query.id,
        results: [],
        cache_time: 0
      });
      return;
    }
    const reply = await getGroqReply(query, GROQ_API_KEY);
    await tg(BOT_TOKEN, 'answerInlineQuery', {
      inline_query_id: update.inline_query.id,
      results: [{
        type: 'article',
        id: '1',
        title: reply.substring(0, 60),
        description: query,
        input_message_content: {
          message_text: reply
        }
      }],
      cache_time: 0
    });
    return;
  }

  // Заявка на вступ
  if (update.chat_join_request) {
    const req = update.chat_join_request;
    const userId = req.from.id;
    const chatId = req.chat.id;
    const userChatId = req.user_chat_id;

    await tg(BOT_TOKEN, 'approveChatJoinRequest', { chat_id: chatId, user_id: userId });
    groupMembers.add(userId);

    try {
      await tg(BOT_TOKEN, 'sendMessage', { chat_id: userChatId, text: '✅ зᴀявку схвᴀʌᴇно!' });
    } catch(e) {}

    await tg(BOT_TOKEN, 'sendMessage', {
      chat_id: chatId,
      text: `ᴡᴇʟᴄᴏᴍᴇ, [${req.from.first_name}](tg://user?id=${userId})!\n\nREADME`,
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [[{ text: 'пᴘᴀʙиʌᴀ', callback_data: 'show_rules' }]] }
    });
    return;
  }

  // Кнопка правил
  if (update.callback_query?.data === 'show_rules') {
    await tg(BOT_TOKEN, 'answerCallbackQuery', {
      callback_query_id: update.callback_query.id,
      text: RULES_TEXT,
      show_alert: true
    });
    return;
  }

  // Повідомлення
  if (update.message?.text) {
    const msg = update.message;
    const userId = msg.from.id;
    const chatType = msg.chat.type;

    // В особистих — перевіряємо підписку
    if (chatType === 'private') {
      const isMember = await isGroupMember(userId, BOT_TOKEN);
      if (!isMember) {
        await tg(BOT_TOKEN, 'sendMessage', {
          chat_id: msg.chat.id,
          text: '⛔ ᴛіʌьᴋи дʌя учᴀᴄниᴋɪʙ зᴀᴋᴘиᴛᴏгᴏ ᴋʌубу'
        });
        return;
      }
    }

    // Перевірка посилань
    if (msg.entities && GOOGLE_SAFE_BROWSING_API_KEY) {
      const urls = [];
      for (const e of msg.entities) {
        if (e.type === 'url') urls.push(msg.text.substring(e.offset, e.offset + e.length));
        else if (e.type === 'text_link') urls.push(e.url);
      }
      if (urls.length > 0) {
        try {
          const sbRes = await fetch(
            `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${GOOGLE_SAFE_BROWSING_API_KEY}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                client: { clientId: 'morstrixbot', clientVersion: '1.0.0' },
                threatInfo: {
                  threatTypes: ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE'],
                  platformTypes: ['ANY_PLATFORM'],
                  threatEntryTypes: ['URL'],
                  threatEntries: urls.map(u => ({ url: u }))
                }
              })
            }
          );
          const sbData = await sbRes.json();
          const emoji = sbData.matches?.length > 0 ? '💩' : '⚡';
          await tg(BOT_TOKEN, 'setMessageReaction', {
            chat_id: msg.chat.id,
            message_id: msg.message_id,
            reaction: [{ type: 'emoji', emoji }]
          });
        } catch(e) { console.error('safebrowsing error:', e); }
      }
    }

    // ШІ відповідь
    const reply = await getGroqReply(msg.text, GROQ_API_KEY);
    await tg(BOT_TOKEN, 'sendMessage', {
      chat_id: msg.chat.id,
      text: reply,
      reply_to_message_id: msg.message_id,
      message_thread_id: msg.message_thread_id
    });
  }

  // Оновлення учасників
  if (update.chat_member) {
    const cm = update.chat_member;
    const user = cm.new_chat_member.user;
    const newStatus = cm.new_chat_member.status;
    const oldStatus = cm.old_chat_member.status;
    const wasOut = ['left', 'kicked', 'banned'].includes(oldStatus);
    const isIn = ['member', 'administrator', 'creator', 'restricted'].includes(newStatus);
    const wasIn = ['member', 'administrator', 'creator', 'restricted'].includes(oldStatus);
    const isOut = ['left', 'kicked', 'banned'].includes(newStatus);
    if (wasOut && isIn) groupMembers.add(user.id);
    if (wasIn && isOut) groupMembers.delete(user.id);
  }
}

// ===== ЕКСПОРТ (ГОЛОВНИЙ ОБРОБНИК) =====
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const method = request.method;

    console.log(`🚀 [BOT] ${method} ${url.pathname}`);

    // --- API ДЛЯ САЙТУ ---
    const SITE_API_KEY = env.SITE_API_KEY;
    const siteKey = request.headers.get('X-Site-Token');

    // 1. Сповіщення про авторизацію
    if (method === 'POST' && url.pathname === '/api/notify-auth') {
      console.log('🔔 [API] /notify-auth called');
      if (!SITE_API_KEY || siteKey !== SITE_API_KEY) {
        console.log('❌ [API] Invalid or missing SITE_API_KEY');
        return new Response('Forbidden', { status: 403 });
      }
      try {
        const data = await request.json();
        console.log(`👤 [API] Auth from: ${data.first_name} (${data.id})`);

        const result = await tg(env.BOT_TOKEN, 'sendMessage', {
          chat_id: ADMIN_ID,
          message_thread_id: AUTH_TOPIC_ID,
          text: `🔐 **Нова авторизація**\n👤 ${data.first_name}\n🆔 \`${data.id}\`\n🔗 [Профіль](tg://user?id=${data.id})`,
          parse_mode: 'Markdown'
        });
        console.log('✅ [API] Message sent:', result);
        return new Response('OK');
      } catch (e) {
        console.error('💥 [API] /notify-auth error:', e);
        return new Response('Internal Server Error', { status: 500 });
      }
    }

    // 2. Відправка арта
    if (method === 'POST' && url.pathname === '/api/send-art') {
      console.log('🎨 [API] /send-art called');
      if (!SITE_API_KEY || siteKey !== SITE_API_KEY) {
        console.log('❌ [API] Invalid or missing SITE_API_KEY');
        return new Response('Forbidden', { status: 403 });
      }
      try {
        const formData = await request.formData();
        const photo = formData.get('photo');
        const userName = formData.get('user_name') || 'Анонім';
        console.log(`🖼️ [API] Art from: ${userName}`);

        const telegramForm = new FormData();
        telegramForm.append('chat_id', ADMIN_ID);
        telegramForm.append('message_thread_id', ARTS_TOPIC_ID);
        telegramForm.append('photo', photo);
        telegramForm.append('caption', `🎨 Новий арт від: ${userName}`);

        const res = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/sendPhoto`, {
          method: 'POST',
          body: telegramForm
        });
        const result = await res.json();
        console.log('✅ [API] Photo sent:', result);
        return new Response('OK');
      } catch (e) {
        console.error('💥 [API] /send-art error:', e);
        return new Response('Internal Server Error', { status: 500 });
      }
    }

    // 3. Основний вебхук Telegram
    if (method === 'POST' && url.pathname === '/webhook') {
      try {
        const update = await request.json();
        await handleUpdate(update, env);
      } catch(e) {
        console.error('handleUpdate error:', e);
      }
      return new Response('OK');
    }

    return new Response('OK');
  }
};
