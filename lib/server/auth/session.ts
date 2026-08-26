import "server-only";

import { getIronSession, type IronSession } from "iron-session";
import { cookies } from "next/headers";
import { sessionOptions } from "@/lib/server/auth/session-config";

export interface SessionData {
  isLoggedIn: boolean;
  /** Set by the viewer password, which grants the public trace but not `/admin`. Optional
   *  because sessions sealed before the gate existed carry only `isLoggedIn`. */
  isViewer?: boolean;
}

export async function getSession(): Promise<IronSession<SessionData>> {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}
