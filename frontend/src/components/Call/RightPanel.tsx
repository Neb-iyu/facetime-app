import React, { useEffect, useState, useRef, JSX } from "react";
import { apiService } from "@/api/apiService";
import { useAuth } from "@/contexts/auth-context";
import LocalVideo from "@/components/Video/LocalVideo";
import RemoteVideo from "@/components/Video/RemoteVideo";
import { VideoGrid } from "../Video/GridView";
import { IncomingCallModal } from "./IncomingCallModal";
import { CallControls } from "./CallControls";

export default function RightPanel(): JSX.Element {
  const { user } = useAuth();
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    const loadHistory = async () => {
      const res = await apiService.getUserHistory("me");
      if (res) setHistory(res);
    };
    loadHistory();
  }, []);

  return (
    <div className="bg-white rounded shadow p-3 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Call</h3>
        <div className="text-sm text-gray-500">Preview</div>
      </div>

      <div className="call-content">
        <main className="video-main">
          <VideoGrid />
          <CallControls />
        </main>
      </div>

      <div>
        <h4 className="text-sm font-medium mb-2">History</h4>
        <ul className="max-h-48 overflow-auto space-y-2 text-sm text-gray-700">
          {history.length ? (
            history.map((h) => (
              <li key={h.id} className="flex justify-between">
                <div>{`Call #${h.id} • ${new Date(h.startTime).toLocaleString()}`}</div>
                <div className="text-xs text-gray-500">{h.status}</div>
              </li>
            ))
          ) : (
            <li className="text-gray-400">No recent calls</li>
          )}
        </ul>
      </div>
      <IncomingCallModal />
    </div>
  );
}