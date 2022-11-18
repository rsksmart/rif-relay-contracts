import fs from 'node:fs';

export const parseJsonFile = <T>(filePath: string, raiseError = true) => {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, { encoding: 'utf-8' })) as T;
    }
    if (raiseError) {
      throw new Error(`The file ${filePath} doesn't exist`);
    }
  } catch (e) {
    if (raiseError) {
      throw e;
    }
    console.warn(e);
  }

  return {};
};
