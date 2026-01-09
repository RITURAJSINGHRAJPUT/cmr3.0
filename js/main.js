// Mock Data
const containerData = [
    {
        id: 'CNTR123456',
        type: '20ft',
        status: 'Delivered',
        destination: 'Hamburg, DE',
        customer: 'Acme Corp',
        vessel: 'MSC Gulsun',
        eta: 'Oct 22, 2024',
        sensors: {
            temp: '12.5°C (Stable)',
            humidity: '55% (Normal)',
            lastUpdate: '10:45 AM'
        }
    },
    {
        id: 'CNTR123457',
        type: '40ft',
        status: 'In Transit',
        destination: 'Hamburg, DE',
        customer: 'Acme Corp',
        vessel: 'MSC Gulsun',
        eta: 'Oct 26, 2024',
        sensors: {
            temp: '4.0°C (Stable)',
            humidity: '60% (Normal)',
            lastUpdate: '10:48 AM'
        }
    },
    {
        id: 'CNTR123458',
        type: '40ft',
        status: 'In Transit',
        destination: 'Hamburg, DE',
        customer: 'LogiTrans',
        vessel: 'Maersk Mc-Kinney',
        eta: 'Nov 02, 2024',
        sensors: {
            temp: 'N/A',
            humidity: 'N/A',
            lastUpdate: 'No Data'
        }
    },
    {
        id: 'CNTR123459',
        type: '20ft',
        status: 'At Port',
        destination: 'Rotterdam, NL',
        customer: 'Global Foods',
        vessel: 'Hapag-Lloyd',
        eta: 'Oct 23, 2024',
        sensors: {
            temp: '-18.0°C (Frozen)',
            humidity: '45% (Dry)',
            lastUpdate: '11:00 AM'
        }
    },
    {
        id: 'CNTR123450',
        type: '40ft',
        status: 'In Transit',
        destination: 'New York, US',
        customer: 'TechSol Inc.',
        vessel: 'CMA CGM Marco Polo',
        eta: 'Nov 12, 2024',
        sensors: {
            temp: '22°C',
            humidity: '50%',
            lastUpdate: '09:30 AM'
        }
    },
    {
        id: 'CNTR123451',
        type: '20ft',
        status: 'At Port',
        destination: 'New York, US',
        customer: 'TechSol Inc.',
        vessel: 'CMA CGM Marco Polo',
        eta: 'Nov 12, 2024',
        sensors: {
            temp: '22°C',
            humidity: '50%',
            lastUpdate: '09:30 AM'
        }
    },
    {
        id: 'CNTR123452',
        type: '20ft',
        status: 'At Port',
        destination: 'Dubai, UAE',
        customer: 'BuildRight',
        vessel: 'Ever Given',
        eta: 'Oct 30, 2024',
        sensors: {
            temp: 'N/A',
            humidity: 'N/A',
            lastUpdate: 'N/A'
        }
    },
    {
        id: 'CNTR123453',
        type: '40ft',
        status: 'In Transit',
        destination: 'Singapore, SG',
        customer: 'Asia Trade',
        vessel: 'ONE Apus',
        eta: 'Nov 05, 2024',
        sensors: {
            temp: '25°C',
            humidity: '80%',
            lastUpdate: '10:00 AM'
        }
    },
];

document.addEventListener('DOMContentLoaded', () => {
    const tableBody = document.querySelector('#containerTable tbody');
    const panelContent = document.getElementById('panelContent');

    // Render Table
    function renderTable() {
        tableBody.innerHTML = '';
        containerData.forEach(container => {
            const tr = document.createElement('tr');
            tr.dataset.id = container.id;

            // Status Class Logic
            let statusClass = '';
            if (container.status === 'Delivered') statusClass = 'delivered';
            else if (container.status === 'In Transit') statusClass = 'intransit';
            else if (container.status === 'At Port') statusClass = 'atport';

            tr.innerHTML = `
                <td><strong>${container.id}</strong></td>
                <td><span style="color:var(--text-secondary)">${container.type}</span></td>
                <td><span class="badge ${statusClass}">${container.status}</span></td>
                <td>${container.destination}</td>
                <td>${container.customer}</td>
            `;

            tr.addEventListener('click', () => selectContainer(container.id));
            tableBody.appendChild(tr);
        });
    }

    // Select Container
    function selectContainer(id) {
        // Highlight row
        document.querySelectorAll('tr').forEach(r => r.classList.remove('selected'));
        const row = document.querySelector(`tr[data-id="${id}"]`);
        if (row) row.classList.add('selected');

        // Update Panel
        const data = containerData.find(c => c.id === id);
        if (!data) return;

        // Render Detail View
        let statusColor = '#000';
        if (data.status === 'Delivered') statusColor = 'var(--accent-green)';
        if (data.status === 'In Transit') statusColor = 'var(--accent-yellow)';
        if (data.status === 'At Port') statusColor = 'var(--accent-blue)';

        panelContent.innerHTML = `
            <div style="margin-bottom: 2rem;">
                <h2 style="font-size: 1.5rem; color: var(--primary); margin-bottom: 0.5rem;">${data.id}</h2>
                <span class="badge" style="background: ${statusColor}20; color: ${statusColor};">${data.status}</span>
            </div>

            <div class="detail-group">
                <div class="detail-label">Vessel</div>
                <div class="detail-value">${data.vessel}</div>
            </div>

             <div class="detail-group">
                <div class="detail-label">Destination</div>
                <div class="detail-value">${data.destination}</div>
            </div>

             <div class="detail-group">
                <div class="detail-label">Estimated Arrival</div>
                <div class="detail-value">${data.eta}</div>
            </div>

            <hr style="border:0; border-top:1px solid var(--border); margin: 1.5rem 0;">

            <h3 style="margin-bottom: 1rem; font-size: 1rem; color: var(--text-secondary);">Sensor Readings</h3>
            
            <div class="sensor-card">
                <div class="sensor-info">
                    <i class="ri-temp-cold-line"></i>
                    <div>
                        <div class="detail-label">Internal Temp</div>
                        <div class="detail-value" style="font-size:0.9rem">${data.sensors.temp}</div>
                    </div>
                </div>
            </div>
            
            <div class="sensor-card">
                <div class="sensor-info">
                    <i class="ri-drop-line"></i>
                    <div>
                        <div class="detail-label">Humidity</div>
                        <div class="detail-value" style="font-size:0.9rem">${data.sensors.humidity}</div>
                    </div>
                </div>
            </div>

            <div style="margin-top: 1rem; font-size: 0.8rem; color: var(--text-tertiary); text-align: right; margin-bottom: 2rem;">
                Last Update: ${data.sensors.lastUpdate}
            </div>

            <a href="monitor.html?id=${data.id}" class="btn-text" style="background: var(--primary); color: white; justify-content: center; padding: 0.75rem; border-radius: 8px; text-decoration: none;">
                <i class="ri-dashboard-3-line"></i> Open Live Monitor
            </a>
        `;
    }

    renderTable();
});
