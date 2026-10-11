// Reads a line from the terminal without echoing it (for passwords). Requires an interactive terminal.
export function promptHidden(question) {
  return new Promise((resolve, reject) => {
    const { stdin, stdout } = process;
    if (!stdin.isTTY) {
      reject(new Error('Interactive password entry needs a terminal.'));
      return;
    }
    stdout.write(question);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    let value = '';
    const finish = () => {
      stdin.removeListener('data', onData);
      stdin.setRawMode(false);
      stdin.pause();
      stdout.write('\n');
    };
    function onData(chunk) {
      for (const char of chunk) {
        if (char === '\r' || char === '\n' || char === '\u0004') {
          finish();
          resolve(value);
          return;
        }
        if (char === '\u0003') {
          finish();
          reject(new Error('Cancelled.'));
          return;
        }
        if (char === '\u007f' || char === '\b') value = value.slice(0, -1);
        else if (char >= ' ') value += char;
      }
    }
    stdin.on('data', onData);
  });
}
