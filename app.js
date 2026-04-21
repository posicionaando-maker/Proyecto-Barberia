// ==================== ESTRUCTURA DE DATOS INICIAL (JSON) ====================
let db = {
  clientes: [],
  citas: [],
  productos: [],
  servicios: [
    { id: 1, nombre: "Corte de pelo", duracion: 30, precio: 15 },
    { id: 2, nombre: "Arreglo de Barba", duracion: 20, precio: 12 },
    { id: 3, nombre: "Afeitado Clásico", duracion: 25, precio: 18 },
    { id: 4, nombre: "Tinte", duracion: 60, precio: 35 }
  ],
  barberos: [
    { id: 1, nombre: "Juan", comision: 0.5 },
    { id: 2, nombre: "Carlos", comision: 0.5 }
  ],
  ventas: [] // ventas directas + servicios finalizados
};

// Cargar datos desde localStorage (JSON)
function cargarDatos() {
  const data = localStorage.getItem("barbercontrol_db");
  if (data) {
    db = JSON.parse(data);
  } else {
    // Datos demo
    db.clientes = [
      { id: "1", nombre: "Pedro López", telefono: "12345678", nacimiento: "", email: "", alergias: "", ultimaVisita: "2026-04-15", gastoTotal: 45, historialServicios: [{ fecha: "2026-04-15", servicio: "Corte de pelo", precio: 15 }], productosComprados: [] }
    ];
    db.productos = [
      { id: "p1", nombre: "Cera Fijación Fuerte", stock: 10, precioCosto: 5, precioVenta: 12 },
      { id: "p2", nombre: "Champú Anticaspa", stock: 5, precioCosto: 4, precioVenta: 10 }
    ];
    db.citas = [];
    db.ventas = [];
    guardarDatos();
  }
  renderizarTodo();
}

function guardarDatos() {
  localStorage.setItem("barbercontrol_db", JSON.stringify(db));
}

// ==================== CLIENTES ====================
function registrarCliente(nombre, telefono, nacimiento, email, alergias) {
  if (db.clientes.find(c => c.telefono === telefono)) {
    alert("⚠️ Teléfono ya registrado. Mostrando ficha existente.");
    verFichaCliente(telefono);
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
  return true;
}

function verFichaCliente(telefono) {
  const cliente = db.clientes.find(c => c.telefono === telefono);
  if (!cliente) return;
  const historialHtml = cliente.historialServicios.map(s => `<li>${s.fecha} - ${s.servicio} - $${s.precio}</li>`).join('');
  const frecuencia = calcularFrecuenciaMedia(cliente.historialServicios);
  alert(`📇 ${cliente.nombre}\n📞 ${cliente.telefono}\n🕒 Última visita: ${cliente.ultimaVisita || "Ninguna"}\n📈 Frecuencia: ${frecuencia}\n💰 Gasto total: $${cliente.gastoTotal}\n✂️ Historial:\n${historialHtml}`);
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
  const barbero = db.barberos.find(b => b.id == barberoId);
  // Validar solapamiento
  const ocupado = db.citas.some(c => c.barberoId == barberoId && c.fechaHora === fechaHora);
  if (ocupado) {
    alert("⚠️ Horario ya ocupado para este barbero");
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
  return true;
}

function finalizarCita(citaId, extras = [], productosVendidos = [], metodoPago = "efectivo") {
  const cita = db.citas.find(c => c.id == citaId);
  if (!cita || cita.estado === "finalizada") return;
  const cliente = db.clientes.find(cl => cl.id == cita.clienteId);
  const servicio = db.servicios.find(s => s.id == cita.servicioId);
  let totalExtras = extras.reduce((sum, e) => sum + e.precio, 0);
  let totalProductos = 0;
  
  productosVendidos.forEach(pv => {
    const prod = db.productos.find(p => p.id == pv.id);
    if (prod && prod.stock >= pv.cantidad) {
      prod.stock -= pv.cantidad;
      totalProductos += prod.precioVenta * pv.cantidad;
      cliente.productosComprados.push({ nombre: prod.nombre, cantidad: pv.cantidad, fecha: new Date().toISOString() });
    }
  });
  
  const total = servicio.precio + totalExtras + totalProductos;
  const comisionBarbero = servicio.precio * (db.barberos.find(b => b.id == cita.barberoId).comision);
  
  cita.estado = "finalizada";
  cita.totalPagado = total;
  cita.metodoPago = metodoPago;
  cita.fechaFinalizacion = new Date().toISOString();
  
  cliente.ultimaVisita = new Date().toISOString().split('T')[0];
  cliente.gastoTotal += total;
  cliente.historialServicios.push({
    fecha: new Date().toISOString(),
    servicio: servicio.nombre,
    precio: servicio.precio,
    extras: totalExtras,
    total
  });
  
  db.ventas.push({
    tipo: "cita",
    fecha: new Date().toISOString(),
    total, metodoPago, comisionBarbero, barberoId: cita.barberoId
  });
  
  guardarDatos();
  renderizarCitas();
  alert(`✅ Cita finalizada. Total: $${total} | Comisión barbero: $${comisionBarbero}`);
}

// ==================== PRODUCTOS ====================
function registrarProducto(nombre, stock, precioCosto, precioVenta) {
  db.productos.push({
    id: Date.now().toString(),
    nombre, stock, precioCosto, precioVenta
  });
  guardarDatos();
  renderizarInventario();
}

function ventaDirecta(productoId, cantidad) {
  const prod = db.productos.find(p => p.id == productoId);
  if (!prod || prod.stock < cantidad) {
    alert("Stock insuficiente");
    return false;
  }
  prod.stock -= cantidad;
  const total = prod.precioVenta * cantidad;
  db.ventas.push({
    tipo: "venta_directa",
    fecha: new Date().toISOString(),
    total, metodoPago: "efectivo",
    productos: [{ nombre: prod.nombre, cantidad, precioUnitario: prod.precioVenta }]
  });
  guardarDatos();
  alert(`💰 Venta realizada: $${total}. Ticket generado.`);
  renderizarInventario();
  return true;
}

// ==================== REPORTES ====================
function resumenDia(fecha) {
  const ventasDelDia = db.ventas.filter(v => v.fecha.split('T')[0] === fecha);
  const totalFacturado = ventasDelDia.reduce((sum, v) => sum + v.total, 0);
  const efectivo = ventasDelDia.filter(v => v.metodoPago === "efectivo").reduce((sum, v) => sum + v.total, 0);
  const tarjeta = ventasDelDia.filter(v => v.metodoPago === "tarjeta").reduce((sum, v) => sum + v.total, 0);
  const comisiones = ventasDelDia.reduce((sum, v) => sum + (v.comisionBarbero || 0), 0);
  const costoProductos = 0; // Simplificado
  const beneficioNeto = totalFacturado - comisiones - costoProductos;
  
  return { totalFacturado, efectivo, tarjeta, comisiones, beneficioNeto };
}

function rankingServicios(mes = 30) {
  const hoy = new Date();
  const haceUnMes = new Date(); haceUnMes.setDate(hoy.getDate() - mes);
  const serviciosRealizados = db.clientes.flatMap(c => 
    c.historialServicios.filter(s => new Date(s.fecha) >= haceUnMes)
  );
  const ranking = {};
  serviciosRealizados.forEach(s => {
    ranking[s.servicio] = ranking[s.servicio] || { cantidad: 0, ingresos: 0 };
    ranking[s.servicio].cantidad++;
    ranking[s.servicio].ingresos += s.precio;
  });
  return Object.entries(ranking).sort((a,b) => b[1].cantidad - a[1].cantidad);
}

// ==================== RENDERIZADO UI ====================
function renderizarListaClientes() {
  const container = document.getElementById("listaClientes");
  if (!container) return;
  container.innerHTML = db.clientes.map(c => `
    <div class="card" onclick="verFichaCliente('${c.telefono}')">
      <strong>${c.nombre}</strong><br>
      📞 ${c.telefono} | Última visita: ${c.ultimaVisita || "—"}
    </div>
  `).join('');
}

function renderizarCitas() {
  const container = document.getElementById("listaCitas");
  if (!container) return;
  container.innerHTML = db.citas.map(c => {
    const cliente = db.clientes.find(cl => cl.id == c.clienteId);
    const servicio = db.servicios.find(s => s.id == c.servicioId);
    return `
      <div class="card">
        <strong>${cliente?.nombre || "?"}</strong> - ${servicio?.nombre}<br>
        📅 ${c.fechaHora} | Estado: ${c.estado}
        ${c.estado === "pendiente" ? `<button onclick="finalizarCita('${c.id}', [], [], 'efectivo')">✅ Finalizar</button>` : ""}
      </div>
    `;
  }).join('');
}

function renderizarInventario() {
  const container = document.getElementById("listaProductos");
  if (!container) return;
  container.innerHTML = db.productos.map(p => `
    <div class="card">
      <strong>${p.nombre}</strong><br>
      Stock: ${p.stock} | Venta: $${p.precioVenta}
      <button onclick="ventaDirecta('${p.id}', 1)">Vender 1</button>
    </div>
  `).join('');
}

function renderizarTodo() {
  renderizarListaClientes();
  renderizarCitas();
  renderizarInventario();
}

// Inicialización
cargarDatos();
// Inicialización
initConfiguracion();  // <--- NUEVA LÍNEA
window.registrarCliente = registrarCliente;
window.verFichaCliente = verFichaCliente;
window.crearCita = crearCita;
window.finalizarCita = finalizarCita;
window.ventaDirecta = ventaDirecta;
window.registrarProducto = registrarProducto;
// Inicialización
cargarDatos();
// ==================== IMPORTAR / EXPORTAR DATOS ====================
function exportarDatos() {
  try {
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
    alert("✅ Datos exportados correctamente");
  } catch (error) {
    alert("❌ Error al exportar: " + error.message);
  }
}

function importarDatos(file) {
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const datosImportados = JSON.parse(e.target.result);
      
      // Validar estructura mínima
      if (!datosImportados.clientes || !datosImportados.productos || !datosImportados.servicios) {
        throw new Error("El archivo no tiene la estructura válida de BarberControl");
      }
      
      // Reemplazar la base de datos completa
      db = datosImportados;
      guardarDatos();
      renderizarTodo();
      alert("✅ Datos importados correctamente. Recarga la vista si es necesario.");
      cerrarModalConfig();
      actualizarTamañoDB();
    } catch (error) {
      alert("❌ Error al importar: " + error.message);
    }
  };
  reader.onerror = function() {
    alert("❌ Error al leer el archivo");
  };
  reader.readAsText(file);
}

function cargarDatosDemo() {
  if (confirm("⚠️ ¿Estás seguro? Esto borrará TODOS tus datos actuales y cargará datos de ejemplo.")) {
    db = {
      clientes: [
        { id: "1", nombre: "Pedro López", telefono: "12345678", nacimiento: "1990-05-15", email: "pedro@email.com", alergias: "Ninguna", ultimaVisita: "2026-04-15", gastoTotal: 45, historialServicios: [{ fecha: "2026-04-15", servicio: "Corte de pelo", precio: 15 }], productosComprados: [] },
        { id: "2", nombre: "Carlos Pérez", telefono: "87654321", nacimiento: "1985-10-20", email: "", alergias: "Alergia a fragancias fuertes", ultimaVisita: "2026-04-10", gastoTotal: 30, historialServicios: [{ fecha: "2026-04-10", servicio: "Arreglo de Barba", precio: 12 }], productosComprados: [] }
      ],
      citas: [
        { id: "c1", clienteId: "1", servicioId: 1, barberoId: 1, fechaHora: "2026-04-20 10:00", estado: "pendiente", precioServicio: 15, extras: [] }
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
        { id: 4, nombre: "Tinte", duracion: 60, precio: 35 }
      ],
      barberos: [
        { id: 1, nombre: "Juan", comision: 0.5 },
        { id: 2, nombre: "Carlos", comision: 0.5 }
      ],
      ventas: []
    };
    guardarDatos();
    renderizarTodo();
    alert("✅ Datos de demostración cargados");
    cerrarModalConfig();
    actualizarTamañoDB();
  }
}

function actualizarTamañoDB() {
  try {
    const dataStr = JSON.stringify(db);
    const tamañoKB = (dataStr.length / 1024).toFixed(2);
    const elemento = document.getElementById("dbSize");
    if (elemento) {
      elemento.textContent = `📦 ${tamañoKB} KB (${db.clientes.length} clientes, ${db.productos.length} productos, ${db.citas.length} citas activas)`;
    }
  } catch (error) {
    console.error("Error al calcular tamaño:", error);
  }
}

// Control del modal de configuración
function abrirModalConfig() {
  const modal = document.getElementById("modalConfig");
  if (modal) {
    modal.classList.remove("hidden");
    actualizarTamañoDB();
  }
}

function cerrarModalConfig() {
  const modal = document.getElementById("modalConfig");
  if (modal) {
    modal.classList.add("hidden");
  }
}

// Inicializar eventos de configuración
function initConfiguracion() {
  const btnConfig = document.getElementById("btnConfig");
  const closeBtn = document.querySelector(".close-config");
  const btnExportar = document.getElementById("btnExportar");
  const btnImportar = document.getElementById("btnImportar");
  const btnCargarDemo = document.getElementById("btnCargarDemo");
  const fileInput = document.getElementById("fileImportar");
  const modal = document.getElementById("modalConfig");
  
  if (btnConfig) {
    btnConfig.onclick = abrirModalConfig;
  }
  
  if (closeBtn) {
    closeBtn.onclick = cerrarModalConfig;
  }
  
  if (modal) {
    modal.onclick = function(e) {
      if (e.target === modal) cerrarModalConfig();
    };
  }
  
  if (btnExportar) {
    btnExportar.onclick = exportarDatos;
  }
  
  if (btnImportar) {
    btnImportar.onclick = () => fileInput.click();
  }
  
  if (fileInput) {
    fileInput.onchange = (e) => {
      if (e.target.files && e.target.files[0]) {
        importarDatos(e.target.files[0]);
        fileInput.value = ""; // Limpiar para permitir importar el mismo archivo nuevamente
      }
    };
    
    // Mostrar advertencia al hacer hover
    btnImportar.addEventListener("mouseenter", () => {
      const warning = document.getElementById("importWarning");
      if (warning) warning.classList.remove("hidden");
    });
    
    btnImportar.addEventListener("mouseleave", () => {
      const warning = document.getElementById("importWarning");
      if (warning) warning.classList.add("hidden");
    });
  }
  
  if (btnCargarDemo) {
    btnCargarDemo.onclick = cargarDatosDemo;
  }
}
initConfiguracion();  // <--- NUEVA LÍNEA