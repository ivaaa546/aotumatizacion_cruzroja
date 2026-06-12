const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const fileStatus = document.getElementById('fileStatus');
const fileNameDisplay = document.getElementById('fileName');
const removeFileBtn = document.getElementById('removeFile');
const startBtn = document.getElementById('startBtn');
const terminalOutput = document.getElementById('terminalOutput');
const btnText = startBtn.querySelector('.btn-text');
const spinner = startBtn.querySelector('.spinner');

// Settings Modal Elements
const settingsBtn = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
const closeSettings = document.getElementById('closeSettings');
const settingsForm = document.getElementById('settingsForm');
const saveSettingsBtn = document.getElementById('saveSettings');

let currentFile = null;
let eventSource = null;

// Drag and Drop Events
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, preventDefaults, false);
});

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => dropZone.classList.add('dragover'), false);
});

['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => dropZone.classList.remove('dragover'), false);
});

dropZone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    handleFiles(files);
});

fileInput.addEventListener('change', function() {
    handleFiles(this.files);
});

function handleFiles(files) {
    if (files.length) {
        const file = files[0];
        if (file.name.endsWith('.json')) {
            currentFile = file;
            fileNameDisplay.textContent = file.name;
            
            // UI Toggle
            Array.from(dropZone.children).forEach(el => {
                if(el.id !== 'fileStatus') el.style.display = 'none';
            });
            fileStatus.classList.remove('hidden');
            startBtn.disabled = false;
            
        } else {
            alert('Por favor, sube un archivo JSON válido.');
        }
    }
}

removeFileBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    currentFile = null;
    fileInput.value = '';
    
    Array.from(dropZone.children).forEach(el => {
        if(el.id !== 'fileStatus') el.style.display = 'block';
        if(el.tagName === 'INPUT') el.style.display = 'none'; 
    });
    
    fileStatus.classList.add('hidden');
    startBtn.disabled = true;
});

function appendLog(text, type = 'normal') {
    const lines = text.split('\n');
    lines.forEach(line => {
        if(!line.trim()) return;
        const div = document.createElement('div');
        div.className = `log-line ${type}`;
        
        // Colorear ticks y cross
        let formattedLine = line;
        
        if (formattedLine.includes('✓')) {
            div.classList.add('success');
        } else if (formattedLine.includes('✗') || formattedLine.includes('Error')) {
            div.classList.add('error');
        } else if (formattedLine.includes('·')) {
            div.classList.add('warning');
        }
        
        // Eliminar control characters puros por si acaso
        formattedLine = formattedLine.replace(/\x1b\[[0-9;]*m/g, ''); 
        
        div.textContent = formattedLine;
        terminalOutput.appendChild(div);
    });
    
    terminalOutput.scrollTop = terminalOutput.scrollHeight;
}

startBtn.addEventListener('click', async () => {
    if (!currentFile) return;

    // UI Updates
    startBtn.disabled = true;
    btnText.textContent = "Procesando...";
    spinner.classList.remove('hidden');
    terminalOutput.innerHTML = '';
    appendLog('Inicializando proceso...', 'info');

    const jobType = document.querySelector('input[name="jobType"]:checked').value;
    
    // 1. Upload File
    const formData = new FormData();
    formData.append('file', currentFile);

    try {
        const uploadRes = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });
        
        if (!uploadRes.ok) throw new Error('Error al subir el archivo');
        
        const { jobId } = await uploadRes.json();
        
        // 2. Iniciar SSE para ver logs reales
        if (eventSource) eventSource.close();
        
        eventSource = new EventSource(`/api/stream?jobId=${jobId}&type=${jobType}`);
        
        eventSource.onmessage = (e) => {
            const data = JSON.parse(e.data);
            
            if (data.type === 'stdout' || data.type === 'stderr') {
                appendLog(data.text);
            } else if (data.type === 'close') {
                appendLog(`\nProceso finalizado con código ${data.code}`, 'info');
                eventSource.close();
                resetBtnState();
            }
        };

        eventSource.onerror = () => {
            appendLog('\nSe cerró la conexión con el servidor.', 'error');
            eventSource.close();
            resetBtnState();
        };

    } catch (err) {
        appendLog(`Error crítico: ${err.message}`, 'error');
        resetBtnState();
    }
});

function resetBtnState() {
    startBtn.disabled = false;
    btnText.textContent = "Iniciar Procesamiento";
    spinner.classList.add('hidden');
}

// Morbilities Modal Elements
const morbilitiesBtn = document.getElementById('morbilitiesBtn');
const morbilitiesModal = document.getElementById('morbilitiesModal');
const closeMorbilities = document.getElementById('closeMorbilities');
const morbilitiesList = document.getElementById('morbilitiesList');
const morbilitiesSearch = document.getElementById('morbilitiesSearch');

let allMorbilities = [];

// ... (existing settings modal code)

// --- Morbilities Modal Logic ---
morbilitiesBtn.addEventListener('click', async () => {
    morbilitiesModal.classList.remove('hidden');
    await loadMorbilities();
});

closeMorbilities.addEventListener('click', () => {
    morbilitiesModal.classList.add('hidden');
});

morbilitiesModal.addEventListener('click', (e) => {
    if (e.target === morbilitiesModal) morbilitiesModal.classList.add('hidden');
});

morbilitiesSearch.addEventListener('input', (e) => {
    renderMorbilities(e.target.value);
});

async function loadMorbilities() {
    morbilitiesList.innerHTML = '<p>Cargando...</p>';
    morbilitiesSearch.value = '';
    try {
        const res = await fetch('/api/morbilities');
        allMorbilities = await res.json();
        renderMorbilities();
    } catch (err) {
        morbilitiesList.innerHTML = '<p style="color: var(--accent-red)">Error al cargar diagnósticos.</p>';
    }
}

function renderMorbilities(filter = '') {
    const filtered = allMorbilities.filter(item => {
        const id = String(item.morbidity_id || item.id || item.ID || '').toLowerCase();
        const name = String(item.name || item.description || item.nombre || '').toLowerCase();
        const searchTerm = filter.toLowerCase();
        return id.includes(searchTerm) || name.includes(searchTerm);
    });

    if (filtered.length === 0) {
        morbilitiesList.innerHTML = '<p>No se encontraron diagnósticos.</p>';
        return;
    }

    let html = `
        <table class="morbilities-table">
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Nombre</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    filtered.forEach(item => {
        const id = item.morbidity_id || item.id || item.ID || 'N/A';
        const name = item.name || item.description || item.nombre || 'N/A';
        html += `<tr><td>${id}</td><td>${name}</td></tr>`;
    });
    
    html += `</tbody></table>`;
    morbilitiesList.innerHTML = html;
}

settingsBtn.addEventListener('click', async () => {
    settingsModal.classList.remove('hidden');
    await loadSettings();
});

closeSettings.addEventListener('click', () => {
    settingsModal.classList.add('hidden');
});

settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) settingsModal.classList.add('hidden');
});

async function loadSettings() {
    try {
        const res = await fetch('/api/config');
        const config = await res.json();
        
        Object.keys(config).forEach(key => {
            const input = settingsForm.querySelector(`[name="${key}"]`);
            if (input) input.value = config[key];
        });
    } catch (err) {
        alert('Error al cargar la configuración');
    }
}

saveSettingsBtn.addEventListener('click', async () => {
    const formData = new FormData(settingsForm);
    const data = {};
    formData.forEach((value, key) => {
        data[key] = value;
    });

    saveSettingsBtn.disabled = true;
    saveSettingsBtn.textContent = 'Guardando...';

    try {
        const res = await fetch('/api/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (res.ok) {
            appendLog('Configuración actualizada correctamente', 'success');
            settingsModal.classList.add('hidden');
        } else {
            throw new Error('Error al guardar');
        }
    } catch (err) {
        alert('No se pudo guardar la configuración');
    } finally {
        saveSettingsBtn.disabled = false;
        saveSettingsBtn.textContent = 'Guardar Cambios';
    }
});
