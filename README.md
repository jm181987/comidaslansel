# Comidas LANSEL

Sistema interno de selección de comidas por funcionario, con roles, menús diarios de múltiples opciones y reportes PDF diarios y mensuales.

## Despliegue en Vercel

1. Importar el repositorio `jm181987/comidaslansel` en Vercel (Framework: Next.js; Root Directory: `./`; Production Branch: `main`).
2. Configurar estas variables de entorno **en Vercel**, nunca en GitHub:
   - `DATABASE_URL`: cadena PostgreSQL de la base existente.
   - `SESSION_SECRET`: valor aleatorio seguro de al menos 32 caracteres.
   - `DATABASE_SSL`: `true` si el servidor PostgreSQL usa TLS válido, o `false` si no usa TLS (se recomienda habilitar TLS).
3. Inicializar la base de datos **una sola vez**, desde una terminal segura con conectividad a PostgreSQL, ejecutando `npm install` y `npm run db:init`. Para esta inicialización también configurar `ADMIN_EMAIL`, `ADMIN_PASSWORD` (mínimo 12 caracteres) y opcionalmente `ADMIN_NAME`. No guardar esas credenciales en Git.
4. Desplegar en Vercel y verificar inicio de sesión, alta de funcionarios, creación de menús, pedidos y descarga de PDFs.

**Importante:** PostgreSQL debe permitir conexiones entrantes desde la infraestructura de Vercel. Es preferible una conexión TLS y un pooler externo (por ejemplo PgBouncer) si crece el tráfico. La configuración usa un máximo de dos conexiones por instancia de función, pero el total puede aumentar con el escalado.

Las funciones API usan el runtime Node.js. Los PDF se generan en memoria; no se requiere almacenamiento persistente en el filesystem de Vercel.

## Desarrollo local

Copiar `.env.example` a `.env.local` y completar los valores de forma privada. Ejecutar `npm install`, `npm run db:init` (solo si corresponde) y `npm run dev`.

## Roles

- Administrador: gestiona funcionarios, roles, menús, pedidos y reportes.
- Funcionario: elige una o varias opciones de un menú por fecha y consulta sus pedidos.

Los usuarios son creados por el administrador; no existe registro público.
