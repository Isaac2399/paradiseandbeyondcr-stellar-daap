export function displayNameFromEmail(email: string): string {
  const local = email.split('@')[0] ?? email
  return local
    .replace(/[._-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

export function initialsFromEmail(email: string): string {
  const parts = displayNameFromEmail(email).split(' ').filter(Boolean)
  return (
    (parts[0]?.[0] ?? 'U').toUpperCase() + (parts[1]?.[0] ?? '').toUpperCase()
  )
}

export function handleFromEmail(email: string): string {
  return `@${email.split('@')[0] ?? 'user'}`
}

export function shortenPublicKey(publicKey: string): string {
  if (publicKey.length < 12) {
    return publicKey
  }
  return `${publicKey.slice(0, 6)}…${publicKey.slice(-6)}`
}
