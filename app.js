let levels = [];
let currentLevelIdx = 0;
let currentMode = 'FILL'; // 'FILL' 或 'CROSS'
let playerGrid = [];

// DOM 元素
const boardEl = document.getElementById('board');
const levelTitleEl = document.getElementById('level-title');
const modeBtn = document.getElementById('mode-btn');
const statusMsg = document.getElementById('status-msg');

// 載入關卡
fetch('./levels.json')
  .then(res => res.json())
  .then(data => {
    levels = data;
    // 讀取上次玩到的關卡進度
    const savedIdx = localStorage.getItem('picross_last_level');
    if (savedIdx !== null) currentLevelIdx = parseInt(savedIdx);
    loadLevel(currentLevelIdx);
  });

function loadLevel(idx) {
  const level = levels[idx];
  levelTitleEl.innerText = `${level.title} (${idx + 1}/${levels.length})`;
  statusMsg.innerText = '';
  
  // 初始化玩家網格 (0: 留白, 1: 填滿, 2: 叉號)
  playerGrid = Array(level.size).fill().map(() => Array(level.size).fill(0));
  
  // 嘗試讀取存檔
  const savedBoard = localStorage.getItem(`picross_save_${level.id}`);
  if (savedBoard) {
    playerGrid = JSON.parse(savedBoard);
  }

  renderBoard(level);
}

// 計算提示數字 (Run-length Encoding)
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
  boardEl.style.gridTemplateColumns = `repeat(${size + 1}, 45px)`;
  boardEl.innerHTML = '';

  // 計算行與列提示
  const rowClues = level.grid.map(row => getClues(row));
  const colClues = [];
  for (let c = 0; c < size; c++) {
    const col = [];
    for (let r = 0; r < size; r++) col.push(level.grid[r][c]);
    colClues.push(getClues(col));
  }

  // 左上角空白格
  boardEl.appendChild(createCell('', 'header'));

  // 頂部列提示
  for (let c = 0; c < size; c++) {
    boardEl.appendChild(createCell(colClues[c].join('\n'), 'header'));
  }

  // 繪製棋盤主體
  for (let r = 0; r < size; r++) {
    // 左側行提示
    boardEl.appendChild(createCell(rowClues[r].join(' '), 'header'));
    
    for (let c = 0; c < size; c++) {
      const cellEl = createCell('', 'playable');
      updateCellVisual(cellEl, playerGrid[r][c]);

      // 點擊事件
      cellEl.addEventListener('click', () => {
        if (currentMode === 'FILL') {
          playerGrid[r][c] = playerGrid[r][c] === 1 ? 0 : 1;
        } else {
          playerGrid[r][c] = playerGrid[r][c] === 2 ? 0 : 2;
        }
        updateCellVisual(cellEl, playerGrid[r][c]);
        saveProgress(level.id);
        checkWin(level);
      });

      boardEl.appendChild(cellEl);
    }
  }
}

function createCell(text, type) {
  const div = document.createElement('div');
  div.className = `cell ${type}`;
  div.innerText = text;
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
  for (let r = 0; r < level.size; r++) {
    for (let c = 0; c < level.size; c++) {
      const isFilled = playerGrid[r][c] === 1 ? 1 : 0;
      if (isFilled !== level.grid[r][c]) return;
    }
  }
  statusMsg.innerText = '🎉 恭喜過關！ (SUCCESS)';
}

// 切換模式與關卡按鈕
modeBtn.addEventListener('click', () => {
  if (currentMode === 'FILL') {
    currentMode = 'CROSS';
    modeBtn.innerText = '當前模式：標記 (CROSS)';
    modeBtn.className = 'active-cross';
  } else {
    currentMode = 'FILL';
    modeBtn.innerText = '當前模式：填滿 (FILL)';
    modeBtn.className = 'active-fill';
  }
});

document.getElementById('prev-btn').addEventListener('click', () => {
  if (currentLevelIdx > 0) { currentLevelIdx--; loadLevel(currentLevelIdx); }
});
document.getElementById('next-btn').addEventListener('click', () => {
  if (currentLevelIdx < levels.length - 1) { currentLevelIdx++; loadLevel(currentLevelIdx); }
});
document.getElementById('reset-btn').addEventListener('click', () => {
  const level = levels[currentLevelIdx];
  playerGrid = Array(level.size).fill().map(() => Array(level.size).fill(0));
  saveProgress(level.id);
  renderBoard(level);
});