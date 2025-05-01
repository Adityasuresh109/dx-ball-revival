const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

let score = 0;
let highScore = localStorage.getItem("dxball_highscore") || 0;
let lives = 3;

let balls = [{
  x: canvas.width / 2,
  y: canvas.height - 30,
  dx: 4,
  dy: -4,
  radius: 10,
  active: true
}];

let paddle = {
  width: 100,
  height: 15,
  x: (canvas.width - 100) / 2,
  dx: 7,
  movingLeft: false,
  movingRight: false
};

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
for (let c = 0; c < brick.colCount; c++) {
  bricks[c] = [];
  for (let r = 0; r < brick.rowCount; r++) {
    bricks[c][r] = { x: 0, y: 0, status: 1 };
  }
}

let powerUps = [];
const powerUpTypes = ["wide", "life", "slow", "multi"];
const powerUpIcons = {
  wide: "⇔",
  life: "❤️",
  slow: "🐌",
  multi: "⚪⚪"
};

const powerUpEffects = {
  wide: () => {
    paddle.width = 150;
    setTimeout(() => paddle.width = 100, 10000);
  },
  life: () => {
    lives++;
  },
  slow: () => {
    balls.forEach(b => { b.dx *= 0.5; b.dy *= 0.5; });
    setTimeout(() => balls.forEach(b => { b.dx *= 2; b.dy *= 2; }), 10000);
  },
  multi: () => {
    const ball = balls[0];
    balls.push({ x: ball.x, y: ball.y, dx: -ball.dx, dy: -ball.dy, radius: 10, active: true });
  }
};

function drawBall(ball) {
  if (!ball.active) return;
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
  ctx.fillStyle = "#00f2ff";
  ctx.shadowColor = "#00f2ff";
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
        const brickX = c * (brick.width + brick.padding) + brick.offsetLeft;
        const brickY = r * (brick.height + brick.padding) + brick.offsetTop;
        bricks[c][r].x = brickX;
        bricks[c][r].y = brickY;

        ctx.beginPath();
        ctx.rect(brickX, brickY, brick.width, brick.height);
        ctx.fillStyle = brickColors[r % brickColors.length];
        ctx.shadowColor = brickColors[r % brickColors.length];
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.closePath();
      }
    }
  }
}

function drawPowerUps() {
  ctx.font = "12px 'Press Start 2P'";
  powerUps.forEach(p => {
    ctx.save();
    ctx.fillStyle = "#fff";
    ctx.shadowBlur = 10;
    ctx.shadowColor = "#fff";
    ctx.textAlign = "center";
    ctx.fillText(powerUpIcons[p.type], p.x, p.y);
    ctx.restore();
  });
}

function collisionDetection(ball) {
  for (let c = 0; c < brick.colCount; c++) {
    for (let r = 0; r < brick.rowCount; r++) {
      const b = bricks[c][r];
      if (b.status && ball.x > b.x && ball.x < b.x + brick.width && ball.y > b.y && ball.y < b.y + brick.height) {
        ball.dy *= -1;
        b.status = 0;
        score++;
        if (Math.random() < 0.1) {
          powerUps.push({ x: b.x + brick.width / 2, y: b.y, type: powerUpTypes[Math.floor(Math.random() * powerUpTypes.length)] });
        }
        if (score === brick.rowCount * brick.colCount) {
          if (score > highScore) localStorage.setItem("dxball_highscore", score);
          alert("🎉 YOU WIN!");
          document.location.reload();
        }
      }
    }
  }
}

function updateUI() {
  document.getElementById("score").textContent = score;
  document.getElementById("lives").textContent = lives;
  document.getElementById("highscore").textContent = highScore;
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawPaddle();
  drawBricks();
  drawPowerUps();
  balls.forEach(drawBall);

  balls.forEach(ball => {
    if (!ball.active) return;
    ball.x += ball.dx;
    ball.y += ball.dy;

    if (ball.x < ball.radius || ball.x > canvas.width - ball.radius) ball.dx *= -1;
    if (ball.y < ball.radius) ball.dy *= -1;

    if (ball.y + ball.radius >= canvas.height - paddle.height - 10 && ball.x > paddle.x && ball.x < paddle.x + paddle.width) {
      ball.dy *= -1;
    }

    if (ball.y > canvas.height) ball.active = false;
    collisionDetection(ball);
  });

  balls = balls.filter(b => b.active);
  if (balls.length === 0) {
    lives--;
    if (lives === 0) {
      alert("😢 GAME OVER!");
      document.location.reload();
    } else {
      balls = [{ x: canvas.width / 2, y: canvas.height - 30, dx: 4, dy: -4, radius: 10, active: true }];
      paddle.x = (canvas.width - paddle.width) / 2;
    }
  }

  if (paddle.movingRight && paddle.x < canvas.width - paddle.width) paddle.x += paddle.dx;
  if (paddle.movingLeft && paddle.x > 0) paddle.x -= paddle.dx;

  powerUps.forEach((p, i) => {
    p.y += 2;
    if (p.y > canvas.height - paddle.height - 10 && p.x > paddle.x && p.x < paddle.x + paddle.width) {
      powerUpEffects[p.type]();
      powerUps.splice(i, 1);
    } else if (p.y > canvas.height) {
      powerUps.splice(i, 1);
    }
  });

  updateUI();
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

document.getElementById("leftBtn").addEventListener("touchstart", () => paddle.movingLeft = true);
document.getElementById("leftBtn").addEventListener("touchend", () => paddle.movingLeft = false);
document.getElementById("rightBtn").addEventListener("touchstart", () => paddle.movingRight = true);
document.getElementById("rightBtn").addEventListener("touchend", () => paddle.movingRight = false);

if (window.DeviceOrientationEvent) {
  window.addEventListener("deviceorientation", (e) => {
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
  });
}

updateUI();
draw();
