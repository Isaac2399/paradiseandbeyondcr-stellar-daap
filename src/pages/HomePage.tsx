"use client";

import { WalletOverview } from "@/components/dashboard/WalletOverview";
import { CreateInvoiceQR } from "@/components/merchant/CreateInvoiceQR";
import { ScanAndPay } from "@/components/customer/ScanAndPay";
import { Store, User } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";

export default function HomePage() {
  const { user, logout } = useAuth();

  if (!user) {
    return null;
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8 text-slate-900">
      <div className="max-w-xl mx-auto space-y-6">
        <div className="flex items-center justify-between bg-white p-3 rounded-xl shadow-sm border border-slate-200">
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{user.email}</p>
            <p className="text-xs text-slate-500 flex items-center gap-1">
              {user.role === "merchant" ? (
                <Store className="w-3.5 h-3.5" />
              ) : (
                <User className="w-3.5 h-3.5" />
              )}
              {user.role === "merchant" ? "Empresa" : "Cliente"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void logout()}
            className="text-sm text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-lg hover:bg-slate-100"
          >
            Salir
          </button>
        </div>

        <WalletOverview publicKey={user.publicKey} />

        {user.role === "customer" ? (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <h2 className="text-lg font-semibold mb-4">Pagar con QR</h2>
            <ScanAndPay />
          </div>
        ) : (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <h2 className="text-lg font-semibold mb-4">Cobrar / Generar Factura QR</h2>
            <CreateInvoiceQR merchantPublicKey={user.publicKey} />
          </div>
        )}
      </div>
    </main>
  );
}
