# Backend simple con Node.js + MySQL + Redis

API mínima en un solo archivo (`server.js`) con:

- Registro de usuario
- Login
- Hash de contraseña con bcrypt
- Persistencia en MySQL
- Cache obligatorio con Redis en `/login`

## 1) Requisitos

- Node.js 18+
- MySQL
- Redis

## 2) Instalación

```bash
npm install
```

## 3) Base de datos

Ejecuta el script SQL:

```bash
mysql -u root -p < init.sql
```

Esto crea:

- Base de datos `simple_auth`
- Tabla `users`

## 4) Variables de entorno

Copia el ejemplo y ajusta valores:

```bash
cp .env.example .env
```

## 5) Ejecutar servidor

```bash
npm start
```

Servidor por defecto: `http://localhost:3000`

---

## Endpoints

### `POST /register`

Body JSON:

```json
{
  "username": "juan",
  "password": "123456"
}
```

Comportamiento:

- Si falta `username` o `password` → `400`
- Si el usuario ya existe → `409`
- Si todo va bien → `201`

### `POST /login`

Body JSON:

```json
{
  "username": "juan",
  "password": "123456"
}
```

Comportamiento:

1. Busca en Redis con key `user:<username>`
2. Si existe en cache, usa ese dato
3. Si no existe, busca en MySQL y lo guarda en Redis con TTL de 300 segundos
4. Compara contraseña con bcrypt
5. Responde éxito o error simple

---

## Flujo simple

### Registro

1. Cliente envía usuario y contraseña
2. El servidor revisa si existe en MySQL
3. Hashea la contraseña con bcrypt
4. Guarda usuario + hash en MySQL

### Login

1. Cliente envía usuario y contraseña
2. El servidor intenta leer usuario desde Redis
3. Si Redis no tiene el usuario, consulta MySQL y lo cachea por 300 segundos
4. Verifica contraseña con bcrypt
5. Devuelve `Login correcto` o `Credenciales inválidas`
