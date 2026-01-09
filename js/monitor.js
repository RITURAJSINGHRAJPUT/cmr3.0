document.addEventListener('DOMContentLoaded', () => {
    // 1. Get Params
    const urlParams = new URLSearchParams(window.location.search);
    const containerId = urlParams.get('id') || 'CNTR-DEFAULT';

    // We could use the ID to fetch specific data, but for now we'll stick to the "Vaccine" mock
    console.log(`Monitoring Container: ${containerId}`);

    // Update Brand Text or Title if needed
    // document.querySelector('.brand-text h1').textContent = `Monitor: ${containerId}`;

    // 2. Simulate Live Data Updates
    const tempElement = document.getElementById('tempValue');
    const updateElement = document.getElementById('lastUpdated');

    // Base temperature around 5.4
    let currentTemp = 5.4;

    setInterval(() => {
        // Random fluctuation between -0.1 and +0.1
        const fluctuation = (Math.random() * 0.2) - 0.1;
        currentTemp = currentTemp + fluctuation;

        // Clamp to realistic "Safe" range for demo
        if (currentTemp < 4.8) currentTemp = 4.8;
        if (currentTemp > 6.0) currentTemp = 6.0;

        // Update DOM
        tempElement.textContent = `${currentTemp.toFixed(1)}°C`;

        // Update "Last updated" text
        updateElement.textContent = 'Just now';
        setTimeout(() => {
            updateElement.textContent = '1 second ago';
        }, 1000);

    }, 5000); // Every 5 seconds
});
