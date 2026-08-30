"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const data = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: data.get("password") }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error || "Une erreur est survenue.");
      }
      router.push(params.get("from") || "/config");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-sm rounded-2xl border border-[#882de1] bg-black p-8"
    >
      <h1 className="text-center text-xl font-bold">Accès réservé</h1>
      <p className="mt-2 text-center text-sm text-white/50">
        Configuration &amp; tableau de bord Selvema Commercial
      </p>

      <label htmlFor="password" className="mt-6 mb-2 block text-sm font-medium text-white/80">
        Mot de passe
      </label>
      <input
        id="password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        className="field"
      />

      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

      <button type="submit" disabled={loading} className="btn-ghost mt-6 w-full">
        {loading ? "Connexion…" : "Se connecter"}
      </button>
    </form>
  );
}
