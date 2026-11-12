/* ============================================================
   ADMIN — panel del dueño y barberos
   ============================================================ */
(function () {
  const C = window.BARBER_CONFIG;
  const U = window.UI;
  const S = window.Store;
  const $ = (sel, root = document) => U.$(sel, root);
  const $$ = (sel, root = document) => U.$$(sel, root);

  const DAY_NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  const VIEW_TITLES = {
    resumen: "Resumen",
    citas: "Citas",
    clientes: "Clientes",
    ingresos: "Ingresos",
    gastos: "Gastos",
    barberos: "Barberos",
    servicios: "Servicios",
    ajustes: "Ajustes",
  };
  const STATUS_OPTIONS = [
    { value: "pendiente", label: "Pendiente" },
    { value: "confirmada", label: "Confirmada" },
    { value: "completada", label: "Completada" },
    { value: "cancelada", label: "Cancelada" },
    { value: "no_asistio", label: "No asistió" },
  ];
  const PAYMENT_OPTIONS = ["Efectivo", "Tarjeta", "Transferencia"];

  const ICON = {
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>',
    edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 5l14 14M19 5L5 19"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>',
    eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="2.6"/></svg>',
  };

  const A = {
    key: S.getAdminKey(),
    data: null,
    view: "resumen",
    filters: {},
    drawerClientId: null,
  };

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    resetFilters();
    wire();
    $("#today-label").textContent = U.formatDate(U.todayISO(), "long");
    $("#year") && ($("#year").textContent = new Date().getFullYear());

    if (S.mode === "demo") {
      $("#login-hint").innerHTML = `Modo demo · usa la clave <b>${U.esc(C.admin.demoKey)}</b>. Los datos se guardan solo en este navegador.`;
    } else {
      $("#login-hint").innerHTML = "Modo Google Sheets · la clave se configura en las propiedades del Apps Script.";
      const chip = $("#mode-chip");
      chip.textContent = "Google Sheets";
      chip.classList.add("mode-chip--live");
    }

    if (A.key) await attemptLogin(A.key, true);
    else showLogin();
  }

  function resetFilters() {
    const today = U.todayISO();
    A.filters = {
      citas: { from: today, to: U.addDays(today, 21), estado: "todas", barber: "todos", q: "" },
      clientes: { q: "" },
      ingresos: { from: U.startOfMonth(today), to: U.endOfMonth(today), categoria: "todas", q: "" },
      gastos: { from: U.startOfMonth(today), to: U.endOfMonth(today), categoria: "todas", q: "" },
    };
  }

  /* ---------- Sesión ---------- */
  async function attemptLogin(key, silent = false) {
    try {
      await S.adminLogin(key);
      S.setAdminKey(key);
      A.key = key;
      await loadData();
      showShell();
    } catch (error) {
      S.setAdminKey("");
      A.key = "";
      if (!silent) U.toast(error.message || "Clave incorrecta.", "error");
      showLogin();
    }
  }

  function showLogin() {
    $("#admin-shell").hidden = true;
    $("#login-screen").style.display = "grid";
    document.body.classList.remove("no-scroll");
  }

  function showShell() {
    $("#login-screen").style.display = "none";
    $("#admin-shell").hidden = false;
    updateBadges();
    const initial = location.hash.replace("#", "");
    setView(VIEW_TITLES[initial] ? initial : "resumen");
  }

  function logout() {
    S.setAdminKey("");
    A.key = "";
    A.data = null;
    closeDrawer();
    $("#login-key").value = "";
    showLogin();
  }

  /* ---------- Datos ---------- */
  async function loadData() {
    const data = await S.adminData();
    A.data = {
      config: data.config || {},
      services: [...(data.services || [])].sort((a, b) => (Number(a.orden) || 0) - (Number(b.orden) || 0)),
      barbers: [...(data.barbers || [])].sort((a, b) => String(a.nombre).localeCompare(String(b.nombre))),
      clients: [...(data.clients || [])].sort((a, b) => String(a.nombre).localeCompare(String(b.nombre))),
      appointments: [...(data.appointments || [])].sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora)),
      incomes: [...(data.incomes || [])].sort((a, b) => String(b.fecha).localeCompare(String(a.fecha))),
      expenses: [...(data.expenses || [])].sort((a, b) => String(b.fecha).localeCompare(String(a.fecha))),
    };
    updateBadges();
  }

  function updateBadges() {
    if (!A.data) return;
    const today = U.todayISO();
    const count = A.data.appointments.filter(
      (a) => a.fecha === today && ["pendiente", "confirmada"].includes(a.estado)
    ).length;
    const badge = $("#badge-citas");
    if (badge) badge.textContent = count;
    const label = $("#today-label");
    if (label) {
      label.textContent = U.formatDate(today, "long");
      label.style.display = window.innerWidth > 980 ? "inline" : "none";
    }
  }

  /* ---------- Navegación ---------- */
  function setView(view) {
    if (!VIEW_TITLES[view]) view = "resumen";
    A.view = view;
    $$(".sidebar__link[data-view]").forEach((btn) => btn.classList.toggle("is-active", btn.dataset.view === view));
    $("#topbar-title").textContent = VIEW_TITLES[view];
    if (location.hash !== "#" + view) history.replaceState(null, "", "#" + view);
    closeSidebar();
    renderView();
  }

  function renderView() {
    if (!A.data) return;
    const renderers = {
      resumen: renderResumen,
      citas: renderCitas,
      clientes: renderClientes,
      ingresos: renderIngresos,
      gastos: renderGastos,
      barberos: renderBarberos,
      servicios: renderServicios,
      ajustes: renderAjustes,
    };
    $("#view").innerHTML = (renderers[A.view] || renderResumen)();
    updateBadges();
  }

  /* ---------- Helpers ---------- */
  const money = (n) => U.money(n, 0);
  const esc = U.esc;

  function apptById(id) {
    return A.data.appointments.find((a) => a.id === id);
  }

  function clientById(id) {
    return A.data.clients.find((c) => c.id === id);
  }

  function activeServices() {
    return A.data.services.filter((s) => s.activo !== false);
  }

  function clientStats(clientId) {
    const list = A.data.appointments.filter((a) => a.cliente_id === clientId);
    const done = list.filter((a) => a.estado === "completada");
    const now = `${U.todayISO()}T${U.timeFromMinutes(U.nowMinutes())}`;
    return {
      total: done.length,
      spent: U.sum(done, "precio"),
      last: done.reduce((max, a) => (a.fecha > max ? a.fecha : max), ""),
      upcoming: list.filter((a) => `${a.fecha}T${a.hora}` >= now && ["pendiente", "confirmada"].includes(a.estado)).length,
      appointments: list,
    };
  }

  function miniBtn(action, id, icon, label, cls = "") {
    return `<button class="mini-btn ${cls}" type="button" data-action="${action}" data-id="${esc(id)}" title="${esc(label)}" aria-label="${esc(label)}">${icon}</button>`;
  }

  function statusOptions(selected) {
    return STATUS_OPTIONS.map(
      (o) => `<option value="${o.value}" ${o.value === selected ? "selected" : ""}>${o.label}</option>`
    ).join("");
  }

  function serviceOptions(selected) {
    return A.data.services
      .map((s) => `<option value="${esc(s.id)}" ${s.id === selected ? "selected" : ""}>${esc(s.nombre)} · ${money(s.precio)}</option>`)
      .join("");
  }

  function barberOptions(selected, includeAll = false) {
    return (
      (includeAll ? `<option value="">Sin asignar</option>` : "") +
      A.data.barbers
        .map((b) => `<option value="${esc(b.id)}" ${b.id === selected ? "selected" : ""}>${esc(b.nombre)}</option>`)
        .join("")
    );
  }

  /* ---------- RESUMEN ---------- */
  function renderResumen() {
    const today = U.todayISO();
    const monthStart = U.startOfMonth(today);
    const monthEnd = U.endOfMonth(today);
    const prevAnchor = U.addDays(monthStart, -1);
    const prevStart = U.startOfMonth(prevAnchor);
    const prevEnd = U.endOfMonth(prevAnchor);

    const todays = A.data.appointments.filter((a) => a.fecha === today);
    const todaysActive = todays.filter((a) => !["cancelada", "no_asistio"].includes(a.estado));
    const pendingToday = todays.filter((a) => a.estado === "pendiente").length;
    const completedToday = todays.filter((a) => a.estado === "completada").length;

    const incMonth = A.data.incomes.filter((i) => i.fecha >= monthStart && i.fecha <= monthEnd);
    const expMonth = A.data.expenses.filter((e) => e.fecha >= monthStart && e.fecha <= monthEnd);
    const incTotal = U.sum(incMonth, "monto");
    const expTotal = U.sum(expMonth, "monto");
    const balance = incTotal - expTotal;
    const dayOfMonth = U.parseISO(today).getDate();
    const prevCutoff = U.addDays(prevStart, dayOfMonth - 1) < prevEnd ? U.addDays(prevStart, dayOfMonth - 1) : prevEnd;
    const incPrev = U.sum(
      A.data.incomes.filter((i) => i.fecha >= prevStart && i.fecha <= prevCutoff),
      "monto"
    );
    const delta = incPrev > 0 ? ((incTotal - incPrev) / incPrev) * 100 : null;
    const margin = incTotal > 0 ? Math.round((balance / incTotal) * 100) : 0;

    const trendHtml =
      delta === null
        ? "Sin historial del mes anterior"
        : `<span class="trend ${delta >= 0 ? "trend--up" : "trend--down"}">${delta >= 0 ? "↑" : "↓"} ${Math.abs(delta).toFixed(0)}%</span> vs mes anterior`;

    const now = `${today}T${U.timeFromMinutes(U.nowMinutes())}`;
    const upcoming = A.data.appointments
      .filter((a) => `${a.fecha}T${a.hora}` >= now && ["pendiente", "confirmada"].includes(a.estado))
      .slice(0, 6);

    const monthCompleted = A.data.appointments.filter((a) => a.fecha >= monthStart && a.fecha <= monthEnd && a.estado === "completada");
    const ranking = A.data.barbers
      .map((b) => {
        const list = monthCompleted.filter((a) => a.barbero_id === b.id);
        return { barber: b, count: list.length, total: U.sum(list, "precio") };
      })
      .sort((a, b) => b.total - a.total);
    const maxRank = Math.max(1, ...ranking.map((r) => r.total));

    return `
      <div class="view-head">
        <div>
          <h1 class="view-head__title">Buen día</h1>
          <p class="view-head__sub">${U.formatDate(today, "long")} · ${todaysActive.length} citas en agenda.</p>
        </div>
        <div class="view-head__actions">
          <button class="btn-admin" type="button" data-action="new-client">Nuevo cliente</button>
          <button class="btn-admin btn-admin--primary" type="button" data-action="new-appointment">Nueva cita</button>
        </div>
      </div>

      <div class="kpi-grid">
        <div class="kpi">
          <div class="kpi__label">Citas hoy</div>
          <div class="kpi__value">${todaysActive.length}</div>
          <div class="kpi__meta">${pendingToday} por confirmar · ${completedToday} completadas</div>
        </div>
        <div class="kpi">
          <div class="kpi__label">Ingresos del mes</div>
          <div class="kpi__value">${money(incTotal)}</div>
          <div class="kpi__meta">${trendHtml}</div>
        </div>
        <div class="kpi">
          <div class="kpi__label">Gastos del mes</div>
          <div class="kpi__value">${money(expTotal)}</div>
          <div class="kpi__meta">${incTotal > 0 ? Math.round((expTotal / incTotal) * 100) : 0}% de los ingresos</div>
        </div>
        <div class="kpi">
          <div class="kpi__label">Balance del mes</div>
          <div class="kpi__value" style="color:${balance >= 0 ? "#2f6a46" : "#9b3f36"}">${money(balance)}</div>
          <div class="kpi__meta">Margen ${margin}%</div>
        </div>
      </div>

      <div class="dash-grid">
        <div class="card">
          <div class="card__head">
            <div>
              <div class="card__title">Ingresos</div>
              <div class="card__sub">Últimos 14 días</div>
            </div>
            <div class="chart-legend">
              <span class="legend-dot">Ingresos diarios</span>
            </div>
          </div>
          <div class="card__body">${chartHtml()}</div>
        </div>

        <div class="card">
          <div class="card__head">
            <div class="card__title">Agenda de hoy</div>
            <button class="mini-btn" type="button" data-view="citas">Ver todas</button>
          </div>
          ${
            todays.length
              ? `<div class="agenda">${todays
                  .map(
                    (a) => `<div class="agenda__item">
                      <div class="agenda__time">${esc(a.hora)}</div>
                      <div class="agenda__main">
                        <div class="agenda__client">${esc(a.cliente_nombre)}</div>
                        <div class="agenda__service">${esc(a.servicio_nombre)} · ${esc(a.barbero_nombre)}</div>
                      </div>
                      <div class="agenda__side">
                        ${U.statusPill(a.estado, true)}
                        ${["pendiente", "confirmada"].includes(a.estado) ? miniBtn("complete-appointment", a.id, ICON.check, "Completar", "mini-btn--primary") : ""}
                      </div>
                    </div>`
                  )
                  .join("")}</div>`
              : `<div class="agenda__empty">No hay citas para hoy.<br><button class="link-arrow" type="button" data-action="new-appointment" style="margin-top:10px;color:#8a6a3d">Crear una cita</button></div>`
          }
        </div>
      </div>

      <div class="dash-grid">
        <div class="card">
          <div class="card__head">
            <div class="card__title">Próximas citas</div>
            <span class="card__sub">${upcoming.length} en camino</span>
          </div>
          ${
            upcoming.length
              ? `<div class="agenda">${upcoming
                  .map(
                    (a) => `<div class="agenda__item">
                      <div class="agenda__time" style="font-size:16px">${esc(a.hora)}</div>
                      <div class="agenda__main">
                        <div class="agenda__client">${esc(a.cliente_nombre)}</div>
                        <div class="agenda__service">${U.relativeDay(a.fecha)} · ${esc(a.servicio_nombre)} · ${esc(a.barbero_nombre)}</div>
                      </div>
                      <div class="agenda__side">${U.statusPill(a.estado, true)}</div>
                    </div>`
                  )
                  .join("")}</div>`
              : `<div class="agenda__empty">Sin citas próximas.</div>`
          }
        </div>

        <div class="card">
          <div class="card__head">
            <div class="card__title">Rendimiento por barbero</div>
            <span class="card__sub">Este mes</span>
          </div>
          <div class="card__body">
            <div class="rank-list">
              ${
                ranking.length
                  ? ranking
                      .map(
                        (r, i) => `<div class="rank-row">
                          <span class="rank-num">${String(i + 1).padStart(2, "0")}</span>
                          <div>
                            <div class="rank-name">${esc(r.barber.nombre)}</div>
                            <div class="rank-meta">${r.count} servicios completados</div>
                            <div class="rank-bar"><span style="width:${Math.round((r.total / maxRank) * 100)}%"></span></div>
                          </div>
                          <span class="rank-value">${money(r.total)}</span>
                        </div>`
                      )
                      .join("")
                  : `<div class="agenda__empty">Aún no hay servicios completados este mes.</div>`
              }
            </div>
          </div>
        </div>
      </div>`;
  }

  function chartHtml() {
    const days = Array.from({ length: 14 }, (_, i) => U.addDays(U.todayISO(), -13 + i));
    const rows = days.map((d) => ({
      d,
      inc: U.sum(A.data.incomes.filter((i) => i.fecha === d), "monto"),
      exp: U.sum(A.data.expenses.filter((e) => e.fecha === d), "monto"),
    }));
    const max = Math.max(1, ...rows.map((r) => r.inc));
    const W = 560;
    const H = 190;
    const top = 14;
    const base = 160;
    const slot = W / rows.length;
    const barW = 18;

    const grid = [0, 0.5, 1]
      .map((p) => {
        const y = base - p * (base - top);
        return `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="#f0e9dd" stroke-width="1" stroke-dasharray="${p === 0 ? "0" : "3 4"}"/>`;
      })
      .join("");

    const bars = rows
      .map((r, i) => {
        const x = i * slot + slot / 2;
        const hInc = (r.inc / max) * (base - top);
        const label =
          i % 2 === 0 || i === rows.length - 1
            ? `<text x="${x}" y="${base + 16}" font-size="9" fill="#8b8478" text-anchor="middle">${U.parseISO(r.d).getDate()}</text>`
            : "";
        return `<rect x="${x - barW / 2}" y="${base - hInc}" width="${barW}" height="${hInc}" rx="1" fill="#c98a4b"><title>${U.formatDate(r.d, "short")} · ${money(r.inc)}</title></rect>${label}`;
      })
      .join("");

    const inc14 = U.sum(rows, "inc");
    const exp14 = U.sum(rows, "exp");

    return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Ingresos de los últimos 14 días">${grid}${bars}</svg></div>
      <div style="display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-top:10px;font-size:11.5px;color:#6f6a60">
        <span>Ingresos del periodo <b style="color:#171614">${money(inc14)}</b></span>
        <span>Gastos del periodo <b style="color:#171614">${money(exp14)}</b></span>
        <span>Balance <b style="color:${inc14 - exp14 >= 0 ? "#2f6a46" : "#9b3f36"}">${money(inc14 - exp14)}</b></span>
      </div>`;
  }

  /* ---------- CITAS ---------- */
  function filteredAppointments() {
    const f = A.filters.citas;
    const q = f.q.trim().toLowerCase();
    return A.data.appointments.filter((a) => {
      if (f.from && a.fecha < f.from) return false;
      if (f.to && a.fecha > f.to) return false;
      if (f.estado !== "todas" && a.estado !== f.estado) return false;
      if (f.barber !== "todos" && a.barbero_id !== f.barber) return false;
      if (q) {
        const haystack = `${a.cliente_nombre} ${a.cliente_telefono} ${a.servicio_nombre} ${a.barbero_nombre}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }

  function renderCitas() {
    const f = A.filters.citas;
    const list = filteredAppointments();
    return `
      <div class="view-head">
        <div>
          <h1 class="view-head__title">Citas</h1>
          <p class="view-head__sub">Agenda, estados y cobros en un solo lugar.</p>
        </div>
        <div class="view-head__actions">
          <button class="btn-admin" type="button" data-action="export-citas">Exportar CSV</button>
          <button class="btn-admin btn-admin--primary" type="button" data-action="new-appointment">Nueva cita</button>
        </div>
      </div>

      <div class="card">
        <div class="filters">
          <input class="input" type="date" data-filter="citas.from" value="${esc(f.from)}" aria-label="Desde">
          <input class="input" type="date" data-filter="citas.to" value="${esc(f.to)}" aria-label="Hasta">
          <select class="select" data-filter="citas.estado" aria-label="Estado">
            <option value="todas" ${f.estado === "todas" ? "selected" : ""}>Todos los estados</option>
            ${STATUS_OPTIONS.map((o) => `<option value="${o.value}" ${f.estado === o.value ? "selected" : ""}>${o.label}</option>`).join("")}
          </select>
          <select class="select" data-filter="citas.barber" aria-label="Barbero">
            <option value="todos" ${f.barber === "todos" ? "selected" : ""}>Todos los barberos</option>
            ${A.data.barbers.map((b) => `<option value="${esc(b.id)}" ${f.barber === b.id ? "selected" : ""}>${esc(b.nombre)}</option>`).join("")}
          </select>
          <input class="input" type="search" data-filter="citas.q" value="${esc(f.q)}" placeholder="Buscar cliente o servicio" aria-label="Buscar">
          <span class="filters__spacer"></span>
          <span class="filters__count">${list.length} cita${list.length === 1 ? "" : "s"}</span>
        </div>
        <div class="table-wrap">${appointmentsTable(list)}</div>
      </div>`;
  }

  function appointmentsTable(list) {
    if (!list.length) return `<div class="table-empty">No hay citas con estos filtros.</div>`;
    return `<table class="data">
      <thead><tr>
        <th>Fecha</th><th>Hora</th><th>Cliente</th><th>Servicio</th><th>Barbero</th><th>Total</th><th>Estado</th><th style="text-align:right">Acciones</th>
      </tr></thead>
      <tbody>${list
        .map(
          (a) => `<tr>
            <td class="num"><div class="strong">${U.relativeDay(a.fecha)}</div><div class="sub">${U.formatDate(a.fecha, "numeric")}</div></td>
            <td class="num">${esc(a.hora)}</td>
            <td><div class="strong">${esc(a.cliente_nombre)}</div><div class="sub">${esc(a.cliente_telefono)}</div></td>
            <td><div>${esc(a.servicio_nombre)}</div><div class="sub">${a.duracion_min} min</div></td>
            <td>${esc(a.barbero_nombre)}</td>
            <td class="num strong">${money(a.precio)}</td>
            <td>${U.statusPill(a.estado, true)}</td>
            <td>
              <div class="row-actions">
                ${["pendiente", "confirmada"].includes(a.estado) ? miniBtn("complete-appointment", a.id, ICON.check, "Completar y cobrar", "mini-btn--primary") : ""}
                ${miniBtn("edit-appointment", a.id, ICON.edit, "Editar cita")}
                ${["pendiente", "confirmada"].includes(a.estado) ? miniBtn("cancel-appointment", a.id, ICON.x, "Cancelar cita", "mini-btn--danger") : ""}
                ${miniBtn("delete-appointment", a.id, ICON.trash, "Eliminar cita", "mini-btn--danger")}
              </div>
            </td>
          </tr>`
        )
        .join("")}</tbody>
    </table>`;
  }

  /* ---------- CLIENTES ---------- */
  function filteredClients() {
    const q = A.filters.clientes.q.trim().toLowerCase();
    if (!q) return A.data.clients;
    return A.data.clients.filter((c) =>
      `${c.nombre} ${c.telefono} ${c.email || ""}`.toLowerCase().includes(q)
    );
  }

  function renderClientes() {
    const f = A.filters.clientes;
    const list = filteredClients();
    return `
      <div class="view-head">
        <div>
          <h1 class="view-head__title">Clientes</h1>
          <p class="view-head__sub">${A.data.clients.length} registrados · historial y contacto.</p>
        </div>
        <div class="view-head__actions">
          <button class="btn-admin" type="button" data-action="export-clientes">Exportar CSV</button>
          <button class="btn-admin btn-admin--primary" type="button" data-action="new-client">Nuevo cliente</button>
        </div>
      </div>

      <div class="card">
        <div class="filters">
          <input class="input" type="search" data-filter="clientes.q" value="${esc(f.q)}" placeholder="Buscar por nombre, teléfono o email" aria-label="Buscar cliente">
          <span class="filters__spacer"></span>
          <span class="filters__count">${list.length} cliente${list.length === 1 ? "" : "s"}</span>
        </div>
        <div class="table-wrap">
          ${
            list.length
              ? `<table class="data">
                  <thead><tr><th>Cliente</th><th>Teléfono</th><th>Citas</th><th>Total gastado</th><th>Última visita</th><th style="text-align:right">Acciones</th></tr></thead>
                  <tbody>${list
                    .map((c) => {
                      const stats = clientStats(c.id);
                      return `<tr>
                        <td>
                          <button class="client-link" type="button" data-open-client="${esc(c.id)}">${esc(c.nombre)}</button>
                          <div class="sub">${esc(c.email || "Sin email")}</div>
                        </td>
                        <td class="num">${esc(c.telefono || "—")}</td>
                        <td class="num">${stats.total}</td>
                        <td class="num strong">${money(stats.spent)}</td>
                        <td>${stats.last ? U.formatDate(stats.last, "numeric") : "—"}</td>
                        <td><div class="row-actions">
                          ${miniBtn("view-client", c.id, ICON.eye, "Ver ficha")}
                          ${miniBtn("edit-client", c.id, ICON.edit, "Editar cliente")}
                          ${miniBtn("delete-client", c.id, ICON.trash, "Eliminar cliente", "mini-btn--danger")}
                        </div></td>
                      </tr>`;
                    })
                    .join("")}</tbody>
                </table>`
              : `<div class="table-empty">No hay clientes que coincidan con la búsqueda.</div>`
          }
        </div>
      </div>`;
  }

  /* ---------- INGRESOS ---------- */
  function filteredIncomes() {
    const f = A.filters.ingresos;
    const q = f.q.trim().toLowerCase();
    return A.data.incomes.filter((i) => {
      if (f.from && i.fecha < f.from) return false;
      if (f.to && i.fecha > f.to) return false;
      if (f.categoria !== "todas" && i.categoria !== f.categoria) return false;
      if (q && !`${i.descripcion} ${i.categoria} ${i.metodo_pago || ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }

  function incomeCategories() {
    return Array.from(new Set(A.data.incomes.map((i) => i.categoria).filter(Boolean))).sort();
  }

  function renderIngresos() {
    const f = A.filters.ingresos;
    const list = filteredIncomes();
    const total = U.sum(list, "monto");
    const avg = list.length ? total / list.length : 0;
    return `
      <div class="view-head">
        <div>
          <h1 class="view-head__title">Ingresos</h1>
          <p class="view-head__sub">Servicios, productos y propinas.</p>
        </div>
        <div class="view-head__actions">
          <button class="btn-admin" type="button" data-action="export-ingresos">Exportar CSV</button>
          <button class="btn-admin btn-admin--primary" type="button" data-action="new-income">Registrar ingreso</button>
        </div>
      </div>

      <div class="card">
        <div class="filters">
          <input class="input" type="date" data-filter="ingresos.from" value="${esc(f.from)}" aria-label="Desde">
          <input class="input" type="date" data-filter="ingresos.to" value="${esc(f.to)}" aria-label="Hasta">
          <select class="select" data-filter="ingresos.categoria" aria-label="Categoría">
            <option value="todas" ${f.categoria === "todas" ? "selected" : ""}>Todas las categorías</option>
            ${incomeCategories().map((c) => `<option value="${esc(c)}" ${f.categoria === c ? "selected" : ""}>${esc(c)}</option>`).join("")}
          </select>
          <input class="input" type="search" data-filter="ingresos.q" value="${esc(f.q)}" placeholder="Buscar descripción" aria-label="Buscar ingreso">
          <span class="filters__spacer"></span>
          <span class="filters__count">${list.length} registro${list.length === 1 ? "" : "s"}</span>
        </div>
        <div class="card__body" style="display:flex;gap:36px;flex-wrap:wrap;border-bottom:1px solid var(--admin-line)">
          <div><div class="kpi__label">Total</div><div class="kpi__value" style="font-size:28px">${money(total)}</div></div>
          <div><div class="kpi__label">Ticket promedio</div><div class="kpi__value" style="font-size:28px">${money(avg)}</div></div>
          <div><div class="kpi__label">Servicios</div><div class="kpi__value" style="font-size:28px">${list.filter((i) => i.categoria === "Servicio").length}</div></div>
        </div>
        <div class="table-wrap">
          ${
            list.length
              ? `<table class="data">
                  <thead><tr><th>Fecha</th><th>Categoría</th><th>Descripción</th><th>Método</th><th>Barbero</th><th>Monto</th><th style="text-align:right">Acciones</th></tr></thead>
                  <tbody>${list
                    .map(
                      (i) => `<tr>
                        <td class="num">${U.formatDate(i.fecha, "numeric")}</td>
                        <td>${esc(i.categoria)}</td>
                        <td>${esc(i.descripcion || "—")}</td>
                        <td>${esc(i.metodo_pago || "—")}</td>
                        <td>${esc((A.data.barbers.find((b) => b.id === i.barbero_id) || {}).nombre || "—")}</td>
                        <td class="num strong">${money(i.monto)}</td>
                        <td><div class="row-actions">
                          ${miniBtn("edit-income", i.id, ICON.edit, "Editar ingreso")}
                          ${miniBtn("delete-income", i.id, ICON.trash, "Eliminar ingreso", "mini-btn--danger")}
                        </div></td>
                      </tr>`
                    )
                    .join("")}</tbody>
                </table>`
              : `<div class="table-empty">No hay ingresos en este periodo.</div>`
          }
        </div>
      </div>`;
  }

  /* ---------- GASTOS ---------- */
  function filteredExpenses() {
    const f = A.filters.gastos;
    const q = f.q.trim().toLowerCase();
    return A.data.expenses.filter((e) => {
      if (f.from && e.fecha < f.from) return false;
      if (f.to && e.fecha > f.to) return false;
      if (f.categoria !== "todas" && e.categoria !== f.categoria) return false;
      if (q && !`${e.descripcion} ${e.categoria} ${e.metodo_pago || ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }

  function expenseCategories() {
    return Array.from(new Set(A.data.expenses.map((e) => e.categoria).filter(Boolean))).sort();
  }

  function renderGastos() {
    const f = A.filters.gastos;
    const list = filteredExpenses();
    const total = U.sum(list, "monto");
    const incMonth = U.sum(
      A.data.incomes.filter((i) => i.fecha >= f.from && i.fecha <= f.to),
      "monto"
    );
    return `
      <div class="view-head">
        <div>
          <h1 class="view-head__title">Gastos</h1>
          <p class="view-head__sub">Renta, insumos, marketing y todo lo que sale de caja.</p>
        </div>
        <div class="view-head__actions">
          <button class="btn-admin" type="button" data-action="export-gastos">Exportar CSV</button>
          <button class="btn-admin btn-admin--primary" type="button" data-action="new-expense">Registrar gasto</button>
        </div>
      </div>

      <div class="card">
        <div class="filters">
          <input class="input" type="date" data-filter="gastos.from" value="${esc(f.from)}" aria-label="Desde">
          <input class="input" type="date" data-filter="gastos.to" value="${esc(f.to)}" aria-label="Hasta">
          <select class="select" data-filter="gastos.categoria" aria-label="Categoría">
            <option value="todas" ${f.categoria === "todas" ? "selected" : ""}>Todas las categorías</option>
            ${expenseCategories().map((c) => `<option value="${esc(c)}" ${f.categoria === c ? "selected" : ""}>${esc(c)}</option>`).join("")}
          </select>
          <input class="input" type="search" data-filter="gastos.q" value="${esc(f.q)}" placeholder="Buscar descripción" aria-label="Buscar gasto">
          <span class="filters__spacer"></span>
          <span class="filters__count">${list.length} registro${list.length === 1 ? "" : "s"}</span>
        </div>
        <div class="card__body" style="display:flex;gap:36px;flex-wrap:wrap;border-bottom:1px solid var(--admin-line)">
          <div><div class="kpi__label">Total gastos</div><div class="kpi__value" style="font-size:28px">${money(total)}</div></div>
          <div><div class="kpi__label">Ingresos del periodo</div><div class="kpi__value" style="font-size:28px">${money(incMonth)}</div></div>
          <div><div class="kpi__label">Balance</div><div class="kpi__value" style="font-size:28px;color:${incMonth - total >= 0 ? "#2f6a46" : "#9b3f36"}">${money(incMonth - total)}</div></div>
        </div>
        <div class="table-wrap">
          ${
            list.length
              ? `<table class="data">
                  <thead><tr><th>Fecha</th><th>Categoría</th><th>Descripción</th><th>Método</th><th>Monto</th><th style="text-align:right">Acciones</th></tr></thead>
                  <tbody>${list
                    .map(
                      (e) => `<tr>
                        <td class="num">${U.formatDate(e.fecha, "numeric")}</td>
                        <td>${esc(e.categoria)}</td>
                        <td>${esc(e.descripcion || "—")}</td>
                        <td>${esc(e.metodo_pago || "—")}</td>
                        <td class="num strong">${money(e.monto)}</td>
                        <td><div class="row-actions">
                          ${miniBtn("edit-expense", e.id, ICON.edit, "Editar gasto")}
                          ${miniBtn("delete-expense", e.id, ICON.trash, "Eliminar gasto", "mini-btn--danger")}
                        </div></td>
                      </tr>`
                    )
                    .join("")}</tbody>
                </table>`
              : `<div class="table-empty">No hay gastos en este periodo.</div>`
          }
        </div>
      </div>`;
  }

  /* ---------- BARBEROS ---------- */
  function renderBarberos() {
    const monthStart = U.startOfMonth();
    const monthEnd = U.endOfMonth();
    const completed = A.data.appointments.filter(
      (a) => a.fecha >= monthStart && a.fecha <= monthEnd && a.estado === "completada"
    );
    return `
      <div class="view-head">
        <div>
          <h1 class="view-head__title">Barberos</h1>
          <p class="view-head__sub">Equipo, especialidades y rendimiento del mes.</p>
        </div>
        <div class="view-head__actions">
          <button class="btn-admin btn-admin--primary" type="button" data-action="new-barber">Agregar barbero</button>
        </div>
      </div>

      <div class="barbers-admin-grid">
        ${A.data.barbers
          .map((b) => {
            const list = completed.filter((a) => a.barbero_id === b.id);
            return `<div class="barber-admin-card" style="${b.activo === false ? "opacity:.6" : ""}">
              <div class="barber-admin-card__top">
                <span class="avatar avatar--lg" style="background:${esc(b.color || "#c98a4b")}">${U.initials(b.nombre)}</span>
                <div>
                  <h3>${esc(b.nombre)}</h3>
                  <div class="sub">${esc(b.rol || "Barbero")} · ${esc(b.especialidad || "General")}</div>
                  <div class="sub">${esc(b.telefono || "Sin teléfono")}</div>
                </div>
              </div>
              <div class="barber-admin-card__stats">
                <div class="barber-admin-card__stat"><span>Citas mes</span><b>${list.length}</b></div>
                <div class="barber-admin-card__stat"><span>Ingresos</span><b>${money(U.sum(list, "precio"))}</b></div>
                <div class="barber-admin-card__stat"><span>Comisión</span><b>${Number(b.comision_pct) || 0}%</b></div>
              </div>
              <div class="barber-admin-card__actions">
                ${miniBtn("edit-barber", b.id, ICON.edit, "Editar barbero")}
                <button class="mini-btn" type="button" data-action="toggle-barber" data-id="${esc(b.id)}">${b.activo === false ? "Activar" : "Desactivar"}</button>
                ${miniBtn("delete-barber", b.id, ICON.trash, "Eliminar barbero", "mini-btn--danger")}
              </div>
            </div>`;
          })
          .join("")}
      </div>`;
  }

  /* ---------- SERVICIOS ---------- */
  function renderServicios() {
    return `
      <div class="view-head">
        <div>
          <h1 class="view-head__title">Servicios</h1>
          <p class="view-head__sub">Precios, duración y orden en la carta pública.</p>
        </div>
        <div class="view-head__actions">
          <button class="btn-admin btn-admin--primary" type="button" data-action="new-service">Agregar servicio</button>
        </div>
      </div>

      <div class="card">
        <div class="services-admin-list">
          ${A.data.services
            .map(
              (s, i) => `<div class="service-admin-row" style="${s.activo === false ? "opacity:.55" : ""}">
                <span class="service-admin-row__num">${String(i + 1).padStart(2, "0")}</span>
                <div>
                  <div class="service-admin-row__name">${esc(s.nombre)}</div>
                  <div class="service-admin-row__desc">${esc(s.descripcion || "Sin descripción")}</div>
                </div>
                <span class="service-admin-row__time">${Number(s.duracion_min)} min</span>
                <span class="service-admin-row__price">${money(s.precio)}</span>
                <span class="service-admin-row__status">${s.activo === false ? '<span class="pill pill--admin-no_asistio">Inactivo</span>' : '<span class="pill pill--admin-confirmada">Activo</span>'}</span>
                <div class="row-actions">
                  ${miniBtn("edit-service", s.id, ICON.edit, "Editar servicio")}
                  <button class="mini-btn" type="button" data-action="toggle-service" data-id="${esc(s.id)}">${s.activo === false ? "Activar" : "Pausar"}</button>
                  ${miniBtn("delete-service", s.id, ICON.trash, "Eliminar servicio", "mini-btn--danger")}
                </div>
              </div>`
            )
            .join("")}
        </div>
      </div>`;
  }

  /* ---------- AJUSTES ---------- */
  function renderAjustes() {
    const cfg = A.data.config || {};
    const val = (key, fallback = "") => (cfg[key] !== undefined && cfg[key] !== "" ? String(cfg[key]) : fallback);
    const closed = String(cfg.dias_cerrados ?? C.schedule.closedDays.join(","))
      .split(",")
      .map((n) => Number(String(n).trim()));
    const isDemo = S.mode === "demo";

    const field = (name, label, type = "text", full = false, extra = "") => `
      <div class="field${full ? " field--full" : ""}">
        <label for="cfg_${name}">${label}</label>
        <input class="input" id="cfg_${name}" name="${name}" type="${type}" value="${esc(val(name))}" ${extra}>
      </div>`;

    return `
      <div class="view-head">
        <div>
          <h1 class="view-head__title">Ajustes</h1>
          <p class="view-head__sub">Datos del negocio, horarios y conexión con Google Sheets.</p>
        </div>
      </div>

      <div class="settings-grid">
        <div class="settings-card">
          <h3>Datos del negocio</h3>
          <p>Se usan en el sitio público, la agenda y los enlaces de contacto.</p>
          <form id="settings-form" class="admin-form-grid">
            <div class="field field--full"><label for="cfg_nombre_negocio">Nombre del negocio</label><input class="input" id="cfg_nombre_negocio" name="nombre_negocio" value="${esc(val("nombre_negocio", C.brand.name))}"></div>
            ${field("telefono", "Teléfono")}
            ${field("whatsapp", "WhatsApp (solo dígitos)")}
            ${field("email", "Email", "email")}
            ${field("instagram", "Instagram")}
            <div class="field field--full"><label for="cfg_direccion">Dirección</label><input class="input" id="cfg_direccion" name="direccion" value="${esc(val("direccion", C.contact.address))}"></div>
            ${field("hora_inicio", "Hora de apertura", "time")}
            ${field("hora_fin", "Hora de cierre", "time")}
            ${field("slot_minutos", "Duración del bloque (min)", "number", false, 'min="5" step="5"')}
            ${field("lead_minutos", "Anticipación mínima (min)", "number", false, 'min="0" step="15"')}

            <div class="field field--full">
              <label>Días cerrados</label>
              <div style="display:flex;flex-wrap:wrap;gap:12px 18px;padding:4px 0">
                ${DAY_NAMES.map(
                  (d, i) => `<label class="checkbox-row" style="min-height:24px;font-size:12px">
                    <input type="checkbox" name="dias" value="${i}" ${closed.includes(i) ? "checked" : ""}> ${d}
                  </label>`
                ).join("")}
              </div>
            </div>

            <div class="field field--full">
              <button class="btn-admin btn-admin--primary" type="submit" style="justify-self:start">Guardar ajustes</button>
            </div>
          </form>
        </div>

        <div style="display:flex;flex-direction:column;gap:10px">
          <div class="settings-card">
            <h3>Conexión de datos</h3>
            <p>${isDemo ? "Estás en modo demo: los datos viven en este navegador." : "La página está conectada a tu Google Sheet."}</p>
            <div style="margin-top:14px">
              <div class="conn-row"><span>Modo</span><b>${isDemo ? "Demo local" : "Google Sheets"}</b></div>
              <div class="conn-row"><span>Web App</span><code>${isDemo ? "Sin conectar" : esc(C.api.url)}</code></div>
              <div class="conn-row"><span>Clave</span><code>${isDemo ? esc(C.admin.demoKey) : "Configurada en Apps Script"}</code></div>
            </div>
            <p style="margin-top:12px;font-size:11px">Para conectar tu hoja: pega la URL del Web App en <code>js/config.js</code> → <code>api.url</code> y vuelve a publicar el sitio.</p>
          </div>

          <div class="settings-card">
            <h3>Respaldo</h3>
            <p>Descarga una copia completa de los datos en JSON.</p>
            <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap">
              <button class="btn-admin" type="button" data-action="download-backup">Descargar respaldo</button>
            </div>
          </div>

          ${
            isDemo
              ? `<div class="settings-card danger-zone">
                  <h3>Zona de riesgo</h3>
                  <p>Restablece la demostración con datos nuevos. Se borra lo que hayas capturado en este navegador.</p>
                  <div style="margin-top:14px">
                    <button class="btn-admin" type="button" data-action="reset-demo">Restablecer demo</button>
                  </div>
                </div>`
              : ""
          }
        </div>
      </div>`;
  }

  /* ---------- DRAWER CLIENTE ---------- */
  function openDrawer(clientId) {
    const client = clientById(clientId);
    if (!client) return;
    A.drawerClientId = clientId;
    const stats = clientStats(clientId);
    const history = [...stats.appointments].sort((a, b) => (b.fecha + b.hora).localeCompare(a.fecha + a.hora)).slice(0, 8);
    const ticket = stats.total ? stats.spent / stats.total : 0;

    $("#drawer-name").textContent = client.nombre;
    $("#drawer-phone").textContent = client.telefono || "Sin teléfono";
    $("#drawer-body").innerHTML = `
      <div class="drawer__stat-grid">
        <div class="drawer__stat"><span>Citas completadas</span><b>${stats.total}</b></div>
        <div class="drawer__stat"><span>Total gastado</span><b>${money(stats.spent)}</b></div>
        <div class="drawer__stat"><span>Ticket promedio</span><b>${money(ticket)}</b></div>
        <div class="drawer__stat"><span>Próximas</span><b>${stats.upcoming}</b></div>
      </div>

      <div class="drawer__section">
        <h4>Contacto</h4>
        <div class="history-item"><span class="history-item__meta">Email</span><span>${esc(client.email || "—")}</span></div>
        <div class="history-item"><span class="history-item__meta">Última visita</span><span>${stats.last ? U.formatDate(stats.last, "numeric") : "—"}</span></div>
        <div class="history-item"><span class="history-item__meta">Cliente desde</span><span>${client.creado_en ? U.formatDate(client.creado_en, "numeric") : "—"}</span></div>
      </div>

      <div class="drawer__section">
        <h4>Notas</h4>
        <p style="font-size:12.5px;color:#6f6a60;line-height:1.6">${esc(client.notas || "Sin notas.")}</p>
      </div>

      <div class="drawer__section">
        <h4>Historial reciente</h4>
        ${
          history.length
            ? history
                .map(
                  (a) => `<div class="history-item">
                    <div>
                      <div>${esc(a.servicio_nombre)}</div>
                      <div class="history-item__meta">${U.formatDate(a.fecha, "short")} · ${esc(a.hora)} · ${esc(a.barbero_nombre)}</div>
                    </div>
                    <div style="text-align:right">
                      <div>${money(a.precio)}</div>
                      <div style="margin-top:3px">${U.statusPill(a.estado, true)}</div>
                    </div>
                  </div>`
                )
                .join("")
            : `<p style="font-size:12.5px;color:#6f6a60">Todavía no hay citas registradas.</p>`
        }
      </div>`;

    $("#drawer-foot").innerHTML = `
      <button class="btn-admin" type="button" data-action="edit-client" data-id="${esc(client.id)}">Editar</button>
      <button class="btn-admin btn-admin--primary" type="button" data-action="new-appointment" data-client-id="${esc(client.id)}">Nueva cita</button>`;

    $("#client-drawer").classList.add("is-open");
    $("#client-drawer").setAttribute("aria-hidden", "false");
    $("#drawer-backdrop").classList.add("is-open");
  }

  function closeDrawer() {
    A.drawerClientId = null;
    $("#client-drawer").classList.remove("is-open");
    $("#client-drawer").setAttribute("aria-hidden", "true");
    $("#drawer-backdrop").classList.remove("is-open");
  }

  /* ---------- FORMULARIOS ---------- */
  function openAppointmentForm(id, presetClientId) {
    const appt = id ? apptById(id) : null;
    const presetClient = presetClientId ? clientById(presetClientId) : null;
    const services = A.data.services;
    const barbers = A.data.barbers;

    if (!services.length) {
      U.toast("Primero agrega al menos un servicio.", "error");
      return;
    }
    if (!barbers.length) {
      U.toast("Primero agrega al menos un barbero.", "error");
      return;
    }

    const fields = [
      { name: "cliente_nombre", label: "Cliente", required: true, value: appt ? appt.cliente_nombre : presetClient ? presetClient.nombre : "", placeholder: "Nombre completo" },
      { name: "cliente_telefono", label: "Teléfono", type: "tel", required: true, value: appt ? appt.cliente_telefono : presetClient ? presetClient.telefono : "", placeholder: "55 1234 5678" },
      { name: "servicio_id", label: "Servicio", type: "select", required: true, options: services.map((s) => ({ value: s.id, label: `${s.nombre} · ${money(s.precio)}` })), value: appt ? appt.servicio_id : services[0].id },
      { name: "barbero_id", label: "Barbero", type: "select", required: true, options: barbers.map((b) => ({ value: b.id, label: b.nombre })), value: appt ? appt.barbero_id : barbers[0].id },
      { name: "fecha", label: "Fecha", type: "date", required: true, value: appt ? appt.fecha : U.todayISO() },
      { name: "hora", label: "Hora", type: "time", required: true, value: appt ? appt.hora : "10:00" },
      { name: "estado", label: "Estado", type: "select", options: STATUS_OPTIONS, value: appt ? appt.estado : "pendiente" },
      { name: "notas", label: "Notas", type: "textarea", full: true, value: appt ? appt.notas || "" : "" },
    ];

    U.formModal({
      title: appt ? "Editar cita" : "Nueva cita",
      subtitle: appt ? `${appt.cliente_nombre} · ${U.formatDate(appt.fecha, "short")} ${appt.hora}` : "Agenda manual desde el panel",
      fields,
      submitText: appt ? "Guardar cambios" : "Crear cita",
      wide: true,
      onSubmit: async (values, { close }) => {
        await S.save("appointments", { ...values, id: appt ? appt.id : undefined });
        await loadData();
        renderView();
        if (A.drawerClientId) openDrawer(A.drawerClientId);
        close();
        U.toast(appt ? "Cita actualizada." : "Cita creada.", "success");
      },
    });
  }

  function openClientForm(id) {
    const client = id ? clientById(id) : null;
    U.formModal({
      title: client ? "Editar cliente" : "Nuevo cliente",
      subtitle: "Datos de contacto e historial.",
      fields: [
        { name: "nombre", label: "Nombre", required: true, value: client ? client.nombre : "" },
        { name: "telefono", label: "Teléfono", type: "tel", required: true, value: client ? client.telefono : "" },
        { name: "email", label: "Email", type: "email", full: true, value: client ? client.email || "" : "" },
        { name: "notas", label: "Notas", type: "textarea", full: true, value: client ? client.notas || "" : "" },
      ],
      submitText: client ? "Guardar cambios" : "Crear cliente",
      onSubmit: async (values, { close }) => {
        await S.save("clients", { ...values, id: client ? client.id : undefined });
        await loadData();
        renderView();
        if (client && A.drawerClientId === client.id) openDrawer(client.id);
        close();
        U.toast(client ? "Cliente actualizado." : "Cliente creado.", "success");
      },
    });
  }

  function openIncomeForm(id) {
    const item = id ? A.data.incomes.find((i) => i.id === id) : null;
    U.formModal({
      title: item ? "Editar ingreso" : "Registrar ingreso",
      subtitle: "Servicios, productos, propinas u otros.",
      fields: [
        { name: "fecha", label: "Fecha", type: "date", required: true, value: item ? item.fecha : U.todayISO() },
        { name: "monto", label: "Monto", type: "number", required: true, min: 0, step: 1, value: item ? item.monto : "" },
        { name: "categoria", label: "Categoría", type: "select", options: ["Servicio", "Productos", "Propinas", "Otros"], value: item ? item.categoria : "Servicio" },
        { name: "metodo_pago", label: "Método de pago", type: "select", options: PAYMENT_OPTIONS, value: item ? item.metodo_pago : "Efectivo" },
        { name: "descripcion", label: "Descripción", full: true, value: item ? item.descripcion || "" : "", placeholder: "Ej. Pomada mate, corte + barba..." },
        { name: "barbero_id", label: "Barbero (opcional)", type: "select", options: [{ value: "", label: "Sin asignar" }, ...A.data.barbers.map((b) => ({ value: b.id, label: b.nombre }))], value: item ? item.barbero_id || "" : "" },
      ],
      submitText: item ? "Guardar cambios" : "Registrar",
      onSubmit: async (values, { close }) => {
        await S.save("incomes", { ...values, id: item ? item.id : undefined });
        await loadData();
        renderView();
        close();
        U.toast(item ? "Ingreso actualizado." : "Ingreso registrado.", "success");
      },
    });
  }

  function openExpenseForm(id) {
    const item = id ? A.data.expenses.find((e) => e.id === id) : null;
    U.formModal({
      title: item ? "Editar gasto" : "Registrar gasto",
      subtitle: "Todo lo que sale de caja.",
      fields: [
        { name: "fecha", label: "Fecha", type: "date", required: true, value: item ? item.fecha : U.todayISO() },
        { name: "monto", label: "Monto", type: "number", required: true, min: 0, step: 1, value: item ? item.monto : "" },
        { name: "categoria", label: "Categoría", type: "select", options: ["Renta", "Insumos", "Servicios", "Marketing", "Equipo", "Impuestos", "Otros"], value: item ? item.categoria : "Insumos" },
        { name: "metodo_pago", label: "Método de pago", type: "select", options: PAYMENT_OPTIONS, value: item ? item.metodo_pago : "Efectivo" },
        { name: "descripcion", label: "Descripción", full: true, value: item ? item.descripcion || "" : "", placeholder: "Ej. Navajas, renta, pauta..." },
      ],
      submitText: item ? "Guardar cambios" : "Registrar",
      onSubmit: async (values, { close }) => {
        await S.save("expenses", { ...values, id: item ? item.id : undefined });
        await loadData();
        renderView();
        close();
        U.toast(item ? "Gasto actualizado." : "Gasto registrado.", "success");
      },
    });
  }

  function openBarberForm(id) {
    const barber = id ? A.data.barbers.find((b) => b.id === id) : null;
    U.formModal({
      title: barber ? "Editar barbero" : "Agregar barbero",
      subtitle: "Datos del equipo y comisión.",
      fields: [
        { name: "nombre", label: "Nombre", required: true, value: barber ? barber.nombre : "" },
        { name: "rol", label: "Rol", value: barber ? barber.rol || "" : "Barbero", placeholder: "Fundador, senior, barbero..." },
        { name: "especialidad", label: "Especialidad", full: true, value: barber ? barber.especialidad || "" : "", placeholder: "Fades, barba, color..." },
        { name: "telefono", label: "Teléfono", type: "tel", value: barber ? barber.telefono || "" : "" },
        { name: "comision_pct", label: "Comisión (%)", type: "number", min: 0, step: 1, value: barber ? barber.comision_pct : 40 },
        { name: "color", label: "Color", type: "color", value: barber ? barber.color || "#C98A4B" : "#C98A4B" },
        { name: "activo", label: "Activo en la agenda", type: "checkbox", value: barber ? barber.activo !== false : true },
      ],
      submitText: barber ? "Guardar cambios" : "Agregar",
      onSubmit: async (values, { close }) => {
        await S.save("barbers", { ...values, id: barber ? barber.id : undefined });
        await loadData();
        renderView();
        close();
        U.toast(barber ? "Barbero actualizado." : "Barbero agregado.", "success");
      },
    });
  }

  function openServiceForm(id) {
    const service = id ? A.data.services.find((s) => s.id === id) : null;
    U.formModal({
      title: service ? "Editar servicio" : "Agregar servicio",
      subtitle: "Aparece en la carta pública y en la agenda.",
      fields: [
        { name: "nombre", label: "Nombre", required: true, value: service ? service.nombre : "" },
        { name: "duracion_min", label: "Duración (min)", type: "number", required: true, min: 5, step: 5, value: service ? service.duracion_min : 30 },
        { name: "precio", label: "Precio", type: "number", required: true, min: 0, step: 1, value: service ? service.precio : "" },
        { name: "orden", label: "Orden", type: "number", min: 1, step: 1, value: service ? service.orden : A.data.services.length + 1 },
        { name: "descripcion", label: "Descripción", type: "textarea", full: true, value: service ? service.descripcion || "" : "" },
        { name: "activo", label: "Visible en el sitio", type: "checkbox", value: service ? service.activo !== false : true },
      ],
      submitText: service ? "Guardar cambios" : "Agregar",
      onSubmit: async (values, { close }) => {
        await S.save("services", { ...values, id: service ? service.id : undefined });
        await loadData();
        renderView();
        close();
        U.toast(service ? "Servicio actualizado." : "Servicio agregado.", "success");
      },
    });
  }

  /* ---------- ACCIONES ---------- */
  async function handleAction(action, id, el) {
    try {
      switch (action) {
        case "new-appointment":
          openAppointmentForm(null, el && el.dataset.clientId);
          break;
        case "edit-appointment":
          openAppointmentForm(id);
          break;
        case "complete-appointment":
          await completeAppointment(id);
          break;
        case "cancel-appointment":
          await setStatusWithConfirm(id, "cancelada", "¿Cancelar esta cita?", "La cita quedará marcada como cancelada y liberará el horario.");
          break;
        case "delete-appointment":
          await deleteRecord("appointments", id, "esta cita");
          break;

        case "new-client":
          openClientForm();
          break;
        case "view-client":
          openDrawer(id);
          break;
        case "edit-client":
          openClientForm(id);
          break;
        case "delete-client":
          await deleteRecord("clients", id, "este cliente");
          break;

        case "new-income":
          openIncomeForm();
          break;
        case "edit-income":
          openIncomeForm(id);
          break;
        case "delete-income":
          await deleteRecord("incomes", id, "este ingreso");
          break;

        case "new-expense":
          openExpenseForm();
          break;
        case "edit-expense":
          openExpenseForm(id);
          break;
        case "delete-expense":
          await deleteRecord("expenses", id, "este gasto");
          break;

        case "new-barber":
          openBarberForm();
          break;
        case "edit-barber":
          openBarberForm(id);
          break;
        case "toggle-barber":
          await toggleActive("barbers", id);
          break;
        case "delete-barber":
          await deleteRecord("barbers", id, "este barbero");
          break;

        case "new-service":
          openServiceForm();
          break;
        case "edit-service":
          openServiceForm(id);
          break;
        case "toggle-service":
          await toggleActive("services", id);
          break;
        case "delete-service":
          await deleteRecord("services", id, "este servicio");
          break;

        case "export-citas":
          exportCSV("citas", filteredAppointments());
          break;
        case "export-clientes":
          exportCSV("clientes", filteredClients());
          break;
        case "export-ingresos":
          exportCSV("ingresos", filteredIncomes());
          break;
        case "export-gastos":
          exportCSV("gastos", filteredExpenses());
          break;

        case "download-backup":
          U.downloadFile(`respaldo-norte-${U.todayISO()}.json`, JSON.stringify(A.data, null, 2), "application/json");
          break;
        case "reset-demo": {
          const ok = await U.confirmDialog({
            title: "Restablecer demo",
            message: "Se borrarán los datos guardados en este navegador y se generará una agenda nueva. Esta acción no se puede deshacer.",
            confirmText: "Restablecer",
            danger: true,
          });
          if (ok) S.resetDemo();
          break;
        }
        default:
          break;
      }
    } catch (error) {
      console.error(error);
      U.toast(error.message || "No se pudo completar la acción.", "error");
    }
  }

  async function completeAppointment(id) {
    const appt = apptById(id);
    if (!appt) return;
    U.formModal({
      title: "Registrar cobro",
      subtitle: `${appt.cliente_nombre} · ${appt.servicio_nombre} · ${money(appt.precio)}`,
      fields: [
        {
          name: "metodo_pago",
          label: "Método de pago",
          type: "select",
          options: PAYMENT_OPTIONS,
          value: "Efectivo",
          full: true,
        },
      ],
      submitText: "Marcar completada",
      onSubmit: async (values, { close }) => {
        await S.setStatus(id, "completada", values.metodo_pago);
        await loadData();
        renderView();
        if (A.drawerClientId) openDrawer(A.drawerClientId);
        close();
        U.toast("Cita completada e ingreso registrado.", "success");
      },
    });
  }

  async function setStatusWithConfirm(id, estado, title, message) {
    const ok = await U.confirmDialog({ title, message, confirmText: "Sí, continuar", danger: estado === "cancelada" });
    if (!ok) return;
    await S.setStatus(id, estado);
    await loadData();
    renderView();
    if (A.drawerClientId) openDrawer(A.drawerClientId);
    U.toast("Cita actualizada.", "success");
  }

  async function toggleActive(entity, id) {
    const list = A.data[entity];
    const item = list.find((x) => x.id === id);
    if (!item) return;
    await S.save(entity, { id, activo: item.activo === false });
    await loadData();
    renderView();
    U.toast(item.activo === false ? "Activado." : "Pausado.", "success");
  }

  async function deleteRecord(entity, id, label) {
    const ok = await U.confirmDialog({
      title: "Eliminar registro",
      message: `¿Eliminar ${label}? Esta acción no se puede deshacer.`,
      confirmText: "Eliminar",
      danger: true,
    });
    if (!ok) return;
    await S.remove(entity, id);
    await loadData();
    if (entity === "clients") closeDrawer();
    renderView();
    U.toast("Registro eliminado.", "success");
  }

  function exportCSV(kind, list) {
    if (!list.length) {
      U.toast("No hay registros para exportar con estos filtros.", "error");
      return;
    }
    let rows;
    if (kind === "citas") {
      rows = list.map((a) => ({
        Fecha: a.fecha,
        Hora: a.hora,
        Cliente: a.cliente_nombre,
        Telefono: a.cliente_telefono,
        Servicio: a.servicio_nombre,
        Barbero: a.barbero_nombre,
        Precio: a.precio,
        Estado: a.estado,
        Origen: a.origen || "",
        Notas: a.notas || "",
      }));
    } else if (kind === "clientes") {
      rows = list.map((c) => {
        const stats = clientStats(c.id);
        return {
          Nombre: c.nombre,
          Telefono: c.telefono,
          Email: c.email || "",
          Citas: stats.total,
          Total_gastado: stats.spent,
          Ultima_visita: stats.last,
          Notas: c.notas || "",
        };
      });
    } else if (kind === "ingresos") {
      rows = list.map((i) => ({
        Fecha: i.fecha,
        Categoria: i.categoria,
        Descripcion: i.descripcion || "",
        Metodo: i.metodo_pago || "",
        Monto: i.monto,
        Barbero: (A.data.barbers.find((b) => b.id === i.barbero_id) || {}).nombre || "",
      }));
    } else {
      rows = list.map((e) => ({
        Fecha: e.fecha,
        Categoria: e.categoria,
        Descripcion: e.descripcion || "",
        Metodo: e.metodo_pago || "",
        Monto: e.monto,
      }));
    }
    U.downloadCSV(`${kind}-${U.todayISO()}.csv`, rows);
    U.toast("Archivo CSV generado.", "success");
  }

  /* ---------- Sidebar móvil ---------- */
  function openSidebar() {
    $("#sidebar").classList.add("is-open");
    $("#sidebar-backdrop").classList.add("is-open");
  }

  function closeSidebar() {
    $("#sidebar").classList.remove("is-open");
    $("#sidebar-backdrop").classList.remove("is-open");
  }

  /* ---------- Eventos ---------- */
  function wire() {
    $("#login-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const key = $("#login-key").value.trim();
      if (!key) return;
      const btn = event.target.querySelector('button[type="submit"]');
      btn.disabled = true;
      btn.textContent = "Entrando…";
      await attemptLogin(key);
      btn.disabled = false;
      btn.textContent = "Entrar al panel";
    });

    $("#logout-btn").addEventListener("click", logout);
    $("#menu-btn").addEventListener("click", openSidebar);
    $("#sidebar-backdrop").addEventListener("click", closeSidebar);
    $("#drawer-close").addEventListener("click", closeDrawer);
    $("#drawer-backdrop").addEventListener("click", closeDrawer);

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeSidebar();
        closeDrawer();
      }
    });

    window.addEventListener("hashchange", () => {
      const view = location.hash.replace("#", "");
      if (A.data && VIEW_TITLES[view]) setView(view);
    });

    document.addEventListener("click", (event) => {
      const nav = event.target.closest("[data-view]");
      if (nav) {
        setView(nav.dataset.view);
        return;
      }
      const actionEl = event.target.closest("[data-action]");
      if (actionEl) {
        handleAction(actionEl.dataset.action, actionEl.dataset.id, actionEl);
        return;
      }
      const clientEl = event.target.closest("[data-open-client]");
      if (clientEl) {
        openDrawer(clientEl.dataset.openClient);
      }
    });

    document.addEventListener("input", (event) => {
      const key = event.target.dataset.filter;
      if (!key || event.target.tagName === "SELECT" || event.target.type === "date") return;
      setFilterDebounced(key, event.target.value);
    });

    document.addEventListener("change", (event) => {
      const key = event.target.dataset.filter;
      if (!key) return;
      if (event.target.tagName === "SELECT" || event.target.type === "date") {
        setFilter(key, event.target.value);
      }
    });

    document.addEventListener("submit", async (event) => {
      if (event.target.id !== "settings-form") return;
      event.preventDefault();
      const form = event.target;
      const btn = form.querySelector('button[type="submit"]');
      const data = {};
      new FormData(form).forEach((value, key) => {
        if (key !== "dias") data[key] = value;
      });
      data.dias_cerrados = new FormData(form).getAll("dias").join(",");
      btn.disabled = true;
      btn.textContent = "Guardando…";
      try {
        await S.save("config", data);
        await loadData();
        renderView();
        U.toast("Ajustes guardados. El sitio público los tomará al recargar.", "success");
      } catch (error) {
        U.toast(error.message || "No se pudieron guardar los ajustes.", "error");
        btn.disabled = false;
        btn.textContent = "Guardar ajustes";
      }
    });
  }

  let filterTimer = null;
  function setFilterDebounced(key, value) {
    clearTimeout(filterTimer);
    filterTimer = setTimeout(() => setFilter(key, value), 220);
  }

  function setFilter(key, value) {
    const [view, prop] = key.split(".");
    if (!A.filters[view]) return;
    A.filters[view][prop] = value;
    if (A.view !== view) return;

    const active = document.activeElement;
    const caret = active && active.selectionStart;
    renderView();

    const next = $(`[data-filter="${key}"]`);
    if (next && next.tagName !== "SELECT" && next.type !== "date" && next.type !== "search") {
      next.focus();
      try {
        next.setSelectionRange(caret ?? next.value.length, caret ?? next.value.length);
      } catch (e) {
        /* noop */
      }
    } else if (next && next.type === "search") {
      next.focus();
      try {
        next.setSelectionRange(caret ?? next.value.length, caret ?? next.value.length);
      } catch (e) {
        /* noop */
      }
    }
  }
})();
