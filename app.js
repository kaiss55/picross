let levels = [];
let currentLevelIdx = 0;
let currentMode = 'FILL'; // 'FILL' (塗黑) 或 'CROSS' (標❌)
let playerGrid = [];
let lives = 5;
let isGameOver = false;

// 滑動狀態
let isMouseDown = false;

const boardEl = document.getElementById('board');
const levelTitleEl = document.getElementById('level-title');
const modeFillBtn = document.getElementById('mode-fill');
const modeCrossBtn = document.getElementById('mode-cross');
const livesContainer = document.getElementById('lives-container');
const statusMsg = document.getElementById('status-msg');

window.addEventListener('mouseup', () => { isMouseDown = false; });
window.addEventListener('touchend', () => { isMouseDown = false; });

fetch('./levels.json')
  .then(res => res.json())
  .then(data => {
    levels = data;
    const savedIdx = localStorage.getItem('picross_last_level');
    if (savedIdx !== null) currentLevelIdx = parseInt(savedIdx);
    loadLevel(currentLevelIdx);
  });

function loadLevel(idx) {
  const level = levels[idx];
  levelTitleEl.innerText = `${level.title} (${idx + 1}/${levels.length})`;
  statusMsg.innerText = '';
  statusMsg.className = '';
  isGameOver = false;
  lives = 5;
  updateLivesDisplay();

  playerGrid = Array(level.size).fill().map(() => Array(level.size).fill(0));
  
  const savedBoard = localStorage.getItem(`picross_save_${level.id}`);
  if (savedBoard) {
    playerGrid = JSON.parse(savedBoard);
  }

  renderBoard(level);
}

function updateLivesDisplay() {
  let hearts = '';
  for (let i = 0; i < 5; i++) {
    hearts += i < lives ? '❤️' : '🖤';
  }
  livesContainer.innerText = `生命: ${hearts}`;
}

function getClues(line) {
  const clues = [];
  let count = 0;
  for (let cell of line) {
    if (cell === 1) count++;
    else if (count > 0) { clues.push(count); count = 0; }
  }
  if (count > 0) clues.push(count);
  return clues.length ? clues : [0];
}

function renderBoard(level) {
  const size = level.size;
  const cellSize = size > 10 ? '30px' : size > 5 ? '38px' : '45px';
  
  boardEl.style.gridTemplateColumns = `repeat(${size + 1}, ${cellSize})`;
  boardEl.innerHTML = '';

  const rowClues = level.grid.map(row => getClues(row));
  const colClues = [];
  for (let c = 0; c < size; c++) {
    const col = [];
    for (let r = 0; r < size; r++) col.push(level.grid[r][c]);
    colClues.push(getClues(col));
  }

  // 左上角
  boardEl.appendChild(createCell('', 'header', cellSize));

  // 頂部 Clues
  for (let c = 0; c < size; c++) {
    boardEl.appendChild(createCell(colClues[c].join('\n'), 'header', cellSize));
  }

  // 主棋盤
  for (let r = 0; r < size; r++) {
    boardEl.appendChild(createCell(rowClues[r].join(' '), 'header', cellSize));
    
    for (let c = 0; c < size; c++) {
      const cellEl = createCell('', 'playable', cellSize);
      cellEl.dataset.r = r;
      cellEl.dataset.c = c;
      updateCellVisual(cellEl, playerGrid[r][c]);

      const handleAction = (e) => {
        if (e) e.preventDefault();
        if (isGameOver) return;
        applyUserAction(r, c, cellEl, level);
      };

      cellEl.addEventListener('mousedown', (e) => {
        isMouseDown = true;
        handleAction(e);
      });
      cellEl.addEventListener('mouseenter', () => {
        if (isMouseDown) handleAction(null);
      });

      cellEl.addEventListener('touchstart', (e) => {
        isMouseDown = true;
        handleAction(e);
      });

      boardEl.appendChild(cellEl);
    }
  }

  // TouchMove 支援
  boardEl.ontouchmove = (e) => {
    if (!isMouseDown || isGameOver) return;
    const touch = e.touches[0];
    const targetEl = document.elementFromPoint(touch.clientX, touch.clientY);
    if (targetEl && targetEl.classList.contains('playable')) {
      const r = parseInt(targetEl.dataset.r);
      const c = parseInt(targetEl.dataset.c);
      applyUserAction(r, c, targetEl, level);
    }
  };
}

function applyUserAction(r, c, cellEl, level) {
  // 如果已經確定正確（填滿或劃叉），就不再觸發
  if (playerGrid[r][c] !== 0) return;

  const correctAnswer = level.grid[r][c]; // 1 代表應該黑，0 代表應該白/叉

  if (currentMode === 'FILL') {
    if (correctAnswer === 1) {
      // 答對：變黑
      playerGrid[r][c] = 1;
      updateCellVisual(cellEl, 1);
    } else {
      // 答錯：扣血，並自動填上 ❌
      triggerError(cellEl);
      playerGrid[r][c] = 2; // 強制修正為 ❌
      updateCellVisual(cellEl, 2);
    }
  } else if (currentMode === 'CROSS') {
    if (correctAnswer === 0) {
      // 答對：標 ❌
      playerGrid[r][c] = 2;
      updateCellVisual(cellEl, 2);
    } else {
      // 答錯：扣血，並自動塗黑
      triggerError(cellEl);
      playerGrid[r][c] = 1; // 強制修正為 黑色
      updateCellVisual(cellEl, 1);
    }
  }

  saveProgress(level.id);
  checkWin(level);
}

function triggerError(cellEl) {
  lives--;
  updateLivesDisplay();
  
  // 震動動畫效果
  cellEl.classList.add('error');
  setTimeout(() => cellEl.classList.remove('error'), 300);

  if (lives <= 0) {
    isGameOver = true;
    statusMsg.innerText = '💀 GAME OVER！生命值用盡！';
    statusMsg.className = 'lose';
  }
}

function createCell(text, type, size) {
  const div = document.createElement('div');
  div.className = `cell ${type}`;
  div.innerText = text;
  div.style.width = size;
  div.style.height = size;
  div.style.whiteSpace = 'pre-line';
  return div;
}

function updateCellVisual(el, state) {
  el.classList.remove('filled', 'cross');
  if (state === 1) el.classList.add('filled');
  if (state === 2) el.classList.add('cross');
}

function saveProgress(levelId) {
  localStorage.setItem(`picross_save_${levelId}`, JSON.stringify(playerGrid));
  localStorage.setItem('picross_last_level', currentLevelIdx);
}

function checkWin(level) {
  if (isGameOver) return;
  for (let r = 0; r < level.size; r++) {
    for (let c = 0; c < level.size; c++) {
      const isFilled = playerGrid[r][c] === 1 ? 1 : 0;
      if (isFilled !== level.grid[r][c]) return;
    }
  }
  statusMsg.innerText = '🎉 恭喜過關！ (SUCCESS)';
  statusMsg.className = 'win';
}

// 模式切換按鈕
modeFillBtn.addEventListener('click', () => {
  currentMode = 'FILL';
  modeFillBtn.classList.add('active');
  modeCrossBtn.classList.remove('active');
});

modeCrossBtn.addEventListener('click', () => {
  currentMode = 'CROSS';
  modeCrossBtn.classList.add('active');
  modeFillBtn.classList.remove('active');
});

document.getElementById('prev-btn').addEventListener('click', () => {
  if (currentLevelIdx > 0) { currentLevelIdx--; loadLevel(currentLevelIdx); }
});
document.getElementById('next-btn').addEventListener('click', () => {
  if (currentLevelIdx < levels.length - 1) { currentLevelIdx++; loadLevel(currentLevelIdx); }
});
document.getElementById('reset-btn').addEventListener('click', () => {
  const level = levels[currentLevelIdx];
  localStorage.removeItem(`picross_save_${level.id}`);
  loadLevel(currentLevelIdx);
});
