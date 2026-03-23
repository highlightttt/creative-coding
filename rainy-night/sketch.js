// 潮湿的雨夜 v15
// 文字连续流式铺满，不换行不留空隙，中英文混排密铺

const CONFIG = {
  canvas: { width: 600, height: 800 },
  curve: {
    startYRange: [-20, 0],
    growthSpeedRange: [2, 5],
    xDriftOptions: [-0.3, 0.3],
    maxLengthRange: [600, 1000],
    weightRange: [3, 4],
    roughness: 0.4,
    roughnessAmp: 1.2,
  },
  generator: {
    spawnInterval: 60,
    maxCurves: 60,
  },
};

// 把整封信拼成一个连续字符串，逐字符排列
const LETTER_TEXT = "兰成：我已经不喜欢你了，你是早已经不喜欢我的了。这次的决心，我是经过一年半的长时间考虑的，彼时唯以小吉故，不欲增加你的困难。Lan Cheng: I no longer love you, you have long ceased to love me. This resolution came after a year and a half of deliberation. 曾经，见了你，我变得很低很低，低到尘埃里，甚至都盼着从尘埃里开出花来。Once, in your presence, I diminished - so low I sank into dust, still vainly hoping flowers might bloom from that dust. 我以为，你是懂我的，懂我文字里的悲欢，懂我灵魂深处的孤寂。I believed you understood me - the joys and sorrows in my words, the solitude in my soul. 在婚书上写下愿岁月静好，现世安稳，以为就此握住了一生的幸福，可现实终究是残酷的。But reality proved cruel. 我的心便已开始千疮百孔。My heart became riddled with wounds. 随信附上三十万法币，算是与你这段感情的终结。Enclosed are 300,000 francs - our relationship's final settlement. 从此以后，你不要来寻我，即或写信来，我亦是不看的了。Seek me no more; should you write, I won't read it. - 张爱玲 Eileen Chang ";

let bgCanvas, fgCanvas, maskCanvas;
let curves = [];
let fc = 0;
let ready = false;

function setup() {
  createCanvas(CONFIG.canvas.width, CONFIG.canvas.height);
  pixelDensity(displayDensity());
  background(50, 110, 245);

  document.fonts.ready.then(() => {
    initLayers();
    ready = true;
  });
}

function initLayers() {
  let baseColor = [50, 110, 245];

  fgCanvas = createGraphics(width, height);
  drawFlowText(fgCanvas, baseColor, [230, 240, 255, 240]);

  bgCanvas = createGraphics(width, height);
  drawFlowText(bgCanvas, baseColor, [120, 160, 240, 180]);
  bgCanvas.filter(BLUR, 1.8);
  bgCanvas.fill(50, 110, 245, 5);
  bgCanvas.noStroke();
  bgCanvas.rect(0, 0, width, height);
  drawTitle(bgCanvas);

  maskCanvas = createGraphics(width, height);
  maskCanvas.clear();
}

// 逐字符流式排列，铺满整个画布，到右边界自动换行
function drawFlowText(pg, bgCol, txtCol) {
  pg.background(bgCol[0], bgCol[1], bgCol[2]);
  pg.fill(txtCol[0], txtCol[1], txtCol[2], txtCol[3] || 255);
  pg.noStroke();
  pg.textFont("'Noto Serif SC', 'Songti SC', Georgia, serif");
  pg.textSize(11);
  pg.textAlign(LEFT, TOP);

  let margin = 6;
  let lineH = 16;
  let x = margin;
  let y = margin;
  let maxX = width - margin;
  let charIdx = 0;
  let fullText = LETTER_TEXT;

  while (y < height) {
    let ch = fullText[charIdx % fullText.length];
    let cw = pg.textWidth(ch);

    // 如果放不下就换行
    if (x + cw > maxX) {
      x = margin;
      y += lineH;
      if (y >= height) break;
    }

    pg.text(ch, x, y);
    x += cw;
    charIdx++;

    // 安全上限
    if (charIdx > 20000) break;
  }
}

function drawTitle(pg) {
  pg.push();
  pg.fill(30, 60, 190, 150);
  pg.noStroke();
  pg.textFont("'Cormorant Garamond', Georgia, serif");
  pg.textAlign(LEFT, TOP);
  pg.textStyle(ITALIC);
  pg.textSize(85);
  pg.text("Rainy", 25, 160);
  pg.text("Night", 25, 280);
  pg.textStyle(NORMAL);
  pg.textFont("'Noto Serif SC', 'Songti SC', serif");
  pg.textSize(110);
  pg.text("雨  夜", 25, 430);
  pg.pop();
}

function draw() {
  if (!ready) return;
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

  // canvas compositing
  let pd = displayDensity();
  let mainCtx = drawingContext;
  let tmpCvs = document.createElement("canvas");
  tmpCvs.width = width * pd;
  tmpCvs.height = height * pd;
  let tmpCtx = tmpCvs.getContext("2d");
  tmpCtx.drawImage(maskCanvas.canvas || maskCanvas.elt, 0, 0);
  tmpCtx.globalCompositeOperation = "source-in";
  tmpCtx.drawImage(fgCanvas.canvas || fgCanvas.elt, 0, 0);
  mainCtx.drawImage(tmpCvs, 0, 0, width * pd, height * pd, 0, 0, width, height);
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
    this.wOff = random(5000);
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

    for (let i = max(0, this.drawnUpTo - 1); i < n - 3; i++) {
      let wNoise = noise(this.wOff + i * CONFIG.curve.roughness);
      let w = this.baseWeight + (wNoise - 0.5) * 2 * CONFIG.curve.roughnessAmp;
      w = max(1, w);
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

    if (this.len < this.maxLen) {
      let last = this.points[n - 1];
      pg.noStroke();
      pg.fill(255, 230);
      pg.ellipse(last.x, last.y, this.baseWeight * 2, this.baseWeight * 2.5);
    }
  }
}
