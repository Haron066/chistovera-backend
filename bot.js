const { createClient } = require('@supabase/supabase-js');
const TelegramBot = require('node-telegram-bot-api');
const http = require('http');

// --- КОНФИГУРАЦИЯ ---
const token = process.env.BOT_TOKEN; // Токен берется из Environment Variables на Render
const adminId = '593064482';
const supabaseUrl = 'https://gpreejfftspjqarthpfp.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdwcmVlamZmdHNwanFhcnRocGZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyNzM4MDUsImV4cCI6MjA4Nzg0OTgwNX0.6u9FNjZLW3AVDY_RNLq4Dm8Yn4XC5JsI84aQlUKXI7c';

// Создаем сервер для Render (чтобы не засыпал и не выдавал ошибку портов)
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.write('ЧистоВера Бот работает успешно!');
    res.end();
}).listen(process.env.PORT || 3000);

const supabase = createClient(supabaseUrl, supabaseKey);
const bot = new TelegramBot(token.trim(), { polling: true });

console.log("=== СИСТЕМА ЧИСТОВЕРА 6.0 (PRO) ЗАПУЩЕНА ===");

// 1. ПРИЕМ ДАННЫХ ИЗ ПРИЛОЖЕНИЯ (Кнопка "Выставил мусор")
bot.on('web_app_data', async (msg) => {
    try {
        const data = msg.web_app_data.data;
        // Пересылаем уведомление тебе (админу)
        await bot.sendMessage(adminId, `🔔 УВЕДОМЛЕНИЕ ОТ КЛИЕНТА:\n\n👤 Имя: ${msg.from.first_name}\n📍 ${data}`);
        console.log("Уведомление о мусоре отправлено админу");
    } catch (e) {
        console.error("Ошибка при приеме данных из WebApp:", e.message);
    }
});

// 2. КОМАНДА /START
bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, `Привет, ${msg.from.first_name}! 🌸\n\nДобро пожаловать в сервис "ЧистоВера".\nМы берем на себя заботу о чистоте вашего дома.\n\nИспользуйте кнопку меню ниже, чтобы открыть приложение.`);
});

// 3. ФУНКЦИЯ ПРОВЕРКИ РАСПИСАНИЯ И СБРОСОВ (Раз в минуту)
setInterval(async () => {
    try {
        // Получаем текущую дату и время
        const now = new Date();
        
        // --- А. УВЕДОМЛЕНИЯ ЗА 30 МИНУТ ---
        // Прибавляем ровно 30 минут к текущему времени
        const targetDate = new Date(now.getTime() + 30 * 60000);
        
        // Форматируем время в ЧЧ:ММ жестко по часовому поясу Москвы (Ингушетия)
        const targetTimeStr = targetDate.toLocaleTimeString('ru-RU', {
            timeZone: 'Europe/Moscow',
            hour: '2-digit',
            minute: '2-digit'
        });

        // Получаем сегодняшнюю дату в формате YYYY-MM-DD для проверки подписки
        const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Moscow' });

        // Ищем в базе людей, у которых schedule совпадает с (Текущее время + 30 минут)
        const { data: clientsToRemind } = await supabase
            .from('clients')
            .select('*')
            .eq('schedule', targetTimeStr)
            .neq('sub_type', 'none'); // Только те, у кого есть подписка

        if (clientsToRemind && clientsToRemind.length > 0) {
            for (const client of clientsToRemind) {
                // 1. Проверяем, не истекла ли подписка
                if (client.sub_end_date && client.sub_end_date < todayStr) {
                    continue; // Пропускаем этого клиента, подписка кончилась
                }
                
                // 2. Проверяем, не выставил ли он мусор УЖЕ
                if (client.trash_out_today) {
                    continue; // Пропускаем, он уже нажал кнопку
                }

                // Отправляем уведомление
                const msgText = `🔔 <b>Напоминание от ЧистоВера!</b>\n\nЧерез 30 минут (в ${client.schedule}) приедет курьер за вашим мусором.\n\nПожалуйста, выставьте пакеты за дверь, зайдите в приложение и нажмите кнопку <b>«Выставил пакеты»</b>.`;
                
                await bot.sendMessage(client.tg_id, msgText, { parse_mode: 'HTML' });
                console.log(`Уведомление за 30 мин отправлено клиенту: ${client.tg_id}`);
            }
        }

        // --- Б. ЕЖЕДНЕВНЫЙ СБРОС СТАТУСОВ ---
        // Получаем текущее время по Москве для полуночи
        const moscowTime = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Moscow" }));
        const hrs = moscowTime.getHours();
        const mins = moscowTime.getMinutes();
        const day = moscowTime.getDay(); // 0 - воскресенье, 1 - понедельник

        if (hrs === 0 && mins === 0) {
            await supabase
                .from('clients')
                .update({ trash_out_today: false })
                .neq('tg_id', '0');
            console.log("Ежедневный статус кнопок сброшен (Полночь)");

            // --- В. ЕЖЕНЕДЕЛЬНЫЙ СБРОС ЛИМИТОВ (Понедельник 00:00) ---
            if (day === 1) { 
                await supabase
                    .from('clients')
                    .update({ weekly_clicks: 0 })
                    .eq('sub_type', '5days');
                console.log("Еженедельные лимиты тарифа '5 дней' обнулены");
            }
        }

    } catch (e) {
        console.error("Системная ошибка в таймере:", e.message);
    }
}, 60000); // Проверка запускается ровно каждые 60 секунд

// Обработка ошибок бота, чтобы он не выключался
bot.on('polling_error', (error) => {
    console.error("Ошибка Polling:", error.code);
});
