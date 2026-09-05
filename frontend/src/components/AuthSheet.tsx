import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Lock, Mail, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { authErrorMessage } from "@/lib/use-session";

type Mode = "login" | "signup" | "forgot";

export function AuthSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [sentVerify, setSentVerify] = useState(false);
  const [sentReset, setSentReset] = useState(false);

  useEffect(() => {
    if (!open) {
      setMode("login");
      setPassword("");
      setConfirm("");
      setSentVerify(false);
      setSentReset(false);
    }
  }, [open]);

  if (!open) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const mail = email.trim();
    if (!mail) {
      toast.error("請輸入電子郵件");
      return;
    }

    if (mode === "forgot") {
      setBusy(true);
      const { error } = await supabase.auth.resetPasswordForEmail(mail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      setBusy(false);
      if (error) {
      toast.error(authErrorMessage(error.message));
      return;
    }
      setSentReset(true);
      return;
    }

    if (password.length < 6) {
      toast.error("密碼至少需要 6 個字元");
      return;
    }

    if (mode === "signup") {
      if (password !== confirm) {
      toast.error("兩次輸入的密碼不一樣");
      return;
    }
      setBusy(true);
      const { data, error } = await supabase.auth.signUp({
        email: mail,
        password,
        options: { emailRedirectTo: window.location.origin },
      });
      setBusy(false);
      if (error) {
      toast.error(authErrorMessage(error.message));
      return;
    }
      if (!data.session) {
        setSentVerify(true);
        return;
      }
      toast.success("帳號建立完成，歡迎加入");
      onClose();
      return;
    }

    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: mail, password });
    setBusy(false);
    if (error) {
      toast.error(authErrorMessage(error.message));
      return;
    }
    toast.success("登入成功，歡迎回來");
    onClose();
  };

  const title = mode === "signup" ? "建立你的帳號" : mode === "forgot" ? "重設密碼" : "登入 SideBy";
  const lede =
    mode === "signup"
      ? "註冊後就能保存你們的約會紀錄與伴侶設定。"
      : mode === "forgot"
        ? "輸入註冊用的電子郵件，我們會寄一封重設密碼的信給你。"
        : "登入後，你們的房間與行程都會被記住。";

  return (
    <div className="auth-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="auth-sheet" onClick={(e) => e.stopPropagation()}>
        <button className="auth-close" onClick={onClose} aria-label="關閉">
          <X size={17} />
        </button>
        <span className="eyebrow">SIDEBY ACCOUNT</span>
        <h2 className="auth-title">{title}</h2>
        <p className="auth-lede">{lede}</p>

        {sentVerify ? (
          <div className="auth-done">
            <strong>驗證信已寄出</strong>
            <p>
              請到 <b>{email.trim()}</b> 收信並點擊驗證連結，完成後回來登入即可。
            </p>
            <button className="btn btn-black wide" onClick={() => setMode("login")}>
              我已完成驗證，前往登入
            </button>
          </div>
        ) : sentReset ? (
          <div className="auth-done">
            <strong>重設信已寄出</strong>
            <p>
              請到 <b>{email.trim()}</b> 收信，點擊信中的連結設定新密碼。
            </p>
            <button className="btn btn-black wide" onClick={() => setMode("login")}>
              回到登入
            </button>
          </div>
        ) : (
          <form className="auth-form" onSubmit={submit} noValidate>
            <label>
              <span>電子郵件</span>
              <div className="input-icon">
                <Mail size={16} />
                <input
                  className="field-input"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  enterKeyHint={mode === "forgot" ? "send" : "next"}
                  autoCapitalize="none"
                  autoCorrect="off"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>
            </label>

            {mode !== "forgot" && (
              <label>
                <span>密碼</span>
                <div className="input-icon">
                  <Lock size={16} />
                  <input
                    className="field-input"
                    type="password"
                    autoComplete={mode === "signup" ? "new-password" : "current-password"}
                    enterKeyHint={mode === "signup" ? "next" : "go"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="至少 6 個字元"
                  />
                </div>
              </label>
            )}

            {mode === "signup" && (
              <label>
                <span>確認密碼</span>
                <div className="input-icon">
                  <Lock size={16} />
                  <input
                    className="field-input"
                    type="password"
                    autoComplete="new-password"
                    enterKeyHint="go"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="再輸入一次密碼"
                  />
                </div>
              </label>
            )}

            <button className="btn btn-black wide" type="submit" disabled={busy}>
              {busy && <Loader2 size={16} className="spin" />}
              {mode === "signup" ? "建立帳號" : mode === "forgot" ? "寄出重設連結" : "登入"}
            </button>

            <div className="auth-links">
              {mode === "login" && (
                <>
                  <button type="button" className="text-action" onClick={() => setMode("signup")}>
                    還沒有帳號？建立帳號
                  </button>
                  <button type="button" className="text-action" onClick={() => setMode("forgot")}>
                    忘記密碼？
                  </button>
                </>
              )}
              {mode !== "login" && (
                <button type="button" className="text-action" onClick={() => setMode("login")}>
                  已經有帳號？返回登入
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
