/* Indicador Lottie compartido por el panel admin y el portal de barberos. */
(function () {
  const overlay = document.getElementById("sheets-loading");
  if (!overlay) return;

  const label = document.getElementById("sheets-loading-label");
  const activeRequests = new Map();
  let showTimer = null;

  if (window.lottie) {
    window.lottie.loadAnimation({
      container: document.getElementById("sheets-loading-animation"),
      renderer: "svg",
      loop: true,
      autoplay: true,
      path: "assets/loading-barbero.json",
    });
  }

  function labelFor({ action, payload = {} }) {
    if (action === "adminLogin" || action === "barberLogin") return "Validando acceso…";
    if (action === "adminData" || action === "barberData" || action === "bootstrap") return "Cargando datos…";
    if (action === "setStatus" || action === "barberSetStatus") {
      return payload.estado === "confirmada" ? "Confirmando cita…" : "Actualizando cita…";
    }
    if (action.toLowerCase().includes("delete")) return "Eliminando registro…";
    if (action.toLowerCase().includes("save")) return "Guardando cambios…";
    if (action === "availability") return "Consultando horarios…";
    return "Procesando solicitud…";
  }

  function updateLabel() {
    const requests = Array.from(activeRequests.values());
    if (requests.length) label.textContent = requests[requests.length - 1];
  }

  window.addEventListener("sheets:request:start", (event) => {
    const request = event.detail;
    activeRequests.set(request, labelFor(request));
    updateLabel();
    if (activeRequests.size === 1) {
      showTimer = window.setTimeout(() => {
        if (activeRequests.size) overlay.hidden = false;
      }, 120);
    }
  });

  window.addEventListener("sheets:request:end", (event) => {
    activeRequests.delete(event.detail);
    if (!activeRequests.size) {
      window.clearTimeout(showTimer);
      overlay.hidden = true;
      return;
    }
    updateLabel();
  });
})();
