import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const backendDir = path.join(rootDir, 'backend');
const programCsPath = path.join(backendDir, 'Program.cs');

let autoRetriedSinceLastSuccess = false;
let retryTimer = null;

function startDotnetWatch() {
  const child = spawn(
    'dotnet',
    [
      'watch',
      '--no-hot-reload',
      '--non-interactive',
      '--project',
      'backend',
      'run',
      '--urls',
      'http://localhost:5000'
    ],
    {
      cwd: rootDir,
      stdio: ['inherit', 'pipe', 'pipe'],
      env: { ...process.env, DOTNET_WATCH_RESTART_ON_RUDE_EDIT: '1' }
    }
  );

  const handleOutput = (chunk, isErr = false) => {
    const text = chunk.toString();
    if (isErr) {
      process.stderr.write(chunk);
    } else {
      process.stdout.write(chunk);
    }

    // Jakmile server úspěšně naběhne nebo začne nová kompilace po reálné změně, povolíme případný auto-retry
    if (
      text.includes('Now listening on:') ||
      text.includes('Application started') ||
      text.includes('File changed:')
    ) {
      if (text.includes('Now listening on:') || text.includes('Application started')) {
        autoRetriedSinceLastSuccess = false;
      }
    }

    // Pokud dotnet watch spadne do "Waiting for a file to change before restarting"
    // (typicky když se během kompilace 1. souboru teprve ukládal 2. soubor nebo byl dočasně zamčený .dll),
    // po 1.5 s automaticky обновíme mtime Program.cs, aby dotnet watch okamžitě zkompiloval finální stav.
    if (text.includes('Waiting for a file to change before restarting')) {
      if (!autoRetriedSinceLastSuccess) {
        autoRetriedSinceLastSuccess = true;
        if (retryTimer) clearTimeout(retryTimer);
        retryTimer = setTimeout(() => {
          try {
            const now = new Date();
            fs.utimesSync(programCsPath, now, now);
            console.log(
              '\x1b[33m[dev-backend] Detekováno zastavení dotnet watch během vícečetné úpravy – automaticky spouštím rekompilaci...\x1b[0m'
            );
          } catch {}
        }, 1500);
      }
    }
  };

  child.stdout.on('data', (d) => handleOutput(d, false));
  child.stderr.on('data', (d) => handleOutput(d, true));

  child.on('exit', (code) => {
    process.exit(code ?? 1);
  });
}

startDotnetWatch();
