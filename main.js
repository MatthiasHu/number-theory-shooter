"use strict";

function onLoad() {
  var canvas = document.getElementById("game-canvas")
  var ctx = canvas.getContext("2d");

  var surface =
    { canvas: canvas
    , ctx: ctx
    , dim: 0
    , center: {x: 0, y: 0}
    };

  adjustSize(surface);

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
    , gettingKeyEvents: false
    , haveRecentAcceleration: false
    , acceleration: {x:0, y:0, z:0}
    };

  var state = {game: game, surface: surface, input: input};

  document.addEventListener("keydown",
    function(e) {onKeyDown(state, e);} );
  document.addEventListener("keyup",
    function(e) {onKeyUp(state, e);} );
  canvas.addEventListener("mousedown",
    function(e) {onMouseDown(state, e);} );
  window.addEventListener("devicemotion",
    function(e) {onDeviceMotion(state, e);} );
  window.addEventListener("resize",
    function(e) {adjustSize(state.surface);} );

  timer(state);
}

function adjustSize(surface) {
  var dim = Math.min(window.innerWidth, window.innerHeight)*0.95;
  surface.dim = dim;
  surface.canvas.width = dim;
  surface.canvas.height = dim;
  surface.ctx.font = (surface.dim*0.06)+"px DUMMY";
  surface.ctx.textBaseline = "middle";
  surface.ctx.textAlign = "center";
}

function startGame() {
  return (
    { targets: {current: [], issued: []}
    , twinConnections: []
    , spawningTargets: {current: [], issued: []}
    , spawning: {phase: 0, nextValue: 2}
    , me:
      { pos: {x: Math.random(), y: Math.random()}
      , v: {x: 0, y: 0}
      , radius: 0.04
      , lives: 3
      , ammo: []
      , collectedGems: {current: 0, max: 0, colorPhase: 0}
      }
    , deathIndicator:
      { phase: -1
      , hue: 0
      , blackWhiteIntensity: 0
      , colorIntensity: 0
      }
    , bullets: {current: [], issued: []}
    , bonuses: {current: [], issued: []}
    , antiBullets: {current: [], issued: []}
    , fadingAmmos: {current: [], issued: []}
    , gameOver: false
    , gameOverAge: 0
    , assumeMobile: true
    } );
}

function onKeyDown(state, e) {
  state.input.gettingKeyEvents = true;
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
function onDeviceMotion(state, e) {
  if (state.input.haveRecentAcceleration==true) return;
  state.input.haveRecentAcceleration = true;

  var acc = e.accelerationIncludingGravity;
  acc = {x: acc.x, y: acc.y, z: acc.z};
  if (screen.orientation) {
    var a = 2*Math.PI/360 * screen.orientation.angle;
    acc = { x: Math.cos(a)*acc.x - Math.sin(a)*acc.y
          , y: Math.sin(a)*acc.x + Math.cos(a)*acc.y
          , z: acc.z};
  }
  state.input.acceleration = acc;
}

function timer(state) {
  var g = state.game;
  var s = state.surface;
  var input = state.input;

  g.assumeMobile = !input.gettingKeyEvents;

  if ( g.gameOver==true
       && (    input.keysDown[input.keyCodes.restart]
            || (    g.assumeMobile
                 && input.clicks.length > 0
                 && g.gameOverAge > 100 ) )
     ) {
    state.game = startGame();
    g = state.game;
  }

  tick(g, input);
  s.center = lerp(s.center, g.me.pos, 0.1);
  draw(s, g);

  input.haveRecentAcceleration = false;

  setTimeout(function() {timer(state);}, 30);
}

function tick(g, input) {
  var tars = g.targets.current;
  var stars = g.spawningTargets.current;
  var bulls = g.bullets.current;
  var bons = g.bonuses.current;
  var abulls = g.antiBullets.current;
  var fammos = g.fadingAmmos.current;

  g.me.v = addPos(g.me.v, scalePos(inputMovement(input), 0.01));
  g.me.v = scalePos(g.me.v, 0.7);
  g.me.pos = addPos(g.me.pos, g.me.v);

  input.clicks.forEach(function(v) {shoot(g, v);});
  input.clicks = [];

  g.deathIndicator.blackWhiteIntensity *= 0.8;
  g.deathIndicator.colorIntensity *= 0.8;
  g.deathIndicator.phase *= -1;
  g.deathIndicator.hue += 0.13;
  g.deathIndicator.hue %= 1;

  g.me.collectedGems.colorPhase += 0.02;

  var twinConnections = [];
  tars.forEach(function(tar) {
    if (tar.isPrime==true && tar.twins[1]==true) {
      tars.forEach(function(twin) {
        if (twin.value == tar.value + 2) {
          twinConnections.push([tar, twin]);
        }
      });
    }
  });
  g.twinConnections = twinConnections;

  twinConnections.forEach(function(conn) {
    var d = normalizePos(diffPos(conn[0].pos, conn[1].pos));
    var dl = lengthPos(d);
    if (dl < 0.4 && dl > conn[0].radius + conn[1].radius) {
      var dv = scalePos(d, -0.00001/dl/dl/dl);
      conn[0].v = addPos(conn[0].v, scalePos(dv, -1));
      conn[1].v = addPos(conn[1].v, dv);
    }
  });

  tars.forEach(function(tar) {
    // flashing
    tar.flashPhase += 0.1232;
    while (tar.flashPhase >= tar.primeFactors.length) {
      tar.flashPhase -= tar.primeFactors.length;
    }
    // charging
    if (tar.isPrime!=true) {
      tar.chargingPhase += tar.value / (33*10000);
      while (tar.chargingPhase >= 1) {
        tar.chargingPhase -= 1;
        targetFires(g, tar);
      }
    }
    // gavitating towards me
    var d = normalizePos(diffPos(g.me.pos, tar.pos));
    var dl = lengthPos(d);
    if (dl < 0.4 && dl > tar.radius+g.me.radius) {
      tar.v = addPos(tar.v, scalePos(d, -0.00001/dl/dl/dl));
    }
    // movement
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

  abulls.forEach(function(abull) {
    abull.pos = addPos(abull.pos, abull.v);
    abull.age += 1;
    if (abull.age >= 20) {
      abull.delete = true;
    }
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
          g.me.lives = 0;
          g.gameOver = true;
        }
        g.deathIndicator.blackWhiteIntensity = 1;
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

  // antiBullet-me collisions
  abulls.forEach(function(abull) {
    if (colliding(abull, g.me)) {
      abull.delete = true;
      loseGem(g);
      g.me.v = addPos(g.me.v, abull.v);
    }
  });

  // bonus-me collisions
  bons.forEach(function(bon) {
    if (colliding(bon, g.me)) {
      bon.delete = true;
      if (g.me.lives < 3) {
        g.me.lives += 1;
      }
      else {
        collectGem(g);
      }
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

  [ g.targets
  , g.spawningTargets
  , g.bullets
  , g.bonuses
  , g.antiBullets
  , g.fadingAmmos
  ].forEach(purgeExtendList);
}

function inputMovement(input) {
  var v = {x: 0, y: 0};
  if (!input.gettingKeyEvents) {
    var acc = input.acceleration;
    var mag = Math.sqrt(acc.x*acc.x + acc.y*acc.y + acc.z*acc.z);
    mag = mag < 0.001 ? 1 : mag;
    acc = {x: acc.x/mag, y: acc.y/mag, z: acc.z/mag};
    var x = -acc.x;
    var y = -(acc.z - acc.y)/Math.sqrt(2);
    v = {x: x*8, y: y*8};
  }
  else {
    var k = input.keysDown;
    var c = input.keyCodes;
    v = ( { x: (k[c.left]==true ? -1 : 0) + (k[c.right]==true ? 1 : 0)
          , y: (k[c.up  ]==true ? -1 : 0) + (k[c.down ]==true ? 1 : 0)
          } );
  }
  var l = lengthPos(v);
  if (l > 1) {
    v = scalePos(v, 1/l);
  }
  return v;
}

function shoot(g, v) {
  var l = lengthPos(v);
  if (l > 0.001 && g.me.ammo.length>0) {
    v = scalePos(v, 1/l);
    newBullet(g, g.me.ammo.pop(), g.me.pos, scalePos(v, 0.06));
  }
}
function collectGem(g) {
  g.me.collectedGems.current += 1;
  if (g.me.collectedGems.current > g.me.collectedGems.max) {
    g.me.collectedGems.max = g.me.collectedGems.current;
  }
}
function loseGem(g) {
  if (g.me.collectedGems.current > 0) {
    g.me.collectedGems.current -= 1;
    g.deathIndicator.colorIntensity = 1;
  }
}
function dropAmmo(g) {
  if (g.me.ammo.length > 0) {
    var value = g.me.ammo.pop();
    newFadingAmmo(g, value, g.me.pos);
  }
}

function targetFires(g, tar) {
  var d = normalizePos(diffPos(tar.pos, g.me.pos));
  var dl = lengthPos(d);
  newAntiBullet(g, tar.pos, scalePos(d, 0.04/dl));
}

function newTarget(g, value, pos, v={x:0, y:0}, chargingPhase=0) {
  var primes = primeFactors(value);
  var prime = isPrime(value);
  var twins = [-2, 2].map(function(d) {
    return prime && isPrime(value+d); });
  g.targets.issued.push(
    { value: value
    , primeFactors: primes
    , isPrime: prime
    , twins: twins
    , pos: pos
    , v: {x:v.x, y:v.y}
    , radius: 0.06
    , chargingPhase: prime==true ? 0 : chargingPhase
    , flashPhase: 0 } );
}
function newSpawningTarget(g, value, pos) {
  g.spawningTargets.issued.push(
    { value: value
    , pos: pos
    , flashPhase: 0
    , age: 0 } );
}
function newBullet(g, value, pos, v) {
  g.bullets.issued.push(
    { value: value
    , pos: pos
    , v: v
    , radius: 0.04
    , age: 0
    , angle: Math.atan2(v.y, v.x) } );
}
function newBonus(g, pos) {
  g.bonuses.issued.push(
    { pos: pos
    , v: {x:0, y:0}
    , radius: 0.01
    , colorPhase: 0
    } );
}
function newAntiBullet(g, pos, v) {
  g.antiBullets.issued.push(
    { pos: pos
    , v: v
    , radius: 0.015
    , age: 0 } );
}
function newFadingAmmo(g, value, pos) {
  g.fadingAmmos.issued.push(
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
    newTarget(g, value, tar.pos, addPos(tar.v, vel(i)));
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
    newTarget(g, tar1.value+tar2.value, pos, lerp(tar1.v, tar2.v, 0.5),
      Math.max(tar1.chargingPhase, tar2.chargingPhase));
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

function purgeExtendList(l) {
  for (var i=0; i<l.current.length; i++) {
    if (l.current[i].delete == true) {
      l.current.splice(i, 1);
      i--;
    }
  }
  l.current = l.current.concat(l.issued);
  l.issued = [];
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
function isPrime(n) {
  return primeFactors(n).length == 1;
}

function draw(s, g) {
  drawBackground(s, g);

  g.bonuses.current.forEach(function(bon) {
    drawBonus(s, bon, g.me.lives >= 3);
  });

  g.antiBullets.current.forEach(function(abull) {
    drawAntiBullet(s, abull);
  });

  g.targets.current.forEach(function(tar) {
    drawTarget(s, tar);
  });

  g.twinConnections.forEach(function(conn) {
    drawTwinConnection(s, conn);
  });

  g.spawningTargets.current.forEach(function(star) {
    drawSpawningTarget(s, star);
  });

  g.bullets.current.forEach(function(bull) {
    drawBullet(s, bull);
  });

  drawMe(s, g.me);

  g.fadingAmmos.current.forEach(function(fammo) {
    drawFadingAmmo(s, fammo);
  });

  drawLives(s, g.me.lives);
  drawCollectedGems(s, g.me.collectedGems);

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
  var ind = g.deathIndicator;
  var blackWhite = ind.phase > 0 ? white : black;
  var color = colorFromHue(ind.hue);
  var i1 = ind.blackWhiteIntensity, i2 = ind.colorIntensity;
  var bg = grey(0.15);
  bg = mixColors(bg, color, i2);
  bg = mixColors(bg, blackWhite, i1);
  s.ctx.fillStyle = toRGBAString(bg);
  s.ctx.fillRect(0, 0, s.dim, s.dim);

  s.ctx.strokeStyle = toRGBAString(grey(0.3));
  lineAt(s, {x: 0, y:0}, {x:  0.5, y:  0.5});
  lineAt(s, {x: 0, y:0}, {x:  0.5, y: -0.5});
  lineAt(s, {x: 0, y:0}, {x: -0.5, y:  0.5});

  if (g.gameOver==true) {
    var a1 = Math.max(0, Math.min(1, g.gameOverAge/100));
    var a2 = Math.max(0, Math.min(1, (g.gameOverAge-100)/100));
    function slopingText(x, y, text, scale) {
      textAt(s, {x: x-y, y: -x-y}, text, scale, -2*Math.PI/8);
    }
    s.ctx.fillStyle = toRGBAString([0.4, 0, 0, a1]);
    slopingText(0, 0.35, "Game Over", 3);
    s.ctx.fillStyle = toRGBAString([0.4, 0.4, 0.4, a1]);
    slopingText(-0.35, 0.05, "last spawned", 0.75);
    slopingText(-0.35, 0.15 , g.spawning.nextValue-1, 3);
    slopingText( 0.35, 0.05, "max gems", 0.75);
    slopingText( 0.35, 0.15 , g.me.collectedGems.max, 3);
    s.ctx.fillStyle = toRGBAString([0.4, 0, 0, a2]);
    slopingText(0, 0.25, restartInstruction(g), 0.5);
  }
}
function restartInstruction(g) {
  return ( g.assumeMobile==true
    ? "tap to restart"
    : "press Enter to restart" );
}
function drawBonus(s, bon, asGem) {
  var color = colorFromHue(bon.colorPhase);
  spotlightAt(s, bon.pos, 0.1, withAlpha(color, 0.2));
  spotlightAt(s, bon.pos, 0.04, withAlpha(black, 0.6));
  if (asGem) {
    gemAt(s, bon.pos, bon.colorPhase+0.5);
  }
  else {
    s.ctx.fillStyle = toRGBAString([1, 0, 0, 1]);
    filledCircleAt(s, bon.pos, 0.01);
  }
}
function drawAntiBullet(s, abull) {
  s.ctx.fillStyle = toRGBAString(white);
  filledCircleAt(s, abull.pos, 0.5*abull.radius);
}
function drawTarget(s, tar) {
  if (tar.isPrime) {
    var color = primeColor(tar.value);
    spotlightAt(s, tar.pos, 0.1, withAlpha(color, 0.3));

    s.ctx.fillStyle = toRGBAString(mixColors(color, white, 0.2));
    textAt(s, tar.pos, tar.value);

    tar.twins.forEach(function(isTwin, index) {
      if (isTwin) {
        var d = index*2 - 1;
        var value = tar.value + 2*d;
        var color = mixColors(primeColor(value), white, 0.5);
        var pos = addPos(tar.pos, {x: 0, y: -d*0.04});
        s.ctx.fillStyle = toRGBAString(withAlpha(color, 0.3));
        textAt(s, pos, value, 0.4);
      }
    });
  }
  else {
    var n = tar.primeFactors.length;
    var i1 = Math.floor(tar.flashPhase);
    var i2 = (i1 + 1) % n;
    var t = tar.flashPhase - i1;
    var lightRadius = 0.07 + 0.03*Math.abs(Math.cos(t*Math.PI));

    var color = mixColors(
      primeColor(tar.primeFactors[i1]),
      primeColor(tar.primeFactors[i2]),
      Math.sin(t*0.5*Math.PI)**2);

    spotlightAt(s, tar.pos, lightRadius, color);

    for (var i=0; i<n; i++) {
      var v = scalePos(circlePos(i/n*2*Math.PI), 0.04);
      spotlightAt(s, addPos(tar.pos, v), 0.02, withAlpha(black, 0.2));
    }

    s.ctx.fillStyle = toRGBAString(white);
    textAt(s, tar.pos, tar.value);

    var charge = tar.chargingPhase;
    s.ctx.strokeStyle = toRGBAString(withAlpha(white, charge));
    for (var i=0; i<4; i++) {
      var a = i*Math.PI/2;
      var b = charge * Math.PI/4;
      arcAt(s, tar.pos, tar.radius, a-b, a+b);
    }
  }
}
function drawTwinConnection(s, conn) {
  var d = lengthPos(normalizePos(diffPos(conn[0].pos, conn[1].pos)));
  var pos = lerp(conn[0].pos, conn[1].pos, 0.5);
  var t = d/0.4;
  var n = 10;
  for (var i=0; i<=n; i++) {
    if (i/n > t) {
      var r = Math.exp(-5*Math.pow((i/n - t), 0.5));
      var color = primeColor(conn[i%2].value);
      var alpha = Math.pow(i/n - t, 0.5) * Math.pow(1-t, 0.25);
      s.ctx.strokeStyle = toRGBAString(withAlpha(color, alpha));
      circleAt(s, pos, r*0.5);
    }
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
    s.ctx.arc((i+1)*0.03*s.dim, 0.03*s.dim, 0.01*s.dim, 0, 2*Math.PI);
    s.ctx.fill();
  }
}
function drawCollectedGems(s, collectedGems) {
  var n = collectedGems.current;
  var m = collectedGems.max;

  for (var i=0; i<m; i++) {
    var x = Math.floor(i/20);
    var xx = Math.floor(x/5);
    var y = i-x*20;
    var yy = Math.floor(y/5);

    s.ctx.save();
    s.ctx.translate( (0.03 + x*0.03 + xx*0.015)*s.dim
                   , (0.5-20.5*0.015 + y*0.03 + yy*0.015)*s.dim );
    gemHere(s, collectedGems.colorPhase - i*0.11, i<n);
    s.ctx.restore();
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
function arcAt(s, pos, radius, alpha, beta) {
  var xys = toPixelPoses(s, pos);
  var r = toPixelLength(s, radius);
  xys.forEach(function(xy) {
    s.ctx.beginPath();
    s.ctx.arc(xy[0], xy[1], r, alpha, beta);
    s.ctx.stroke();
  });
}
function circleAt(s, pos, radius) {
  arcAt(s, pos, radius, 0, 2*Math.PI);
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
function gemAt(s, pos, phase, filled=true) {
  toPixelPoses(s, pos).forEach(function(xy) {
    s.ctx.save();
    s.ctx.translate(xy[0], xy[1]);
    gemHere(s, phase, filled);
    s.ctx.restore();
  });
}
function gemHere(s, phase, filled=true) {
  var r = toPixelLength(s, 0.01);
  var grad = s.ctx.createRadialGradient(0, 0, 0, 0, 0, r);
  grad.addColorStop(0, toRGBAString(colorFromHue(phase+0.1)));
  grad.addColorStop(1, toRGBAString(colorFromHue(phase    )));

  s.ctx.beginPath();
  s.ctx.arc(0, 0, r, 0, 2*Math.PI);
  if (filled) {
    s.ctx.fillStyle = grad;
    s.ctx.fill();
  }
  else {
    s.ctx.strokeStyle = grad;
    s.ctx.stroke();
  }
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
  return colorFromHue(hue);
}

var goldenRatio = (1 + Math.sqrt(5)) / 2

// 0 <= hue < 1
function colorFromHue(hue) {
  while (hue < 0 || hue >= 1) {
    hue = hue-Math.floor(hue);
  }
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
  var rgb = color.slice(0, 3).map(
    function(c) {return Math.trunc(c*255);} ).join(", ");
  var a = color[3];
  return ("rgba("+rgb+", "+a+")");
}
