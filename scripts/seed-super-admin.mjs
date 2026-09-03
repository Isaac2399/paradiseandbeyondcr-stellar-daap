import { randomBytes, scryptSync } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const email = 'admin@stellarpay.local'
const password = 'Admin1234!'
const publicKey =
  'GC5IQE74UCRCKXJII3G3AYNJHB75JGVD2TQKMDNNR2QZVLKEDVU5E4NJ'
const file = 'data/users.json'

mkdirSync('data', { recursive: true })
const store = existsSync(file)
  ? JSON.parse(readFileSync(file, 'utf8'))
  : { users: [] }
store.users = Array.isArray(store.users) ? store.users : []

const salt = randomBytes(16).toString('hex')
const passwordHash = scryptSync(password, salt, 64).toString('hex')
const existing = store.users.find(
  (user) => String(user.email).toLowerCase() === email,
)

if (existing) {
  existing.role = 'admin'
  existing.publicKey = publicKey
  existing.salt = salt
  existing.passwordHash = passwordHash
  delete existing.secretKeyEnc
} else {
  store.users.push({
    id: randomBytes(12).toString('hex'),
    email,
    salt,
    passwordHash,
    role: 'admin',
    publicKey,
    createdAt: new Date().toISOString(),
  })
}

writeFileSync(file, JSON.stringify(store, null, 2), 'utf8')
console.log('created')
