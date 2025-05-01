const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

let score = 0;
let lives = 3;

// Ball setup
let ball = {
  x: canvas.width / 2,
  y: canvas.height - 30,
  dx: 4,
  dy: -4,
  radius: 10
};

// Paddle setup
let paddle = {
  height: 15,
  width: 100,
  x: (canvas.width - 100) / 2,
  dx: 7,
  movingLeft: false,
  movingRight: false
};

// Bricks setup
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

// Draw ball
function drawBall() {
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
  ctx.fillStyle = "#00f2ff";
  ctx.fill();
  ctx.closePath();
}

// Draw paddle
function drawPaddle() {
  ctx.beginPath();
  ctx.rect(paddle.x, canvas.height - paddle.height - 10, paddle.width, paddle.height);
  ctx.fillStyle = "#f39c12";
  ctx.fill();
  ctx.closePath();
}

// Draw bricks
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
        ctx.fillStyle = "#e74c3c";
        ctx.fill();
        ctx.closePath();
      }
    }
  }
}

// Collision detection
function collisionDetection() {
  for (let c = 0; c < brick.colCount; c++) {
    for (let r = 0; r < brick.rowCount; r++) {
      const b = bricks[c][r];
      if (b.status === 1) {
        if (
          ball.x > b.x &&
          ball.x < b.x + brick.width &&
          ball.y > b.y &&
          ball.y < b.y + brick.height
        ) {
          ball.dy *= -1;
          b.status = 0;
          score++;
          document.getElementById("score").textContent = score;

          if (score === brick.rowCount * brick.colCount) {
            alert("🎉 YOU WIN!");
            document.location.reload();
          }
        }
      }
    }
  }
}

// Draw everything
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBall();
  drawPaddle();
  drawBricks();
  collisionDetection();

  // Ball movement
  ball.x += ball.dx;
  ball.y += ball.dy;

  // Wall collisions
  if (ball.x + ball.dx > canvas.width - ball.radius || ball.x + ball.dx < ball.radius) {
    ball.dx *= -1;
  }

  if (ball.y + ball.dy < ball.radius) {
    ball.dy *= -1;
  } else if (ball.y + ball.dy > canvas.height - ball.radius - paddle.height) {
    if (ball.x > paddle.x && ball.x < paddle.x + paddle.width) {
      ball.dy *= -1;
    } else if (ball.y + ball.dy > canvas.height - ball.radius) {
      lives--;
      document.getElementById("lives").textContent = lives;

      if (!lives) {
        alert("😢 GAME OVER!");
        document.location.reload();
      } else {
        ball.x = canvas.width / 2;
        ball.y = canvas.height - 30;
        ball.dx = 4;
        ball.dy = -4;
        paddle.x = (canvas.width - paddle.width) / 2;
      }
    }
  }

  // Paddle movement
  if (paddle.movingRight && paddle.x < canvas.width - paddle.width) {
    paddle.x += paddle.dx;
  } else if (paddle.movingLeft && paddle.x > 0) {
    paddle.x -= paddle.dx;
  }

  requestAnimationFrame(draw);
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Right" || e.key === "ArrowRight") paddle.movingRight = true;
  if (e.key === "Left" || e.key === "ArrowLeft") paddle.movingLeft = true;
});

document.addEventListener("keyup", (e) => {
  if (e.key === "Right" || e.key === "ArrowRight") paddle.movingRight = false;
  if (e.key === "Left" || e.key === "ArrowLeft") paddle.movingLeft = false;
});

draw();

