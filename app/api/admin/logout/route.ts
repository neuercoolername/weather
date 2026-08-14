import { getSession } from "@/lib/session";
import { redirectToPath } from "@/lib/redirect";

export async function POST() {
  const session = await getSession();
  session.destroy();
  return redirectToPath("/admin/login");
}
