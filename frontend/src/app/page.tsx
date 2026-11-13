"use client";

import React, { useState } from "react";
import { secureFetch } from "@/lib/api";

type UserSession = {
  id: string;
  name: string;
  email: string;
  role: "student" | "admin";
};

export default function FiecPortal() {
  const [view, setView] = useState<"login" | "register" | "forgot" | "dashboard">("login");
  const [session, setSession] = useState<UserSession | null>(null);
  const [feedback, setFeedback] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Estados de formulário
  const [name, setName] = useState("");
  const [email, setEmail] = useState("admin@fiec.org.br");
  const [password, setPassword] = useState("Admin@Fiec2026!");

  // Estados do Agente IA (Aluno)
  const [prompt, setPrompt] = useState("");
  const [aiReply, setAiReply] = useState("");
  const [quota, setQuota] = useState({ used: 0, limit: 5000, remaining: 5000 });

  // Estados do Painel Admin (IAM + SOC)
  const [usersList, setUsersList] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    try {
      const user = await secureFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      setSession(user);
      setView("dashboard");
      if (user.role === "admin") {
        loadAdminData();
      }
    } catch (err: any) {
      setFeedback({ type: "err", text: err.message });
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    try {
      const res = await secureFetch("/auth/register", {
        method: "POST",
        body: JSON.stringify({ name, email, password }),
      });
      setFeedback({ type: "ok", text: res.message });
      setView("login");
    } catch (err: any) {
      setFeedback({ type: "err", text: err.message });
    }
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    try {
      const res = await secureFetch("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setFeedback({ type: "ok", text: res.message });
    } catch (err: any) {
      setFeedback({ type: "err", text: err.message });
    }
  }

  async function handleAskAI(e: React.FormEvent) {
    e.preventDefault();
    if (!prompt.trim()) return;
    setFeedback(null);
    try {
      const res = await secureFetch("/ai/chat", {
        method: "POST",
        body: JSON.stringify({ prompt }),
      });
      // Renderização segura via estado React (escapa HTML automaticamente contra XSS)
      setAiReply(res.reply);
      setQuota({
        used: res.finops.tokens_used_today,
        limit: res.finops.daily_limit,
        remaining: res.finops.remaining,
      });
      setPrompt("");
    } catch (err: any) {
      setFeedback({ type: "err", text: err.message });
    }
  }

  async function loadAdminData() {
    try {
      const [users, logs] = await Promise.all([
        secureFetch("/admin/users"),
        secureFetch("/admin/audit-logs"),
      ]);
      setUsersList(users);
      setAuditLogs(logs);
    } catch (err: any) {
      setFeedback({ type: "err", text: err.message });
    }
  }

  async function handleResetUserPassword(targetEmail: string) {
    try {
      const res = await secureFetch(`/admin/users/${encodeURIComponent(targetEmail)}/reset-password`, {
        method: "PATCH",
        body: JSON.stringify({ temp_password: "Fiec@NovaSenha2026" }),
      });
      setFeedback({ type: "ok", text: res.message });
      loadAdminData();
    } catch (err: any) {
      setFeedback({ type: "err", text: err.message });
    }
  }

  async function handleUpdateQuota(targetEmail: string, newLimit: number) {
    try {
      const res = await secureFetch(`/admin/users/${encodeURIComponent(targetEmail)}/quota`, {
        method: "PATCH",
        body: JSON.stringify({ daily_token_limit: newLimit }),
      });
      setFeedback({ type: "ok", text: res.message });
      loadAdminData();
    } catch (err: any) {
      setFeedback({ type: "err", text: err.message });
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-6 font-sans">
      <header className="max-w-6xl mx-auto flex flex-wrap justify-between items-center border-b border-slate-800 pb-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-cyan-400">Sistema FIEC • Portal Educacional & IA Segura</h1>
          <p className="text-xs text-slate-400">Arquitetura Zero-Trust • LGPD by Design • ISO 27001 / NIST</p>
        </div>
        {session && (
          <nav aria-label="Menu do usuário" className="flex items-center gap-4">
            <span className="text-sm bg-slate-800 px-3 py-1 rounded-full">
              {session.name} ({session.role.toUpperCase()})
            </span>
            <button
              onClick={() => { setSession(null); setView("login"); }}
              className="text-sm bg-rose-600 hover:bg-rose-500 px-3 py-1 rounded"
            >
              Sair
            </button>
          </nav>
        )}
      </header>

      {feedback && (
        <div
          role="alert"
          className={`max-w-6xl mx-auto mb-6 p-4 rounded border ${
            feedback.type === "ok"
              ? "bg-emerald-950/60 border-emerald-500 text-emerald-200"
              : "bg-rose-950/60 border-rose-500 text-rose-200"
          }`}
        >
          {feedback.text}
        </div>
      )}

      {!session ? (
        <section aria-label="Autenticação" className="max-w-md mx-auto bg-slate-900 p-8 rounded-xl border border-slate-800 shadow-xl">
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setView("login")}
              className={`flex-1 py-2 rounded text-sm font-semibold ${view === "login" ? "bg-cyan-600" : "bg-slate-800"}`}
            >
              Entrar
            </button>
            <button
              onClick={() => setView("register")}
              className={`flex-1 py-2 rounded text-sm font-semibold ${view === "register" ? "bg-cyan-600" : "bg-slate-800"}`}
            >
              Criar Conta
            </button>
          </div>

          {view === "login" && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label htmlFor="login-email" className="block text-sm mb-1">E-mail institucional ou pessoal</label>
                <input
                  id="login-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full p-2.5 rounded bg-slate-800 border border-slate-700"
                />
              </div>
              <div>
                <label htmlFor="login-pass" className="block text-sm mb-1">Senha</label>
                <input
                  id="login-pass"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full p-2.5 rounded bg-slate-800 border border-slate-700"
                />
              </div>
              <button type="submit" className="w-full py-2.5 bg-cyan-600 hover:bg-cyan-500 rounded font-semibold">
                Acessar Plataforma
              </button>
              <button
                type="button"
                onClick={() => setView("forgot")}
                className="w-full text-xs text-cyan-400 hover:underline mt-2"
              >
                Esqueci minha senha
              </button>
            </form>
          )}

          {view === "register" && (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label htmlFor="reg-name" className="block text-sm mb-1">Nome Completo</label>
                <input
                  id="reg-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full p-2.5 rounded bg-slate-800 border border-slate-700"
                />
              </div>
              <div>
                <label htmlFor="reg-email" className="block text-sm mb-1">E-mail</label>
                <input
                  id="reg-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full p-2.5 rounded bg-slate-800 border border-slate-700"
                />
              </div>
              <div>
                <label htmlFor="reg-pass" className="block text-sm mb-1">Senha Forte (mín. 8 caracteres)</label>
                <input
                  id="reg-pass"
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full p-2.5 rounded bg-slate-800 border border-slate-700"
                />
              </div>
              <button type="submit" className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded font-semibold">
                Cadastrar e Enviar Confirmação
              </button>
            </form>
          )}

          {view === "forgot" && (
            <form onSubmit={handleForgot} className="space-y-4">
              <p className="text-sm text-slate-300">Informe seu e-mail para receber o link seguro de redefinição (Mailpit porta 8025).</p>
              <div>
                <label htmlFor="forgot-email" className="block text-sm mb-1">E-mail cadastrado</label>
                <input
                  id="forgot-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full p-2.5 rounded bg-slate-800 border border-slate-700"
                />
              </div>
              <button type="submit" className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 rounded font-semibold">
                Enviar Link de Recuperação
              </button>
              <button type="button" onClick={() => setView("login")} className="w-full text-xs text-slate-400 hover:underline">
                Voltar para o login
              </button>
            </form>
          )}
        </section>
      ) : (
        <div className="max-w-6xl mx-auto space-y-8">
          {/* MÓDULO DO ALUNO: AGENTE DE IA COM CONTROLE DE TOKENS */}
          <section aria-label="Assistente Virtual IA" className="bg-slate-900 p-6 rounded-xl border border-slate-800">
            <div className="flex flex-wrap justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-cyan-400">Assistente Acadêmico IA (Protegido por LGPD & Circuit Breaker)</h2>
              <div className="text-xs bg-slate-800 px-3 py-1.5 rounded border border-slate-700">
                FinOps Tokens Hoje: <strong>{quota.used}</strong> / {quota.limit} (Restantes: {quota.remaining})
              </div>
            </div>
            <form onSubmit={handleAskAI} className="flex gap-3">
              <label htmlFor="ai-prompt" className="sr-only">Digite sua dúvida para o assistente</label>
              <input
                id="ai-prompt"
                type="text"
                placeholder="Pergunte sobre matrícula, certificados ou suporte..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="flex-1 p-3 rounded bg-slate-800 border border-slate-700"
              />
              <button type="submit" className="px-6 py-3 bg-cyan-600 hover:bg-cyan-500 rounded font-semibold">
                Enviar
              </button>
            </form>
            {aiReply && (
              <div className="mt-4 p-4 rounded bg-slate-800/80 border border-cyan-800 text-sm text-slate-200">
                {aiReply}
              </div>
            )}
          </section>

          {/* MÓDULO DO ADMIN: IAM + TRILHA DE AUDITORIA SOC + LINKS NOC */}
          {session.role === "admin" && (
            <section aria-label="Painel Administrativo SOC/NOC" className="bg-slate-900 p-6 rounded-xl border border-amber-700/50 space-y-6">
              <div className="flex flex-wrap justify-between items-center">
                <h2 className="text-lg font-bold text-amber-400">Painel de Governança IAM, FinOps & SOC</h2>
                <div className="flex gap-3 text-xs">
                  <a href="http://localhost:3001" target="_blank" rel="noreferrer" className="bg-indigo-600 px-3 py-1.5 rounded hover:bg-indigo-500">
                    Abrir Grafana (NOC/SOC)
                  </a>
                  <a href="http://localhost:8025" target="_blank" rel="noreferrer" className="bg-teal-600 px-3 py-1.5 rounded hover:bg-teal-500">
                    Abrir Mailpit (E-mails)
                  </a>
                  <button onClick={loadAdminData} className="bg-slate-700 px-3 py-1.5 rounded hover:bg-slate-600">
                    Atualizar Dados
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-slate-700 text-slate-400">
                      <th className="py-2">Usuário</th>
                      <th className="py-2">Perfil</th>
                      <th className="py-2">Verificado</th>
                      <th className="py-2">Cota Diária Tokens</th>
                      <th className="py-2">Ações IAM</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usersList.map((u) => (
                      <tr key={u.email} className="border-b border-slate-800">
                        <td className="py-2.5">{u.name} <span className="text-xs text-slate-400">({u.email})</span></td>
                        <td className="py-2.5 uppercase text-xs">{u.role}</td>
                        <td className="py-2.5">{u.is_verified ? "✅ Sim" : "⏳ Pendente"}</td>
                        <td className="py-2.5">{u.daily_token_limit}</td>
                        <td className="py-2.5 flex gap-2">
                          <button
                            onClick={() => handleResetUserPassword(u.email)}
                            className="text-xs bg-amber-600/80 hover:bg-amber-600 px-2.5 py-1 rounded"
                          >
                            Resetar Senha
                          </button>
                          <button
                            onClick={() => handleUpdateQuota(u.email, u.daily_token_limit + 5000)}
                            className="text-xs bg-cyan-700 hover:bg-cyan-600 px-2.5 py-1 rounded"
                          >
                            +5k Tokens
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-slate-300 mb-2">Trilha de Auditoria Imutável (MongoDB • LGPD Mascarada)</h3>
                <div className="bg-slate-950 p-3 rounded border border-slate-800 max-h-48 overflow-y-auto text-xs font-mono space-y-1">
                  {auditLogs.length === 0 && <p className="text-slate-500">Nenhum evento registrado ainda.</p>}
                  {auditLogs.map((log, idx) => (
                    <div key={idx} className="text-slate-300">
                      <span className="text-cyan-400">[{log.timestamp}]</span>{" "}
                      <span className="text-amber-400">{log.action}</span> | {log.actor} | {log.status} — {log.details}
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}
        </div>
      )}
    </main>
  );
}

