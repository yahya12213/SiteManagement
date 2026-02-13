import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';

dotenv.config();

// Configuration commune du pool
const poolConfig = {
  max: 20, // Maximum de connexions dans le pool
  idleTimeoutMillis: 30000, // Fermer les connexions inactives après 30s
  connectionTimeoutMillis: 10000, // Timeout de connexion 10s
  allowExitOnIdle: false, // Ne pas quitter si idle
};

// Railway fournit DATABASE_URL, le développement local utilise des variables séparées
const pool = process.env.DATABASE_URL
  ? new Pool({
    connectionString: process.env.DATABASE_URL,
    // Enable SSL for remote databases (like Railway) even in development
    ssl: process.env.DATABASE_URL.includes('localhost') || process.env.DATABASE_URL.includes('127.0.0.1')
      ? false
      : { rejectUnauthorized: false },
    ...poolConfig,
  })
  : new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'accounting_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    ...poolConfig,
  });

// Test de connexion
pool.on('connect', (client) => {
  console.log('✅ New client connected to PostgreSQL database');
});

pool.on('acquire', (client) => {
  console.log('📊 Client acquired from pool');
});

pool.on('remove', (client) => {
  console.log('🔄 Client removed from pool');
});

pool.on('error', (err, client) => {
  console.error('❌ Unexpected error on idle client:', err.message);
  console.error('Error code:', err.code);
  // Ne PAS quitter le processus - laisser le pool récupérer
  // Le pool tentera automatiquement de se reconnecter
});

// Vérification initiale de la connexion
const testConnection = async () => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    console.log('✅ Database connection verified at:', result.rows[0].now);
    client.release();
  } catch (err) {
    console.error('❌ Initial database connection failed:', err.message);
    console.error('DATABASE_URL configured:', process.env.DATABASE_URL ? 'YES' : 'NO');
  }
};

// Test initial de connexion (ne bloque pas le démarrage)
testConnection();

export default pool;
