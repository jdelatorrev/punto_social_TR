// cliente-panel.js

const token = localStorage.getItem("token");

function verificarTokenValido() {
  if (!token) return window.location.href = "ingresa.html";
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (payload.exp < Math.floor(Date.now() / 1000)) {
      Swal.fire('Sesión expirada', 'Por favor inicia sesión de nuevo.', 'warning').then(() => {
        localStorage.removeItem("token");
        window.location.href = "ingresa.html";
      });
    } else {
      document.getElementById("usuarioNombre").textContent = payload.nombre;
    }
  } catch (err) {
    Swal.fire('Token inválido', 'Por favor inicia sesión de nuevo.', 'error').then(() => {
      localStorage.removeItem("token");
      window.location.href = "ingresa.html";
    });
  }
}

function irAComprar() {
  window.location.href = "comprar.html";
}

function cerrarSesion() {
  Swal.fire({
    title: '¿Deseas cerrar sesión?',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#d33',
    cancelButtonColor: '#3085d6',
    confirmButtonText: 'Sí, cerrar',
    cancelButtonText: 'Cancelar'
  }).then((result) => {
    if (result.isConfirmed) {
      localStorage.removeItem("token");
      window.location.href = "ingresa.html";
    }
  });
}

let cuponesGlobal = [];
let filtroEstado = "todos";

function filtrar(filtro) {
  filtroEstado = filtro;
  aplicarFiltros();
}

function aplicarFiltros() {
  const contenedor = document.getElementById("cupones-container");
  contenedor.innerHTML = "";

  const comercioSeleccionado = document.getElementById("filtroComercio").value.toLowerCase();
  const textoBusqueda = document.getElementById("buscadorCupon").value.toLowerCase();

  let filtrados = [...cuponesGlobal];

  if (filtroEstado === 'usado') {
    filtrados = filtrados.filter(c => c.utilizado).sort((a, b) => new Date(b.fecha_compra) - new Date(a.fecha_compra));
  } else if (filtroEstado === 'no-usado') {
    filtrados = filtrados.filter(c => !c.utilizado).sort((a, b) => new Date(b.fecha_compra) - new Date(a.fecha_compra));
  } else {
    const disponibles = filtrados.filter(c => !c.utilizado).sort((a, b) => new Date(b.fecha_compra) - new Date(a.fecha_compra));
    const usados = filtrados.filter(c => c.utilizado).sort((a, b) => new Date(b.fecha_compra) - new Date(a.fecha_compra));
    filtrados = [...disponibles, ...usados];
  }

  if (comercioSeleccionado) {
    filtrados = filtrados.filter(c => c.comercio.toLowerCase() === comercioSeleccionado);
  }

  if (textoBusqueda) {
    filtrados = filtrados.filter(c => c.comercio.toLowerCase().includes(textoBusqueda) || c.titulo.toLowerCase().includes(textoBusqueda));
  }

  if (filtrados.length === 0) {
    contenedor.innerHTML = "<p>No tienes cupones que coincidan con los filtros.</p>";
    return;
  }

  filtrados.forEach(c => {
    const div = document.createElement("div");
    div.className = "cupon " + (c.utilizado ? "usado" : "no-usado");
    div.innerHTML = `
      <h3>${c.titulo}</h3>
      <p><strong>Comercio:</strong> ${c.comercio}</p>
      <p><strong>Descripción:</strong> ${c.descripcion}</p>
      <p><strong>Descuento:</strong> ${c.descuento}</p>
      <p><strong>Válido hasta:</strong> ${new Date(c.fecha_expiracion).toLocaleDateString()}</p>
      <p class="estado">${c.utilizado ? "❌ Ya fue usado" : "✅ Disponible"}</p>
    `;
    contenedor.appendChild(div);
  });
}

async function cargarCupones() {
  const res = await fetch(`${API}/api/mis-cupones`, { headers: { Authorization: "Bearer " + token } });
  const data = await res.json();
  cuponesGlobal = data;

  const cuponesAnteriores = JSON.parse(localStorage.getItem('cuponesActuales')) || [];
  const nuevosTitulos = cuponesGlobal.map(c => c.titulo);
  localStorage.setItem('cuponesActuales', JSON.stringify(nuevosTitulos));

  const comerciosUnicos = [...new Set(cuponesGlobal.map(c => c.comercio))];
  const select = document.getElementById("filtroComercio");
  select.innerHTML = `<option value="">-- Todos --</option>` + comerciosUnicos.map(nombre => `<option value="${nombre}">${nombre}</option>`).join('');

  filtrar(filtroEstado);

  setTimeout(() => {
    document.querySelectorAll('.cupon').forEach(div => {
      const titulo = div.querySelector('h3').textContent;
      if (!cuponesAnteriores.includes(titulo)) {
        div.classList.add('nuevo-cupon');
      }
    });
  }, 100);

  const listaGrupos = document.getElementById("listaGrupos");
  listaGrupos.innerHTML = `<li onclick="filtrarPorComercio('todos')">Todos</li>`;
  comerciosUnicos.forEach(comercio => {
    const li = document.createElement("li");
    li.textContent = comercio;
    li.onclick = () => filtrarPorComercio(comercio);
    listaGrupos.appendChild(li);
  });
}

function filtrarPorComercio(comercioSeleccionado) {
  const contenedor = document.getElementById("cupones-container");
  contenedor.innerHTML = "";
  let filtrados = comercioSeleccionado === 'todos' ? [...cuponesGlobal] : cuponesGlobal.filter(c => c.comercio === comercioSeleccionado);

  const disponibles = filtrados.filter(c => !c.utilizado).sort((a, b) => new Date(b.fecha_compra) - new Date(a.fecha_compra));
  const usados = filtrados.filter(c => c.utilizado).sort((a, b) => new Date(b.fecha_compra) - new Date(a.fecha_compra));
  filtrados = [...disponibles, ...usados];

  if (filtrados.length === 0) {
    contenedor.innerHTML = "<p>No tienes cupones de este comercio.</p>";
    return;
  }

  filtrados.forEach(c => {
    const div = document.createElement("div");
    div.className = "cupon " + (c.utilizado ? "usado" : "no-usado");
    div.innerHTML = `
      <h3>${c.titulo}</h3>
      <p><strong>Comercio:</strong> ${c.comercio}</p>
      <p><strong>Descripción:</strong> ${c.descripcion}</p>
      <p><strong>Descuento:</strong> ${c.descuento}</p>
      <p><strong>Válido hasta:</strong> ${new Date(c.fecha_expiracion).toLocaleDateString()}</p>
      <p class="estado">${c.utilizado ? "❌ Ya fue usado" : "✅ Disponible"}</p>
    `;
    contenedor.appendChild(div);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  verificarTokenValido();
  cargarCupones();

  const menuToggle = document.getElementById('menuToggle');
  const sidebar = document.querySelector('.sidebar');

  if (menuToggle && sidebar) {
    menuToggle.addEventListener('click', () => sidebar.classList.toggle('active'));
  }
});

async function canjearCodigo() {
    const codigo = document.getElementById("codigoInput").value.trim();
    if (!codigo) {
      await Swal.fire('Código vacío', 'Por favor ingresa un código válido.', 'warning');
      return;
    }
  
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // Máximo 10 segundos de espera
  
    try {
      const loading = Swal.fire({
        title: 'Canjeando código...',
        text: 'Por favor espera',
        allowOutsideClick: false,
        allowEscapeKey: false,
        didOpen: () => Swal.showLoading()
      });
  
      const cuponesAntes = cuponesGlobal.map(c => c.titulo);
  
      const res = await fetch(`${API}/api/canjear-codigo`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token
        },
        body: JSON.stringify({ codigo }),
        signal: controller.signal
      });
  
      clearTimeout(timeoutId);
      Swal.close();
  
      const data = await res.json();
  
      if (res.ok && data.message) {
        await Swal.fire('¡Éxito!', `Se te asignaron ${data.cupones} cupones 🎉`, 'success');
  
        await cargarCupones(); // Recarga los cupones actualizados
  
        setTimeout(() => {
          const nuevos = [];
          document.querySelectorAll('.cupon').forEach(div => {
            const titulo = div.querySelector('h3').textContent;
            if (!cuponesAntes.includes(titulo)) {
              div.classList.add('nuevo-cupon');
              nuevos.push(div);
            }
          });
  
          setTimeout(() => {
            nuevos.forEach(div => div.classList.remove('nuevo-cupon'));
          }, 5000);
  
        }, 100);
  
      } else {
        await Swal.fire('Error', data.error || 'No se pudo canjear el código.', 'error');
      }
  
    } catch (err) {
      Swal.close();
      if (err.name === 'AbortError') {
        Swal.fire('Tiempo agotado', 'El servidor no respondió a tiempo.', 'error');
      } else {
        console.error('Error al canjear código:', err);
        Swal.fire('Error', 'Ocurrió un problema de conexión.', 'error');
      }
    }
  }
  
