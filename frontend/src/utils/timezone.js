let _sourceTZ = 'UTC';

export async function fetchTimezone() {
  try {
    const res = await fetch('/api/config');
    const data = await res.json();
    _sourceTZ = data.timezone || 'UTC';
  } catch {
    _sourceTZ = 'UTC';
  }
}

export function getSourceTZ() {
  return _sourceTZ;
}

export function toDateFromVnstat({ year, month, day }, time) {
  const hour = time?.hour ?? 0;
  const minute = time?.minute ?? 0;
  const pad = n => String(n).padStart(2, '0');
  const iso = `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:00`;
  const refUTC = new Date(iso + 'Z');

  if (!_sourceTZ || _sourceTZ === 'UTC' || _sourceTZ === 'Etc/UTC') return refUTC;

  const fmtOpts = {
    timeZone: _sourceTZ,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  };

  const tzParts = {};
  new Intl.DateTimeFormat('en-US', fmtOpts).formatToParts(refUTC).forEach(p => {
    if (p.type !== 'literal') tzParts[p.type] = parseInt(p.value, 10);
  });

  const utcParts = {};
  new Intl.DateTimeFormat('en-US', { ...fmtOpts, timeZone: 'UTC' }).formatToParts(refUTC).forEach(p => {
    if (p.type !== 'literal') utcParts[p.type] = parseInt(p.value, 10);
  });

  const tzAsUTC = Date.UTC(
    utcParts.year, utcParts.month - 1, utcParts.day,
    utcParts.hour, utcParts.minute, utcParts.second || 0
  );
  const tzDisplay = Date.UTC(
    tzParts.year, tzParts.month - 1, tzParts.day,
    tzParts.hour, tzParts.minute, tzParts.second || 0
  );

  const offsetMs = refUTC.getTime() - tzDisplay;
  return new Date(tzAsUTC + offsetMs);
}
