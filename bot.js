const { createClient } = require('@supabase/supabase-js');
const TelegramBot = require('node-telegram-bot-api');

// Твои данные
const token = 'ТВОЙ_ТОКЕН_БОТА_ОТ_BOTFATHER';
const adminId = '593064482';
const supabaseUrl = 'https://gpreejfftspjqarthpfp.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'; // Твой анон кей

const supabase = createClient(supabaseUrl, supabaseKey);
const bot = new TelegramBot(token, {polling: true});

console.log("Бот запущен и ждет уведомлений...");

// Когда клиент нажимает кнопку в Mini App, приложение отправляет данные боту
bot.on('web_app_data', async (msg) => {
    const data = msg.web_app_data.data; // Получаем текст "МУСОР_ВЫСТАВЛЕН: Адрес..."
    
    // Пересылаем это тебе (админу)
    bot.sendMessage(adminId, `🔔 УВЕДОМЛЕНИЕ:\nПользователь ${msg.from.first_name}\n${data}`);
});

// Дополнительно: Рассылка по расписанию (упрощенно)
// Этот блок будет проверять базу раз в 30 минут
setInterval(async () => {
    const now = new Date();
    const currentTime = now.getHours() + ":" + (now.getMinutes() < 30 ? "00" : "30"); // Округляем до 30 мин
    
    const { data: clients } = await supabase.from('clients').eq('schedule', currentTime);
    
    if (clients) {
        clients.forEach(client => {
            bot.sendMessage(client.tg_id, "🌸 ЧистоВера напоминает: Пожалуйста, выставите мусор за дверь к " + client.schedule);
        });
    }
}, 1800000); // 1800000 мс = 30 минут
