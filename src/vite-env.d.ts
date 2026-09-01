/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_STELLAR_NETWORK?: string
  readonly VITE_HORIZON_URL?: string
  readonly VITE_NETWORK_PASSPHRASE?: string
  readonly VITE_USDC_CODE?: string
  readonly VITE_USDC_ISSUER?: string
  readonly VITE_LOYALTY_CODE?: string
  readonly VITE_LOYALTY_ISSUER?: string
  readonly VITE_FEE_BUMP_API_URL?: string
  readonly VITE_POINTS_PER_USDC?: string
  readonly VITE_POINTS_PER_XLM?: string
  readonly VITE_ONRAMP_WIDGET_URL?: string
  readonly VITE_SEP24_HOME_DOMAIN?: string
  readonly NEXT_PUBLIC_STELLAR_NETWORK?: string
  readonly NEXT_PUBLIC_HORIZON_URL?: string
  readonly NEXT_PUBLIC_LOYALTY_CODE?: string
  readonly NEXT_PUBLIC_LOYALTY_ISSUER?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

type FreighterWindowApi = {
  isConnected?: () => Promise<boolean | { isConnected: boolean }>
  requestAccess?: () => Promise<void | { address?: string; error?: { message: string } }>
  getPublicKey: () => Promise<string>
  getAddress?: () => Promise<{ address: string }>
  signTransaction: (
    xdr: string,
    opts?: { networkPassphrase?: string; address?: string },
  ) => Promise<string | { signedTxXdr: string }>
}

interface Window {
  freighterApi?: FreighterWindowApi
}

