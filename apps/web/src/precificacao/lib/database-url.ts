import fs from 'node:fs'

function isContainerRuntime() {
  // Docker creates `/.dockerenv`. Podman often creates `/run/.containerenv`.
  // We only use this as a heuristic to avoid rewriting localhost URLs on the host machine.
  return fs.existsSync('/.dockerenv') || fs.existsSync('/run/.containerenv')
}

function encodePgComponent(value: string) {
  // Encode user/password safely for inclusion in a connection string.
  return encodeURIComponent(value)
}

export function resolveDatabaseUrl() {
  const directUrl = process.env.DATABASE_URL

  const host = process.env.DATABASE_HOST
  const port = process.env.DATABASE_PORT
  const user = process.env.DATABASE_USER
  const password = process.env.DATABASE_PASSWORD
  const name = process.env.DATABASE_NAME

  // In many docker-compose setups the env files keep a localhost URL for local use,
  // but inside the container `localhost` points to the container itself (not the DB service).
  // If we detect a container runtime and have the DB parts, prefer building the URL.
  const looksLikeLocalhost =
    !directUrl || directUrl.includes('@localhost:') || directUrl.includes('@127.0.0.1:')

  if (isContainerRuntime() && looksLikeLocalhost && host && port && user && password && name) {
    return `postgresql://${encodePgComponent(user)}:${encodePgComponent(password)}@${host}:${port}/${name}`
  }

  return directUrl
}
