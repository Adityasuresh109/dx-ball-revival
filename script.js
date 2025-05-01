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
  height: 15,
  width: 100,
  x: (canvas.width - 100) / 2,
  dx: 7,
  movingLeft: false,
  movingRight: false,
  originalWidth: 100
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
const powerUpEffects = {
  wide: () => {
    paddle.width = 150;
    setTimeout(() => paddle.width = paddle
