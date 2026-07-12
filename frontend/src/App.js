import React, { useState, useEffect } from 'react';
import './App.css';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts';
import { Network, Activity, Calendar, Clock, TrendingUp, Download, Upload, Server, Github } from 'lucide-react';
import { HourlyTable, DailyTable, MonthlyTable, YearlyTable } from './components/TrafficTable';


function formatDate({ year, month, day }) {
  const date = new Date(year, month - 1, day);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[date.getMonth()]} ${date.getDate().toString().padStart(2, '0')}, ${date.getFullYear()}`;
}

function formatTime({ hour, minute }) {
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')} ${period}`;
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024, dm = 2;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function formatMonthYear(year, month) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[month - 1]} ${year}`;
}

function periodSeconds(row, period) {
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

function isCurrentEstimatePeriod(row, period, updated) {
  const duration = periodSeconds(row, period);
  if (!row?.timestamp || !duration || !updated) return false;
  return updated >= row.timestamp && updated < row.timestamp + duration;
}

function getTrafficEstimate(row, period, ifaceInfo) {
  if (!row?.timestamp || !ifaceInfo?.updated?.timestamp) return null;
  if (!row.rx || !row.tx) return null;

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

const TABS = [
  { id: 'Summary', label: 'Summary', icon: Activity },
  { id: 'Hourly', label: 'Hourly', icon: Clock },
  { id: 'Daily', label: 'Daily', icon: Calendar },
  { id: 'Monthly', label: 'Monthly', icon: Calendar },
  { id: 'Yearly', label: 'Yearly', icon: TrendingUp }
];

function App() {

  const DEFAULT_TAB = 'Summary';
  const CONFIG_KEY = 'vnstat_config';
  const LAST_TAB_KEY = 'vnstat_last_tab';
  const LAST_INTERFACE_KEY = 'vnstat_last_interface';

  // Config state (source of truth)
  const [config, setConfig] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(CONFIG_KEY));
      return stored || { mode: 'last', defaultTab: 'Summary' };
    } catch {
      return { mode: 'last', defaultTab: 'Summary' };
    }
  });

  // Tab state (derived from config initially)
  const [tab, setTab] = useState(() => {
    if (config.mode === 'fixed') return config.defaultTab;
    return localStorage.getItem(LAST_TAB_KEY) || DEFAULT_TAB;
  });

  const [selected, setSelected] = useState(() => localStorage.getItem(LAST_INTERFACE_KEY) || '');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [interfaces, setInterfaces] = useState([]);
  const [ifaceLoading, setIfaceLoading] = useState(true);

  // Persist config
  useEffect(() => {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  }, [config]);

  // Persist last opened tab
  useEffect(() => {
    localStorage.setItem(LAST_TAB_KEY, tab);
  }, [tab]);

  // Persist last selected interface
  useEffect(() => {
    if (selected) {
      localStorage.setItem(LAST_INTERFACE_KEY, selected);
    }
  }, [selected]);

  // React to config changes (MAIN FIX)
  useEffect(() => {
    if (config.mode === 'fixed') {
      setTab(config.defaultTab);
    } else if (config.mode === 'last') {
      const last = localStorage.getItem(LAST_TAB_KEY);
      if (last) setTab(last);
      else setTab(DEFAULT_TAB);
    }
  }, [config]);

  useEffect(() => {
    fetch('/api/interfaces')
      .then(res => res.json())
      .then(data => {
        if (data && Array.isArray(data.interfaces)) {
          setInterfaces(data.interfaces);
        }
      })
      .catch(err => console.error('Failed to fetch interfaces:', err))
      .finally(() => setIfaceLoading(false));
  }, []);

  useEffect(() => {
    if (interfaces.length === 0) return;
    if (!selected || !interfaces.includes(selected)) {
      const storedInterface = localStorage.getItem(LAST_INTERFACE_KEY);
      setSelected(storedInterface && interfaces.includes(storedInterface)
        ? storedInterface
        : interfaces[0]);
    }
  }, [interfaces, selected]);

  useEffect(() => {
    if (!selected) return;
    setLoading(true);
    fetch(`/api/vnstat/${selected}`)
      .then(res => res.json())
      .then(setData)
      .catch(err => {
        console.error('Failed to fetch vnstat data:', err);
        setData(null);
      })
      .finally(() => setLoading(false));

  }, [selected]);

  const ifaceInfo = data && data.interfaces ? data.interfaces[0] : null;
  const traffic = ifaceInfo ? ifaceInfo.traffic : null;
  const hourly = traffic && traffic.hour
    ? [...traffic.hour]
      .filter(row => row.time && typeof row.time.hour === 'number')
      .sort((a, b) => {
        const dateA = new Date(a.date.year, a.date.month - 1, a.date.day, a.time.hour);
        const dateB = new Date(b.date.year, b.date.month - 1, b.date.day, b.time.hour);
        return dateB - dateA;
      })
      .slice(0, 24)
    : [];

  const daily = traffic && traffic.day
    ? [...traffic.day].sort((a, b) => {
      const dateA = new Date(a.date.year, a.date.month - 1, a.date.day);
      const dateB = new Date(b.date.year, b.date.month - 1, b.date.day);
      return dateB - dateA;
    })
    : [];

  const monthly = traffic && traffic.month
    ? [...traffic.month].sort((a, b) => {
      const dateA = new Date(a.date.year, a.date.month - 1);
      const dateB = new Date(b.date.year, b.date.month - 1);
      return dateB - dateA;
    })
    : [];

  const yearly = traffic && traffic.year
    ? [...traffic.year].sort((a, b) => b.date.year - a.date.year)
    : [];

  const fivemin = traffic && traffic.fiveminute
    ? traffic.fiveminute.slice(-10).reverse()
    : [];

  const hourlyEstimate = hourly.length > 0 ? getTrafficEstimate(hourly[0], 'hour', ifaceInfo) : null;
  const dailyEstimate = daily.length > 0 ? getTrafficEstimate(daily[0], 'day', ifaceInfo) : null;
  const monthlyEstimate = monthly.length > 0 ? getTrafficEstimate(monthly[0], 'month', ifaceInfo) : null;
  const yearlyEstimate = yearly.length > 0 ? getTrafficEstimate(yearly[0], 'year', ifaceInfo) : null;

  const getLabel = (row, type) => {
    if (type === 'hourly') {
      const date = new Date(row.date.year, row.date.month - 1, row.date.day, row.time.hour);
      return date.toLocaleString('en-US', {
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        hour12: true
      });
    }
    if (type === 'daily') return formatDate(row.date);
    if (type === 'monthly') return formatMonthYear(row.date.year, row.date.month);
    if (type === 'yearly') return `${row.date.year}`;
    return '';
  };

  const graphData = (rows, type, estimate) => rows.map((row, index) => {
    const isEstimateTarget = estimate && index === rows.length - 1;

    return {
      name: getLabel(row, type),
      RX: row.rx ? row.rx : 0,
      TX: row.tx ? row.tx : 0,
      Total: row.rx && row.tx ? row.rx + row.tx : 0,
      estimateRX: isEstimateTarget ? estimate.rx : null,
      estimateTX: isEstimateTarget ? estimate.tx : null,
      estimateTotal: isEstimateTarget ? estimate.total : null,
    };
  });

  const getChartRows = () => {
    if (tab === 'Hourly') return [...hourly.slice(-24)].reverse();
    if (tab === 'Daily') return [...daily].reverse();
    if (tab === 'Monthly') return [...monthly].reverse();
    if (tab === 'Yearly') return [...yearly].reverse();
    return [];
  };

  const getChartEstimate = () => {
    if (tab === 'Hourly') return hourlyEstimate;
    if (tab === 'Daily') return dailyEstimate;
    if (tab === 'Monthly') return monthlyEstimate;
    if (tab === 'Yearly') return yearlyEstimate;
    return null;
  };

  const CustomTooltip = ({ active, payload, label }) => {
    const visiblePayload = payload
      ? payload.filter(entry => entry.value !== null && entry.value !== undefined)
      : [];
    const labelMap = {
      estimateRX: 'RX Estimate',
      estimateTX: 'TX Estimate',
      estimateTotal: 'Total Estimate',
    };
    const colorMap = {
      RX: '#10B981',
      TX: '#3B82F6',
      Total: '#F97316',
      estimateRX: '#F59E0B',
      estimateTX: '#C084FC',
      estimateTotal: '#FACC15',
    };

    if (active && visiblePayload.length) {
      return (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 shadow-xl">
          <p className="text-gray-300 text-sm mb-2">{label}</p>
          {visiblePayload.map((entry, index) => (
            <div key={index} className="flex items-center gap-2 text-sm">
              <div
                aria-hidden="true"
                style={{
                  width: '0.75rem',
                  height: '0.75rem',
                  borderRadius: '9999px',
                  backgroundColor: colorMap[entry.dataKey] || entry.color,
                  flexShrink: 0,
                }}
              />
              <span className="text-gray-300">{labelMap[entry.dataKey] || entry.dataKey}:</span>
              <span className="text-white font-medium">{formatBytes(entry.value)}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  const EstimateDot = ({ cx, cy, value, fill, stroke, r = 6 }) => {
    if (cx == null || cy == null || value == null) return null;

    return (
      <circle
        className="estimate-dot"
        cx={cx}
        cy={cy}
        r={r}
        fill={fill}
        stroke={stroke}
        strokeWidth={2}
      />
    );
  };

  const EstimateCard = ({ title, estimate, accent = 'text-yellow-400' }) => {
    if (!estimate) return null;

    return (
      <div className="estimate-card bg-gray-900 rounded-md p-4 border border-gray-700">
        <div className="text-sm text-gray-400 mb-1">{title}</div>
        <div className={`text-xl font-bold ${accent}`}>{formatBytes(estimate.total)}</div>
        <div className="text-sm text-gray-400 mt-1">
          RX {formatBytes(estimate.rx)} / TX {formatBytes(estimate.tx)}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white mb-8">
      <div className="container mx-auto px-4 py-8 max-w-xl w-full">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            Network Traffic Dashboard
          </h1>
          <p className="text-gray-400">Monitor your network interface statistics in real-time</p>
        </div>
        <div class="github">
          <a class="github-icon" href="https://github.com/Kshitiz-b/vnstat-dashboard" target="_blank" rel="noreferrer">
            <Github class="h-5 w-5" />
            <span>Kshitiz-b</span>
          </a>

        </div>

        {/* Interface + View Controls */}
        <div className="mb-8 flex justify-center w-full">
          <div className="flex items-center justify-center gap-4 border border-gray-700 rounded-lg bg-gray-900 px-3 py-1">

            {/* Interface Section */}
            <div className="flex items-center gap-3 px-5 py-3">
              <Network className="h-4 w-4 text-gray-500 shrink-0" />
              <span className="text-[11px] uppercase tracking-wider font-medium text-gray-500 whitespace-nowrap">
                Interface
              </span>
              {ifaceLoading ? (
                <span className="text-gray-400 text-sm">Loading…</span>
              ) : (
                <select
                  value={selected}
                  onChange={e => setSelected(e.target.value)}
                  className="bg-gray-800 border border-gray-700 rounded-md px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  disabled={ifaceLoading || interfaces.length === 0}
                >
                  {interfaces.length > 0 ? (
                    interfaces.map(iface => (
                      <option key={iface} value={iface}>{iface}</option>
                    ))
                  ) : (
                    <option disabled>No interfaces found</option>
                  )}
                </select>
              )}
            </div>

            {/* View Section */}
            <div className="flex items-center gap-3 px-5 py-3">
              <Clock className="h-4 w-4 text-gray-500 shrink-0" />
              <span className="text-[11px] uppercase tracking-wider font-medium text-gray-500 whitespace-nowrap">
                View
              </span>
              <select
                value={config.mode}
                onChange={e => setConfig(prev => ({ ...prev, mode: e.target.value }))}
                className="bg-gray-800 border border-gray-700 rounded-md px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="last">Last view</option>
                <option value="fixed">Fixed view</option>
              </select>

              {config.mode === 'fixed' && (
                <select
                  value={config.defaultTab}
                  onChange={e => setConfig(prev => ({ ...prev, defaultTab: e.target.value }))}
                  className="bg-gray-800 border border-gray-700 rounded-md px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {TABS.map(t => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </select>
              )}
            </div>

          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mb-8">
          <div className="overflow-x-auto no-scrollbar">
            <div className="tab-bar">
              {TABS.map(t => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={`tab-button${t.id === tab ? ' active' : ''}`}
                  >
                    <Icon className="h-4 w-4" />
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-96">
              <div className="flex items-center gap-3">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                <span className="text-gray-400">Loading network data...</span>
              </div>
            </div>
          ) : !ifaceInfo ? (
            <div className="flex items-center justify-center h-96">
              <div className="text-center">
                <Server className="h-12 w-12 text-gray-500 mx-auto mb-4" />
                <p className="text-gray-400">No data available for this interface</p>
              </div>
            </div>
          ) : tab === "Summary" ? (
            <div className="p-8">
              <div className="mb-8">
                <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                  <Activity className="h-6 w-6 text-blue-400" />
                  {ifaceInfo.name} Overview
                </h2>

                {/* Stats Grid */}
                <div className="overview-grid grid grid-cols-1 xl:grid-cols-2 gap-4 mb-8 items-stretch">
                  <div className="overview-card bg-gray-800 rounded-lg p-6 border border-gray-700">
                    <div className="traffic-overview-layout grid grid-cols-1 md:grid-cols-2 gap-4 h-full">
                      <div className="overview-subcard traffic-total-card bg-gray-900 rounded-md p-5 border border-gray-700 flex flex-col justify-center">
                        <div className="flex items-center gap-2 mb-4">
                          <Activity className="h-5 w-5 text-yellow-400 shrink-0" />
                          <span className="text-sm font-medium text-gray-400">Total Traffic</span>
                        </div>
                        <div className="overview-total-value text-4xl font-bold text-yellow-400 leading-tight text-right">
                          {formatBytes((traffic.total.rx || 0) + (traffic.total.tx || 0))}
                        </div>
                      </div>

                      <div className="traffic-detail-stack grid grid-rows-2 gap-4 h-full">
                        <div className="overview-subcard traffic-detail-card bg-gray-900 rounded-md p-4 border border-gray-700 flex items-center justify-between gap-4">
                          <div className="flex items-center gap-2 min-w-0">
                            <Download className="h-5 w-5 text-green-400 shrink-0" />
                            <span className="text-sm font-medium text-gray-400">Received</span>
                          </div>
                          <div className="overview-detail-value text-xl font-bold text-green-400 leading-tight text-right">{formatBytes(traffic.total.rx)}</div>
                        </div>

                        <div className="overview-subcard traffic-detail-card bg-gray-900 rounded-md p-4 border border-gray-700 flex items-center justify-between gap-4">
                          <div className="flex items-center gap-2 min-w-0">
                            <Upload className="h-5 w-5 text-blue-400 shrink-0" />
                            <span className="text-sm font-medium text-gray-400">Sent</span>
                          </div>
                          <div className="overview-detail-value text-xl font-bold text-blue-400 leading-tight text-right">{formatBytes(traffic.total.tx)}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="overview-card bg-gray-800 rounded-lg p-6 border border-gray-700">
                    <div className="time-overview-layout grid grid-cols-1 md:grid-cols-2 gap-4 h-full">
                      <div className="overview-subcard time-detail-card bg-gray-900 rounded-md p-4 border border-gray-700">
                        <div className="flex items-center gap-3 mb-4">
                          <Calendar className="h-5 w-5 text-purple-400 shrink-0" />
                          <span className="text-sm font-medium text-gray-400">Created</span>
                        </div>
                        <div className="overview-date-value text-lg font-semibold text-purple-400 leading-snug">
                          {formatDate(ifaceInfo.created.date)}
                        </div>
                      </div>

                      <div className="overview-subcard time-detail-card bg-gray-900 rounded-md p-4 border border-gray-700">
                        <div className="flex items-center gap-3 mb-4">
                          <Clock className="h-5 w-5 text-orange-400 shrink-0" />
                          <span className="text-sm font-medium text-gray-400">Last Updated</span>
                        </div>
                        <div className="overview-date-value text-lg font-semibold text-orange-400 leading-snug">
                          {formatDate(ifaceInfo.updated.date)}
                        </div>
                        <div className="text-sm text-gray-400 mt-1">
                          {formatTime(ifaceInfo.updated.time)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {(dailyEstimate || monthlyEstimate || yearlyEstimate) && (
                <div className="mb-8">
                  <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-yellow-400" />
                    Estimated Usage
                  </h3>
                  <div className="estimate-grid">
                    <EstimateCard title="Today" estimate={dailyEstimate} />
                    <EstimateCard title="This Month" estimate={monthlyEstimate} accent="text-purple-400" />
                    <EstimateCard title="This Year" estimate={yearlyEstimate} accent="text-orange-400" />
                  </div>
                </div>
              )}

              {/* Recent Traffic Table */}
              <div>
                <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-blue-400" />
                  Recent Traffic (5-minute intervals)
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gray-800">
                        <th className="text-left p-4 font-medium text-gray-300 border-b border-gray-700">Date</th>
                        <th className="text-left p-4 font-medium text-gray-300 border-b border-gray-700">Time</th>
                        <th className="text-left p-4 font-medium text-gray-300 border-b border-gray-700">
                          <div className="flex items-center gap-2">
                            <Download className="h-4 w-4 text-green-400" />
                            <span className="label-text">Received</span>
                          </div>
                        </th>
                        <th className="text-left p-4 font-medium text-gray-300 border-b border-gray-700">
                          <div className="flex items-center gap-2">
                            <Upload className="h-4 w-4 text-blue-400" />
                            <span className="label-text">Sent</span>
                          </div>
                        </th>
                        <th className="text-left p-4 font-medium text-gray-300 border-b border-gray-700">
                          <div className="flex items-center gap-2">
                            <Activity className="h-4 w-4 text-yellow-400" />
                            <span className="label-text">Total</span>
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {fivemin.map((row, i) => (
                        <tr key={i} className="hover:bg-gray-800 transition-colors">
                          <td className="p-4 border-b border-gray-800 text-gray-300">
                            {formatDate(row.date)}
                          </td>
                          <td className="p-4 border-b border-gray-800 text-gray-300">
                            {formatTime(row.time)}
                          </td>
                          <td className="p-4 border-b border-gray-800 font-medium text-green-400">
                            {formatBytes(row.rx)}
                          </td>
                          <td className="p-4 border-b border-gray-800 font-medium text-blue-400">
                            {formatBytes(row.tx)}
                          </td>
                          <td className="p-4 border-b border-gray-800 font-medium text-yellow-400">
                            {formatBytes((row.rx || 0) + (row.tx || 0))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8">
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                <TrendingUp className="h-6 w-6 text-blue-400" />
                {tab} Traffic Analysis
              </h2>
              <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart
                    data={graphData(
                      getChartRows(),
                      tab.toLowerCase(),
                      getChartEstimate()
                    )}
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  >

                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis
                      dataKey="name"
                      stroke="#9CA3AF"
                      fontSize={12}
                      tickLine={false}
                    />
                    <YAxis
                      tickFormatter={formatBytes}
                      stroke="#9CA3AF"
                      fontSize={12}
                      tickLine={false}
                      width={80}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Line
                      type="monotone"
                      dataKey="RX"
                      stroke="#10B981"
                      strokeWidth={3}
                      dot={{ fill: '#10B981', strokeWidth: 2, r: 4 }}
                      activeDot={{ r: 6, stroke: '#10B981', strokeWidth: 2 }}
                      animationDuration={1500}
                      animationEasing="ease-out"
                    />
                    <Line
                      type="monotone"
                      dataKey="TX"
                      stroke="#3B82F6"
                      strokeWidth={3}
                      dot={{ fill: '#3B82F6', strokeWidth: 2, r: 4 }}
                      activeDot={{ r: 6, stroke: '#3B82F6', strokeWidth: 2 }}
                      animationDuration={1500}
                      animationEasing="ease-out"
                    />
                    <Line
                      type="monotone"
                      dataKey="Total"
                      stroke="#F97316"
                      strokeWidth={3}
                      dot={{ fill: '#F97316', strokeWidth: 2, r: 4 }}
                      activeDot={{ r: 6, stroke: '#F97316', strokeWidth: 2 }}
                      animationDuration={1500}
                      animationEasing="ease-out"
                    />
                    <Line
                      type="monotone"
                      dataKey="estimateRX"
                      stroke="#F59E0B"
                      strokeWidth={0}
                      dot={(props) => <EstimateDot {...props} fill="#F59E0B" stroke="#FDE68A" r={6} />}
                      activeDot={{ r: 8, stroke: '#FDE68A', strokeWidth: 2 }}
                      animationDuration={1500}
                      animationEasing="ease-out"
                    />
                    <Line
                      type="monotone"
                      dataKey="estimateTX"
                      stroke="#C084FC"
                      strokeWidth={0}
                      dot={(props) => <EstimateDot {...props} fill="#C084FC" stroke="#E9D5FF" r={6} />}
                      activeDot={{ r: 8, stroke: '#E9D5FF', strokeWidth: 2 }}
                      animationDuration={1500}
                      animationEasing="ease-out"
                    />
                    <Line
                      type="monotone"
                      dataKey="estimateTotal"
                      stroke="#FACC15"
                      strokeWidth={0}
                      dot={(props) => <EstimateDot {...props} fill="#FACC15" stroke="#FEF3C7" r={7} />}
                      activeDot={{ r: 9, stroke: '#FEF3C7', strokeWidth: 2 }}
                      animationDuration={1500}
                      animationEasing="ease-out"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Summary Stats */}
              {tab === 'Daily' && daily.length > 0 && (
                <div className="mt-6 bg-gray-800 rounded-lg p-6 border border-gray-700">
                  <h4 className="text-lg font-semibold mb-2 text-blue-400">Today's Usage</h4>
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex flex-col bg-gray-900 rounded-md p-4 border border-gray-700 min-w-[120px] items-center">
                      <span className="text-sm text-gray-400 mb-1">Download:</span>
                      <span className="text-xl font-bold text-green-400 ml-2">{formatBytes(daily[0].rx)}</span>
                    </div>
                    <div className="flex flex-col bg-gray-900 rounded-md p-4 border border-gray-700 min-w-[120px] items-center">
                      <span className="text-sm text-gray-400 mb-1">Upload:</span>
                      <span className="text-xl font-bold text-blue-400 ml-2">{formatBytes(daily[0].tx)}</span>
                    </div>
                    <div className="flex flex-col bg-gray-900 rounded-md p-4 border border-gray-700 min-w-[120px] items-center">
                      <span className="text-sm text-gray-400 mb-1">Total:</span>
                      <span className="text-xl font-bold text-yellow-400 ml-2">{formatBytes((daily[0].rx || 0) + (daily[0].tx || 0))}</span>
                    </div>
                    {dailyEstimate && (
                      <div className="flex flex-col bg-gray-900 rounded-md p-4 border border-gray-700 min-w-[120px] items-center">
                        <span className="text-sm text-gray-400 mb-1">Estimate:</span>
                        <span className="text-xl font-bold text-yellow-400 ml-2">{formatBytes(dailyEstimate.total)}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {tab === 'Monthly' && monthly.length > 0 && (
                <div className="mt-6 bg-gray-800 rounded-lg p-6 border border-gray-700">
                  <h4 className="text-lg font-semibold mb-2 text-blue-400">This Month's Usage</h4>
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex flex-col bg-gray-900 rounded-md p-4 border border-gray-700 min-w-[120px] items-center">
                      <span className="text-sm text-gray-400">Download:</span>
                      <span className="text-xl font-bold text-green-400 ml-2">{formatBytes(monthly[0].rx)}</span>
                    </div>
                    <div className="flex flex-col bg-gray-900 rounded-md p-4 border border-gray-700 min-w-[120px] items-center">
                      <span className="text-sm text-gray-400">Upload:</span>
                      <span className="text-xl font-bold text-blue-400 ml-2">{formatBytes(monthly[0].tx)}</span>
                    </div>
                    <div className="flex flex-col bg-gray-900 rounded-md p-4 border border-gray-700 min-w-[120px] items-center">
                      <span className="text-sm text-gray-400">Total:</span>
                      <span className="text-xl font-bold text-yellow-400 ml-2">{formatBytes((monthly[0].rx || 0) + (monthly[0].tx || 0))}</span>
                    </div>
                    {monthlyEstimate && (
                      <div className="flex flex-col bg-gray-900 rounded-md p-4 border border-gray-700 min-w-[120px] items-center">
                        <span className="text-sm text-gray-400">Estimate:</span>
                        <span className="text-xl font-bold text-yellow-400 ml-2">{formatBytes(monthlyEstimate.total)}</span>
                      </div>
                    )}
                  </div>

                </div>
              )}

              {tab === 'Yearly' && yearly.length > 0 && (
                <div className="mt-6 bg-gray-800 rounded-lg p-6 border border-gray-700">
                  <h4 className="text-lg font-semibold mb-2 text-blue-400">This Year's Usage</h4>
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex flex-col bg-gray-900 rounded-md p-4 border border-gray-700 min-w-[120px] items-center">
                      <span className="text-sm text-gray-400">Download:</span>
                      <span className="text-xl font-bold text-green-400 ml-2">{formatBytes(yearly[0].rx)}</span>
                    </div>
                    <div className="flex flex-col bg-gray-900 rounded-md p-4 border border-gray-700 min-w-[120px] items-center">
                      <span className="text-sm text-gray-400">Upload:</span>
                      <span className="text-xl font-bold text-blue-400 ml-2">{formatBytes(yearly[0].tx)}</span>
                    </div>
                    <div className="flex flex-col bg-gray-900 rounded-md p-4 border border-gray-700 min-w-[120px] items-center">
                      <span className="text-sm text-gray-400">Total:</span>
                      <span className="text-xl font-bold text-yellow-400 ml-2">{formatBytes((yearly[0].rx || 0) + (yearly[0].tx || 0))}</span>
                    </div>
                    {yearlyEstimate && (
                      <div className="flex flex-col bg-gray-900 rounded-md p-4 border border-gray-700 min-w-[120px] items-center">
                        <span className="text-sm text-gray-400">Estimate:</span>
                        <span className="text-xl font-bold text-yellow-400 ml-2">{formatBytes(yearlyEstimate.total)}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
              <div>
                {tab === 'Hourly' && <HourlyTable data={hourly} />}
                {tab === 'Daily' && <DailyTable data={daily} />}
                {tab === 'Monthly' && <MonthlyTable data={monthly} />}
                {tab === 'Yearly' && <YearlyTable data={yearly} />}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
