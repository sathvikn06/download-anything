import React, { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import { useHistory } from '../hooks/useStorage';
import { Platform, DownloadItem } from '../types';
import { Activity, HardDrive, Zap } from 'lucide-react';

export function AnalyticsView() {
  const { history } = useHistory();

  const { chartData, platformData, totalDownloads, successRate } = useMemo(() => {
    // Generate last 7 days data
    const last7Days = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return {
        date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        downloads: 0,
        rawDate: d.toDateString()
      };
    });

    const pData: Record<Platform, number> = {
      instagram: 0, tiktok: 0, facebook: 0, twitter: 0, youtube: 0, pinterest: 0, unknown: 0
    };

    let successful = 0;

    history.forEach(item => {
      if (item.status === 'completed') successful++;
      pData[item.platform]++;
      
      const itemDate = new Date(item.createdAt).toDateString();
      const dayData = last7Days.find(d => d.rawDate === itemDate);
      if (dayData) {
        dayData.downloads++;
      }
    });

    const formattedPlatformData = Object.entries(pData)
      .filter(([_, count]) => count > 0)
      .map(([name, count]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        count
      }));

    return {
      chartData: last7Days,
      platformData: formattedPlatformData,
      totalDownloads: history.length,
      successRate: history.length > 0 ? Math.round((successful / history.length) * 100) : 0
    };
  }, [history]);

  return (
    <div className="space-y-6 pb-12">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard 
          icon={<Activity className="text-light-blue dark:text-cm-gold w-5 h-5" />}
          label="Total Extractions"
          value={totalDownloads.toString()}
        />
        <StatCard 
          icon={<Zap className="text-emerald-500 w-5 h-5" />}
          label="Success Rate"
          value={`${successRate}%`}
        />
        <StatCard 
          icon={<HardDrive className="text-purple-500 w-5 h-5" />}
          label="Local Storage Usage"
          value="< 5 MB"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Engagement Trend */}
        <div className="bg-light-surface dark:bg-cm-blue-light border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
          <h3 className="font-heading font-semibold text-lg mb-6">Extraction Volume (7 Days)</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorDownloads" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1E3A8A" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#1E3A8A" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0F172A', borderColor: '#1E293B', color: '#F8FAFC', borderRadius: '8px' }}
                  itemStyle={{ color: '#FFC107' }}
                />
                <Area type="monotone" dataKey="downloads" stroke="#1E3A8A" strokeWidth={3} fillOpacity={1} fill="url(#colorDownloads)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Platform Distribution */}
        <div className="bg-light-surface dark:bg-cm-blue-light border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
          <h3 className="font-heading font-semibold text-lg mb-6">Platform Distribution</h3>
          <div className="h-64 w-full">
            {platformData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={platformData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0F172A', borderColor: '#1E293B', color: '#F8FAFC', borderRadius: '8px' }}
                    cursor={{ fill: 'transparent' }}
                  />
                  <Bar dataKey="count" fill="#FFC107" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                No platform data available yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode, label: string, value: string }) {
  return (
    <div className="bg-light-surface dark:bg-cm-blue-light border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex items-center gap-4 shadow-sm">
      <div className="w-12 h-12 rounded-lg bg-slate-100 dark:bg-slate-900 flex items-center justify-center">
        {icon}
      </div>
      <div>
        <p className="text-sm text-slate-500 font-medium">{label}</p>
        <p className="text-2xl font-bold font-heading">{value}</p>
      </div>
    </div>
  );
}
