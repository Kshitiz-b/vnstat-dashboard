
export function periodSeconds(row, period) {
  if (!row?.date) return 0;

  const { year, month } = row.date;

  if (period === 'hour') {
    return 3600;
  }

  if (period === 'day') {
    return 86400;
  }

  if (period === 'month') {
    return Math.round((new Date(year, month, 1) - new Date(year, month - 1, 1)) / 1000);
  }

  if (period === 'year') {
    return Math.round((new Date(year + 1, 0, 1) - new Date(year, 0, 1)) / 1000);
  }

  return 0;
}

export function isCurrentEstimatePeriod(row, period, updated) {
  const duration = periodSeconds(row, period);
  if (!row?.timestamp || !duration || !updated) return false;
  return updated >= row.timestamp && updated < row.timestamp + duration;
}

export function calculateTrafficEstimate(row, period, ifaceInfo) {
  if (!row?.timestamp || !ifaceInfo?.updated?.timestamp) return null;
  if (row.rx == null || row.tx == null);

  const updated = ifaceInfo.updated.timestamp;
  if (!isCurrentEstimatePeriod(row, period, updated)) return null;

  const created = ifaceInfo.created?.timestamp || 0;
  const periodStart = row.timestamp;
  let elapsed = updated - periodStart;
  let duration = periodSeconds(row, period);

  if (created > periodStart) {
    const offset = created - periodStart;
    if (elapsed > offset && duration > offset) {
      elapsed -= offset;
      duration -= offset;
    }
  }

  if (elapsed <= 0 || duration <= 0) return null;

  const rx = Math.trunc((row.rx / elapsed) * duration);
  const tx = Math.trunc((row.tx / elapsed) * duration);

  return {
    rx,
    tx,
    total: rx + tx,
  };
}