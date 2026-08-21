/**
 * Приём заявки с формы консультации.
 * Формат Vercel Functions (Netlify — тот же handler через @netlify/functions).
 *
 * Работает в двух режимах:
 *  - fetch с Accept: application/json (когда на странице загрузился script.js);
 *  - обычный POST формы без JS — тогда отвечаем редиректом обратно на страницу.
 *
 * Переменные окружения: TG_BOT_TOKEN, TG_CHAT_ID.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // без JS тело приходит как application/x-www-form-urlencoded
  const data =
    typeof req.body === 'string'
      ? Object.fromEntries(new URLSearchParams(req.body))
      : req.body || {};

  const wantsJson = (req.headers.accept || '').includes('application/json');
  const done = () =>
    wantsJson ? res.status(200).json({ ok: true }) : res.redirect(303, '/?sent=1#consult');

  // honeypot: боту отвечаем как обычно, чтобы он не подбирал обход
  if (data.company) return done();

  const name = String(data.name || '').trim();
  const phone = String(data.phone || '').replace(/\D/g, '');
  if (name.length < 2 || phone.length !== 11 || !data.agree) {
    return res.status(400).json({ error: 'Проверьте имя, телефон и согласие с политикой' });
  }

  const text = [
    '🖤 Новая заявка с сайта',
    `Имя: ${name}`,
    `Телефон: +${phone}`,
    `Стиль: ${data.style || '—'}`,
    `Мастер: ${data.master || '—'}`,
    `Идея: ${String(data.idea || '—').slice(0, 800)}`,
  ].join('\n');

  const tg = await fetch(`https://api.telegram.org/bot${process.env.TG_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: process.env.TG_CHAT_ID, text }),
  });

  if (!tg.ok) {
    console.error('telegram failed', tg.status, await tg.text());
    return res.status(502).json({ error: 'Не удалось передать заявку' });
  }

  return done();
}
