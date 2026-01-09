import { db } from '../firebase-config.js';
import { collection, writeBatch, doc } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

const fileInput = document.getElementById('csvFileInput');
const uploadBtn = document.getElementById('uploadBtn');
const fileNameDisplay = document.getElementById('fileName');
const statusMsg = document.getElementById('statusMsg');

// Custom Date Parser for "DD-MM-YYYY" or standard
function parseDate(dateStr) {
    if (!dateStr) return null;
    dateStr = dateStr.trim();

    // Try standard first? No, standard often prefers MM/DD for 09/01.
    // Let's check for DD-MM-YYYY or DD/MM/YYYY specifically if it looks like it.
    // Regex for d/m/y or d-m-y
    const dmy = dateStr.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(.*)$/);
    if (dmy) {
        // Detected Day-Month-Year pattern
        const day = parseInt(dmy[1], 10);
        const month = parseInt(dmy[2], 10) - 1; // 0-indexed
        const year = parseInt(dmy[3], 10);
        const timePart = dmy[4].trim(); // Time

        // If time part exists, let Date parse the time, but we set date manually
        // Or construct full string "YYYY/MM/DD TIME" which JS parses reliably
        // Easier: Parse time manually if needed, or append to ISO.

        let hours = 0, minutes = 0, seconds = 0;
        if (timePart) {
            // Check for 12h AM/PM
            const timeMatch = timePart.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?/i);
            if (timeMatch) {
                hours = parseInt(timeMatch[1], 10);
                minutes = parseInt(timeMatch[2], 10);
                seconds = timeMatch[3] ? parseInt(timeMatch[3], 10) : 0;
                const meridiem = timeMatch[4] ? timeMatch[4].toUpperCase() : null;

                if (meridiem === "PM" && hours < 12) hours += 12;
                if (meridiem === "AM" && hours === 12) hours = 0;
            }
        }

        return new Date(year, month, day, hours, minutes, seconds).getTime();
    }

    // Fallback to standard
    return new Date(dateStr).getTime();
}

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        const file = e.target.files[0];
        fileNameDisplay.textContent = file.name;
        uploadBtn.disabled = false;

        // Preview First Date
        const reader = new FileReader();
        reader.onload = (evt) => {
            const lines = evt.target.result.split(/\r?\n/).slice(0, 5);
            // Skip header if needed
            let sampleLine = lines[0];
            if (sampleLine.toLowerCase().includes('date') || sampleLine.toLowerCase().includes('timestamp')) {
                sampleLine = lines[1] || "";
            }
            if (sampleLine) {
                const parts = sampleLine.split(',');
                if (parts.length >= 1) {
                    const rawDate = parts[0];
                    const ts = parseDate(rawDate);
                    const parsedStr = new Date(ts).toString();
                    statusMsg.innerHTML = `<small style="color: #64748B;">Preview 1st Row: <b>${rawDate}</b> <br/>→ Interpreted as: <b style="color:var(--col-primary)">${parsedStr}</b></small>`;
                }
            }
        };
        reader.readAsText(file.slice(0, 1024)); // Read first 1KB
    } else {
        fileNameDisplay.textContent = 'No file selected';
        uploadBtn.disabled = true;
        statusMsg.textContent = "";
    }
});

uploadBtn.addEventListener('click', () => {
    const file = fileInput.files[0];
    if (!file) return;

    statusMsg.textContent = "Reading file...";
    statusMsg.style.color = "#64748B"; // Gray

    const reader = new FileReader();

    reader.onload = async (e) => {
        const text = e.target.result;
        await parseAndUpload(text);
    };

    reader.onerror = () => {
        statusMsg.textContent = "Error reading file.";
        statusMsg.style.color = "#DC2626";
    };

    reader.readAsText(file);
});

async function parseAndUpload(csvText) {
    statusMsg.textContent = "Parsing...";

    // Split by line
    const lines = csvText.split(/\r?\n/);
    let parsedRecords = [];

    // Simple heuristic to skip header
    let startIdx = 0;
    if (lines.length > 0) {
        const firstLine = lines[0].toLowerCase();
        if (firstLine.includes('timestamp') || firstLine.includes('date')) {
            startIdx = 1;
        }
    }

    for (let i = startIdx; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const parts = line.split(',');
        if (parts.length >= 2) {
            const timeStr = parts[0].trim();
            const tempStr = parts[1].trim();

            const timestamp = parseDate(timeStr);
            const temp = Number(tempStr);

            if (!isNaN(timestamp) && !isNaN(temp)) {
                parsedRecords.push({
                    timestamp: timestamp,
                    temperature: temp,
                    status: (temp > 12 || temp < 6) ? "CRITICAL" : "NORMAL"
                });
            }
        }
    }

    if (parsedRecords.length === 0) {
        statusMsg.textContent = "No valid data found to upload.";
        statusMsg.style.color = "#DC2626";
        return;
    }

    statusMsg.textContent = `Prepare upload for ${parsedRecords.length} records...`;

    // Firestore Batch Logic (Max 500 per batch)
    const BATCH_SIZE = 500;
    const historyCol = collection(db, 'device_history');
    let batchCount = 0;
    let successCount = 0;

    try {
        for (let i = 0; i < parsedRecords.length; i += BATCH_SIZE) {
            const chunk = parsedRecords.slice(i, i + BATCH_SIZE);
            const batch = writeBatch(db);

            chunk.forEach(record => {
                const newDocRef = doc(historyCol); // Auto-ID
                batch.set(newDocRef, record);
            });

            await batch.commit();
            successCount += chunk.length;
            batchCount++;

            // Update UI periodically
            statusMsg.textContent = `Uploaded ${successCount}/${parsedRecords.length} records...`;
        }

        statusMsg.innerHTML = `<span style="color: #059669;">Success! Uploaded ${successCount} records.</span>`;
        uploadBtn.disabled = true;
        fileInput.value = '';
        fileNameDisplay.textContent = 'Upload Complete';

    } catch (err) {
        console.error("Firestore Upload Error", err);
        statusMsg.textContent = "Error during upload: " + err.message;
        statusMsg.style.color = "#DC2626";
    }
}
