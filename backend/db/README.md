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
│   ├── 004_enable_rls_and_policies.sql    # Políticas de seguridad RLS
│   ├── 005_create_productos_abm.sql       # Tabla productos (ABM)
│   ├── 006_organizaciones_y_roles.sql     # Organizaciones, roles y RLS por organización
│   ├── 007_superadmin_ventas_auditoria.sql  # Ventas, stock y logs de auditoría
│   └── 008_invitaciones_y_gestion_de_usuarios.sql  # Invitaciones, cambio de rol y cierre de la escalada
│
├── seeds/
│   ├── 001_seed_products.sql              # Inserción de productos iniciales
│   ├── 002_seed_tables.sql                # Inserción de mesas 1 al 12
│   ├── 003_seed_orders.sql                # Pedidos activos de prueba
│   ├── 004_seed_usuarios_prueba.sql       # Cuentas de los 3 roles en 2 organizaciones
│   ├── 005_seed_demostracion.sql          # Menú completo para la demo
│   └── seed.js                            # Script ejecutable con Node.js
│
└── README.md
```

---

## 🚀 Cómo Aplicar en Supabase

### Opción 1: SQL Editor de Supabase (Recomendada para primera configuración)

1. Ingresá a tu proyecto en [Supabase Dashboard](https://supabase.com/dashboard).
2. Ve a la sección **SQL Editor**.
3. Ejecutá en orden los archivos de `migrations/` (`001` a `008`).
4. Ejecutá los archivos de `seeds/` (`001` a `005`) si deseas cargar los datos de prueba.
   Los seeds `004` y `005` crean las cuentas de demostración y su menú, y hay
   que correrlos desde el SQL Editor: escriben en `auth.users`, que la clave
   pública no puede tocar.

---

### Opción 2: Ejecutar Seeds desde Node.js

Una vez creadas las tablas con las migraciones, configurá tu `backend/.env` y ejecutá:

```bash
# Desde la carpeta backend
npm run db:seed
```
