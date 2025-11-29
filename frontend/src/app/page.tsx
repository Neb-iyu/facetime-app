"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/contexts/auth-context";

export default function Home() {
  const { user, isAuthenticated, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user?.id) {
      sessionStorage.setItem("userId", String(user.id));
    } else {
      sessionStorage.removeItem("userId");
    }
  }, [user]);

  const handleLogout = () => {
    logout();
    router.push("/auth/login");
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-start p-8">
      <header className="w-full max-w-4xl flex items-center justify-between mb-12">
        <div className="flex items-center gap-4">
          <Image src="/next.svg" alt="logo" width={120} height={28} />
          <h1 className="text-lg font-semibold">Facetime App</h1>
        </div>

        <nav className="flex items-center gap-4">
          {!isAuthenticated ? (
            <>
              <Link
                href="/auth/login"
                className="text-sm px-4 py-2 rounded bg-blue-600 text-white"
              >
                Sign in
              </Link>
              <Link
                href="/auth/register"
                className="text-sm px-4 py-2 rounded border"
              >
                Register
              </Link>
            </>
          ) : (
            <div className="flex items-center gap-3">
              {user?.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.avatarUrl}
                  alt="avatar"
                  className="w-9 h-9 rounded-full object-cover"
                />
              ) : (
                <div className="w-9 h-9 bg-gray-200 rounded-full flex items-center justify-center text-sm">
                  {user?.name?.[0] ?? "U"}
                </div>
              )}
              <div className="text-sm">
                <div className="font-medium">{user?.name}</div>
                <div className="text-xs text-gray-500">{user?.email}</div>
              </div>
              <button
                onClick={handleLogout}
                className="ml-4 px-3 py-1 bg-red-600 text-white rounded text-sm"
              >
                Sign out
              </button>
            </div>
          )}
        </nav>
      </header>

      <main className="w-full max-w-4xl">
        <section className="bg-white rounded shadow p-6">
          <h2 className="text-xl font-semibold mb-3">Welcome</h2>
          <p className="text-sm text-gray-600 mb-4">
            Small demo landing page for the Facetime app. Use the links above to
            sign in or register.
          </p>

          {isAuthenticated ? (
            <div className="flex gap-3 flex-wrap">
              <Link
                href="/dashboard"
                className="px-4 py-2 bg-blue-600 text-white rounded text-sm"
              >
                Open Dashboard
              </Link>
              <Link
                href="/calls"
                className="px-4 py-2 border rounded text-sm"
              >
                My Calls
              </Link>
              <Link
                href="/profile"
                className="px-4 py-2 border rounded text-sm"
              >
                Edit profile
              </Link>
            </div>
          ) : (
            <div className="flex gap-3">
              <Link
                href="/auth/register"
                className="px-4 py-2 bg-green-600 text-white rounded text-sm"
              >
                Create account
              </Link>
              <Link
                href="/auth/login"
                className="px-4 py-2 border rounded text-sm"
              >
                Have an account? Sign in
              </Link>
            </div>
          )}
        </section>

        <section className="mt-6 text-sm text-gray-500">
          <p>
            This page is intentionally minimal. Add dashboard UI, call list, and
            realtime components under /dashboard and /calls.
          </p>
        </section>
      </main>

      <footer className="mt-12 text-xs text-gray-400">
        © {new Date().getFullYear()} Facetime App — demo
      </footer>
    </div>
  );
}
