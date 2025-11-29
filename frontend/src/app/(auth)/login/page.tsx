import type React from "react"; 
import { useAuth } from "@/contexts/auth-context";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
    const [formData, setFormData] = useState({
        email: "",
        password: "",
    });
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const { loginWithCredentials, isAuthenticated, user } = useAuth();

    const router = useRouter();

    const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        if (!loginWithCredentials) {
            setError("Login handler not available");
            return;
        }
        setIsLoading(true);
        try {
            await loginWithCredentials(formData.email, formData.password);
            setShowSuccess(true);
            // small delay for UX then redirect to app root
            setTimeout(() => {
                router.push("/");
            }, 600);
        } catch (err: any) {
            setError(err?.message || "Login failed");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="max-w-md mx-auto mt-24 p-6 bg-white rounded shadow">
            <h1 className="text-2xl font-semibold mb-4">Sign in</h1>

            {error ? (
                <div className="mb-4 text-sm text-red-700 bg-red-100 p-2 rounded">{error}</div>
            ) : null}

            {showSuccess && (
                <div className="mb-4 text-sm text-green-700 bg-green-100 p-2 rounded">
                    Signed in — redirecting...
                </div>
            )}

            <form onSubmit={onSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium mb-1" htmlFor="email">Email</label>
                    <input
                        id="email"
                        name="email"
                        type="email"
                        value={formData.email}
                        onChange={onChange}
                        required
                        className="w-full border px-3 py-2 rounded"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium mb-1" htmlFor="password">Password</label>
                    <input
                        id="password"
                        name="password"
                        type="password"
                        value={formData.password}
                        onChange={onChange}
                        required
                        className="w-full border px-3 py-2 rounded"
                    />
                </div>

                <div className="flex items-center justify-between">
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-60"
                    >
                        {isLoading ? "Signing in..." : "Sign in"}
                    </button>
                    <a href="/auth/register" className="text-sm text-blue-600">Register</a>
                </div>
            </form>
        </div>
    );
}
