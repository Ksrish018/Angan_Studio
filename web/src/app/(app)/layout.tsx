import { Shell } from "@/components/shell";
import { viewer } from "@/lib/auth";
import { sql } from "@/lib/db";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const [me, team] = await Promise.all([
    viewer(),
    sql`select id, name from designers where active order by is_principal desc, name`.then((r) => r as { id: number; name: string }[]),
  ]);
  return <Shell me={me} team={team}>{children}</Shell>;
}
