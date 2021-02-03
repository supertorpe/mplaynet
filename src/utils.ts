let MPLAYNET_DEBUG = false;

export {MPLAYNET_DEBUG};

export function setDebug(value: boolean) {
  MPLAYNET_DEBUG = value;
}

export function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    let r = (Math.random() * 16) | 0,
      v = c == 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const FAKE_TIME = // for local debugging
  0;
/*
  10000 * (1 + Math.floor(Math.random() * 9)) + 
  1000 * (1 + Math.floor(Math.random() * 9)) + 
    100 * (1 + Math.floor(Math.random() * 9));
//*/
export function getLocalTimestamp(): number {
  return new Date().valueOf() + FAKE_TIME;
}

// for debugging purposes
if (MPLAYNET_DEBUG) {
  const fakeTimestamp = getLocalTimestamp();
  console.log(`FAKE TIME: ${FAKE_TIME}, fake timestamp=${fakeTimestamp}, time=${fakeTimestamp - FAKE_TIME}`);
}
