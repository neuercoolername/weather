import { getIronSession, type IronSession } from "iron-session";
import { cookies } from "next/headers";
import { sessionOptions } from "./session-config";

export interface SessionData {
  isLoggedIn: boolean;
}

export async function getSession(): Promise<IronSession<SessionData>> {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}
