// ===== КОНСТАНТИ =====
const SYSTEM_PROMPT = `Відповідай корисно, культурно, українською мовою, коротко (до 100 слів).`;
const RULES_TEXT = `ᴘᴇᴋʌᴀᴍᴀ / пᴏʌіᴛиᴋᴀ - зᴀбᴏᴘᴏнᴇні.\n\nᴀᴘхіʙ ᴄᴛᴘуᴄᴛуᴘᴏʙᴀних ᴍᴀᴛᴇᴘіᴀʌіʙ`;
const GROUP_CHAT_ID = -1003821287920;
const CHANNEL_USERNAME = 'n5Qg8d2h9qliMmRi';

// --- ОБНОВЛЕННЫЕ ID ТОПИКОВ ---
const ADMIN_ID = 8382236562;
const TOPIC_ASK = 33260;
const TOPIC_OUT = 33259;
const TOPIC_ARTS = 33261;
const TOPIC_FONT = 34051;

// --- FONT STYLER MAPPING (из index.html) ---
const FONT_MAP = {
    'А': 'ᴀ', 'а': 'ᴀ', 'В': 'в', 'в': 'ʙ', 'Е': 'ᴇ', 'е': 'ᴇ', 'К': 'ᴋ', 'к': 'ᴋ',
    'М': 'ᴍ', 'м': 'ᴍ', 'О': 'ᴏ', 'о': 'ᴏ', 'Р': 'ᴘ', 'р': 'ᴘ', 'С': 'ᴄ', 'с': 'ᴄ',
    'Т': 'т', 'т': 'ᴛ', 'Н': 'н', 'н': 'н', 'І': 'і', 'і': 'і', 'У': 'у', 'у': 'у',
    'Л': 'ʌ', 'л': 'ʌ', 'A': 'ᴀ', 'a': 'ᴀ', 'B': 'ʙ', 'b': 'ʙ', 'C': 'ᴄ', 'c': 'ᴄ',
    'D': 'ᴅ', 'd': 'ᴅ', 'E': 'ᴇ', 'e': 'ᴇ', 'F': 'ꜰ', 'f': 'ꜰ', 'G': 'ɢ', 'g': 'ɢ',
    'H': 'ʜ', 'h': 'ʜ', 'I': 'ɪ', 'i': 'ɪ', 'J': 'ᴊ', 'j': 'ᴊ', 'K': 'ᴋ', 'k': 'ᴋ',
    'L': 'ʟ', 'l': 'ʟ', 'M': 'ᴍ', 'm': 'ᴍ', 'N': 'ɴ', 'n': 'ɴ', 'O': 'ᴏ', 'o': 'ᴏ',
    'P': 'ᴘ', 'p': 'ᴘ', 'Q': 'ǫ', 'q': 'ǫ', 'R': 'ʀ', 'r': 'ʀ', 'S': 'ꜱ', 's': 'ꜱ',
    'T': 'ᴛ', 't': 'ᴛ', 'U': 'ᴜ', 'u': 'ᴜ', 'V': 'ᴠ', 'v': 'ᴠ', 'W': 'ᴡ', 'w': 'ᴡ',
    'X': 'x', 'x': 'x', 'Y': 'ʏ', 'y': 'ʏ', 'Z': 'ᴢ', 'z': 'ᴢ',
};

function convertTextToFont(text) {
    return text.split('').map(char => FONT_MAP[char] || FONT_MAP[char.toUpperCase()] || char).join('');
}

// --- ХРАНИЛИЩЕ ПОЛЬЗОВАТЕЛЕЙ И ТОПИКОВ ---
const userTopics = new Map(); // userID -> { ask, font, arts }
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

// ===== ПЕРЕВІРКА ПІДПИСКИ (З ДЕБАГОМ) =====
async function isGroupMember(userId, token) {
    if (groupMembers.has(userId)) return true;
    try {
        console.log(`🔍 [DEBUG] Checking membership for user ${userId} in chat ${GROUP_CHAT_ID}`);
        const res = await tg(token, 'getChatMember', { chat_id: GROUP_CHAT_ID, user_id: userId });
        console.log(`🔍 [DEBUG] getChatMember raw result:`, JSON.stringify(res));

        if (!res.ok) {
            console.error(`❌ [DEBUG] Telegram API error:`, res.description);
            return false;
        }

        const status = res.result?.status;
        const ok = ['member', 'administrator', 'creator'].includes(status) ||
                    (status === 'restricted' && res.result?.is_member === true);
        
        if (ok) groupMembers.add(userId);
        return ok;
    } catch (e) {
        console.error('💥 [DEBUG] isGroupMember exception:', e);
        return false;
    }
}

// ===== СОЗДАНИЕ ТОПИКОВ ДЛЯ ПОЛЬЗОВАТЕЛЯ =====
async function createUserTopics(userId, token) {
    if (userTopics.has(userId)) {
        console.log(`✅ [TOPICS] User ${userId} already has topics`);
        return userTopics.get(userId);
    }

    try {
        console.log(`🆕 [TOPICS] Creating topics for user ${userId}...`);
        
        const topics = {};

        // Создаем топик 'ask'
        const askRes = await tg(token, 'createForumTopic', {
            chat_id: userId,
            name: 'ask',
            icon_color: 16711680
        });
        if (askRes.ok) {
            topics.ask = askRes.result.message_thread_id;
            console.log(`✅ [TOPICS] Created 'ask' topic: ${topics.ask}`);
        }

        // Создаем топик 'font'
        const fontRes = await tg(token, 'createForumTopic', {
            chat_id: userId,
            name: 'font',
            icon_color: 65280
        });
        if (fontRes.ok) {
            topics.font = fontRes.result.message_thread_id;
            console.log(`✅ [TOPICS] Created 'font' topic: ${topics.font}`);
        }

        // Создаем топик 'arts'
        const artsRes = await tg(token, 'createForumTopic', {
            chat_id: userId,
            name: 'arts',
            icon_color: 255
        });
        if (artsRes.ok) {
            topics.arts = artsRes.result.message_thread_id;
            console.log(`✅ [TOPICS] Created 'arts' topic: ${topics.arts}`);
        }

        userTopics.set(userId, topics);
        return topics;
    } catch (e) {
        console.error('💥 [TOPICS] Failed to create topics:', e);
        return null;
    }
}

// ===== ПОЛУЧЕНИЕ АРТОВ ПОЛЬЗОВАТЕЛЯ ИЗ FIRESTORE =====
async function getUserArts(userId) {
    try {
        console.log(`🎨 [ARTS] Fetching arts for user ${userId}...`);
        
        const { initializeApp, getApps, getApp } = await import('https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js');
        const { getFirestore, collection, query, where, getDocs, orderBy } = await import('https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js');
        
        const firebaseConfig = {
            apiKey: 'AIzaSyD7HW4Ec9n3vl5l_WgTSwiK5NpyQYE6tlU',
            authDomain: 'helper-e10b2.firebaseapp.com',
            projectId: 'helper-e10b2',
            storageBucket: 'helper-e10b2.firebasestorage.app',
            messagingSenderId: '131536876451',
            appId: '1:131536876451:web:eeaef494c83dfc4849e016'
        };
        
        const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
        const db = getFirestore(app);
        
        // Ищем арты этого пользователя в истории (сохранены в paint.js)
        const historyRef = collection(db, 'global_canvas', 'current', 'history');
        const q = query(historyRef, where('authorId', '==', Number(userId)), orderBy('timestamp', 'desc'));
        const snap = await getDocs(q);
        
        const arts = [];
        snap.forEach((doc) => {
            const data = doc.data();
            if (data.imageUrl) {
                arts.push({
                    url: data.imageUrl,
                    author: data.authorName || 'ANON',
                    timestamp: data.timestamp
                });
            }
        });
        
        console.log(`✅ [ARTS] Found ${arts.length} arts for user ${userId}`);
        return arts;
    } catch (e) {
        console.error('💥 [ARTS] Error fetching arts:', e);
        return [];
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

    // Кнопка проверки подписки
    if (update.callback_query?.data === 'check_membership') {
        const userId = update.callback_query.from.id;
        const callbackQueryId = update.callback_query.id;
        
        const isMember = await isGroupMember(userId, BOT_TOKEN);
        
        if (isMember) {
            await tg(BOT_TOKEN, 'answerCallbackQuery', {
                callback_query_id: callbackQueryId,
                text: '✅ Ви учасник клубу! Тепер можете писати.',
                show_alert: true
            });
            await tg(BOT_TOKEN, 'editMessageText', {
                chat_id: update.callback_query.message.chat.id,
                message_id: update.callback_query.message.message_id,
                text: '✅ Ви учасник клубу! Тепер можете писати.'
            });
        } else {
            await tg(BOT_TOKEN, 'answerCallbackQuery', {
                callback_query_id: callbackQueryId,
                text: '❌ Ви поки не учасник. Спочатку приєднайтесь до групи.',
                show_alert: true
            });
        }
        return;
    }

    // Повідомлення
    if (update.message?.text) {
        const msg = update.message;
        const userId = msg.from.id;
        const chatType = msg.chat.type;
        const isOwner = userId === ADMIN_ID;

        // Для владельца - все без изменений
        if (isOwner) {
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

            // Для владельца - ИИ только в ask топике
            if (msg.message_thread_id === TOPIC_ASK) {
                const reply = await getGroqReply(msg.text, GROQ_API_KEY);
                await tg(BOT_TOKEN, 'sendMessage', {
                    chat_id: msg.chat.id,
                    text: reply,
                    reply_to_message_id: msg.message_id,
                    message_thread_id: msg.message_thread_id
                });
            }
            return;
        }

        // В группе - ничего не делаем
        if (chatType === 'group' || chatType === 'supergroup') {
            return;
        }

        // В личке не-владельца
        if (chatType === 'private') {
            const isMember = await isGroupMember(userId, BOT_TOKEN);
            if (!isMember) {
                await tg(BOT_TOKEN, 'sendMessage', {
                    chat_id: msg.chat.id,
                    text: '⛔ ᴛіʌьᴋи дʌя учᴀᴄниᴋɪʙ зᴀᴋᴘиᴛᴏгᴏ ᴋʌубу.\n\n👉 Долучайтесь до нашої групи, щоб спілкуватися.',
                    reply_markup: { 
                        inline_keyboard: [[
                            { text: '🚀 Вступити до групи', url: 'https://t.me/+n5Qg8d2h9qliMmRi' },
                            { text: '✅ DONE', callback_data: 'check_membership' }
                        ]] 
                    }
                });
                return;
            }

            // Создаем топики если их нет
            const topics = await createUserTopics(userId, BOT_TOKEN);

            // Обработка сообщений по топикам
            const threadId = msg.message_thread_id;

            // ask топик - ИИ отвечает
            if (threadId === topics?.ask) {
                const reply = await getGroqReply(msg.text, GROQ_API_KEY);
                await tg(BOT_TOKEN, 'sendMessage', {
                    chat_id: msg.chat.id,
                    text: reply,
                    reply_to_message_id: msg.message_id,
                    message_thread_id: threadId
                });
                return;
            }

            // font топик - редактировать текст стилем
            if (threadId === topics?.font) {
                const styledText = convertTextToFont(msg.text);
                await tg(BOT_TOKEN, 'sendMessage', {
                    chat_id: msg.chat.id,
                    text: styledText,
                    reply_to_message_id: msg.message_id,
                    message_thread_id: threadId
                });
                return;
            }

            // arts топик - выдавать сохраненные арты
            if (threadId === topics?.arts) {
                const arts = await getUserArts(userId);
                
                if (arts.length === 0) {
                    await tg(BOT_TOKEN, 'sendMessage', {
                        chat_id: msg.chat.id,
                        text: '🎨 У вас пока нет сохраненных артов.',
                        reply_to_message_id: msg.message_id,
                        message_thread_id: threadId
                    });
                } else {
                    // Отправляем первый арт как фото
                    await tg(BOT_TOKEN, 'sendPhoto', {
                        chat_id: msg.chat.id,
                        photo: arts[0].url,
                        caption: `🎨 ${arts[0].author}\n📊 Всего артов: ${arts.length}`,
                        reply_to_message_id: msg.message_id,
                        message_thread_id: threadId
                    });
                }
                return;
            }
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
                    message_thread_id: TOPIC_OUT,
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
                telegramForm.append('message_thread_id', TOPIC_ARTS);
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
