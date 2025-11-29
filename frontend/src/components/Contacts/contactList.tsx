import React, { JSX, useEffect, useState } from "react";
import { User } from "@/types/index";
import { apiService } from "@/api/apiService";
import ContactItem from "./contactItem";
import { wsClient } from "@/api/webSocketClient";
import { useAuth } from "@/contexts/auth-context";
import { useCallStore } from "@/stores/callStore";

export default function ContactList(): JSX.Element {
  const { user } = useAuth();
  const { makeCall, users, invitePlaya } = useCallStore();
  const [contacts, setContacts] = useState<User[]>([]);
  const [statuses, setStatuses] = useState<Map<number, "online" | "offline" | "busy">>(new Map());
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<User[] | null>(null);
  const currentUserId = user?.id ?? null;

  useEffect(() => {
    const fetchContacts = async () => {
      const res = await apiService.getContacts("me");
      if (res) setContacts(res);
    };
    fetchContacts();

    // presence updates
    const listener = (status: any) => {
      setStatuses((prev) => {
        const copy = new Map(prev);
        copy.set(status.userID, status.status);
        return copy;
      });
    };
    wsClient.addPresenceListener(listener);

    // cleanup - if addPresenceListener returns nothing, remove is omitted.
    // TTODO: implement subscribe to call here
  }, []);

  const onSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query) {
      setSearchResults(null);
      return;
    }
    const results = await apiService.getUsers(query, 1, 20);
    setSearchResults(results ?? []);
  };

  const onAddContact = async (contact: User) => {
    if (!currentUserId) return;
    await apiService.addContact(String(currentUserId), String(contact.id));
    // refresh contact list
    const res = await apiService.getContacts("me");
    if (res) setContacts(res);
  };

  const onCall = (contact: User) => {
    const stat = users.get(contact.id)?.status;
    if (!contact || stat !== "online") return;
    makeCall([contact.id]).catch(console.error);
  };

  const statusDot = (s?: "online" | "offline" | "busy") => {
    if (s === "online") return <span className="w-3 h-3 bg-green-400 rounded-full inline-block" />;
    if (s === "busy") return <span className="w-3 h-3 bg-red-400 rounded-full inline-block" />;
    return <span className="w-3 h-3 bg-gray-300 rounded-full inline-block" />;
  };

  const listToRender = searchResults ?? contacts;

  return (
    <div>
      <form onSubmit={onSearch} className="mb-3">
        <div className="flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search users by name"
            className="flex-1 border px-3 py-2 rounded"
          />
          <button type="submit" className="px-3 py-2 bg-blue-600 text-white rounded">Search</button>
        </div>
      </form>

      <ul className="space-y-2 max-h-[60vh] overflow-auto">
        {listToRender && listToRender.length ? (
          listToRender.map((c) => {
            const st = users.get(c.id)?.status ?? (c.status as any) ?? "offline";
            const canCall = st === "online";
            return (
              <li key={c.id} className="flex items-center justify-between p-2 rounded hover:bg-gray-50">
                <div className="flex items-center gap-3">
                  {/* ContactItem assumed to render avatar+name when used with contact prop */}
                  <ContactItem contact={{ ...c, status: st }} />
                </div>

                <div className="flex items-center gap-2">
                  {statusDot(st as any)}
                  <div className="text-xs text-gray-600 mr-2">{st}</div>
                  {canCall ? (
                    <button
                      onClick={() => onCall(c)}
                      className="text-sm bg-green-600 text-white px-3 py-1 rounded"
                    >
                      Call
                    </button>
                  ) : (
                    <div>
                      <button disabled className="text-sm bg-gray-200 text-gray-500 px-3 py-1 rounded">
                        Call
                      </button><button onClick={() => invitePlaya(c.id)}></button>
                    </div>
                    
                  )}
                  {searchResults !== null && (
                    <button
                      onClick={() => onAddContact(c)}
                      className="ml-2 text-sm px-3 py-1 border rounded"
                    >
                      Add
                    </button>
                  )}
                </div>
              </li>
            );
          })
        ) : (
          <li className="text-sm text-gray-500">No contacts</li>
        )}
      </ul>
    </div>
  );
}