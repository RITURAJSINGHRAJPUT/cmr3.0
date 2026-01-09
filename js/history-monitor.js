import { db } from '../firebase-config.js';
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

// Chart Setup
const ctx = document.getElementById('tempChart').getContext('2d');
const gradientFill = ctx.createLinearGradient(0, 0, 0, 400);
gradientFill.addColorStop(0, 'rgba(59, 130, 246, 0.2)');
gradientFill.addColorStop(1, 'rgba(59, 130, 246, 0.0)');

const tempChart = new Chart(ctx, {
    type: 'line',
    data: {
        labels: [],
        datasets: [{
            label: 'Temperature (°C)',
            data: [],
            borderColor: '#3B82F6',
            backgroundColor: gradientFill,
            borderWidth: 2,
            fill: true,
            tension: 0.4,
            pointBackgroundColor: '#FFFFFF',
            pointBorderColor: '#3B82F6',
            pointRadius: 3,
            pointHoverRadius: 5
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
        }
    }
});

// Listener
document.getElementById('filterBtn').onclick = applyFilterAction;
const clearBtn = document.getElementById('clearBtn');
if (clearBtn) clearBtn.onclick = clearHistoryData;

import { deleteDoc, doc } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

async function clearHistoryData() {
    if (!confirm("Are you sure you want to DELETE ALL history data? This cannot be undone.")) return;

    const btn = document.getElementById('clearBtn');
    const originalText = btn.innerHTML;
    btn.innerHTML = 'Deleting...';
    btn.disabled = true;

    try {
        const historyCol = collection(db, 'device_history');
        const q = query(historyCol);
        const snapshot = await getDocs(q);

        // Batched delete would be better for many docs, but simple loop for now
        const deletePromises = snapshot.docs.map(d => deleteDoc(doc(db, 'device_history', d.id)));
        await Promise.all(deletePromises);

        alert("History Cleared Successfully.");
        // Clear chart
        tempChart.data.labels = [];
        tempChart.data.datasets[0].data = [];
        tempChart.update();

    } catch (e) {
        console.error("Error clearing history:", e);
        alert("Failed to clear history: " + e.message);
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

// Initialize Flatpickr 24h
flatpickr("#startTime", {
    enableTime: true,
    dateFormat: "Y-m-d H:i",
    time_24hr: true,
    defaultDate: new Date(Date.now() - 86400000) // 24 hours ago
});
flatpickr("#endTime", {
    enableTime: true,
    dateFormat: "Y-m-d H:i",
    time_24hr: true,
    defaultDate: new Date()
});

async function applyFilterAction() {
    const startInput = document.getElementById('startTime').value;
    const endInput = document.getElementById('endTime').value;

    if (!startInput || !endInput) { alert("Please select range"); return; }

    const start = new Date(startInput).getTime();
    const end = new Date(endInput).getTime();

    if (start >= end) { alert("Invalid Range"); return; }

    const btn = document.getElementById('filterBtn');
    btn.innerHTML = '<i class="ri-loader-4-line ri-spin"></i> Loading...';

    // Clear Chart
    tempChart.data.labels = [];
    tempChart.data.datasets[0].data = [];
    tempChart.update();

    // Firestore Query
    const historyCol = collection(db, 'device_history');

    // Removing orderBy to avoid Index requirement. Client side sort preferred for ad-hoc history queries without managing indexes.
    const q = query(historyCol,
        where("timestamp", ">=", start),
        where("timestamp", "<=", end)
    );

    try {
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            // Client-side sort
            const docs = querySnapshot.docs.map(doc => doc.data());
            docs.sort((a, b) => a.timestamp - b.timestamp);

            docs.forEach((record) => {
                addPointToChart(record);
            });
            btn.innerHTML = '<i class="ri-check-line"></i> Loaded';
        } else {
            alert("No data found in this range.");
            btn.innerHTML = '<i class="ri-filter-3-line"></i> Filter';
        }
    } catch (e) {
        console.error("Firestore Error:", e);
        alert("Error fetching data: " + e.message);
        btn.innerHTML = '<i class="ri-filter-3-line"></i> Filter';
    }
}

function addPointToChart(record) {
    if (!record || record.temperature === undefined) return;

    let timeLabel;
    if (record.timestamp) {
        timeLabel = new Date(record.timestamp).toLocaleString();
    } else {
        timeLabel = "Unknown";
    }

    const temp = Number(record.temperature);

    tempChart.data.labels.push(timeLabel);
    tempChart.data.datasets[0].data.push(temp);

    tempChart.update();
}
