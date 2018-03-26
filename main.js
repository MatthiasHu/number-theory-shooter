"use strict";

function onLoad() {
  var canvas = document.getElementById("game-canvas")
  var ctx = canvas.getContext("2d");
  var dim = 800;
  var surface =
    { canvas: canvas
    , ctx: ctx
    , dim: dim
    , center: {x: 0, y: 0}
    };
  canvas.width = dim;
  canvas.height = dim;
  ctx.font = (dim*0.06)+"px DUMMY";
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";

  var game = startGame();

  var input =
    { keysDown: {}
    , keyCodes:
      { up: 87       // 87 is W
      , down: 83     // 83 is S
      , left: 65     // 65 is A
      , right: 68    // 68 is D
      , restart: 13  // 13 is Enter
      }
    , clicks: []
    };

  var state = {game: game, surface: surface, input: input};

  document.addEventListener("keydown",
    function(e) {onKeyDown(state, e);} );
  document.addEventListener("keyup",
    function(e) {onKeyUp(state, e);} );
  canvas.addEventListener("mousedown",
    function(e) {onMouseDown(state, e);} );

  timer(state);
}

function startGame() {
  return (
    { targets: []
    , newTargets: []
    , spawningTargets: []
    , spawning: {phase: 0, nextValue: 2}
    , me:
      { pos: {x: Math.random(), y: Math.random()}
      , v: {x: 0, y: 0}
      , radius: 0.04
      , lives: 3
      , ammo: []
      }
    , deathIndicator: {phase: -1, intensity: 0}
    , bullets: []
    , newBullets: []
    , bonuses: []
    , newBonuses: []
    , fadingAmmos: []
    , newFadingAmmos: []
    , gameOver: false
    , gameOverAge: 0
    } );
}

function onKeyDown(state, e) {
  state.input.keysDown[e.keyCode] = true;
}
function onKeyUp(state, e) {
  state.input.keysDown[e.keyCode] = false;
}
function onMouseDown(state, e) {
  var g = state.game;
  var s = state.surface;
  if (e.button==0) {
    // save click position relative to me.pos
    var p = fromPixelPos(s, [e.offsetX, e.offsetY]);
    p = normalizePos(diffPos(s.center, p));
    var mp = normalizePos(diffPos(s.center, g.me.pos));
    state.input.clicks.push(diffPos(mp, p));
  }
}

function timer(state) {
  var g = state.game;
  var s = state.surface;
  var input = state.input;

  if (g.gameOver==true && input.keysDown[input.keyCodes.restart]) {
    state.game = startGame();
    g = state.game;
  }

  tick(g, input);
  s.center = lerp(s.center, g.me.pos, 0.1);
  draw(s, g);

  setTimeout(function() {timer(state);}, 30);
}

function tick(g, input) {
  var tars = g.targets;
  var stars = g.spawningTargets;
  var bulls = g.bullets;
  var bons = g.bonuses;
  var fammos = g.fadingAmmos;

  g.me.v = addPos(g.me.v, scalePos(inputMovement(input), 0.01));
  g.me.v = scalePos(g.me.v, 0.7);
  g.me.pos = addPos(g.me.pos, g.me.v);

  input.clicks.forEach(function(v) {shoot(g, v);});
  input.clicks = [];

  g.deathIndicator.intensity *= 0.8;
  g.deathIndicator.phase *= -1;

  tars.forEach(function(tar) {
    tar.flashPhase += 0.1232;
    while (tar.flashPhase >= tar.primeFactors.length) {
      tar.flashPhase -= tar.primeFactors.length;
    }
    var d = normalizePos(diffPos(g.me.pos, tar.pos));
    var dl = lengthPos(d);
    if (dl < 0.4 && dl > tar.radius+g.me.radius) {
      tar.v = addPos(tar.v, scalePos(d, -0.00001/dl/dl/dl));
    }
    tar.pos = addPos(tar.pos, tar.v);
    tar.v = scalePos(tar.v, 0.98);
  });

  stars.forEach(function(star) {
    star.flashPhase += 0.13;
    star.flashPhase -= Math.floor(star.flashPhase);
    star.age += 1;
    if (star.age >= 30) {
      star.delete = true;
      newTarget(g, star.value, star.pos);
    }
  });

  bulls.forEach(function(bull) {
    bull.pos = addPos(bull.pos, bull.v);
    bull.age += 1;
    if (bull.age >= 100) {
      bull.delete = true;
    }
  });

  bons.forEach(function(bon) {
    bon.colorPhase += 0.002;
    bon.colorPhase -= Math.floor(bon.colorPhase);
  });

  fammos.forEach(function(fammo) {
    fammo.pos = addPos(fammo.pos, fammo.v);
    fammo.age += 0.05;
    if (fammo.age >= 1) {
      fammo.delete = true;
    }
  });

  // target-bullet collisions
  bulls.forEach(function(bull) {
    tars.forEach(function(tar) {
      if (    colliding(bull, tar)
           && bull.value <= tar.primeFactors.length
         ) {
        bull.delete = true;
        explodeTarget(g, tar, bull.value);
      }
    });
  });

  // target-target collisions
  for (var i=0; i<tars.length; i++) {
    var tar1 = tars[i];
    if (tar1.delete == true) continue;
    for (var j=i+1; j<tars.length; j++) {
      var tar2 = tars[j];
      if (colliding(tar1, tar2)) {
        mergeTargets(g, tar1, tar2);
      }
    }
  }

  // target-me collisions
  tars.forEach(function(tar) {
    if (colliding(g.me, tar)) {
      if (tar.isPrime) {
        tar.delete = true;
        g.me.ammo.push(tar.value);
      }
      else {
        g.me.lives -= 1;
        if (g.me.lives <= 0) {
          g.gameOver = true;
        }
        g.deathIndicator.intensity = 1;
        var v = normalizePos(diffPos(g.me.pos, tar.pos));
        g.me.v = addPos(g.me.v, scalePos(v, -0.02/lengthPos(v)));
        explodeTarget(g, tar, tar.primeFactors.length);
      }
    }
  });

  // bullet-me collisions
  bulls.forEach(function(bull) {
    if (colliding(bull, g.me)) {
      bull.delete = true;
      g.me.v = addPos(g.me.v, scalePos(bull.v, 0.8));
      for (var i=0; i<bull.value; i++) {
        dropAmmo(g);
      }
    }
  });

  // bonus-me collisions
  bons.forEach(function(bon) {
    if (colliding(bon, g.me)) {
      bon.delete = true;
      if (g.me.lives < 3) {g.me.lives += 1;}
    }
  });

  if (g.gameOver==true) {
    g.gameOverAge += 1;
  }
  else {
    g.spawning.phase += 0.01;
  }
  if (g.spawning.phase >= 1) {
    g.spawning.phase -= 1;
    newSpawningTarget(g, g.spawning.nextValue, randomPos());
    g.spawning.nextValue += 1;
  }

  purgeList(tars);
  purgeList(stars);
  purgeList(bulls);
  purgeList(bons);
  purgeList(fammos);

  g.targets = tars.concat(g.newTargets);
  g.newTargets = [];
  g.bullets = bulls.concat(g.newBullets);
  g.newBullets = [];
  g.bonuses = bons.concat(g.newBonuses);
  g.newBonuses = [];
  g.fadingAmmos = fammos.concat(g.newFadingAmmos);
  g.newFadingAmmos = [];
}

function inputMovement(input) {
  var k = input.keysDown;
  var c = input.keyCodes;
  return (
    { x: (k[c.left]==true ? -1 : 0) + (k[c.right]==true ? 1 : 0)
    , y: (k[c.up  ]==true ? -1 : 0) + (k[c.down ]==true ? 1 : 0)
    } );
}

function shoot(g, v) {
  var l = lengthPos(v);
  if (l > 0.001 && g.me.ammo.length>0) {
    v = scalePos(v, 1/l);
    newBullet(g, g.me.ammo.pop(), g.me.pos, scalePos(v, 0.06));
  }
}

function newTarget(g, value, pos, v={x:0, y:0}) {
  var primes = primeFactors(value);
  g.newTargets.push(
    { value: value
    , primeFactors: primes
    , isPrime: primes.length==1
    , pos: pos
    , v: {x:v.x, y:v.y}
    , radius: 0.06
    , flashPhase: 0 } );
}
function newSpawningTarget(g, value, pos) {
  g.spawningTargets.push(
    { value: value
    , pos: pos
    , flashPhase: 0
    , age: 0 } );
}
function newBullet(g, value, pos, v) {
  g.newBullets.push(
    { value: value
    , pos: pos
    , v: v
    , radius: 0.04
    , age: 0
    , angle: Math.atan2(v.y, v.x) } );
}
function newBonus(g, pos) {
  g.newBonuses.push(
    { pos: pos
    , v: {x:0, y:0}
    , radius: 0.01
    , colorPhase: 0
    } );
}
function newFadingAmmo(g, value, pos) {
  g.newFadingAmmos.push(
    { value: value
    , pos: pos
    , v: scalePos(circlePos(Math.random()*2*Math.PI), 0.01)
    , age: 0 } );
}

function colliding(a, b) {
  var d = normalizePos(diffPos(a.pos, b.pos));
  var dl = lengthPos(d);
  return (
       !(a.delete==true) && !(b.delete==true)
    && dl < a.radius+b.radius
    && dotPos(diffPos(a.v, b.v), scalePos(d, 1/dl)) < 0.001
    );
}

function explodeTarget(g, tar, k) {
  tar.delete = true;

  var ps = tar.primeFactors;
  shuffleArray(ps);
  var factors = [];
  for (var i=0; i<k; i++) {
    factors.push(ps[i]);
  }
  for (var i=k; i<ps.length; i++) {
    factors[Math.floor(Math.random()*k)] *= ps[i];
  }

  var alpha = Math.random()*2*Math.PI;
  function vel(i) {
    return scalePos(circlePos(alpha + i/k*2*Math.PI), 0.015);
  }
  factors.forEach(function(value, i) {
    newTarget(g, value, tar.pos, addPos(tar.v, vel(i)), 1);
  });
}
function mergeTargets(g, tar1, tar2) {
  tar1.delete = true;
  tar2.delete = true;
  var pos = lerp(tar1.pos, tar2.pos, 0.5);
  if (    tar1.isPrime==true
       && tar2.isPrime==true
       && Math.abs(tar2.value-tar1.value)==2
     ) {
    newBonus(g, pos);
  }
  else {
    newTarget(g, tar1.value+tar2.value, pos, lerp(tar1.v, tar2.v, 0.5));
  }
}

function dropAmmo(g) {
  if (g.me.ammo.length > 0) {
    var value = g.me.ammo.pop();
    newFadingAmmo(g, value, g.me.pos);
  }
}

function shuffleArray(a) {
  for (var i=a.length-1; i>0; i--) {
    var j = Math.floor(Math.random()*(i+1));
    var tmp = a[i];
    a[i] = a[j];
    a[j] = tmp;
  }
}

function randomPos() {
  return {x: Math.random()-0.5, y: Math.random()-0.5};
}
function circlePos(alpha) {
  return {x: Math.cos(alpha), y: -Math.sin(alpha)};
}
function addPos(pos, v) {
  return {x: pos.x+v.x, y: pos.y+v.y};
}
function scalePos(v, s) {
  return {x: v.x*s, y: v.y*s};
}
function diffPos(p1, p2) {
  return {x: p2.x-p1.x, y: p2.y-p1.y};
}
function lerp(p1, p2, t) {
  var d = normalizePos(diffPos(p1, p2));
  return addPos(p1, scalePos(d, t));
}
function dist(p1, p2) {
  return lengthPos(normalizePos(diffPos(p1, p2)));
}
function normalizePos(pos) {
  return ( { x: pos.x-Math.floor(pos.x+0.5)
           , y: pos.y-Math.floor(pos.y+0.5) } );
}
function lengthPos(v) {
  return Math.sqrt(v.x*v.x + v.y*v.y);
}
function dotPos(v1, v2) {
  return v1.x*v2.x + v1.y*v2.y;
}

function normalizedPoses(pos) {
  var npos = normalizePos(pos);
  var x = npos.x, y = npos.y;
  var xx = x>0 ? x-1 : x+1;
  var yy = y>0 ? y-1 : y+1;
  return (
    [ {x: x , y: y }
    , {x: x , y: yy}
    , {x: xx, y: y }
    , {x: xx, y: yy} ] );
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
    while (n % p == 0) {
      ps.push(p);
      n = n/p;
    }
  }
  return ps;
}

function draw(s, g) {
  drawBackground(s, g);

  g.bonuses.forEach(function(bon) {
    drawBonus(s, bon);
  });

  g.targets.forEach(function(tar) {
    drawTarget(s, tar);
  });

  g.spawningTargets.forEach(function(star) {
    drawSpawningTarget(s, star);
  });

  g.bullets.forEach(function(bull) {
    drawBullet(s, bull);
  });

  drawMe(s, g.me);

  g.fadingAmmos.forEach(function(fammo) {
    drawFadingAmmo(s, fammo);
  });

  drawLives(s, g.me.lives);

  // hueColorTest(s, 100);
}

function hueColorTest(s, n) {
  var d = s.dim;
  for (var i=0; i<n; i++) {
    s.ctx.fillStyle = toRGBAString(colorFromHue(i/n));
    s.ctx.fillRect(d/n*i, 0, d/n, d/8);
  }
}

function drawBackground(s, g) {
  var high = 1.0, middle = 0.15, low = 0;
  var i = g.deathIndicator.intensity;
  var bg = (1-i)*middle + i*(g.deathIndicator.phase>0 ? high : low);
  s.ctx.fillStyle = toRGBAString(grey(bg));
  s.ctx.fillRect(0, 0, s.dim, s.dim);

  s.ctx.strokeStyle = toRGBAString(grey(0.3));
  lineAt(s, {x: 0, y:0}, {x:  0.5, y:  0.5});
  lineAt(s, {x: 0, y:0}, {x:  0.5, y: -0.5});
  lineAt(s, {x: 0, y:0}, {x: -0.5, y:  0.5});

  if (g.gameOver==true) {
    var a1 = Math.max(0, Math.min(1, g.gameOverAge/100));
    var a2 = Math.max(0, Math.min(1, (g.gameOverAge-200)/100));
    s.ctx.fillStyle = toRGBAString([0.4, 0, 0, a1]);
    textAt(s, {x: -0.3, y: -0.3}, "Game Over", 3, -2*Math.PI/8);
    s.ctx.fillStyle = toRGBAString([0.4, 0, 0, a2]);
    textAt(s, {x: -0.2, y: -0.2},
      "press Enter to restart", 0.5, -2*Math.PI/8);
  }
}
function drawBonus(s, bon) {
  var color = colorFromHue(bon.colorPhase);
  spotlightAt(s, bon.pos, 0.1, withAlpha(color, 0.2));
  spotlightAt(s, bon.pos, 0.04, withAlpha(black, 0.6));
  s.ctx.fillStyle = toRGBAString([1, 0, 0, 1]);
  filledCircleAt(s, bon.pos, 0.01);
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
function drawBullet(s, bull) {
  s.ctx.fillStyle = toRGBAString(white);
  textAt(s, bull.pos, bull.value, 1, bull.angle+Math.PI/2);
}
function drawFadingAmmo(s, fammo) {
  s.ctx.fillStyle = toRGBAString(withAlpha(white, 1-fammo.age));
  textAt(s, fammo.pos, fammo.value, 0.5);
}
function drawMe(s, me) {
  spotlightAt(s, me.pos, 0.06, white);
  s.ctx.fillStyle = toRGBAString(grey(0.1));
  filledCircleAt(s, me.pos, 0.05);
  s.ctx.strokeStyle = toRGBAString(grey(0.2));
  circleAt(s, me.pos, 0.03);

  s.ctx.fillStyle = toRGBAString(white);
  var n = me.ammo.length;
  if (n > 0) {
    textAt(s, me.pos, me.ammo[n-1], 0.75);
  }
  function f(k) {return 1 - (1/(1 + 0.1*k));}
  for (var i=1; i<n; i++) {
    var t = f(i-1);
    var dt = f(i) - t;
    var pos = scalePos(circlePos(t*2*Math.PI), 0.04);
    var scale = dt * 6;
    textAt(s, addPos(me.pos, pos), me.ammo[n-1-i], scale);
  }
}
function drawLives(s, n) {
  s.ctx.fillStyle = toRGBAString([1, 0, 0, 1]);
  for (var i=0; i<n; i++) {
    s.ctx.beginPath();
    s.ctx.arc((0.03*(i+1))*s.dim, 0.03*s.dim, 0.01*s.dim, 0, 2*Math.PI);
    s.ctx.fill();
  }
}

function lineAt(s, pos, v) {
  toPixelPoses(s, pos).forEach(function(xy) {
    s.ctx.beginPath();
    s.ctx.moveTo(xy[0], xy[1]);
    s.ctx.lineTo( xy[0] + toPixelLength(s, v.x)
                , xy[1] + toPixelLength(s, v.y) );
    s.ctx.stroke();
  });
}
function spotlightAt(s, pos, radius, color) {
  var xys = toPixelPoses(s, pos);
  var r = toPixelLength(s, radius);
  var transparent = withAlpha(color, 0);

  xys.forEach(function(xy) {
    var grad =
      s.ctx.createRadialGradient(xy[0], xy[1], 0, xy[0], xy[1], r);
    grad.addColorStop(0, toRGBAString(color));
    grad.addColorStop(1, toRGBAString(transparent));
    s.ctx.fillStyle = grad;
    s.ctx.fillRect(xy[0]-r, xy[1]-r, 2*r, 2*r);
  });
}
function textAt(s, pos, text, scale=1, angle=0) {
  var xys = toPixelPoses(s, pos);
  xys.forEach(function(xy) {
    s.ctx.save();
    s.ctx.translate(xy[0], xy[1]);
    s.ctx.scale(scale, scale);
    s.ctx.rotate(angle);
    s.ctx.fillText(text, 0, 0);
    s.ctx.restore();
  });
}
function circleAt(s, pos, radius) {
  var xys = toPixelPoses(s, pos);
  var r = toPixelLength(s, radius);
  xys.forEach(function(xy) {
    s.ctx.beginPath();
    s.ctx.arc(xy[0], xy[1], r, 0, 2*Math.PI);
    s.ctx.stroke();
  });
}
function filledCircleAt(s, pos, radius) {
  var xys = toPixelPoses(s, pos);
  var r = toPixelLength(s, radius);
  xys.forEach(function(xy) {
    s.ctx.beginPath();
    s.ctx.arc(xy[0], xy[1], r, 0, 2*Math.PI);
    s.ctx.fill();
  });
}

function toPixelPoses(s, pos) {
  var nps = normalizedPoses(diffPos(s.center, pos));
  return nps.map(
    function(p) {return [(p.x+0.5)*s.dim, (p.y+0.5)*s.dim];} );
}
function toPixelLength(s, l) {
  return l*s.dim;
}
function fromPixelPos(s, xy) {
  return addPos(s.center, { x: xy[0]/s.dim - 0.5
                          , y: xy[1]/s.dim - 0.5 });
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
function grey(s) {
  return [s, s, s, 1];
}

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
