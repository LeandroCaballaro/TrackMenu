# Casos de prueba

Responde a los puntos 7 a 11 de la etapa final. Cada caso tiene pasos concretos
y el resultado que el sistema debe dar.

**Cuentas** (`db/seeds/004_seed_usuarios_prueba.sql`), contraseña `Prueba12345!`:

| Cuenta | Rol | Organización |
|---|---|---|
| `e2e.admin@example.org` | admin | Negocio A de prueba |
| `e2e.empleado@example.org` | empleado | Negocio A de prueba |
| `e2e.consulta@example.org` | consulta | Negocio A de prueba |
| `e2e.otraorg@example.org` | admin | Negocio B de prueba |

**Automatizado.** Los casos marcados con 🤖 los corren solos:

```bash
cd backend && npm test
```

```bash
cd backend && npm run test:e2e
```

```bash
cd backend && npm run test:e2e:miembros
```

```bash
cd backend && npm run test:e2e:admin
```

Los dos últimos necesitan el backend levantado (`npm run dev`) y las variables
de entorno que indica `FUNCION-PRINCIPAL.md`.

---

## A. Registro, inicio y cierre de sesión

| # | Pasos | Resultado esperado |
|---|---|---|
| A1 | Abrir `/registro`, completar nombre, correo nuevo y contraseña, enviar | La cuenta se crea y queda como **admin** de un negocio nuevo |
| A2 | Registrarse con un correo ya usado | Mensaje de error, no se crea nada |
| A3 | Registrarse con la contraseña vacía | El formulario no se envía y marca el campo |
| A4 | Entrar en `/login` con contraseña incorrecta | "Correo o contraseña incorrectos." |
| A5 🤖 | Entrar con una cuenta válida | Entra a `/productos` |
| A6 🤖 | Pulsar "Cerrar sesión" | Vuelve a `/login` |
| A7 🤖 | Después de cerrar sesión, escribir `/productos` en la barra de direcciones | Redirige a `/login` |
| A8 🤖 | Llamar a `GET /api/productos` sin token, o con un token inventado | `401` |
| A9 | Entrar en `/no-existe` | Página 404 con enlace para volver |

## B. Función principal: ABM de productos

| # | Pasos | Resultado esperado |
|---|---|---|
| B1 🤖 | Como admin, cargar "Milanesa napolitana", precio 9500, stock 12, con imagen | "Producto creado correctamente" y aparece en el listado |
| B2 🤖 | Enviar el alta sin nombre ni precio | `400` indicando qué campo falta, por campo |
| B3 🤖 | Enviar el precio como texto ("gratis") | `400` "El precio debe ser un número…" |
| B4 | Elegir un archivo que no sea imagen | "La imagen debe ser JPG, PNG o WEBP." |
| B5 | Elegir una imagen de más de 5 MB | "La imagen no puede superar los 5 MB." |
| B6 🤖 | Buscar "mila" | Sólo los productos cuyo nombre lo contiene |
| B7 🤖 | Buscar algo que no existe | Listado vacío, sin error |
| B8 🤖 | Ordenar por precio ascendente | Los precios salen de menor a mayor |
| B9 🤖 | Ordenar por un campo inventado | `400` con la lista de campos válidos |
| B10 🤖 | Abrir el detalle de un producto | Devuelve ese producto |
| B11 🤖 | Editar el precio y guardar | "Producto modificado correctamente" y el listado muestra el nuevo precio |
| B12 🤖 | Editar poniendo precio negativo | `400`, no se guarda |
| B13 | Pulsar "Eliminar" y cancelar la confirmación | El producto sigue estando |
| B14 🤖 | Pulsar "Eliminar" y confirmar | "Producto eliminado correctamente" y desaparece |
| B15 🤖 | Eliminar un producto que otro usuario ya borró | "El producto ya no existe o no tenés permiso para eliminarlo." |

## C. Permisos por rol

| # | Pasos | Resultado esperado |
|---|---|---|
| C1 🤖 | Entrar como `consulta` y pedir el listado | `200`, ve los productos |
| C2 🤖 | Como `consulta`, intentar crear un producto | `403` |
| C3 | Como `consulta`, mirar la pantalla | No aparece el formulario ni los botones Editar/Eliminar |
| C4 🤖 | Como `empleado`, crear y modificar | `201` y `200` |
| C5 🤖 | Como `empleado`, eliminar | `403` |
| C6 | Como `empleado`, mirar la pantalla | Hay formulario y Editar, no hay Eliminar |
| C7 🤖 | Como `admin`, eliminar | `200` |
| C8 🤖 | Como `empleado`, invitar a alguien o cambiar un rol | `403` |

## D. Separación entre organizaciones

| # | Pasos | Resultado esperado |
|---|---|---|
| D1 🤖 | Entrar como `e2e.otraorg` y pedir el listado | No aparece ningún producto del Negocio A |
| D2 🤖 | Como `e2e.otraorg`, pedir por id un producto del Negocio A | `404` |
| D3 🤖 | Como `e2e.otraorg`, modificarlo | `404` |
| D4 🤖 | Como `e2e.otraorg`, eliminarlo | `404` |
| D5 | Con el token de `e2e.otraorg`, llamar directo a la API de Supabase saltando el backend | Lista vacía al leer; `42501` al escribir |
| D6 | Con una cuenta nueva, intentar insertarse en `miembros` de otra organización | `42501`: ya no hay permiso de INSERT |

## E. Gestión de usuarios

| # | Pasos | Resultado esperado |
|---|---|---|
| E1 🤖 | Como admin, `GET /api/miembros` | Lista el equipo, marcando cuál soy yo |
| E2 🤖 | Como admin, crear una invitación con rol `empleado` | `201` con un código |
| E3 🤖 | Crear una invitación con rol "jefe" o un email mal escrito | `400` con el detalle por campo |
| E4 🤖 | Con una cuenta sin organización, aceptar el código | Se suma con rol `empleado` |
| E5 🤖 | Volver a usar el mismo código | `400` "no existe, ya se usó o venció" |
| E6 🤖 | Aceptar sin código | `400` |
| E7 🤖 | Como admin, cambiar el rol de otro miembro | `200` "Rol actualizado correctamente" |
| E8 🤖 | Como admin, cambiar su propio rol o darse de baja | `403` |
| E9 🤖 | Como admin, dar de baja a un miembro | `200`, y ese usuario pasa a recibir `403` |
| E10 🤖 | Operar sobre un usuario de otra organización, o con un id que no es UUID | `404` |

## F. Datos incorrectos y errores

| # | Pasos | Resultado esperado |
|---|---|---|
| F1 🤖 | `GET /api/productos/abc` (id que no es UUID) | `404`, no un error de base |
| F2 🤖 | `?limite=-5` o `?pagina=99999` | `200`: se acota, o página vacía |
| F3 🤖 | Mandar un objeto o un array en `nombre` | `400` |
| F4 🤖 | Mandar un precio o un stock enormes | `400` con el tope en el mensaje |
| F5 🤖 | Buscar `%` o `_` | Búsqueda literal, no devuelve todo |
| F6 🤖 | Enviar un cuerpo vacío, `null` o JSON roto | `400`, el servidor no se cae |

## G. Visualización

| # | Pasos | Resultado esperado |
|---|---|---|
| G1 | Abrir el sistema en un celular (o el navegador a 375 px) | Se lee y se puede operar, sin scroll horizontal |
| G2 | Revisar los mensajes de éxito y error | Se entienden y están en castellano |
| G3 | Recorrer el formulario con el teclado | Se llega a todos los campos y al botón de guardar |


## H. Módulo de administración

| # | Pasos | Resultado esperado |
|---|---|---|
| H1 🤖 | Entrar como `empleado` o `consulta` a KPIs, ventas, auditoría o usuarios | `403` en las cuatro |
| H2 🤖 | Cambiar el rol de un usuario que no existe | `404`, no un éxito falso |
| H3 🤖 | Cambiar el rol pasando un id que no es UUID | `404`, no el error crudo de Postgres |
| H4 🤖 | Como admin de otra organización, cambiar el rol de este equipo | `404` |
| H5 🤖 | Comprobar la auditoría después de un cambio que falló | No quedó registrado |
| H6 🤖 | Hacer un cambio de rol real | `200` y queda una entrada en la auditoría |
| H7 🤖 | `?limite=-5`, `?pagina=9999`, `?desde=noesunafecha` en ventas | Se acota, página vacía y `400` con el campo |
| H8 🤖 | `?limite=1` y `?accion=inventada` en auditoría | Respeta el límite; `400` con la lista de acciones |
| H9 🤖 | Anular una venta con id inválido, inexistente o sin motivo | `404`, `404` y `400` |
| H10 🤖 | Crear un usuario sin datos, con email mal formado o contraseña corta | `400` en los tres |
| H11 | Abrir la pantalla de usuarios | Se ven correos y nombres, no UUIDs |
