import 'dotenv/config';
import * as bcrypt from 'bcrypt';

interface SeedUser {
  fullName: string;
  email: string;
  password: string;
  role: 'ADMIN' | 'PROFESOR' | 'ESTUDIANTE';
}

const DEMO_USERS: SeedUser[] = [
  {
    fullName: 'Administrador General',
    email: process.env.ADMIN_EMAIL ?? 'admin@nuclear.local',
    password: process.env.ADMIN_PASSWORD ?? 'Admin123*',
    role: 'ADMIN',
  },
  {
    fullName: 'Profa. Carmen Ruiz',
    email: 'profesor@nuclear.local',
    password: 'Profesor123*',
    role: 'PROFESOR',
  },
  {
    fullName: 'Profe. Luis Morales',
    email: 'profesor2@nuclear.local',
    password: 'Profesor123*',
    role: 'PROFESOR',
  },
  {
    fullName: 'Ana Estudiante',
    email: 'estudiante1@nuclear.local',
    password: 'Estudiante123*',
    role: 'ESTUDIANTE',
  },
  {
    fullName: 'Bruno Estudiante',
    email: 'estudiante2@nuclear.local',
    password: 'Estudiante123*',
    role: 'ESTUDIANTE',
  },
  {
    fullName: 'Carla Estudiante',
    email: 'estudiante3@nuclear.local',
    password: 'Estudiante123*',
    role: 'ESTUDIANTE',
  },
];

async function main() {
  const postgrestUrl = process.env.POSTGREST_URL;

  if (!postgrestUrl) {
    throw new Error('POSTGREST_URL no esta definido.');
  }

  const apiKey = process.env.POSTGREST_API_KEY;
  const schema = process.env.POSTGREST_SCHEMA ?? 'public';
  const baseUrl = postgrestUrl.replace(/\/$/, '');

  const headers: HeadersInit = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'Accept-Profile': schema,
    'Content-Profile': schema,
    ...(apiKey ? { apikey: apiKey, Authorization: `Bearer ${apiKey}` } : {}),
  };

  for (const user of DEMO_USERS) {
    const check = await fetch(
      `${baseUrl}/usuarios?email=eq.${encodeURIComponent(user.email)}&select=id,email&limit=1`,
      { headers },
    );

    if (!check.ok) {
      throw new Error(`No se pudo consultar ${user.email}: ${check.status}`);
    }

    const existing = (await check.json()) as Array<{ id: string }>;

    if (existing.length > 0) {
      console.log(`Ya existe: ${user.email} (${user.role})`);
      continue;
    }

    const passwordHash = await bcrypt.hash(user.password, 10);
    const create = await fetch(`${baseUrl}/usuarios`, {
      method: 'POST',
      headers: { ...headers, Prefer: 'return=representation' },
      body: JSON.stringify({
        fullName: user.fullName,
        email: user.email,
        passwordHash,
        role: user.role,
      }),
    });

    if (!create.ok) {
      throw new Error(`No se pudo crear ${user.email}: ${create.status}`);
    }

    console.log(`Creado: ${user.email} (${user.role})`);
  }

  console.log('');
  console.log('Usuarios demo listos:');
  console.log('  ADMIN      -> admin@nuclear.local / Admin123*');
  console.log('  PROFESOR   -> profesor@nuclear.local / Profesor123*');
  console.log('  PROFESOR 2 -> profesor2@nuclear.local / Profesor123*');
  console.log('  ESTUDIANTE -> estudiante1@nuclear.local / Estudiante123*');
  console.log('              estudiante2@nuclear.local / Estudiante123*');
  console.log('              estudiante3@nuclear.local / Estudiante123*');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
