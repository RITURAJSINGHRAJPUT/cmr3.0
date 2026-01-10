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

// Time Buttons Logic
document.querySelectorAll('.btn-time').forEach(btn => {
    btn.onclick = () => {
        const minutes = parseInt(btn.dataset.min);
        const end = new Date();
        const start = new Date(end.getTime() - minutes * 60000);

        // Update Flatpickr
        document.querySelector("#startTime")._flatpickr.setDate(start);
        document.querySelector("#endTime")._flatpickr.setDate(end);

        // Auto Trigger
        applyFilterAction();
    };
});

// Spike Toggle Logic
const spikeToggle = document.getElementById('spikeToggle');
if (spikeToggle) {
    spikeToggle.onchange = () => {
        // Re-render chart with current data but filtered
        if (currentQueryDocs) {
            renderChart(currentQueryDocs);
        }
    };
}

// Export CSV Logic
const exportBtn = document.getElementById('exportBtn');
if (exportBtn) {
    exportBtn.onclick = () => {
        if (!currentQueryDocs || currentQueryDocs.length === 0) {
            alert("No data to export. Please filter data first.");
            return;
        }

        // CSV Header
        let csvContent = "data:text/csv;charset=utf-8,Timestamp,Temperature,Status\n";

        currentQueryDocs.forEach(row => {
            const time = row.timestamp ? new Date(row.timestamp).toLocaleString() : "Unknown";
            const temp = row.temperature;
            const status = row.status || (temp < 8 || temp > 16 ? "CRITICAL" : "NORMAL"); // Logic matches 8-16
            csvContent += `${time},${temp},${status}\n`;
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `temperature_data_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };
}

let currentQueryDocs = []; // Store raw data for toggle

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
        currentQueryDocs = [];
        renderChart([]);

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
    defaultDate: new Date(Date.now() - 3600000) // Default 1 hr
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
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="ri-loader-4-line ri-spin"></i> Loading...';

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

            currentQueryDocs = docs; // Save for toggle
            renderChart(docs);

            btn.innerHTML = '<i class="ri-check-line"></i> Loaded';
            setTimeout(() => btn.innerHTML = originalText, 2000);
        } else {
            alert("No data found in this range.");
            btn.innerHTML = originalText;
            currentQueryDocs = [];
            renderChart([]);
        }
    } catch (e) {
        console.error("Firestore Error:", e);
        alert("Error fetching data: " + e.message);
        btn.innerHTML = originalText;
    }
}

function renderChart(docs) {
    if (!tempChart) return;

    // Check Spike Toggle
    const showSpikesOnly = document.getElementById('spikeToggle')?.checked;

    let filtered = docs;
    if (showSpikesOnly) {
        // 8 - 16 is Safe. Spike is <8 or >16
        filtered = docs.filter(r => {
            const t = Number(r.temperature);
            return t < 8 || t > 16;
        });
    }

    const labels = [];
    const data = [];
    const pointColors = [];
    const pointRadii = [];

    filtered.forEach(record => {
        if (record.temperature === undefined) return;

        const timestamp = record.timestamp ? new Date(record.timestamp).toLocaleString() : "Unknown";
        const temp = Number(record.temperature);

        labels.push(timestamp);
        data.push(temp);

        // Visualization: Red for Violation, Green for Safe
        if (temp < 8 || temp > 16) {
            pointColors.push('#DC2626'); // Red
            pointRadii.push(5);
        } else {
            pointColors.push('#10B981'); // Green
            pointRadii.push(3);
        }
    });

    tempChart.data.labels = labels;
    tempChart.data.datasets[0].data = data;
    tempChart.data.datasets[0].pointBackgroundColor = pointColors;
    tempChart.data.datasets[0].pointBorderColor = pointColors;
    tempChart.data.datasets[0].pointRadius = pointRadii;

    // Remove old threshold datasets if any
    tempChart.data.datasets = [tempChart.data.datasets[0]];

    // Create constant line for 16
    const lineMax = Array(data.length).fill(16);
    const lineMin = Array(data.length).fill(8);

    if (data.length > 0) {
        tempChart.data.datasets.push({
            label: 'Max (16°C)',
            data: lineMax,
            borderColor: '#DC2626',
            borderWidth: 1,
            borderDash: [5, 5],
            pointRadius: 0,
            fill: false
        });
        tempChart.data.datasets.push({
            label: 'Min (8°C)',
            data: lineMin,
            borderColor: '#3B82F6',
            borderWidth: 1,
            borderDash: [5, 5],
            pointRadius: 0,
            fill: false
        });
    }

    tempChart.update();
}

// Remove old addPointToChart as unique rendering is handled by renderChart
function addPointToChart(record) {
    // Deprecated for History View mainly, but used by... wait, this file is ONLY history.
    // So we can replace it safely.
}
