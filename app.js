// Curling Stats site: live game in the first screen and small page behaviour.
(function () {
  var root = document.documentElement;
  var en = root.lang === 'en';
  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Header line after scrolling
  var head = document.querySelector('.site-head');
  if (head) {
    var onScroll = function () { head.classList.toggle('scrolled', window.scrollY > 8); };
    addEventListener('scroll', onScroll, { passive: true }); onScroll();
  }

  // Blocks appear on scroll
  var items = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px' });
    items.forEach(function (el) { io.observe(el); });
  } else { items.forEach(function (el) { el.classList.add('in'); }); }

  // Live game
  var canvas = document.getElementById('sheet');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var hudShot = document.getElementById('hud-shot');
  var hudWho = document.getElementById('hud-who');
  var hudDot = document.getElementById('hud-dot');
  var rateCells = document.querySelectorAll('.rate b');

  // Sizes are in feet, tee at (0, 0), thrower at the bottom, like in the app.
  var R = 0.48, HALF = 7.1, TOP = -7, BOTTOM = 8.8;
  var COLORS = {
    ice: '#F3F8FC', ring12: '#A9C9E6', ring8: '#FFFFFF', ring4: '#F2B6B0', line: '#8E9AAB',
    red: '#E06F68', yellow: '#F3CC5C', granite: '#9BA1AA', broom: '#8A6FB5', target: '#8A6A3A'
  };
  var third = en ? 'Third' : 'Третий';
  var endLabel = en ? 'End 5' : 'Энд 5';

  // Three shots of one end. Paths are quadratic curves from the bottom edge.
  var START = [
    { c: 'yellow', x: 1.9, y: -2.8 },
    { c: 'yellow', x: 2.7, y: 4.2 },
    { c: 'red', x: 0.4, y: 7.3 }
  ];
  var hit = { from: [0.45, 0.7], to: [-1.39, -10.1], rest: [0.8, 1.0], at: [0.61, 1.65] };
  var SHOTS = [
    { n: 9, c: 'red', name: 'Come-around · In-turn', rate: 4, dur: 3400, target: [0.3, 0.5], broom: [-2.1, 0],
      p: [[-3.1, 11], [-3.1, 4.5], [0.45, 0.7]] },
    { n: 10, c: 'yellow', name: 'Takeout · Out-turn', rate: 3, dur: 1300, target: hit.from, broom: [0.3, 0], takeout: true,
      p: [[2.2, 11], [1.4, 6.3], hit.at] },
    { n: 11, c: 'red', name: 'Draw · In-turn', rate: 2, dur: 3200, target: [-0.3, -0.3], broom: [-2.6, 0],
      p: [[-3.3, 11], [-3.6, 2.8], [-1.1, -1.3]] }
  ];
  var AIM = 800, RATE = 1700, FADE = 500;

  var stones, trail, fade = 1;
  function reset() { stones = START.map(function (s) { return { c: s.c, x: s.x, y: s.y, a: 1 }; }); trail = []; }

  var W = 0, S = 1;
  function resize() {
    var w = canvas.clientWidth, h = canvas.clientHeight, d = Math.min(window.devicePixelRatio || 1, 2);
    if (!w) return;
    canvas.width = Math.round(w * d); canvas.height = Math.round(h * d);
    W = canvas.width; S = W / (HALF * 2);
  }
  function X(x) { return (x + HALF) * S; }
  function Y(y) { return (y - TOP) * S; }

  function ring(r, c, edge) {
    ctx.beginPath(); ctx.arc(X(0), Y(0), r * S, 0, Math.PI * 2); ctx.fillStyle = c; ctx.fill();
    if (edge) { ctx.strokeStyle = 'rgba(142,154,171,.45)'; ctx.lineWidth = 1; ctx.stroke(); }
  }
  function line(x1, y1, x2, y2) {
    ctx.beginPath(); ctx.moveTo(X(x1), Y(y1)); ctx.lineTo(X(x2), Y(y2));
    ctx.strokeStyle = COLORS.line; ctx.lineWidth = Math.max(1, .07 * S); ctx.stroke();
  }
  function stone(s) {
    ctx.globalAlpha = s.a * fade;
    ctx.beginPath(); ctx.arc(X(s.x), Y(s.y), R * S, 0, Math.PI * 2); ctx.fillStyle = COLORS.granite; ctx.fill();
    ctx.beginPath(); ctx.arc(X(s.x), Y(s.y), R * .72 * S, 0, Math.PI * 2); ctx.fillStyle = COLORS[s.c]; ctx.fill();
    ctx.globalAlpha = 1;
  }
  function broom(b) {
    var x = X(b[0]), y = Y(b[1]), u = S;
    ctx.strokeStyle = COLORS.broom; ctx.lineCap = 'round';
    ctx.lineWidth = .13 * u; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 2 * u); ctx.stroke();
    ctx.lineWidth = .26 * u; ctx.beginPath(); ctx.moveTo(x - .72 * u, y); ctx.lineTo(x + .72 * u, y); ctx.stroke();
    ctx.lineCap = 'butt';
  }
  function target(t) {
    ctx.setLineDash([.14 * S, .14 * S]); ctx.strokeStyle = COLORS.target; ctx.lineWidth = .1 * S;
    ctx.beginPath(); ctx.arc(X(t[0]), Y(t[1]), R * S, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
  }
  function draw(shot) {
    ctx.clearRect(0, 0, W, canvas.height);
    ctx.fillStyle = COLORS.ice; ctx.fillRect(0, 0, W, canvas.height);
    ring(6, COLORS.ring12, true); ring(4, COLORS.ring8, true); ring(2, COLORS.ring4, true); ring(.5, COLORS.ring8);
    line(-HALF, 0, HALF, 0); line(0, TOP, 0, BOTTOM); line(-HALF, -6, HALF, -6);
    if (trail.length > 1) {
      ctx.beginPath(); ctx.moveTo(X(trail[0][0]), Y(trail[0][1]));
      trail.forEach(function (p) { ctx.lineTo(X(p[0]), Y(p[1])); });
      ctx.strokeStyle = 'rgba(138,111,181,.4)'; ctx.lineWidth = Math.max(1.5, .08 * S); ctx.stroke();
    }
    if (shot) { target(shot.target); broom(shot.broom); }
    stones.forEach(stone);
  }

  function ease(t) { return 1 - Math.pow(1 - t, 2.1); }
  function curve(p, t) {
    var u = 1 - t;
    return [u * u * p[0][0] + 2 * u * t * p[1][0] + t * t * p[2][0], u * u * p[0][1] + 2 * u * t * p[1][1] + t * t * p[2][1]];
  }
  function setHud(shot, showRate) {
    hudShot.textContent = endLabel + ' · ' + shot.n + '/16';
    hudWho.textContent = third + ' · ' + shot.name;
    hudDot.style.background = shot.c === 'red' ? COLORS.red : COLORS.yellow;
    rateCells.forEach(function (b, i) { b.classList.toggle('on', showRate && i === shot.rate); });
  }

  // One shot: aim, travel (and hit), score.
  function apply(shot, t, moving) {
    var e = ease(Math.min(t / shot.dur, 1));
    var pos = curve(shot.p, shot.takeout ? Math.min(t / shot.dur, 1) : e);
    moving.x = pos[0]; moving.y = pos[1];
    trail.push(pos);
    if (shot.takeout && t >= shot.dur) {
      var k = ease(Math.min((t - shot.dur) / 800, 1));
      moving.x = hit.at[0] + (hit.rest[0] - hit.at[0]) * k;
      moving.y = hit.at[1] + (hit.rest[1] - hit.at[1]) * k;
      var struck = stones.filter(function (s) { return s.struck; })[0];
      if (struck) {
        var q = Math.min((t - shot.dur) / 1000, 1);
        struck.x = hit.from[0] + (hit.to[0] - hit.from[0]) * q;
        struck.y = hit.from[1] + (hit.to[1] - hit.from[1]) * q;
        if (struck.y < TOP) struck.a = 0;
      }
    }
  }

  function finalState() {
    reset();
    stones.push({ c: 'yellow', x: hit.rest[0], y: hit.rest[1], a: 1 });
    stones.push({ c: 'red', x: -1.1, y: -1.3, a: 1 });
  }

  resize();
  addEventListener('resize', function () { resize(); });

  if (reduced) {
    finalState(); setHud(SHOTS[2], true); draw(SHOTS[2]);
    addEventListener('resize', function () { draw(SHOTS[2]); });
    return;
  }

  var visible = true;
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) { visible = es[0].isIntersecting; }).observe(canvas);
  }

  var idx = 0, phase = 'aim', phaseStart = null, moving = null, last = null, paused = 0;
  reset();
  function next() { idx += 1; phase = 'aim'; }

  function frame(now) {
    requestAnimationFrame(frame);
    if (last === null) { last = now; phaseStart = now; setHud(SHOTS[0], false); }
    if (!visible || document.hidden) { paused += now - last; last = now; return; }
    last = now;
    var t = now - phaseStart - paused;

    if (phase === 'fade') {
      fade = Math.max(1 - t / FADE, 0);
      draw(null);
      if (t >= FADE) { fade = 1; reset(); idx = 0; phase = 'aim'; phaseStart = now; paused = 0; setHud(SHOTS[0], false); }
      return;
    }
    var shot = SHOTS[idx];
    if (phase === 'aim') {
      draw(shot);
      if (t >= AIM) {
        trail = [];
        moving = { c: shot.c, x: shot.p[0][0], y: shot.p[0][1], a: 1 };
        stones.push(moving);
        if (shot.takeout) stones[stones.length - 2].struck = true;
        phase = 'travel'; phaseStart = now; paused = 0;
      }
      return;
    }
    if (phase === 'travel') {
      apply(shot, t, moving); draw(shot);
      if (t >= shot.dur + (shot.takeout ? 1000 : 0)) {
        stones = stones.filter(function (s) { return !s.struck; });
        setHud(shot, true); phase = 'rate'; phaseStart = now; paused = 0;
      }
      return;
    }
    if (phase === 'rate') {
      draw(shot);
      if (t >= RATE) {
        trail = [];
        phaseStart = now; paused = 0;
        if (idx === SHOTS.length - 1) { phase = 'fade'; }
        else { next(); setHud(SHOTS[idx], false); }
      }
    }
  }
  requestAnimationFrame(frame);
})();
