# Comidas LANSEL 🥗

Aplicación interna para gestionar menús y pedidos de almuerzo de funcionarios, desarrollada con **Next.js 15**, **React 19**, **PostgreSQL** y **PDFKit**.

**Producción:** https://comidalansel.vercel.app/  
**Repositorio:** https://github.com/jm181987/comidaslansel

## Funcionalidades

- **Funcionarios:** registro de cuenta, inicio de sesión, selección de una o varias opciones de comida, actualización de pedidos antes del cierre e historial personal.
- **Administración:** alta y edición de funcionarios, activación de cuentas, gestión de menús diarios con múltiples opciones, listado de pedidos, resumen de porciones y reportes PDF diarios/mensuales agrupados por plato y funcionario.
- **Registro configurable:** `open` (abierto, acceso inmediato; valor predeterminado), `approval` (cuenta inactiva hasta que un administrador la habilite) o `closed` (registro deshabilitado).
- **Fechas configurables:** `today` (solo hoy; predeterminado) o `today_and_future` (hoy y fechas futuras).
- **Cierre diario a las 11:30:** los pedidos del día no se pueden crear ni modificar desde las **11:30, hora de Uruguay (America/Montevideo)**. Se valida tanto en la interfaz como en la API; el funcionario ve un modal informativo. Cuando se permiten pedidos futuros, esos pedidos siguen disponibles.
- **Control horario:** las tablas de pedidos muestran la **hora de creación** del pedido en zona horaria de Uruguay, tomada del campo `orders.created_at`. Las modificaciones actualizan `updated_at`, no la hora original de creación.

## Accesos

- Inicio de sesión: `/login`
- Registro de funcionarios: `/register`
- Pedidos e historial: `/orders`
- Panel administrativo: `/admin`

Los usuarios tienen rol `admin` o `employee`. El servidor valida la sesión y los permisos en cada API protegida. El registro público crea **únicamente funcionarios**, nunca administradores.

## Despliegue en Vercel

1. Importar `jm181987/comidaslansel` en Vercel con framework **Next.js**, directorio raíz `./` y rama de producción `main`.
2. Configurar las variables de entorno de forma privada:
   - `DATABASE_URL`: conexión a PostgreSQL.
   - `SESSION_SECRET`: secreto aleatorio de al menos 32 caracteres.
   - `DATABASE_SSL`: `true` cuando PostgreSQL utiliza TLS; `false` solo cuando corresponda.
   - `DATABASE_SSL_REJECT_UNAUTHORIZED`: conservar `true` con certificados válidos; `false` únicamente en entornos controlados donde sea imprescindible.
3. Inicializar el esquema y el primer administrador **solo cuando corresponda** mediante `npm install` y `npm run db:init`, desde un entorno seguro con conectividad a PostgreSQL. Para el administrador inicial se requieren `ADMIN_EMAIL`, `ADMIN_PASSWORD` (mínimo 12 caracteres) y, opcionalmente, `ADMIN_NAME`.
4. Desplegar y verificar inicio de sesión, registro, menús, pedidos y generación de PDF.

**Base existente:** revisar y ejecutar las migraciones necesarias sin borrar datos. El esquema de referencia está en `scripts/schema.sql`. Para habilitar las preferencias actuales:

```sql
CREATE TABLE IF NOT EXISTS public.app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
INSERT INTO public.app_settings (key,value)
VALUES ('order_mode','today'), ('registration_mode','open')
ON CONFLICT (key) DO NOTHING;
```

La cuenta PostgreSQL de la aplicación debe tener permisos de lectura y escritura sobre las tablas correspondientes. Los valores anteriores no reemplazan configuraciones existentes.

## Desarrollo local

```bash
npm install
cp .env.example .env.local
npm run dev
```

En Windows, copiar `.env.example` a `.env.local` manualmente. Configurar las variables antes de iniciar. Ejecutar `npm run db:init` únicamente si la base requiere inicialización.

## Base de datos

Tablas principales: `users`, `menus`, `menu_options`, `orders`, `order_items`, `app_settings`.

- Un menú por fecha, con múltiples opciones.
- Un pedido por funcionario y menú, con varias opciones seleccionadas.
- `orders.created_at` conserva la fecha/hora original; `orders.updated_at` registra modificaciones.
- Los pedidos existentes restringen la eliminación de sus menús; las opciones de un pedido se eliminan en cascada cuando se borra ese pedido.

## Estabilidad y diagnóstico

- Pool PostgreSQL: máximo **5 conexiones por instancia**, conexión con límite de 5 segundos y consultas con límite de 12 segundos.
- Las solicitudes de datos de la interfaz tienen límite de espera de **18 segundos** y muestran un mensaje ante demoras.
- El panel administrativo y la pantalla de pedidos admiten carga parcial cuando falla una de las consultas; se ofrecen botones **Actualizar**.
- Los reportes PDF se generan en memoria con el runtime Node.js, sin depender de archivos persistentes en Vercel.

**Nota:** el número de conexiones puede multiplicarse por las instancias serverless de Vercel; si hay tráfico concurrente, considerar un pooler PostgreSQL como PgBouncer. Para investigar lentitud o bloqueos, consultar los logs y métricas de Vercel y PostgreSQL. Estas medidas reducen esperas indefinidas, pero no garantizan ausencia de errores.

## Seguridad

No subir `.env.local`, cadenas de conexión, contraseñas ni claves a GitHub. Usar TLS para PostgreSQL cuando sea posible, contraseñas robustas y una clave de sesión segura. La fecha límite de pedidos se comprueba en el servidor, no solo en el navegador.
