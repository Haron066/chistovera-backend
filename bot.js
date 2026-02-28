const { createClient } = require('@supabase/supabase-js');
const TelegramBot = require('node-telegram-bot-api');
const http = require('http');

const token = process.env.BOT_TOKEN;
const adminId = '593064482';
const supabaseUrl = 'https://gpreejfftspjqarthpfp.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdwcmVlamZmdHNwanFhcnRocGZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyNzM4MDUsImV4cCI6MjA4Nzg0OTgwNX0.6u9FNjZLW3AVDY_RNLq4Dm8Yn4XC5JsI84aQlUKXI7c';

http.createServer((req, res) => { res.write('OK'); res.end(); }).listen(process.env.PORT || 3000);

const supabase = createClient(supabaseUrl, supabaseKey);
const bot = new TelegramBot(token.trim(), { polling: true });

console.log("=== СИСТЕМА ЧИСТОВЕРА 4.0 ЗАПУЩЕНА ===");

// 1. ПРОВЕРКА РАСПИСАНИЯ И УВЕДОМЛЕНИЯ ЗА 30 МИНУТ
setInterval(async () => {
    try {
        const now = new Date();
        const moscowTime = new Date(now.toLocaleString("en-US", {timeZone: "Europe/Moscow"}));
        
        // Время через 30 минут
        moscowTime.setMinutes(moscowTime.getMinutes() + 30);
        const targetTime = moscowTime.getHours().toString().padStart(2, '0') + ":" + 
                           moscowTime.getMinutes().toString().padStart(2, '0');

        const { data: clients } = await supabase.from('clients').eq('schedule', targetTime);
        
        if (clients && clients.length > 0) {
            clients.forEach(c => {
                bot.sendMessage(c.tg_id, `🔔 ЧистоВера напоминает:\nУ вас вынос мусора через 30 минут (${c.schedule}).\nПожалуйста, не забудьте выставить пакеты!`);
            });
        }

        // Обнуление кнопок в полночь (00:00)
        if (moscowTime.getHours() === 0 && moscowTime.getMinutes() === 0) {
            await supabase.from('clients').update({ trash_out_today: false }).neq('tg_id', '0');
        }

    } catch (e) { console.error(e.message); }
}, 60000); // Проверка раз в минуту

bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, "Добро пожаловать в ЧистоВеру! 🌸\nИспользуйте кнопку меню для входа.");
});
