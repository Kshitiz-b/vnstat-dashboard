import { useState } from 'react';
import { Clock, Calendar, Download, Upload, BarChart, LineChart, Activity, ChevronDown, ChevronUp } from 'lucide-react';
import { toDateFromVnstat } from '../utils/timezone';

const TrafficTable = ({ title, icon, data, headers, initialCount }) => {
  const [expanded, setExpanded] = useState(false);
  const hasMore = initialCount && data.length > initialCount;
  const visibleData = hasMore && !expanded ? data.slice(0, initialCount) : data;

  return (
    <div>
      <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
        {icon}
        {title}
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-800">
              {headers.map((header, i) => (
                <th key={i} className="text-left p-4 font-medium text-gray-300 border-b border-gray-700">
                  <div className="flex items-center gap-2">
                    {header.icon}
                    <span className="label-text">{header.label}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleData.map((row, i) => (
              <tr key={i} className="hover:bg-gray-800 transition-colors">
                {headers.map((header, j) => (
                  <td
                    key={j}
                    className={`p-4 border-b border-gray-800 text-gray-300 ${header.className || ''}`.trim()}
                  >
                    {header.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-3 table-expand-btn"
        >
          {expanded ? (
            <>Show less <ChevronUp className="inline h-3.5 w-3.5" /></>
          ) : (
            <>Show all {data.length} entries <ChevronDown className="inline h-3.5 w-3.5" /></>
          )}
        </button>
      )}
    </div>
  );
};

const formatBytes = (bytes) => {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

const HourlyTable = ({ data }) => {
  const sortedData = [...data]
    .filter((row) => row.rx || row.tx)
    .sort((a, b) => toDateFromVnstat(b.date, b.time) - toDateFromVnstat(a.date, a.time))
    .slice(0, 24); // last 24 hours

  return (
    <TrafficTable
      title="Hourly Traffic"
      icon={<Clock className="h-5 w-5 text-blue-400" />}
      data={sortedData}
      headers={[
        {
          label: 'Date',
          render: (row) =>
            toDateFromVnstat(row.date, row.time).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: '2-digit',
            }),
        },
        {
          label: 'Time',
          render: (row) =>
            toDateFromVnstat(row.date, row.time).toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: true,
            }),
        },
        {
          label: 'Received',
          icon: <Download className="h-4 w-4 text-green-400" />,
          className: 'font-medium text-green-400',
          render: (row) => formatBytes(row.rx),
        },
        {
          label: 'Sent',
          icon: <Upload className="h-4 w-4 text-blue-400" />,
          className: 'font-medium text-blue-400',
          render: (row) => formatBytes(row.tx),
        },
        {
          label: 'Total',
          icon: <Activity className="h-4 w-4 text-orange-400" />,
          className: 'font-medium text-orange-400',
          render: (row) => formatBytes((row.rx || 0) + (row.tx || 0)),
        },
      ]}
    />
  );
};

const DailyTable = ({ data }) => (
  <TrafficTable
    title="Daily Traffic"
    icon={<Calendar className="h-5 w-5 text-green-400" />}
    data={data}
    initialCount={10}
    headers={[
      { label: 'Date',
          render: (row) =>
            toDateFromVnstat(row.date, row.time).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: '2-digit',
            }), },
      {
        label: 'Received',
        icon: <Download className="h-4 w-4 text-green-400" />,
        className: 'font-medium text-green-400',
        render: (row) => formatBytes(row.rx),
      },
      {
        label: 'Sent',
        icon: <Upload className="h-4 w-4 text-blue-400" />,
        className: 'font-medium text-blue-400',
        render: (row) => formatBytes(row.tx),
      },
      {
        label: 'Total',
        icon: <Activity className="h-4 w-4 text-orange-400" />,
        className: 'font-medium text-orange-400',
        render: (row) => formatBytes((row.rx || 0) + (row.tx || 0)),
      },
    ]}
  />
);

const MonthlyTable = ({ data }) => (
  <TrafficTable
    title="Monthly Traffic"
    icon={<BarChart className="h-5 w-5 text-purple-400" />}
    data={data}
    initialCount={10}
    headers={[
      { label: 'Month', render: (row) =>
            toDateFromVnstat(row.date, row.time).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
            }), },
      {
        label: 'Received',
        icon: <Download className="h-4 w-4 text-green-400" />,
        className: 'font-medium text-green-400',
        render: (row) => formatBytes(row.rx),
      },
      {
        label: 'Sent',
        icon: <Upload className="h-4 w-4 text-blue-400" />,
        className: 'font-medium text-blue-400',
        render: (row) => formatBytes(row.tx),
      },
      {
        label: 'Total',
        icon: <Activity className="h-4 w-4 text-orange-400" />,
        className: 'font-medium text-orange-400',
        render: (row) => formatBytes((row.rx || 0) + (row.tx || 0)),
      },
    ]}
  />
);

const YearlyTable = ({ data }) => (
  <TrafficTable
    title="Yearly Traffic"
    icon={<LineChart className="h-5 w-5 text-orange-400" />}
    data={data}
    headers={[
      { label: 'Year', render: (row) => `${row.date.year}` },
      {
        label: 'Received',
        icon: <Download className="h-4 w-4 text-green-400" />,
        className: 'font-medium text-green-400',
        render: (row) => formatBytes(row.rx),
      },
      {
        label: 'Sent',
        icon: <Upload className="h-4 w-4 text-blue-400" />,
        className: 'font-medium text-blue-400',
        render: (row) => formatBytes(row.tx),
      },
      {
        label: 'Total',
        icon: <Activity className="h-4 w-4 text-orange-400" />,
        className: 'font-medium text-orange-400',
        render: (row) => formatBytes((row.rx || 0) + (row.tx || 0)),
      },
    ]}
  />
);

export { HourlyTable, DailyTable, MonthlyTable, YearlyTable };
