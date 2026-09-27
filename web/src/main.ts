import './style.css';
import { api, type Me, type LeaderboardEntry } from './api';
import { BikeEngine } from './game/engine';

const GAME_TITLE = '我的 Token, danced by bike:';

const TAUNTS = [
  '啪！你在马路上被打了一巴掌，没人知道为什么。',
  'K3 核心正在闷闷儿烧，烧得很含蓄。',
  'TokenDance 的虚拟额度正在随你的腿肚子起舞。',
  '前方 200 米有一个哲学问题，请减速。',
  '你的左脚和右脚刚刚达成了共识。',
  '这辆车没有链条，全靠信念传动。',
  '路过的风给你的功率点了个赞。',
  'K3 说：再踩两脚，我就快想明白人生了。',
  '警告：本游戏不消耗任何真实卡路里。',
  '你踩得越狠，词元越烫。',
];

const SLAP_TAUNTS = [
  '啪！马路突然伸出一只手，给了你一巴掌！',
  '啪！一只过路的鸽子对你实施了空气动力学制裁！',
  '啪！红绿灯觉得你太得意，远程扇了你一下！',
];

const app = document.querySelector<HTMLDivElement>('#app')!;

app.innerHTML = `
  <div class="scanlines flex min-h-screen flex-col">
    <header class="z-20 flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-8">
      <div>
        <h1 class="neon-text text-xl font-black tracking-wide text-volt sm:text-2xl">《${GAME_TITLE}》</h1>
        <p class="text-xs text-slate-400">踩二轮 · 发虚电 · 喂 K3 · 闷闷儿烧</p>
      </div>
      <div id="account" class="flex items-center gap-2"></div>
    </header>

    <main class="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 pb-8 sm:px-8">
      <section class="glass relative overflow-hidden rounded-3xl">
        <div id="stage" class="h-[46vh] min-h-[320px] w-full cursor-pointer select-none touch-manipulation"></div>
        <div id="popups" class="pointer-events-none absolute inset-0 overflow-hidden"></div>
        <div class="pointer-events-none absolute left-3 top-3 flex flex-wrap gap-2" id="hud"></div>
        <div id="taunt" class="pointer-events-none absolute bottom-3 left-1/2 w-[92%] -translate-x-1/2 text-center text-sm text-juice/90"></div>
      </section>

      <section class="grid gap-4 md:grid-cols-2">
        <div class="glass rounded-3xl p-5">
          <h2 class="mb-3 text-sm font-bold tracking-widest text-ember">⚡ 发电舱仪表</h2>
          <div class="space-y-3 text-sm">
            <div>
              <div class="mb-1 flex justify-between text-slate-300"><span>体力</span><span id="staminaText">100%</span></div>
              <div class="h-2 overflow-hidden rounded-full bg-slate-800"><div id="staminaBar" class="h-full rounded-full bg-volt transition-[width] duration-150" style="width:100%"></div></div>
            </div>
            <div>
              <div class="mb-1 flex justify-between text-slate-300"><span>K3 核心烧度</span><span id="coreText">闷闷儿</span></div>
              <div class="h-2 overflow-hidden rounded-full bg-slate-800"><div id="coreBar" class="h-full rounded-full bg-juice transition-[width] duration-150" style="width:0%"></div></div>
            </div>
            <p class="text-xs leading-relaxed text-slate-400">
              操作：点击 / 触摸画面，或狂敲 <kbd class="rounded bg-slate-800 px-1">空格</kbd> 模拟踩踏。
              有节奏的踩踏（约每秒 4~5 次）能触发踏频加成。小心马路，它会打你。
            </p>
          </div>
        </div>

        <div class="glass rounded-3xl p-5">
          <h2 class="mb-3 text-sm font-bold tracking-widest text-ember">🏆 词元富豪榜</h2>
          <ol id="leaderboard" class="space-y-2 text-sm"></ol>
        </div>
      </section>

      <footer class="text-center text-xs text-slate-500">
        观猹 FDE 共学营出品 · 本游戏仅生产虚拟词元，TokenDance 额度概不兑现 · 被马路打了请自行揉脸
      </footer>
    </main>
  </div>
`;

const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!;

const accountEl = $('#account');
const hudEl = $('#hud');
const tauntEl = $('#taunt');
const popupsEl = $('#popups');
const staminaBar = $('#staminaBar');
const staminaText = $('#staminaText');
const coreBar = $('#coreBar');
const coreText = $('#coreText');
const leaderboardEl = $('#leaderboard');

let me: Me | null = null;
let pendingSync = 0;
let syncing = false;

function renderAccount() {
  if (!me) {
    accountEl.innerHTML = `
      <span class="token-pill text-xs text-slate-300">未登录 · 词元存不进 TokenDance</span>
      <button id="loginBtn" class="rounded-full bg-juice px-4 py-2 text-sm font-bold text-abyss transition hover:brightness-110">观猹登录开骑</button>`;
    $('#loginBtn').addEventListener('click', () => api.login());
    return;
  }
  accountEl.innerHTML = `
    <span class="token-pill text-sm">
      ${me.avatar_url ? `<img src="${me.avatar_url}" alt="" class="h-6 w-6 rounded-full" referrerpolicy="no-referrer" />` : ''}
      <span class="max-w-28 truncate">${me.nickname}</span>
      <span class="font-mono font-bold text-volt" id="balanceText">⚡${me.balance}</span>
      <span class="text-xs text-slate-400">今日 +${me.today}</span>
    </span>
    <button id="logoutBtn" class="rounded-full border border-slate-600 px-3 py-1.5 text-xs text-slate-300 transition hover:border-juice hover:text-juice">下车</button>`;
  $('#logoutBtn').addEventListener('click', async () => {
    await flushSync();
    await api.logout().catch(() => undefined);
    me = null;
    renderAccount();
  });
}

function popupImg(src: string) {
  const el = document.createElement('img');
  el.src = src;
  el.alt = '啪！';
  el.className = 'earn-pop absolute w-36 rounded-2xl border-2 border-juice shadow-2xl sm:w-48';
  el.style.left = `${30 + Math.random() * 25}%`;
  el.style.top = `${20 + Math.random() * 20}%`;
  popupsEl.appendChild(el);
  setTimeout(() => el.remove(), 1100);
}

function popup(text: string, tone: 'volt' | 'juice' = 'volt') {
  const el = document.createElement('span');
  el.textContent = text;
  el.className = `earn-pop absolute text-lg font-black ${tone === 'volt' ? 'text-volt' : 'text-juice'}`;
  el.style.left = `${35 + Math.random() * 30}%`;
  el.style.top = `${30 + Math.random() * 25}%`;
  popupsEl.appendChild(el);
  setTimeout(() => el.remove(), 1100);
}

let tauntTimer = 0;
function taunt(text: string, hold = 4200) {
  tauntEl.textContent = text;
  clearTimeout(tauntTimer);
  tauntTimer = setTimeout(() => { tauntEl.textContent = ''; }, hold);
}

const engine = new BikeEngine({
  onSnapshot: ({ speedKmh, watts, tokensPerSec, stamina, sessionTokens, coreCharge }) => {
    hudEl.innerHTML = `
      <span class="token-pill text-xs">🚲 <b class="font-mono">${speedKmh.toFixed(0)}</b> km/h</span>
      <span class="token-pill text-xs">⚡ <b class="font-mono">${watts}</b> W</span>
      <span class="token-pill text-xs">🪙 <b class="font-mono">${tokensPerSec.toFixed(2)}</b> 词元/s</span>
      <span class="token-pill text-xs">本次 <b class="font-mono text-ember">${sessionTokens.toFixed(1)}</b> 词元</span>`;
    staminaBar.style.width = `${stamina}%`;
    staminaText.textContent = `${stamina.toFixed(0)}%`;
    coreBar.style.width = `${coreCharge}%`;
    coreText.textContent = coreCharge > 80 ? '猛烈闷烧🔥' : coreCharge > 40 ? '闷闷儿烧' : '闷闷儿';
  },
  onEarn: (whole) => {
    pendingSync += whole;
    popup(`+${whole} 词元`);
    if (pendingSync >= 10) void flushSync();
  },
});

async function flushSync() {
  if (syncing || pendingSync <= 0) return;
  if (!me) return; // 游客的词元只能随风而逝
  syncing = true;
  const tokens = pendingSync;
  pendingSync = 0;
  try {
    const result = await api.sync(tokens);
    me.balance = result.balance;
    me.total = result.total;
    me.today += result.earned;
    if (result.capped) taunt('今日词元产量已达上限，K3 说它吃撑了，明天再来。', 6000);
    renderAccount();
    void loadLeaderboard();
  } catch {
    pendingSync += tokens; // 网络打滑，词元先揣回兜里
  } finally {
    syncing = false;
  }
}

async function loadLeaderboard() {
  try {
    const rows: LeaderboardEntry[] = await api.leaderboard();
    leaderboardEl.innerHTML = rows.length
      ? rows.map((row, i) => `
        <li class="flex items-center gap-2 rounded-xl bg-abyss/60 px-3 py-2">
          <span class="w-5 text-center font-mono ${i < 3 ? 'text-ember' : 'text-slate-500'}">${i + 1}</span>
          ${row.avatar_url ? `<img src="${row.avatar_url}" alt="" class="h-6 w-6 rounded-full" referrerpolicy="no-referrer" />` : '<span class="h-6 w-6 rounded-full bg-slate-700"></span>'}
          <span class="flex-1 truncate">${row.nickname}</span>
          <span class="font-mono font-bold text-volt">${row.total}</span>
        </li>`).join('')
      : '<li class="text-slate-500">虚位以待，第一个词元富豪可能就是你。</li>';
  } catch {
    leaderboardEl.innerHTML = '<li class="text-slate-500">榜单信号被马路打断了。</li>';
  }
}

// 随机无厘头事件：吐槽 or 被马路打巴掌
function scheduleShenanigans() {
  const delay = 14_000 + Math.random() * 20_000;
  setTimeout(() => {
    if (Math.random() < 0.3) {
      engine.slap(0.4 + Math.random() * 0.4);
      popupImg('/assets/meme-slap.png');
      taunt(SLAP_TAUNTS[Math.floor(Math.random() * SLAP_TAUNTS.length)], 5200);
    } else {
      taunt(TAUNTS[Math.floor(Math.random() * TAUNTS.length)]);
    }
    scheduleShenanigans();
  }, delay);
}

async function boot() {
  await engine.mount($('#stage'));
  taunt('点击画面或敲空格开踩，给 K3 续一口闷闷儿烧。', 6000);
  try { me = await api.me(); } catch { me = null; }
  renderAccount();
  await loadLeaderboard();
  setInterval(() => void flushSync(), 6000);
  setInterval(() => void loadLeaderboard(), 30_000);
  scheduleShenanigans();
}

void boot();
