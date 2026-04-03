/**
 * consultation.js
 * Automatiza el registro de consultas médicas en SIGGA.
 * Flujo por cada registro:
 *   1. POST /person              → person_id
 *   2. POST /consultation        → consultation_id
 *   3. PATCH /consultation/{id}  → historial médico
 *   4. PATCH /consultation/{id}  → signos vitales
 *
 * Uso: node src/consultation.js [archivo.json]
 * Por defecto lee: data/consultas.json
 */
import 'dotenv/config';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// ─── Configuración ────────────────────────────────────────────────────────────
const BASE_URL = process.env.SIGGA_BASE_URL;
const TOKEN = process.env.SIGGA_TOKEN;

const DEFAULTS = {
    delegation_area_service_id: Number(process.env.DEFAULT_DELEGATION_AREA_SERVICE_ID),
    personnel_id: Number(process.env.DEFAULT_PERSONNEL_ID),
    period_id: Number(process.env.DEFAULT_PERIOD_ID),
    created_by_user_id: Number(process.env.DEFAULT_CREATED_BY_USER_ID),
    updated_by_user_id: Number(process.env.DEFAULT_CREATED_BY_USER_ID),
};

// Valores fijos del sistema SIGGA
const FIXED = {
    country_of_birth_id: 1,
    town_id: 2,
    delegation_id: 4,
    document_id: 1,
    document_country_id: 1,
};

// ─── Utilidades ───────────────────────────────────────────────────────────────
const delay = (ms) => new Promise((res) => setTimeout(res, ms));
const randomDelay = () => delay(200 + Math.random() * 300);

function headers() {
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOKEN}`,
    };
}

// ─── Validación ───────────────────────────────────────────────────────────────
const REQUIRED_PERSON = ['first_name', 'last_name', 'birthday', 'gender_id', 'address', 'community'];
const REQUIRED_CONSULTATION = ['motive'];

function validate(registro, index) {
    const missingPerson = REQUIRED_PERSON.filter((f) => !registro[f]);
    if (missingPerson.length)
        throw new Error(`Registro #${index + 1} — faltan campos de persona: ${missingPerson.join(', ')}`);

    if (!registro.consultation)
        throw new Error(`Registro #${index + 1} — falta la sección "consultation"`);

    const missingConsulta = REQUIRED_CONSULTATION.filter((f) => !registro.consultation[f]);
    if (missingConsulta.length)
        throw new Error(`Registro #${index + 1} — faltan campos de consulta: ${missingConsulta.join(', ')}`);
}

// ─── API calls ────────────────────────────────────────────────────────────────

/** 1. Crear persona → devuelve person_id (recupera si ya existe) */
async function crearPersona(registro) {
    const body = {
        first_name: registro.first_name,
        last_name: registro.last_name,
        birthday: registro.birthday,
        gender_id: registro.gender_id,
        address: registro.address,
        zone: registro.zone ?? null,
        community: registro.community,
        country_of_birth_id: FIXED.country_of_birth_id,
        town_id: registro.town_id ?? FIXED.town_id,
        delegation_id: registro.delegation_id ?? FIXED.delegation_id,
        created_by_user_id: DEFAULTS.created_by_user_id,
        updated_by_user_id: DEFAULTS.updated_by_user_id,
    };

    if (registro.has_dpi) {
        body.document_id = FIXED.document_id;
        body.document_number = registro.document_number;
        body.document_country_id = FIXED.document_country_id;
    }

    const res = await fetch(`${BASE_URL}/person`, { method: 'POST', headers: headers(), body: JSON.stringify(body) });
    const json = await res.json();

    // Si es duplicado, buscar la persona existente por document_number
    if (!res.ok && json?.code === '23000' && registro.has_dpi && registro.document_number) {
        const getRes = await fetch(`${BASE_URL}/person?document_number=${registro.document_number}&per_page=1`, { headers: headers() });
        const getData = await getRes.json();
        const items = getData?.data?.data ?? getData?.data ?? [];
        const person_id = items[0]?.person_id ?? items[0]?.id;
        if (person_id) return { _recovered: true, data: { person_id } };
        throw new Error(`Registro duplicado y no se pudo recuperar person_id por DPI.`);
    }

    if (!res.ok) throw new Error(`HTTP ${res.status}: ${JSON.stringify(json)}`);
    return json;
}

/** 2. Registrar como paciente → devuelve patient_id */
async function registrarPaciente(person_id, delegation_id) {
    const body = {
        person_id,
        delegation_id: delegation_id ?? FIXED.delegation_id,
        created_by_user_id: DEFAULTS.created_by_user_id,
    };
    const res = await fetch(`${BASE_URL}/patient`, { method: 'POST', headers: headers(), body: JSON.stringify(body) });
    const json = await res.json();
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${JSON.stringify(json)}`);

    // El API no devuelve patient_id → buscarlo con GET
    await new Promise(r => setTimeout(r, 300));
    const getRes = await fetch(`${BASE_URL}/patient?person_id=${person_id}&per_page=1`, { headers: headers() });
    const getData = await getRes.json();
    const items = getData?.data?.data ?? getData?.data ?? [];
    const patient_id = items[0]?.patient_id ?? items[0]?.id;
    return { patient_id };
}

/** 3. Crear consulta → devuelve consultation_id */
async function crearConsulta(patient_id, consulta) {
    const body = {
        form_code: consulta.form_code ?? null,
        delegation_area_service_id: consulta.delegation_area_service_id ?? DEFAULTS.delegation_area_service_id,
        personnel_id: consulta.personnel_id ?? DEFAULTS.personnel_id,
        consultation_date: consulta.consultation_date ?? new Date().toISOString(),
        price: consulta.price ?? 0,
        motive: consulta.motive,
        comment: consulta.comment ?? '',
        patient_id,
        period_id: consulta.period_id ?? DEFAULTS.period_id,
        created_by_user_id: DEFAULTS.created_by_user_id,
    };

    const res = await fetch(`${BASE_URL}/consultation`, { method: 'POST', headers: headers(), body: JSON.stringify(body) });
    const json = await res.json();
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${JSON.stringify(json)}`);

    // El API no devuelve el consultation_id directamente → buscar el más reciente del paciente
    await new Promise(r => setTimeout(r, 300));
    const getRes = await fetch(`${BASE_URL}/consultation?patient_id=${patient_id}&per_page=1&sort=desc`, { headers: headers() });
    const getData = await getRes.json();
    const items = getData?.data?.data ?? getData?.data ?? [];
    const consultation_id = items[0]?.consultation_id ?? items[0]?.id;
    if (!consultation_id) throw new Error(`Consulta creada pero no se pudo obtener consultation_id`);
    return { consultation_id };
}

/** 3. Actualizar historial médico */
async function actualizarHistorial(consultation_id, historial) {
    if (!historial) return null;

    const body = {
        delegation_area_service_id: DEFAULTS.delegation_area_service_id,
        personnel_id: DEFAULTS.personnel_id,
        motive: historial.motive,
        medical_history: historial.medical_history ?? 'No refiere',
        surgical_history: historial.surgical_history ?? 'No refiere',
        injury_history: historial.injury_history ?? 'No refiere',
        allergic_history: historial.allergic_history ?? 'No refiere',
        addiction_history: historial.addiction_history ?? 'No refiere',
        familiar_history: historial.familiar_history ?? 'No refiere',
        gynecological_history: historial.gynecological_history ?? null,
        gestation: historial.gestation ?? '0',
        birth: historial.birth ?? '0',
        misbirth: historial.misbirth ?? '0',
        cst: historial.cst ?? null,
        fur: historial.fur ?? '0',
        fpp: historial.fpp ?? '0',
        hv: historial.hv ?? '0',
        hm: historial.hm ?? '0',
        menarche: historial.menarche ?? '',
        contraceptive: historial.contraceptive ?? 0,
        contraceptive_method: historial.contraceptive_method ?? null,
        illness_history: historial.illness_history ?? null,
        has_perinatal_history: historial.has_perinatal_history ?? 0,
        perinatal_description: historial.perinatal_description ?? null,
        birth_weight: historial.birth_weight ?? null,
        birth_size: historial.birth_size ?? null,
        social_profile: historial.social_profile ?? null,
        eating_habits: historial.eating_habits ?? null,
        growth_and_development: historial.growth_and_development ?? null,
    };

    const res = await fetch(`${BASE_URL}/consultation/${consultation_id}`, { method: 'PUT', headers: headers(), body: JSON.stringify(body) });
    const json = await res.json();
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${JSON.stringify(json)}`);
    return json;
}

/** 4. Actualizar signos vitales */
async function actualizarVitales(consultation_id, vitales) {
    if (!vitales) return null;

    const body = {
        heart_rate: vitales.heart_rate ?? null,
        breathing_frequency: vitales.breathing_frequency ?? null,
        pulse: vitales.pulse ?? null,
        temperature: vitales.temperature ?? null,
        pa: vitales.pa ?? null,
        size: vitales.size ?? null,
        weight: vitales.weight ?? null,
        imc: vitales.imc ?? null,
        medical_comment: vitales.medical_comment ?? '',
        medical_testing: vitales.medical_testing ?? null,
        updated_by_user_id: DEFAULTS.updated_by_user_id,
    };

    const res = await fetch(`${BASE_URL}/consultation/${consultation_id}`, { method: 'PUT', headers: headers(), body: JSON.stringify(body) });
    const json = await res.json();
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${JSON.stringify(json)}`);
    return json;
}

// ─── Procesamiento ────────────────────────────────────────────────────────────
async function procesarConsultas(registros) {
    let exitosos = 0;
    let fallidos = 0;
    const errores = [];

    for (let i = 0; i < registros.length; i++) {
        const reg = registros[i];
        const nombre = `${reg.first_name} ${reg.last_name}`;
        console.log(`\n[${i + 1}/${registros.length}] Procesando: ${nombre}`);

        // Validación
        try {
            validate(reg, i);
        } catch (err) {
            console.error(`  ✗ Validación: ${err.message}`);
            fallidos++;
            errores.push({ nombre, error: err.message });
            continue;
        }

        // 1. Crear persona (o usar id manual)
        let person_id = reg.person_id;
        if (!person_id) {
            try {
                const resp = await crearPersona(reg);
                person_id = resp?.data?.person_id ?? resp?.person_id;
                if (!person_id) throw new Error(`No se recibió person_id. Respuesta: ${JSON.stringify(resp)}`);
                console.log(`  ✓ Persona creada.       person_id=${person_id}`);
            } catch (err) {
                console.error(`  ✗ Error al crear persona: ${err.message}`);
                fallidos++;
                errores.push({ nombre, error: `Persona: ${err.message}` });
                await randomDelay();
                continue;
            }
        } else {
            console.log(`  · Usando person_id manual: ${person_id}`);
        }

        // 2. Registrar como paciente y obtener patient_id
        let patient_id = reg.patient_id; // soporte para patient_id manual
        try {
            const result = await registrarPaciente(person_id, reg.delegation_id);
            patient_id = result.patient_id;
            console.log(`  ✓ Paciente registrado.  patient_id=${patient_id}`);
        } catch (err) {
            if (JSON.stringify(err.message).includes('duplicad') || JSON.stringify(err.message).includes('23000')) {
                // Paciente ya existe → buscarlo con GET
                try {
                    const getRes = await fetch(`${BASE_URL}/patient?person_id=${person_id}&per_page=1`, { headers: headers() });
                    const getData = await getRes.json();
                    const items = getData?.data?.data ?? getData?.data ?? [];
                    patient_id = items[0]?.patient_id ?? items[0]?.id ?? reg.patient_id;
                    console.log(`  · Paciente ya registrado. patient_id recuperado: ${patient_id}`);
                } catch {
                    console.log(`  · Paciente ya registrado. Usando patient_id manual: ${patient_id ?? '(no especificado)'}`);
                }

            } else {
                console.error(`  ✗ Error al registrar paciente: ${err.message}`);
                fallidos++;
                errores.push({ nombre, error: `Paciente: ${err.message}` });
                await randomDelay();
                continue;
            }
        }

        if (!patient_id) {
            console.error(`  ✗ No se pudo obtener patient_id. Agrega "patient_id": <ID> al JSON manualmente.`);
            fallidos++;
            errores.push({ nombre, error: 'patient_id desconocido (registro duplicado)' });
            await randomDelay();
            continue;
        }

        // 3. Crear consulta
        let consultation_id;
        try {
            const resp2 = await crearConsulta(patient_id, reg.consultation);
            consultation_id = resp2?.data?.consultation_id ?? resp2?.consultation_id ?? resp2?.id;
            if (!consultation_id) throw new Error(`No se recibió consultation_id. Respuesta: ${JSON.stringify(resp2)}`);
            console.log(`  ✓ Consulta creada.      consultation_id=${consultation_id}`);
        } catch (err) {
            console.error(`  ✗ Error al crear consulta: ${err.message}`);
            fallidos++;
            errores.push({ nombre, error: `Consulta: ${err.message}` });
            await randomDelay();
            continue;
        }

        // 3. Historial médico (opcional)
        try {
            if (reg.medical_history) {
                await actualizarHistorial(consultation_id, { ...reg.medical_history, motive: reg.consultation.motive });
                console.log(`  ✓ Historial médico guardado.`);
            } else {
                console.log(`  · Historial médico omitido (no incluido en el registro).`);
            }
        } catch (err) {
            console.error(`  ✗ Error en historial médico: ${err.message}`);
            errores.push({ nombre, error: `Historial: ${err.message}` });
        }

        // 4. Signos vitales (opcional)
        try {
            if (reg.vitals) {
                await actualizarVitales(consultation_id, reg.vitals);
                console.log(`  ✓ Signos vitales guardados.`);
            } else {
                console.log(`  · Signos vitales omitidos (no incluido en el registro).`);
            }
        } catch (err) {
            console.error(`  ✗ Error en signos vitales: ${err.message}`);
            errores.push({ nombre, error: `Vitales: ${err.message}` });
        }

        exitosos++;
        await randomDelay();
    }

    // ─── Reporte final ────────────────────────────────────────────────────────
    console.log('\n══════════════════════════════════════════');
    console.log('           REPORTE DE CONSULTAS');
    console.log('══════════════════════════════════════════');
    console.log(`  Total procesados : ${registros.length}`);
    console.log(`  ✓ Exitosos       : ${exitosos}`);
    console.log(`  ✗ Fallidos       : ${fallidos}`);
    if (errores.length) {
        console.log('\n  Detalle de errores:');
        errores.forEach(({ nombre, error }) => console.log(`    • ${nombre}: ${error}`));
    }
    console.log('══════════════════════════════════════════\n');
}

// ─── Entrada principal ────────────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const fileName = process.argv[2] || 'consultas.json';
const dataPath = join(__dirname, '..', 'data', fileName);

let registros;
try {
    registros = JSON.parse(readFileSync(dataPath, 'utf-8'));
    if (!Array.isArray(registros)) throw new Error('El archivo no es un arreglo JSON.');
} catch (err) {
    console.error(`Error al leer ${fileName}: ${err.message}`);
    process.exit(1);
}

if (!BASE_URL || !TOKEN) {
    console.error('Error: Falta SIGGA_BASE_URL o SIGGA_TOKEN en el archivo .env');
    process.exit(1);
}

console.log(`\nIniciando carga de consultas SIGGA desde ${fileName} — ${registros.length} registro(s)...`);
procesarConsultas(registros);
