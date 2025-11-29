"use client";

import React, { useEffect } from "react";
import Sidebar from "@/components/Sidebar/Sidebar";
import ContactList from "@/components/Contacts/contactList";
import RightPanel from "@/components/Call/RightPanel";
import { useAuth } from "@/contexts/auth-context";

export default function DashboardPage() {
  const { user, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) {
      // optional: redirect to login if needed
      // router.push("/auth/login");
    }
  }, [isAuthenticated]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1200px] mx-auto grid grid-cols-[72px,1fr,420px] gap-4 p-4">
        <aside className="col-span-1">
          <Sidebar />
        </aside>

        <main className="col-span-1 bg-white rounded shadow p-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="text-xl font-semibold">Contacts</div>
              <div className="text-sm text-gray-500">({user?.name})</div>
            </div>
          </div>

          <ContactList />
        </main>

        <aside className="col-span-1">
          <RightPanel />
        </aside>
      </div>
    </div>
  );
}