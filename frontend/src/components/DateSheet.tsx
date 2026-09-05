import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

const WEEK = ["日", "一", "二", "三", "四", "五", "六"];

export function formatDateLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "選擇日期";
  const today = new Date();
  const isToday =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();
  const base = `${d.getMonth() + 1} 月 ${d.getDate()} 日（${WEEK[d.getDay()]}）`;
  return isToday ? `今天，${base}` : base;
}

function toISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

export function DateSheet({
  open,
  value,
  onClose,
  onSelect,
}: {
  open: boolean;
  value: string;
  onClose: () => void;
  onSelect: (iso: string) => void;
}) {
  const todayISO = useMemo(() => toISO(new Date()), []);
  const [cursor, setCursor] = useState(() => {
    const d = new Date(`${value || todayISO}T00:00:00`);
    return Number.isNaN(d.getTime()) ? new Date() : d;
  });

  useEffect(() => {
    if (!open) return;
    const d = new Date(`${value || todayISO}T00:00:00`);
    if (!Number.isNaN(d.getTime())) setCursor(d);
  }, [open, value, todayISO]);

  if (!open) return null;

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: Array<string | null> = [
    ...Array.from({ length: firstDay }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => toISO(new Date(year, month, i + 1))),
  ];

  return (
    <div className="picker-backdrop" role="dialog" aria-modal="true" aria-label="選擇日期">
      <button className="picker-scrim" aria-label="關閉" onClick={onClose} />
      <div className="picker-sheet">
        <div className="picker-head">
          <button className="picker-nav" aria-label="上個月" onClick={() => setCursor(new Date(year, month - 1, 1))}>
            <ChevronLeft size={18} />
          </button>
          <strong>
            {year} 年 {month + 1} 月
          </strong>
          <button className="picker-nav" aria-label="下個月" onClick={() => setCursor(new Date(year, month + 1, 1))}>
            <ChevronRight size={18} />
          </button>
          <button className="picker-close" aria-label="關閉日期選擇" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="cal-week">
          {WEEK.map((w) => (
            <span key={w}>{w}</span>
          ))}
        </div>
        <div className="cal-grid">
          {cells.map((iso, i) => {
            if (!iso) return <span key={`e${i}`} className="cal-cell empty" />;
            const past = iso < todayISO;
            const classes = [
              "cal-cell",
              past ? "disabled" : "",
              iso === todayISO ? "today" : "",
              iso === value ? "selected" : "",
            ]
              .filter(Boolean)
              .join(" ");
            return (
              <button
                key={iso}
                className={classes}
                disabled={past}
                onClick={() => {
                  onSelect(iso);
                  onClose();
                }}
              >
                {Number(iso.slice(-2))}
              </button>
            );
          })}
        </div>
        <p className="picker-hint">已過去的日期無法選擇</p>
      </div>
    </div>
  );
}

export const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const h = String(Math.floor(i / 2)).padStart(2, "0");
  const m = i % 2 === 0 ? "00" : "30";
  return `${h}:${m}`;
});

const ITEM_H = 44;

export function TimeSheet({
  open,
  title,
  value,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  value: string;
  onClose: () => void;
  onConfirm: (time: string) => void;
}) {
  const listRef = useRef<HTMLDivElement | null>(null);
  const [index, setIndex] = useState(() => Math.max(0, TIME_OPTIONS.indexOf(value)));

  useEffect(() => {
    if (!open) return;
    const next = Math.max(0, TIME_OPTIONS.indexOf(value));
    setIndex(next);
    requestAnimationFrame(() => {
      if (listRef.current) listRef.current.scrollTop = next * ITEM_H;
    });
  }, [open, value]);

  if (!open) return null;

  return (
    <div className="picker-backdrop" role="dialog" aria-modal="true" aria-label={title}>
      <button className="picker-scrim" aria-label="關閉" onClick={onClose} />
      <div className="picker-sheet">
        <div className="wheel-head">
          <button className="wheel-action" onClick={onClose}>
            取消
          </button>
          <strong>{title}</strong>
          <button className="wheel-action done" onClick={() => onConfirm(TIME_OPTIONS[index]!)}>
            完成
          </button>
        </div>
        <div className="wheel-wrap">
          <div className="wheel-highlight" />
          <div
            className="wheel-list"
            ref={listRef}
            onScroll={(e) => {
              const next = Math.round(e.currentTarget.scrollTop / ITEM_H);
              setIndex(Math.min(TIME_OPTIONS.length - 1, Math.max(0, next)));
            }}
          >
            {TIME_OPTIONS.map((t, i) => (
              <button
                key={t}
                className={`wheel-item ${i === index ? "active" : ""}`}
                onClick={() => {
                  setIndex(i);
                  if (listRef.current) listRef.current.scrollTop = i * ITEM_H;
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
