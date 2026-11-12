# Norte Barbería

Sitio web y panel de administración para una barbería. Funciona como sitio estático en **GitHub Pages** y usa **Google Sheets** como base de datos a través de un Web App de **Google Apps Script**.

- **Sitio público:** presentación, servicios, barberos, reserva de citas y consulta/cancelación con el teléfono.
- **Panel privado:** resumen del negocio, agenda, clientes, ingresos, gastos, equipo, catálogo de servicios y ajustes.
- **Modo demo:** si aún no conectas Google Sheets, todo funciona con datos locales en el navegador.

**Demo publicada:** <https://charlea-in.github.io/Barberia-Demo/>

---

## 1. Ver la demo en local

No necesitas instalar nada. Abre `index.html` en el navegador o levanta un servidor local:

```bash
python -m http.server 5500
```

Luego abre `http://127.0.0.1:5500/`.

### Panel de administración

- URL: `admin.html` (en local, `http://127.0.0.1:5500/admin.html`)
- Clave demo: **`barberia2026`**

La clave demo está en `js/config.js` → `admin.demoKey`. En modo Google Sheets la clave real se configura en Apps Script.

> En modo demo los datos se guardan en `localStorage` de ese navegador. Puedes restablecerlos desde **Ajustes → Restablecer demo**.

---

## 2. Conectar Google Sheets (modo real)

Sigue la guía completa: **[docs/google-sheets-setup.md](docs/google-sheets-setup.md)**.

Resumen:

1. Crea una hoja de cálculo en Google Sheets.
2. Abre **Extensiones → Apps Script**.
3. Pega `apps-script/Code.gs` y `apps-script/appsscript.json`.
4. Ejecuta `setup()` y autoriza los permisos.
5. Ejecuta `configurarClave("tu-clave-segura")`.
6. Implementa como **Aplicación web**:
   - Ejecutar como: **yo**
   - Acceso: **cualquier persona**
7. Copia la URL que termina en `/exec` en `js/config.js`:

```js
api: {
  url: "https://script.google.com/macros/s/XXXXX/exec",
}
```

Al recargar, el sitio y el panel detectan la URL y dejan de usar el modo demo.

### Hojas creadas

| Hoja | Contenido |
| --- | --- |
| `Config` | Nombre del negocio, contacto, horario, moneda. |
| `Servicios` | Catálogo, precio, duración, orden y visibilidad. |
| `Barberos` | Equipo, especialidad, comisión, color y estado. |
| `Clientes` | Contacto e historial calculado. |
| `Citas` | Agenda con servicio, barbero, estado y origen. |
| `Ingresos` | Cobros de servicios y ventas de productos. |
| `Gastos` | Renta, insumos, servicios, marketing, etc. |

No edites los encabezados ni la columna `id`: el panel y la API los usan como llaves.

---

## 3. Publicar en GitHub Pages

### Opción A — Desde una rama (la más simple)

1. Sube el proyecto a un repositorio de GitHub.
2. Ve a **Settings → Pages**.
3. En *Build and deployment*, elige **Deploy from a branch**.
4. Selecciona la rama (`main`) y la carpeta `/ (root)`.
5. Guarda y espera la URL publicada.

El archivo `.nojekyll` ya está incluido para que GitHub Pages no procese el sitio con Jekyll.

### Opción B — GitHub Actions

El repositorio incluye `.github/workflows/pages.yml`. Si prefieres Actions:

1. Ve a **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. Haz push a `main` o `master` (o ejecuta el workflow manualmente).
3. El workflow publica solo `index.html`, `admin.html`, `css/`, `js/`, `assets/` y `.nojekyll`.

### Después de publicar

Actualiza la URL del Web App en `js/config.js` y vuelve a subir el cambio. También puedes usar una URL relativa para el sitio, pero la API siempre debe ser la URL absoluta de Apps Script.

> GitHub Pages cachea los archivos estáticos unos minutos. Los HTML enlazan CSS y JS con `?v=20261111`; al publicar cambios en esos archivos, sube ese número de versión en `index.html` y `admin.html` para que los visitantes reciban la versión nueva de inmediato.

---

## 4. Personalizar

Casi todo lo visual y comercial se cambia en **`js/config.js`**:

- Nombre, lema, ciudad y monograma.
- Teléfono, WhatsApp, email, dirección e Instagram.
- Moneda y configuración regional.
- Horario de atención, días cerrados, duración de los intervalos y anticipación mínima.
- Servicios y barberos iniciales.
- URL de la API y clave demo.

En modo Google Sheets, los servicios, barberos, horarios y datos de contacto se administran desde el panel y viven en la hoja. `js/config.js` solo se usa como semilla y como configuración de la interfaz.

Para cambiar colores o tipografías, edita las variables CSS al inicio de `css/styles.css`.

---

## 5. Estructura del proyecto

```text
.
├─ index.html               Sitio público
├─ admin.html               Panel de administración
├─ css/
│  └─ styles.css            Estilos del sitio y del panel
├─ js/
│  ├─ config.js             Marca, contacto, horarios y conexión
│  ├─ ui.js                 Utilidades, modales, formularios, CSV/ICS
│  ├─ store.js              Modo demo (localStorage) y cliente HTTP
│  ├─ app.js                Reserva, disponibilidad y “Mis citas”
│  └─ admin.js              Vistas, CRUD, métricas y exportaciones
├─ assets/
│  ├─ favicon.svg
│  └─ logo.svg
├─ apps-script/
│  ├─ Code.gs               API completa sobre Google Sheets
│  ├─ appsscript.json       Manifiesto del proyecto
│  └─ README.md             Notas de instalación del backend
├─ docs/
│  └─ google-sheets-setup.md Guía paso a paso
└─ .github/workflows/pages.yml
```

---

## 6. Cómo funciona la API

Todas las peticiones son `POST` con cuerpo JSON y `Content-Type: text/plain;charset=utf-8` para evitar el preflight de CORS:

```json
{ "action": "bootstrap", "payload": {} }
```

Respuesta:

```json
{ "ok": true, "data": { } }
```

o

```json
{ "ok": false, "error": "Mensaje para mostrar" }
```

Acciones disponibles:

| Acción | Quién la usa | Descripción |
| --- | --- | --- |
| `bootstrap` | Público | Servicios, barberos y configuración activos. |
| `availability` | Público | Horarios libres para una fecha y servicio. |
| `book` | Público | Crea la cita y, si hace falta, el cliente. |
| `lookup` | Público | Citas recientes por teléfono. |
| `cancel` | Público | Cancela una cita validando el teléfono. |
| `adminLogin` | Panel | Valida la clave. |
| `adminData` | Panel | Devuelve todas las hojas. |
| `adminSave` | Panel | Crea o actualiza un registro. |
| `adminDelete` | Panel | Elimina un registro. |
| `setStatus` | Panel | Cambia el estado y registra/elimina el ingreso. |

Las acciones de administración incluyen `key` en el payload. Apps Script usa `LockService` para evitar citas duplicadas o escrituras simultáneas.

---

## 7. Seguridad y alcance de esta primera versión

- La clave del panel es una protección ligera, adecuada para una barbería pequeña, pero **no es autenticación de usuarios**. No hay roles separados para dueño y barberos todavía.
- La hoja de cálculo debe quedar privada. El Web App se ejecuta con la cuenta del dueño y solo expone las acciones de la API.
- Cualquier persona con la URL del Web App puede consultar disponibilidad y reservar; es el comportamiento esperado del sitio público.
- Para producción conviene cambiar la clave demo, usar una clave larga y revisar periódicamente la hoja.

---

## 8. Siguientes mejoras sugeridas

- Paginación y búsqueda en la tabla de citas.
- Notificaciones por WhatsApp o email al confirmar/cancelar.
- Roles y permisos por barbero.
- Bloqueo de horarios y vacaciones.
- Historial de caja por día y corte de caja.
- Recordatorios automáticos con triggers de Apps Script.
- Gráficas comparativas mes contra mes y exportación a PDF.

---

Hecho para **Norte Barbería**. Ajusta la marca, los precios y el equipo desde `js/config.js` o desde el panel.
