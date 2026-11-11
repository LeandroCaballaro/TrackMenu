# TrackMenu 🍽️

Sistema de gestión y pedidos para restaurantes y bares.

## 📁 Estructura del Proyecto

```
TrackMenu/
├── backend/               # Servidor API REST (Node.js + Express)
│   ├── src/
│   │   ├── controllers/   # Lógica de controladores (auth, mesas, pedidos, productos)
│   │   ├── routes/        # Definición de rutas API (/api/...)
│   │   ├── data/          # Datos y mocks de prueba
│   │   ├── middlewares/   # Manejo de errores y middlewares
│   │   ├── app.js         # Configuración de Express
│   │   └── server.js      # Punto de entrada y listener del servidor
│   ├── .env               # Variables de entorno
│   └── package.json
│
├── frontend/              # Aplicación cliente (Vue 3 + Vite + Tailwind CSS v4)
│   ├── src/
│   │   ├── views/         # Vistas (Bienvenida, Inicio/Carta, Login, Productos, Dashboard)
│   │   ├── components/    # Header de navegación con roles y Combobox
│   │   ├── services/      # Cliente API y fallback local
│   │   ├── router/        # Rutas y guardias por rol (admin / empleado)
│   │   ├── assets/        # Estilos y logo
│   │   ├── App.vue        # Componente raíz
│   │   └── main.js        # Punto de entrada de Vue
│   ├── index.html
│   └── package.json
│
└── package.json           # Scripts unificados para ejecutar el monorepo
```

---

## 🚀 Inicio Rápido

### 1. Instalar dependencias

Desde la raíz del proyecto:
```bash
npm run install:all
```

O individualmente:
```bash
# Frontend
cd frontend
npm install

# Backend
cd ../backend
npm install
```

---

### 2. Ejecutar en Modo Desarrollo

#### Opción A: Desde la raíz
- Iniciar Frontend:
  ```bash
  npm run dev:frontend
  ```
- Iniciar Backend (puerto 3000):
  ```bash
  npm run dev:backend
  ```

#### Opción B: En cada carpeta por separado
- **Frontend** (`http://localhost:5173`):
  ```bash
  cd frontend
  npm run dev
  ```
- **Backend** (`http://localhost:3000`):
  ```bash
  cd backend
  npm run dev
  ```

---

## 📡 Endpoints del Backend (`/api`)

- `GET  /api/health` - Estado del servidor
- `GET  /api/products` - Lista de productos (soporta filtro `?category=...`)
- `GET  /api/products/:id` - Detalle de producto
- `POST /api/products` - Crear producto
- `GET  /api/tables` - Lista de mesas y su estado
- `GET  /api/tables/:number` - Detalle de mesa
- `POST /api/tables/:number/liberar` - Cobrar y liberar mesa
- `POST /api/tables/:number/ocupar` - Asignar orden a mesa
- `GET  /api/orders` - Lista de pedidos en cocina
- `POST /api/orders` - Crear nuevo pedido
- `POST /api/auth/login` - Iniciar sesión (`admin` / `empleado`)
- `GET  /api/auth/me` - Sesión, organización y rol actual
- `GET/POST/PUT/DELETE /api/productos` - ABM multi-tenant de productos y aviso de falta de stock
- `GET/POST /api/admin/...` - KPIs, historial de ventas, anulación, movimientos y alta/gestión de usuarios (solo `admin`)
