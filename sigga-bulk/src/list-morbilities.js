import 'dotenv/config';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE_URL = process.env.SIGGA_BASE_URL;
const TOKEN = process.env.SIGGA_TOKEN;

async function listMorbilities() {
    if (!BASE_URL || !TOKEN) {
        console.error('Error: Falta SIGGA_BASE_URL o SIGGA_TOKEN en el archivo .env');
        return;
    }

    console.log('Consultando diagnósticos (morbilidades) en SIGGA...\n');

    try {
        const response = await fetch(`${BASE_URL}/morbidity`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${TOKEN}`,
            },
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        }

        const data = await response.json();
        
        // Asumiendo que la API devuelve un arreglo o un objeto con un campo data
        const list = Array.isArray(data) ? data : (data.data || []);

        if (list.length === 0) {
            console.log('No se encontraron diagnósticos o el formato de respuesta es inesperado.');
            console.log('Respuesta cruda:', JSON.stringify(data).substring(0, 500));
            return;
        }

        // Guardar en archivo
        try {
            const outputPath = join(__dirname, '..', 'morbilities.json');
            writeFileSync(outputPath, JSON.stringify(list, null, 2));
            console.log(`\nArchivo 'morbilities.json' creado en la raíz.`);
        } catch (err) {
            console.error('Error al guardar el archivo JSON:', err.message);
        }

        console.log('ID'.padEnd(8) + ' | ' + 'NOMBRE DEL DIAGNÓSTICO');
        console.log(''.padEnd(40, '─'));

        list.forEach(item => {
            const id = item.morbidity_id || item.id || item.ID || 'N/A';
            const name = item.name || item.description || item.nombre || 'N/A';
            console.log(String(id).padEnd(8) + ' | ' + name);
        });

        console.log('\n' + ''.padEnd(40, '─'));
        console.log(`Total: ${list.length} diagnósticos encontrados.`);

    } catch (error) {
        console.error('Error al consultar morbilidades:', error.message);
    }
}

listMorbilities();
