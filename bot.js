const { createClient } = require('@supabase/supabase-js');
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');

// --- КОНФИГУРАЦИЯ ---
const token = process.env.BOT_TOKEN || '8270034848:AAF9wQm0meVJ1jeflutjZfOO3OTG-_3QLfk'; // Токен бота
const adminId = '593064482';

// ⚠️ ВАЖНО: ВСТАВЬ СЮДА СВОЮ ССЫЛКУ ИЗ RENDER (БЕЗ СЛЕША / В КОНЦЕ)
const RENDER_URL = process.env.RENDER_EXTERNAL_URL || 'https://chistovera-backend.onrender.com'; 

const supabaseUrl = 'https://gpreejfftspjqarthpfp.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdwcmVlamZmdHNwanFhcnRocGZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyNzM4MDUsImV4cCI6MjA4Nzg0OTgwNX0.6u9FNjZLW3AVDY_RNLq4Dm8Yn4XC5JsI84aQlUKXI7c';

const supabase = createClient(supabaseUrl, supabaseKey);

// Создаем бота БЕЗ polling: true
const bot = new TelegramBot(token); 
const app = express();
app.use(express.json());

// Устанавливаем Webhook
bot.setWebHook(`${RENDER_URL}/bot${token}`);
console.log(`Webhook установлен на: ${RENDER_URL}/bot${token}`);

// Принимаем запросы от Телеграма
app.post(`/bot${token}`, (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
});

// Страница для "Будильника" (чтобы бот не засыпал)
app.get('/', (req, res) => {
    res.send('ЧистоВера Webhook Бот работает 24/7!');
});

// Запуск сервера
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});

// ==========================================
// ЛОГИКА БОТА
// ==========================================

// 1. ПРИЕМ ДАННЫХ ИЗ ПРИЛОЖЕНИЯ
bot.on('web_app_data', async (msg) => {
    try {
        const data = msg.web_app_data.data;
        await bot.sendMessage(adminId, `🔔 УВЕДОМЛЕНИЕ ОТ КЛИЕНТА:\n\n👤 Имя: ${msg.from.first_name}\n📍 ${data}`);
    } catch (e) {
        console.error("Ошибка WebApp:", e.message);
    }
});

// 2. КОМАНДА /START
bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, `Привет, ${msg.from.first_name}! 🌸\n\nДобро пожаловать в сервис "ЧистоВера".\nМы берем на себя заботу о чистоте вашего дома.\n\nИспользуйте кнопку меню ниже, чтобы открыть приложение.`);
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

                const msgText = `🔔 <b>Напоминание от ЧистоВера!</b>\n\nЧерез 30 минут (в ${client.schedule}) приедет курьер за вашим мусором.\n\nПожалуйста, выставьте пакеты за дверь, зайдите в приложение и нажмите кнопку <b>«Выставил пакеты»</b>.`;
                await bot.sendMessage(client.tg_id, msgText, { parse_mode: 'HTML' });
            }
        }

        // СБРОС СТАТУСОВ (Полночь)
        const moscowTime = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Moscow" }));
        if (moscowTime.getHours() === 0 && moscowTime.getMinutes() === 0) {
            await supabase.from('clients').update({ trash_out_today: false }).neq('tg_id', '0');
            if (moscowTime.getDay() === 1) { 
                await supabase.from('clients').update({ weekly_clicks: 0 }).eq('sub_type', '5days');
            }
        }
    } catch (e) {
        console.error("Ошибка в таймере:", e.message);
    }
}, 60000);
