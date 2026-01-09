import { db } from '../firebase-config.js';
import { collection, query, onSnapshot } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

// Chart Setup
const ctx = document.getElementById('tempChart').getContext('2d');
const gradientFill = ctx.createLinearGradient(0, 0, 0, 400);
gradientFill.addColorStop(0, 'rgba(16, 185, 129, 0.2)');
gradientFill.addColorStop(1, 'rgba(16, 185, 129, 0.0)');

const tempChart = new Chart(ctx, {
    type: 'line',
    data: {
        labels: [],
        datasets: [{
            label: 'Temperature (°C)',
            data: [],
            borderColor: '#10B981',
            backgroundColor: gradientFill,
            borderWidth: 3,
            fill: true,
            tension: 0.4,
            pointBackgroundColor: '#FFFFFF',
            pointBorderColor: '#10B981',
            pointRadius: 4,
            pointHoverRadius: 6
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: '#1E293B',
                padding: 12,
                titleFont: { size: 13 },
                bodyFont: { size: 14, weight: 'bold' },
                displayColors: false,
                callbacks: {
                    label: function (context) {
                        return `${context.parsed.y.toFixed(1)} °C`;
                    }
                }
            }
        },
        scales: {
            x: {
                grid: { display: false },
                ticks: { color: '#94A3B8', font: { size: 11 } }
            },
            y: {
                beginAtZero: false,
                grid: { color: '#F1F5F9', borderDash: [5, 5] },
                ticks: { color: '#64748B', font: { size: 11 } }
            }
        },
        animation: { duration: 0 }
    }
});

const MAX_DATA_POINTS = 50;

// Start Live Monitor directly
const historyCol = collection(db, 'device_history');
// Querying ALL without index. Note: This downloads all history. 
// For production with millions of rows, this is bad. 
// But for this user's request without creating an index, this is the only way to get "Latest 50".
const liveQuery = query(historyCol);

let isFirstLoad = true;

const TIME_GAP_MS = 30000; // 30 Seconds
let lastGraphTimestamp = 0;

onSnapshot(liveQuery, (snapshot) => {
    if (isFirstLoad) {
        // Client-side Sort
        let docs = snapshot.docs.map(d => d.data());
        docs.sort((a, b) => a.timestamp - b.timestamp);

        // Downsample: Take points at least 30s apart
        let downsampled = [];
        if (docs.length > 0) {
            // Always take the very last point first
            let lastTaken = docs[docs.length - 1];
            downsampled.push(lastTaken);
            let lastTakenTime = lastTaken.timestamp;

            // Iterate backwards
            for (let i = docs.length - 2; i >= 0; i--) {
                const current = docs[i];
                if (lastTakenTime - current.timestamp >= TIME_GAP_MS) {
                    downsampled.unshift(current); // Prepend
                    lastTakenTime = current.timestamp;
                }
                if (downsampled.length >= MAX_DATA_POINTS) break;
            }
        }

        downsampled.forEach(record => {
            addPointToChart(record);
        });

        if (downsampled.length > 0) {
            lastGraphTimestamp = downsampled[downsampled.length - 1].timestamp;
        }

        isFirstLoad = false;
    } else {
        snapshot.docChanges().forEach((change) => {
            if (change.type === "added") {
                const record = change.doc.data();
                if (record.timestamp - lastGraphTimestamp >= TIME_GAP_MS) {
                    addPointToChart(record);
                    lastGraphTimestamp = record.timestamp;
                }
            }
        });
    }
}, (error) => {
    console.error("Live Graph Error:", error);
});

function addPointToChart(record) {
    if (!record || record.temperature === undefined) return;

    let timeLabel;
    if (record.timestamp) {
        timeLabel = new Date(record.timestamp).toLocaleTimeString();
    } else {
        timeLabel = new Date().toLocaleTimeString();
    }

    const temp = Number(record.temperature);

    tempChart.data.labels.push(timeLabel);
    tempChart.data.datasets[0].data.push(temp);

    // Always limit in Live Mode
    if (tempChart.data.labels.length > MAX_DATA_POINTS) {
        tempChart.data.labels.shift();
        tempChart.data.datasets[0].data.shift();
    }

    updateStatusBadge(temp);
    tempChart.update();
}

function updateStatusBadge(temp) {
    const badge = document.getElementById('statusBadge');
    if (!badge) return;

    if (temp > 12 || temp < 6) {
        badge.textContent = "CRITICAL";
        badge.className = "badge-critical";
        badge.style.display = "inline-block";
        badge.style.background = '#FEF2F2';
        badge.style.color = '#DC2626';

        tempChart.data.datasets[0].borderColor = '#DC2626';
        tempChart.data.datasets[0].pointBorderColor = '#DC2626';
    } else {
        badge.textContent = "NORMAL";
        badge.className = "badge-normal";
        badge.style.display = "inline-block";
        badge.style.background = '#ECFDF5';
        badge.style.color = '#059669';

        tempChart.data.datasets[0].borderColor = '#10B981';
        tempChart.data.datasets[0].pointBorderColor = '#10B981';
    }
}
