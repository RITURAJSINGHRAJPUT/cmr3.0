import { app } from '../firebase-config.js';
import { getDatabase, ref, onValue, push } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-database.js";

const db = getDatabase(app);
const deviceRef = ref(db, 'device');

const tempElement = document.querySelector('.temp-val');
const trendIcon = document.querySelector('.trend-icon');
const alertBar = document.querySelector('.alert-bar');
const marker = document.querySelector('.current-marker');
const badge = document.querySelector('.badge-critical');
const activityElement = document.querySelector('.dot-val');

// Variables moved to top of file
const historyTableBody = document.querySelector('.history-table tbody');
// State Variables
let lastLogTime = 0;
let isFirstTableLoad = true;
let lastDataTime = Date.now(); // Track last update time
let sensorFaultTriggered = false;
let latestSensorStatus = "WORKING"; // Track explicit status

/* Audio Alarm Logic Init */
let lastAlarmTime = 0;
// Initialize AudioContext lazily or handle suspension
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playBeep() {
    // Resume context if suspended (browser policy)
    if (audioCtx.state === 'suspended') {
        audioCtx.resume().then(() => {
            console.log("AudioContext resumed successfully");
        }).catch(e => console.error("Could not resume AudioContext:", e));
    }

    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 frequency

    // Fade out to avoid clicking sound
    gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + 0.15);

    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.15);
}

function triggerAlarm() {
    const now = Date.now();
    // Throttle: Don't beep more often than every 2 seconds
    if (now - lastAlarmTime < 2000) return;

    console.log("Triggering Audio Alarm!");
    lastAlarmTime = now;
    playBeep();
    setTimeout(playBeep, 200); // Second beep
}

// Global listener to unlock audio on first interaction
document.body.addEventListener('click', () => {
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}, { once: true });
document.body.addEventListener('input', () => {
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}, { once: true });


// Main Listener
onValue(deviceRef, (snapshot) => {
    const data = snapshot.val();
    console.log("Device Data:", data);

    if (data) {
        // Heartbeat Logic:
        // Prefers last_seen timestamp if available, otherwise any data update counts
        // We just track the timestamp of *reception* of this data
        lastDataTime = Date.now();

        // 1. Temperature
        if (data.temperature !== undefined) {
            updateTempUI(Number(data.temperature));
        }

        // 2. Humidity / Status
        if (activityElement) {
            const status = data.sensor_status || "Active";
            latestSensorStatus = status; // Update global

            const hum = data.humidity !== undefined ? `${data.humidity}% Hum` : "Unknown Hum";

            const isGood = (status === "WORKING" || status === "ACTIVE" || status === "Active");
            const dotColor = isGood ? "green" : "orange";
            activityElement.innerHTML = `<span class="dot ${dotColor}"></span> ${status} / ${hum}`;

            // Handle "Not Working" Visuals immediately
            const card = document.querySelector('.main-temp-card');
            if (card && !sensorFaultTriggered) {
                if (!isGood) {
                    // Turn div reddish
                    card.style.backgroundColor = '#FEF2F2';
                    card.style.borderLeftColor = 'var(--col-danger)';
                    activityElement.style.color = 'var(--col-danger)';

                    // Update Badge
                    if (badge) {
                        badge.textContent = 'SENSOR FAULT';
                        badge.style.background = '#FEF2F2';
                        badge.style.color = '#DC2626';
                    }
                    if (trendIcon) {
                        trendIcon.className = 'ri-error-warning-fill trend-icon';
                        trendIcon.style.color = '#DC2626';
                    }
                } else {
                    // Reset if Good (and not in timeout fault)
                    card.style.backgroundColor = 'white';
                    activityElement.style.color = '';
                    // Note: Border color is handled by updateTempUI which runs before/after this
                }
            }
        }
    }
});

function updateTempUI(temp) {
    if (tempElement) tempElement.textContent = `${temp.toFixed(1)}°C`;

    // Visual Range 0-40C
    if (marker) {
        let percent = (temp / 40) * 100;
        if (percent < 0) percent = 0;
        if (percent > 100) percent = 100;
        marker.style.left = `${percent}%`;
    }

    // Dynamic Thresholds
    const minInput = document.getElementById('minTempInput');
    const maxInput = document.getElementById('maxTempInput');

    // Check if configured
    if (!minInput.value || !maxInput.value) {
        // Not configured state
        if (alertBar) alertBar.style.display = 'none';

        if (badge) {
            badge.style.display = 'inline-block';
            badge.textContent = 'SET THRESHOLDS';
            badge.style.background = '#FEF3C7'; // Warning BG
            badge.style.color = '#D97706'; // Warning Text
        }
        if (trendIcon) {
            trendIcon.className = 'ri-information-line trend-icon';
            trendIcon.style.color = '#D97706';
        }
        const card = document.querySelector('.main-temp-card');
        if (card) card.style.borderLeftColor = '#CBD5E1'; // Neutral

        // Do not update chart colors based on critical, just default
        updateChart(temp, false);
        updateHistoryTable(temp, false);
        return;
    }

    const minVal = parseFloat(minInput.value);
    const maxVal = parseFloat(maxInput.value);

    const isCritical = temp < minVal || temp > maxVal;

    if (isCritical) {
        // 1. Alert Bar force hidden
        if (alertBar) alertBar.style.display = 'none';

        // 2. Trigger Alarm
        triggerAlarm();

        // 3. Update Badge
        if (badge) {
            badge.style.display = 'inline-block';
            badge.textContent = 'CRITICAL ALERT';
            badge.style.background = '#FEF2F2';
            badge.style.color = '#DC2626';
        }
        if (trendIcon) {
            trendIcon.className = 'ri-error-warning-fill trend-icon';
            trendIcon.style.color = '#DC2626';
        }
        const card = document.querySelector('.main-temp-card');
        if (card) card.style.borderLeftColor = 'var(--col-danger)';
    } else {
        if (alertBar) alertBar.style.display = 'none';

        if (badge) {
            badge.textContent = 'ALL SYSTEMS NORMAL';
            badge.style.background = '#ECFDF5';
            badge.style.color = '#059669';
        }
        if (trendIcon) {
            trendIcon.className = 'ri-check-double-line trend-icon';
            trendIcon.style.color = '#059669';
        }
        const card = document.querySelector('.main-temp-card');
        if (card) card.style.borderLeftColor = 'var(--col-success)';
    }

    updateChart(temp, isCritical);
    updateHistoryTable(temp, isCritical);
}

function updateChart(temp, isCritical) {
    const chart = document.querySelector('.bar-chart');
    if (!chart) return;

    const bar = document.createElement('div');
    bar.className = isCritical ? 'bar danger' : 'bar normal';
    // Map 0-40 height
    const height = Math.max(20, Math.min(150, (temp / 40) * 150));
    bar.style.height = `${height}px`;
    bar.style.width = '15%';

    chart.appendChild(bar);
    if (chart.children.length > 8) {
        // filter for chart bars to remove oldest
        const bars = Array.from(chart.children).filter(c => c.classList.contains('bar'));
        if (bars.length > 7) {
            // we remove the first element that is a bar. 
            // Note: chart.children includes the absolute threshold div which we want to keep.
            // Safe way: remove chart.children[0] if it's a bar
            if (chart.children[0].classList.contains('bar')) {
                chart.removeChild(chart.children[0]);
            } else if (chart.children[1] && chart.children[1].classList.contains('bar')) {
                chart.removeChild(chart.children[1]);
            }
        }
    }
}

// Heartbeat Verify Interval
setInterval(() => {
    const now = Date.now();
    // 3 seconds timeout as requested (User: "read laste seen if it didnt updated for 3 sec")
    if (now - lastDataTime > 3000) {
        if (!sensorFaultTriggered) {
            // triggerSensorFault(); // DISABLED for now as per user request
        }
    } else {
        if (sensorFaultTriggered) {
            clearSensorFault();
        }
    }
}, 500); // Check every 500ms for precision

function triggerSensorFault() {
    sensorFaultTriggered = true;
    console.warn("Sensor Fault Detected: No data for > 3s");

    // 1. Show Popup
    const popup = document.getElementById('sensorFaultPopup');
    if (popup) {
        const popupText = popup.querySelector('p');
        if (popupText) popupText.textContent = "Data transmission interrupted. Last signal > 3s ago.";
        popup.style.display = 'flex';
    }

    // 2. Visual Status Update
    if (activityElement) {
        activityElement.innerHTML = `<span class="dot red"></span> SENSOR INACTIVE / --% Hum`;
        activityElement.style.color = 'var(--col-danger)';
    }
    const card = document.querySelector('.main-temp-card');
    if (card) {
        // "change the div color to reddish color"
        // Changing border and background to indicate failure state clearly
        card.style.borderLeftColor = 'var(--col-danger)';
        card.style.backgroundColor = '#FEF2F2'; // var(--col-danger-bg)
    }

    // Update Badge
    const badge = document.querySelector('.badge-critical');
    if (badge) {
        badge.textContent = 'SENSOR INACTIVE';
        badge.style.background = '#FEF2F2';
        badge.style.color = '#DC2626';
    }
    const trendIcon = document.querySelector('.trend-icon');
    if (trendIcon) {
        trendIcon.className = 'ri-error-warning-fill trend-icon';
        trendIcon.style.color = '#DC2626';
    }

    // 3. Audio Alarm
    // Use existing trigger logic but force it
    triggerAlarm();

    // 4. Add Log
    addHistoryLog("N/A", true, "SENSOR INACTIVE");
}

function clearSensorFault() {
    sensorFaultTriggered = false;
    console.log("Sensor Connection Restored");

    // 1. Hide Popup
    const popup = document.getElementById('sensorFaultPopup');
    if (popup) popup.style.display = 'none';

    // 2. Reset Visuals (Respecting explicit status)
    const card = document.querySelector('.main-temp-card');
    if (card) {
        const isGood = (latestSensorStatus === "WORKING" || latestSensorStatus === "ACTIVE" || latestSensorStatus === "Active");
        if (isGood) {
            card.style.backgroundColor = 'white';
            // Border color reset by updateTempUI logic flow
        } else {
            // Keep it red if status is still bad
            card.style.backgroundColor = '#FEF2F2';
            card.style.borderLeftColor = 'var(--col-danger)';
        }
    }
    if (activityElement) {
        const isGood = (latestSensorStatus === "WORKING" || latestSensorStatus === "ACTIVE" || latestSensorStatus === "Active");
        if (isGood) {
            activityElement.style.color = '';
        } else {
            activityElement.style.color = 'var(--col-danger)';
        }
    }
}

function addHistoryLog(tempVal, isFail = false, failMsg = "BREACH") {
    if (!historyTableBody) return;

    // Specially logging faults:
    if (isFail && failMsg === "SENSOR LOSS") {
        const row = document.createElement('tr');
        row.className = 'highlight-red';
        const timestamp = new Date().toLocaleTimeString();
        row.innerHTML = `
            <td><span class="bold-red">${timestamp}</span></td>
            <td>Connectivity</td>
            <td><span class="italic-grey">No Signal</span></td>
            <td><span class="badge-breach">FAULT</span></td>
            <td><span class="italic-grey">Alert & Popup Triggered</span></td>
        `;
        historyTableBody.prepend(row);
        if (historyTableBody.children.length > 50) historyTableBody.removeChild(historyTableBody.lastElementChild);
    }
}

function updateHistoryTable(temp, isCritical) {
    if (!historyTableBody) return;
    if (sensorFaultTriggered) return; // Don't log normal temp rows if we are in fault state (the data shouldn't be coming in anyway though)

    const now = Date.now();
    // Log every 5 seconds for demo purposes
    if (now - lastLogTime < 5000 && !isFirstTableLoad) return;

    lastLogTime = now;

    // PERSISTENCE: Push to Firebase History for Graph
    try {
        const historyRef = ref(db, 'device/history');
        push(historyRef, {
            temperature: temp,
            timestamp: now,
            status: isCritical ? "CRITICAL" : "NORMAL"
        });
    } catch (e) {
        console.error("Error logging to history:", e);
    }

    // Clear hardcoded rows on first real data arrival
    if (isFirstTableLoad) {
        historyTableBody.innerHTML = '';
        isFirstTableLoad = false;
    }

    const row = document.createElement('tr');
    if (isCritical) row.className = 'highlight-red';

    const timestamp = new Date().toLocaleTimeString();

    let statusBadge = '<span class="badge-normal">NORMAL</span>';
    let action = '-';
    let tempDisplay = `<strong>${temp.toFixed(1)}°C</strong>`;

    if (isCritical) {
        statusBadge = '<span class="badge-breach">BREACH</span>';
        action = '<span class="italic-grey">System alert triggered</span>';
        tempDisplay = `<span class="bold-red temp-log-val">${temp.toFixed(1)}°C</span>`;
    }

    row.innerHTML = `
        <td>${isCritical ? '<span class="bold-red">' : ''}${timestamp}${isCritical ? '</span>' : ''}</td>
        <td>Internal Temp</td>
        <td>${tempDisplay}</td>
        <td>${statusBadge}</td>
        <td>${action}</td>
    `;

    historyTableBody.prepend(row);

    // Keep max 50 rows
    if (historyTableBody.children.length > 50) {
        historyTableBody.removeChild(historyTableBody.lastElementChild);
    }
}

// Export Functionality
const exportBtn = document.querySelector('.history-section .btn-text');
if (exportBtn) {
    exportBtn.addEventListener('click', () => {
        const rows = Array.from(historyTableBody.querySelectorAll('tr'));
        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += "Timestamp,Metric,Reading,Status,Action Taken\n";

        rows.forEach(row => {
            const cols = row.querySelectorAll('td');
            const data = Array.from(cols).map(col => col.textContent.trim());
            csvContent += data.join(",") + "\n";
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "temperature_logs.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });
}
