// 潮湿的雨夜 v11
// 1. 文字铺满整个背景（多列密排）
// 2. 水滴边缘不平滑：noise调制粗细 + 微小分支
// 3. 更高饱和度的蓝色

const CONFIG = {
  canvas: { width: 600, height: 800 },
  curve: {
    startYRange: [-20, 0],
    growthSpeedRange: [1, 3],
    xDriftOptions: [-1, 1],
    maxLengthRange: [600, 1000],
    weightRange: [3, 4],
    // 边缘粗糙度
    roughness: 0.15,       // noise频率控制粗细变化
    roughnessAmp: 2.5,     // 粗细波动幅度(px)
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
  "I diminished - so low",
  "I sank into dust.",
  "曾经，见了你，",
  "我变得很低很低，低到尘埃里，",
  "甚至都盼着从尘埃里开出花来，",
  "I believed you understood me -",
  "the joys and sorrows",
  "in my words,",
  "the solitude in my soul.",
  "我以为，你是懂我的，",
  "懂我文字里的悲欢，",
  "懂我灵魂深处的孤寂。",
  "在婚书上写下",
  "愿岁月静好，现世安稳",
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
  "- Eileen Chang",
];

let bgCanvas, fgCanvas, maskCanvas;
let curves = [];
let fc = 0;

function setup() {
  createCanvas(CONFIG.canvas.width, CONFIG.canvas.height);
  pixelDensity(1);

  // 高饱和蓝色
  let baseColor = [30, 90, 220];
  let textColor = [150, 190, 255, 200];

  // 前景（清晰）
  fgCanvas = createGraphics(width, height);
  drawDenseText(fgCanvas, baseColor, [220, 235, 255, 240]);

  // 背景（模糊）
  bgCanvas = createGraphics(width, height);
  drawDenseText(bgCanvas, baseColor, textColor);
  bgCanvas.filter(BLUR, 6);
  bgCanvas.fill(50, 100, 210, 40);
  bgCanvas.noStroke();
  bgCanvas.rect(0, 0, width, height);
  drawTitle(bgCanvas);

  // 蒙版
  maskCanvas = createGraphics(width, height);
  maskCanvas.clear();
}

// 文字铺满整个画布 — 多列、密排
function drawDenseText(pg, bgCol, txtCol) {
  pg.background(bgCol[0], bgCol[1], bgCol[2]);
  pg.fill(txtCol[0], txtCol[1], txtCol[2], txtCol[3] || 255);
  pg.noStroke();
  pg.textFont("'Songti SC', Georgia, 'Noto Serif SC', 'STSong', serif");
  pg.textSize(13);
  pg.textAlign(LEFT, TOP);

  let cols = 3;
  let colW = (width - 20) / cols;
  let margin = 10;
  let leading = 18;

  for (let c = 0; c < cols; c++) {
    let x = margin + c * colW;
    let y = margin + random(-5, 5); // 轻微错位
    let idx = floor(random(LETTER_LINES.length)); // 每列起始不同
    while (y < height - margin) {
      pg.text(LETTER_LINES[idx % LETTER_LINES.length], x, y, colW - 8);
      y += leading;
      idx++;
    }
  }
}

function drawTitle(pg) {
  pg.push();
  pg.fill(40, 80, 200, 160);
  pg.noStroke();
  pg.textFont("Georgia, 'Times New Roman', serif");
  pg.textAlign(LEFT, TOP);
  pg.textStyle(ITALIC);
  pg.textSize(85);
  pg.text("Rainy", 30, 160);
  pg.text("Night", 30, 280);
  pg.textStyle(NORMAL);
  pg.textFont("'Songti SC', 'Noto Serif SC', 'STSong', serif");
  pg.textSize(110);
  pg.text("雨  夜", 30, 430);
  pg.pop();
}

function draw() {
  image(bgCanvas, 0, 0);

  fc++;
  if (fc % CONFIG.generator.spawnInterval === 0 && curves.length < CONFIG.generator.maxCurves) {
    curves.push(new RainCurve());
  }

  for (let i = curves.length - 1; i >= 0; i--) {
    curves[i].grow();
    curves[i].drawToMask();
    if (curves[i].done) curves.splice(i, 1);
  }

  // 合成
  let mainCtx = drawingContext;
  let tmpCvs = document.createElement("canvas");
  tmpCvs.width = width;
  tmpCvs.height = height;
  let tmpCtx = tmpCvs.getContext("2d");
  tmpCtx.drawImage(maskCanvas.canvas || maskCanvas.elt, 0, 0);
  tmpCtx.globalCompositeOperation = "source-in";
  tmpCtx.drawImage(fgCanvas.canvas || fgCanvas.elt, 0, 0);
  mainCtx.drawImage(tmpCvs, 0, 0);
}

class RainCurve {
  constructor() {
    this.x = random(width);
    this.y = random(CONFIG.curve.startYRange[0], CONFIG.curve.startYRange[1]);
    this.points = [createVector(this.x, this.y)];
    this.speed = random(CONFIG.curve.growthSpeedRange[0], CONFIG.curve.growthSpeedRange[1]);
    this.maxLen = random(CONFIG.curve.maxLengthRange[0], CONFIG.curve.maxLengthRange[1]);
    this.baseWeight = random(CONFIG.curve.weightRange[0], CONFIG.curve.weightRange[1]);
    this.len = 0;
    this.done = false;
    this.nOff = random(1000);
    this.wOff = random(5000); // 粗细noise偏移
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
                 CONFIG.curve.xDriftOptions[0], CONFIG.curve.xDriftOptions[1]);
    this.points.push(createVector(last.x + dx, last.y + this.speed));
    this.len += this.speed;
  }

  drawToMask() {
    let n = this.points.length;
    if (n < 4) return;

    let pg = maskCanvas;

    // 逐段画，每段粗细用 noise 调制 → 边缘不平滑
    for (let i = max(0, this.drawnUpTo - 1); i < n - 3; i++) {
      let t = i / n;
      let wNoise = noise(this.wOff + i * CONFIG.curve.roughness);
      let w = this.baseWeight + (wNoise - 0.5) * 2 * CONFIG.curve.roughnessAmp;
      w = max(1, w);

      // alpha也微变 → 有些段更淡
      let a = 200 + (wNoise - 0.5) * 100;

      pg.stroke(255, a);
      pg.strokeWeight(w);
      pg.noFill();
      pg.beginShape();
      pg.curveVertex(this.points[i].x, this.points[i].y);
      pg.curveVertex(this.points[i+1].x, this.points[i+1].y);
      pg.curveVertex(this.points[i+2].x, this.points[i+2].y);
      pg.curveVertex(this.points[i+3].x, this.points[i+3].y);
      pg.endShape();
    }
    this.drawnUpTo = n - 2;

    // 水珠头
    if (this.len < this.maxLen) {
      let last = this.points[n - 1];
      pg.noStroke();
      pg.fill(255, 230);
      pg.ellipse(last.x, last.y, this.baseWeight * 2, this.baseWeight * 2.5);
    }
  }
}
