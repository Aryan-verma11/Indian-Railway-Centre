import { readFile, realpath } from 'node:fs/promises';

async function sampleInfo(sampleUrl) {
  try {
    const path = await realpath(sampleUrl);
    const rows = JSON.parse(await readFile(path, 'utf8'));
    return { path, passwords: new Set(rows.map((row) => row.password).filter(Boolean)) };
  } catch {
    return { path: null, passwords: new Set() };
  }
}

// Demo data must never reach a real database. The decision does not rely on the file name: the explicit
// --demo flag, the real path of database/sample-users.json (symlinks resolved), or any row that reuses a
// demo password all count as demo data. Demo data is refused in production and otherwise needs
// ALLOW_DEMO_DATA=true.
export async function assertDemoAllowed({ file, users, demoFlag, sampleUrl, env = process.env }) {
  const sample = await sampleInfo(sampleUrl);
  const isSampleFile = sample.path !== null && (await realpath(file)) === sample.path;
  const reusesDemoPassword = Array.isArray(users)
    && users.some((row) => row && typeof row.password === 'string' && sample.passwords.has(row.password));
  if (!demoFlag && !isSampleFile && !reusesDemoPassword) return;

  if (env.NODE_ENV === 'production') {
    throw new Error('Refusing to import demo data (--demo, the sample file, or demo passwords) when NODE_ENV=production.');
  }
  if (env.ALLOW_DEMO_DATA !== 'true') {
    throw new Error('This looks like demo data. Set ALLOW_DEMO_DATA=true in server/.env to import it (development only).');
  }
}
