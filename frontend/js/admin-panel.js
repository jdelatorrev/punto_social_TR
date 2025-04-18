// admin-panel.js - PARTE 1: inicialización y utilidades

const token = localStorage.getItem("token");
let datosReporte = [];
let listaComercios = [];
let listaGrupos = [];
let vendedoresGlobal = [];
let cuponesPorGrupo = {};
let paginaActual = {};

function cerrarSesion() {
  localStorage.removeItem("token");
  window.location.href = "ingresa.html";
}

function verificarTokenValido() {
  if (!token) window.location.href = "ingresa.html";
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (payload.exp < Math.floor(Date.now() / 1000)) {
      alert("Sesión expirada");
      localStorage.removeItem("token");
      window.location.href = "ingresa.html";
    }
    document.getElementById("usuarioNombre").textContent = payload.nombre;
    return payload;
  } catch (err) {
    localStorage.removeItem("token");
    window.location.href = "ingresa.html";
  }
}

function formatearFecha(fechaISO) {
  if (!fechaISO) return '-';
  const fecha = new Date(fechaISO);
  const dia = String(fecha.getDate()).padStart(2, '0');
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const año = fecha.getFullYear();
  return `${dia}-${mes}-${año}`;
}
function habilitarEdicion(id) {
    const row = document.querySelector(`tr[data-id='${id}']`);
    row.querySelectorAll("span").forEach(el => el.style.display = "none");
    row.querySelectorAll(".edit-input").forEach(el => el.style.display = "inline-block");
    row.querySelector(".guardar-btn").style.display = "inline-block";
    row.querySelector(".cancelar-btn").style.display = "inline-block";
  }
  
  function cancelarEdicion(id) {
    const row = document.querySelector(`tr[data-id='${id}']`);
    row.querySelectorAll("span").forEach(el => el.style.display = "inline");
    row.querySelectorAll(".edit-input").forEach(el => el.style.display = "none");
    row.querySelector(".guardar-btn").style.display = "none";
    row.querySelector(".cancelar-btn").style.display = "none";
  }
  
  function guardarEdicion(id) {
    const row = document.querySelector(`tr[data-id='${id}']`);
    const inputs = row.querySelectorAll(".edit-input");
  
    const titulo = inputs[0].value.trim();
    const descripcion = inputs[1].value.trim();
    const descuento = inputs[2].value.trim();
    const comercio_id = inputs[3].value;
    const grupo_id = row.querySelector(".grupo-edit").value;
    const grupo_descripcion = row.querySelector(".grupo-descripcion-edit").value;
  
    if (!titulo || !descripcion || !descuento || !comercio_id || !grupo_id) {
      alert("Todos los campos son obligatorios.");
      return;
    }
  
    const datos = {
      titulo,
      descripcion,
      descuento,
      comercio_id,
      grupo_id
    };
  
    fetch(`${API}/api/admin/cupones/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token
      },
      body: JSON.stringify(datos)
    })
      .then(res => res.json())
      .then(async data => {
        if (data.message) {
          if (grupo_descripcion.trim() !== "") {
            await fetch(`${API}/api/admin/grupos/${grupo_id}`, {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
                Authorization: "Bearer " + token
              },
              body: JSON.stringify({ descripcion: grupo_descripcion })
            });
          }
  
          alert("✅ Cupón actualizado correctamente");
          cargarCuponesAdmin();
        } else {
          alert("❌ " + (data.error || "Error al actualizar"));
        }
      })
      .catch(err => {
        console.error(err);
        alert("⛔ Error de conexión");
      });
  }
  
  function cargarFiltroComercios(data) {
    const select = document.getElementById("filtroComercio");
    const comerciosUnicos = [...new Set(data.map(row => row.comercio))];
    comerciosUnicos.forEach(comercio => {
      const option = document.createElement("option");
      option.value = comercio;
      option.textContent = comercio;
      select.appendChild(option);
    });
  }
  
  function renderTabla(data) {
    const tbody = document.querySelector("#tabla-reporte tbody");
    tbody.innerHTML = "";
  
    data.forEach(row => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${row.cliente}</td>
        <td>${row.cupon}</td>
        <td>${row.comercio}</td>
        <td>${row.descuento}</td>
        <td>
          ${row.utilizado 
            ? `✅ <button class="habilitar-btn" onclick="habilitarCupon(${row.id})">Habilitar</button>` 
            : `❌ <button class="habilitar-btn" onclick="marcarUtilizado(${row.id})">Marcar como usado</button>`}
        </td>
        <td>${formatearFecha(row.fecha_compra)}</td>
        <td>
          <input type="text" value="${row.telefono || ''}" 
            onchange="actualizarTelefonoCliente('${row.cliente}', '${row.telefono}', this.value)" />
        </td>
        <td>
          <select onchange="asignarVendedorCliente('${row.cliente}', this.value)">
            <option value="">-- Ninguno --</option>
            ${vendedoresGlobal
              .filter(v => v.activo)
              .map(v => `
                <option value="${v.id}" ${v.nombre === row.vendedor ? 'selected' : ''}>
                  ${v.nombre}
                </option>
              `).join('')}
          </select>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }
  
  async function habilitarCupon(id) {
    if (!confirm("¿Habilitar nuevamente este cupón como disponible?")) return;
  
    try {
      const res = await fetch(`${API}/api/admin/habilitar-cupon/${id}`, {
        method: "POST",
        headers: { Authorization: "Bearer " + token }
      });
  
      const data = await res.json();
  
      if (res.ok) {
        alert("✅ Cupón habilitado correctamente.");
        cargarReporte();
      } else {
        alert("⚠️ " + (data.error || "Error al habilitar cupón."));
      }
    } catch (err) {
      alert("⛔ Error de conexión con el servidor.");
      console.error(err);
    }
  }
  
  async function marcarUtilizado(id) {
    try {
      const res = await fetch(`${API}/api/admin/marcar-utilizado/${id}`, {
        method: "POST",
        headers: { Authorization: "Bearer " + token }
      });
  
      const contentType = res.headers.get("content-type");
      const textoPlano = await res.text();
      console.log("📦 Respuesta cruda:", textoPlano);
  
      if (!contentType || !contentType.includes("application/json")) {
        alert("⚠️ Error inesperado del servidor:\n" + textoPlano);
        return;
      }
  
      const data = JSON.parse(textoPlano);
      if (res.ok) {
        alert("✅ Cupón marcado como utilizado");
        cargarReporte();
      } else {
        alert("⚠️ " + (data.error || "Error al marcar cupón"));
      }
  
    } catch (err) {
      console.error("⛔ Error al marcar como utilizado:", err);
      alert("⛔ Error al marcar como utilizado: " + err);
    }
  }
  function filtrarCupones() {
    const estado = document.getElementById("filtroEstado").value;
    const comercioSeleccionado = document.getElementById("filtroComercio").value;
    const textoBusqueda = document.getElementById("busqueda")?.value.toLowerCase() || "";
  
    const filtrados = datosReporte.filter(row => {
      const coincideEstado =
        estado === "todos" ||
        (estado === "usados" && row.utilizado) ||
        (estado === "no_usados" && !row.utilizado);
  
      const coincideComercio =
        comercioSeleccionado === "todos" || row.comercio === comercioSeleccionado;
  
      const coincideBusqueda =
        row.cliente.toLowerCase().includes(textoBusqueda) ||
        row.cupon.toLowerCase().includes(textoBusqueda);
  
      return coincideEstado && coincideComercio && coincideBusqueda;
    });
  
    renderTabla(filtrados);
  }
  
  async function cargarReporte() {
    try {
      if (!vendedoresGlobal.length) await cargarVendedoresAdmin();
  
      const res = await fetch(`${API}/api/admin/reporte-cupones`, {
        headers: { Authorization: "Bearer " + token }
      });
  
      if (!res.ok) throw new Error("Error de servidor");
  
      const data = await res.json();
      datosReporte = data;
      cargarFiltroComercios(data);
      renderTabla(data);
    } catch (error) {
      console.error("Error al cargar el reporte:", error);
      alert("Error al cargar los datos del servidor.");
    }
  }
  
  function exportarExcel() {
    if (!datosReporte.length) {
      alert("No hay datos para exportar.");
      return;
    }
  
    const dataExcel = datosReporte.map(row => ({
      Cliente: row.cliente,
      Cupón: row.cupon,
      Comercio: row.comercio,
      Descuento: row.descuento,
      Usado: row.utilizado ? 'Sí' : 'No',
      "Fecha de compra": formatearFecha(row.fecha_compra)
    }));
  
    const worksheet = XLSX.utils.json_to_sheet(dataExcel);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Reporte Cupones");
    XLSX.writeFile(workbook, "reporte-cupones.xlsx");
  }
  
  const payload = verificarTokenValido();
  if (payload && payload.tipo === "admin") {
    cargarComercios().then(() => {
      cargarGrupos().then(() => {
        cargarVendedoresGlobal().then(() => {
          mostrarVendedoresTabla();
          cargarCuponesAdmin();
          cargarReporte();
        });
      });
    });
  }
  function cargarCuponesAdmin() {
    fetch(`${API}/api/admin/cupones`, {
      headers: { Authorization: "Bearer " + token }
    })
      .then(res => res.json())
      .then(cupones => {
        const tbody = document.querySelector("#tabla-cupones-admin tbody");
        tbody.innerHTML = "";
        cupones.forEach(c => {
          const grupo = listaGrupos.find(g => g.id === c.grupo_id) || {};
          const tr = document.createElement("tr");
          tr.setAttribute("data-id", c.id);
          tr.innerHTML = `
            <td><span>${c.titulo}</span><input type="text" class="edit-input" style="display:none" value="${c.titulo}" /></td>
            <td><span>${c.descripcion || ''}</span><input type="text" class="edit-input" style="display:none" value="${c.descripcion || ''}" /></td>
            <td><span>${c.descuento}</span><input type="text" class="edit-input" style="display:none" value="${c.descuento}" /></td>
            <td>${formatearFecha(grupo.fecha_inicio)}</td>
            <td>${formatearFecha(grupo.fecha_fin)}</td>
            <td>
              <span>${c.comercio}</span>
              <select class="edit-input" style="display:none">
                ${listaComercios.map(com => `
                  <option value="${com.id}" ${com.nombre === c.comercio ? "selected" : ""}>${com.nombre}</option>
                `).join("")}
              </select>
            </td>
            <td>
              <span>${c.grupo}</span>
              <select class="edit-input grupo-edit" style="display:none">
                ${listaGrupos.map(g => `
                  <option value="${g.id}" ${g.id === c.grupo_id ? 'selected' : ''}>${g.nombre}</option>
                `).join("")}
              </select>
            </td>
            <td>
              <span>${c.grupo_descripcion || ''}</span>
              <input type="text" class="edit-input grupo-descripcion-edit" style="display:none" value="${c.grupo_descripcion || ''}" />
            </td>
            <td>
              <button onclick="habilitarEdicion(${c.id})">✏️ Editar</button>
              <button class="guardar-btn" style="display:none" onclick="guardarEdicion(${c.id})">💾 Guardar</button>
              <button class="cancelar-btn" style="display:none" onclick="cancelarEdicion(${c.id})">❌ Cancelar</button>
              <button onclick="eliminarCupon(${c.id})">🗑 Eliminar</button>
            </td>
          `;
          tbody.appendChild(tr);
        });
      });
  }
  
  function eliminarCupon(id) {
    if (!confirm("¿Eliminar este cupón permanentemente?")) return;
  
    fetch(`${API}/api/admin/cupones/${id}`, {
      method: "DELETE",
      headers: {
        Authorization: "Bearer " + token
      }
    })
      .then(res => res.json())
      .then(data => {
        if (data.message) {
          alert("🗑️ Cupón eliminado");
          cargarCuponesAdmin();
        } else {
          alert("❌ " + (data.error || "Error al eliminar"));
        }
      })
      .catch(err => {
        console.error(err);
        alert("Error de conexión.");
      });
  }
  // admin-panel.js - PARTE 2: gestión de grupos, comercios y vendedores

function cargarGrupos() {
    return fetch(`${API}/api/admin/grupos`, {
      headers: { Authorization: "Bearer " + token }
    })
      .then(res => res.json())
      .then(data => {
        listaGrupos = data;
        mostrarGruposTabla();
      });
  }
  
  function mostrarGruposTabla() {
    const tbody = document.querySelector("#tabla-grupos tbody");
    tbody.innerHTML = "";
  
    listaGrupos.forEach(grupo => {
      const tr = document.createElement("tr");
      tr.setAttribute("data-id", grupo.id);
      tr.innerHTML = `
        <td><span>${grupo.nombre}</span><input type="text" class="edit-input" style="display:none" value="${grupo.nombre}" /></td>
        <td><span>${grupo.descripcion || ''}</span><input type="text" class="edit-input" style="display:none" value="${grupo.descripcion || ''}" /></td>
        <td><span>${formatearFecha(grupo.fecha_inicio)}</span><input type="date" class="edit-input" style="display:none" value="${grupo.fecha_inicio?.split('T')[0] || ''}" /></td>
        <td><span>${formatearFecha(grupo.fecha_fin)}</span><input type="date" class="edit-input" style="display:none" value="${grupo.fecha_fin?.split('T')[0] || ''}" /></td>
        <td>
          <button onclick="editarGrupo(${grupo.id})">✏️ Editar</button>
          <button class="guardar-btn" style="display:none" onclick="guardarGrupo(${grupo.id})">💾 Guardar</button>
          <button class="cancelar-btn" style="display:none" onclick="cancelarEdicion(${grupo.id})">❌ Cancelar</button>
          <button onclick="eliminarGrupo(${grupo.id})">🗑 Eliminar</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }
  
  function editarGrupo(id) {
    habilitarEdicion(id);
  }
  
  function guardarGrupo(id) {
    const row = document.querySelector(`tr[data-id='${id}']`);
    const inputs = row.querySelectorAll(".edit-input");
  
    const nombre = inputs[0].value.trim();
    const descripcion = inputs[1].value.trim();
    const fecha_inicio = inputs[2].value;
    const fecha_fin = inputs[3].value;
  
    if (!nombre || !fecha_inicio || !fecha_fin) {
      alert("Nombre, fecha inicio y fecha fin son obligatorios.");
      return;
    }
  
    fetch(`${API}/api/admin/grupos/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token
      },
      body: JSON.stringify({ nombre, descripcion, fecha_inicio, fecha_fin })
    })
      .then(res => res.json())
      .then(data => {
        if (data.message) {
          alert("✅ Grupo actualizado correctamente");
          cargarGrupos();
        } else {
          alert("❌ " + (data.error || "Error al actualizar grupo"));
        }
      })
      .catch(err => {
        console.error(err);
        alert("⛔ Error al actualizar grupo");
      });
  }
  
  function eliminarGrupo(id) {
    if (!confirm("¿Eliminar este grupo?")) return;
  
    fetch(`${API}/api/admin/grupos/${id}`, {
      method: "DELETE",
      headers: { Authorization: "Bearer " + token }
    })
      .then(res => res.json())
      .then(data => {
        if (data.message) {
          alert("🗑️ Grupo eliminado");
          cargarGrupos();
        } else {
          alert("❌ " + (data.error || "Error al eliminar grupo"));
        }
      })
      .catch(err => {
        console.error(err);
        alert("⛔ Error al eliminar grupo");
      });
  }
  
  function cargarComercios() {
    return fetch(`${API}/api/admin/comercios`, {
      headers: { Authorization: "Bearer " + token }
    })
      .then(res => res.json())
      .then(data => {
        listaComercios = data;
      });
  }
  
  function cargarVendedoresAdmin() {
    return fetch(`${API}/api/admin/vendedores`, {
      headers: { Authorization: "Bearer " + token }
    })
      .then(res => res.json())
      .then(data => {
        vendedoresGlobal = data;
      });
  }
  
  function cargarVendedoresGlobal() {
    return cargarVendedoresAdmin();
  }
  // admin-panel.js - PARTE 3: creación y manejo de nuevos datos

function mostrarVendedoresTabla() {
    const tbody = document.querySelector("#tabla-vendedores tbody");
    if (!tbody) return;
    tbody.innerHTML = "";
  
    vendedoresGlobal.forEach(vendedor => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${vendedor.nombre}</td>
        <td>${vendedor.correo}</td>
        <td>${vendedor.activo ? '✅' : '❌'}</td>
      `;
      tbody.appendChild(tr);
    });
  }
  
  function crearGrupoNuevo() {
    const nombre = document.getElementById("nuevoGrupoNombre").value.trim();
    const descripcion = document.getElementById("nuevoGrupoDescripcion").value.trim();
    const fecha_inicio = document.getElementById("nuevoGrupoFechaInicio").value;
    const fecha_fin = document.getElementById("nuevoGrupoFechaFin").value;
  
    if (!nombre || !fecha_inicio || !fecha_fin) {
      alert("Nombre, fecha inicio y fecha fin son obligatorios");
      return;
    }
  
    fetch(`${API}/api/admin/grupos`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token
      },
      body: JSON.stringify({ nombre, descripcion, fecha_inicio, fecha_fin })
    })
      .then(res => res.json())
      .then(data => {
        if (data.message) {
          alert("✅ Grupo creado correctamente");
          document.getElementById("nuevoGrupoNombre").value = "";
          document.getElementById("nuevoGrupoDescripcion").value = "";
          document.getElementById("nuevoGrupoFechaInicio").value = "";
          document.getElementById("nuevoGrupoFechaFin").value = "";
          cargarGrupos();
        } else {
          alert("❌ " + (data.error || "Error al crear grupo"));
        }
      })
      .catch(err => {
        console.error(err);
        alert("⛔ Error de red");
      });
  }
  
  function crearCuponNuevo() {
    const titulo = document.getElementById("nuevoCuponTitulo").value.trim();
    const descripcion = document.getElementById("nuevoCuponDescripcion").value.trim();
    const descuento = document.getElementById("nuevoCuponDescuento").value.trim();
    const comercio_id = document.getElementById("nuevoCuponComercio").value;
    const grupo_id = document.getElementById("nuevoCuponGrupo").value;
  
    if (!titulo || !descripcion || !descuento || !comercio_id || !grupo_id) {
      alert("Todos los campos son obligatorios");
      return;
    }
  
    fetch(`${API}/api/admin/cupones`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token
      },
      body: JSON.stringify({ titulo, descripcion, descuento, comercio_id, grupo_id })
    })
      .then(res => res.json())
      .then(data => {
        if (data.message) {
          alert("✅ Cupón creado correctamente");
          document.getElementById("nuevoCuponTitulo").value = "";
          document.getElementById("nuevoCuponDescripcion").value = "";
          document.getElementById("nuevoCuponDescuento").value = "";
          cargarCuponesAdmin();
        } else {
          alert("❌ " + (data.error || "Error al crear cupón"));
        }
      })
      .catch(err => {
        console.error(err);
        alert("⛔ Error de red");
      });
  }
  
  function asignarVendedorCliente(cliente, vendedorId) {
    fetch(`${API}/api/admin/asignar-vendedor`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token
      },
      body: JSON.stringify({ cliente, vendedorId })
    })
      .then(res => res.json())
      .then(data => {
        if (data.message) {
          alert("✅ Vendedor asignado");
        } else {
          alert("❌ " + (data.error || "Error al asignar vendedor"));
        }
      })
      .catch(err => {
        console.error(err);
        alert("⛔ Error al asignar vendedor");
      });
  }
  
  function actualizarTelefonoCliente(cliente, telefonoViejo, nuevoTelefono) {
    if (telefonoViejo === nuevoTelefono) return;
  
    fetch(`${API}/api/admin/actualizar-telefono`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token
      },
      body: JSON.stringify({ cliente, telefono: nuevoTelefono })
    })
      .then(res => res.json())
      .then(data => {
        if (data.message) {
          alert("📱 Teléfono actualizado");
        } else {
          alert("❌ " + (data.error || "Error al actualizar teléfono"));
        }
      })
      .catch(err => {
        console.error(err);
        alert("⛔ Error al actualizar teléfono");
      });
  }
  