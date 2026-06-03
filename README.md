# 🎮 Telegram Game Bot

A feature-rich Telegram group game bot with XP system, levels, trivia, duels, shop, daily rewards, and admin tools.

> Built with Node.js + Telegraf + SQLite — no external database required.

---

## 🎯 Use Cases

Perfect for:
- 👥 **Telegram Communities** — engage members with games and competitions
- 🎮 **Gaming Groups** — duels, trivia, group events
- 🏢 **Employee Engagement** — team building through friendly competition
- 📚 **Educational Groups** — quiz mode for learning and testing knowledge
- 🎉 **Event Bots** — competitions during streams, webinars, meetups

## ✨ Features

### 🎯 Gameplay
- **Trivia** — 4-choice questions with 30s timer, easy/medium/hard difficulty
- **Duels** — 1v1 real-time challenge between players
- **Compete** — 5-round group competition
- **Group Event** — 10-round event for the whole chat, speed bonuses

### � Progression
- XP & level system (10 titles: Newbie → GOD)
- Coins earned through activity and wins
- **Daily rewards** — 7-day streak with increasing bonuses
- **Title Shop** — buy custom titles (Shadow, Dragon, King, Hacker, etc.)
- Level-up notifications with coin bonuses

### 📊 Stats & Leaderboards
- Personal profile, full stats, 7-day activity chart
- Top 10 by XP, wins, and activity
- Game history

### 🛠 Admin Panel
- `/adminstats` — total users, active today/week, games played, messages, XP
- `/broadcast` — send a message to all users
- `/addquestion` — add trivia questions via step-by-step dialog
- `/questions` — view total question count

---

## 🚀 Getting Started

### 1. Clone & Install
```bash
git clone https://github.com/yourusername/tg-game-bot.git
cd tg-game-bot
npm install
```

### 2. Configure
1. Copy `config.json.example` to `config.json` (just rename the file)
2. Open `config.json` in Notepad and fill in your values:
```json
{
  "BOT_TOKEN": "your_bot_token_here",
  "ADMIN_IDS": "your_telegram_id_here"
}
```

**How to get these values:**
- **BOT_TOKEN**: Message @BotFather in Telegram, create new bot, copy token
- **ADMIN_IDS**: Message @userinfobot, copy your ID number

### 3. Run
```bash
node bot.js
# or with auto-restart:
npm run dev
```

### 4. Add to Group
- Add the bot to your Telegram group
- Go to **@BotFather → Bot Settings → Group Privacy → Turn OFF**
- This allows the bot to track messages and award XP

---

## � Project Structure
```
tg-game-bot/
├── bot.js          # Commands, handlers, game logic
├── database.js     # SQLite wrapper, all DB functions
├── gamebot.db      # Auto-created SQLite database
├── config.json     # Secrets (not committed, create from example)
├── .gitignore
└── package.json
```

---

## ⚙️ Tech Stack
- **Node.js**
- **Telegraf v4** — Telegram Bot framework
- **sql.js** — SQLite in Node.js (no native deps, no compilation)
- **node-cron** — scheduled tasks

---

## � Commands Reference

| Command | Description |
|---|---|
| `/start` | Register and view commands |
| `/profile` | Your level, XP, coins, win rate |
| `/stats` | Full statistics |
| `/mystats` | 7-day activity chart |
| `/top` | Top 10 by XP |
| `/topwins` | Top 10 by wins |
| `/activity` | Top 10 by messages |
| `/quiz [easy\|hard]` | Start a trivia question |
| `/duel @user` | Challenge a player to a duel |
| `/compete` | Start a 5-round competition |
| `/event` | Start a 10-round group event |
| `/daily` | Claim daily reward (7-day streak) |
| `/shop` | Browse title shop |
| `/mytitle` | Equip a purchased title |
| `/history` | Last 10 games |
| `/help` | Full help |

---

## 📄 License
MIT
