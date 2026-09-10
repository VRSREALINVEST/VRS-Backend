/**
 * Calendar-day boundaries in the business's own timezone.
 *
 * VRS operates in Australia (en-AU, +61, NSW), while the server almost
 * certainly runs on UTC. Computing "today" from the server clock would roll
 * over at 10am/11am Sydney time, so every boundary here is derived from the
 * wall-clock date in APP_TIMEZONE and then converted back to the UTC instant
 * that MongoDB stores.
 *
 * Uses Intl, which is built into Node — no date library is added.
 */

const APP_TIMEZONE = process.env.APP_TIMEZONE || "Australia/Sydney";

/** Wall-clock offset (ms) of `instant` in `tz`, relative to UTC. */
const zoneOffsetMs = (instant, tz) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
    .formatToParts(instant)
    .reduce((acc, part) => {
      acc[part.type] = part.value;
      return acc;
    }, {});

  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    // Intl can emit hour "24" for midnight in some locales/zones.
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second)
  );

  return asUtc - instant.getTime();
};

/** The calendar Y/M/D that `instant` falls on in `tz`. */
const zonedParts = (instant, tz = APP_TIMEZONE) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .formatToParts(instant)
    .reduce((acc, part) => {
      acc[part.type] = part.value;
      return acc;
    }, {});

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
  };
};

/**
 * The UTC instant at which the local calendar day y-m-d starts in `tz`.
 * Out-of-range values roll over the way Date.UTC does, so day 0 is the last
 * day of the previous month and month 0 is December of the previous year.
 */
const startOfZonedDay = (year, month, day, tz = APP_TIMEZONE) => {
  const wallClock = Date.UTC(year, month - 1, day, 0, 0, 0, 0);

  // Applied twice so a boundary that lands on a DST transition settles.
  let instant = wallClock - zoneOffsetMs(new Date(wallClock), tz);
  instant = wallClock - zoneOffsetMs(new Date(instant), tz);

  return new Date(instant);
};

/**
 * Boundaries for the statistics cards.
 *
 * last7Days is the seven-day window ENDING TODAY (today plus the previous six
 * days), not the seven days before today.
 * lastMonth is the previous CALENDAR month, not the previous 30 days.
 */
const statBoundaries = (now = new Date(), tz = APP_TIMEZONE) => {
  const { year, month, day } = zonedParts(now, tz);

  return {
    todayStart: startOfZonedDay(year, month, day, tz),
    tomorrowStart: startOfZonedDay(year, month, day + 1, tz),
    last7Start: startOfZonedDay(year, month, day - 6, tz),
    lastMonthStart: startOfZonedDay(year, month - 1, 1, tz),
    thisMonthStart: startOfZonedDay(year, month, 1, tz),
  };
};

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Turn ?from=YYYY-MM-DD&to=YYYY-MM-DD into a Mongo range.
 *
 * `to` is INCLUSIVE: it becomes "< start of the following day", so an enquiry
 * submitted at 4pm on the To date is still matched. Using the To date's own
 * midnight would silently drop everything submitted later that day.
 */
const parseDateRange = (from, to, tz = APP_TIMEZONE) => {
  const result = { gte: null, lt: null, invalid: false };

  const parse = (value) => {
    if (typeof value !== "string" || !DATE_ONLY.test(value.trim())) return null;
    const [y, m, d] = value.trim().split("-").map(Number);
    if (m < 1 || m > 12 || d < 1 || d > 31) return null;
    return { y, m, d };
  };

  const fromParts = parse(from);
  const toParts = parse(to);

  if (from && !fromParts) return { ...result, invalid: true };
  if (to && !toParts) return { ...result, invalid: true };

  if (fromParts) {
    result.gte = startOfZonedDay(fromParts.y, fromParts.m, fromParts.d, tz);
  }

  if (toParts) {
    result.lt = startOfZonedDay(toParts.y, toParts.m, toParts.d + 1, tz);
  }

  if (result.gte && result.lt && result.gte >= result.lt) {
    return { ...result, invalid: true };
  }

  return result;
};

module.exports = {
  APP_TIMEZONE,
  zonedParts,
  startOfZonedDay,
  statBoundaries,
  parseDateRange,
};
