const { spawn } = require('child_process')

const args = process.argv.slice(2)
const command = process.platform === 'win32' ? 'electron-vite.cmd' : 'electron-vite'
const env = { ...process.env }

delete env.ELECTRON_RUN_AS_NODE

const child = spawn(command, args, {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env
})

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }
  process.exit(code ?? 0)
})
