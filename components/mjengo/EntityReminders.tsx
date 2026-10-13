"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { ReminderList } from "./ReminderList";
import { getReminders, setReminders } from "@/app/actions/mjengo-reminders";
import { unwrap } from "@/lib/action-result";
import type { ReminderEntity } from "@/lib/mjengo/entity-reminders";

/** Your reminders for one saved item: loaded when shown and saved as they change. */
export function EntityReminders({ type, id }: { type: ReminderEntity; id: string }) {
	const [value, setValue] = useState<number[] | null>(null);
	const [saving, setSaving] = useState(false);
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
	useEffect(() => {
		setValue(null);
		unwrap(getReminders(type, id)).then(setValue).catch(() => setValue([]));
	}, [type, id]);
	const change = (v: number[]) => {
		setValue(v);
		if (timer.current) clearTimeout(timer.current);
		timer.current = setTimeout(async () => {
			setSaving(true);
			try { await unwrap(setReminders(type, id, v)); } catch { /* shown on the next load */ } finally { setSaving(false); }
		}, 500);
	};
	if (value === null) return <Loader2 className="h-4 w-4 animate-spin text-serene-neutral-400" />;
	return (
		<div>
			<ReminderList value={value} onChange={change} units={["hours", "days", "weeks"]} emptyHint="No reminders yet." />
			<p className="mt-1 text-[11px] text-serene-neutral-400">Counted from 9:00 on the day it is due. {saving ? "Saving..." : "Saved as you change them."}</p>
		</div>
	);
}
