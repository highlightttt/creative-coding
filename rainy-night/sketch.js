// 潮湿的雨夜 — 灵感来自思花
// 雨滴在起雾的玻璃上滑落，擦出清晰的城市夜景

const CONFIG = {
  canvas: { width: 600, height: 800 },
  curve: {
    startYRange: [-20, 0],
    growthSpeedRange: [1.5, 3],
    xDriftRange: [-0.8, 0.8],
    maxLengthRange: [500, 900],
    weightRange: [3, 5],
  },
  generator: {
    spawnInterval: 40,
    maxCurves: 60,
  },
  text: {
    lines: ["我将只是萎谢了", "", "— 张爱玲"],
    size: 16,
    x: 40,
    yStart: 700,
    lineHeight: 24,
  },
};

let blurImg, clearImg, revealCanvas;
let curves = [];
let fc = 0;

function setup() {
  createCanvas(CONFIG.canvas.width, CONFIG.canvas.height);
  pixelDensity(1);

  // 生成城市夜景
  let scene = createGraphics(width, height);
  drawCityScene(scene);

  // 清晰版
  clearImg = scene.get();

  // 模糊版
  scene.filter(BLUR, 8);
  scene.fill(60, 70, 90, 80);
  scene.noStroke();
  scene.rect(0, 0, width, height);
  blurImg = scene.get();
  scene.remove();

  // 蒙版画布（累积雨痕）
  revealCanvas = createGraphics(width, height);
  revealCanvas.clear();
}

function draw() {
  // 背景：模糊城市
  image(blurImg, 0, 0);

  // 生成新雨滴
  fc++;
  if (fc % CONFIG.generator.spawnInterval === 0 && curves.length < CONFIG.generator.maxCurves) {
    curves.push(new RainDrop());
  }

  // 更新雨滴，画到蒙版
  for (let i = curves.length - 1; i >= 0; i--) {
    let c = curves[i];
    c.grow();
    c.drawToReveal();
    if (c.done) curves.splice(i, 1);
  }

  // 用蒙版合成清晰图
  // 方法：在主画布上用 destination-over 以外的方式
  // 更高效：直接逐像素太慢，用 canvas compositing
  let ctx = drawingContext;

  // 画蒙版形状（白色区域）到临时canvas上，然后composite
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';

  // 把 revealCanvas 作为 clip
  // 先画清晰图，再用 destination-in 与蒙版相交
  let tmpCanvas = document.createElement('canvas');
  tmpCanvas.width = width;
  tmpCanvas.height = height;
  let tmpCtx = tmpCanvas.getContext('2d');

  tmpCtx.drawImage(clearImg.canvas, 0, 0);
  tmpCtx.globalCompositeOperation = 'destination-in';
  tmpCtx.drawImage(revealCanvas.canvas, 0, 0);

  ctx.drawImage(tmpCanvas, 0, 0);
  ctx.restore();

  // 淡淡的雾气动画
  drawFog();

  // 文字
  drawPoem();
}

// === 城市场景 ===
function drawCityScene(pg) {
  pg.background(15, 18, 28);

  // 天空渐变
  for (let y = 0; y < pg.height * 0.45; y++) {
    let t = y / (pg.height * 0.45);
    pg.stroke(lerpColor(color(18, 22, 48), color(35, 28, 52), t));
    pg.line(0, y, pg.width, y);
  }

  // 建筑群
  pg.noStroke();
  let baseY = pg.height * 0.35;
  let x = -5;
  while (x < pg.width + 10) {
    let bw = random(22, 55);
    let bh = random(60, 300);
    let shade = random(18, 35);
    pg.fill(shade, shade + 3, shade + 15);
    pg.rect(x, baseY - bh, bw, bh + pg.height);

    // 窗户
    for (let wy = baseY - bh + 8; wy < min(baseY + 200, pg.height); wy += random(10, 18)) {
      for (let wx = x + 3; wx < x + bw - 3; wx += random(7, 13)) {
        if (random() > 0.45) {
          let r = random();
          if (r > 0.6) pg.fill(255, 230, 130, random(120, 240));
          else if (r > 0.3) pg.fill(200, 230, 255, random(80, 180));
          else pg.fill(255, 180, 200, random(60, 140));
          let ww = random(3, 6), wh = random(3, 6);
          pg.rect(wx, wy, ww, wh);
        }
      }
    }
    x += bw + random(1, 6);
  }

  // 地面湿润反射
  for (let y = baseY + 80; y < pg.height; y++) {
    let t = (y - baseY - 80) / (pg.height - baseY - 80);
    pg.stroke(25 + sin(y * 0.03) * 8, 20 + sin(y * 0.05) * 5, 40, 220 - t * 180);
    pg.line(0, y, pg.width, y);
  }

  // 霓虹散射
  pg.noStroke();
  for (let i = 0; i < 100; i++) {
    let lx = random(pg.width);
    let ly = random(baseY - 20, pg.height);
    let s = random(1, 12);
    let palettes = [
      [255, 90, 70], [70, 170, 255], [255, 200, 40],
      [200, 90, 255], [255, 140, 190], [100, 255, 200],
    ];
    let c = random(palettes);
    pg.fill(c[0], c[1], c[2], random(15, 45));
    pg.ellipse(lx, ly, s);
  }
}

// === 雨滴 ===
class RainDrop {
  constructor() {
    this.x = random(width);
    this.y = random(CONFIG.curve.startYRange[0], CONFIG.curve.startYRange[1]);
    this.prevX = this.x;
    this.prevY = this.y;
    this.speed = random(CONFIG.curve.growthSpeedRange[0], CONFIG.curve.growthSpeedRange[1]);
    this.maxLen = random(CONFIG.curve.maxLengthRange[0], CONFIG.curve.maxLengthRange[1]);
    this.weight = random(CONFIG.curve.weightRange[0], CONFIG.curve.weightRange[1]);
    this.len = 0;
    this.done = false;
    this.nOff = random(1000);
    this.life = 0;
  }

  grow() {
    if (this.len >= this.maxLen) {
      this.life++;
      if (this.life > 200) this.done = true;
      return;
    }
    this.prevX = this.x;
    this.prevY = this.y;
    let dx = map(noise(this.nOff + this.len * 0.007), 0, 1,
                 CONFIG.curve.xDriftRange[0], CONFIG.curve.xDriftRange[1]);
    this.x += dx;
    this.y += this.speed;
    this.len += this.speed;
  }

  drawToReveal() {
    // 增量绘制到蒙版画布
    revealCanvas.stroke(255, 210);
    revealCanvas.strokeWeight(this.weight);
    revealCanvas.line(this.prevX, this.prevY, this.x, this.y);

    // 水珠头
    if (this.len < this.maxLen) {
      revealCanvas.noStroke();
      revealCanvas.fill(255, 230);
      revealCanvas.ellipse(this.x, this.y, this.weight * 2.2, this.weight * 2.8);
    }
  }
}

// === 雾气 ===
function drawFog() {
  noStroke();
  for (let i = 0; i < 4; i++) {
    let fy = noise(frameCount * 0.0015 + i * 50) * height;
    fill(170, 185, 210, 8 + sin(frameCount * 0.008 + i * 2) * 4);
    ellipse(width / 2, fy, width * 1.8, 250);
  }
}

// === 诗句 ===
function drawPoem() {
  push();
  fill(255, 255, 255, 140);
  noStroke();
  textFont("serif");
  textSize(CONFIG.text.size);
  textAlign(LEFT);
  let y = CONFIG.text.yStart;
  for (let line of CONFIG.text.lines) {
    text(line, CONFIG.text.x, y);
    y += CONFIG.text.lineHeight;
  }
  pop();
}
