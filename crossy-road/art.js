// art.js - NE PAS MODIFIER CE FICHIER.
// Charge les images du jeu (assets/atlas.js + feuilles PNG) et dessine les sprites.
// Les enfants n'appellent jamais drawSprite : ils utilisent les fonctions du moteur
// (drawHen, drawCar...). Si une image ne charge pas, le jeu dessine des formes simples.

var art = { images: [], loaded: 0, ready: false, failed: false };

function loadArt() {
  if (typeof ATLAS === 'undefined') {
    art.failed = true;
    return;
  }
  var total = ATLAS.sheets.length;
  for (var i = 0; i < total; i += 1) {
    var img = new Image();
    img.onload = function () {
      art.loaded += 1;
      if (art.loaded == total) {
        art.ready = true;
      }
    };
    img.onerror = function () {
      art.failed = true;
    };
    img.src = 'assets/' + ATLAS.sheets[i];
    art.images.push(img);
  }
}

// Nombre d'images de l'animation d'un sprite (1 si pas d'animation).
function spriteFrames(name) {
  return (typeof ATLAS !== 'undefined' && ATLAS.anims[name]) || 1;
}

// Rectangle [x, y, w, h, feuille] d'une image, ou null si le nom est inconnu.
function spriteRect(name, frame) {
  if (typeof ATLAS === 'undefined') {
    return null;
  }
  var n = spriteFrames(name);
  var f = Math.floor(frame || 0) % n;
  if (f < 0) {
    f += n;
  }
  return ATLAS.frames[n > 1 ? name + '_' + f : name] || null;
}

// Dessine le sprite `name` (image numero `frame`) avec son coin haut-gauche en (x, y).
// flip = true le retourne de gauche a droite. Renvoie false si on a du dessiner une forme simple.
function drawSprite(name, x, y, frame, flip) {
  var r = spriteRect(name, frame);
  x = Math.round(x);
  y = Math.round(y);
  if (!art.ready || art.failed || !r) {
    drawFallback(name, x, y, r);
    return false;
  }
  var img = art.images[r[4]];
  if (flip) {
    ctx.save();
    ctx.translate(x + r[2], y);
    ctx.scale(-1, 1);
    ctx.drawImage(img, r[0], r[1], r[2], r[3], 0, 0, r[2], r[3]);
    ctx.restore();
  } else {
    ctx.drawImage(img, r[0], r[1], r[2], r[3], x, y, r[2], r[3]);
  }
  return true;
}

// Plan B : un rectangle (ou une ellipse) de la couleur du sprite, avec un contour.
function drawFallback(name, x, y, r) {
  var fb = (typeof ATLAS !== 'undefined' && ATLAS.fb[name]) || [
    '#888888',
    'rect'
  ];
  var w = r ? r[2] : 40;
  var h = r ? r[3] : 40;
  ctx.fillStyle = fb[0];
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.lineWidth = 2;
  if (fb[1] == 'ellipse') {
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2);
    ctx.scale(w / 2, h / 2);
    ctx.beginPath();
    ctx.arc(0, 0, 1, 0, Math.PI * 2);
    ctx.restore();
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  }
}
