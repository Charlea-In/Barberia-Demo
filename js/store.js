/* ============================================================
   STORE — capa de datos
   Modo demo: localStorage (funciona sin configurar nada)
   Modo Sheets: POST al Web App de Google Apps Script
   La interfaz pública y el panel usan exactamente la misma API.
   ============================================================ */
(function () {
  const C = window.BARBER_CONFIG;
  const U = window.UI;

  const DEMO = !C.api.url;
  const DB_KEY = "norte_barberia_db_v1";
  const KEY_STORE = "norte_admin_key";

  let schedule = scheduleFrom({});
  let adminKey = sessionStorage.getItem(KEY_STORE) || "";

  /* ---------- Horario a partir de la config ---------- */
  function scheduleFrom(config) {
    const open = config.hora_inicio || C.schedule.open;
    const close = config.hora_fin || C.schedule.close;
    const closedRaw = config.dias_cerrados !== undefined ? config.dias_cerrados : C.schedule.closedDays.join(",");
    const closedDays = String(closedRaw)
      .split(",")
      .map((n) => Number(String(n).trim()))
      .filter((n) => !Number.isNaN(n));
    return {
      open,
      close,
      openMin: U.minutesFromTime(open),
      closeMin: U.minutesFromTime(close),
      slotMinutes: Number(config.slot_minutos) || C.schedule.slotMinutes,
      closedDays,
      leadMinutes: Number(config.lead_minutos ?? C.schedule.leadTimeMinutes) || 0,
    };
  }

  /* ---------- Utilidades demo ---------- */
  function saveDB(db) {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  }

  function loadDB() {
    try {
      const raw = localStorage.getItem(DB_KEY);
      if (raw) {
        const db = JSON.parse(raw);
        if (db && db.version === 1) return db;
      }
    } catch (e) {
      console.warn("No se pudo leer la base demo, se regenera.", e);
    }
    const db = seedDB();
    saveDB(db);
    return db;
  }

  function shortCode(id) {
    return String(id || "")
      .replace(/[^a-z0-9]/gi, "")
      .slice(-6)
      .toUpperCase();
  }

  function publicAppointment(a) {
    return {
      id: a.id,
      codigo: shortCode(a.id),
      fecha: a.fecha,
      hora: a.hora,
      cliente_nombre: a.cliente_nombre,
      cliente_telefono: a.cliente_telefono,
      servicio_id: a.servicio_id,
      servicio_nombre: a.servicio_nombre,
      barbero_id: a.barbero_id,
      barbero_nombre: a.barbero_nombre,
      precio: Number(a.precio) || 0,
      duracion_min: Number(a.duracion_min) || 30,
      estado: a.estado,
      notas: a.notas || "",
      creado_en: a.creado_en || "",
    };
  }

  function recomputeClient(db, clientId) {
    const client = db.clients.find((c) => c.id === clientId);
    if (!client) return;
    const done = db.appointments.filter((a) => a.cliente_id === clientId && a.estado === "completada");
    client.total_citas = done.length;
    client.total_gastado = U.sum(done, "precio");
    client.ultima_visita = done.reduce((max, a) => (a.fecha > max ? a.fecha : max), "");
  }

  function ensureClient(db, data) {
    const phone = U.normalizePhone(data.cliente_telefono || data.telefono);
    let client = null;
    if (data.cliente_id) client = db.clients.find((c) => c.id === data.cliente_id) || null;
    if (!client && phone) client = db.clients.find((c) => U.normalizePhone(c.telefono) === phone) || null;

    if (!client) {
      client = {
        id: U.uid("cl"),
        nombre: data.cliente_nombre || data.nombre || "Cliente",
        telefono: data.cliente_telefono || data.telefono || "",
        email: data.cliente_email || data.email || "",
        notas: "",
        creado_en: U.todayISO(),
        total_citas: 0,
        total_gastado: 0,
        ultima_visita: "",
      };
      db.clients.push(client);
    } else {
      if (data.cliente_nombre || data.nombre) client.nombre = data.cliente_nombre || data.nombre;
      if (data.cliente_email || data.email) client.email = data.cliente_email || data.email;
    }
    return client;
  }

  function sortAppointments(list) {
    return [...list].sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora));
  }

  function computeAvailability(db, { date, serviceId, barberId }) {
    const sch = scheduleFrom(db.config);
    const svc = db.services.find((s) => s.id === serviceId && s.activo !== false);
    if (!svc) throw new Error("El servicio ya no está disponible.");
    if (!date) throw new Error("Falta la fecha.");

    const d = U.parseISO(date);
    if (Number.isNaN(d.getTime())) throw new Error("Fecha inválida.");
    if (sch.closedDays.includes(d.getDay())) return { date, closed: true, slots: [] };
    if (date < U.todayISO()) return { date, closed: false, slots: [] };

    const barbers = db.barbers.filter(
      (b) => b.activo !== false && (!barberId || barberId === "any" || b.id === barberId)
    );
    if (!barbers.length) return { date, closed: false, slots: [] };

    const busyAppts = db.appointments.filter(
      (a) => a.fecha === date && !["cancelada", "no_asistio"].includes(a.estado)
    );
    const duration = Number(svc.duracion_min) || 30;
    const minStart = date === U.todayISO() ? U.nowMinutes() + sch.leadMinutes : -1;
    const slots = [];

    for (let t = sch.openMin; t + duration <= sch.closeMin; t += sch.slotMinutes) {
      if (t < minStart) continue;
      const available = barbers.filter((b) => {
        const busy = busyAppts
          .filter((a) => a.barbero_id === b.id)
          .map((a) => [U.minutesFromTime(a.hora), U.minutesFromTime(a.hora) + (Number(a.duracion_min) || 30)]);
        return !busy.some(([start, end]) => t < end && t + duration > start);
      });
      if (available.length) slots.push({ time: U.timeFromMinutes(t), barbers: available.map((b) => b.id) });
    }
    return { date, closed: false, slots };
  }

  /* ---------- Datos de demostración ---------- */
  function seedDB() {
    let seed = 20261111;
    const rnd = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
    const randInt = (a, b) => a + Math.floor(rnd() * (b - a + 1));

    const config = {
      nombre_negocio: C.brand.name,
      telefono: C.contact.phone,
      whatsapp: C.contact.whatsapp,
      email: C.contact.email,
      direccion: C.contact.address,
      instagram: C.contact.instagram,
      moneda: C.currency.code,
      hora_inicio: C.schedule.open,
      hora_fin: C.schedule.close,
      slot_minutos: String(C.schedule.slotMinutes),
      dias_cerrados: C.schedule.closedDays.join(","),
      lead_minutos: String(C.schedule.leadTimeMinutes),
    };

    const services = C.services.map((s) => ({ ...s }));
    const barbers = C.barbers.map((b) => ({ ...b }));

    const clientSeeds = [
      ["Aarón Villalobos", "5512348890", "aaron.v@correo.mx"],
      ["Bruno Castañeda", "5523459911", "bruno.c@correo.mx"],
      ["Carlos Mendoza", "5534561122", "carlos.m@correo.mx"],
      ["Damián Ortega", "5545672233", "damian.o@correo.mx"],
      ["Emiliano Rivas", "5556783344", "emiliano.r@correo.mx"],
      ["Fernando Lozano", "5567894455", "fer.lozano@correo.mx"],
      ["Gael Domínguez", "5578905566", "gael.d@correo.mx"],
      ["Hugo Barrera", "5589016677", "hugo.b@correo.mx"],
      ["Iker Salgado", "5590127788", "iker.s@correo.mx"],
      ["Joaquín Paredes", "5511223344", "joaquin.p@correo.mx"],
      ["Kevin Aguilar", "5522334455", "kevin.a@correo.mx"],
      ["Luis Trejo", "5533445566", "luis.t@correo.mx"],
    ];
    const clients = clientSeeds.map(([nombre, telefono, email], i) => ({
      id: `cl-demo-${i + 1}`,
      nombre,
      telefono,
      email,
      notas: i % 4 === 0 ? "Prefiere máquina 1 a los lados." : "",
      creado_en: U.addDays(U.todayISO(), -randInt(30, 240)),
      total_citas: 0,
      total_gastado: 0,
      ultima_visita: "",
    }));

    const openMin = U.minutesFromTime(config.hora_inicio);
    const closeMin = U.minutesFromTime(config.hora_fin);
    const slot = Number(config.slot_minutos);
    const closed = config.dias_cerrados.split(",").map(Number);
    const base = U.todayISO();
    const nowMin = U.nowMinutes();
    const appointments = [];
    const incomes = [];
    const activeServices = services.filter((s) => s.activo !== false);

    for (let offset = -60; offset <= 14; offset++) {
      const iso = U.addDays(base, offset);
      const dayOfWeek = U.parseISO(iso).getDay();
      if (closed.includes(dayOfWeek)) continue;

      barbers.forEach((barber) => {
        let t = openMin;
        while (t + slot <= closeMin) {
          const probability = offset < 0 ? 0.4 : offset === 0 ? 0.34 : 0.24;
          if (rnd() < probability) {
            const svc = pick(activeServices);
            if (t + svc.duracion_min <= closeMin) {
              const client = rnd() < 0.42 ? clients[0] : pick(clients);
              let estado;
              if (offset < 0) estado = rnd() < 0.9 ? "completada" : rnd() < 0.5 ? "cancelada" : "no_asistio";
              else if (offset === 0) estado = t + svc.duracion_min <= nowMin ? "completada" : rnd() < 0.55 ? "confirmada" : "pendiente";
              else estado = rnd() < 0.3 ? "confirmada" : "pendiente";

              const id = `apt-${offset}-${barber.id.slice(-4)}-${t}`;
              const appt = {
                id,
                fecha: iso,
                hora: U.timeFromMinutes(t),
                cliente_id: client.id,
                cliente_nombre: client.nombre,
                cliente_telefono: client.telefono,
                servicio_id: svc.id,
                servicio_nombre: svc.nombre,
                barbero_id: barber.id,
                barbero_nombre: barber.nombre,
                precio: svc.precio,
                duracion_min: svc.duracion_min,
                estado,
                notas: rnd() < 0.12 ? "Cliente frecuente. Café sin azúcar." : "",
                creado_en: `${U.addDays(iso, -randInt(1, 12))}T${U.timeFromMinutes(randInt(9 * 60, 20 * 60))}:00`,
                origen: rnd() < 0.55 ? "web" : "mostrador",
              };
              appointments.push(appt);

              if (estado === "completada") {
                incomes.push({
                  id: `inc-${offset}-${barber.id.slice(-4)}-${t}`,
                  fecha: iso,
                  monto: svc.precio,
                  categoria: "Servicio",
                  descripcion: `${svc.nombre} · ${client.nombre}`,
                  cita_id: id,
                  metodo_pago: pick(["Efectivo", "Efectivo", "Tarjeta", "Transferencia"]),
                  barbero_id: barber.id,
                  creado_en: `${iso}T${U.timeFromMinutes(t)}:00`,
                });
              }
              t += svc.duracion_min;
              continue;
            }
          }
          t += slot;
        }
      });
    }

    // Ventas de producto
    const products = [
      ["Pomada mate", 320],
      ["Shampoo sólido", 220],
      ["Aceite de barba", 260],
      ["Bálsamo after-shave", 240],
      ["Peine de carbono", 180],
    ];
    for (let i = 0; i < 9; i++) {
      const [nombre, monto] = pick(products);
      const fecha = U.addDays(base, -randInt(0, 32));
      incomes.push({
        id: `inc-prod-${i + 1}`,
        fecha,
        monto,
        categoria: "Productos",
        descripcion: nombre,
        cita_id: "",
        metodo_pago: pick(["Efectivo", "Tarjeta"]),
        barbero_id: "",
        creado_en: `${fecha}T13:00:00`,
      });
    }

    // Gastos
    const thisMonth = U.startOfMonth(base);
    const prevMonthStart = U.startOfMonth(U.addDays(thisMonth, -1));
    const expenses = [
      { id: "exp-1", fecha: thisMonth, monto: 12000, categoria: "Renta", descripcion: "Renta del local", metodo_pago: "Transferencia", creado_en: `${thisMonth}T09:00:00` },
      { id: "exp-2", fecha: prevMonthStart, monto: 12000, categoria: "Renta", descripcion: "Renta del local", metodo_pago: "Transferencia", creado_en: `${prevMonthStart}T09:00:00` },
      { id: "exp-3", fecha: U.addDays(base, -randInt(2, 6)), monto: 2450, categoria: "Insumos", descripcion: "Navajas, cuchillas y toallas", metodo_pago: "Tarjeta", creado_en: `${base}T10:00:00` },
      { id: "exp-4", fecha: U.addDays(base, -randInt(7, 12)), monto: 1680, categoria: "Insumos", descripcion: "Pomadas y productos de venta", metodo_pago: "Efectivo", creado_en: `${base}T10:00:00` },
      { id: "exp-5", fecha: U.addDays(base, -randInt(13, 18)), monto: 980, categoria: "Servicios", descripcion: "Luz y agua", metodo_pago: "Transferencia", creado_en: `${base}T10:00:00` },
      { id: "exp-6", fecha: U.addDays(base, -randInt(19, 24)), monto: 1500, categoria: "Marketing", descripcion: "Pauta en Instagram", metodo_pago: "Tarjeta", creado_en: `${base}T10:00:00` },
      { id: "exp-7", fecha: U.addDays(base, -randInt(25, 30)), monto: 3200, categoria: "Equipo", descripcion: "Mantenimiento de máquinas", metodo_pago: "Transferencia", creado_en: `${base}T10:00:00` },
      { id: "exp-8", fecha: U.addDays(base, -randInt(31, 38)), monto: 870, categoria: "Insumos", descripcion: "Café, agua y limpieza", metodo_pago: "Efectivo", creado_en: `${base}T10:00:00` },
    ];

    const db = {
      version: 1,
      config,
      services,
      barbers,
      clients,
      appointments: sortAppointments(appointments),
      incomes,
      expenses,
      seeded_at: new Date().toISOString(),
    };

    clients.forEach((c) => recomputeClient(db, c.id));
    return db;
  }

  /* ---------- Acciones demo ---------- */
  function demoBootstrap() {
    const db = loadDB();
    const data = {
      services: db.services.filter((s) => s.activo !== false).sort((a, b) => Number(a.orden) - Number(b.orden)),
      barbers: db.barbers.filter((b) => b.activo !== false),
      config: { ...db.config },
    };
    data.schedule = scheduleFrom(data.config);
    return data;
  }

  function demoAvailability(payload) {
    return computeAvailability(loadDB(), payload);
  }

  function demoBook(payload) {
    const db = loadDB();
    const nombre = String(payload.cliente_nombre || "").trim();
    const telefono = String(payload.cliente_telefono || "").trim();
    if (nombre.length < 2) throw new Error("Escribe tu nombre completo.");
    if (U.normalizePhone(telefono).length < 10) throw new Error("Escribe un teléfono de 10 dígitos.");
    if (!payload.fecha || !payload.hora) throw new Error("Elige fecha y hora.");

    const svc = db.services.find((s) => s.id === payload.servicio_id && s.activo !== false);
    if (!svc) throw new Error("El servicio ya no está disponible.");

    const availability = computeAvailability(db, {
      date: payload.fecha,
      serviceId: payload.servicio_id,
      barberId: payload.barbero_id || "any",
    });
    if (availability.closed) throw new Error("Ese día la barbería está cerrada.");
    const slot = availability.slots.find((s) => s.time === payload.hora);
    if (!slot) throw new Error("Ese horario acaba de ocuparse. Elige otro.");
    const barberId = payload.barbero_id && payload.barbero_id !== "any" ? payload.barbero_id : slot.barbers[0];
    if (!slot.barbers.includes(barberId)) throw new Error("Ese barbero ya no tiene espacio a esa hora.");
    const barber = db.barbers.find((b) => b.id === barberId);
    if (!barber) throw new Error("Barbero no encontrado.");

    const phoneNorm = U.normalizePhone(telefono);
    const duplicate = db.appointments.find(
      (a) =>
        U.normalizePhone(a.cliente_telefono) === phoneNorm &&
        a.fecha === payload.fecha &&
        a.hora === payload.hora &&
        !["cancelada", "no_asistio"].includes(a.estado)
    );
    if (duplicate) throw new Error("Ya tienes una cita a esa hora. Revisa “Mis citas”.");

    const client = ensureClient(db, {
      cliente_nombre: nombre,
      cliente_telefono: telefono,
      cliente_email: payload.cliente_email || "",
    });

    const appt = {
      id: U.uid("apt"),
      fecha: payload.fecha,
      hora: payload.hora,
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
      notas: String(payload.notas || "").slice(0, 300),
      creado_en: new Date().toISOString(),
      origen: "web",
    };
    db.appointments.push(appt);
    saveDB(db);
    return publicAppointment(appt);
  }

  function demoLookup(payload) {
    const phone = U.normalizePhone(payload.telefono);
    if (phone.length < 10) throw new Error("Escribe el teléfono con el que reservaste.");
    const db = loadDB();
    const since = U.addDays(U.todayISO(), -120);
    const list = db.appointments
      .filter((a) => U.normalizePhone(a.cliente_telefono) === phone && a.fecha >= since)
      .sort((a, b) => (b.fecha + b.hora).localeCompare(a.fecha + a.hora))
      .slice(0, 40)
      .map(publicAppointment);
    return { appointments: list };
  }

  function demoCancel(payload) {
    const db = loadDB();
    const appt = db.appointments.find((a) => a.id === payload.id);
    if (!appt) throw new Error("No encontramos esa cita.");
    if (U.normalizePhone(appt.cliente_telefono) !== U.normalizePhone(payload.telefono)) {
      throw new Error("El teléfono no coincide con la cita.");
    }
    if (!["pendiente", "confirmada"].includes(appt.estado)) {
      throw new Error("Esta cita ya no se puede cancelar.");
    }
    const when = `${appt.fecha}T${appt.hora}`;
    const now = `${U.todayISO()}T${U.timeFromMinutes(U.nowMinutes())}`;
    if (when <= now) throw new Error("La cita ya pasó o está en curso.");
    appt.estado = "cancelada";
    saveDB(db);
    return { ok: true };
  }

  function demoAdminData() {
    const db = loadDB();
    return JSON.parse(JSON.stringify(db));
  }

  function demoAdminLogin(payload) {
    if (String(payload.key || "") !== C.admin.demoKey) throw new Error("Clave incorrecta.");
    return { ok: true };
  }

  function demoAdminSave(payload) {
    const db = loadDB();
    const entity = payload.entity;
    let input = { ...(payload.record || {}) };
    let previous = null;

    if (entity === "config") {
      Object.keys(input).forEach((k) => {
        db.config[k] = String(input[k] ?? "");
      });
      saveDB(db);
      return { config: db.config };
    }

    const lists = {
      services: db.services,
      barbers: db.barbers,
      clients: db.clients,
      appointments: db.appointments,
      incomes: db.incomes,
      expenses: db.expenses,
    };
    const list = lists[entity];
    if (!list) throw new Error("Entidad no válida: " + entity);

    // Las actualizaciones parciales (por ejemplo activar/pausar) se mezclan
    // con el registro existente antes de validar.
    if (input.id) {
      const existing = list.find((item) => item.id === input.id);
      if (existing) {
        previous = existing;
        input = { ...existing, ...input };
      }
    }

    if (entity === "appointments") {
      if (!input.fecha || !input.hora) throw new Error("La cita necesita fecha y hora.");
      if (!input.servicio_id) throw new Error("Selecciona un servicio.");
      if (!input.barbero_id) throw new Error("Selecciona un barbero.");
      const svc = db.services.find((s) => s.id === input.servicio_id);
      if (!svc) throw new Error("Servicio no encontrado.");
      const barber = db.barbers.find((b) => b.id === input.barbero_id);
      if (!barber) throw new Error("Barbero no encontrado.");
      if (!input.cliente_telefono) throw new Error("La cita necesita un teléfono.");
      const client = ensureClient(db, input);
      Object.assign(input, {
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
      });
    }

    if (entity === "clients") {
      if (!String(input.nombre || "").trim()) throw new Error("El cliente necesita un nombre.");
      input.telefono = String(input.telefono || "").trim();
      input.creado_en = input.creado_en || U.todayISO();
      input.total_citas = Number(input.total_citas) || 0;
      input.total_gastado = Number(input.total_gastado) || 0;
    }

    if (entity === "services") {
      if (!String(input.nombre || "").trim()) throw new Error("El servicio necesita un nombre.");
      input.precio = Number(input.precio) || 0;
      input.duracion_min = Number(input.duracion_min) || 30;
      input.orden = Number(input.orden) || list.length + 1;
      input.activo = input.activo !== false;
    }

    if (entity === "barbers") {
      if (!String(input.nombre || "").trim()) throw new Error("El barbero necesita un nombre.");
      input.comision_pct = Number(input.comision_pct) || 0;
      input.activo = input.activo !== false;
      if (!input.color) input.color = "#C98A4B";
    }

    if (entity === "incomes" || entity === "expenses") {
      input.monto = Number(input.monto) || 0;
      if (input.monto <= 0) throw new Error("El monto debe ser mayor a cero.");
      input.fecha = input.fecha || U.todayISO();
      input.categoria = input.categoria || "Otros";
      input.metodo_pago = input.metodo_pago || "Efectivo";
    }

    const prefixes = { services: "srv", barbers: "brb", clients: "cl", appointments: "apt", incomes: "inc", expenses: "exp" };
    let record;
    if (input.id) {
      const index = list.findIndex((item) => item.id === input.id);
      if (index === -1) throw new Error("Registro no encontrado.");
      record = { ...list[index], ...input };
      list[index] = record;
    } else {
      record = { ...input, id: U.uid(prefixes[entity] || "reg") };
      list.push(record);
    }

    if (entity === "appointments") {
      recomputeClient(db, record.cliente_id);
      if (previous && previous.cliente_id && previous.cliente_id !== record.cliente_id) {
        recomputeClient(db, previous.cliente_id);
      }
    }
    if (entity === "clients") {
      recomputeClient(db, record.id);
    }

    saveDB(db);
    return record;
  }

  function demoAdminDelete(payload) {
    const db = loadDB();
    const entity = payload.entity;
    if (entity === "config") throw new Error("La configuración no se puede borrar.");
    const list = db[entity];
    if (!list) throw new Error("Entidad no válida.");
    const index = list.findIndex((item) => item.id === payload.id);
    if (index === -1) throw new Error("Registro no encontrado.");
    const [removed] = list.splice(index, 1);
    if (entity === "appointments") {
      db.incomes = db.incomes.filter((i) => i.cita_id !== removed.id);
      recomputeClient(db, removed.cliente_id);
    }
    if (entity === "clients") {
      // conserva las citas históricas, pero sin vínculo activo
      db.appointments.forEach((a) => {
        if (a.cliente_id === removed.id) a.cliente_id = "";
      });
    }
    saveDB(db);
    return { ok: true };
  }

  function demoSetStatus(payload) {
    const db = loadDB();
    const appt = db.appointments.find((a) => a.id === payload.id);
    if (!appt) throw new Error("Cita no encontrada.");
    appt.estado = payload.estado;

    if (payload.estado === "completada") {
      let income = db.incomes.find((i) => i.cita_id === appt.id);
      if (!income) {
        income = {
          id: U.uid("inc"),
          fecha: appt.fecha,
          monto: Number(appt.precio) || 0,
          categoria: "Servicio",
          descripcion: `${appt.servicio_nombre} · ${appt.cliente_nombre}`,
          cita_id: appt.id,
          metodo_pago: payload.metodo_pago || "Efectivo",
          barbero_id: appt.barbero_id,
          creado_en: new Date().toISOString(),
        };
        db.incomes.push(income);
      } else {
        income.monto = Number(appt.precio) || income.monto;
        if (payload.metodo_pago) income.metodo_pago = payload.metodo_pago;
      }
    } else {
      db.incomes = db.incomes.filter((i) => i.cita_id !== appt.id);
    }

    recomputeClient(db, appt.cliente_id);
    saveDB(db);
    return { ok: true, appointment: publicAppointment(appt) };
  }

  /* ---------- Cliente HTTP (modo Sheets) ---------- */
  async function request(action, payload = {}) {
    if (DEMO) throw new Error("request() no se usa en modo demo");
    const response = await fetch(C.api.url, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action, payload }),
      redirect: "follow",
    });
    if (!response.ok) throw new Error(`Error de conexión (${response.status}). Revisa la URL del Web App.`);
    let json;
    try {
      json = await response.json();
    } catch (e) {
      throw new Error("La respuesta del servidor no es JSON válido. Revisa el despliegue de Apps Script.");
    }
    if (!json || json.ok !== true) throw new Error((json && json.error) || "Error del servidor.");
    return json.data;
  }

  function adminPayload(payload = {}) {
    return { ...payload, key: adminKey };
  }

  /* ---------- API pública ---------- */
  const Store = {
    mode: DEMO ? "demo" : "sheets",

    get schedule() {
      return schedule;
    },

    isClosed(iso) {
      return schedule.closedDays.includes(U.parseISO(iso).getDay());
    },

    getAdminKey() {
      return adminKey;
    },

    setAdminKey(key) {
      adminKey = key || "";
      if (adminKey) sessionStorage.setItem(KEY_STORE, adminKey);
      else sessionStorage.removeItem(KEY_STORE);
    },

    async bootstrap() {
      const data = DEMO ? demoBootstrap() : await request("bootstrap");
      schedule = scheduleFrom(data.config || {});
      data.schedule = schedule;
      return data;
    },

    async availability(payload) {
      if (DEMO) return demoAvailability(payload);
      return request("availability", payload);
    },

    async book(payload) {
      if (DEMO) return demoBook(payload);
      return request("book", payload);
    },

    async lookup(telefono) {
      if (DEMO) return demoLookup({ telefono });
      return request("lookup", { telefono });
    },

    async cancel(id, telefono) {
      if (DEMO) return demoCancel({ id, telefono });
      return request("cancel", { id, telefono });
    },

    /* ---------- Panel ---------- */
    async adminLogin(key) {
      if (DEMO) return demoAdminLogin({ key });
      const data = await request("adminLogin", { key });
      return data;
    },

    async adminData() {
      const data = DEMO ? demoAdminData() : await request("adminData", adminPayload());
      schedule = scheduleFrom(data.config || {});
      data.schedule = schedule;
      return data;
    },

    async save(entity, record) {
      if (DEMO) return demoAdminSave({ entity, record });
      return request("adminSave", adminPayload({ entity, record }));
    },

    async remove(entity, id) {
      if (DEMO) return demoAdminDelete({ entity, id });
      return request("adminDelete", adminPayload({ entity, id }));
    },

    async setStatus(id, estado, metodo_pago) {
      if (DEMO) return demoSetStatus({ id, estado, metodo_pago });
      return request("setStatus", adminPayload({ id, estado, metodo_pago }));
    },

    resetDemo() {
      if (!DEMO) return;
      localStorage.removeItem(DB_KEY);
      location.reload();
    },
  };

  window.Store = Store;
})();
