import type { Match } from "@/lib/types";

type Props = { matches: Match[] };

export default function MatchList({ matches }: Props) {
  if (!matches.length) {
    return (
      <p className="text-slate-500">No matches yet.</p>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200">
      <table className="w-full">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-4 py-2 text-left text-sm font-medium text-slate-700">
              Home
            </th>
            <th className="px-4 py-2 text-left text-sm font-medium text-slate-700">
              Away
            </th>
            <th className="px-4 py-2 text-left text-sm font-medium text-slate-700">
              Date
            </th>
            <th className="px-4 py-2 text-right text-sm font-medium text-slate-700">
              Result
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {matches.map((m) => (
            <tr key={m.id}>
              <td className="px-4 py-2">{m.home_team}</td>
              <td className="px-4 py-2">{m.away_team}</td>
              <td className="px-4 py-2 text-slate-600">
                {new Date(m.date).toLocaleString()}
              </td>
              <td className="px-4 py-2 text-right">
                {m.real_home_score != null && m.real_away_score != null
                  ? `${m.real_home_score} – ${m.real_away_score}`
                  : "–"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
