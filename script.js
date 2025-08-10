/* =================== PAGE LOCK (mobile) =================== */
document.addEventListener('touchmove', e => e.preventDefault(), { passive:false });
['gesturestart','gesturechange','gestureend'].forEach(ev =>
  document.addEventListener(ev, e => e.preventDefault()) );

/* =================== DOM HOOKS =================== */
const cvs = document.getElementById('game');
const ctx = cvs.getContext('2d', { alpha:false });

const hud = {
  score: document.getElementById('score'),
  lives: document.getElementById('lives'),
  level: document.getElementById('level'),
  high:  document.getElementById('high'),
};
const fadeOverlay = document.getElementById('fadeOverlay');
const countdownEl = document.getElementById('countdown');
const modal  = document.getElementById('modal');
const finalScore = document.getElementById('finalScore');
const playAgain  = document.getElementById('playAgain');
const gotoMenu   = document.getElementById('gotoMenu');

const themeSelect = document.getElementById('themeSelect');
const musicToggle = document.getElementById('musicToggle');
const sfxToggle   = document.getElementById('sfxToggle');
const restartBtn  = document.getElementById('restartBtn');
const btnMenu     = document.getElementById('btnMenu');

const bgm    = document.getElementById('bgm');
const sfxHit = document.getElementById('sfxBrick');
const sfxPow = document.getElementById('sfxCatch');
const sfxLife= document.getElementById('sfxLife');

const screens = {
  home: document.getElementById('home'),
  instructions: document.getElementById('instructions'),
  leaderboard: document.getElementById('leaderboard'),
};
const startBtn = document.getElementById('startBtn');
const instructionsBtn = document.getElementById('instructionsBtn');
const leaderboardBtn  = document.getElementById('leaderboardBtn');
const backFromInstructions = document.getElementById('backFromInstructions');
const lbList = document.getElementById('lbList');
const clearLB = document.getElementById('clearLB');
const backFromLB = document.getElementById('backFromLB');
const themeThumbs = [...document.querySelectorAll('.theme-thumb')];
const modeSelect = document.getElementById('modeSelect');
const difficulty = document.getElementById('difficulty');

/* =================== VIEWPORT FIT =================== */
function fitCanvas() {
  const hudH = document.getElementById('hud').getBoundingClientRect().height;
  const w = Math.floor(window.innerWidth);
  const h = Math.floor(window.innerHeight - hudH);
  cvs.width  = w; cvs.height = h;
}
window.addEventListener('resize', fitCanvas);
window.addEventListener('orientationchange', () => setTimeout(fitCanvas, 150));
fitCanvas();

/* =================== STATE =================== */
const G = {
  level: 1,
  score: 0,
  lives: 3,
  high: +localStorage.getItem('dx2025_high') || 0,
  running: false,
  mode: 'classic',           // classic | time | obstacles
  difficulty: 1.0,           // multiplier
  analytics: JSON.parse(localStorage.getItem('dx2025_analytics') || '{}'),
};
hud.high.textContent = G.high;

const BRICK = { cols: 10, rows: 6, w: 0, h: 20, pad: 12, top: 90, left: 18 };
const BALL  = { r: 9, base: 6.0 };
const PADDLE= { w: 110, h: 16, speed: 9 };
const DROP_CHANCE = 0.35;

let paddle, ball, bricks = [], powerups = [], particles = [], trail = [];
let timeLeft = 60;       // for time mode
let lastTime = 0;

/* =================== INPUT =================== */
const input = { left:false, right:false };
document.addEventListener('keydown', e=>{
  if (e.key==='ArrowLeft' || e.key==='a') input.left=true;
  if (e.key==='ArrowRight'|| e.key==='d') input.right=true;
  if (e.key==='Escape') openMenu();
});
document.addEventListener('keyup', e=>{
  if (e.key==='ArrowLeft' || e.key==='a') input.left=false;
  if (e.key==='ArrowRight'|| e.key==='d') input.right=false;
});
cvs.addEventListener('touchstart', e=>{
  const x = e.touches[0].clientX;
  input.left = x < window.innerWidth/2;
  input.right= !input.left;
});
cvs.addEventListener('touchend', ()=>{ input.left=false; input.right=false; });

/* =================== AUDIO =================== */
function playSFX(el) { if (sfxToggle.checked) { try { el.currentTime = 0; el.play(); } catch{} } }
if (musicToggle.checked) { bgm.play().catch(()=>{}); }
musicToggle.addEventListener('change', ()=> {
  if (musicToggle.checked) bgm.play().catch(()=>{}); else bgm.pause();
});

/* =================== MENUS =================== */
function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove('visible'));
  if (name) screens[name].classList.add('visible');
}
function openMenu() { showScreen('home'); G.running = false; }
btnMenu.addEventListener('click', openMenu);
instructionsBtn.addEventListener('click', ()=>showScreen('instructions'));
backFromInstructions.addEventListener('click', ()=>showScreen('home'));
leaderboardBtn.addEventListener('click', ()=>{ renderLB(); showScreen('leaderboard'); });
backFromLB.addEventListener('click', ()=>showScreen('home'));
clearLB.addEventListener('click', ()=>{ localStorage.removeItem('dx2025_lb'); renderLB(); });

themeThumbs.forEach(b=>{
  b.addEventListener('click', ()=>{
    themeThumbs.forEach(x=>x.classList.remove('selected'));
    b.classList.add('selected');
    document.body.className = b.dataset.theme + ' no-scroll';
    themeSelect.value = b.dataset.theme;
  });
});
themeSelect.addEventListener('change', ()=>{
  document.body.className = themeSelect.value + ' no-scroll';
});

startBtn.addEventListener('click', ()=>{
  G.mode = modeSelect.value;
  G.difficulty = parseFloat(difficulty.value);
  showScreen(); // hide all
  hardReset(true);
});
restartBtn.addEventListener('click', ()=> hardReset(false));

/* =================== LEADERBOARD =================== */
function getLB() { return JSON.parse(localStorage.getItem('dx2025_lb') || '[]'); }
function setLB(list) { localStorage.setItem('dx2025_lb', JSON.stringify(list.slice(0,10))); }
function pushLB(score, theme) {
  const list = getLB();
  list.push({ score, theme, date: Date.now() });
  list.sort((a,b)=>b.score-a.score);
  setLB(list);
}
function renderLB() {
  const list = getLB();
  lbList.innerHTML = '';
  list.forEach((e,i)=>{
    const li = document.createElement('li');
    const date = new Date(e.date).toLocaleDateString();
    li.textContent = `#${i+1}  ${e.score}  •  ${e.theme.replace('theme-','')}  •  ${date}`;
    lbList.appendChild(li);
  });
}

/* =================== HUD =================== */
function updateHUD() {
  hud.score.textContent = G.score;
  hud.lives.textContent = G.lives;
  hud.level.textContent = G.level;
  if (G.score > G.high) { G.high = G.score; localStorage.setItem('dx2025_high', G.high); }
  hud.high.textContent = G.high;
}

/* =================== LEVEL & OBJECTS =================== */
function buildLevel() {
  const usableW = cvs.width - BRICK.left*2;
  BRICK.w = Math.floor((usableW - (BRICK.cols-1)*BRICK.pad) / BRICK.cols);
  BRICK.h = Math.floor(Math.min(BRICK.h, (cvs.height*0.45 - BRICK.top - (BRICK.rows-1)*BRICK.pad)/BRICK.rows));

  bricks = [];
  for (let c=0;c<BRICK.cols;c++){
    bricks[c] = [];
    for (let r=0;r<BRICK.rows;r++){
      // HP scales with level, alternate by row
      const hp = 1 + Math.floor((G.level-1)/2) + (r%2);
      bricks[c][r] = { x:0,y:0, alive:true, hp };
    }
  }
  // Obstacles mode: mark gaps / blocks
  if (G.mode === 'obstacles') {
    for (let i=0;i<8;i++) {
      const c = (Math.random()*BRICK.cols)|0;
      const r = (Math.random()*BRICK.rows)|0;
      bricks[c][r].alive = false; // gap
    }
  }
}

function placePaddleBall(stick=true) {
  paddle = {
    w: PADDLE.w, h: PADDLE.h,
    x: (cvs.width - PADDLE.w)/2,
    y: cvs.height - PADDLE.h - 18,
    vx: PADDLE.speed
  };
  const speed = BALL.base * G.difficulty * (1 + (G.level-1)*0.1);
  ball = {
    x: paddle.x + paddle.w/2,
    y: paddle.y - BALL.r - 2,
    vx: speed * (Math.random()>.5?1:-1),
    vy: -speed,
    r: BALL.r,
    stuck: !!stick
  };
  trail = [];
}

/* =================== COUNTDOWN & FADES =================== */
function fadeInOverlay(ms=500, cb) { fadeOverlay.classList.remove('hidden'); fadeOverlay.style.opacity=1; setTimeout(()=>cb&&cb(), ms); }
function fadeOutOverlay(ms=500) { fadeOverlay.style.opacity=0; setTimeout(()=>fadeOverlay.classList.add('hidden'), ms); }
function countdown(cb) {
  let n = 3;
  countdownEl.textContent = n; countdownEl.classList.remove('hidden');
  const iv = setInterval(()=>{
    n--;
    if (n>0) countdownEl.textContent = n;
    else if (n===0) countdownEl.textContent = 'GO!';
    else { clearInterval(iv); countdownEl.classList.add('hidden'); cb(); }
  }, 700);
}

/* =================== GAME FLOW =================== */
function hardReset(fromMenu=false) {
  G.score = 0; G.lives = 3; G.level = 1; timeLeft = 60;
  updateHUD(); buildLevel(); placePaddleBall(true);
  if (fromMenu) fadeInOverlay(200, ()=>{ fadeOutOverlay(400); countdown(startGame); });
  else { fadeInOverlay(150, ()=>{ fadeOutOverlay(300); countdown(startGame); }); }
}
function startGame() { G.running = true; ball.stuck = false; lastTime = performance.now(); requestAnimationFrame(loop); }

/* =================== PARTICLES =================== */
function burst(x,y,theme='generic') {
  for (let i=0;i<18;i++){
    particles.push({
      x, y,
      vx: (Math.random()*2-1)*3,
      vy: (Math.random()*-1-0.5)*3,
      life: 600, size: 2 + Math.random()*3,
      hue: theme==='ice'? 200+Math.random()*40 :
           theme==='inferno'? 20+Math.random()*40 :
           theme==='neon'? 280+Math.random()*40 : 190+Math.random()*40
    });
  }
}

/* =================== POWERUPS =================== */
function addPowerup(x,y) {
  const types = ['wide','life','slow','multi','fire'];
  const type = types[(Math.random()*types.length)|0];
  powerups.push({ x, y, vy: 2.2, type, spin: 0, pulse: 0 });
}
function applyPowerup(t) {
  if (t==='wide') {
    const before = paddle.w; paddle.w = Math.min(paddle.w*1.45, Math.min(260, cvs.width*0.6));
    setTimeout(()=>paddle.w = before, 11000);
  }
  if (t==='life') { G.lives += 1; playSFX(sfxLife); updateHUD(); }
  if (t==='slow') {
    ball.vx *= 0.7; ball.vy *= 0.7; setTimeout(()=>{ball.vx/=0.7; ball.vy/=0.7;}, 9000);
  }
  if (t==='multi') {
    // Score bonus + small particle burst (simple sub for true multiball)
    G.score += 10; updateHUD(); playSFX(sfxPow); burst(ball.x, ball.y, getThemeName());
  }
  if (t==='fire') {
    // Temporarily boost pierce damage (implemented as higher speed)
    const k = 1.25; ball.vx *= k; ball.vy *= k; setTimeout(()=>{ball.vx/=k; ball.vy/=k;}, 8000);
  }
}

/* =================== LOOP =================== */
function loop(now) {
  if (!G.running) return;
  const dt = Math.min(32, now - lastTime); lastTime = now;

  step(dt);
  draw(dt);

  requestAnimationFrame(loop);
}

/* =================== STEP =================== */
function step(dt) {
  // Time Attack
  if (G.mode==='time') {
    timeLeft -= dt/1000;
    if (timeLeft <= 0) return gameOver();
  }

  // Paddle
  if (input.left)  paddle.x = Math.max(0, paddle.x - paddle.vx);
  if (input.right) paddle.x = Math.min(cvs.width - paddle.w, paddle.x + paddle.vx);

  // Ball
  if (ball.stuck) { ball.x = paddle.x + paddle.w/2; ball.y = paddle.y - ball.r - 2; }
  else { ball.x += ball.vx; ball.y += ball.vy; }

  // Trail
  trail.unshift({ x: ball.x, y: ball.y, life: 220 });
  if (trail.length > 18) trail.pop();

  // Walls
  if (ball.x < ball.r) { ball.x = ball.r; ball.vx *= -1; }
  if (ball.x > cvs.width - ball.r) { ball.x = cvs.width - ball.r; ball.vx *= -1; }
  if (ball.y < ball.r) { ball.y = ball.r; ball.vy *= -1; }

  // Paddle bounce
  if (ball.y + ball.r >= paddle.y &&
      ball.x >= paddle.x && ball.x <= paddle.x + paddle.w &&
      ball.vy > 0) {
    const rel = (ball.x - (paddle.x + paddle.w/2)) / (paddle.w/2);
    const angle = rel * Math.PI/3; // -60..+60
    const speed = Math.hypot(ball.vx, ball.vy);
    ball.vx = speed * Math.sin(angle);
    ball.vy = -Math.abs(speed * Math.cos(angle));
    ball.y  = paddle.y - ball.r - 0.1;
    playSFX(sfxHit);
  }

  // Bricks
  let anyAlive = false;
  bricks.forEach((col,c)=>{
    col.forEach((b,r)=>{
      if (!b.alive) return;
      anyAlive = true;
      const x = BRICK.left + c*(BRICK.w+BRICK.pad);
      const y = BRICK.top  + r*(BRICK.h+BRICK.pad);
      b.x=x; b.y=y;
      if (ball.x > x && ball.x < x+BRICK.w && ball.y > y && ball.y < y+BRICK.h) {
        b.hp -= 1; playSFX(sfxHit);
        burst(ball.x, ball.y, getThemeName());
        if (b.hp<=0) {
          b.alive = false; G.score += 2; updateHUD();
          if (Math.random() < DROP_CHANCE) addPowerup(x+BRICK.w/2, y+BRICK.h/2);
        }
        ball.vy *= -1;
      }
    });
  });

  // Powerups
  powerups.forEach(p=>{
    p.spin += 0.2; p.pulse += 0.06;
    p.y += p.vy;
    if (p.y >= paddle.y && p.x >= paddle.x && p.x <= paddle.x + paddle.w) {
      applyPowerup(p.type); p.caught = true;
    }
    if (p.y > cvs.height+40) p.dead = true;
  });
  powerups = powerups.filter(p=>!p.caught && !p.dead);

  // Particles
  particles.forEach(pt=>{
    pt.x += pt.vx; pt.y += pt.vy; pt.vy += 0.05; pt.life -= dt;
  });
  particles = particles.filter(pt=>pt.life>0);

  // Lose Life
  if (ball.y > cvs.height + ball.r) {
    G.lives -= 1; updateHUD();
    if (G.lives <= 0) return gameOver();
    placePaddleBall(true);
    countdown(()=>{ ball.stuck=false; });
  }

  // Win → next level
  if (!anyAlive) {
    G.level += 1; updateHUD();
    buildLevel(); placePaddleBall(true);
    countdown(()=>{ ball.stuck=false; });
  }
}

/* =================== DRAW =================== */
function drawBackground() {
  // Subtle per-theme motion (stars/embers/frost shimmer)
  // Kept light for performance; can be expanded with offscreen canvas later.
}
function drawPaddle() {
  ctx.save();
  ctx.shadowColor = getCSS('--glow'); ctx.shadowBlur = 18;
  const x = paddle.x, y = paddle.y, w = paddle.w, h = paddle.h;
  const grad = ctx.createLinearGradient(x, y, x, y+h);
  grad.addColorStop(0, shade(getCSS('--paddle'), 1.1));
  grad.addColorStop(1, shade(getCSS('--paddle'), 0.8));
  ctx.fillStyle = grad;
  roundRect(ctx, x, y, w, h, 6); ctx.fill();
  ctx.restore();
}
function drawBall() {
  // Trail
  const base = getCSS('--ball');
  trail.forEach((t,i)=>{
    const alpha = Math.max(0, (t.life - i*8)/220);
    ctx.fillStyle = rgba(base, alpha*0.4);
    ctx.beginPath(); ctx.arc(t.x, t.y, BALL.r - Math.min(i, BALL.r-2)*0.3, 0, Math.PI*2); ctx.fill();
    t.life -= 14;
  });

  // Ball
  ctx.save();
  ctx.shadowColor = getCSS('--glow'); ctx.shadowBlur = 16;
  const g = ctx.createRadialGradient(ball.x-2, ball.y-2, 2, ball.x, ball.y, BALL.r);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(1, getCSS('--ball'));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(ball.x, ball.y, BALL.r, 0, Math.PI*2); ctx.fill();
  ctx.restore();
}
function drawBricks() {
  bricks.forEach(col=>col.forEach(b=>{
    if (!b.alive) return;
    ctx.save();
    ctx.shadowColor = getCSS('--glow'); ctx.shadowBlur = 12;

    const theme = getThemeName();
    if (theme==='galaxy') {
      // asteroid: dark base + glowing crystal veins
      ctx.fillStyle = '#1a1f2b';
      roundRect(ctx, b.x, b.y, BRICK.w, BRICK.h, 4); ctx.fill();
      ctx.fillStyle = getCSS('--brickB');
      ctx.globalAlpha = .35;
      ctx.fillRect(b.x+6, b.y+4, BRICK.w-12, BRICK.h-8);
    } else if (theme==='neon') {
      // glass: transparent center + neon outline
      ctx.globalAlpha = .25; ctx.fillStyle = '#ffffff';
      roundRect(ctx, b.x, b.y, BRICK.w, BRICK.h, 6); ctx.fill();
      ctx.globalAlpha = 1; ctx.strokeStyle = getCSS('--brickA'); ctx.lineWidth = 3;
      roundRect(ctx, b.x+2, b.y+2, BRICK.w-4, BRICK.h-4, 6); ctx.stroke();
    } else if (theme==='ice') {
      // frosted block with light crack
      const g = ctx.createLinearGradient(b.x, b.y, b.x, b.y+BRICK.h);
      g.addColorStop(0, '#cfe9ff'); g.addColorStop(1, '#8cc7ff');
      ctx.fillStyle = g; roundRect(ctx, b.x, b.y, BRICK.w, BRICK.h, 5); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.beginPath();
      ctx.moveTo(b.x+6, b.y+BRICK.h/2); ctx.lineTo(b.x+BRICK.w-6, b.y+BRICK.h/2+2); ctx.stroke();
    } else {
      // inferno: lava cracks
      const g = ctx.createLinearGradient(b.x, b.y, b.x, b.y+BRICK.h);
      g.addColorStop(0, '#ff7b00'); g.addColorStop(1, '#6a2400');
      ctx.fillStyle = g; roundRect(ctx, b.x, b.y, BRICK.w, BRICK.h, 4); ctx.fill();
      ctx.strokeStyle = '#ffb000'; ctx.globalAlpha = .5;
      ctx.beginPath(); ctx.moveTo(b.x+6, b.y+4); ctx.lineTo(b.x+BRICK.w-6, b.y+BRICK.h-4); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }));
}
function drawPowerup(p) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.spin*0.2);
  ctx.shadowColor = getCSS('--glow'); ctx.shadowBlur = 14;

  if (p.type==='wide') {
    // metallic paddle + outward arrows
    ctx.fillStyle = '#9ea7b3';
    roundRect(ctx, -18, -6, 36, 12, 4); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-28,0); ctx.lineTo(-36,0); ctx.lineTo(-30,-6);
    ctx.moveTo(-28,0); ctx.lineTo(-36,0); ctx.lineTo(-30, 6);
    ctx.moveTo(28,0); ctx.lineTo(36,0); ctx.lineTo(30,-6);
    ctx.moveTo(28,0); ctx.lineTo(36,0); ctx.lineTo(30, 6);
    ctx.stroke();
  }
  if (p.type==='life') {
    ctx.fillStyle = '#ff3366';
    ctx.beginPath();
    ctx.moveTo(0,-6); ctx.bezierCurveTo(12,-20, 26,-2, 0,16); ctx.bezierCurveTo(-26,-2,-12,-20,0,-6);
    ctx.fill();
  }
  if (p.type==='slow') {
    ctx.strokeStyle = '#bfe8ff'; ctx.lineWidth = 2;
    for (let r=12;r>=4;r-=2){ ctx.beginPath(); ctx.arc(0,0,r, 0, Math.PI*2); ctx.globalAlpha = .12; ctx.stroke(); }
    ctx.globalAlpha = 1;
  }
  if (p.type==='multi') {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(-8,0,6,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(8,0,6,0,Math.PI*2); ctx.fill();
  }
  if (p.type==='fire') {
    const g = ctx.createRadialGradient(0,0,2, 0,0,12);
    g.addColorStop(0, '#fff4c1'); g.addColorStop(1, '#ff4800');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0,0,10,0,Math.PI*2); ctx.fill();
  }
  ctx.restore();
}
function drawParticles() {
  particles.forEach(pt=>{
    ctx.fillStyle = `hsla(${pt.hue}, 90%, 60%, ${Math.max(0, pt.life/600)})`;
    ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI*2); ctx.fill();
  });
}

function draw(dt) {
  ctx.fillStyle = '#000'; ctx.fillRect(0,0,cvs.width,cvs.height);
  drawBackground();
  drawBricks();
  drawPaddle();
  drawBall();
  powerups.forEach(drawPowerup);
  drawParticles();
}

/* =================== UTILS =================== */
function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w/2, h/2);
  ctx.beginPath();
  ctx.moveTo(x+rr, y);
  ctx.lineTo(x+w-rr, y);
  ctx.quadraticCurveTo(x+w, y, x+w, y+rr);
  ctx.lineTo(x+w, y+h-rr);
  ctx.quadraticCurveTo(x+w, y+h, x+w-rr, y+h);
  ctx.lineTo(x+rr, y+h);
  ctx.quadraticCurveTo(x, y+h, x, y+h-rr);
  ctx.lineTo(x, y+rr);
  ctx.quadraticCurveTo(x, y, x+rr, y);
  // NOTE: caller must fill/stroke
}
function getCSS(name) { return getComputedStyle(document.body).getPropertyValue(name); }
function rgba(hexOrCss, alpha) {
  // crude: if css var color, just return white w/alpha
  return `rgba(255,255,255,${alpha})`;
}
function getThemeName() {
  const c = document.body.className.split(' ').find(x=>x.startsWith('theme-')) || 'theme-galaxy';
  return c.replace('theme-','');
}

/* =================== GAME OVER =================== */
function gameOver() {
  G.running = false;
  finalScore.textContent = G.score;
  // Analytics
  bumpAnalytics('gamesPlayed', 1);
  bumpAnalytics('lastScore', G.score);
  bumpAnalytics('theme_'+getThemeName(), 1);
  localStorage.setItem('dx2025_analytics', JSON.stringify(G.analytics));
  // Leaderboard
  pushLB(G.score, document.body.className.split(' ')[0] || 'theme-galaxy');
  modal.classList.remove('hidden');
}
playAgain.addEventListener('click', ()=>{ modal.classList.add('hidden'); hardReset(false); });
gotoMenu.addEventListener('click', ()=>{ modal.classList.add('hidden'); openMenu(); });

/* =================== ANALYTICS (local) =================== */
function bumpAnalytics(key, v) {
  if (!G.analytics) G.analytics = {};
  if (typeof v === 'number') G.analytics[key] = (G.analytics[key]||0) + v;
  else G.analytics[key] = v;
}

/* =================== INITIALIZE =================== */
function initFromUI() {
  document.body.className = (themeSelect.value || 'theme-galaxy') + ' no-scroll';
}
// ---- Color helpers ----
function shade(cssColor, factor = 1.0) {
  // accepts hex (“#00ffaa”) or rgb/var -> returns hex string shaded by factor
  const hex = toHex(cssColor || '#00ffff');
  let r = parseInt(hex.slice(1,3), 16);
  let g = parseInt(hex.slice(3,5), 16);
  let b = parseInt(hex.slice(5,7), 16);
  r = Math.max(0, Math.min(255, Math.round(r * factor)));
  g = Math.max(0, Math.min(255, Math.round(g * factor)));
  b = Math.max(0, Math.min(255, Math.round(b * factor)));
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
}
function toHex(cssColor) {
  // crude converter; if it's already hex, return as-is
  const c = (cssColor || '').trim();
  if (c.startsWith('#') && (c.length === 7 || c.length === 4)) return normalizeHex(c);
  // rgb(a)
  const m = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (m) {
    const r = (+m[1]).toString(16).padStart(2,'0');
    const g = (+m[2]).toString(16).padStart(2,'0');
    const b = (+m[3]).toString(16).padStart(2,'0');
    return `#${r}${g}${b}`;
  }
  // fallback cyan
  return '#00ffff';
}
function normalizeHex(h) {
  if (h.length === 4) {
    const r = h[1], g = h[2], b = h[3];
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return h;
}
function rgba(hexOrCss, alpha) {
  // used for ball trails; converts hex to rgba string
  const hex = toHex(hexOrCss);
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${alpha})`;
}

initFromUI();
