# Función principal: ABM de productos (backend)

## 1. Decisión

Del MVP de TrackMenu la función elegida para esta etapa es **cargar y administrar
los productos del menú**. Es la que habilita todo lo demás: sin productos no hay
pedidos ni mesas ocupadas.

Historia de usuario que cubre:

> Como administrador del negocio quiero cargar, buscar, modificar y eliminar los
> productos de mi menú, y que sólo mi negocio los vea.

## 2. Recorrido, paso a paso

| Paso | Vista (Vue Router) | Llamada al backend |
|------|--------------------|--------------------|
| 1. Se registra o inicia sesión | `/registro`, `/login` | `POST /api/auth/register`, `POST /api/auth/login` |
| 2. El sistema le crea su organización y lo deja como `admin` | — | el propio register/login |
| 3. Entra al listado de su menú | `/productos` | `GET /api/productos` |
| 4. Busca por nombre y ordena por precio o fecha | `/productos?q=&orden=` | `GET /api/productos?q=mila&orden=precio&dir=asc` |
| 5. Carga un producto nuevo desde el formulario | `/productos/nuevo` | `POST /api/productos` |
| 6. Abre el detalle de un producto | `/productos/:id` | `GET /api/productos/:id` |
| 7. Lo edita | `/productos/:id/editar` | `PUT /api/productos/:id` |
| 8. Lo elimina (el frontend pide confirmación antes) | `/productos` | `DELETE /api/productos/:id` |
| 9. Cierra sesión: las rutas privadas dejan de responder | `/login` | cualquier llamada sin token → `401` |

## 3. Endpoints

Todos bajo `/api/productos` y **todos privados** (`requireAuth`).

| Método | Ruta | Rol mínimo | Qué hace |
|--------|------|-----------|----------|
| GET | `/api/productos` | consulta | Lista con búsqueda, filtro, orden y paginado |
| GET | `/api/productos/:id` | consulta | Detalle |
| POST | `/api/productos` | empleado | Crea |
| PUT / PATCH | `/api/productos/:id` | empleado | Modifica |
| DELETE | `/api/productos/:id` | admin | Elimina |
| GET | `/api/auth/me` | — | Usuario, organización y rol actual |

Parámetros del listado:

- `q` — busca por nombre (parcial, sin distinguir mayúsculas).
- `activo` — `true` / `false`.
- `orden` — `nombre` \| `precio` \| `stock` \| `creado_en` (default `creado_en`).
- `dir` — `asc` \| `desc` (default `desc`).
- `pagina`, `limite` (máx. 100).

Respuestas: `{ success, message, data }` en el camino feliz;
`{ success: false, message, errors: { campo: motivo } }` ante datos inválidos.
Códigos usados: `200`, `201`, `400` (validación), `401` (sin sesión o vencida),
`403` (rol sin permiso), `404` (no existe o es de otra organización), `503`
(Supabase sin configurar).

## 4. Validaciones

Las mismas reglas para alta y modificación (`validarProducto`, un solo lugar):

- `nombre` obligatorio, entre 2 y 80 caracteres (se recorta).
- `precio` obligatorio, numérico, ≥ 0.
- `stock` entero ≥ 0 (default 0).
- `descripcion` hasta 500 caracteres.
- `activo` booleano.
- `imagen_url` URL `http(s)`.

En la modificación sólo se validan los campos enviados, con las mismas reglas; un
cuerpo vacío devuelve `400`.

## 5. Tipos de usuario

| Rol | Por qué lo necesita | Puede |
|-----|---------------------|-------|
| `admin` (dueño) | Es responsable del menú y de los precios | leer, crear, modificar y **eliminar** |
| `empleado` | Carga productos y corrige stock en el día a día | leer, crear y modificar |
| `consulta` | Mira el menú y los precios (cocina, caja) | sólo leer |

## 6. Multi-tenencia y seguridad

Modelo (migración `006_organizaciones_y_roles.sql`):

```
organizaciones (id, nombre)
miembros       (usuario_id PK → auth.users, organizacion_id → organizaciones, rol)
productos      (id, organizacion_id → organizaciones, usuario_id, nombre, precio, stock, activo, ...)
```

El control está en **dos capas**, no sólo en la interfaz:

1. **Backend** — `requireAuth` valida el token, resuelve organización y rol;
   `requireRole` corta por rol; cada consulta filtra por `organizacion_id`.
2. **Base de datos (RLS)** — el backend consulta Supabase *con el token del
   usuario*, nunca con la `service_role`, así las políticas de
   `006_organizaciones_y_roles.sql` se aplican igual. Aunque alguien saltee el
   backend, Postgres sólo le devuelve las filas de su organización y le niega
   crear, modificar o borrar según su rol. Lo mismo para las imágenes del bucket
   `productos`, cuya carpeta es la organización.

La PK de `miembros` es el `usuario_id`: un usuario pertenece a una sola
organización y no puede cambiarse de rol a sí mismo.

## 7. Pruebas

```bash
npm test
```

Valida las reglas de alta y modificación (5 casos, pasan).

```bash
npm run dev          # en otra terminal, con backend/.env configurado
npm run test:e2e
```

Requisitos del e2e: tener aplicada la migración `006` y que Supabase **no** exija
confirmar el email (Authentication > Sign In / Providers > *Confirm email* en
off), porque el script registra dos cuentas nuevas. Si preferís dejar la
confirmación activada, creá las dos cuentas a mano y pasalas por entorno:

```bash
EMAIL_A=a@dominio.com PASSWORD_A=... EMAIL_B=b@dominio.com PASSWORD_B=... npm run test:e2e
```

Recorrido completo con datos ficticios: registra dos negocios distintos, da de
alta tres productos, busca, ordena, ve el detalle, modifica, elimina, y verifica
que fallen los casos que deben fallar — faltan datos (`400`), formato inválido
(`400`), orden inexistente (`400`), sin token o token vencido (`401`), producto de
otra organización (`404` al leer, modificar y eliminar).

Cuentas de prueba (`db/seeds/004_seed_usuarios_prueba.sql`, contraseña
`Prueba12345!` en todas):

| Cuenta | Rol | Organización |
|---|---|---|
| `e2e.admin@example.org` | admin | Negocio A de prueba |
| `e2e.empleado@example.org` | empleado | Negocio A de prueba |
| `e2e.consulta@example.org` | consulta | Negocio A de prueba |
| `e2e.otraorg@example.org` | admin | Negocio B de prueba |

```bash
EMAIL_A=e2e.admin@example.org PASSWORD_A='Prueba12345!' \
EMAIL_B=e2e.otraorg@example.org PASSWORD_B='Prueba12345!' npm run test:e2e
```

## 8. Estado del frontend

`ProductosView.vue` ya trabaja contra el modelo nuevo: resuelve la organización
con la función `mi_organizacion()` (la misma que usan las políticas), guarda
`organizacion_id` en el alta y sube las imágenes a la carpeta de la
organización. Según el rol (`mi_rol()`) oculta el formulario y los botones que
no corresponden — los permisos igual se validan en la base, ocultarlos es sólo
comodidad.

Queda pendiente: los mensajes de error que vienen de Postgres se muestran tal
cual, en inglés (por ejemplo `new row violates row-level security policy`).


## 9. Qué cubre el testing adversarial

Se probó la API con datos basura y la web tocando todos los botones. Lo que
falló quedó arreglado y con test:

- Un `id` que no es UUID devolvía `500` de Postgres; ahora es `404`.
- `limite` negativo o una `pagina` más allá del final devolvían `500`; ahora se
  acotan y una página vacía es una respuesta válida.
- Un objeto o un array en `nombre` se guardaban como `"[object Object]"` o
  `"a,b"`, y `precio: true` entraba como `1`. Ahora sólo se aceptan texto o
  número.
- Un precio o un stock más grandes que su columna devolvían `500`; ahora `400`.
- Buscar `%` o `_` devolvía todo, porque son comodines de LIKE: ahora se
  escapan.
- Una ruta inexistente mostraba una página en blanco; ahora hay un 404.
- Modificar o eliminar un producto que ya no existe avisaba "correctamente"
  sin haber tocado nada; ahora se comprueban las filas afectadas.
- Si la sesión vencía con el listado abierto, la tabla quedaba vacía sin aviso;
  ahora vuelve al login.
- `/inicio` tenía su propio registro y login guardados en `localStorage`, en
  paralelo a Supabase y sin relación con las cuentas reales. Se eliminó: el
  botón lleva al login de verdad y muestra la sesión de Supabase.

Pendiente, no es un error: `/inicio` sigue siendo una demo con productos y
mesas escritos a mano; no lee el menú real de la base.
