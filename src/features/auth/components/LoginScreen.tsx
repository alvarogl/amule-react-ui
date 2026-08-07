import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import amuleLogo from "@/assets/amule-logo.png";
import { useSession } from "@/features/auth/session-context";
import { getErrorMessage } from "@/shared/lib/errors";

export function LoginScreen() {
  const { login } = useSession();
  const [password, setPassword] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();

    try {
      await login(password);
    } catch (error) {
      toast.error(getErrorMessage(error, "Login failed"));
    }
  }

  return (
    <main className="login">
      <form onSubmit={submit}>
        <img className="login-logo" src={amuleLogo} alt="aMule" />
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
        <details className="login-help">
          <summary>Forgot your password?</summary>
          <p>
            Passwords cannot be recovered here. On the aMule host, replace the API admin password in
            Preferences → Remote Controls or with amuleapi's <code>--set-admin-pass</code> option.
            Then sign in with the new password; no browser reset is required.
          </p>
        </details>
      </form>
    </main>
  );
}
