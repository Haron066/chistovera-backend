const { createClient } = require('@supabase/supabase-js');
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');

// --- КОНФИГУРАЦИЯ ---
const token = (process.env.BOT_TOKEN || '8270034848:AAF9wQm0meVJ1jeflutjZfOO3OTG-_3QLfk').trim();
const adminId = '593064482';
const RENDER_URL = process.env.RENDER_EXTERNAL_URL || 'https://chistovera-backend.onrender.com'; 

const supabaseUrl = 'https://gpreejfftspjqarthpfp.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdwcmVlamZmdHNwanFhcnRocGZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyNzM4MDUsImV4cCI6MjA4Nzg0OTgwNX0.6u9FNjZLW3AVDY_RNLq4Dm8Yn4XC5JsI84aQlUKXI7c';

const supabase = createClient(supabaseUrl, supabaseKey);

const bot = new TelegramBot(token); 
const app = express();
app.use(express.json());

bot.setWebHook(`${RENDER_URL}/bot${token}`);
console.log(`Webhook установлен на: ${RENDER_URL}/bot${token}`);

app.post(`/bot${token}`, (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
});

app.get('/', (req, res) => {
    res.send('ЧистоВера Webhook Бот работает 24/7!');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});

// ==========================================
// ЛОГИКА БОТА
// ==========================================

bot.on('web_app_data', async (msg) => {
    try {
        const data = msg.web_app_data.data;
        await bot.sendMessage(adminId, `🔔 УВЕДОМЛЕНИЕ ОТ КЛИЕНТА:\n\n👤 Имя: ${msg.from.first_name}\n📍 ${data}`);
    } catch (e) {
        console.error("Ошибка WebApp:", e.message);
    }
});

bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, `Привет, ${msg.from.first_name}! 🌸\n\nДобро пожаловать в сервис "ЧистоВера".\nМы берем на себя заботу о чистоте вашего дома.\n\nИспользуйте кнопку меню ниже, чтобы открыть приложение.`);
});

// ==========================================
// ОБРАБОТЧИК КНОПОК В ЧАТЕ (НОВОЕ)
// ==========================================
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;
    const data = query.data; // 'trash_yes' или 'trash_no'
    const tgId = String(query.from.id);

    try {
        // Достаем клиента из базы
        const { data: client } = await supabase.from('clients').select('*').eq('tg_id', tgId).single();
        if (!client) return bot.answerCallbackQuery(query.id, { text: "Пользователь не найден!" });

        // Если клиент нажал "Да, выставил"
        if (data === 'trash_yes') {
            // Проверка лимита (если тариф 5 дней)
            if (client.sub_type === '5days' && client.weekly_clicks >= 5) {
                bot.answerCallbackQuery(query.id, { text: "⚠️ Ваш лимит (5 из 5) на этой неделе исчерпан!", show_alert: true });
                return;
            }

            // Обновляем базу: ставим галочку и добавляем +1 к кликам
            const newClicks = client.weekly_clicks + 1;
            await supabase.from('clients').update({ trash_out_today: true, weekly_clicks: newClicks }).eq('tg_id', tgId);

            // Меняем текст сообщения и убираем кнопки
            await bot.editMessageText(`✅ **Принято!** Курьер заедет за вашими пакетами.`, {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'Markdown'
            });

            // Отвечаем Телеграму, что клик обработан
            bot.answerCallbackQuery(query.id);

            // Отправляем уведомление Админу
            bot.sendMessage(adminId, `🔔 ВЫСТАВИЛ МУСОР (Из чата):\n📍 ${client.address}\n👤 ${client.name}`);
        } 
        
        // Если клиент нажал "Нет мусора"
        else if (data === 'trash_no') {
            // Ничего не меняем в лимитах, просто убираем кнопки
            await bot.editMessageText(`❌ **Поняли вас!** Сегодня курьер к вам не заезжает. Хорошего вечера!`, {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'Markdown'
            });
            bot.answerCallbackQuery(query.id);
        }

    } catch (e) {
        console.error("Ошибка обработки кнопки:", e.message);
        bot.answerCallbackQuery(query.id, { text: "Произошла ошибка. Попробуйте через приложение." });
    }
});


// ==========================================
// ТАЙМЕР (УВЕДОМЛЕНИЯ ЗА 30 МИНУТ)
// ==========================================
setInterval(async () => {
    try {
        const now = new Date();
        const targetDate = new Date(now.getTime() + 30 * 60000);
        
        const targetTimeStr = targetDate.toLocaleTimeString('ru-RU', {
            timeZone: 'Europe/Moscow',
            hour: '2-digit',
            minute: '2-digit'
        });

        const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Moscow' });

        const { data: clientsToRemind } = await supabase
            .from('clients')
            .select('*')
            .eq('schedule', targetTimeStr)
            .neq('sub_type', 'none');

        if (clientsToRemind && clientsToRemind.length > 0) {
            for (const client of clientsToRemind) {
                if (client.sub_end_date && client.sub_end_date < todayStr) continue;
                if (client.trash_out_today) continue;
                if (client.sub_type === '5days' && client.weekly_clicks >= 5) continue;

                const msgText = `🔔 <b>Напоминание от ЧистоВера!</b>\n\nЧерез 30 минут (в ${client.schedule}) приедет курьер за вашим мусором.\n\nПожалуйста, выставьте пакеты за дверь и нажмите кнопку ниже:`;
                
                // === ДОБАВЛЯЕМ КНОПКИ К СООБЩЕНИЮ ===
                const keyboard = {
                    inline_keyboard: [
                        [
                            { text: '✅ Выставил пакеты', callback_data: 'trash_yes' }
                        ],
                        [
                            { text: '❌ Сегодня без мусора', callback_data: 'trash_no' }
                        ]
                    ]
                };

                await bot.sendMessage(client.tg_id, msgText, { 
                    parse_mode: 'HTML',
                    reply_markup: JSON.stringify(keyboard) // Прикрепляем кнопки
                });
            }
        }

        // СБРОС СТАТУСОВ (Полночь)
        const moscowTime = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Moscow" }));
        if (moscowTime.getHours() === 0 && moscowTime.getMinutes() === 0) {
            await supabase.from('clients').update({ trash_out_today: false, trash_not_found: false }).neq('tg_id', '0');
            if (moscowTime.getDay() === 1) { 
                await supabase.from('clients').update({ weekly_clicks: 0 }).eq('sub_type', '5days');
            }
        }
    } catch (e) {
        console.error("Ошибка в таймере:", e.message);
    }
}, 60000);
