import './style.css';
import { api, type Me, type LeaderboardEntry } from './api';
import { BikeEngine } from './game/engine';

const $ = <T extends HTMLElement = HTMLElement>(sel: string) =>
  document.querySelector(sel) as T;

const fmt = (n: number) =>
  n >= 10000 ? `${(n / 1000).toFixed(1)}k` : n.toFixed(n >= 100 ? 0 : 1);

// ---------- 页面骨架 ----------
document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
<header class="fixed top-0 inset-x-0 z-40 bg-paper/85 backdrop-blur border-b border-ink/10">
  <div class="max-w-6xl mx-auto px-4 h-16 flex items-center gap-3">
    <img src="/assets/logo.png" alt="logo" class="w-9 h-9 rounded-full frame-line" onerror="this.style.display='none'"/>
    <span class="font-serif font-bold tracking-wide">我的 Token, <span class="italic text-verm">danced by bike:</span></span>
    <div class="ml-auto flex items-center gap-4">
      <div id="nav-balance" class="hidden sm:flex items-baseline gap-1.5 text-brass font-bold stat-num">
        <span class="text-lg leading-none">◉</span><span id="nav-balance-num" class="text-lg">0</span><span class="text-xs text-inksoft font-normal">词元</span>
      </div>
      <div id="auth-slot"></div>
    </div>
  </div>
</header>

<!-- Hero -->
<section class="pt-16 min-h-[92vh] relative flex items-center">
  <div class="max-w-6xl mx-auto px-4 py-20 grid md:grid-cols-2 gap-12 items-center w-full">
    <div>
      <div class="inline-flex items-center gap-2 text-xs tracking-widest uppercase text-inksoft mb-8">
        <span class="w-8 h-px bg-ink/40"></span>赛博发电站 · 虚拟词元 · 零碳排
      </div>
      <h1 class="font-serif text-5xl md:text-7xl font-black leading-[1.05]">
        踩上单车,<br/>让 Token <span class="italic text-verm">dance</span>
      </h1>
      <p class="mt-8 text-inksoft leading-relaxed max-w-md">
        一台固定单车,一台黄铜发电机,一颗永远吃不饱的 K3 核心。
        你负责踩,它负责烧 —— 踩得越快,词元来得越快。
      </p>
      <div class="mt-10 flex flex-wrap gap-4">
        <a href="#ride" class="px-8 py-3.5 rounded-full bg-verm text-paper font-bold text-lg hover:bg-ink transition-colors">开始踩踏</a>
        <a href="#board" class="px-6 py-3.5 rounded-full border border-ink/25 hover:border-ink hover:bg-ink hover:text-paper transition-colors">词元富豪榜</a>
      </div>
      <div class="mt-14 flex gap-10 text-sm text-inksoft">
        <div><div class="font-serif text-3xl font-black text-ink stat-num" id="stat-global">-</div><div class="mt-1">全站闷烧词元</div></div>
        <div><div class="font-serif text-3xl font-black text-ink stat-num" id="stat-riders">-</div><div class="mt-1">在册骑手</div></div>
        <div><div class="font-serif text-3xl font-black text-ink stat-num">¥0</div><div class="mt-1">真实电费支出</div></div>
      </div>
    </div>
    <div class="hidden md:block animate-floaty">
      <img src="/assets/hero-pedal.webp" alt="踩车发电" class="rounded-lg frame-line shadow-[0_24px_60px_-20px_rgba(28,36,32,.35)]" onerror="this.parentElement.style.display='none'"/>
    </div>
  </div>
</section>

<!-- 跑马灯 -->
<div class="border-y border-ink/10 bg-card py-2.5 overflow-hidden whitespace-nowrap">
  <div class="inline-block animate-marquee text-sm text-inksoft" id="marquee"></div>
</div>

<!-- 游戏区 -->
<section id="ride" class="max-w-6xl mx-auto px-4 py-16">
  <div class="flex items-baseline gap-4 mb-2">
    <h2 class="font-serif text-4xl font-black">踩踏车间</h2>
    <span class="text-inksoft text-sm tracking-widest">THE WORKSHOP</span>
  </div>
  <p class="text-inksoft mb-8 max-w-2xl">
    左右方向键 <kbd class="px-1.5 py-0.5 rounded border border-ink/25 bg-card text-xs">←</kbd>
    <kbd class="px-1.5 py-0.5 rounded border border-ink/25 bg-card text-xs">→</kbd> 交替敲,就是踩踏板;
    手机用画面下方的「左蹬 / 右蹬」。踩得越快,功率越高,词元越多 —— 但省着点腿。
  </p>

  <div class="rounded-lg overflow-hidden frame-line bg-card relative">
    <div id="game-wrap" class="w-full aspect-[16/9]"></div>

    <!-- HUD -->
    <div class="grid grid-cols-2 md:grid-cols-5 gap-px bg-ink/10 border-t border-ink/15 text-center">
      <div class="bg-card p-3.5"><div class="font-serif text-2xl font-black stat-num" id="hud-speed">0.0</div><div class="text-xs text-inksoft mt-0.5">时速 km/h</div></div>
      <div class="bg-card p-3.5"><div class="font-serif text-2xl font-black text-verm stat-num" id="hud-watts">0</div><div class="text-xs text-inksoft mt-0.5">功率 W</div></div>
      <div class="bg-card p-3.5"><div class="font-serif text-2xl font-black text-brass stat-num" id="hud-tps">0.0</div><div class="text-xs text-inksoft mt-0.5">词元/秒</div></div>
      <div class="bg-card p-3.5"><div class="font-serif text-2xl font-black stat-num" id="hud-session">0</div><div class="text-xs text-inksoft mt-0.5">本次已发词元</div></div>
      <div class="bg-card p-3.5 col-span-2 md:col-span-1">
        <div class="h-8 flex items-center px-3"><div class="w-full h-2.5 rounded-full bg-ink/10 overflow-hidden"><div id="hud-stamina" class="h-full rounded-full bg-verm transition-all duration-150" style="width:100%"></div></div></div>
        <div class="text-xs text-inksoft">腿力</div>
      </div>
    </div>

    <!-- 手机踏板 -->
    <div class="md:hidden grid grid-cols-2 gap-3 p-3 bg-card border-t border-ink/15">
      <button id="pedal-l" class="py-6 rounded-lg bg-ink text-paper font-bold text-xl active:bg-verm select-none">左 蹬</button>
      <button id="pedal-r" class="py-6 rounded-lg bg-verm text-paper font-bold text-xl active:bg-ink select-none">右 蹬</button>
    </div>

    <!-- 未登录提示条 -->
    <div id="guest-bar" class="hidden absolute top-3 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-paper/90 frame-line text-sm backdrop-blur">
      游客模式:词元只在本地发光,<a href="/api/auth/login" class="text-verm underline underline-offset-2 font-bold">观猹登录</a>后才会入账
    </div>
  </div>
</section>

<!-- 排行榜 -->
<section id="board" class="max-w-6xl mx-auto px-4 pb-24">
  <div class="flex items-baseline gap-4 mb-8">
    <h2 class="font-serif text-4xl font-black">词元富豪榜</h2>
    <span class="text-inksoft text-sm tracking-widest">HALL OF WATTS</span>
  </div>
  <div class="rounded-lg frame-line bg-card overflow-hidden">
    <table class="w-full text-sm">
      <thead><tr class="text-inksoft border-b border-ink/15 text-xs tracking-widest">
        <th class="py-3.5 px-4 text-left w-14">名次</th><th class="py-3.5 px-4 text-left">骑手</th>
        <th class="py-3.5 px-4 text-right">今日</th><th class="py-3.5 px-4 text-right">总词元</th>
      </tr></thead>
      <tbody id="board-body"><tr><td colspan="4" class="py-12 text-center text-inksoft">加载中…</td></tr></tbody>
    </table>
  </div>
</section>

<footer class="border-t border-ink/10 py-12 text-center text-inksoft text-sm space-y-2.5">
  <p class="font-serif text-ink text-lg font-bold">《我的 Token, danced by bike:》</p>
  <p>双腿发电,词元入账。</p>
  <p class="flex items-center justify-center gap-1.5">
    登录由 <img src="/assets/watcha-logo.png" alt="观猹" class="w-4 h-4 rounded"/> 观猹 OAuth2 提供
  </p>
  <p class="text-inksoft/70 text-xs">本站词元均为虚拟娱乐数值,与任何真实账户额度无关。</p>
</footer>

<div id="toast-zone" class="fixed top-20 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2 pointer-events-none"></div>
`;

// ---------- 跑马灯 ----------
const MEMES = [
  '踩一圈,词元 +1;踩一万圈,K3 随便烧',
  '小心:马路上可能随时伸来一巴掌',
  'K3 核心今天又饿了',
  '你的踏频,就是词元的流速',
  '本车间零碳排放,纯腿驱动',
  '富豪榜不收税,只收腿',
  '腿力耗尽时,连发电机都替你喘',
];
const marqueeEl = $('#marquee');
marqueeEl.textContent = [...MEMES, ...MEMES].join('　　　✦　　　');

// ---------- Toast ----------
function toast(html: string, ms = 3600) {
  const el = document.createElement('div');
  el.className =
    'toast pointer-events-auto px-5 py-3 rounded-lg bg-card frame-line shadow-[0_16px_40px_-12px_rgba(28,36,32,.3)] text-sm max-w-sm text-center';
  el.innerHTML = html;
  $('#toast-zone').appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity .4s, transform .4s';
    el.style.opacity = '0';
    el.style.transform = 'translateY(-10px)';
    setTimeout(() => el.remove(), 400);
  }, ms);
}

// ---------- 游戏 ----------
const engine = new BikeEngine();
let me: Me | null = null;
let lastSyncAt = performance.now();
let syncing = false;

function bindPedal(el: HTMLElement, side: 'left' | 'right') {
  const fire = (ev: Event) => {
    ev.preventDefault();
    if (!engine.pedal(side)) {
      el.classList.add('opacity-40');
      setTimeout(() => el.classList.remove('opacity-40'), 120);
    }
  };
  el.addEventListener('pointerdown', fire);
}
bindPedal($('#pedal-l'), 'left');
bindPedal($('#pedal-r'), 'right');

window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
    e.preventDefault();
    engine.pedal('left');
  } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
    e.preventDefault();
    engine.pedal('right');
  }
});

let hudLast = 0;
engine.onStats = (s) => {
  const now = performance.now();
  if (now - hudLast < 100) return;
  hudLast = now;
  $('#hud-speed').textContent = s.speedKmh.toFixed(1);
  $('#hud-watts').textContent = String(Math.round(s.watts));
  $('#hud-tps').textContent = s.tokensPerSec.toFixed(1);
  $('#hud-session').textContent = fmt(s.sessionTokens);
  ($('#hud-stamina') as HTMLElement).style.width = `${s.stamina}%`;
};

engine.onFirstPedal = () => {
  if (!me) $('#guest-bar').classList.remove('hidden');
};

// ---------- 结算循环 ----------
async function syncLoop() {
  const now = performance.now();
  const windowSec = (now - lastSyncAt) / 1000;
  const joules = engine.drainJoules();
  lastSyncAt = now;
  if (me && joules > 0.5 && !syncing) {
    syncing = true;
    try {
      const r = await api.sync(Math.round(joules * 10) / 10, Math.min(windowSec, 30));
      me.balance = r.balance;
      me.today = r.today;
      $('#nav-balance-num').textContent = fmt(r.balance);
      if (r.capped) toast('你的腿已突破人类极限,超出的功率被物理定律没收了', 2600);
    } catch {
      /* 网络抖动时能量已清零,损失可忽略 */
    } finally {
      syncing = false;
    }
  }
  setTimeout(syncLoop, 5000);
}

// ---------- 无厘头随机事件 ----------
const EVENTS: Array<{ text: string; run: () => void }> = [
  {
    text: '<img src="/assets/meme-slap.webp" class="w-24 h-24 rounded-lg mx-auto mb-2 frame-line"/>🖐️ 马路对面突然伸来一巴掌!你被扇得热血沸腾,功率 ×1.5(10 秒)',
    run: () => engine.setBoost(1.5, 10),
  },
  {
    text: '🐸 一只路过的猹给你点了个赞,功率 ×1.3(12 秒)',
    run: () => engine.setBoost(1.3, 12),
  },
  {
    text: '⛓️ 链条掉了!3 秒无功率,但你假装无事发生',
    run: () => engine.stall(3),
  },
  {
    text: '🥤 你灌了一口虚拟电解质水,功率 ×1.15(8 秒)',
    run: () => engine.setBoost(1.15, 8),
  },
  {
    text: '🔥 K3 核心饿了!功率 ×1.8(8 秒),喂饱它',
    run: () => engine.setBoost(1.8, 8),
  },
];
function eventLoop() {
  const wait = 25000 + Math.random() * 30000;
  setTimeout(() => {
    const ev = EVENTS[Math.floor(Math.random() * EVENTS.length)];
    ev.run();
    toast(ev.text, 4200);
    eventLoop();
  }, wait);
}

// ---------- 排行榜 ----------
function renderBoard(top: LeaderboardEntry[]) {
  const body = $('#board-body');
  if (!top.length) {
    body.innerHTML = `<tr><td colspan="4" class="py-12 text-center text-inksoft">还没有人踩出词元,你就是第一个。</td></tr>`;
    return;
  }
  body.innerHTML = top
    .slice(0, 20)
    .map(
      (r) => `
    <tr class="border-b border-ink/8 ${me && r.user_id === me.user_id ? 'bg-brass/10' : ''}">
      <td class="py-3 px-4 font-serif font-black ${r.rank <= 3 ? 'text-verm' : 'text-inksoft'}">${r.rank <= 3 ? ['Ⅰ', 'Ⅱ', 'Ⅲ'][r.rank - 1] : r.rank}</td>
      <td class="py-3 px-4 flex items-center gap-2.5">
        ${r.avatar_url ? `<img src="${r.avatar_url}" class="w-7 h-7 rounded-full frame-line" referrerpolicy="no-referrer"/>` : '<span class="w-7 h-7 rounded-full bg-ink/10 inline-block"></span>'}
        <span>${escapeHtml(r.nickname || `骑手 ${r.user_id}`)}</span>
      </td>
      <td class="py-3 px-4 text-right text-inksoft stat-num">${fmt(r.today)}</td>
      <td class="py-3 px-4 text-right font-serif font-bold text-brass stat-num">${fmt(r.total)}</td>
    </tr>`,
    )
    .join('');
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

async function refreshBoard() {
  try {
    const d = await api.leaderboard();
    renderBoard(d.top);
    $('#stat-global').textContent = fmt(d.global_total);
    $('#stat-riders').textContent = String(d.top.length);
  } catch {
    /* ignore */
  }
}

// ---------- 登录态 ----------
function renderAuth() {
  const slot = $('#auth-slot');
  if (me) {
    slot.innerHTML = `
      <div class="flex items-center gap-2.5">
        ${me.avatar_url ? `<img src="${me.avatar_url}" class="w-9 h-9 rounded-full frame-line" referrerpolicy="no-referrer"/>` : ''}
        <span class="text-sm hidden sm:inline">${escapeHtml(me.nickname)}</span>
        <button id="logout-btn" class="text-xs text-inksoft hover:text-verm transition-colors">退出</button>
      </div>`;
    $('#nav-balance-num').textContent = fmt(me.balance);
    $('#logout-btn').addEventListener('click', async () => {
      await api.logout().catch(() => {});
      location.reload();
    });
  } else {
    slot.innerHTML = `
      <a href="/api/auth/login" class="flex items-center gap-2 px-4 py-2 rounded-full border border-ink/25 text-sm font-bold hover:bg-ink hover:text-paper transition-colors">
        <img src="/assets/watcha-logo.png" alt="观猹" class="w-5 h-5 rounded"/>
        观猹登录
      </a>`;
  }
}

// ---------- 启动 ----------
(async () => {
  const oauthErr = new URLSearchParams(location.search).get('oauth_error');
  if (oauthErr) {
    toast(`观猹登录失败:${escapeHtml(oauthErr)}`, 5000);
    history.replaceState(null, '', location.pathname);
  }
  await engine.init($('#game-wrap'));
  try {
    const r = await api.me();
    me = r.user;
  } catch {
    me = null;
  }
  renderAuth();
  refreshBoard();
  setInterval(refreshBoard, 30000);
  syncLoop();
  eventLoop();
})();
