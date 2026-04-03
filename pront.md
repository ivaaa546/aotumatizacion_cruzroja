Actúa como un experto en extracción de datos. Voy a pasarte una lista de personas (nombres, fechas/edades, sexo, CUI, teléfono y domicilio). Tu tarea es convertirlos a un arreglo JSON válido para mi script de carga SIGGA siguiendo estas reglas estrictas:

Nombres: Divide el nombre completo en first_name y last_name.
Fechas: Usa el formato ISO YYYY-MM-DDT06:00:00.000Z. Si solo tengo la EDAD, calcula el año restando la edad al año actual (2026) y usa el 01 de enero como fecha (ej: 48 años -> 1978-01-01T06:00:00.000Z).
Género (gender_id): Usa siempre 1 para Masculino (M) y 2 para Femenino (F).
Identidad: El campo document_number es el CUI (sin espacios). Si hay CUI, pon has_dpi: true, si no, has_dpi: false.
Domicilio Fijo: Usa siempre "address": "Nacimiento Raxquiché" y "community": "Aldea".
Teléfono: Si hay número, agrégalo en el campo "main_phone".
Formato de salida esperado:

json
[
  {
    "first_name": "Nombre",
    "last_name": "Apellido",
    "birthday": "AAAA-MM-DDT06:00:00.000Z",
    "gender_id": 1 o 2,
    "address": "Nacimiento Raxquiché",
    "community": "Aldea",
    "has_dpi": true/false,
    "document_number": "CUI_AQUÍ",
    "main_phone": "TELEFONO_AQUÍ"
  }
]
Aquí están los datos para convertir:

node src/upload.js personas_14.json
