# Roles, permisos y protección de la información

Responde a los puntos 1 a 6 de la etapa final.

## 1. Los roles

| Rol | Quién es | Qué necesita hacer |
|---|---|---|
| **admin** | El dueño del negocio | Es responsable del menú, de los precios y de quién trabaja en el sistema. Carga y da de baja productos, y administra las cuentas de su equipo. |
| **empleado** | Encargado o mozo | Mantiene el menú al día: carga productos nuevos y corrige precios y stock durante el servicio. No da de baja productos ni toca las cuentas. |
| **consulta** | Cocina, caja, un socio | Sólo necesita mirar el menú y los precios. No modifica nada. |

El primer usuario que registra un negocio queda como **admin**. Al resto lo suma
él mismo con una invitación, eligiendo con qué rol entra.

## 2. Matriz de permisos

| Acción | admin | empleado | consulta |
|---|---|---|---|
| Consultar productos | Sí | Sí | Sí |
| Buscar, filtrar y ordenar | Sí | Sí | Sí |
| Crear productos | Sí | Sí | No |
| Modificar productos | Sí | Sí | No |
| Eliminar productos | Sí | No | No |
| Ver el equipo de la organización | Sí | Sí | Sí |
| Invitar usuarios | Sí | No | No |
| Cambiar el rol de un usuario | Sí | No | No |
| Dar de baja a un usuario | Sí | No | No |

Dos reglas más, para que una organización no quede sin dueño ni nadie se
promueva solo: **un admin no puede cambiar su propio rol ni darse de baja a sí
mismo**. Lo impide el backend y también la política de la base.

## 3. Usuarios, roles y organizaciones

```
organizaciones (id, nombre)
miembros       (usuario_id PK → auth.users, organizacion_id → organizaciones, rol)
invitaciones   (id, organizacion_id, codigo, rol, usada_por, expira_en)
productos      (id, organizacion_id → organizaciones, usuario_id, nombre, precio, ...)
```

`usuario_id` es la clave primaria de `miembros`: cada cuenta pertenece a **una**
organización y tiene **un** rol. No existe forma de quedar sin organización y
seguir operando: toda ruta privada exige la membresía.

Las dos puertas de entrada a una organización son funciones de la base
(`SECURITY DEFINER`), no inserciones del cliente:

- `fundar_organizacion(nombre)` — crea el negocio y deja al que la llama como
  admin. Falla si ya pertenece a alguno.
- `aceptar_invitacion(codigo)` — suma al que la llama con el rol de la
  invitación. Falla si el código no existe, ya se usó, venció, o si el usuario
  ya pertenece a una organización.

## 4. Controles de acceso, en los dos lados

**En el backend** (`src/middlewares/auth.js`):

- `requireSesion` valida el token contra Supabase.
- `requireAuth` además resuelve organización y rol, y devuelve `403` si la
  cuenta no pertenece a ninguna.
- `requireRole('admin', ...)` corta por rol antes de llegar al controlador.
- Cada consulta filtra además por `organizacion_id`.

**En la base** (migraciones `006` y `008`): el backend consulta Supabase **con el
token del usuario, nunca con la `service_role`**, así las políticas RLS se
aplican igual. Aunque alguien saltee el backend y hable directo con la API de
Supabase, Postgres sólo le devuelve las filas de su organización y le niega
crear, modificar o borrar según su rol. Lo mismo para las imágenes del bucket
`productos`, cuya carpeta es el id de la organización.

Ocultar botones en la interfaz es sólo comodidad: `ProductosView.vue` esconde el
formulario y las acciones según el rol, pero quien las fuerce choca igual contra
la base.

## 5. Separación entre organizaciones

Un usuario no puede leer, modificar ni eliminar nada de otra organización. Está
probado desde los dos lados: por la API (`tests/e2e.productos.mjs` devuelve `404`
al leer, modificar y eliminar un producto ajeno) y hablando directo con Supabase
con el token de la otra cuenta (devuelve lista vacía y `42501` al escribir).

Ninguna cuenta puede cambiarse de organización: la clave primaria de `miembros`
lo impide, y las dos funciones de alta fallan si el usuario ya es miembro.

> **Agujero encontrado y cerrado.** Hasta la migración `008`, la política de
> alta de `miembros` era `usuario_id = auth.uid()`: cualquier usuario recién
> registrado podía insertarse en **cualquier** organización con rol admin si
> conocía su UUID, y pasaba a ver y borrar todo. Se reprodujo, se corrigió
> quitando el permiso de INSERT sobre `miembros` y `organizaciones`, y se
> verificó que ahora devuelve `42501`.

## 6. Sesiones

- Sin token, con token vencido o inválido, toda ruta privada responde `401`.
- Al cerrar sesión el guard de Vue Router manda a `/login`, y entrar por URL
  directa a `/productos` también.
- Si la sesión vence con la pantalla abierta, el listado lo detecta y vuelve al
  login en vez de mostrar una tabla vacía.
- Dar de baja a un usuario tiene efecto en la petición siguiente: su token sigue
  siendo válido, pero ya no pertenece a ninguna organización y recibe `403`.

## 7. Dos decisiones pendientes de la fusión

Al fusionar las dos ramas quedaron dos contratos distintos. Están marcados acá
porque los definen tests, no el código:

1. **Alta propia (`POST /api/auth/register`).** La otra rama la había quitado a
   propósito: sólo un admin crea usuarios (`tests/admin.test.js` lo afirma). En
   la fusión se mantuvo, porque sin ella un negocio nuevo no tiene cómo abrir su
   cuenta —no existe todavía un admin que lo cree— y la consigna pide probar el
   registro. **Ese test queda fallando hasta que se decida.**
2. **El rol `consulta`.** La base lo acepta desde la migración `006` y lo usan
   `/api/miembros` y las invitaciones, pero el módulo de administración de la
   otra rama sólo contempla `admin` y `empleado`, y su test lo afirma. Mientras
   tanto, un usuario de sólo lectura se asigna por invitación o por
   `PATCH /api/miembros/:id`, no por `POST /api/admin/usuarios/rol`.
