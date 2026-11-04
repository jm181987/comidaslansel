# Comidas LANSEL

Aplicación para gestión interna de menús, selección de opciones por funcionarios y reportes diarios y mensuales en PDF.

## Instalación

1. Configurar las variables `DATABASE_URL`, `SESSION_SECRET` (32+ caracteres), `ADMIN_EMAIL`, `ADMIN_PASSWORD` (12+ caracteres).
2. Ejecutar `npm install`.
3. Inicializar PostgreSQL con `npm run db:init`.
4. Iniciar con `npm run dev`, o compilar con `npm run build` y luego `npm start`.

La conexión PostgreSQL debe mantenerse exclusivamente en variables de entorno. En Coolify se puede usar el `Dockerfile` del repositorio. No se permite registro público; el administrador da de alta a los empleados.
