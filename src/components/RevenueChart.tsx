import React, { useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend
} from 'recharts';

export interface MonthlyRevenueData {
  mes: string;
  ingresos: number;
  meta: number;
  sociosNuevos: number;
}

const DEFAULT_6_MONTHS_DATA: MonthlyRevenueData[] = [
  { mes: 'May', ingresos: 9850000, meta: 9500000, sociosNuevos: 32 },
  { mes: 'Jun', ingresos: 11200000, meta: 10500000, sociosNuevos: 38 },
  { mes: 'Jul', ingresos: 12400000, meta: 11500000, sociosNuevos: 41 },
  { mes: 'Ago', ingresos: 13900000, meta: 13000000, sociosNuevos: 45 },
  { mes: 'Sep', ingresos: 15300000, meta: 14500000, sociosNuevos: 49 },
  { mes: 'Oct', ingresos: 16800000, meta: 16000000, sociosNuevos: 54 },
];

interface RevenueChartProps {
  currentMonthRevenue?: number;
}

export const RevenueChart: React.FC<RevenueChartProps> = ({ currentMonthRevenue }) => {
  const [showMeta, setShowMeta] = useState(true);

  // Si hay ingresos actuales calculados dinámicamente del mes corriente, ajustamos el último punto
  const chartData = DEFAULT_6_MONTHS_DATA.map((item, idx) => {
    if (idx === DEFAULT_6_MONTHS_DATA.length - 1 && currentMonthRevenue && currentMonthRevenue > 0) {
      return { ...item, ingresos: currentMonthRevenue };
    }
    return item;
  });

  const totalSemestre = chartData.reduce((acc, curr) => acc + curr.ingresos, 0);
  const promedioMensual = Math.round(totalSemestre / chartData.length);
  const crecimiento = ((chartData[chartData.length - 1].ingresos - chartData[0].ingresos) / chartData[0].ingresos * 100).toFixed(1);

  return (
    <div className="p-5 sm:p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-4">
      {/* Cabecera del Gráfico con Métricas Rápidas y Controles */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Recharts Analytics
            </span>
            <span className="text-slate-600 hidden sm:inline">•</span>
            <span className="text-xs text-slate-400 font-medium">Últimos 6 Meses (en Pesos $)</span>
          </div>
          <h3 className="text-lg sm:text-xl font-extrabold text-white tracking-tight flex items-center gap-2 mt-0.5">
            Tendencia de Ingresos Mensuales
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Evolución de facturación en pesos argentinos ($ ARS) y comparación con objetivo comercial.
          </p>
        </div>

        {/* Badges de Crecimiento & Toggle */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold flex items-center gap-1">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
              <polyline points="17 6 23 6 23 12"></polyline>
            </svg>
            +{crecimiento}% semestral
          </div>

          <button
            onClick={() => setShowMeta(!showMeta)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
              showMeta 
                ? 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700' 
                : 'bg-slate-950 text-slate-500 border-slate-800 hover:text-slate-300'
            }`}
          >
            {showMeta ? 'Ocultar Meta' : 'Mostrar Meta'}
          </button>
        </div>
      </div>

      {/* Resumen en Mini-Cards bajo la cabecera */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1">
        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
          <span className="text-[11px] font-semibold uppercase text-slate-400 block">Total Semestre ($)</span>
          <span className="text-base sm:text-lg font-bold text-white font-mono">
            $ {totalSemestre.toLocaleString('es-AR')}
          </span>
        </div>
        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
          <span className="text-[11px] font-semibold uppercase text-slate-400 block">Promedio / Mes ($)</span>
          <span className="text-base sm:text-lg font-bold text-emerald-400 font-mono">
            $ {promedioMensual.toLocaleString('es-AR')}
          </span>
        </div>
        <div className="col-span-2 sm:col-span-1 p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
          <span className="text-[11px] font-semibold uppercase text-slate-400 block">Mes Actual (Octubre)</span>
          <span className="text-base sm:text-lg font-bold text-white font-mono">
            $ {chartData[chartData.length - 1].ingresos.toLocaleString('es-AR')}
          </span>
        </div>
      </div>

      {/* Gráfico de Líneas con Recharts */}
      <div className="w-full h-72 sm:h-80 pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 10, right: 15, left: -5, bottom: 5 }}>
            <defs>
              <linearGradient id="colorIngresos" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.0}/>
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.4} vertical={false} />
            
            <XAxis 
              dataKey="mes" 
              stroke="#94a3b8" 
              fontSize={12} 
              tickLine={false} 
              axisLine={{ stroke: '#334155' }} 
            />
            
            <YAxis 
              stroke="#94a3b8" 
              fontSize={12} 
              tickLine={false} 
              axisLine={{ stroke: '#334155' }}
              tickFormatter={(val: number) => {
                if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
                if (val >= 1000) return `$${Math.round(val / 1000)}k`;
                return `$${val}`;
              }} 
            />

            <Tooltip 
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  const actualVal = payload.find(p => p.dataKey === 'ingresos')?.value;
                  const metaVal = payload.find(p => p.dataKey === 'meta')?.value;
                  return (
                    <div className="p-3 rounded-xl bg-slate-950/95 border border-slate-800 shadow-2xl backdrop-blur-md text-xs space-y-1.5">
                      <p className="font-bold text-white uppercase tracking-wider text-[11px] border-b border-slate-800 pb-1">
                        Mes: {label}
                      </p>
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-emerald-400 font-medium flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                          Ingresos Reales:
                        </span>
                        <span className="font-mono font-bold text-white">
                          $ {Number(actualVal).toLocaleString('es-AR')} Pesos
                        </span>
                      </div>
                      {showMeta && metaVal !== undefined && (
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-slate-400 font-medium flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-slate-500"></span>
                            Meta Proyectada:
                          </span>
                          <span className="font-mono font-medium text-slate-300">
                            $ {Number(metaVal).toLocaleString('es-AR')} Pesos
                          </span>
                        </div>
                      )}
                    </div>
                  );
                }
                return null;
              }}
            />

            <Legend 
              verticalAlign="top" 
              align="right" 
              height={36} 
              wrapperStyle={{ paddingBottom: '10px', fontSize: '12px' }}
              formatter={(value) => <span className="text-slate-300 text-xs font-medium mr-2">{value}</span>}
            />

            <Line
              type="monotone"
              dataKey="ingresos"
              name="Ingresos Reales ($)"
              stroke="#10b981"
              strokeWidth={3}
              dot={{ r: 5, fill: '#10b981', stroke: '#020617', strokeWidth: 2 }}
              activeDot={{ r: 8, fill: '#34d399', stroke: '#020617', strokeWidth: 3 }}
            />

            {showMeta && (
              <Line
                type="monotone"
                dataKey="meta"
                name="Meta Comercial ($)"
                stroke="#64748b"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={{ r: 3, fill: '#64748b' }}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
