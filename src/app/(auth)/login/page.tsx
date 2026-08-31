"use client";

import { useState } from "react";
import Link from "next/link";
import { signIn, signUp } from "./actions";
import BrandLogo from "@/components/brand/BrandLogo";
import { useBrand } from "@/components/brand/BrandProvider";

export default function LoginPage() {
  const brand = useBrand();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"in" | "up">("in");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const result = mode === "up" ? await signUp(formData) : await signIn(formData);

    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-sm">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-gray-200 dark:border-slate-700 p-8">
        <div className="mb-8 text-center space-y-2">
          <div className="flex justify-center mb-4">
            <BrandLogo brand={brand} size={36} />
          </div>
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400">
            Partner portal &amp; operations
          </p>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Sign in to {brand.displayName}
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400">
            Your own login. Fill the TMMT Rentals desk first — even offline — then merge into live when you are seated on an org. New accounts need an invite code.
          </p>
          <div className="flex rounded-lg border border-gray-200 dark:border-slate-600 p-1 text-xs font-semibold">
            <button type="button" onClick={() => setMode("in")} className={`flex-1 rounded-md py-1.5 ${mode === "in" ? "bg-blue-600 text-white" : "text-gray-600 dark:text-slate-300"}`}>
              Sign in
            </button>
            <button type="button" onClick={() => setMode("up")} className={`flex-1 rounded-md py-1.5 ${mode === "up" ? "bg-blue-600 text-white" : "text-gray-600 dark:text-slate-300"}`}>
              Create account
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {mode === "up" && (
            <>
              <div>
                <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Full name
                </label>
                <input
                  id="fullName"
                  name="fullName"
                  autoComplete="name"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                />
              </div>
              <div>
                <label htmlFor="inviteCode" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Invite code
                </label>
                <input
                  id="inviteCode"
                  name="inviteCode"
                  required
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="XXXX-XXXX-XXXX-XXXX"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-white text-sm font-mono tracking-wide uppercase placeholder:normal-case placeholder:tracking-normal placeholder:font-sans focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                  Accounts are by invitation. Ask TMMT for your code — each one works once.
                </p>
              </div>
            </>
          )}
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1"
            >
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete={mode === "up" ? "new-password" : "current-password"}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}

          <div className="text-right">
            <Link
              href="/login/forgot"
              className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
            >
              Forgot password?
            </Link>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {loading ? "Working…" : mode === "up" ? "Create my login" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
