// Основные переменные игры
let score = 0;
let totalReactionTime = 0;
let reactionCount = 0;
let gameStarted = false;
let gameMode = null;
let targetTimeout;
let gameInterval;
let timerInterval;
let timeLeft = 30;
let health = 3;
let fadeIntervals = {};
let currentTargetType = 'static'; // По умолчанию статичные
let movingTargets = {}; // Для хранения движущихся целей
let animationFrame; // Для анимации движения

// Получаем элементы DOM
const TARGETS_COUNT = 2; // Количество одновременно активных целей
const SPAWN_INTERVAL = 700; // Интервал появления новых целей (мс)
const GAME_DURATION = 30000; // 30 секунд для timed-режима
const FADE_DURATION = 4000;
const target = document.getElementById('target');
const gameArea = document.getElementById('gameArea');
const scoreDisplay = document.getElementById('score');
const averageTimeDisplay = document.getElementById('averageTime');
const startButton = document.getElementById('startButton');
const timerDisplay = document.getElementById('timerDisplay');
const timerElement = document.getElementById('timer');
const healthDisplay = document.getElementById('healthDisplay');
const healthElement = document.getElementById('health');
const modeButtons = document.querySelectorAll('.mode-btn');
const resultsDisplay = document.getElementById('results');
const finalScore = document.getElementById('finalScore');
const finalAverage = document.getElementById('finalAverage');
const CONFIG = {
    targets: {
        count: 3,
        spawnInterval: 1000,
        fadeDuration: 3000,
        types: ['static', 'moving'],
        speed: 1 // Скорость 
    },
    game: {
        duration: 30000
    },
    fading: {
        minRespawnDelay: 500, // Минимальная задержка
        maxRespawnDelay: 1500 // Максимальная задержка
    }
};
const targetTypeSelect = document.getElementById('targetType');
const topScores = {
    reaction: JSON.parse(localStorage.getItem('topReaction')) || [],
    timed: JSON.parse(localStorage.getItem('topTimed')) || [],
    fading: JSON.parse(localStorage.getItem('topFading')) || []
};



// Обработчик изменения типа целей
targetTypeSelect.addEventListener('change', function() {
    currentTargetType = this.value;
    if (gameStarted) {
        // Останавливаем всё
        cancelAnimationFrame(animationFrame);
        clearExistingTargets();
        Object.keys(movingTargets).forEach(id => delete movingTargets[id]);
        
        // Перезапускаем игру с новыми настройками
        if (gameMode === 'timed') {
            startTimer();
            spawnMultipleTargets();
        } else if (gameMode === 'fading') {
            spawnMultipleTargets();
        } else {
            showTarget();
        }
        
        // Если выбран движущийся режим - запускаем анимацию
        if (currentTargetType === 'moving') {
            moveTargets();
        }
    }
});

target.style.display = 'none';

function spawnMultipleTargets() {
    if (!gameStarted) return;
    
    // Удаляем угасшие цели (для режима fading)
    const existingTargets = document.querySelectorAll('[id^="target_"]');
    const targetsToRemove = TARGETS_COUNT - existingTargets.length;
    
    if (targetsToRemove <= 0) return;
    
    // Создаем новые цели
    for (let i = 0; i < targetsToRemove; i++) {
        setTimeout(() => {
            if (gameStarted) showTarget();
        }, i * 100); // Небольшая задержка между появлением
    }
}

// Функция получения случайной позиции
function getRandomPosition() {
    const areaWidth = gameArea.clientWidth - 50;
    const areaHeight = gameArea.clientHeight - 50;
    let x, y, overlapping;
    const maxAttempts = 100; // Максимальное количество попыток
    let attempts = 0;

    do {
        overlapping = false;
        x = Math.random() * areaWidth;
        y = Math.random() * areaHeight;
        
        // Проверяем все существующие цели
        document.querySelectorAll('[id^="target_"]').forEach(target => {
            const tx = parseFloat(target.style.left);
            const ty = parseFloat(target.style.top);
            const distance = Math.sqrt((x - tx) ** 2 + (y - ty) ** 2);
            if (distance < 70) overlapping = true; // 70px - минимальный отступ
        });

        if (++attempts >= maxAttempts) {
            console.warn('Не удалось найти свободное место для цели');
            break;
        }
    } while (overlapping);

    return { x, y };
}


function fadeTarget(targetElement) {
    let opacity = 1;
    const fadeInterval = setInterval(() => {
        opacity -= 0.05;
        targetElement.style.opacity = opacity;
        
        if (opacity <= 0) {
            clearInterval(fadeInterval);
            if (gameMode === 'fading' && gameStarted) {
                health--;
                healthElement.textContent = health;
                
                // Удаляем цель
                targetElement.remove();
                delete movingTargets[targetElement.id];
                
                // Добавляем задержку перед появлением новой цели
                const respawnDelay = Math.random() * 
                    (CONFIG.fading.maxRespawnDelay - CONFIG.fading.minRespawnDelay) + 
                    CONFIG.fading.minRespawnDelay;
                
                setTimeout(() => {
                    if (gameStarted && health > 0) {
                        const targets = document.querySelectorAll('[id^="target_"]');
                        if (targets.length < CONFIG.targets.count) {
                            showTarget();
                        }
                    }
                    
                    if (health <= 0) {
                        endGame();
                    }
                }, respawnDelay); // Используем нашу задержку
            }
        }
    }, 150);
    return fadeInterval;
}

// Функция создания новой цели
function createTarget() {
    const newTarget = target.cloneNode(true);
    newTarget.id = 'target_' + Date.now() + Math.random().toString(36).substr(2, 5);
    newTarget.className = `target ${currentTargetType}`;
    newTarget.style.cssText = `
        display: block;
        opacity: 1;
        left: ${Math.random() * (gameArea.clientWidth - 50)}px;
        top: ${Math.random() * (gameArea.clientHeight - 50)}px;
    `;
    
    if (currentTargetType === 'moving') {
        // Для движущихся целей добавляем случайное направление
        newTarget.dataset.dx = (Math.random() * 2 - 1) * CONFIG.targets.speed;
        newTarget.dataset.dy = (Math.random() * 2 - 1) * CONFIG.targets.speed;
        movingTargets[newTarget.id] = newTarget;
    }
    
    return newTarget;
}
function moveTargets() {
    const areaWidth = gameArea.clientWidth;
    const areaHeight = gameArea.clientHeight;

    // Обновляем список движущихся целей
    const currentTargets = document.querySelectorAll('.target.moving');
    movingTargets = {};
    currentTargets.forEach(target => {
        movingTargets[target.id] = target;
    });

    Object.keys(movingTargets).forEach(id => {
        const target = movingTargets[id];
        if (!target || !target.style) return;

        let dx = parseFloat(target.dataset.dx);
        let dy = parseFloat(target.dataset.dy);
        let x = parseFloat(target.style.left);
        let y = parseFloat(target.style.top);

        // Отскок от границ
        if (x + dx > areaWidth - 50) {
            dx = -Math.abs(dx);
            x = areaWidth - 50;
        } else if (x + dx < 0) {
            dx = Math.abs(dx);
            x = 0;
        }

        if (y + dy > areaHeight - 50) {
            dy = -Math.abs(dy);
            y = areaHeight - 50;
        } else if (y + dy < 0) {
            dy = Math.abs(dy);
            y = 0;
        }

        target.style.left = (x + dx) + 'px';
        target.style.top = (y + dy) + 'px';
        target.dataset.dx = dx;
        target.dataset.dy = dy;
    });

    if (gameStarted) {
        animationFrame = requestAnimationFrame(moveTargets);
    }
}

// Функция показа цели
function showTarget() {
    if (!gameStarted) return;
    
    const pos = getRandomPosition();
    const newTarget = target.cloneNode(true);
    newTarget.id = 'target_' + Date.now() + Math.random().toString(36).substr(2, 5);
    newTarget.className = `target ${currentTargetType}`;
    
    newTarget.style.cssText = `
        display: block;
        opacity: 1;
        left: ${pos.x}px;
        top: ${pos.y}px;
        cursor: pointer;
    `;
    
    if (currentTargetType === 'moving') {
        newTarget.dataset.dx = (Math.random() * 4 - 2) * CONFIG.targets.speed;
        newTarget.dataset.dy = (Math.random() * 4 - 2) * CONFIG.targets.speed;
        movingTargets[newTarget.id] = newTarget;
        
        if (!animationFrame && gameStarted) {
            moveTargets();
        }
    }
    
    newTarget.dataset.startTime = Date.now();
    gameArea.appendChild(newTarget);
    
    if (gameMode === 'fading') {
        fadeIntervals[newTarget.id] = fadeTarget(newTarget);
    }
    
    newTarget.addEventListener('mousedown', function(e) {
    e.preventDefault(); // Предотвращаем выделение текста при быстрых кликах
    if (!gameStarted) return;
        
        // Для движущихся целей - улучшенная проверка попадания
        if (currentTargetType === 'moving') {
            const rect = this.getBoundingClientRect();
            const dx = parseFloat(this.dataset.dx) || 0;
            const dy = parseFloat(this.dataset.dy) || 0;
            const centerX = rect.left + rect.width/2 + dx * 2;
            const centerY = rect.top + rect.height/2 + dy * 2;
            const distance = Math.sqrt(
                Math.pow(e.clientX - centerX, 2) + 
                Math.pow(e.clientY - centerY, 2)
            );
            if (distance > 30) return; // 30px - радиус попадания
        }
        
        // Обработка попадания
        if (fadeIntervals[this.id]) {
            clearInterval(fadeIntervals[this.id]);
            delete fadeIntervals[this.id];
        }
        
        if (currentTargetType === 'moving') {
        const rect = this.getBoundingClientRect();
        const dx = parseFloat(this.dataset.dx) || 0;
        const dy = parseFloat(this.dataset.dy) || 0;
        // Увеличили радиус попадания с 30px до 40px
        const distance = Math.sqrt(
            Math.pow(e.clientX - (rect.left + rect.width/2), 2) + 
            Math.pow(e.clientY - (rect.top + rect.height/2), 2)
        );
        if (distance > 40) return;
    }
        
        const reactionTime = Date.now() - this.dataset.startTime;
        totalReactionTime += reactionTime;
        reactionCount++;
        score++;
        
        updateScoreDisplay();
        this.remove();
        
        // Автоматическое создание новых целей для всех режимов
        setTimeout(() => {
            if (!gameStarted) return;
            
            const targets = document.querySelectorAll('[id^="target_"]');
            let maxTargets = 1;
            
            if (gameMode === 'reaction') {
            score+1;
            if (score >= 30) { // Останавливаем игру после 30 целей
                endGame();
                return;
            }
        }

            if (gameMode === 'timed' || gameMode === 'fading') {
                maxTargets = CONFIG.targets.count;
            }
            
            if (targets.length < maxTargets) {
                showTarget();
            }
        }, 300);
    });
}

// Обработчик клика по цели
function handleTargetClick(targetElement) {
    if (!gameStarted) return;
    
    if (fadeIntervals[targetElement.id]) {
        clearInterval(fadeIntervals[targetElement.id]);
        delete fadeIntervals[targetElement.id];
    }
    
    const reactionTime = Date.now() - targetElement.dataset.startTime;
    totalReactionTime += reactionTime;
    reactionCount++;
    score++;
    
    updateScoreDisplay();
    targetElement.remove();
    
    if (gameMode !== 'fading') {
        targetTimeout = setTimeout(showTarget, Math.random() * 1500 + 500);
    }
}

// Обновление отображения счета
function updateScoreDisplay() {
    scoreDisplay.textContent = score;
    if (reactionCount > 0) {
        averageTimeDisplay.textContent = (totalReactionTime / reactionCount).toFixed(2);
    }
}

// Очистка всех целей
function clearExistingTargets() {
    const targets = document.querySelectorAll('[id^="target_"]');
    targets.forEach(target => {
        if (fadeIntervals[target.id]) {
            clearInterval(fadeIntervals[target.id]);
            delete fadeIntervals[target.id];
        }
        target.remove();
    });
}

// Запуск таймера
function startTimer() {
    timeLeft = 30;
    timerElement.textContent = timeLeft;
    timerDisplay.style.display = 'block';
    
    timerInterval = setInterval(() => {
        timeLeft--;
        timerElement.textContent = timeLeft;
        
        if (timeLeft <= 0) {
            endGame();
        }
    }, 1000);
}

// Начало игры
function startGame() {
    // Полный сброс состояния
    cancelAnimationFrame(animationFrame);
    animationFrame = null;
    movingTargets = {};
    clearExistingTargets();
    
    // Сброс игровых переменных
    score = 0;
    totalReactionTime = 0;
    reactionCount = 0;
    gameStarted = true;
    
    // UI обновления
    updateScoreDisplay();
    startButton.textContent = 'Остановить игру';
    resultsDisplay.style.display = 'none';
    
    // Логика для разных режимов
    if (gameMode === 'timed') {
        startTimer();
        for (let i = 0; i < CONFIG.targets.count; i++) {
            setTimeout(() => gameStarted && showTarget(), i * 300);
        }
    } 
    else if (gameMode === 'fading') {
        health = 3;
        healthElement.textContent = health;
        healthDisplay.style.display = 'block';
        for (let i = 0; i < CONFIG.targets.count; i++) {
            setTimeout(() => gameStarted && showTarget(), i * 300);
        }
    } 
    else {
        setTimeout(() => gameStarted && showTarget(), 1000);
    }
    
    // Запуск движения если нужно
    if (currentTargetType === 'moving') {
        moveTargets();
    }
}

// Окончание игры
function endGame() {
    gameStarted = false;
    startButton.textContent = 'Начать игру';
    
    if (gameMode) {
        topScores[gameMode].push({
            score: score,
            average: reactionCount > 0 ? (totalReactionTime / reactionCount).toFixed(2) : '0',
            timestamp: Date.now()
        });

        // Сортируем по очкам (и времени реакции при равенстве)
        topScores[gameMode].sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            return a.average - b.average;
        });

        // Оставляем топ-3 и сохраняем
        topScores[gameMode] = topScores[gameMode].slice(0, 3);
        localStorage.setItem(`top${gameMode.charAt(0).toUpperCase() + gameMode.slice(1)}`, 
                          JSON.stringify(topScores[gameMode]));
        
        displayTopScores(); // Обновляем отображение
    }

    // Показываем результаты
    finalScore.textContent = score;
    finalAverage.textContent = reactionCount > 0 ? (totalReactionTime / reactionCount).toFixed(2) : '0';
    resultsDisplay.style.display = 'block';
    
    // Очищаем все интервалы и анимации
    clearTimeout(targetTimeout);
    clearInterval(timerInterval);
    clearInterval(gameInterval);
    cancelAnimationFrame(animationFrame);
    animationFrame = null;
    
    // Очищаем движущиеся цели
    movingTargets = {};
    
    // Удаляем все цели
    clearExistingTargets();
}

function displayTopScores() {
    const modes = ['reaction', 'timed', 'fading'];
    
    modes.forEach(mode => {
        const container = document.querySelector(`#top${mode.charAt(0).toUpperCase() + mode.slice(1)}`);
        const list = container.querySelector('ol');
        list.innerHTML = '';
        
        topScores[mode].forEach((item, index) => {
            const li = document.createElement('li');
            li.innerHTML = `
                <span class="score">${item.score} очков</span>
                <span class="time">${item.average} мс</span>
            `;
            list.appendChild(li);
        });
    });
}

// Вызовите при загрузке страницы
document.addEventListener('DOMContentLoaded', displayTopScores);

// Обработчики событий

// Выбор режима игры
modeButtons.forEach(button => {
    button.addEventListener('click', function() {
        if (gameStarted) {
            alert('Сначала остановите текущую игру!');
            return;
        }
        
        modeButtons.forEach(btn => btn.classList.remove('active'));
        this.classList.add('active');
        gameMode = this.dataset.mode;
        
        // Обновляем UI в зависимости от режима
        timerDisplay.style.display = gameMode === 'timed' ? 'block' : 'none';
        healthDisplay.style.display = gameMode === 'fading' ? 'block' : 'none';
    });
});

// Кнопка старта/остановки
startButton.addEventListener('click', function() {
    if (!gameMode) {
        alert('Выберите режим игры!');
        return;
    }

    if (!gameStarted) {
        startGame();
    } else {
        endGame();
    }
});

// Сброс статистики
document.getElementById('resetScores')?.addEventListener('click', () => {
    if (confirm('Вы уверены, что хотите сбросить все результаты? Это действие нельзя отменить.')) {
        // Очищаем хранилище
        localStorage.removeItem('topReaction');
        localStorage.removeItem('topTimed');
        localStorage.removeItem('topFading');
        
        // Очищаем текущие результаты
        topScores.reaction = [];
        topScores.timed = [];
        topScores.fading = [];
        
        // Обновляем отображение
        displayTopScores();
        
        // Визуальная обратная связь
        const btn = document.getElementById('resetScores');
        btn.innerHTML = '<i class="fas fa-check"></i> Результаты сброшены!';
        setTimeout(() => {
            btn.innerHTML = '<i class="fas fa-trash-alt"></i> Сбросить результаты';
        }, 2000);
    }
});