# Backend de Apps Script

`Code.gs` es la API que conecta el sitio con Google Sheets. No necesita servidor propio: se ejecuta como Web App de Google Apps Script.

## Instalación mínima

1. Crea una hoja de cálculo nueva.
2. **Extensiones → Apps Script**.
3. Pega `Code.gs` en el editor.
4. (Opcional, recomendado) Copia `appsscript.json` en **Configuración del proyecto → Mostrar archivo de manifiesto**.
5. Ejecuta `setup()` y autoriza los permisos.
6. Ejecuta `configurarClave("tu-clave-segura")`.
7. **Implementar → Nueva implementación → Aplicación web**:
   - Ejecutar como: **Yo**
   - Acceso: **Cualquier persona**
8. Copia la URL `/exec` en `js/config.js` → `api.url`.

La guía detallada está en [`docs/google-sheets-setup.md`](../docs/google-sheets-setup.md).

## Funciones del editor

| Función | Uso |
| --- | --- |
| `setup()` | Crea hojas, encabezados y datos iniciales. |
| `configurarClave("...")` | Define o cambia la clave del panel. |
| `verificarInstalacion()` | Revisa hojas, clave e ID de la hoja. |

## Propiedades del script

| Propiedad | Obligatoria | Descripción |
| --- | --- | --- |
| `ADMIN_KEY` | Sí | Clave del panel. |
| `SPREADSHEET_ID` | No | ID de la hoja. Se guarda solo si `setup()` crea la hoja. Si el script está vinculado a una hoja, no hace falta. |

## Notas

- El Web App debe ejecutarse como **Yo** y con acceso **Cualquier persona** para que el sitio público pueda reservar.
- La hoja permanece privada; el script es el único intermediario.
- Después de editar `Code.gs`, crea una **Nueva versión** de la implementación para que los cambios se publiquen.
- Las fechas y horas se guardan como texto ISO (`YYYY-MM-DD`, `HH:mm`) para evitar conversiones automáticas de Sheets.
- Las acciones de escritura usan `LockService` para evitar citas duplicadas.
