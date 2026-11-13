"use client";

import React, { useState } from "react";
import { secureFetch, setAuthToken } from "@/lib/api";

type UserSession = {
  id: string;
  name: string;
  email: string;
  role: "student" | "admin";
  must_change_password?: boolean;
};

type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  is_verified: boolean;
  daily_token_limit: number;
};

type AuditLog = {
  timestamp: string;
  action: string;
  actor: string;
  status: string;
  details: string;
};

export default function FiecPortal() {
  const [view, setView] = useState<"login" | "register" | "forgot" | "dashboard">("login");
  const [activeTab, setActiveTab] = useState<"assistant" | "users" | "audit">("assistant");
  const [session, setSession] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("admin@fiec.org.br");
  const [password, setPassword] = useState("Admin@Fiec2026!");
  const [newPassword, setNewPassword] = useState("");

  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; text: string }[]>([]);
  const [quota, setQuota] = useState({ used: 0, limit: 5000, remaining: 5000 });

  const [usersList, setUsersList] = useState<AdminUser[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    setLoading(true);
    try {
      const user = await secureFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      if (user.access_token) {
        setAuthToken(user.access_token);
      }
      setSession(user);
      setView("dashboard");
      setActiveTab("assistant");
      if (user.role === "admin") {
        await loadAdminData();
      }
    } catch (err: unknown) {
      setFeedback({ type: "err", text: err instanceof Error ? err.message : "Erro ao autenticar." });
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    setLoading(true);
    try {
      const res = await secureFetch("/auth/register", {
        method: "POST",
        body: JSON.stringify({ name, email }),
      });
      setFeedback({ type: "ok", text: res.message });
      setPassword("");
      setView("login");
    } catch (err: unknown) {
      setFeedback({ type: "err", text: err instanceof Error ? err.message : "Erro ao cadastrar." });
    } finally {
      setLoading(false);
    }
  }

  async function handleFirstAccessPassword(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    setLoading(true);
    try {
      const res = await secureFetch("/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ new_password: newPassword }),
      });
      setSession((prev) => (prev ? { ...prev, must_change_password: false } : prev));
      setNewPassword("");
      setFeedback({ type: "ok", text: res.message });
    } catch (err: unknown) {
      setFeedback({ type: "err", text: err instanceof Error ? err.message : "Erro ao atualizar senha." });
    } finally {
      setLoading(false);
    }
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    setLoading(true);
    try {
      const res = await secureFetch("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setFeedback({ type: "ok", text: res.message });
    } catch (err: unknown) {
      setFeedback({ type: "err", text: err instanceof Error ? err.message : "Erro ao enviar solicitação." });
    } finally {
      setLoading(false);
    }
  }

  async function handleAskAI(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = prompt.trim();
    if (!trimmed) return;
    setFeedback(null);
    setLoading(true);
    setMessages((prev) => [...prev, { role: "user", text: trimmed }]);
    setPrompt("");
    try {
      const res = await secureFetch("/ai/chat", {
        method: "POST",
        body: JSON.stringify({ prompt: trimmed }),
      });
      setMessages((prev) => [...prev, { role: "assistant", text: res.reply }]);
      setQuota({
        used: res.finops.tokens_used_today,
        limit: res.finops.daily_limit,
        remaining: res.finops.remaining,
      });
    } catch (err: unknown) {
      setFeedback({ type: "err", text: err instanceof Error ? err.message : "Erro ao consultar assistente." });
    } finally {
      setLoading(false);
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
    } catch (err: unknown) {
      setFeedback({ type: "err", text: err instanceof Error ? err.message : "Erro ao carregar dados administrativos." });
    }
  }

  async function handleResetUserPassword(targetEmail: string) {
    try {
      const res = await secureFetch(`/admin/users/${encodeURIComponent(targetEmail)}/reset-password`, {
        method: "PATCH",
        body: JSON.stringify({ temp_password: "Fiec@NovaSenha2026" }),
      });
      setFeedback({ type: "ok", text: res.message });
      await loadAdminData();
    } catch (err: unknown) {
      setFeedback({ type: "err", text: err instanceof Error ? err.message : "Erro ao redefinir senha." });
    }
  }

  async function handleUpdateQuota(targetEmail: string, newLimit: number) {
    try {
      const res = await secureFetch(`/admin/users/${encodeURIComponent(targetEmail)}/quota`, {
        method: "PATCH",
        body: JSON.stringify({ daily_token_limit: newLimit }),
      });
      setFeedback({ type: "ok", text: res.message });
      await loadAdminData();
    } catch (err: unknown) {
      setFeedback({ type: "err", text: err instanceof Error ? err.message : "Erro ao atualizar cota." });
    }
  }

  function handleLogout() {
    setAuthToken(null);
    setSession(null);
    setMessages([]);
    setUsersList([]);
    setAuditLogs([]);
    setFeedback(null);
    setView("login");
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-[#0F2942] text-white font-bold text-sm flex items-center justify-center">
              F
            </div>
            <div>
              <h1 className="text-base font-semibold text-slate-900 leading-tight">
                Portal Acadêmico FIEC
              </h1>
              <p className="text-xs text-slate-500">Sistema Integrado de Atendimento e Gestão</p>
            </div>
          </div>

          {session && (
            <nav aria-label="Menu do usuário" className="flex items-center gap-4">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-slate-800">{session.name}</p>
                <p className="text-xs text-slate-500 uppercase">{session.role}</p>
              </div>
              <button
                onClick={handleLogout}
                className="text-sm font-medium text-slate-700 hover:text-slate-900 border border-slate-300 hover:bg-slate-100 px-3 py-1.5 rounded-md transition-colors"
              >
                Sair
              </button>
            </nav>
          )}
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-8">
        {feedback && (
          <div
            role="alert"
            className={`mb-6 px-4 py-3 rounded-md border text-sm flex items-center justify-between ${
              feedback.type === "ok"
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-red-50 border-red-200 text-red-800"
            }`}
          >
            <span>{feedback.text}</span>
            <button
              onClick={() => setFeedback(null)}
              className="text-xs font-medium underline ml-4"
            >
              Fechar
            </button>
          </div>
        )}

        {!session ? (
          <div className="max-w-md mx-auto mt-8 bg-white rounded-lg border border-slate-200 shadow-sm p-8">
            <div className="flex border-b border-slate-200 mb-6">
              <button
                onClick={() => { setView("login"); setFeedback(null); }}
                className={`flex-1 pb-3 text-sm font-medium border-b-2 transition-colors ${
                  view === "login"
                    ? "border-[#0F2942] text-[#0F2942]"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                Entrar
              </button>
              <button
                onClick={() => { setView("register"); setFeedback(null); }}
                className={`flex-1 pb-3 text-sm font-medium border-b-2 transition-colors ${
                  view === "register"
                    ? "border-[#0F2942] text-[#0F2942]"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                Criar Conta
              </button>
            </div>

            {view === "login" && (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label htmlFor="login-email" className="block text-sm font-medium text-slate-700 mb-1">
                    E-mail
                  </label>
                  <input
                    id="login-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded-md border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F2942] focus:border-transparent"
                  />
                </div>
                <div>
                  <label htmlFor="login-pass" className="block text-sm font-medium text-slate-700 mb-1">
                    Senha
                  </label>
                  <input
                    id="login-pass"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-2 rounded-md border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F2942] focus:border-transparent"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-[#0F2942] hover:bg-[#163a5c] disabled:opacity-60 text-white rounded-md text-sm font-medium transition-colors"
                >
                  {loading ? "Autenticando..." : "Acessar Plataforma"}
                </button>
                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={() => setView("forgot")}
                    className="text-xs text-slate-600 hover:text-[#0F2942] hover:underline"
                  >
                    Esqueci minha senha
                  </button>
                </div>
              </form>
            )}

            {view === "register" && (
              <form onSubmit={handleRegister} className="space-y-4">
                <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-md border border-slate-200">
                  Informe seu nome e e-mail. Você receberá uma <strong>senha provisória</strong> para o primeiro acesso.
                </p>
                <div>
                  <label htmlFor="reg-name" className="block text-sm font-medium text-slate-700 mb-1">
                    Nome completo
                  </label>
                  <input
                    id="reg-name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 rounded-md border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F2942]"
                  />
                </div>
                <div>
                  <label htmlFor="reg-email" className="block text-sm font-medium text-slate-700 mb-1">
                    E-mail
                  </label>
                  <input
                    id="reg-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded-md border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F2942]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-[#0F2942] hover:bg-[#163a5c] disabled:opacity-60 text-white rounded-md text-sm font-medium transition-colors"
                >
                  {loading ? "Cadastrando..." : "Criar Conta e Enviar Senha"}
                </button>
              </form>
            )}

            {view === "forgot" && (
              <form onSubmit={handleForgot} className="space-y-4">
                <p className="text-sm text-slate-600">
                  Informe seu e-mail cadastrado para receber o link de redefinição de senha.
                </p>
                <div>
                  <label htmlFor="forgot-email" className="block text-sm font-medium text-slate-700 mb-1">
                    E-mail
                  </label>
                  <input
                    id="forgot-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded-md border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F2942]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-[#0F2942] hover:bg-[#163a5c] disabled:opacity-60 text-white rounded-md text-sm font-medium transition-colors"
                >
                  {loading ? "Enviando..." : "Enviar link de recuperação"}
                </button>
                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => setView("login")}
                    className="text-xs text-slate-600 hover:underline"
                  >
                    Voltar para o login
                  </button>
                </div>
              </form>
            )}
          </div>
        ) : session.must_change_password ? (
          <div className="max-w-md mx-auto mt-8 bg-white rounded-lg border border-slate-200 shadow-sm p-8 space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">Primeiro Acesso</h2>
            <p className="text-sm text-slate-600">
              Por segurança, defina uma nova senha definitiva para continuar acessando o portal.
            </p>
            <form onSubmit={handleFirstAccessPassword} className="space-y-4">
              <div>
                <label htmlFor="first-new-pass" className="block text-sm font-medium text-slate-700 mb-1">
                  Nova senha (mínimo 8 caracteres)
                </label>
                <input
                  id="first-new-pass"
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
                disabled={loading}
                className="w-full py-2.5 bg-[#0F2942] hover:bg-[#163a5c] disabled:opacity-60 text-white rounded-md text-sm font-medium transition-colors"
              >
                {loading ? "Salvando..." : "Salvar Nova Senha e Entrar"}
              </button>
            </form>
          </div>
        ) : (
          <div className="space-y-6">
            {session.role === "admin" && (
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-3">
                <div className="flex gap-2">
                  <button
                    onClick={() => setActiveTab("assistant")}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      activeTab === "assistant"
                        ? "bg-[#0F2942] text-white"
                        : "text-slate-600 hover:bg-slate-200/70"
                    }`}
                  >
                    Assistente Acadêmico
                  </button>
                  <button
                    onClick={() => { setActiveTab("users"); loadAdminData(); }}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      activeTab === "users"
                        ? "bg-[#0F2942] text-white"
                        : "text-slate-600 hover:bg-slate-200/70"
                    }`}
                  >
                    Usuários e Cotas
                  </button>
                  <button
                    onClick={() => { setActiveTab("audit"); loadAdminData(); }}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      activeTab === "audit"
                        ? "bg-[#0F2942] text-white"
                        : "text-slate-600 hover:bg-slate-200/70"
                    }`}
                  >
                    Auditoria
                  </button>
                </div>
                <button
                  onClick={loadAdminData}
                  className="text-xs font-medium text-slate-600 hover:text-slate-900 border border-slate-300 bg-white px-3 py-1.5 rounded-md"
                >
                  Atualizar dados
                </button>
              </div>
            )}

            {activeTab === "assistant" && (
              <section aria-label="Assistente Acadêmico" className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
                <div className="flex flex-wrap justify-between items-center gap-2 pb-4 mb-4 border-b border-slate-100">
                  <div>
                    <h2 className="text-base font-semibold text-slate-900">Assistente Acadêmico</h2>
                    <p className="text-xs text-slate-500">Atendimento sobre matrículas, certificados e suporte técnico</p>
                  </div>
                  <div className="text-xs text-slate-600 bg-slate-100 px-3 py-1.5 rounded-md border border-slate-200">
                    Cota diária: <strong>{quota.used}</strong> / {quota.limit} tokens
                  </div>
                </div>

                <div className="space-y-3 mb-4 min-h-[180px] max-h-[360px] overflow-y-auto p-4 bg-slate-50 rounded-md border border-slate-200">
                  {messages.length === 0 ? (
                    <p className="text-sm text-slate-400 text-center py-12">
                      Envie uma pergunta abaixo para iniciar o atendimento.
                    </p>
                  ) : session.must_change_password ? (
          <div className="max-w-md mx-auto mt-8 bg-white rounded-lg border border-slate-200 shadow-sm p-8 space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">Primeiro Acesso</h2>
            <p className="text-sm text-slate-600">
              Por segurança, defina uma nova senha definitiva para continuar acessando o portal.
            </p>
            <form onSubmit={handleFirstAccessPassword} className="space-y-4">
              <div>
                <label htmlFor="first-new-pass" className="block text-sm font-medium text-slate-700 mb-1">
                  Nova senha (mínimo 8 caracteres)
                </label>
                <input
                  id="first-new-pass"
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
                disabled={loading}
                className="w-full py-2.5 bg-[#0F2942] hover:bg-[#163a5c] disabled:opacity-60 text-white rounded-md text-sm font-medium transition-colors"
              >
                {loading ? "Salvando..." : "Salvar Nova Senha e Entrar"}
              </button>
            </form>
          </div>
        ) : (
                    messages.map((m, i) => (
                      <div
                        key={i}
                        className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-lg px-4 py-2.5 text-sm ${
                            m.role === "user"
                              ? "bg-[#0F2942] text-white"
                              : "bg-white border border-slate-200 text-slate-800"
                          }`}
                        >
                          {m.text}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <form onSubmit={handleAskAI} className="flex gap-3">
                  <label htmlFor="ai-prompt" className="sr-only">Digite sua dúvida</label>
                  <input
                    id="ai-prompt"
                    type="text"
                    placeholder="Pergunte sobre matrícula, certificados ou suporte..."
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    className="flex-1 px-3 py-2.5 rounded-md border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F2942]"
                  />
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-5 py-2.5 bg-[#0F2942] hover:bg-[#163a5c] disabled:opacity-60 text-white rounded-md text-sm font-medium transition-colors"
                  >
                    {loading ? "Enviando..." : "Enviar"}
                  </button>
                </form>
              </section>
            )}

            {session.role === "admin" && activeTab === "users" && (
              <section aria-label="Gestão de Usuários" className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200">
                  <h2 className="text-base font-semibold text-slate-900">Usuários e Cotas de Uso</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs uppercase">
                      <tr>
                        <th className="px-6 py-3 font-medium">Usuário</th>
                        <th className="px-6 py-3 font-medium">Perfil</th>
                        <th className="px-6 py-3 font-medium">Status</th>
                        <th className="px-6 py-3 font-medium">Cota Diária</th>
                        <th className="px-6 py-3 font-medium text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {usersList.map((u) => (
                        <tr key={u.email} className="hover:bg-slate-50">
                          <td className="px-6 py-3.5">
                            <p className="font-medium text-slate-900">{u.name}</p>
                            <p className="text-xs text-slate-500">{u.email}</p>
                          </td>
                          <td className="px-6 py-3.5 uppercase text-xs font-medium text-slate-600">{u.role}</td>
                          <td className="px-6 py-3.5">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                u.is_verified
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  : "bg-amber-50 text-amber-700 border border-amber-200"
                              }`}
                            >
                              {u.is_verified ? "Ativo" : "Pendente"}
                            </span>
                          </td>
                          <td className="px-6 py-3.5 text-slate-700">{u.daily_token_limit.toLocaleString("pt-BR")} tokens</td>
                          <td className="px-6 py-3.5 text-right space-x-2">
                            <button
                              onClick={() => handleResetUserPassword(u.email)}
                              className="text-xs font-medium text-slate-700 hover:text-slate-900 border border-slate-300 px-2.5 py-1 rounded hover:bg-slate-100"
                            >
                              Resetar senha
                            </button>
                            <button
                              onClick={() => handleUpdateQuota(u.email, u.daily_token_limit + 5000)}
                              className="text-xs font-medium text-[#0F2942] border border-[#0F2942]/30 px-2.5 py-1 rounded hover:bg-slate-100"
                            >
                              +5.000 tokens
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {session.role === "admin" && activeTab === "audit" && (
              <section aria-label="Trilha de Auditoria" className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200">
                  <h2 className="text-base font-semibold text-slate-900">Registro de Auditoria</h2>
                  <p className="text-xs text-slate-500">Eventos recentes do sistema com mascaramento de dados pessoais</p>
                </div>
                <div className="divide-y divide-slate-100 max-h-[420px] overflow-y-auto">
                  {auditLogs.length === 0 ? (
                    <p className="px-6 py-8 text-sm text-slate-500 text-center">Nenhum evento registrado ainda.</p>
                  ) : session.must_change_password ? (
          <div className="max-w-md mx-auto mt-8 bg-white rounded-lg border border-slate-200 shadow-sm p-8 space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">Primeiro Acesso</h2>
            <p className="text-sm text-slate-600">
              Por segurança, defina uma nova senha definitiva para continuar acessando o portal.
            </p>
            <form onSubmit={handleFirstAccessPassword} className="space-y-4">
              <div>
                <label htmlFor="first-new-pass" className="block text-sm font-medium text-slate-700 mb-1">
                  Nova senha (mínimo 8 caracteres)
                </label>
                <input
                  id="first-new-pass"
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
                disabled={loading}
                className="w-full py-2.5 bg-[#0F2942] hover:bg-[#163a5c] disabled:opacity-60 text-white rounded-md text-sm font-medium transition-colors"
              >
                {loading ? "Salvando..." : "Salvar Nova Senha e Entrar"}
              </button>
            </form>
          </div>
        ) : (
                    auditLogs.map((log, idx) => (
                      <div key={idx} className="px-6 py-3 text-xs flex flex-wrap items-center justify-between gap-2 hover:bg-slate-50">
                        <div className="space-y-0.5">
                          <span className="font-semibold text-slate-800">{log.action}</span>
                          <span className="text-slate-400 mx-2">•</span>
                          <span className="text-slate-600">{log.actor}</span>
                          {log.details && <p className="text-slate-500">{log.details}</p>}
                        </div>
                        <div className="text-right">
                          <span className="inline-block px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium mr-2">
                            {log.status}
                          </span>
                          <span className="text-slate-400 font-mono">{log.timestamp}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
