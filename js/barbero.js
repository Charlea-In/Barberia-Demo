/* ============================================================
   BARBERO — Panel de jornada personal
   ============================================================ */
(function () {
  const C = window.BARBER_CONFIG;
  const U = window.UI;
  const S = window.Store;
  const $ = (sel, root = document) => U.$(sel, root);
  const $$ = (sel, root = document) => U.$$(sel, root);

  const state = {
    key: sessionStorage.getItem("barbero_key") || "",
    data: null,
    view: "hoy", // hoy | ingresos
    timer: null,
    refresh: null,
    calendarDate: U.todayISO(),
  };

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    wire();
    if (S.mode === "demo") {
      $("#barbero-hint").innerHTML = `Modo demo · usa una clave como <b>diego2026</b>, <b>marco2026</b> o <b>ivan2026</b>.`;
    } else {
      $("#barbero-hint").innerHTML = "Modo Google Sheets · usa tu clave personal asignada por el dueño.";
    }

    if (state.key) {
      await login(state.key, true);
    }
  }

  function wire() {
    $("#barbero-login-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const key = $("#barbero-key").value.trim();
      if (!key) return;
      const btn = e.target.querySelector('button[type="submit"]');
      btn.disabled = true;
      btn.textContent = "Entrando…";
      await login(key);
      btn.disabled = false;
      btn.textContent = "Entrar a mi jornada";
    });

    $("#barbero-logout").addEventListener("click", logout);
    $("#barbero-refresh").addEventListener("click", () => loadData(true));
    window.addEventListener("storage", () => {
      if (state.key && !document.hidden) loadData(false);
    });

    // Delegación de eventos para el panel
    $("#barbero-view").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-action], [data-cal-time], [data-cal-delete]");
      if (!btn) return;
      const action = btn.dataset.action;
      const id = btn.dataset.id;
      if (btn.dataset.calTime) { const time = btn.dataset.calTime; const start = $("#availability-start"); const end = $("#availability-end"); if (start) start.value = time; if (end) end.value = U.timeFromMinutes(Math.min(1439, U.minutesFromTime(time) + 60)); return; }
      if (btn.dataset.calDelete) { removeAvailability(btn.dataset.calDelete); return; }
      if (action === "start") startJob(id);
      if (action === "finish") finishJob(id);
      if (action === "confirm") changeStatus(id, "confirmada");
      if (action === "cancel") changeStatus(id, "cancelada");
    });
    $("#barbero-view").addEventListener("change", (e) => { if (e.target.matches("[data-cal-date]")) { state.calendarDate = e.target.value || U.todayISO(); render(); } });
    $("#barbero-view").addEventListener("submit", async (e) => {
      if (e.target.id !== "availability-form") return;
      e.preventDefault(); const form = e.target; const values = Object.fromEntries(new FormData(form).entries());
      try { await S.barberAvailabilitySave(state.key, values); await loadData(); U.toast("Bloque de disponibilidad guardado.", "success"); }
      catch (err) { U.toast(err.message || "No se pudo guardar el bloque.", "error"); }
    });
  }

  async function login(key, silent = false) {
    try {
      const res = await S.barberLogin(key);
      sessionStorage.setItem("barbero_key", key);
      state.key = key;
      state.data = res.data;
      $("#barbero-name").textContent = res.barber.nombre;
      $("#barbero-role").textContent = res.barber.rol || "Barbero";
      
      $("#barbero-login").style.display = "none";
      $("#barbero-shell").hidden = false;
      
      render();
      startTicker();
      startAutoRefresh();
      updateSyncLabel("Conectado");
    } catch (error) {
      if (!silent) U.toast(error.message || "Clave incorrecta.", "error");
      logout();
    }
  }

  function logout() {
    sessionStorage.removeItem("barbero_key");
    state.key = "";
    state.data = null;
    clearInterval(state.timer);
    clearInterval(state.refresh);
    $("#barbero-login").style.display = "grid";
    $("#barbero-shell").hidden = true;
    $("#barbero-key").value = "";
  }

  async function loadData(showToast = false) {
    if (!state.key) return;
    updateSyncLabel("Actualizando…");
    try {
      state.data = await S.barberData(state.key);
      render();
      updateSyncLabel("Actualizado");
      if (showToast) U.toast("Datos actualizados", "success");
    } catch (error) {
      updateSyncLabel("Error de conexión");
      if (showToast) U.toast(error.message, "error");
    }
  }

  function updateSyncLabel(text) {
    const el = $("#barbero-sync");
    if (el) el.textContent = text;
  }

  function startTicker() {
    clearInterval(state.timer);
    updateTimers();
    state.timer = setInterval(updateTimers, 1000);
  }

  function updateTimers() {
    // Actualiza los cronómetros en vivo cada segundo
    $$("[data-live-elapsed]").forEach((el) => {
      const start = new Date(el.dataset.liveElapsed).getTime();
      if (isNaN(start)) return;
      const diff = Math.max(0, Math.floor((Date.now() - start) / 1000));
      const h = Math.floor(diff / 3600);
      const m = Math.floor((diff % 3600) / 60);
      const s = diff % 60;
      const pad = (n) => String(n).padStart(2, "0");
      el.textContent = h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
    });
  }

  function startAutoRefresh() {
    // Refresca datos cada 45 segundos para ver nuevas citas o confirmaciones
    clearInterval(state.refresh);
    state.refresh = setInterval(() => {
      if (document.hidden) return;
      loadData(false);
    }, 45000);
  }

  /* ---------- Vistas ---------- */
  function render() {
    const { barber, appointments } = state.data;
    const today = U.todayISO();
    
    // Filtrar citas de hoy (ignorando canceladas/no asistió)
    const todayAppts = appointments
      .filter(a => a.fecha === today && !["cancelada", "no_asistio"].includes(a.estado))
      .sort((a, b) => a.hora.localeCompare(b.hora));

    // Encontrar cita en curso
    const liveAppt = appointments.find(a => a.fecha === today && a.estado === "en_curso");

    // Actualizar chip "En vivo" en topbar
    const chip = $("#barbero-live-chip");
    if (liveAppt) chip.hidden = false;
    else chip.hidden = true;

    // Renderizar tarjeta de reloj o resumen
    let timerHtml = "";
    if (liveAppt) {
      timerHtml = renderLiveTimer(liveAppt);
    } else {
      const next = todayAppts.find(a => ["pendiente", "confirmada"].includes(a.estado));
      timerHtml = renderIdleTimer(next);
    }

    // Renderizar lista de hoy
    const listHtml = todayAppts.map(a => renderApptRow(a)).join("");

    // Renderizar dinero del día y comisiones (simulado con los ingresos de hoy)
    const todayIncomes = state.data.incomes.filter(i => i.fecha === today);
    const totalIncome = U.sum(todayIncomes, "monto");
    const commission = (totalIncome * (barber.comision_pct || 0)) / 100;

    $("#barbero-view").innerHTML = `
      <div class="view-head">
        <div>
          <h1 class="view-head__title">Mi jornada</h1>
          <p class="view-head__sub">${U.formatDate(today, "long")} · ${todayAppts.length} citas agendadas.</p>
        </div>
        <div class="view-head__actions">
          <div class="kpi" style="padding:8px 14px; min-width:130px">
            <div class="kpi__label">Ingresos hoy</div>
            <div class="kpi__value" style="font-size:22px">${U.money(totalIncome)}</div>
          </div>
          <div class="kpi" style="padding:8px 14px; min-width:130px">
            <div class="kpi__label">Mi comisión (${barber.comision_pct}%)</div>
            <div class="kpi__value" style="font-size:22px;color:#8a5a12">${U.money(commission)}</div>
          </div>
        </div>
      </div>

      <div class="jornada-grid">
        <div class="jornada-col">
          ${timerHtml}
          <div class="card">
            <div class="card__head">
              <div class="card__title">Agenda de hoy</div>
            </div>
            <div class="card__body card__body--flush">
              ${listHtml || '<div class="jornada-empty">No tienes citas para hoy.</div>'}
            </div>
          </div>
        </div>
        <div class="jornada-col">
          <div class="card">
            <div class="card__head">
              <div class="card__title">Mis próximas citas</div>
            </div>
            <div class="card__body card__body--flush">
              ${renderUpcoming(appointments)}
            </div>
          </div>
        </div>
      </div>
      <div class="card daycal-card barber-calendar">
        <div class="card__head"><div><div class="card__title">Calendario de mi jornada</div><div class="sub">Crea bloques de receso, almuerzo o disponibilidad</div></div><input class="input" type="date" data-cal-date value="${U.esc(state.calendarDate || today)}" aria-label="Fecha del calendario"></div>
        <div class="card__body">${DayCalendar.render({ date: state.calendarDate || today, appointments, blocks: state.data.availabilityBlocks || [], barberId: barber.id, editable: true, config: state.data.config })}</div>
        <form class="availability-form" id="availability-form">
          <input type="hidden" name="fecha" value="${U.esc(state.calendarDate || today)}">
          <label>Desde<input class="input" id="availability-start" name="hora_inicio" type="time" value="12:00" required></label>
          <label>Hasta<input class="input" id="availability-end" name="hora_fin" type="time" value="13:00" required></label>
          <label>Estado<select class="select" name="estado"><option>Disponible</option><option>Receso</option><option selected>Almuerzo</option><option>No disponible</option></select></label>
          <label>Nota<input class="input" name="notas" maxlength="100" placeholder="Opcional"></label>
          <button class="btn-admin btn-admin--primary" type="submit">Guardar bloque</button>
        </form>
      </div>
    `;

    updateTimers();
  }

  async function removeAvailability(id) {
    try { await S.barberAvailabilityDelete(state.key, id); await loadData(); U.toast("Bloque eliminado.", "success"); }
    catch (error) { U.toast(error.message || "No se pudo eliminar.", "error"); }
  }

  function renderLiveTimer(appt) {
    const inicio = appt.inicio_en;
    const start = new Date(inicio).getTime();
    const now = Date.now();
    const diffSec = Math.max(0, Math.floor((now - start) / 1000));
    const expectedMin = Number(appt.duracion_min) || 30;
    const expectedSec = expectedMin * 60;
    const progress = Math.min(100, (diffSec / expectedSec) * 100);
    const isOver = diffSec > expectedSec;

    return `
      <div class="timer-card">
        <div class="timer-card__head">
          <span class="timer-card__eyebrow">En curso</span>
          <span class="timer-card__live">En vivo</span>
        </div>
        <div class="timer-card__client">${U.esc(appt.cliente_nombre)}</div>
        <div class="timer-card__service">${U.esc(appt.servicio_nombre)} · ${expectedMin} min estimados</div>
        
        <div class="timer-display" data-live-elapsed="${inicio}">00:00</div>
        
        <div class="timer-meta">
          <span>Inicio: ${inicio.split("T")[1].slice(0,5)}</span>
          <span class="${isOver ? "is-over" : ""}">${isOver ? "Tiempo excedido" : "Dentro del tiempo"}</span>
        </div>
        
        <div class="timer-track">
          <span class="${isOver ? "is-over" : ""}" style="width:${progress}%"></span>
        </div>
        
        <div class="timer-actions">
          <button class="btn-admin btn-admin--primary" type="button" data-action="finish" data-id="${appt.id}">Terminar y cobrar</button>
        </div>
      </div>
    `;
  }

  function renderIdleTimer(nextAppt) {
    let nextHtml = "No hay más citas pendientes hoy.";
    if (nextAppt) {
      nextHtml = `Siguiente: <b>${nextAppt.hora}</b> · ${nextAppt.cliente_nombre}`;
    }
    return `
      <div class="timer-card timer-card--idle">
        <div class="timer-card__head">
          <span class="timer-card__eyebrow">Reloj de corte</span>
          <span class="timer-card__live">Libre</span>
        </div>
        <div class="timer-card__client">Sin corte activo</div>
        <div class="timer-card__service">${nextHtml}</div>
        <div class="timer-display">00:00</div>
        <div class="timer-actions">
          <button class="btn-admin" type="button" disabled>Inicia un corte desde la agenda</button>
        </div>
      </div>
    `;
  }

  function renderApptRow(a) {
    const isPending = a.estado === "pendiente";
    const isConfirmed = a.estado === "confirmada";
    const isDone = a.estado === "completada";
    const isLive = a.estado === "en_curso";

    let actions = "";
    if (isPending) {
      actions += `<button class="btn-admin btn-admin--primary" type="button" data-action="confirm" data-id="${a.id}">Confirmar</button>`;
    }
    if (isPending || isConfirmed) {
      const phone = String(a.cliente_telefono || "").replace(/\D/g, "");
      const message = `Hola ${a.cliente_nombre || ""}, tu cita está confirmada. Te veo a las ${a.hora}. Recuerda llegar 5 minutos antes. Si termino el corte anterior antes de tu cita, con gusto podemos iniciar antes.`;
      if (phone) {
        actions += `<a class="btn-admin" href="https://wa.me/${phone}?text=${encodeURIComponent(message)}" target="_blank" rel="noopener noreferrer">WhatsApp</a>`;
      }
      actions += `<button class="btn-admin btn-admin--primary" type="button" data-action="start" data-id="${a.id}">Iniciar</button>`;
    }
    if (isLive) {
      actions += `<button class="btn-admin btn-admin--primary" type="button" data-action="finish" data-id="${a.id}">Terminar</button>`;
    }
    
    return `
      <div class="jornada-row ${isLive ? "is-running" : ""}">
        <div class="jornada-row__time">${a.hora}</div>
        <div class="jornada-row__main">
          <div class="jornada-row__client">${U.esc(a.cliente_nombre)}</div>
          <div class="jornada-row__meta">${U.esc(a.servicio_nombre)} · ${a.duracion_min} min · ${U.money(a.precio)}</div>
        </div>
        <div class="jornada-row__side">
          ${U.statusPill(a.estado, true)}
          ${actions}
        </div>
      </div>
    `;
  }

  function renderUpcoming(appointments) {
    const today = U.todayISO();
    const upcoming = appointments
      .filter(a => a.fecha > today && !["cancelada", "no_asistio"].includes(a.estado))
      .sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora))
      .slice(0, 8);
      
    if (!upcoming.length) return `<div class="jornada-empty">No tienes citas próximas.</div>`;
    
    return upcoming.map(a => `
      <div class="jornada-row">
        <div class="jornada-row__time" style="font-size:15px">${U.relativeDay(a.fecha).slice(0,3)}</div>
        <div class="jornada-row__main">
          <div class="jornada-row__client">${a.hora} · ${U.esc(a.cliente_nombre)}</div>
          <div class="jornada-row__meta">${U.esc(a.servicio_nombre)}</div>
        </div>
        <div class="jornada-row__side">${U.statusPill(a.estado, true)}</div>
      </div>
    `).join("");
  }

  /* ---------- Acciones ---------- */
  async function startJob(id) {
    try {
      // Cambiamos a en_curso y guardamos el timestamp de inicio
      await S.barberSetStatus(state.key, id, "en_curso", null, { inicio_en: new Date().toISOString() });
      await loadData();
      U.toast("Corte iniciado. ¡Buen trabajo!", "success");
    } catch (e) {
      U.toast(e.message, "error");
    }
  }

  async function finishJob(id) {
    // Al terminar, pedimos confirmación rápida
    const ok = await U.confirmDialog({
      title: "Terminar corte",
      message: "¿Registrar el cobro e ingreso por este servicio?",
      confirmText: "Sí, terminar",
    });
    if (!ok) return;

    try {
      await S.barberSetStatus(state.key, id, "completada", "Efectivo");
      await loadData();
      U.toast("Corte terminado y registrado.", "success");
    } catch (e) {
      U.toast(e.message, "error");
    }
  }

  async function changeStatus(id, estado) {
    try {
      await S.barberSetStatus(state.key, id, estado);
      await loadData();
      U.toast("Estado actualizado.", "success");
    } catch (e) {
      U.toast(e.message, "error");
    }
  }

})();
