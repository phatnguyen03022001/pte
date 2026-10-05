import type { DescribeImageItem } from "./content";

type DescribeImageChartProps = {
  item: DescribeImageItem;
};

const WIDTH = 640;
const HEIGHT = 360;
const LEFT = 64;
const RIGHT = 24;
const TOP = 30;
const BOTTOM = 82;
const BASELINE = HEIGHT - BOTTOM;
const PLOT_WIDTH = WIDTH - LEFT - RIGHT;
const PLOT_HEIGHT = BASELINE - TOP;

function safeId(value: string): string {
  return value.replace(/[^a-z0-9-]/gi, "-");
}

export default function DescribeImageChart({ item }: DescribeImageChartProps) {
  const maxValue = Math.max(1, ...item.values);
  const slotWidth = PLOT_WIDTH / item.values.length;
  const yFor = (value: number) =>
    BASELINE - Math.max(0, value / maxValue) * PLOT_HEIGHT;
  const titleId = `describe-image-${safeId(item.slug)}-title`;
  const descId = `describe-image-${safeId(item.slug)}-description`;
  const points = item.values
    .map((value, index) => {
      const x = LEFT + slotWidth * index + slotWidth / 2;
      return `${x},${yFor(value)}`;
    })
    .join(" ");
  const summary = item.labels
    .map((label, index) => `${label}: ${item.values[index]} ${item.unit}`)
    .join("; ");

  return (
    <section className="describe-image-chart-panel" aria-label="Describe Image chart">
      <p className="describe-image-synthetic">
        Synthetic practice dataset — project-authored values, not real-world facts.
      </p>

      <div className="describe-image-chart-wrap">
        <svg
          aria-labelledby={`${titleId} ${descId}`}
          className="describe-image-chart"
          role="img"
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        >
          <title id={titleId}>{item.title}</title>
          <desc id={descId}>
            {summary}
          </desc>

          <line
            className="describe-image-axis"
            x1={LEFT}
            x2={WIDTH - RIGHT}
            y1={BASELINE}
            y2={BASELINE}
          />
          <line
            className="describe-image-axis"
            x1={LEFT}
            x2={LEFT}
            y1={TOP}
            y2={BASELINE}
          />

          {item.chartType === "bar"
            ? item.values.map((value, index) => {
                const barWidth = slotWidth * 0.58;
                const x = LEFT + slotWidth * index + (slotWidth - barWidth) / 2;
                const y = yFor(value);
                const height = BASELINE - y;

                return (
                  <g key={item.labels[index]}>
                    <rect
                      className="describe-image-bar"
                      height={height}
                      width={barWidth}
                      x={x}
                      y={y}
                    />
                    <text
                      className="describe-image-value"
                      textAnchor="middle"
                      x={x + barWidth / 2}
                      y={Math.max(TOP + 12, y - 8)}
                    >
                      {value}
                    </text>
                  </g>
                );
              })
            : (
              <>
                <polyline
                  className="describe-image-line"
                  fill="none"
                  points={points}
                />
                {item.values.map((value, index) => {
                  const x = LEFT + slotWidth * index + slotWidth / 2;
                  const y = yFor(value);

                  return (
                    <g key={item.labels[index]}>
                      <circle className="describe-image-point" cx={x} cy={y} r="6" />
                      <text
                        className="describe-image-value"
                        textAnchor="middle"
                        x={x}
                        y={Math.max(TOP + 12, y - 11)}
                      >
                        {value}
                      </text>
                    </g>
                  );
                })}
              </>
            )}

          {item.labels.map((label, index) => {
            const x = LEFT + slotWidth * index + slotWidth / 2;
            return (
              <text
                className="describe-image-label"
                key={label}
                textAnchor="middle"
                x={x}
                y={BASELINE + 28}
              >
                {label}
              </text>
            );
          })}

          <text className="describe-image-unit" x={LEFT} y={HEIGHT - 18}>
            Unit: {item.unit}
          </text>
        </svg>
      </div>

      <div className="describe-image-table-wrap">
        <table className="describe-image-table">
          <caption>Structured data summary: {item.title}</caption>
          <thead>
            <tr>
              <th scope="col">Category</th>
              <th scope="col">Value ({item.unit})</th>
            </tr>
          </thead>
          <tbody>
            {item.labels.map((label, index) => (
              <tr key={label}>
                <th scope="row">{label}</th>
                <td>{item.values[index]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
