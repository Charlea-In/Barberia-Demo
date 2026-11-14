# Conectar el sitio con Google Sheets

Esta guía deja el sitio publicado en GitHub Pages hablando con una hoja de cálculo de Google. Tiempo estimado: **15–20 minutos**.

Al terminar tendrás:

- Una hoja con las pestañas `Config`, `Servicios`, `Barberos`, `Clientes`, `Citas`, `Ingresos` y `Gastos`.
- Un Web App de Apps Script que responde a la API del sitio.
- El sitio y el panel usando datos reales en lugar del modo demo.

---

## Antes de empezar

Necesitas:

- Una cuenta de Google.
- El proyecto descargado o clonado.
- Acceso a [Google Sheets](https://sheets.google.com) y [Google Apps Script](https://script.google.com).

---

## Paso 1. Crear la hoja de cálculo

1. Entra a [Google Sheets](https://sheets.google.com).
2. Crea una hoja nueva.
3. Ponle un nombre, por ejemplo **Norte Barbería — Base de datos**.
4. No necesitas crear las pestañas a mano: el script lo hace.

> También puedes usar una hoja existente. El script solo agrega las pestañas que falten y no borra datos.

---

## Paso 2. Abrir el editor de Apps Script

Desde la hoja:

1. Menú **Extensiones → Apps Script**.
2. Se abre un proyecto nuevo asociado a esa hoja.

Si prefieres un proyecto independiente:

1. Entra a [script.google.com](https://script.google.com).
2. Crea **Nuevo proyecto**.
3. Ejecuta `setup()`: el script creará una hoja nueva automáticamente y guardará su ID.

---

## Paso 3. Pegar el código

1. En el editor, abre `Code.gs`.
2. Borra el contenido de ejemplo.
3. Copia todo el contenido de [`apps-script/Code.gs`](../apps-script/Code.gs) y pégalo.
4. Guarda con **Ctrl + S** (o el icono de disquete).

### Manifiesto (recomendado)

1. En el editor, abre el icono de engranaje **Configuración del proyecto**.
2. Activa **Mostrar el archivo de manifiesto `appsscript.json`**.
3. Abre `appsscript.json` y reemplázalo por el contenido de [`apps-script/appsscript.json`](../apps-script/appsscript.json).
4. Guarda.

El manifiesto fija la zona horaria en `America/Mexico_City` y el tipo de implementación web. Si tu barbería está en otra zona horaria, cámbiala aquí y en `Code.gs` (constante `TZ`).

---

## Paso 4. Ejecutar la instalación

1. En la barra superior del editor, selecciona la función **`setup`**.
2. Pulsa **Ejecutar**.
3. Google pedirá autorización:
   - **Revisar permisos**.
   - Elige tu cuenta.
   - Si aparece “Google no ha verificado esta aplicación”, pulsa **Configuración avanzada → Ir a (nombre del proyecto)**.
   - Acepta los permisos de Sheets y de Apps Script.
4. Revisa el **Registro de ejecución**. Debe decir algo como:

```text
✅ Base de datos lista: https://docs.google.com/spreadsheets/d/...
🔑 Aún no hay clave del panel...
👉 Siguiente paso: Implementar → Nueva implementación → Aplicación web.
```

Vuelve a la hoja: ya deben existir las siete pestañas con encabezados y datos iniciales.

### Crear la clave del panel

1. En el editor, selecciona la función **`configurarClave`**.
2. Si el editor no permite pasar argumentos, crea temporalmente esta función al final de `Code.gs`:

```js
function miClave() {
  configurarClave("una-clave-larga-y-dificil-de-adivinar");
}
```

3. Ejecuta `miClave` una vez.
4. Borra `miClave` o cambia la clave cuando quieras.

También puedes hacerlo desde **Configuración del proyecto → Propiedades del script**:

- Propiedad: `ADMIN_KEY`
- Valor: tu clave

La clave debe tener **al menos 6 caracteres**. Usa una frase larga, no `123456`.

### Comprobar la instalación

Ejecuta la función **`verificarInstalacion`** y revisa el registro. Debe indicar que no faltan hojas y que la clave está configurada.

---

## Paso 5. Implementar el Web App

1. Pulsa **Implementar → Nueva implementación**.
2. Tipo: **Aplicación web**.
3. Configuración:
   - **Descripción:** `API Norte Barbería`
   - **Ejecutar como:** `Yo` (tu cuenta)
   - **Quién tiene acceso:** `Cualquier persona`
4. Pulsa **Implementar**.
5. Copia la **URL del Web App**. Termina en `/exec`:

```text
https://script.google.com/macros/s/AKfycb.../exec
```

> La opción “Cualquier persona” es necesaria para que el sitio público pueda reservar sin iniciar sesión. La hoja sigue siendo privada: nadie accede a ella directamente.

### Probar la API

Abre la URL `/exec` en el navegador. Debes ver un JSON como:

```json
{"ok":true,"data":{"service":"Norte Barbería API","version":"1.0.0","configured":true}}
```

Si ves un error de permisos, revisa el paso 5 y vuelve a implementar.

También puedes probar una acción pública desde PowerShell:

```powershell
$body = '{"action":"bootstrap","payload":{}}'
Invoke-RestMethod -Uri "https://script.google.com/macros/s/TU_ID/exec" `
  -Method Post -ContentType "text/plain;charset=utf-8" -Body $body
```

Debe devolver `ok: true` con servicios y barberos.

---

## Paso 6. Conectar el frontend

1. Abre `js/config.js`.
2. Pega la URL en `api.url`:

```js
api: {
  url: "https://script.google.com/macros/s/TU_ID/exec",
},
```

3. Guarda y sube el cambio a GitHub.
4. Recarga el sitio. En el panel, la etiqueta de modo debe decir **Google Sheets** y la pista de acceso ya no mostrará la clave demo.

La clave del panel ahora es la que configuraste con `configurarClave`, no `barberia2026`.

---

## Paso 7. Publicar el frontend en GitHub Pages

Si aún no lo has hecho:

1. Sube el proyecto a GitHub.
2. Ve a **Settings → Pages**.
3. Elige **Deploy from a branch**, rama `main`, carpeta `/ (root)`.
4. Guarda.

El archivo `.nojekyll` evita que GitHub Pages procese el sitio con Jekyll.

También puedes usar el workflow incluido en `.github/workflows/pages.yml`:

1. **Settings → Pages → Source: GitHub Actions**.
2. Push a `main` o `master`.

---

## Cómo se guardan los datos

| Pestaña | Columnas principales |
| --- | --- |
| `Config` | `clave`, `valor` |
| `Servicios` | `id`, `nombre`, `descripcion`, `duracion_min`, `precio`, `activo`, `orden` |
| `Barberos` | `id`, `nombre`, `rol`, `especialidad`, `telefono`, `comision_pct`, `activo`, `color` |
| `Clientes` | `id`, `nombre`, `telefono`, `email`, `notas`, `creado_en`, `total_citas`, `total_gastado`, `ultima_visita` |
| `Citas` | `id`, `fecha`, `hora`, `cliente_id`, `cliente_nombre`, `cliente_telefono`, `servicio_id`, `servicio_nombre`, `barbero_id`, `barbero_nombre`, `precio`, `duracion_min`, `estado`, `notas`, `creado_en`, `origen`, `inicio_en`, `fin_en`, `duracion_real_min` |
| `Ingresos` | `id`, `fecha`, `monto`, `categoria`, `descripcion`, `cita_id`, `metodo_pago`, `barbero_id`, `creado_en` |
| `Gastos` | `id`, `fecha`, `monto`, `categoria`, `descripcion`, `metodo_pago`, `creado_en` |

Reglas importantes:

- **No cambies los encabezados** ni el orden de las columnas.
- **No edites la columna `id`** de registros existentes: es la llave que usa el panel.
- Las fechas se guardan como texto `YYYY-MM-DD` y las horas como `HH:mm`.
- Puedes editar precios, nombres, textos y montos directamente en la hoja; el panel los leerá al recargar.
- Si agregas filas a mano, deja `id` vacío o inventa uno único con el mismo prefijo (`srv-`, `brb-`, `cl-`, `apt-`, `inc-`, `exp-`).

---

## Actualizar el backend después de un cambio

Cada vez que modifiques `Code.gs`:

1. Guarda el archivo.
2. Pulsa **Implementar → Administrar implementaciones**.
3. En la implementación activa, pulsa el lápiz **Editar**.
4. En *Versión*, elige **Nueva versión**.
5. Pulsa **Implementar**.

La URL `/exec` se mantiene. Si creas una implementación nueva, cambia la URL en `js/config.js`.

> Después de actualizar `Code.gs`, ejecuta **`migrar()`** una vez desde el editor. Actualiza los encabezados que falten sin borrar los datos existentes y elimina claves de barbero de demostración conocidas. Luego asigna claves personales a cada barbero desde el panel de administración.

---

## Copias de seguridad

Desde el panel:

- **Ajustes → Descargar respaldo JSON** guarda una copia completa de los datos visibles.
- **Ajustes → Restablecer demo** solo funciona en modo demo y no toca Google Sheets.

En Google Sheets también puedes usar **Archivo → Crear una copia** antes de cambios grandes.

---

## Problemas frecuentes

### El sitio sigue en modo demo

- Revisa que `js/config.js` tenga la URL y que termine en `/exec`.
- Recarga con **Ctrl + F5** para evitar caché.
- Abre la consola del navegador y busca errores de red.

### “Error de conexión (401/403)”

- La implementación no está como **Cualquier persona**.
- La cuenta que implementó perdió acceso a la hoja.
- Vuelve a implementar y autoriza de nuevo.

### “La respuesta del servidor no es JSON válido”

- La URL no es la del Web App (debe terminar en `/exec`, no en `/dev`).
- Hay un error de sintaxis en `Code.gs`: revisa **Ejecuciones** en Apps Script.
- La implementación quedó en una versión anterior: crea una **Nueva versión**.

### “Clave incorrecta” en el panel

- La clave real es la propiedad `ADMIN_KEY` del script, no `barberia2026`.
- Ejecuta `configurarClave("...")` o edita la propiedad.
- Cierra sesión en el panel y vuelve a entrar.

### “Falta configurar la clave del panel”

- No existe `ADMIN_KEY`. Ejecuta `configurarClave("...")`.

### Las citas se guardan con un día menos

- Revisa la zona horaria del manifiesto y la constante `TZ` en `Code.gs`.
- Ambos deben coincidir con la zona de la barbería.

### Dos clientes reservan el mismo horario

- La API usa `LockService` y vuelve a validar la disponibilidad al guardar.
- Si editas la hoja manualmente mientras alguien reserva, puede haber una carrera muy breve. Evita editar la pestaña `Citas` en horarios de alta demanda.

### Cambié la hoja de cálculo y ya no funciona

- Si usas un script independiente, revisa la propiedad `SPREADSHEET_ID`.
- Si moviste el archivo a otra cuenta, vuelve a ejecutar `setup()` o actualiza la propiedad.

---

## Siguiente paso

Vuelve al [README](../README.md) para ver la estructura del proyecto, la personalización y las mejoras sugeridas.
