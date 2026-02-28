const { createClient } = require('@supabase/supabase-js');
const TelegramBot = require('node-telegram-bot-api');

// Твой токен (очищенный от невидимых символов)
const token = '8270034848:AAF9wQm0meVJ1jeflutjZfOO3OTG-_3QLfk'.trim();
const adminId = '593064482';
const supabaseUrl = 'https://gpreejfftspjqarthpfp.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdwcmVlamZmdHNwanFhcnRocGZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyNzM4MDUsImV4cCI6MjA4Nzg0OTgwNX0.6u9FNjZLW3AVDY_RNLq4Dm8Yn4XC5JsI84aQlUKXI7c';

const supabase = createClient(supabaseUrl, supabaseKey);
const bot = new TelegramBot(token, {polling: true});

console.log("=== БОТ ЧИСТОВЕРА ЗАПУЩЕН ===");

// Ловим нажатие кнопки в Mini App
bot.on('web_app_data', async (msg) => {
    try {
        const data = msg.web_app_data.data;
        await bot.sendMessage(adminId, `🔔 МУСОР ВЫСТАВЛЕН!\n\n👤 Клиент: ${msg.from.first_name}\n📍 ${data}`);
    } catch (e) {
        console.error("Ошибка при отправке админу:", e.message);
    }
});

// Команда /start
bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, "Привет! 🌸\nДобро пожаловать в ЧистоВеру.\nИспользуйте кнопку меню для открытия приложения.");
});

// Рассылка напоминаний раз в минуту
setInterval(async () => {
    try {
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const mins = String(now.getMinutes()).padStart(2, '0');
        const currentTime = `${hours}:${mins}`;

        const { data: clients } = await supabase.from('clients').eq('schedule', currentTime);
        
        if (clients && clients.length > 0) {
            clients.forEach(c => {
                bot.sendMessage(c.tg_id, `🌸 Напоминание: пора выставлять мусор! Ваш график: ${c.schedule}`);
            });
        }
    } catch (e) {
        console.error("Ошибка в интервале:", e.message);
    }
}, 60000);
