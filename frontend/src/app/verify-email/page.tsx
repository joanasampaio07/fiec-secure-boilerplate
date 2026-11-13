"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { secureFetch } from "@/lib/api";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"loading" | "ok" | "err">("loading");
  const [message, setMessage] = useState("Validando seu e-mail...");

  useEffect(() => {
    if (!token) {
      setStatus("err");
      setMessage("Token de verificação não encontrado na URL.");
      return;
    }

    secureFetch(`/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then((res) => {
        setStatus("ok");
        setMessage(res.message || "E-mail confirmado com sucesso!");
      })
      .catch((err: unknown) => {
        setStatus("err");
        setMessage(err instanceof Error ? err.message : "Link inválido ou expirado.");
      });
  }, [token]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-lg border border-slate-200 shadow-sm p-8 text-center space-y-4">
        <div className="w-10 h-10 rounded bg-[#0F2942] text-white font-bold flex items-center justify-center mx-auto">
          F
        </div>
        <h1 className="text-lg font-semibold text-slate-900">Confirmação de Cadastro</h1>
        <p
          className={`text-sm p-3 rounded-md border ${
            status === "ok"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : status === "err"
              ? "bg-red-50 border-red-200 text-red-800"
              : "bg-slate-50 border-slate-200 text-slate-600"
          }`}
        >
          {message}
        </p>
        <Link
          href="/"
          className="inline-block w-full py-2.5 bg-[#0F2942] hover:bg-[#163a5c] text-white rounded-md text-sm font-medium transition-colors"
        >
          Ir para o Login
        </Link>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center text-sm text-slate-500">Carregando...</div>}>
      <VerifyEmailContent />
    </Suspense>
  );
}
