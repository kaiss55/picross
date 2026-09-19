let levels = [];
let currentLevelIdx = 0;
let currentMode = 'FILL'; // 'FILL' (塗黑) 或 'CROSS' (標❌)
let playerGrid = []; // 0: 空白, 1: 塗黑, 2: 標❌
let lives = 5;
let isGameOver = false;

let isMouseDown = false;
let lastTouchedCell = null;

const boardEl = document.getElementById('board');
const levelTitleEl = document.getElementById('level-title');
const modeFillBtn = document.getElementById('mode-fill');
const modeCrossBtn = document.getElementById('mode-cross');
const livesContainer = document.getElementById('lives-container');
const statusMsg = document.getElementById('status-msg');
const resetBtn = document.getElementById('reset-btn');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');

// 初始化事件監聽
function initEvents() {
  window.addEventListener('mouseup', () => { isMouseDown = false; lastTouchedCell = null; });
  window.addEventListener('touchend', () => { isMouseDown = false; lastTouchedCell = null; });

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

  prevBtn.addEventListener('click', () => {
    if (currentLevelIdx > 0) {
      currentLevelIdx--;
      loadLevel(currentLevelIdx);
    }
  });

  nextBtn.addEventListener('click', () => {
    if (currentLevelIdx < levels.length - 1) {
      currentLevelIdx++;
      loadLevel(currentLevelIdx);
    }
  });

  resetBtn.addEventListener('click', () => {
    if (levels.length === 0) return;
    const level = levels[currentLevelIdx];
    localStorage.removeItem(`picross_save_${level.id}`);
    loadLevel(currentLevelIdx);
  });
}

// 載入關卡資料
fetch('./levels.json')
  .then(res => res.json())
  .then(data => {
    levels = data;
    initEvents();
    const savedIdx = localStorage.getItem('picross_last_level');
    if (savedIdx !== null && !isNaN(savedIdx) && savedIdx < levels.length) {
      currentLevelIdx = parseInt(savedIdx);
    }
    loadLevel(currentLevelIdx);
  })
  .catch(err => {
    console.error("載入關卡失敗:", err);
    statusMsg.innerText = "關卡資料載入失敗！";
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
    try {
      playerGrid = JSON.parse(savedBoard);
    } catch(e) {
      console.error(e);
    }
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
  const cellSize = size > 10 ? '28px' : size > 5 ? '36px' : '44px';
  
  boardEl.style.gridTemplateColumns = `repeat(${size + 1}, ${cellSize})`;
  boardEl.innerHTML = '';

  const rowClues = level.grid.map(row => getClues(row));
  const colClues = [];
  for (let c = 0; c < size; c++) {
    const col = [];
    for (let r = 0; r < size; r++) col.push(level.grid[r][c]);
    colClues.push(getClues(col));
  }

  // 左上角空白格
  boardEl.appendChild(createCell('', 'header', cellSize));

  // 頂部 數字提示
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
        if (e && e.cancelable) e.preventDefault();
        if (isGameOver) return;
        applyUserAction(r, c, cellEl, level);
      };

      cellEl.addEventListener('mousedown', (e) => {
        isMouseDown = true;
        handleAction(e);
      });

      cellEl.addEventListener('mouseenter', () => {
        if (isMouseDown) {
          applyUserAction(r, c, cellEl, level);
        }
      });

      cellEl.addEventListener('touchstart', (e) => {
        isMouseDown = true;
        handleAction(e);
      }, { passive: false });

      boardEl.appendChild(cellEl);
    }
  }

  // TouchMove 支援 (手機滑動繪製)
  boardEl.ontouchmove = (e) => {
    if (!isMouseDown || isGameOver) return;
    const touch = e.touches[0];
    const targetEl = document.elementFromPoint(touch.clientX, touch.clientY);
    if (targetEl && targetEl.classList.contains('playable')) {
      const r = parseInt(targetEl.dataset.r);
      const c = parseInt(targetEl.dataset.c);
      const cellKey = `${r}-${c}`;
      if (lastTouchedCell !== cellKey) {
        lastTouchedCell = cellKey;
        applyUserAction(r, c, targetEl, level);
      }
    }
  };
}

function applyUserAction(r, c, cellEl, level) {
  const currentState = playerGrid[r][c];
  const targetAnswer = level.grid[r][c];

  // 1. 如果玩家在【塗黑模式】
  if (currentMode === 'FILL') {
    if (currentState === 1) {
      // 已經塗黑，取消塗黑
      playerGrid[r][c] = 0;
      updateCellVisual(cellEl, 0);
    } else {
      // 欲進行塗黑動作
      if (targetAnswer === 1) {
        // 正確：填黑
        playerGrid[r][c] = 1;
        updateCellVisual(cellEl, 1);
      } else {
        // 錯誤：扣血，並自動填❌提示錯了
        triggerError(cellEl);
        playerGrid[r][c] = 2; 
        updateCellVisual(cellEl, 2);
      }
    }
  } 
  // 2. 如果玩家在【標記❌模式】
  else if (currentMode === 'CROSS') {
    if (currentState === 2) {
      // 已經標記 ❌，取消標記
      playerGrid[r][c] = 0;
      updateCellVisual(cellEl, 0);
    } else if (currentState === 0) {
      // 標記 ❌
      playerGrid[r][c] = 2;
      updateCellVisual(cellEl, 2);
    }
  }

  saveProgress(level.id);
  checkWin(level);
}

function triggerError(cellEl) {
  lives--;
  updateLivesDisplay();
  
  // 錯誤紅光與震動效果
  cellEl.classList.add('error');
  setTimeout(() => cellEl.classList.remove('error'), 400);

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
