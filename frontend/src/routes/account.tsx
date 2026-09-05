import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  ArrowLeft,
  Bell,
  Bookmark,
  Brain,
  CalendarHeart,
  ChevronRight,
  Heart,
  Languages,
  Loader2,
  LogOut,
  Lock,
  MapPin,
  MessageSquareHeart,
  Palette,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserRound,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useSession, authErrorMessage } from "@/lib/use-session";
import { deleteMyAccount } from "@/lib/account.functions";

export const Route = createFileRoute("/account")({
  head: () => ({
    meta: [
      { title: "個人中心｜SideBy" },
      {
        name: "description",
        content: "在 SideBy 個人中心管理個人資料、收藏的約會方案、約會紀錄、伴侶連結與 AI 偏好記憶。",
      },
      { property: "og:title", content: "個人中心｜SideBy" },
      {
        property: "og:description",
        content: "管理你的 SideBy 個人資料、收藏方案、約會紀錄與偏好設定。",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AccountPage,
});

type Profile = {
  display_name: string | null;
  partner_name: string | null;
  partner_email: string | null;
};

type DateRecord = {
  id: string;
  title: string;
  subtitle: string | null;
  date_text: string | null;
  total: string | null;
  created_at: string;
};

function AccountPage() {
  const { user, loading } = useSession();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [records, setRecords] = useState<DateRecord[] | null>(null);
  const [showAllRecords, setShowAllRecords] = useState(false);
  const [editing, setEditing] = useState(false);
  const [pairing, setPairing] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [partnerDraft, setPartnerDraft] = useState("");
  const [partnerEmailDraft, setPartnerEmailDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [soon, setSoon] = useState<string | null>(null);
  const [askDelete, setAskDelete] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/" });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    supabase
      .from("profiles")
      .select("display_name, partner_name, partner_email")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        const p = data ?? { display_name: null, partner_name: null, partner_email: null };
        setProfile(p);
        setNameDraft(p.display_name ?? "");
        setPartnerDraft(p.partner_name ?? "");
        setPartnerEmailDraft(p.partner_email ?? "");
      });
    supabase
      .from("date_records")
      .select("id, title, subtitle, date_text, total, created_at")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (active) setRecords(data ?? []);
      });
    return () => {
      active = false;
    };
  }, [user]);

  const save = async (fields: Record<string, string>, message: string, done: () => void) => {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .upsert({ id: user.id, ...fields, updated_at: new Date().toISOString() });
    setBusy(false);
    if (error) {
      toast.error("儲存失敗，請再試一次");
      return;
    }
    setProfile((prev) => ({ ...(prev ?? { display_name: null, partner_name: null, partner_email: null }), ...fields }));
    toast.success(message);
    done();
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error(authErrorMessage(error.message));
      return;
    }
    toast.success("已登出，隨時歡迎回來");
    navigate({ to: "/" });
  };

  const changePassword = async () => {
    if (!user?.email) return;
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (error) {
      toast.error(authErrorMessage(error.message));
      return;
    }
    toast.success("已寄出修改密碼的連結，請到信箱查看");
  };

  const removeAccount = async () => {
    setBusy(true);
    try {
      await deleteMyAccount();
      await supabase.auth.signOut();
      toast.success("帳號已刪除");
      navigate({ to: "/" });
    } catch {
      toast.error("目前無法刪除帳號，請稍後再試");
    } finally {
      setBusy(false);
      setAskDelete(false);
    }
  };

  if (loading || !user) {
    return (
      <div className="account-loading">
        <Loader2 size={22} className="spin" /> 讀取中…
      </div>
    );
  }

  const paired = Boolean(profile?.partner_name || profile?.partner_email);
  const partnerLabel = profile?.partner_name || profile?.partner_email || "";
  const initial = (profile?.display_name || user.email || "?").trim().charAt(0).toUpperCase();
  const visibleRecords = showAllRecords ? (records ?? []) : (records ?? []).slice(0, 3);

  return (
    <div className="account-page">
      <header className="account-top">
        <Link to="/" className="icon-btn" aria-label="返回">
          <ArrowLeft size={18} />
        </Link>
        <span className="account-top-title">個人中心</span>
        <span className="account-top-spacer" />
      </header>

      <main className="account-main">
        <section className="account-card hero">
          <span className="account-eyebrow">個人資訊</span>
          <div className="account-hero-row">
            <span className="avatar-btn big">{initial}</span>
            <div className="account-hero-text">
              <strong>{profile?.display_name || "尚未設定名稱"}</strong>
              <small>{user.email}</small>
              <span className={`pair-badge${paired ? " on" : ""}`}>
                <Heart size={13} />
                {paired ? `已與 ${partnerLabel} 配對` : "尚未連結另一半"}
              </span>
            </div>
          </div>

          {editing ? (
            <div className="account-edit">
              <label>
                <span>顯示名稱</span>
                <input
                  className="field-input"
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  placeholder="想讓另一半看到的名字"
                  enterKeyHint="done"
                />
              </label>
              <div className="account-edit-actions">
                <button
                  className="btn btn-black"
                  disabled={busy}
                  onClick={() => save({ display_name: nameDraft }, "個人資料已更新", () => setEditing(false))}
                >
                  {busy && <Loader2 size={15} className="spin" />}儲存
                </button>
                <button className="text-action" onClick={() => setEditing(false)}>
                  取消
                </button>
              </div>
            </div>
          ) : (
            <button className="btn btn-outline wide" onClick={() => setEditing(true)}>
              <UserRound size={16} /> 編輯個人資料
            </button>
          )}
        </section>

        <section className="account-card">
          <div className="account-card-head">
            <span className="account-eyebrow">收藏的方案</span>
            <Bookmark size={17} />
          </div>
          <div className="account-empty">
            <strong>還沒有收藏的方案</strong>
            <span>看到喜歡的約會提案時，可以先收藏起來。</span>
          </div>
        </section>

        <section className="account-card">
          <div className="account-card-head">
            <span className="account-eyebrow">約會紀錄</span>
            <CalendarHeart size={17} />
          </div>
          {records === null && <p className="account-note">讀取中…</p>}
          {records?.length === 0 && (
            <div className="account-empty">
              <strong>還沒有約會紀錄</strong>
              <span>完成一次約會路線後，就會出現在這裡。</span>
            </div>
          )}
          {visibleRecords.map((r) => (
            <div key={r.id} className="account-row static">
              <div>
                <strong>{r.title}</strong>
                <small>{[r.date_text, r.subtitle, r.total].filter(Boolean).join(" · ")}</small>
              </div>
            </div>
          ))}
          {(records?.length ?? 0) > 3 && (
            <button className="text-action" onClick={() => setShowAllRecords((v) => !v)}>
              {showAllRecords ? "收起紀錄" : "查看所有約會紀錄"}
            </button>
          )}
        </section>

        <section className="account-card">
          <div className="account-card-head">
            <span className="account-eyebrow">我的伴侶</span>
            <Heart size={17} />
          </div>
          {pairing ? (
            <div className="account-edit">
              <label>
                <span>伴侶暱稱</span>
                <input
                  className="field-input"
                  value={partnerDraft}
                  onChange={(e) => setPartnerDraft(e.target.value)}
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
                  value={partnerEmailDraft}
                  onChange={(e) => setPartnerEmailDraft(e.target.value)}
                  placeholder="partner@example.com"
                />
              </label>
              <div className="account-edit-actions">
                <button
                  className="btn btn-black"
                  disabled={busy}
                  onClick={() =>
                    save(
                      { partner_name: partnerDraft, partner_email: partnerEmailDraft.trim() },
                      "伴侶資料已更新",
                      () => setPairing(false),
                    )
                  }
                >
                  {busy && <Loader2 size={15} className="spin" />}儲存
                </button>
                <button className="text-action" onClick={() => setPairing(false)}>
                  取消
                </button>
              </div>
            </div>
          ) : paired ? (
            <>
              <div className="account-row static">
                <div>
                  <strong>{partnerLabel}</strong>
                  <small>已連結・可以一起共決策</small>
                </div>
                <span className="online-dot" />
              </div>
              <button className="btn btn-outline wide" onClick={() => setPairing(true)}>
                管理配對
              </button>
            </>
          ) : (
            <>
              <div className="account-empty">
                <strong>尚未連結另一半</strong>
                <span>連結後，兩個人的條件與提案才會同步。</span>
              </div>
              <button className="btn btn-black wide" onClick={() => setPairing(true)}>
                邀請另一半
              </button>
            </>
          )}
          <p className="account-note quiet">另一半的私密輸入不會顯示在這裡。</p>
        </section>

        <section className="account-card">
          <div className="account-card-head">
            <span className="account-eyebrow">偏好與 AI</span>
            <Brain size={17} />
          </div>
          <div className="account-empty">
            <strong>目前沒有 AI 記住的偏好</strong>
            <span>在私密輸入選擇「讓 AI 之後也記得」，偏好才會保留在這裡。</span>
          </div>
          <button className="account-row" onClick={() => setSoon("管理已記住的偏好")}>
            <span>
              <Sparkles size={16} /> 管理已記住的偏好
            </span>
            <ChevronRight size={17} />
          </button>
          <button className="account-row" onClick={() => setSoon("清除 AI 偏好記憶")}>
            <span>
              <Trash2 size={16} /> 清除 AI 偏好記憶
            </span>
            <ChevronRight size={17} />
          </button>
        </section>

        <section className="account-card">
          <div className="account-card-head">
            <span className="account-eyebrow">設定</span>
          </div>
          {[
            { label: "通知設定", icon: <Bell size={16} /> },
            { label: "定位權限", icon: <MapPin size={16} /> },
            { label: "隱私設定", icon: <ShieldCheck size={16} /> },
            { label: "地圖與位置", icon: <MapPin size={16} /> },
            { label: "語言", icon: <Languages size={16} /> },
            { label: "外觀", icon: <Palette size={16} /> },
          ].map((item) => (
            <button key={item.label} className="account-row" onClick={() => setSoon(item.label)}>
              <span>
                {item.icon} {item.label}
              </span>
              <ChevronRight size={17} />
            </button>
          ))}
        </section>

        <section className="account-card">
          <div className="account-card-head">
            <span className="account-eyebrow">帳號管理</span>
          </div>
          <div className="account-row static">
            <div>
              <strong>電子郵件</strong>
              <small>{user.email}</small>
            </div>
          </div>
          <button className="account-row" disabled={busy} onClick={changePassword}>
            <span>
              <Lock size={16} /> 修改密碼
            </span>
            <ChevronRight size={17} />
          </button>
          <button className="account-row" onClick={signOut}>
            <span>
              <LogOut size={16} /> 登出
            </span>
            <ChevronRight size={17} />
          </button>
        </section>

        <section className="account-card quiet-card">
          <button className="account-row quiet" onClick={() => setSoon("關於 SideBy")}>
            <span>關於 SideBy</span>
            <ChevronRight size={16} />
          </button>
          <button className="account-row quiet" onClick={() => setSoon("隱私權政策")}>
            <span>隱私權政策</span>
            <ChevronRight size={16} />
          </button>
          <button className="account-row quiet" onClick={() => setSoon("使用條款")}>
            <span>使用條款</span>
            <ChevronRight size={16} />
          </button>
          <button className="account-row quiet" onClick={() => setSoon("意見回饋")}>
            <span>
              <MessageSquareHeart size={15} /> 意見回饋
            </span>
            <ChevronRight size={16} />
          </button>
        </section>

        <section className="account-danger">
          <strong>刪除帳號</strong>
          <p>刪除後，你的個人資料與約會紀錄會永久消失，無法復原。</p>
          <button className="btn btn-danger wide" onClick={() => setAskDelete(true)}>
            <Trash2 size={16} /> 刪除帳號
          </button>
        </section>
      </main>

      {soon && (
        <div className="picker-backdrop" role="dialog" aria-modal="true" onClick={() => setSoon(null)}>
          <div className="auth-sheet soon-sheet" onClick={(e) => e.stopPropagation()}>
            <strong>{soon}</strong>
            <p>這項功能正在準備中，之後會在這裡開放。</p>
            <button className="btn btn-black wide" onClick={() => setSoon(null)}>
              好，知道了
            </button>
          </div>
        </div>
      )}

      {askDelete && (
        <div className="picker-backdrop" role="dialog" aria-modal="true">
          <div className="auth-sheet soon-sheet">
            <strong>確定要刪除帳號嗎？</strong>
            <p>這個動作無法復原，所有資料都會被移除。</p>
            <button className="btn btn-danger wide" disabled={busy} onClick={removeAccount}>
              {busy && <Loader2 size={15} className="spin" />}確定刪除
            </button>
            <button className="text-action" onClick={() => setAskDelete(false)}>
              先不要
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
