import React, { JSX } from "react";
import { useAuth } from "@/contexts/auth-context";
import Link from "next/link";

export default function Sidebar(): JSX.Element {
  const { user } = useAuth();

  return (
    <div className="flex flex-col items-center gap-4 sticky top-6">
      <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
        {user?.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.avatarUrl} alt="me" className="w-12 h-12 rounded-full object-cover" />
        ) : (
          <span className="text-sm font-semibold">{user?.name?.[0] ?? "U"}</span>
        )}
      </div>

      <Link href="/contacts">
        <button className="w-10 h-10 rounded-md bg-white border flex items-center justify-center" title="Contacts">
          📇
        </button>
      </Link>

      <button className="w-10 h-10 rounded-md bg-white border flex items-center justify-center" title="Online users">
        🟢
      </button>

      <button className="w-10 h-10 rounded-md bg-white border flex items-center justify-center" title="New chat">
        ➕
      </button>

      <div className="mt-auto text-xs text-gray-400">v0.1</div>
    </div>
  );
}