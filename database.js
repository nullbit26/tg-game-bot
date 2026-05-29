const path = require('path');
const fs   = require('fs');
const initSqlJs = require('sql.js');

const DB_PATH = path.join(__dirname, 'gamebot.db');

let db;

async function initDB() {
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      user_id     INTEGER PRIMARY KEY,
      username    TEXT,
      first_name  TEXT,
      xp          INTEGER DEFAULT 0,
      level       INTEGER DEFAULT 1,
      coins       INTEGER DEFAULT 100,
      messages    INTEGER DEFAULT 0,
      commands    INTEGER DEFAULT 0,
      wins        INTEGER DEFAULT 0,
      losses      INTEGER DEFAULT 0,
      streak      INTEGER DEFAULT 0,
      best_streak INTEGER DEFAULT 0,
      last_active  INTEGER DEFAULT 0,
      joined_at    INTEGER DEFAULT 0,
      active_title TEXT DEFAULT NULL
    );
    CREATE TABLE IF NOT EXISTS games (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      game_type   TEXT NOT NULL,
      chat_id     INTEGER NOT NULL,
      winner_id   INTEGER,
      loser_id    INTEGER,
      duration_s  INTEGER,
      details     TEXT,
      played_at   INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS trivia_questions (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      question    TEXT NOT NULL,
      correct     TEXT NOT NULL,
      wrong1      TEXT NOT NULL,
      wrong2      TEXT NOT NULL,
      wrong3      TEXT NOT NULL,
      category    TEXT DEFAULT 'general',
      difficulty  TEXT DEFAULT 'medium'
    );
    CREATE TABLE IF NOT EXISTS daily_activity (
      user_id   INTEGER,
      date      TEXT,
      messages  INTEGER DEFAULT 0,
      xp_earned INTEGER DEFAULT 0,
      PRIMARY KEY (user_id, date)
    );
    CREATE TABLE IF NOT EXISTS user_titles (
      user_id   INTEGER,
      title_id  TEXT,
      bought_at INTEGER DEFAULT 0,
      PRIMARY KEY (user_id, title_id)
    );
    CREATE TABLE IF NOT EXISTS daily_claims (
      user_id    INTEGER PRIMARY KEY,
      last_claim INTEGER DEFAULT 0,
      streak     INTEGER DEFAULT 0
    );
  `);

  // Seed questions if empty
  const cnt = db.exec('SELECT COUNT(*) as cnt FROM trivia_questions');
  if (cnt[0].values[0][0] === 0) {
    const qs = [
      ['Сколько байт в одном килобайте?','1024','1000','512','2048','tech','easy'],
      ['Какой язык создал Гвидо ван Россум?','Python','Ruby','Perl','Java','tech','easy'],
      ['Что означает HTTP?','HyperText Transfer Protocol','High Transfer Text Protocol','Hyper Tool Transfer Process','HyperText Tool Protocol','tech','medium'],
      ['Какая компания разработала JavaScript?','Netscape','Microsoft','Apple','Google','tech','medium'],
      ['Сколько планет в Солнечной системе?','8','9','7','10','science','easy'],
      ['Какой элемент имеет атомный номер 1?','Водород','Гелий','Литий','Углерод','science','easy'],
      ['Скорость света приблизительно равна...','300 000 км/с','150 000 км/с','500 000 км/с','1 000 000 км/с','science','medium'],
      ['В каком году был основан GitHub?','2008','2005','2010','2006','tech','medium'],
      ['Протокол для безопасной передачи данных?','HTTPS','FTP','HTTP','SMTP','tech','easy'],
      ['Что такое RAM?','Оперативная память','Постоянная память','Видеопамять','Кэш память','tech','easy'],
      ['Кто написал "Войну и мир"?','Лев Толстой','Достоевский','Пушкин','Тургенев','culture','easy'],
      ['Столица Японии?','Токио','Осака','Киото','Хиросима','geo','easy'],
      ['Самая длинная река в мире?','Нил','Амазонка','Янцзы','Миссисипи','geo','medium'],
      ['Сколько континентов на Земле?','7','6','5','8','geo','easy'],
      ['В каком году началась Вторая мировая война?','1939','1941','1938','1940','history','easy'],
      ['Кто изобрёл телефон?','Александр Белл','Томас Эдисон','Никола Тесла','Гульельмо Маркони','history','medium'],
      ['Самая высокая гора в мире?','Эверест','К2','Канченджанга','Лхоцзе','geo','easy'],
      ['Что такое DNS?','Domain Name System','Dynamic Network Service','Data Name Server','Direct Network System','tech','medium'],
      ['Сколько бит в одном байте?','8','4','16','6','tech','easy'],
      ['Язык для веб-стилей?','CSS','HTML','PHP','SQL','tech','easy'],
      ['Кто основал Tesla?','Илон Маск','Стив Джобс','Джефф Безос','Билл Гейтс','tech','medium'],
      ['Что означает SQL?','Structured Query Language','Simple Query Logic','Server Query Language','Standard Query List','tech','easy'],
      ['Какой порт использует HTTPS?','443','80','8080','22','tech','medium'],
      ['Сколько цветов в радуге?','7','6','5','8','science','easy'],
      ['Что такое Node.js?','Среда выполнения JavaScript на сервере','База данных','CSS фреймворк','Веб-браузер','tech','easy'],
      ['Что означает API?','Application Programming Interface','Advanced Program Integration','Application Process Index','Auto Program Interface','tech','easy'],
      ['Оператор строгого сравнения в JS?','===','==','=','!=','tech','easy'],
      ['Что такое JSON?','JavaScript Object Notation','Java Standard Object Network','JavaScript Open Network','Java Object Node','tech','easy'],
      ['Столица Германии?','Берлин','Мюнхен','Гамбург','Франкфурт','geo','easy'],
      ['Что такое Docker?','Платформа контейнеризации','Язык программирования','База данных','Веб-сервер','tech','medium'],
    ];
    for (const q of qs) {
      db.run(`INSERT INTO trivia_questions (question,correct,wrong1,wrong2,wrong3,category,difficulty) VALUES (?,?,?,?,?,?,?)`, q);
    }
  }
  try { db.run(`ALTER TABLE users ADD COLUMN active_title TEXT DEFAULT NULL`); } catch(e) {}
  saveDB();
  return { getUser, upsertUser, addXP, updateLevel, updateCoins, updateWin, updateLoss, getTopXP, getTopWins, getTopActivity, logGame, getGameHistory, getRandomQuestion, getQuestionsByDifficulty, logDailyXP, getUserDailyStats, getUserByUsername, calcLevel, xpForLevel, xpProgress, getDailyClaim, setDailyClaim, getUserTitles, buyTitle, setActiveTitle, addQuestion, getQuestionsCount, getAdminStats, getAllUserIds };
}

function saveDB() {
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

// ─── Wrappers ──────────────────────────────────────────────
function nowTs() { return Math.floor(Date.now()/1000); }

function getUser(userId) {
  const r = db.exec(`SELECT * FROM users WHERE user_id = ${userId}`);
  if (!r.length || !r[0].values.length) return null;
  return rowToObj(r[0].columns, r[0].values[0]);
}

function upsertUser({ user_id, username, first_name, last_active }) {
  const u = username ? `'${username.replace(/'/g,"''")}'` : 'NULL';
  const fn = first_name ? `'${first_name.replace(/'/g,"''")}'` : "'Игрок'";
  db.run(`INSERT INTO users (user_id,username,first_name,last_active,joined_at) VALUES (${user_id},${u},${fn},${last_active},${last_active}) ON CONFLICT(user_id) DO UPDATE SET username=${u},first_name=${fn},last_active=${last_active}`);
  saveDB();
}

function addXP({ user_id, xp, msgs, cmds, now }) {
  db.run(`UPDATE users SET xp=xp+${xp},messages=messages+${msgs},commands=commands+${cmds},last_active=${now} WHERE user_id=${user_id}`);
  saveDB();
}

function updateLevel(level, userId) {
  db.run(`UPDATE users SET level=${level} WHERE user_id=${userId}`);
  saveDB();
}

function updateCoins(amount, userId) {
  db.run(`UPDATE users SET coins=coins+${amount} WHERE user_id=${userId}`);
  saveDB();
}

function updateWin(userId) {
  db.run(`UPDATE users SET wins=wins+1,streak=streak+1,best_streak=MAX(best_streak,streak+1) WHERE user_id=${userId}`);
  saveDB();
}

function updateLoss(userId) {
  db.run(`UPDATE users SET losses=losses+1,streak=0 WHERE user_id=${userId}`);
  saveDB();
}

function getTopXP() {
  const r = db.exec(`SELECT * FROM users ORDER BY xp DESC LIMIT 10`);
  return r.length ? r[0].values.map(v => rowToObj(r[0].columns, v)) : [];
}

function getTopWins() {
  const r = db.exec(`SELECT * FROM users ORDER BY wins DESC LIMIT 10`);
  return r.length ? r[0].values.map(v => rowToObj(r[0].columns, v)) : [];
}

function getTopActivity() {
  const r = db.exec(`SELECT * FROM users ORDER BY messages DESC LIMIT 10`);
  return r.length ? r[0].values.map(v => rowToObj(r[0].columns, v)) : [];
}

function logGame({ game_type, chat_id, winner_id, loser_id, duration_s, details }) {
  const d = details ? `'${details.replace(/'/g,"''")}'` : 'NULL';
  const li = loser_id || 'NULL';
  db.run(`INSERT INTO games (game_type,chat_id,winner_id,loser_id,duration_s,details,played_at) VALUES ('${game_type}',${chat_id},${winner_id},${li},${duration_s||0},${d},${nowTs()})`);
  saveDB();
}

function getGameHistory(chatId, limit) {
  const r = db.exec(`SELECT g.*,wu.first_name as winner_name,lu.first_name as loser_name FROM games g LEFT JOIN users wu ON g.winner_id=wu.user_id LEFT JOIN users lu ON g.loser_id=lu.user_id WHERE g.chat_id=${chatId} ORDER BY g.played_at DESC LIMIT ${limit}`);
  return r.length ? r[0].values.map(v => rowToObj(r[0].columns, v)) : [];
}

function getRandomQuestion() {
  const r = db.exec(`SELECT * FROM trivia_questions ORDER BY RANDOM() LIMIT 1`);
  return r.length ? rowToObj(r[0].columns, r[0].values[0]) : null;
}

function getQuestionsByDifficulty(diff) {
  const r = db.exec(`SELECT * FROM trivia_questions WHERE difficulty='${diff}' ORDER BY RANDOM() LIMIT 1`);
  return r.length ? rowToObj(r[0].columns, r[0].values[0]) : null;
}

function logDailyXP({ user_id, date, msgs, xp }) {
  db.run(`INSERT INTO daily_activity (user_id,date,messages,xp_earned) VALUES (${user_id},'${date}',${msgs},${xp}) ON CONFLICT(user_id,date) DO UPDATE SET messages=messages+${msgs},xp_earned=xp_earned+${xp}`);
  saveDB();
}

function getUserDailyStats(userId) {
  const r = db.exec(`SELECT * FROM daily_activity WHERE user_id=${userId} ORDER BY date DESC LIMIT 7`);
  return r.length ? r[0].values.map(v => rowToObj(r[0].columns, v)) : [];
}

function getUserByUsername(username) {
  const r = db.exec(`SELECT * FROM users WHERE username='${username.replace(/'/g,"''")}'`);
  return r.length && r[0].values.length ? rowToObj(r[0].columns, r[0].values[0]) : null;
}

function rowToObj(cols, vals) {
  const obj = {};
  cols.forEach((c, i) => obj[c] = vals[i]);
  return obj;
}

// ─── Level helpers ─────────────────────────────────────────
function xpForLevel(level) { return Math.floor(100 * Math.pow(1.5, level - 1)); }
function calcLevel(xp) {
  let level = 1, total = 0;
  while (true) { const n = xpForLevel(level); if (total + n > xp) break; total += n; level++; }
  return level;
}
function xpProgress(user) {
  let total = 0;
  for (let i = 1; i < user.level; i++) total += xpForLevel(i);
  const cur = user.xp - total, need = xpForLevel(user.level);
  return { current: cur, needed: need, percent: Math.min(100, Math.floor((cur / need) * 100)) };
}

function getAdminStats() {
  const total = db.exec(`SELECT COUNT(*) as cnt FROM users`);
  const activeToday = db.exec(`SELECT COUNT(DISTINCT user_id) as cnt FROM daily_activity WHERE date='${new Date().toISOString().slice(0,10)}'`);
  const activeWeek = db.exec(`SELECT COUNT(DISTINCT user_id) as cnt FROM daily_activity WHERE date >= date('now','-7 days')`);
  const totalGames = db.exec(`SELECT COUNT(*) as cnt FROM games`);
  const totalMsgs = db.exec(`SELECT SUM(messages) as cnt FROM users`);
  const totalXP = db.exec(`SELECT SUM(xp) as cnt FROM users`);
  return {
    totalUsers: total[0].values[0][0],
    activeToday: activeToday[0].values[0][0],
    activeWeek: activeWeek[0].values[0][0],
    totalGames: totalGames[0].values[0][0],
    totalMessages: totalMsgs[0].values[0][0] || 0,
    totalXP: totalXP[0].values[0][0] || 0,
  };
}

function getAllUserIds() {
  const r = db.exec(`SELECT user_id FROM users`);
  return r.length ? r[0].values.map(v => v[0]) : [];
}

function addQuestion({ question, correct, wrong1, wrong2, wrong3, category, difficulty }) {
  db.run(`INSERT INTO trivia_questions (question,correct,wrong1,wrong2,wrong3,category,difficulty) VALUES (?,?,?,?,?,?,?)`,
    [question, correct, wrong1, wrong2, wrong3, category || 'general', difficulty || 'medium']);
  saveDB();
}

function getQuestionsCount() {
  const r = db.exec(`SELECT COUNT(*) as cnt FROM trivia_questions`);
  return r.length ? r[0].values[0][0] : 0;
}

function getDailyClaim(userId) {
  const r = db.exec(`SELECT * FROM daily_claims WHERE user_id=${userId}`);
  return r.length && r[0].values.length ? rowToObj(r[0].columns, r[0].values[0]) : null;
}

function setDailyClaim(userId, streak) {
  const now = nowTs();
  db.run(`INSERT INTO daily_claims (user_id, last_claim, streak) VALUES (${userId}, ${now}, ${streak}) ON CONFLICT(user_id) DO UPDATE SET last_claim=${now}, streak=${streak}`);
  saveDB();
}

function getUserTitles(userId) {
  const r = db.exec(`SELECT title_id FROM user_titles WHERE user_id=${userId}`);
  return r.length ? r[0].values.map(v => v[0]) : [];
}

function buyTitle(userId, titleId) {
  db.run(`INSERT OR IGNORE INTO user_titles (user_id, title_id, bought_at) VALUES (${userId}, '${titleId}', ${nowTs()})`);
  saveDB();
}

function setActiveTitle(userId, titleId) {
  db.run(`UPDATE users SET active_title='${titleId}' WHERE user_id=${userId}`);
  saveDB();
}

module.exports = { initDB, getUser, upsertUser, addXP, updateLevel, updateCoins, updateWin, updateLoss, getTopXP, getTopWins, getTopActivity, logGame, getGameHistory, getRandomQuestion, getQuestionsByDifficulty, logDailyXP, getUserDailyStats, getUserByUsername, calcLevel, xpForLevel, xpProgress, getDailyClaim, setDailyClaim, getUserTitles, buyTitle, setActiveTitle, addQuestion, getQuestionsCount, getAdminStats, getAllUserIds };
