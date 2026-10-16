/**
 * Release "top comments".
 *
 * Source: the English neutral list of pyjokes, https://github.com/pyjokes/pyjokes
 * (`pyjokes/jokes_en.py`), whose jokes come from the Stack Overflow question "What is your best
 * programmer joke?", http://stackoverflow.com/questions/234075/what-is-your-best-programmer-joke
 * Authors: Stack Overflow contributors, collected by the pyjokes project.
 * License: CC BY-SA 3.0, https://creativecommons.org/licenses/by-sa/3.0/
 *
 * Quoted verbatim. This file (only) is distributed under CC BY-SA 3.0; the rest of the project
 * stays under its own license. Credits: THIRD_PARTY_NOTICES.md and Settings → Credits.
 */
import type { ReleaseComment } from '../game/catalog';

export const RELEASE_COMMENTS_ATTRIBUTION =
  'Top comments: programmer jokes by Stack Overflow contributors, collected by pyjokes (CC BY-SA 3.0).';

export const releaseComments: readonly ReleaseComment[] = [
  { id: 'c01', text: "If at first you don't succeed, call it version 1.0." },
  { id: 'c02', text: 'Hey! It compiles! Ship it!' },
  { id: 'c03', text: 'You never finish a program, you just stop working on it.' },
  { id: 'c04', text: "Bug? That's not a bug, that's a feature." },
  {
    id: 'c05',
    text: 'A product manager walks into a bar, asks for drink. Bartender says no, but will consider adding later.',
  },
  { id: 'c06', text: 'I have a joke on programming but it only works on my computer.' },
  { id: 'c07', text: "My attitude isn't bad. It's in beta." },
  {
    id: 'c08',
    text: "Computer analyst to programmer: You start coding. I'll go find out what they want.",
  },
  {
    id: 'c09',
    text: "Child: Dad, why does the sun rise in the east and set in the west? Dad: Son, it's working, don't touch it.",
  },
  {
    id: 'c10',
    text: 'QA Engineer walks into a bar. Orders a beer. Orders 0 beers. Orders 999999999 beers. Orders a lizard. Orders -1 beers. Orders a sfdeljknesv.',
  },
  { id: 'c11', text: 'Artificial intelligence usually beats real stupidity.' },
  {
    id: 'c12',
    text: 'Software developers like to solve problems. If there are no problems handily available, they will create their own.',
  },
  { id: 'c13', text: 'You are making progress if each mistake is a new one.' },
  { id: 'c14', text: 'The program is absolutely right; therefore the computer must be wrong.' },
  { id: 'c15', text: 'Number of days since I have encountered an off-by-one error: 0.' },
  { id: 'c16', text: 'A user friendly computer first requires a friendly user.' },
  { id: 'c17', text: 'There are two ways to write error-free programs; only the third one works.' },
  { id: 'c18', text: 'Programmers are tools for converting caffeine into code.' },
];
