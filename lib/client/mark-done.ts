import { saveEntity, saveTodo } from "@/app/actions/mjengo";
import { R, fresh } from "@/lib/client/resources";

export type DoneKind = "todo" | "grant" | "opportunity" | "project" | "fellowship";

/** The status that means "nothing more to do about it" for each kind of record. */
const DONE_STATUS = { grant: "submitted", opportunity: "applied", project: "completed", fellowship: "completed" } as const;

export const canMarkDone = (kind: string): kind is DoneKind => kind === "todo" || kind in DONE_STATUS;

/** Marks a to-do or a record done, then refreshes everything on the Overview that counts it. */
export async function markDone(kind: DoneKind, id: string) {
	if (kind === "todo") await saveTodo(id, { status: "done" });
	else await saveEntity(kind, id, { status: DONE_STATUS[kind] });
	await Promise.all([fresh(R.overview), fresh(R.suite), fresh(R.caughtUp)]).catch(() => undefined);
}
