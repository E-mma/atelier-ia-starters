// NE PAS MODIFIER CE FICHIER : c'est le moteur de Crossy Road.
// Il charge les images (art.js), fait tourner la boucle et appelle TES fonctions de script.js :
//   drawPlayer()         chaque image, quand la partie tourne : dessine la poule
//   onKey(direction)     quand tu appuies sur une fleche : 'left', 'right', 'up' ou 'down'
//   laneType(row)        pour chaque rangee : renvoie 'grass', 'road' ou 'river'
//   updateCar(car)       chaque image, pour chaque voiture
//   checkCollision(car)  chaque image, pour chaque voiture de la rangee de la poule
//   customize()          au debut de chaque partie
// Tu peux utiliser : hen (col, row, x, y), game (score, speed, baseSpeed), car (x, speed, w, row),
// drawHen(x, y), overlaps(car), killHen(), setSkin(nom).

// ---- Constantes ----
var CELL = 40;
var COLS = 12;
var ROWS = 12;
var WIDTH = COLS * CELL;
var HEIGHT = ROWS * CELL;
var STEP = 1000 / 30;
var HOP_FRAMES = 8;
var SAFE_ROWS = 3;
var SAFE_FRAMES = 60;
var EDGE = 100;
var LOOP = WIDTH + 2 * EDGE;
var SKINS = ['hen', 'chick', 'raven'];
var SKY_TOP = '#8fd3f4';
var SKY_BOTTOM = '#d8f1e4';
var FONT = 'bold 20px Arial, sans-serif';

// ---- Etat du jeu ----
var canvas = document.getElementById('game');
var ctx = canvas.getContext('2d');
var skyGradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
skyGradient.addColorStop(0, SKY_TOP);
skyGradient.addColorStop(1, SKY_BOTTOM);

var game = {
  state: 'title',
  score: 0,
  best: 0,
  time: 0,
  speed: 1,
  baseSpeed: 1,
  camera: 0,
  shake: 0,
  flash: 0,
  pop: 0,
  lanes: {},
  particles: [],
  seed: 3,
  rounds: 0,
  skin: 'hen',
  deadT: 0,
  overT: 0,
  reason: '',
  newBest: false,
  tick: 0
};
var hen = {
  col: 5,
  row: 0,
  wx: 200,
  rowF: 0,
  x: 200,
  y: 0,
  hop: -1,
  fx: 0,
  fy: 0,
  tx: 0,
  ty: 0,
  frame: 0,
  alive: true,
  log: null
};
var keys = {};
var clouds = [
  { x: 40, y: 60, k: 'cloud_a' },
  { x: 300, y: 150, k: 'cloud_b' },
  { x: 180, y: 250, k: 'cloud_a' },
  { x: 420, y: 330, k: 'cloud_b' }
];

// ---- Aleatoire reproductible (meme seed = meme niveau) ----
function makeRng(seed) {
  var s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    var t = s;
    t = Math.imul
      ? Math.imul(t ^ (t >>> 15), t | 1)
      : (t ^ (t >>> 15)) * (t | 1);
    t ^=
      t +
      (Math.imul
        ? Math.imul(t ^ (t >>> 7), t | 61)
        : (t ^ (t >>> 7)) * (t | 61));
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- Rangees ----
function rowY(row) {
  return HEIGHT - (row - game.camera + 1) * CELL;
}

function getLane(row) {
  var lane = game.lanes[row];
  if (lane) {
    return lane;
  }
  var type = row < SAFE_ROWS ? 'grass' : laneType(row);
  if (type != 'road' && type != 'river') {
    type = 'grass';
  }
  lane = { row: row, type: type, cars: [], logs: [], trees: [] };
  var rng = makeRng(row * 7919 + game.seed * 104729);
  if (type == 'grass') {
    fillTrees(lane, rng);
  } else if (type == 'road') {
    fillCars(lane, rng);
  } else {
    fillLogs(lane, rng);
  }
  game.lanes[row] = lane;
  return lane;
}

function fillTrees(lane, rng) {
  if (lane.row < SAFE_ROWS + 1) {
    return;
  }
  var chance = Math.min(0.28, 0.14 + lane.row * 0.004);
  for (var c = 0; c < COLS; c += 1) {
    if (rng() < chance && lane.trees.length < 5) {
      var r = rng();
      lane.trees.push({
        col: c,
        kind: r < 0.4 ? 'tree_pine' : r < 0.8 ? 'tree_round' : 'rock'
      });
    }
  }
}

function fillCars(lane, rng) {
  var dir = rng() < 0.5 ? 1 : -1;
  var speed = 1.6 + rng() * 1.6 + Math.min(lane.row, 60) * 0.02;
  var n = 2 + (rng() < 0.5 ? 1 : 0);
  var kinds = ['car_red', 'car_blue', 'truck'];
  for (var i = 0; i < n; i += 1) {
    var kind = kinds[Math.floor(rng() * 3)];
    var w = kind == 'truck' ? 96 : 56;
    var x = i * (LOOP / n) + rng() * 30 - EDGE;
    lane.cars.push({
      x: x,
      row: lane.row,
      speed: dir * speed,
      w: w,
      kind: kind,
      dir: dir
    });
  }
}

function fillLogs(lane, rng) {
  var dir = rng() < 0.5 ? 1 : -1;
  var speed = 0.9 + rng() * 0.9 + Math.min(lane.row, 60) * 0.01;
  var widths = [120, 80, 120];
  for (var i = 0; i < 3; i += 1) {
    var x = i * (LOOP / 3) - EDGE + rng() * 20;
    lane.logs.push({
      x: x,
      row: lane.row,
      speed: dir * speed,
      w: widths[i],
      kind: widths[i] > 100 ? 'log_l' : 'log_s'
    });
  }
}

function wrap(obj) {
  if (obj.x > WIDTH + EDGE) {
    obj.x -= LOOP;
  } else if (obj.x < -EDGE - obj.w) {
    obj.x += LOOP;
  }
}

function treeAt(col, row) {
  var lane = getLane(row);
  for (var i = 0; i < lane.trees.length; i += 1) {
    if (lane.trees[i].col == col) {
      return true;
    }
  }
  return false;
}

// ---- Poule : aides pour les enfants ----
function drawHen(x, y) {
  if (hen.drowned) {
    drawSprite('splash', x, y, hen.deadT / 5);
  } else {
    drawSprite(game.skin, x, y - 8, hen.frame);
  }
}

function setSkin(name) {
  for (var i = 0; i < SKINS.length; i += 1) {
    if (SKINS[i] == name) {
      game.skin = name;
    }
  }
}

function overlaps(car) {
  if (
    !hen.alive ||
    game.time < SAFE_FRAMES ||
    Math.abs(hen.rowF - car.row) > 0.6
  ) {
    return false;
  }
  return hen.wx + 8 < car.x + car.w && hen.wx + CELL - 8 > car.x;
}

function killHen(reason) {
  if (!hen.alive) {
    return;
  }
  hen.alive = false;
  hen.hop = -1;
  hen.frame = 4;
  hen.drowned = reason == 'water';
  game.reason = reason || 'car';
  game.shake = 12;
  game.flash = 10;
  game.deadT = 0;
  burst(hen.wx + 20, hen.y + 20, reason == 'water' ? '#d9f2ff' : '#ffffff', 14);
}

function burst(x, y, color, n) {
  for (var i = 0; i < n && game.particles.length < 30; i += 1) {
    var a = Math.random() * Math.PI * 2;
    var v = 1.5 + Math.random() * 3;
    game.particles.push({
      x: x,
      y: y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v - 2.5,
      life: 14 + Math.floor(Math.random() * 10),
      color: color,
      size: 3 + Math.floor(Math.random() * 3)
    });
  }
}

// ---- Mouvement de la poule ----
function tryMove(dir) {
  if (!hen.alive || hen.hop >= 0 || game.state != 'playing') {
    return;
  }
  var oldCol = Math.round(hen.wx / CELL);
  var oldRow = Math.round(hen.rowF);
  hen.col = oldCol;
  hen.row = oldRow;
  onKey(dir);
  hen.col = Math.max(
    oldCol - 1,
    Math.min(oldCol + 1, Math.max(0, Math.min(COLS - 1, hen.col)))
  );
  hen.row = Math.max(oldRow - 1, Math.min(oldRow + 1, hen.row));
  if (hen.row < Math.ceil(game.camera)) {
    hen.row = oldRow;
  }
  if (treeAt(hen.col, hen.row)) {
    hen.col = oldCol;
    hen.row = oldRow;
  }
  if (hen.col != oldCol || hen.row != oldRow) {
    hen.hop = 0;
    hen.fx = hen.wx;
    hen.fy = hen.rowF;
    hen.tx = hen.col * CELL;
    hen.ty = hen.row;
    hen.log = null;
  }
}

function updateHen() {
  if (hen.alive && hen.hop >= 0) {
    hen.hop += 1 / HOP_FRAMES;
    var t = Math.min(1, hen.hop);
    hen.wx = hen.fx + (hen.tx - hen.fx) * t;
    hen.rowF = hen.fy + (hen.ty - hen.fy) * t;
    hen.frame = t < 0.2 ? 1 : t < 0.8 ? 2 : 3;
    if (hen.hop >= 1) {
      land();
    }
  } else if (hen.alive) {
    hen.frame = 0;
    rideLog();
  }
  hen.x = Math.round(hen.wx);
  var arc = hen.hop >= 0 ? Math.sin(Math.min(1, hen.hop) * Math.PI) * 14 : 0;
  hen.y = Math.round(rowY(hen.rowF) - arc);
}

function land() {
  hen.hop = -1;
  hen.wx = hen.tx;
  hen.rowF = hen.ty;
  burst(hen.wx + 20, rowY(hen.ty) + 36, '#c9d8b6', 3);
  if (hen.ty > game.score) {
    game.score = hen.ty;
    game.pop = 10;
  }
  var lane = getLane(hen.ty);
  if (lane.type == 'river') {
    hen.log = logUnder(lane);
    if (!hen.log) {
      killHen('water');
    }
  }
}

function logUnder(lane) {
  var cx = hen.wx + CELL / 2;
  for (var i = 0; i < lane.logs.length; i += 1) {
    var l = lane.logs[i];
    if (cx > l.x + 4 && cx < l.x + l.w - 4) {
      return l;
    }
  }
  return null;
}

function rideLog() {
  var lane = getLane(Math.round(hen.rowF));
  if (lane.type != 'river') {
    return;
  }
  var log = logUnder(lane);
  if (!log) {
    killHen('water');
    return;
  }
  hen.wx += log.speed * game.speed;
  if (hen.wx < -CELL / 2 || hen.wx > WIDTH - CELL / 2) {
    killHen('water');
  }
}

// ---- Mise a jour ----
function updateWorld() {
  var top = Math.ceil(game.camera) + ROWS + 1;
  for (var r = Math.floor(game.camera) - 1; r <= top; r += 1) {
    var lane = getLane(r);
    for (var i = 0; i < lane.cars.length; i += 1) {
      var car = lane.cars[i];
      updateCar(car);
      wrap(car);
      if (hen.alive && Math.round(hen.rowF) == car.row) {
        checkCollision(car);
      }
    }
    for (var j = 0; j < lane.logs.length; j += 1) {
      lane.logs[j].x += lane.logs[j].speed * game.speed;
      wrap(lane.logs[j]);
    }
  }
}

function updateCamera() {
  var target = hen.rowF - 4;
  if (target > game.camera) {
    game.camera += (target - game.camera) * 0.12;
  }
  if (game.time > 90) {
    game.camera += Math.min(0.03, 0.012 + game.score * 0.0003);
  }
  if (hen.alive && hen.rowF < game.camera - 0.3) {
    killHen('late');
  }
}

function updateParticles() {
  for (var i = game.particles.length - 1; i >= 0; i -= 1) {
    var p = game.particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.35;
    p.life -= 1;
    if (p.life <= 0) {
      game.particles.splice(i, 1);
    }
  }
}

function update() {
  game.tick += 1;
  if (game.shake > 0) {
    game.shake -= 1;
  }
  if (game.flash > 0) {
    game.flash -= 1;
  }
  if (game.pop > 0) {
    game.pop -= 1;
  }
  updateParticles();
  if (game.state == 'over') {
    game.overT += 1;
  }
  if (game.state != 'playing') {
    return;
  }
  game.time += 1;
  game.speed = Math.min(2.4, game.baseSpeed + game.score * 0.03);
  updateHen();
  updateWorld();
  updateCamera();
  if (!hen.alive) {
    game.deadT += 1;
    if (game.deadT > 24) {
      endGame();
    }
  }
}

function startGame() {
  game.rounds += 1;
  game.seed = game.rounds == 1 ? 3 : Math.floor(Math.random() * 100000);
  game.state = 'playing';
  game.score = 0;
  game.time = 0;
  game.camera = 0;
  game.lanes = {};
  game.particles = [];
  game.skin = 'hen';
  game.baseSpeed = 1;
  game.speed = 1;
  game.newBest = false;
  hen.col = 5;
  hen.row = 0;
  hen.wx = 5 * CELL;
  hen.rowF = 0;
  hen.hop = -1;
  hen.alive = true;
  hen.drowned = false;
  hen.log = null;
  hen.frame = 0;
  customize();
  updateHen();
}

function endGame() {
  game.state = 'over';
  game.overT = 0;
  if (game.score > game.best) {
    game.best = game.score;
    game.newBest = game.score > 0;
  }
}

// ---- Dessin ----
function drawText(text, x, y, size, color, align) {
  ctx.font = 'bold ' + size + 'px Arial, sans-serif';
  ctx.textAlign = align || 'center';
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#1c2b24';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color || '#ffffff';
  ctx.fillText(text, x, y);
}

function drawLane(lane, y) {
  var name = 'lane_grass_' + (lane.row % 2 ? 'b' : 'a');
  if (lane.type == 'road') {
    name = getLane(lane.row + 1).type == 'road' ? 'lane_road' : 'lane_road_end';
  } else if (lane.type == 'river') {
    name = 'lane_water';
  }
  drawSprite(name, 0, y, Math.floor(game.tick / 12));
}

function drawLaneObjects(lane, y) {
  var i;
  for (i = 0; i < lane.trees.length; i += 1) {
    var t = lane.trees[i];
    drawSprite(
      t.kind,
      t.col * CELL,
      y + CELL - (t.kind == 'rock' ? 32 : 56) + 2,
      0
    );
  }
  for (i = 0; i < lane.logs.length; i += 1) {
    drawSprite(
      lane.logs[i].kind,
      lane.logs[i].x,
      y + 6,
      0,
      lane.logs[i].speed < 0
    );
  }
  for (i = 0; i < lane.cars.length; i += 1) {
    var c = lane.cars[i];
    drawCar(c, y);
  }
}

function drawCar(car, y) {
  var h = car.kind == 'truck' ? 38 : 34;
  drawSprite(
    car.kind,
    car.x,
    y + CELL - h,
    Math.floor(game.tick / 4),
    car.dir < 0
  );
}

function drawWorld() {
  var henRow = Math.round(hen.rowF);
  for (
    var r = Math.ceil(game.camera) + ROWS + 1;
    r >= Math.floor(game.camera) - 1;
    r -= 1
  ) {
    var lane = getLane(r);
    var y = rowY(r);
    drawLane(lane, y);
    drawLaneObjects(lane, y);
    if (r == henRow) {
      drawPlayer();
    }
  }
}

function drawParallax() {
  ctx.globalAlpha = 0.16;
  for (var i = 0; i < clouds.length; i += 1) {
    var c = clouds[i];
    var x = ((c.x + game.tick * (0.4 + i * 0.15)) % (WIDTH + 140)) - 120;
    var y = (c.y + game.camera * CELL * (1.1 + i * 0.12)) % (HEIGHT + 100);
    drawSprite('cloud_shadow', x, HEIGHT - y - 20, 0);
  }
  ctx.globalAlpha = 1;
}

function drawParticles() {
  for (var i = 0; i < game.particles.length; i += 1) {
    var p = game.particles[i];
    ctx.fillStyle = p.color;
    ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
  }
}

function drawHud() {
  drawSprite('panel_score', 8, 8, 0);
  var size = game.pop > 0 ? 26 : 20;
  drawText(String(game.score), 40, 32, size, '#ffffff', 'left');
  drawSprite('panel_best', WIDTH - 148, 8, 0);
  drawText(String(game.best), WIDTH - 116, 32, 20, '#ffe27a', 'left');
}

function drawPrompt(text, y) {
  if (Math.floor(game.tick / 15) % 4 === 3) {
    return;
  }
  drawText(text, WIDTH / 2 - 60, y, 20, '#ffffff', 'center');
  drawSprite('key_space', WIDTH / 2 + 28, y - 22, 0);
}

function drawTitle() {
  var t = game.tick;
  ctx.fillStyle = skyGradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  for (var i = 0; i < clouds.length; i += 1) {
    var cx = ((clouds[i].x + t * (0.3 + i * 0.12)) % (WIDTH + 140)) - 110;
    drawSprite(clouds[i].k, cx, clouds[i].y - 10 - i * 8, 0);
  }
  drawSprite('hills_far', -((t * 0.25) % WIDTH), 250, 0);
  drawSprite('hills_far', WIDTH - ((t * 0.25) % WIDTH), 250, 0);
  drawSprite('hills_near', -((t * 0.6) % WIDTH), 310, 0);
  drawSprite('hills_near', WIDTH - ((t * 0.6) % WIDTH), 310, 0);
  drawSprite('lane_grass_a', 0, 360, 0);
  drawSprite('lane_road_end', 0, 400, 0);
  drawSprite('lane_grass_b', 0, 440, 0);
  var carX = ((t * 3) % (WIDTH + 200)) - 120;
  drawSprite('car_red', carX, 406, Math.floor(t / 4));
  drawSprite(
    'truck',
    WIDTH - ((t * 2) % (WIDTH + 260)) + 40,
    402,
    Math.floor(t / 4),
    true
  );
  drawSprite(
    'hen',
    212,
    360 - 8 - Math.abs(Math.sin(t / 9)) * 4,
    Math.floor(t / 9) % 2 ? 0 : 3
  );
  drawLogo(Math.sin(t / 15) * 4);
  drawPrompt(artReadyText('Appuie sur'), 258);
  if (game.best > 0) {
    drawText(
      'Meilleur score : ' + game.best,
      WIDTH / 2,
      306,
      18,
      '#ffe27a',
      'center'
    );
  }
}

function artReadyText(text) {
  return art.ready || art.failed ? text : 'Chargement...';
}

function drawLogo(bob) {
  if (art.ready && !art.failed) {
    drawSprite('logo', 50, 36 + bob, 0);
  } else {
    drawText('CROSSY ROAD', WIDTH / 2, 100 + bob, 52, '#ffc42e', 'center');
  }
}

function drawGameOver() {
  ctx.fillStyle = 'rgba(10, 20, 15, 0.72)';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  if (art.ready && !art.failed) {
    drawSprite('banner_over', 60, 90 + Math.min(game.overT, 12) * 2, 0);
  } else {
    drawText('GAME OVER', WIDTH / 2, 150, 48, '#e63946', 'center');
  }
  drawText('Score : ' + game.score, WIDTH / 2, 240, 30, '#ffffff', 'center');
  drawText('Meilleur : ' + game.best, WIDTH / 2, 278, 22, '#ffe27a', 'center');
  if (game.newBest) {
    drawText('Nouveau record !', WIDTH / 2, 312, 20, '#7dffa0', 'center');
  }
  if (game.overT > 15) {
    drawPrompt('Appuie sur', 370);
  }
}

function drawGame() {
  var sx = game.shake > 0 ? Math.round((Math.random() - 0.5) * 6) : 0;
  var sy = game.shake > 0 ? Math.round((Math.random() - 0.5) * 6) : 0;
  ctx.save();
  ctx.translate(sx, sy);
  drawWorld();
  drawParallax();
  drawParticles();
  ctx.restore();
  if (game.flash > 0) {
    ctx.fillStyle = 'rgba(230, 57, 70, ' + game.flash / 24 + ')';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }
  drawHud();
}

function render() {
  ctx.textBaseline = 'alphabetic';
  if (game.state == 'title') {
    drawTitle();
    return;
  }
  drawGame();
  if (game.state == 'over') {
    drawGameOver();
  }
}

// ---- Entrees clavier ----
var DIRS = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
  a: 'left',
  d: 'right',
  w: 'up',
  s: 'down'
};

document.addEventListener('keydown', function (e) {
  var k = e.key;
  if (k.indexOf('Arrow') === 0 || k == ' ' || k == 'Spacebar') {
    e.preventDefault();
  }
  if (e.repeat || (!art.ready && !art.failed)) {
    return;
  }
  var go = k == ' ' || k == 'Spacebar' || k == 'Enter';
  if (game.state == 'title' && (go || DIRS[k])) {
    startGame();
  } else if (game.state == 'over' && go && game.overT > 15) {
    startGame();
  } else if (game.state == 'playing' && DIRS[k]) {
    tryMove(DIRS[k]);
  }
});

// ---- Boucle (pas fixe de 1/30 s) ----
var lastTime = 0;
var acc = 0;

function loop(now) {
  acc += Math.min(100, now - lastTime);
  lastTime = now;
  while (acc >= STEP) {
    update();
    acc -= STEP;
  }
  render();
  requestAnimationFrame(loop);
}

loadArt();
requestAnimationFrame(function (t) {
  lastTime = t;
  loop(t);
});
