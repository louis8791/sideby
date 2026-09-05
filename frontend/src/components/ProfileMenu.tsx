import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { User } from "@supabase/supabase-js";
import { Heart, History, Loader2, LogOut, UserRound, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { authErrorMessage } from "@/lib/use-session";

type Panel = "menu" | "account" | "partner" | "history";
type DateRecord = {
  id: string;
  title: string;
  subtitle: string | null;
  date_text: string | null;
  total: string | null;
};

export function ProfileMenu({ user }: { user: User }) {
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState<Panel>("menu");
  const [displayName, setDisplayName] = useState("");
  const [partnerEmail, setPartnerEmail] = useState("");
  const [partnerName, setPartnerName] = useState("");
  const [records, setRecords] = useState<DateRecord[] | null>(null);
  const [busy, setBusy] = useState(false);

  const initial = (displayName || user.email || "?").trim().charAt(0).toUpperCase();

  useEffect(() => {
    let active = true;
    supabase
      .from("profiles")
      .select("display_name, partner_email, partner_name")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!active || !data) return;
        setDisplayName(data.display_name ?? "");
        setPartnerEmail(data.partner_email ?? "");
        setPartnerName(data.partner_name ?? "");
      });
    return () => {
      active = false;
    };
  }, [user.id]);

  useEffect(() => {
    if (panel !== "history" || records) return;
    supabase
      .from("date_records")
      .select("id, title, subtitle, date_text, total")
      .order("created_at", { ascending: false })
      .then(({ data }) => setRecords(data ?? []));
  }, [panel, records]);

  const saveProfile = async (fields: Record<string, string>, message: string) => {
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .upsert({ id: user.id, ...fields, updated_at: new Date().toISOString() });
    setBusy(false);
    if (error) {
      toast.error("儲存失敗，請再試一次");
      return;
    }
    toast.success(message);
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error(authErrorMessage(error.message));
      return;
    }
    setOpen(false);
    toast.success("已登出，隨時歡迎回來");
  };

  return (
    <>
      <button
        className="avatar-btn"
        onClick={() => {
          setPanel("menu");
          setOpen(true);
        }}
        aria-label="我的帳號"
      >
        {initial}
      </button>

      {open && (
        <div className="auth-overlay" role="dialog" aria-modal="true" onClick={() => setOpen(false)}>
          <div className="auth-sheet profile-sheet" onClick={(e) => e.stopPropagation()}>
            <button className="auth-close" onClick={() => setOpen(false)} aria-label="關閉">
              <X size={17} />
            </button>

            <div className="profile-head">
              <span className="avatar-btn big">{initial}</span>
              <div>
                <strong>{displayName || "尚未設定名稱"}</strong>
                <small>{user.email}</small>
              </div>
            </div>

            {panel === "menu" && (
              <div className="profile-list">
                <button onClick={() => setPanel("account")}>
                  <UserRound size={17} /> 我的帳號
                </button>
                <button onClick={() => setPanel("partner")}>
                  <Heart size={17} /> 我的伴侶
                </button>
                <button onClick={() => setPanel("history")}>
                  <History size={17} /> 約會紀錄
                </button>
                <button className="danger" onClick={signOut}>
                  <LogOut size={17} /> 登出
                </button>
              </div>
            )}

            {panel === "account" && (
              <div className="profile-panel">
                <label>
                  <span>顯示名稱</span>
                  <input
                    className="field-input"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="想讓另一半看到的名字"
                    enterKeyHint="done"
                  />
                </label>
                <label>
                  <span>電子郵件</span>
                  <input className="field-input" value={user.email ?? ""} readOnly />
                </label>
                <button
                  className="btn btn-black wide"
                  disabled={busy}
                  onClick={() => saveProfile({ display_name: displayName }, "帳號資料已更新")}
                >
                  {busy && <Loader2 size={16} className="spin" />}儲存
                </button>
                <button className="text-action" onClick={() => setPanel("menu")}>
                  返回
                </button>
              </div>
            )}

            {panel === "partner" && (
              <div className="profile-panel">
                <label>
                  <span>伴侶暱稱</span>
                  <input
                    className="field-input"
                    value={partnerName}
                    onChange={(e) => setPartnerName(e.target.value)}
                    placeholder="例如：小海"
                    enterKeyHint="next"
                  />
                </label>
                <label>
                  <span>伴侶的電子郵件</span>
                  <input
                    className="field-input"
                    type="email"
                    inputMode="email"
                    autoCapitalize="none"
                    enterKeyHint="done"
                    value={partnerEmail}
                    onChange={(e) => setPartnerEmail(e.target.value)}
                    placeholder="partner@example.com"
                  />
                </label>
                <button
                  className="btn btn-black wide"
                  disabled={busy}
                  onClick={() =>
                    saveProfile(
                      { partner_name: partnerName, partner_email: partnerEmail.trim() },
                      "伴侶資料已更新",
                    )
                  }
                >
                  {busy && <Loader2 size={16} className="spin" />}儲存
                </button>
                <button className="text-action" onClick={() => setPanel("menu")}>
                  返回
                </button>
              </div>
            )}

            {panel === "history" && (
              <div className="profile-panel">
                {records === null && <p className="profile-empty">讀取中…</p>}
                {records?.length === 0 && (
                  <p className="profile-empty">還沒有紀錄。完成一次約會路線後，就會出現在這裡。</p>
                )}
                {records?.map((r) => (
                  <div key={r.id} className="record-row">
                    <strong>{r.title}</strong>
                    <small>
                      {[r.date_text, r.subtitle, r.total].filter(Boolean).join(" · ")}
                    </small>
                  </div>
                ))}
                <button className="text-action" onClick={() => setPanel("menu")}>
                  返回
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
