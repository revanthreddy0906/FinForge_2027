/** What the organizer sign-in form shows after each step. */
export type LoginState =
  | { step: "password"; error?: string; fieldErrors?: { email?: string; password?: string } }
  | { step: "enroll"; factorId: string; qrCode: string; secret: string; error?: string }
  | { step: "verify"; factorId: string; error?: string };

export const initialLoginState: LoginState = { step: "password" };

export const loginCopy = {
  rateLimited: "Too many attempts from your network. Wait a minute, then try again.",
  wrongCredentials: "That email and password don't match an organizer account.",
  unavailable: "We couldn't sign you in right now. Try again in a minute.",
  wrongCode: "That code didn't work. Check the time on your phone and enter the newest code.",
  sessionLost: "Your sign-in expired. Enter your email and password again.",
  notOrganizer: "This account isn't on the organizer list, so it can't open the console.",
} as const;
