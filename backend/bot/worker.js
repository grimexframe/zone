// ===== КОНСТАНТИ =====
const SYSTEM_PROMPT = `Відповідай корисно, культурно, українською мовою, коротко (до 100 слів).`;
const RULES_TEXT = `ᴘᴇᴋʌᴀᴍᴀ / пᴏʌіᴛиᴋᴀ - зᴀбᴏᴘᴏнᴇні.\n\nᴀᴘхіʙ ᴄᴛᴘуᴋᴛуᴘᴏʙᴀних ᴍᴀᴛᴇᴘіᴀʌіʙ`;
const GROUP_CHAT_ID = -1003904095389;

// --- ВАШИ ПРАВИЛЬНЫЕ ID (уже исправлены) ---
const ADMIN_ID = 8382236562;
const AUTH_TOPIC_ID = 20803;
const ARTS_TOPIC_ID = 20827;           // ID топика для артов

// ⚠️ ЗАПОВНИ ЦІ ДВА ID! Це ID тем "Ask" і "Fonts" у твоєму особистому чаті з ботом
// (Settings → там де ти вмикав теми у своєму приваті). Дізнатись ID теми можна,
// написавши будь-що в потрібну тему і подивившись update.message.message_thread_id в логах Worker'а.
const ASK_TOPIC_ID = 0;                // TODO: встав реальний ID теми "Ask"
const FONTS_TOPIC_ID = 0;              // TODO: встав реальний ID теми "Fonts"
// --- КОНЕЦ ID ---

// Мета-інформація і інструкції по темах приватного чату адміна
const TOPIC_META = {
  [AUTH_TOPIC_ID]: {
    mode: 'log',
    instructions:
      `🔐 ᴛᴇᴍᴀ ᴀʙᴛᴏᴘизᴀцій.\n\n` +
      `ᴄюди бᴏᴛ ᴀʙᴛᴏᴍᴀᴛичнᴏ ᴋидᴀє пᴏʙідᴏмʌᴇння пᴘᴏ ᴋᴏжну ᴀʙᴛᴏᴘизᴀцію нᴀ ᴄᴀйᴛі. ` +
      `ᴘучнᴏ писᴀᴛи ᴛуᴛ нᴇ ᴛᴘᴇбᴀ — цᴇ ʌᴏг.`
  },
  [ASK_TOPIC_ID]: {
    mode: 'ai-all',
    instructions:
      `💬 ᴛᴇᴍᴀ ᴀsᴋ.\n\n` +
      `ᴛуᴛ ІІ ʙідпᴏʙідᴀє нᴀ ᴀбᴄᴏʌюᴛнᴏ ʙᴄᴇ, щᴏ ᴛи нᴀпишᴇш — нᴇ пᴏᴛᴘібнᴏ ᴄᴛᴀʙиᴛи "?". ` +
      `пᴘᴏᴄᴛᴏ пиши питᴀння чи ᴘᴇпʌіᴋу.`
  },
  [ARTS_TOPIC_ID]: {
    mode: 'log',
    instructions:
      `🎨 ᴛᴇᴍᴀ ᴀᴘᴛів.\n\n` +
      `ᴀᴘᴛи, нᴀдіᴄʌᴀні чᴇᴘᴇз ᴄᴀйᴛ grimexframe.help, ᴀʙᴛᴏᴍᴀᴛичнᴏ зʼяʙʌяюᴛьᴄя ᴛуᴛ і ᴏднᴏчᴀᴄнᴏ ` +
      `зᴀᴄᴏʙуюᴛьᴄя у ᴘᴏздіʌі Paint нᴀ ᴄᴀйᴛі. нᴀдᴄиʌᴀᴛи ᴀᴘᴛи ᴛᴘᴇбᴀ чᴇᴘᴇз ᴄᴀйᴛ, нᴇ ᴄюди у чᴀᴛ.`
  },
  [FONTS_TOPIC_ID]: {
    mode: 'command-only',
    instructions:
      `🔤 ᴛᴇᴍᴀ ꜰᴏɴᴛs.\n\n` +
      `ᴋᴏмᴀндᴀ: /fonts <ᴛᴇᴋᴄᴛ>\n` +
      `пᴘиᴋʌᴀд: /fonts привіт світ\n` +
      `ᴘᴇзуʌьᴛᴀᴛ: ${'привіт світ'}`
  }
};

const groupMembers = new Set();

// ===== FONT STYLER (маленькі капіталі, той самий стиль, що вже юзається в RULES_TEXT) =====
const SMALLCAPS_MAP = {
  // Latin
  a: 'ᴀ', b: 'ʙ', c: 'ᴄ', d: 'ᴅ', e: 'ᴇ', f: 'ꜰ', g: 'ɢ', h: 'ʜ', i: 'ɪ', j: 'ᴊ',
  k: 'ᴋ', l: 'ʟ', m: 'ᴍ', n: 'ɴ', o: 'ᴏ', p: 'ᴘ', q: 'ǫ', r: 'ʀ', s: 's', t: 'ᴛ',
  u: 'ᴜ', v: 'ᴠ', w: 'ᴡ', x: 'x', y: 'ʏ', z: 'ᴢ',
  // Кирилиця (той самий "лук", що вже присутній у RULES_TEXT: п,и,н,б,с лишаються як є, бо для них
  // нема гарного unicode-відповідника у капіталях; решта мапиться на схожі латинські малі капіталі)
  а: 'ᴀ', б: 'б', в: 'ʙ', г: 'г', д: 'д', е: 'ᴇ', ё: 'ё', ж: 'ж', з: 'з', и: 'и',
  й: 'й', к: 'ᴋ', л: 'ʌ', м: 'ᴍ', н: 'н', о: 'ᴏ', п: 'п', р: 'ᴘ', с: 'ᴄ', т: 'ᴛ',
  у: 'ᴜ', ф: 'ф', х: 'x', ц: 'ц', ч: 'ч', ш: 'ш', щ: 'щ', ъ: 'ъ', ы: 'ы', ь: 'ь',
  э: 'э', ю: 'ю', я: 'я', і: 'і', ї: 'ї', є: 'є', ґ: 'ґ'
};

function toSmallCaps(text) {
  return text
    .split('')
    .map(ch => SMALLCAPS_MAP[ch.toLowerCase()] || ch)
    .join('');
}

const FONTS_EXAMPLE_SOURCE = 'привіт світ';

function fontsUsageMessage() {
  return (
    `ᴠᴋᴀжи ᴛᴇᴋᴄᴛ пісʌя ᴋᴏмᴀнди, нᴀпᴘиᴋʌᴀд:\n` +
    `/fonts ${FONTS_EXAMPLE_SOURCE}\n\n` +
    `ᴘᴇзуʌьᴛᴀᴛ:\n${toSmallCaps(FONTS_EXAMPLE_SOURCE)}`
  );
}

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

// ===== ОБРОБКА ОНОВЛЕНЬ =====
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

  // Заявка на вступ (АВТОПРИЙОМ)
  if (update.chat_join_request) {
    const req = update.chat_join_request;
    const userId = req.from.id;
    const chatId = req.chat.id;
    const userChatId = req.user_chat_id;

    await tg(BOT_TOKEN, 'approveChatJoinRequest', { chat_id: chatId, user_id: userId });
    groupMembers.add(userId);

    try {
      await tg(BOT_TOKEN, 'sendMessage', { chat_id: userChatId, text: '✅ зᴀявку схвᴀʌᴇно!' });
    } catch (e) {
      console.error('welcome DM error:', e);
    }

    // ВЕЛКОМ + ПРАВИЛА (кнопка)
    await tg(BOT_TOKEN, 'sendMessage', {
      chat_id: chatId,
      text: `ᴡᴇʟᴄᴏᴍᴇ, [${req.from.first_name}](tg://user?id=${userId})!\n\n` +
            `ᴘᴀді зустᴘіᴛи ᴛᴇбᴇ у нᴀшій ᴋᴏмʼюніᴛі 🎉\n` +
            `ᴏзнᴀйᴏмся з пᴘᴀʙиʌᴀми нижчᴇ, пᴏᴛім мᴏжᴇш пᴏчинᴀᴛи спіʌᴋуʙᴀᴛися ʙ ᴛᴇмᴀх.`,
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

  // Адмінська команда: розіслати/оновити інструкції у всіх темах приватного чату з ботом
  if (update.message?.text?.trim() === '/setup_topics' && update.message.from.id === ADMIN_ID) {
    for (const [topicId, meta] of Object.entries(TOPIC_META)) {
      const id = Number(topicId);
      if (!id) continue; // пропускаємо не заповнені (0) ID
      try {
        await tg(BOT_TOKEN, 'sendMessage', {
          chat_id: ADMIN_ID,
          message_thread_id: id,
          text: meta.instructions
        });
      } catch (e) {
        console.error(`setup_topics error for topic ${id}:`, e);
      }
    }
    await tg(BOT_TOKEN, 'sendMessage', { chat_id: ADMIN_ID, text: '✅ інструкції розіслані по темах.' });
    return;
  }

  // НОВА ТЕМА ФОРУМУ СТВОРЕНА — якщо це одна з відомих тем, шлемо її інструкцію;
  // якщо невідома — шлемо загальний текст-заглушку.
  if (update.message?.forum_topic_created) {
    const msg = update.message;
    const meta = TOPIC_META[msg.message_thread_id];
    try {
      await tg(BOT_TOKEN, 'sendMessage', {
        chat_id: msg.chat.id,
        message_thread_id: msg.message_thread_id,
        text: meta ? meta.instructions : 'ᴠіᴛᴀємᴏ у ноʙій ᴛᴇмі! 👋'
      });
    } catch (e) {
      console.error('topic instructions error:', e);
    }
    return;
  }

  // Повідомлення
  if (update.message?.text) {
    const msg = update.message;
    const userId = msg.from.id;
    const chatType = msg.chat.type;
    const isGroupChat = chatType === 'group' || chatType === 'supergroup';
    const isPrivate = chatType === 'private';

    // В особистих — перевіряємо підписку
    if (isPrivate) {
      const isMember = await isGroupMember(userId, BOT_TOKEN);
      if (!isMember) {
        await tg(BOT_TOKEN, 'sendMessage', {
          chat_id: msg.chat.id,
          text: '⛔ ᴛіʌьᴋи дʌя учᴀᴄниᴋɪʙ зᴀᴋᴘиᴛᴏгᴏ ᴋʌубу'
        });
        return;
      }
    }

    // Перевірка посилань — РЕАКЦІЯ СТАВИТЬСЯ ЗАВЖДИ (Safe Browsing лише уточнює емодзі, якщо ключ є)
    if (msg.entities) {
      const urls = [];
      for (const e of msg.entities) {
        if (e.type === 'url') urls.push(msg.text.substring(e.offset, e.offset + e.length));
        else if (e.type === 'text_link') urls.push(e.url);
      }
      if (urls.length > 0) {
        let emoji = '⚡';
        if (GOOGLE_SAFE_BROWSING_API_KEY) {
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
            emoji = sbData.matches?.length > 0 ? '💩' : '⚡';
          } catch (e) {
            console.error('safebrowsing error:', e);
          }
        }
        try {
          await tg(BOT_TOKEN, 'setMessageReaction', {
            chat_id: msg.chat.id,
            message_id: msg.message_id,
            reaction: [{ type: 'emoji', emoji }]
          });
        } catch (e) {
          console.error('setMessageReaction error:', e);
        }
      }
    }

    // /fonts — стайлер тексту (працює всюди; в темі Fonts саме на цю команду й розрахована тема)
    const isFontsCommand = /^\/fonts?(@\w+)?/i.test(msg.text);
    if (isFontsCommand) {
      const raw = msg.text.replace(/^\/fonts?(@\w+)?\s*/i, '');
      const source = raw || msg.reply_to_message?.text || '';
      const reply = source ? `${toSmallCaps(source)}` : fontsUsageMessage();
      await tg(BOT_TOKEN, 'sendMessage', {
        chat_id: msg.chat.id,
        text: reply,
        reply_to_message_id: msg.message_id,
        message_thread_id: msg.message_thread_id
      });
      return;
    }

    // Спеціальна поведінка для відомих тем приватного чату адміна
    const topicMeta = isPrivate ? TOPIC_META[msg.message_thread_id] : null;
    if (topicMeta) {
      if (topicMeta.mode === 'command-only') {
        // Тема Fonts: якщо це не /fonts — нагадуємо, як користуватись
        await tg(BOT_TOKEN, 'sendMessage', {
          chat_id: msg.chat.id,
          text: fontsUsageMessage(),
          reply_to_message_id: msg.message_id,
          message_thread_id: msg.message_thread_id
        });
        return;
      }
      if (topicMeta.mode === 'log') {
        // Теми Auth / Arts: це лог-фіди, ІІ тут не треба, просто нагадуємо про призначення теми
        await tg(BOT_TOKEN, 'sendMessage', {
          chat_id: msg.chat.id,
          text: topicMeta.instructions,
          reply_to_message_id: msg.message_id,
          message_thread_id: msg.message_thread_id
        });
        return;
      }
      // mode === 'ai-all' (тема Ask) — падаємо далі у звичайну логіку ІІ, вона відповість на все
    }

    // ШІ відповідь: у приваті (в т.ч. у темі Ask) — завжди, у групах — тільки якщо є "?"
    const hasQuestionMark = /[?？]/.test(msg.text);
    if (!isGroupChat || hasQuestionMark) {
      const reply = await getGroqReply(msg.text, GROQ_API_KEY);
      await tg(BOT_TOKEN, 'sendMessage', {
        chat_id: msg.chat.id,
        text: reply,
        reply_to_message_id: msg.message_id,
        message_thread_id: msg.message_thread_id
      });
    }
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

    // 2. Відправка арта (з сайту grimexframe.help — арт зберігається в Paint на сайті,
    //    і одночасно дублюється сюди в тему Arts для перегляду)
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
        telegramForm.append('caption', `🎨 Новий арт від: ${userName} (збережено в Paint на grimexframe.help)`);

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
      } catch (e) {
        console.error('handleUpdate error:', e);
      }
      return new Response('OK');
    }

    return new Response('OK');
  }
};
