
import bcrypt from 'bcryptjs';

async function generate() {
    const pass = 'admin123';
    const hash = await bcrypt.hash(pass, 10);
    console.log(`Password: ${pass}`);
    console.log(`Hash: ${hash}`);

    const pass2 = 'khalidfathi';
    const hash2 = await bcrypt.hash(pass2, 10);
    console.log(`Password: ${pass2}`);
    console.log(`Hash: ${hash2}`);
}

generate();
