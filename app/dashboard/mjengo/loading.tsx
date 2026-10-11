import { MjengoLoader } from "./_components/MjengoLoader";

/** Shown at once while any Mjengo section loads: the same animation the chats use. */
export default function Loading() {
	return <MjengoLoader label="Loading" />;
}
