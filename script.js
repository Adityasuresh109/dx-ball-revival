/* ========================== PAGE LOCK (mobile) ========================== */
document.addEventListener('touchmove', e => e.preventDefault(), { passive:false });
['gesturestart','gesturechange','gestureend'].forEach(ev =>
  document.addEventListener(ev, e => e.preventDefault()) );

/* ========================== DOM HOOKS ========================== */
const bgCvs   = document.getElementById('bg');
const bgCtx   = bgCvs.getContext('2d', { alpha: true });
const cvs     = document.getElementById('game');
const ctx     = cvs.getContext('2d', { alpha: false });

const hud = {
  score: document.getElementById('score'),
  lives: document.getElementById('lives'),
  level: document.getElementById('level'),
  high:  document.getElementById('high'),
  timerWrap: document.getElementById('timerWrap'),
  timer: document.getElementById('timer'),
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
const reduceMotion= document.getElementById('reduceMotion');
const tiltToggle  = document.getElementById('tiltToggle');
const tiltCalBtn  = document.getElementById('tiltCalibrate');
const tiltSlider  = document.getElementById('tiltSlider');
const tiltStatus  = document.getElementById('tiltStatus');
const restartBtn  = document.getElementById('restartBtn');
const btnMenu     = document.getElementById('btnMenu');

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

// Menu option mirrors (for initial UX)
const menuMusic = document.getElementById('menuMusic');
const menuSfx   = document.getElementById('menuSfx');
const menuRM    = document.getElementById('menuReduceMotion');
const menuTilt  = document.getElementById('menuTilt');

// Audio
const bgm    = document.getElementById('bgm');
const sfxHit = document.getElementById('sfxBrick');
const sfxPow = document.getElementById('sfxCatch');
const sfxLife= document.getElementById('sfxLife');

/* ========================== VIEWPORT FIT ========================== */
function fitCanvas() {
  const hudH = document.getElementById('hud').getBoundingClientRect().height;
  const w = Math.floor(window.innerWidth);
  const h = Math.floor(window.innerHeight - hudH);
  bgCvs.width = cvs.width  = w;
  bgCvs.height= cvs.height = h;
}
window.addEventListener('resize', fitCanvas);
window.addEventListener('orientationchange', () => setTimeout(fitCanvas, 150));
fitCanvas();

/* ========================== SETTINGS & STATE ========================== */
const store = {
  get(key, def){ try{return JSON.parse(localStorage.getItem(key)) ?? def;}catch{ return def; } },
  set(key, val){ localStorage.setItem(key, JSON.stringify(val)); }
};

const SETTINGS = store.get('pb_settings', {
  theme: 'theme-neptune',
  music: true, sfx: true, reduceMotion: false, tilt: false, tiltSens: 1.0,
});
document.body.className = SETTINGS.theme + ' no-scroll';
themeSelect.value = SETTINGS.theme;
musicToggle.checked = menuMusic.checked = SETTINGS.music;
sfxToggle.checked   = menuSfx.checked   = SETTINGS.sfx;
reduceMotion.checked= menuRM.checked    = SETTINGS.reduceMotion;
tiltToggle.checked  = menuTilt.checked  = SETTINGS.tilt;
tiltSlider.value    = SETTINGS.tiltSens;

const G = {
  level: 1,
  score: 0,
  lives: 3,
  high: +store.get('pb_high', 0),
  running: false,
  mode: 'classic',           // classic | time | obstacles
  difficulty: 1.0,           // multiplier
  analytics: store.get('pb_analytics', {}),
};
hud.high.textContent = G.high;
hud.timerWrap.classList.add('hidden');

/* ========================== GAME CONSTANTS ========================== */
const BRICK = { cols: 10, rows: 6, w: 0, h: 20, pad: 12, top: 90, left: 18 };
const BALL  = { r: 9, base: 6.2 };
const PADDLE= { w: 118, h: 16, speed: 9.2 };
const DROP_CHANCE = 0.35;

/* ========================== OBJECTS ========================== */
let paddle, ball, bricks = [], powerups = [], particles = [], trail = [];
let timeLeft = 60;       // for time mode

/* ========================== INPUT ========================== */
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

/* ========================== TILT CONTROL ========================== */
let tiltEnabled = SETTINGS.tilt;
let tiltZero = null;
let tiltVal = 0;
const tiltSmooth = 0.2;
let   tiltSensitivity = +SETTINGS.tiltSens; // 0.5..2.0
const tiltDeadzone = 2.0;

function setTiltStatus(txt){ tiltStatus.textContent = txt; }
async function requestTiltPermission() {
  try {
    const needPerm = typeof DeviceOrientationEvent !== 'undefined'
      && typeof DeviceOrientationEvent.requestPermission === 'function';
    if (needPerm) {
      const res = await DeviceOrientationEvent.requestPermission();
      return res === 'granted';
    }
    return true;
  } catch { return false; }
}
function handleOrientation(e) {
  if (typeof e.gamma !== 'number') return;
  if (tiltZero === null) tiltZero = e.gamma;
  const delta = e.gamma - tiltZero;
  const dz = Math.abs(delta) < tiltDeadzone ? 0 : delta;
  tiltVal = tiltVal * (1 - tiltSmooth) + dz * tiltSmooth;
}
async function enableTilt() {
  const granted = await requestTiltPermission();
  if (!granted) { setTiltStatus('Tilt: denied'); tiltToggle.checked=false; SETTINGS.tilt=false; saveSettings(); return; }
  if (!tiltEnabled) {
    tiltEnabled = true; tiltZero = null; tiltVal = 0;
    window.addEventListener('deviceorientation', handleOrientation);
  }
  setTiltStatus('Tilt: on');
}
function disableTilt() {
  tiltEnabled = false;
  window.removeEventListener('deviceorientation', handleOrientation);
  tiltZero = null; tiltVal = 0;
  setTiltStatus('Tilt: off');
}
tiltToggle.addEventListener('change', async () => {
  if (tiltToggle.checked) { SETTINGS.tilt=true; saveSettings(); await enableTilt(); }
  else { SETTINGS.tilt=false; saveSettings(); disableTilt(); }
});
tiltCalBtn.addEventListener('click', ()=>{ tiltZero = null; setTiltStatus('Tilt: calibrated'); });
tiltSlider.addEventListener('input', ()=>{ tiltSensitivity = +tiltSlider.value; SETTINGS.tiltSens = tiltSensitivity; saveSettings(); });

/* ========================== AUDIO ========================== */
function playSFX(el) { if (sfxToggle.checked) { try { el.currentTime = 0; el.play(); } catch{} } }
if (musicToggle.checked) { bgm.play().catch(()=>{}); }
musicToggle.addEventListener('change', ()=> {
  SETTINGS.music = musicToggle.checked; saveSettings();
  if (musicToggle.checked) bgm.play().catch(()=>{}); else bgm.pause();
});
sfxToggle.addEventListener('change', ()=>{ SETTINGS.sfx = sfxToggle.checked; saveSettings(); });
reduceMotion.addEventListener('change', ()=>{ SETTINGS.reduceMotion = reduceMotion.checked; saveSettings(); });

/* Mirror menu checkboxes into HUD on Start */
function syncMenuToHud() {
  musicToggle.checked = menuMusic.checked;
  sfxToggle.checked   = menuSfx.checked;
  reduceMotion.checked= menuRM.checked;
  tiltToggle.checked  = menuTilt.checked;
  SETTINGS.music = musicToggle.checked;
  SETTINGS.sfx   = sfxToggle.checked;
  SETTINGS.reduceMotion = reduceMotion.checked;
  SETTINGS.tilt  = tiltToggle.checked;
  saveSettings();
}

/* ========================== MENUS / SCREENS ========================== */
function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove('visible'));
  if (name) screens[name].classList.add('visible');
  // Hide gameplay canvases when any screen is visible (UX clean)
  const showGame = !name;
  setGameVisible(showGame);
}
function openMenu() { showScreen('home'); pauseGame(); }
btnMenu.addEventListener('click', openMenu);
instructionsBtn.addEventListener('click', ()=>showScreen('instructions'));
backFromInstructions.addEventListener('click', ()=>showScreen('home'));
leaderboardBtn.addEventListener('click', ()=>{ renderLB(); showScreen('leaderboard'); });
backFromLB.addEventListener('click', ()=>showScreen('home'));
clearLB.addEventListener('click', ()=>{ localStorage.removeItem('pb_lb'); renderLB(); });

themeThumbs.forEach(b=>{
  b.addEventListener('click', ()=>{
    themeThumbs.forEach(x=>x.classList.remove('selected'));
    b.classList.add('selected');
    document.body.className = b.dataset.theme + ' no-scroll';
    themeSelect.value = b.dataset.theme;
    SETTINGS.theme = b.dataset.theme; saveSettings();
  });
});
themeSelect.addEventListener('change', ()=>{
  document.body.className = themeSelect.value + ' no-scroll';
  SETTINGS.theme = themeSelect.value; saveSettings();
});

startBtn.addEventListener('click', async ()=>{
  syncMenuToHud();
  if (tiltToggle.checked) await enableTilt(); else disableTilt();

  G.mode = modeSelect.value;
  G.difficulty = parseFloat(difficulty.value);
  hud.timerWrap.classList.toggle('hidden', G.mode!=='time');
  showScreen(); // hide overlays, show gameplay
  hardReset(true);
});
restartBtn.addEventListener('click', async ()=>{
  if (tiltToggle.checked) await enableTilt();
  hardReset(false);
});

/* ========================== LEADERBOARD ========================== */
function getLB() { return store.get('pb_lb', []); }
function setLB(list) { store.set('pb_lb', list.slice(0,10)); }
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

/* ========================== HUD ========================== */
function updateHUD() {
  hud.score.textContent = G.score;
  hud.lives.textContent = G.lives;
  hud.level.textContent = G.level;
  if (G.score > G.high) { G.high = G.score; store.set('pb_high', G.high); }
  hud.high.textContent = G.high;
}

/* ========================== GAME VISIBILITY/PAUSE ========================== */
let loopHandle = 0, bgHandle = 0;
function setGameVisible(show) {
  // fade canvases via CSS class if desired; here we just hide/display
  cvs.style.display = bgCvs.style.display = show ? 'block' : 'none';
}
function pauseGame() { G.running = false; }
function resumeGame() {
  if (!G.running) {
    G.running = true;
    lastFrameTime = performance.now();
    requestAnimationFrame(loop);
  }
}

/* ========================== LEVEL & OBJECTS ========================== */
function buildLevel() {
  const usableW = cvs.width - BRICK.left*2;
  BRICK.w = Math.floor((usableW - (BRICK.cols-1)*BRICK.pad) / BRICK.cols);
  BRICK.h = Math.floor(Math.min(22, (cvs.height*0.45 - BRICK.top - (BRICK.rows-1)*BRICK.pad)/BRICK.rows));

  bricks = [];
  for (let c=0;c<BRICK.cols;c++){
    bricks[c] = [];
    for (let r=0;r<BRICK.rows;r++){
      const hp = 1 + Math.floor((G.level-1)/2) + (r%2);
      bricks[c][r] = { x:0,y:0, alive:true, hp };
    }
  }
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

/* ========================== FADES & COUNTDOWN ========================== */
function fadeInOverlay(ms=400, cb) { fadeOverlay.classList.remove('hidden'); fadeOverlay.style.opacity=1; setTimeout(()=>cb&&cb(), ms); }
function fadeOutOverlay(ms=400) { fadeOverlay.style.opacity=0; setTimeout(()=>fadeOverlay.classList.add('hidden'), ms); }
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

/* ========================== GAME FLOW ========================== */
function hardReset(fromMenu=false) {
  G.score = 0; G.lives = 3; G.level = 1; timeLeft = 60;
  updateHUD(); buildLevel(); placePaddleBall(true);
  fadeInOverlay(150, ()=>{ fadeOutOverlay(300); countdown(startGame); });
  // background starts/updates per theme
  startBgLoop();
}
function startGame() { resumeGame(); ball.stuck = false; }

/* ========================== FIXED TIMESTEP LOOP ========================== */
const STEP = 1000/60; // 16.67ms
let accumulator = 0;
let lastFrameTime = performance.now();

function loop(now) {
  if (!G.running) return;
  accumulator += Math.min(50, now - lastFrameTime);
  lastFrameTime = now;

  while (accumulator >= STEP) {
    step(STEP);
    accumulator -= STEP;
  }
  draw();
  requestAnimationFrame(loop);
}

/* ========================== BACKGROUND ANIM (per theme) ========================== */
let bgStars = [], bgT = 0;
function seedStars() {
  bgStars = [];
  const n = 120;
  for (let i=0;i<n;i++) {
    bgStars.push({
      x: Math.random()*bgCvs.width,
      y: Math.random()*bgCvs.height,
      r: Math.random()*1.8 + 0.4,
      s: Math.random()*0.6 + 0.3,
    });
  }
}
function drawBg(dt=16) {
  if (cvs.style.display === 'none') return; // hidden
  const theme = getThemeName();

  if (SETTINGS.reduceMotion) {
    bgCtx.clearRect(0,0,bgCvs.width,bgCvs.height);
    return;
  }

  bgCtx.clearRect(0,0,bgCvs.width,bgCvs.height);
  bgT += dt;

  // Simple animated motifs per planet (lightweight)
  if (theme==='neptune' || theme==='uranus' || theme==='earth') {
    // Stars drift + subtle nebula
    if (!bgStars.length) seedStars();
    bgCtx.fillStyle = 'rgba(255,255,255,0.9)';
    bgStars.forEach(s=>{
      s.y += s.s * 0.2;
      if (s.y > bgCvs.height) s.y = 0;
      bgCtx.beginPath(); bgCtx.arc(s.x, s.y, s.r, 0, Math.PI*2); bgCtx.fill();
    });
    // faint moving gradient
    const g = bgCtx.createRadialGradient(bgCvs.width*0.6, (bgT*0.02)%bgCvs.height, 80, bgCvs.width*0.5, bgCvs.height*0.5, Math.max(bgCvs.width,bgCvs.height)*0.8);
    g.addColorStop(0, 'rgba(255,255,255,0.04)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    bgCtx.fillStyle = g; bgCtx.fillRect(0,0,bgCvs.width,bgCvs.height);
  } else if (theme==='saturn') {
    // Parallax ring sweep
    const cy = bgCvs.height*0.4;
    for (let i=0;i<6;i++){
      bgCtx.strokeStyle = `rgba(255,220,150,${0.15 + i*0.1})`;
      bgCtx.lineWidth = 8 + i*3;
      bgCtx.beginPath();
      bgCtx.ellipse(bgCvs.width/2, cy, bgCvs.width*0.6, 40 + i*12, 0.2, 0, Math.PI*2);
      bgCtx.stroke();
    }
  } else if (theme==='jupiter') {
    // Flowing bands
    const bandH = 24;
    for (let y=0;y<bgCvs.height;y+=bandH) {
      const hue = 30 + 10*Math.sin((y+bgT*0.05)/50);
      bgCtx.fillStyle = `hsla(${hue},70%,60%,0.15)`;
      bgCtx.fillRect(0,y,bgCvs.width,bandH);
    }
  } else if (theme==='mars' || theme==='mercury' || theme==='venus') {
    // Dust/speckle drift
    if (!bgStars.length) seedStars();
    bgCtx.fillStyle = theme==='mars' ? 'rgba(255,140,90,0.25)' :
                      theme==='venus'? 'rgba(255,210,120,0.25)' :
                                       'rgba(200,200,200,0.25)';
    for (let i=0;i<bgStars.length;i+=2){
      const s = bgStars[i];
      s.x += s.s * 0.3;
      if (s.x > bgCvs.width) s.x = 0;
      bgCtx.beginPath(); bgCtx.arc(s.x, s.y, s.r*0.6, 0, Math.PI*2); bgCtx.fill();
    }
  } else {
    // Legacy themes → gentle vignette pulse
    const alpha = 0.04 + 0.03*Math.sin(bgT*0.003);
    bgCtx.fillStyle = `rgba(255,255,255,${alpha})`;
    bgCtx.beginPath();
    bgCtx.arc(bgCvs.width*0.5, bgCvs.height*0.5, Math.max(bgCvs.width,bgCvs.height)*0.55, 0, Math.PI*2);
    bgCtx.fill();
  }
}
let lastBgT = performance.now();
function bgLoop(now) {
  const dt = now - lastBgT; lastBgT = now;
  drawBg(dt);
  bgHandle = requestAnimationFrame(bgLoop);
}
function startBgLoop() {
  cancelAnimationFrame(bgHandle);
  lastBgT = performance.now();
  bgHandle = requestAnimationFrame(bgLoop);
}

/* ========================== PARTICLES ========================== */
function burst(x,y,theme='generic') {
  const count = 16;
  for (let i=0;i<count;i++){
    particles.push({
      x, y,
      vx: (Math.random()*2-1)*3,
      vy: (Math.random()*-1-0.5)*3,
      life: 500 + Math.random()*300,
      size: 2 + Math.random()*3,
      hue: theme==='ice'||theme==='uranus'? 200+Math.random()*40 :
           theme==='inferno'||theme==='mars'||theme==='venus'? 20+Math.random()*40 :
           theme==='neon'||theme==='jupiter'? 280+Math.random()*40 : 190+Math.random()*40
    });
  }
}

/* ========================== POWERUPS ========================== */
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
    G.score += 10; updateHUD(); playSFX(sfxPow); burst(ball.x, ball.y, getThemeName());
  }
  if (t==='fire') {
    const k = 1.25; ball.vx *= k; ball.vy *= k; setTimeout(()=>{ball.vx/=k; ball.vy/=k;}, 8000);
  }
}

/* ========================== STEP (physics & logic) ========================== */
function step(dt) {
  // Time Attack
  if (G.mode==='time') {
    timeLeft -= dt/1000;
    hud.timer.textContent = Math.max(0, Math.ceil(timeLeft));
    if (timeLeft <= 0) return gameOver();
  }

  // Paddle input
  if (input.left)  paddle.x = Math.max(0, paddle.x - paddle.vx);
  if (input.right) paddle.x = Math.min(cvs.width - paddle.w, paddle.x + paddle.vx);

  // Tilt add-on
  if (tiltEnabled) {
    const dx = tiltVal * tiltSensitivity;
    paddle.x = Math.max(0, Math.min(cvs.width - paddle.w, paddle.x + dx));
  }

  // Ball movement with substeps to avoid tunneling
  if (ball.stuck) {
    ball.x = paddle.x + paddle.w/2;
    ball.y = paddle.y - BALL.r - 2;
  } else {
    const maxStep = BALL.r * 0.8; // movement per micro-step
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(ball.vx), Math.abs(ball.vy)) / maxStep));
    const stepX = ball.vx / steps;
    const stepY = ball.vy / steps;

    for (let i=0;i<steps;i++){
      ball.x += stepX;
      ball.y += stepY;

      // Walls
      if (ball.x < ball.r) { ball.x = ball.r; ball.vx *= -1; break; }
      if (ball.x > cvs.width - ball.r) { ball.x = cvs.width - ball.r; ball.vx *= -1; break; }
      if (ball.y < ball.r) { ball.y = ball.r; ball.vy *= -1; break; }

      // Paddle
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
        break;
      }

      // Bricks (allow multiple hits per frame)
      let hit = false;
      bricks.forEach((col,c)=>{
        col.forEach((b,r)=>{
          if (hit || !b.alive) return;
          const x = BRICK.left + c*(BRICK.w+BRICK.pad);
          const y = BRICK.top  + r*(BRICK.h+BRICK.pad);
          b.x=x; b.y=y;
          if (ball.x > x && ball.x < x+BRICK.w && ball.y > y && ball.y < y+BRICK.h) {
            // Determine which side we hit by checking penetration depths
            const dxL = Math.abs(ball.x - x);
            const dxR = Math.abs((x+BRICK.w) - ball.x);
            const dyT = Math.abs(ball.y - y);
            const dyB = Math.abs((y+BRICK.h) - ball.y);
            const minPen = Math.min(dxL, dxR, dyT, dyB);
            if (minPen === dxL || minPen === dxR) ball.vx *= -1;
            else ball.vy *= -1;

            b.hp -= 1; playSFX(sfxHit);
            burst(ball.x, ball.y, getThemeName());
            if (b.hp<=0) {
              b.alive = false; G.score += 2; updateHUD();
              if (Math.random() < DROP_CHANCE) addPowerup(x+BRICK.w/2, y+BRICK.h/2);
            }
            hit = true;
          }
        });
      });
      if (hit) break;
    }
  }

  // Trail
  trail.unshift({ x: ball.x, y: ball.y, life: 220 });
  if (trail.length > 18) trail.pop();

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
  if (!bricks.flat().some(b=>b.alive)) {
    G.level += 1; updateHUD();
    buildLevel(); placePaddleBall(true);
    countdown(()=>{ ball.stuck=false; });
  }
}

/* ========================== DRAW ========================== */
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
  const theme = getThemeName();
  bricks.forEach(col=>col.forEach(b=>{
    if (!b.alive) return;
    ctx.save();
    ctx.shadowColor = getCSS('--glow'); ctx.shadowBlur = 12;

    if (theme==='mercury') {
      ctx.fillStyle = '#4d4d4d';
      roundRect(ctx, b.x, b.y, BRICK.w, BRICK.h, 3); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.fillRect(b.x+4,b.y+4,BRICK.w-8,BRICK.h-8);
    } else if (theme==='venus') {
      const lg = ctx.createLinearGradient(b.x,b.y,b.x,b.y+BRICK.h);
      lg.addColorStop(0,'#ffd89a'); lg.addColorStop(1,'#b36b00');
      ctx.fillStyle = lg; roundRect(ctx,b.x,b.y,BRICK.w,BRICK.h,4); ctx.fill();
    } else if (theme==='earth') {
      ctx.globalAlpha=.25; ctx.fillStyle='#ffffff';
      roundRect(ctx,b.x,b.y,BRICK.w,BRICK.h,6); ctx.fill();
      ctx.globalAlpha=1; ctx.strokeStyle='#4ac1ff'; ctx.lineWidth=3;
      roundRect(ctx,b.x+2,b.y+2,BRICK.w-4,BRICK.h-4,6); ctx.stroke();
    } else if (theme==='mars') {
      const lg = ctx.createLinearGradient(b.x,b.y,b.x,b.y+BRICK.h);
      lg.addColorStop(0,'#c24a2e'); lg.addColorStop(1,'#6a1d12');
      ctx.fillStyle=lg; roundRect(ctx,b.x,b.y,BRICK.w,BRICK.h,4); ctx.fill();
    } else if (theme==='jupiter') {
      const hue = 30; ctx.fillStyle = `hsla(${hue},70%,60%,0.8)`;
      roundRect(ctx,b.x,b.y,BRICK.w,BRICK.h,4); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.15)'; ctx.fillRect(b.x+3,b.y+3,BRICK.w-6,BRICK.h-6);
    } else if (theme==='saturn') {
      const lg = ctx.createLinearGradient(b.x,b.y,b.x,b.y+BRICK.h);
      lg.addColorStop(0,'#ffe6a6'); lg.addColorStop(1,'#b58d3b');
      ctx.fillStyle=lg; roundRect(ctx,b.x,b.y,BRICK.w,BRICK.h,5); ctx.fill();
    } else if (theme==='uranus') {
      const lg = ctx.createLinearGradient(b.x,b.y,b.x,b.y+BRICK.h);
      lg.addColorStop(0,'#d5f3ff'); lg.addColorStop(1,'#79c2f2');
      ctx.fillStyle=lg; roundRect(ctx,b.x,b.y,BRICK.w,BRICK.h,5); ctx.fill();
    } else if (theme==='neptune') {
      const lg = ctx.createLinearGradient(b.x,b.y,b.x,b.y+BRICK.h);
      lg.addColorStop(0,'#3a66a5'); lg.addColorStop(1,'#0b1a37');
      ctx.fillStyle=lg; roundRect(ctx,b.x,b.y,BRICK.w,BRICK.h,4); ctx.fill();
      ctx.strokeStyle='rgba(255,255,255,.25)'; ctx.strokeRect(b.x+4,b.y+4,BRICK.w-8,BRICK.h-8);
    } else {
      // Legacy
      const grad = ctx.createLinearGradient(b.x, b.y, b.x, b.y+BRICK.h);
      grad.addColorStop(0, getCSS('--brickA'));
      grad.addColorStop(1, getCSS('--brickB'));
      ctx.fillStyle = grad;
      ctx.fillRect(b.x, b.y, BRICK.w, BRICK.h);
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

function draw() {
  ctx.fillStyle = '#000'; ctx.fillRect(0,0,cvs.width,cvs.height);
  drawBricks();
  drawPaddle();
  drawBall();
  powerups.forEach(drawPowerup);
  drawParticles();
}

/* ========================== UTILS ========================== */
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
  // caller fills/strokes
}
function getCSS(name) { return getComputedStyle(document.body).getPropertyValue(name); }
function shade(cssColor, factor = 1.0) {
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
  const c = (cssColor || '').trim();
  if (c.startsWith('#') && (c.length === 7 || c.length === 4)) return normalizeHex(c);
  const m = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (m) {
    const r = (+m[1]).toString(16).padStart(2,'0');
    const g = (+m[2]).toString(16).padStart(2,'0');
    const b = (+m[3]).toString(16).padStart(2,'0');
    return `#${r}${g}${b}`;
  }
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
  const hex = toHex(hexOrCss);
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${alpha})`;
}
function getThemeName() {
  const c = document.body.className.split(' ').find(x=>x.startsWith('theme-')) || 'theme-neptune';
  return c.replace('theme-','');
}
function saveSettings(){ store.set('pb_settings', SETTINGS); }

/* ========================== GAME OVER ========================== */
function gameOver() {
  G.running = false;
  finalScore.textContent = G.score;
  bumpAnalytics('gamesPlayed', 1);
  bumpAnalytics('lastScore', G.score);
  bumpAnalytics('theme_'+getThemeName(), 1);
  store.set('pb_analytics', G.analytics);
  pushLB(G.score, SETTINGS.theme);
  modal.classList.remove('hidden');
}
playAgain.addEventListener('click', ()=>{ modal.classList.add('hidden'); hardReset(false); });
gotoMenu.addEventListener('click', ()=>{ modal.classList.add('hidden'); openMenu(); });

/* ========================== ANALYTICS (local) ========================== */
function bumpAnalytics(key, v) {
  if (!G.analytics) G.analytics = {};
  if (typeof v === 'number') G.analytics[key] = (G.analytics[key]||0) + v;
  else G.analytics[key] = v;
}

/* ========================== INIT ========================== */
function initFromUI() {
  document.body.className = (themeSelect.value || 'theme-neptune') + ' no-scroll';
  setTiltStatus(tiltEnabled ? 'Tilt: on' : 'Tilt: off');
}
initFromUI();
seedStars(); startBgLoop();
