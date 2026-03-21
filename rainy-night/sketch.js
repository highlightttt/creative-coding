// 潮湿的雨夜 v10 — 按作者最终参数
// 关键：曲线本身不可见，只是透明蒙版，露出清晰层
// 两层图的差异要微妙（模糊vs清晰），不是深蓝vs浅蓝

const CONFIG = {
  canvas: { width: 600, height: 800 },
  curve: {
    startYRange: [-20, 0],
    growthSpeedRange: [1, 3],
    xDriftOptions: [-1, 1],
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
  "I diminished - so low",
  "I sank into dust.",
  "曾经，见了你，",
  "我变得很低很低，",
  "低到尘埃里，",
  "甚至都盼着从尘埃里开出花来，",
  "I believed you understood me -",
  "the joys and sorrows in my words,",
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

  // 两层用相同的底色和文字，区别只在于模糊程度
  let baseColor = [45, 80, 160]; // 统一蓝色底
  let textColor = [220, 230, 245]; // 浅色文字

  // 前景（清晰版）- 被蒙版揭示
  fgCanvas = createGraphics(width, height);
  drawLetterPage(fgCanvas, baseColor, textColor, 16, 24);

  // 背景（模糊版）- 默认显示
  bgCanvas = createGraphics(width, height);
  drawLetterPage(bgCanvas, baseColor, textColor, 16, 24);
  bgCanvas.filter(BLUR, 6);
  // 轻微雾气叠加
  bgCanvas.fill(80, 120, 180, 50);
  bgCanvas.noStroke();
  bgCanvas.rect(0, 0, width, height);
  // 标题
  drawTitle(bgCanvas);

  // 蒙版：透明底
  maskCanvas = createGraphics(width, height);
  maskCanvas.clear();
}

function drawLetterPage(pg, bgCol, txtCol, fontSize, leading) {
  pg.background(bgCol[0], bgCol[1], bgCol[2]);
  pg.fill(txtCol[0], txtCol[1], txtCol[2]);
  pg.noStroke();
  pg.textFont("Georgia, 'Songti SC', serif");
  pg.textSize(fontSize);
  pg.textAlign(LEFT, TOP);

  let margin = 35;
  let y = margin;
  let idx = 0;
  while (y < height - margin) {
    pg.text(LETTER_LINES[idx % LETTER_LINES.length], margin, y);
    y += leading;
    idx++;
  }
}

function drawTitle(pg) {
  pg.push();
  pg.fill(60, 95, 180, 180);
  pg.noStroke();
  pg.textFont("Georgia, 'Songti SC', serif");
  pg.textAlign(LEFT, TOP);
  pg.textSize(80);
  pg.text("Rainy", 35, 180);
  pg.text("Night", 35, 290);
  pg.textSize(100);
  pg.text("雨  夜", 35, 430);
  pg.pop();
}

function draw() {
  // 1. 背景（模糊）
  image(bgCanvas, 0, 0);

  // 2. 新雨滴
  fc++;
  if (fc % CONFIG.generator.spawnInterval === 0 && curves.length < CONFIG.generator.maxCurves) {
    curves.push(new RainCurve());
  }

  // 3. 生长 + 画蒙版
  for (let i = curves.length - 1; i >= 0; i--) {
    curves[i].grow();
    curves[i].drawToMask();
    if (curves[i].done) curves.splice(i, 1);
  }

  // 4. 合成：用 canvas composite 把清晰图通过蒙版叠上
  let mainCtx = drawingContext;
  let tmpCvs = document.createElement("canvas");
  tmpCvs.width = width;
  tmpCvs.height = height;
  let tmpCtx = tmpCvs.getContext("2d");

  // 先画蒙版（有alpha的区域）
  tmpCtx.drawImage(maskCanvas.canvas || maskCanvas.elt, 0, 0);
  // source-in: 只保留蒙版有像素的地方，用清晰图填充
  tmpCtx.globalCompositeOperation = "source-in";
  tmpCtx.drawImage(fgCanvas.canvas || fgCanvas.elt, 0, 0);
  // 叠到主画布
  mainCtx.drawImage(tmpCvs, 0, 0);
}

class RainCurve {
  constructor() {
    this.x = random(width);
    this.y = random(CONFIG.curve.startYRange[0], CONFIG.curve.startYRange[1]);
    this.points = [createVector(this.x, this.y)];
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
                 CONFIG.curve.xDriftOptions[0], CONFIG.curve.xDriftOptions[1]);
    this.points.push(createVector(last.x + dx, last.y + this.speed));
    this.len += this.speed;
  }

  drawToMask() {
    let n = this.points.length;
    if (n < 4) return;

    let pg = maskCanvas;
    pg.stroke(255);
    pg.strokeWeight(this.weight);
    pg.noFill();

    for (let i = max(0, this.drawnUpTo - 1); i < n - 3; i++) {
      pg.beginShape();
      pg.curveVertex(this.points[i].x, this.points[i].y);
      pg.curveVertex(this.points[i+1].x, this.points[i+1].y);
      pg.curveVertex(this.points[i+2].x, this.points[i+2].y);
      pg.curveVertex(this.points[i+3].x, this.points[i+3].y);
      pg.endShape();
    }
    this.drawnUpTo = n - 2;

    // 水珠
    if (this.len < this.maxLen) {
      let last = this.points[n - 1];
      pg.noStroke();
      pg.fill(255);
      pg.ellipse(last.x, last.y, this.weight * 2, this.weight * 2.5);
    }
  }
}
