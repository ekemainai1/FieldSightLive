import { spawnSync } from 'node:child_process'

const emulatorMode = process.argv.includes('--emulator')

function run(command, args, env = process.env) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    env,
  })

  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

run('npm', ['--prefix', 'frontend', 'run', 'test:ci'])

if (emulatorMode) {
  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    console.error('FIRESTORE_EMULATOR_HOST is required for --emulator mode')
    process.exit(1)
  }
  run('npm', ['--prefix', 'backend', 'run', 'test:ci:emulator'])
} else {
  run('npm', ['--prefix', 'backend', 'run', 'test:ci'])
}
