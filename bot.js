require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const dbModule = require('./database');

if (!process.env.BOT_TOKEN) {
  console.error('❌ BOT_TOKEN не найден в .env файле!');
  process.exit(1);
}

const bot = new Telegraf(process.env.BOT_TOKEN);

const activeTrivias  = new Map();
const activeDuels    = new Map();
const dailyComps     = new Map();
const activeEvents   = new Map();

const SHOP_ITEMS = [
  { id: 'shadow',    name: '🌑 Тень',         price: 300,  description: 'Таинственный титул' },
  { id: 'dragon',    name: '🐉 Дракон',        price: 500,  description: 'Огненный титул' },
  { id: 'king',      name: '👑 Король',         price: 800,  description: 'Королевский титул' },
  { id: 'hacker',    name: '💻 Хакер',          price: 400,  description: 'Технический титул' },
  { id: 'ninja',     name: '🥷 Ниндзя',         price: 350,  description: 'Скрытный титул' },
  { id: 'wizard',    name: '🧙 Волшебник',      price: 600,  description: 'Магический титул' },
  { id: 'ghost',     name: '👻 Призрак',        price: 250,  description: 'Пугающий титул' },
  { id: 'champion',  name: '🏆 Чемпион',        price: 1000, description: 'Легендарный титул' },
];

const DAILY_REWARDS = [
  { coins: 50,  xp: 20,  label: 'День 1' },
  { coins: 75,  xp: 30,  label: 'День 2' },
  { coins: 100, xp: 40,  label: 'День 3' },
  { coins: 125, xp: 50,  label: 'День 4' },
  { coins: 150, xp: 60,  label: 'День 5' },
  { coins: 200, xp: 80,  label: 'День 6' },
  { coins: 300, xp: 100, label: 'День 7 🎉' },
];

const XP_MSG       = 3;
const XP_CMD       = 5;
const XP_QUIZ_WIN  = 50;
const XP_DUEL_WIN  = 80;
const XP_COMP_WIN  = 150;
const COINS_QUIZ   = 20;
const COINS_DUEL   = 50;
const COINS_COMP   = 100;

const TITLES = ['','Новичок 🌱','Ученик 📚','Игрок 🎮','Боец ⚔️','Ветеран 🛡','Мастер 🏆','Элита 💎','Легенда 🌟','Бессмертный 👑','БОГ 🔱'];
const title  = l => TITLES[Math.min(l, TITLES.length-1)] || `Уровень ${l} 🔱`;
const bar    = (p, n=10) => '█'.repeat(Math.max(0,Math.round(p/100*n))) + '░'.repeat(Math.max(0,n-Math.round(p/100*n)));
const nowTs  = () => Math.floor(Date.now()/1000);
const today  = () => new Date().toISOString().slice(0,10);

let db;

function ensureUser(ctx) {
  const u = ctx.from;
  db.upsertUser({ user_id: u.id, username: u.username||null, first_name: u.first_name||'Игрок', last_active: nowTs() });
  return db.getUser(u.id);
}

const ADMIN_IDS = (process.env.ADMIN_IDS || '').split(',').map(s => parseInt(s.trim())).filter(Boolean);
const isAdmin = id => ADMIN_IDS.includes(id);
const pendingQuestions = new Map();

function giveXP(userId, xp, msgs=0, cmds=0) {
  db.addXP({ user_id: userId, xp, msgs, cmds, now: nowTs() });
  db.logDailyXP({ user_id: userId, date: today(), msgs, xp });
  const user = db.getUser(userId);
  const newLvl = db.calcLevel(user.xp);
  if (newLvl !== user.level) { db.updateLevel(newLvl, userId); return { levelUp: true, newLevel: newLvl }; }
  return { levelUp: false };
}

// ─── /start ───────────────────────────────────────────────
const escapeMd = s => (s||'').replace(/([_*[`])/g, '\\$1');

bot.start(ctx => {
  const u = ensureUser(ctx);
  const name = escapeMd(ctx.from.first_name);
  ctx.reply(
    `🎮 *Добро пожаловать, ${name}\!*\n\n`+
    `Ты зарегистрирован как *${title(u ? u.level : 1)}*\n`+
    `⭐ XP: ${u ? u.xp : 0} | 💰 Монеты: ${u ? u.coins : 100}\n\n`+
    `*Команды:*\n`+
    `👤 /profile — профиль\n`+
    `📊 /stats — статистика\n`+
    `📅 /mystats — активность за неделю\n`+
    `🏆 /top — топ по XP\n`+
    `⚔️ /topwins — топ по победам\n`+
    `💬 /activity — топ по активности\n`+
    `🎯 /quiz — викторина\n`+
    `🥊 /duel @игрок — дуэль\n`+
    `🏅 /compete — соревнование\n`+
    `🎪 /event — групповой ивент\n`+
    `🎁 /daily — ежедневная награда\n`+
    `🛒 /shop — магазин титулов\n`+
    `📜 /history — история игр\n`+
    `❓ /help — справка`,
    { parse_mode: 'Markdown' }
  );
});

bot.command('help', ctx => {
  ensureUser(ctx);
  ctx.reply(
    `📖 *Справка*\n\n`+
    `/profile — уровень, XP, монеты\n`+
    `/stats — полная статистика\n`+
    `/mystats — активность за 7 дней\n`+
    `/top — топ 10 по XP\n`+
    `/topwins — топ 10 по победам\n`+
    `/activity — топ по активности\n`+
    `/quiz — викторина (30 сек)\n`+
    `/quiz hard — сложная\n`+
    `/quiz easy — лёгкая\n`+
    `/duel @игрок — дуэль 1 на 1\n`+
    `/compete — соревнование 5 вопросов\n`+
    `/event — групповой ивент 10 вопросов\n`+
    `/daily — ежедневная награда (серия до 7 дней)\n`+
    `/shop — магазин титулов\n`+
    `/mytitle — надеть титул\n`+
    `/history — последние 10 игр\n\n`+
    `💡 +${XP_MSG} XP за сообщение | +${XP_CMD} XP за команду`,
    { parse_mode: 'Markdown' }
  );
});

bot.command('profile', ctx => {
  const u = ensureUser(ctx);
  giveXP(u.user_id, XP_CMD, 0, 1);
  const f = db.getUser(u.user_id);
  const p = db.xpProgress(f);
  const wr = f.wins+f.losses > 0 ? Math.round(f.wins/(f.wins+f.losses)*100) : 0;
  ctx.reply(
    `👤 *${ctx.from.first_name}*\n`+
    `🎖 *${title(f.level)}* — Уровень ${f.level}\n\n`+
    `⭐ XP: ${f.xp.toLocaleString()}\n`+
    `[${bar(p.percent)}] ${p.percent}%\n`+
    `До след. уровня: ${p.needed - p.current} XP\n\n`+
    `💰 Монеты: ${f.coins}\n`+
    `💬 Сообщений: ${f.messages} | ⌨️ Команд: ${f.commands}\n\n`+
    `🏆 Победы: ${f.wins} | 💀 Поражения: ${f.losses}\n`+
    `📈 Винрейт: ${wr}%\n`+
    `🔥 Серия: ${f.streak} | ⚡ Рекорд: ${f.best_streak}`,
    { parse_mode: 'Markdown' }
  );
});

bot.command('stats', ctx => {
  const u = ensureUser(ctx);
  giveXP(u.user_id, XP_CMD, 0, 1);
  const f = db.getUser(u.user_id);
  const total = f.wins + f.losses;
  const wr = total > 0 ? Math.round(f.wins/total*100) : 0;
  ctx.reply(
    `📊 *Статистика — ${ctx.from.first_name}*\n\n`+
    `💬 Сообщений: ${f.messages} | ⌨️ Команд: ${f.commands}\n`+
    `🎮 Игр: ${total} | ✅ ${f.wins}W ❌ ${f.losses}L\n`+
    `📈 Винрейт: ${wr}%\n`+
    `🔥 Серия: ${f.streak} | ⚡ Рекорд: ${f.best_streak}\n\n`+
    `⭐ XP: ${f.xp.toLocaleString()} | 💰 ${f.coins} монет\n`+
    `🎖 ${title(f.level)} (Уровень ${f.level})`,
    { parse_mode: 'Markdown' }
  );
});

bot.command('mystats', ctx => {
  const u = ensureUser(ctx);
  giveXP(u.user_id, XP_CMD, 0, 1);
  const rows = db.getUserDailyStats(u.user_id);
  if (!rows.length) return ctx.reply('📅 Данных пока нет. Начни общаться в чате!');
  let text = `📅 *Активность за 7 дней*\n\n`;
  for (const r of rows) {
    const d = new Date(r.date).toLocaleDateString('ru-RU',{day:'numeric',month:'short'});
    text += `${d}: 💬${r.messages} ⭐+${r.xp_earned}\n`;
  }
  ctx.reply(text, { parse_mode: 'Markdown' });
});

bot.command('top', ctx => {
  ensureUser(ctx);
  giveXP(ctx.from.id, XP_CMD, 0, 1);
  const users = db.getTopXP();
  if (!users.length) return ctx.reply('Рейтинг пока пуст.');
  const m = ['🥇','🥈','🥉'];
  let text = `🏆 *Топ 10 — XP*\n\n`;
  users.forEach((u,i) => {
    const n = u.username ? `@${u.username}` : u.first_name;
    text += `${m[i]||`${i+1}.`} ${n} — ${u.xp.toLocaleString()} XP · Ур.${u.level}\n`;
  });
  ctx.reply(text, { parse_mode: 'Markdown' });
});

bot.command('topwins', ctx => {
  ensureUser(ctx);
  giveXP(ctx.from.id, XP_CMD, 0, 1);
  const users = db.getTopWins();
  if (!users.length) return ctx.reply('Рейтинг пуст.');
  const m = ['🥇','🥈','🥉'];
  let text = `⚔️ *Топ 10 — Победы*\n\n`;
  users.forEach((u,i) => {
    const n = u.username ? `@${u.username}` : u.first_name;
    const wr = u.wins+u.losses>0?Math.round(u.wins/(u.wins+u.losses)*100):0;
    text += `${m[i]||`${i+1}.`} ${n} — ${u.wins}W/${u.losses}L · ${wr}%\n`;
  });
  ctx.reply(text, { parse_mode: 'Markdown' });
});

bot.command('activity', ctx => {
  ensureUser(ctx);
  giveXP(ctx.from.id, XP_CMD, 0, 1);
  const users = db.getTopActivity();
  if (!users.length) return ctx.reply('Нет данных.');
  const m = ['🥇','🥈','🥉'];
  let text = `💬 *Топ 10 — Активность*\n\n`;
  users.forEach((u,i) => {
    const n = u.username ? `@${u.username}` : u.first_name;
    text += `${m[i]||`${i+1}.`} ${n} — 💬${u.messages} · ⌨️${u.commands}\n`;
  });
  ctx.reply(text, { parse_mode: 'Markdown' });
});

bot.command('history', ctx => {
  ensureUser(ctx);
  giveXP(ctx.from.id, XP_CMD, 0, 1);
  const games = db.getGameHistory(ctx.chat.id, 10);
  if (!games.length) return ctx.reply('📜 История пуста. Сыграй /quiz');
  const lbl = { quiz:'🎯 Викторина', duel:'⚔️ Дуэль', competition:'🏅 Соревнование' };
  let text = `📜 *История игр*\n\n`;
  for (const g of games) {
    const d = new Date(g.played_at*1000).toLocaleString('ru-RU',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
    text += `${lbl[g.game_type]||g.game_type} · ${d}\n  🏆 ${g.winner_name||'?'}${g.loser_name?` vs ❌ ${g.loser_name}`:''}\n\n`;
  }
  ctx.reply(text, { parse_mode: 'Markdown' });
});

bot.command('quiz', async ctx => {
  const u = ensureUser(ctx);
  giveXP(u.user_id, XP_CMD, 0, 1);
  const chatId = ctx.chat.id;
  if (activeTrivias.has(chatId)) return ctx.reply('⏳ Викторина уже идёт!');
  const args = ctx.message.text.split(' ');
  const diff = ['hard','easy'].includes(args[1]) ? args[1] : null;
  const q = diff ? db.getQuestionsByDifficulty(diff) : db.getRandomQuestion();
  if (!q) return ctx.reply('Вопросы не найдены.');
  const answers = [q.correct, q.wrong1, q.wrong2, q.wrong3].sort(() => Math.random()-0.5);
  const ci = answers.indexOf(q.correct);
  activeTrivias.set(chatId, { q, correct:q.correct, ci, answers, start:Date.now(), answered:false });
  const dlabel = { easy:'🟢 Лёгкий', medium:'🟡 Средний', hard:'🔴 Сложный' };
  const btns = answers.map((a,i) => [Markup.button.callback(`${['A','B','C','D'][i]}. ${a}`, `qz_${chatId}_${i}`)]);
  await ctx.reply(
    `🎯 *Викторина!* [${dlabel[q.difficulty]||q.difficulty}]\n\n❓ *${q.question}*\n\n🏷 _${q.category}_\n🎁 ⭐${XP_QUIZ_WIN} XP + 💰${COINS_QUIZ} монет | ⏱ 30 сек`,
    { parse_mode:'Markdown', ...Markup.inlineKeyboard(btns) }
  );
  setTimeout(() => {
    const s = activeTrivias.get(chatId);
    if (s && !s.answered) { activeTrivias.delete(chatId); ctx.reply(`⏰ Время вышло! Ответ: *${q.correct}*`, { parse_mode:'Markdown' }); }
  }, 30000);
});

bot.action(/^qz_(-?\d+)_(\d)$/, async ctx => {
  const chatId = parseInt(ctx.match[1]), chosen = parseInt(ctx.match[2]);
  const s = activeTrivias.get(chatId);
  if (!s || s.answered) return ctx.answerCbQuery('Викторина уже завершена!');
  const u = ensureUser(ctx);
  s.answered = true; activeTrivias.delete(chatId);
  const elapsed = Math.round((Date.now()-s.start)/1000);
  if (chosen === s.ci) {
    const bonus = elapsed<5?20:elapsed<10?10:0, total = XP_QUIZ_WIN+bonus;
    const { levelUp, newLevel } = giveXP(u.user_id, total, 0, 0);
    db.updateCoins(COINS_QUIZ, u.user_id); db.updateWin(u.user_id);
    db.logGame({ game_type:'quiz', chat_id:chatId, winner_id:u.user_id, loser_id:null, duration_s:elapsed, details:s.correct });
    let msg = `✅ *${ctx.from.first_name} ответил правильно!*\n\n📝 *${s.correct}*\n⭐ +${total} XP${bonus>0?` (+${bonus} бонус)`:''}  💰 +${COINS_QUIZ}\n⏱ За ${elapsed}с`;
    if (levelUp) { msg += `\n\n🎉 *ЛЕВЕЛ АП! Уровень ${newLevel} — ${title(newLevel)}*\n💰 +${newLevel*25} монет!`; db.updateCoins(newLevel*25, u.user_id); }
    await ctx.editMessageText(msg, { parse_mode:'Markdown' });
  } else {
    db.updateLoss(u.user_id); giveXP(u.user_id, 5, 0, 0);
    await ctx.editMessageText(`❌ *${ctx.from.first_name} ошибся!*\n\n✅ Ответ: *${s.correct}*\nТвой: _${s.answers[chosen]}_\n⭐ +5 XP за участие`, { parse_mode:'Markdown' });
  }
  await ctx.answerCbQuery();
});

bot.command('duel', async ctx => {
  const challenger = ensureUser(ctx);
  giveXP(challenger.user_id, XP_CMD, 0, 1);
  const chatId = ctx.chat.id;
  if (activeDuels.has(chatId)) return ctx.reply('⚔️ Дуэль уже идёт!');
  const ent = ctx.message.entities?.find(e => e.type==='mention'||e.type==='text_mention');
  if (!ent) return ctx.reply('⚔️ Укажи соперника: /duel @username');
  const uname = ctx.message.text.slice(ent.offset, ent.offset+ent.length).replace('@','');
  const target = db.getUserByUsername(uname);
  if (!target) return ctx.reply(`❌ @${uname} не найден. Пусть напишет /start`);
  if (target.user_id === challenger.user_id) return ctx.reply('😅 Нельзя вызвать себя!');
  activeDuels.set(chatId, { cId:challenger.user_id, cName:ctx.from.first_name, tId:target.user_id, tName:target.first_name, accepted:false, finished:false, duelResponses:{}, start:Date.now() });
  await ctx.reply(
    `⚔️ *ВЫЗОВ НА ДУЭЛЬ!*\n\n👊 *${ctx.from.first_name}* vs *${target.first_name}*\n💰 ${COINS_DUEL} монет | ⭐ ${XP_DUEL_WIN} XP\n\n@${uname}, принимаешь?`,
    { parse_mode:'Markdown', ...Markup.inlineKeyboard([[Markup.button.callback('✅ Принять','dl_ok_'+chatId),Markup.button.callback('❌ Отказать','dl_no_'+chatId)]]) }
  );
  setTimeout(() => { if (activeDuels.has(chatId)&&!activeDuels.get(chatId).accepted) { activeDuels.delete(chatId); ctx.reply('⏰ Дуэль отменена.'); } }, 60000);
});

bot.action(/^dl_ok_(-?\d+)$/, async ctx => {
  const chatId = parseInt(ctx.match[1]), s = activeDuels.get(chatId);
  if (!s) return ctx.answerCbQuery('Дуэль уже завершена.');
  if (ctx.from.id !== s.tId) return ctx.answerCbQuery('Не твой вызов!', { show_alert:true });
  s.accepted = true; await ctx.answerCbQuery();
  const q = db.getRandomQuestion();
  const answers = [q.correct, q.wrong1, q.wrong2, q.wrong3].sort(() => Math.random()-0.5);
  s.q=q; s.answers=answers; s.ci=answers.indexOf(q.correct); s.duelStart=Date.now();
  const btns = answers.map((a,i) => [Markup.button.callback(`${['A','B','C','D'][i]}. ${a}`, `da_${chatId}_${i}`)]);
  await ctx.editMessageText(`⚔️ *Дуэль!*\n${s.cName} vs ${s.tName}\n\n❓ *${q.question}*\n\n🏆 Первый правильный побеждает!`, { parse_mode:'Markdown', ...Markup.inlineKeyboard(btns) });
});

bot.action(/^dl_no_(-?\d+)$/, async ctx => {
  const chatId = parseInt(ctx.match[1]), s = activeDuels.get(chatId);
  if (!s) return ctx.answerCbQuery();
  if (ctx.from.id !== s.tId) return ctx.answerCbQuery('Не твоя дуэль!', { show_alert:true });
  activeDuels.delete(chatId);
  await ctx.editMessageText(`❌ *${s.tName}* отказался.`, { parse_mode:'Markdown' }); await ctx.answerCbQuery();
});

bot.action(/^da_(-?\d+)_(\d)$/, async ctx => {
  const chatId = parseInt(ctx.match[1]), chosen = parseInt(ctx.match[2]);
  const s = activeDuels.get(chatId);
  if (!s||!s.accepted||s.finished) return ctx.answerCbQuery('Дуэль завершена!');
  const u = ensureUser(ctx);
  if (u.user_id!==s.cId&&u.user_id!==s.tId) return ctx.answerCbQuery('Ты не участник!', { show_alert:true });
  if (s.duelResponses[u.user_id]!==undefined) return ctx.answerCbQuery('Уже ответил!', { show_alert:true });
  s.duelResponses[u.user_id] = chosen;
  if (chosen === s.ci) {
    s.finished = true; activeDuels.delete(chatId);
    const elapsed = Math.round((Date.now()-s.duelStart)/1000);
    const loserId = u.user_id===s.cId?s.tId:s.cId, loserName = u.user_id===s.cId?s.tName:s.cName;
    const { levelUp, newLevel } = giveXP(u.user_id, XP_DUEL_WIN, 0, 0);
    db.updateCoins(COINS_DUEL, u.user_id); db.updateWin(u.user_id); db.updateLoss(loserId);
    db.logGame({ game_type:'duel', chat_id:chatId, winner_id:u.user_id, loser_id:loserId, duration_s:elapsed, details:s.q.correct });
    let msg = `⚔️ *Дуэль завершена!*\n🏆 *${ctx.from.first_name}* vs ❌ *${loserName}*\n✅ Ответ: *${s.q.correct}* за ${elapsed}с\n⭐ +${XP_DUEL_WIN} XP | 💰 +${COINS_DUEL}`;
    if (levelUp) { msg += `\n🎉 *ЛЕВЕЛ АП! Уровень ${newLevel}!*`; db.updateCoins(newLevel*25, u.user_id); }
    await ctx.editMessageText(msg, { parse_mode:'Markdown' });
  } else { await ctx.answerCbQuery('❌ Неверно!'); }
});

bot.command('compete', async ctx => {
  const u = ensureUser(ctx); giveXP(u.user_id, XP_CMD, 0, 1);
  const chatId = ctx.chat.id;
  if (dailyComps.has(chatId)) {
    const c = dailyComps.get(chatId);
    const sc = Object.entries(c.scores).sort((a,b)=>b[1]-a[1]).slice(0,5);
    let txt = `🏅 *Соревнование идёт!* Вопрос ${c.round}/${c.maxRounds}\n\n`;
    sc.forEach(([id,pts],i)=>{ txt+=`${['🥇','🥈','🥉','4.','5.'][i]} ${c.names[id]||'?'} — ${pts} очков\n`; });
    return ctx.reply(txt, { parse_mode:'Markdown' });
  }
  const c = { scores:{}, names:{}, round:0, maxRounds:5, active:false, answered:new Set(), currentQ:null };
  dailyComps.set(chatId, c);
  await ctx.reply(`🏅 *Соревнование!*\n\n5 вопросов — кто больше наберёт, победил!\n🏆 ⭐${XP_COMP_WIN} XP + 💰${COINS_COMP} монет победителю\n\nЖми кнопку!`,
    { parse_mode:'Markdown', ...Markup.inlineKeyboard([[Markup.button.callback('🚀 Начать!','cs_'+chatId)]]) });
});

bot.action(/^cs_(-?\d+)$/, async ctx => {
  const chatId = parseInt(ctx.match[1]), c = dailyComps.get(chatId);
  if (!c) return ctx.answerCbQuery('Не найдено.');
  if (c.active) return ctx.answerCbQuery('Уже идёт!');
  await ctx.answerCbQuery(); await sendCompQ(ctx, chatId);
});

async function sendCompQ(ctx, chatId) {
  const c = dailyComps.get(chatId);
  if (!c||c.round>=c.maxRounds) return endComp(ctx, chatId);
  c.round++; c.active=true; c.answered=new Set();
  const q = db.getRandomQuestion();
  const answers = [q.correct, q.wrong1, q.wrong2, q.wrong3].sort(() => Math.random()-0.5);
  const ci = answers.indexOf(q.correct);
  c.currentQ = { q, answers, ci, start:Date.now() };
  const btns = answers.map((a,i) => [Markup.button.callback(`${['A','B','C','D'][i]}. ${a}`, `ca_${chatId}_${i}`)]);
  const msg = await ctx.telegram.sendMessage(chatId, `🏅 *Вопрос ${c.round}/${c.maxRounds}*\n\n❓ *${q.question}*\n\n⏱ 20 секунд`, { parse_mode:'Markdown', ...Markup.inlineKeyboard(btns) });
  c.msgId = msg.message_id;
  const rn = c.round;
  setTimeout(async () => {
    const fresh = dailyComps.get(chatId);
    if (fresh&&fresh.round===rn) {
      try { await ctx.telegram.editMessageText(chatId, c.msgId, null, `⏰ Время! Ответ: *${q.correct}*`, { parse_mode:'Markdown' }); } catch(e){}
      setTimeout(() => sendCompQ(ctx, chatId), 2000);
    }
  }, 20000);
}

bot.action(/^ca_(-?\d+)_(\d)$/, async ctx => {
  const chatId = parseInt(ctx.match[1]), chosen = parseInt(ctx.match[2]);
  const c = dailyComps.get(chatId);
  if (!c||!c.active||!c.currentQ) return ctx.answerCbQuery('Закрыт.');
  const u = ensureUser(ctx);
  if (c.answered.has(u.user_id)) return ctx.answerCbQuery('Уже ответил!', { show_alert:true });
  c.answered.add(u.user_id); c.names[u.user_id]=ctx.from.first_name;
  if (!c.scores[u.user_id]) c.scores[u.user_id]=0;
  const elapsed = Math.round((Date.now()-c.currentQ.start)/1000);
  if (chosen===c.currentQ.ci) {
    const pts = elapsed<5?3:elapsed<10?2:1;
    c.scores[u.user_id]+=pts; giveXP(u.user_id, pts*10, 0, 0);
    await ctx.answerCbQuery(`✅ Верно! +${pts} очков (${elapsed}с)`);
  } else { await ctx.answerCbQuery(`❌ Неверно! Ответ: ${c.currentQ.q.correct}`); }
});

async function endComp(ctx, chatId) {
  const c = dailyComps.get(chatId); if (!c) return;
  dailyComps.delete(chatId);
  const sc = Object.entries(c.scores).sort((a,b)=>b[1]-a[1]);
  if (!sc.length) return ctx.telegram.sendMessage(chatId,'🏅 Соревнование завершено — никто не участвовал.');
  const [wId,wPts]=sc[0], wName=c.names[wId];
  const { levelUp, newLevel } = giveXP(parseInt(wId), XP_COMP_WIN, 0, 0);
  db.updateCoins(COINS_COMP, parseInt(wId)); db.updateWin(parseInt(wId));
  db.logGame({ game_type:'competition', chat_id:chatId, winner_id:parseInt(wId), loser_id:null, duration_s:0, details:`score:${wPts}` });
  let txt = `🏅 *Соревнование завершено!*\n\n`;
  sc.slice(0,5).forEach(([id,pts],i)=>{ txt+=`${['🥇','🥈','🥉','4.','5.'][i]} ${c.names[id]||'?'} — ${pts} очков\n`; });
  txt += `\n🎉 Победитель: *${wName}*!\n⭐ +${XP_COMP_WIN} XP | 💰 +${COINS_COMP} монет`;
  if (levelUp) txt += `\n🔱 *ЛЕВЕЛ АП! Уровень ${newLevel}!*`;
  ctx.telegram.sendMessage(chatId, txt, { parse_mode:'Markdown' });
}

// ─── /addquestion (admin) ─────────────────────────────────
bot.command('addquestion', ctx => {
  if (!isAdmin(ctx.from.id)) return ctx.reply('❌ Нет доступа.');
  pendingQuestions.set(ctx.from.id, { step: 'question' });
  ctx.reply(
    `➕ *Добавление вопроса*\n\nШаг 1/6 — Напиши *текст вопроса:*`,
    { parse_mode: 'Markdown' }
  );
});

bot.command('questions', ctx => {
  if (!isAdmin(ctx.from.id)) return ctx.reply('❌ Нет доступа.');
  const cnt = db.getQuestionsCount();
  ctx.reply(`📚 Вопросов в базе: *${cnt}*`, { parse_mode: 'Markdown' });
});

// ─── /adminstats ──────────────────────────────────────────
bot.command('adminstats', ctx => {
  if (!isAdmin(ctx.from.id)) return ctx.reply('❌ Нет доступа.');
  const s = db.getAdminStats();
  const qCnt = db.getQuestionsCount();
  ctx.reply(
    `📊 *Статистика бота*\n\n`+
    `👥 Всего пользователей: *${s.totalUsers}*\n`+
    `🟢 Активны сегодня: *${s.activeToday}*\n`+
    `📅 Активны за неделю: *${s.activeWeek}*\n\n`+
    `🎮 Всего игр сыграно: *${s.totalGames}*\n`+
    `💬 Всего сообщений: *${s.totalMessages.toLocaleString()}*\n`+
    `⭐ Всего XP выдано: *${s.totalXP.toLocaleString()}*\n\n`+
    `📚 Вопросов в базе: *${qCnt}*`,
    { parse_mode: 'Markdown' }
  );
});

// ─── /broadcast ───────────────────────────────────────────
const pendingBroadcast = new Map();

bot.command('broadcast', ctx => {
  if (!isAdmin(ctx.from.id)) return ctx.reply('❌ Нет доступа.');
  pendingBroadcast.set(ctx.from.id, true);
  const cnt = db.getAllUserIds().length;
  ctx.reply(`📢 *Рассылка*\n\nНапиши сообщение — оно уйдёт всем *${cnt}* пользователям.\n\n/cancelbroadcast — отмена`, { parse_mode: 'Markdown' });
});

bot.command('cancelbroadcast', ctx => {
  if (!isAdmin(ctx.from.id)) return;
  pendingBroadcast.delete(ctx.from.id);
  ctx.reply('❌ Рассылка отменена.');
});

// ─── /daily ───────────────────────────────────────────────
bot.command('daily', ctx => {
  const u = ensureUser(ctx);
  const claim = db.getDailyClaim(u.user_id);
  const now = nowTs();
  const secondsInDay = 86400;
  if (claim && now - claim.last_claim < secondsInDay) {
    const left = secondsInDay - (now - claim.last_claim);
    const h = Math.floor(left / 3600), m = Math.floor((left % 3600) / 60);
    return ctx.reply(`⏳ Награда уже получена!\n\nСледующая через: *${h}ч ${m}мин*`, { parse_mode: 'Markdown' });
  }
  const isStreak = claim && now - claim.last_claim < secondsInDay * 2;
  const streak = isStreak ? Math.min((claim.streak || 0) + 1, 7) : 1;
  const reward = DAILY_REWARDS[streak - 1];
  db.setDailyClaim(u.user_id, streak);
  db.updateCoins(reward.coins, u.user_id);
  giveXP(u.user_id, reward.xp, 0, 0);
  const days = DAILY_REWARDS.map((r, i) => i + 1 === streak ? `✅` : i + 1 < streak ? `☑️` : `⬜`).join('');
  ctx.reply(
    `🎁 *Ежедневная награда!*\n\n`+
    `${days}\n`+
    `📅 ${reward.label} — серия ${streak}/7\n\n`+
    `💰 +${reward.coins} монет\n`+
    `⭐ +${reward.xp} XP\n\n`+
    `${streak === 7 ? '🎉 Максимальная серия! Завтра начнётся заново.' : `Завтра: 💰${DAILY_REWARDS[streak]?.coins||50} монет ⭐${DAILY_REWARDS[streak]?.xp||20} XP`}`,
    { parse_mode: 'Markdown' }
  );
});

// ─── /shop ────────────────────────────────────────────────
bot.command('shop', ctx => {
  const u = ensureUser(ctx);
  const owned = db.getUserTitles(u.user_id);
  let text = `🛒 *Магазин титулов*\n\n💰 У тебя: ${db.getUser(u.user_id).coins} монет\n\n`;
  const btns = [];
  for (const item of SHOP_ITEMS) {
    const has = owned.includes(item.id);
    text += `${item.name} — ${has ? '✅ Куплено' : `💰 ${item.price}`}\n_${item.description}_\n\n`;
    if (!has) btns.push([Markup.button.callback(`Купить ${item.name} (${item.price})`, `buy_${item.id}`)]);
  }
  text += `\nЧтобы надеть титул: /mytitle`;
  ctx.reply(text, { parse_mode: 'Markdown', ...Markup.inlineKeyboard(btns) });
});

bot.action(/^buy_(.+)$/, async ctx => {
  const itemId = ctx.match[1];
  const item = SHOP_ITEMS.find(i => i.id === itemId);
  if (!item) return ctx.answerCbQuery('Товар не найден.');
  const u = ensureUser(ctx);
  const owned = db.getUserTitles(u.user_id);
  if (owned.includes(itemId)) return ctx.answerCbQuery('Уже куплено!', { show_alert: true });
  const user = db.getUser(u.user_id);
  if (user.coins < item.price) return ctx.answerCbQuery(`❌ Не хватает монет! Нужно ${item.price}, у тебя ${user.coins}`, { show_alert: true });
  db.updateCoins(-item.price, u.user_id);
  db.buyTitle(u.user_id, itemId);
  await ctx.answerCbQuery(`✅ Куплено! ${item.name}`);
  await ctx.editMessageText(`✅ *Ты купил титул ${item.name}!*\n\nНадень его через /mytitle`, { parse_mode: 'Markdown' });
});

// ─── /mytitle ─────────────────────────────────────────────
bot.command('mytitle', ctx => {
  const u = ensureUser(ctx);
  const owned = db.getUserTitles(u.user_id);
  if (!owned.length) return ctx.reply('У тебя нет титулов. Купи в /shop');
  const user = db.getUser(u.user_id);
  const btns = owned.map(id => {
    const item = SHOP_ITEMS.find(i => i.id === id);
    const active = user.active_title === id;
    return [Markup.button.callback(`${active ? '✅ ' : ''}${item ? item.name : id}`, `settitle_${id}`)];
  });
  ctx.reply(`🎖 *Твои титулы*\n\nВыбери активный:`, { parse_mode: 'Markdown', ...Markup.inlineKeyboard(btns) });
});

bot.action(/^settitle_(.+)$/, async ctx => {
  const titleId = ctx.match[1];
  const u = ensureUser(ctx);
  db.setActiveTitle(u.user_id, titleId);
  const item = SHOP_ITEMS.find(i => i.id === titleId);
  await ctx.answerCbQuery(`✅ Активен: ${item ? item.name : titleId}`);
  await ctx.editMessageText(`✅ Активный титул: *${item ? item.name : titleId}*`, { parse_mode: 'Markdown' });
});

// ─── /event ───────────────────────────────────────────────
bot.command('event', async ctx => {
  const chatId = ctx.chat.id;
  if (activeEvents.has(chatId)) return ctx.reply('🎪 Ивент уже идёт!');
  const e = { scores: {}, names: {}, round: 0, maxRounds: 10, active: false, answered: new Set(), currentQ: null };
  activeEvents.set(chatId, e);
  await ctx.reply(
    `🎪 *ГРУППОВОЙ ИВЕНТ!*\n\n`+
    `10 вопросов для всех!\n`+
    `⚡ Скорость ответа даёт бонусные очки\n`+
    `🏆 Победитель получит ⭐200 XP + 💰150 монет\n\n`+
    `Участвовать может любой — просто нажми на кнопку!`,
    { parse_mode: 'Markdown', ...Markup.inlineKeyboard([[Markup.button.callback('🚀 Начать ивент!', `ev_start_${chatId}`)]]) }
  );
});

bot.action(/^ev_start_(-?\d+)$/, async ctx => {
  const chatId = parseInt(ctx.match[1]);
  const e = activeEvents.get(chatId);
  if (!e) return ctx.answerCbQuery('Не найдено.');
  if (e.active) return ctx.answerCbQuery('Уже идёт!');
  await ctx.answerCbQuery();
  await ctx.editMessageText(`🎪 *Ивент начался!* Готовьтесь...`, { parse_mode: 'Markdown' });
  setTimeout(() => sendEventQ(ctx, chatId), 2000);
});

async function sendEventQ(ctx, chatId) {
  const e = activeEvents.get(chatId);
  if (!e || e.round >= e.maxRounds) return endEvent(ctx, chatId);
  e.round++; e.active = true; e.answered = new Set();
  const q = db.getRandomQuestion();
  const answers = [q.correct, q.wrong1, q.wrong2, q.wrong3].sort(() => Math.random() - 0.5);
  const ci = answers.indexOf(q.correct);
  e.currentQ = { q, answers, ci, start: Date.now() };
  const btns = answers.map((a, i) => [Markup.button.callback(`${['A','B','C','D'][i]}. ${a}`, `ev_${chatId}_${i}`)]);
  const msg = await ctx.telegram.sendMessage(chatId,
    `🎪 *Ивент — Вопрос ${e.round}/${e.maxRounds}*\n\n❓ *${q.question}*\n\n⚡ Быстрый ответ = больше очков!`,
    { parse_mode: 'Markdown', ...Markup.inlineKeyboard(btns) }
  );
  e.msgId = msg.message_id;
  const rn = e.round;
  setTimeout(async () => {
    const fresh = activeEvents.get(chatId);
    if (fresh && fresh.round === rn) {
      try { await ctx.telegram.editMessageText(chatId, e.msgId, null, `⏰ Время! Ответ: *${q.correct}*`, { parse_mode: 'Markdown' }); } catch(err) {}
      setTimeout(() => sendEventQ(ctx, chatId), 2000);
    }
  }, 15000);
}

bot.action(/^ev_(-?\d+)_(\d)$/, async ctx => {
  const chatId = parseInt(ctx.match[1]), chosen = parseInt(ctx.match[2]);
  const e = activeEvents.get(chatId);
  if (!e || !e.active || !e.currentQ) return ctx.answerCbQuery('Вопрос закрыт.');
  const u = ensureUser(ctx);
  if (e.answered.has(u.user_id)) return ctx.answerCbQuery('Уже ответил!', { show_alert: true });
  e.answered.add(u.user_id);
  e.names[u.user_id] = ctx.from.first_name;
  if (!e.scores[u.user_id]) e.scores[u.user_id] = 0;
  const elapsed = Math.round((Date.now() - e.currentQ.start) / 1000);
  if (chosen === e.currentQ.ci) {
    const pts = elapsed < 3 ? 5 : elapsed < 7 ? 3 : 2;
    e.scores[u.user_id] += pts;
    giveXP(u.user_id, pts * 5, 0, 0);
    await ctx.answerCbQuery(`✅ +${pts} очков! (${elapsed}с)`);
  } else {
    await ctx.answerCbQuery(`❌ Неверно! Ответ: ${e.currentQ.q.correct}`);
  }
});

async function endEvent(ctx, chatId) {
  const e = activeEvents.get(chatId); if (!e) return;
  activeEvents.delete(chatId);
  const sc = Object.entries(e.scores).sort((a, b) => b[1] - a[1]);
  if (!sc.length) return ctx.telegram.sendMessage(chatId, '🎪 Ивент завершён — никто не участвовал.');
  const [wId, wPts] = sc[0], wName = e.names[wId];
  const { levelUp, newLevel } = giveXP(parseInt(wId), 200, 0, 0);
  db.updateCoins(150, parseInt(wId));
  db.updateWin(parseInt(wId));
  const medals = ['🥇','🥈','🥉','4.','5.','6.','7.','8.','9.','10.'];
  let txt = `🎪 *Ивент завершён!*\n\n`;
  sc.slice(0, 10).forEach(([id, pts], i) => { txt += `${medals[i]} ${e.names[id]||'?'} — ${pts} очков\n`; });
  txt += `\n🏆 Победитель: *${wName}*!\n⭐ +200 XP | 💰 +150 монет`;
  if (levelUp) txt += `\n🎉 *ЛЕВЕЛ АП! Уровень ${newLevel}!*`;
  ctx.telegram.sendMessage(chatId, txt, { parse_mode: 'Markdown' });
}

bot.on('text', async ctx => {
  if (ctx.message.text.startsWith('/')) return;

  // Admin: broadcast
  if (isAdmin(ctx.from.id) && pendingBroadcast.has(ctx.from.id)) {
    pendingBroadcast.delete(ctx.from.id);
    const ids = db.getAllUserIds();
    const msg = ctx.message.text;
    let sent = 0, failed = 0;
    ctx.reply(`📢 Отправляю ${ids.length} пользователям...`);
    for (const id of ids) {
      try { await bot.telegram.sendMessage(id, `📢 *Сообщение от администратора:*\n\n${msg}`, { parse_mode: 'Markdown' }); sent++; } catch(e) { failed++; }
      await new Promise(r => setTimeout(r, 50));
    }
    return ctx.reply(`✅ Рассылка завершена!\n\n📨 Отправлено: ${sent}\n❌ Не доставлено: ${failed}`);
  }

  // Admin: addquestion dialog
  if (isAdmin(ctx.from.id) && pendingQuestions.has(ctx.from.id)) {
    const state = pendingQuestions.get(ctx.from.id);
    const text = ctx.message.text.trim();
    const steps = ['question','correct','wrong1','wrong2','wrong3','difficulty'];
    const labels = ['текст вопроса','правильный ответ','неверный ответ 1','неверный ответ 2','неверный ответ 3','сложность (easy/medium/hard)'];
    state[state.step] = text;
    const idx = steps.indexOf(state.step);
    if (state.step === 'difficulty') {
      if (!['easy','medium','hard'].includes(text.toLowerCase())) {
        return ctx.reply('❌ Введи: easy, medium или hard');
      }
      state.difficulty = text.toLowerCase();
      db.addQuestion(state);
      pendingQuestions.delete(ctx.from.id);
      const cnt = db.getQuestionsCount();
      return ctx.reply(`✅ *Вопрос добавлен!*\n\n❓ ${state.question}\n✅ ${state.correct}\n\nВсего в базе: ${cnt} вопросов`, { parse_mode: 'Markdown' });
    }
    state.step = steps[idx + 1];
    return ctx.reply(`Шаг ${idx + 2}/6 — Напиши *${labels[idx + 1]}:*`, { parse_mode: 'Markdown' });
  }

  const u = ensureUser(ctx);
  const { levelUp, newLevel } = giveXP(u.user_id, XP_MSG, 1, 0);
  if (levelUp) { db.updateCoins(newLevel*25, u.user_id); ctx.reply(`🎉 *${ctx.from.first_name} достиг уровня ${newLevel}!*\n🎖 ${title(newLevel)}\n💰 +${newLevel*25} монет!`, { parse_mode:'Markdown' }); }
});

bot.catch((err, ctx) => {
  console.error('[Ошибка]', err.message);
  try { ctx.reply('⚠️ Ошибка. Попробуй снова.'); } catch(e) {}
});

// ─── Запуск ───────────────────────────────────────────────
async function main() {
  console.log('⏳ Инициализация базы данных...');
  db = await dbModule.initDB();
  console.log('✅ База данных готова');
  console.log('⏳ Подключение к Telegram...');
  await bot.launch({ dropPendingUpdates: true });
  console.log('🤖 GameBot запущен! Напиши /start боту в Telegram');
}

main().catch(err => {
  console.error('❌ Ошибка запуска:', err.message);
  process.exit(1);
});

process.once('SIGINT',  () => { console.log('Останавливаю...'); bot.stop('SIGINT'); });
process.once('SIGTERM', () => { console.log('Останавливаю...'); bot.stop('SIGTERM'); });
