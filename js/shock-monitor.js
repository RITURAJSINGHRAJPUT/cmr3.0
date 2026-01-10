import { rtdb } from '../firebase-config.js';
import { ref, onValue } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-database.js";

// DOM Elements
const gForceDisplay = document.getElementById('gForceVal');
const statusCard = document.getElementById('mainStatusCard');
const statusText = document.getElementById('statusText');
const tiltIcon = document.getElementById('tiltIcon');
const tiltText = document.getElementById('tiltText');
const vibBar = document.getElementById('vibBar');
const vibVal = document.getElementById('vibVal');
const resetBtn = document.getElementById('resetShockBtn');

// State
let isShocked = false;
let maxShockVal = 0;
// Data Buffer for Smoother Animation
let latestX = 0;
let latestY = 0;
let latestZ = 1; // Default gravity

// Chart Setup
const ctx = document.getElementById('accelChart').getContext('2d');
const accelChart = new Chart(ctx, {
    type: 'line',
    data: {
        labels: Array(50).fill(''),
        datasets: [
            { label: 'X', data: Array(50).fill(0), borderColor: '#0EA5E9', borderWidth: 2, pointRadius: 0, tension: 0.4 },
            { label: 'Y', data: Array(50).fill(0), borderColor: '#22C55E', borderWidth: 2, pointRadius: 0, tension: 0.4 },
            { label: 'Z', data: Array(50).fill(1), borderColor: '#EF4444', borderWidth: 2, pointRadius: 0, tension: 0.4 }
        ]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false, // Keep false for performant scrolling
        scales: {
            y: { grid: { color: '#F1F5F9' } },
            x: { display: false }
        },
        plugins: { legend: { display: false } }
    }
});

// Firebase Listener
const deviceRef = ref(rtdb, 'device');

onValue(deviceRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
        const mpu = data.mpu || {};

        // Update Latest Values (Chart Loop will pick these up)
        latestX = Number(mpu.x || mpu.accel_x || 0);
        latestY = Number(mpu.y || mpu.accel_y || 0);
        latestZ = Number(mpu.z || mpu.accel_z || 0);

        analyzeMotion(latestX, latestY, latestZ);

        // 2. Explicit Alert Flags
        const deviceShockFlag = (mpu.shock === true);
        const alertType = data.alert ? data.alert.type : "";

        if (deviceShockFlag || alertType === "SHOCK") {
            const magnitude = Math.sqrt(latestX * latestX + latestY * latestY + latestZ * latestZ);
            triggerShock(magnitude > 1 ? magnitude : 3.0);
        }
    }
});

// Animation Loop (Updates Chart every 100ms)
setInterval(() => {
    updateChart(latestX, latestY, latestZ);
}, 100);

function updateChart(x, y, z) {
    accelChart.data.datasets[0].data.push(x);
    accelChart.data.datasets[0].data.shift();
    accelChart.data.datasets[1].data.push(y);
    accelChart.data.datasets[1].data.shift();
    accelChart.data.datasets[2].data.push(z);
    accelChart.data.datasets[2].data.shift();
    accelChart.update();
}

function analyzeMotion(x, y, z) {
    const magnitude = Math.sqrt(x * x + y * y + z * z);

    // Vibration
    const vib = Math.sqrt(x * x + y * y);
    if (vibBar) {
        vibBar.style.width = Math.min(vib * 100, 100) + '%';
        if (vibVal) vibVal.innerText = vib.toFixed(2) + ' RMS';
    }

    // Shock Detection logic (backup to flag)
    if (magnitude > 2.5) {
        triggerShock(magnitude);
    } else if (!isShocked) {
        if (gForceDisplay) gForceDisplay.innerText = magnitude.toFixed(1) + 'G';
    }

    // Tilt Detection
    const isTipped = Math.abs(z) < 0.5 || Math.abs(x) > 0.8 || Math.abs(y) > 0.8;
    if (isTipped) {
        triggerTilt();
    }
}

function triggerShock(force) {
    if (force > maxShockVal) maxShockVal = force;

    if (isShocked) {
        gForceDisplay.innerText = maxShockVal.toFixed(1) + 'G';
        return;
    }

    isShocked = true;

    if (statusCard) {
        statusCard.classList.add('critical');
        statusCard.style.background = "linear-gradient(135deg, #FEF2F2 0%, #FEE2E2 100%)";
        statusCard.style.borderColor = "#EF4444";
    }

    if (statusText) {
        statusText.innerText = "IMPACT DETECTED";
        statusText.style.color = "#DC2626";
    }

    if (gForceDisplay) {
        gForceDisplay.innerText = force.toFixed(1) + 'G';
        gForceDisplay.style.color = "#DC2626";
    }

    if (resetBtn) {
        resetBtn.style.borderColor = "#EF4444";
        resetBtn.style.color = "#EF4444";
        resetBtn.innerText = "Acknowledge Alert";
    }
}

let tiltTimeout;
function triggerTilt() {
    if (tiltIcon) tiltIcon.classList.add('tipped');
    if (tiltText) {
        tiltText.innerText = "TIPPED";
        tiltText.style.color = "#DC2626";
    }

    clearTimeout(tiltTimeout);
    tiltTimeout = setTimeout(() => {
        if (tiltIcon) tiltIcon.classList.remove('tipped');
        if (tiltText) {
            tiltText.innerText = "Upright";
            tiltText.style.color = "#1E293B";
        }
    }, 3000);
}

// Reset Handler
if (resetBtn) {
    resetBtn.onclick = () => {
        isShocked = false;
        maxShockVal = 0;

        if (statusCard) {
            statusCard.classList.remove('critical');
            statusCard.style.background = "linear-gradient(135deg, #F0FDF4 0%, #DCFCE7 100%)";
            statusCard.style.borderColor = "#10B981";
        }

        if (statusText) {
            statusText.innerText = "HANDLING NORMAL";
            statusText.style.color = "#15803D";
        }

        if (gForceDisplay) {
            gForceDisplay.innerText = "0.1G";
            gForceDisplay.style.color = "#1E293B";
        }

        resetBtn.style.borderColor = "#94A3B8";
        resetBtn.style.color = "#64748B";
        resetBtn.innerText = "Reset Status";
    };
}
