import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";

export default function ProfilePage() {
  const { completeRegistration, loginWithCredentials } = useAuth();
  const router = useRouter();

  const [avatar, setAvatar] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!avatar) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(avatar);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [avatar]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files && e.target.files[0];
    if (f) setAvatar(f);
  };

  const handleContinue = async () => {
    setError(null);
    setLoading(true);
    try {
      await completeRegistration({ avatar });
      router.push("/");
    } catch (err: any) {
      setError(err?.message || "Failed to complete registration");
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    setError(null);
    setLoading(true);
    try {
      // call completeRegistration with null to skip avatar
      await completeRegistration({ avatar: null });
      router.push("/");
    } catch (err: any) {
      setError(err?.message || "Failed to complete registration");
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => router.back();

  return (
    <div className="max-w-md mx-auto mt-20 p-6 bg-white rounded shadow">
      <h1 className="text-2xl font-semibold mb-4">Create your profile</h1>

      {error && (
        <div className="mb-4 text-sm text-red-700 bg-red-100 p-2 rounded">{error}</div>
      )}

      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">Avatar (optional)</label>
        <div className="flex items-center gap-4">
          <div className="w-24 h-24 bg-gray-100 rounded overflow-hidden flex items-center justify-center">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="avatar preview" className="w-full h-full object-cover" />
            ) : (
              <span className="text-sm text-gray-500">No image</span>
            )}
          </div>
          <div>
            <input
              type="file"
              accept="image/*"
              onChange={onFileChange}
              aria-label="Upload avatar"
            />
            <p className="text-xs text-gray-500 mt-2">You can skip this and set it later.</p>
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={handleContinue}
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-60"
        >
          {loading ? "Saving..." : "Save & Continue"}
        </button>

        <button
          onClick={handleSkip}
          disabled={loading}
          className="bg-gray-200 text-gray-800 px-4 py-2 rounded disabled:opacity-60"
        >
          Skip for now
        </button>

        <button
          onClick={handleBack}
          disabled={loading}
          className="ml-auto text-sm text-gray-600 underline"
        >
          Back
        </button>
      </div>
    </div>
  );
}