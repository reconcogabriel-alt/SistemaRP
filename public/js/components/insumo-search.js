/* ============================================================
   BUSCADOR DE INSUMOS — combobox con filtro en tiempo real
   Reemplaza los <select> planos de insumo (2700+ opciones) por
   un input de texto + lista desplegable filtrable.

   Uso:
     crearBuscadorInsumo(containerEl, {
       insumos: [...],                 // array {id_insumo, codigo, descripcion, unidad, precio_unitario}
       onSelect: (insumo) => {...},    // callback cuando se elige uno
       placeholder: '...'              // opcional
     })
   Retorna un objeto { setValue(insumo), clear(), getValue() }
   ============================================================ */

let _insumoSearchSeq = 0;

function crearBuscadorInsumo(container, opts) {
  const { insumos = [], onSelect, placeholder = 'Buscar por código o descripción...' } = opts;
  const uid = `isb-${++_insumoSearchSeq}`;
  let seleccionado = null;
  let filtrados = [];
  let activeIdx = -1;

  container.classList.add('insumo-search');
  container.innerHTML = `
    <input type="text" class="insumo-search-input" id="${uid}-input"
           placeholder="${placeholder}" autocomplete="off">
    <div class="insumo-search-dropdown hidden" id="${uid}-drop"></div>
  `;

  const input = container.querySelector(`#${uid}-input`);
  const drop  = container.querySelector(`#${uid}-drop`);

  function normaliza(s) {
    return (s||'').toString().toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // quita acentos
  }

  function filtrar(q) {
    const txt = normaliza(q);
    if (!txt) return [];
    const partes = txt.split(/\s+/).filter(Boolean);
    return insumos.filter(i => {
      const hay = normaliza((i.codigo||'') + ' ' + (i.descripcion||''));
      return partes.every(p => hay.includes(p));
    }).slice(0, 50); // límite razonable de resultados visibles
  }

  function render() {
    if (!filtrados.length) {
      drop.innerHTML = `<div class="insumo-search-empty">Sin resultados</div>`;
    } else {
      drop.innerHTML = filtrados.map((i, idx) => `
        <div class="insumo-search-item ${idx===activeIdx?'active':''}" data-idx="${idx}">
          <span class="isi-desc">${i.descripcion}</span>
          <span class="isi-meta">
            <span class="isi-codigo">${i.codigo||'—'}</span>
            <span class="isi-unidad">${i.unidad||''}</span>
          </span>
        </div>`).join('');
    }
    drop.classList.remove('hidden');
  }

  function cerrar() {
    drop.classList.add('hidden');
    activeIdx = -1;
  }

  function elegir(i) {
    seleccionado = i;
    input.value = `${i.descripcion}${i.codigo ? ' ('+i.codigo+')' : ''}`;
    cerrar();
    if (onSelect) onSelect(i);
  }

  input.addEventListener('input', () => {
    seleccionado = null;
    filtrados = filtrar(input.value);
    activeIdx = -1;
    render();
  });

  input.addEventListener('focus', () => {
    if (input.value && !seleccionado) { filtrados = filtrar(input.value); render(); }
  });

  input.addEventListener('keydown', (e) => {
    if (drop.classList.contains('hidden') && e.key !== 'Escape') return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIdx = Math.min(activeIdx+1, filtrados.length-1);
      render();
      drop.querySelector('.active')?.scrollIntoView({ block:'nearest' });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIdx = Math.max(activeIdx-1, 0);
      render();
      drop.querySelector('.active')?.scrollIntoView({ block:'nearest' });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIdx >= 0 && filtrados[activeIdx]) elegir(filtrados[activeIdx]);
    } else if (e.key === 'Escape') {
      cerrar();
    }
  });

  drop.addEventListener('mousedown', (e) => {
    const item = e.target.closest('.insumo-search-item');
    if (!item) return;
    e.preventDefault();
    const idx = parseInt(item.dataset.idx);
    if (filtrados[idx]) elegir(filtrados[idx]);
  });

  document.addEventListener('click', (e) => {
    if (!container.contains(e.target)) cerrar();
  });

  return {
    getValue: () => seleccionado,
    setValue: (i) => {
      seleccionado = i;
      input.value = i ? `${i.descripcion}${i.codigo ? ' ('+i.codigo+')' : ''}` : '';
    },
    clear: () => {
      seleccionado = null;
      input.value = '';
    }
  };
}
