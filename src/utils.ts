export function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    let r = (Math.random() * 16) | 0,
      v = c == 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const FAKE_TIME = // for local debugging
  //0;
  //*
  10000 * (1 + Math.floor(Math.random() * 9)) + 
  1000 * (1 + Math.floor(Math.random() * 9)) + 
    100 * (1 + Math.floor(Math.random() * 9));
  //*/
export function getLocalTimestamp(): number {
  const sResult = new Date().valueOf().toString().substring(3);
  return +sResult + FAKE_TIME;
}

// for debug purposes
const fakeTimestamp = getLocalTimestamp();
console.log(`FAKE TIME: ${FAKE_TIME}, fake timestamp=${fakeTimestamp}, time=${fakeTimestamp - FAKE_TIME}`);
   