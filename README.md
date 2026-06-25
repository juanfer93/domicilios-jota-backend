# Jota Delivery Backend

API REST para administrar usuarios, comercios, pedidos y notificaciones de Jota Delivery.

## Proposito

Este backend centraliza la autenticacion, la administracion de domiciliarios y comercios, la asignacion de pedidos y las notificaciones Push. Debe mantenerse seguro, escalable y compatible con el frontend movil y web.

## Tecnologias

- NestJS 11 y TypeScript
- PostgreSQL alojado en Supabase Cloud
- TypeORM con patron Repository
- JWT con Passport y Guards de NestJS
- DTOs con `class-validator`
- Nodemailer para invitaciones por correo
- Web Push con VAPID

## Instalacion

```bash
pnpm install
```

Configura las variables de entorno requeridas antes de iniciar la aplicacion:

- `NODE_ENV`, `PORT`
- `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_USERNAME`, `DATABASE_PASSWORD`, `DATABASE_NAME`, `DATABASE_SYNCHRONIZE`
- `JWT_SECRET`, `JWT_EXPIRATION`
- `FRONTEND_URL`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_SECURE`, `EMAIL_FROM`
- `WEB_PUSH_PUBLIC_KEY`, `WEB_PUSH_PRIVATE_KEY`, `WEB_PUSH_SUBJECT`
- `APP_SCHEME` (por defecto `jotadeliverymobile`)
- `NOTIFICATIONS_DRY_RUN` opcional. Use `true` solo en desarrollo para imprimir
  en consola las notificaciones que se enviarian a Expo sin llamar la red.

## Ejecucion y cambio de entorno

La API escucha en `0.0.0.0`, usa el puerto configurado y expone sus rutas bajo
`/api/v1`.

### Desarrollo

El entorno de desarrollo carga `.env`. Antes de iniciarlo, elimina cualquier
valor de `NODE_ENV` que haya quedado activo en la terminal:

```powershell
Remove-Item Env:NODE_ENV -ErrorAction SilentlyContinue
pnpm run start:dev
```

### De desarrollo a produccion

Completa primero las credenciales de produccion en `.env.prod`. Luego compila,
activa `NODE_ENV=production` e inicia la version compilada:

```powershell
pnpm run build
$env:NODE_ENV='production'
pnpm run start:prod
```

Con `NODE_ENV=production`, el backend carga `.env.prod` en lugar de `.env`.

### De produccion a desarrollo

Deten el proceso de produccion, elimina `NODE_ENV` de la sesion actual y vuelve
a iniciar el modo de desarrollo:

```powershell
Remove-Item Env:NODE_ENV -ErrorAction SilentlyContinue
pnpm run start:dev
```

Al eliminar `NODE_ENV`, el backend vuelve a cargar `.env`.

### Sincronizacion de base de datos

`DATABASE_SYNCHRONIZE=true` permite que TypeORM cree o ajuste las tablas. Debe
usarse solo durante la creacion inicial controlada del esquema. Una vez creadas
las tablas de produccion, configura permanentemente:

```env
DATABASE_SYNCHRONIZE=false
```

Para aplicar el campo `ganancia` en `pedidos`, inicia una sola vez el backend
contra la base objetivo con `DATABASE_SYNCHRONIZE=true`, confirma que la columna
`ganancia` exista, y vuelve inmediatamente a `DATABASE_SYNCHRONIZE=false`.

En servicios como Vercel, Render o Railway, los archivos `.env` y `.env.prod`
no se suben a GitHub. Las variables deben configurarse directamente en el panel
del proveedor, usando `NODE_ENV=production` y `DATABASE_SYNCHRONIZE=false`.

## Arquitectura

El codigo se organiza por modulos dentro de `src/modules`:

- `auth`: registro, login JWT y compatibilidad con enlaces antiguos de domiciliarios.
- `usuarios`: administradores, clientes y domiciliarios.
- `comercios`: administracion y busqueda de comercios.
- `pedidos`: asignacion, estados e historial de domicilios.
- `notifications`: suscripciones y notificaciones Web Push.

El acceso a datos se implementa mediante repositorios TypeORM inyectables. Los controladores deben permanecer enfocados en HTTP y delegar la logica de negocio a los servicios.

## Reglas de negocio

### Autenticacion

- Las credenciales de acceso son correo y contrasena.
- Las contrasenas deben tener al menos 8 caracteres.
- Los endpoints protegidos usan JWT y, cuando corresponda, `RolesGuard`.
- Un domiciliario puede iniciar sesion inmediatamente con la clave temporal que recibe por correo.

### Domiciliarios

1. Un administrador crea el domiciliario con nombre y correo.
2. El backend genera una clave temporal criptograficamente segura y la envia al correo registrado.
3. El domiciliario inicia sesion directamente con su correo y esa clave temporal.
4. Despues del primer acceso, debe cambiar la clave desde Perfil.
5. Al asignarle un pedido, el backend intenta enviar una notificacion Push.
6. Un fallo de Push nunca debe impedir la creacion del pedido.

### Pedidos

Los estados disponibles son:

- `EN_PROCESO`
- `HECHO`
- `CANCELADO`

Las consultas diarias e historicas usan la zona horaria `America/Bogota`.

### CORS

Los origenes permitidos se administran en `src/main.ts`. Deben contemplar el dominio configurado en `FRONTEND_URL`, desarrollo local, dispositivos de la red `192.168.x.x` y Expo cuando siga siendo necesario.

### Entrega de notificaciones

La plataforma desde la que se crea o actualiza un pedido no cambia el envio. El
backend identifica al usuario destinatario y entrega la misma notificacion por
todos los canales que tenga registrados:

- `push_subscriptions`: navegadores web.
- `expo_tokens`: dispositivos Android.
- `notifications`: historial persistido y estado de lectura.

Esto cubre las combinaciones web a web, web a Android, Android a web y Android
a Android. Para recibir en ambos destinos, el usuario debe haber iniciado
sesion y concedido permisos al menos una vez en cada plataforma.

Para validar el flujo sin un dispositivo Android, inicie el backend con:

```powershell
$env:NOTIFICATIONS_DRY_RUN='true'
pnpm run start:dev
```

Luego registre un token Expo de prueba para el usuario y ejecute acciones reales
como crear un pedido libre, asignarlo, tomarlo o cambiar su estado. La consola
mostrara entradas `[NOTIFICATIONS][TRACE]`, `[NOTIFICATIONS][EXPO]` y
`[NOTIFICATIONS][DRY_RUN]` con el destinatario, pedido, titulo, cuerpo, estado,
URL y payload que se habria enviado.

## Patrones de desarrollo

### Inyeccion de dependencias

- Los servicios y repositorios usan `@Injectable()`.
- Las dependencias se reciben mediante el constructor.
- Los repositorios personalizados extienden `Repository<Entidad>` e inyectan `DataSource`.

### DTOs

- Toda entrada HTTP debe usar un DTO.
- Los DTOs usan decoradores de `class-validator`.
- Los mensajes de validacion deben escribirse en espanol.
- No se deben aceptar propiedades no declaradas en el DTO.

### Autorizacion

- Usa `JwtAuthGuard` para rutas autenticadas.
- Usa `RolesGuard` y `@Roles(...)` para permisos por rol.
- Usa `@CurrentUser()` o el usuario validado por Passport para obtener la identidad autenticada.

### Respuestas y errores

- Las respuestas exitosas se normalizan con `TransformInterceptor`.
- Los errores se normalizan con `HttpExceptionFilter`.
- Usa excepciones HTTP de NestJS en lugar de respuestas de error manuales.

## Convencion Git

Todos los commits deben seguir Conventional Commits con uno de estos prefijos:

- `feat:` para una funcionalidad nueva.
- `fix:` para una correccion de comportamiento o seguridad.
- `chore:` para mantenimiento, configuracion o documentacion sin cambio funcional.

Ejemplos:

```text
feat: add delivery assignment notifications
fix: reject unconfirmed delivery users at login
chore: consolidate project documentation
```

Antes de hacer `push`, los cambios deben estar incluidos en commits que respeten esta convencion.

## Validacion

```bash
pnpm run build
pnpm run test
pnpm run test:e2e
```

La prueba e2e requiere acceso a PostgreSQL/Supabase. Si falla por conexion dentro de un entorno restringido, debe repetirse con acceso de red antes de atribuir el fallo a la aplicacion.
