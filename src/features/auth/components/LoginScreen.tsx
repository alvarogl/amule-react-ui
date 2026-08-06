import { useState, type FormEvent } from "react";
import { Activity } from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@/features/auth/session-context";

export function LoginScreen() {
  const { login } = useSession();
  const [password, setPassword] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();

    try {
      await login(password);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Login failed");
    }
  }

  return (
    <main className="login">
      <form onSubmit={submit}>
        <Activity size={36} />
        <h1>aMule Console</h1>
        <label>
          Admin password
          <input
            autoFocus
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        <button>Sign in</button>
      </form>
    </main>
  );
}
