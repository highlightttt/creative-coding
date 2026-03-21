// 潮湿的雨夜 v6 — fix: 用 createGraphics 替代 get() 避免 canvas 访问问题

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
};

const LETTER_LINES = [
  "兰成：",
  "我已经不喜欢你了，",
  "你是早已经不喜欢我的了。",
  "这次的决心，",
  "我是经过一年半的长时间考虑的，",
  "彼时唯以小吉故，",
  "不欲增加你的困难。",
  "Once, in your presence,",
  "I diminished—so low",
  "I sank into dust.",
  "曾经，见了你，",
  "我变得很低很低，",
  "低到尘埃里，",
  "甚至都盼着从尘埃里开出花来，",
  "I believed you understood me—",
  "the joys and sorrows in my words,",
  "the solitude in my soul.",
  "我以为，你是懂我的，",
  "懂我文字里的悲欢，",
  "懂我灵魂深处的孤寂。",
  "在婚书上写下",
  ""愿岁月静好，现世安稳"",
  "以为就此握住了一生的幸福，",
  "可现实终究是残酷的。",
  "But reality proved cruel.",
  "我的心便已开始千疮百孔。",
  "随信附上三十万法币，",
  "算是与你这段感情的终结。",
  "从此以后，你不要来寻我，",
  "Seek me no more;",
  "即或写信来，",
  "我亦是不看的了。",
  "I won't read it.",
  "— 张爱玲  Eileen Chang",
];

// 保留为 createGraphics（有 .elt / canvas 属性）
let blurGfx, clearGfx, revealCanvas;
let curves = [];
let fc = 0;

function setup() {
  createCanvas(CONFIG.canvas.width, CONFIG.canvas.height);
  pixelDensity(1);

  // 清晰版
  clearGfx = createGraphics(width, height);
  drawLetterBg(clearGfx, [25, 55, 150], [255, 255, 255, 220]);

  // 模糊版
  blurGfx = createGraphics(width, height);
  drawLetterBg(blurGfx, [90, 140, 220], [130, 170, 230, 150]);
  blurGfx.filter(BLUR, 5);
  blurGfx.fill(100, 150, 220, 40);
  blurGfx.noStroke();
  blurGfx.rect(0, 0, width, height);
  // 大标题
  drawTitle(blurGfx);

  // 蒙版
  revealCanvas = createGraphics(width, height);
  revealCanvas.clear();
}

function drawLetterBg(pg, bgCol, txtCol) {
  pg.background(bgCol[0], bgCol[1], bgCol[2]);
  pg.fill(txtCol[0], txtCol[1], txtCol[2], txtCol[3] || 255);
  pg.noStroke();
  pg.textFont("Georgia");
  pg.textSize(15);
  pg.textAlign(LEFT, TOP);

  let margin = 30;
  let y = margin;
  let idx = 0;
  while (y < height - margin) {
    pg.text(LETTER_LINES[idx % LETTER_LINES.length], margin, y);
    y += 22;
    idx++;
  }
}

function drawTitle(pg) {
  pg.push();
  pg.fill(35, 70, 170, 200);
  pg.noStroke();
  pg.textFont("Georgia");
  pg.textSize(80);
  pg.textAlign(LEFT, TOP);
  pg.text("R a i n y", 35, 160);
  pg.text("N i g h t", 35, 270);
  pg.textSize(110);
  pg.text("雨  夜", 35, 420);
  pg.pop();
}

function draw() {
  // 1. 模糊背景
  image(blurGfx, 0, 0);

  // 2. 生成雨滴
  fc++;
  if (fc % CONFIG.generator.spawnInterval === 0 && curves.length < CONFIG.generator.maxCurves) {
    curves.push(new RainDrop());
  }

  // 3. 更新雨滴，画到蒙版
  for (let i = curves.length - 1; i >= 0; i--) {
    curves[i].grow();
    curves[i].drawToReveal();
    if (curves[i].done) curves.splice(i, 1);
  }

  // 4. 蒙版合成 — 用原生 canvas API
  let mainCtx = drawingContext;
  let tmpCvs = document.createElement('canvas');
  tmpCvs.width = width;
  tmpCvs.height = height;
  let tmpCtx = tmpCvs.getContext('2d');
  // 画清晰图
  tmpCtx.drawImage(clearGfx.elt, 0, 0);
  // destination-in: 只保留蒙版白色区域
  tmpCtx.globalCompositeOperation = 'destination-in';
  tmpCtx.drawImage(revealCanvas.elt, 0, 0);
  // 叠到主画布
  mainCtx.drawImage(tmpCvs, 0, 0);

  // 5. 淡雾
  drawFog();
}

// ======== 雨滴 ========
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
    this.drawnUpTo = 0;
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
    this.points.push({ x: last.x + dx, y: last.y + this.speed });
    this.len += this.speed;
  }

  drawToReveal() {
    let n = this.points.length;
    if (n < 4) return;

    revealCanvas.stroke(255, 210);
    revealCanvas.strokeWeight(this.weight);
    revealCanvas.noFill();

    for (let i = max(0, this.drawnUpTo - 1); i < n - 3; i++) {
      revealCanvas.beginShape();
      revealCanvas.curveVertex(this.points[i].x, this.points[i].y);
      revealCanvas.curveVertex(this.points[i+1].x, this.points[i+1].y);
      revealCanvas.curveVertex(this.points[i+2].x, this.points[i+2].y);
      revealCanvas.curveVertex(this.points[i+3].x, this.points[i+3].y);
      revealCanvas.endShape();
    }
    this.drawnUpTo = n - 2;

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
    let fy = noise(frameCount * 0.001 + i * 80) * height;
    fill(120, 160, 220, 4 + sin(frameCount * 0.005 + i) * 2);
    ellipse(width / 2, fy, width * 2, 250);
  }
}
