/** What the organizer sign-in form shows after each step. */
export type LoginState =
  | { step: "password"; error?: string; fieldErrors?: { email?: string; password?: string } }
  /** qrCode is "" when the server asks the form to keep showing the QR code it already has. */
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

/** The previous state as sent to the server: never the QR code, which only the form needs. */
export function withoutQrCode(state: LoginState): LoginState {
  return state.step === "enroll" ? { ...state, qrCode: "" } : state;
}

/** Puts the form's copy of the QR code back when the server returned the step without it. */
export function keepQrCode(previous: LoginState, next: LoginState): LoginState {
  if (next.step === "enroll" && next.qrCode === "" && previous.step === "enroll") {
    return { ...next, qrCode: previous.qrCode };
  }
  return next;
}
