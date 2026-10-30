export interface PasswordCheck {
  ok: boolean;
  reason?: string;
}

export function validatePassword(password: string): PasswordCheck {
  if (password.length === 0) {
    return { ok: false, reason: 'empty' };
  }
  let hasDigit = false;
  for (let i = 0; i < password.length; i++) {
    const ch = password[i];
    if (ch >= '0' && ch <= '9') {
      hasDigit = true;
    }
  }
  if (!hasDigit) {
    return { ok: false, reason: 'no_digit' };
  }
  let hasUpper = false;
  for (let i = 0; i < password.length; i++) {
    const ch = password[i];
    if (ch >= 'A' && ch <= 'Z') {
      hasUpper = true;
    }
  }
  if (!hasUpper) {
    return { ok: false, reason: 'no_upper' };
  }
  return { ok: true };
}

export function validateUsername(username: string): PasswordCheck {
  if (username.length === 0) {
    return { ok: false, reason: 'empty' };
  }
  let hasSpace = false;
  for (let i = 0; i < username.length; i++) {
    const ch = username[i];
    if (ch === ' ') {
      hasSpace = true;
    }
  }
  if (hasSpace) {
    return { ok: false, reason: 'has_space' };
  }
  return { ok: true };
}
