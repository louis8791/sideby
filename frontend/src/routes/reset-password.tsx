import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { authErrorMessage } from "@/lib/use-session";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "重設密碼｜SideBy" },
      { name: "description", content: "為你的 SideBy 帳號設定一組新的密碼，之後就能繼續一起規劃約會。" },
      { property: "og:title", content: "重設密碼｜SideBy" },
      { property: "og:description", content: "設定新密碼，回到你們的約會規劃。" },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("密碼至少需要 6 個字元");
      return;
    }
    if (password !== confirm) {
      toast.error("兩次輸入的密碼不一樣");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      toast.error(authErrorMessage(error.message));
      return;
    }
    toast.success("密碼已更新，已為你登入");
    navigate({ to: "/", replace: true });
  };

  return (
    <div className="app-shell">
      <main className="page-wrap reset-wrap">
        <div className="auth-sheet static-sheet">
          <span className="eyebrow">SIDEBY ACCOUNT</span>
          <h1 className="auth-title">設定新密碼</h1>
          <p className="auth-lede">輸入新的密碼，完成後就會自動登入。</p>
          <form className="auth-form" onSubmit={submit} noValidate>
            <label>
              <span>新密碼</span>
              <div className="input-icon">
                <Lock size={16} />
                <input
                  className="field-input"
                  type="password"
                  autoComplete="new-password"
                  enterKeyHint="next"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="至少 6 個字元"
                />
              </div>
            </label>
            <label>
              <span>確認新密碼</span>
              <div className="input-icon">
                <Lock size={16} />
                <input
                  className="field-input"
                  type="password"
                  autoComplete="new-password"
                  enterKeyHint="go"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="再輸入一次新密碼"
                />
              </div>
            </label>
            <button className="btn btn-black wide" type="submit" disabled={busy}>
              {busy && <Loader2 size={16} className="spin" />}更新密碼
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
