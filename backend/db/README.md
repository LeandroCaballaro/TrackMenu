# 🗄️ Base de Datos Supabase (Migraciones y Seeds)

Este directorio contiene las migraciones SQL estructuradas y los seeds de datos iniciales para TrackMenu.

---

## 📁 Estructura

```
backend/db/
├── migrations/
│   ├── 001_create_products_table.sql      # Tabla de productos
│   ├── 002_create_tables_table.sql        # Tabla de mesas
│   ├── 003_create_orders_table.sql        # Tabla de pedidos/comandas
│   └── 004_enable_rls_and_policies.sql    # Políticas de seguridad RLS
│
├── seeds/
│   ├── 001_seed_products.sql              # Inserción de productos iniciales
│   ├── 002_seed_tables.sql                # Inserción de mesas 1 al 12
│   ├── 003_seed_orders.sql                # Pedidos activos de prueba
│   └── seed.js                            # Script ejecutable con Node.js
│
└── README.md
```

---

## 🚀 Cómo Aplicar en Supabase

### Opción 1: SQL Editor de Supabase (Recomendada para primera configuración)

1. Ingresá a tu proyecto en [Supabase Dashboard](https://supabase.com/dashboard).
2. Ve a la sección **SQL Editor**.
3. Ejecutá en orden los archivos de `migrations/` (`001`, `002`, `003`, `004`).
4. Ejecutá los archivos de `seeds/` (`001`, `002`, `003`) si deseas cargar los datos de prueba.

---

### Opción 2: Ejecutar Seeds desde Node.js

Una vez creadas las tablas con las migraciones, configurá tu `backend/.env` y ejecutá:

```bash
# Desde la carpeta backend
npm run db:seed
```
