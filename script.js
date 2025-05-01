const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
// Brick colors cycle
const brickColors = ['#e74c3c', '#f39c12', '#2ecc71', '#3498db', '#9b59b6'];

// ===== Game State =====
let score = 0;
let highScore = localStorage.getItem("dxball_highscore") || 0;
let lives = 3;

// ===== Ball Setup =====
let balls = [{
  x: canvas.width / 2,
  y: canvas.height - 30,
  dx: 4,
  dy: -4,
  radius: 10,
  active: true
}];

// ===== Paddle Setup =====
let paddle = {
  height: 15,
  width: 100,
  x: (canvas.width - 100) / 2,
  dx: 7,
  movingLeft: false,
  movingRight: false,
  originalWidth: 100
};

// ===== Brick Setup =====
const brick = {
  rowCount: 5,
  colCount: 8,
  width: 75,
  height: 20,
  padding: 10,
  offsetTop: 40,
  offsetLeft: 35
};

let bricks = [];
for (let c = 0; c < brick.colCount; c++) {
  bricks[c] = [];
  for (let r = 0; r < brick.rowCount; r++) {
    bricks[c][r] = { x: 0, y: 0, status: 1 };
  }
}

// ===== Power-Up Setup =====
let powerUps = [];

const powerUpTypes = ["wide", "life", "slow", "multi"];
const powerUpEffects = {
  wide: () => {
    paddle.width = 150;
    setTimeout(() => paddle.width = paddle.originalWidth, 10000);
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
    const mainBall = balls[0];
    balls.push({
      x: mainBall.x,
      y: mainBall.y,
      dx: -mainBall.dx,
      dy: -mainBall.dy,
      radius: 10,
      active: true
    });
  }
};

// ===== Draw Functions =====
function drawBall(ball) {
  if (!ball.active) return;
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
  ctx.fillStyle = "#00f2ff";
  ctx.fill();
  ctx.closePath();
}

function drawPaddle() {
  ctx.beginPath();
  ctx.rect(paddle.x, canvas.height - paddle.height - 10, paddle.width, paddle.height);
  ctx.fillStyle = "#f39c12";
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
  powerUps.forEach(p => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 10, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.fill();
    ctx.closePath();
  });
}

// ===== Collision & Game Logic =====
function collisionDetection(ball) {
  for (let c = 0; c < brick.colCount; c++) {
    for (let r = 0; r < brick.rowCount; r++) {
      const b = bricks[c][r];
      if (b.status === 1 &&
        ball.x > b.x && ball.x < b.x + brick.width &&
        ball.y > b.y && ball.y < b.y + brick.height) {
        ball.dy *= -1;
        b.status = 0;
        score++;
        updateUI();

        // Drop power-up 10% of the time
        if (Math.random() < 0.1) {
          const type = powerUpTypes[Math.floor(Math.random() * powerUpTypes.length)];
          powerUps.push({
            x: b.x + brick.width / 2,
            y: b.y,
            type: type,
            color: type === "life" ? "lime" : type === "wide" ? "gold" : "aqua"
          });
        }

        if (score === brick.rowCount * brick.colCount) {
          if (score > highScore) {
            localStorage.setItem("dxball_highscore", score);
          }
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

    // Ball movement
    ball.x += ball.dx;
    ball.y += ball.dy;

    // Wall collisions
    if (ball.x < ball.radius || ball.x > canvas.width - ball.radius) ball.dx *= -1;
    if (ball.y < ball.radius) ball.dy *= -1;

    // Paddle collision
    if (
      ball.y + ball.radius >= canvas.height - paddle.height - 10 &&
      ball.x > paddle.x && ball.x < paddle.x + paddle.width
    ) {
      ball.dy *= -1;
    }

    // Missed ball
    if (ball.y + ball.radius > canvas.height) {
      ball.active = false;
    }

    // Brick collisions
    collisionDetection(ball);
  });

  // Remove inactive balls
  balls = balls.filter(b => b.active);
  if (balls.length === 0) {
    lives--;
    updateUI();
    if (lives === 0) {
      alert("😢 GAME OVER!");
      score = 0;
      localStorage.setItem("dxball_highscore", highScore);
      document.location.reload();
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

  // Paddle movement
  if (paddle.movingRight && paddle.x < canvas.width - paddle.width) paddle.x += paddle.dx;
  if (paddle.movingLeft && paddle.x > 0) paddle.x -= paddle.dx;

  // Power-up fall & collection
  powerUps.forEach((p, i) => {
    p.y += 3;
    if
