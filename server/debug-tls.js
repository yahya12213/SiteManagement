
import tls from 'tls';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
    console.error('DATABASE_URL not set');
    process.exit(1);
}

// Extract host and port
const match = dbUrl.match(/@([^:]+):(\d+)/);
if (!match) {
    console.error('Could not parse DATABASE_URL');
    process.exit(1);
}

const host = match[1];
const port = parseInt(match[2], 10);

console.log(`Testing TLS connection to ${host}:${port}...`);

const socket = tls.connect(port, host, {
    rejectUnauthorized: false,
    servername: host // SNI
}, () => {
    console.log('✅ TLS connection established!');
    console.log('Cipher:', socket.getCipher());
    socket.end();
});

socket.on('error', (err) => {
    console.error('❌ TLS connection error:', err);
});

socket.on('end', () => {
    console.log('Connection ended');
});
