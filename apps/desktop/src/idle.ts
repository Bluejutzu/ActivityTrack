import koffi from "koffi";

/**
 * Idle detection via the Win32 API — NOT a keylogger.
 *
 * We call user32!GetLastInputInfo, which returns the tick count of the most
 * recent keyboard/mouse input system-wide. We never capture WHICH keys were
 * pressed or where the mouse went — only "how long since the last input".
 * This is the whole privacy story: activity, not content.
 *
 * IMPORTANT: GetLastInputInfo only reports input for the calling session, so the
 * agent must run in the interactive user session (scheduled task at logon),
 * NOT as a session-0 Windows service.
 */
const user32 = koffi.load("user32.dll");
const kernel32 = koffi.load("kernel32.dll");

// typedef struct { UINT cbSize; DWORD dwTime; } LASTINPUTINFO;
const LASTINPUTINFO = koffi.struct("LASTINPUTINFO", {
  cbSize: "uint32",
  dwTime: "uint32",
});

const GetLastInputInfo = user32.func("__stdcall", "GetLastInputInfo", "bool", [
  koffi.out(koffi.pointer(LASTINPUTINFO)),
]);
const GetTickCount = kernel32.func("__stdcall", "GetTickCount", "uint32", []);

/** Milliseconds since the last keyboard or mouse input in this session. */
export function getIdleMs(): number {
  const info = { cbSize: koffi.sizeof(LASTINPUTINFO), dwTime: 0 };
  if (!GetLastInputInfo(info)) return 0;
  // Handle the 32-bit tick wraparound (~49.7 days uptime).
  const delta = (GetTickCount() - info.dwTime) >>> 0;
  return delta;
}
