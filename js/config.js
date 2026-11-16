/* ============================================================
   NORTE BARBERÍA — Configuración central
   Este es el ÚNICO archivo que necesitas tocar para cambiar
   marca, contacto, horarios y la conexión con Google Sheets.
   ============================================================ */

window.BARBER_CONFIG = {
  brand: {
    name: "Norte Barbería",
    shortName: "Norte",
    monogram: "NB",
    tagline: "Corte preciso. Actitud clásica.",
    established: "2019",
    city: "San Salvador, El Salvador",
  },

  contact: {
    phone: "",
    whatsapp: "", // Número de WhatsApp del negocio en formato internacional, sin + ni espacios.
    email: "",
    address: "",
    instagram: "norte.barberia",
    mapsUrl: "https://maps.google.com/?q=San+Salvador,+El+Salvador",
  },

  currency: {
    code: "USD",
    locale: "es-SV",
  },

  schedule: {
    open: "10:00",
    close: "20:00",
    slotMinutes: 30,
    closedDays: [0], // 0 = domingo, 1 = lunes ... 6 = sábado
    leadTimeMinutes: 60, // anticipación mínima para reservar hoy
    maxDaysAhead: 45,
  },

  api: {
    // Pega aquí la URL del Web App de Apps Script (termina en /exec).
    // Si lo dejas vacío, la página funciona como demo funcional con datos locales.
    url: "https://script.google.com/macros/s/AKfycbySLhn_8tpbnsVpQrqyZE2sYmvbLbEWOUMRqOkfrc2nGsI46cnfi4HR2bjDnVz9mVc3/exec",
  },

  admin: {
    // Clave del panel en demo funcional. Con Sheets se usa la clave del Apps Script.
    demoKey: "barberia2026",
  },

  /* Datos iniciales. En modo Sheets se copian a la hoja la primera vez. */
  services: [
    { id: "srv-corte", nombre: "Corte clásico", descripcion: "Tijera y máquina, lavado y peinado final.", duracion_min: 30, precio: 8, activo: true, orden: 1 },
    { id: "srv-corte-barba", nombre: "Corte + barba", descripcion: "Corte a medida y perfilado de barba con navaja.", duracion_min: 45, precio: 12, activo: true, orden: 2 },
    { id: "srv-afeitado", nombre: "Afeitado tradicional", descripcion: "Navaja, toalla caliente y bálsamo calmante.", duracion_min: 30, precio: 8, activo: true, orden: 3 },
    { id: "srv-barba", nombre: "Perfilado de barba", descripcion: "Diseño, recorte y aceite para barba.", duracion_min: 20, precio: 6, activo: true, orden: 4 },
    { id: "srv-ritual", nombre: "Ritual completo", descripcion: "Corte, barba, mascarilla y toalla caliente.", duracion_min: 75, precio: 15, activo: true, orden: 5 },
    { id: "srv-nino", nombre: "Corte niño", descripcion: "Corte para los más pequeños de la casa.", duracion_min: 25, precio: 8, activo: true, orden: 6 },
    { id: "srv-color", nombre: "Camuflaje de canas", descripcion: "Tinte suave con acabado natural.", duracion_min: 40, precio: 10, activo: true, orden: 7 },
    { id: "srv-cejas", nombre: "Cejas", descripcion: "Perfilado con navaja.", duracion_min: 10, precio: 4, activo: true, orden: 8 },
  ],

  barbers: [
    { id: "brb-diego", nombre: "Diego Salas", rol: "Fundador", especialidad: "Fades y cortes clásicos", telefono: "", comision_pct: 50, activo: true, color: "#C98A4B", clave: "diego2026" },
    { id: "brb-marco", nombre: "Marco Ríos", rol: "Barbero senior", especialidad: "Afeitado y barba", telefono: "", comision_pct: 45, activo: true, color: "#7C8C6E", clave: "marco2026" },
    { id: "brb-ivan", nombre: "Iván Cruz", rol: "Barbero", especialidad: "Texturizados y color", telefono: "", comision_pct: 40, activo: true, color: "#8B7BA8", clave: "ivan2026" },
  ],
};
