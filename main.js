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

  var game = {nonPrimes: [newNonPrime(9230, {x: 0, y: 0})]};

  timer(game, surface);
}

function timer(game, surface) {
  tick(game);
  draw(surface, game);

  setTimeout(function() {timer(game, surface);}, 30);
}

function tick(g) {
  var ns = g.nonPrimes;
  for (var i=0; i<ns.length; i++) {
    var n = ns[i];
    n.flashPhase += 0.1;
    while (n.flashPhase >= n.primeFactors.length) {
      n.flashPhase -= n.primeFactors.length;
    }
  }
}

function newNonPrime(value, pos) {
  return { value: value, primeFactors: primeFactors(value)
         , pos: pos, flashPhase: 0 };
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
  s.ctx.fillStyle = toRGBString([0.15, 0.15, 0.15]);
  s.ctx.fillRect(0, 0, s.dim, s.dim);

  for (var i=0; i<g.nonPrimes.length; i++) {
    drawNonPrime(s, g.nonPrimes[i]);
  }
}

function drawNonPrime(s, n) {
  var i = Math.floor(n.flashPhase);
  var t = n.flashPhase - i;
  var lightRadius = 0.04 + 0.06*Math.sin(t*Math.PI);
  var color = primeColor(n.primeFactors[i]);

  spotlightAt(s, n.pos, lightRadius, color);

  s.ctx.fillStyle = toRGBString(white);
  textAt(s, n.pos, n.value);
}

function spotlightAt(s, pos, radius, color) {
  var xy = toPixelPos(s, pos);
  var r = toPixelLength(s, radius);
  var transparent = [color[0], color[1], color[2], 0]

  var grad =
    s.ctx.createRadialGradient(xy[0], xy[1], 0, xy[0], xy[1], r);
  grad.addColorStop(0, toRGBString(color));
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
  var hue = p*goldenAngle;
  hue = hue - Math.floor(hue);
  return colorFromHue(hue);
}

var goldenAngle = 2*Math.PI/((1+Math.sqrt(5))/2);

// 0 <= hue < 1
function colorFromHue(hue) {
  var cs =
    [ [1, 0, 0]
    , [1, 1, 0]
    , [0, 1, 0]
    , [0, 1, 1]
    , [0, 0, 1]
    , [1, 0, 1]
    , [1, 0, 0]
    ];
  var n = cs.length - 1;
  var i = Math.floor(n*hue);
  var t = n*hue - i;
  return mixColors(cs[i], cs[i+1], t);
}

var white = [1, 1, 1];
var black = [0, 0, 0];

function mixColors(c1, c2, t) {
  var c = [0, 0, 0]
  for (var i=0; i<3; i++) {
    c[i] = (1-t)*c1[i] + t*c2[i];
  }
  return c;
}

function toRGBString(color) {
  return "rgb("+color[0]*255+", "+color[1]*255+", "+color[2]*255+")";
}
function toRGBAString(color) {
  return ("rgba("+color[0]*255+", "+color[1]*255+", "+color[2]*255+
    ", "+color[3]+")");
}
