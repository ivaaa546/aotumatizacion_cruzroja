import 'dotenv/config';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// ─── Configuración ────────────────────────────────────────────────────────────
const BASE_URL = process.env.SIGGA_BASE_URL;
const TOKEN = process.env.SIGGA_TOKEN;

const DEFAULTS = {
    activity_helping_id: Number(process.env.DEFAULT_ACTIVITY_HELPING_ID),
    program_service_id: Number(process.env.DEFAULT_PROGRAM_SERVICE_ID),
    morbidity_id: Number(process.env.DEFAULT_MORBIDITY_ID),
    doctor_id: Number(process.env.DEFAULT_DOCTOR_ID),
    created_by_user_id: Number(process.env.DEFAULT_CREATED_BY_USER_ID),
    activity_date: process.env.DEFAULT_ACTIVITY_DATE,
};

// Valores fijos del sistema SIGGA
const FIXED = {
    country_of_birth_id: 1,
    town_id: 8,
    delegation_id: 4,
    document_id: 1,
    document_country_id: 1,
};

// ─── Utilidades ───────────────────────────────────────────────────────────────
const delay = (ms) => new Promise((res) => setTimeout(res, ms));

function randomDelay() {
    return delay(200 + Math.random() * 300); // 200–500 ms
}

function headers() {
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOKEN}`,
    };
}

// ─── Validación de personas ───────────────────────────────────────────────────
const REQUIRED_FIELDS = ['first_name', 'last_name', 'birthday', 'gender_id', 'address', 'community'];

function validate(persona, index) {
    const missing = REQUIRED_FIELDS.filter((f) => !persona[f]);
    if (missing.length) {
        throw new Error(`Registro #${index + 1} sin campos obligatorios: ${missing.join(', ')}`);
    }
}

// ─── API calls ────────────────────────────────────────────────────────────────
async function crearPersona(persona) {
    const body = {
        first_name: persona.first_name,
        last_name: persona.last_name,
        birthday: persona.birthday,
        gender_id: persona.gender_id,
        address: persona.address,
        community: persona.community,
        country_of_birth_id: FIXED.country_of_birth_id,
        town_id: FIXED.town_id,
        delegation_id: FIXED.delegation_id,
        created_by_user_id: DEFAULTS.created_by_user_id,
        updated_by_user_id: DEFAULTS.created_by_user_id,
    };

    if (persona.has_dpi) {
        body.document_id = FIXED.document_id;
        body.document_number = persona.document_number;
        body.document_country_id = FIXED.document_country_id;
    }

    if (persona.main_phone) {
        body.main_phone = persona.main_phone;
    }

    const res = await fetch(`${BASE_URL}/person`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(body),
    });

    const json = await res.json();

    if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${JSON.stringify(json)}`);
    }

    return json;
}

async function registrarServicio(person_id) {
    const body = {
        activity_helping_id: DEFAULTS.activity_helping_id,
        person_id,
        program_service_id: DEFAULTS.program_service_id,
        morbidity_id: DEFAULTS.morbidity_id,
        doctor_id: DEFAULTS.doctor_id,
        activity_helping_detail_at: DEFAULTS.activity_date,
        comment: '',
        created_by_user_id: DEFAULTS.created_by_user_id,
    };

    const res = await fetch(`${BASE_URL}/activityHelpingDetail`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(body),
    });

    const json = await res.json();

    if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${JSON.stringify(json)}`);
    }

    return json;
}

// ─── Procesamiento ────────────────────────────────────────────────────────────
async function procesarPersonas(personas) {
    let exitosos = 0;
    let fallidos = 0;
    const errores = [];

    for (let i = 0; i < personas.length; i++) {
        const persona = personas[i];
        const nombre = `${persona.first_name} ${persona.last_name}`;

        console.log(`\n[${i + 1}/${personas.length}] Procesando: ${nombre}`);

        try {
            validate(persona, i);
        } catch (err) {
            console.error(`  ✗ Validación: ${err.message}`);
            fallidos++;
            errores.push({ nombre, error: err.message });
            continue;
        }

        // 1. Crear persona
        let person_id;
        try {
            const respPersona = await crearPersona(persona);
            person_id = respPersona?.data?.person_id ?? respPersona?.person_id;

            if (!person_id) {
                throw new Error(`No se recibió person_id. Respuesta: ${JSON.stringify(respPersona)}`);
            }

            console.log(`  ✓ Persona creada. person_id=${person_id}`);
        } catch (err) {
            console.error(`  ✗ Error al crear persona: ${err.message}`);
            fallidos++;
            errores.push({ nombre, error: `Persona: ${err.message}` });
            await randomDelay();
            continue;
        }

        // 2. Registrar servicio
        try {
            const respServicio = await registrarServicio(person_id);
            console.log(`  ✓ Servicio registrado. Respuesta: ${JSON.stringify(respServicio)}`);
            exitosos++;
        } catch (err) {
            console.error(`  ✗ Error al registrar servicio: ${err.message}`);
            fallidos++;
            errores.push({ nombre, error: `Servicio: ${err.message}` });
        }

        await randomDelay();
    }

    // ─── Reporte final ────────────────────────────────────────────────────────
    console.log('\n══════════════════════════════════════════');
    console.log('              REPORTE FINAL');
    console.log('══════════════════════════════════════════');
    console.log(`  Total procesados : ${personas.length}`);
    console.log(`  ✓ Exitosos       : ${exitosos}`);
    console.log(`  ✗ Fallidos       : ${fallidos}`);

    if (errores.length > 0) {
        console.log('\n  Detalle de errores:');
        errores.forEach(({ nombre, error }) => {
            console.log(`    • ${nombre}: ${error}`);
        });
    }
    console.log('══════════════════════════════════════════\n');
}

// ─── Entrada principal ────────────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const fileName = process.argv[2] || 'personas.json';
const dataPath = join(__dirname, '..', 'data', fileName);

let personas;
try {
    personas = JSON.parse(readFileSync(dataPath, 'utf-8'));
    if (!Array.isArray(personas))
        throw new Error('El archivo no es un arreglo JSON.');
} catch (err) {
    console.error(`Error al leer ${fileName}: ${err.message}`);
    process.exit(1);
}

if (!BASE_URL || !TOKEN) {
    console.error('Error: Falta SIGGA_BASE_URL o SIGGA_TOKEN en el archivo .env');
    process.exit(1);
}

console.log(`\nIniciando carga masiva SIGGA desde ${fileName} — ${personas.length} persona(s)...`);
procesarPersonas(personas);
