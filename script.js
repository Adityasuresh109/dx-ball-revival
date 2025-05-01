const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const starCanvas = document.getElementById("stars");
const starCtx = starCanvas.getContext("2d");
starCanvas.width = window.innerWidth;
starCanvas.height = window.innerHeight;

// Starfield background animation
let stars = Array(200).fill().map(() => ({
  x: Math.random() * starCanvas.width,
  y: Math.random() * starCanvas.height,
  radius: Math.random() * 1.2,
  speed: 0.5 + Math.random()
}));

function drawStars() {
  starCtx.clearRect(0, 0, starCanvas.width, starCanvas.height);
  starCtx.fillStyle = '#fff';
  stars.forEach(star => {
    star.y += star.speed;
    if (star.y > starCanvas.height) {
      star.y = 0;
      star.x = Math.random() * starCanvas.width;
    }
    starCtx.beginPath();
    starCtx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
    starCtx.fill();
  });
  requestAnimationFrame(drawStars);
}
drawStars();

let score = 0;
let highScore = localStorage.getItem("dxball_highscore") || 0;
let lives = 3;

let showIntro = true;
setTimeout(() => { showIntro = false; }, 3000);

let paddle = {
  height: 15,
  width: 100,
  x: (canvas.width - 100) / 2,
  dx: 7,
  movingLeft: false,
  movingRight: false
};

let balls = [{
  x: canvas.width / 2,
  y: canvas.height - 30,
  dx: 4,
  dy: -4,
  radius: 10,
  active: true
}];

const brick = {
  rowCount: 5,
  colCount: 8,
  width: 75,
  height: 20,
  padding: 10,
  offsetTop: 40,
  offsetLeft: 35
};

const brickColors = ['#e74c3c', '#f39c12', '#2ecc71', '#3498db', '#9b59b6'];
let bricks = [];
let particles = [];

for (let c = 0; c < brick.colCount; c++) {
  bricks[c] = [];
  for (let r = 0; r < brick.rowCount; r++) {
    bricks[c][r] = { x: 0, y: 0, status: 1 };
  }
}

let powerUps = [];
const powerUpTypes = ["wide", "life", "slow", "multi"];
const powerUpEffects = {
  wide: () => {
    paddle.width = 150;
    setTimeout(() => paddle.width = 100, 10000);
  },
  life: () => {
    lives++;
    updateUI();
  },
  slow: () => {
    balls.forEach(b => {
      b.dx *= 0.5;
      b.dy *= 0.5;
    });
    setTimeout(() => {
      balls.forEach(b => {
        b.dx *= 2;
        b.dy *= 2;
      });
    }, 10000);
  },
  multi: () => {
    let main = balls[0];
    balls.push({
      x: main.x,
      y: main.y,
      dx: -main.dx,
      dy: -main.dy,
      radius: 10,
      active: true
    });
  }
};

function updateUI() {
  document.getElementById("score").textContent = score;
  document.getElementById("lives").textContent = lives;
  document.getElementById("highscore").textContent = highScore;
}

function drawBall(ball) {
  if (!ball.active) return;
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
  ctx.fillStyle = "#0ff";
  ctx.shadowColor = "#0ff";
  ctx.shadowBlur = 15;
  ctx.fill();
  ctx.closePath();
}

function drawPaddle() {
  ctx.beginPath();
  ctx.rect(paddle.x, canvas.height - paddle.height - 10, paddle.width, paddle.height);
  ctx.fillStyle = "#f39c12";
  ctx.shadowColor = "#f39c12";
  ctx.shadowBlur = 10;
  ctx.fill();
  ctx.closePath();
}

function drawBricks() {
  for (let c = 0; c < brick.colCount; c++) {
    for (let r = 0; r < brick.rowCount; r++) {
      if (bricks[c][r].status === 1) {
        let x = c * (brick.width + brick.padding) + brick.offsetLeft;
        let y = r * (brick.height + brick.padding) + brick.offsetTop;
        bricks[c][r].x = x;
        bricks[c][r].y = y;

        ctx.beginPath();
        ctx.rect(x, y, brick.width, brick.height);
        ctx.fillStyle = brickColors[r % brickColors.length];
        ctx.shadowColor = brickColors[r % brickColors.length];
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.closePath();
      }
    }
  }
}

function createParticles(x, y) {
  for (let i = 0; i < 8; i++) {
    particles.push({
      x: x,
      y: y,
      dx: (Math.random() - 0.5) * 4,
      dy: (Math.random() - 0.5) * 4,
      life: 60
    });
  }
}

function drawParticles() {
  particles.forEach(p => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.closePath();
    p.x += p.dx;
    p.y += p.dy;
    p.life--;
  });
  particles = particles.filter(p => p.life > 0);
}

function drawPowerUps() {
  powerUps.forEach(p => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 10, 0, Math.PI * 2);
    ctx.fillStyle = {
      wide: "gold",
      life: "lime",
      slow: "cyan",
      multi: "magenta"
    }[p.type];
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 15;
    ctx.fill();
    ctx.closePath();
  });
}

function collisionDetection(ball) {
  for (let c = 0; c < brick.colCount; c++) {
    for (let r = 0; r < brick.rowCount; r++) {
      let b = bricks[c][r];
      if (b.status === 1 &&
        ball.x > b.x && ball.x < b.x + brick.width &&
        ball.y > b.y && ball.y < b.y + brick.height) {
        b.status = 0;
        score++;
        updateUI();
        createParticles(b.x + brick.width / 2, b.y + brick.height / 2);
        ball.dy = -ball.dy;

        if (Math.random() < 0.1) {
          let type = powerUpTypes[Math.floor(Math.random() * powerUpTypes.length)];
          powerUps.push({ x: b.x + brick.width / 2, y: b.y, type });
        }

        if (score === brick.rowCount * brick.colCount) {
          if (score > highScore) {
            localStorage.setItem("dxball_highscore", score);
          }
          alert("🎉 YOU WIN!");
          location.reload();
        }
      }
    }
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (showIntro) {
    document.getElementById("introText").style.display = "block";
  } else {
    document.getElementById("introText").style.display = "none";
    drawPaddle();
    drawBricks();
    drawPowerUps();
    drawParticles();
    balls.forEach(drawBall);

    balls.forEach(ball => {
      if (!ball.active) return;

      ball.x += ball.dx;
      ball.y += ball.dy;

      if (ball.x < ball.radius || ball.x > canvas.width - ball.radius) ball.dx *= -1;
      if (ball.y < ball.radius) ball.dy *= -1;

      if (
        ball.y + ball.radius >= canvas.height - paddle.height - 10 &&
        ball.x > paddle.x && ball.x < paddle.x + paddle.width
      ) {
        let collidePoint = ball.x - (paddle.x + paddle.width / 2);
        collidePoint = collidePoint / (paddle.width / 2);
        let angle = collidePoint * (Math.PI / 3); // max bounce angle
        let speed = Math.sqrt(ball.dx * ball.dx + ball.dy * ball.dy);
        ball.dx = speed * Math.sin(angle);
        ball.dy = -speed * Math.cos(angle);
      }

      if (ball.y + ball.radius > canvas.height) ball.active = false;

      collisionDetection(ball);
    });

    balls = balls.filter(b => b.active);
    if (balls.length === 0) {
      lives--;
      updateUI();
      if (lives === 0) {
        alert("😢 GAME OVER");
        location.reload();
      } else {
        balls = [{
          x: canvas.width / 2,
          y: canvas.height - 30,
          dx: 4,
          dy: -4,
          radius: 10,
          active: true
        }];
        paddle.x = (canvas.width - paddle.width) / 2;
      }
    }

    if (paddle.movingRight && paddle.x < canvas.width - paddle.width) paddle.x += paddle.dx;
    if (paddle.movingLeft && paddle.x > 0) paddle.x -= paddle.dx;

    powerUps.forEach((p, i) => {
      p.y += 3;
      if (
        p.y > canvas.height - paddle.height - 10 &&
        p.x > paddle.x && p.x < paddle.x + paddle.width
      ) {
        powerUpEffects[p.type]();
        powerUps.splice(i, 1);
      } else if (p.y > canvas.height) {
        powerUps.splice(i, 1);
      }
    });
  }

  requestAnimationFrame(draw);
}

document.addEventListener("keydown", e => {
  if (e.key === "ArrowRight") paddle.movingRight = true;
  if (e.key === "ArrowLeft") paddle.movingLeft = true;
});
document.addEventListener("keyup", e => {
  if (e.key === "ArrowRight") paddle.movingRight = false;
  if (e.key === "ArrowLeft") paddle.movingLeft = false;
});

// Touch buttons
document.getElementById("leftBtn").addEventListener("touchstart", () => paddle.movingLeft = true);
document.getElementById("leftBtn").addEventListener("touchend", () => paddle.movingLeft = false);
document.getElementById("rightBtn").addEventListener("touchstart", () => paddle.movingRight = true);
document.getElementById("rightBtn").addEventListener("touchend", () => paddle.movingRight = false);

// Enable tilt button (iOS permission)
document.getElementById("enableTilt").addEventListener("click", () => {
  if (
    typeof DeviceOrientationEvent !== 'undefined' &&
    typeof DeviceOrientationEvent.requestPermission === 'function'
  ) {
    DeviceOrientationEvent.requestPermission()
      .then(state => {
        if (state === 'granted') {
          window.addEventListener("deviceorientation", handleTilt);
        } else {
          alert("Permission denied.");
        }
      });
  } else {
    window.addEventListener("deviceorientation", handleTilt);
  }
});

function handleTilt(e) {
  const tilt = e.gamma;
  if (tilt > 10) {
    paddle.movingRight = true;
    paddle.movingLeft = false;
  } else if (tilt < -10) {
    paddle.movingLeft = true;
    paddle.movingRight = false;
  } else {
    paddle.movingLeft = false;
    paddle.movingRight = false;
  }
}

updateUI();
draw();
