/* Agenda diaria compartida por Admin y portal del barbero. */
(function () {
  const esc = (v) => window.UI.esc(v || "");
  const statusClass = (s) => ({ Receso: "break", Almuerzo: "lunch", "No disponible": "blocked", Disponible: "available" }[s] || "blocked");
  function render({ date, appointments = [], blocks = [], barbers = [], barberId = "todos", editable = false, config = {} }) {
    const start = window.UI.minutesFromTime(config.hora_inicio || "00:00");
    let end = window.UI.minutesFromTime(config.hora_fin || "23:59");
    if (end <= start) end = 1439;
    const span = Math.max(60, end - start);
    const events = [];
    appointments.filter(a => a.fecha === date && !["cancelada", "no_asistio"].includes(a.estado) && (barberId === "todos" || a.barbero_id === barberId)).forEach(a => events.push({ start: window.UI.minutesFromTime(a.hora), end: window.UI.minutesFromTime(a.hora) + (Number(a.duracion_min) || 30), title: a.cliente_nombre, sub: `${a.servicio_nombre} · ${a.barbero_nombre}`, kind: "appointment", color: "" }));
    blocks.filter(b => b.fecha === date && (barberId === "todos" || b.barbero_id === barberId)).forEach(b => events.push({ id: b.id, start: window.UI.minutesFromTime(b.hora_inicio), end: window.UI.minutesFromTime(b.hora_fin), title: b.estado, sub: `${(barbers.find(x => x.id === b.barbero_id) || {}).nombre || ""}${b.notas ? ` · ${b.notas}` : ""}`, kind: statusClass(b.estado), block: b }));
    events.forEach((e, i) => {
      const overlapping = events.filter((x, j) => j !== i && x.start < e.end && x.end > e.start);
      const lane = overlapping.filter(x => x.start < e.start || (x.start === e.start && events.indexOf(x) < i)).length;
      const lanes = Math.min(4, Math.max(1, overlapping.length + 1));
      e.left = lane * (100 / lanes); e.width = 100 / lanes;
    });
    const rows = [];
    const firstHour = Math.floor(start / 60) * 60;
    for (let t = firstHour; t <= end; t += 60) rows.push(`<div class="daycal__hour"><span>${window.UI.timeFromMinutes(t)}</span><button type="button" data-cal-time="${window.UI.timeFromMinutes(Math.max(t, start))}" aria-label="Crear bloque a las ${window.UI.timeFromMinutes(Math.max(t, start))}" ${editable ? "" : "disabled"}></button></div>`);
    const eventHtml = events.map(e => {
      const top = Math.max(0, e.start - start), height = Math.max(28, e.end - e.start);
      return `<div class="daycal__event daycal__event--${e.kind}" style="top:${top}px;height:${height}px;left:${e.left}%;width:${e.width}%" title="${esc(e.sub)}"><b>${esc(e.title)}</b><small>${window.UI.timeFromMinutes(e.start)}–${window.UI.timeFromMinutes(e.end)} · ${esc(e.sub)}</small>${editable && e.block ? `<button type="button" data-cal-delete="${esc(e.id)}" aria-label="Eliminar bloque">×</button>` : ""}</div>`;
    }).join("");
    return `<div class="daycal"><div class="daycal__times">${rows.join("")}</div><div class="daycal__track" style="height:${Math.ceil(span / 60) * 60}px">${eventHtml}</div></div>`;
  }
  window.DayCalendar = { render };
})();
