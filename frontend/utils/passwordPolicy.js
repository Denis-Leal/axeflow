export const PASSWORD_POLICY_HINT = 'Use de 15 a 72 caracteres. Acentos e emojis ocupam mais espaço e reduzem esse limite.';

export function validateNewPassword(password) {
  if (password.includes('\0')) {
    return 'A senha contém um caractere inválido.';
  }
  if (Array.from(password).length < 15) {
    return 'A senha deve ter pelo menos 15 caracteres.';
  }
  if (new TextEncoder().encode(password).length > 72) {
    return 'A senha deve ter no máximo 72 bytes UTF-8. Reduza o tamanho, considerando acentos e emojis.';
  }
  return '';
}
