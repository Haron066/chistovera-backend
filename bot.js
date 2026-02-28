const { createClient } = require('@supabase/supabase-js');
const TelegramBot = require('node-telegram-bot-api');
const http = require('http');

// Настройки
const token = process.env.BOT_TOKEN;
const adminId = '593064482';
const supabaseUrl = 'https://gpreejfftspjqarthpfp.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdwcmVlamZmdHNwanFhcnRocGZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyNzM4MDUsImV4cCI6MjA4Nzg0OTgwNX0.6u9FNjZLW3AVDY_RNLq4Dm8Yn4XC5JsI84aQlUKXI7c';

// Создаем "пустой" сервер, чтобы Render не ругался на порты
http.createServer((req, res) => { res.write('Бот работает'); res.end(); }).listen(process.env.PORT || 3000);

const supabase = createClient(supabaseUrl, supabaseKey);
const bot = new TelegramBot(token.trim(), { polling: true });

console.log("=== СИСТЕМА ЧИСТОВЕРА ЗАПУЩЕНА ===");

// 1. ПРИЕМ ДАННЫХ ИЗ ПРИЛОЖЕНИЯ
bot.on('web_app_data', async (msg) => {
    try {
        const data = msg.web_app_data.data;
        // Отправляем сообщение тебе (админу)
        await bot.sendMessage(adminId, `🔔 МУСОР ВЫСТАВЛЕН!\n\n👤 Клиент: ${msg.from.first_name}\n📍 ${data}`);
        console.log("Уведомление админу отправлено");
    } catch (e) {
        console.error("Ошибка при приеме данных:", e.message);
    }
});

bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, "Привет! 🌸\nВы в боте ЧистоВера.\nИспользуйте кнопку внизу для входа в приложение.");
});

// 2. РАССЫЛКА НАПОМИНАНИЙ (раз в минуту)
setInterval(async () => {
    try {
        const now = new Date();
        // Время по Москве (МСК)
        const currentTime = now.toLocaleTimeString('ru-RU', { 
            hour: '2-digit', 
            minute: '2-digit', 
            timeZone: 'Europe/Moscow' 
        });

        // Ищем клиентов на это время
        const { data: clients, error } = await supabase
            .from('clients')
            .select('tg_id, schedule')
            .eq('schedule', currentTime);
        
        if (clients && clients.length > 0) {
            for (const client of clients) {
                await bot.sendMessage(client.tg_id, `🌸 ЧистоВера напоминает: пришло время выставлять мусор (${client.schedule}). Пожалуйста, сделайте это сейчас.`);
            }
            console.log(`Разослано напоминаний: ${clients.length}`);
        }
    } catch (e) {
        console.error("Ошибка в таймере:", e.message);
    }
}, 60000);
