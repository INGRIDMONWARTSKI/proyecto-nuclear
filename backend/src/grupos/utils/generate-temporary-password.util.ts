export function generateTemporaryPassword(length = 12): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const special = '!@*';
  const all = upper + lower + digits + special;

  const pick = (chars: string) =>
    chars[Math.floor(Math.random() * chars.length)] ?? chars[0];

  const required = [pick(upper), pick(lower), pick(digits), pick(special)];
  const rest = Array.from({ length: Math.max(length - required.length, 0) }, () =>
    pick(all),
  );

  return [...required, ...rest]
    .sort(() => Math.random() - 0.5)
    .join('');
}
