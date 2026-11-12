/* ============================================================
   APP — lógica del sitio público
   ============================================================ */
(function () {
  const C = window.BARBER_CONFIG;
  const U = window.UI;
  const S = window.Store;

  const DAY_NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

  const state = {
    services: [...C.services],
    barbers: [...C.barbers],
    config: { ...C.contact },
    booking: null,
    lookup: { phone: "", results: null, confirmId: null, loading: false },
  };

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    wireStatic();
    renderAll();
    setupReveal();
    $("#year").textContent = new Date().getFullYear();
    const years = Math.max(1, new Date().getFullYear() - Number(C.brand.established || new Date().getFullYear()));
    const yearsEl = $("#stat-years");
    if (yearsEl) yearsEl.textContent = years;

    try {
      const data = await S.bootstrap();
      if (data.services && data.services.length) state.services = data.services;
      if (data.barbers && data.barbers.length) state.barbers = data.barbers;
      state.config = data.config || state.config;
      applyConfig(state.config);
      renderAll();
      renderHeroNext();
    } catch (error) {
      console.error(error);
      U.toast("No pudimos conectar con la agenda en línea. Intenta de nuevo en un momento.", "error", 5200);
    }

    setInterval(renderHeroCard, 60000);
  }

  const $ = (sel) => U.$(sel);
  const $$ = (sel) => U.$$(sel);

  /* ---------- Render general ---------- */
  function renderAll() {
    renderTicker();
    renderServices();
    renderBarbers();
    renderHours();
    renderHeroCard();
    $("#stat-barbers").textContent = state.barbers.length || C.barbers.length;
  }

  function renderTicker() {
    const items = state.services
      .map((s) => `<span class="ticker__item">${U.esc(s.nombre)} <b>${U.money(s.precio)}</b></span>`)
      .join("");
    $("#ticker-track").innerHTML = items + items;
  }

  function renderServices() {
    const list = [...state.services].sort((a, b) => (Number(a.orden) || 0) - (Number(b.orden) || 0));
    $("#services-grid").innerHTML = list
      .map(
        (s, i) => `
        <article class="service-card">
          <span class="service-card__num">${String(i + 1).padStart(2, "0")}</span>
          <h3>${U.esc(s.nombre)}</h3>
          <p>${U.esc(s.descripcion || "")}</p>
          <div class="service-card__foot">
            <div class="service-card__price">${U.money(s.precio)}<small>${Number(s.duracion_min)} min</small></div>
            <span class="service-card__time">Reservar →</span>
          </div>
          <button class="service-card__cta" type="button" data-book-service="${U.esc(s.id)}"
            aria-label="Reservar ${U.esc(s.nombre)}"></button>
        </article>`
      )
      .join("");
  }

  function renderBarbers() {
    $("#barbers-grid").innerHTML = state.barbers
      .map(
        (b) => `
        <article class="barber-card" style="--barber-color:${U.esc(b.color || "#c98a4b")}">
          <div class="barber-card__art">
            <span class="barber-card__tag">${U.esc(b.rol || "Barbero")}</span>
            <span class="barber-card__initials">${U.initials(b.nombre)}</span>
          </div>
          <div class="barber-card__body">
            <h3>${U.esc(b.nombre)}</h3>
            <div class="barber-card__role">${U.esc(b.especialidad || "Barbero")}</div>
            <p class="barber-card__spec">${U.esc(b.rol || "")}</p>
            <div class="barber-card__foot">
              <button class="link-arrow" type="button" data-book-barber="${U.esc(b.id)}">
                Reservar con ${U.esc(String(b.nombre).split(" ")[0])}
              </button>
            </div>
          </div>
        </article>`
      )
      .join("");
  }

  function renderHours() {
    const sch = S.schedule;
    const today = new Date().getDay();
    $("#hours-list").innerHTML = DAY_NAMES.map((name, i) => {
      const closed = sch.closedDays.includes(i);
      return `<div class="hours__row ${closed ? "hours__row--closed" : ""}">
        <span>${name}${i === today ? " · hoy" : ""}</span>
        <b>${closed ? "Cerrado" : `${sch.open} – ${sch.close}`}</b>
      </div>`;
    }).join("");
  }

  function renderHeroCard() {
    const sch = S.schedule;
    const now = new Date();
    const mins = now.getHours() * 60 + now.getMinutes();
    const closedToday = sch.closedDays.includes(now.getDay());
    const isOpen = !closedToday && mins >= sch.openMin && mins < sch.closeMin;

    $("#hero-hours").innerHTML = `${sch.open} <small>— ${sch.close}</small>`;

    const status = $("#hero-status");
    if (isOpen) {
      status.textContent = "Abierto ahora";
      status.className = "status-dot status-dot--open";
    } else if (closedToday) {
      status.textContent = "Cerrado hoy";
      status.className = "status-dot status-dot--closed";
    } else if (mins < sch.openMin) {
      status.textContent = `Abre ${sch.open}`;
      status.className = "status-dot status-dot--closed";
    } else {
      status.textContent = "Cerrado";
      status.className = "status-dot status-dot--closed";
    }

    $("#hero-services").innerHTML = state.services
      .slice(0, 3)
      .map(
        (s) => `<div class="hero-card__row"><span>${U.esc(s.nombre)}</span><b>${U.money(s.precio)}</b></div>`
      )
      .join("");
  }

  async function renderHeroNext() {
    const el = $("#hero-next");
    if (!el || !state.services.length) return;
    const service = state.services[0];
    try {
      const today = U.todayISO();
      const todayRes = await S.availability({ date: today, serviceId: service.id, barberId: "any" });
      if (todayRes.slots && todayRes.slots.length) {
        el.textContent = `Hoy ${todayRes.slots[0].time}`;
        return;
      }
      for (let i = 1; i <= 14; i++) {
        const iso = U.addDays(today, i);
        if (S.isClosed(iso)) continue;
        const res = await S.availability({ date: iso, serviceId: service.id, barberId: "any" });
        if (res.slots && res.slots.length) {
          el.textContent = `${U.relativeDay(iso)} ${res.slots[0].time}`;
          return;
        }
      }
      el.textContent = "Escríbenos";
    } catch (error) {
      el.textContent = "Escríbenos";
    }
  }

  /* ---------- Configuración de negocio ---------- */
  function applyConfig(config) {
    const map = {
      direccion: config.direccion || C.contact.address,
      telefono: config.telefono || C.contact.phone,
      email: config.email || C.contact.email,
      ciudad: C.brand.city,
      anio: C.brand.established,
    };
    $$("[data-config]").forEach((el) => {
      const value = map[el.dataset.config];
      if (value) el.textContent = value;
    });

    const phoneDigits = String(config.telefono || C.contact.phone).replace(/\D/g, "");
    const waDigits = String(config.whatsapp || C.contact.whatsapp).replace(/\D/g, "");
    const email = config.email || C.contact.email;
    const instagram = String(config.instagram || C.contact.instagram).replace(/^@/, "");
    const address = config.direccion || C.contact.address;

    $$('[data-config-link="phone"]').forEach((a) => (a.href = `tel:+${phoneDigits}`));
    $$('[data-config-link="email"]').forEach((a) => (a.href = `mailto:${email}`));
    $$('[data-config-link="instagram"]').forEach((a) => {
      a.href = `https://instagram.com/${instagram}`;
      if (/^@/.test(a.textContent.trim())) a.textContent = `@${instagram}`;
    });
    $$('[data-config-link="maps"]').forEach((a) => {
      a.href = C.contact.mapsUrl || `https://maps.google.com/?q=${encodeURIComponent(address)}`;
    });

    const waMessage = encodeURIComponent(`Hola, quiero reservar una cita en ${config.nombre_negocio || C.brand.name}.`);
    const waLink = `https://wa.me/${waDigits}?text=${waMessage}`;
    const wa = $("#whatsapp-link");
    if (wa) wa.href = waLink;
    const phoneLink = $("#phone-link");
    if (phoneLink) phoneLink.href = `tel:+${phoneDigits}`;
  }

  /* ---------- Reserva ---------- */
  function nextOpenDate() {
    const today = U.todayISO();
    for (let i = 0; i <= 21; i++) {
      const iso = U.addDays(today, i);
      if (!S.isClosed(iso)) return iso;
    }
    return today;
  }

  function openBooking(serviceId = null, barberId = "any") {
    if (!state.services.length) {
      U.toast("No hay servicios disponibles por el momento.", "error");
      return;
    }
    state.booking = {
      step: serviceId ? 2 : 1,
      serviceId: serviceId || null,
      barberId: barberId || "any",
      date: nextOpenDate(),
      time: null,
      assignedBarber: null,
      availability: null,
      loading: false,
      result: null,
      client: { nombre: "", telefono: "", email: "", notas: "" },
      reqToken: 0,
    };
    renderBooking();
    U.openModal("#booking-modal");
  }

  function service() {
    return state.services.find((s) => s.id === state.booking.serviceId) || null;
  }

  function barberById(id) {
    return state.barbers.find((b) => b.id === id) || null;
  }

  function canContinue() {
    const b = state.booking;
    if (!b) return false;
    if (b.step === 1) return !!b.serviceId;
    if (b.step === 2) return !!b.date;
    if (b.step === 3) return !!b.time;
    if (b.step === 4) return true;
    return false;
  }

  function renderBooking() {
    const b = state.booking;
    if (!b) return;
    const isSuccess = b.step === 5;
    const svc = service();

    $$("#booking-stepper .stepper__item").forEach((item) => {
      const n = Number(item.dataset.step);
      item.classList.toggle("is-done", isSuccess || b.step > n);
      item.classList.toggle("is-active", !isSuccess && b.step === n);
    });

    const titles = {
      1: ["Elige tu servicio", "Precio y duración visibles antes de confirmar."],
      2: ["Profesional y día", "Elige a tu barbero de confianza o deja que te asignemos uno."],
      3: ["Elige la hora", svc ? `${svc.nombre} · ${svc.duracion_min} min` : "Horarios disponibles."],
      4: ["Tus datos", "Solo lo necesario para confirmar tu cita."],
      5: ["Cita reservada", "Te contactaremos por WhatsApp para confirmar."],
    };
    $("#booking-title").textContent = titles[b.step][0];
    $("#booking-sub").textContent = titles[b.step][1];

    if (b._lastStep !== b.step) {
      b._lastStep = b.step;
      requestAnimationFrame(() => {
        const dialog = $("#booking-modal .modal__dialog");
        if (dialog) dialog.scrollTop = 0;
      });
    }

    $("#booking-body").innerHTML = isSuccess ? successHtml() : stepHtml();
    $("#booking-summary").innerHTML = summaryHtml();

    const nav = $("#booking-nav");
    nav.style.display = isSuccess ? "none" : "flex";
    $("#booking-back").style.visibility = b.step === 1 ? "hidden" : "visible";
    const next = $("#booking-next");
    next.textContent = b.step === 4 ? "Confirmar cita" : "Continuar →";
    next.disabled = !canContinue() || b.loading;
  }

  function stepHtml() {
    const b = state.booking;
    const svc = service();

    if (b.step === 1) {
      return `<div class="option-grid">${state.services
        .map(
          (s) => `<button class="option" type="button" data-pick-service="${U.esc(s.id)}" aria-pressed="${b.serviceId === s.id}">
            <span class="option__title">${U.esc(s.nombre)}</span>
            <span class="option__meta"><span>${Number(s.duracion_min)} min</span><b>${U.money(s.precio)}</b></span>
          </button>`
        )
        .join("")}</div>`;
    }

    if (b.step === 2) {
      const anySelected = b.barberId === "any";
      const barberOptions = `<button class="option option--barber" type="button" data-pick-barber="any" aria-pressed="${anySelected}">
          <span class="avatar" style="background:#f4ede2;color:#0b0b0c">NB</span>
          <span><span class="option__title">Cualquier barbero</span><span class="option__sub">El primero disponible</span></span>
        </button>` +
        state.barbers
          .map(
            (barber) => `<button class="option option--barber" type="button" data-pick-barber="${U.esc(barber.id)}" aria-pressed="${b.barberId === barber.id}">
              <span class="avatar" style="background:${U.esc(barber.color || "#c98a4b")}">${U.initials(barber.nombre)}</span>
              <span><span class="option__title">${U.esc(barber.nombre)}</span><span class="option__sub">${U.esc(barber.especialidad || "")}</span></span>
            </button>`
          )
          .join("");

      const days = Array.from({ length: 21 }, (_, i) => U.addDays(U.todayISO(), i));
      const chips = days
        .map((iso) => {
          const closed = S.isClosed(iso);
          return `<button class="date-chip" type="button" data-pick-date="${iso}" aria-pressed="${b.date === iso}" ${closed ? "disabled" : ""}>
            <span class="date-chip__dow">${U.weekdayShort(iso)}</span>
            <span class="date-chip__day">${U.parseISO(iso).getDate()}</span>
            <span class="date-chip__mon">${U.monthShort(iso)}</span>
          </button>`;
        })
        .join("");

      return `<div class="option-grid">${barberOptions}</div>
        <div class="slot-group">
          <div class="slot-group__label">Elige el día</div>
          <div class="date-strip">${chips}</div>
        </div>`;
    }

    if (b.step === 3) {
      if (b.loading) {
        return `<div class="slot-grid">${Array.from({ length: 8 })
          .map(() => `<div class="skeleton skeleton--slot"></div>`)
          .join("")}</div>`;
      }
      const av = b.availability;
      if (!av || !av.slots || !av.slots.length) {
        const wa = `https://wa.me/${String(state.config.whatsapp || C.contact.whatsapp).replace(/\D/g, "")}`;
        return `<div class="empty-state">
          <strong>${av && av.closed ? "Ese día está cerrado" : "No quedan horarios para este día"}</strong>
          Prueba con otra fecha, otro barbero o escríbenos por WhatsApp.
          <div style="margin-top:16px"><a class="btn btn--outline btn--sm" href="${wa}" target="_blank" rel="noopener">Escribir por WhatsApp</a></div>
        </div>`;
      }
      const groups = [
        { label: "Mañana", from: 0, to: 13 * 60 },
        { label: "Tarde", from: 13 * 60, to: 17 * 60 },
        { label: "Noche", from: 17 * 60, to: 24 * 60 },
      ];
      return groups
        .map((g) => {
          const slots = av.slots.filter((s) => {
            const m = U.minutesFromTime(s.time);
            return m >= g.from && m < g.to;
          });
          if (!slots.length) return "";
          return `<div class="slot-group">
            <div class="slot-group__label">${g.label}</div>
            <div class="slot-grid">${slots
              .map(
                (s) => `<button class="slot" type="button" data-pick-time="${s.time}" aria-pressed="${b.time === s.time}">${s.time}</button>`
              )
              .join("")}</div>
          </div>`;
        })
        .join("");
    }

    if (b.step === 4) {
      const client = b.client || {};
      return `<div class="form-grid">
        <div class="field field--full">
          <label for="bk-nombre">Nombre completo *</label>
          <input class="input" id="bk-nombre" name="nombre" type="text" autocomplete="name" value="${U.esc(client.nombre || "")}" placeholder="Tu nombre" required>
        </div>
        <div class="field">
          <label for="bk-tel">Teléfono *</label>
          <input class="input" id="bk-tel" name="telefono" type="tel" inputmode="tel" autocomplete="tel" value="${U.esc(client.telefono || "")}" placeholder="55 1234 5678" required>
        </div>
        <div class="field">
          <label for="bk-email">Email (opcional)</label>
          <input class="input" id="bk-email" name="email" type="email" autocomplete="email" value="${U.esc(client.email || "")}" placeholder="tu@correo.mx">
        </div>
        <div class="field field--full">
          <label for="bk-notas">Notas (opcional)</label>
          <textarea class="textarea" id="bk-notas" name="notas" placeholder="Alergias, referencias de corte, etc.">${U.esc(client.notas || "")}</textarea>
        </div>
      </div>
      <p class="field-hint" style="margin-top:12px">Al reservar aceptas que te contactemos por WhatsApp para confirmar la cita.</p>`;
    }

    return "";
  }

  function summaryHtml() {
    const b = state.booking;
    const svc = service();
    const isSuccess = b.step === 5;
    const result = b.result;

    let barberName = "Cualquiera";
    if (b.barberId && b.barberId !== "any") {
      const barber = barberById(b.barberId);
      barberName = barber ? barber.nombre : "—";
    } else if (b.assignedBarber) {
      const barber = barberById(b.assignedBarber);
      barberName = barber ? barber.nombre : "—";
    }

    const rows = isSuccess
      ? [
          ["Servicio", result.servicio_nombre],
          ["Barbero", result.barbero_nombre],
          ["Fecha", U.formatDate(result.fecha, "short")],
          ["Hora", result.hora],
          ["Duración", `${result.duracion_min} min`],
        ]
      : [
          ["Servicio", svc ? svc.nombre : "—"],
          ["Barbero", barberName],
          ["Fecha", b.date ? U.formatDate(b.date, "short") : "—"],
          ["Hora", b.time || "—"],
          ["Duración", svc ? `${svc.duracion_min} min` : "—"],
        ];

    const total = isSuccess ? result.precio : svc ? svc.precio : 0;

    return `${rows
      .map(([label, value]) => `<div class="summary__row"><span>${U.esc(label)}</span><b>${U.esc(value || "—")}</b></div>`)
      .join("")}
      <div class="summary__total"><span>Total</span><strong>${U.money(total)}</strong></div>`;
  }

  function successHtml() {
    const r = state.booking.result;
    const waDigits = String(state.config.whatsapp || C.contact.whatsapp).replace(/\D/g, "");
    const waText = encodeURIComponent(
      `Hola, reservé una cita en ${C.brand.name}. Código ${r.codigo} · ${U.formatDate(r.fecha, "short")} ${r.hora} · ${r.servicio_nombre}`
    );
    return `<div class="booking-success">
      <div class="success-check">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>
      </div>
      <h3>Todo listo</h3>
      <p>Tu cita quedó registrada. Te contactaremos por WhatsApp para confirmar. Guarda tu código.</p>
      <div class="success-ticket">
        <div class="success-ticket__row"><span>Código</span><b class="success-code">${U.esc(r.codigo)}</b></div>
        <div class="success-ticket__row"><span>Servicio</span><b>${U.esc(r.servicio_nombre)}</b></div>
        <div class="success-ticket__row"><span>Barbero</span><b>${U.esc(r.barbero_nombre)}</b></div>
        <div class="success-ticket__row"><span>Fecha</span><b>${U.esc(U.formatDate(r.fecha, "long"))}</b></div>
        <div class="success-ticket__row"><span>Hora</span><b>${U.esc(r.hora)}</b></div>
        <div class="success-ticket__row"><span>Total</span><b>${U.money(r.precio)}</b></div>
      </div>
      <div class="success-actions">
        <button class="btn btn--primary btn--sm" type="button" data-ics>Guardar en calendario</button>
        <a class="btn btn--outline btn--sm" href="https://wa.me/${waDigits}?text=${waText}" target="_blank" rel="noopener">WhatsApp</a>
        <button class="btn btn--ghost btn--sm" type="button" data-close-modal>Listo</button>
      </div>
    </div>`;
  }

  async function loadAvailability() {
    const b = state.booking;
    const token = ++b.reqToken;
    b.loading = true;
    b.availability = null;
    renderBooking();
    try {
      const res = await S.availability({ date: b.date, serviceId: b.serviceId, barberId: b.barberId });
      if (token !== b.reqToken) return;
      b.availability = res;
      if (b.time && !res.slots.some((s) => s.time === b.time)) {
        b.time = null;
        b.assignedBarber = null;
      }
    } catch (error) {
      if (token !== b.reqToken) return;
      U.toast(error.message || "No se pudo consultar la disponibilidad.", "error");
      b.availability = { slots: [], closed: false };
    } finally {
      if (token === b.reqToken) {
        b.loading = false;
        if (b.step === 3) renderBooking();
      }
    }
  }

  function captureClient() {
    const b = state.booking;
    if (!b || b.step !== 4) return;
    const name = $("#bk-nombre");
    if (!name) return;
    b.client = {
      nombre: name.value.trim(),
      telefono: $("#bk-tel").value.trim(),
      email: $("#bk-email").value.trim(),
      notas: $("#bk-notas").value.trim(),
    };
  }

  async function submitBooking() {
    const b = state.booking;
    captureClient();
    const client = b.client;
    if (client.nombre.length < 2) {
      U.toast("Escribe tu nombre completo.", "error");
      $("#bk-nombre").focus();
      return;
    }
    if (U.normalizePhone(client.telefono).length < 10) {
      U.toast("Escribe un teléfono de 10 dígitos.", "error");
      $("#bk-tel").focus();
      return;
    }

    const btn = $("#booking-next");
    btn.disabled = true;
    btn.textContent = "Reservando…";

    try {
      const result = await S.book({
        cliente_nombre: client.nombre,
        cliente_telefono: client.telefono,
        cliente_email: client.email,
        notas: client.notas,
        servicio_id: b.serviceId,
        barbero_id: b.barberId,
        fecha: b.date,
        hora: b.time,
      });
      b.result = result;
      b.step = 5;
      renderBooking();
      U.toast(`Cita reservada. Código ${result.codigo}`, "success", 6000);
      renderHeroNext();
    } catch (error) {
      U.toast(error.message || "No se pudo reservar. Intenta de nuevo.", "error", 5200);
      btn.disabled = false;
      btn.textContent = "Confirmar cita";
    }
  }

  async function bookingNext() {
    const b = state.booking;
    if (!b || b.loading) return;
    if (b.step === 4) {
      await submitBooking();
      return;
    }
    if (!canContinue()) return;
    b.step += 1;
    renderBooking();
    if (b.step === 3) await loadAvailability();
  }

  function bookingBack() {
    const b = state.booking;
    if (!b || b.step <= 1) return;
    if (b.step === 4) captureClient();
    if (b.step === 5) return;
    b.step -= 1;
    renderBooking();
  }

  /* ---------- Mis citas ---------- */
  function openLookup() {
    state.lookup = { phone: "", results: null, confirmId: null, loading: false };
    $("#lookup-results").innerHTML = "";
    $("#lookup-phone").value = "";
    U.openModal("#lookup-modal");
  }

  async function searchAppointments(phone) {
    state.lookup.loading = true;
    state.lookup.confirmId = null;
    $("#lookup-results").innerHTML = `<div class="appointments-list"><div class="skeleton" style="height:96px"></div></div>`;
    try {
      const res = await S.lookup(phone);
      state.lookup.phone = phone;
      state.lookup.results = res.appointments || [];
    } catch (error) {
      state.lookup.results = [];
      U.toast(error.message || "No se pudo consultar.", "error");
    } finally {
      state.lookup.loading = false;
      renderLookup();
    }
  }

  function renderLookup() {
    const box = $("#lookup-results");
    const { results, confirmId } = state.lookup;
    if (results === null) {
      box.innerHTML = "";
      return;
    }
    if (!results.length) {
      box.innerHTML = `<div class="empty-state" style="margin-top:22px">
        <strong>No encontramos citas</strong>
        Revisa que el teléfono sea el mismo con el que reservaste.
      </div>`;
      return;
    }

    const now = `${U.todayISO()}T${U.timeFromMinutes(U.nowMinutes())}`;
    const upcoming = results.filter((a) => `${a.fecha}T${a.hora}` >= now && !["cancelada", "completada", "no_asistio"].includes(a.estado));
    const past = results.filter((a) => !upcoming.includes(a));

    const card = (a, isPast) => {
      const when = `${a.fecha}T${a.hora}`;
      const cancelable = !isPast && ["pendiente", "confirmada"].includes(a.estado) && when > now;
      const confirming = confirmId === a.id;
      return `<div class="appt-card ${isPast ? "appt-card--past" : ""}">
        <div class="appt-card__top">
          <div>
            <div class="appt-card__date">${U.esc(U.relativeDay(a.fecha))} · ${U.esc(a.hora)}</div>
            <div class="appt-card__service">${U.esc(a.servicio_nombre)}</div>
            <div class="appt-card__meta">${U.esc(a.barbero_nombre)} · ${a.duracion_min} min · ${U.money(a.precio)}</div>
          </div>
          ${U.statusPill(a.estado)}
        </div>
        <div class="appt-card__foot">
          <span class="appt-card__code">Código ${U.esc(a.codigo)}</span>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            ${
              confirming
                ? `<button class="btn btn--ghost btn--sm" type="button" data-cancel-abort>No</button>
                   <button class="btn btn--primary btn--sm" type="button" data-cancel-confirm="${U.esc(a.id)}">Sí, cancelar</button>`
                : `${cancelable ? `<button class="btn btn--ghost btn--sm" type="button" data-cancel-id="${U.esc(a.id)}">Cancelar</button>` : ""}
                   <button class="btn btn--outline btn--sm" type="button" data-ics-appt="${U.esc(a.id)}">Calendario</button>`
            }
          </div>
        </div>
      </div>`;
    };

    box.innerHTML = `
      ${upcoming.length ? `<div class="slot-group"><div class="slot-group__label">Próximas</div><div class="appointments-list">${upcoming.map((a) => card(a, false)).join("")}</div></div>` : ""}
      ${past.length ? `<div class="slot-group"><div class="slot-group__label">Historial</div><div class="appointments-list">${past.map((a) => card(a, true)).join("")}</div></div>` : ""}
    `;
  }

  async function cancelAppointment(id) {
    try {
      await S.cancel(id, state.lookup.phone);
      U.toast("Cita cancelada. Te esperamos en otra ocasión.", "success");
      state.lookup.confirmId = null;
      await searchAppointments(state.lookup.phone);
    } catch (error) {
      U.toast(error.message || "No se pudo cancelar.", "error");
    }
  }

  /* ---------- Eventos ---------- */
  function wireStatic() {
    document.addEventListener("click", (event) => {
      const bookService = event.target.closest("[data-book-service]");
      if (bookService) {
        openBooking(bookService.dataset.bookService);
        return;
      }
      const bookBarber = event.target.closest("[data-book-barber]");
      if (bookBarber) {
        openBooking(null, bookBarber.dataset.bookBarber);
        return;
      }
      if (event.target.closest("[data-open-booking]")) {
        openBooking();
        return;
      }
      if (event.target.closest("[data-open-lookup]")) {
        openLookup();
        return;
      }
      if (event.target.closest("[data-ics]") && state.booking && state.booking.result) {
        U.downloadICS(state.booking.result);
      }
      const icsAppt = event.target.closest("[data-ics-appt]");
      if (icsAppt && state.lookup.results) {
        const appt = state.lookup.results.find((a) => a.id === icsAppt.dataset.icsAppt);
        if (appt) U.downloadICS(appt);
      }
      const cancelId = event.target.closest("[data-cancel-id]");
      if (cancelId) {
        state.lookup.confirmId = cancelId.dataset.cancelId;
        renderLookup();
      }
      if (event.target.closest("[data-cancel-abort]")) {
        state.lookup.confirmId = null;
        renderLookup();
      }
      const cancelConfirm = event.target.closest("[data-cancel-confirm]");
      if (cancelConfirm) cancelAppointment(cancelConfirm.dataset.cancelConfirm);
    });

    // Navegación móvil
    const toggle = $("#nav-toggle");
    const nav = $("#site-nav");
    toggle.addEventListener("click", () => {
      const open = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Cerrar menú" : "Abrir menú");
    });
    nav.addEventListener("click", (event) => {
      if (event.target.closest("a, button")) {
        nav.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
      }
    });

    // Cabecera con fondo al hacer scroll
    const header = $("#site-header");
    const onScroll = () => header.classList.toggle("is-scrolled", window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    // Reserva
    $("#booking-next").addEventListener("click", bookingNext);
    $("#booking-back").addEventListener("click", bookingBack);
    $("#booking-modal").addEventListener("click", (event) => {
      const b = state.booking;
      if (!b) return;

      const pickService = event.target.closest("[data-pick-service]");
      if (pickService) {
        b.serviceId = pickService.dataset.pickService;
        b.time = null;
        b.assignedBarber = null;
        b.availability = null;
        if (b.step === 1) b.step = 2;
        renderBooking();
        return;
      }

      const pickBarber = event.target.closest("[data-pick-barber]");
      if (pickBarber) {
        b.barberId = pickBarber.dataset.pickBarber;
        b.time = null;
        b.assignedBarber = null;
        b.availability = null;
        renderBooking();
        return;
      }

      const pickDate = event.target.closest("[data-pick-date]");
      if (pickDate) {
        b.date = pickDate.dataset.pickDate;
        b.time = null;
        b.assignedBarber = null;
        b.availability = null;
        renderBooking();
        return;
      }

      const pickTime = event.target.closest("[data-pick-time]");
      if (pickTime) {
        b.time = pickTime.dataset.pickTime;
        const slot = b.availability && b.availability.slots.find((s) => s.time === b.time);
        b.assignedBarber = b.barberId === "any" && slot ? slot.barbers[0] : b.barberId;
        renderBooking();
      }
    });

    // Búsqueda de citas
    $("#lookup-form").addEventListener("submit", (event) => {
      event.preventDefault();
      const phone = $("#lookup-phone").value.trim();
      if (U.normalizePhone(phone).length < 10) {
        U.toast("Escribe un teléfono de 10 dígitos.", "error");
        $("#lookup-phone").focus();
        return;
      }
      searchAppointments(phone);
    });

    // Al cerrar la reserva, refresca el próximo hueco del hero
    $("#booking-modal").addEventListener("click", (event) => {
      if (event.target.closest("[data-close-modal]")) setTimeout(renderHeroNext, 300);
    });
  }

  function setupReveal() {
    const items = $$("[data-reveal]");
    if (!("IntersectionObserver" in window)) {
      items.forEach((el) => el.classList.add("is-visible"));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    items.forEach((el) => observer.observe(el));
  }
})();
