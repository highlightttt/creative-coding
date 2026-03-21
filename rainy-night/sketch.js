// 潮湿的雨夜 v4 — 忠实于思花原设计
// 背景是张爱玲写给胡兰成的分手信，水滴擦出清晰文字

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

// 张爱玲写给胡兰成的分手信（中英对照）
const LETTER_TEXT = `兰成：Lan Cheng: 我已经不喜欢你了，I no longer love you, 你是早已经不喜欢我的了。you have long ceased to love me. 这次的决心，我是经过一年半的长时间考虑的，This resolution came after a year and a half of deliberation. 彼时唯以小吉故，不欲增加你的困难。only delaying to avoid adding to your burdens. 曾经，见了你，我变得很低很低，低到尘埃里，Once, in your presence, I diminished—so low I sank into dust. 甚至都盼着从尘埃里开出花来，still vainly hoping flowers might bloom from that dust. 我以为，你是懂我的，I believed you understood me— 懂我文字里的悲欢，the joys and sorrows in my words, 懂我灵魂深处的孤寂，the solitude in my soul's depths. 那时的我，满心期许，Back then, full of hope, 在婚书上写下"愿岁月静好，现世安稳"I wrote on our marriage certificate: "May time flow gently, the world stay tranquil," 以为就此握住了一生的幸福，thinking I'd grasped lifelong happiness. 可现实终究是残酷的，But reality proved cruel. 你与小周的那段情，When you told me unabashedly of your affair with Xiao Zhou, 你毫无顾忌地告知我时，my heart became riddled with wounds. 我的心便已开始千疮百孔。I stifled rage and pain. 我努力压抑心中的怒火与痛苦，trying to understand, to endure, 试图去理解，试图去包容，pouring my turmoil into writing— 将满心的挣扎倾诉于笔端，thus came "Red Rose and White Rose." 于是有了《红玫瑰与白玫瑰》。Yet you remained unrepentant. 但你未曾悔过，你经常不归家。fleeing to Wenzhou, 在那已温州时，you took up with Fan Xiumei. 你与范秀美断混在一起。I traveled miles to find you, 我千里迢迢去寻你，only to meet your scorn. 换来的却是你的冷漠与训斥。That moment revealed our irreversible end. 那一刻，我终于明白，我们之间再也回不去了。For eighteen months I revisited memories, 这一年半的时间里，我不断地回忆，不断地思索，seeking reasons to persist—试图从过往的点滴里找到坚持下去的理由，all in vain. 可终究是徒劳。No more self-deception; 如今，我不想再自欺欺人，no more drowning in this abyss. 也不想再让自己沉没在这痛苦的深渊中无法自拔。Enclosed are 300,000 francs— 随信附上三十万法币，my earnings from two screenplays— 这是我写两部电影剧本所得的稿酬，our relationship's final settlement. 算是与你这段感情的终结。Seek me no more; 从此以后，你不要来寻我，should you write, 即或写信来，I won't read it. 我亦是不看的了。-张爱玲 -Eileen Chang`;

let blurImg, clearImg, revealCanvas;
let curves = [];
let fc = 0;

function setup() {
  createCanvas(CONFIG.canvas.width, CONFIG.canvas.height);
  pixelDensity(1);

  // 清晰版：深蓝底 + 白色文字
  clearImg = createLetterImage(color(20, 50, 140), color(255, 255, 255, 230), false);

  // 模糊版：浅蓝底 + 浅色文字，然后模糊
  blurImg = createLetterImage(color(60, 100, 180), color(180, 200, 240, 180), true);

  revealCanvas = createGraphics(width, height);
  revealCanvas.clear();
}

function createLetterImage(bgColor, textColor, doBlur) {
  let pg = createGraphics(width, height);
  pg.background(bgColor);

  pg.fill(textColor);
  pg.noStroke();
  pg.textFont("serif");
  pg.textSize(11);
  pg.textLeading(15);
  pg.textAlign(LEFT, TOP);

  // 铺满整个画布的文字
  let margin = 25;
  let textWidth = width - margin * 2;
  let y = margin;
  let words = LETTER_TEXT.split(/\s+/);
  let line = '';

  for (let word of words) {
    let testLine = line + (line ? ' ' : '') + word;
    if (pg.textWidth(testLine) > textWidth && line) {
      pg.text(line, margin, y);
      y += 15;
      line = word;
      if (y > height - margin) {
        y = margin; // 循环铺满
      }
    } else {
      line = testLine;
    }
  }
  if (line) pg.text(line, margin, y);

  // 如果文字没铺满，重复铺
  y += 15;
  while (y < height - margin) {
    let wordsAgain = LETTER_TEXT.split(/\s+/);
    for (let word of wordsAgain) {
      let testLine = line + (line ? ' ' : '') + word;
      if (pg.textWidth(testLine) > textWidth && line) {
        pg.text(line, margin, y);
        y += 15;
        line = word;
        if (y > height - margin) break;
      } else {
        line = testLine;
      }
    }
    if (y > height - margin) break;
  }

  if (doBlur) {
    pg.filter(BLUR, 4);
    // 再叠一层淡雾
    pg.fill(80, 120, 180, 50);
    pg.noStroke();
    pg.rect(0, 0, width, height);
  }

  let img = pg.get();
  pg.remove();
  return img;
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

  // 蒙版合成：清晰文字只在水痕处显示
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

// ======== 雨滴 curveVertex ========
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

    // 水珠头
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
    fill(100, 140, 200, 4 + sin(frameCount * 0.005 + i) * 2);
    ellipse(width / 2, fy, width * 2, 250);
  }
}
