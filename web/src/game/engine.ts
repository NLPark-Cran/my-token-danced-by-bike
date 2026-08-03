import { Application, Container, Graphics } from 'pixi.js';

export interface Snapshot {
  speedKmh: number;
  watts: number;
  tokensPerSec: number;
  stamina: number; // 0-100
  sessionTokens: number;
  crankAngle: number;
}

const DESIGN_W = 1280;
const DESIGN_H = 720;
const FLOOR = 600; // 地面线

// 调色 —— 复古海报:奶油纸 / 墨色 / 朱红 / 黄铜
const PAPER = 0xf2ede3;
const INK = 0x1c2420;
const VERM = 0xc8411f;
const BRASS = 0xb98a2f;
const BRASS_HI = 0xe3b64f;

// 几何(设计坐标系,车轮底部落在 FLOOR 上)
const REAR = { x: 450, y: FLOOR - 76 };
const FRONT = { x: 714, y: FLOOR - 76 };
const WHEEL_R = 76;
const BB = { x: 567, y: FLOOR - 64 };
const CRANK = 36;
const SEAT = { x: 540, y: 400 };
const HANDLE = { x: 728, y: 360 };
const SHOULDER = { x: 632, y: 336 };
const HEAD = { x: 656, y: 298 };
const CORE = { x: 1030, y: FLOOR - 20 - 84, r: 86 }; // K3 核心
const GEN = { x: 624, y: FLOOR - 28 }; // 发电机

interface Spark {
  g: Graphics;
  x: number; y: number;
  vx: number; vy: number;
  life: number; maxLife: number;
  kind: 'spark' | 'token';
}

export class BikeEngine {
  private app = new Application();
  private world = new Container();
  private scenery = new Graphics();
  private bike = new Graphics();
  private fx = new Graphics();
  private sparks: Spark[] = [];
  private sparkLayer = new Container();

  private lastSide: 'left' | 'right' | null = null;
  private strokes: number[] = [];
  private crankAngle = 0;
  private crankVel = 0;
  private rpm = 0;
  private watts = 0;
  private joules = 0;
  private sessionTokens = 0;
  private stamina = 100;
  private boostMult = 1;
  private boostUntil = 0;
  private stallUntil = 0;
  private scroll = 0;
  private time = 0;
  private destroyed = false;

  onStats: ((s: Snapshot) => void) | null = null;
  onFirstPedal: (() => void) | null = null;
  private firstPedalFired = false;

  async init(wrapper: HTMLElement) {
    await this.app.init({
      background: PAPER,
      resizeTo: wrapper,
      antialias: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
    });
    wrapper.appendChild(this.app.canvas);
    this.app.stage.addChild(this.world);
    this.world.addChild(this.scenery);
    this.world.addChild(this.bike);
    this.world.addChild(this.sparkLayer);
    this.world.addChild(this.fx);

    this.app.ticker.add((t) => this.update(t.deltaMS / 1000));
    this.resize();
    window.addEventListener('resize', this.resize);
  }

  private resize = () => {
    const w = this.app.renderer.width;
    const h = this.app.renderer.height;
    const s = Math.min(w / DESIGN_W, h / DESIGN_H);
    this.world.scale.set(s);
    this.world.position.set((w - DESIGN_W * s) / 2, (h - DESIGN_H * s) / 2);
  };

  pedal(side: 'left' | 'right'): boolean {
    if (side === this.lastSide) return false;
    this.lastSide = side;
    const now = performance.now();
    this.strokes.push(now);
    if (this.strokes.length > 24) this.strokes.shift();
    if (!this.firstPedalFired) {
      this.firstPedalFired = true;
      this.onFirstPedal?.();
    }
    return true;
  }

  setBoost(mult: number, sec: number) {
    this.boostMult = mult;
    this.boostUntil = performance.now() + sec * 1000;
  }

  stall(sec: number) {
    this.stallUntil = performance.now() + sec * 1000;
  }

  drainJoules(): number {
    const j = this.joules;
    this.joules = 0;
    return j;
  }

  get tokensPerWattSecond() {
    return 0.08;
  }

  private update(dt: number) {
    if (this.destroyed) return;
    this.time += dt;
    const now = performance.now();

    while (this.strokes.length && now - this.strokes[0] > 1600) this.strokes.shift();
    const instRpm = (this.strokes.length / 1.6) * 30;
    this.rpm += (instRpm - this.rpm) * Math.min(1, dt * 6);

    const stalled = now < this.stallUntil;
    if (now > this.boostUntil) this.boostMult = 1;
    const staminaFactor = this.stamina > 15 ? 1 : 0.35;
    let target = Math.min(1400, (this.rpm * this.rpm) / 45);
    target *= staminaFactor * this.boostMult;
    if (stalled) target = 0;
    this.watts += (target - this.watts) * Math.min(1, dt * 5);

    const drain = (this.watts / 1200) * 16;
    const regen = this.watts < 60 ? 14 : 0;
    this.stamina = Math.max(0, Math.min(100, this.stamina + (regen - drain) * dt));

    const effJoules = this.watts * dt;
    this.joules += effJoules;
    this.sessionTokens += effJoules * this.tokensPerWattSecond;

    const targetVel = (this.rpm / 60) * Math.PI * 2;
    this.crankVel += (targetVel - this.crankVel) * Math.min(1, dt * 8);
    this.crankAngle += this.crankVel * dt;
    const speedKmh = this.rpm * 0.25;
    this.scroll += speedKmh * dt * 6;

    this.drawScenery();
    this.drawBike(stalled);
    this.drawCore();
    this.updateSparks(dt);

    if (this.watts > 120 && Math.random() < dt * Math.min(30, this.watts / 40)) {
      this.spawnSpark('token');
    }
    if (this.watts > 500 && Math.random() < dt * 12) {
      this.spawnSpark('spark');
    }

    this.onStats?.({
      speedKmh,
      watts: this.watts,
      tokensPerSec: this.watts * this.tokensPerWattSecond,
      stamina: this.stamina,
      sessionTokens: this.sessionTokens,
      crankAngle: this.crankAngle,
    });
  }

  // —— 远景:版画山丘 + 赛道刻度,随速度滚动 ——
  private drawScenery() {
    const g = this.scenery;
    g.clear();
    // 两层山丘弧线
    for (const [amp, alpha, par] of [
      [90, 0.1, 0.3],
      [140, 0.06, 0.15],
    ] as const) {
      const off = (this.scroll * par) % 640;
      g.moveTo(-640 - off, FLOOR);
      for (let x = -640 - off; x <= DESIGN_W + 640; x += 640) {
        g.arc(x + 320, FLOOR, 320, Math.PI, Math.PI * 2);
      }
      g.stroke({ color: INK, width: 2, alpha });
      void amp;
    }
    // 地面主线
    g.rect(0, FLOOR, DESIGN_W, 2.5).fill(INK);
    // 赛道刻度(滚动)
    const dash = (this.scroll % 96 + 96) % 96;
    for (let x = -dash; x < DESIGN_W; x += 96) {
      g.rect(x, FLOOR + 18, 40, 3).fill({ color: INK, alpha: 0.25 });
    }
  }

  private spawnSpark(kind: 'spark' | 'token') {
    if (this.sparks.length > 140) return;
    const g = new Graphics();
    if (kind === 'token') {
      g.circle(0, 0, 6).fill(BRASS).stroke({ color: INK, width: 1.5 });
      g.circle(0, 0, 2.5).fill(BRASS_HI);
    } else {
      g.circle(0, 0, 3).fill(VERM);
    }
    this.sparkLayer.addChild(g);
    this.sparks.push({
      g,
      x: GEN.x + (Math.random() - 0.5) * 20,
      y: GEN.y - 10,
      vx: (Math.random() - 0.5) * 60,
      vy: -120 - Math.random() * 120,
      life: 0,
      maxLife: kind === 'token' ? 1.6 : 0.7,
      kind,
    });
  }

  private updateSparks(dt: number) {
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i];
      s.life += dt;
      if (s.kind === 'token') {
        const dx = CORE.x - s.x;
        const dy = CORE.y - s.y;
        s.vx += dx * dt * 3.2;
        s.vy += dy * dt * 3.2;
      } else {
        s.vy += 500 * dt;
      }
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.g.position.set(s.x, s.y);
      s.g.alpha = Math.max(0, 1 - s.life / s.maxLife);
      const done =
        s.life > s.maxLife ||
        (s.kind === 'token' && Math.hypot(CORE.x - s.x, CORE.y - s.y) < 40);
      if (done) {
        s.g.destroy();
        this.sparks.splice(i, 1);
      }
    }
  }

  private drawBike(stalled: boolean) {
    const g = this.bike;
    g.clear();
    const a = this.crankAngle;
    const wheelSpin = a * 2.2;
    const glow = Math.min(1, this.watts / 900);
    const ink = stalled ? 0x8a938c : INK;

    // 固定台架
    g.poly([BB.x - 140, FLOOR, BB.x + 160, FLOOR, BB.x + 60, BB.y + 26, BB.x - 60, BB.y + 26])
      .fill({ color: INK, alpha: 0.08 })
      .stroke({ color: ink, width: 2, alpha: 0.5 });

    for (const hub of [REAR, FRONT]) {
      g.circle(hub.x, hub.y, WHEEL_R).stroke({ color: ink, width: 5 });
      g.circle(hub.x, hub.y, WHEEL_R - 8).stroke({ color: ink, width: 1.5, alpha: 0.4 });
      for (let i = 0; i < 8; i++) {
        const ang = wheelSpin + (i * Math.PI) / 4;
        g.moveTo(hub.x, hub.y)
          .lineTo(hub.x + Math.cos(ang) * (WHEEL_R - 10), hub.y + Math.sin(ang) * (WHEEL_R - 10))
          .stroke({ color: ink, width: 1.5, alpha: 0.55 });
      }
      g.circle(hub.x, hub.y, 6).fill(PAPER).stroke({ color: ink, width: 2.5 });
    }

    // 车架(朱红)
    const frame = { color: stalled ? 0x8a938c : VERM, width: 6 };
    g.moveTo(REAR.x, REAR.y).lineTo(BB.x, BB.y).stroke(frame);
    g.moveTo(BB.x, BB.y).lineTo(HANDLE.x - 18, HANDLE.y + 24).stroke(frame);
    g.moveTo(HANDLE.x - 18, HANDLE.y + 24).lineTo(FRONT.x, FRONT.y).stroke(frame);
    g.moveTo(REAR.x, REAR.y).lineTo(SEAT.x, SEAT.y).stroke(frame);
    g.moveTo(SEAT.x, SEAT.y).lineTo(HANDLE.x - 18, HANDLE.y + 24).stroke(frame);
    g.moveTo(SEAT.x - 14, SEAT.y).lineTo(SEAT.x + 16, SEAT.y).stroke({ color: ink, width: 7 });
    g.moveTo(HANDLE.x - 30, HANDLE.y + 22).lineTo(HANDLE.x + 6, HANDLE.y + 22).stroke({ color: ink, width: 6 });

    // 发电机(黄铜)
    g.roundRect(GEN.x - 26, GEN.y - 16, 52, 32, 6)
      .fill(0xd9c9a3)
      .stroke({ color: ink, width: 2.5 });
    if (glow > 0.15) {
      g.moveTo(GEN.x, GEN.y - 8)
        .lineTo(GEN.x - 6, GEN.y + 2)
        .lineTo(GEN.x, GEN.y + 2)
        .lineTo(GEN.x - 4, GEN.y + 10)
        .lineTo(GEN.x + 7, GEN.y - 2)
        .lineTo(GEN.x + 1, GEN.y - 2)
        .lineTo(GEN.x + 4, GEN.y - 8)
        .fill({ color: BRASS, alpha: 0.4 + glow * 0.6 });
    }

    // 曲柄 + 脚踏
    const px = BB.x + Math.cos(a) * CRANK;
    const py = BB.y + Math.sin(a) * CRANK;
    const qx = BB.x - Math.cos(a) * CRANK;
    const qy = BB.y - Math.sin(a) * CRANK;
    g.moveTo(qx, qy).lineTo(px, py).stroke({ color: ink, width: 6 });
    g.circle(BB.x, BB.y, 8).fill(PAPER).stroke({ color: ink, width: 3 });
    g.roundRect(px - 11, py - 3.5, 22, 7, 3).fill(ink);
    g.roundRect(qx - 11, qy - 3.5, 22, 7, 3).fill(ink);

    // 骑手(墨色线稿,朱红骑行服)
    const jersey = stalled ? 0x8a938c : VERM;
    // 躯干
    g.moveTo(SEAT.x + 8, SEAT.y - 4).lineTo(SHOULDER.x, SHOULDER.y).stroke({ color: jersey, width: 19 });
    // 手臂
    g.moveTo(SHOULDER.x, SHOULDER.y).lineTo(HANDLE.x - 12, HANDLE.y + 22).stroke({ color: ink, width: 8 });
    // 头 + 骑行帽
    g.circle(HEAD.x, HEAD.y, 16).fill(0xf0dcc0).stroke({ color: ink, width: 2 });
    g.moveTo(HEAD.x - 18, HEAD.y - 2);
    g.arc(HEAD.x, HEAD.y - 2, 18, Math.PI, Math.PI * 2).fill(jersey);
    g.rect(HEAD.x - 18, HEAD.y - 4, 36, 4).fill(jersey);
    // 双腿
    const hip = { x: SEAT.x + 8, y: SEAT.y - 6 };
    for (const [tx, ty] of [
      [px, py],
      [qx, qy],
    ]) {
      const knee = { x: (hip.x + tx) / 2 + 24, y: (hip.y + ty) / 2 - 12 };
      g.moveTo(hip.x, hip.y).lineTo(knee.x, knee.y).lineTo(tx, ty).stroke({ color: ink, width: 9 });
    }
  }

  private drawCore() {
    const g = this.fx;
    g.clear();
    const glow = Math.min(1, this.watts / 900);
    const pulse = 0.5 + 0.5 * Math.sin(this.time * 4);

    // 电缆:发电机 → 核心
    g.moveTo(GEN.x + 26, GEN.y + 8)
      .bezierCurveTo(GEN.x + 140, FLOOR - 4, CORE.x - 130, FLOOR - 4, CORE.x - 36, CORE.y + CORE.r)
      .stroke({ color: INK, width: 3, alpha: 0.6 });

    // 底座
    g.roundRect(CORE.x - 86, CORE.y + CORE.r - 6, 172, 22, 4)
      .fill(0xd9c9a3)
      .stroke({ color: INK, width: 2.5 });

    // 暖光晕(功率越高越亮)
    const haloR = CORE.r * (1.12 + glow * 0.4 + pulse * 0.06);
    g.circle(CORE.x, CORE.y, haloR).fill({ color: BRASS_HI, alpha: 0.1 + glow * 0.25 });
    // 核心体:黄铜炉
    g.circle(CORE.x, CORE.y, CORE.r).fill(0xe8dcc0).stroke({ color: INK, width: 4 });
    g.circle(CORE.x, CORE.y, CORE.r - 12).stroke({ color: INK, width: 1.5, alpha: 0.4 });
    // 炉心
    const inner = CORE.r * 0.5 * (0.9 + pulse * 0.15 * (0.3 + glow));
    g.circle(CORE.x, CORE.y, inner).fill({ color: BRASS, alpha: 0.35 + glow * 0.5 });
    g.circle(CORE.x, CORE.y, inner * 0.5).fill({ color: BRASS_HI, alpha: 0.4 + glow * 0.6 });
    // 铆钉
    for (let i = 0; i < 8; i++) {
      const ang = (i * Math.PI) / 4 + Math.PI / 8;
      g.circle(CORE.x + Math.cos(ang) * (CORE.r - 6), CORE.y + Math.sin(ang) * (CORE.r - 6), 2.5).fill(INK);
    }
  }

  destroy() {
    this.destroyed = true;
    window.removeEventListener('resize', this.resize);
    this.app.destroy(true);
  }
}
