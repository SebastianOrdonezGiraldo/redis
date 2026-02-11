require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const redis = require('redis');
const bcrypt = require('bcrypt');

const app = express();
app.use(express.json());

// Configuración mínima
const PORT = process.env.PORT || 3000;
const SALT_ROUNDS = 10;

// Conexión a MySQL (pool sencillo)
const mysqlPool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10
});

// Cliente oficial de Redis
const redisClient = redis.createClient({
  url: process.env.REDIS_URL
});

redisClient.on('error', (err) => {
  console.error('Error de Redis:', err.message);
});

// POST /register
// 1) Recibe username y password
// 2) Hashea password con bcrypt
// 3) Guarda usuario en MySQL
app.post('/register', async (req, res) => {
  const { username, password } = req.body;

  // Validación mínima (sin librerías externas)
  if (!username || !password) {
    return res.status(400).json({ message: 'username y password son obligatorios' });
  }

  try {
    // Verificar si ya existe
    const [rows] = await mysqlPool.execute(
      'SELECT id FROM users WHERE username = ? LIMIT 1',
      [username]
    );

    if (rows.length > 0) {
      return res.status(409).json({ message: 'El usuario ya existe' });
    }

    // Hash de contraseña
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // Guardar en MySQL
    await mysqlPool.execute(
      'INSERT INTO users (username, password_hash) VALUES (?, ?)',
      [username, passwordHash]
    );

    return res.status(201).json({ message: 'Usuario registrado correctamente' });
  } catch (error) {
    console.error('Error en /register:', error.message);
    return res.status(500).json({ message: 'Error interno' });
  }
});

// POST /login
// Flujo:
// 1) Buscar usuario en Redis usando key: user:<username>
// 2) Si no existe en cache, buscar en MySQL y guardar en Redis (TTL 300)
// 3) Comparar password recibido contra hash con bcrypt
app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'username y password son obligatorios' });
  }

  const redisKey = `user:${username}`;

  try {
    let userData;

    // Intentar obtener de Redis
    const cachedUser = await redisClient.get(redisKey);

    if (cachedUser) {
      userData = JSON.parse(cachedUser);
      console.log(`Login: usuario ${username} encontrado en Redis`);
    } else {
      // Si no está en cache, consultar MySQL
      const [rows] = await mysqlPool.execute(
        'SELECT id, username, password_hash FROM users WHERE username = ? LIMIT 1',
        [username]
      );

      if (rows.length === 0) {
        return res.status(401).json({ message: 'Credenciales inválidas' });
      }

      userData = rows[0];

      // Guardar en Redis por 300 segundos
      await redisClient.setEx(redisKey, 300, JSON.stringify(userData));
      console.log(`Login: usuario ${username} guardado en Redis (TTL 300)`);
    }

    // Comparar contraseña
    const isPasswordValid = await bcrypt.compare(password, userData.password_hash);

    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    return res.json({ message: 'Login correcto' });
  } catch (error) {
    console.error('Error en /login:', error.message);
    return res.status(500).json({ message: 'Error interno' });
  }
});

// Inicialización simple: conectar Redis y luego levantar servidor
async function startServer() {
  try {
    await redisClient.connect();
    console.log('Conectado a Redis');

    // Prueba simple de MySQL
    await mysqlPool.query('SELECT 1');
    console.log('Conectado a MySQL');

    app.listen(PORT, () => {
      console.log(`Servidor corriendo en http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('No se pudo iniciar el servidor:', error.message);
    process.exit(1);
  }
}

startServer();
