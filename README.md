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
- `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_USERNAME`, `DATABASE_PASSWORD`, `DATABASE_NAME`
- `JWT_SECRET`, `JWT_EXPIRATION`
- `FRONTEND_URL`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_SECURE`, `EMAIL_FROM`
- `WEB_PUSH_PUBLIC_KEY`, `WEB_PUSH_PRIVATE_KEY`, `WEB_PUSH_SUBJECT`
- `USE_DEEP_LINK`, `APP_SCHEME`

## Ejecucion

```bash
pnpm run start:dev
```

La API escucha en `0.0.0.0`, usa el puerto configurado y expone sus rutas bajo `/api/v1`.

## Arquitectura

El codigo se organiza por modulos dentro de `src/modules`:

- `auth`: registro, login JWT y confirmacion de domiciliarios.
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
- Un domiciliario no puede iniciar sesion hasta confirmar su cuenta.

### Domiciliarios

1. Un administrador crea el domiciliario con nombre y correo.
2. El backend genera una credencial temporal y un token con vigencia de 24 horas.
3. El domiciliario recibe un enlace para establecer su contrasena.
4. La cuenta queda confirmada al establecer la nueva contrasena.
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
