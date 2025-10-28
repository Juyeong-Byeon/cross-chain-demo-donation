import { getAddress, isInstalled, on, sendPayment, setTrustline, type SetTrustlineRequest } from "@gemwallet/api"
import type { Amount, IssuedCurrencyAmount, Payment } from "xrpl"

export interface Wallet {
  isInApp: boolean
  addOnLoadListener: (callback: () => void) => () => void
  logIn: () => Promise<{ address: string } | undefined>
  logout: () => void
  openBrowser: (url: string) => void
  requestPayment: (tx: Payment) => Promise<string | undefined>
  setTrustLine: (limitAmount: IssuedCurrencyAmount) => Promise<string | undefined>
}

export class GemWallet implements Wallet {
  constructor() {}

  get isInApp() {
    return false
  }

  async logIn() {
    const installed = await isInstalled()
    if (!installed) {
      throw new Error("GemWallet is not installed")
    }

    const res = await getAddress()
    if (res.result) {
      return { address: res.result.address }
    }
  }

  logout() {
    // no logout
  }

  openBrowser(url: string) {
    window.open(url, "_blank", "noopener,noreferrer")
  }

  async requestPayment(tx: Payment) {
    const result = await sendPayment({
      amount: tx.Amount as Amount,
      destination: tx.Destination,
      sourceTag: tx.SourceTag,
      memos: tx.Memos?.map((m) => ({
        memo: {
          memoType: m.Memo.MemoType,
          memoData: m.Memo.MemoData,
          memoFormat: m.Memo.MemoFormat,
        },
      })),
    })

    return result.result?.hash
  }

  async setTrustLine(limitAmount: IssuedCurrencyAmount) {
    const setTrustLineParams: SetTrustlineRequest = {
      limitAmount,
    }

    const result = await setTrustline(setTrustLineParams)

    return result.result?.hash
  }

  addOnLoadListener(callback: () => void) {
    on("success", () => {
      callback()
    })

    return () => {
      // no off
    }
  }
}
