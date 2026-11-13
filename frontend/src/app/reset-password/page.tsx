"use client";

import React, { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { secureFetch } from "@/lib/api";

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    setLoading(true);
    try {
      const res = await secureFetch("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, new_password: newPassword }),
      });
      setStatus({ type: "ok", text: res.message || "Senha atualizada com sucesso!" });
    } catch (err: unknown) {
      setStatus({ type: "err", text: err instanceof Error ? err.message : "Erro ao redefinir senha." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-lg border border-slate-200 shadow-sm p-8 space-y-5">
        <div className="text-center space-y-2">
          <div className="w-10 h-10 rounded bg-[#0F2942] text-white font-bold flex items-center justify-center mx-auto">
            F
          </div>
          <h1 className="text-lg font-semibold text-slate-900">Redefinir Senha</h1>
        </div>

        {status && (
          <div
            className={`p-3 rounded-md border text-sm ${
              status.type === "ok"
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-red-50 border-red-200 text-red-800"
            }`}
          >
            {status.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="new-pass" className="block text-sm font-medium text-slate-700 mb-1">
              Nova senha (mínimo 8 caracteres)
            </label>
            <input
              id="new-pass"
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-md border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F2942]"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !token}
            className="w-full py-2.5 bg-[#0F2942] hover:bg-[#163a5c] disabled:opacity-60 text-white rounded-md text-sm font-medium transition-colors"
          >
            {loading ? "Salvando..." : "Atualizar Senha"}
          </button>
        </form>

        <div className="text-center">
          <Link href="/" className="text-xs text-slate-600 hover:underline">
            Voltar para o Login
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center text-sm text-slate-500">Carregando...</div>}>
      <ResetPasswordContent />
    </Suspense>
  );
}
