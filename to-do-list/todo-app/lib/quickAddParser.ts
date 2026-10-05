export interface ParsedQuickAdd {
  title: string;
  description: string;
  dueDate: Date | null;
  tags: string[];
}

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

function stripMatch(text: string, match: RegExpMatchArray): string {
  const start = match.index ?? 0;
  return (text.slice(0, start) + text.slice(start + match[0].length))
    .replace(/\s{2,}/g, " ")
    .trim();
}

function parseTime(text: string): { time: { h: number; m: number } | null; rest: string } {
  // "at 12:30pm", "at 5pm", "at 14:00", "12pm", "noon", "midnight"
  const named = text.match(/\b(noon|midnight)\b/i);
  if (named) {
    const isNoon = named[1].toLowerCase() === "noon";
    return { time: { h: isNoon ? 12 : 0, m: 0 }, rest: stripMatch(text, named) };
  }

  // Scan every digit-led candidate and score it — an explicit am/pm or a
  // colon is unambiguous; a bare "at N" is a weaker signal; a lone number
  // with none of those (e.g. "buy 5 apples") is too ambiguous to use.
  const timeRe = /\b(?:(at)\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/gi;
  let best: RegExpExecArray | null = null;
  let bestScore = -1;
  let m: RegExpExecArray | null;
  while ((m = timeRe.exec(text)) !== null) {
    const hasMeridiem = Boolean(m[4]);
    const hasColon = Boolean(m[3]);
    const hasAt = Boolean(m[1]);
    if (!hasMeridiem && !hasColon && !hasAt) continue; // too ambiguous, skip
    const score = (hasMeridiem ? 2 : 0) + (hasColon ? 1 : 0) + (hasAt ? 1 : 0);
    if (score > bestScore) {
      best = m;
      bestScore = score;
    }
  }

  if (best) {
    let h = parseInt(best[2], 10);
    const minute = best[3] ? parseInt(best[3], 10) : 0;
    const meridiem = best[4]?.toLowerCase();
    if (h > 23 || minute > 59) return { time: null, rest: text };

    if (meridiem === "pm" && h < 12) h += 12;
    if (meridiem === "am" && h === 12) h = 0;

    const matchArr = best as unknown as RegExpMatchArray;
    return { time: { h, m: minute }, rest: stripMatch(text, matchArr) };
  }

  return { time: null, rest: text };
}

function parseDate(text: string): { date: Date | null; rest: string } {
  const now = new Date();

  const todayMatch = text.match(/\b(today|tonight)\b/i);
  if (todayMatch) {
    return { date: new Date(now.getFullYear(), now.getMonth(), now.getDate()), rest: stripMatch(text, todayMatch) };
  }

  const tomorrowMatch = text.match(/\btomorrow\b/i);
  if (tomorrowMatch) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    d.setDate(d.getDate() + 1);
    return { date: d, rest: stripMatch(text, tomorrowMatch) };
  }

  const inDaysMatch = text.match(/\bin\s+(\d+)\s+days?\b/i);
  if (inDaysMatch) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    d.setDate(d.getDate() + parseInt(inDaysMatch[1], 10));
    return { date: d, rest: stripMatch(text, inDaysMatch) };
  }

  const nextWeekMatch = text.match(/\bnext week\b/i);
  if (nextWeekMatch) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    d.setDate(d.getDate() + 7);
    return { date: d, rest: stripMatch(text, nextWeekMatch) };
  }

  const weekdayRe = new RegExp(`\\b(next\\s+|this\\s+)?(${WEEKDAYS.join("|")})\\b`, "i");
  const weekdayMatch = text.match(weekdayRe);
  if (weekdayMatch) {
    const targetDay = WEEKDAYS.indexOf(weekdayMatch[2].toLowerCase());
    const isNext = /next/i.test(weekdayMatch[1] ?? "");
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let diff = (targetDay - d.getDay() + 7) % 7;
    if (diff === 0 && isNext) diff = 7;
    if (diff === 0 && !isNext) diff = 0;
    if (isNext && diff < 7 && diff !== 0) diff += 0;
    d.setDate(d.getDate() + diff);
    return { date: d, rest: stripMatch(text, weekdayMatch) };
  }

  // "Aug 20", "August 20th", "8/20", "8-20"
  const monthNames = "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?";
  const monthDayRe = new RegExp(`\\b(${monthNames})\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`, "i");
  const monthDayMatch = text.match(monthDayRe);
  if (monthDayMatch) {
    const monthIndex = [
      "jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec",
    ].findIndex((m) => monthDayMatch[1].toLowerCase().startsWith(m));
    const day = parseInt(monthDayMatch[2], 10);
    let year = now.getFullYear();
    let d = new Date(year, monthIndex, day);
    if (d.getTime() < new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) {
      year += 1;
      d = new Date(year, monthIndex, day);
    }
    return { date: d, rest: stripMatch(text, monthDayMatch) };
  }

  const numericDateRe = /\b(\d{1,2})[/-](\d{1,2})\b/;
  const numericMatch = text.match(numericDateRe);
  if (numericMatch) {
    const month = parseInt(numericMatch[1], 10) - 1;
    const day = parseInt(numericMatch[2], 10);
    if (month >= 0 && month <= 11 && day >= 1 && day <= 31) {
      let year = now.getFullYear();
      let d = new Date(year, month, day);
      if (d.getTime() < new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) {
        year += 1;
        d = new Date(year, month, day);
      }
      return { date: d, rest: stripMatch(text, numericMatch) };
    }
  }

  return { date: null, rest: text };
}

function capitalize(s: string): string {
  return s.length > 0 ? s[0].toUpperCase() + s.slice(1) : s;
}

export function parseQuickAdd(input: string): ParsedQuickAdd {
  let text = input.trim();

  const tags: string[] = [];
  text = text.replace(/#(\w+)/g, (_, tag) => {
    tags.push(tag.toLowerCase());
    return "";
  }).trim();

  const { time, rest: afterTime } = parseTime(text);
  const { date, rest: afterDate } = parseDate(afterTime);

  let dueDate: Date | null = null;
  if (date || time) {
    const base = date ?? new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
    dueDate = new Date(base);
    if (time) {
      dueDate.setHours(time.h, time.m, 0, 0);
    } else {
      dueDate.setHours(9, 0, 0, 0);
    }
  }

  const cleaned = afterDate
    .replace(/\s+/g, " ")
    .replace(/^(on|at|for|to)\s+/i, "")
    .replace(/\s+(on|at)\s*$/i, "")
    .trim();

  // Optional "Title - description" or "Title: description" split.
  const splitMatch = cleaned.match(/^(.+?)\s*[-:]\s+(.+)$/);
  const title = capitalize(splitMatch ? splitMatch[1].trim() : cleaned) || input.trim();
  const description = splitMatch ? capitalize(splitMatch[2].trim()) : "";

  return { title, description, dueDate, tags };
}
