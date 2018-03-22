"use strict";

function onLoad() {
  var canvas = document.getElementById("game-canvas")
  var ctx = canvas.getContext("2d");
  var dim = 512;
  var surface = {canvas: canvas, ctx: ctx, dim: dim}
  canvas.width = dim;
	canvas.height = dim;
  ctx.font = (dim*0.06)+"px DUMMY";
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";

  var game = {targets:
    [ newTarget(2, {x: 0, y: 0})
    , newTarget(3, {x: -0.1, y: 0})
    , newTarget(5, {x: 0, y: -0.1})
    , newTarget(2*3*5*7*11, {x: 0.2, y: 0.1})]
    };

  timer(game, surface);
}

function timer(game, surface) {
  tick(game);
  draw(surface, game);

  setTimeout(function() {timer(game, surface);}, 30);
}

function tick(g) {
  var tars = g.targets;
  for (var i=0; i<tars.length; i++) {
    var tar = tars[i];
    tar.flashPhase += 0.1;
    while (tar.flashPhase >= tar.primeFactors.length) {
      tar.flashPhase -= tar.primeFactors.length;
    }
  }
}

function newTarget(value, pos) {
  var primes = primeFactors(value);
  return (
    { value: value
    , primeFactors: primes
    , isPrime: primes.length==1
    , pos: pos
    , flashPhase: 0 } );
}

function primeFactors(n) {
  var ps = [];
  var p = 1;
  while (n>1) {
    p += 1;
    if (n % p == 0) {
      ps.push(p);
      n = n/p;
      p = 1;
    }
  }
  return ps;
}

function draw(s, g) {
  s.ctx.fillStyle = toRGBAString([0.15, 0.15, 0.15, 1]);
  s.ctx.fillRect(0, 0, s.dim, s.dim);

  for (var i=0; i<g.targets.length; i++) {
    drawTarget(s, g.targets[i]);
  }

  // hueColorTest(s, 100);
}

function hueColorTest(s, n) {
  var d = s.dim;
  for (var i=0; i<n; i++) {
    s.ctx.fillStyle = toRGBAString(colorFromHue(i/n));
    s.ctx.fillRect(d/n*i, 0, d/n, d/8);
  }
}

function drawTarget(s, tar) {
  if (tar.isPrime) {
    var color = primeColor(tar.value);
    spotlightAt(s, tar.pos, 0.1, withAlpha(color, 0.3));

    s.ctx.fillStyle = toRGBAString(mixColors(color, white, 0.2));
    textAt(s, tar.pos, tar.value);
  }
  else {
    var i = Math.floor(tar.flashPhase);
    var t = tar.flashPhase - i;
    var lightRadius = 0.07 + 0.03*Math.sin(t*Math.PI);
    var color = primeColor(tar.primeFactors[i]);

    spotlightAt(s, tar.pos, lightRadius, color);

    s.ctx.fillStyle = toRGBAString(white);
    textAt(s, tar.pos, tar.value);
  }
}

function spotlightAt(s, pos, radius, color) {
  var xy = toPixelPos(s, pos);
  var r = toPixelLength(s, radius);
  var transparent = withAlpha(color, 0);

  var grad =
    s.ctx.createRadialGradient(xy[0], xy[1], 0, xy[0], xy[1], r);
  grad.addColorStop(0, toRGBAString(color));
  grad.addColorStop(1, toRGBAString(transparent));
  s.ctx.fillStyle = grad;
  s.ctx.fillRect(xy[0]-r, xy[1]-r, xy[0]+r, xy[1]+r);
}

function textAt(s, pos, text) {
  var xy = toPixelPos(s, pos);
  s.ctx.fillText(text, xy[0], xy[1]);
}

function toPixelPos(s, pos) {
  return [(pos.x+0.5)*s.dim, (pos.y+0.5)*s.dim];
}
function toPixelLength(s, l) {
  return l*s.dim;
}

function primeColor(p) {
  var hue = p*goldenRatio;
  hue = hue - Math.floor(hue);
  return colorFromHue(hue);
}

var goldenRatio = (1 + Math.sqrt(5)) / 2

// 0 <= hue < 1
function colorFromHue(hue) {
  var cs =
    [ [1, 0, 0, 1]
    , [1, 1, 0, 1]
    , [0, 1, 0, 1]
    , [0, 1, 1, 1]
    , [0, 0, 1, 1]
    , [1, 0, 1, 1]
    , [1, 0, 0, 1]
    ];
  var n = cs.length - 1;
  var i = Math.floor(n*hue);
  var t = n*hue - i;
  return mixColors(cs[i], cs[i+1], t);
}

var white = [1, 1, 1, 1];
var black = [0, 0, 0, 1];

function mixColors(c1, c2, t) {
  var c = [0, 0, 0, 0]
  for (var i=0; i<4; i++) {
    c[i] = (1-t)*c1[i] + t*c2[i];
  }
  return c;
}
function withAlpha(c, alpha) {
  return [c[0], c[1], c[2], alpha];
}

function toRGBAString(color) {
  return ("rgba("+color[0]*255+", "+color[1]*255+", "+color[2]*255+
    ", "+color[3]+")");
}
