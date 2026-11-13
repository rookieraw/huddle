import { ChildProcess, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';

const gatewayEntryPoint = path.resolve(__dirname, '../dist/main.js');
const readinessTimeoutMs = 30_000;
const readinessPollMs = 250;

const placeholderEnvironment = {
  DATABASE_URL:
    'postgresql://placeholder:placeholder@localhost:5432/placeholder',
  GITHUB_CALLBACK_URL: 'http://localhost/auth/oauth/github/callback',
  GITHUB_CLIENT_ID: 'startup-spec-github-client',
  GITHUB_CLIENT_SECRET: 'startup-spec-github-secret',
  GOOGLE_CALLBACK_URL: 'http://localhost/auth/oauth/google/callback',
  GOOGLE_CLIENT_ID: 'startup-spec-google-client',
  GOOGLE_CLIENT_SECRET: 'startup-spec-google-secret',
  JWT_SECRET: 'startup-spec-jwt-secret',
};

type RunningGateway = {
  port: number;
  stop: () => Promise<void>;
};

type GatewayOptions = {
  switchInEnvironment?: string;
  dotenvContent?: string;
};

jest.setTimeout(readinessTimeoutMs + 30_000);

describe('API documentation switch at startup (e2e)', () => {
  const running: RunningGateway[] = [];
  const temporaryDirectories: string[] = [];

  beforeAll(() => {
    if (!existsSync(gatewayEntryPoint)) {
      throw new Error(
        `${gatewayEntryPoint} is missing. Run "pnpm --filter api-gateway build" first.`,
      );
    }
  });

  afterEach(async () => {
    await Promise.all(running.splice(0).map((gateway) => gateway.stop()));
    await Promise.all(
      temporaryDirectories
        .splice(0)
        .map((directory) => rm(directory, { recursive: true, force: true })),
    );
  });

  it('enables the routes when the switch is set in the environment', async () => {
    const gateway = await startGateway({ switchInEnvironment: 'true' });

    const response = await fetch(documentationJsonUrl(gateway.port));
    const body = (await response.json()) as { openapi: string };

    expect(response.status).toBe(200);
    expect(body.openapi).toMatch(/^3\.0\.\d+$/);
  });

  it('enables the routes when the switch is set in the .env file', async () => {
    const gateway = await startGateway({
      dotenvContent: 'API_DOCS_ENABLED=true\n',
    });

    const response = await fetch(documentationJsonUrl(gateway.port));

    expect(response.status).toBe(200);
  });

  it('leaves the routes unregistered when the switch is unset', async () => {
    const gateway = await startGateway({});

    const response = await fetch(documentationJsonUrl(gateway.port));

    expect(response.status).toBe(404);
  });

  it('leaves the routes unregistered when the switch is not the enable value', async () => {
    const gateway = await startGateway({ switchInEnvironment: 'false' });

    const response = await fetch(documentationJsonUrl(gateway.port));

    expect(response.status).toBe(404);
  });

  function documentationJsonUrl(port: number): string {
    return `http://127.0.0.1:${port}/docs/api/openapi.json`;
  }

  async function startGateway(
    options: GatewayOptions,
  ): Promise<RunningGateway> {
    // AppModule reads `../../.env` relative to the working directory, so a
    // fresh <tmp>/a/b keeps the repository's own root .env out of the picture.
    const root = await mkdtemp(path.join(tmpdir(), 'huddle-docs-startup-'));
    temporaryDirectories.push(root);
    const workingDirectory = path.join(root, 'a', 'b');
    await mkdir(workingDirectory, { recursive: true });
    if (options.dotenvContent !== undefined) {
      await writeFile(path.join(root, '.env'), options.dotenvContent);
    }

    const port = await findFreePort();
    const environment: NodeJS.ProcessEnv = { ...process.env };
    delete environment.API_DOCS_ENABLED;
    Object.assign(environment, placeholderEnvironment, { PORT: `${port}` });
    if (options.switchInEnvironment !== undefined) {
      environment.API_DOCS_ENABLED = options.switchInEnvironment;
    }

    const child = spawn(process.execPath, [gatewayEntryPoint], {
      cwd: workingDirectory,
      env: environment,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    child.stdout?.on('data', (chunk: Buffer) => (output += chunk.toString()));
    child.stderr?.on('data', (chunk: Buffer) => (output += chunk.toString()));

    const gateway: RunningGateway = { port, stop: () => stopProcess(child) };
    running.push(gateway);
    await waitUntilReady(child, port, () => output);

    return gateway;
  }
});

async function waitUntilReady(
  child: ChildProcess,
  port: number,
  getOutput: () => string,
): Promise<void> {
  const deadline = Date.now() + readinessTimeoutMs;

  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Gateway exited early. Output:\n${getOutput()}`);
    }
    try {
      const response = await fetch(`http://127.0.0.1:${port}/`);
      if (response.status === 200) {
        return;
      }
    } catch {
      // The server is not listening yet.
    }
    await new Promise((resolve) => setTimeout(resolve, readinessPollMs));
  }

  throw new Error(`Gateway was not ready in time. Output:\n${getOutput()}`);
}

async function stopProcess(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null) {
    return;
  }
  const exited = new Promise<void>((resolve) =>
    child.once('exit', () => resolve()),
  );
  child.kill();
  await exited;
}

function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (address === null || typeof address === 'string') {
        reject(new Error('Could not determine a free port.'));
        return;
      }
      server.close(() => resolve(address.port));
    });
  });
}
