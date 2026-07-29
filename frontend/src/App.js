import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceArea
} from 'recharts';
import { Settings, Activity, Calendar, Clock, TrendingUp, Download, Upload, Server, Github } from 'lucide-react';
import { HourlyTable, DailyTable, MonthlyTable, YearlyTable } from './components/TrafficTable';
import EstimateCard from './components/EstimateCard';
import EstimateDot from './components/EstimateDot';
import SettingsModal from './components/SettingsModal';
import { calculateTrafficEstimate } from './utils/trafficEstimate';
import { formatDate, formatTime, formatBytes, formatMonthYear } from './utils/format';

function parseDateStr(str, isEnd) {
  if (!str) return null;
  if (str.includes('T')) return new Date(str);
  if (/^\d{4}$/.test(str)) {
    const y = parseInt(str);
    return isEnd ? new Date(y, 12, 0, 23, 59, 59) : new Date(y, 0, 1);
  }
  if (/^\d{4}-\d{2}$/.test(str)) {
    const [y, m] = str.split('-').map(Number);
    return isEnd ? new Date(y, m, 0, 23, 59, 59) : new Date(y, m - 1, 1);
  }
  return isEnd ? new Date(str + 'T23:59:59') : new Date(str + 'T00:00:00');
}

function filterByDateRange(data, range, getEntryDate) {
  if (!range || (!range.from && !range.to)) return data;
  const fromDate = parseDateStr(range.from, false);
  const toDate = parseDateStr(range.to, true);
  return data.filter(row => {
    const d = getEntryDate(row);
    if (fromDate && d < fromDate) return false;
    if (toDate && d > toDate) return false;
    return true;
  });
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
  const DISPLAY_SETTINGS_KEY = 'vnstat_display_settings';

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

  // Display settings
  const [displaySettings, setDisplaySettings] = useState(() => {
    const defaultSettings = {
      showEstimates: false,
      graphSeries: {
        rx: true,
        tx: true,
        total: true,
        estimateRx: false,
        estimateTx: false,
        estimateTotal: false,
      },
    };


    try {
      const stored = JSON.parse(localStorage.getItem(DISPLAY_SETTINGS_KEY));

      if (!stored) {
        return defaultSettings;
      }

      return {
        ...defaultSettings,
        ...stored,
        graphSeries: {
          ...defaultSettings.graphSeries,
          ...(stored.graphSeries || {}),
        },
      };
    } catch {
      return defaultSettings;
    }
  });

  const updateGraphSeries = (key, value) => {
    setDisplaySettings(prev => ({
      ...prev,
      graphSeries: {
        ...prev.graphSeries,
        [key]: value,
      },
    }));
  };

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selected, setSelected] = useState(() => localStorage.getItem(LAST_INTERFACE_KEY) || '');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [interfaces, setInterfaces] = useState([]);
  const [ifaceLoading, setIfaceLoading] = useState(true);
  const estimatesEnabled = displaySettings.showEstimates;


  const [dateRanges, setDateRanges] = useState({
    hourly: { from: '', to: '' },
    daily: { from: '', to: '' },
    monthly: { from: '', to: '' },
    yearly: { from: '', to: '' },
  });
  const [dragVisualFrom, setDragVisualFrom] = useState(null);
  const [dragVisualTo, setDragVisualTo] = useState(null);
  const dragRef = useRef({ from: null, to: null });
  const chartDataRef = useRef([]);

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

  // Persist view settings
  useEffect(() => {
    localStorage.setItem(
      DISPLAY_SETTINGS_KEY,
      JSON.stringify(displaySettings)
    );
  }, [displaySettings]);

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

  useEffect(() => {
    const handleUp = () => {
      const { from, to } = dragRef.current;
      if (from != null && to != null && from !== to) {
        const data = chartDataRef.current;
        const i1 = Math.min(from, to);
        const i2 = Math.max(from, to);
        const startRow = data[i1];
        const endRow = data[i2];
        if (startRow && endRow) {
          const tabKey = tab.toLowerCase();
          const toISO = (date, time) => {
            if (tabKey === 'hourly')
              return `${date.year}-${pad(date.month)}-${pad(date.day)}T${pad(time?.hour || 0)}:${pad(time?.minute || 0)}`;
            if (tabKey === 'monthly')
              return `${date.year}-${pad(date.month)}`;
            if (tabKey === 'yearly')
              return `${date.year}`;
            return `${date.year}-${pad(date.month)}-${pad(date.day)}`;
          };
          setDateRanges(prev => ({
            ...prev,
            [tabKey]: {
              from: toISO(startRow._date, startRow._time),
              to: toISO(endRow._date, endRow._time),
            }
          }));
        }
      }
      dragRef.current = { from: null, to: null };
      setDragVisualFrom(null);
      setDragVisualTo(null);
    };
    window.addEventListener('mouseup', handleUp);
    return () => window.removeEventListener('mouseup', handleUp);
  }, [tab]);

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

  const pad = (n) => String(n).padStart(2, '0');
  const now = new Date();
  const toLocalDatetime = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const toLocalDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const toLocalMonth = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;

  const filterBounds = {
    hourly: hourly.length > 0 ? {
      min: toLocalDatetime(new Date(hourly[hourly.length - 1].date.year, hourly[hourly.length - 1].date.month - 1, hourly[hourly.length - 1].date.day, hourly[hourly.length - 1].time?.hour || 0)),
      max: toLocalDatetime(new Date(Math.min(new Date(hourly[0].date.year, hourly[0].date.month - 1, hourly[0].date.day, hourly[0].time?.hour || 0).getTime(), now.getTime())))
    } : null,
    daily: daily.length > 0 ? {
      min: toLocalDate(new Date(daily[daily.length - 1].date.year, daily[daily.length - 1].date.month - 1, daily[daily.length - 1].date.day)),
      max: toLocalDate(new Date(Math.min(new Date(daily[0].date.year, daily[0].date.month - 1, daily[0].date.day).getTime(), now.getTime())))
    } : null,
    monthly: monthly.length > 0 ? {
      min: toLocalMonth(new Date(monthly[monthly.length - 1].date.year, monthly[monthly.length - 1].date.month - 1, 1)),
      max: toLocalMonth(new Date(Math.min(new Date(monthly[0].date.year, monthly[0].date.month - 1, 1).getTime(), now.getTime())))
    } : null,
    yearly: yearly.length > 0 ? {
      min: Math.min(...yearly.map(r => r.date.year)),
      max: Math.min(Math.max(...yearly.map(r => r.date.year)), now.getFullYear())
    } : null
  };

  const hourlyEstimate = hourly.length > 0 ? calculateTrafficEstimate(hourly[0], 'hour', ifaceInfo) : null;
  const dailyEstimate = daily.length > 0 ? calculateTrafficEstimate(daily[0], 'day', ifaceInfo) : null;
  const monthlyEstimate = monthly.length > 0 ? calculateTrafficEstimate(monthly[0], 'month', ifaceInfo) : null;
  const yearlyEstimate = yearly.length > 0 ? calculateTrafficEstimate(yearly[0], 'year', ifaceInfo) : null;

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

  const getHourlyDate = (row) => new Date(row.date.year, row.date.month - 1, row.date.day, row.time.hour);
  const getDailyDate = (row) => new Date(row.date.year, row.date.month - 1, row.date.day);
  const getMonthlyDate = (row) => new Date(row.date.year, row.date.month - 1, 1);
  const getYearlyDate = (row) => new Date(row.date.year, 0, 1);

  const filteredHourly = filterByDateRange(hourly, dateRanges.hourly, getHourlyDate);
  const filteredDaily = filterByDateRange(daily, dateRanges.daily, getDailyDate);
  const filteredMonthly = filterByDateRange(monthly, dateRanges.monthly, getMonthlyDate);
  const filteredYearly = filterByDateRange(yearly, dateRanges.yearly, getYearlyDate);

  const currentFiltered = tab === 'Hourly' ? filteredHourly :
    tab === 'Daily' ? filteredDaily :
      tab === 'Monthly' ? filteredMonthly :
        tab === 'Yearly' ? filteredYearly : [];
  const currentRangeTotal = currentFiltered.reduce((a, r) => ({
    rx: a.rx + (r.rx || 0), tx: a.tx + (r.tx || 0)
  }), { rx: 0, tx: 0 });
  const hasActiveFilter = !!(dateRanges[tab.toLowerCase()]?.from || dateRanges[tab.toLowerCase()]?.to);

  const tabData = tab === "Hourly" ? [...filteredHourly.slice(-24)].reverse() :
    tab === "Daily" ? [...(hasActiveFilter ? filteredDaily : filteredDaily.slice(0, 31))].reverse() :
      tab === "Monthly" ? [...(hasActiveFilter ? filteredMonthly : filteredMonthly.slice(0, 12))].reverse() :
        tab === "Yearly" ? [...filteredYearly].reverse() : [];

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

  const graphSeries = [
    {
      dataKey: 'RX',
      enabled: displaySettings.graphSeries.rx,
      stroke: '#10B981',
      strokeWidth: 3,
      dot: { fill: '#10B981', strokeWidth: 2, r: 4 },
      activeDot: { r: 6, stroke: '#10B981', strokeWidth: 2 },
    },
    {
      dataKey: 'TX',
      enabled: displaySettings.graphSeries.tx,
      stroke: '#3B82F6',
      strokeWidth: 3,
      dot: { fill: '#3B82F6', strokeWidth: 2, r: 4 },
      activeDot: { r: 6, stroke: '#3B82F6', strokeWidth: 2 },
    },
    {
      dataKey: 'Total',
      enabled: displaySettings.graphSeries.total,
      stroke: '#F97316',
      strokeWidth: 3,
      dot: { fill: '#F97316', strokeWidth: 2, r: 4 },
      activeDot: { r: 6, stroke: '#F97316', strokeWidth: 2 },
    },
    {
      dataKey: 'estimateRX',
      enabled: estimatesEnabled && displaySettings.graphSeries.estimateRx,
      stroke: '#F59E0B',
      strokeWidth: 0,
      dot: (props) => (
        <EstimateDot
          {...props}
          fill="#F59E0B"
          stroke="#FDE68A"
          r={6}
        />
      ),
      activeDot: { r: 8, stroke: '#FDE68A', strokeWidth: 2 },
    },
    {
      dataKey: 'estimateTX',
      enabled: estimatesEnabled && displaySettings.graphSeries.estimateTx,
      stroke: '#C084FC',
      strokeWidth: 0,
      dot: (props) => (
        <EstimateDot
          {...props}
          fill="#C084FC"
          stroke="#E9D5FF"
          r={6}
        />
      ),
      activeDot: { r: 8, stroke: '#E9D5FF', strokeWidth: 2 },
    },
    {
      dataKey: 'estimateTotal',
      enabled: estimatesEnabled && displaySettings.graphSeries.estimateTotal,
      stroke: '#FACC15',
      strokeWidth: 0,
      dot: (props) => (
        <EstimateDot
          {...props}
          fill="#FACC15"
          stroke="#FEF3C7"
          r={7}
        />
      ),
      activeDot: { r: 9, stroke: '#FEF3C7', strokeWidth: 2 },
    },
  ];

  const getChartRows = () => {
    if (tab === 'Hourly') return [...hourly.slice(-24)].reverse();
    if (tab === 'Daily') return [...daily].reverse();
    if (tab === 'Monthly') return [...monthly].reverse();
    if (tab === 'Yearly') return [...yearly].reverse();
    return [];
  };

  const getChartEstimate = () => {
    if (hasActiveFilter) return null;
    if (tab === 'Hourly') return hourlyEstimate;
    if (tab === 'Daily') return dailyEstimate;
    if (tab === 'Monthly') return monthlyEstimate;
    if (tab === 'Yearly') return yearlyEstimate;
    return null;
  };

  const currentGraphData = tabData.map(row => ({
    name: getLabel(row, tab.toLowerCase()),
    RX: row.rx || 0,
    TX: row.tx || 0,
    _date: row.date,
    _time: row.time,
  }));

  useEffect(() => {
    chartDataRef.current = currentGraphData;
  }, [currentGraphData]);

  const refAreaFrom = dragVisualFrom != null && dragVisualTo != null && currentGraphData.length > 0
    ? currentGraphData[Math.max(0, Math.min(dragVisualFrom, dragVisualTo))]?.name
    : undefined;
  const refAreaTo = dragVisualFrom != null && dragVisualTo != null && currentGraphData.length > 0
    ? currentGraphData[Math.min(currentGraphData.length - 1, Math.max(dragVisualFrom, dragVisualTo))]?.name
    : undefined;

  const isFilterDisabled =
    (tab === 'Hourly' && hourly.length <= 1) ||
    (tab === 'Daily' && daily.length <= 1) ||
    (tab === 'Monthly' && monthly.length <= 1) ||
    (tab === 'Yearly' && yearly.length <= 1);

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
        <div className="mb-4 github">
          <a className="github-icon" href="https://github.com/Kshitiz-b/vnstat-dashboard" target="_blank" rel="noreferrer">
            <Github className="h-5 w-5" />
            <span>Kshitiz-b</span>
          </a>

          <button
            onClick={() => setSettingsOpen(prev => !prev)}
            className={`settings-button ${settingsOpen ? "settings-button-active" : ""
              }`}
            title="Settings"
            aria-label="Open settings"
          >
            <Settings className="h-5 w-5" />
          </button>
        </div>

        <SettingsModal
          isOpen={settingsOpen}
          onClose={() => setSettingsOpen(false)}

          selected={selected}
          setSelected={setSelected}

          interfaces={interfaces}
          ifaceLoading={ifaceLoading}

          config={config}
          setConfig={setConfig}

          displaySettings={displaySettings}
          setDisplaySettings={setDisplaySettings}

          estimatesEnabled={estimatesEnabled}
          updateGraphSeries={updateGraphSeries}

          tabs={TABS}
        />

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
                          <Activity className="h-5 w-5 text-orange-400 shrink-0" />
                          <span className="text-sm font-medium text-gray-400">Total Traffic</span>
                        </div>
                        <div className="overview-total-value text-4xl font-bold text-orange-400 leading-tight text-right">
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
                          <Clock className="h-5 w-5 text-blue-400 shrink-0" />
                          <span className="text-sm font-medium text-gray-400">Last Updated</span>
                        </div>
                        <div className="overview-date-value text-lg font-semibold text-blue-400 leading-snug">
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

              {estimatesEnabled && (dailyEstimate || monthlyEstimate || yearlyEstimate) && (
                <div className="mb-8">
                  <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-orange-400" />
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
                            <Activity className="h-4 w-4 text-orange-400" />
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
                          <td className="p-4 border-b border-gray-800 font-medium text-orange-400">
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

              <div className={`date-range-bar${isFilterDisabled ? ' disabled' : ''}`}>
                <Calendar className="h-4 w-4 text-gray-400 shrink-0" />
                {tab === 'Hourly' ? (
                  <>
                    <input
                      type="datetime-local"
                      className="date-range-input"
                      value={dateRanges.hourly?.from || ''}
                      min={filterBounds.hourly?.min}
                      max={filterBounds.hourly?.max}
                      disabled={isFilterDisabled}
                      onChange={(e) => setDateRanges(prev => ({ ...prev, hourly: { ...prev.hourly, from: e.target.value } }))}
                    />
                    <span className="date-range-separator">&mdash;</span>
                    <input
                      type="datetime-local"
                      className="date-range-input"
                      value={dateRanges.hourly?.to || ''}
                      min={filterBounds.hourly?.min}
                      max={filterBounds.hourly?.max}
                      disabled={isFilterDisabled}
                      onChange={(e) => setDateRanges(prev => ({ ...prev, hourly: { ...prev.hourly, to: e.target.value } }))}
                    />
                  </>
                ) : tab === 'Monthly' ? (
                  <>
                    <input
                      type="month"
                      className="date-range-input"
                      value={dateRanges.monthly?.from || ''}
                      min={filterBounds.monthly?.min}
                      max={filterBounds.monthly?.max}
                      disabled={isFilterDisabled}
                      onChange={(e) => setDateRanges(prev => ({ ...prev, monthly: { ...prev.monthly, from: e.target.value } }))}
                    />
                    <span className="date-range-separator">&mdash;</span>
                    <input
                      type="month"
                      className="date-range-input"
                      value={dateRanges.monthly?.to || ''}
                      min={filterBounds.monthly?.min}
                      max={filterBounds.monthly?.max}
                      disabled={isFilterDisabled}
                      onChange={(e) => setDateRanges(prev => ({ ...prev, monthly: { ...prev.monthly, to: e.target.value } }))}
                    />
                  </>
                ) : tab === 'Yearly' ? (
                  <>
                    <input
                      type="number"
                      className="date-range-input date-range-year"
                      value={dateRanges.yearly?.from || ''}
                      min={filterBounds.yearly?.min}
                      max={filterBounds.yearly?.max}
                      disabled={isFilterDisabled}
                      placeholder="From"
                      onChange={(e) => setDateRanges(prev => ({ ...prev, yearly: { ...prev.yearly, from: e.target.value } }))}
                    />
                    <span className="date-range-separator">&mdash;</span>
                    <input
                      type="number"
                      className="date-range-input date-range-year"
                      value={dateRanges.yearly?.to || ''}
                      min={filterBounds.yearly?.min}
                      max={filterBounds.yearly?.max}
                      disabled={isFilterDisabled}
                      placeholder="To"
                      onChange={(e) => setDateRanges(prev => ({ ...prev, yearly: { ...prev.yearly, to: e.target.value } }))}
                    />
                  </>
                ) : (
                  <>
                    <input
                      type="date"
                      className="date-range-input"
                      value={dateRanges.daily?.from || ''}
                      min={filterBounds.daily?.min}
                      max={filterBounds.daily?.max}
                      disabled={isFilterDisabled}
                      onChange={(e) => setDateRanges(prev => ({ ...prev, daily: { ...prev.daily, from: e.target.value } }))}
                    />
                    <span className="date-range-separator">&mdash;</span>
                    <input
                      type="date"
                      className="date-range-input"
                      value={dateRanges.daily?.to || ''}
                      min={filterBounds.daily?.min}
                      max={filterBounds.daily?.max}
                      disabled={isFilterDisabled}
                      onChange={(e) => setDateRanges(prev => ({ ...prev, daily: { ...prev.daily, to: e.target.value } }))}
                    />
                  </>
                )}
                {isFilterDisabled ? (
                  <span className="date-range-hint">Not enough data to filter</span>
                ) : (
                  <button
                    className="date-range-btn date-range-btn-reset"
                    onClick={() => {
                      setDateRanges(prev => ({
                        ...prev,
                        [tab.toLowerCase()]: { from: '', to: '' }
                      }));
                      dragRef.current = { from: null, to: null };
                      setDragVisualFrom(null);
                      setDragVisualTo(null);
                    }}
                  >
                    Reset
                  </button>
                )}
              </div>

              <div className={`bg-gray-800 rounded-lg p-6 border border-gray-700${dragVisualFrom != null ? ' select-none' : ''}`}>
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart
                    data={graphData(tabData, tab.toLowerCase(), getChartEstimate())}
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                    onMouseDown={(e) => {
                      if (!isFilterDisabled && e?.activeTooltipIndex != null && currentGraphData.length > 0) {
                        dragRef.current.from = e.activeTooltipIndex;
                        dragRef.current.to = e.activeTooltipIndex;
                        setDragVisualFrom(e.activeTooltipIndex);
                        setDragVisualTo(e.activeTooltipIndex);
                      }
                    }}
                    onMouseMove={(e) => {
                      if (!isFilterDisabled && dragRef.current.from != null && e?.activeTooltipIndex != null) {
                        dragRef.current.to = e.activeTooltipIndex;
                        setDragVisualTo(e.activeTooltipIndex);
                      }
                    }}
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
                    {graphSeries
                      .filter(series => series.enabled)
                      .map(series => (
                        <Line
                          key={series.dataKey}
                          type="monotone"
                          dataKey={series.dataKey}
                          stroke={series.stroke}
                          strokeWidth={series.strokeWidth}
                          dot={series.dot}
                          activeDot={series.activeDot}
                          animationDuration={1500}
                          animationEasing="ease-out"
                        />
                      ))}
                    {refAreaFrom && refAreaTo && (
                      <ReferenceArea
                        x1={refAreaFrom}
                        x2={refAreaTo}
                        fill="#3b82f6"
                        fillOpacity={0.15}
                        stroke="#3b82f6"
                        strokeOpacity={0.3}
                      />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Summary Stats */}
              {tab === 'Hourly' && hasActiveFilter && (
                <div className="mt-6 bg-gray-800 rounded-lg p-6 border border-gray-700">
                  <h4 className="text-lg font-semibold mb-2 text-purple-400">Range Total</h4>
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex flex-col bg-gray-900 rounded-md p-4 border border-gray-700 min-w-[120px] items-center">
                      <span className="text-sm text-gray-400 mb-1">Download:</span>
                      <span className="text-xl font-bold text-green-400 ml-2">{formatBytes(currentRangeTotal.rx)}</span>
                    </div>
                    <div className="flex flex-col bg-gray-900 rounded-md p-4 border border-gray-700 min-w-[120px] items-center">
                      <span className="text-sm text-gray-400 mb-1">Upload:</span>
                      <span className="text-xl font-bold text-blue-400 ml-2">{formatBytes(currentRangeTotal.tx)}</span>
                    </div>
                    <div className="flex flex-col bg-gray-900 rounded-md p-4 border border-gray-700 min-w-[120px] items-center">
                      <span className="text-sm text-gray-400 mb-1">Total:</span>
                      <span className="text-xl font-bold text-orange-400 ml-2">{formatBytes((currentRangeTotal.rx || 0) + (currentRangeTotal.tx || 0))}</span>
                    </div>
                  </div>
                </div>
              )}

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
                      <span className="text-xl font-bold text-orange-400 ml-2">{formatBytes((daily[0].rx || 0) + (daily[0].tx || 0))}</span>
                    </div>
                    {estimatesEnabled && dailyEstimate && (
                      <div className="flex flex-col bg-gray-900 rounded-md p-4 border border-gray-700 min-w-[120px] items-center">
                        <span className="text-sm text-gray-400 mb-1">Estimate:</span>
                        <span className="text-xl font-bold text-yellow-400 ml-2">{formatBytes(dailyEstimate.total)}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {tab === 'Daily' && hasActiveFilter && (
                <div className="mt-6 bg-gray-800 rounded-lg p-6 border border-gray-700">
                  <h4 className="text-lg font-semibold mb-2 text-purple-400">Range Total</h4>
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex flex-col bg-gray-900 rounded-md p-4 border border-gray-700 min-w-[120px] items-center">
                      <span className="text-sm text-gray-400 mb-1">Download:</span>
                      <span className="text-xl font-bold text-green-400 ml-2">{formatBytes(currentRangeTotal.rx)}</span>
                    </div>
                    <div className="flex flex-col bg-gray-900 rounded-md p-4 border border-gray-700 min-w-[120px] items-center">
                      <span className="text-sm text-gray-400 mb-1">Upload:</span>
                      <span className="text-xl font-bold text-blue-400 ml-2">{formatBytes(currentRangeTotal.tx)}</span>
                    </div>
                    <div className="flex flex-col bg-gray-900 rounded-md p-4 border border-gray-700 min-w-[120px] items-center">
                      <span className="text-sm text-gray-400 mb-1">Total:</span>
                      <span className="text-xl font-bold text-orange-400 ml-2">{formatBytes((currentRangeTotal.rx || 0) + (currentRangeTotal.tx || 0))}</span>
                    </div>
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
                      <span className="text-xl font-bold text-orange-400 ml-2">{formatBytes((monthly[0].rx || 0) + (monthly[0].tx || 0))}</span>
                    </div>
                    {estimatesEnabled && monthlyEstimate && (
                      <div className="flex flex-col bg-gray-900 rounded-md p-4 border border-gray-700 min-w-[120px] items-center">
                        <span className="text-sm text-gray-400">Estimate:</span>
                        <span className="text-xl font-bold text-yellow-400 ml-2">{formatBytes(monthlyEstimate.total)}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {tab === 'Monthly' && hasActiveFilter && (
                <div className="mt-6 bg-gray-800 rounded-lg p-6 border border-gray-700">
                  <h4 className="text-lg font-semibold mb-2 text-purple-400">Range Total</h4>
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex flex-col bg-gray-900 rounded-md p-4 border border-gray-700 min-w-[120px] items-center">
                      <span className="text-sm text-gray-400">Download:</span>
                      <span className="text-xl font-bold text-green-400 ml-2">{formatBytes(currentRangeTotal.rx)}</span>
                    </div>
                    <div className="flex flex-col bg-gray-900 rounded-md p-4 border border-gray-700 min-w-[120px] items-center">
                      <span className="text-sm text-gray-400">Upload:</span>
                      <span className="text-xl font-bold text-blue-400 ml-2">{formatBytes(currentRangeTotal.tx)}</span>
                    </div>
                    <div className="flex flex-col bg-gray-900 rounded-md p-4 border border-gray-700 min-w-[120px] items-center">
                      <span className="text-sm text-gray-400">Total:</span>
                      <span className="text-xl font-bold text-orange-400 ml-2">{formatBytes((currentRangeTotal.rx || 0) + (currentRangeTotal.tx || 0))}</span>
                    </div>
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
                      <span className="text-xl font-bold text-orange-400 ml-2">{formatBytes((yearly[0].rx || 0) + (yearly[0].tx || 0))}</span>
                    </div>
                    {estimatesEnabled && yearlyEstimate && (
                      <div className="flex flex-col bg-gray-900 rounded-md p-4 border border-gray-700 min-w-[120px] items-center">
                        <span className="text-sm text-gray-400">Estimate:</span>
                        <span className="text-xl font-bold text-yellow-400 ml-2">{formatBytes(yearlyEstimate.total)}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {tab === 'Yearly' && hasActiveFilter && (
                <div className="mt-6 bg-gray-800 rounded-lg p-6 border border-gray-700">
                  <h4 className="text-lg font-semibold mb-2 text-purple-400">Range Total</h4>
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex flex-col bg-gray-900 rounded-md p-4 border border-gray-700 min-w-[120px] items-center">
                      <span className="text-sm text-gray-400">Download:</span>
                      <span className="text-xl font-bold text-green-400 ml-2">{formatBytes(currentRangeTotal.rx)}</span>
                    </div>
                    <div className="flex flex-col bg-gray-900 rounded-md p-4 border border-gray-700 min-w-[120px] items-center">
                      <span className="text-sm text-gray-400">Upload:</span>
                      <span className="text-xl font-bold text-blue-400 ml-2">{formatBytes(currentRangeTotal.tx)}</span>
                    </div>
                    <div className="flex flex-col bg-gray-900 rounded-md p-4 border border-gray-700 min-w-[120px] items-center">
                      <span className="text-sm text-gray-400">Total:</span>
                      <span className="text-xl font-bold text-orange-400 ml-2">{formatBytes((currentRangeTotal.rx || 0) + (currentRangeTotal.tx || 0))}</span>
                    </div>
                  </div>
                </div>
              )}
              <div>
                {tab === 'Hourly' && <HourlyTable data={filteredHourly} />}
                {tab === 'Daily' && <DailyTable data={filteredDaily} />}
                {tab === 'Monthly' && <MonthlyTable data={filteredMonthly} />}
                {tab === 'Yearly' && <YearlyTable data={filteredYearly} />}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
