// 潮湿的雨夜 v5 — 忠实于思花原设计
// 初始：雾面玻璃 + "Rainy Night 雨夜" 标题
// 水滴滑过时擦出清晰的信件文字

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
  "the solitude in my soul's depths.",
  "我以为，你是懂我的，",
  "懂我文字里的悲欢，",
  "懂我灵魂深处的孤寂。",
  "在婚书上写下",
  ""愿岁月静好，现世安稳"",
  "以为就此握住了一生的幸福，",
  "可现实终究是残酷的。",
  "But reality proved cruel.",
  "your affair with Xiao Zhou,",
  "my heart became riddled",
  "with wounds.",
  "我的心便已开始千疮百孔。",
  "This resolution came after",
  "a year and a half of deliberation.",
  "随信附上三十万法币，",
  "Enclosed are 300,000 francs—",
  "算是与你这段感情的终结。",
  "从此以后，你不要来寻我，",
  "Seek me no more;",
  "即或写信来，",
  "我亦是不看的了。",
  "I won't read it.",
  "— 张爱玲  Eileen Chang",
];

let blurImg, clearImg, revealCanvas;
let curves = [];
let fc = 0;

function setup() {
  createCanvas(CONFIG.canvas.width, CONFIG.canvas.height);
  pixelDensity(1);

  // 清晰版：深蓝底 + 大号白色文字
  let clearGfx = createGraphics(width, height);
  drawLetterBg(clearGfx, color(25, 55, 150), color(255, 255, 255, 220));
  clearImg = clearGfx.get();
  clearGfx.remove();

  // 模糊版：亮蓝底 + 浅色文字 + 模糊 + 大标题
  let blurGfx = createGraphics(width, height);
  drawLetterBg(blurGfx, color(90, 140, 220), color(130, 170, 230, 150));
  blurGfx.filter(BLUR, 5);
  // 叠一层淡雾
  blurGfx.fill(100, 150, 220, 40);
  blurGfx.noStroke();
  blurGfx.rect(0, 0, width, height);
  // 大标题 "Rainy Night 雨夜"
  drawTitle(blurGfx);
  blurImg = blurGfx.get();
  blurGfx.remove();

  revealCanvas = createGraphics(width, height);
  revealCanvas.clear();
}

function drawLetterBg(pg, bgColor, txtColor) {
  pg.background(bgColor);
  pg.fill(txtColor);
  pg.noStroke();
  pg.textFont("Georgia, 'Noto Serif SC', 'Songti SC', serif");
  pg.textSize(15);
  pg.textLeading(22);
  pg.textAlign(LEFT, TOP);

  let margin = 30;
  let y = margin;
  let lineIdx = 0;

  // 铺满整个画布，循环文字
  while (y < height - margin) {
    let line = LETTER_LINES[lineIdx % LETTER_LINES.length];
    pg.text(line, margin, y, width - margin * 2);
    y += 22;
    lineIdx++;
  }
}

function drawTitle(pg) {
  pg.push();
  pg.fill(40, 80, 180, 200);
  pg.noStroke();

  // "Rainy"
  pg.textFont("Georgia, 'Times New Roman', serif");
  pg.textSize(90);
  pg.textAlign(LEFT, TOP);
  pg.textStyle(NORMAL);
  pg.text("R a i n y", 40, 150);

  // "Night"
  pg.text("N i g h t", 40, 270);

  // "雨 夜"
  pg.textFont("'Songti SC', 'Noto Serif SC', 'STSong', serif");
  pg.textSize(120);
  pg.text("雨  夜", 40, 420);

  pg.pop();
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
