import { formatAmount } from '@/lib/stellar/useAccountBalances'
import { stellarConfig } from '@/lib/stellar/config'
import type { AccountBalances } from '@/lib/stellar/getBalances'

type AccountStripProps = {
  balances: AccountBalances
}

export function AccountStrip({ balances }: AccountStripProps) {
  const cards = [
    { label: stellarConfig.loyalty.code, value: balances.loyalty },
    { label: 'XLM', value: balances.xlm },
    { label: 'USDC', value: balances.usdc },
  ]

  return (
    <section className="space-y-3">
      <h2 className="text-[17px] font-semibold">Cuentas</h2>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {cards.map((card) => (
          <div
            key={card.label}
            className="min-w-28 shrink-0 rounded-[20px] bg-app-card p-4"
          >
            <p className="text-xs text-app-muted">{card.label}</p>
            <p className="mt-2 text-lg font-semibold tabular-nums">
              {formatAmount(card.value)}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}
