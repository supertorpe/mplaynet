export function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    let r = (Math.random() * 16) | 0,
      v = c == 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function generateRandomLetters(length: number) {
  let code = '';
  for (let i = 0; i < length; i++) {
    const ndx = Math.floor(Math.random() * LETTERS.length);
    code += LETTERS[ndx];
  }
  return code;
}
