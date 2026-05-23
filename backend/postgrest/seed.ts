import 'dotenv/config';
import * as bcrypt from 'bcrypt';

async function main() {
  const postgrestUrl = process.env.POSTGREST_URL;

  if (!postgrestUrl) {
    throw new Error('POSTGREST_URL no esta definido.');
  }

  const adminEmail = process.env.ADMIN_EMAIL ?? 'admin@nuclear.local';
  const adminPassword = process.env.ADMIN_PASSWORD ?? 'Admin123*';
  const adminFullName = process.env.ADMIN_FULL_NAME ?? 'Administrador General';
  const apiKey = process.env.POSTGREST_API_KEY;
  const schema = process.env.POSTGREST_SCHEMA ?? 'public';

  const headers: HeadersInit = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'Accept-Profile': schema,
    'Content-Profile': schema,
    ...(apiKey ? { apikey: apiKey, Authorization: `Bearer ${apiKey}` } : {}),
  };

  const baseUrl = postgrestUrl.replace(/\/$/, '');
  const existingResponse = await fetch(
    `${baseUrl}/usuarios?email=eq.${encodeURIComponent(adminEmail)}&select=id&limit=1`,
    { headers },
  );

  if (!existingResponse.ok) {
    throw new Error(`No se pudo consultar el admin: ${existingResponse.status}`);
  }

  const existingUsers = (await existingResponse.json()) as Array<{ id: string }>;

  if (existingUsers.length > 0) {
    console.log(`Admin ya existe: ${adminEmail}`);
    return;
  }

  const passwordHash = await bcrypt.hash(adminPassword, 10);

  const createResponse = await fetch(`${baseUrl}/usuarios`, {
    method: 'POST',
    headers: {
      ...headers,
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      fullName: adminFullName,
      email: adminEmail,
      passwordHash,
      role: 'ADMIN',
    }),
  });

  if (!createResponse.ok) {
    throw new Error(`No se pudo crear el admin: ${createResponse.status}`);
  }

  console.log(`Admin creado: ${adminEmail}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
