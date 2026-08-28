import {
  getAddress,
  getNetworkDetails,
  isAllowed,
  isConnected,
  requestAccess,
  WatchWalletChanges,
} from '@stellar/freighter-api'
import { stellarConfig } from './config'

export async function isFreighterInstalled(): Promise<boolean> {
  const result = await isConnected()
  return Boolean(result.isConnected) && !result.error
}

export async function connectFreighterPublicKey(): Promise<string> {
  const installed = await isFreighterInstalled()
  if (!installed) {
    throw new Error(
      'Freighter no está instalado. Añade la extensión y recarga la página.',
    )
  }

  const access = await requestAccess()
  if (access.error || !access.address) {
    throw new Error(access.error?.message ?? 'Freighter rechazó el acceso')
  }
  await assertTestnet()
  return access.address
}

export async function readFreighterPublicKey(): Promise<string | null> {
  const installed = await isFreighterInstalled()
  if (!installed) {
    return null
  }
  const allowed = await isAllowed()
  if (!allowed.isAllowed || allowed.error) {
    return null
  }
  const result = await getAddress()
  if (result.error || !result.address) {
    return null
  }
  return result.address
}

export async function assertTestnet(): Promise<void> {
  const details = await getNetworkDetails()
  if (details.error) {
    return
  }
  if (details.networkPassphrase !== stellarConfig.networkPassphrase) {
    throw new Error(
      `Freighter está en ${details.network}, no en la red de esta app (Testnet).`,
    )
  }
}

export function watchFreighterAddress(
  onAddress: (address: string) => void,
): () => void {
  const watcher = new WatchWalletChanges(1500)
  watcher.watch(({ address }) => {
    if (address) {
      onAddress(address)
    }
  })
  return () => watcher.stop()
}
