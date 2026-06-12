document.addEventListener('DOMContentLoaded', async () => {
    const searchInput = document.getElementById('searchInput');
    const tableBody = document.getElementById('tableBody');
    const statsDisplay = document.getElementById('stats');
    const noResults = document.getElementById('noResults');
    
    let allMorbilities = [];

    async function loadData() {
        try {
            const response = await fetch('morbilities.json');
            if (!response.ok) throw new Error('No se pudo cargar el archivo de datos.');
            
            allMorbilities = await response.json();
            
            statsDisplay.textContent = `Total: ${allMorbilities.length} diagnósticos cargados`;
            renderTable(allMorbilities);
        } catch (error) {
            console.error('Error:', error);
            statsDisplay.textContent = 'Error al cargar los datos.';
            statsDisplay.style.color = 'var(--accent-red)';
        }
    }

    function renderTable(data) {
        tableBody.innerHTML = '';
        
        if (data.length === 0) {
            noResults.classList.remove('hidden');
            return;
        }

        noResults.classList.add('hidden');

        // We only render a limited number of results initially for performance, 
        // but the search will filter the whole list.
        const fragment = document.createDocumentFragment();
        
        data.forEach(item => {
            const tr = document.createElement('tr');
            
            const id = item.morbidity_id || 'N/A';
            const cie = item.code_cie || 'N/A';
            const name = item.name || item.description || 'N/A';

            tr.innerHTML = `
                <td class="id-cell">${id}</td>
                <td class="cie-cell">${cie}</td>
                <td>${name}</td>
            `;
            fragment.appendChild(tr);
        });
        
        tableBody.appendChild(fragment);
    }

    searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        
        const filtered = allMorbilities.filter(item => {
            const id = String(item.morbidity_id || '').toLowerCase();
            const name = String(item.name || item.description || '').toLowerCase();
            const cie = String(item.code_cie || '').toLowerCase();
            
            return id.includes(term) || name.includes(term) || cie.includes(term);
        });
        
        renderTable(filtered);
        statsDisplay.textContent = `Encontrados: ${filtered.length} de ${allMorbilities.length}`;
    });

    loadData();
});
