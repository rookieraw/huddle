export const CHAT_CLOCK = Symbol('CHAT_CLOCK');

export interface ChatClock {
  now(): Date;
}
