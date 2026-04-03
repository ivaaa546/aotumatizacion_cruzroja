/**
 * recover-services.js
 * Registra el activityHelpingDetail para personas que ya fueron creadas
 * pero cuyo servicio falló. Solo necesitas la lista de person_ids.
 */
import 'dotenv/config';

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

// ─── IDs de personas ya creadas en SIGGA ──────────────────────────────────────
const PERSON_IDS = [
    366793, // Oliver
    366794, // Ana
    366795, // Yasmin
    366796, // Iris
    366797, // Aurelia
    366798, // Magaly
    366799, // José
    366800, // Leonarda
    366801, // Jael
    366802, // Glenda
    366803, // Francisco
    366804, // Adolberto
    366805, // Carmelina
    366806  // Roberto
];

// ─── Utilidades ───────────────────────────────────────────────────────────────
const delay = (ms) => new Promise((res) => setTimeout(res, ms));
const randomDelay = () => delay(200 + Math.random() * 300);

function headers() {
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOKEN}`,
    };
}

// ─── API call ─────────────────────────────────────────────────────────────────
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
async function recuperar() {
    let exitosos = 0;
    let fallidos = 0;
    const errores = [];

    console.log(`\nRegistrando servicios para ${PERSON_IDS.length} persona(s) ya creadas...\n`);

    for (let i = 0; i < PERSON_IDS.length; i++) {
        const person_id = PERSON_IDS[i];
        console.log(`[${i + 1}/${PERSON_IDS.length}] person_id=${person_id}`);

        try {
            const resp = await registrarServicio(person_id);
            console.log(`  ✓ Servicio registrado. Respuesta: ${JSON.stringify(resp)}`);
            exitosos++;
        } catch (err) {
            console.error(`  ✗ Error: ${err.message}`);
            fallidos++;
            errores.push({ person_id, error: err.message });
        }

        await randomDelay();
    }

    // ─── Reporte final ────────────────────────────────────────────────────────
    console.log('\n══════════════════════════════════════════');
    console.log('           REPORTE DE RECUPERACIÓN');
    console.log('══════════════════════════════════════════');
    console.log(`  Total     : ${PERSON_IDS.length}`);
    console.log(`  ✓ Exitosos: ${exitosos}`);
    console.log(`  ✗ Fallidos: ${fallidos}`);
    if (errores.length) {
        console.log('\n  Errores:');
        errores.forEach(({ person_id, error }) => {
            console.log(`    • person_id ${person_id}: ${error}`);
        });
    }
    console.log('══════════════════════════════════════════\n');
}

recuperar();
