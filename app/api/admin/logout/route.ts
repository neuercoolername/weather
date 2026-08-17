import { getSession } from "@/lib/server/auth/session";
import { redirectToPath } from "@/lib/server/auth/redirect";

export async function POST() {
  const session = await getSession();
  session.destroy();
  return redirectToPath("/admin/login");
}
