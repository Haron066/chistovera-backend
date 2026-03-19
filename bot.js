const { createClient } = require('@supabase/supabase-js');
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');

// ==========================================
// 1. КОНФИГУРАЦИЯ И ПОДКЛЮЧЕНИЕ
// ==========================================
const token = (process.env.BOT_TOKEN || '8270034848:AAF9wQm0meVJ1jeflutjZfOO3OTG-_3QLfk').trim();
const adminId = '593064482';

// ⚠️ Убедись, что тут правильная ссылка на твой Render сервер
const RENDER_URL = process.env.RENDER_EXTERNAL_URL || 'https://chistovera-backend.onrender.com'; 

const supabaseUrl = 'https://gpreejfftspjqarthpfp.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdwcmVlamZmdHNwanFhcnRocGZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyNzM4MDUsImV4cCI6MjA4Nzg0OTgwNX0.6u9FNjZLW3AVDY_RNLq4Dm8Yn4XC5JsI84aQlUKXI7c';

// Подключаем базу данных
const supabase = createClient(supabaseUrl, supabaseKey);

// Создаем бота и сервер
const bot = new TelegramBot(token); 
const app = express();
app.use(express.json());

// Настраиваем Webhooks (Телеграм сам будет слать сюда сообщения)
bot.setWebHook(`${RENDER_URL}/bot${token}`);
console.log(`✅ Webhook установлен на: ${RENDER_URL}/bot${token}`);

// Слушаем сервер Телеграма
app.post(`/bot${token}`, (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
});

// Страница-будильник (чтобы Render не засыпал)
app.get('/', (req, res) => {
    res.send('ЧистоВера Webhook Бот работает стабильно 24/7!');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ Сервер запущен на порту ${PORT}`);
});


// ==========================================
// 2. ОСНОВНЫЕ КОМАНДЫ БОТА
// ==========================================

// Прием данных из мини-приложения
bot.on('web_app_data', async (msg) => {
    try {
        const data = msg.web_app_data.data;
        await bot.sendMessage(adminId, `🔔 УВЕДОМЛЕНИЕ ОТ КЛИЕНТА (Из приложения):\n\n👤 Имя: ${msg.from.first_name}\n📍 ${data}`);
    } catch (e) {
        console.error("Ошибка WebApp:", e.message);
    }
});

// КОМАНДА /START (С РЕФЕРАЛЬНОЙ СИСТЕМОЙ)
bot.onText(/\/start(?: (.+))?/, async (msg, match) => {
    const tgId = String(msg.from.id);
    const referrerId = match[1]; // Достаем ID того, кто пригласил (если есть)

    // Если человек перешел по ссылке друга (и это не он сам)
    if (referrerId && referrerId !== tgId) {
        try {
            // Проверяем, есть ли этот новый клиент уже в базе
            const { data: existing } = await supabase.from('clients').select('tg_id').eq('tg_id', tgId).single();
            if (!existing) {
                // Если нет — сохраняем его и записываем, кто его пригласил
                await supabase.from('clients').insert({ 
                    tg_id: tgId, 
                    referred_by: referrerId,
                    name: msg.from.first_name || 'Клиент',
                    username: msg.from.username || ''
                });
                console.log(`Новый клиент ${tgId} пришел от ${referrerId}`);
            }
        } catch (e) {
            console.error("Ошибка рефералки:", e.message);
        }
    }

    bot.sendMessage(msg.chat.id, `Привет, ${msg.from.first_name}! 🌸\n\nДобро пожаловать в сервис "ЧистоВера".\nМы берем на себя заботу о чистоте вашего дома.\n\nИспользуйте кнопку меню ниже, чтобы открыть приложение.`);
});


// ==========================================
// 3. ОБРАБОТЧИК INLINE-КНОПОК ИЗ ЧАТА
// ==========================================
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;
    const data = query.data; // 'trash_yes' или 'trash_no'
    const tgId = String(query.from.id);

    try {
        // 1. Проверяем АВАРИЙНЫЙ РУБИЛЬНИК
        const { data: sys } = await supabase.from('app_settings').select('is_paused').eq('id', 1).single();
        if (sys && sys.is_paused) {
            return bot.answerCallbackQuery(query.id, { text: "🛠 Идут технические работы. Бот временно остановлен.", show_alert: true });
        }

        // 2. Достаем клиента из базы
        const { data: client } = await supabase.from('clients').select('*').eq('tg_id', tgId).single();
        if (!client) return bot.answerCallbackQuery(query.id, { text: "Пользователь не найден!" });

        // ЕСЛИ КЛИЕНТ НАЖАЛ "ВЫСТАВИЛ ПАКЕТЫ"
        if (data === 'trash_yes') {
            if (client.sub_type === '5days' && client.weekly_clicks >= 5) {
                return bot.answerCallbackQuery(query.id, { text: "⚠️ Ваш лимит (5 из 5) на этой неделе исчерпан!", show_alert: true });
            }

            const newClicks = client.weekly_clicks + 1;
            await supabase.from('clients').update({ trash_out_today: true, weekly_clicks: newClicks }).eq('tg_id', tgId);

            await bot.editMessageText(`✅ **Принято!** Курьер заедет за вашими пакетами.`, {
                chat_id: chatId, message_id: messageId, parse_mode: 'Markdown'
            });

            bot.answerCallbackQuery(query.id);
            bot.sendMessage(adminId, `🔔 ВЫСТАВИЛ МУСОР (Из чата):\n📍 ${client.address}\n👤 ${client.name}`);
        } 
        
        // ЕСЛИ КЛИЕНТ НАЖАЛ "СЕГОДНЯ БЕЗ МУСОРА"
        else if (data === 'trash_no') {
            await bot.editMessageText(`❌ **Поняли вас!** Сегодня курьер к вам не заезжает. Хорошего вечера!`, {
                chat_id: chatId, message_id: messageId, parse_mode: 'Markdown'
            });
            bot.answerCallbackQuery(query.id);
        }

    } catch (e) {
        console.error("Ошибка обработки Inline-кнопки:", e.message);
        bot.answerCallbackQuery(query.id, { text: "Произошла ошибка. Попробуйте через приложение." });
    }
});


// ==========================================
// 4. ТАЙМЕР (УВЕДОМЛЕНИЯ ЗА 30 МИНУТ + СБРОСЫ)
// ==========================================
setInterval(async () => {
    try {
        // 1. ПРОВЕРКА РУБИЛЬНИКА
        const { data: sys } = await supabase.from('app_settings').select('is_paused').eq('id', 1).single();
        if (sys && sys.is_paused) return; 

        // 2. РАСЧЕТ ВРЕМЕНИ
        const now = new Date();
        const targetDate = new Date(now.getTime() + 30 * 60000); 
        
        const targetTimeStr = targetDate.toLocaleTimeString('ru-RU', {
            timeZone: 'Europe/Moscow',
            hour: '2-digit',
            minute: '2-digit'
        });

        const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Moscow' });

        // 3. ДОСТАЕМ КЛИЕНТОВ НА ЭТО ВРЕМЯ
        const { data: clientsToRemind } = await supabase
            .from('clients')
            .select('*')
            .eq('schedule', targetTimeStr)
            .neq('sub_type', 'none');

        // 4. РАССЫЛКА УВЕДОМЛЕНИЙ
        if (clientsToRemind && clientsToRemind.length > 0) {
            for (const client of clientsToRemind) {
                if (client.sub_end_date && client.sub_end_date < todayStr) continue;
                if (client.trash_out_today) continue;
                if (client.sub_type === '5days' && client.weekly_clicks >= 5) continue;

                const msgText = `🔔 <b>Напоминание от ЧистоВера!</b>\n\nЧерез 30 минут (в ${client.schedule}) приедет курьер за вашим мусором.\n\nПожалуйста, выставьте пакеты за дверь и нажмите кнопку ниже:`;
                
                const keyboard = {
                    inline_keyboard: [
                        [{ text: '✅ Выставил пакеты', callback_data: 'trash_yes' }],
                        [{ text: '❌ Сегодня без мусора', callback_data: 'trash_no' }]
                    ]
                };

                await bot.sendMessage(client.tg_id, msgText, { 
                    parse_mode: 'HTML',
                    reply_markup: JSON.stringify(keyboard)
                });
            }
        }

        // ==========================================
        // 5. ЕЖЕДНЕВНЫЙ И ЕЖЕНЕДЕЛЬНЫЙ СБРОС (Полночь)
        // ==========================================
        const moscowTime = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Moscow" }));
        
        if (moscowTime.getHours() === 0 && moscowTime.getMinutes() === 0) {
            await supabase.from('clients').update({ trash_out_today: false, trash_not_found: false }).neq('tg_id', '0');
            console.log("✅ Ежедневный сброс выполнен");

            if (moscowTime.getDay() === 1) { 
                await supabase.from('clients').update({ weekly_clicks: 0 }).eq('sub_type', '5days');
                console.log("✅ Еженедельный сброс лимитов выполнен");
            }
        }
    } catch (e) {
        console.error("Ошибка в таймере:", e.message);
    }
}, 60000);
