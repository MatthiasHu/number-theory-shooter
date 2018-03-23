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

  var game =
    { targets: []
    , newTargets: []
    , spawningTargets: []
    , spawning: {phase: 0, nextValue: 2}
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
  var stars = g.spawningTargets;

  for (var i=0; i<tars.length; i++) {
    var tar = tars[i];
    tar.flashPhase += 0.1232;
    while (tar.flashPhase >= tar.primeFactors.length) {
      tar.flashPhase -= tar.primeFactors.length;
    }
  }

  for (var i=0; i<stars.length; i++) {
    var star = stars[i];
    star.flashPhase += 0.13;
    while (star.flashPhase >= 1) {
      star.flashPhase -= 1;
    }
    star.age += 1;
    if (star.age >= 30) {
      star.delete = true;
      newTarget(g, star.value, star.pos);
    }
  }

  // target-target collisions
  for (var i=0; i<tars.length; i++) {
    var tar1 = tars[i];
    if (tar1.delete == true) continue;
    for (var j=i+1; j<tars.length; j++) {
      var tar2 = tars[j];
      if (tar2.delete == true) continue;
      if (dist(tar1.pos, tar2.pos) <= 0.18) {
        mergeTargets(g, tar1, tar2);
      }
    }
  }

  g.spawning.phase += 0.05;
  if (g.spawning.phase >= 1) {
    g.spawning.phase -= 1;
    newSpawningTarget(g, g.spawning.nextValue, randomPos());
    g.spawning.nextValue += 1;
  }

  purgeList(tars);
  purgeList(stars);

  g.targets = tars.concat(g.newTargets);
  g.newTargets = [];
}

function newTarget(g, value, pos) {
  var primes = primeFactors(value);
  g.newTargets.push(
    { value: value
    , primeFactors: primes
    , isPrime: primes.length==1
    , pos: pos
    , flashPhase: 0 } );
}
function newSpawningTarget(g, value, pos) {
  g.spawningTargets.push(
    { value: value
    , pos: pos
    , flashPhase: 0
    , age: 0 } );
}

function mergeTargets(g, tar1, tar2) {
  console.log("merge");
  tar1.delete = true;
  tar2.delete = true;
  newTarget(g, tar1.value+tar2.value, centerPos(tar1.pos, tar2.pos));
}

function randomPos() {
  return {x: Math.random(), y: Math.random()};
}
function centerPos(p1, p2) {
  return {x: (p1.x+p2.x)/2, y: (p1.y+p2.y)/2};
}

function dist(p1, p2) {
  return Math.sqrt((p1.x-p2.x)*(p1.x-p2.x) + (p1.y-p2.y)*(p1.y-p2.y));
}

function purgeList(l) {
  for (var i=0; i<l.length; i++) {
    if (l[i].delete == true) {
      l.splice(i, 1);
      i--;
    }
  }
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
  for (var i=0; i<g.spawningTargets.length; i++) {
    drawSpawningTarget(s, g.spawningTargets[i]);
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
function drawSpawningTarget(s, star) {
  if (star.flashPhase <= 0.5) {
    s.ctx.fillStyle = toRGBAString(white);
    textAt(s, star.pos, star.value);
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
  s.ctx.fillRect(xy[0]-r, xy[1]-r, 2*r, 2*r);
}

function textAt(s, pos, text) {
  var xy = toPixelPos(s, pos);
  s.ctx.fillText(text, xy[0], xy[1]);
}

function toPixelPos(s, pos) {
  return [pos.x*s.dim, pos.y*s.dim];
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
