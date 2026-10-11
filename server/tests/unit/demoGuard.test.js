import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { assertDemoAllowed } from '../../utils/demoGuard.js';

const SAMPLE = [{ roll_number: 'DEMO1', password: 'Demo-Password-1', name: 'Demo' }];

async function setup() {
  const dir = await mkdtemp(join(tmpdir(), 'irc-demo-'));
  const sample = join(dir, 'sample-users.json');
  await writeFile(sample, JSON.stringify(SAMPLE));
  const real = join(dir, 'users.production.json');
  await writeFile(real, JSON.stringify([{ roll_number: 'REAL1', password: 'Another-Secret-9', name: 'Real' }]));
  return { dir, sample, real, sampleUrl: pathToFileURL(sample) };
}
const run = (ctx, file, users, env, demoFlag = false) =>
  assertDemoAllowed({ file, users, demoFlag, sampleUrl: ctx.sampleUrl, env });

test('ordinary import is unaffected, in any environment', async () => {
  const ctx = await setup();
  await run(ctx, ctx.real, [{ password: 'Another-Secret-9' }], { NODE_ENV: 'production' });
  await run(ctx, ctx.real, [{ password: 'Another-Secret-9' }], {});
});

test('demo data refused in production however it is presented', async () => {
  const ctx = await setup();
  const env = { NODE_ENV: 'production', ALLOW_DEMO_DATA: 'true' };
  await assert.rejects(run(ctx, ctx.sample, SAMPLE, env), /NODE_ENV=production/);
  await assert.rejects(run(ctx, ctx.real, [{ password: 'x' }], env, true), /NODE_ENV=production/);
  const copy = join(ctx.dir, 'renamed-copy.json');
  await writeFile(copy, JSON.stringify(SAMPLE));
  await assert.rejects(run(ctx, copy, SAMPLE, env), /NODE_ENV=production/); // copied file, demo password reused
  const link = join(ctx.dir, 'innocent.json');
  await symlink(ctx.sample, link);
  await assert.rejects(run(ctx, link, [], env), /NODE_ENV=production/); // symlink to the sample file
});

test('demo data in development needs ALLOW_DEMO_DATA=true', async () => {
  const ctx = await setup();
  await assert.rejects(run(ctx, ctx.sample, SAMPLE, { NODE_ENV: 'development' }), /ALLOW_DEMO_DATA/);
  await assert.rejects(run(ctx, ctx.sample, SAMPLE, {}), /ALLOW_DEMO_DATA/);
  await run(ctx, ctx.sample, SAMPLE, { NODE_ENV: 'development', ALLOW_DEMO_DATA: 'true' });
});
