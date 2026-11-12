/* ============================================================
   UI — utilidades compartidas por el sitio y el panel
   ============================================================ */
(function () {
  const C = window.BARBER_CONFIG;

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const pad = (n) => String(n).padStart(2, "0");

  /* ---------- Dinero ---------- */
  function money(value, decimals = 0) {
    const n = Number(value) || 0;
    try {
      return new Intl.NumberFormat(C.currency.locale, {
        style: "currency",
        currency: C.currency.code,
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(n);
    } catch (e) {
      return `$${n.toFixed(decimals)}`;
    }
  }

  function number(value, decimals = 0) {
    return new Intl.NumberFormat(C.currency.locale, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(Number(value) || 0);
  }

  /* ---------- Fechas (siempre locales, sin UTC) ---------- */
  const parseISO = (iso) => {
    if (!iso) return new Date(NaN);
    if (iso instanceof Date) return new Date(iso.getFullYear(), iso.getMonth(), iso.getDate());
    const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
  };

  const toISO = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

  const todayISO = () => toISO(new Date());

  function addDays(iso, days) {
    const d = parseISO(iso);
    d.setDate(d.getDate() + days);
    return toISO(d);
  }

  function startOfMonth(iso = todayISO()) {
    return `${String(iso).slice(0, 7)}-01`;
  }

  function endOfMonth(iso = todayISO()) {
    const d = parseISO(iso);
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    return toISO(last);
  }

  function formatDate(iso, style = "medium") {
    if (!iso) return "—";
    const d = parseISO(iso);
    const opts = {
      short: { weekday: "short", day: "numeric", month: "short" },
      medium: { weekday: "long", day: "numeric", month: "long" },
      long: { weekday: "long", day: "numeric", month: "long", year: "numeric" },
      numeric: { day: "2-digit", month: "2-digit", year: "numeric" },
      month: { month: "long", year: "numeric" },
    }[style] || { day: "numeric", month: "short" };
    const out = new Intl.DateTimeFormat("es-MX", opts).format(d);
    return out.charAt(0).toUpperCase() + out.slice(1);
  }

  function relativeDay(iso) {
    const today = todayISO();
    if (iso === today) return "Hoy";
    if (iso === addDays(today, 1)) return "Mañana";
    if (iso === addDays(today, -1)) return "Ayer";
    return formatDate(iso, "short");
  }

  function weekdayShort(iso) {
    return new Intl.DateTimeFormat("es-MX", { weekday: "short" }).format(parseISO(iso)).replace(".", "");
  }

  function monthShort(iso) {
    return new Intl.DateTimeFormat("es-MX", { month: "short" }).format(parseISO(iso)).replace(".", "");
  }

  /* ---------- Horas ---------- */
  function minutesFromTime(time) {
    const [h, m] = String(time || "00:00").split(":").map(Number);
    return h * 60 + (m || 0);
  }

  function timeFromMinutes(total) {
    const t = ((Math.round(total) % 1440) + 1440) % 1440;
    return `${pad(Math.floor(t / 60))}:${pad(t % 60)}`;
  }

  const formatTime = (time) => String(time || "").slice(0, 5);

  function timeRange(start, duration) {
    return `${formatTime(start)} – ${timeFromMinutes(minutesFromTime(start) + Number(duration || 0))}`;
  }

  function nowMinutes() {
    const n = new Date();
    return n.getHours() * 60 + n.getMinutes();
  }

  function isClosedDay(iso) {
    return (C.schedule.closedDays || []).includes(parseISO(iso).getDay());
  }

  /* ---------- Texto / datos ---------- */
  const esc = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));

  function initials(name) {
    const parts = String(name || "?").trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "?";
    return (parts[0][0] + (parts[1] ? parts[1][0] : "")).toUpperCase();
  }

  function normalizePhone(phone) {
    const digits = String(phone || "").replace(/\D/g, "");
    return digits.length > 10 ? digits.slice(-10) : digits;
  }

  function uid(prefix) {
    return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  }

  function slug(text) {
    return String(text || "archivo")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  const STATUS = {
    pendiente: { label: "Pendiente" },
    confirmada: { label: "Confirmada" },
    completada: { label: "Completada" },
    cancelada: { label: "Cancelada" },
    no_asistio: { label: "No asistió" },
  };

  function statusMeta(status) {
    return STATUS[status] || { label: status || "—" };
  }

  function statusPill(status, admin = false) {
    const meta = statusMeta(status);
    const cls = admin ? `pill--admin-${status}` : `pill--${status}`;
    return `<span class="pill ${cls}">${esc(meta.label)}</span>`;
  }

  function debounce(fn, wait = 220) {
    let t;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), wait);
    };
  }

  function sum(list, key) {
    return (list || []).reduce((acc, item) => acc + (Number(item[key]) || 0), 0);
  }

  function groupBy(list, keyFn) {
    return (list || []).reduce((acc, item) => {
      const key = keyFn(item);
      (acc[key] = acc[key] || []).push(item);
      return acc;
    }, {});
  }

  /* ---------- Descargas ---------- */
  function downloadFile(filename, content, mime = "text/plain;charset=utf-8") {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  function toCSV(rows, headers) {
    const cols = headers || (rows[0] ? Object.keys(rows[0]) : []);
    const escapeCell = (v) => {
      const s = String(v ?? "");
      return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [cols.join(",")];
    rows.forEach((row) => lines.push(cols.map((c) => escapeCell(row[c])).join(",")));
    return "\ufeff" + lines.join("\r\n");
  }

  function downloadCSV(filename, rows, headers) {
    downloadFile(filename, toCSV(rows, headers), "text/csv;charset=utf-8");
  }

  function downloadICS(appt) {
    const start = parseISO(appt.fecha);
    const [h, m] = String(appt.hora).split(":").map(Number);
    start.setHours(h, m, 0, 0);
    const end = new Date(start.getTime() + (Number(appt.duracion_min) || 30) * 60000);
    const fmt = (d) =>
      `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Norte Barberia//Reservas//ES",
      "BEGIN:VEVENT",
      `UID:${appt.id || uid("appt")}@nortebarberia`,
      `DTSTAMP:${fmt(new Date())}`,
      `DTSTART:${fmt(start)}`,
      `DTEND:${fmt(end)}`,
      `SUMMARY:${appt.servicio_nombre || "Cita"} · ${C.brand.name}`,
      `LOCATION:${C.contact.address}`,
      `DESCRIPTION:${appt.barbero_nombre ? "Barbero: " + appt.barbero_nombre + ". " : ""}Código: ${appt.codigo || appt.id || ""}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ];
    downloadFile(`cita-${appt.fecha}-${String(appt.hora).replace(":", "")}.ics`, lines.join("\r\n"), "text/calendar;charset=utf-8");
  }

  /* ---------- Toasts ---------- */
  function toast(message, type = "info", timeout = 3800) {
    let stack = $(".toast-stack");
    if (!stack) {
      stack = document.createElement("div");
      stack.className = "toast-stack";
      document.body.appendChild(stack);
    }
    const el = document.createElement("div");
    el.className = `toast toast--${type}`;
    el.setAttribute("role", "status");
    el.innerHTML = `<span>${esc(message)}</span>`;
    stack.appendChild(el);
    setTimeout(() => {
      el.classList.add("is-out");
      setTimeout(() => el.remove(), 220);
    }, timeout);
  }

  /* ---------- Modales ---------- */
  let lastFocused = null;

  function openModal(modal) {
    const el = typeof modal === "string" ? $(modal) : modal;
    if (!el) return;
    lastFocused = document.activeElement;
    el.classList.add("is-open");
    el.setAttribute("aria-hidden", "false");
    document.body.classList.add("no-scroll");
    const focusable = el.querySelector("input:not([type=hidden]), select, textarea, button, [href]");
    setTimeout(() => focusable && focusable.focus({ preventScroll: true }), 40);
  }

  function closeModal(modal) {
    const el = typeof modal === "string" ? $(modal) : modal;
    if (!el) return;
    el.classList.remove("is-open");
    el.setAttribute("aria-hidden", "true");
    if (!$(".modal.is-open")) document.body.classList.remove("no-scroll");
    if (lastFocused && document.contains(lastFocused)) {
      try { lastFocused.focus({ preventScroll: true }); } catch (e) { /* noop */ }
    }
  }

  document.addEventListener("click", (event) => {
    const closer = event.target.closest("[data-close-modal]");
    if (closer) {
      const modal = closer.closest(".modal");
      if (modal) closeModal(modal);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    const open = $$(".modal.is-open").pop();
    if (open) closeModal(open);
  });

  /* ---------- Formulario genérico (panel) ---------- */
  function fieldHtml(field) {
    const id = `fld_${field.name}`;
    const req = field.required ? "required" : "";
    const full = field.full ? " field--full" : "";
    const value = field.value ?? "";
    let control = "";

    if (field.type === "select") {
      const opts = (field.options || [])
        .map((opt) => {
          const val = typeof opt === "object" ? opt.value : opt;
          const label = typeof opt === "object" ? opt.label : opt;
          return `<option value="${esc(val)}" ${String(val) === String(value) ? "selected" : ""}>${esc(label)}</option>`;
        })
        .join("");
      control = `<select class="select" id="${id}" name="${field.name}" ${req}>${opts}</select>`;
    } else if (field.type === "textarea") {
      control = `<textarea class="textarea" id="${id}" name="${field.name}" placeholder="${esc(field.placeholder || "")}" ${req}>${esc(value)}</textarea>`;
    } else if (field.type === "checkbox") {
      return `<div class="field${full}">
        <div class="checkbox-row">
          <input type="checkbox" id="${id}" name="${field.name}" ${value ? "checked" : ""}>
          <label for="${id}">${esc(field.label)}</label>
        </div>
        ${field.hint ? `<span class="field-hint">${esc(field.hint)}</span>` : ""}
      </div>`;
    } else {
      const attrs = [
        field.min !== undefined ? `min="${esc(field.min)}"` : "",
        field.max !== undefined ? `max="${esc(field.max)}"` : "",
        field.step !== undefined ? `step="${esc(field.step)}"` : "",
        field.placeholder ? `placeholder="${esc(field.placeholder)}"` : "",
        field.autocomplete ? `autocomplete="${esc(field.autocomplete)}"` : "",
      ].join(" ");
      control = `<input class="input" type="${field.type || "text"}" id="${id}" name="${field.name}" value="${esc(value)}" ${attrs} ${req}>`;
    }

    return `<div class="field${full}">
      <label for="${id}">${esc(field.label)}${field.required ? " *" : ""}</label>
      ${control}
      ${field.hint ? `<span class="field-hint">${esc(field.hint)}</span>` : ""}
    </div>`;
  }

  function formModal({ title, subtitle = "", fields = [], submitText = "Guardar", cancelText = "Cancelar", onSubmit, wide = false }) {
    const root = $("#modal-root");
    if (!root) return;
    const modal = document.createElement("div");
    modal.className = "modal modal--admin is-open";
    modal.setAttribute("aria-hidden", "false");
    modal.innerHTML = `
      <div class="modal__backdrop" data-close-modal></div>
      <div class="modal__dialog ${wide ? "" : "modal__dialog--sm"}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
        <button class="modal__close" type="button" data-close-modal aria-label="Cerrar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M5 5l14 14M19 5L5 19"/></svg>
        </button>
        <div class="modal__head">
          <h2>${esc(title)}</h2>
          ${subtitle ? `<p>${esc(subtitle)}</p>` : ""}
        </div>
        <form novalidate>
          <div class="modal__body">
            <div class="admin-form-grid">${fields.map(fieldHtml).join("")}</div>
          </div>
          <div class="modal__foot">
            <button type="button" class="btn-admin" data-close-modal>${esc(cancelText)}</button>
            <button type="submit" class="btn-admin btn-admin--primary">${esc(submitText)}</button>
          </div>
        </form>
      </div>`;
    root.appendChild(modal);
    document.body.classList.add("no-scroll");

    const form = modal.querySelector("form");
    const submit = form.querySelector('button[type="submit"]');
    const first = form.querySelector("input:not([type=checkbox]), select, textarea");
    setTimeout(() => first && first.focus({ preventScroll: true }), 40);

    const close = () => {
      modal.remove();
      if (!$(".modal.is-open")) document.body.classList.remove("no-scroll");
    };

    modal.querySelectorAll("[data-close-modal]").forEach((b) => b.addEventListener("click", close));

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const invalid = form.querySelector(":invalid");
      if (invalid) {
        invalid.focus();
        invalid.reportValidity();
        return;
      }
      const data = {};
      fields.forEach((f) => {
        const input = form.elements[f.name];
        if (!input) return;
        if (f.type === "checkbox") data[f.name] = input.checked;
        else if (f.type === "number") data[f.name] = input.value === "" ? "" : Number(input.value);
        else data[f.name] = input.value.trim();
      });
      submit.disabled = true;
      const original = submit.textContent;
      submit.textContent = "Guardando…";
      try {
        await onSubmit(data, { close });
      } catch (error) {
        toast(error.message || "No se pudo guardar", "error");
        submit.disabled = false;
        submit.textContent = original;
      }
    });

    return { close, modal };
  }

  function confirmDialog({ title, message, confirmText = "Confirmar", cancelText = "Cancelar", danger = false }) {
    return new Promise((resolve) => {
      const root = $("#modal-root");
      if (!root) return resolve(false);
      const modal = document.createElement("div");
      modal.className = "modal modal--admin is-open";
      modal.innerHTML = `
        <div class="modal__backdrop"></div>
        <div class="modal__dialog modal__dialog--sm" role="alertdialog" aria-modal="true" aria-label="${esc(title)}">
          <div class="modal__head"><h2>${esc(title)}</h2></div>
          <div class="modal__body"><p style="font-size:13.5px;color:#6f6a60;line-height:1.6">${esc(message)}</p></div>
          <div class="modal__foot">
            <button type="button" class="btn-admin" data-no>${esc(cancelText)}</button>
            <button type="button" class="btn-admin ${danger ? "btn-admin--copper" : "btn-admin--primary"}" data-yes>${esc(confirmText)}</button>
          </div>
        </div>`;
      root.appendChild(modal);
      document.body.classList.add("no-scroll");
      const finish = (value) => {
        modal.remove();
        if (!$(".modal.is-open")) document.body.classList.remove("no-scroll");
        resolve(value);
      };
      modal.querySelector("[data-no]").addEventListener("click", () => finish(false));
      modal.querySelector(".modal__backdrop").addEventListener("click", () => finish(false));
      modal.querySelector("[data-yes]").addEventListener("click", () => finish(true));
      modal.querySelector("[data-yes]").focus();
    });
  }

  window.UI = {
    $, $$, money, number,
    parseISO, toISO, todayISO, addDays, startOfMonth, endOfMonth,
    formatDate, relativeDay, weekdayShort, monthShort,
    minutesFromTime, timeFromMinutes, formatTime, timeRange, nowMinutes, isClosedDay,
    esc, initials, normalizePhone, uid, slug,
    statusMeta, statusPill,
    debounce, sum, groupBy,
    downloadFile, downloadCSV, downloadICS,
    toast, openModal, closeModal, formModal, confirmDialog,
  };
})();
