import fs from 'fs';

// TODO: we may convert this function to return a promise
export const parseJsonFile = <T>(filePath: string) => {
  if (fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath, { encoding: 'utf-8' })) as T;
  }
  throw new Error(`The file ${filePath} doesn't exist`);
};
