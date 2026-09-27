import { Application, Assets, Container, Graphics, TilingSprite } from 'pixi.js';

export interface Snapshot {
  speedKmh: number;
  watts: number;
  tokensPerSec: number;
  stamina: number;
  sessionTokens: number;
  coreCharge: number;
}

export interface BikeEngineOptions {
  onSnapshot?: (snapshot: Snapshot) => void;
  onEarn?: (wholeTokens: number) => void;
}

const TAU = Math.PI * 2;

export class BikeEngine {
  private app = new Application();
  private world = new Container();
  private bg?: TilingSprite;
  private wheels: Container[] = [];
  private crank?: Container;
  private sparks: Graphics[] = [];
  private sparkCursor = 0;
  private pedal = 0;
  private speed = 0;
  private stamina = 100;
  private sessionTokens = 0;
  private pendingTokens = 0;
  private bgScroll = 0;
  private wheelSpin = 0;
  private lastInput = 0;
  private ready = false;
  private readonly options: BikeEngineOptions;

  constructor(options: BikeEngineOptions = {}) { this.options = options; }

  async mount(host: HTMLElement) {
    await this.app.init({
      resizeTo: host,
      antialias: true,
      backgroundAlpha: 0,
      resolution: Math.min(devicePixelRatio, 2),
    });
    host.replaceChildren(this.app.canvas);
    this.app.stage.addChild(this.world);
    try {
      const texture = await Assets.load('/assets/bg-city.png');
      this.bg = new TilingSprite({ texture, width: this.app.screen.width, height: this.app.screen.height });
      this.bg.alpha = 0.55;
      this.world.addChild(this.bg);
    } catch {
      // 背景图缺失时保持纯色夜空，不影响游戏逻辑
    }
    this.drawMachine();
    this.app.ticker.add((ticker) => this.tick(ticker.deltaMS / 1000));
    window.addEventListener('resize', this.resize);
    this.app.canvas.addEventListener('pointerdown', this.push);
    window.addEventListener('keydown', this.keydown);
    this.ready = true;
  }

  private resize = () => {
    if (!this.bg) return;
    this.bg.width = this.app.screen.width;
    this.bg.height = this.app.screen.height;
  };

  private keydown = (event: KeyboardEvent) => {
    if (event.code === 'Space' || event.code === 'ArrowRight' || event.code === 'ArrowLeft') {
      event.preventDefault();
      this.push();
    }
  };

  private push = () => {
    if (!this.ready || this.stamina <= 0.5) return;
    const now = performance.now();
    const rhythm = Math.max(0, 1 - Math.abs(220 - (now - this.lastInput)) / 420);
    this.lastInput = now;
    this.pedal += 1;
    this.speed = Math.min(58, this.speed + 4.2 + rhythm * 3.8);
    this.stamina = Math.max(0, this.stamina - 0.7);
    this.burst(2);
  };

  private drawWheel(x: number, y: number) {
    const wheel = new Container();
    const rim = new Graphics().circle(0, 0, 52).stroke({ color: 0x22d3ee, width: 9 });
    const hub = new Graphics().circle(0, 0, 8).fill(0xe879f9);
    const spokes = new Graphics();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      spokes.moveTo(0, 0).lineTo(Math.cos(a) * 48, Math.sin(a) * 48);
    }
    spokes.stroke({ color: 0x67e8f9, width: 3, alpha: 0.8 });
    wheel.addChild(rim, spokes, hub);
    wheel.position.set(x, y);
    return wheel;
  }

  private drawMachine() {
    const machine = new Container();
    const floor = new Graphics().roundRect(-190, 88, 470, 20, 10).fill({ color: 0x111827, alpha: 0.9 });
    const rear = this.drawWheel(-92, 40);
    const front = this.drawWheel(92, 40);
    this.wheels = [rear, front];
    const frame = new Graphics()
      .moveTo(-92, 40).lineTo(-20, -30).lineTo(38, 40).lineTo(-92, 40)
      .moveTo(-20, -30).lineTo(92, 40)
      .stroke({ color: 0xfbbf24, width: 10, cap: 'round', join: 'round' });
    const seat = new Graphics().roundRect(-44, -44, 36, 10, 5).fill(0xe879f9);
    const bar = new Graphics().moveTo(70, -18).lineTo(92, -2).lineTo(104, -14).stroke({ color: 0x22d3ee, width: 7, cap: 'round' });

    // 曲柄：随踩踏旋转
    const crank = new Container();
    crank.addChild(new Graphics().moveTo(0, -22).lineTo(0, 22).stroke({ color: 0xf8fafc, width: 6, cap: 'round' }));
    crank.addChild(new Graphics().circle(0, 0, 6).fill(0xfbbf24));
    crank.position.set(38, 40);
    this.crank = crank;

    // K3 反应堆核心
    const core = new Graphics()
      .circle(180, -20, 58).fill({ color: 0x312e81, alpha: 0.9 }).stroke({ color: 0xe879f9, width: 8 })
      .circle(180, -20, 26).fill({ color: 0xe879f9, alpha: 0.35 });
    const cable = new Graphics().moveTo(38, 40).bezierCurveTo(90, 70, 150, 60, 180, 30).stroke({ color: 0xe879f9, width: 4, alpha: 0.6 });

    machine.addChild(floor, cable, rear, front, frame, seat, bar, crank, core);
    machine.position.set(this.app.screen.width / 2 - 60, this.app.screen.height * 0.62);
    machine.scale.set(Math.min(1.15, this.app.screen.width / 700));
    this.world.addChild(machine);

    // 火花粒子池
    for (let i = 0; i < 40; i++) {
      const spark = new Graphics().circle(0, 0, 3).fill(0xfbbf24);
      spark.visible = false;
      spark.alpha = 0;
      this.sparks.push(spark);
      machine.addChild(spark);
    }
  }

  private burst(count: number) {
    for (let i = 0; i < count; i++) {
      const spark = this.sparks[this.sparkCursor];
      this.sparkCursor = (this.sparkCursor + 1) % this.sparks.length;
      spark.visible = true;
      spark.alpha = 1;
      spark.position.set(150 + Math.random() * 60, -60 + Math.random() * 80);
      spark.scale.set(0.6 + Math.random());
      (spark as Graphics & { vx: number; vy: number }).vx = 60 + Math.random() * 120;
      (spark as Graphics & { vx: number; vy: number }).vy = -80 - Math.random() * 120;
    }
  }

  private tick(dt: number) {
    this.speed *= Math.pow(0.73, dt);
    const watts = Math.round(this.speed * 8.4);
    const tokensPerSec = Math.max(0, (watts - 28) / 520);
    const earned = tokensPerSec * dt;
    this.sessionTokens += earned;
    this.pendingTokens += earned;
    this.stamina = Math.min(100, this.stamina + (this.speed < 4 ? 3.2 : 0.45) * dt);

    // 视差背景与车轮/曲柄动画
    this.bgScroll += this.speed * dt * 2.4;
    if (this.bg) this.bg.tilePosition.x = -this.bgScroll;
    this.wheelSpin += this.speed * dt * 0.55;
    for (const wheel of this.wheels) wheel.rotation = this.wheelSpin;
    if (this.crank) this.crank.rotation = this.pedal * 0.9 + this.wheelSpin * 0.4;

    // 高功率时反应堆喷火花
    if (tokensPerSec > 0.25 && Math.random() < dt * 14) this.burst(1);
    for (const spark of this.sparks) {
      if (!spark.visible) continue;
      const s = spark as Graphics & { vx: number; vy: number };
      s.vy += 320 * dt;
      spark.x += s.vx * dt;
      spark.y += s.vy * dt;
      spark.alpha -= dt * 1.6;
      if (spark.alpha <= 0) spark.visible = false;
    }

    const whole = Math.floor(this.pendingTokens);
    if (whole > 0) { this.pendingTokens -= whole; this.options.onEarn?.(whole); }
    this.options.onSnapshot?.({
      speedKmh: this.speed,
      watts,
      tokensPerSec,
      stamina: this.stamina,
      sessionTokens: this.sessionTokens,
      coreCharge: Math.min(100, watts / 5),
    });
  }

  /** 被马路打一巴掌：速度瞬间折损 */
  slap(strength = 0.6) {
    this.speed *= Math.max(0, 1 - strength);
    this.burst(6);
  }

  destroy() {
    window.removeEventListener('resize', this.resize);
    window.removeEventListener('keydown', this.keydown);
    this.app.canvas.removeEventListener('pointerdown', this.push);
    this.app.destroy(true, { children: true, texture: false });
    this.ready = false;
  }
}

/*
Design note: Input impulses accelerate the virtual flywheel.
Design note: Velocity decays continuously between pedal strokes.
Design note: Rhythmic input earns a small cadence bonus.
Design note: Stamina drains under load and recovers at rest.
Design note: Token yield begins only above idle power.
Design note: Fractional rewards accumulate before synchronization.
Design note: Wheel spokes and crank visualize cadence.
Design note: A pooled spark system avoids per-frame allocation.
Design note: The canvas resolution is capped for mobile GPUs.
Design note: Callbacks keep rendering independent from account data.
*/
