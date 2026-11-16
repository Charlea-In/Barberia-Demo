# Norte Barbería

Sistema web de gestión y reservas para barberías salvadoreñas. La interfaz está configurada para **El Salvador**: fechas `es-SV`, zona horaria `America/El_Salvador`, precios en dólares estadounidenses (USD) y teléfonos locales de 8 dígitos con código de país `+503` para enlaces.

**Demo funcional:** <https://charlea-in.github.io/Barberia-Demo/>

## Funciones

- Sitio público con servicios, barberos, disponibilidad y reserva de citas.
- Consulta y cancelación de citas; los clientes recurrentes pueden vincular su historial usando código `BA-01`, nombre y teléfono.
- Panel administrativo para agenda, clientes, servicios, barberos, ingresos, gastos, disponibilidad, ajustes y respaldos.
- Portal personal de cada barbero con agenda, confirmación de citas, contacto por WhatsApp, registro de cortes e ingresos.
- Indicador de carga al consultar datos en Google Sheets.
- Modo de demo funcional con almacenamiento en el navegador si no hay conexión con Google Sheets.

La demo publicada es una instancia funcional del proyecto, no una garantía de que sus datos sean persistentes entre navegadores. Para operar el negocio, conecta una hoja de Google propia y configura sus datos reales.

## Abrir y usar

Puedes abrir `index.html` directamente o iniciar un servidor estático desde la carpeta del proyecto:

```bash
python -m http.server 5500
```

Abre `http://127.0.0.1:5500/`. El panel administrativo está en `admin.html` y el portal del barbero en `barbero.html`.

Sin una API configurada, la demo funcional guarda los cambios en `localStorage` del navegador actual. Desde el panel puedes restaurar los datos de demo. Las claves de demostración están en `js/config.js`; cámbialas antes de compartir una instancia de demostración.

## Conectar Google Sheets

La guía detallada está en [docs/google-sheets-setup.md](docs/google-sheets-setup.md).

1. Crea una hoja de cálculo y abre **Extensiones → Apps Script**.
2. Copia `apps-script/Code.gs` y `apps-script/appsscript.json` al proyecto de Apps Script.
3. Ejecuta `setup()` y autoriza los permisos.
4. Configura una clave larga para el panel con `configurarClave("tu-clave-segura")`.
5. Implementa como aplicación web y pega su URL `/exec` en `js/config.js`, en `api.url`.
6. Si actualizas una instalación existente, revisa la guía y ejecuta `migrar()` antes de publicar una versión nueva del Web App.

Apps Script usa `LockService` para proteger operaciones sensibles frente a solicitudes simultáneas. La zona horaria del backend está fijada a El Salvador. Cada instalación debe tener su propia hoja, clave y datos comerciales.

## Configuración regional y datos

Los precios y contactos de `js/config.js` y `apps-script/Code.gs` son valores de ejemplo. Las tarifas semilla están expresadas en USD y deben ajustarse a cada negocio desde el panel. No se incluyen números de WhatsApp, teléfonos, correos ni direcciones comerciales inventados.

Los números de clientes de ejemplo usan valores de prueba y no son números de contacto. Para clientes reales, se validan 8 dígitos locales; los formularios también reconocen el prefijo internacional `+503`.

En Google Sheets, la configuración del negocio, el catálogo, las citas, clientes y datos financieros viven en las pestañas creadas por `setup()`. La ejecución de `migrar()` actualiza encabezados, asigna códigos de cliente faltantes y reemplaza valores regionales de ejemplo conocidos. Solo migra precios semilla si la moneda previa era MXN (o faltaba) y cada precio coincide exactamente con el valor de ejemplo; los demás precios se conservan.

La migración no convierte automáticamente importes de citas o movimientos históricos ni reescribe teléfonos de clientes existentes. Antes de usar datos previos en El Salvador, revisa esos registros en Sheets: los teléfonos deben estar en formato local de 8 dígitos y cualquier importe histórico en otra moneda requiere una conversión contable apropiada.

## Publicar en GitHub Pages

El proyecto es estático y puede servirse desde GitHub Pages:

1. Sube el repositorio a GitHub.
2. En **Settings → Pages**, selecciona despliegue desde una rama o GitHub Actions.
3. Si usas Actions, el workflow está en `.github/workflows/pages.yml`.
4. Tras publicar cambios de frontend, incrementa los parámetros `?v=` de los recursos CSS/JS en los HTML para renovar la caché.

## Estructura

```text
├─ index.html                 Sitio público y reservas
├─ admin.html                 Panel administrativo
├─ barbero.html               Portal del barbero
├─ js/config.js               Marca, región, horarios y conexión
├─ js/ui.js                   Formato, componentes y utilidades
├─ js/store.js                Demo funcional y cliente de Apps Script
├─ js/app.js                  Reservas e historial de clientes
├─ js/admin.js                Administración del negocio
├─ js/barbero.js              Jornada y acciones del barbero
├─ js/sheets-loading.js       Indicador de operaciones con Sheets
├─ apps-script/Code.gs        API y persistencia en Google Sheets
└─ docs/google-sheets-setup.md Guía de instalación y actualización
```

## API

El frontend usa solicitudes JSON a Apps Script. Entre sus acciones se encuentran `bootstrap`, `availability`, `book`, `lookup`, `cancel`, `adminLogin`, `adminData`, `adminSave`, `adminDelete`, `setStatus` y las acciones del portal de barberos. Las operaciones administrativas se validan en Apps Script; la guía explica cómo configurar y actualizar el Web App.

## Alcance y seguridad

- Google Sheets debe permanecer privada; el Web App accede a ella con la cuenta de quien lo implementa.
- La URL del Web App es pública para permitir reservas. No guardes secretos en `js/config.js`.
- Usa contraseñas únicas y fuertes para el panel y claves personales para cada barbero.
- La demo funcional almacena datos localmente en el navegador y no sustituye una base de datos compartida.

Hecho para adaptar a negocios de barbería en El Salvador. Configura marca, tarifas, equipo, contactos y horario propios antes de usarlo con clientes.
