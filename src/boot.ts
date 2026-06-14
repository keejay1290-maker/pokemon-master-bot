/* eslint-disable @typescript-eslint/no-var-requires */
// Crash-proof entrypoint. The container previously exited with zero Node output:
// node was crashing during the top-level import phase of index.js (an error that
// happens on the alpine/musl runtime but not on the local Windows machine),
// before any in-app logging could run. Loading the app via require() inside a
// try/catch and writing with fs.writeSync (a synchronous syscall that survives an
// immediate process.exit) guarantees the real error is captured in the logs.
import fs from 'fs';

const w = (fd: number, msg: string) => {
  try {
    fs.writeSync(fd, msg + '\n');
  } catch {
    /* ignore */
  }
};

w(1, '[wrapper] node process started; loading application...');
w(1, `[wrapper] node=${process.version} cwd=${process.cwd()} NODE_ENV=${process.env.NODE_ENV ?? '(unset)'}`);

try {
  require('./index.js');
  w(1, '[wrapper] application module loaded');
} catch (err) {
  w(2, `[wrapper] FATAL during application load: ${(err as Error)?.stack || String(err)}`);
  process.exit(1);
}
