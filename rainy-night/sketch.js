// 潮湿的雨夜 v3 — 忠实于思花的参数和方法
// curveVertex 平滑曲线 + 双图蒙版

const CONFIG = {
  canvas: { width: 600, height: 800 },
  curve: {
    startYRange: [-20, 0],
    growthSpeedRange: [1, 3],
    xDriftRange: [-1, 1],
    maxLengthRange: [600, 1000],
    weightRange: [3, 4],
  },
  generator: {
    spawnInterval: 60,
    maxCurves: 60,
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

  // 模糊版 + 水雾
  scene.filter(BLUR, 6);
  scene.fill(50, 60, 80, 85);
  scene.noStroke();
  scene.rect(0, 0, width, height);
  // 玻璃上的微小凝结水珠
  for (let i = 0; i < 4000; i++) {
    scene.fill(255, random(2, 10));
    scene.noStroke();
    scene.ellipse(random(width), random(height), random(0.5, 2.5));
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
    curves[i].grow();
    curves[i].drawToReveal();
    if (curves[i].done) curves.splice(i, 1);
  }

  // 蒙版合成
  let ctx = drawingContext;
  let tmp = document.createElement('canvas');
  tmp.width = width;
  tmp.height = height;
  let tCtx = tmp.getContext('2d');
  tCtx.drawImage(clearImg.canvas, 0, 0);
  tCtx.globalCompositeOperation = 'destination-in';
  tCtx.drawImage(revealCanvas.canvas, 0, 0);
  ctx.drawImage(tmp, 0, 0);

  drawFog();
  drawPoem();
}

// ======== 城市夜景 ========
function drawCityScene(pg) {
  for (let y = 0; y < pg.height; y++) {
    let t = y / pg.height;
    pg.stroke(lerp(12, 25, t), lerp(15, 20, t), lerp(35, 28, t));
    pg.line(0, y, pg.width, y);
  }

  let horizon = pg.height * 0.38;
  pg.noStroke();

  // 三层建筑
  drawBuildings(pg, horizon, 40, 120, 15, 0.65);
  drawBuildings(pg, horizon, 80, 260, 20, 0.82);
  drawBuildings(pg, horizon, 100, 340, 28, 1.0);

  // 湿地面
  for (let y = horizon + 20; y < pg.height; y++) {
    let t = (y - horizon - 20) / (pg.height - horizon - 20);
    pg.stroke(20 + sin(y * 0.04) * 6, 18, 35 - t * 10, 240 - t * 120);
    pg.line(0, y, pg.width, y);
  }

  // 地面光带反射
  pg.noStroke();
  for (let i = 0; i < 50; i++) {
    let c = random([[255,180,80],[255,100,70],[80,180,255],[255,220,100],[200,100,255]]);
    pg.fill(c[0], c[1], c[2], random(12, 35));
    pg.rect(random(pg.width), random(horizon+30, pg.height), random(3, 35), random(1, 3));
  }

  // 路灯
  for (let i = 0; i < 3; i++) {
    let lx = random(60, pg.width - 60);
    pg.fill(30, 30, 40);
    pg.rect(lx - 1, horizon - 55, 3, 75);
    for (let r = 50; r > 0; r -= 2) {
      pg.fill(255, 200, 100, map(r, 0, 50, 20, 0));
      pg.noStroke();
      pg.ellipse(lx, horizon - 55, r, r * 0.5);
    }
  }

  // 散光
  for (let i = 0; i < 100; i++) {
    let c = random([[255,220,130],[255,100,70],[80,170,255],[200,90,255],[255,150,200]]);
    pg.fill(c[0], c[1], c[2], random(8, 30));
    pg.noStroke();
    pg.ellipse(random(pg.width), random(pg.height), random(1, 5));
  }
}

function drawBuildings(pg, horizon, minW, maxH, gap, bright) {
  let x = random(-10, 5);
  while (x < pg.width + 10) {
    let bw = random(minW * 0.5, minW * 2);
    let bh = random(maxH * 0.3, maxH);
    let s = random(14, 28) * bright;
    pg.fill(s, s + 2, s + 12);
    pg.rect(x, horizon - bh, bw, bh + pg.height * 0.65);

    for (let wy = horizon - bh + 6; wy < min(horizon + 120, pg.height - 50); wy += random(9, 15)) {
      for (let wx = x + 3; wx < x + bw - 3; wx += random(6, 11)) {
        if (random() > 0.4) {
          let r = random();
          if (r > 0.55) pg.fill(255, 230 + random(-20, 0), 120 + random(-20, 30), random(130, 255) * bright);
          else if (r > 0.25) pg.fill(180 + random(-20, 20), 220, 255, random(80, 200) * bright);
          else pg.fill(255, 160 + random(40), 180 + random(40), random(60, 150) * bright);
          pg.rect(wx, wy, random(2.5, 5), random(2.5, 5));
        }
      }
    }
    x += bw + random(gap * 0.3, gap);
  }
}

// ======== 雨滴 — 用 curveVertex 画平滑曲线 ========
class RainDrop {
  constructor() {
    this.x = random(width);
    this.y = random(CONFIG.curve.startYRange[0], CONFIG.curve.startYRange[1]);
    this.points = [{ x: this.x, y: this.y }];
    this.speed = random(CONFIG.curve.growthSpeedRange[0], CONFIG.curve.growthSpeedRange[1]);
    this.maxLen = random(CONFIG.curve.maxLengthRange[0], CONFIG.curve.maxLengthRange[1]);
    this.weight = random(CONFIG.curve.weightRange[0], CONFIG.curve.weightRange[1]);
    this.len = 0;
    this.done = false;
    this.nOff = random(1000);
    this.life = 0;
    this.drawnUpTo = 0; // 已经画到蒙版上的点索引
  }

  grow() {
    if (this.len >= this.maxLen) {
      this.life++;
      if (this.life > 300) this.done = true;
      return;
    }

    let last = this.points[this.points.length - 1];
    let dx = map(noise(this.nOff + this.len * 0.008), 0, 1,
                 CONFIG.curve.xDriftRange[0], CONFIG.curve.xDriftRange[1]);
    this.points.push({
      x: last.x + dx,
      y: last.y + this.speed,
    });
    this.len += this.speed;
  }

  drawToReveal() {
    let n = this.points.length;
    if (n < 4) return;

    // 增量绘制：只画新增的段到蒙版
    let startIdx = max(0, this.drawnUpTo - 3);
    if (startIdx >= n - 3) return;

    revealCanvas.stroke(255, 210);
    revealCanvas.strokeWeight(this.weight);
    revealCanvas.noFill();

    for (let i = startIdx; i < n - 3; i++) {
      if (i < this.drawnUpTo - 1) continue;
      revealCanvas.beginShape();
      revealCanvas.curveVertex(this.points[i].x, this.points[i].y);
      revealCanvas.curveVertex(this.points[i + 1].x, this.points[i + 1].y);
      revealCanvas.curveVertex(this.points[i + 2].x, this.points[i + 2].y);
      revealCanvas.curveVertex(this.points[i + 3].x, this.points[i + 3].y);
      revealCanvas.endShape();
    }
    this.drawnUpTo = n - 2;

    // 水珠头部
    if (this.len < this.maxLen) {
      let last = this.points[n - 1];
      revealCanvas.noStroke();
      revealCanvas.fill(255, 220);
      revealCanvas.ellipse(last.x, last.y, this.weight * 2.5, this.weight * 3);
    }
  }
}

// ======== 雾气 ========
function drawFog() {
  noStroke();
  for (let i = 0; i < 3; i++) {
    let fy = noise(frameCount * 0.0012 + i * 80) * height;
    fill(160, 175, 200, 5 + sin(frameCount * 0.006 + i) * 3);
    ellipse(width / 2, fy, width * 2, 250);
  }
}

// ======== 诗句 ========
function drawPoem() {
  push();
  fill(255, 255, 255, 110);
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
