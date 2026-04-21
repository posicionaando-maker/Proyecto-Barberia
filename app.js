// ==================== BASE DE DATOS ====================
let db = {
  clientes: [],
  citas: [],
  productos: [],
  servicios: [
    { id: 1, nombre: "Corte de pelo", duracion: 30, precio: 15 },
    { id: 2, nombre: "Arreglo de Barba", duracion: 20, precio: 12 },
    { id: 3, nombre: "Afeitado Clásico", duracion: 25, precio: 18 },
    { id: 4, nombre: "Tinte", duracion: 60, precio: 35 },
    { id: 5, nombre: "Corte + Barba", duracion: 45, precio: 25 }
  ],
  barberos: [
    { id: 1, nombre: "Juan", comision: 0.5 },
    { id: 2, nombre: "Carlos", comision: 0.5 },
    { id: 3, nombre: "Miguel", comision: 0.5 }
  ],
  ventas: []
};

let currentCitaId = null;

// ==================== UTILIDADES ====================
function mostrarToast(mensaje, tipo = "success") {
  const toast = document.getElementById("toast");
  toast.textContent = mensaje;
  toast.className = `toast ${tipo}`;
  toast.classList.remove("hidden");
  setTimeout(() => {
    toast.classList.add("hidden");
  }, 3000);
}

function cargarDatos() {
  const data = localStorage.getItem("barbercontrol_db");
  if (data) {
    db = JSON.parse(data);
  } else {
    cargarDatosDemo(false);
  }
  renderizarTodo();
}

function guardarDatos() {
  localStorage.setItem("barbercontrol_db", JSON.stringify(db));
}

// ==================== CLIENTES ====================
function registrarCliente(nombre, telefono, nacimiento, email, alergias) {
  if (db.clientes.find(c => c.telefono === telefono)) {
    mostrarToast("⚠️ Teléfono ya registrado", "warning");
    return false;
  }
  
  const nuevoCliente = {
    id: Date.now().toString(),
    nombre, telefono, nacimiento, email, alergias,
    ultimaVisita: null,
    gastoTotal: 0,
    historialServicios: [],
    productosComprados: []
  };
  db.clientes.push(nuevoCliente);
  guardarDatos();
  renderizarListaClientes();
  mostrarToast(`✅ Cliente ${nombre} registrado`, "success");
  return true;
}

function verFichaCliente(clienteId) {
  const cliente = db.clientes.find(c => c.id == clienteId);
  if (!cliente) return;
  
  const historialHtml = cliente.historialServicios.map(s => 
    `<div class="card" style="margin-top: 8px;">
       <strong>${s.fecha}</strong><br>
       ${s.servicio} - $${s.total || s.precio}
     </div>`
  ).join('');
  
  const frecuencia = calcularFrecuenciaMedia(cliente.historialServicios);
  
  const modalBody = document.createElement("div");
  modalBody.innerHTML = `
    <div class="info-box">
      <p><strong>📇 ${cliente.nombre}</strong></p>
      <p>📞 ${cliente.telefono}</p>
      <p>📧 ${cliente.email || "No registrado"}</p>
      <p>🎂 ${cliente.nacimiento || "No registrada"}</p>
      <p>⚠️ ${cliente.alergias || "Ninguna"}</p>
      <hr>
      <p>🕒 Última visita: ${cliente.ultimaVisita || "Ninguna"}</p>
      <p>📈 Frecuencia: ${frecuencia}</p>
      <p>💰 Gasto total: $${cliente.gastoTotal}</p>
      <p>📦 Productos comprados: ${cliente.productosComprados.length}</p>
    </div>
    <h3>✂️ Historial de Servicios</h3>
    ${historialHtml || "<p>Sin servicios aún</p>"}
  `;
  
  mostrarModalPersonalizado("Ficha del Cliente", modalBody);
}

function calcularFrecuenciaMedia(historial) {
  if (historial.length < 2) return "Sin datos suficientes";
  let totalDias = 0;
  for (let i = 1; i < historial.length; i++) {
    const diff = (new Date(historial[i-1].fecha) - new Date(historial[i].fecha)) / (1000*60*60*24);
    totalDias += Math.abs(diff);
  }
  const media = Math.round(totalDias / (historial.length - 1));
  return `cada ${media} días`;
}

// ==================== CITAS ====================
function crearCita(clienteId, servicioId, barberoId, fechaHora) {
  const servicio = db.servicios.find(s => s.id == servicioId);
  const ocupado = db.citas.some(c => c.barberoId == barberoId && c.fechaHora === fechaHora && c.estado !== "finalizada");
  
  if (ocupado) {
    mostrarToast("⚠️ Horario ya ocupado para este barbero", "warning");
    return false;
  }
  
  const nuevaCita = {
    id: Date.now().toString(),
    clienteId, servicioId, barberoId,
    fechaHora, estado: "pendiente",
    precioServicio: servicio.precio,
    extras: []
  };
  db.citas.push(nuevaCita);
  guardarDatos();
  renderizarCitas();
  mostrarToast("✅ Cita agendada correctamente", "success");
  return true;
}

function abrirFinalizarCita(citaId) {
  currentCitaId = citaId;
  const cita = db.citas.find(c => c.id == citaId);
  const cliente = db.clientes.find(c => c.id == cita.clienteId);
  const servicio = db.servicios.find(s => s.id == cita.servicioId);
  
  document.getElementById("finalizarInfo").innerHTML = `
    <div class="info-box">
      <p><strong>Cliente:</strong> ${cliente.nombre}</p>
      <p><strong>Servicio:</strong> ${servicio.nombre}</p>
      <p><strong>Precio base:</strong> $${servicio.precio}</p>
    </div>
  `;
  
  // Productos disponibles
  const productosHtml = db.productos.filter(p => p.stock > 0).map(p => `
    <label style="display: flex; align-items: center; gap: 8px; margin: 8px 0;">
      <input type="checkbox" class="producto-extra" data-id="${p.id}" data-precio="${p.precioVenta}" data-nombre="${p.nombre}">
      ${p.nombre} - $${p.precioVenta} (Stock: ${p.stock})
    </label>
  `).join('');
  
  document.getElementById("productosExtras").innerHTML = productosHtml || "<p>No hay productos en inventario</p>";
  
  document.getElementById("modalFinalizar").classList.remove("hidden");
  calcularTotalFinalizar();
}

function calcularTotalFinalizar() {
  const cita = db.citas.find(c => c.id == currentCitaId);
  const servicio = db.servicios.find(s => s.id == cita.servicioId);
  let total = servicio.precio;
  
  document.querySelectorAll(".extra:checked").forEach(cb => {
    total += parseFloat(cb.dataset.precio);
  });
  
  document.querySelectorAll(".producto-extra:checked").forEach(cb => {
    total += parseFloat(cb.dataset.precio);
  });
  
  document.getElementById("totalFinalizar").textContent = `$${total.toFixed(2)}`;
}

function finalizarCita(metodoPago) {
  const cita = db.citas.find(c => c.id == currentCitaId);
  if (!cita || cita.estado === "finalizada") return;
  
  const cliente = db.clientes.find(cl => cl.id == cita.clienteId);
  const servicio = db.servicios.find(s => s.id == cita.servicioId);
  
  let totalExtras = 0;
  document.querySelectorAll(".extra:checked").forEach(cb => {
    totalExtras += parseFloat(cb.dataset.precio);
  });
  
  let totalProductos = 0;
  const productosVendidos = [];
  document.querySelectorAll(".producto-extra:checked").forEach(cb => {
    const precio = parseFloat(cb.dataset.precio);
    const prodId = cb.dataset.id;
    const producto = db.productos.find(p => p.id == prodId);
    if (producto && producto.stock > 0) {
      producto.stock--;
      totalProductos += precio;
      productosVendidos.push({ id: prodId, nombre: cb.dataset.nombre, precio });
      cliente.productosComprados.push({ 
        nombre: cb.dataset.nombre, 
        cantidad: 1, 
        fecha: new Date().toISOString() 
      });
    }
  });
  
  const total = servicio.precio + totalExtras + totalProductos;
  const comisionBarbero = servicio.precio * (db.barberos.find(b => b.id == cita.barberoId).comision);
  
  cita.estado = "finalizada";
  cita.totalPagado = total;
  cita.metodoPago = metodoPago;
  cita.fechaFinalizacion = new Date().toISOString();
  cita.extras = { totalExtras, productosVendidos };
  
  cliente.ultimaVisita = new Date().toISOString().split('T')[0];
  cliente.gastoTotal += total;
  cliente.historialServicios.push({
    fecha: new Date().toISOString(),
    servicio: servicio.nombre,
    precio: servicio.precio,
    extras: totalExtras,
    total: total
  });
  
  db.ventas.push({
    tipo: "cita",
    fecha: new Date().toISOString(),
    total, metodoPago, comisionBarbero, barberoId: cita.barberoId,
    cliente: cliente.nombre,
    servicio: servicio.nombre
  });
  
  guardarDatos();
  renderizarCitas();
  cerrarModalFinalizar();
  mostrarToast(`✅ Servicio finalizado. Total: $${total}`, "success");
}

// ==================== PRODUCTOS ====================
function registrarProducto(nombre, stock, precioCosto, precioVenta) {
  db.productos.push({
    id: Date.now().toString(),
    nombre, 
    stock: parseInt(stock), 
    precioCosto: parseFloat(precioCosto), 
    precioVenta: parseFloat(precioVenta)
  });
  guardarDatos();
  renderizarInventario();
  mostrarToast(`✅ Producto ${nombre} agregado`, "success");
}

function ventaDirecta(productoId, cantidad) {
  const prod = db.productos.find(p => p.id == productoId);
  if (!prod || prod.stock < cantidad) {
    mostrarToast("Stock insuficiente", "error");
    return false;
  }
  prod.stock -= cantidad;
  const total = prod.precioVenta * cantidad;
  db.ventas.push({
    tipo: "venta_directa",
    fecha: new Date().toISOString(),
    total, 
    metodoPago: "efectivo",
    productos: [{ nombre: prod.nombre, cantidad, precioUnitario: prod.precioVenta }]
  });
  guardarDatos();
  mostrarToast(`💰 Venta realizada: $${total}`, "success");
  renderizarInventario();
  return true;
}

// ==================== REPORTES ====================
function mostrarResumenDia(fecha) {
  const ventasDelDia = db.ventas.filter(v => v.fecha.split('T')[0] === fecha);
  const totalFacturado = ventasDelDia.reduce((sum, v) => sum + v.total, 0);
  const efectivo = ventasDelDia.filter(v => v.metodoPago === "efectivo").reduce((sum, v) => sum + v.total, 0);
  const tarjeta = ventasDelDia.filter(v => v.metodoPago === "tarjeta").reduce((sum, v) => sum + v.total, 0);
  const transferencia = ventasDelDia.filter(v => v.metodoPago === "transferencia").reduce((sum, v) => sum + v.total, 0);
  const comisiones = ventasDelDia.reduce((sum, v) => sum + (v.comisionBarbero || 0), 0);
  const beneficioNeto = totalFacturado - comisiones;
  
  const html = `
    <div class="stat-card">
      <div class="stat-value">$${totalFacturado.toFixed(2)}</div>
      <div class="stat-label">Total Facturado</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">$${efectivo.toFixed(2)}</div>
      <div class="stat-label">Efectivo</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">$${tarjeta.toFixed(2)}</div>
      <div class="stat-label">Tarjeta</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">$${transferencia.toFixed(2)}</div>
      <div class="stat-label">Transferencia</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">$${comisiones.toFixed(2)}</div>
      <div class="stat-label">Comisiones</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">$${beneficioNeto.toFixed(2)}</div>
      <div class="stat-label">Beneficio Neto</div>
    </div>
  `;
  
  document.getElementById("resumenDia").innerHTML = html;
}

function mostrarRankingServicios(dias = 30) {
  const hoy = new Date();
  const fechaLimite = new Date();
  fechaLimite.setDate(hoy.getDate() - dias);
  
  const serviciosRealizados = [];
  db.clientes.forEach(cliente => {
    cliente.historialServicios.forEach(servicio => {
      if (new Date(servicio.fecha) >= fechaLimite) {
        serviciosRealizados.push(servicio);
      }
    });
  });
  
  const ranking = {};
  serviciosRealizados.forEach(s => {
    if (!ranking[s.servicio]) {
      ranking[s.servicio] = { cantidad: 0, ingresos: 0 };
    }
    ranking[s.servicio].cantidad++;
    ranking[s.servicio].ingresos += s.total || s.precio;
  });
  
  const rankingArray = Object.entries(ranking).sort((a,b) => b[1].cantidad - a[1].cantidad);
  
  let html = "";
  rankingArray.forEach(([nombre, datos], index) => {
    html += `
      <div class="ranking-item">
        <div class="ranking-position">#${index + 1}</div>
        <div class="ranking-name">${nombre}</div>
        <div class="ranking-stats">
          <div>📊 ${datos.cantidad} veces</div>
          <div>💰 $${datos.ingresos.toFixed(2)}</div>
        </div>
      </div>
    `;
  });
  
  document.getElementById("rankingServicios").innerHTML = html || "<p>No hay datos suficientes</p>";
}

// ==================== IMPORTAR/EXPORTAR ====================
function exportarDatos() {
  const dataStr = JSON.stringify(db, null, 2);
  const blob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `barbercontrol_backup_${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  mostrarToast("✅ Datos exportados correctamente", "success");
}

function importarDatos(file) {
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const datosImportados = JSON.parse(e.target.result);
      if (!datosImportados.clientes || !datosImportados.productos) {
        throw new Error("Estructura inválida");
      }
      db = datosImportados;
      guardarDatos();
      renderizarTodo();
      mostrarToast("✅ Datos importados correctamente", "success");
      cerrarModalConfig();
    } catch (error) {
      mostrarToast("❌ Error al importar: archivo inválido", "error");
    }
  };
  reader.readAsText(file);
}

function cargarDatosDemo(mostrarMensaje = true) {
  db = {
    clientes: [
      { id: "1", nombre: "Pedro López", telefono: "12345678", nacimiento: "1990-05-15", email: "pedro@email.com", alergias: "Ninguna", ultimaVisita: "2026-04-15", gastoTotal: 45, historialServicios: [{ fecha: "2026-04-15", servicio: "Corte de pelo", precio: 15, total: 15 }], productosComprados: [] },
      { id: "2", nombre: "Carlos Pérez", telefono: "87654321", nacimiento: "1985-10-20", email: "", alergias: "Alergia a fragancias", ultimaVisita: "2026-04-10", gastoTotal: 30, historialServicios: [{ fecha: "2026-04-10", servicio: "Arreglo de Barba", precio: 12, total: 12 }], productosComprados: [] }
    ],
    citas: [
      { id: "c1", clienteId: "1", servicioId: 1, barberoId: 1, fechaHora: "2026-04-20T10:00", estado: "pendiente", precioServicio: 15, extras: [] }
    ],
    productos: [
      { id: "p1", nombre: "Cera Fijación Fuerte", stock: 10, precioCosto: 5, precioVenta: 12 },
      { id: "p2", nombre: "Champú Anticaspa", stock: 5, precioCosto: 4, precioVenta: 10 },
      { id: "p3", nombre: "Aceite para Barba", stock: 8, precioCosto: 6, precioVenta: 15 }
    ],
    servicios: [
      { id: 1, nombre: "Corte de pelo", duracion: 30, precio: 15 },
      { id: 2, nombre: "Arreglo de Barba", duracion: 20, precio: 12 },
      { id: 3, nombre: "Afeitado Clásico", duracion: 25, precio: 18 },
      { id: 4, nombre: "Tinte", duracion: 60, precio: 35 },
      { id: 5, nombre: "Corte + Barba", duracion: 45, precio: 25 }
    ],
    barberos: [
      { id: 1, nombre: "Juan", comision: 0.5 },
      { id: 2, nombre: "Carlos", comision: 0.5 },
      { id: 3, nombre: "Miguel", comision: 0.5 }
    ],
    ventas: []
  };
  guardarDatos();
  if (mostrarMensaje) {
    mostrarToast("✅ Datos de demostración cargados", "success");
  }
}

function limpiarTodosLosDatos() {
  if (confirm("⚠️ ¿ESTÁS SEGURO? Esto eliminará TODOS los datos (clientes, citas, productos, ventas). Esta acción no se puede deshacer.")) {
    db = {
      clientes: [],
      citas: [],
      productos: [],
      servicios: [
        { id: 1, nombre: "Corte de pelo", duracion: 30, precio: 15 },
        { id: 2, nombre: "Arreglo de Barba", duracion: 20, precio: 12 },
        { id: 3, nombre: "Afeitado Clásico", duracion: 25, precio: 18 },
        { id: 4, nombre: "Tinte", duracion: 60, precio: 35 },
        { id: 5, nombre: "Corte + Barba", duracion: 45, precio: 25 }
      ],
      barberos: [
        { id: 1, nombre: "Juan", comision: 0.5 },
        { id: 2, nombre: "Carlos", comision: 0.5 },
        { id: 3, nombre: "Miguel", comision: 0.5 }
      ],
      ventas: []
    };
    guardarDatos();
    renderizarTodo();
    mostrarToast("🗑️ Todos los datos han sido eliminados", "warning");
  }
}

// ==================== RENDERIZADO ====================
function renderizarListaClientes(filtro = "") {
  const container = document.getElementById("listaClientes");
  if (!container) return;
  
  let clientesFiltrados = db.clientes;
  if (filtro) {
    clientesFiltrados = db.clientes.filter(c => 
      c.nombre.toLowerCase().includes(filtro.toLowerCase()) || 
      c.telefono.includes(filtro)
    );
  }
  
  container.innerHTML = clientesFiltrados.map(c => `
    <div class="card" onclick="verFichaCliente('${c.id}')">
      <div class="card-header">
        <div class="card-title">${c.nombre}</div>
        <div class="card-badge">📞 ${c.telefono}</div>
      </div>
      <div class="card-content">
        🕒 Última visita: ${c.ultimaVisita || "Ninguna"}<br>
        💰 Gasto total: $${c.gastoTotal}
      </div>
    </div>
  `).join('');
  
  if (clientesFiltrados.length === 0) {
    container.innerHTML = '<div class="card" style="text-align: center;">No hay clientes registrados</div>';
  }
}

function renderizarCitas(filtro = "todas") {
  const container = document.getElementById("listaCitas");
  if (!container) return;
  
  let citasFiltradas = db.citas;
  if (filtro !== "todas") {
    citasFiltradas = db.citas.filter(c => c.estado === filtro);
  }
  
  citasFiltradas.sort((a,b) => new Date(b.fechaHora) - new Date(a.fechaHora));
  
  container.innerHTML = citasFiltradas.map(c => {
    const cliente = db.clientes.find(cl => cl.id == c.clienteId);
    const servicio = db.servicios.find(s => s.id == c.servicioId);
    const barbero = db.barberos.find(b => b.id == c.barberoId);
    const estadoClass = c.estado === "pendiente" ? "pendiente" : "finalizada";
    const estadoTexto = c.estado === "pendiente" ? "⏳ Pendiente" : "✅ Finalizada";
    
    return `
      <div class="card">
        <div class="card-header">
          <div class="card-title">${cliente?.nombre || "?"}</div>
          <div class="card-badge ${estadoClass}">${estadoTexto}</div>
        </div>
        <div class="card-content">
          ✂️ ${servicio?.nombre}<br>
          👤 ${barbero?.nombre}<br>
          📅 ${new Date(c.fechaHora).toLocaleString()}<br>
          💰 $${c.totalPagado || c.precioServicio}
        </div>
        ${c.estado === "pendiente" ? `
          <div class="card-actions">
            <button class="btn-success" onclick="abrirFinalizarCita('${c.id}')">✅ Finalizar</button>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
  
  if (citasFiltradas.length === 0) {
    container.innerHTML = '<div class="card" style="text-align: center;">No hay citas</div>';
  }
}

function renderizarInventario() {
  const container = document.getElementById("listaProductos");
  if (!container) return;
  
  container.innerHTML = db.productos.map(p => `
    <div class="card">
      <div class="card-header">
        <div class="card-title">${p.nombre}</div>
        <div class="card-badge">Stock: ${p.stock}</div>
      </div>
      <div class="card-content">
        💰 Costo: $${p.precioCosto} | Venta: $${p.precioVenta}<br>
        📈 Margen: $${(p.precioVenta - p.precioCosto).toFixed(2)} por unidad
      </div>
      <div class="card-actions">
        <button class="btn-success" onclick="abrirVentaDirecta('${p.id}')">💰 Vender</button>
      </div>
    </div>
  `).join('');
  
  if (db.productos.length === 0) {
    container.innerHTML = '<div class="card" style="text-align: center;">No hay productos registrados</div>';
  }
}

function renderizarTodo() {
  renderizarListaClientes();
  renderizarCitas();
  renderizarInventario();
  const hoy = new Date().toISOString().split('T')[0];
  document.getElementById("fechaReporte").value = hoy;
  mostrarResumenDia(hoy);
  mostrarRankingServicios(30);
}

// ==================== MODALES ====================
function mostrarModalPersonalizado(titulo, contenido) {
  const modal = document.createElement("div");
  modal.className = "modal";
  modal.innerHTML = `
    <div class="modal-content modal-medium">
      <div class="modal-header">
        <h2>${titulo}</h2>
        <button class="modal-close">&times;</button>
      </div>
      <div class="modal-body">
        ${contenido.innerHTML}
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  modal.querySelector(".modal-close").onclick = () => modal.remove();
  modal.onclick = (e) => { if(e.target === modal) modal.remove(); };
}

function cerrarModalFinalizar() {
  document.getElementById("modalFinalizar").classList.add("hidden");
  currentCitaId = null;
}

function cerrarModalConfig() {
  document.getElementById("modalConfig").classList.add("hidden");
}

function abrirVentaDirecta(productoId) {
  const producto = db.productos.find(p => p.id == productoId);
  if (!producto) return;
  
  const select = document.getElementById("ventaProducto");
  select.innerHTML = `<option value="${producto.id}">${producto.nombre} - $${producto.precioVenta}</option>`;
  document.getElementById("ventaCantidad").value = 1;
  document.getElementById("ventaInfo").innerHTML = `Stock disponible: ${producto.stock}`;
  document.getElementById("modalVentaDirecta").classList.remove("hidden");
  
  document.getElementById("confirmarVenta").onclick = () => {
    const cantidad = parseInt(document.getElementById("ventaCantidad").value);
    if (ventaDirecta(productoId, cantidad)) {
      document.getElementById("modalVentaDirecta").classList.add("hidden");
    }
  };
}

// ==================== EVENTOS E INICIALIZACIÓN ====================
function initEventos() {
  // Tabs
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const tabId = btn.dataset.tab;
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach(t => t.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(tabId).classList.add("active");
    });
  });
  
  // Búsqueda clientes
  document.getElementById("searchCliente")?.addEventListener("input", (e) => {
    renderizarListaClientes(e.target.value);
  });
  
  // Filtros citas
  document.querySelectorAll(".filter-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      renderizarCitas(btn.dataset.filter);
    });
  });
  
  // Ranking filters
  document.querySelectorAll("[data-ranking-mes]").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("[data-ranking-mes]").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      mostrarRankingServicios(parseInt(btn.dataset.rankingMes));
    });
  });
  
  // Formulario cliente
  document.getElementById("formCliente")?.addEventListener("submit", (e) => {
    e.preventDefault();
    registrarCliente(
      document.getElementById("clienteNombre").value,
      document.getElementById("clienteTelefono").value,
      document.getElementById("clienteNacimiento").value,
      document.getElementById("clienteEmail").value,
      document.getElementById("clienteAlergias").value
    );
    document.getElementById("modalCliente").classList.add("hidden");
    e.target.reset();
  });
  
  // Formulario cita
  document.getElementById("formCita")?.addEventListener("submit", (e) => {
    e.preventDefault();
    crearCita(
      document.getElementById("citaCliente").value,
      parseInt(document.getElementById("citaServicio").value),
      parseInt(document.getElementById("citaBarbero").value),
      document.getElementById("citaFechaHora").value
    );
    document.getElementById("modalCita").classList.add("hidden");
  });
  
  // Formulario producto
  document.getElementById("formProducto")?.addEventListener("submit", (e) => {
    e.preventDefault();
    registrarProducto(
      document.getElementById("productoNombre").value,
      document.getElementById("productoStock").value,
      document.getElementById("productoCosto").value,
      document.getElementById("productoVenta").value
    );
    document.getElementById("modalProducto").classList.add("hidden");
    e.target.reset();
  });
  
  // Finalizar cita
  document.getElementById("formFinalizar")?.addEventListener("submit", (e) => {
    e.preventDefault();
    finalizarCita(document.getElementById("pagoMetodo").value);
  });
  
  // Actualizar total en finalizar
  document.querySelectorAll(".extra, .producto-extra").forEach(el => {
    el?.addEventListener("change", () => calcularTotalFinalizar());
  });
  
  // Reportes
  document.getElementById("btnVerResumen")?.addEventListener("click", () => {
    const fecha = document.getElementById("fechaReporte").value;
    mostrarResumenDia(fecha);
  });
  
  // Configuración
  document.getElementById("btnConfig")?.addEventListener("click", () => {
    document.getElementById("modalConfig").classList.remove("hidden");
    actualizarTamañoDB();
  });
  
  document.getElementById("btnExportar")?.addEventListener("click", exportarDatos);
  document.getElementById("btnImportar")?.addEventListener("click", () => {
    document.getElementById("fileImportar").click();
  });
  document.getElementById("btnCargarDemo")?.addEventListener("click", () => cargarDatosDemo(true));
  document.getElementById("btnLimpiarTodo")?.addEventListener("click", limpiarTodosLosDatos);
  
  document.getElementById("fileImportar")?.addEventListener("change", (e) => {
    if (e.target.files && e.target.files[0]) {
      importarDatos(e.target.files[0]);
    }
  });
  
  // Botones modales
  document.getElementById("btnNuevoCliente")?.addEventListener("click", () => {
    document.getElementById("modalClienteTitle").textContent = "📝 Registrar Cliente";
    document.getElementById("formCliente").reset();
    document.getElementById("modalCliente").classList.remove("hidden");
  });
  
  document.getElementById("btnNuevaCita")?.addEventListener("click", () => {
    const clienteSelect = document.getElementById("citaCliente");
    clienteSelect.innerHTML = '<option value="">Seleccionar cliente...</option>' + 
      db.clientes.map(c => `<option value="${c.id}">${c.nombre} - ${c.telefono}</option>`).join('');
    
    const servicioSelect = document.getElementById("citaServicio");
    servicioSelect.innerHTML = '<option value="">Seleccionar servicio...</option>' + 
      db.servicios.map(s => `<option value="${s.id}">${s.nombre} - $${s.precio} (${s.duracion} min)</option>`).join('');
    
    const barberoSelect = document.getElementById("citaBarbero");
    barberoSelect.innerHTML = '<option value="">Seleccionar barbero...</option>' + 
      db.barberos.map(b => `<option value="${b.id}">${b.nombre}</option>`).join('');
    
    document.getElementById("modalCita").classList.remove("hidden");
  });
  
  document.getElementById("btnNuevoProducto")?.addEventListener("click", () => {
    document.getElementById("formProducto").reset();
    document.getElementById("modalProducto").classList.remove("hidden");
  });
  
  document.getElementById("btnVentaDirecta")?.addEventListener("click", () => {
    const select = document.getElementById("ventaProducto");
    select.innerHTML = '<option value="">Seleccionar producto...</option>' + 
      db.productos.map(p => `<option value="${p.id}">${p.nombre} - $${p.precioVenta} (Stock: ${p.stock})</option>`).join('');
    document.getElementById("modalVentaDirecta").classList.remove("hidden");
    
    document.getElementById("confirmarVenta").onclick = () => {
      const productoId = document.getElementById("ventaProducto").value;
      const cantidad = parseInt(document.getElementById("ventaCantidad").value);
      if (productoId && ventaDirecta(productoId, cantidad)) {
        document.getElementById("modalVentaDirecta").classList.add("hidden");
      }
    };
  });
  
  // Cerrar modales
  document.querySelectorAll(".modal-close").forEach(btn => {
    btn.addEventListener("click", () => {
      btn.closest(".modal").classList.add("hidden");
    });
  });
  
  document.getElementById("cancelarCliente")?.addEventListener("click", () => {
    document.getElementById("modalCliente").classList.add("hidden");
  });
  
  document.getElementById("cancelarCita")?.addEventListener("click", () => {
    document.getElementById("modalCita").classList.add("hidden");
  });
  
  document.getElementById("cancelarProducto")?.addEventListener("click", () => {
    document.getElementById("modalProducto").classList.add("hidden");
  });
  
  document.getElementById("cancelarFinalizar")?.addEventListener("click", cerrarModalFinalizar);
  document.getElementById("cancelarVenta")?.addEventListener("click", () => {
    document.getElementById("modalVentaDirecta").classList.add("hidden");
  });
  
  // Margen producto
  document.getElementById("productoVenta")?.addEventListener("input", () => {
    const costo = parseFloat(document.getElementById("productoCosto").value) || 0;
    const venta = parseFloat(document.getElementById("productoVenta").value) || 0;
    document.getElementById("productoMargen").innerHTML = `Margen de ganancia: $${(venta - costo).toFixed(2)}`;
  });
  
  document.getElementById("productoCosto")?.addEventListener("input", () => {
    const costo = parseFloat(document.getElementById("productoCosto").value) || 0;
    const venta = parseFloat(document.getElementById("productoVenta").value) || 0;
    document.getElementById("productoMargen").innerHTML = `Margen de ganancia: $${(venta - costo).toFixed(2)}`;
  });
  
  // Info cita
  document.getElementById("citaServicio")?.addEventListener("change", (e) => {
    const servicio = db.servicios.find(s => s.id == parseInt(e.target.value));
    if (servicio) {
      document.getElementById("citaInfo").innerHTML = `
        <p>💰 Precio: <strong>$${servicio.precio}</strong></p>
        <p>⏱️ Duración: <strong>${servicio.duracion} min</strong></p>
      `;
    }
  });
}

function actualizarTamañoDB() {
  const dataStr = JSON.stringify(db);
  const tamañoKB = (dataStr.length / 1024).toFixed(2);
  const elemento = document.getElementById("dbSize");
  if (elemento) {
    elemento.innerHTML = `📦 ${tamañoKB} KB<br>👥 ${db.clientes.length} clientes<br>📦 ${db.productos.length} productos<br>📅 ${db.citas.filter(c => c.estado === "pendiente").length} citas pendientes`;
  }
}

// Inicialización
cargarDatos();
initEventos();

// Exponer funciones globales
window.verFichaCliente = verFichaCliente;
window.abrirFinalizarCita = abrirFinalizarCita;
window.abrirVentaDirecta = abrirVentaDirecta;
window.calcularTotalFinalizar = calcularTotalFinalizar;
window.cerrarModalFinalizar = cerrarModalFinalizar;
window.cerrarModalConfig = cerrarModalConfig;