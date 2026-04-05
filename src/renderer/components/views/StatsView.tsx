import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Camera, Film, Calendar, TrendingUp } from 'lucide-react';
import { Photo } from '../../types';
import { COLORS } from '../../constants/filmModes';

interface StatsViewProps {
  photos: Photo[];
  theme: string;
}

export function StatsView({ photos, theme }: StatsViewProps) {
  // 计算相机型号统计
  const cameraStats = useMemo(() => {
    return photos.reduce((acc, photo) => {
      if (photo.cameraModel) {
        acc[photo.cameraModel] = (acc[photo.cameraModel] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);
  }, [photos]);

  const cameraData = useMemo(() => {
    return Object.entries(cameraStats)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [cameraStats]);

  // 计算胶片模式统计
  const filmModeStats = useMemo(() => {
    return photos.reduce((acc, photo) => {
      if (photo.filmMode) {
        acc[photo.filmMode] = (acc[photo.filmMode] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);
  }, [photos]);

  const filmModeData = useMemo(() => {
    return Object.entries(filmModeStats)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filmModeStats]);

  // 计算日期统计
  const dateStats = useMemo(() => {
    return photos.reduce((acc, photo) => {
      if (photo.dateTime) {
        const date = photo.dateTime.split('T')[0];
        acc[date] = (acc[date] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);
  }, [photos]);

  const dateData = useMemo(() => {
    return Object.entries(dateStats)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => new Date(a.name).getTime() - new Date(b.name).getTime());
  }, [dateStats]);

  // 计算基本统计信息
  const stats = useMemo(() => {
    return {
      totalPhotos: photos.length,
      uniqueCameras: Object.keys(cameraStats).length,
      uniqueFilmModes: Object.keys(filmModeStats).length,
      uniqueDates: Object.keys(dateStats).length
    };
  }, [photos, cameraStats, filmModeStats, dateStats]);

  return (
    <div className="space-y-12">
      <div className="flex items-center justify-between">
        <h2 className="text-4xl font-black tracking-tighter">Analytics Dashboard</h2>
        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">
          {stats.totalPhotos} photos analyzed
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card rounded-3xl p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-blue-500" />
            </div>
            <div className="text-3xl font-black">{stats.totalPhotos}</div>
          </div>
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Photos</h3>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-card rounded-3xl p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center">
              <Camera className="w-6 h-6 text-purple-500" />
            </div>
            <div className="text-3xl font-black">{stats.uniqueCameras}</div>
          </div>
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Camera Models</h3>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-card rounded-3xl p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center">
              <Film className="w-6 h-6 text-amber-500" />
            </div>
            <div className="text-3xl font-black">{stats.uniqueFilmModes}</div>
          </div>
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Film Modes</h3>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="glass-card rounded-3xl p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
              <Calendar className="w-6 h-6 text-emerald-500" />
            </div>
            <div className="text-3xl font-black">{stats.uniqueDates}</div>
          </div>
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Capture Days</h3>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Camera Model Distribution */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="glass-card rounded-3xl p-6"
        >
          <div className="flex items-center gap-4 mb-6">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/10 flex items-center justify-center">
              <Camera className="w-5 h-5 text-blue-500" />
            </div>
            <h3 className="text-xl font-black tracking-tight">Camera Model Distribution</h3>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={cameraData}
                margin={{ top: 10, right: 10, left: 10, bottom: 70 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis 
                  dataKey="name" 
                  angle={-45} 
                  textAnchor="end" 
                  height={70}
                  tick={{ fill: theme === 'dark' ? '#94a3b8' : '#64748b', fontSize: 12 }}
                />
                <YAxis 
                  tick={{ fill: theme === 'dark' ? '#94a3b8' : '#64748b', fontSize: 12 }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '12px',
                    boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)'
                  }}
                  labelStyle={{ fontWeight: 'bold' }}
                />
                <Bar 
                  dataKey="value" 
                  fill="#3b82f6" 
                  radius={[4, 4, 0, 0]}
                  animationDuration={1500}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Film Mode Distribution */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="glass-card rounded-3xl p-6"
        >
          <div className="flex items-center gap-4 mb-6">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 flex items-center justify-center">
              <Film className="w-5 h-5 text-amber-500" />
            </div>
            <h3 className="text-xl font-black tracking-tight">Film Mode Distribution</h3>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={filmModeData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={100}
                  innerRadius={60}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  animationDuration={1500}
                >
                  {filmModeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '12px',
                    boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Date Distribution */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="glass-card rounded-3xl p-6 md:col-span-2"
        >
          <div className="flex items-center gap-4 mb-6">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-emerald-500" />
            </div>
            <h3 className="text-xl font-black tracking-tight">Date Distribution</h3>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={dateData}
                margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis 
                  dataKey="name" 
                  tick={{ fill: theme === 'dark' ? '#94a3b8' : '#64748b', fontSize: 12 }}
                />
                <YAxis 
                  tick={{ fill: theme === 'dark' ? '#94a3b8' : '#64748b', fontSize: 12 }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '12px',
                    boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)'
                  }}
                />
                <Bar 
                  dataKey="value" 
                  fill="#10b981" 
                  radius={[4, 4, 0, 0]}
                  animationDuration={1500}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>
    </div>
  );
}