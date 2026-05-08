# Sistema de Costos Unitarios — Honduras

App web de presupuestación para construcción civil. 
Desarrollada para Ing. Gabriel Reconco.

## Instalación local

```bash
npm install
node src/app.js
```

Abrir: http://localhost:3000  
Usuario: admin@costos.hn  
Clave: admin123

## Docker / Coolify

```bash
docker build -t costos-unitarios .
docker run -p 3000:3000 -v ./data:/app/data costos-unitarios
```

## Módulos

- **Dashboard** — estadísticas y últimos cambios de precio
- **Proyectos** — gestión de proyectos con cliente/ubicación/moneda
- **Presupuestos** — capítulos + partidas, cálculo automático con % indirectos/utilidad/imprevistos
- **Actividades / CU** — análisis de precios unitarios con cantidad, rendimiento y desperdicio
- **Insumos** — catálogo maestro con historial automático de precios
- **Exportación Excel** — presupuesto en formato PAU (azul/naranja)

## Credenciales por defecto

Cambiar en producción editando la BD o agregando endpoint de cambio de clave.
