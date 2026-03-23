export interface RawInput {
  link?: string;
  name?: string;
  format?: string;
  destination?: string;
  backend?: string;
}

export interface IInputReader {
  read(): RawInput;
}
