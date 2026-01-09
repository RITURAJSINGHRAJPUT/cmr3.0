import { app } from '../firebase-config.js';
import { getDatabase, ref, query, limitToLast, get, onChildAdded } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-database.js";

const db = getDatabase(app);
const historyRef = ref(db, 'device/history');

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
const liveQuery = query(historyRef, limitToLast(MAX_DATA_POINTS));

onChildAdded(liveQuery, (snapshot) => {
    const record = snapshot.val();
    addPointToChart(record);
});

function addPointToChart(record) {
    if (!record || record.temperature === undefined) return;

    // Check if timestamp is valid, if not use now or skip
    let timeLabel;
    if (record.timestamp) {
        timeLabel = new Date(record.timestamp).toLocaleTimeString();
    } else {
        timeLabel = new Date().toLocaleTimeString();
    }

    const temp = Number(record.temperature);

    tempChart.data.labels.push(timeLabel);
    tempChart.data.datasets[0].data.push(temp);

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

    if (temp > 30 || temp < 15) {
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
