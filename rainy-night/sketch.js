// 潮湿的雨夜 v2 — 灵感来自思花
// 改进：更丰富的城市夜景、更自然的水滴（粗细变化、加速、停顿）

const CONFIG = {
  canvas: { width: 600, height: 800 },
  curve: {
    startYRange: [-30, 10],
    baseSpeedRange: [0.8, 1.8],
    accelerationRange: [0.002, 0.006],
    xDriftRange: [-0.6, 0.6],
    maxLengthRange: [400, 800],
    startWeightRange: [1, 2],      // 起点细
    endWeightRange: [4, 7],        // 终点粗
    dropletSize: [6, 12],          // 末端水珠
    pauseChance: 0.003,            // 偶尔停顿
    pauseDuration: [20, 60],
  },
  generator: {
    spawnInterval: 35,
    maxCurves: 45,
  },
  text: {
    lines: ["我将只是萎谢了", "", "— 张爱玲"],
    size: 15,
    x: 40,
    yStart: 710,
    lineHeight: 22,
  },
};

let blurImg, clearImg, revealCanvas;
let curves = [];
let fc = 0;

function setup() {
  createCanvas(CONFIG.canvas.width, CONFIG.canvas.height);
  pixelDensity(1);

  let scene = createGraphics(width, height);
  drawCityScene(scene);
  clearImg = scene.get();

  scene.filter(BLUR, 6);
  // 水雾叠层
  scene.fill(50, 60, 80, 90);
  scene.noStroke();
  scene.rect(0, 0, width, height);
  // 加一点凝结水珠的噪点
  for (let i = 0; i < 3000; i++) {
    let cx = random(width), cy = random(height);
    scene.fill(255, random(3, 12));
    scene.noStroke();
    scene.ellipse(cx, cy, random(1, 3));
  }
  blurImg = scene.get();
  scene.remove();

  revealCanvas = createGraphics(width, height);
  revealCanvas.clear();
}

function draw() {
  image(blurImg, 0, 0);

  fc++;
  if (fc % CONFIG.generator.spawnInterval === 0 && curves.length < CONFIG.generator.maxCurves) {
    curves.push(new RainDrop());
  }

  for (let i = curves.length - 1; i >= 0; i--) {
    curves[i].update();
    curves[i].drawToReveal();
    if (curves[i].done) curves.splice(i, 1);
  }

  // composite: 清晰图通过蒙版显示
  let ctx = drawingContext;
  let tmpCanvas = document.createElement('canvas');
  tmpCanvas.width = width;
  tmpCanvas.height = height;
  let tmpCtx = tmpCanvas.getContext('2d');
  tmpCtx.drawImage(clearImg.canvas, 0, 0);
  tmpCtx.globalCompositeOperation = 'destination-in';
  tmpCtx.drawImage(revealCanvas.canvas, 0, 0);
  ctx.drawImage(tmpCanvas, 0, 0);

  drawFog();
  drawPoem();
}

// ======== 城市夜景（更丰富） ========
function drawCityScene(pg) {
  // 深夜天空渐变
  for (let y = 0; y < pg.height; y++) {
    let t = y / pg.height;
    let r = lerp(12, 25, t);
    let g = lerp(15, 20, t);
    let b = lerp(35, 30, t);
    pg.stroke(r, g, b);
    pg.line(0, y, pg.width, y);
  }

  let horizon = pg.height * 0.38;

  // 远景建筑（矮、暗）
  pg.noStroke();
  drawBuildingLayer(pg, horizon, 0.15, 0.28, 40, 120, 12, 0.7);
  // 中景建筑
  drawBuildingLayer(pg, horizon, 0.08, 0.35, 80, 260, 18, 0.85);
  // 近景建筑（高、亮）
  drawBuildingLayer(pg, horizon, 0, 0.42, 100, 340, 25, 1.0);

  // 地面 — 湿润的路面反射
  for (let y = horizon + 20; y < pg.height; y++) {
    let t = (y - horizon - 20) / (pg.height - horizon - 20);
    pg.stroke(20 + sin(y * 0.04) * 6, 18 + sin(y * 0.06) * 4, 35 - t * 10, 240 - t * 120);
    pg.line(0, y, pg.width, y);
  }

  // 路面霓虹反射（长条形光带）
  pg.noStroke();
  for (let i = 0; i < 40; i++) {
    let rx = random(pg.width);
    let ry = random(horizon + 40, pg.height);
    let rw = random(2, 30);
    let rh = random(1, 4);
    let palettes = [
      [255, 180, 80], [255, 100, 70], [80, 180, 255],
      [255, 220, 100], [200, 100, 255], [255, 140, 180],
    ];
    let c = random(palettes);
    pg.fill(c[0], c[1], c[2], random(15, 40));
    pg.rect(rx, ry, rw, rh);
  }

  // 散落光点
  for (let i = 0; i < 120; i++) {
    let lx = random(pg.width);
    let ly = random(pg.height);
    let s = random(1, 6);
    let palettes = [
      [255, 220, 130], [255, 100, 70], [80, 170, 255],
      [200, 90, 255], [255, 150, 200], [100, 255, 200],
    ];
    let c = random(palettes);
    pg.fill(c[0], c[1], c[2], random(10, 35));
    pg.noStroke();
    pg.ellipse(lx, ly, s);
  }

  // 几盏路灯光晕
  for (let i = 0; i < 4; i++) {
    let lx = random(50, pg.width - 50);
    pg.noStroke();
    // 灯柱
    pg.fill(30, 30, 40);
    pg.rect(lx - 1, horizon - 60, 3, 80);
    // 光晕
    for (let r = 60; r > 0; r -= 2) {
      pg.fill(255, 200, 100, map(r, 0, 60, 25, 0));
      pg.ellipse(lx, horizon - 60, r, r * 0.6);
    }
  }
}

function drawBuildingLayer(pg, horizon, topOffset, maxHFrac, minW, maxH, gap, brightness) {
  let x = random(-10, 5);
  while (x < pg.width + 10) {
    let bw = random(minW * 0.5, minW * 2.2);
    let bh = random(maxH * 0.3, maxH);
    let baseShade = random(14, 28) * brightness;
    pg.fill(baseShade, baseShade + 2, baseShade + 12);
    pg.rect(x, horizon - bh, bw, bh + pg.height * 0.65);

    // 窗户
    let winSpacingY = random(9, 16);
    let winSpacingX = random(6, 12);
    for (let wy = horizon - bh + 6; wy < min(horizon + 120, pg.height - 50); wy += winSpacingY) {
      for (let wx = x + 3; wx < x + bw - 3; wx += winSpacingX) {
        if (random() > 0.4) {
          let r = random();
          if (r > 0.55) {
            pg.fill(255, 230 + random(-20, 0), 120 + random(-20, 30), random(130, 255) * brightness);
          } else if (r > 0.25) {
            pg.fill(180 + random(-20, 20), 220, 255, random(80, 200) * brightness);
          } else {
            pg.fill(255, 160 + random(40), 180 + random(40), random(60, 150) * brightness);
          }
          pg.rect(wx, wy, random(2.5, 5.5), random(2.5, 5.5));
        }
      }
    }
    x += bw + random(gap * 0.3, gap);
  }
}

// ======== 自然水滴 ========
class RainDrop {
  constructor() {
    this.x = random(width);
    this.y = random(CONFIG.curve.startYRange[0], CONFIG.curve.startYRange[1]);
    this.prevX = this.x;
    this.prevY = this.y;
    this.baseSpeed = random(CONFIG.curve.baseSpeedRange[0], CONFIG.curve.baseSpeedRange[1]);
    this.acceleration = random(CONFIG.curve.accelerationRange[0], CONFIG.curve.accelerationRange[1]);
    this.speed = this.baseSpeed;
    this.maxLen = random(CONFIG.curve.maxLengthRange[0], CONFIG.curve.maxLengthRange[1]);
    this.startWeight = random(CONFIG.curve.startWeightRange[0], CONFIG.curve.startWeightRange[1]);
    this.endWeight = random(CONFIG.curve.endWeightRange[0], CONFIG.curve.endWeightRange[1]);
    this.len = 0;
    this.done = false;
    this.nOff = random(1000);
    this.life = 0;
    this.paused = false;
    this.pauseTimer = 0;
    // 沿途粗细波动
    this.weightNoise = random(1000);
  }

  update() {
    if (this.len >= this.maxLen) {
      this.life++;
      if (this.life > 250) this.done = true;
      return;
    }

    // 偶尔停顿
    if (this.paused) {
      this.pauseTimer--;
      if (this.pauseTimer <= 0) this.paused = false;
      this.prevX = this.x;
      this.prevY = this.y;
      return;
    }
    if (random() < CONFIG.curve.pauseChance) {
      this.paused = true;
      this.pauseTimer = random(CONFIG.curve.pauseDuration[0], CONFIG.curve.pauseDuration[1]);
      return;
    }

    this.prevX = this.x;
    this.prevY = this.y;

    // 加速
    this.speed = this.baseSpeed + this.acceleration * this.len;

    let dx = map(noise(this.nOff + this.len * 0.006), 0, 1,
                 CONFIG.curve.xDriftRange[0], CONFIG.curve.xDriftRange[1]);
    this.x += dx;
    this.y += this.speed;
    this.len += this.speed;
  }

  drawToReveal() {
    if (this.prevX === this.x && this.prevY === this.y) return;

    // 粗细：从起点到终点逐渐变粗 + noise 波动
    let progress = constrain(this.len / this.maxLen, 0, 1);
    let baseW = lerp(this.startWeight, this.endWeight, progress);
    let noiseW = map(noise(this.weightNoise + this.len * 0.02), 0, 1, 0.6, 1.4);
    let w = baseW * noiseW;

    revealCanvas.stroke(255, 200);
    revealCanvas.strokeWeight(w);
    revealCanvas.line(this.prevX, this.prevY, this.x, this.y);

    // 水珠头部（越往下越大）
    if (this.len < this.maxLen && !this.paused) {
      let dropR = map(progress, 0, 1,
                      CONFIG.curve.dropletSize[0] * 0.4,
                      CONFIG.curve.dropletSize[0]);
      revealCanvas.noStroke();
      revealCanvas.fill(255, 220);
      revealCanvas.ellipse(this.x, this.y, dropR, dropR * 1.3);
    }
  }
}

// ======== 雾气 ========
function drawFog() {
  noStroke();
  for (let i = 0; i < 4; i++) {
    let fy = noise(frameCount * 0.0012 + i * 80) * height;
    fill(160, 175, 200, 6 + sin(frameCount * 0.006 + i * 1.5) * 3);
    ellipse(width / 2, fy, width * 2, 280);
  }
}

// ======== 诗句 ========
function drawPoem() {
  push();
  fill(255, 255, 255, 120);
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
