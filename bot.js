const { createClient } = require('@supabase/supabase-js');
const TelegramBot = require('node-telegram-bot-api');

// Берем токен из настроек сервера (Environment Variables)
const token = process.env.BOT_TOKEN;

const adminId = '593064482';
const supabaseUrl = 'https://gpreejfftspjqarthpfp.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdwcmVlamZmdHNwanFhcnRocGZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyNzM4MDUsImV4cCI6MjA4Nzg0OTgwNX0.6u9FNjZLW3AVDY_RNLq4Dm8Yn4XC5JsI84aQlUKXI7c';

// Простая проверка токена
if (!token) {
    console.error("ОШИБКА: Токен не найден в Environment Variables!");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const bot = new TelegramBot(token.trim(), { polling: true });

console.log("=== СИСТЕМА ЧИСТОВЕРА ЗАПУЩЕНА ===");

// Обработка данных из Mini App
bot.on('web_app_data', async (msg) => {
    try {
        const data = msg.web_app_data.data;
        await bot.sendMessage(adminId, `🔔 МУСОР ВЫСТАВЛЕН!\n\n👤 Клиент: ${msg.from.first_name}\n📍 ${data}`);
    } catch (e) {
        console.error("Ошибка уведомления:", e.message);
    }
});

bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, "Привет! 🌸\nВы в боте ЧистоВера.\nИспользуйте кнопку внизу для входа в приложение.");
});

// Напоминания
setInterval(async () => {
    try {
        const now = new Date();
        const currentTime = now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Moscow' });
        
        const { data: clients } = await supabase.from('clients').eq('schedule', currentTime);
        if (clients && clients.length > 0) {
            clients.forEach(c => {
                bot.sendMessage(c.tg_id, `🌸 Пора выставлять мусор! Ваш график: ${c.schedule}`);
            });
        }
    } catch (e) {}
}, 60000);
