import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";

const COLORS = { "On Time": "#16A34A", "Slight Late": "#F59E0B", "Very Late": "#DC2626" };

export default function StatusDistributionChart({ onTime, slightLate, veryLate }) {
  const data = [
    { name: "On Time", value: onTime },
    { name: "Slight Late", value: slightLate },
    { name: "Very Late", value: veryLate },
  ].filter((d) => d.value > 0);

  if (data.length === 0) {
    return <div className="chart-empty muted">No attendance recorded today.</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={55} outerRadius={80} paddingAngle={3}>
          {data.map((entry) => (
            <Cell key={entry.name} fill={COLORS[entry.name]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            background: "var(--color-card)",
            border: "1px solid var(--color-border)",
            borderRadius: 10,
            fontSize: 13,
          }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
