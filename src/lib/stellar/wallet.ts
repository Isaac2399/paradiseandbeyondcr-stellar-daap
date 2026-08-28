import { getAddress, signTransaction } from '@stellar/freighter-api'

export type StellarWallet = {
  getPublicKey: () => Promise<string>
  signTransaction: (
    xdr: string,
    opts: { networkPassphrase: string; address?: string },
  ) => Promise<string>
}

export function getFreighterWallet(): StellarWallet {
  return {
    async getPublicKey() {
      const result = await getAddress()
      if (result.error || !result.address) {
        throw new Error(result.error?.message ?? 'Conecta Freighter para firmar')
      }
      return result.address
    },
    async signTransaction(xdr, opts) {
      const result = await signTransaction(xdr, {
        networkPassphrase: opts.networkPassphrase,
        address: opts.address,
      })
      if (result.error || !result.signedTxXdr) {
        throw new Error(result.error?.message ?? 'Freighter no firmó la transacción')
      }
      return result.signedTxXdr
    },
  }
}
