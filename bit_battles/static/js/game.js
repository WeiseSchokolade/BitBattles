let timerElement;
let truthtable;
let alertsElement;
let resultsPlayerList;
let currentStage = null;

window.addEventListener("DOMContentLoaded", (event) => {
    loadStage(battle.stage);
    timerElement = document.getElementById("timer");
    truthtable = document.getElementById("truthtable");
    alertsElement = document.getElementById("alerts");
    resultsPlayerList = document.getElementById("results-player-list");
});

function resetGame() {
    secondsElapsed = 0;
    placedGates = [];
    placedWires = [];
    placedConnectors = [];
    rotation = 0;
    
    bufferContext.clearRect(0, 0, canvas.width, canvas.height);
    drawGrid();
    drawCanvas();

    const children = [...truthtable.children];
    for (const child of children) {
        if (child.id === "test-column") {
            child.innerHTML = '<div class="title">Pass</div>';
            continue;
        }
        child.remove();
    }
}

let gamesCounter = 0;

function loadStage(stage) {
    if (currentStage) currentStage.classList.remove("active");
    currentStage = document.getElementById(stage);
    currentStage.classList.add("active");

    if (stage === "queue" && gamesCounter) {
        resetGame();
    }
    if (stage === "battle") {
        requestAnimationFrame(updateTimer);
        loadGateButtons(battle.gates);
        loadTruthtable(battle.truthtable);
        loadGates(battle.truthtable);
    }
    if (stage === "results") {
        loadResults();
        gamesCounter++;
    }
}

function loadGateButtons(gates) {
    gates.forEach(gate => {
        document.getElementById(`${gate}-btn`).classList.add("active");
    });
} 


function loadTruthtable(data) {
    const testColumn = document.getElementById("test-column");
    let firstOutput = false;
    let columnLength = 0;

    for (const [key, values] of Object.entries(data)) {
        const column = document.createElement("div");
        const title = document.createElement("div");
        title.classList.add("title")
        title.innerText = key

        column.appendChild(title);
        values.forEach(value => {
            const cell = document.createElement("div");
            cell.classList.add("cell");
            cell.classList.add(value? "on": "off");
            cell.innerText = value;

            column.appendChild(cell);
        });
        
        if (key.charCodeAt(0) > 77 && !firstOutput) {
            column.classList.add("output");
            firstOutput = true;
        }

        truthtable.appendChild(column);
        columnLength = values.length;
    }

    for (let i = 0; i < columnLength; i++) {
        const cell = document.createElement("div");
        cell.classList.add("cell");
        cell.innerText = "v";
        cell.id = `test-${i}`;

        testColumn.appendChild(cell);
    }
}

function loadGates(data) {
    let inputY = 60;
    let outputY = 60;

    for (const key of Object.keys(data)) {
        if (key.charCodeAt(0) > 77) {
            const gate = objects["OUTPUT"];
            const [inputCoordinates, outputCoordinates] = setConnectors(gate, 500, outputY);

            placedGates.push({
                x: 500, 
                y: outputY, 
                type: "OUTPUT", 
                rotation: 0, 
                inputs: inputCoordinates, 
                output: outputCoordinates,
                id: key,
            });
            outputY += 2 * gridSize;
            continue;
        }

        const gate = objects["INPUT"];
        const [inputCoordinates, outputCoordinates] = setConnectors(gate, 20, inputY);

        placedGates.push({
            x: 20, 
            y: inputY, 
            type: "INPUT",
            rotation: 0, 
            inputs: inputCoordinates, 
            output: outputCoordinates,
            id: key,
        });
        inputY += 2 * gridSize;
    }

    drawGrid();
    drawCanvas();
}

let secondsElapsed = 0;
let lastTime = performance.now();

function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secondsRemaining = seconds % 60;
    return (
        String(minutes).padStart(2, '0') + ':' +
        String(secondsRemaining).padStart(2, '0')
    );
}

function updateTimer(timestamp) {
    const elapsed = timestamp - lastTime;

    if (elapsed >= 1000) {
        secondsElapsed++;
        timerElement.textContent = formatTime(secondsElapsed);
               
        lastTime = timestamp;
    }
    requestAnimationFrame(updateTimer);
}

async function submit() {
    const response = await fetch(`/api/battle/${battle.id}/submit`, {
        method: "POST",
        body: JSON.stringify({"gates": placedGates, "wires": placedWires}),
        headers: {"Authorization": `Bearer ${getCookie("bt")}`, "Content-Type": "application/json"}
    });

    try {
        const json = await response.json()
        if (!response.ok) return sendAlert(json.error);
        if (!json.passed) return sendAlert("You did not pass the test.");
    } catch {
        sendAlert("Unexpected error.");
    }
}

let alerts = [];

function sendAlert(message) {
    if (alerts.length >= 5) {
        const element = alerts.shift();
        element.remove();
    }

    const alertElement = document.createElement("div");
    alertElement.classList.add("alert");
    alertElement.innerText = message;
    alerts.push(alertElement);
    alertsElement.appendChild(alertElement);

    updateAlertPositions();

    setTimeout(() => {
        const index = alerts.indexOf(alertElement);
        if (index > -1) {
            alerts.splice(index, 1);
            alertElement.remove();
            updateAlertPositions();
        }
    }, 30000);
}

function updateAlertPositions() {
    alerts.forEach((alert, index) => {
        alert.style.bottom = `${10 + (30 * index)}px`;
    });
}


function addResultPlayer(_player, gatesAverage, pathAverage, timeAverage) {
    const element = document.createElement("div");
    const timePerformance = (_player.time - timeAverage).toFixed(2);
    const gatePerformance = (_player.gates - gatesAverage).toFixed(2);
    const pathPerformance = (_player.longest_path - pathAverage).toFixed(2);
    element.innerHTML = `
        <h4>[${_player.score}] ${_player.username}${_player.id === player.id? " (you)": ""}</h4>
        <p>
            Time: ${formatSeconds(_player.time)} (${timePerformance <= 0? 
                `<span class="good">${timePerformance}s</span>`: 
                `<span class="bad">+${timePerformance}s</span>`
            }) Gates: ${_player.gates} (${gatePerformance <= 0? 
                `<span class="good">${gatePerformance}</span>`: 
                `<span class="bad">+${gatePerformance}</span>`
            }) Longest path: ${_player.longest_path} (${pathPerformance <= 0? 
                `<span class="good">${pathPerformance}</span>`: 
                `<span class="bad">+${pathPerformance}</span>`
            })
        </p>
    `
    return element;
}

async function loadResults() {
    let gatesAverage = 0;
    let pathAverage = 0;
    let timeAverage = 0;

    battle.players.forEach(_player => {
        gatesAverage += _player.gates;
        pathAverage += _player.longest_path;
        timeAverage += _player.time;
    });

    gatesAverage /= battle.players.length;
    pathAverage /= battle.players.length;
    timeAverage /= battle.players.length;
    
    resultsPlayerList.innerHTML += `
        <h2>Battle ${gamesCounter + 1}</h2>
        <ul>
            <li>Average gates: ${gatesAverage}</li>
            <li>Average longest path: ${pathAverage}</li>
            <li>Average time: ${formatSeconds(timeAverage)}</li>
        </ul>    
    `
    battle.players.forEach(_player => {
        resultsPlayerList.appendChild(addResultPlayer(_player, gatesAverage, pathAverage, timeAverage));
    });
}

async function restartGame() {
    const response = await fetch(`/api/battle/${battle.id}/restart`, {
        method: "POST",
        headers: {"Authorization": `Bearer ${getCookie("bt")}`}
    });

    if (!response.ok) return;
}

function formatSeconds(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = (seconds % 60).toFixed(3);

    return `${minutes}m ${remainingSeconds}s`;
}