# Plan: Carga masiva SIGGA con Node.js (`person` + `activityHelpingDetail`)

## Objetivo
Automatizar la carga de registros a SIGGA evitando el copiado y pegado manual siguiendo este flujo:
1. **Crear persona:** Enviar datos básicos a `POST /api/person`.
2. **Obtener `person_id`:** Extraer el ID único de la respuesta.
3. **Crear el servicio/detalle:** Enviar a `POST /api/activityHelpingDetail` usando el `person_id` obtenido.

Todo esto procesando un solo archivo `.json` que contenga múltiples registros de personas.

---

## Requisitos
- **Node.js instalado:** Versión 18 o superior (recomendado por el uso de `fetch` nativo).
- **Acceso al sistema SIGGA:** Token válido (Bearer).
- **Permisos:** Credenciales con capacidad para crear personas y registrar servicios.

> [!WARNING]
> **Seguridad:** No subas tu token a GitHub ni lo compartas en repositorios públicos. Utiliza siempre el archivo `.env`.

---

## Estructura del proyecto
```text
sigga-bulk/
├── package.json
├── .env
├── data/
│   └── personas.json
└── src/
    └── upload.js
```

---

## Configuración (`.env`)
Crea un archivo llamado `.env` en la raíz con el siguiente contenido:

```ini
SIGGA_BASE_URL=https://sigga.cruzroja.gt/api_sigga/public/api
SIGGA_TOKEN=TU_BEARER_TOKEN

# Valores por defecto para la carga
DEFAULT_ACTIVITY_HELPING_ID=945
DEFAULT_PROGRAM_SERVICE_ID=23
DEFAULT_MORBIDITY_ID=12597
DEFAULT_DOCTOR_ID=526
DEFAULT_CREATED_BY_USER_ID=565
DEFAULT_ACTIVITY_DATE=2026-03-02T06:00:00.000Z
```
*Nota: Puedes ajustar los valores según la actividad, doctor o fecha correspondiente.*

---

## Formato del archivo `data/personas.json`
El archivo debe ser un arreglo de objetos. Ejemplo de los dos tipos de registros:

### A) Con DPI
```json
{
  "first_name": "Maria",
  "last_name": "Bac",
  "birthday": "1995-09-17T06:00:00.000Z",
  "gender_id": 2,
  "document_number": "2481689731613",
  "address": "Coyombalam",
  "community": "Aldea",
  "has_dpi": true
}
```

### B) Sin DPI
```json
{
  "first_name": "Yenifer",
  "last_name": "Pana",
  "birthday": "2014-11-06T06:00:00.000Z",
  "gender_id": 2,
  "address": "Coyombalam",
  "community": "Aldea",
  "has_dpi": false
}
```
*Nota: Si `has_dpi` es `false`, el script omitirá los campos de documento.*

---

## Lógica del script (`src/upload.js`)

### 1. Lectura de datos
- Cargar el archivo `data/personas.json`.
- Validar que sea un arreglo y que cada objeto contenga campos obligatorios (`first_name`, `last_name`, `birthday`, `gender_id`, `address`, `community`).

### 2. Creación de persona
- **Endpoint:** `POST {BASE_URL}/person`
- **Cuerpo (Siempre):** `first_name`, `last_name`, `birthday`, `country_of_birth_id`, `gender_id`, `town_id`, `address`, `zone`, `community`, `delegation_id`, `created_by_user_id`, `updated_by_user_id`.
- **Cuerpo (Si `has_dpi: true`):** `document_id=1`, `document_number`, `document_country_id=1`.

### 3. Registro del servicio
- Extraer `response.data.person_id`.
- **Endpoint:** `POST {BASE_URL}/activityHelpingDetail`
- **Cuerpo:** `activity_helping_id`, `person_id`, `program_service_id`, `morbidity_id`, `doctor_id`, `activity_helping_detail_at`, `comment`, `created_by_user_id`.

### 4. Control de errores y Delays
- Si falla la creación de la persona, registrar el error y saltar al siguiente (no intentar registrar el servicio).
- Si falla la creación del servicio, registrar el error y continuar.
- **Delay:** Implementar una pausa de 200–500ms entre registros para evitar saturación del servidor.

### 5. Reporte Final
Al terminar, el script debe imprimir:
- Total de registros procesados.
- Conteo de éxitos y fallos.
- Listado de errores detallado (Nombre de la persona + Error).

---

## Instalación y Ejecución

### Dependencias
Usaremos `dotenv` para el entorno y `fetch` nativo (Node 18+).
```bash
npm init -y
npm i dotenv
```

### Ejecución
1. Configura el `.env`.
2. Prepara `data/personas.json`.
3. Ejecuta el proceso:
```bash
node src/upload.js
```

---

## Checklist de Pruebas
- [ ] Probar con 1 persona con DPI (Esperar 201 y `person_id`).
- [ ] Probar con 1 persona sin DPI (Esperar 201 y `person_id`).
- [ ] Verificar creación de `activityHelpingDetail` (Status 201 / true).
- [ ] Probar un lote pequeño (ej. 5 personas).
- [ ] Validar reflejo de datos en la plataforma SIGGA.