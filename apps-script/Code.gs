/**
 * ============================================================
 *  NORTE BARBERÍA — API de Google Sheets
 *  Web App de Apps Script que da servicio al sitio público
 *  y al panel de administración.
 *
 *  Instalación rápida:
 *   1. Crea una hoja de cálculo nueva (o abre una).
 *   2. Extensiones → Apps Script.
 *   3. Pega este archivo en Code.gs.
 *   4. Ejecuta setup() una vez y autoriza los permisos.
 *   5. Ejecuta configurarClave("tu-clave-segura").
 *   6. Implementar → Nueva implementación → Aplicación web.
 *      - Ejecutar como: yo
 *      - Quién tiene acceso: cualquier persona
 *   7. Copia la URL /exec en js/config.js → api.url.
 *
 *  La hoja puede ser independiente: setup() la crea sola y
 *  guarda su ID en las propiedades del script.
 * ============================================================
 */

const TZ = "America/El_Salvador";

const SHEETS = {
  config: "Config",
  services: "Servicios",
  barbers: "Barberos",
  clients: "Clientes",
  appointments: "Citas",
  incomes: "Ingresos",
  expenses: "Gastos",
};

const HEADERS = {
  config: ["clave", "valor"],
  services: ["id", "nombre", "descripcion", "duracion_min", "precio", "activo", "orden"],
  barbers: ["id", "nombre", "rol", "especialidad", "telefono", "comision_pct", "activo", "color", "clave"],
  clients: ["id", "nombre", "telefono", "email", "notas", "creado_en", "total_citas", "total_gastado", "ultima_visita"],
  appointments: [
    "id", "fecha", "hora", "cliente_id", "cliente_nombre", "cliente_telefono",
    "servicio_id", "servicio_nombre", "barbero_id", "barbero_nombre",
    "precio", "duracion_min", "estado", "notas", "creado_en", "origen",
    "inicio_en", "fin_en", "duracion_real_min",
  ],
  incomes: ["id", "fecha", "monto", "categoria", "descripcion", "cita_id", "metodo_pago", "barbero_id", "creado_en"],
  expenses: ["id", "fecha", "monto", "categoria", "descripcion", "metodo_pago", "creado_en"],
};

// Columnas que deben guardarse como texto para que Sheets no las
// convierta a fechas y rompa el formato ISO.
const TEXT_COLUMNS = {
  config: ["valor"],
  services: [],
  barbers: ["clave"],
  clients: ["creado_en", "ultima_visita"],
  appointments: ["fecha", "hora", "creado_en", "inicio_en", "fin_en"],
  incomes: ["fecha", "creado_en"],
  expenses: ["fecha", "creado_en"],
};

const DEFAULTS = {
  config: {
    nombre_negocio: "Norte Barbería",
    telefono: "+52 55 1234 5678",
    whatsapp: "5215512345678",
    email: "hola@nortebarberia.mx",
    direccion: "Av. Álvaro Obregón 145, Roma Norte, CDMX",
    instagram: "norte.barberia",
    moneda: "MXN",
    hora_inicio: "10:00",
    hora_fin: "20:00",
    slot_minutos: "30",
    dias_cerrados: "0",
    lead_minutos: "60",
  },
  services: [
    { id: "srv-corte", nombre: "Corte clásico", descripcion: "Tijera y máquina, lavado y peinado final.", duracion_min: 30, precio: 180, activo: true, orden: 1 },
    { id: "srv-corte-barba", nombre: "Corte + barba", descripcion: "Corte a medida y perfilado de barba con navaja.", duracion_min: 45, precio: 260, activo: true, orden: 2 },
    { id: "srv-afeitado", nombre: "Afeitado tradicional", descripcion: "Navaja, toalla caliente y bálsamo calmante.", duracion_min: 30, precio: 170, activo: true, orden: 3 },
    { id: "srv-barba", nombre: "Perfilado de barba", descripcion: "Diseño, recorte y aceite para barba.", duracion_min: 20, precio: 120, activo: true, orden: 4 },
    { id: "srv-ritual", nombre: "Ritual completo", descripcion: "Corte, barba, mascarilla y toalla caliente.", duracion_min: 75, precio: 380, activo: true, orden: 5 },
    { id: "srv-nino", nombre: "Corte niño", descripcion: "Corte para los más pequeños de la casa.", duracion_min: 25, precio: 140, activo: true, orden: 6 },
    { id: "srv-color", nombre: "Camuflaje de canas", descripcion: "Tinte suave con acabado natural.", duracion_min: 40, precio: 220, activo: true, orden: 7 },
    { id: "srv-cejas", nombre: "Cejas", descripcion: "Perfilado con navaja.", duracion_min: 10, precio: 60, activo: true, orden: 8 },
  ],
  barbers: [
    // En una instalación real, el dueño asigna las claves desde el admin.
    { id: "brb-diego", nombre: "Diego Salas", rol: "Fundador", especialidad: "Fades y cortes clásicos", telefono: "", comision_pct: 50, activo: true, color: "#C98A4B", clave: "" },
    { id: "brb-marco", nombre: "Marco Ríos", rol: "Barbero senior", especialidad: "Afeitado y barba", telefono: "", comision_pct: 45, activo: true, color: "#7C8C6E", clave: "" },
    { id: "brb-ivan", nombre: "Iván Cruz", rol: "Barbero", especialidad: "Texturizados y color", telefono: "", comision_pct: 40, activo: true, color: "#8B7BA8", clave: "" },
  ],
};

const STATUSES = ["pendiente", "confirmada", "en_curso", "completada", "cancelada", "no_asistio"];
const PREFIXES = { services: "srv", barbers: "brb", clients: "cl", appointments: "apt", incomes: "inc", expenses: "exp" };

/* ============================================================
   INSTALACIÓN
   ============================================================ */

/**
 * Crea las hojas, encabezados y datos iniciales.
 * Ejecútala una sola vez desde el editor de Apps Script.
 */
function setup() {
  const props = PropertiesService.getScriptProperties();
  let ss = null;

  const savedId = props.getProperty("SPREADSHEET_ID");
  if (savedId) {
    ss = SpreadsheetApp.openById(savedId);
  } else {
    try {
      ss = SpreadsheetApp.getActiveSpreadsheet();
    } catch (e) {
      ss = null;
    }
  }

  if (!ss) {
    ss = SpreadsheetApp.create("Norte Barbería — Base de datos");
    props.setProperty("SPREADSHEET_ID", ss.getId());
  }

  Object.keys(SHEETS).forEach((key) => ensureSheet_(ss, key));

  seedConfig_();
  seedRecords_("services", DEFAULTS.services);
  seedRecords_("barbers", DEFAULTS.barbers);

  // Elimina la hoja vacía por defecto si sigue ahí.
  const defaultSheet = ss.getSheetByName("Sheet1") || ss.getSheetByName("Hoja 1");
  if (defaultSheet && defaultSheet.getLastRow() === 0 && ss.getSheets().length > 1) {
    ss.deleteSheet(defaultSheet);
  }

  const hasKey = !!props.getProperty("ADMIN_KEY");
  Logger.log("✅ Base de datos lista: " + ss.getUrl());
  Logger.log(hasKey
    ? "🔑 Clave del panel configurada."
    : "🔑 Aún no hay clave del panel. Ejecuta configurarClave(\"tu-clave-segura\") y vuelve a ejecutar setup si quieres comprobarlo.");
  Logger.log("👉 Siguiente paso: Implementar → Nueva implementación → Aplicación web.");
}

/**
 * Define o cambia la clave del panel.
 * Ejemplo: configurarClave("norte-2026-fuerte")
 */
function configurarClave(clave) {
  const value = String(clave || "").trim();
  if (value.length < 6) throw new Error("Usa una clave de al menos 6 caracteres.");
  PropertiesService.getScriptProperties().setProperty("ADMIN_KEY", value);
  Logger.log("✅ Clave del panel actualizada.");
}

/**
 * Actualiza encabezados sin borrar datos y elimina claves de demo
 * conocidas de instalaciones anteriores. El dueño puede asignar
 * claves personales desde el panel después de ejecutar esta función.
 */
function migrar() {
  const ss = getSpreadsheet_();
  Object.keys(HEADERS).forEach((key) => ensureSheet_(ss, key));
  const demoKeys = ["diego2026", "marco2026", "ivan2026"];
  let cleared = 0;
  getRecords_("barbers").forEach((barber) => {
    if (demoKeys.indexOf(str_(barber.clave)) === -1) return;
    barber.clave = "";
    writeRecord_("barbers", barber);
    cleared += 1;
  });
  Logger.log("✅ Hojas actualizadas. Claves de demo eliminadas: " + cleared + ".");
}

/** Comprueba que la hoja y la clave estén listas. */
function verificarInstalacion() {
  const props = PropertiesService.getScriptProperties();
  const ss = getSpreadsheet_();
  const missing = Object.keys(SHEETS).filter((key) => !ss.getSheetByName(SHEETS[key]));
  Logger.log("Hoja: " + ss.getUrl());
  Logger.log("Hojas faltantes: " + (missing.length ? missing.join(", ") : "ninguna"));
  Logger.log("Clave del panel: " + (props.getProperty("ADMIN_KEY") ? "configurada" : "FALTA"));
  Logger.log("ID guardado: " + (props.getProperty("SPREADSHEET_ID") || "usa la hoja activa"));
}

/* ============================================================
   WEB APP
   ============================================================ */

function doGet() {
  return json_({
    ok: true,
    data: {
      service: "Norte Barbería API",
      version: "1.0.0",
      configured: !!PropertiesService.getScriptProperties().getProperty("ADMIN_KEY"),
    },
  });
}

function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    const action = String(body.action || "");
    const payload = body.payload || {};
    let data;

    switch (action) {
      case "bootstrap":
        data = bootstrap_();
        break;
      case "availability":
        data = availability_(payload);
        break;
      case "book":
        data = withLock_(() => book_(payload));
        break;
      case "lookup":
        data = lookup_(payload);
        break;
      case "cancel":
        data = withLock_(() => cancel_(payload));
        break;
      case "adminLogin":
        data = adminLogin_(payload);
        break;
      case "adminData":
        requireAdmin_(payload);
        data = adminData_();
        break;
      case "adminSave":
        requireAdmin_(payload);
        data = withLock_(() => adminSave_(payload));
        break;
      case "adminDelete":
        requireAdmin_(payload);
        data = withLock_(() => adminDelete_(payload));
        break;
      case "setStatus":
        requireAdmin_(payload);
        data = withLock_(() => setStatus_(payload));
        break;
      case "barberLogin":
        data = barberLogin_(payload);
        break;
      case "barberData":
        data = barberData_(requireBarber_(payload));
        break;
      case "barberSave":
        data = withLock_(() => barberSave_(payload));
        break;
      case "barberDelete":
        data = withLock_(() => barberDelete_(payload));
        break;
      case "barberSetStatus":
        data = withLock_(() => barberSetStatus_(payload));
        break;
      default:
        throw new Error("Acción no válida: " + action);
    }

    return json_({ ok: true, data: data });
  } catch (error) {
    return json_({ ok: false, error: error && error.message ? error.message : String(error) });
  }
}

/* ============================================================
   ACCIONES PÚBLICAS
   ============================================================ */

function bootstrap_() {
  const config = getConfig_();
  return {
    services: getRecords_("services")
      .filter((s) => s.activo !== false)
      .sort((a, b) => (Number(a.orden) || 0) - (Number(b.orden) || 0)),
    barbers: getRecords_("barbers").filter((b) => b.activo !== false).map(publicBarber_),
    config: config,
    schedule: scheduleFrom_(config),
  };
}

function availability_(payload) {
  return computeAvailability_(payload.date, payload.serviceId, payload.barberId);
}

function book_(payload) {
  const nombre = str_(payload.cliente_nombre);
  const telefono = str_(payload.cliente_telefono);
  const fecha = date_(payload.fecha);
  const hora = time_(payload.hora);
  if (nombre.length < 2) throw new Error("Escribe tu nombre completo.");
  if (normalizePhone_(telefono).length < 10) throw new Error("Escribe un teléfono de 10 dígitos.");
  if (!fecha || !hora) throw new Error("Elige fecha y hora.");

  const services = getRecords_("services");
  const svc = services.filter((s) => s.id === payload.servicio_id && s.activo !== false)[0];
  if (!svc) throw new Error("El servicio ya no está disponible.");

  const availability = computeAvailability_(fecha, payload.servicio_id, payload.barbero_id || "any");
  if (availability.closed) throw new Error("Ese día la barbería está cerrada.");
  const slot = availability.slots.filter((s) => s.time === hora)[0];
  if (!slot) throw new Error("Ese horario acaba de ocuparse. Elige otro.");

  const barberId = payload.barbero_id && payload.barbero_id !== "any" ? payload.barbero_id : slot.barbers[0];
  if (slot.barbers.indexOf(barberId) === -1) throw new Error("Ese barbero ya no tiene espacio a esa hora.");

  const barber = getRecords_("barbers").filter((b) => b.id === barberId)[0];
  if (!barber) throw new Error("Barbero no encontrado.");

  const phoneNorm = normalizePhone_(telefono);
  const appointments = getRecords_("appointments");
  const duplicate = appointments.some((a) =>
    normalizePhone_(a.cliente_telefono) === phoneNorm &&
    a.fecha === fecha &&
    a.hora === hora &&
    ["cancelada", "no_asistio"].indexOf(a.estado) === -1
  );
  if (duplicate) throw new Error("Ya tienes una cita a esa hora. Revisa “Mis citas”.");

  const clients = getRecords_("clients");
  const client = ensureClient_(clients, {
    cliente_nombre: nombre,
    cliente_telefono: telefono,
    cliente_email: payload.cliente_email || "",
  });

  const appt = {
    id: uid_("apt"),
    fecha: fecha,
    hora: hora,
    cliente_id: client.id,
    cliente_nombre: client.nombre,
    cliente_telefono: client.telefono,
    servicio_id: svc.id,
    servicio_nombre: svc.nombre,
    barbero_id: barber.id,
    barbero_nombre: barber.nombre,
    precio: Number(svc.precio) || 0,
    duracion_min: Number(svc.duracion_min) || 30,
    estado: "pendiente",
    notas: str_(payload.notas).slice(0, 300),
    creado_en: new Date().toISOString(),
    origen: "web",
  };

  writeRecord_("appointments", appt);
  return publicAppointment_(appt);
}

function lookup_(payload) {
  const phone = normalizePhone_(payload.telefono);
  if (phone.length < 10) throw new Error("Escribe el teléfono con el que reservaste.");
  const since = addDays_(today_(), -120);
  const appointments = getRecords_("appointments")
    .filter((a) => normalizePhone_(a.cliente_telefono) === phone && a.fecha >= since)
    .sort((a, b) => (b.fecha + b.hora).localeCompare(a.fecha + a.hora))
    .slice(0, 40)
    .map(publicAppointment_);
  return { appointments: appointments };
}

function cancel_(payload) {
  const appointments = getRecords_("appointments");
  const appt = appointments.filter((a) => a.id === payload.id)[0];
  if (!appt) throw new Error("No encontramos esa cita.");
  if (normalizePhone_(appt.cliente_telefono) !== normalizePhone_(payload.telefono)) {
    throw new Error("El teléfono no coincide con la cita.");
  }
  if (["pendiente", "confirmada"].indexOf(appt.estado) === -1) {
    throw new Error("Esta cita ya no se puede cancelar.");
  }
  const when = appt.fecha + "T" + appt.hora;
  const now = today_() + "T" + timeFromMinutes_(nowMinutes_());
  if (when <= now) throw new Error("La cita ya pasó o está en curso.");

  appt.estado = "cancelada";
  writeRecord_("appointments", appt);
  return { ok: true };
}

/* ============================================================
   ACCIONES DE ADMINISTRACIÓN
   ============================================================ */

function adminLogin_(payload) {
  const expected = getAdminKey_();
  if (String(payload.key || "") !== expected) throw new Error("Clave incorrecta.");
  return { ok: true };
}

function adminData_() {
  return {
    version: 1,
    config: getConfig_(),
    services: getRecords_("services"),
    barbers: getRecords_("barbers"),
    clients: getRecords_("clients"),
    appointments: getRecords_("appointments"),
    incomes: getRecords_("incomes"),
    expenses: getRecords_("expenses"),
  };
}

/* ============================================================
   PANEL DEL BARBERO
   Cada barbero entra con su clave personal y solo recibe sus
   propias citas e ingresos. El detalle del negocio queda solo
   en el panel del dueño.
   ============================================================ */

function publicBarber_(b) {
  return {
    id: b.id,
    nombre: b.nombre,
    rol: b.rol || "",
    especialidad: b.especialidad || "",
    activo: b.activo !== false,
    color: b.color || "#C98A4B",
  };
}

function selfBarber_(b) {
  const base = publicBarber_(b);
  base.comision_pct = Number(b.comision_pct) || 0;
  return base;
}

function requireBarber_(payload) {
  const clave = str_(payload.clave);
  if (!clave) throw new Error("Escribe tu clave personal.");
  const barber = getRecords_("barbers").filter(
    (b) => b.activo !== false && str_(b.clave) === clave
  )[0];
  if (!barber) throw new Error("Clave incorrecta.");
  return barber;
}

function barberData_(barber) {
  const since = addDays_(today_(), -90);
  const config = getConfig_();
  return {
    version: 1,
    barber: selfBarber_(barber),
    services: getRecords_("services")
      .filter((s) => s.activo !== false)
      .sort((a, b) => (Number(a.orden) || 0) - (Number(b.orden) || 0)),
    config: {
      nombre_negocio: config.nombre_negocio || "Norte Barbería",
      moneda: config.moneda || "MXN",
      hora_inicio: config.hora_inicio || "10:00",
      hora_fin: config.hora_fin || "20:00",
      dias_cerrados: config.dias_cerrados !== undefined ? config.dias_cerrados : "0",
      slot_minutos: config.slot_minutos || "30",
    },
    appointments: getRecords_("appointments").filter(
      (a) => a.barbero_id === barber.id && a.fecha >= since
    ),
    incomes: getRecords_("incomes").filter(
      (i) => i.barbero_id === barber.id && i.fecha >= since
    ),
  };
}

function barberLogin_(payload) {
  const barber = requireBarber_(payload);
  return { barber: selfBarber_(barber), data: barberData_(barber) };
}

function barberSave_(payload) {
  const barber = requireBarber_(payload);
  const entity = str_(payload.entity);
  if (entity !== "appointments" && entity !== "incomes") {
    throw new Error("No puedes modificar esa sección.");
  }
  const input = Object.assign({}, payload.record || {});
  input.barbero_id = barber.id;
  input.barbero_nombre = barber.nombre;

  if (input.id) {
    const list = getRecords_(entity);
    const existing = list.filter((item) => item.id === input.id)[0];
    if (!existing || existing.barbero_id !== barber.id) {
      throw new Error("Ese registro no es tuyo.");
    }
  }

  return adminSave_({ entity: entity, record: input });
}

function barberDelete_(payload) {
  const barber = requireBarber_(payload);
  const entity = str_(payload.entity);
  if (entity !== "appointments" && entity !== "incomes") {
    throw new Error("No puedes modificar esa sección.");
  }
  const list = getRecords_(entity);
  const item = list.filter((x) => x.id === payload.id)[0];
  if (!item || item.barbero_id !== barber.id) throw new Error("Ese registro no es tuyo.");
  return adminDelete_({ entity: entity, id: payload.id });
}

function barberSetStatus_(payload) {
  const barber = requireBarber_(payload);
  const appt = getRecords_("appointments").filter((a) => a.id === payload.id)[0];
  if (!appt || appt.barbero_id !== barber.id) throw new Error("Esa cita no es tuya.");
  return setStatus_(payload);
}

function adminSave_(payload) {
  const entity = String(payload.entity || "");
  const inputRaw = payload.record || {};

  if (entity === "config") {
    return { config: saveConfig_(inputRaw) };
  }

  if (!HEADERS[entity] || entity === "config") throw new Error("Entidad no válida: " + entity);

  const list = getRecords_(entity);
  let input = Object.assign({}, inputRaw);
  let previous = null;

  // Las actualizaciones parciales (activar/pausar) se mezclan con el
  // registro existente antes de validar.
  if (input.id) {
    const existing = list.filter((item) => item.id === input.id)[0];
    if (existing) {
      previous = existing;
      input = Object.assign({}, existing, input);
    }
  }

  if (entity === "appointments") {
    if (!input.fecha || !input.hora) throw new Error("La cita necesita fecha y hora.");
    input.fecha = date_(input.fecha);
    input.hora = time_(input.hora);
    if (!input.servicio_id) throw new Error("Selecciona un servicio.");
    if (!input.barbero_id) throw new Error("Selecciona un barbero.");
    const svc = getRecords_("services").filter((s) => s.id === input.servicio_id)[0];
    if (!svc) throw new Error("Servicio no encontrado.");
    const barber = getRecords_("barbers").filter((b) => b.id === input.barbero_id)[0];
    if (!barber) throw new Error("Barbero no encontrado.");
    if (!input.cliente_telefono) throw new Error("La cita necesita un teléfono.");

    const clients = getRecords_("clients");
    const client = ensureClient_(clients, input);

    input = Object.assign({}, input, {
      cliente_id: client.id,
      cliente_nombre: client.nombre,
      cliente_telefono: client.telefono,
      servicio_nombre: svc.nombre,
      barbero_nombre: barber.nombre,
      precio: input.precio === "" || input.precio === undefined ? Number(svc.precio) : Number(input.precio),
      duracion_min: Number(input.duracion_min) || Number(svc.duracion_min),
      estado: input.estado || "pendiente",
      origen: input.origen || "admin",
      creado_en: input.creado_en || new Date().toISOString(),
      inicio_en: timestamp_(input.inicio_en),
      fin_en: timestamp_(input.fin_en),
      duracion_real_min: Number(input.duracion_real_min) || 0,
    });
  }

  if (entity === "clients") {
    if (!str_(input.nombre)) throw new Error("El cliente necesita un nombre.");
    input.telefono = str_(input.telefono);
    input.creado_en = date_(input.creado_en) || today_();
    input.total_citas = Number(input.total_citas) || 0;
    input.total_gastado = Number(input.total_gastado) || 0;
    input.ultima_visita = date_(input.ultima_visita);
  }

  if (entity === "services") {
    if (!str_(input.nombre)) throw new Error("El servicio necesita un nombre.");
    input.precio = Number(input.precio) || 0;
    input.duracion_min = Number(input.duracion_min) || 30;
    input.orden = Number(input.orden) || list.length + 1;
    input.activo = bool_(input.activo, true);
  }

  if (entity === "barbers") {
    if (!str_(input.nombre)) throw new Error("El barbero necesita un nombre.");
    input.comision_pct = Number(input.comision_pct) || 0;
    input.activo = bool_(input.activo, true);
    if (!input.color) input.color = "#C98A4B";
    input.clave = str_(input.clave);
    if (input.clave) {
      if (input.clave.length < 6) throw new Error("La clave personal debe tener al menos 6 caracteres.");
      const taken = getRecords_("barbers").some(
        (b) => b.id !== input.id && str_(b.clave) === input.clave
      );
      if (taken) throw new Error("Esa clave ya está en uso por otro barbero.");
    }
  }

  if (entity === "incomes" || entity === "expenses") {
    input.monto = Number(input.monto) || 0;
    if (input.monto <= 0) throw new Error("El monto debe ser mayor a cero.");
    input.fecha = date_(input.fecha) || today_();
    input.categoria = str_(input.categoria) || "Otros";
    input.metodo_pago = str_(input.metodo_pago) || "Efectivo";
    input.creado_en = input.creado_en || new Date().toISOString();
  }

  let record;
  if (input.id) {
    const index = list.findIndex((item) => item.id === input.id);
    if (index === -1) throw new Error("Registro no encontrado.");
    record = Object.assign({}, list[index], input);
    list[index] = record;
    writeRecord_(entity, record);
  } else {
    record = Object.assign({}, input, { id: uid_(PREFIXES[entity] || "reg") });
    list.push(record);
    writeRecord_(entity, record);
  }

  if (entity === "appointments") {
    const clients = getRecords_("clients");
    const appointments = getRecords_("appointments");
    recomputeClient_(clients, appointments, record.cliente_id);
    if (previous && previous.cliente_id && previous.cliente_id !== record.cliente_id) {
      recomputeClient_(clients, appointments, previous.cliente_id);
    }
  }
  if (entity === "clients") {
    recomputeClient_(list, getRecords_("appointments"), record.id);
  }

  return record;
}

function adminDelete_(payload) {
  const entity = String(payload.entity || "");
  const id = String(payload.id || "");
  if (entity === "config") throw new Error("La configuración no se puede borrar.");
  if (!HEADERS[entity] || entity === "config") throw new Error("Entidad no válida.");

  const record = getRecords_(entity).filter((item) => item.id === id)[0];
  if (!record) throw new Error("Registro no encontrado.");

  deleteRecord_(entity, id);

  if (entity === "appointments") {
    getRecords_("incomes")
      .filter((i) => i.cita_id === id)
      .forEach((i) => deleteRecord_("incomes", i.id));
    recomputeClient_(getRecords_("clients"), getRecords_("appointments"), record.cliente_id);
  }

  if (entity === "clients") {
    // Conserva las citas históricas, pero sin vínculo activo.
    getRecords_("appointments").forEach((a) => {
      if (a.cliente_id === record.id) {
        a.cliente_id = "";
        writeRecord_("appointments", a);
      }
    });
  }

  return { ok: true };
}

function setStatus_(payload) {
  const id = String(payload.id || "");
  const estado = String(payload.estado || "");
  if (STATUSES.indexOf(estado) === -1) throw new Error("Estado no válido.");

  const appt = getRecords_("appointments").filter((a) => a.id === id)[0];
  if (!appt) throw new Error("Cita no encontrada.");

  appt.estado = estado;
  if (payload.inicio_en !== undefined) appt.inicio_en = timestamp_(payload.inicio_en);
  if (payload.fin_en !== undefined) appt.fin_en = timestamp_(payload.fin_en);
  if (payload.duracion_real_min !== undefined) appt.duracion_real_min = Number(payload.duracion_real_min) || 0;

  if (estado === "completada") {
    if (!appt.fin_en) appt.fin_en = new Date().toISOString();
    if (!Number(appt.duracion_real_min) && appt.inicio_en) {
      const start = new Date(appt.inicio_en).getTime();
      if (!isNaN(start)) {
        appt.duracion_real_min = Math.max(1, Math.round((Date.now() - start) / 60000));
      }
    }
  }

  writeRecord_("appointments", appt);

  if (estado === "completada") {
    const incomes = getRecords_("incomes");
    let income = incomes.filter((i) => i.cita_id === appt.id)[0];
    if (!income) {
      income = {
        id: uid_("inc"),
        fecha: appt.fecha,
        monto: Number(appt.precio) || 0,
        categoria: "Servicio",
        descripcion: appt.servicio_nombre + " · " + appt.cliente_nombre,
        cita_id: appt.id,
        metodo_pago: str_(payload.metodo_pago) || "Efectivo",
        barbero_id: appt.barbero_id,
        creado_en: new Date().toISOString(),
      };
      writeRecord_("incomes", income);
    } else {
      income.monto = Number(appt.precio) || income.monto;
      if (payload.metodo_pago) income.metodo_pago = str_(payload.metodo_pago);
      writeRecord_("incomes", income);
    }
  } else {
    getRecords_("incomes")
      .filter((i) => i.cita_id === appt.id)
      .forEach((i) => deleteRecord_("incomes", i.id));
  }

  recomputeClient_(getRecords_("clients"), getRecords_("appointments"), appt.cliente_id);
  return { ok: true, appointment: publicAppointment_(appt) };
}

/* ============================================================
   DISPONIBILIDAD
   ============================================================ */

function computeAvailability_(dateValue, serviceId, barberId) {
  const date = date_(dateValue);
  if (!date) throw new Error("Falta la fecha.");

  const config = getConfig_();
  const sch = scheduleFrom_(config);
  const svc = getRecords_("services").filter((s) => s.id === serviceId && s.activo !== false)[0];
  if (!svc) throw new Error("El servicio ya no está disponible.");

  const parsed = parseISODate_(date);
  if (isNaN(parsed.getTime())) throw new Error("Fecha inválida.");
  if (sch.closedDays.indexOf(parsed.getDay()) !== -1) {
    return { date: date, closed: true, slots: [] };
  }

  const today = today_();
  if (date < today) return { date: date, closed: false, slots: [] };

  const barbers = getRecords_("barbers").filter((b) =>
    b.activo !== false && (!barberId || barberId === "any" || b.id === barberId)
  );
  if (!barbers.length) return { date: date, closed: false, slots: [] };

  const busyAppts = getRecords_("appointments").filter((a) =>
    a.fecha === date && ["cancelada", "no_asistio"].indexOf(a.estado) === -1
  );

  const duration = Number(svc.duracion_min) || 30;
  const minStart = date === today ? nowMinutes_() + sch.leadMinutes : -1;
  const slots = [];

  for (let t = sch.openMin; t + duration <= sch.closeMin; t += sch.slotMinutes) {
    if (t < minStart) continue;
    const available = barbers.filter((b) => {
      return !busyAppts.some((a) => {
        if (a.barbero_id !== b.id) return false;
        const start = minutesFromTime_(a.hora);
        const end = start + (Number(a.duracion_min) || 30);
        return t < end && t + duration > start;
      });
    });
    if (available.length) {
      slots.push({ time: timeFromMinutes_(t), barbers: available.map((b) => b.id) });
    }
  }

  return { date: date, closed: false, slots: slots };
}

function scheduleFrom_(config) {
  const open = str_(config.hora_inicio) || DEFAULTS.config.hora_inicio;
  const close = str_(config.hora_fin) || DEFAULTS.config.hora_fin;
  const closedRaw = config.dias_cerrados !== undefined && config.dias_cerrados !== ""
    ? config.dias_cerrados
    : DEFAULTS.config.dias_cerrados;
  const closedDays = String(closedRaw)
    .split(",")
    .map((n) => Number(String(n).trim()))
    .filter((n) => !isNaN(n));

  return {
    open: open,
    close: close,
    openMin: minutesFromTime_(open),
    closeMin: minutesFromTime_(close),
    slotMinutes: Number(config.slot_minutos) || 30,
    closedDays: closedDays,
    leadMinutes: Number(config.lead_minutos) || 0,
  };
}

/* ============================================================
   CLIENTES
   ============================================================ */

function ensureClient_(clients, data) {
  const phone = normalizePhone_(data.cliente_telefono || data.telefono);
  let client = null;

  if (data.cliente_id) client = clients.filter((c) => c.id === data.cliente_id)[0] || null;
  if (!client && phone) client = clients.filter((c) => normalizePhone_(c.telefono) === phone)[0] || null;

  if (!client) {
    client = {
      id: uid_("cl"),
      nombre: str_(data.cliente_nombre || data.nombre) || "Cliente",
      telefono: str_(data.cliente_telefono || data.telefono),
      email: str_(data.cliente_email || data.email),
      notas: "",
      creado_en: today_(),
      total_citas: 0,
      total_gastado: 0,
      ultima_visita: "",
    };
    clients.push(client);
    writeRecord_("clients", client);
    return client;
  }

  let dirty = false;
  const nombre = str_(data.cliente_nombre || data.nombre);
  const email = str_(data.cliente_email || data.email);
  if (nombre && nombre !== client.nombre) {
    client.nombre = nombre;
    dirty = true;
  }
  if (email && email !== client.email) {
    client.email = email;
    dirty = true;
  }
  if (dirty) writeRecord_("clients", client);
  return client;
}

function recomputeClient_(clients, appointments, clientId) {
  if (!clientId) return null;
  const client = clients.filter((c) => c.id === clientId)[0];
  if (!client) return null;

  const done = appointments.filter((a) => a.cliente_id === clientId && a.estado === "completada");
  client.total_citas = done.length;
  client.total_gastado = done.reduce((acc, a) => acc + (Number(a.precio) || 0), 0);
  client.ultima_visita = done.reduce((max, a) => (a.fecha > max ? a.fecha : max), "");
  writeRecord_("clients", client);
  return client;
}

/* ============================================================
   ACCESO A HOJAS
   ============================================================ */

function getSpreadsheet_() {
  const props = PropertiesService.getScriptProperties();
  const savedId = props.getProperty("SPREADSHEET_ID");
  if (savedId) return SpreadsheetApp.openById(savedId);

  let active = null;
  try {
    active = SpreadsheetApp.getActiveSpreadsheet();
  } catch (e) {
    active = null;
  }
  if (active) return active;

  throw new Error("No hay hoja de cálculo configurada. Ejecuta setup() desde el editor de Apps Script.");
}

function ensureSheet_(ss, key) {
  const name = SHEETS[key];
  const headers = HEADERS[key];
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);

  const currentWidth = sh.getLastColumn();
  const current = currentWidth ? sh.getRange(1, 1, 1, currentWidth).getValues()[0] : [];
  const needsHeaders = headers.some((h, i) => String(current[i] || "").trim() !== h);
  if (needsHeaders) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  }

  sh.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#F3EEE4");
  sh.setFrozenRows(1);

  TEXT_COLUMNS[key].forEach((column) => {
    const idx = headers.indexOf(column);
    if (idx === -1) return;
    const rows = Math.max(sh.getMaxRows() - 1, 1);
    sh.getRange(2, idx + 1, rows, 1).setNumberFormat("@");
  });

  sh.autoResizeColumns(1, headers.length);
  return sh;
}

function getSheet_(key) {
  const ss = getSpreadsheet_();
  return ss.getSheetByName(SHEETS[key]) || ensureSheet_(ss, key);
}

function readRaw_(key) {
  const sh = getSheet_(key);
  const values = sh.getDataRange().getValues();
  if (values.length < 2) return [];

  const headers = values[0].map((h) => String(h).trim());
  const rows = [];
  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    if (!row.some((cell) => cell !== "" && cell !== null)) continue;
    const obj = {};
    headers.forEach((h, i) => {
      if (h) obj[h] = row[i];
    });
    rows.push(obj);
  }
  return rows;
}

function getRecords_(entity) {
  return readRaw_(entity).map((row) => normalize_(entity, row));
}

function writeRecord_(entity, record) {
  const sh = getSheet_(entity);
  const headers = HEADERS[entity];
  const values = sh.getDataRange().getValues();
  const idCol = headers.indexOf("id");
  let rowIndex = -1;

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][idCol]) === String(record.id)) {
      rowIndex = i + 1;
      break;
    }
  }

  if (rowIndex === -1) rowIndex = Math.max(sh.getLastRow() + 1, 2);

  // Aplica formato de texto a fechas/horas antes de escribir para que
  // Sheets no las convierta a valores de fecha.
  TEXT_COLUMNS[entity].forEach((column) => {
    const idx = headers.indexOf(column);
    if (idx !== -1) sh.getRange(rowIndex, idx + 1).setNumberFormat("@");
  });

  const row = headers.map((h) => {
    const value = record[h];
    return value === undefined || value === null ? "" : value;
  });
  sh.getRange(rowIndex, 1, 1, headers.length).setValues([row]);
  return record;
}

function deleteRecord_(entity, id) {
  const sh = getSheet_(entity);
  const headers = HEADERS[entity];
  const values = sh.getDataRange().getValues();
  const idCol = headers.indexOf("id");
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][idCol]) === String(id)) {
      sh.deleteRow(i + 1);
      return true;
    }
  }
  return false;
}

/* ============================================================
   CONFIGURACIÓN
   ============================================================ */

function getConfig_() {
  const stored = {};
  readRaw_("config").forEach((row) => {
    const key = str_(row.clave);
    if (key) stored[key] = configValue_(row.valor);
  });
  return Object.assign({}, DEFAULTS.config, stored);
}

function saveConfig_(patch) {
  const sh = getSheet_("config");
  const values = sh.getDataRange().getValues();
  const index = {};
  for (let i = 1; i < values.length; i++) {
    const key = str_(values[i][0]);
    if (key) index[key] = i + 1;
  }

  Object.keys(patch || {}).forEach((key) => {
    if (!key) return;
    const value = patch[key] === null || patch[key] === undefined ? "" : String(patch[key]);
    if (index[key]) {
      sh.getRange(index[key], 2).setNumberFormat("@").setValue(value);
    } else {
      const row = sh.getLastRow() + 1;
      sh.getRange(row, 1).setNumberFormat("@").setValue(key);
      sh.getRange(row, 2).setNumberFormat("@").setValue(value);
      index[key] = row;
    }
  });

  return getConfig_();
}

function seedConfig_() {
  const sh = getSheet_("config");
  if (sh.getLastRow() > 1) return;
  const rows = Object.keys(DEFAULTS.config).map((key) => [key, DEFAULTS.config[key]]);
  sh.getRange(2, 2, rows.length, 1).setNumberFormat("@");
  sh.getRange(2, 1, rows.length, 2).setValues(rows);
}

function configValue_(value) {
  if (value instanceof Date) return Utilities.formatDate(value, TZ, "HH:mm");
  if (typeof value === "number" && value >= 0 && value < 1) {
    return timeFromMinutes_(Math.round(value * 24 * 60));
  }
  return str_(value);
}

function seedRecords_(entity, records) {
  const sh = getSheet_(entity);
  if (sh.getLastRow() > 1) return;
  const headers = HEADERS[entity];
  const rows = records.map((record) => headers.map((h) => (record[h] === undefined ? "" : record[h])));
  TEXT_COLUMNS[entity].forEach((column) => {
    const idx = headers.indexOf(column);
    if (idx !== -1) sh.getRange(2, idx + 1, rows.length, 1).setNumberFormat("@");
  });
  sh.getRange(2, 1, rows.length, headers.length).setValues(rows);
}

/* ============================================================
   NORMALIZACIÓN
   ============================================================ */

function normalize_(entity, raw) {
  if (entity === "services") {
    return {
      id: str_(raw.id),
      nombre: str_(raw.nombre),
      descripcion: str_(raw.descripcion),
      duracion_min: num_(raw.duracion_min, 30),
      precio: num_(raw.precio, 0),
      activo: bool_(raw.activo, true),
      orden: num_(raw.orden, 0),
    };
  }

  if (entity === "barbers") {
    return {
      id: str_(raw.id),
      nombre: str_(raw.nombre),
      rol: str_(raw.rol),
      especialidad: str_(raw.especialidad),
      telefono: str_(raw.telefono),
      comision_pct: num_(raw.comision_pct, 0),
      activo: bool_(raw.activo, true),
      color: str_(raw.color) || "#C98A4B",
      clave: str_(raw.clave),
    };
  }

  if (entity === "clients") {
    return {
      id: str_(raw.id),
      nombre: str_(raw.nombre),
      telefono: str_(raw.telefono),
      email: str_(raw.email),
      notas: str_(raw.notas),
      creado_en: date_(raw.creado_en),
      total_citas: num_(raw.total_citas, 0),
      total_gastado: num_(raw.total_gastado, 0),
      ultima_visita: date_(raw.ultima_visita),
    };
  }

  if (entity === "appointments") {
    return {
      id: str_(raw.id),
      fecha: date_(raw.fecha),
      hora: time_(raw.hora),
      cliente_id: str_(raw.cliente_id),
      cliente_nombre: str_(raw.cliente_nombre),
      cliente_telefono: str_(raw.cliente_telefono),
      servicio_id: str_(raw.servicio_id),
      servicio_nombre: str_(raw.servicio_nombre),
      barbero_id: str_(raw.barbero_id),
      barbero_nombre: str_(raw.barbero_nombre),
      precio: num_(raw.precio, 0),
      duracion_min: num_(raw.duracion_min, 30),
      estado: str_(raw.estado) || "pendiente",
      notas: str_(raw.notas),
      creado_en: timestamp_(raw.creado_en),
      origen: str_(raw.origen) || "web",
      inicio_en: timestamp_(raw.inicio_en),
      fin_en: timestamp_(raw.fin_en),
      duracion_real_min: num_(raw.duracion_real_min, 0),
    };
  }

  if (entity === "incomes") {
    return {
      id: str_(raw.id),
      fecha: date_(raw.fecha),
      monto: num_(raw.monto, 0),
      categoria: str_(raw.categoria),
      descripcion: str_(raw.descripcion),
      cita_id: str_(raw.cita_id),
      metodo_pago: str_(raw.metodo_pago),
      barbero_id: str_(raw.barbero_id),
      creado_en: timestamp_(raw.creado_en),
    };
  }

  if (entity === "expenses") {
    return {
      id: str_(raw.id),
      fecha: date_(raw.fecha),
      monto: num_(raw.monto, 0),
      categoria: str_(raw.categoria),
      descripcion: str_(raw.descripcion),
      metodo_pago: str_(raw.metodo_pago),
      creado_en: timestamp_(raw.creado_en),
    };
  }

  return raw;
}

function publicAppointment_(appt) {
  return {
    id: appt.id,
    codigo: shortCode_(appt.id),
    fecha: appt.fecha,
    hora: appt.hora,
    cliente_nombre: appt.cliente_nombre,
    cliente_telefono: appt.cliente_telefono,
    servicio_id: appt.servicio_id,
    servicio_nombre: appt.servicio_nombre,
    barbero_id: appt.barbero_id,
    barbero_nombre: appt.barbero_nombre,
    precio: Number(appt.precio) || 0,
    duracion_min: Number(appt.duracion_min) || 30,
    estado: appt.estado,
    notas: appt.notas || "",
    creado_en: appt.creado_en || "",
  };
}

/* ============================================================
   UTILIDADES
   ============================================================ */

function requireAdmin_(payload) {
  const expected = getAdminKey_();
  if (String((payload && payload.key) || "") !== expected) throw new Error("Clave incorrecta.");
}

function getAdminKey_() {
  const key = PropertiesService.getScriptProperties().getProperty("ADMIN_KEY");
  if (!key) {
    throw new Error("Falta configurar la clave del panel. Ejecuta configurarClave(\"tu-clave\") en Apps Script.");
  }
  return key;
}

function withLock_(fn) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) {
    throw new Error("El sistema está ocupado. Intenta de nuevo en unos segundos.");
  }
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function str_(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function num_(value, fallback) {
  if (value === "" || value === null || value === undefined) return fallback;
  const n = Number(value);
  return isNaN(n) ? fallback : n;
}

function bool_(value, fallback) {
  if (value === "" || value === null || value === undefined) return fallback;
  if (typeof value === "boolean") return value;
  const text = String(value).trim().toLowerCase();
  if (["false", "0", "no", "falso"].indexOf(text) !== -1) return false;
  if (["true", "1", "sí", "si", "verdadero"].indexOf(text) !== -1) return true;
  return fallback;
}

function date_(value) {
  if (value === null || value === undefined || value === "") return "";
  if (value instanceof Date) return Utilities.formatDate(value, TZ, "yyyy-MM-dd");
  if (typeof value === "number") {
    // Fecha serial de Google Sheets (días desde 1899-12-30).
    const ms = Math.round((value - 25569) * 86400 * 1000);
    const d = new Date(ms);
    return d.getUTCFullYear() + "-" + pad2_(d.getUTCMonth() + 1) + "-" + pad2_(d.getUTCDate());
  }
  const match = String(value).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return match[1] + "-" + match[2] + "-" + match[3];
  return str_(value).slice(0, 10);
}

function time_(value) {
  if (value === null || value === undefined || value === "") return "";
  if (value instanceof Date) return Utilities.formatDate(value, TZ, "HH:mm");
  if (typeof value === "number") return timeFromMinutes_(Math.round(value * 24 * 60));
  const match = String(value).trim().match(/^(\d{1,2}):(\d{2})/);
  if (match) return pad2_(Number(match[1])) + ":" + match[2];
  return str_(value).slice(0, 5);
}

function timestamp_(value) {
  if (value === null || value === undefined || value === "") return "";
  if (value instanceof Date) return Utilities.formatDate(value, TZ, "yyyy-MM-dd'T'HH:mm:ss");
  if (typeof value === "number") {
    const ms = Math.round((value - 25569) * 86400 * 1000);
    return new Date(ms).toISOString();
  }
  return str_(value);
}

function today_() {
  return Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd");
}

function nowMinutes_() {
  return Number(Utilities.formatDate(new Date(), TZ, "HH")) * 60 +
    Number(Utilities.formatDate(new Date(), TZ, "mm"));
}

function parseISODate_(iso) {
  const parts = String(iso || "").slice(0, 10).split("-").map(Number);
  return new Date(parts[0], (parts[1] || 1) - 1, parts[2] || 1);
}

function toISO_(date) {
  return date.getFullYear() + "-" + pad2_(date.getMonth() + 1) + "-" + pad2_(date.getDate());
}

function addDays_(iso, days) {
  const d = parseISODate_(iso);
  d.setDate(d.getDate() + days);
  return toISO_(d);
}

function minutesFromTime_(time) {
  const parts = String(time || "00:00").split(":").map(Number);
  return (parts[0] || 0) * 60 + (parts[1] || 0);
}

function timeFromMinutes_(total) {
  const t = ((Math.round(total) % 1440) + 1440) % 1440;
  return pad2_(Math.floor(t / 60)) + ":" + pad2_(t % 60);
}

function pad2_(n) {
  return String(n).padStart(2, "0");
}

function normalizePhone_(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
}

function shortCode_(id) {
  return String(id || "")
    .replace(/[^a-z0-9]/gi, "")
    .slice(-6)
    .toUpperCase();
}

function uid_(prefix) {
  return prefix + "-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}
