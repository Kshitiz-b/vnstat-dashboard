
import { formatBytes } from '../utils/format';

const EstimateCard = ({ title, estimate, accent = 'text-yellow-400' }) => {
  if (!estimate) return null;

  return (
    <div className="estimate-card bg-gray-900 rounded-md p-4 border border-gray-700">
      <div className="text-sm text-gray-400 mb-1">
        {title}
      </div>

      <div className={`text-xl font-bold ${accent}`}>
        {formatBytes(estimate.total)}
      </div>

      <div className="text-sm text-gray-400 mt-1">
        RX {formatBytes(estimate.rx)} / TX {formatBytes(estimate.tx)}
      </div>
    </div>
  );
};

export default EstimateCard;