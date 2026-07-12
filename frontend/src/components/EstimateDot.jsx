
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

export default EstimateDot;