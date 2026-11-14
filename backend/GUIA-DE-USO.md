# Guía de uso de TrackMenú

Responde a los puntos 12 a 15 de la etapa final.

## Qué es

TrackMenú le permite a un bar o restaurante administrar el menú que después ven
sus clientes: cargar productos con foto, precio y stock, buscarlos, corregirlos
y darlos de baja. Cada negocio ve sólo lo suyo, y dentro del negocio cada
persona entra con el rol que le corresponde.

## Cómo ingresar

1. Abrir la aplicación y pulsar **Ingresar**.
2. Si todavía no hay cuenta, **Registrarme**: nombre, correo y contraseña. Esa
   primera cuenta queda como **administradora** de un negocio nuevo.
3. Si alguien te pasó un **código de invitación**, registrate y usá el código:
   entrás al negocio que te invitó, con el rol que eligió quien te invitó.

Cuentas de demostración, todas con la contraseña `Prueba12345!`:

| Cuenta | Rol | Negocio |
|---|---|---|
| `e2e.admin@example.org` | administrador | Negocio A de prueba |
| `e2e.empleado@example.org` | empleado | Negocio A de prueba |
| `e2e.consulta@example.org` | consulta | Negocio A de prueba |
| `e2e.otraorg@example.org` | administrador | Negocio B de prueba |

Entrando con las dos últimas se ve, en vivo, que cada negocio tiene su propio
menú y que un rol de sólo lectura no puede tocar nada.

## Qué puede hacer cada rol

| | administrador | empleado | consulta |
|---|---|---|---|
| Ver el menú, buscar y ordenar | Sí | Sí | Sí |
| Cargar y modificar productos | Sí | Sí | No |
| Eliminar productos | Sí | No | No |
| Invitar gente y cambiar roles | Sí | No | No |

## La tarea principal: cargar un producto

1. Entrar con una cuenta de administrador o empleado.
2. Se abre **Administración del menú**.
3. En el formulario de la izquierda completar **nombre** y **precio** (son
   obligatorios), y si corresponde descripción y stock.
4. Elegir una **imagen** JPG, PNG o WEBP de hasta 5 MB.
5. Pulsar **Crear producto**. Aparece "Producto creado correctamente" y el
   producto se suma al listado de la derecha.
6. Para corregirlo, **Editar** en su fila, cambiar lo que haga falta y
   **Actualizar producto**.
7. Para darlo de baja, **Eliminar** y confirmar. El sistema pregunta antes.

Si falta un dato o el formato no es el esperado, el sistema lo dice campo por
campo y no guarda nada.

## Sumar a alguien del equipo

1. Entrar como administrador.
2. Crear una invitación eligiendo el rol (`POST /api/invitaciones`, o el botón
   correspondiente cuando esté en la interfaz).
3. Pasarle el **código** a la persona. Vence a los 7 días y se usa una sola vez.
4. Esa persona se registra y canjea el código; queda dentro del negocio con el
   rol elegido.
5. Desde el listado del equipo se le puede cambiar el rol o darle de baja.

## Datos de demostración

En el **SQL Editor de Supabase**, ejecutar en orden:

1. `db/seeds/004_seed_usuarios_prueba.sql` — crea las cuatro cuentas de arriba,
   ya confirmadas y sin enviar correos.
2. `db/seeds/005_seed_demostracion.sql` — carga un menú completo en cada negocio
   (10 productos en uno, 5 en el otro, uno de ellos inactivo).

Van por el SQL Editor y no por `npm run db:seed` porque escriben en `auth.users`,
que la clave pública no puede tocar. Los dos son idempotentes: se pueden volver a
correr para dejar la demo como al principio. `npm run db:seed` carga los datos de
las tablas viejas (`products`, `tables`, `orders`), que no usa el ABM.

Con eso alcanza para mostrar el recorrido entero sin cargar nada a mano.

## Publicar

El backend necesita estas variables de entorno (ver `backend/.env.example`):

| Variable | Para qué |
|---|---|
| `PORT` | Puerto donde escucha (lo suele fijar el proveedor) |
| `FRONTEND_URL` | Orígenes permitidos por CORS; acepta varios separados por coma |
| `SUPABASE_URL` | URL del proyecto |
| `SUPABASE_ANON_KEY` | Clave pública. **Obligatoria**: el ABM consulta con el token del usuario para que RLS siga aplicando |

El frontend necesita `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`
(ver `frontend/.env.example`).

Antes de publicar, aplicar las migraciones de `db/migrations/` en orden (001 a
008) y después los seeds.

> **Nada de esto se versiona.** `.env` está en `.gitignore`; en el repositorio
> sólo hay `.env.example` con valores de ejemplo. Las claves reales se cargan en
> el panel del proveedor. Las cuentas de demostración usan el dominio
> `example.org` y no corresponden a personas reales.
