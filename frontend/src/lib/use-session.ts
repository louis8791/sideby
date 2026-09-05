import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setLoading(false);
    });
    supabase.auth.getSession().then(({ data: { session: current } }) => {
      setSession(current);
      setLoading(false);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  return { session, user: session?.user ?? null, loading };
}

export function authErrorMessage(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "電子郵件或密碼不正確";
  if (m.includes("email not confirmed")) return "請先到信箱點擊驗證連結，再登入";
  if (m.includes("already registered") || m.includes("already been registered"))
    return "這個電子郵件已經註冊過了，直接登入就好";
  if (m.includes("password should be at least")) return "密碼至少需要 6 個字元";
  if (m.includes("unable to validate email") || m.includes("invalid email"))
    return "電子郵件格式看起來不太對";
  if (m.includes("rate limit") || m.includes("too many")) return "嘗試次數太多，請稍後再試";
  if (m.includes("weak password") || m.includes("known to be weak") || m.includes("pwned"))
    return "這組密碼太容易被猜到，請換一組更獨特的密碼";
  if (m.includes("same as the old password") || m.includes("should be different"))
    return "新密碼不能和舊密碼相同";
  if (m.includes("email address") && m.includes("invalid")) return "這個電子郵件無法使用，請換一個";
  if (m.includes("network") || m.includes("failed to fetch")) return "網路連線不穩，請再試一次";
  return "發生問題，請稍後再試一次";
}
